var myGarden;

var DEBUG = false;

function setup() {
    createCanvas(windowWidth, windowHeight);

    angleMode(DEGREES);

    myGarden = new Garden();
    myGarden.plant();
}

function draw() {
    background(20);
    strokeWeight(2);

    myGarden.display();
}

function mouseClicked() {
    for (var i = myGarden.myPlants.length - 1; i >= 0; i--) {
        if (myGarden.myPlants[i].mouseOver()) {
            myGarden.myPlants.splice(i, 1);
        }
    }
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

function resolveCoord(value, mid) {
    var s = String(value).trim();
    if (s === 'center') {
        return mid;
    }
    // a literal "+" in a URL query value is decoded as a space (e.g. "center+180" arrives as "center 180")
    var m = s.match(/^center\s*([+-]?\d+(\.\d+)?)$/);
    if (m) {
        return mid + Number(m[1]);
    }
    return Number(s);
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

class CharPlant {

    constructor(_char, _xPos, _yPos, _maxSize, _parentColor) {
        this.char = _char;
        this.x = _xPos;
        this.y = _yPos;
        this.maxSize = _maxSize + random(-_maxSize / 12, _maxSize / 12);
        this.size = 1;
        this.tilt = random(-8, 8);
        this.c = _parentColor ? varyColor(_parentColor, 40) : color(random(0, 255), random(0, 255), random(0, 255));
        this.fruitC = color(0, 220, 0);
        this.fruitW = 0.0;
        this.growthSpeed = 0.1; // per second
        this.spreadRange = this.maxSize;
        this.startMaturingAt = 0.8;
        this.isGrown = false;
        this.isMaturing = false;
    }

    preGrow() {
        this.size = random(this.maxSize / 2, this.maxSize);
        this.spreadRange = this.maxSize * 0.8;
    }

    reset() {
        this.size = 1;
        this.isGrown = false;
        this.isMaturing = false;
        this.fruitW = 0.0;

        var v = this.maxSize / 4;
        this.x = this.x + random(-v, v);
        this.y = this.y + random(-v, v);
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

    displayGround() {
        if (this.mouseOver()) {
            stroke(200);
        } else {
            noStroke();
        }
        fill(80);

        ellipseMode(CENTER);
        ellipse(this.x, this.y, this.maxSize / 2, this.maxSize / 4);

        if (DEBUG && this.mouseOver()) {
            noFill();
            stroke(255, 80, 80);
            strokeWeight(1);
            ellipse(this.x, this.y, this.spreadRange * 2, this.spreadRange * 2);
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

            if (this.mouseOver()) {
                g = g * 20;
            }

            this.size = this.size + g;

            if (this.size > this.maxSize) {
                this.isGrown = true;
            }
        }

        if (this.isGrown) {
            this.reset();
            this.plantNewPlants(0, 2, this.spreadRange);
        }
    }

    plantNewPlants(min, max, range) {
        var newPlants = random(min, max);
        for (var i = 0; i < newPlants; i++) {
            var angle = random(0, 360);
            var radius = random(0, range);
            var nx = this.x + radius * cos(angle);
            var ny = this.y + radius * sin(angle);
            if (myGarden.hasSpaceAt(nx, ny, this.maxSize / 4)) {
                myGarden.myPlants.push(new CharPlant(this.char, nx, ny, this.maxSize, this.c));
            }
        }
        myGarden.myPlants.sort(myGarden.compare);
    }

    mouseOver() {
        var r = false;
        var d = dist(mouseX, mouseY, this.x, this.y);
        if (d < 10) {
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
            var xPos = resolveCoord(line.x, windowWidth / 2) - lineWidth / 2;
            var yPos = resolveCoord(line.y, windowHeight / 2);
            this.plantTextWithCharPlants(line.text, xPos, yPos, line.size);
        }

        for (var i = 0; i < this.myPlants.length; i++) {
            this.myPlants[i].preGrow();
        }
        this.myPlants.sort(this.compare);
    }

    display() {
        for (var i = 0; i < myGarden.myPlants.length; i++) {
            this.myPlants[i].grow();
        }
        for (var i = 0; i < myGarden.myPlants.length; i++) {
            this.myPlants[i].displayGround();
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
            if (dist(x, y, other.x, other.y) < minDist) {
                return false;
            }
        }
        return true;
    }
}
