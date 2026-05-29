'use strict';
// Room + Game.
//
// A Room owns one isolated match: its connected clients, its dynamic entities, its
// physics engine, its world (arena + static geometry), and its Game. The Game runs
// the fixed-timestep simulation and hosts a pluggable GAME MODE — the seam where
// your actual game lives (see modes/). The engine/compressor stay game-agnostic;
// the mode decides what spawns, what the rules are, and when someone wins.

var utils = require('./utils.js');
var c = utils.loadConfig();
var messenger = require('./messenger.js');
var _engine = require('./engine.js');
var compressor = require('./compressor.js');
var { World } = require('./entities/world.js');

// Fixed-timestep constants (see Game.simulate). FIXED_DT is the nominal tick
// interval, so normal scheduling runs exactly one sub-step per tick and the game
// feel matches a plain per-tick update; the accumulator only matters under jitter.
// MAX_SUBSTEPS caps catch-up so a long stall is a brief slowdown, not a spiral.
var FIXED_DT = c.serverTickSpeed / 1000;
var MAX_SUBSTEPS = c.maxSubStepsPerTick;

// Load the configured game mode. Modes are small factories under server/modes/.
function loadMode(name) {
    var factory = require('./modes/' + name + '.js');
    return factory();
}

exports.getRoom = function (sig, size) {
    return new Room(sig, size);
};

class Room {
    constructor(sig, size) {
        this.sig = sig;
        this.size = size;
        this.clientList = {};
        this.playerList = {};   // clientId -> Player (the socket<->player mapping)
        this.clientCount = 0;
        this.engine = _engine.getEngine();
        this.world = new World(0, 0, c.worldWidth, c.worldHeight, this.engine, this.playerList, this.sig);
        this.engine.setWorldBounds(this.world.width, this.world.height);
        this.game = new Game(this.clientList, this.playerList, this.world, this.engine, this.sig);
    }
    join(clientID) {
        var client = messenger.getClient(clientID);
        messenger.addRoomToMailBox(clientID, this.sig);
        client.join(String(this.sig));
        this.clientCount++;
    }
    // Create + register this client's player and notify the mode. The caller
    // (messenger.enterGame) sends the joiner the full snapshot and broadcasts the
    // new player to everyone else.
    spawnPlayer(clientID) {
        var player = this.world.createNewPlayer(clientID);
        this.playerList[clientID] = player;
        this.game.registerEntity(player);
        this.game.mode.onPlayerJoin(this.game, player);
        return player;
    }
    leave(clientID) {
        var player = this.playerList[clientID];
        if (player != null) {
            this.game.mode.onPlayerLeave(this.game, clientID);
        }
        this.game.unregisterEntity(clientID);
        messenger.messageRoomBySig(this.sig, 'entityDespawn', clientID);
        messenger.removeRoomMailBox(clientID);
        var client = messenger.getClient(clientID);
        if (client != null) {
            client.leave(String(this.sig));
        }
        delete this.clientList[clientID];
        delete this.playerList[clientID];
        this.clientCount--;
    }
    update(dt) {
        this.game.update(dt);
        this.sendUpdates();
    }
    // Broadcast this tick's authoritative snapshot: every dynamic entity's state,
    // the game state, and the server tick number (the client uses it for
    // interpolation/ordering; the per-entity input ack rides inside the entity
    // rows for prediction reconciliation).
    sendUpdates() {
        messenger.messageRoomBySig(this.sig, 'gameUpdates', {
            entityList: compressor.sendEntityUpdates(this.game.entities),
            state: compressor.gameState(this.game),
            tick: this.game.tick,
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
        this.entities = {};     // id -> dynamic entity (players + mode-spawned things)
        this.tick = 0;          // monotonic sim step counter, stamped into snapshots
        this.playerCount = 0;
        this.stateMap = c.stateMap;
        this.currentState = this.stateMap.waiting;
        this.accumulator = 0;   // leftover real time carried between ticks
        this.mode = loadMode(c.gameMode);
    }
    // Entity bookkeeping. registerEntity/unregisterEntity are the quiet versions
    // (used for players, whose spawn/despawn the room broadcasts as part of
    // join/leave); spawnEntity/despawnEntity also broadcast, for things the mode
    // creates/removes mid-game (e.g. pickups).
    registerEntity(e) { this.entities[e.id] = e; }
    unregisterEntity(id) { delete this.entities[id]; }
    spawnEntity(e) {
        this.registerEntity(e);
        messenger.messageRoomBySig(this.roomSig, 'entitySpawn', compressor.appendEntity(e));
    }
    despawnEntity(id) {
        this.unregisterEntity(id);
        messenger.messageRoomBySig(this.roomSig, 'entityDespawn', id);
    }
    update(dt) {
        this.getPlayerCount();
        if (this.currentState == this.stateMap.waiting) {
            if (this.playerCount >= c.minPlayersToStart) {
                this.currentState = this.stateMap.playing;
                this.mode.onStart(this);
            }
            return; // idle while waiting
        }
        if (this.currentState == this.stateMap.playing) {
            if (this.playerCount < c.minPlayersToStart) {
                this.currentState = this.stateMap.waiting;
                this.mode.onStop(this);
                this.clearNonPlayers();
                return;
            }
            this.simulate(dt);
            this.mode.onTick(this, dt);
        }
    }
    // Fixed-timestep accumulator: advance the sim in constant FIXED_DT sub-steps so
    // physics is deterministic and independent of real tick jitter. The dynamic
    // entity array + the static obstacle array are passed to engine.step; the
    // dynamic array is rebuilt once per tick (cheap; the set is stable mid-tick).
    simulate(dt) {
        var entities = [];
        for (var id in this.entities) {
            if (this.entities[id].alive) {
                entities.push(this.entities[id]);
            }
        }
        var statics = this.world.obstacles;

        this.accumulator += dt;
        var maxAccumulated = FIXED_DT * MAX_SUBSTEPS;
        if (this.accumulator > maxAccumulated) {
            this.accumulator = maxAccumulated;
        }
        while (this.accumulator >= FIXED_DT) {
            this.engine.step(FIXED_DT, this.world, entities, statics);
            this.tick++;
            this.accumulator -= FIXED_DT;
        }
    }
    // Drop everything the mode spawned when the match winds back to waiting, so a
    // fresh start (onStart) doesn't accumulate stale entities. Broadcasts the
    // despawns so clients clear them too.
    clearNonPlayers() {
        var ids = [];
        for (var id in this.entities) {
            if (this.entities[id].type !== 'player') {
                ids.push(id);
            }
        }
        for (var i = 0; i < ids.length; i++) {
            this.despawnEntity(ids[i]);
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
