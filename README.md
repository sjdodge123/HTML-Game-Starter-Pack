# Server-Authoritative Multiplayer Skeleton

A minimal, runnable **server-authoritative multiplayer game** — the bare bones of a
real-time game with no actual game on top. Every connected client is a circle they
drive around a shared arena with WASD / arrow keys; the server simulates everything
and every client sees everyone else live. It's deliberately just the load-bearing
structure (one authoritative simulation, a compressed per-tick broadcast, thin
clients that only render and forward input) so you can graft a real game onto it.

This is the [chaochao](https://github.com/sjdodge123/chaochao) racing game with the
game stripped out — chaochao was itself forked from the 2018 version of this starter
pack, so this harvests its matured multiplayer architecture back into the starter.
The original 2018 flat-file starter is preserved under [`legacy/`](./legacy) for
reference.

## Run it

```bash
npm install
npm start
```

Then open **http://localhost:3000/play.html in TWO browser tabs**. Drive with
**WASD** or the **arrow keys**. Each tab is its own player; both tabs render both
circles, moving live, and the circles bounce off each other and off the arena walls.
(Your own circle is ringed white.)

## Architecture

One Node process does everything:

- **It serves the static client** (Express, from `client/`) **and hosts the
  Socket.IO server** on the same port. No bundler, no build step — the browser loads
  the raw `<script>` tags in `play.html` directly.
- **Gameplay is fully authoritative on the server.** The client owns no physics. It
  reports only *intent* ("these movement keys are held") and renders the snapshots it
  receives. The server's engine integrates input into velocity into position,
  resolves wall and circle-vs-circle collisions, and is the single source of truth
  for where everything is.
- **A fixed-timestep tick loop** (`setInterval` at `serverTickSpeed`) simulates every
  room and broadcasts a compact snapshot each tick. The loop sleeps while no one is
  connected and wakes on the first connection.

The flow of one player:

```
browser keydown ──"movement"──▶ server records held-input on that player
                                         │
server tick: engine integrates ──▶ collisions ──▶ commit positions
                                         │
        compressor packs snapshot ──"gameUpdates"──▶ every client in the room
                                         │
                       client decodes ──▶ eases positions ──▶ draws
```

## The two contracts you must respect when extending

1. **Lockstep.** What crosses the socket is *positional arrays*, not keyed objects
   (dropping JSON keys is a big, free bandwidth win at 30 ticks/sec × every player).
   The price: the meaning of each array slot lives only in the shared convention
   between the packers in **`server/compressor.js`** and the decoders in
   **`client/scripts/client.js`**. Any change to a per-tick (or spawn) payload shape
   must be made in BOTH, in the same slot order, or the client silently reads the
   wrong field. Each packer/decoder names its counterpart in a comment.

2. **`config.json` is the single source of truth.** `server/config.json` holds all
   tuning (world size, tick speed, player physics, the `stateMap`). The server loads
   it once and ships *the same object* to the client on join (in the `gameState`
   payload). Read tuning from that delivered config on the client — don't hard-code a
   second copy, or the two halves will drift apart.

## File tree

```
index.js                      Entry: Express static server + Socket.IO + the tick loop (wake/sleep).
package.json                  express, socket.io, compression. `npm start`.
server/
  config.json                 Single source of truth: world size, tick speed, player physics, stateMap.
  utils.js                    Config loader + dt clock + pure math (getMag/getMagSq/dotProduct/getRandomInt) + colour picker.
  engine.js                   Physics core: velocity integration, QuadTree broad-phase, narrow-phase handleHit dispatch, wall bounce.
  compressor.js               SERVER half of the wire contract — packs every payload into positional arrays.
  hostess.js                  Room registry / matchmaker: find-or-create a room with space, tick all rooms, reclaim empties.
  messenger.js                Socket boundary: per-connection handlers (getConfig / enterGame / movement / leave) + room broadcasts.
  game.js                     Room + a tiny two-state Game machine (waiting ⇄ playing) that runs the authoritative tick.
  entities/
    shapes.js                 Geometry primitives: Shape / Rect / Circle and their overlap tests.
    world.js                  The arena (extends Rect); creates and spawns players with a unique colour.
    player.js                 A driven circle: input flags, velocity/physics, and the circle-vs-circle bounce in handleHit.
client/
  play.html                   Canvas page; loads the raw client scripts in dependency order (no bundler).
  scripts/
    utils.js                  Client math helpers + requestAnimationFrame shim.
    game.js                   Bootstrap (connect → enterGame) + the render loop + client-side motion smoothing.
    client.js                 Socket handlers + DECODERS that mirror compressor.js (the lockstep partner).
    draw.js                   Minimal canvas renderer (arena border + a circle per player).
    input.js                  Keyboard → "movement" events to the server.
legacy/                       The original 2018 flat-file starter, kept for reference.
```

## What's intentionally NOT here

This is a skeleton, so chaochao's actual game is gone on purpose: no maps / map
editor, no Voronoi-tile terrain, no abilities, no punches/combat, no AI bots, no
scoring or rounds, no music / achievements, no auth or accounts, no analytics, and
no build/bundling step. What's left is just the authoritative-multiplayer pattern —
add your game on top of it.
