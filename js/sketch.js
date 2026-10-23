var myGarden;
var gardenLineSignature = ''; // identifies which ?text=... params the saved garden belongs to
var debugOn = false; // toggled with "D"
var debugLayers = Object.assign({}, DEBUG_LAYERS_DEFAULT); // in debug, toggled with the panel's checkboxes
var debugStatsTime = 0; // ms; last update of the panel's stats
var simTime = 0; // s of simulated time not yet run as ticks
var lastTicks = 0; // ticks run in the last frame (shown in the debug panel)
var debugSpeed = 1; // in debug, set with the panel's slider

// plants and bases always show outside debug; in debug, only if their checkbox is on
function showLayer(name) {
    return !debugOn || debugLayers[name];
}

// how many seconds of simulated time pass per real second (outside debug always 1)
function simSpeed() {
    return debugOn ? debugSpeed : 1;
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    pixelDensity(1); // on HiDPI/Retina screens p5 would otherwise draw 4x as many pixels
    frameRate(TARGET_FPS);

    angleMode(DEGREES);
    colorMode(OKLCH);

    myGarden = new Garden();

    gardenLineSignature = JSON.stringify(new URLSearchParams(window.location.search).getAll('text'));
    if (!myGarden.loadState()) {
        myGarden.plant();
    }

    // right click is used to switch tools, so suppress the browser's context menu
    document.addEventListener('contextmenu', function (event) {
        event.preventDefault();
    });

    document.querySelectorAll('#tools [data-mode]').forEach(function (link) {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            setToolMode(link.dataset.mode);
        });
    });
    setToolMode(toolMode);

    document.getElementById('debug').style.fontSize = DEBUG_TEXT_SIZE + 'px';
    document.querySelectorAll('#debug [data-layer]').forEach(function (checkbox) {
        checkbox.checked = debugLayers[checkbox.dataset.layer];
        checkbox.addEventListener('change', function () {
            debugLayers[checkbox.dataset.layer] = checkbox.checked;
        });
    });
    var speedSlider = document.getElementById('sim-speed');
    speedSlider.addEventListener('input', function () {
        debugSpeed = Math.pow(SIM_SPEED_MAX, speedSlider.value);
        document.getElementById('sim-speed-value').textContent = round(debugSpeed) + 'x';
    });

    setupPinch(drawingContext.canvas);

    document.addEventListener('mouseleave', function () {
        mouseOverCanvas = false;
    });
    document.addEventListener('mouseenter', function () {
        mouseOverCanvas = true;
    });

    setInterval(function () {
        myGarden.saveState();
    }, GARDEN_SAVE_INTERVAL);
    window.addEventListener('beforeunload', function () {
        myGarden.saveState();
    });
}

function draw() {
    var dt = Math.min(deltaTime / 1000, MAX_FRAME_TIME); // seconds since the last frame

    // fixed-size ticks: speeding up runs more of them, so every part of the simulation sees the same step size
    simTime += dt * simSpeed();
    var ticks = 0;
    while (simTime >= SIM_TICK && ticks < SIM_TICKS_MAX) {
        myGarden.update(SIM_TICK);
        simTime -= SIM_TICK;
        ticks++;
    }
    if (ticks === SIM_TICKS_MAX) {
        simTime = 0; // too slow to keep up - drop the rest instead of piling it up
    }
    lastTicks = ticks;

    background(BACKGROUND_COLOR);
    strokeWeight(2);

    push();
    translate(width / 2, height / 2);
    myGarden.draw();
    pop();

    if (debugOn) {
        updateDebugStats();
    }
}

// a few times per second only - otherwise the fps number flickers
function updateDebugStats() {
    if (millis() - debugStatsTime < 250) return;
    debugStatsTime = millis();
    var lines = ['plants: ' + myGarden.myPlants.length, 'fps: ' + round(frameRate()), 'ticks/frame: ' + lastTicks];
    if (window.performance && performance.memory) { // Chrome only
        lines.push('memory: ' + round(performance.memory.usedJSHeapSize / 1048576) + ' MB');
    }
    document.getElementById('debug-stats').innerHTML = lines.join('<br>');
}

function keyPressed() {

    // F
    if (key === 'f' || key === 'F') {
        var fs = fullscreen();
        fullscreen(!fs);
    }

    // D
    if (key === 'd' || key === 'D') {
        debugOn = !debugOn;
        document.body.classList.toggle('debug', debugOn);
        debugStatsTime = 0; // show fresh stats right away
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
