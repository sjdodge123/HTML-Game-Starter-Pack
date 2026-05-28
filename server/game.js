'use strict';
// Room + Game — chaochao's game.js gutted from a ~1200-line race director down to
// the simulation loop and a two-state machine.
//
// A Room owns one isolated match: its client list, its player list, its physics
// engine, its world, and its Game. The Game holds the state machine and runs the
// per-tick simulation. chaochao's Game ran a full round lifecycle (waiting →
// lobby → gated → racing → collapsing → overview → gameOver) with scoring, music,
// bots, abilities, and map rotation. The skeleton keeps two states:
//   waiting  — fewer than minPlayersToStart connected; the sim is idle.
//   playing  — enough players; the engine integrates and broadcasts every tick.

var utils = require('./utils.js');
var c = utils.loadConfig();
var messenger = require('./messenger.js');
var _engine = require('./engine.js');
var compressor = require('./compressor.js');
var { World } = require('./entities/world.js');

exports.getRoom = function (sig, size) {
    return new Room(sig, size);
};

class Room {
    constructor(sig, size) {
        this.sig = sig;
        this.size = size;
        this.clientList = {};
        this.playerList = {};
        this.clientCount = 0;
        this.engine = _engine.getEngine(this.playerList);
        this.world = new World(0, 0, c.worldWidth, c.worldHeight, this.engine, this.playerList, this.sig);
        // The engine's QuadTree is sized to the arena once, up front.
        this.engine.setWorldBounds(this.world.width, this.world.height);
        this.game = new Game(this.clientList, this.playerList, this.world, this.engine, this.sig);
    }
    // Socket-room plumbing: join/leave the Socket.IO room so broadcasts reach this
    // client, and track how many clients the room holds.
    join(clientID) {
        var client = messenger.getClient(clientID);
        messenger.addRoomToMailBox(clientID, this.sig);
        client.join(String(this.sig));
        this.clientCount++;
    }
    leave(clientID) {
        messenger.messageRoomBySig(this.sig, 'playerLeft', clientID);
        messenger.removeRoomMailBox(clientID);
        var client = messenger.getClient(clientID);
        if (client != null) {
            client.leave(String(this.sig));
        }
        delete this.clientList[clientID];
        delete this.playerList[clientID];
        this.clientCount--;
    }
    // One server tick: advance the simulation, then broadcast the new snapshot.
    update(dt) {
        this.game.update(dt);
        this.sendUpdates();
    }
    // Broadcast this tick's authoritative snapshot to every client in the room.
    // This is the heartbeat clients render from — they own no physics of their own.
    sendUpdates() {
        messenger.messageRoomBySig(this.sig, 'gameUpdates', {
            playerList: compressor.sendPlayerUpdates(this.playerList),
            state: compressor.gameState(this.game),
            totalPlayers: this.game.playerCount
        });
    }
    checkRoom(clientID) {
        return this.clientList[clientID] != null;
    }
    hasSpace() {
        return this.clientCount < this.size;
    }
}

class Game {
    constructor(clientList, playerList, world, engine, roomSig) {
        this.clientList = clientList;
        this.playerList = playerList;
        this.world = world;
        this.engine = engine;
        this.roomSig = roomSig;
        this.playerCount = 0;
        this.stateMap = c.stateMap;
        this.currentState = this.stateMap.waiting;
    }
    update(dt) {
        this.getPlayerCount();
        // The state machine: flip between waiting and playing on the player count.
        if (this.currentState == this.stateMap.waiting) {
            if (this.playerCount >= c.minPlayersToStart) {
                this.currentState = this.stateMap.playing;
            }
            return; // idle while waiting — nothing to simulate
        }
        if (this.currentState == this.stateMap.playing) {
            if (this.playerCount < c.minPlayersToStart) {
                this.currentState = this.stateMap.waiting;
                return;
            }
            this.simulate(dt);
        }
    }
    // The authoritative tick: integrate, keep everyone in bounds, resolve
    // player-vs-player collisions, then commit positions. Ordering matters —
    // collisions run on the scratch position (newX/newY) the engine just
    // integrated, and Player.move() commits it last.
    simulate(dt) {
        this.engine.update(dt);

        var players = [];
        for (var id in this.playerList) {
            var player = this.playerList[id];
            if (player.alive == false) {
                continue;
            }
            _engine.bounceOffBoundry(player, this.world);
            // Snapshot the post-integration, post-wall velocity so player-vs-player
            // collision response reads a stable value for both bodies of a pair
            // (see Player.handleHit / cvX,cvY).
            player.cvX = player.velX;
            player.cvY = player.velY;
            player.hitThisTick = {};
            players.push(player);
        }

        this.engine.broadBase(players);

        for (var i = 0; i < players.length; i++) {
            players[i].move();
        }
    }
    getPlayerCount() {
        var count = 0;
        for (var id in this.playerList) {
            count++;
        }
        this.playerCount = count;
        return count;
    }
    getState() {
        return this.currentState;
    }
}

module.exports = exports;
