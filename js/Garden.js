// =================================
// Garden
// =================================

class Garden {
    constructor() {
        this.myPlants = []; // array of objects
        this.lineages = []; // one Lineage per letter of the original text (indexed by plant.lineage)
        this.needsSort = true;
    }

    plant() {
        var lines = layoutLines(getGardenLines());
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            this.plantTextWithCharPlants(line.text, line.x - lineWidth(line) / 2, line.y, line.size);
        }

        for (var i = 0; i < this.myPlants.length; i++) {
            this.myPlants[i].preGrow();
        }
    }

    saveState() {
        try {
            var data = this.myPlants.map(function (plant) {
                return plant.serialize();
            });
            var lineages = this.lineages.map(function (lineage) {
                return lineage.serialize();
            });
            localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify({ signature: gardenLineSignature, plants: data, lineages: lineages }));
        } catch (e) {
            // localStorage unavailable (e.g. private browsing) - skip saving
        }
    }

    loadState() {
        try {
            var raw = localStorage.getItem(GARDEN_STORAGE_KEY);
            if (!raw) return false;
            var saved = JSON.parse(raw);
            if (!saved || saved.signature !== gardenLineSignature) return false; // different ?text=... params - start fresh
            if (!Array.isArray(saved.plants) || saved.plants.length === 0) return false;
            if (!Array.isArray(saved.lineages)) return false; // saved before lineages existed - start fresh
            var plants = saved.plants.map(charPlantFromSerialized);
            this.lineages = saved.lineages.map(Lineage.fromSerialized);
            this.myPlants = [];
            for (var i = 0; i < plants.length; i++) {
                this.addPlant(plants[i]); // refills the lineages' members
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    // new plants go through here, so the draw order is only re-sorted when something was added
    addPlant(plant) {
        this.myPlants.push(plant);
        var lineage = this.lineages[plant.lineage];
        if (lineage) {
            lineage.add(plant);
        }
        this.needsSort = true;
    }

    // removes all plants marked isDead, from the garden and from their lineages
    removeDead() {
        var before = this.myPlants.length;
        this.myPlants = this.myPlants.filter(function (plant) {
            return !plant.isDead;
        });
        if (this.myPlants.length === before) return;
        for (var i = 0; i < this.lineages.length; i++) {
            this.lineages[i].prune();
        }
    }

    // simulation: advances the garden by dt seconds
    update(dt) {
        for (var i = 0; i < this.myPlants.length; i++) {
            this.myPlants[i].grow(dt, this);
        }
        this.removeDead();
        this.sproutRare(dt);
        if (this.needsSort) { // removing plants keeps the order, only additions need a sort
            this.myPlants.sort(this.compare);
            this.needsSort = false;
        }
    }

    // drawing only, nothing changes here (expects the canvas origin at the screen center)
    draw() {
        var ctx = drawingContext;
        var showBases = showLayer('bases');

        // all ground ellipses as one path, filled and outlined with a single call each (much cheaper than one p5 ellipse() per plant)
        if (showBases) {
            var ground = new Path2D();
            for (var i = 0; i < this.myPlants.length; i++) {
                this.myPlants[i].addGroundToPath(ground);
            }
            ctx.save();
            ctx.fillStyle = GROUND_FILL;
            ctx.fill(ground);
            ctx.restore();
        }

        drawToolCircle();

        // outlines are drawn after the tool circle, so they stay visible even where the tool circle covers them
        if (showBases) {
            ctx.save();
            ctx.strokeStyle = GROUND_OUTLINE;
            ctx.lineWidth = 1.5;
            ctx.stroke(ground);
            ctx.restore();
        }

        // after the tool circle, which would otherwise cover it
        if (debugOn && debugLayers.spreadRange) {
            for (var i = 0; i < this.myPlants.length; i++) {
                if (this.myPlants[i].mouseOver(10)) {
                    this.myPlants[i].displaySpreadRange();
                }
            }
        }

        if (showLayer('plants')) {
            for (var i = 0; i < this.myPlants.length; i++) {
                this.myPlants[i].displayPlants();
            }
        }

        if (debugOn && debugLayers.origins) {
            this.displayLineageOrigins();
        }
    }

    // debug: each lineage's original letter as an outline on its original spot, with a cross at the spot and its number of living plants
    displayLineageOrigins() {
        push();
        stroke(DEBUG_COLOR);
        strokeWeight(1);
        textAlign(CENTER, BASELINE); // same as the plants
        for (var i = 0; i < this.lineages.length; i++) {
            var lineage = this.lineages[i];
            noFill();
            textSize(lineage.baseSize * DEBUG_ORIGIN_SIZE_FACTOR);
            text(lineage.char, lineage.originX, lineage.originY);
            line(lineage.originX - 4, lineage.originY - 4, lineage.originX + 4, lineage.originY + 4);
            line(lineage.originX - 4, lineage.originY + 4, lineage.originX + 4, lineage.originY - 4);
        }
        noStroke();
        fill(DEBUG_COLOR);
        textSize(DEBUG_COUNT_TEXT_SIZE);
        textAlign(LEFT, TOP);
        for (var i = 0; i < this.lineages.length; i++) {
            text(this.lineages[i].count, this.lineages[i].originX + 5, this.lineages[i].originY + 2);
        }
        pop();
    }

    plantTextWithCharPlants(text, xPos, yPos, maxCharSize) {
        var splitString = text.split('');
        for (var i = 0; i < splitString.length; i++) {
            if (splitString[i] === ' ') continue;
            var x = xPos + (i * maxCharSize / 2);
            var lineage = new Lineage(this.lineages.length, splitString[i], x, yPos, maxCharSize);
            this.lineages.push(lineage);
            this.addPlant(new CharPlant(splitString[i], x, yPos, maxCharSize, maxCharSize, undefined, undefined, lineage.id));
        }
    }

    // lineages with few living plants get extra sprouts around their population (the fewer, the likelier);
    // an extinct lineage sprouts again near its last seen plant
    sproutRare(dt) {
        for (var l = 0; l < this.lineages.length; l++) {
            var lineage = this.lineages[l];
            var count = lineage.count;
            var chance = RARE_SPROUT_CHANCE * Math.exp(-count / RARE_POPULATION_SCALE) * dt;
            if (random() >= chance) continue;
            var parent = count > 0 ? random(lineage.members) : lineage.lastSeen;
            if (parent) {
                this.sproutNear(parent, count === 0);
            }
        }
    }

    // tries a few spots around the parent; if forced (extinct lineage) and none is free, sprouts on the parent's own spot
    sproutNear(parent, force) {
        for (var attempt = 0; attempt < 5; attempt++) {
            if (parent.plantSpread(this)) return;
        }
        if (force) {
            this.addPlant(parent.makeChild(parent.x, parent.y));
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
