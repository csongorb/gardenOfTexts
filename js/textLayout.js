// reads the ?text=text,size,x,y params (size, x and y are optional; leave one empty to skip it, e.g. text=Hello,,,newline)
// size: number | rnd | empty (DEFAULT_TEXT_SIZE)
// x, y: offset from the screen center (number) | center | rnd; x empty = previous line's x; y empty or newline = below the previous line
function getGardenLines() {
    var rawLines = new URLSearchParams(window.location.search).getAll('text');
    var lines = [];
    for (var i = 0; i < rawLines.length; i++) {
        var parts = rawLines[i].split(',').map(function (part) {
            return part.trim();
        });
        var size = parts[1] === 'rnd' ? random(RND_SIZE_MIN, RND_SIZE_MAX) : (Number(parts[1]) || DEFAULT_TEXT_SIZE);
        lines.push({ text: parts[0], size: size, x: parts[2] || '', y: parts[3] || '' });
    }
    if (lines.length === 0) {
        lines.push({ text: 'Garden', size: 120, x: '', y: '' });
        lines.push({ text: 'of', size: 80, x: '', y: '' });
        lines.push({ text: 'Texts', size: 120, x: '', y: '' });
    }
    return lines;
}

// width of a planted line (letters are spaced half their size apart, x is the line's middle)
function lineWidth(line) {
    return (line.text.length - 1) * (line.size / 2);
}

// resolves each line's x (horizontal middle) and y (baseline) to numbers relative to the screen center
function layoutLines(lines) {
    var prevX = 0;
    var prevY = 0;
    var autoCenter = false; // a first block without a y is centered vertically as a whole
    var inFirstBlock = true;
    var firstBlockEnd = 0; // index of the first block's last line

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        var x;
        if (line.x === 'rnd') {
            var maxX = Math.max(0, width / 2 - lineWidth(line) / 2 - line.size / 2);
            x = random(-maxX, maxX);
        } else if (line.x === 'center') {
            x = 0;
        } else if (line.x === '') {
            x = prevX;
        } else {
            x = Number(line.x) || 0;
        }

        var y;
        var startsBlock = true;
        if (line.y === 'rnd') {
            y = random(-height / 2 + line.size, Math.max(-height / 2 + line.size, height / 2 - line.size / 4));
        } else if (line.y === 'center') {
            y = 0;
        } else if (line.y === '' || line.y === 'newline') {
            if (i === 0) {
                y = 0;
                autoCenter = true;
            } else {
                y = prevY + line.size * LINE_SPACING;
                startsBlock = false;
            }
        } else {
            y = Number(line.y) || 0;
        }
        if (i > 0 && startsBlock) {
            inFirstBlock = false;
        }
        if (inFirstBlock) {
            firstBlockEnd = i;
        }

        line.x = x;
        line.y = y;
        prevX = x;
        prevY = y;
    }

    if (autoCenter) {
        var first = lines[0];
        var last = lines[firstBlockEnd];
        var top = first.y - first.size * 0.8; // roughly where the first line's letters end at the top
        var shift = -(top + last.y) / 2;
        for (var j = 0; j <= firstBlockEnd; j++) {
            lines[j].y += shift;
        }
    }
    return lines;
}
