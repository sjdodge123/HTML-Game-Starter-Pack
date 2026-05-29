// Camera — a follow camera with a world→screen transform. The viewport (the
// canvas' logical size) is smaller than the world, so the camera tracks the local
// player and clamps to the world edges (you never see past the arena). All drawing
// goes through worldToScreen so the rest of the client can think purely in world
// coordinates.

var camera = {
    cx: 0, cy: 0,       // world-space center of the view (eased toward the target)
    zoom: 1,            // screen pixels per world unit
    viewW: 1024,        // logical viewport size (canvas backing is this × devicePixelRatio)
    viewH: 576
};

// Ease the camera toward (targetX, targetY) in world space, clamped so the visible
// window stays inside the world. If the world is smaller than the view on an axis,
// center on it instead.
function cameraFollow(targetX, targetY) {
    if (targetX == null || targetY == null) {
        return;
    }
    var halfW = camera.viewW / (2 * camera.zoom);
    var halfH = camera.viewH / (2 * camera.zoom);
    var tx = targetX, ty = targetY;
    if (world != null) {
        if (world.width <= 2 * halfW) {
            tx = world.x + world.width / 2;
        } else {
            tx = clamp(tx, world.x + halfW, world.x + world.width - halfW);
        }
        if (world.height <= 2 * halfH) {
            ty = world.y + world.height / 2;
        } else {
            ty = clamp(ty, world.y + halfH, world.y + world.height - halfH);
        }
    }
    // Snap on first use, otherwise glide.
    if (camera.cx === 0 && camera.cy === 0) {
        camera.cx = tx; camera.cy = ty;
    } else {
        camera.cx += (tx - camera.cx) * 0.15;
        camera.cy += (ty - camera.cy) * 0.15;
    }
}

function worldToScreen(wx, wy) {
    return {
        x: (wx - camera.cx) * camera.zoom + camera.viewW / 2,
        y: (wy - camera.cy) * camera.zoom + camera.viewH / 2
    };
}
