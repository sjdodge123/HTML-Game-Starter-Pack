// Headless integration test — two scripted clients against a running server.
// Decodes the wire arrays exactly like client/scripts/client.js, so it also guards
// the compressor<->decoder lockstep and the new protocol (type-tagged entities,
// input acks, obstacles, protocol version). Requires the server on :3000 and
// socket.io-client.
'use strict';
var { io } = require('socket.io-client');

var URL = 'http://localhost:3000';
var passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  PASS  ' + name); } else { failed++; console.log('  FAIL  ' + name); } }
var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

function mkClient() {
    var cl = { id: null, world: null, obstacles: null, state: null, config: null, version: null, entities: {}, seq: 0, lastAck: null };
    var s = io(URL, { transports: ['websocket'] });
    cl.socket = s;
    s.on('gameState', function (gs) {
        cl.version = gs.protocolVersion;
        cl.id = gs.myID;
        cl.config = gs.config;
        cl.world = JSON.parse(gs.world);             // [x,y,w,h]
        cl.obstacles = JSON.parse(gs.obstacles);     // tagged rows
        cl.state = JSON.parse(gs.game)[0];
        JSON.parse(gs.entityList).forEach(function (a) { // [type,id,x,y,color,radius]
            cl.entities[a[1]] = { type: a[0], x: a[2], y: a[3], color: a[4], radius: a[5] };
        });
    });
    s.on('entitySpawn', function (rec) {
        var a = JSON.parse(rec);
        cl.entities[a[1]] = { type: a[0], x: a[2], y: a[3], color: a[4], radius: a[5] };
    });
    s.on('entityDespawn', function (id) { delete cl.entities[id]; });
    s.on('gameUpdates', function (u) {
        cl.state = JSON.parse(u.state)[0];
        cl.tick = u.tick;
        u.entityList.forEach(function (row) {            // [id,x,y,vx,vy,ack]
            var e = cl.entities[row[0]];
            if (e) { e.x = row[1]; e.y = row[2]; e.velX = row[3]; e.velY = row[4]; }
            if (row[0] === cl.id) { cl.lastAck = row[5]; }
        });
    });
    return cl;
}
function drive(cl, dirs) {
    cl.seq++;
    cl.socket.emit('movement', Object.assign({ seq: cl.seq, moveForward: false, moveBackward: false, turnLeft: false, turnRight: false }, dirs));
}
function countType(cl, type) { return Object.keys(cl.entities).filter(function (k) { return cl.entities[k].type === type; }).length; }

(async function () {
    console.log('integration.test.js');

    var a = mkClient();
    await sleep(300); a.socket.emit('enterGame', -1);
    await sleep(500);
    var b = mkClient();
    await sleep(300); b.socket.emit('enterGame', -1);
    await sleep(600);

    check('protocol version delivered (v1)', a.version === 1);
    check('A and B got distinct ids', a.id != null && a.id !== b.id);
    check('A sees both players', countType(a, 'player') === 2);
    check('B sees both players', countType(b, 'player') === 2);
    check('pickups spawned and are visible (mode-spawned entities)', countType(a, 'pickup') >= 1);
    check('static obstacles delivered on join', Array.isArray(a.obstacles) && a.obstacles.length >= 1);
    check('world arena delivered (1366x768)', a.world && a.world[2] === 1366 && a.world[3] === 768);
    check('config delivered (single source of truth)', a.config != null && a.config.worldWidth === 1366);
    check('state is playing (1)', a.state === 1);

    // Authoritative movement: drive A right for ~1s, expect the server to move it
    // and to ack our input sequence.
    var startX = a.entities[a.id].x;
    var driveTimer = setInterval(function () { drive(a, { turnRight: true }); }, 33);
    await sleep(1000);
    clearInterval(driveTimer);
    drive(a, {}); // release
    await sleep(200);
    var movedX = a.entities[a.id].x;
    check('driving moves the player (server-authoritative)', Math.abs(movedX - startX) > 40);
    check('server acks our latest input seq (reconciliation plumbing)', a.lastAck != null && a.lastAck > 0);

    // Live sync: B sees A's authoritative position.
    check('B sees A at the same authoritative position (live sync)',
        b.entities[a.id] && Math.abs(b.entities[a.id].x - movedX) < 50);

    // Disconnect: B leaving drops it from A's view.
    b.socket.close();
    await sleep(500);
    check('A drops B after B disconnects', b.id != null && a.entities[b.id] == null);

    a.socket.close();
    console.log('integration: ' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed === 0 ? 0 : 1);
})();
