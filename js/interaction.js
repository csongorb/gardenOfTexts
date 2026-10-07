// the garden's origin (0, 0) is the center of the screen, so it stays centered when the window is resized
function gardenMouse() {
    if (pinchAnchor) {
        return pinchAnchor; // the tool circle stays put during/after a pinch
    }
    return { x: mouseX - width / 2, y: mouseY - height / 2 };
}

function drawToolCircle() {
    if (mouseOverCanvas) {
        noStroke();
        fill(TOOL_COLORS[toolMode]);
        ellipseMode(CENTER);
        var mouse = gardenMouse();
        ellipse(mouse.x, mouse.y, toolRadius * 2, toolRadius * 2 * PERSPECTIVE);
    }
}

// a light, still clearly colored version of the tool circle's color, for the active link
// (same hue at full brightness and saturation, then mixed a bit towards white so it reads on the dark background)
function lightToolColor(mode) {
    return 'rgb(' + intensifyColor(TOOL_COLORS[mode]).map(function (v) {
        return round(lerp(v, 255, 0.35));
    }).join(',') + ')';
}

function setToolMode(mode) {
    toolMode = mode;
    document.querySelectorAll('#tools [data-mode]').forEach(function (link) {
        link.style.color = link.dataset.mode === mode ? lightToolColor(mode) : '';
    });
}

function mousePressed(event) {
    if (!event || event.target.tagName !== 'CANVAS') return; // clicks on the links shouldn't also act on the garden

    if (event.pointerType === 'touch') return; // touch cuts on release instead, see mouseReleased()

    if (event.button === 2) { // right click
        setToolMode(toolMode === 'water' ? 'cut' : 'water');
    } else if (event.button === 0 && toolMode === 'cut') { // left click
        cutAtMouse();
    }
}

// on touch, a finger going down might be the start of a pinch - so cut only when the finger lifts
// and no second finger joined in the meantime
function mouseReleased(event) {
    if (!event || event.target.tagName !== 'CANVAS') return;
    if (event.pointerType === 'touch' && toolMode === 'cut' && !touchPinched) {
        cutAtMouse();
    }
}

function cutAtMouse() {
    myGarden.myPlants = myGarden.myPlants.filter(function (plant) {
        return !plant.mouseOver(toolRadius);
    });
}

function mouseWheel(event) {
    toolRadius = constrain(toolRadius - event.delta * 0.1, TOOL_RADIUS_MIN, TOOL_RADIUS_MAX);
    return false; // prevent the page itself from scrolling
}

// two-finger pinch on the canvas resizes the tool circle (the mobile version of the mouse wheel)
function setupPinch(canvasElement) {
    var startDist = 0; // finger distance when the pinch started, 0 = no pinch
    var startRadius = 0;

    function fingerDist(event) {
        var a = event.touches[0], b = event.touches[1];
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    canvasElement.addEventListener('touchstart', function (event) {
        if (event.touches.length === 1) {
            pinchAnchor = null; // a new single touch moves the tool circle again
        } else if (event.touches.length === 2) {
            startDist = fingerDist(event);
            startRadius = toolRadius;
            touchPinched = true;
            // freeze the circle at the first finger - otherwise it would jump to whichever finger moved last
            pinchAnchor = { x: event.touches[0].clientX - width / 2, y: event.touches[0].clientY - height / 2 };
        }
    });
    canvasElement.addEventListener('touchmove', function (event) {
        if (event.touches.length === 2 && startDist > 0) {
            toolRadius = constrain(startRadius * fingerDist(event) / startDist, TOOL_RADIUS_MIN, TOOL_RADIUS_MAX);
            event.preventDefault(); // no page zoom
        }
    }, { passive: false });
    function onTouchEnd(event) {
        if (event.touches.length < 2) {
            startDist = 0;
        }
        if (event.touches.length === 0) {
            touchPinched = false; // all fingers lifted (this runs after the pointer events, so mouseReleased() still sees the pinch)
        }
    }
    canvasElement.addEventListener('touchend', onTouchEnd);
    canvasElement.addEventListener('touchcancel', onTouchEnd);
}
