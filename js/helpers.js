function ellipticalDist(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = (y1 - y2) / PERSPECTIVE;
    return sqrt(dx * dx + dy * dy);
}

// the middle value of a non-empty list of numbers (the average of the two middle ones for an even count)
function median(values) {
    var sorted = values.slice().sort(function (a, b) {
        return a - b;
    });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// the part of a convex polygon (or a single point / a segment) inside the vertical band minX <= x <= maxX; [] if none
// (Sutherland-Hodgman, against the band's two edges one after the other)
function clipHullX(hull, minX, maxX) {
    function clip(points, limit, keepRight) {
        var result = [];
        for (var i = 0; i < points.length; i++) {
            var prev = points[(i + points.length - 1) % points.length];
            var cur = points[i];
            var prevIn = keepRight ? prev.x >= limit : prev.x <= limit;
            var curIn = keepRight ? cur.x >= limit : cur.x <= limit;
            if (prevIn !== curIn) { // the edge crosses the limit
                var t = (limit - prev.x) / (cur.x - prev.x);
                result.push({ x: limit, y: prev.y + t * (cur.y - prev.y) });
            }
            if (curIn) result.push(cur);
        }
        return result;
    }
    return clip(clip(hull, minX, true), maxX, false);
}

// true if a plant of the given size at (x, y) would be fully on screen
// (text is drawn centered horizontally, above its baseline at y)
function isOnScreen(x, y, size) {
    var halfW = width / 2;
    var halfH = height / 2;
    return x - size / 2 >= -halfW && x + size / 2 <= halfW &&
           y - size >= -halfH && y + size / 4 <= halfH;
}
