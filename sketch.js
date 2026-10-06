var myGarden;

var mouseOverCanvas = true;

var DEBUG = false;
var toolRadius = 100; // size of the tool circle around the mouse (mouse wheel changes it)
var toolMode = 'water'; // 'water': hovering boosts growth / 'cut': left click removes plants; right click toggles
var TOOL_COLORS = { water: [5, 30, 95], cut: [90, 10, 10] };
var PERSPECTIVE = 0.40; // 1 = circular/top-down; smaller = flatter, more angled ground-plane ellipse

var SIZE_MIN_FACTOR = 0.6; // a plant's maxSize stays within [SIZE_MIN_FACTOR, SIZE_MAX_FACTOR] x its letter's original size
var SIZE_MAX_FACTOR = 1.4;
var SIZE_MUTATION = 1 / 20; // a child's maxSize = parent's +/- up to this fraction
var GROW_DURATION_DEFAULT = 600; // seconds from seed to full size (without watering)
var GROW_DURATION_MIN = 120;
var GROW_DURATION_MAX = 1800;
var GROW_DURATION_MUTATION = 1 / 12; // a child's grow duration = parent's +/- up to this fraction
var COLOR_MUTATION = 35; // a child's r, g and b = parent's +/- up to this amount (0-255)

var GARDEN_STORAGE_KEY = 'gardenOfTextState'; // plant positions are relative to the screen center
var GARDEN_SAVE_INTERVAL = 5000; // ms
var gardenLineSignature = ''; // identifies which ?line=... params the saved garden belongs to

function ellipticalDist(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = (y1 - y2) / PERSPECTIVE;
    return sqrt(dx * dx + dy * dy);
}

// the garden's origin (0, 0) is the center of the screen, so it stays centered when the window is resized
function gardenMouse() {
    return { x: mouseX - width / 2, y: mouseY - height / 2 };
}

// true if a plant of the given size at (x, y) would be fully on screen
// (text is drawn centered horizontally, above its baseline at y)
function isOnScreen(x, y, size) {
    var halfW = width / 2;
    var halfH = height / 2;
    return x - size / 2 >= -halfW && x + size / 2 <= halfW &&
           y - size >= -halfH && y + size / 4 <= halfH;
}

function setup() {
    createCanvas(windowWidth, windowHeight);

    angleMode(DEGREES);

    myGarden = new Garden();

    gardenLineSignature = JSON.stringify(new URLSearchParams(window.location.search).getAll('line'));
    if (!myGarden.loadState()) {
        myGarden.plant();
    }

    // right click is used to switch tools, so suppress the browser's context menu
    document.addEventListener('contextmenu', function (event) {
        event.preventDefault();
    });

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

function drawToolCircle() {
    if (mouseOverCanvas) {
        noStroke();
        fill(TOOL_COLORS[toolMode]);
        ellipseMode(CENTER);
        var mouse = gardenMouse();
        ellipse(mouse.x, mouse.y, toolRadius * 2, toolRadius * 2 * PERSPECTIVE);
    }
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
    pop();
}

function mousePressed(event) {
    if (event.button === 2) { // right click
        toolMode = toolMode === 'water' ? 'cut' : 'water';
    } else if (event.button === 0 && toolMode === 'cut') { // left click
        myGarden.myPlants = myGarden.myPlants.filter(function (plant) {
            return !plant.mouseOver(toolRadius);
        });
    }
}

function mouseWheel(event) {
    toolRadius = constrain(toolRadius - event.delta * 0.1, 30, 500);
    return false; // prevent the page itself from scrolling
}

function keyPressed() {
    print(keyCode);

    // F
    if (key === 'f' || key === 'F') {
        var fs = fullscreen();
        fullscreen(!fs);
    }

    // 1
    if (key === '1') {
        DEBUG = !DEBUG;
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

// returns a coordinate relative to the screen center
// ("center" -> 0, "center+180" -> 180, a plain number is measured from the left/top edge of the current window)
function resolveCoord(value, screenSize) {
    var s = String(value).trim();
    if (s === 'center') {
        return 0;
    }
    // a literal "+" in a URL query value is decoded as a space (e.g. "center+180" arrives as "center 180")
    var m = s.match(/^center\s*([+-]?\d+(\.\d+)?)$/);
    if (m) {
        return Number(m[1]);
    }
    return Number(s) - screenSize / 2;
}

function getGardenLines() {
    var rawLines = new URLSearchParams(window.location.search).getAll('line');
    var lines = [];
    for (var i = 0; i < rawLines.length; i++) {
        var parts = rawLines[i].split(',');
        lines.push({
            text: parts[0],
            x: parts[1] !== undefined ? parts[1] : 'center',
            y: parts[2] !== undefined ? parts[2] : 'center',
            size: parts[3] !== undefined ? Number(parts[3]) : 80
        });
    }
    if (lines.length === 0) {
        lines.push({ text: 'Garden', x: 'center', y: 'center-100', size: 120 });
        lines.push({ text: 'of', x: 'center', y: 'center', size: 80 });
        lines.push({ text: 'Texts', x: 'center', y: 'center+100', size: 120 });
    }
    return lines;
}

// =================================
// CharPlant
// =================================

function varyColor(baseColor, amount) {
    var r = constrain(red(baseColor) + random(-amount, amount), 0, 255);
    var g = constrain(green(baseColor) + random(-amount, amount), 0, 255);
    var b = constrain(blue(baseColor) + random(-amount, amount), 0, 255);
    return color(r, g, b);
}

function ensureMinBrightness(col, minBrightness) {
    var r = red(col), g = green(col), b = blue(col);
    var brightness = (r + g + b) / 3;
    if (brightness < minBrightness) {
        var boost = minBrightness - brightness;
        r = constrain(r + boost, 0, 255);
        g = constrain(g + boost, 0, 255);
        b = constrain(b + boost, 0, 255);
    }
    return color(r, g, b);
}

function charPlantFromSerialized(data) {
    var plant = new CharPlant(data.char, data.x, data.y, data.maxSize, data.baseSize);
    plant.maxSize = data.maxSize;
    plant.size = data.size;
    plant.tilt = data.tilt;
    plant.spreadRange = data.spreadRange;
    plant.isMaturing = data.isMaturing;
    plant.growDuration = data.growDuration;
    plant.c = color(data.r, data.g, data.b);
    return plant;
}

class CharPlant {

    constructor(_char, _xPos, _yPos, _maxSize, _baseSize, _parentColor, _parentGrowDuration) {
        this.char = _char;
        this.x = _xPos;
        this.y = _yPos;
        this.baseSize = _baseSize; // the letter's original size, unchanged across generations
        this.maxSize = constrain(_maxSize + random(-_maxSize * SIZE_MUTATION, _maxSize * SIZE_MUTATION), _baseSize * SIZE_MIN_FACTOR, _baseSize * SIZE_MAX_FACTOR);
        this.size = 1;
        this.tilt = random(-8, 8);
        this.c = ensureMinBrightness(_parentColor ? varyColor(_parentColor, COLOR_MUTATION) : color(random(0, 255), random(0, 255), random(0, 255)), 75);
        this.fruitC = color(0, 220, 0);
        this.fruitW = 0.0;
        var duration = _parentGrowDuration || GROW_DURATION_DEFAULT;
        this.growDuration = constrain(duration + random(-duration * GROW_DURATION_MUTATION, duration * GROW_DURATION_MUTATION), GROW_DURATION_MIN, GROW_DURATION_MAX); // seconds to full size
        this.spreadRange = this.maxSize;
        this.startMaturingAt = 0.8;
        this.isGrown = false;
        this.isMaturing = false;
        this.isDead = false;
    }

    preGrow() {
        this.size = random(this.maxSize / 2, this.maxSize);
        this.spreadRange = this.maxSize * 0.8;
    }

    serialize() {
        return {
            char: this.char,
            x: this.x,
            y: this.y,
            maxSize: this.maxSize,
            size: this.size,
            tilt: this.tilt,
            spreadRange: this.spreadRange,
            isMaturing: this.isMaturing,
            baseSize: this.baseSize,
            growDuration: this.growDuration,
            r: red(this.c),
            g: green(this.c),
            b: blue(this.c)
        };
    }

    displayPlants() {
        stroke(this.c);
        strokeWeight(this.fruitW);
        fill(this.c);
        textSize(this.size);
        textAlign(CENTER);

        if (this.isMaturing == true) {
            stroke(this.fruitC);
        }

        push();
        translate(this.x, this.y);
        rotate(this.tilt);
        text(this.char, 0, 0);
        pop();
    }

    displayGroundFill() {
        noStroke();
        fill(40);

        ellipseMode(CENTER);
        ellipse(this.x, this.y, this.maxSize / 2, (this.maxSize / 2) * PERSPECTIVE);

        if (DEBUG && this.mouseOver()) {
            noFill();
            stroke(255, 80, 80);
            strokeWeight(1);
            ellipse(this.x, this.y, this.spreadRange * 2, this.spreadRange * 2 * PERSPECTIVE);
        }
    }

    // drawn after the tool circle, so a plant's outline stays visible even where the tool circle covers it
    displayGroundOutline() {
        noFill();
        ellipseMode(CENTER);

        stroke(80); // same color as the ground fill
        strokeWeight(1.5);
        ellipse(this.x, this.y, this.maxSize / 2, (this.maxSize / 2) * PERSPECTIVE);
    }

    grow() {

        if (!this.isMaturing) {
            if (this.size / this.maxSize >= this.startMaturingAt) {
                this.isMaturing = true;
            }
        }

        if (!this.isGrown) {

            if (this.isMaturing) {
                var l = 1 - (1 - (this.size / this.maxSize)) / (1 - this.startMaturingAt);
                this.fruitC = lerpColor(this.c, color(220, 0, 0), l);
                this.fruitW = lerp(0.0, 5.0, l);
            }

            var g = (1.0 / frameRate()) * (this.maxSize / this.growDuration); // full size after growDuration seconds, regardless of size
            if (g == "Infinity") {
                g = 0;
            }

            if ((toolMode === 'water' && mouseOverCanvas && this.mouseOver(toolRadius)) || (DEBUG && (keyIsDown('g') || keyIsDown('G')))) { // hold "G" to speed up all growth
                g = g * 20;
            }

            this.size = this.size + g;

            if (this.size > this.maxSize) {
                this.isGrown = true;
            }
        }

        if (this.isGrown) {
            this.plantNewPlants(0, 3, this.spreadRange);
            this.isDead = true; // replaced by its successor, rather than cloning itself alongside it
        }
    }

    randomPositionNear(maxRadius) {
        var angle = random(0, 360);
        var radius = random(0, maxRadius);
        return {
            x: this.x + radius * cos(angle),
            y: this.y + radius * sin(angle) * PERSPECTIVE
        };
    }

    // always plants one successor close to the parent's spot, ignoring the space check,
    // so a replacement keeps the shape readable even if the area is already crowded
    plantSuccessor(range) {
        var maxRadius = this.maxSize / 8; // stays within its own ground-circle radius
        var pos = this.randomPositionNear(maxRadius);
        if (!isOnScreen(pos.x, pos.y, this.maxSize)) {
            pos = { x: this.x, y: this.y }; // don't drift off screen - stay on the parent's spot instead
        }
        myGarden.myPlants.push(new CharPlant(this.char, pos.x, pos.y, this.maxSize, this.baseSize, this.c, this.growDuration));
    }

    // plants one scattered plant at the full range, only if it's on screen and there's enough space for it
    plantSpread(range) {
        var pos = this.randomPositionNear(range);
        if (isOnScreen(pos.x, pos.y, this.maxSize) && myGarden.hasSpaceAt(pos.x, pos.y, this.maxSize / 4)) {
            myGarden.myPlants.push(new CharPlant(this.char, pos.x, pos.y, this.maxSize, this.baseSize, this.c, this.growDuration));
        }
    }

    plantNewPlants(min, max, range) {
        this.plantSuccessor(range);

        var spreadCount = random(min, max);
        for (var i = 0; i < spreadCount; i++) {
            this.plantSpread(range);
        }
    }

    mouseOver(radius) {
        var r = false;
        var mouse = gardenMouse();
        var d = ellipticalDist(mouse.x, mouse.y, this.x, this.y);
        if (d < (radius || 10)) {
            r = true;
        }
        return r;
    }
}

// =================================
// Garden
// =================================

class Garden {
    constructor() {
        this.myPlants = []; // array of objects

        this.rowPos = 100;
        this.startPos = 100;
    }

    plant() {
        var lines = getGardenLines();
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var lineWidth = (line.text.length - 1) * (line.size / 2);
            var xPos = resolveCoord(line.x, width) - lineWidth / 2;
            var yPos = resolveCoord(line.y, height);
            this.plantTextWithCharPlants(line.text, xPos, yPos, line.size);
        }

        for (var i = 0; i < this.myPlants.length; i++) {
            this.myPlants[i].preGrow();
        }
        this.myPlants.sort(this.compare);
    }

    saveState() {
        try {
            var data = this.myPlants.map(function (plant) {
                return plant.serialize();
            });
            localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ signature: gardenLineSignature, plants: data }));
        } catch (e) {
            // localStorage unavailable (e.g. private browsing) - skip saving
        }
    }

    loadState() {
        try {
            var raw = localStorage.getItem(GARDEN_STORAGE_KEY);
            if (!raw) return false;
            var saved = JSON.parse(raw);
            if (!saved || saved.signature !== gardenLineSignature) return false; // different ?line=... params - start fresh
            if (!Array.isArray(saved.plants) || saved.plants.length === 0) return false;
            this.myPlants = saved.plants.map(charPlantFromSerialized);
            return true;
        } catch (e) {
            return false;
        }
    }

    display() {
        for (var i = 0; i < myGarden.myPlants.length; i++) {
            this.myPlants[i].grow();
        }
        this.myPlants = this.myPlants.filter(function (plant) {
            return !plant.isDead;
        });
        this.myPlants.sort(this.compare);
        for (var i = 0; i < myGarden.myPlants.length; i++) {
            this.myPlants[i].displayGroundFill();
        }
        drawToolCircle();
        for (var i = 0; i < myGarden.myPlants.length; i++) {
            this.myPlants[i].displayGroundOutline();
        }
        for (var i = 0; i < myGarden.myPlants.length; i++) {
            this.myPlants[i].displayPlants();
        }
    }

    plantTextWithCharPlants(text, xPos, yPos, maxCharSize) {
        var splitString = text.split('');
        for (var i = 0; i < splitString.length; i++) {
            if (splitString[i] === ' ') continue;
            this.myPlants.push(new CharPlant(splitString[i], xPos + (i * maxCharSize / 2), yPos, maxCharSize, maxCharSize));
        }
    }

    compare(a, b) {
        if (a.y < b.y)
            return -1;
        if (a.y > b.y)
            return 1;
        return 0;
    }

    hasSpaceAt(x, y, radius) {
        var overlapAllowance = 0.7; // allow ~30% overlap of combined radii
        for (var i = 0; i < this.myPlants.length; i++) {
            var other = this.myPlants[i];
            var minDist = (radius + other.maxSize / 4) * overlapAllowance;
            if (ellipticalDist(x, y, other.x, other.y) < minDist) {
                return false;
            }
        }
        return true;
    }
}
