'use strict';
// Player — chaochao's entities/player.js gutted to the essentials of a
// server-driven circle: input flags, velocity/physics constants, the per-tick
// move(), and a handleHit() that bounces off other players.
//
// Everything the racing game layered on is gone: punches, charge/stamina,
// abilities, fire, infection/zombies, AFK sleep/kick, scoring (notches), bot
// steering, avatar skins. What remains is the smallest authoritative entity that
// the engine can drive and that resolves its own collisions.

var utils = require('../utils.js');
var c = utils.loadConfig();
var { Circle } = require('./shapes.js');

class Player extends Circle {
    constructor(x, y, color, id, roomSig) {
        super(x, y, c.playerBaseRadius, color);
        this.isPlayer = true;
        this.alive = true;
        this.id = id;
        this.roomSig = roomSig;

        // Input flags — set by the 'movement' socket event (messenger.js), read by
        // the engine's integration. The client never moves itself; it only reports
        // which keys are down, and the server decides the resulting motion.
        this.moveForward = false;
        this.moveBackward = false;
        this.turnLeft = false;
        this.turnRight = false;

        // Physics state + per-player constants (seeded from config so all tuning
        // lives in one place). newX/newY come from Shape.
        this.velX = 0;
        this.velY = 0;
        // Pre-collision velocity snapshot. The engine's narrow-phase calls
        // handleHit on BOTH bodies of a pair, so if each read the other's LIVE
        // velocity the second call would see the first's already-bounced value and
        // the exchange wouldn't compose. game.js snapshots velX/velY into cvX/cvY
        // for every player right before broadBase, and handleHit reads the snapshot
        // — making the response order-independent. (See Game.simulate.)
        this.cvX = 0;
        this.cvY = 0;
        // Pairs already bounced THIS tick. The broad-phase visits each unordered
        // pair from both sides (it narrow-phases the candidates of p1 AND of p2),
        // so without this guard each pair's response would apply twice. Cleared
        // each tick by Game.simulate alongside the velocity snapshot.
        this.hitThisTick = {};
        this.acel = c.playerBaseAcel;
        this.maxVelocity = c.playerMaxSpeed;
        this.dragCoeff = c.playerDragCoeff;
        this.brakeCoeff = c.playerBrakeCoeff;
    }
    // Commit the scratch position the engine integrated (and collisions adjusted)
    // into the authoritative position. Called once per tick after the engine has
    // integrated velocity, bounced off walls, and resolved entity collisions.
    move() {
        this.x = this.newX;
        this.y = this.newY;
    }
    // The collision response. The engine's narrow-phase calls this on BOTH bodies
    // of an overlapping pair, so each player resolves itself symmetrically:
    //   1. push apart by half the overlap (so they don't sink into each other),
    //   2. exchange the velocity component along the collision normal — the
    //      equal-mass elastic result (each call applies its own half, and the two
    //      halves compose into a full exchange).
    // Guarded on isPlayer so any future non-player entity is simply ignored here.
    handleHit(object) {
        if (!object.isPlayer) {
            return;
        }
        // Resolve each pair once per tick (the broad-phase visits it from both sides).
        if (this.hitThisTick[object.id]) {
            return;
        }
        this.hitThisTick[object.id] = true;
        var dx = this.newX - object.newX;
        var dy = this.newY - object.newY;
        var dist = utils.getMag(dx, dy);
        if (dist === 0) {
            // Perfectly stacked — nudge along a deterministic axis so the normal is
            // defined and they separate next test.
            dx = 1; dy = 0; dist = 1;
        }
        var nx = dx / dist;
        var ny = dy / dist;

        // Separate: push this body out by half the penetration depth.
        var overlap = (this.radius + object.radius) - dist;
        if (overlap > 0) {
            this.newX += nx * (overlap / 2);
            this.newY += ny * (overlap / 2);
        }

        // Relative velocity along the normal, using the PRE-collision snapshots so
        // both bodies' calls agree (see cvX/cvY above). Negative => the two are
        // closing; only then do we exchange the normal component, so resting
        // contact doesn't jitter. Equal mass: each call applies its own half, and
        // the two compose into a full exchange of the normal-direction velocity.
        var relVel = (this.cvX - object.cvX) * nx + (this.cvY - object.cvY) * ny;
        if (relVel < 0) {
            this.velX -= relVel * nx;
            this.velY -= relVel * ny;
        }
    }
}

module.exports = { Player };
