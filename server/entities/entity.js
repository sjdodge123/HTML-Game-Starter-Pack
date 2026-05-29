'use strict';
// Entity — the base for every DYNAMIC thing the engine simulates (players,
// pickups, …). It generalizes what used to be baked into Player so the engine,
// compressor, and game loop can treat "the things in the world" uniformly: add a
// new entity type by subclassing this, and the broad-phase / wire protocol pick it
// up for free. Entities are circles here (extends Circle for geometry + the
// circle/rect overlap tests); static level geometry lives in obstacles.js.
//
// Two knobs decide how an entity participates in collisions:
//   solid   — does it collide at all (false = pass-through, e.g. a future trigger).
//   movable — does a collision push it (false = infinite mass, e.g. an obstacle).
//
// The per-step lifecycle the engine drives:
//   control(dt) → update own velocity + scratch position (overridden by Player to
//                 read input; the base just coasts at current velocity).
//   handleHit(other) → the collision response (called for both bodies of a pair).
//   move() → commit the scratch position to the authoritative position.

var utils = require('../utils.js');
var c = utils.loadConfig();
var { Circle } = require('./shapes.js');

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

class Entity extends Circle {
    constructor(x, y, radius, color, id, type) {
        super(x, y, radius, color);
        this.id = id;
        this.type = type;          // wire tag the client renders by ('player', 'pickup', …)
        this.alive = true;
        this.solid = true;         // participates in collision
        this.movable = true;       // gets pushed by collisions (obstacles set this false)
        // Pre-collision velocity snapshot + per-step pair guard (see handleHit and
        // Engine.step). cvX/cvY make the symmetric response order-independent;
        // hitThisTick resolves each pair once even though the broad-phase visits it
        // from both sides.
        this.cvX = 0;
        this.cvY = 0;
        this.hitThisTick = {};
    }
    // Default motion: coast at current velocity (free-floating body). Player
    // overrides this to drive velocity from input via the shared integrator.
    control(dt) {
        this.newX += this.velX * dt;
        this.newY += this.velY * dt;
    }
    move() {
        this.x = this.newX;
        this.y = this.newY;
    }
    // Collision response, called by the engine's narrow-phase on BOTH bodies of an
    // overlapping pair. Resolves this circle against another circle (player/pickup)
    // or an axis-aligned box (a static obstacle). A movable partner shares the
    // separation and exchanges normal velocity (equal-mass elastic, composed across
    // the two symmetric calls); an immovable partner acts as infinite mass — this
    // body takes the full push-out and bounces (restitution = wallBounceDamping).
    handleHit(other) {
        if (!other.solid) {
            return;
        }
        // The broad-phase visits each pair from both sides; resolve it once per step.
        if (this.hitThisTick[other.id]) {
            return;
        }
        this.hitThisTick[other.id] = true;

        var nx, ny, pen;
        if (other.isBox) {
            // circle (this) vs axis-aligned box (other): nearest point on the box.
            var cx = this.newX, cy = this.newY;
            var px = clamp(cx, other.minX, other.maxX);
            var py = clamp(cy, other.minY, other.maxY);
            var dx = cx - px, dy = cy - py;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d > 1e-9) {
                nx = dx / d; ny = dy / d; pen = this.radius - d;
            } else {
                // center is inside the box — eject along the nearest face.
                var left = cx - other.minX, right = other.maxX - cx;
                var top = cy - other.minY, bottom = other.maxY - cy;
                var m = Math.min(left, right, top, bottom);
                if (m === left) { nx = -1; ny = 0; pen = this.radius + left; }
                else if (m === right) { nx = 1; ny = 0; pen = this.radius + right; }
                else if (m === top) { nx = 0; ny = -1; pen = this.radius + top; }
                else { nx = 0; ny = 1; pen = this.radius + bottom; }
            }
        } else {
            // circle vs circle.
            var ex = this.newX - other.newX, ey = this.newY - other.newY;
            var dist = Math.sqrt(ex * ex + ey * ey);
            if (dist === 0) { ex = 1; ey = 0; dist = 1; } // perfectly stacked: deterministic normal
            nx = ex / dist; ny = ey / dist;
            pen = (this.radius + other.radius) - dist;
        }
        if (pen <= 0) {
            return; // not actually penetrating at the scratch position
        }

        if (other.movable) {
            // Share the separation; exchange the normal velocity component. Each
            // body applies its own half, composing into a full elastic exchange.
            this.newX += nx * (pen * 0.5);
            this.newY += ny * (pen * 0.5);
            var rel = (this.cvX - other.cvX) * nx + (this.cvY - other.cvY) * ny;
            if (rel < 0) {
                this.velX -= rel * nx;
                this.velY -= rel * ny;
            }
        } else {
            // Immovable partner (obstacle): full push-out + bounce on this body only.
            this.newX += nx * pen;
            this.newY += ny * pen;
            var reln = this.cvX * nx + this.cvY * ny; // other velocity is zero
            if (reln < 0) {
                var e = c.wallBounceDamping;
                this.velX -= (1 + e) * reln * nx;
                this.velY -= (1 + e) * reln * ny;
            }
        }
    }
    // Detection counterpart to handleHit's response: the narrow-phase asks the
    // dynamic body "do you overlap this candidate?". Adds a circle-vs-box test on
    // top of Circle's circle/rect tests.
    inBounds(other) {
        if (other.isBox) {
            var px = clamp(this.newX, other.minX, other.maxX);
            var py = clamp(this.newY, other.minY, other.maxY);
            var dx = this.newX - px, dy = this.newY - py;
            return (dx * dx + dy * dy) <= this.radius * this.radius;
        }
        return super.inBounds(other);
    }
}

module.exports = { Entity };
