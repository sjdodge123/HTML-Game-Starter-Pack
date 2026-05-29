'use strict';
// Pickup — a worked example of a SECOND dynamic entity type, to show the "add a
// new entity" path end to end. It's a free-floating ball: it has velocity but no
// input, so it uses Entity's default control() (coast) and inherits the full
// collision response unchanged — it bounces off walls, players, other pickups, and
// obstacles with ZERO new physics code. The game mode spawns it with an initial
// velocity (see modes/arena.js).
//
// The only thing a new entity type needs to add for the network is its wire tag
// ('pickup'); the compressor/decoder already handle entities generically by tag.

var utils = require('../utils.js');
var c = utils.loadConfig();
var { Entity } = require('./entity.js');

class Pickup extends Entity {
    constructor(x, y, id) {
        super(x, y, c.pickupRadius, c.pickupColor, id, 'pickup');
    }
}

module.exports = { Pickup };
