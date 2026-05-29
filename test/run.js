// Test runner — `npm test`. Runs the standalone suites (no server needed), then
// spawns the server and runs the integration suite against it. Exits non-zero if
// any suite fails, so CI can gate on it.
'use strict';
var path = require('path');
var { spawnSync, spawn } = require('child_process');

var DIR = __dirname;
var node = process.execPath;

var standalone = ['movement.test.js', 'physics.test.js', 'engine.test.js', 'queue.test.js', 'stability.test.js'];
var failures = 0;

console.log('=== standalone suites ===');
standalone.forEach(function (f) {
    var r = spawnSync(node, [path.join(DIR, f)], { stdio: 'inherit' });
    if (r.status !== 0) { failures++; }
});

console.log('\n=== integration suite (spawns server) ===');
var server = spawn(node, [path.join(DIR, '..', 'index.js')], { stdio: 'ignore' });

function finish(code) {
    try { server.kill(); } catch (e) { /* already gone */ }
    console.log('\n=== ' + (failures === 0 ? 'ALL SUITES PASSED' : failures + ' SUITE(S) FAILED') + ' ===');
    process.exit(failures === 0 && code === 0 ? 0 : 1);
}

// Give the server a moment to bind the port, then run integration.
setTimeout(function () {
    var r = spawnSync(node, [path.join(DIR, 'integration.test.js')], { stdio: 'inherit' });
    if (r.status !== 0) { failures++; }
    finish(0);
}, 1200);
