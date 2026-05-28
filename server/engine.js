'use strict';
// Physics engine — the GENERIC half of chaochao's engine.js.
//
// chaochao's engine.js mixed a reusable core (a QuadTree broad-phase, the
// narrow-phase collision dispatch, velocity integration, boundary handling) with
// game-specific physics (Voronoi tile/cell collision, punches, pucks, cuts,
// explosions, projectiles, moving hazards). The skeleton keeps the entity-vs-entity
// core and DROPS everything map/ability/projectile-shaped:
//   - Engine.updatePlayers : integrate input -> velocity -> position each tick.
//   - broadBase / narrowBase : QuadTree broad-phase, then per-pair handleHit().
//   - QuadTree : the spatial index that keeps collision O(n log n), not O(n^2).
//   - bounceOffBoundry / checkDistance : keep entities in the arena.
//
// The collision contract is unchanged from chaochao: narrowBase calls
// obj.handleHit(other) on BOTH objects of a colliding pair, and each entity owns
// its own response (see Player.handleHit). The engine never reaches into entity
// internals — it only detects overlap and delegates.

var utils = require('./utils.js');
var c = utils.loadConfig();

exports.getEngine = function (playerList) {
    return new Engine(playerList);
};
exports.checkDistance = function (obj1, obj2) {
    return checkDistance(obj1, obj2);
};
exports.bounceOffBoundry = function (obj, bound) {
    bounceOffBoundry(obj, bound);
};

class Engine {
    constructor(playerList) {
        this.playerList = playerList;
        this.dt = 0;
        this.quadTree = null;
        this.worldWidth = 0;
        this.worldHeight = 0;
    }
    update(dt) {
        this.dt = dt;
        this.updatePlayers();
    }
    // Integrate each player's input into velocity and velocity into position.
    // Input arrives as four booleans (set by the movement socket event); they map
    // to a unit drive direction. This is chaochao's integration, stripped of the
    // AI branch, the stamina/exhaustion drive penalty, and speed/drag bonuses.
    updatePlayers() {
        for (var playerSig in this.playerList) {
            var player = this.playerList[playerSig];
            if (player.alive == false) {
                continue;
            }
            var dirX = 0;
            var dirY = 0;
            var braking = false;
            if (player.moveForward && !player.moveBackward && !player.turnLeft && !player.turnRight) {
                dirY = -1;
            } else if (!player.moveForward && player.moveBackward && !player.turnLeft && !player.turnRight) {
                dirY = 1;
            } else if (!player.moveForward && !player.moveBackward && player.turnLeft && !player.turnRight) {
                dirX = -1;
            } else if (!player.moveForward && !player.moveBackward && !player.turnLeft && player.turnRight) {
                dirX = 1;
            } else if (player.moveForward && !player.moveBackward && player.turnLeft && !player.turnRight) {
                dirY = -Math.SQRT1_2; dirX = -Math.SQRT1_2;
            } else if (player.moveForward && !player.moveBackward && !player.turnLeft && player.turnRight) {
                dirY = -Math.SQRT1_2; dirX = Math.SQRT1_2;
            } else if (!player.moveForward && player.moveBackward && player.turnLeft && !player.turnRight) {
                dirY = Math.SQRT1_2; dirX = -Math.SQRT1_2;
            } else if (!player.moveForward && player.moveBackward && !player.turnLeft && player.turnRight) {
                dirY = Math.SQRT1_2; dirX = Math.SQRT1_2;
            } else {
                braking = true;
            }

            var newVelX = player.velX + player.acel * dirX * this.dt;
            var newVelY = player.velY + player.acel * dirY * this.dt;

            if (braking) {
                newVelX -= player.brakeCoeff * player.velX;
                newVelY -= player.brakeCoeff * player.velY;
            } else {
                newVelX -= player.dragCoeff * player.velX;
                newVelY -= player.dragCoeff * player.velY;
            }

            var newVel = utils.getMag(newVelX, newVelY);
            if (newVel > player.maxVelocity) {
                player.velX = player.maxVelocity * (newVelX / newVel);
                player.velY = player.maxVelocity * (newVelY / newVel);
            } else {
                player.velX = newVelX;
                player.velY = newVelY;
            }
            // Integrate into the SCRATCH position (newX/newY). The authoritative
            // x/y isn't committed until Player.move() runs after collision
            // resolution, so collision tests this tick see the about-to-be position.
            player.newX += player.velX * this.dt;
            player.newY += player.velY * this.dt;
        }
    }
    // Broad-phase: rebuild the QuadTree from this tick's entities, then for each
    // entity retrieve only the candidates sharing its quadrant and narrow-phase
    // those. This keeps collision near O(n log n) instead of the O(n^2) all-pairs
    // scan a naive loop would do.
    broadBase(objectArray) {
        this.quadTree.clear();
        for (var i = 0; i < objectArray.length; i++) {
            this.quadTree.insert(objectArray[i]);
        }
        for (var j = 0; j < objectArray.length; j++) {
            var obj1 = objectArray[j];
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

// Distance check between two circular bodies, using the scratch position
// (newX/newY) when present. true when they overlap. From chaochao's engine.
function checkDistance(obj1, obj2) {
    var objX1 = obj1.newX || obj1.x;
    var objY1 = obj1.newY || obj1.y;
    var objX2 = obj2.newX || obj2.x;
    var objY2 = obj2.newY || obj2.y;
    var distance = utils.getMag(objX2 - objX1, objY2 - objY1);
    distance -= obj1.radius || obj1.height / 2;
    distance -= obj2.radius || obj2.height / 2;
    return distance <= 0;
}

// Keep a circular body inside the rectangular world. Adapted from chaochao's
// bounceOffBoundry: where the original was tuned for projectiles (flip an angle,
// multiply velocity by -3 to ricochet faster), the skeleton's players have no
// angle and shouldn't gain energy off a wall — so we clamp the body just inside
// the edge and reflect the offending velocity component, damped, for a clean
// elastic bounce. Operates on the scratch position before Player.move() commits it.
function bounceOffBoundry(obj, bound) {
    var damp = c.wallBounceDamping;
    if (obj.newX - obj.radius < bound.x) {
        obj.newX = bound.x + obj.radius;
        obj.velX = -obj.velX * damp;
    }
    if (obj.newX + obj.radius > bound.x + bound.width) {
        obj.newX = bound.x + bound.width - obj.radius;
        obj.velX = -obj.velX * damp;
    }
    if (obj.newY - obj.radius < bound.y) {
        obj.newY = bound.y + obj.radius;
        obj.velY = -obj.velY * damp;
    }
    if (obj.newY + obj.radius > bound.y + bound.height) {
        obj.newY = bound.y + bound.height - obj.radius;
        obj.velY = -obj.velY * damp;
    }
}
