'use strict';
// Server utilities — the GENERIC half of chaochao's utils.js.
//
// chaochao's utils.js had grown to ~30 reusable engine helpers tangled together
// with game-specific concerns (map loading, Voronoi cell graphs, a GitHub-PR map
// submitter, palettes derived from map data). The skeleton keeps ONLY the pieces
// every server build needs no matter what game sits on top:
//   - loadConfig()  : the single source of truth, read once and shared by ref.
//   - getDT()       : the wall-clock delta-time source for the fixed-timestep loop.
//   - pure math     : getMag / getMagSq / dotProduct / getRandomInt.
//   - getUniqueColor: hand each player a visually distinct colour.
// Everything map/Voronoi/Octokit/asset-listing-shaped was dropped.

// config.json is loaded once and the SAME object is returned to every caller of
// loadConfig(). Tuning values therefore live in exactly one place server-side,
// and that same object is shipped to the client (see messenger 'getConfig') so the
// two halves never fork their numbers.
var c = require('./config.json');
c.port = process.env.PORT || c.port;

exports.loadConfig = function () {
    return c;
};

// --- Delta-time clock --------------------------------------------------------
// getDT() returns SECONDS elapsed since the previous call. index.js calls it once
// per server tick and feeds the result through the whole simulation, so physics is
// framed in real time and a slow/long tick simply integrates a larger dt rather
// than running in slow motion.
var lastFrame = Date.now();
exports.getDT = function () {
    var now = Date.now();
    var dt = now - lastFrame;
    lastFrame = now;
    return dt / 1000;
};

// --- Pure math ---------------------------------------------------------------
exports.getMag = function (x, y) {
    return Math.sqrt(x * x + y * y);
};
exports.getMagSq = function (x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    return dx * dx + dy * dy;
};
exports.dotProduct = function (a, b) {
    return a.x * b.x + a.y * b.y;
};
exports.getRandomInt = function (min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// --- Colours -----------------------------------------------------------------
// A fixed palette of visually distinct colours (chaochao's named-colour set).
// getUniqueColor() prefers a palette entry not already in use so karts stay
// distinguishable; once the palette is exhausted it falls back to a random hue.
var PALETTE = [
    '#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4',
    '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990', '#dcbeff',
    '#9A6324', '#800000', '#aaffc3', '#808000', '#000075', '#f58231'
];
exports.getUniqueColor = function (usedColors) {
    usedColors = usedColors || {};
    var available = [];
    for (var i = 0; i < PALETTE.length; i++) {
        if (!usedColors[PALETTE[i]]) {
            available.push(PALETTE[i]);
        }
    }
    if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
    }
    return 'hsl(' + Math.floor(Math.random() * 360) + ', 70%, 50%)';
};
