// Client math helpers — the browser-side counterparts to the server's utils.js.
// Kept tiny on purpose; the skeleton's rendering only needs a couple of these.

function getMag(x, y) {
    return Math.sqrt(x * x + y * y);
}

// requestAnimationFrame with a setTimeout fallback for very old browsers, so the
// render loop in game.js has something to call regardless of vendor prefixes.
var requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (callback) { window.setTimeout(callback, 1000 / 60); };
})();
