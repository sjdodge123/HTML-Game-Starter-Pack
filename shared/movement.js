// Shared movement integrator — the ONE piece of simulation code that runs on
// BOTH the server (authoritative) and the client (prediction). Client-side
// prediction only feels right if the client advances the local player with the
// EXACT math the server uses; keeping that math here, used by both sides, is what
// guarantees they agree (any divergence shows up as reconciliation jitter).
//
// It is a pure function of (entity, input, dt, constants): it reads the four
// movement booleans, updates velX/velY (accelerate, drag/brake, clamp to top
// speed), and integrates the scratch position newX/newY. No collision, no walls —
// the engine/client layer adds those around it.
//
// Loaded by Node via require() (server) and as a plain <script> global (browser),
// so it's written in the small UMD shim below with zero dependencies.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();        // Node: const { applyMovement } = require('.../movement.js')
    } else {
        root.SharedMovement = factory();   // Browser: window.SharedMovement.applyMovement(...)
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var SQRT1_2 = Math.SQRT1_2;

    // Map the four held-direction booleans to a unit drive vector (8 directions),
    // or flag braking when no clean direction is held.
    function driveFromInput(input) {
        var f = input.moveForward, b = input.moveBackward, l = input.turnLeft, r = input.turnRight;
        if (f && !b && !l && !r) { return { x: 0, y: -1, braking: false }; }
        if (!f && b && !l && !r) { return { x: 0, y: 1, braking: false }; }
        if (!f && !b && l && !r) { return { x: -1, y: 0, braking: false }; }
        if (!f && !b && !l && r) { return { x: 1, y: 0, braking: false }; }
        if (f && !b && l && !r) { return { x: -SQRT1_2, y: -SQRT1_2, braking: false }; }
        if (f && !b && !l && r) { return { x: SQRT1_2, y: -SQRT1_2, braking: false }; }
        if (!f && b && l && !r) { return { x: -SQRT1_2, y: SQRT1_2, braking: false }; }
        if (!f && b && !l && r) { return { x: SQRT1_2, y: SQRT1_2, braking: false }; }
        return { x: 0, y: 0, braking: true };
    }

    // Advance one entity by `dt` seconds given its held `input`. `c` carries the
    // tuning (acel, maxVelocity, dragCoeff, brakeCoeff) — passed in from config so
    // the single source of truth drives both sides. Mutates e.velX/velY/newX/newY.
    function applyMovement(e, input, dt, c) {
        var d = driveFromInput(input);

        var newVelX = e.velX + c.acel * d.x * dt;
        var newVelY = e.velY + c.acel * d.y * dt;

        if (d.braking) {
            newVelX -= c.brakeCoeff * e.velX;
            newVelY -= c.brakeCoeff * e.velY;
        } else {
            newVelX -= c.dragCoeff * e.velX;
            newVelY -= c.dragCoeff * e.velY;
        }

        var newVel = Math.sqrt(newVelX * newVelX + newVelY * newVelY);
        if (newVel > c.maxVelocity) {
            // newVel > maxVelocity > 0, so this division is always safe (no 0/0).
            var scale = c.maxVelocity / newVel;
            e.velX = newVelX * scale;
            e.velY = newVelY * scale;
        } else {
            e.velX = newVelX;
            e.velY = newVelY;
        }
        e.newX += e.velX * dt;
        e.newY += e.velY * dt;
    }

    return { applyMovement: applyMovement, driveFromInput: driveFromInput };
}));
