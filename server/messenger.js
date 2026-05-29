'use strict';
// Messenger — the socket boundary. Inbound socket events are wired here; outbound
// room/client messages go through here. Handlers:
//   getConfig    — ship the shared config (single source of truth) to the client.
//   enterGame    — matchmake into a room and spawn the client's player; reply with
//                  the full join snapshot (entities, obstacles, world, config).
//   movement     — record the client's held input + sequence number on its player.
//   playerLeaveRoom / disconnect — tear the client out of its room.
//
// All client-supplied values are treated as untrusted: the room id is validated to
// a numeric signature, and input is range/sequence-checked.

var utils = require('./utils.js');
var c = utils.loadConfig();
var hostess = require('./hostess.js');
var compressor = require('./compressor.js');

var mailBoxList = Object.create(null),   // clientId -> socket
    roomMailList = Object.create(null),  // clientId -> roomSig
    io;

exports.build = function (mainIO) {
    io = mainIO;
};

exports.addMailBox = function (id, client) {
    mailBoxList[id] = client;
    checkForMail(mailBoxList[id]);
};
exports.removeMailBox = function (id) {
    delete mailBoxList[id];
};
exports.addRoomToMailBox = function (id, roomSig) {
    roomMailList[id] = roomSig;
};
exports.removeRoomMailBox = function (id) {
    delete roomMailList[id];
};
exports.getClient = function (id) {
    return mailBoxList[id];
};
exports.messageRoomBySig = function (sig, header, payload) {
    io.to(String(sig)).emit(header, payload);
};
exports.messageClientBySig = function (sig, header, payload) {
    if (mailBoxList[sig] != null) {
        mailBoxList[sig].emit(header, payload);
    }
};

// Validate the client-supplied room id: -1 (matchmake) or a non-negative integer
// signature. Anything else (floats, strings like "__proto__", huge values) is
// rejected — the server never indexes roomList with an unvalidated client value.
function parseRoomId(raw) {
    if (raw === -1 || raw === '-1') {
        return -1;
    }
    var n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 999) {
        return null;
    }
    return n;
}

function checkForMail(client) {
    client.emit('welcome', client.id);

    client.on('getConfig', function () {
        client.emit('config', c);
    });

    client.on('enterGame', function (id) {
        var roomId = parseRoomId(id);
        if (roomId === null) {
            client.emit('roomNotFound');
            return;
        }
        var roomSig = (roomId === -1) ? hostess.findARoom() : roomId;
        var room = hostess.joinARoom(roomSig, client.id);
        if (room === false) {
            client.emit('roomNotFound');
            return;
        }
        room.clientList[client.id] = client.id;
        var player = room.spawnPlayer(client.id);

        // Full join snapshot. protocolVersion lets the client refuse a mismatched
        // server; entities + obstacles + world + state rehydrate a (possibly
        // mid-game) joiner; config is the single source of truth.
        client.emit('gameState', {
            protocolVersion: c.protocolVersion,
            entityList: compressor.entitiesSpawn(room.game.entities),
            obstacles: compressor.obstacles(room.world.obstacles),
            world: compressor.worldResize(room.world),
            game: compressor.gameState(room.game),
            tick: room.game.tick,
            config: c,
            myID: client.id,
            gameID: roomSig
        });

        // Tell everyone already in the room about the newcomer.
        client.broadcast.to(String(roomSig)).emit('entitySpawn', compressor.appendEntity(player));
    });

    // The only gameplay input: the held movement keys plus a monotonically
    // increasing sequence number. The client is authoritative over NOTHING — it
    // reports intent; the engine decides the motion. We ignore stale/duplicate
    // inputs (seq <= last seen) and echo the accepted seq back each tick so the
    // client can reconcile its prediction.
    client.on('movement', function (packet) {
        var room = hostess.getRoomBySig(roomMailList[client.id]);
        if (room === undefined || packet == null) {
            return;
        }
        var player = room.playerList[client.id];
        if (player == null) {
            return;
        }
        var seq = Number(packet.seq);
        if (!Number.isFinite(seq) || seq <= player.lastInputSeq) {
            return; // stale, duplicate, or malformed
        }
        player.lastInputSeq = seq;
        player.currentInput.moveForward = !!packet.moveForward;
        player.currentInput.moveBackward = !!packet.moveBackward;
        player.currentInput.turnLeft = !!packet.turnLeft;
        player.currentInput.turnRight = !!packet.turnRight;
    });

    client.on('playerLeaveRoom', function () {
        hostess.kickFromRoom(client.id);
    });
}
