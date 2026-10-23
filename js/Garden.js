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

        if (debugOn && debugLayers.areas) {
            this.displayLineageAreas();
        }

        var lines = debugOn && (debugLayers.middles || debugLayers.textLine) ? this.fitTextLines() : null; // computed once for both layers

        if (debugOn && debugLayers.middles) {
            this.displayLineageMiddles(lines);
        }

        if (debugOn && debugLayers.textLine) {
            this.displayTextLines(lines);
        }

        if (debugOn && debugLayers.origins) {
            this.displayLineageOrigins();
        }
    }

    // debug: the living lineages' area middles, grouped per text line, in letter order:
    // [{ entries: [{ lineage, hull, middle, target, aligned, orderBroken }, ...], lineY, scale }, ...]
    // the original text line is used as a template: its spacing is stretched by scale (the median over all letter pairs of how much
    // wider apart their middles are than their origins), then it's shifted as a whole by the median of (middle - origin) -
    // medians, so a single wild lineage doesn't move it; target: where the letter would be on that fitted, straight line (y = lineY);
    // aligned: the target if it lies inside the letter's area, otherwise the middle moved towards the area's edge point nearest to the target,
    // then put into letter order where the areas allow it (see orderAlignedMiddles; orderBroken: they don't)
    // (lineages are created in text order; consecutive ones with the same originY and baseSize belong to one text line)
    fitTextLines() {
        var lines = [];
        var current = null;
        var prevLineage = null;
        for (var i = 0; i < this.lineages.length; i++) {
            var lineage = this.lineages[i];
            if (!prevLineage || lineage.originY !== prevLineage.originY || lineage.baseSize !== prevLineage.baseSize) {
                current = { entries: [], lineY: 0 }; // a new text line starts
                lines.push(current);
            }
            prevLineage = lineage;
            var hull = lineage.hull();
            var m = lineage.middle(hull);
            if (m) { // extinct lineages have none
                current.entries.push({ lineage: lineage, hull: hull, middle: m });
            }
        }
        lines = lines.filter(function (l) {
            return l.entries.length > 0;
        });

        for (var l = 0; l < lines.length; l++) {
            var entries = lines[l].entries;

            // spacing: for every pair of letters, how much wider apart their middles are now than their origins
            var slopes = [];
            for (var i = 0; i < entries.length; i++) {
                for (var j = i + 1; j < entries.length; j++) {
                    var originDist = entries[j].lineage.originX - entries[i].lineage.originX;
                    if (originDist === 0) continue;
                    slopes.push((entries[j].middle.x - entries[i].middle.x) / originDist);
                }
            }
            var scale = slopes.length > 0 ? Math.max(median(slopes), DEBUG_FIT_SCALE_MIN) : 1;
            lines[l].scale = scale;

            var shiftX = median(entries.map(function (e) {
                return e.middle.x - e.lineage.originX * scale;
            }));
            var shiftY = median(entries.map(function (e) {
                return e.middle.y - e.lineage.originY;
            }));
            var lineY = entries[0].lineage.originY + shiftY; // all letters of a line share the same originY
            lines[l].lineY = lineY;

            for (var i = 0; i < entries.length; i++) {
                var m = entries[i].middle;
                var target = { x: entries[i].lineage.originX * scale + shiftX, y: lineY };
                var edge = entries[i].lineage.closestPoint(target, entries[i].hull);
                entries[i].target = target;
                if (edge === target) {
                    entries[i].aligned = target; // the area reaches the line here
                } else {
                    entries[i].aligned = { x: m.x + (edge.x - m.x) * DEBUG_ALIGN_EDGE_FACTOR, y: m.y + (edge.y - m.y) * DEBUG_ALIGN_EDGE_FACTOR };
                }
            }

            this.orderAlignedMiddles(entries);
        }
        return lines;
    }

    // debug: keeps the aligned middles of a text line in letter order (at least a gap apart in x), where the areas allow it:
    // for each pair in the wrong order, either the right letter moves into the part of its area right of the left one,
    // or the left letter into the part of its area left of the right one - whichever moves less (each as close to its target as possible);
    // repeated, as fixing one pair can break the next; letters still out of order afterwards get orderBroken = true
    orderAlignedMiddles(entries) {
        function moveDist(e, p) {
            return Math.hypot(p.x - e.aligned.x, p.y - e.aligned.y);
        }
        for (var pass = 0; pass < entries.length; pass++) {
            var changed = false;
            for (var i = 1; i < entries.length; i++) {
                var a = entries[i - 1];
                var b = entries[i];
                var gap = DEBUG_ORDER_GAP_FACTOR * b.lineage.baseSize;
                if (b.aligned.x >= a.aligned.x + gap) continue;
                var moveB = b.lineage.closestPoint(b.target, clipHullX(b.hull, a.aligned.x + gap, Infinity));
                var moveA = a.lineage.closestPoint(a.target, clipHullX(a.hull, -Infinity, b.aligned.x - gap));
                if (moveB && (!moveA || moveDist(b, moveB) <= moveDist(a, moveA))) {
                    b.aligned = moveB;
                    changed = true;
                } else if (moveA) {
                    a.aligned = moveA;
                    changed = true;
                }
            }
            if (!changed) break;
        }
        for (var i = 0; i < entries.length; i++) {
            entries[i].orderBroken = i > 0 && entries[i].aligned.x < entries[i - 1].aligned.x + DEBUG_ORDER_GAP_FACTOR * entries[i].lineage.baseSize;
        }
    }

    // debug: a dot at the middle of each lineage's area, and a line through the middles of each text line, in letter order
    // (lines: from fitTextLines)
    displayLineageMiddles(lines) {
        push();
        strokeWeight(1);
        for (var l = 0; l < lines.length; l++) {
            var entries = lines[l].entries;
            for (var i = 0; i < entries.length; i++) {
                var m = entries[i].middle;
                if (i > 0) {
                    stroke('oklch(0.6 0 0)');
                    line(entries[i - 1].middle.x, entries[i - 1].middle.y, m.x, m.y);
                }
                noStroke();
                fill(entries[i].lineage.color());
                ellipse(m.x, m.y, 6, 6);
            }
        }
        pop();
    }

    // debug: each fitted text line (lines: from fitTextLines) as a dashed horizontal line from its first to its last target,
    // with its spacing factor; per letter its target (small cross) and aligned middle (ring) with a connector from the middle
    // showing the move; and a line through the aligned middles, in letter order
    displayTextLines(lines) {
        var ctx = drawingContext;
        ctx.save();
        ctx.strokeStyle = 'oklch(0.85 0 0)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = DEBUG_COUNT_TEXT_SIZE + 'px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (var l = 0; l < lines.length; l++) {
            var entries = lines[l].entries;
            var minX = Infinity;
            var maxX = -Infinity;
            for (var i = 0; i < entries.length; i++) {
                minX = Math.min(minX, entries[i].target.x);
                maxX = Math.max(maxX, entries[i].target.x);
            }
            ctx.beginPath();
            ctx.moveTo(minX - 20, lines[l].lineY); // a bit longer than the targets, so it's visible for a single one too
            ctx.lineTo(maxX + 20, lines[l].lineY);
            ctx.stroke();
            ctx.fillText('×' + lines[l].scale.toFixed(1), maxX + 24, lines[l].lineY); // the fitted spacing factor
        }
        ctx.restore();

        push();
        strokeWeight(1);
        noFill();
        for (var l = 0; l < lines.length; l++) {
            var entries = lines[l].entries;
            for (var i = 0; i < entries.length; i++) {
                var m = entries[i].middle;
                var a = entries[i].aligned;
                if (i > 0) {
                    stroke('oklch(0.85 0 0)');
                    strokeWeight(2.5); // the text as it can be read now - the main line of this layer
                    line(entries[i - 1].aligned.x, entries[i - 1].aligned.y, a.x, a.y);
                    strokeWeight(1);
                }
                stroke(entries[i].lineage.color());
                line(m.x, m.y, a.x, a.y);
                if (entries[i].orderBroken) {
                    stroke(DEBUG_COLOR); // out of order, and its area doesn't allow fixing it
                }
                ellipse(a.x, a.y, 9, 9);
                stroke(entries[i].lineage.color());
                var t = entries[i].target;
                line(t.x - 3, t.y - 3, t.x + 3, t.y + 3);
                line(t.x - 3, t.y + 3, t.x + 3, t.y - 3);
            }
        }
        pop();
    }

    // debug: the area each lineage occupies, as the outline around its living plants, in the lineage's hue
    displayLineageAreas() {
        push();
        noFill();
        strokeWeight(1);
        for (var i = 0; i < this.lineages.length; i++) {
            var lineage = this.lineages[i];
            if (lineage.isExtinct()) continue;
            stroke(lineage.color());
            var hull = lineage.hull();
            beginShape();
            for (var j = 0; j < hull.length; j++) {
                vertex(hull[j].x, hull[j].y);
            }
            endShape(CLOSE);
        }
        pop();
    }

    // debug: each lineage's original letter as an outline on its original spot, with a cross at the spot and its number of living plants
    // (in the lineage's hue, like its area)
    displayLineageOrigins() {
        push();
        strokeWeight(1);
        for (var i = 0; i < this.lineages.length; i++) {
            var lineage = this.lineages[i];
            var c = lineage.color();
            stroke(c);
            noFill();
            textAlign(CENTER, BASELINE); // same as the plants
            textSize(lineage.baseSize * DEBUG_ORIGIN_SIZE_FACTOR);
            text(lineage.char, lineage.originX, lineage.originY);
            line(lineage.originX - 4, lineage.originY - 4, lineage.originX + 4, lineage.originY + 4);
            line(lineage.originX - 4, lineage.originY + 4, lineage.originX + 4, lineage.originY - 4);

            var label = lineage.count;
            if (debugLayers.areas) {
                label += ' / ' + round(lineage.area() / 1000) + 'k px²';
            }
            noStroke();
            fill(c);
            textAlign(LEFT, TOP);
            textSize(DEBUG_COUNT_TEXT_SIZE);
            text(label, lineage.originX + 5, lineage.originY + 2);
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
