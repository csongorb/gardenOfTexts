var myGarden;

var mouseOverCanvas = true;

var DEBUG = false;
var growRadius = 100; // how far from the mouse plants get the hover growth boost
var PERSPECTIVE = 0.40; // 1 = circular/top-down; smaller = flatter, more angled ground-plane ellipse

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

function setup() {
    createCanvas(windowWidth, windowHeight);

    angleMode(DEGREES);

    myGarden = new Garden();

    gardenLineSignature = JSON.stringify(new URLSearchParams(window.location.search).getAll('line'));
    if (!myGarden.loadState()) {
        myGarden.plant();
    }

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

function drawWateringCircle() {
    if (mouseOverCanvas) {
        noStroke();
        fill(5, 30, 95);
        ellipseMode(CENTER);
        var mouse = gardenMouse();
        ellipse(mouse.x, mouse.y, growRadius * 2, growRadius * 2 * PERSPECTIVE);
    }
}

function draw() {
    background(20);
    strokeWeight(2);

    push();
    translate(width / 2, height / 2);
    myGarden.display();
    pop();
}

function mouseClicked() {
    for (var i = myGarden.myPlants.length - 1; i >= 0; i--) {
        if (myGarden.myPlants[i].mouseOver()) {
            myGarden.myPlants.splice(i, 1);
        }
    }
}

function mouseWheel(event) {
    growRadius = constrain(growRadius - event.delta * 0.1, 30, 500);
    return false; // prevent the page itself from scrolling
}

function keyPressed() {
    print(keyCode);

    // F
    if (key === 'f' || key === 'F') {
        var fs = fullscreen();
        fullscreen(!fs);
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
    var plant = new CharPlant(data.char, data.x, data.y, data.maxSize);
    plant.maxSize = data.maxSize;
    plant.size = data.size;
    plant.tilt = data.tilt;
    plant.spreadRange = data.spreadRange;
    plant.isMaturing = data.isMaturing;
    plant.growthSpeed = data.growthSpeed;
    plant.c = color(data.r, data.g, data.b);
    return plant;
}

class CharPlant {

    constructor(_char, _xPos, _yPos, _maxSize, _parentColor, _parentGrowthSpeed) {
        this.char = _char;
        this.x = _xPos;
        this.y = _yPos;
        this.maxSize = _maxSize + random(-_maxSize / 12, _maxSize / 12);
        this.size = 1;
        this.tilt = random(-8, 8);
        this.c = ensureMinBrightness(_parentColor ? varyColor(_parentColor, 40) : color(random(0, 255), random(0, 255), random(0, 255)), 75);
        this.fruitC = color(0, 220, 0);
        this.fruitW = 0.0;
        this.growthSpeed = _parentGrowthSpeed ? constrain(_parentGrowthSpeed + random(-_parentGrowthSpeed / 6, _parentGrowthSpeed / 6), 0.02, 0.3) : 0.1; // per second
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
            growthSpeed: this.growthSpeed,
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
        fill(80);

        ellipseMode(CENTER);
        ellipse(this.x, this.y, this.maxSize / 2, (this.maxSize / 2) * PERSPECTIVE);

        if (DEBUG && this.mouseOver()) {
            noFill();
            stroke(255, 80, 80);
            strokeWeight(1);
            ellipse(this.x, this.y, this.spreadRange * 2, this.spreadRange * 2 * PERSPECTIVE);
        }
    }

    // drawn after the watering circle, so a plant's outline stays visible even where the watering circle covers it
    displayGroundOutline() {
        noFill();
        ellipseMode(CENTER);

        stroke(80); // same color as the ground fill
        strokeWeight(1.5);
        ellipse(this.x, this.y, this.maxSize / 2, (this.maxSize / 2) * PERSPECTIVE);

        if (this.mouseOver()) {
            stroke(255, 60, 60);
            strokeWeight(2);
            ellipse(this.x, this.y, this.maxSize / 2, (this.maxSize / 2) * PERSPECTIVE);
        }
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

            var g = (1.0 / frameRate()) * this.growthSpeed;
            if (g == "Infinity") {
                g = 0;
            }

            if (this.mouseOver(growRadius) || (DEBUG && (keyIsDown('g') || keyIsDown('G')))) { // hold "G" to speed up all growth
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
        myGarden.myPlants.push(new CharPlant(this.char, pos.x, pos.y, this.maxSize, this.c, this.growthSpeed));
    }

    // plants one scattered plant at the full range, only if there's enough space for it
    plantSpread(range) {
        var pos = this.randomPositionNear(range);
        if (myGarden.hasSpaceAt(pos.x, pos.y, this.maxSize / 4)) {
            myGarden.myPlants.push(new CharPlant(this.char, pos.x, pos.y, this.maxSize, this.c, this.growthSpeed));
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
        drawWateringCircle();
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
            this.myPlants.push(new CharPlant(splitString[i], xPos + (i * maxCharSize / 2), yPos, maxCharSize));
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
