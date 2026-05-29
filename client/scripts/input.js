// Keyboard input -> held movement flags.
//
// Unlike the first skeleton, input is NOT emitted here. The prediction loop
// (game.js) samples these held flags every fixed step, applies them locally for
// instant response, stamps a sequence number, and sends that to the server. This
// keeps prediction and the network packet perfectly in step (one input per
// predicted step, each with its own seq for reconciliation).

window.addEventListener('keydown', onKey(true), false);
window.addEventListener('keyup', onKey(false), false);

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
    };
}

// Be a good citizen: tell the server we're leaving so the room frees our slot
// promptly (the socket 'disconnect' is the real teardown, but this is instant).
window.addEventListener('beforeunload', function () {
    if (server != null) { server.emit('playerLeaveRoom'); }
});
