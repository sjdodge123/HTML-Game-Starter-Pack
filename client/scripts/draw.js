// Minimal canvas renderer. Called once per render frame (game.js), AFTER the
// camera has been positioned. Everything is drawn in world coordinates mapped
// through worldToScreen, so the camera transform is the only thing that knows
// about pixels. Draw order: arena border, static obstacles, dynamic entities.

function drawObjects() {
    var ctx = gameContext;
    // Reset to device-pixel space and clear, then we draw in logical units.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, camera.viewW, camera.viewH);

    if (world != null) {
        drawWorldBorder(ctx);
    }
    drawObstacles(ctx);
    drawEntities(ctx);
}

function drawWorldBorder(ctx) {
    var tl = worldToScreen(world.x, world.y);
    ctx.strokeStyle = '#3a3a44';
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, world.width * camera.zoom, world.height * camera.zoom);
}

function drawObstacles(ctx) {
    for (var i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        ctx.fillStyle = o.color;
        if (o.shape === 'circle') {
            var c = worldToScreen(o.x, o.y);
            ctx.beginPath();
            ctx.arc(c.x, c.y, o.radius * camera.zoom, 0, 2 * Math.PI);
            ctx.fill();
        } else if (o.shape === 'box') {
            var tl = worldToScreen(o.x, o.y);
            ctx.fillRect(tl.x, tl.y, o.w * camera.zoom, o.h * camera.zoom);
        }
    }
}

function drawEntities(ctx) {
    for (var id in entities) {
        var e = entities[id];
        if (e == null || e.x == null) { continue; }
        var s = worldToScreen(e.x, e.y);
        ctx.beginPath();
        ctx.arc(s.x, s.y, e.radius * camera.zoom, 0, 2 * Math.PI);
        ctx.fillStyle = e.color;
        ctx.fill();
        // Ring the local player so it's easy to tell which one you drive.
        if (id === myID) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }
    }
}
