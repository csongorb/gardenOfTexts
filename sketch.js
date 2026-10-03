var myGarden;

var logoWidth = 800;
var logoHeight = 200;

function setup() {
    createCanvas(windowWidth, windowHeight);

    angleMode(DEGREES);

    myGarden = new Garden();
    myGarden.plant();
}

function draw() {
    background(20);
    strokeWeight(2);

    myGarden.display();
}

function mouseClicked() {
    for (var i = 0; i < myGarden.myPlants.length; i++) {
        if (myGarden.myPlants[i].mouseOver() && myGarden.myPlants[i].isMaturing) {
            myGarden.myPlants[i].reset();
            myGarden.myPlants[i].plantNewPlants(0, 3, myGarden.myPlants[i].maxSize);
        }
    }
}

function keyPressed() {
    print(keyCode);

    // F
    if (keyCode == 70) {
        var fs = fullscreen();
        fullscreen(!fs);
    }
}

function windowResized() {
    var fs = fullscreen();
    if (fs) {
        resizeCanvas(windowWidth, windowHeight);
    } else {
        resizeCanvas(logoWidth, logoHeight);
    }
}

// =================================
// CharPlant
// =================================

function CharPlant(_char, _xPos, _yPos, _maxSize) {
    this.char = _char;
    this.x = _xPos;
    this.y = _yPos;
    this.maxSize = _maxSize + random(-_maxSize / 12, _maxSize / 12);
    this.size = 1;
    this.tilt = random(-8, 8)
    this.c = color(random(0, 255), random(0, 255), random(0, 255));
	this.fruitC = color(0, 220, 0);
	this.fruitW = 0.0;
    this.growthSpeed = 0.1; // per second
	this.startMaturingAt = 0.8;
    this.isGrown = false;
	this.isMaturing = false;

    this.preGrow = function() {
        this.size = random(this.maxSize / 2, this.maxSize);
    };

	this.reset = function(){
		this.size = 1;
		this.isGrown = false;
		this.isMaturing = false;
		this.fruitW = 0.0;

		var v = this.maxSize/4;
		this.x = this.x + random(-v, v);
		this.y = this.y + random(-v, v);
	}

    this.displayPlants = function() {
		stroke(this.c);
		strokeWeight(this.fruitW);
        fill(this.c);
        textSize(this.size);
        textAlign(CENTER);

		if (this.isMaturing == true){
			stroke(this.fruitC);
		}

        push();
        translate(this.x, this.y);
        rotate(this.tilt);
        text(this.char, 0, 0);
        pop();
    };

    this.displayGround = function() {
        if (this.mouseOver()) {
            stroke(200);
        } else {
            noStroke();
        }
        fill(80);

        ellipseMode(CENTER);
        ellipse(this.x, this.y, this.maxSize / 2, this.maxSize / 4);
    };

    this.grow = function() {

		if (!this.isMaturing){
			if (this.size / this.maxSize >= this.startMaturingAt){
				this.isMaturing = true;
			}
		}

        if (!this.isGrown) {

			if (this.isMaturing){
				var l = 1 - (1 - (this.size / this.maxSize))/(1 - this.startMaturingAt);
				this.fruitC = lerpColor(this.c, color(220, 0, 0), l);
				this.fruitW = lerp(0.0, 5.0, l);
			}

            var g = (1.0 / frameRate()) * this.growthSpeed;
            if (g == "Infinity") {
                g = 0;
            }

            if (this.mouseOver()) {
                g = g * 20;
            }

            this.size = this.size + g;

            if (this.size > this.maxSize) {
                this.isGrown = true;
            }
        }

		if (this.isGrown){
			this.reset();
			this.plantNewPlants(0, 2, this.maxSize/2);
		}
    };

    this.plantNewPlants = function(min, max, range) {
        var newPlants = random(min, max);
        for (var i = 0; i < newPlants; i++) {
            myGarden.myPlants.push(new CharPlant(this.char, this.x + random(-range, range), this.y + random(-range, range), this.maxSize));
        }
        myGarden.myPlants.sort(myGarden.compare);
    };

    this.mouseOver = function() {
        var r = false;
        var d = dist(mouseX, mouseY, this.x, this.y);
        if (d < 10) {
            r = true;
        }
        return r;
    };
}

// =================================
// Garden
// =================================

function Garden() {
    this.myPlants = []; // array of objects

    this.rowPos = 100;
    this.startPos = 100;

    this.plant = function() {
        this.plantTextWithCharPlants("Game Gardening Simulator", windowWidth/2 - 460, windowHeight/2 - 30, 80);
		this.plantTextWithCharPlants("2018", windowWidth/2 - 100, windowHeight/2 + 180, 120);

        for (var i = 0; i < this.myPlants.length; i++) {
            this.myPlants[i].preGrow();
        }
        this.myPlants.sort(this.compare);
    };

    this.display = function() {
        for (var i = 0; i < myGarden.myPlants.length; i++) {
            this.myPlants[i].grow();
        }
        for (var i = 0; i < myGarden.myPlants.length; i++) {
            this.myPlants[i].displayGround();
        }
        for (var i = 0; i < myGarden.myPlants.length; i++) {
            this.myPlants[i].displayPlants();
        }
    };

    this.plantTextWithCharPlants = function(text, xPos, yPos, maxCharSize) {
        var splitString = split(text, '');
        for (var i = 0; i < splitString.length; i++) {
            this.myPlants.push(new CharPlant(splitString[i], xPos + (i * maxCharSize / 2), yPos, maxCharSize));
        }
    };

    this.compare = function(a, b) {
        if (a.y < b.y)
            return -1;
        if (a.y > b.y)
            return 1;
        return 0;
    };

}
