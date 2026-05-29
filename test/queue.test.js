// Per-input queue test — the server consumes exactly one queued input command per
// simulation sub-step, in order, applying each with the SHARED integrator. This is
// what makes the server advance a player identically to the client's prediction
// (tight, near-zero-correction reconciliation for free movement).
'use strict';
var { Player } = require('../server/entities/player.js');
var { applyMovement } = require('../shared/movement.js');
var utils = require('../server/utils.js');
var c = utils.loadConfig();
var DT = c.serverTickSpeed / 1000;

var passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  PASS  ' + name); } else { failed++; console.log('  FAIL  ' + name); } }
function cmd(seq, f, b, l, r) { return { seq: seq, moveForward: !!f, moveBackward: !!b, turnLeft: !!l, turnRight: !!r }; }

console.log('queue.test.js');

// --- consume one per step; ack advances per consumed command ----------------
(function () {
    var p = new Player(0, 0, '#fff', 'p', 0);
    for (var s = 1; s <= 5; s++) { p.enqueueInput(cmd(s, false, false, false, true)); }
    p.control(DT); p.control(DT); p.control(DT);
    check('consumes one input per control() (ack=3, 2 left queued)', p.lastInputSeq === 3 && p.inputQueue.length === 2);
    p.control(DT); p.control(DT);
    check('drains the queue in order (ack=5, queue empty)', p.lastInputSeq === 5 && p.inputQueue.length === 0);
    var seqBefore = p.lastInputSeq, vxBefore = p.velX;
    p.control(DT); // empty: reuse last input, ack unchanged, motion continues
    check('empty queue reuses last input (ack unchanged)', p.lastInputSeq === seqBefore);
    check('empty queue still advances motion (velX changed)', p.velX !== vxBefore);
})();

// --- determinism vs the shared integrator -----------------------------------
// A player fed N commands through the queue must end exactly where N direct
// applyMovement calls with the same inputs land.
(function () {
    var inputs = [];
    for (var i = 1; i <= 40; i++) {
        // vary the input so it's not a trivial constant
        inputs.push(cmd(i, i % 2 === 0, false, i % 3 === 0, i % 2 === 1));
    }
    // Interleave enqueue+consume one-at-a-time — exactly how it runs live (client
    // sends one per step, server consumes one per step), which also keeps the queue
    // within its bound.
    var p = new Player(0, 0, '#fff', 'p2', 0);
    var ref = { velX: 0, velY: 0, newX: 0, newY: 0 };
    var consts = { acel: c.playerBaseAcel, maxVelocity: c.playerMaxSpeed, dragCoeff: c.playerDragCoeff, brakeCoeff: c.playerBrakeCoeff };
    for (var k = 0; k < inputs.length; k++) {
        p.enqueueInput(inputs[k]);
        p.control(DT);
        applyMovement(ref, inputs[k], DT, consts);
    }

    check('queue consumption matches the shared integrator exactly (position)', p.newX === ref.newX && p.newY === ref.newY);
    check('queue consumption matches the shared integrator exactly (velocity)', p.velX === ref.velX && p.velY === ref.velY);
})();

// --- dedup: stale / out-of-order seq rejected -------------------------------
(function () {
    var p = new Player(0, 0, '#fff', 'p3', 0);
    p.enqueueInput(cmd(5, false, false, false, true));
    p.enqueueInput(cmd(3, false, false, false, true)); // stale
    p.enqueueInput(cmd(5, false, false, false, true)); // duplicate
    check('stale/duplicate inputs are rejected at the queue', p.inputQueue.length === 1 && p.lastQueuedSeq === 5);
})();

// --- bounded queue: overflow drops the oldest -------------------------------
(function () {
    var p = new Player(0, 0, '#fff', 'p4', 0);
    for (var s = 1; s <= c.maxInputQueue + 5; s++) { p.enqueueInput(cmd(s, false, false, false, true)); }
    check('queue is bounded to maxInputQueue', p.inputQueue.length === c.maxInputQueue);
    check('overflow drops the oldest (freshest kept)', p.inputQueue[0].seq === 6 && p.lastQueuedSeq === c.maxInputQueue + 5);
})();

console.log('queue: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
