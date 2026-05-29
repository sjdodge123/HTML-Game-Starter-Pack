// Stability test — exercises the fixed-timestep accumulator via the REAL
// Game.simulate path (no sockets; we call game.simulate, which is pure physics,
// never Room.update which would broadcast).
//
// Proves: (1) determinism under tick jitter — same total simulated time gives the
// same result however unevenly it's delivered; (2) no tunnelling/blow-up on a
// pathological long tick (anti-spiral clamp).
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

// A room with two deterministically placed + driven players, registered as
// entities (Game.simulate iterates entities). y=100 keeps them clear of the
// default obstacles (which sit around mid-arena), so the collision under test is
// player-vs-player.
function makeRoom() {
    var room = game.getRoom(1, 25);
    room.game.currentState = c.stateMap.playing;
    var p1 = room.spawnPlayer('p1');
    var p2 = room.spawnPlayer('p2');
    p1.x = p1.newX = 300; p1.y = p1.newY = 100; p1.velX = p1.velY = 0;
    p2.x = p2.newX = 360; p2.y = p2.newY = 100; p2.velX = p2.velY = 0;
    p1.currentInput = { moveForward: false, moveBackward: false, turnLeft: false, turnRight: true };  // drive right into p2
    p2.currentInput = { moveForward: false, moveBackward: false, turnLeft: false, turnRight: false };
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

// 1. Determinism under tick jitter -------------------------------------------
var control = makeRoom();
for (var i = 0; i < 60; i++) { control.game.simulate(FIXED_DT); }
var controlEnd = snapshot(control);

var jitter = makeRoom();
var pattern = [3, 1, 2, 1, 3, 2, 1, 2, 1, 2, 1, 1]; // 20 fixed steps per pass
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
check('a collision actually happened (p1 drove into p2 and pushed it right)', controlEnd.p2.x > 360);

// 2. No tunnelling / blow-up on a pathological long tick ---------------------
var stall = makeRoom();
stall.game.simulate(10.0); // one absurd 10s tick (process descheduled)
var w = stall.world, inBounds = true, finite = true;
['p1', 'p2'].forEach(function (id) {
    var p = stall.playerList[id];
    if (!(p.x >= w.x && p.x <= w.x + w.width && p.y >= w.y && p.y <= w.y + w.height)) { inBounds = false; }
    if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.velX)) { finite = false; }
});
check('a 10s pathological tick keeps every body inside the world (no tunnelling)', inBounds);
check('positions/velocities stay finite (no NaN/Infinity blow-up)', finite);

var stall2 = makeRoom();
var stepsRun = 0;
var realStep = stall2.engine.step.bind(stall2.engine);
stall2.engine.step = function (dt, world, ents, statics) { stepsRun++; realStep(dt, world, ents, statics); };
stall2.game.simulate(10.0);
check('anti-spiral clamp caps catch-up at MAX_SUBSTEPS (' + c.maxSubStepsPerTick + ')', stepsRun === c.maxSubStepsPerTick);

console.log('stability: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
