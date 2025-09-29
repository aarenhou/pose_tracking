let cameraActive = false;
let recording = false;
let updateInterval = null;
let chartData = {
    timestamps: [],
    joint1: [],
    joint2: [],
    joint3: []
};

const MAX_DATA_POINTS = 50;

function toggleCamera() {
    const btn = document.getElementById('btnCamera');
    
    if (!cameraActive) {
        btn.disabled = true;
        btn.innerHTML = 'Camera啟動中<span class="loading"></span>';
        
        fetch('/start_camera', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    cameraActive = true;
                    document.getElementById('videoFeed').src = '/video_feed';
                    document.getElementById('videoFeed').style.display = 'block';
                    document.getElementById('videoPlaceholder').style.display = 'none';
                    btn.innerHTML = '關閉鏡頭';
                    btn.disabled = false;
                    document.getElementById('btnRecord').disabled = false;
                    showStatus('鏡頭已經啟動', 'active');
                    
                    // update 3D visualization and chart
                    startUpdating();
                }
            })
            .catch(error => {
                console.error('Error:', error);
                btn.innerHTML = '開啟鏡頭';
                btn.disabled = false;
                showStatus('無法啟動鏡頭', 'error');
            });
    } else {
        fetch('/stop_camera', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                cameraActive = false;
                document.getElementById('videoFeed').style.display = 'none';
                document.getElementById('videoPlaceholder').style.display = 'block';
                btn.innerHTML = '開啟鏡頭';
                document.getElementById('btnRecord').disabled = true;
                document.getElementById('btnStop').disabled = true;
                showStatus('鏡頭已經關閉', '');
                stopUpdating();
                recording = false;
            });
    }
}

function startRecording() {
    fetch('/start_recording', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                recording = true;
                document.getElementById('btnRecord').disabled = true;
                document.getElementById('btnStop').disabled = false;
                showStatus('正在記錄資料中', 'recording');
                
                // reset chart data
                chartData = {
                    timestamps: [],
                    joint1: [],
                    joint2: [],
                    joint3: []
                };
            }
        });
}

function stopRecording() {
    fetch('/stop_recording', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                recording = false;
                document.getElementById('btnRecord').disabled = false;
                document.getElementById('btnStop').disabled = true;
                showStatus(`記錄已經保存：${data.filename}`, 'active');
            }
        });
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
    status.style.display = 'block';
    
    if (type !== 'recording') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
}

function startUpdating() {
    updateInterval = setInterval(updateVisualizations, 100);
}

function stopUpdating() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

function updateVisualizations() {
    fetch('/pose_data')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success' && data.data) {
                update3DPlots(data.data);
                updateLineChart(data.data);
            }
        })
        .catch(error => console.error('Error fetching pose data:', error));
}

function update3DPlots(landmarks) {
    // prepare 3D pose data
    const x = landmarks.map(l => l.x);
    const y = landmarks.map(l => l.y);
    const z = landmarks.map(l => l.z);

    // MediaPipe human pose connections
    const connections = [
        [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
        [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
        [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32]
    ];

    // create lines for connections
    const lines_x = [], lines_y = [], lines_z = [];
    connections.forEach(conn => {
        lines_x.push(x[conn[0]], x[conn[1]], null);
        lines_y.push(y[conn[0]], y[conn[1]], null);
        lines_z.push(z[conn[0]], z[conn[1]], null);
    });

    // View 1
    const trace1_points = {
        x: x, y: y, z: z,
        mode: 'markers',
        type: 'scatter3d',
        marker: { size: 5, color: 'rgb(0, 200, 100)' }
    };

    const trace1_lines = {
        x: lines_x, y: lines_y, z: lines_z,
        mode: 'lines',
        type: 'scatter3d',
        line: { color: 'rgb(100, 150, 250)', width: 3 }
    };

    const layout1 = {
        scene: {
            camera: {
                eye: { x: 1.5, y: 1.5, z: 1.5 }
            },
            xaxis: { range: [0, 1] },
            yaxis: { range: [0, 1] },
            zaxis: { range: [-0.5, 0.5] }
        },
        margin: { l: 0, r: 0, t: 0, b: 0 },
        showlegend: false,
        height: 280
    };

    Plotly.react('plot3d_view1', [trace1_lines, trace1_points], layout1);

    // View 2
    const layout2 = {
        scene: {
            camera: {
                eye: { x: -1.5, y: 1.5, z: 1.5 }
            },
            xaxis: { range: [0, 1] },
            yaxis: { range: [0, 1] },
            zaxis: { range: [-0.5, 0.5] }
        },
        margin: { l: 0, r: 0, t: 0, b: 0 },
        showlegend: false,
        height: 280
    };

    Plotly.react('plot3d_view2', [trace1_lines, trace1_points], layout2);
}

function updateLineChart(landmarks) {
    const timestamp = chartData.timestamps.length;
    
    // angle calculation
    const joint1_angle = Math.abs(landmarks[13].y - landmarks[15].y) * 100;
    const joint2_angle = Math.abs(landmarks[25].y - landmarks[27].y) * 100;
    const joint3_angle = Math.abs(landmarks[11].y - landmarks[23].y) * 100;

    chartData.timestamps.push(timestamp);
    chartData.joint1.push(joint1_angle);
    chartData.joint2.push(joint2_angle);
    chartData.joint3.push(joint3_angle);

    // restrict datapoints
    if (chartData.timestamps.length > MAX_DATA_POINTS) {
        chartData.timestamps.shift();
        chartData.joint1.shift();
        chartData.joint2.shift();
        chartData.joint3.shift();
    }

    const trace1 = {
        x: chartData.timestamps,
        y: chartData.joint1,
        mode: 'lines',
        name: 'angle 1',
        line: { color: 'rgb(255, 0, 0)' }
    };

    const trace2 = {
        x: chartData.timestamps,
        y: chartData.joint2,
        mode: 'lines',
        name: 'angle 2',
        line: { color: 'rgb(0, 255, 0)' }
    };

    const trace3 = {
        x: chartData.timestamps,
        y: chartData.joint3,
        mode: 'lines',
        name: 'angle 3',
        line: { color: 'rgb(0, 0, 255)' }
    };

    const layout = {
        xaxis: { title: 'times' },
        yaxis: { title: 'angles' },
        margin: { l: 50, r: 30, t: 30, b: 50 },
        height: 300,
        legend: { x: 0, y: 1 }
    };

    Plotly.react('lineChart', [trace1, trace2, trace3], layout);
}

// initailize empty plots
window.onload = function() {
    const emptyLayout = {
        xaxis: { title: 'times' },
        yaxis: { title: 'angles' },
        margin: { l: 50, r: 30, t: 30, b: 50 },
        height: 300
    };
    Plotly.newPlot('lineChart', [], emptyLayout);
    
    const empty3DLayout = {
        scene: {
            xaxis: { range: [0, 1] },
            yaxis: { range: [0, 1] },
            zaxis: { range: [-0.5, 0.5] }
        },
        margin: { l: 0, r: 0, t: 0, b: 0 },
        height: 280
    };
    Plotly.newPlot('plot3d_view1', [], empty3DLayout);
    Plotly.newPlot('plot3d_view2', [], empty3DLayout);
};