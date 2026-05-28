'use strict';
// Messenger — chaochao's messenger.js, the socket boundary. Every inbound socket
// event is wired here, and every outbound room/client message goes through here.
// Trimmed from chaochao's ~30 handlers (auth skins, emoji, map submission, lobby
// AI, diagnostics, ...) to the four that a movement skeleton needs:
//   getConfig    — ship the shared config to the client (single source of truth).
//   enterGame    — matchmake the client into a room and spawn its player.
//   movement     — record this client's held input on its server-side player.
//   disconnect   — handled in index.js, which calls hostess.kickFromRoom.
//
// A "mailbox" is just the live socket, stored by client id so any module can
// message a client by id without holding the socket itself.

var utils = require('./utils.js');
var c = utils.loadConfig();
var hostess = require('./hostess.js');
var compressor = require('./compressor.js');

var mailBoxList = {},   // clientId -> socket
    roomMailList = {},  // clientId -> roomSig
    io;

exports.build = function (mainIO) {
    io = mainIO;
};

// Register a connected socket and wire its event handlers.
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

// Wire the per-socket handlers. Called once per connection.
function checkForMail(client) {
    // Let the client confirm its own id.
    client.emit('welcome', client.id);

    // The client asks for the shared config (tuning values, world size, stateMap)
    // up front. Shipping the SAME config object the server simulates with is what
    // keeps the two halves from forking their numbers.
    client.on('getConfig', function () {
        client.emit('config', c);
    });

    // Matchmake into a room and spawn this client's player.
    client.on('enterGame', function (id) {
        var roomSig = (id == -1) ? hostess.findARoom() : id;
        var room = hostess.joinARoom(roomSig, client.id);
        if (room == false) {
            client.emit('roomNotFound');
            return;
        }
        // Track the client in the room and spawn its server-side player.
        room.clientList[client.id] = client.id;
        room.playerList[client.id] = room.world.createNewPlayer(client.id);

        // Send the joining client the full current snapshot: who's here, the arena,
        // the state, and its own id.
        client.emit('gameState', {
            playerList: compressor.playerSpawns(room.playerList),
            world: compressor.worldResize(room.world),
            game: compressor.gameState(room.game),
            config: c,
            myID: client.id,
            gameID: roomSig
        });

        // Tell everyone already in the room about the newcomer.
        client.broadcast.to(String(roomSig)).emit('playerJoin', {
            id: client.id,
            player: compressor.appendPlayer(room.playerList[client.id])
        });
    });

    // The only gameplay input: which movement keys are currently held. The client
    // is authoritative over NOTHING — it just reports intent, and the engine
    // decides the resulting motion next tick.
    client.on('movement', function (packet) {
        var room = hostess.getRoomBySig(roomMailList[client.id]);
        if (room == undefined) {
            return;
        }
        var player = room.playerList[client.id];
        if (player != null) {
            player.moveForward = packet.moveForward;
            player.moveBackward = packet.moveBackward;
            player.turnLeft = packet.turnLeft;
            player.turnRight = packet.turnRight;
        }
    });

    // A client that explicitly leaves (the page does this on unload as a courtesy;
    // the socket 'disconnect' in index.js is the real teardown).
    client.on('playerLeaveRoom', function () {
        hostess.kickFromRoom(client.id);
    });
}
