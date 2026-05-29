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

// Fixed-timestep simulation constants. The sim always advances in constant
// FIXED_DT increments regardless of how jittery the real tick interval is, so
// physics is deterministic and dt-invariant (no tick-jitter wobble, no tunnelling
// from an occasional long tick). FIXED_DT is the nominal tick interval, so under
// normal scheduling there's exactly ONE sub-step per tick and the game feel is
// identical to a plain per-tick update — the accumulator only matters when a tick
// runs long or short. MAX_SUBSTEPS caps the catch-up so a long stall (GC, the
// process being descheduled) causes a brief slowdown instead of a death spiral.
var FIXED_DT = c.serverTickSpeed / 1000;
var MAX_SUBSTEPS = c.maxSubStepsPerTick;

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
        // Leftover real time not yet consumed by a fixed sub-step; carried to the
        // next tick so the sim tracks wall-clock time smoothly (see simulate).
        this.accumulator = 0;
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
    // The authoritative tick, driven by a fixed-timestep accumulator. We add the
    // real elapsed time to the accumulator and drain it in constant FIXED_DT
    // sub-steps, so the physics integrator always sees the same dt no matter how
    // uneven the real tick interval is. The alive-players array is built ONCE here
    // and reused across every sub-step (the set can't change mid-tick), keeping the
    // per-step hot path on an array rather than a for..in over the playerList map.
    simulate(dt) {
        var players = [];
        for (var id in this.playerList) {
            if (this.playerList[id].alive) {
                players.push(this.playerList[id]);
            }
        }

        this.accumulator += dt;
        // Anti-spiral clamp: never try to catch up more than MAX_SUBSTEPS worth of
        // time in one tick. A long stall is absorbed as a brief slowdown, not a
        // burst of steps that stalls the loop further.
        var maxAccumulated = FIXED_DT * MAX_SUBSTEPS;
        if (this.accumulator > maxAccumulated) {
            this.accumulator = maxAccumulated;
        }
        while (this.accumulator >= FIXED_DT) {
            // engine.step owns one full step: integrate, wall-bounce, collide, commit.
            this.engine.step(FIXED_DT, this.world, players);
            this.accumulator -= FIXED_DT;
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
