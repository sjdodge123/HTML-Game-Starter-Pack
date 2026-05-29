// Socket handlers + DECODERS — the CLIENT half of the wire contract.
//
// *** THE LOCKSTEP RULE ***
// The decoders below read POSITIONAL ARRAYS produced by server/compressor.js. Slot
// order MUST match the packers there exactly. The protocol is versioned: on join we
// compare the server's protocolVersion to CLIENT_PROTOCOL_VERSION and refuse to run
// on a mismatch, so a layout drift fails loudly instead of silently misreading.

function registerHandlers(server) {
    server.on('welcome', function (id) {
        myID = id;
    });

    // Full join snapshot: version, config, world, obstacles, entities, state, our id.
    server.on('gameState', function (gs) {
        if (gs.protocolVersion !== CLIENT_PROTOCOL_VERSION) {
            protocolOK = false;
            console.error('Protocol mismatch: server v' + gs.protocolVersion +
                ' vs client v' + CLIENT_PROTOCOL_VERSION + ' — refusing to run. Reload the page.');
            return;
        }
        config = gs.config;
        FIXED_DT_MS = config.serverTickSpeed;
        FIXED_DT_S = config.serverTickSpeed / 1000;
        myID = gs.myID;
        serverTick = gs.tick;

        // gameState is a FULL snapshot. Reset the entity set first so a reconnect
        // (Socket.IO auto-reconnects and re-emits enterGame, getting a fresh socket
        // id + snapshot) can't leave the old player and any since-despawned entities
        // as frozen ghosts — our own despawns were broadcast while we were offline.
        entities = {};

        worldResize(gs.world);
        decodeObstacles(gs.obstacles);
        spawnEntities(gs.entityList);
        checkGameState(gs.game);

        // Seed prediction from our authoritative spawn position.
        var me = entities[myID];
        if (me != null) {
            predictionInit(me.x, me.y);
        }

        resize();
        if (!gameRunning) {
            gameRunning = true;
            lastFrameTime = Date.now();
            animloop();
        }
    });

    // An entity appeared (a joining player, or a mode-spawned thing like a pickup).
    server.on('entitySpawn', function (rec) {
        appendEntity(rec);
    });

    // An entity left / was removed.
    server.on('entityDespawn', function (id) {
        delete entities[id];
    });

    // Per-tick authoritative snapshot.
    server.on('gameUpdates', function (u) {
        updateEntities(u.entityList);
        checkGameState(u.state);
        serverTick = u.tick;
    });

    server.on('roomNotFound', function () {
        console.warn('roomNotFound — retrying matchmaking in 1s');
        setTimeout(function () { server.emit('enterGame', -1); }, 1000);
    });
}

// --- Decoders ----------------------------------------------------------------

// Mirrors compressor.entitySpawnPacket: [ type, id, x, y, color, radius ]
function createEntity(a) {
    var id = a[1];
    entities[id] = {
        type: a[0],
        id: id,
        x: a[2], y: a[3],
        tx: a[2], ty: a[3],   // interpolation target (remotes)
        velX: 0, velY: 0,
        color: a[4],
        radius: a[5]
    };
}

// Mirrors compressor.entitiesSpawn: JSON array of spawn records.
function spawnEntities(packet) {
    if (packet == null) { return; }
    var arr = JSON.parse(packet);
    for (var i = 0; i < arr.length; i++) {
        if (entities[arr[i][1]] == null) { createEntity(arr[i]); }
    }
}

// Mirrors compressor.appendEntity: a single JSON spawn record.
function appendEntity(packet) {
    if (packet == null) { return; }
    var a = JSON.parse(packet);
    if (entities[a[1]] == null) { createEntity(a); }
}

// Mirrors compressor.sendEntityUpdates: [ id, x, y, velX, velY, inputAck ] per entity.
// The local player feeds reconciliation; remotes feed interpolation.
function updateEntities(packet) {
    if (packet == null) { return; }
    for (var i = 0; i < packet.length; i++) {
        var row = packet[i];
        var e = entities[row[0]];
        if (e == null) { continue; }
        if (row[0] === myID) {
            if (predicted != null) {
                predictReconcile(row[1], row[2], row[3], row[4], row[5], FIXED_DT_S);
            }
        } else {
            e.tx = row[1];
            e.ty = row[2];
            e.velX = row[3];
            e.velY = row[4];
        }
    }
}

// Mirrors compressor.worldResize: [ x, y, width, height ]
function worldResize(packet) {
    var a = JSON.parse(packet);
    world = { x: a[0], y: a[1], width: a[2], height: a[3] };
}

// Mirrors compressor.obstacles: rows tagged 'c' (circle) or 'b' (box).
//   [ 'c', x, y, radius, color ]   |   [ 'b', x, y, width, height, color ]
function decodeObstacles(packet) {
    obstacles = [];
    if (packet == null) { return; }
    var arr = JSON.parse(packet);
    for (var i = 0; i < arr.length; i++) {
        var o = arr[i];
        if (o[0] === 'c') {
            obstacles.push({ shape: 'circle', x: o[1], y: o[2], radius: o[3], color: o[4] });
        } else if (o[0] === 'b') {
            obstacles.push({ shape: 'box', x: o[1], y: o[2], w: o[3], h: o[4], color: o[5] });
        }
    }
}

// Mirrors compressor.gameState: [ currentState ]
function checkGameState(packet) {
    if (packet == null) { return; }
    currentState = JSON.parse(packet)[0];
}
