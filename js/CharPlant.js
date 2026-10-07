// =================================
// CharPlant
// =================================

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
        this.tilt = random(-TILT_MAX, TILT_MAX);
        this.setColor(ensureMinBrightness(_parentColor ? varyColor(_parentColor, COLOR_MUTATION) : color(random(0, 255), random(0, 255), random(0, 255)), MIN_BRIGHTNESS));
        this.fruitStr = this.cStr;
        this.fruitW = 0.0;
        var duration = _parentGrowDuration || GROW_DURATION_DEFAULT;
        this.growDuration = constrain(duration + random(-duration * GROW_DURATION_MUTATION, duration * GROW_DURATION_MUTATION), GROW_DURATION_MIN, GROW_DURATION_MAX); // seconds to full size
        this.spreadRange = this.maxSize * SPREAD_RANGE_FACTOR;
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
        ctx.font = Math.round(this.size) + 'px sans-serif'; // p5's default font; whole pixels, so the browser doesn't render & cache glyphs at ever-new fractional sizes
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

    // adds this plant's ground ellipse to the current canvas path (all of them are filled/stroked at once by the garden)
    addGroundToPath(ctx) {
        var rx = this.maxSize / 4;
        ctx.moveTo(this.x + rx, this.y); // start a new sub-path, so ellipses aren't connected by lines
        ctx.ellipse(this.x, this.y, rx, rx * PERSPECTIVE, 0, 0, Math.PI * 2);
    }

    displaySpreadRange() {
        noFill();
        stroke(255, 80, 80);
        strokeWeight(1);
        ellipseMode(CENTER);
        ellipse(this.x, this.y, this.spreadRange * 2, this.spreadRange * 2 * PERSPECTIVE);
    }

    grow(dt) {

        if (!this.isMaturing) {
            if (this.size / this.maxSize >= MATURING_START) {
                this.isMaturing = true;
            }
        }

        if (!this.isGrown) {

            if (this.isMaturing) {
                var l = 1 - (1 - (this.size / this.maxSize)) / (1 - MATURING_START);
                this.fruitStr = 'rgb(' + lerp(this.rgb[0], this.fruitRgb[0], l) + ',' + lerp(this.rgb[1], this.fruitRgb[1], l) + ',' + lerp(this.rgb[2], this.fruitRgb[2], l) + ')';
                this.fruitW = lerp(0.0, FRUIT_OUTLINE_MAX, l);
            }

            var g = dt * (this.maxSize / this.growDuration); // full size after growDuration seconds, regardless of size

            if ((toolMode === 'water' && mouseOverCanvas && this.mouseOver(toolRadius)) || (debugOn && (keyIsDown('g') || keyIsDown('G')))) { // hold "G" to speed up all growth
                g = g * WATER_BOOST;
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
        myGarden.addPlant(this.makeChild(pos.x, pos.y));
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
            myGarden.addPlant(this.makeChild(pos.x, pos.y));
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
