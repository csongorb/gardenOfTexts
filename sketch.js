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
var COLOR_MUTATION = 25; // a child's r, g and b = parent's +/- up to this amount (0-255)

var SPREAD_RANGE_FACTOR = 0.8; // seeds land up to this x maxSize away from the parent
var INITIAL_SPREAD_RANGE_FACTOR = 0.6; // same, for the initially planted text (keeps it readable at first)
var SEEDS_MIN = 1; // number of scattered seeds per grown plant (besides its successor)
var SEEDS_MAX = 3;
var ALWAYS_PLANT_SUCCESSOR = false; // true: a grown plant is always replaced near its spot (keeps the text readable); false: only seeds that find space, so plants can die out
var SUCCESSOR_DRIFT_FACTOR = 1 / 8; // the successor lands up to this x maxSize away from its parent (ignores the space check)
var SPACE_OVERLAP_ALLOWANCE = 0.9; // a seed needs distance >= (sum of ground-circle radii) x this; 1 = ground circles may only touch, smaller = more overlap
var RARE_SPROUT_CHANCE = 1 / 30; // per second, for an extinct lineage (one lineage per letter of the original text)
var RARE_POPULATION_SCALE = 1.5; // how fast that chance fades with living plants: chance x e^(-count / scale); 1.5 -> 1: 51%, 2: 26%, 5: 4%
var FRUIT_SATURATION_BOOST = 1.5; // the fruiting outline is the plant's color at full brightness, with saturation multiplied by this

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
    pixelDensity(1); // on HiDPI/Retina screens p5 would otherwise draw 4x as many pixels

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

// same hue, but full brightness and boosted saturation (rgb as [r, g, b], 0-255)
function intensifyColor(rgb) {
    var mx = Math.max(rgb[0], rgb[1], rgb[2]);
    var mn = Math.min(rgb[0], rgb[1], rgb[2]);
    if (mx === mn) {
        return [255, 255, 255]; // grey has no hue to intensify
    }
    var saturation = Math.min(1, ((mx - mn) / mx) * FRUIT_SATURATION_BOOST);
    return rgb.map(function (c) {
        return 255 * (1 - saturation * (mx - c) / (mx - mn));
    });
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
    var plant = new CharPlant(data.char, data.x, data.y, data.maxSize, data.baseSize, undefined, undefined, data.lineage);
    plant.maxSize = data.maxSize;
    plant.size = data.size;
    plant.tilt = data.tilt;
    plant.spreadRange = data.spreadRange;
    plant.isMaturing = data.isMaturing;
    plant.growDuration = data.growDuration;
    plant.setColor(color(data.r, data.g, data.b));
    return plant;
}

class CharPlant {

    constructor(_char, _xPos, _yPos, _maxSize, _baseSize, _parentColor, _parentGrowDuration, _lineage) {
        this.char = _char;
        this.lineage = _lineage; // index of the original letter this plant descends from
        this.x = _xPos;
        this.y = _yPos;
        this.baseSize = _baseSize; // the letter's original size, unchanged across generations
        this.maxSize = constrain(_maxSize + random(-_maxSize * SIZE_MUTATION, _maxSize * SIZE_MUTATION), _baseSize * SIZE_MIN_FACTOR, _baseSize * SIZE_MAX_FACTOR);
        this.size = 1;
        this.tilt = random(-8, 8);
        this.setColor(ensureMinBrightness(_parentColor ? varyColor(_parentColor, COLOR_MUTATION) : color(random(0, 255), random(0, 255), random(0, 255)), 75));
        this.fruitStr = this.cStr;
        this.fruitW = 0.0;
        var duration = _parentGrowDuration || GROW_DURATION_DEFAULT;
        this.growDuration = constrain(duration + random(-duration * GROW_DURATION_MUTATION, duration * GROW_DURATION_MUTATION), GROW_DURATION_MIN, GROW_DURATION_MAX); // seconds to full size
        this.spreadRange = this.maxSize * SPREAD_RANGE_FACTOR;
        this.startMaturingAt = 0.8;
        this.isGrown = false;
        this.isMaturing = false;
        this.isDead = false;
    }

    // caches the color as plain numbers and a CSS string, so drawing doesn't need p5.Color conversions every frame
    setColor(col) {
        this.c = col;
        this.rgb = [red(col), green(col), blue(col)];
        this.cStr = 'rgb(' + this.rgb[0] + ',' + this.rgb[1] + ',' + this.rgb[2] + ')';
        this.fruitRgb = intensifyColor(this.rgb);
    }

    preGrow() {
        this.size = random(this.maxSize / 2, this.maxSize);
        this.spreadRange = this.maxSize * INITIAL_SPREAD_RANGE_FACTOR;
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
            lineage: this.lineage,
            r: red(this.c),
            g: green(this.c),
            b: blue(this.c)
        };
    }

    // drawn with the canvas context directly - p5's text()/fill()/stroke() are too slow for hundreds of plants per frame
    displayPlants() {
        var ctx = drawingContext;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(radians(this.tilt));
        ctx.font = this.size + 'px sans-serif'; // p5's default font
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic'; // p5's default BASELINE
        ctx.fillStyle = this.cStr;
        ctx.fillText(this.char, 0, 0);
        if (this.fruitW > 0) {
            ctx.lineWidth = this.fruitW;
            ctx.strokeStyle = this.fruitStr;
            ctx.strokeText(this.char, 0, 0);
        }
        ctx.restore();
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
                this.fruitStr = 'rgb(' + lerp(this.rgb[0], this.fruitRgb[0], l) + ',' + lerp(this.rgb[1], this.fruitRgb[1], l) + ',' + lerp(this.rgb[2], this.fruitRgb[2], l) + ')';
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
            this.isDead = true; // set before planting, so the parent's own spot counts as free for its seeds
            this.plantNewPlants(SEEDS_MIN, SEEDS_MAX, this.spreadRange);
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
        var maxRadius = this.maxSize * SUCCESSOR_DRIFT_FACTOR;
        var pos = this.randomPositionNear(maxRadius);
        if (!isOnScreen(pos.x, pos.y, this.maxSize)) {
            pos = { x: this.x, y: this.y }; // don't drift off screen - stay on the parent's spot instead
        }
        myGarden.myPlants.push(this.makeChild(pos.x, pos.y));
    }

    // a new seedling at (x, y), inheriting this plant's genes (with mutation) and lineage
    makeChild(x, y) {
        return new CharPlant(this.char, x, y, this.maxSize, this.baseSize, this.c, this.growDuration, this.lineage);
    }

    // plants one scattered plant at the full range, only if it's on screen and there's enough space for it
    // (returns whether it was planted)
    plantSpread(range) {
        var pos = this.randomPositionNear(range);
        if (isOnScreen(pos.x, pos.y, this.maxSize) && myGarden.hasSpaceAt(pos.x, pos.y, this.maxSize / 4)) {
            myGarden.myPlants.push(this.makeChild(pos.x, pos.y));
            return true;
        }
        return false;
    }

    plantNewPlants(min, max, range) {
        if (ALWAYS_PLANT_SUCCESSOR) {
            this.plantSuccessor(range);
        }

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
        this.lineageMemory = []; // per lineage (original letter): its last seen living plant, so an extinct lineage can sprout again there

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
            var memory = this.lineageMemory.map(function (plant) {
                return plant.serialize();
            });
            localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ signature: gardenLineSignature, plants: data, lineageMemory: memory }));
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
            var plants = saved.plants.map(charPlantFromSerialized);
            this.lineageMemory = saved.lineageMemory.map(charPlantFromSerialized);
            this.myPlants = plants;
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
        this.sproutRare();
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
            var plant = new CharPlant(splitString[i], xPos + (i * maxCharSize / 2), yPos, maxCharSize, maxCharSize, undefined, undefined, this.lineageMemory.length);
            this.myPlants.push(plant);
            this.lineageMemory.push(plant);
        }
    }

    // lineages with few living plants get extra sprouts around their population (the fewer, the likelier);
    // an extinct lineage sprouts again near its last seen plant
    sproutRare() {
        var dt = Math.min(deltaTime / 1000, 0.1); // a backgrounded tab shouldn't cause a burst of sprouts
        var members = this.lineageMemory.map(function () {
            return [];
        });
        for (var i = 0; i < this.myPlants.length; i++) {
            var plant = this.myPlants[i];
            var group = members[plant.lineage];
            if (!group) continue; // unknown lineage
            group.push(plant);
            this.lineageMemory[plant.lineage] = plant;
        }

        for (var l = 0; l < members.length; l++) {
            var count = members[l].length;
            var chance = RARE_SPROUT_CHANCE * Math.exp(-count / RARE_POPULATION_SCALE) * dt;
            if (random() >= chance) continue;
            var parent = count > 0 ? random(members[l]) : this.lineageMemory[l];
            if (parent) {
                this.sproutNear(parent, count === 0);
            }
        }
    }

    // tries a few spots around the parent; if forced (extinct lineage) and none is free, sprouts on the parent's own spot
    sproutNear(parent, force) {
        for (var attempt = 0; attempt < 5; attempt++) {
            if (parent.plantSpread(parent.spreadRange)) return;
        }
        if (force) {
            this.myPlants.push(parent.makeChild(parent.x, parent.y));
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
        for (var i = 0; i < this.myPlants.length; i++) {
            var other = this.myPlants[i];
            if (other.isDead) continue;
            var minDist = (radius + other.maxSize / 4) * SPACE_OVERLAP_ALLOWANCE;
            if (ellipticalDist(x, y, other.x, other.y) < minDist) {
                return false;
            }
        }
        return true;
    }
}
