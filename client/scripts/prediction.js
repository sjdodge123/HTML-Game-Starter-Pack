// Client-side prediction + server reconciliation for the LOCAL player.
//
// The problem: if the client only rendered the server's snapshots, your own
// movement would lag by a full round-trip (input → server → broadcast → render).
// The fix is the standard authoritative-netcode pattern:
//   * PREDICT — each fixed step, apply the held input to a local predicted copy of
//     your player immediately (so controls feel instant), buffer that input with a
//     sequence number, and send it to the server.
//   * RECONCILE — every snapshot carries the last input seq the server processed
//     for you. Snap the predicted copy to the authoritative state, drop acked
//     inputs, and re-apply the inputs the server hasn't processed yet (replay).
// Both sides advance the player with the SAME function (shared/movement.js), so a
// correct prediction matches the server exactly; collisions (resolved only on the
// server) cause small corrections that reconciliation absorbs.
//
// Only the local player is predicted; remote entities are interpolated (client.js).

var predicted = null;     // { x, y, newX, newY, velX, velY } — the local player's predicted state
var pendingInputs = [];   // unacked inputs, each { seq, input }
var inputSeq = 0;         // monotonically increasing input sequence number
var predictConsts = null; // { acel, maxVelocity, dragCoeff, brakeCoeff } from config

function predictionInit(spawnX, spawnY) {
    predicted = { x: spawnX, y: spawnY, newX: spawnX, newY: spawnY, velX: 0, velY: 0 };
    pendingInputs = [];
    inputSeq = 0;
    predictConsts = {
        acel: config.playerBaseAcel,
        maxVelocity: config.playerMaxSpeed,
        dragCoeff: config.playerDragCoeff,
        brakeCoeff: config.playerBrakeCoeff
    };
}

// Apply one input to the predicted state for one fixed step, using the SHARED
// integrator, then keep the predicted player inside the world (mirrors the
// server's wall clamp closely enough that prediction doesn't visibly leave the
// arena before the next snapshot).
function predictApply(input, dt) {
    predicted.newX = predicted.x;
    predicted.newY = predicted.y;
    SharedMovement.applyMovement(predicted, input, dt, predictConsts);
    predicted.x = predicted.newX;
    predicted.y = predicted.newY;
    if (world != null && config != null) {
        var r = config.playerBaseRadius;
        predicted.x = clamp(predicted.x, world.x + r, world.x + world.width - r);
        predicted.y = clamp(predicted.y, world.y + r, world.y + world.height - r);
    }
}

// One prediction step: stamp a seq, record + apply the input locally, and return
// the packet to send to the server. Called by the fixed-step loop in game.js.
function predictStep(input, dt) {
    if (predicted == null) {
        return null;
    }
    inputSeq++;
    var snapshot = { moveForward: input.moveForward, moveBackward: input.moveBackward, turnLeft: input.turnLeft, turnRight: input.turnRight };
    pendingInputs.push({ seq: inputSeq, input: snapshot });
    predictApply(snapshot, dt);
    return { seq: inputSeq, moveForward: snapshot.moveForward, moveBackward: snapshot.moveBackward, turnLeft: snapshot.turnLeft, turnRight: snapshot.turnRight };
}

// Reconcile against an authoritative snapshot of the local player. `ack` is the
// last input seq the server had processed; drop those, snap to authoritative, and
// replay everything still in flight so the predicted state reflects inputs the
// server hasn't seen yet.
function predictReconcile(authX, authY, authVelX, authVelY, ack, dt) {
    if (predicted == null) {
        return;
    }
    var keep = [];
    for (var i = 0; i < pendingInputs.length; i++) {
        if (pendingInputs[i].seq > ack) {
            keep.push(pendingInputs[i]);
        }
    }
    pendingInputs = keep;

    predicted.x = authX;
    predicted.y = authY;
    predicted.velX = authVelX;
    predicted.velY = authVelY;
    for (var j = 0; j < pendingInputs.length; j++) {
        predictApply(pendingInputs[j].input, dt);
    }
}
