'use strict';
// World — the arena rectangle plus its static level geometry. It owns player
// creation/colours and a small default obstacle layout (a centre block and two
// bumpers) so every game starts with something to bounce off. Replace
// buildDefaultObstacles (or feed obstacles from a map file / the game mode) to
// build real levels — the engine treats `obstacles` as opaque static colliders.

var utils = require('../utils.js');
var c = utils.loadConfig();
var { Rect } = require('./shapes.js');
var { Player } = require('./player.js');
var { CircleObstacle, BoxObstacle } = require('./obstacles.js');

class World extends Rect {
    constructor(x, y, width, height, engine, playerList, roomSig) {
        super(x, y, width, height, 0, 'white');
        this.engine = engine;
        this.playerList = playerList;
        this.roomSig = roomSig;
        this.center = { x: width / 2, y: height / 2 };
        this.obstacles = [];
        this.buildDefaultObstacles();
    }
    buildDefaultObstacles() {
        var cx = this.width / 2, cy = this.height / 2;
        this.obstacles.push(new BoxObstacle(cx - 90, cy - 40, 180, 80, 'obs-box'));
        this.obstacles.push(new CircleObstacle(cx - 300, cy, 45, 'obs-l'));
        this.obstacles.push(new CircleObstacle(cx + 300, cy, 45, 'obs-r'));
    }
    createNewPlayer(id) {
        var color = this.getUniqueColorR();
        var player = new Player(0, 0, color, id, this.roomSig);
        this.spawnPlayerRandomLoc(player);
        return player;
    }
    spawnPlayerRandomLoc(entity) {
        var loc = this.findFreeLoc(entity);
        entity.x = loc.x;
        entity.y = loc.y;
        entity.newX = loc.x;
        entity.newY = loc.y;
    }
    getUniqueColorR() {
        var usedColors = {};
        for (var id in this.playerList) {
            usedColors[this.playerList[id].color] = true;
        }
        return utils.getUniqueColor(usedColors);
    }
}

module.exports = { World };
