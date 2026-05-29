// Client bootstrap + render loop.
//
// The client is a thin presentation layer over the server's authoritative sim,
// with ONE exception: it predicts its own player locally for responsive controls
// (see prediction.js). It connects, reports input, receives snapshots, reconciles
// its prediction, interpolates remote entities, and draws — owning no authoritative
// physics. This file holds the shared globals (loaded in order by play.html's raw
// <script> tags) and the requestAnimationFrame loop that drives prediction +
// rendering.

// Must match server config.protocolVersion. A mismatch means the client was built
// against a different wire layout (compressor/decoder lockstep) — refuse to run.
var CLIENT_PROTOCOL_VERSION = 1;

var server = null,
    myID = null,
    config = null,
    world = null,
    entities = {},      // id -> { type, x, y, tx, ty, velX, velY, color, radius }
    obstacles = [],     // decoded static geometry
    currentState = null,
    serverTick = 0,
    gameRunning = false,
    protocolOK = true;

// Held input flags, mutated by input.js, sampled by the prediction loop.
var moveForward = false,
    moveBackward = false,
    turnLeft = false,
    turnRight = false;

// Timing.
var lastFrameTime = 0,
    predictionAccumulator = 0,
    FIXED_DT_MS = 33.33,        // set from config on join
    FIXED_DT_S = 0.03333;

var gameCanvas = document.getElementById('gameCanvas');
var gameContext = gameCanvas.getContext('2d');
var dpr = window.devicePixelRatio || 1;

function boot() {
    server = io();
    registerHandlers(server);
    server.on('connect', function () {
        server.emit('enterGame', -1); // -1 = matchmake into any room with space
    });
}

// Size the canvas backing store for the device pixel ratio so rendering is crisp
// on HiDPI displays, while we keep drawing in logical (viewW × viewH) coordinates.
function resize() {
    dpr = window.devicePixelRatio || 1;
    gameCanvas.width = camera.viewW * dpr;
    gameCanvas.height = camera.viewH * dpr;
    gameCanvas.style.width = camera.viewW + 'px';
    gameCanvas.style.height = camera.viewH + 'px';
}

// --- Remote entity interpolation --------------------------------------------
// Remote entities ease their render position (x/y) toward the latest server
// position (tx/ty), so 30Hz snapshots don't render as visible stepping at 60fps.
// A big jump (spawn/teleport) snaps. The LOCAL player is excluded — it's driven by
// prediction, not interpolation.
var SMOOTH_TAU = 40, SMOOTH_SNAP_DIST = 200;
function interpolateRemote(dt) {
    for (var id in entities) {
        if (id === myID) { continue; }
        var e = entities[id];
        if (e.tx == null) { continue; }
        if (e.x == null) { e.x = e.tx; e.y = e.ty; continue; }
        var ddx = e.tx - e.x, ddy = e.ty - e.y;
        if (ddx * ddx + ddy * ddy > SMOOTH_SNAP_DIST * SMOOTH_SNAP_DIST) {
            e.x = e.tx; e.y = e.ty; continue;
        }
        var a = 1 - Math.exp(-dt / SMOOTH_TAU);
        e.x += ddx * a;
        e.y += ddy * a;
    }
}

function animloop() {
    if (!gameRunning) { return; }
    var now = Date.now();
    var frameDt = now - lastFrameTime;
    lastFrameTime = now;
    if (frameDt > 250) { frameDt = 250; } // tab was backgrounded — don't fast-forward a huge burst

    // Prediction runs on the SAME fixed timestep as the server. Each step: sample
    // held input, advance the predicted local player, and send the input upstream.
    predictionAccumulator += frameDt;
    var steps = 0;
    while (predictionAccumulator >= FIXED_DT_MS && steps < 10) {
        var input = { moveForward: moveForward, moveBackward: moveBackward, turnLeft: turnLeft, turnRight: turnRight };
        var pkt = predictStep(input, FIXED_DT_S);
        if (pkt != null && server != null) {
            server.emit('movement', pkt);
        }
        predictionAccumulator -= FIXED_DT_MS;
        steps++;
    }

    // Local player renders from its predicted state; remotes from interpolation.
    if (myID != null && entities[myID] != null && predicted != null) {
        entities[myID].x = predicted.x;
        entities[myID].y = predicted.y;
    }
    interpolateRemote(frameDt);

    // Camera follows the local player.
    if (myID != null && entities[myID] != null) {
        cameraFollow(entities[myID].x, entities[myID].y);
    }

    drawObjects();
    requestAnimFrame(animloop);
}

window.addEventListener('resize', resize);
window.addEventListener('load', boot);
