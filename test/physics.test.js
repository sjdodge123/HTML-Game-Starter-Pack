// Deterministic physics unit test — no server, no network.
// Exercises the collision/bounce math in engine.js + player.js directly.
'use strict';
var _engine = require('../server/engine.js');
var { Player } = require('../server/entities/player.js');

var passed = 0, failed = 0;
function check(name, cond) {
    if (cond) { passed++; console.log('  PASS  ' + name); }
    else { failed++; console.log('  FAIL  ' + name); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 0.5); }

// Run two overlapping circles (centres 10px apart, radius 12 each) through the
// engine's broad+narrow phase, mirroring Game.simulate's per-tick snapshot.
function collide(v1, v2) {
    var p1 = new Player(100, 100, 'red', 'p1', 0);
    var p2 = new Player(110, 100, 'blue', 'p2', 0);
    p1.velX = v1; p2.velX = v2;
    p1.newX = p1.x; p1.newY = p1.y; p2.newX = p2.x; p2.newY = p2.y;
    p1.cvX = p1.velX; p1.cvY = p1.velY; p2.cvX = p2.velX; p2.cvY = p2.velY;
    p1.hitThisTick = {}; p2.hitThisTick = {};
    var eng = _engine.getEngine({ p1: p1, p2: p2 });
    eng.setWorldBounds(1366, 768);
    eng.broadBase([p1, p2]);
    return { p1: p1, p2: p2 };
}

console.log('physics.test.js');

var a = collide(50, -50);
check('head-on symmetric exchanges velocity (-50 / +50)', near(a.p1.velX, -50) && near(a.p2.velX, 50));
check('head-on separates the pair (>10px apart)', (a.p2.newX - a.p1.newX) > 10);

var b = collide(100, 0);
check("into a stationary circle => Newton's cradle (0 / +100)", near(b.p1.velX, 0) && near(b.p2.velX, 100));

var c = collide(-30, 0);
check('already separating => no exchange (-30 / 0)', near(c.p1.velX, -30) && near(c.p2.velX, 0));

// Wall: a circle pushed past the left edge is clamped inside and reflected.
var w = new Player(5, 400, 'g', 'w', 0);
w.velX = -100; w.newX = w.x + w.velX * 0.033; w.newY = w.y;
_engine.bounceOffBoundry(w, { x: 0, y: 0, width: 1366, height: 768 });
check('wall clamps inside (newX >= radius)', w.newX >= 12);
check('wall reflects velocity (velX > 0)', w.velX > 0);

console.log('physics: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
