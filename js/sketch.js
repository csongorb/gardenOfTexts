function setup() {
    createCanvas(windowWidth, windowHeight);
    pixelDensity(1); // on HiDPI/Retina screens p5 would otherwise draw 4x as many pixels
    frameRate(TARGET_FPS);

    angleMode(DEGREES);

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
    background(20);
    strokeWeight(2);

    push();
    translate(width / 2, height / 2);
    myGarden.display();
    pop();

    if (DEBUG) {
        drawDebugInfo();
    }
}

function drawDebugInfo() {
    push();
    noStroke();
    fill(220);
    textSize(16);
    textAlign(LEFT, TOP);
    text('plants: ' + myGarden.myPlants.length, 10, 10);
    text('fps: ' + round(frameRate()), 10, 30);
    if (window.performance && performance.memory) { // Chrome only
        text('memory: ' + round(performance.memory.usedJSHeapSize / 1048576) + ' MB', 10, 50);
    }
    pop();
}

function keyPressed() {

    // F
    if (key === 'f' || key === 'F') {
        var fs = fullscreen();
        fullscreen(!fs);
    }

    // D
    if (key === 'd' || key === 'D') {
        DEBUG = !DEBUG;
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
