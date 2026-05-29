// Headless integration test — two scripted clients against a running server.
// Decodes the wire arrays exactly like client/scripts/client.js, so it also
// guards the compressor<->decoder lockstep. Requires the server on :3000 and
// socket.io-client (npm install --no-save socket.io-client).
'use strict';
var { io } = require('socket.io-client');

var URL = 'http://localhost:3000';
var passed = 0, failed = 0;
function check(name, cond) {
    if (cond) { passed++; console.log('  PASS  ' + name); }
    else { failed++; console.log('  FAIL  ' + name); }
}
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

// A minimal client: connects and decodes snapshots into a local player map,
// mirroring the real client's decoders (positional arrays).
function mkClient() {
    var c = { id: null, world: null, state: null, config: null, players: {} };
    var s = io(URL, { transports: ['websocket'] });
    c.socket = s;
    s.on('gameState', function (gs) {
        c.id = gs.myID;
        c.config = gs.config;
        c.world = JSON.parse(gs.world);                 // [x,y,w,h]
        c.state = JSON.parse(gs.game)[0];               // [currentState]
        JSON.parse(gs.playerList).forEach(function (p) { // [id,x,y,color,radius]
            c.players[p[0]] = { x: p[1], y: p[2], color: p[3], radius: p[4] };
        });
    });
    s.on('playerJoin', function (pl) {
        var p = JSON.parse(pl.player);
        c.players[p[0]] = { x: p[1], y: p[2], color: p[3], radius: p[4] };
    });
    s.on('playerLeft', function (id) { delete c.players[id]; });
    s.on('gameUpdates', function (u) {
        c.state = JSON.parse(u.state)[0];
        u.playerList.forEach(function (p) {              // [id,x,y,velX,velY]
            if (c.players[p[0]]) { c.players[p[0]].x = p[1]; c.players[p[0]].y = p[2]; c.players[p[0]].velX = p[3]; }
        });
    });
    return c;
}

(async function () {
    console.log('integration.test.js');

    var a = mkClient();
    await sleep(300); a.socket.emit('enterGame', -1);
    await sleep(400);
    var b = mkClient();
    await sleep(300); b.socket.emit('enterGame', -1);
    await sleep(500);

    check('client A spawned with an id', a.id != null);
    check('A and B got distinct ids', a.id !== b.id);
    check('A sees both players', Object.keys(a.players).length === 2);
    check('B sees both players', Object.keys(b.players).length === 2);
    check('state is playing (1) with players connected', a.state === 1);
    check('world arena delivered (1366x768)', a.world && a.world[2] === 1366 && a.world[3] === 768);
    check('config delivered to client (single source of truth)', a.config != null && a.config.worldWidth === 1366);

    // Authoritative movement: drive A right, expect server to move it.
    var startX = a.players[a.id].x;
    a.socket.emit('movement', { moveForward: false, moveBackward: false, turnLeft: false, turnRight: true });
    await sleep(900);
    a.socket.emit('movement', { moveForward: false, moveBackward: false, turnLeft: false, turnRight: false });
    await sleep(200);
    var movedX = a.players[a.id].x;
    check('driving right moves the player (server-authoritative)', (movedX - startX) > 40);

    // Live sync: B sees A's new position.
    check('B sees A at the same authoritative x (live sync)',
        b.players[a.id] && Math.abs(b.players[a.id].x - movedX) < 40);

    // Disconnect: B leaving drops it from A's view.
    b.socket.close();
    await sleep(500);
    check('A drops B after B disconnects', Object.keys(a.players).length === 1);

    a.socket.close();
    console.log('integration: ' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed === 0 ? 0 : 1);
})();
