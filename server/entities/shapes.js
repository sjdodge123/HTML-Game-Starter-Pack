'use strict';
// Geometry primitives — chaochao's entities/shapes.js with the game-specific Gate
// removed. Shape is the common base (position + scratch position + velocity +
// colour + the inBounds collision dispatch); Rect and Circle add their extents and
// the shape-vs-shape overlap tests the QuadTree and narrow-phase rely on.
//
// inBounds() duck-types its argument: anything with a `radius` is a circle,
// anything with a `width` is a rect. This is how the engine's narrow-phase asks
// "do these two overlap?" without knowing concrete types.

var utils = require('../utils.js');

class Shape {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        // Scratch (about-to-be) position. The engine integrates into newX/newY and
        // collision tests read it; the entity commits it to x/y in its move().
        this.newX = this.x;
        this.newY = this.y;
        this.velX = 0;
        this.velY = 0;
        this.color = color;
    }
    inBounds(shape) {
        if (shape.radius) {
            return this.testCircle(shape);
        }
        if (shape.width) {
            return this.testRect(shape);
        }
        return false;
    }
}

class Rect extends Shape {
    constructor(x, y, width, height, angle, color) {
        super(x, y, color);
        this.width = width;
        this.height = height;
        this.angle = angle;
        this.vertices = this.getVertices();
    }
    getVertices() {
        return [
            { x: this.x, y: this.y },
            { x: this.width, y: this.y },
            { x: this.width, y: this.height },
            { x: this.x, y: this.height }
        ];
    }
    pointInRect(objX, objY) {
        var a = this.areaTriangle(this.vertices[0].x, this.vertices[0].y, this.vertices[1].x, this.vertices[1].y, this.vertices[2].x, this.vertices[2].y) +
            this.areaTriangle(this.vertices[0].x, this.vertices[0].y, this.vertices[3].x, this.vertices[3].y, this.vertices[2].x, this.vertices[2].y);
        var a1 = this.areaTriangle(objX, objY, this.vertices[0].x, this.vertices[0].y, this.vertices[1].x, this.vertices[1].y);
        var a2 = this.areaTriangle(objX, objY, this.vertices[1].x, this.vertices[1].y, this.vertices[2].x, this.vertices[2].y);
        var a3 = this.areaTriangle(objX, objY, this.vertices[2].x, this.vertices[2].y, this.vertices[3].x, this.vertices[3].y);
        var a4 = this.areaTriangle(objX, objY, this.vertices[0].x, this.vertices[0].y, this.vertices[3].x, this.vertices[3].y);
        return (a == a1 + a2 + a3 + a4);
    }
    areaTriangle(x1, y1, x2, y2, x3, y3) {
        return Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2.0);
    }
    getExtents() {
        var minX = this.vertices[0].x, maxX = minX, minY = this.vertices[0].y, maxY = minY;
        for (var i = 0; i < this.vertices.length - 1; i++) {
            var vert = this.vertices[i];
            minX = (vert.x < minX) ? vert.x : minX;
            maxX = (vert.x > maxX) ? vert.x : maxX;
            minY = (vert.y < minY) ? vert.y : minY;
            maxY = (vert.y > maxY) ? vert.y : maxY;
        }
        return { minX, maxX, minY, maxY };
    }
    testRect(rect) {
        for (var i = 0; i < this.vertices.length; i++) {
            if (rect.pointInRect(this.vertices[i].x, this.vertices[i].y)) {
                return true;
            }
        }
        for (var j = 0; j < rect.vertices.length; j++) {
            if (this.pointInRect(rect.vertices[j].x, rect.vertices[j].y)) {
                return true;
            }
        }
        return false;
    }
    testCircle(circle) {
        return circle.testRect(this);
    }
    // A free location inside the rect, leaving room for an object of `size`.
    getSafeLoc(size) {
        var objW = size + 5 + size;
        var objH = size + 5 + size;
        return {
            x: Math.floor(Math.random() * (this.width - 2 * objW - this.x)) + this.x + objW,
            y: Math.floor(Math.random() * (this.height - 2 * objH - this.y)) + this.y + objH,
            width: objW
        };
    }
    findFreeLoc(obj) {
        return this.getSafeLoc(obj.width || obj.radius);
    }
}

class Circle extends Shape {
    constructor(x, y, radius, color) {
        super(x, y, color);
        this.radius = radius;
    }
    getExtents() {
        return { minX: this.x - this.radius, maxX: this.x + this.radius, minY: this.y - this.radius, maxY: this.y + this.radius };
    }
    testCircle(circle) {
        var objX1 = this.newX || this.x;
        var objY1 = this.newY || this.y;
        var objX2 = circle.newX || circle.x;
        var objY2 = circle.newY || circle.y;
        var distance = utils.getMag(objX2 - objX1, objY2 - objY1);
        distance -= this.radius;
        distance -= circle.radius;
        return distance <= 0;
    }
    testRect(rect) {
        if (this.lineIntersectCircle({ x: rect.x, y: rect.y }, { x: rect.newX, y: rect.newY })) {
            return true;
        }
        if (rect.pointInRect(this.x, this.y)) {
            return true;
        }
        if (this.lineIntersectCircle(rect.vertices[0], rect.vertices[1]) ||
            this.lineIntersectCircle(rect.vertices[1], rect.vertices[2]) ||
            this.lineIntersectCircle(rect.vertices[2], rect.vertices[3]) ||
            this.lineIntersectCircle(rect.vertices[3], rect.vertices[0])) {
            return true;
        }
        for (var i = 0; i < rect.vertices.length; i++) {
            var distsq = utils.getMagSq(this.x, this.y, rect.vertices[i].x, rect.vertices[i].y);
            if (distsq < Math.pow(this.radius, 2)) {
                return true;
            }
        }
        return false;
    }
    lineIntersectCircle(a, b) {
        var ap = { x: this.x - a.x, y: this.y - a.y };
        var ab = { x: b.x - a.x, y: b.y - a.y };
        var magAB = Math.sqrt(utils.dotProduct(ab, ab));
        var dirAB = { x: ab.x / magAB, y: ab.y / magAB };
        var projMag = utils.dotProduct(ap, dirAB);
        var perp = { x: ap.x - projMag * dirAB.x, y: ap.y - projMag * dirAB.y };
        var perpMag = Math.sqrt(utils.dotProduct(perp, perp));
        return (0 < perpMag) && (perpMag < this.radius) && (0 < projMag) && (projMag < magAB);
    }
}

module.exports = { Shape, Rect, Circle };
