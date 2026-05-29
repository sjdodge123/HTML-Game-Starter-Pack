'use strict';
// Player — a dynamic Entity driven by client input. All the geometry, collision
// response, and lifecycle now live in the Entity base; Player only adds the input
// it carries and the per-step "apply input to motion" via the SHARED integrator
// (shared/movement.js), which the client runs too for prediction. Keeping that
// math shared is what lets client-side prediction agree with the server.

var utils = require('../utils.js');
var c = utils.loadConfig();
var { Entity } = require('./entity.js');
var { applyMovement } = require('../../shared/movement.js');

class Player extends Entity {
    constructor(x, y, color, id, roomSig) {
        super(x, y, c.playerBaseRadius, color, id, 'player');
        this.roomSig = roomSig;
        // Latest reported held input. The movement handler overwrites this; the
        // engine applies it each step. (The skeleton applies the most recent input
        // each step — see README for the per-input-queue variant.)
        this.currentInput = { moveForward: false, moveBackward: false, turnLeft: false, turnRight: false };
        // Highest input sequence number processed, echoed back to the owning client
        // every tick so it can reconcile its prediction (drop acked inputs, replay
        // the rest). Monotonic; stale/duplicate inputs (seq <= this) are ignored.
        this.lastInputSeq = 0;
        // Movement tuning, pulled from config once so the shared integrator gets the
        // same numbers on both sides (single source of truth).
        this.moveConsts = {
            acel: c.playerBaseAcel,
            maxVelocity: c.playerMaxSpeed,
            dragCoeff: c.playerDragCoeff,
            brakeCoeff: c.playerBrakeCoeff
        };
    }
    // Drive velocity + scratch position from the held input, using the exact same
    // function the client predicts with.
    control(dt) {
        applyMovement(this, this.currentInput, dt, this.moveConsts);
    }
}

module.exports = { Player };
