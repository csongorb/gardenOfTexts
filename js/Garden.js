// =================================
// Garden
// =================================

class Garden {
    constructor() {
        this.myPlants = []; // array of objects
        this.lineageMemory = []; // per lineage (original letter): its last seen living plant, so an extinct lineage can sprout again there
        this.needsSort = true;

        this.rowPos = 100;
        this.startPos = 100;
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
            if (!saved || saved.signature !== gardenLineSignature) return false; // different ?text=... params - start fresh
            if (!Array.isArray(saved.plants) || saved.plants.length === 0) return false;
            var plants = saved.plants.map(charPlantFromSerialized);
            this.lineageMemory = saved.lineageMemory.map(charPlantFromSerialized);
            this.myPlants = plants;
            this.needsSort = true;
            return true;
        } catch (e) {
            return false;
        }
    }

    // new plants go through here, so the draw order is only re-sorted when something was added
    addPlant(plant) {
        this.myPlants.push(plant);
        this.needsSort = true;
    }

    display() {
        var dt = Math.min(deltaTime / 1000, MAX_FRAME_TIME); // seconds since the last frame
        for (var i = 0; i < myGarden.myPlants.length; i++) {
            this.myPlants[i].grow(dt);
        }
        this.myPlants = this.myPlants.filter(function (plant) {
            return !plant.isDead;
        });
        this.sproutRare(dt);
        if (this.needsSort) { // removing plants keeps the order, only additions need a sort
            this.myPlants.sort(this.compare);
            this.needsSort = false;
        }

        // all ground ellipses as one path, filled and outlined with a single call each (much cheaper than one p5 ellipse() per plant)
        var ground = new Path2D();
        for (var i = 0; i < this.myPlants.length; i++) {
            this.myPlants[i].addGroundToPath(ground);
        }
        var ctx = drawingContext;
        ctx.save();
        ctx.fillStyle = 'rgb(40,40,40)';
        ctx.fill(ground);
        ctx.restore();

        if (DEBUG) {
            for (var i = 0; i < this.myPlants.length; i++) {
                if (this.myPlants[i].mouseOver()) {
                    this.myPlants[i].displaySpreadRange();
                }
            }
        }

        drawToolCircle();

        // outlines are drawn after the tool circle, so they stay visible even where the tool circle covers them
        ctx.save();
        ctx.strokeStyle = 'rgb(80,80,80)';
        ctx.lineWidth = 1.5;
        ctx.stroke(ground);
        ctx.restore();

        for (var i = 0; i < this.myPlants.length; i++) {
            this.myPlants[i].displayPlants();
        }
    }

    plantTextWithCharPlants(text, xPos, yPos, maxCharSize) {
        var splitString = text.split('');
        for (var i = 0; i < splitString.length; i++) {
            if (splitString[i] === ' ') continue;
            var plant = new CharPlant(splitString[i], xPos + (i * maxCharSize / 2), yPos, maxCharSize, maxCharSize, undefined, undefined, this.lineageMemory.length);
            this.addPlant(plant);
            this.lineageMemory.push(plant);
        }
    }

    // lineages with few living plants get extra sprouts around their population (the fewer, the likelier);
    // an extinct lineage sprouts again near its last seen plant
    sproutRare(dt) {
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
