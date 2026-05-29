// Entity + obstacle collision test — the new collision paths added by the entity
// model: dynamic-vs-static (circle obstacle + box obstacle, immovable bounce),
// cross-type dynamic-vs-dynamic (player vs pickup), and pickup-vs-wall.
'use strict';
var _engine = require('../server/engine.js');
var { Player } = require('../server/entities/player.js');
var { Pickup } = require('../server/entities/pickup.js');
var { CircleObstacle, BoxObstacle } = require('../server/entities/obstacles.js');
var utils = require('../server/utils.js');
var c = utils.loadConfig();
var WORLD = { x: 0, y: 0, width: c.worldWidth, height: c.worldHeight };

var passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  PASS  ' + name); } else { failed++; console.log('  FAIL  ' + name); } }

console.log('engine.test.js');

// --- player vs immovable CIRCLE obstacle ------------------------------------
// Player just right of the obstacle, moving left into it. Expect: bounced right
// (velX > 0), pushed out (newX increased).
(function () {
    var obs = new CircleObstacle(400, 384, 30, 'o');
    var p = new Player(440, 384, 'red', 'p', 0);
    p.newX = 440; p.newY = 384; p.velX = -300; p.velY = 0;
    p.cvX = p.velX; p.cvY = p.velY; p.hitThisTick = {};
    var startX = p.newX;
    p.handleHit(obs);
    check('player bounces off a circle obstacle (velX reversed to +)', p.velX > 0);
    check('player pushed out of the circle obstacle (newX increased)', p.newX > startX);
    check('circle obstacle is immovable (unchanged)', obs.x === 400 && obs.velX == null || obs.x === 400);
})();

// --- player vs immovable BOX obstacle ---------------------------------------
// Player just left of the box's left face, moving right into it. Expect bounced
// left (velX < 0) and pushed out (newX decreased).
(function () {
    var box = new BoxObstacle(400, 360, 80, 48, 'b'); // x:400..480, y:360..408
    var p = new Player(395, 384, 'red', 'p2', 0);
    p.newX = 395; p.newY = 384; p.velX = 300; p.velY = 0;
    p.cvX = p.velX; p.cvY = p.velY; p.hitThisTick = {};
    var startX = p.newX;
    p.handleHit(box);
    check('player bounces off a box obstacle (velX reversed to -)', p.velX < 0);
    check('player pushed out of the box obstacle (newX decreased)', p.newX < startX);
})();

// --- cross-type: player vs pickup (both movable) ----------------------------
// Player moving right into a stationary pickup. Equal-mass-style exchange: the
// pickup gains rightward velocity and the pair separates.
(function () {
    var pl = new Player(100, 100, 'red', 'pl', 0);
    pl.newX = 100; pl.newY = 100; pl.velX = 200; pl.velY = 0; pl.cvX = 200; pl.cvY = 0; pl.hitThisTick = {};
    var pk = new Pickup(115, 100, 'pk');
    pk.newX = 115; pk.newY = 100; pk.velX = 0; pk.velY = 0; pk.cvX = 0; pk.cvY = 0; pk.hitThisTick = {};
    pl.handleHit(pk);
    pk.handleHit(pl);
    check('cross-type collision: pickup gains rightward velocity from the player', pk.velX > 0);
    check('cross-type collision: bodies separate (pickup pushed right of player)', pk.newX > pl.newX);
})();

// --- pickup bounces off the world wall (via engine.step) --------------------
(function () {
    var eng = _engine.getEngine();
    eng.setWorldBounds(WORLD.width, WORLD.height);
    var pk = new Pickup(12, 384, 'pkw');
    pk.velX = -200; pk.velY = 0; pk.newX = 12; pk.newY = 384;
    eng.step(1 / 30, WORLD, [pk], []);
    check('pickup bounces off the left wall (velX reversed to +)', pk.velX > 0);
    check('pickup stays inside the world (x >= radius)', pk.x >= pk.radius - 1e-6);
})();

console.log('engine: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
