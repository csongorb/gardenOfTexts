function ellipticalDist(x1, y1, x2, y2) {
    var dx = x1 - x2;
    var dy = (y1 - y2) / PERSPECTIVE;
    return sqrt(dx * dx + dy * dy);
}

// true if a plant of the given size at (x, y) would be fully on screen
// (text is drawn centered horizontally, above its baseline at y)
function isOnScreen(x, y, size) {
    var halfW = width / 2;
    var halfH = height / 2;
    return x - size / 2 >= -halfW && x + size / 2 <= halfW &&
           y - size >= -halfH && y + size / 4 <= halfH;
}

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
