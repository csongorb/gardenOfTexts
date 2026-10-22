// =================================
// Lineage
// =================================

// one per letter of the original text: remembers where it was first planted and keeps track of all its living descendants
// (the plants themselves live in the garden's flat list, this is only an index on top of it)
class Lineage {

    constructor(_id, _char, _originX, _originY, _baseSize) {
        this.id = _id; // index in the garden's lineages, stored in each plant as plant.lineage
        this.char = _char;
        this.originX = _originX; // where the original letter was planted
        this.originY = _originY;
        this.baseSize = _baseSize;
        this.members = []; // living plants of this lineage
        this.lastSeen = null; // last living plant, so an extinct lineage can sprout again there
    }

    static fromSerialized(data, id) {
        var lineage = new Lineage(id, data.char, data.originX, data.originY, data.baseSize);
        lineage.lastSeen = data.lastSeen ? charPlantFromSerialized(data.lastSeen) : null;
        return lineage;
    }

    serialize() {
        return {
            char: this.char,
            originX: this.originX,
            originY: this.originY,
            baseSize: this.baseSize,
            lastSeen: this.lastSeen ? this.lastSeen.serialize() : null
        };
    }

    add(plant) {
        this.members.push(plant);
        this.lastSeen = plant;
    }

    // drops dead members; lastSeen stays on the last one, so it's still known after extinction
    prune() {
        this.members = this.members.filter(function (plant) {
            return !plant.isDead;
        });
        if (this.members.length > 0) {
            this.lastSeen = this.members[this.members.length - 1];
        }
    }

    // debug color: the hue of its last seen plant (also after extinction), like the plants themselves
    color() {
        if (!this.lastSeen) return DEBUG_COLOR;
        return 'oklch(' + PLANT_LIGHTNESS + ' ' + PLANT_CHROMA + ' ' + this.lastSeen.hue + ')';
    }

    // convex hull around the living plants' positions (monotone chain); fewer than 3 plants: just their positions
    hull() {
        var points = this.members.map(function (plant) {
            return { x: plant.x, y: plant.y };
        });
        if (points.length < 3) return points;
        points.sort(function (a, b) {
            return a.x - b.x || a.y - b.y;
        });
        function cross(o, a, b) {
            return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        }
        var lower = [];
        for (var i = 0; i < points.length; i++) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) lower.pop();
            lower.push(points[i]);
        }
        var upper = [];
        for (var i = points.length - 1; i >= 0; i--) {
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) upper.pop();
            upper.push(points[i]);
        }
        lower.pop(); // the last point of each chain is the first of the other
        upper.pop();
        return lower.concat(upper);
    }

    // area of the hull in px² on the ground (the screen squashes y by PERSPECTIVE, so that's undone here)
    area(hull) {
        hull = hull || this.hull();
        var sum = 0;
        for (var i = 0; i < hull.length; i++) {
            var a = hull[i];
            var b = hull[(i + 1) % hull.length];
            sum += a.x * b.y - b.x * a.y;
        }
        return Math.abs(sum) / 2 / PERSPECTIVE;
    }

    get count() {
        return this.members.length;
    }

    isExtinct() {
        return this.members.length === 0;
    }
}
