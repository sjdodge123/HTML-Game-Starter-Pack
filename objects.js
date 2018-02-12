class GameObject {
    constructor(){
        this.alive = true;
        this.velX = 0;
        this.velY = 0;
        this.dt = 0;
    }
    update(dt){
        this.dt = dt;
    }
    handleHit(object){
        console.log(this.type + " hit a " + object.type);
    }
}
class Shape extends GameObject{
    constructor(x,y,color){
        super();
        this.x = x;
        this.y = y;
        this.newX = 0;
        this.newY = 0;
        this.color = color;
        this.originalColor = color;
    }
    move(x,y){
        this.newX = x;
        this.newY = y;
    }
    _move(){
        this.x += this.newX + this.velX;// * this.dt;
        this.y += this.newY + this.velY; //* this.dt;

    }
    setRandomMovement(){
        this.velX = globals.utils.getRandomInt(-2,2);
        this.velY = globals.utils.getRandomInt(-2,2);
    }
    update(dt){
        super.update(dt);
        this._move();
        this.draw();
    }
    inBounds(shape){
        if(shape.radius){
            return this.testCircle(shape);
        }
        if(shape.width){
            return this.testRect(shape);
        }
        return false;
    }
    select(){
        this.color = "purple";
    }
    unselect(){
        this.color = this.originalColor;
    }
}
class Circle extends Shape{
    constructor(x,y,color,radius){
        super(x,y,color);
        this.type = "Circle";
        this.radius = radius;
    }
    draw(){
        globals.ctx.save();
        globals.ctx.fillStyle=this.color;
        globals.ctx.beginPath();
        globals.ctx.arc(this.x,this.y,this.radius,0,2*Math.PI);
        globals.ctx.fill();
        globals.ctx.restore();
    }
    getExtents(){
		return {minX: this.x - this.radius, maxX: this.x + this.radius, minY: this.y - this.radius, maxY: this.y + this.radius};
	}

	testCircle(circle){
		var objX1,objY1,objX2,objY2,distance;
		objX1 = this.newX || this.x;
		objY1 = this.newY || this.y;
		objX2 = circle.newX || circle.x;
		objY2 = circle.newY || circle.y;
		distance = globals.utils.getMag(objX2 - objX1,objY2 - objY1);
	  	distance -= this.radius;
		distance -= circle.radius;
		if(distance <= 0){
			return true;
		}
		return false;
	}
    testRect(rect){
		if(this.lineIntersectCircle({x:rect.x, y:rect.y}, {x:rect.newX, y:rect.newY})){
			return true;
		}
		if(rect.pointInRect(this.x, this.y)){
			return true;
		}

		if(this.lineIntersectCircle(rect.vertices[0], rect.vertices[1]) ||
	       this.lineIntersectCircle(rect.vertices[1], rect.vertices[2]) ||
	       this.lineIntersectCircle(rect.vertices[2], rect.vertices[3]) ||
	       this.lineIntersectCircle(rect.vertices[3], rect.vertices[0])){
	        return true;
	    }

		for (var i = 0; i < rect.vertices.length; i++){
	        var distsq = globals.utils.getMagSq(this.x, this.y, rect.vertices[i].x, rect.vertices[i].y);
	        if (distsq < Math.pow(this.radius, 2)){
	            return true;
	        }
	    }
		return false;
	}
    lineIntersectCircle(a, b){
        var ap, ab, dirAB, magAB, projMag, perp, perpMag;
        ap = {x: this.x - a.x, y: this.y - a.y};
        ab = {x: b.x - a.x, y: b.y - a.y};
        magAB = Math.sqrt(globals.utils.dotProduct(ab,ab));
        dirAB = {x: ab.x/magAB, y: ab.y/magAB};

        projMag = globals.utils.dotProduct(ap, dirAB);

        perp = {x: ap.x - projMag*dirAB.x, y: ap.y - projMag*dirAB.y};
        perpMag = Math.sqrt(globals.utils.dotProduct(perp, perp));
        if ((0 < perpMag) && (perpMag < this.radius) && (0 <  projMag) && (projMag < magAB)){
            return true;
        }
        return false;
	}
    getRandomCircleLoc(minR,maxR){
        /*
		var r = Math.floor(Math.random()*(maxR - minR));
		var angle = Math.floor(Math.random()*(Math.PI*2 - 0));
        return this.tesn {x:r*Math.cos(angle)+this.x,y:r*Math.sin(angle)+this.y};
        */
	}
    handleHit(shape){
        if(shape.type == "Circle"){
            this.velX = shape.velX - this.velX;
            this.velY = shape.velY - this.velY;
        }
    }
}
class Rect extends Shape{
    constructor(x,y,color,length,width,angle){
        super(x,y,color);
        this.length = length;
        this.width = width;
        this.angle = angle;
        this.type = "Rect";
        this.vertices = this.getVertices();
    }
    draw(){
        globals.ctx.save();
        globals.ctx.fillStyle = this.color;
        globals.ctx.translate(this.x - this.width/2,this.y - this.length/2);
        globals.ctx.rotate(this.angle);
        globals.ctx.fillRect(0,0,this.width,this.length);
        globals.ctx.restore();
    }
    getVertices(){
		var vertices = [];
		var a = {x:-this.width/2, y: -this.height/2},
	        b = {x:this.width/2, y: -this.height/2},
	        c = {x:this.width/2, y: this.height/2},
	        d = {x:-this.width/2, y: this.height/2};
		vertices.push(a, b, c, d);

		var cos = Math.cos(this.angle * Math.PI/180);
	    var sin = Math.sin(this.angle * Math.PI/180);

		var tempX, tempY;
	    for (var i = 0; i < vertices.length; i++){
	        var vert = vertices[i];
	        tempX = vert.x * cos - vert.y * sin;
	        tempY = vert.x * sin + vert.y * cos;
	        vert.x = this.x + tempX;
	        vert.y = this.y + tempY;
	    }
		return vertices;
	}
    pointInRect(x, y){
	    var ap = {x:x-this.vertices[0].x, y:y-this.vertices[0].y};
	    var ab = {x:this.vertices[1].x - this.vertices[0].x, y:this.vertices[1].y - this.vertices[0].y};
	    var ad = {x:this.vertices[3].x - this.vertices[0].x, y:this.vertices[3].y - this.vertices[0].y};

		var dotW = globals.utils.dotProduct(ap, ab);
		var dotH = globals.utils.dotProduct(ap, ad);
		if ((0 <= dotW) && (dotW <= globals.utils.dotProduct(ab, ab)) && (0 <= dotH) && (dotH <= globals.utils.dotProduct(ad, ad))){
			return true;
		}
	    return false;
	}
    getExtents(){
		var minX = this.vertices[0].x,
		maxX = minX,
		minY = this.vertices[0].y,
		maxY = minY;
		for (var i = 0; i < this.vertices.length-1; i++){
			var vert = this.vertices[i];
			minX = (vert.x < minX) ? vert.x : minX;
			maxX = (vert.x > maxX) ? vert.x : maxX;
			minY = (vert.y < minY) ? vert.y : minY;
			maxY = (vert.y > maxY) ? vert.y : maxY;
		}
		return {minX, maxX, minY, maxY};
	}
    testRect(rect){
		for (var i = 0; i < this.vertices.length; i++){
	        if(rect.pointInRect(this.vertices[i].x,this.vertices[i].y)){
	            return true;
	        }
	    }
	    for (var i = 0; i < rect.vertices.length; i++){
	        if(this.pointInRect(rect.vertices[i].x,rect.vertices[i].y)){
	            return true;
	        }
	    }
        return false;
	}
    testCircle(circle){
		return circle.testRect(this);
	}
}

class TargetingCircle extends Circle{
    constructor(x,y,color,radius,duration){
        super(x,y,color,radius);
        this.duration = duration;
        this.spawnDate = Date.now();
    }
    update(dt){
        var elapsedTime = Date.now() - this.spawnDate;
        if(elapsedTime > this.duration){
            this.alive = false;
            return;
        }
        super.update(dt);
    }
}
