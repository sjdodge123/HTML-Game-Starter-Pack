// Keyboard input -> movement events.
//
// The client sends only INTENT: which direction keys are held. It never moves its
// own kart — the server's engine reads these flags next tick and decides the
// motion (this is what "server-authoritative" means in practice). WASD and the
// arrow keys both map to the four directions the server's engine understands.

window.addEventListener('keydown', onKey(true), false);
window.addEventListener('keyup', onKey(false), false);

// Resolve a keyboard event to one of the four movement intents, or null.
function keyToAction(e) {
    switch (e.code) {
        case 'KeyW': case 'ArrowUp': return 'moveForward';
        case 'KeyS': case 'ArrowDown': return 'moveBackward';
        case 'KeyA': case 'ArrowLeft': return 'turnLeft';
        case 'KeyD': case 'ArrowRight': return 'turnRight';
        default: return null;
    }
}

function onKey(pressed) {
    return function (e) {
        var action = keyToAction(e);
        if (action == null) { return; }
        e.preventDefault(); // stop arrow keys scrolling the page
        switch (action) {
            case 'moveForward': moveForward = pressed; break;
            case 'moveBackward': moveBackward = pressed; break;
            case 'turnLeft': turnLeft = pressed; break;
            case 'turnRight': turnRight = pressed; break;
        }
        sendMovement();
    };
}

// Report the full held-key state. Sending on every edge (not on a timer) keeps the
// payload tiny and the server's view of our input current.
function sendMovement() {
    if (server == null) { return; }
    server.emit('movement', {
        moveForward: moveForward,
        moveBackward: moveBackward,
        turnLeft: turnLeft,
        turnRight: turnRight
    });
}

// Be a good citizen: tell the server we're leaving so the room frees our slot
// promptly (the socket 'disconnect' is the real teardown, but this is instant).
window.addEventListener('beforeunload', function () {
    if (server != null) { server.emit('playerLeaveRoom'); }
});
