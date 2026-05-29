// Shared movement integrator test — the function both server and client run.
// Determinism + clamping here is what makes client-side prediction match the
// server (any divergence would show up as reconciliation jitter).
'use strict';
var { applyMovement } = require('../shared/movement.js');
var utils = require('../server/utils.js');
var c = utils.loadConfig();

var consts = { acel: c.playerBaseAcel, maxVelocity: c.playerMaxSpeed, dragCoeff: c.playerDragCoeff, brakeCoeff: c.playerBrakeCoeff };
var DT = c.serverTickSpeed / 1000;

var passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  PASS  ' + name); } else { failed++; console.log('  FAIL  ' + name); } }
function fresh() { return { x: 0, y: 0, newX: 0, newY: 0, velX: 0, velY: 0 }; }
var UP = { moveForward: true, moveBackward: false, turnLeft: false, turnRight: false };
var NONE = { moveForward: false, moveBackward: false, turnLeft: false, turnRight: false };

console.log('movement.test.js');

// Accelerate upward: velY goes negative, position moves up.
var e = fresh();
applyMovement(e, UP, DT, consts);
check('holding up accelerates upward (velY < 0, moved up)', e.velY < 0 && e.newY < 0 && e.velX === 0);

// Determinism: identical (state, input, dt) => identical result, every time.
var a = fresh(), b = fresh();
for (var i = 0; i < 100; i++) { applyMovement(a, UP, DT, consts); }
for (var j = 0; j < 100; j++) { applyMovement(b, UP, DT, consts); }
check('deterministic: same inputs => identical state', a.velY === b.velY && a.newY === b.newY);

// Speed clamp: velocity magnitude never exceeds maxVelocity, even after long hold.
var f = fresh();
for (var k = 0; k < 1000; k++) { applyMovement(f, UP, DT, consts); }
var speed = Math.sqrt(f.velX * f.velX + f.velY * f.velY);
check('top speed is clamped to maxVelocity', speed <= c.playerMaxSpeed + 1e-6);

// Braking: with no input, an existing velocity decays toward zero.
var g = fresh(); g.velX = 300; g.velY = 0;
var before = Math.abs(g.velX);
applyMovement(g, NONE, DT, consts);
check('no input brakes (speed decreases)', Math.abs(g.velX) < before);

console.log('movement: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
