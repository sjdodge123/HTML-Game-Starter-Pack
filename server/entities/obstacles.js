'use strict';
// Static level geometry — immovable colliders that dynamic entities bounce off.
// They are NOT integrated or moved by the engine; they only get inserted into the
// broad-phase each tick so collision tests find them. Both expose the small duck-
// typed surface the engine needs (getExtents for the QuadTree; solid/movable flags;
// a no-op handleHit because nothing can push them; a no-op move).
//
// Two primitives cover most levels:
//   CircleObstacle — a bumper / pillar (reuses the circle-circle collision path).
//   BoxObstacle    — an axis-aligned wall / block (circle-vs-AABB collision path).
// The collision RESPONSE for both lives in Entity.handleHit (the dynamic body
// resolves itself against the immovable obstacle).

var utils = require('../utils.js');
var c = utils.loadConfig();

class CircleObstacle {
    constructor(x, y, radius, id) {
        this.type = 'obstacle';
        this.id = id;
        this.x = x; this.y = y;
        this.newX = x; this.newY = y;
        this.radius = radius;
        this.color = c.obstacleColor;
        this.solid = true;
        this.movable = false;
        this.cvX = 0; this.cvY = 0;
    }
    getExtents() {
        return { minX: this.x - this.radius, maxX: this.x + this.radius, minY: this.y - this.radius, maxY: this.y + this.radius };
    }
    handleHit() { }
    move() { }
}

class BoxObstacle {
    constructor(x, y, w, h, id) {
        this.type = 'obstacle';
        this.id = id;
        this.isBox = true;
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.minX = x; this.minY = y; this.maxX = x + w; this.maxY = y + h;
        this.newX = x; this.newY = y;
        this.color = c.obstacleColor;
        this.solid = true;
        this.movable = false;
        this.cvX = 0; this.cvY = 0;
    }
    getExtents() {
        return { minX: this.minX, maxX: this.maxX, minY: this.minY, maxY: this.maxY };
    }
    handleHit() { }
    move() { }
}

module.exports = { CircleObstacle, BoxObstacle };
