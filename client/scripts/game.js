// Client bootstrap + render loop.
//
// The client is a THIN presentation layer over the server's authoritative
// simulation. It owns no physics: it connects, reports input, receives snapshots,
// and draws them. This file holds the shared globals (loaded in order by the raw
// <script> tags in play.html) and the requestAnimationFrame render loop.

var server = null,      // the Socket.IO connection
    myID = null,        // this client's id (also keys our own player in playerList)
    config = null,      // the shared config, delivered by the server on join
    playerList = {},    // id -> rendered player ({ x, y, tx, ty, color, radius })
    world = null,       // the arena rect { x, y, width, height }
    currentState = null,
    gameRunning = false,
    then = 0;

// Held-input flags, mutated by input.js and emitted to the server.
var moveForward = false,
    moveBackward = false,
    turnLeft = false,
    turnRight = false;

var gameCanvas = document.getElementById('gameCanvas');
var gameContext = gameCanvas.getContext('2d');

// --- Boot --------------------------------------------------------------------
// Connect, wire the handlers (client.js), then ask to be matchmade into a room.
// The server replies with a gameState snapshot, which starts the render loop.
function boot() {
    server = io();
    registerHandlers(server);
    server.on('connect', function () {
        // -1 = "find me any room with space" (server.findARoom).
        server.emit('enterGame', -1);
    });
}

// --- Client-side motion smoothing --------------------------------------------
// The server broadcasts positions at its tick rate (~30Hz); rendering at 60fps
// would visibly STEP if we drew those raw. So each player carries a smoothing
// TARGET (tx/ty) — the latest server position — and we ease the RENDER position
// (x/y) toward it each frame. A large jump (a fresh spawn) snaps instead of
// sliding. Easing, not extrapolation: the sim is authoritative and collision-
// heavy, so guessing ahead would overshoot into walls and rubber-band.
var SMOOTH_TAU = 40;        // ms — ~3 frames to catch up
var SMOOTH_SNAP_DIST = 200; // px — beyond this is a teleport/spawn, so snap
function smoothPos(o, dt) {
    if (o == null || o.tx == null) { return; }
    if (o.x == null || o.y == null) { o.x = o.tx; o.y = o.ty; return; }
    var dx = o.tx - o.x, dy = o.ty - o.y;
    if (dx * dx + dy * dy > SMOOTH_SNAP_DIST * SMOOTH_SNAP_DIST) {
        o.x = o.tx; o.y = o.ty; return;
    }
    var a = 1 - Math.exp(-dt / SMOOTH_TAU); // dt >> tau (tab refocus) -> a -> 1, no overshoot
    o.x += dx * a;
    o.y += dy * a;
}
function smoothEntities(dt) {
    if (!(dt > 0)) { return; }
    for (var id in playerList) {
        smoothPos(playerList[id], dt);
    }
}

// --- Render loop -------------------------------------------------------------
function animloop() {
    if (!gameRunning) { return; }
    var now = Date.now();
    var dt = now - then;
    then = now;
    smoothEntities(dt);
    drawObjects();
    requestAnimFrame(animloop);
}

window.addEventListener('load', boot);
