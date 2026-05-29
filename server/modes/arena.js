'use strict';
// Arena — the default game mode, and the template for writing your own.
//
// A "mode" is the seam where YOUR game plugs into the engine. The Game host calls
// these lifecycle hooks; the engine, physics, networking, and entity model stay
// game-agnostic underneath. A mode decides what spawns, what the rules are, and
// when (if ever) someone wins — by reading/mutating the `game` it's handed:
//   game.entities            — the live dynamic entities (read/iterate).
//   game.playerList          — connected players by id.
//   game.world               — arena bounds + static obstacles (game.world.obstacles).
//   game.spawnEntity(e)      — add a dynamic entity AND broadcast it to clients.
//   game.despawnEntity(id)   — remove one AND broadcast the removal.
//
// Hooks (all optional in spirit; provided here as no-ops/defaults):
//   onStart(game)            — entered the playing state (first player joined).
//   onStop(game)             — fell back to waiting (last player left); the host
//                              clears non-player entities for you afterward.
//   onPlayerJoin(game, p)    — a player entity was created/registered.
//   onPlayerLeave(game, id)  — a player is leaving (still present this call).
//   onTick(game, dt)         — once per server tick while playing (after the sim).
//   checkWin(game)           — return a winner (or null); the skeleton arena is
//                              endless, so it returns null. Wire a real rule here.
//
// This default arena just scatters a few free-floating "pickup" balls that bounce
// around forever — enough to show entities + a mode working together. Swap the
// body of these hooks (or point config.gameMode at a new file) to build a game.

var utils = require('../utils.js');
var c = utils.loadConfig();
var { Pickup } = require('../entities/pickup.js');

module.exports = function createArenaMode() {
    return {
        name: 'arena',

        onStart: function (game) {
            for (var i = 0; i < c.pickupCount; i++) {
                var loc = game.world.getSafeLoc(c.pickupRadius);
                var pickup = new Pickup(loc.x, loc.y, 'pickup-' + i);
                // Launch it in a random direction at the configured speed. (Direction
                // randomness is cosmetic, not a security boundary.)
                var angle = Math.random() * Math.PI * 2;
                pickup.velX = Math.cos(angle) * c.pickupSpeed;
                pickup.velY = Math.sin(angle) * c.pickupSpeed;
                game.spawnEntity(pickup);
            }
        },

        onStop: function (game) {
            // The host clears non-player entities after this returns; nothing to do.
        },

        onPlayerJoin: function (game, player) {
            // e.g. assign a team, seed a score row, place at a spawn point…
        },

        onPlayerLeave: function (game, id) {
            // e.g. release a team slot, persist a score…
        },

        onTick: function (game, dt) {
            // e.g. award points on pickup contact, spawn waves, run a timer…
            // (The skeleton arena has no rules; this is where they'd go.)
        },

        checkWin: function (game) {
            return null; // endless arena — wire a real win condition here
        }
    };
};
