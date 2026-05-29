// Engine micro-benchmark — measures the per-tick simulation cost in isolation
// (no sockets, no broadcast), so we can see whether the engine is CPU-bound and
// how it scales with player count. Drives players with randomly-changing input so
// they actually move, bounce off walls, and collide.
//
// Works against BOTH the pre- and post-refactor engine: it prefers engine.step()
// (the refactored single-step entry) and falls back to replicating the old
// game.simulate loop (engine.update + manual bounce/broadBase/move) when step()
// isn't present.
'use strict';
var _engine = require('../server/engine.js');
var { Player } = require('../server/entities/player.js');
var utils = require('../server/utils.js');
var c = utils.loadConfig();

var WORLD = { x: 0, y: 0, width: c.worldWidth, height: c.worldHeight };
var FIXED_DT = c.serverTickSpeed / 1000;

// Deterministic pseudo-random so runs are comparable (no Math.random()).
var seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

function makePlayers(n) {
    var map = {};
    for (var i = 0; i < n; i++) {
        var id = 'p' + i;
        var p = new Player(0, 0, '#fff', id, 0);
        p.x = p.newX = 50 + rnd() * (WORLD.width - 100);
        p.y = p.newY = 50 + rnd() * (WORLD.height - 100);
        map[id] = p;
    }
    return map;
}
function randomizeInput(p) {
    p.moveForward = rnd() < 0.4;
    p.moveBackward = !p.moveForward && rnd() < 0.3;
    p.turnLeft = rnd() < 0.4;
    p.turnRight = !p.turnLeft && rnd() < 0.3;
}

// One full tick of simulation, however the engine exposes it.
function tick(engine, map, players) {
    if (typeof engine.step === 'function') {
        engine.step(FIXED_DT, WORLD, players);
        return;
    }
    // Legacy path: mirror the original game.simulate ordering.
    engine.update(FIXED_DT);
    for (var i = 0; i < players.length; i++) {
        _engine.bounceOffBoundry(players[i], WORLD);
        players[i].cvX = players[i].velX; players[i].cvY = players[i].velY;
        players[i].hitThisTick = {};
    }
    engine.broadBase(players);
    for (var j = 0; j < players.length; j++) { players[j].move(); }
}

function bench(n, ticks) {
    var map = makePlayers(n);
    var players = Object.keys(map).map(function (k) { return map[k]; });
    var engine = _engine.getEngine(map);
    engine.setWorldBounds(WORLD.width, WORLD.height);

    // Warm up V8 (JIT) before timing.
    for (var w = 0; w < 500; w++) {
        if (w % 8 === 0) { for (var a = 0; a < players.length; a++) randomizeInput(players[a]); }
        tick(engine, map, players);
    }
    var t0 = process.hrtime.bigint();
    for (var t = 0; t < ticks; t++) {
        if (t % 8 === 0) { for (var b = 0; b < players.length; b++) randomizeInput(players[b]); }
        tick(engine, map, players);
    }
    var t1 = process.hrtime.bigint();
    var totalMs = Number(t1 - t0) / 1e6;
    var usPerTick = (totalMs * 1000) / ticks;
    var budgetPct = (usPerTick / 1000) / c.serverTickSpeed * 100;
    console.log('  N=' + String(n).padStart(4) +
        '  ' + usPerTick.toFixed(2).padStart(8) + ' µs/tick' +
        '   (' + budgetPct.toFixed(3) + '% of the ' + c.serverTickSpeed.toFixed(1) + 'ms tick budget)');
}

console.log('perf.bench.js  —  ' + (typeof _engine.getEngine({}).step === 'function' ? 'step() API' : 'legacy API'));
var TICKS = 20000;
[25, 100, 250].forEach(function (n) { bench(n, TICKS); });
