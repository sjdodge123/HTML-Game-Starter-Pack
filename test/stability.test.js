// Stability test — exercises the fixed-timestep accumulator via the REAL
// Game.simulate path (no sockets; we never call Room.update, which would
// broadcast, only game.simulate, which is pure physics).
//
// Proves two properties the accumulator gives us:
//   1. Determinism under tick jitter: the same total simulated time produces the
//      same result regardless of how unevenly it was delivered.
//   2. No tunnelling / blow-up on a pathological long tick: a giant dt is absorbed
//      (anti-spiral clamp) and every body stays inside the world.
'use strict';
var game = require('../server/game.js');
var utils = require('../server/utils.js');
var c = utils.loadConfig();
var FIXED_DT = c.serverTickSpeed / 1000;

var passed = 0, failed = 0;
function check(name, cond) {
    if (cond) { passed++; console.log('  PASS  ' + name); }
    else { failed++; console.log('  FAIL  ' + name); }
}

// Build a room with two deterministically-placed, deterministically-driven
// players. (getRoom builds engine+world+game but touches no socket.)
function makeRoom() {
    var room = game.getRoom(1, 25);
    room.game.currentState = c.stateMap.playing;
    var p1 = room.world.createNewPlayer('p1');
    var p2 = room.world.createNewPlayer('p2');
    // Overwrite the random spawn with fixed positions + inputs so the sim is a
    // pure function of the number of fixed steps taken.
    p1.x = p1.newX = 300; p1.y = p1.newY = 384; p1.velX = p1.velY = 0;
    p2.x = p2.newX = 360; p2.y = p2.newY = 384; p2.velX = p2.velY = 0;
    p1.moveForward = false; p1.moveBackward = false; p1.turnLeft = false; p1.turnRight = true;  // drive right (into p2)
    p2.moveForward = false; p2.moveBackward = false; p2.turnLeft = false; p2.turnRight = false; // idle
    room.playerList.p1 = p1;
    room.playerList.p2 = p2;
    return room;
}
function snapshot(room) {
    var s = {};
    ['p1', 'p2'].forEach(function (id) {
        var p = room.playerList[id];
        s[id] = { x: Math.round(p.x * 1e6) / 1e6, y: Math.round(p.y * 1e6) / 1e6, vx: Math.round(p.velX * 1e6) / 1e6 };
    });
    return s;
}
function eq(a, b) {
    return ['p1', 'p2'].every(function (id) {
        return a[id].x === b[id].x && a[id].y === b[id].y && a[id].vx === b[id].vx;
    });
}

console.log('stability.test.js');

// --- 1. Determinism under tick jitter ---------------------------------------
// Control: 60 steady ticks of exactly FIXED_DT.
var control = makeRoom();
for (var i = 0; i < 60; i++) { control.game.simulate(FIXED_DT); }
var controlEnd = snapshot(control);

// Jittery: the SAME total time (60 * FIXED_DT), delivered in lumpy chunks (each
// under the MAX_SUBSTEPS clamp) — e.g. alternating 3x and 1x fixed steps.
var jitter = makeRoom();
var pattern = [3, 1, 2, 1, 3, 2, 1, 2, 1, 2, 1, 1]; // sums to 20 fixed steps
// repeat the pattern 3x => 60 fixed steps worth of time, lumpily delivered
var totalSteps = 0;
for (var r = 0; r < 3; r++) {
    for (var k = 0; k < pattern.length; k++) {
        jitter.game.simulate(pattern[k] * FIXED_DT);
        totalSteps += pattern[k];
    }
}
var jitterEnd = snapshot(jitter);

check('same total time => identical result regardless of tick jitter (deterministic)', eq(controlEnd, jitterEnd));
check('jitter run advanced the same number of fixed steps (60)', totalSteps === 60);
check('a collision actually happened during the run (p1 drove into p2)', controlEnd.p2.x > 360);

// --- 2. No tunnelling / blow-up on a pathological long tick -----------------
var stall = makeRoom();
// One absurd 10-second tick (e.g. the process was descheduled). Must NOT launch
// anyone off-map or produce NaN; the clamp absorbs it.
stall.game.simulate(10.0);
var w = stall.world, ok = true, finite = true;
['p1', 'p2'].forEach(function (id) {
    var p = stall.playerList[id];
    if (!(p.x >= w.x && p.x <= w.x + w.width && p.y >= w.y && p.y <= w.y + w.height)) { ok = false; }
    if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.velX)) { finite = false; }
});
check('a 10s pathological tick keeps every body inside the world (no tunnelling)', ok);
check('positions/velocities stay finite (no NaN/Infinity blow-up)', finite);
// The clamp means a 10s tick advances at most MAX_SUBSTEPS steps, not ~300.
var stall2 = makeRoom();
var stepsRun = 0;
var realStep = stall2.engine.step.bind(stall2.engine);
stall2.engine.step = function (dt, world, players) { stepsRun++; realStep(dt, world, players); };
stall2.game.simulate(10.0);
check('anti-spiral clamp caps catch-up at MAX_SUBSTEPS (' + c.maxSubStepsPerTick + ')', stepsRun === c.maxSubStepsPerTick);

console.log('stability: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
