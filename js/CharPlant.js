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
    plant.setHue(data.h);
    return plant;
}

class CharPlant {

    constructor(_char, _xPos, _yPos, _maxSize, _baseSize, _parentHue, _parentGrowDuration, _lineage) {
        this.char = _char;
        this.lineage = _lineage; // index of the original letter this plant descends from
        this.x = _xPos;
        this.y = _yPos;
        this.baseSize = _baseSize; // the letter's original size, unchanged across generations
        this.maxSize = constrain(_maxSize + random(-_maxSize * SIZE_MUTATION, _maxSize * SIZE_MUTATION), _baseSize * SIZE_MIN_FACTOR, _baseSize * SIZE_MAX_FACTOR);
        this.size = 1;
        this.tilt = random(-TILT_MAX, TILT_MAX);
        this.setHue(_parentHue !== undefined ? (_parentHue + random(-HUE_MUTATION, HUE_MUTATION) + 360) % 360 : random(0, 360));
        var duration = _parentGrowDuration || GROW_DURATION_DEFAULT;
        this.growDuration = constrain(duration + random(-duration * GROW_DURATION_MUTATION, duration * GROW_DURATION_MUTATION), GROW_DURATION_MIN, GROW_DURATION_MAX); // seconds to full size
        this.spreadRange = this.maxSize * SPREAD_RANGE_FACTOR;
        this.isGrown = false;
        this.isMaturing = false;
        this.isDead = false;
    }

    // caches the color as a CSS string, so drawing doesn't need to build it every frame
    setHue(h) {
        this.hue = h;
        this.cStr = 'oklch(' + PLANT_LIGHTNESS + ' ' + PLANT_CHROMA + ' ' + h + ')';
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
            h: this.hue
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
        if (this.isMaturing) {
            // fruiting outline: from 0 to FRUIT_OUTLINE_MAX thick, from the plant's lightness/chroma to the fruit's, while maturing
            var l = 1 - (1 - (this.size / this.maxSize)) / (1 - MATURING_START);
            if (l > 0) {
                ctx.lineWidth = lerp(0.0, FRUIT_OUTLINE_MAX, l);
                ctx.strokeStyle = 'oklch(' + lerp(PLANT_LIGHTNESS, FRUIT_LIGHTNESS, l) + ' ' + lerp(PLANT_CHROMA, FRUIT_CHROMA, l) + ' ' + this.hue + ')';
                ctx.strokeText(this.char, 0, 0);
            }
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
        stroke('oklch(0.68 0.21 25)');
        strokeWeight(1);
        ellipseMode(CENTER);
        ellipse(this.x, this.y, this.spreadRange * 2, this.spreadRange * 2 * PERSPECTIVE);
    }

    // advances growth by dt seconds; when fully grown, the plant dies and plants its seeds into the garden
    grow(dt, garden) {

        if (!this.isMaturing) {
            if (this.size / this.maxSize >= MATURING_START) {
                this.isMaturing = true;
            }
        }

        if (!this.isGrown) {

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
            this.plantNewPlants(garden);
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
    plantSuccessor(garden) {
        var maxRadius = this.maxSize * SUCCESSOR_DRIFT_FACTOR;
        var pos = this.randomPositionNear(maxRadius);
        if (!isOnScreen(pos.x, pos.y, this.maxSize)) {
            pos = { x: this.x, y: this.y }; // don't drift off screen - stay on the parent's spot instead
        }
        garden.addPlant(this.makeChild(pos.x, pos.y));
    }

    // a new seedling at (x, y), inheriting this plant's genes (with mutation) and lineage
    makeChild(x, y) {
        return new CharPlant(this.char, x, y, this.maxSize, this.baseSize, this.hue, this.growDuration, this.lineage);
    }

    // plants one scattered plant at the full range, only if it's on screen and there's enough space for it
    // (returns whether it was planted)
    plantSpread(garden) {
        var pos = this.randomPositionNear(this.spreadRange);
        if (isOnScreen(pos.x, pos.y, this.maxSize) && garden.hasSpaceAt(pos.x, pos.y, this.maxSize / 4)) {
            garden.addPlant(this.makeChild(pos.x, pos.y));
            return true;
        }
        return false;
    }

    plantNewPlants(garden) {
        if (ALWAYS_PLANT_SUCCESSOR) {
            this.plantSuccessor(garden);
        }

        var spreadCount = random(SEEDS_MIN, SEEDS_MAX);
        for (var i = 0; i < spreadCount; i++) {
            this.plantSpread(garden);
        }
    }

    mouseOver(radius) {
        var r = false;
        var mouse = gardenMouse();
        var d = ellipticalDist(mouse.x, mouse.y, this.x, this.y);
        if (d < radius) {
            r = true;
        }
        return r;
    }
}
