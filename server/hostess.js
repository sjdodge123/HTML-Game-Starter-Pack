'use strict';
// Hostess — chaochao's hostess.js, the room registry / matchmaker. Trimmed of the
// preview/co-op rooms, late-join locking, AI-count bookkeeping, and the rich room
// listing the join page needed. What's left is the core: keep a map of live rooms,
// hand a joining client an existing room with space (or spin up a new one), tick
// every room each server frame, and reclaim a room once it empties.

var utils = require('./utils.js');
var c = utils.loadConfig();
var game = require('./game.js');

var roomList = {},
    maxPlayersInRoom = c.maxPlayersInRoom;

// Find a room with free space, creating one if none exists / none is free.
// Returns the room's signature (its key in roomList).
exports.findARoom = function () {
    for (var sig in roomList) {
        if (roomList[sig].hasSpace()) {
            return sig;
        }
    }
    return generateNewRoom();
};

// Place a client into the room with the given signature. Returns the room, or
// false if it's gone / full.
exports.joinARoom = function (sig, clientID) {
    var room = roomList[sig];
    if (room == null) {
        return false;
    }
    if (!room.hasSpace()) {
        return false;
    }
    room.join(clientID);
    return room;
};

// Remove a client from whatever room holds it; delete the room once it's empty.
exports.kickFromRoom = function (clientID) {
    var room = searchForRoom(clientID);
    if (room != undefined) {
        room.leave(clientID);
        if (room.clientCount == 0) {
            console.log('Deleting empty room ' + room.sig);
            delete roomList[room.sig];
        }
    }
};

// Tick every live room once per server frame (called from index.js's loop).
exports.updateRooms = function (dt) {
    for (var sig in roomList) {
        var room = roomList[sig];
        if (room == null) {
            delete roomList[sig];
            continue;
        }
        room.update(dt);
    }
};

exports.getRoomBySig = function (sig) {
    return roomList[sig];
};

function searchForRoom(id) {
    for (var sig in roomList) {
        if (roomList[sig].checkRoom(id)) {
            return roomList[sig];
        }
    }
    return undefined;
}

function generateRoomSig() {
    var sig = utils.getRandomInt(0, 999);
    if (roomList[sig] == null) {
        return sig;
    }
    return generateRoomSig();
}

function generateNewRoom() {
    var sig = generateRoomSig();
    roomList[sig] = game.getRoom(sig, maxPlayersInRoom);
    console.log('Started a new room ' + sig);
    return sig;
}
