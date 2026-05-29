'use strict';
// Compressor — the SERVER half of the wire contract. Every payload is packed into
// POSITIONAL ARRAYS (no JSON keys) to save bandwidth at tick rate. The meaning of
// each slot lives only in the shared convention between this file and the client
// decoders.
//
// *** THE LOCKSTEP RULE ***
// These array layouts are a MATCHED PAIR with the decoders in
// client/scripts/client.js. Add/remove/reorder a slot here and you MUST mirror it
// there, or the client silently reads the wrong field. Each packer names its
// decoder. The protocol is versioned (config.protocolVersion, sent on join) so a
// client built against a different layout fails loudly instead of misreading.

// --- Per-tick entity state (hot path) ---------------------------------------
// One row per dynamic entity, every tick. Decoder: updateEntities() in client.js.
//   [ id, x, y, velX, velY, inputAck ]
// inputAck is the last input seq the server processed for THIS entity (players
// only; 0 otherwise) — the owning client uses it to reconcile its prediction.
exports.sendEntityUpdates = function (entities) {
    var packet = [];
    for (var id in entities) {
        var e = entities[id];
        packet.push([
            e.id,
            Math.round(e.x),
            Math.round(e.y),
            e.velX,
            e.velY,
            e.lastInputSeq || 0
        ]);
    }
    return packet;
};

// --- Entity spawn record ----------------------------------------------------
// The static identity of an entity, sent when it appears (not per tick).
// Decoder: createEntity() in client.js.
//   [ type, id, x, y, color, radius ]
function entitySpawnPacket(e) {
    return [e.type, e.id, Math.round(e.x), Math.round(e.y), e.color, e.radius];
}

// Every current entity, for a freshly-joined client. Decoder: spawnEntities().
exports.entitiesSpawn = function (entities) {
    var packet = [];
    for (var id in entities) {
        packet.push(entitySpawnPacket(entities[id]));
    }
    return JSON.stringify(packet);
};

// One entity, broadcast when it spawns mid-game. Decoder: appendEntity().
exports.appendEntity = function (e) {
    return JSON.stringify(entitySpawnPacket(e));
};

// --- Static level geometry (sent once on join) ------------------------------
// Decoder: decodeObstacles() in client.js. Tagged by shape:
//   circle: [ 'c', x, y, radius, color ]
//   box:    [ 'b', x, y, width, height, color ]
exports.obstacles = function (obstacles) {
    var packet = [];
    for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        if (o.isBox) {
            packet.push(['b', o.x, o.y, o.w, o.h, o.color]);
        } else {
            packet.push(['c', o.x, o.y, o.radius, o.color]);
        }
    }
    return JSON.stringify(packet);
};

// --- Arena + state ----------------------------------------------------------
// World rectangle, sent once on join. Decoder: worldResize().  [ x, y, w, h ]
exports.worldResize = function (world) {
    return JSON.stringify([world.x, world.y, world.width, world.height]);
};

// Game state (the tiny waiting/playing machine). Decoder: checkGameState().  [ state ]
exports.gameState = function (game) {
    return JSON.stringify([game.currentState]);
};
