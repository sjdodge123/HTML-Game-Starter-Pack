'use strict';
// Compressor — the SERVER half of the wire contract.
//
// Every payload that crosses the socket is packed into POSITIONAL ARRAYS rather
// than {key: value} objects: at 30 ticks/sec for every player, dropping the JSON
// keys is a large, free bandwidth win. The cost is that the meaning of each slot
// lives only in the shared convention between this file and the client decoders.
//
// *** THE LOCKSTEP RULE ***
// The array layouts below are a MATCHED PAIR with the decoders in
// client/scripts/client.js. If you add, remove, or reorder a slot here, you MUST
// make the identical change in the matching decoder, or the client will silently
// read the wrong field. Each packer notes its decoder counterpart.

// Per-tick player state. Hot path: built and broadcast every server tick for
// every player. Decoder: updatePlayerList() in client.js.
//   [ id, x, y, velX, velY ]
exports.sendPlayerUpdates = function (playerList) {
    var packet = [];
    for (var id in playerList) {
        var player = playerList[id];
        packet.push([
            player.id,
            Math.round(player.x),
            Math.round(player.y),
            player.velX,
            player.velY
        ]);
    }
    return packet;
};

// A full player spawn record. Sent once when a player appears (not per tick), so
// it carries the static fields (colour, radius) the tick packet omits.
// Decoder: createPlayer() in client.js.
//   [ id, x, y, color, radius ]
function newPlayerPacket(player) {
    return [
        player.id,
        Math.round(player.x),
        Math.round(player.y),
        player.color,
        player.radius
    ];
}

// Every current player, for a freshly-joined client. Decoder: connectSpawnPlayers().
exports.playerSpawns = function (playerList) {
    var packet = [];
    for (var id in playerList) {
        packet.push(newPlayerPacket(playerList[id]));
    }
    return JSON.stringify(packet);
};

// One new player, broadcast to everyone already in the room. Decoder: appendNewPlayer().
exports.appendPlayer = function (player) {
    return JSON.stringify(newPlayerPacket(player));
};

// The arena rectangle, sent once on join. Decoder: worldResize() in client.js.
//   [ x, y, width, height ]
exports.worldResize = function (world) {
    return JSON.stringify([world.x, world.y, world.width, world.height]);
};

// Current game state (the tiny waiting/playing machine). Sent on join and every
// tick. Decoder: checkGameState() in client.js.
//   [ currentState ]
exports.gameState = function (game) {
    return JSON.stringify([game.currentState]);
};
