// Minimal canvas renderer. Called once per render frame (game.js's animloop),
// AFTER smoothEntities has eased every player toward its latest server position.
// Draws the arena border and every player as a filled circle, with our own player
// ringed so it's easy to tell which one you drive.

function drawObjects() {
    var ctx = gameContext;
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // Arena border.
    if (world != null) {
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(world.x, world.y, world.width, world.height);
    }

    // Players.
    for (var id in playerList) {
        var p = playerList[id];
        if (p == null || p.x == null) { continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
        ctx.fillStyle = p.color;
        ctx.fill();
        // Ring our own kart white so the local player stands out.
        if (id == myID) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }
    }
}
