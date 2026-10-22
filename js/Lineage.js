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

    // geometric middle of the area: the hull's centroid (center of mass); for fewer than 3 plants or a flat hull, the average of the points
    middle(hull) {
        hull = hull || this.hull();
        if (hull.length === 0) return null;
        var sum = 0, cx = 0, cy = 0;
        for (var i = 0; i < hull.length; i++) {
            var a = hull[i];
            var b = hull[(i + 1) % hull.length];
            var c = a.x * b.y - b.x * a.y;
            sum += c;
            cx += (a.x + b.x) * c;
            cy += (a.y + b.y) * c;
        }
        if (Math.abs(sum) < 1e-6) {
            cx = 0;
            cy = 0;
            for (var i = 0; i < hull.length; i++) {
                cx += hull[i].x;
                cy += hull[i].y;
            }
            return { x: cx / hull.length, y: cy / hull.length };
        }
        return { x: cx / (3 * sum), y: cy / (3 * sum) };
    }

    // where the vertical line at x crosses the hull: { top, bottom } (smaller y = higher on screen)
    verticalExtent(x, hull) {
        hull = hull || this.hull();
        var top = Infinity;
        var bottom = -Infinity;
        for (var i = 0; i < hull.length; i++) {
            var a = hull[i];
            var b = hull[(i + 1) % hull.length]; // 1 point: a = b; 2 points: the segment twice
            if (x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x)) continue;
            if (a.x === b.x) { // vertical edge (or a single point): both ends count
                top = Math.min(top, a.y, b.y);
                bottom = Math.max(bottom, a.y, b.y);
            } else {
                var y = a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
            }
        }
        if (top > bottom) { // not crossed at all (x outside the hull) - shouldn't happen for the hull's own middle
            var m = this.middle(hull);
            return { top: m.y, bottom: m.y };
        }
        return { top: top, bottom: bottom };
    }

    get count() {
        return this.members.length;
    }

    isExtinct() {
        return this.members.length === 0;
    }
}
