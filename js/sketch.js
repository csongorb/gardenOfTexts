var myGarden;
var gardenLineSignature = ''; // identifies which ?text=... params the saved garden belongs to
var debugOn = false; // toggled with "D"
var debugLayers = Object.assign({}, DEBUG_LAYERS_DEFAULT); // in debug, toggled with the panel's checkboxes
var debugStatsTime = 0; // ms; last update of the panel's stats

// plants and bases always show outside debug; in debug, only if their checkbox is on
function showLayer(name) {
    return !debugOn || debugLayers[name];
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
    myGarden.update(dt);

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
    var lines = ['plants: ' + myGarden.myPlants.length, 'fps: ' + round(frameRate())];
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
