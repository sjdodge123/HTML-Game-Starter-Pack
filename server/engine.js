'use strict';
// Physics engine — the GENERIC half of chaochao's engine.js.
//
// chaochao's engine.js mixed a reusable core (a QuadTree broad-phase, the
// narrow-phase collision dispatch, velocity integration, boundary handling) with
// game-specific physics (Voronoi tile/cell collision, punches, pucks, cuts,
// explosions, projectiles, moving hazards). The skeleton keeps the entity-vs-entity
// core and DROPS everything map/ability/projectile-shaped:
//   - Engine.step : one fixed-timestep step — control(), wall-bounce, collide,
//                   commit. Called N times per tick by Game.simulate's accumulator.
//                   Per-entity motion lives in Entity.control()/Player.control()
//                   (the latter via the shared integrator); the engine orchestrates.
//   - broadBase / narrowBase : QuadTree broad-phase (dynamic + static), per-pair
//                   handleHit(); statics are tested but never initiate.
//   - QuadTree : the spatial index that keeps collision O(n log n), not O(n^2).
//   - bounceOffBoundry : keep entities in the arena (shape-agnostic via getExtents).
//
// The collision contract is unchanged from chaochao: narrowBase calls
// obj.handleHit(other) on BOTH objects of a colliding pair, and each entity owns
// its own response (see Player.handleHit). The engine never reaches into entity
// internals — it only detects overlap and delegates.

var utils = require('./utils.js');
var c = utils.loadConfig();
var { applyBounds } = require('../shared/movement.js'); // shared wall-bounce (client predicts with the same code)

var EMPTY = []; // shared empty array for the "no statics" default (never mutated)

exports.getEngine = function () {
    return new Engine();
};
exports.bounceOffBoundry = function (obj, bound) {
    bounceOffBoundry(obj, bound);
};

class Engine {
    constructor() {
        this.dt = 0;
        this.quadTree = null;
        this.worldWidth = 0;
        this.worldHeight = 0;
    }
    // Advance the simulation by ONE fixed timestep. `entities` is the prebuilt
    // array of alive DYNAMIC bodies (players, pickups, …); `statics` is the array
    // of immovable obstacles (level geometry). The whole physics step:
    //   1. each entity drives its own velocity + scratch position (control()),
    //   2. keep each inside the world (wall bounce),
    //   3. snapshot pre-collision velocity + reset the per-step pair guard,
    //   4. broad/narrow-phase resolve entity-vs-entity and entity-vs-obstacle,
    //   5. commit the scratch position to the authoritative position.
    // Both lists are ARRAYS, built once per tick by Game.simulate and reused across
    // sub-steps — iterating an array is cheaper than a `for..in` over a map on V8's
    // hot path, and the accumulator can run N sub-steps without rebuilding the set.
    step(dt, world, entities, statics) {
        this.dt = dt;
        statics = statics || EMPTY;
        for (var i = 0; i < entities.length; i++) {
            var e = entities[i];
            e.control(dt);                 // entity updates its own velocity + scratch position
            bounceOffBoundry(e, world);    // keep it inside the arena
            // Snapshot for the symmetric collision response (see Entity.handleHit),
            // and clear the "already resolved this step" pair guard.
            e.cvX = e.velX;
            e.cvY = e.velY;
            e.hitThisTick = {};
        }
        this.broadBase(entities, statics);
        for (var j = 0; j < entities.length; j++) {
            entities[j].move();
        }
    }
    // Broad-phase: rebuild the QuadTree from this step's bodies (dynamic + static),
    // then for each DYNAMIC body retrieve only the candidates sharing its quadrant
    // and narrow-phase those. Statics are inserted (so dynamic bodies find them) but
    // never initiate, so static-vs-static pairs are never tested. This keeps
    // collision near O(n log n) instead of the O(n^2) all-pairs scan.
    broadBase(dynamic, statics) {
        statics = statics || EMPTY;
        this.quadTree.clear();
        for (var i = 0; i < dynamic.length; i++) {
            this.quadTree.insert(dynamic[i]);
        }
        for (var s = 0; s < statics.length; s++) {
            this.quadTree.insert(statics[s]);
        }
        for (var j = 0; j < dynamic.length; j++) {
            var obj1 = dynamic[j];
            var collisionList = [];
            collisionList = this.quadTree.retrieve(collisionList, obj1);
            this.narrowBase(obj1, collisionList);
        }
    }
    // Narrow-phase: exact overlap test, then hand the pair to BOTH entities. Each
    // entity decides what a hit means to it (Player bounces off another Player).
    narrowBase(obj1, collisionList) {
        for (var i = 0; i < collisionList.length; i++) {
            var obj2 = collisionList[i];
            if (obj1 == obj2) {
                continue;
            }
            if (obj1.inBounds(obj2)) {
                obj1.handleHit(obj2);
                obj2.handleHit(obj1);
            }
        }
    }
    setWorldBounds(width, height) {
        this.worldWidth = width;
        this.worldHeight = height;
        this.quadTree = new QuadTree(0, width, 0, height, c.quadTreeMaxDepth, c.quadTreeMaxCount, -1);
    }
}

// A region quadtree over the arena. Each node holds up to maxChildren entities;
// once exceeded (and below maxDepth) it splits into four children and pushes
// entities that fit wholly inside a child down into it. retrieve() walks only the
// quadrant an entity falls in, so a query returns a small candidate set. Verbatim
// from chaochao (it was already game-agnostic).
class QuadTree {
    constructor(minX, maxX, minY, maxY, maxDepth, maxChildren, level) {
        this.maxDepth = maxDepth;
        this.maxChildren = maxChildren;
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
        this.width = maxX - minX;
        this.height = maxY - minY;
        this.level = level;
        this.nodes = [];
        this.objects = [];
    }
    clear() {
        this.objects = [];
        this.nodes = [];
    }
    splitNode() {
        var subWidth = Math.floor(this.width / 2);
        var subHeight = Math.floor(this.height / 2);
        this.nodes.push(new QuadTree(this.minX, this.minX + subWidth, this.minY, this.minY + subHeight, this.maxDepth, this.maxChildren, this.level + 1));
        this.nodes.push(new QuadTree(this.minX + subWidth, this.maxX, this.minY, this.minY + subHeight, this.maxDepth, this.maxChildren, this.level + 1));
        this.nodes.push(new QuadTree(this.minX, this.minX + subWidth, this.minY + subHeight, this.maxY, this.maxDepth, this.maxChildren, this.level + 1));
        this.nodes.push(new QuadTree(this.minX + subWidth, this.maxX, this.minY + subHeight, this.maxY, this.maxDepth, this.maxChildren, this.level + 1));
    }
    getIndex(obj) {
        var index = -1;
        var horizontalMidpoint = this.minX + this.width / 2;
        var verticalMidpoint = this.minY + this.height / 2;
        var extents = obj.getExtents();
        var leftQuadrant = false, rightQuadrant = false;
        if (extents.minX > this.minX && extents.maxX < horizontalMidpoint) {
            leftQuadrant = true;
        }
        if (extents.maxX < this.maxX && extents.minX > horizontalMidpoint) {
            rightQuadrant = true;
        }
        if (extents.minY > this.minY && extents.maxY < verticalMidpoint) {
            if (leftQuadrant) { index = 0; }
            else if (rightQuadrant) { index = 1; }
        } else if (extents.maxY < this.maxY && extents.minY > verticalMidpoint) {
            if (leftQuadrant) { index = 2; }
            else if (rightQuadrant) { index = 3; }
        }
        return index;
    }
    insert(obj) {
        if (this.nodes[0] != null) {
            var index = this.getIndex(obj);
            if (index != -1) {
                this.nodes[index].insert(obj);
                return;
            }
        }
        this.objects.push(obj);
        if (this.objects.length > this.maxChildren && this.level < this.maxDepth) {
            if (this.nodes[0] == null) {
                this.splitNode();
            }
            var i = 0;
            while (i < this.objects.length) {
                var idx = this.getIndex(this.objects[i]);
                if (idx != -1) {
                    this.nodes[idx].insert(this.objects[i]);
                    this.objects.splice(i, 1);
                } else {
                    i++;
                }
            }
        }
    }
    retrieve(returnObjects, obj) {
        var index = this.getIndex(obj);
        if (index != -1 && this.nodes[0] != null) {
            this.nodes[index].retrieve(returnObjects, obj);
        }
        returnObjects.push.apply(returnObjects, this.objects);
        return returnObjects;
    }
}

// Keep a body inside the rectangular world. Shape-agnostic: derive the body's
// half-extents from its own bounding box (radius for a circle; w/2,h/2 for a
// future box entity), then reflect+clamp via the SHARED bounds helper — the exact
// code the client predicts with, so a player reconciles cleanly even at a wall.
// Operates on the scratch position before move() commits it.
function bounceOffBoundry(obj, bound) {
    var ext = obj.getExtents();
    var halfW = (ext.maxX - ext.minX) / 2;
    var halfH = (ext.maxY - ext.minY) / 2;
    applyBounds(obj, bound, halfW, halfH, c.wallBounceDamping);
}
