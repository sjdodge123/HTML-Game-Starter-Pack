// Socket handlers + DECODERS — the CLIENT half of the wire contract.
//
// *** THE LOCKSTEP RULE ***
// The decoders below read POSITIONAL ARRAYS produced by server/compressor.js.
// Slot order here MUST match the packers there exactly — there are no field names
// on the wire, only positions. If you change a layout in compressor.js, change the
// matching decoder here, or the client silently reads the wrong field. Each
// decoder names the packer it mirrors.

function registerHandlers(server) {
    // Confirm our own id.
    server.on('welcome', function (id) {
        myID = id;
    });

    // Full snapshot for a freshly-joined client: config, the arena, who's here,
    // the state, and our id. This is also what starts the render loop.
    server.on('gameState', function (gameState) {
        config = gameState.config;
        myID = gameState.myID;
        worldResize(gameState.world);
        connectSpawnPlayers(gameState.playerList);
        checkGameState(gameState.game);
        if (!gameRunning) {
            gameRunning = true;
            then = Date.now();
            animloop();
        }
    });

    // Someone else joined: add their player.
    server.on('playerJoin', function (payload) {
        appendNewPlayer(payload.player);
    });

    // Someone left: drop their player.
    server.on('playerLeft', function (id) {
        delete playerList[id];
    });

    // The per-tick heartbeat: the authoritative snapshot we render from.
    server.on('gameUpdates', function (updatePacket) {
        updatePlayerList(updatePacket.playerList);
        checkGameState(updatePacket.state);
    });

    // The room we asked for is gone / full.
    server.on('roomNotFound', function () {
        console.warn('roomNotFound — retrying matchmaking in 1s');
        setTimeout(function () { server.emit('enterGame', -1); }, 1000);
    });
}

// --- Decoders ----------------------------------------------------------------

// Mirrors compressor.newPlayerPacket: [ id, x, y, color, radius ]
function createPlayer(dataArray) {
    var id = dataArray[0];
    playerList[id] = {
        id: id,
        x: dataArray[1],
        y: dataArray[2],
        tx: dataArray[1],   // seed the smoothing target (see smoothEntities)
        ty: dataArray[2],
        color: dataArray[3],
        radius: dataArray[4]
    };
}

// Mirrors compressor.playerSpawns: a JSON array of spawn records.
function connectSpawnPlayers(packet) {
    if (packet == null) { return; }
    packet = JSON.parse(packet);
    for (var i = 0; i < packet.length; i++) {
        if (playerList[packet[i][0]] == null) {
            createPlayer(packet[i]);
        }
    }
}

// Mirrors compressor.appendPlayer: a single JSON spawn record.
function appendNewPlayer(packet) {
    if (packet == null) { return; }
    var player = JSON.parse(packet);
    if (playerList[player[0]] == null) {
        createPlayer(player);
    }
}

// Mirrors compressor.sendPlayerUpdates: [ id, x, y, velX, velY ] per player.
// The server position becomes the smoothing TARGET (tx/ty); smoothEntities eases
// the render position toward it each frame.
function updatePlayerList(packet) {
    if (packet == null) { return; }
    for (var i = 0; i < packet.length; i++) {
        var p = packet[i];
        var player = playerList[p[0]];
        if (player != null) {
            player.tx = p[1];
            player.ty = p[2];
            player.velX = p[3];
            player.velY = p[4];
        }
    }
}

// Mirrors compressor.worldResize: [ x, y, width, height ]
function worldResize(payload) {
    payload = JSON.parse(payload);
    world = { x: payload[0], y: payload[1], width: payload[2], height: payload[3] };
}

// Mirrors compressor.gameState: [ currentState ]
function checkGameState(payload) {
    if (payload == null) { return; }
    payload = JSON.parse(payload);
    currentState = payload[0];
}
