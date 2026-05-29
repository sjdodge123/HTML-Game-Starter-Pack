// Lifecycle test — Game.clearNonPlayers (round wind-down) keeps players and any
// entity flagged `persistent`, and drops transient mode-spawned entities. Stubs the
// Socket.IO `io` so despawn broadcasts no-op (we're testing selection, not the wire).
'use strict';
var messenger = require('../server/messenger.js');
messenger.build({ to: function () { return { emit: function () { } }; } });
var game = require('../server/game.js');
var { Entity } = require('../server/entities/entity.js');

var passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  PASS  ' + name); } else { failed++; console.log('  FAIL  ' + name); } }

console.log('lifecycle.test.js');

var room = game.getRoom(1, 25);
var player = room.spawnPlayer('p1');                       // a player (managed via join/leave)
var transient = new Entity(100, 100, 9, '#fff', 'pk1', 'pickup'); // default persistent=false
room.game.registerEntity(transient);
var persistent = new Entity(200, 200, 9, '#fff', 'flag1', 'flag');
persistent.persistent = true;                              // mode opted this one in
room.game.registerEntity(persistent);

check('before wind-down: all three entities present', Object.keys(room.game.entities).length === 3);

room.game.clearNonPlayers();

check('player survives the round wind-down', room.game.entities['p1'] === player);
check('transient (non-persistent) entity is cleared', room.game.entities['pk1'] == null);
check('persistent entity survives (flag respected, not hardcoded type)', room.game.entities['flag1'] === persistent);

console.log('lifecycle: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
