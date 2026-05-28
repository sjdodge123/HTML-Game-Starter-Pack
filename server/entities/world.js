'use strict';
// World — chaochao's entities/world.js with bot creation and the runtime resize
// (the arena shrinks during a race in chaochao) removed. The World IS the arena
// rectangle (it extends Rect), so the engine and the boundary check treat it as a
// plain bound. It also owns player creation and spawn placement.

var utils = require('../utils.js');
var c = utils.loadConfig();
var { Rect } = require('./shapes.js');
var { Player } = require('./player.js');

class World extends Rect {
    constructor(x, y, width, height, engine, playerList, roomSig) {
        super(x, y, width, height, 0, 'white');
        this.engine = engine;
        this.playerList = playerList;
        this.roomSig = roomSig;
        this.center = { x: width / 2, y: height / 2 };
    }
    // A new player gets a unique colour and is spawned at a random free location
    // inside the arena.
    createNewPlayer(id) {
        var color = this.getUniqueColorR();
        var player = new Player(0, 0, color, id, this.roomSig);
        this.spawnPlayerRandomLoc(player);
        return player;
    }
    spawnPlayerRandomLoc(player) {
        var loc = this.findFreeLoc(player);
        player.x = loc.x;
        player.y = loc.y;
        player.newX = loc.x;
        player.newY = loc.y;
    }
    // Pick a palette colour none of the current players are using, so karts stay
    // visually distinct.
    getUniqueColorR() {
        var usedColors = {};
        for (var id in this.playerList) {
            usedColors[this.playerList[id].color] = true;
        }
        return utils.getUniqueColor(usedColors);
    }
}

module.exports = { World };
