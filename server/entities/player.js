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
        // Per-input queue. The client produces ONE seq'd input command per fixed
        // step and sends it; the server enqueues them here and consumes exactly ONE
        // per simulation sub-step (Player.control), in order. Consuming one-per-step
        // (rather than latching only the latest) makes the server apply each input
        // for the same single step the client predicted it for — so a non-colliding
        // player reconciles bit-exactly, not approximately.
        this.inputQueue = [];
        // The last consumed command's keys, reused while the queue is empty (a brief
        // network gap) so the player coasts on its last input instead of stalling.
        this.currentInput = { moveForward: false, moveBackward: false, turnLeft: false, turnRight: false };
        // Highest seq CONSUMED — echoed to the owning client every tick as its
        // reconciliation ack (drop inputs <= this, replay the rest). Advances by one
        // per command consumed; stays put when the queue is empty.
        this.lastInputSeq = 0;
        // Highest seq ever ENQUEUED — guards against stale/duplicate/out-of-order
        // commands at the queue boundary.
        this.lastQueuedSeq = 0;
        // Movement tuning, pulled from config once so the shared integrator gets the
        // same numbers on both sides (single source of truth).
        this.moveConsts = {
            acel: c.playerBaseAcel,
            maxVelocity: c.playerMaxSpeed,
            dragCoeff: c.playerDragCoeff,
            brakeCoeff: c.playerBrakeCoeff
        };
    }
    // Enqueue one client input command. Rejected if it's stale/duplicate (seq not
    // strictly greater than the last enqueued). The queue is bounded; on overflow
    // the OLDEST is dropped (prefer the freshest input — lower latency), which
    // reconciliation absorbs on the client.
    enqueueInput(cmd) {
        if (cmd.seq <= this.lastQueuedSeq) {
            return; // stale, duplicate, or reordered
        }
        this.lastQueuedSeq = cmd.seq;
        this.inputQueue.push(cmd);
        if (this.inputQueue.length > c.maxInputQueue) {
            this.inputQueue.shift();
        }
    }
    // Consume exactly ONE queued input (if any) and drive velocity + scratch
    // position from it, using the exact same function the client predicts with.
    // With the queue empty (a network gap), reuse the last consumed input so motion
    // continues smoothly; lastInputSeq only advances when a command is consumed.
    control(dt) {
        if (this.inputQueue.length > 0) {
            var cmd = this.inputQueue.shift();
            this.currentInput.moveForward = cmd.moveForward;
            this.currentInput.moveBackward = cmd.moveBackward;
            this.currentInput.turnLeft = cmd.turnLeft;
            this.currentInput.turnRight = cmd.turnRight;
            this.lastInputSeq = cmd.seq;
        }
        applyMovement(this, this.currentInput, dt, this.moveConsts);
    }
}

module.exports = { Player };
