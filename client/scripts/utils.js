// Client math/helpers — browser-side counterparts to the server's utils.js.

function getMag(x, y) {
    return Math.sqrt(x * x + y * y);
}

function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

// requestAnimationFrame with a setTimeout fallback for very old browsers.
var requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (callback) { window.setTimeout(callback, 1000 / 60); };
})();
