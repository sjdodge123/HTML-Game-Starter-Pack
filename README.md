# Server-Authoritative Multiplayer Game Engine Skeleton

A small but real foundation for building real-time multiplayer browser games. The
server is authoritative; clients predict their own movement for responsive controls
and reconcile against the server's truth. It ships with a generalized entity model,
static level geometry, client-side prediction, a camera, and a pluggable **game
mode** seam — the bones you build a game *on*, not a game itself.

The demo (the default `arena` mode): every connected client drives a circle with
WASD/arrows around a shared arena; gold pickups bounce around; everything collides
off the walls, the obstacles, and each other; all clients see each other live.

This is the [chaochao](https://github.com/sjdodge123/chaochao) racing game's matured
multiplayer architecture, harvested back into the starter it was forked from. The
original 2018 flat-file starter is preserved under [`legacy/`](./legacy).

## Run it

```bash
npm install
npm start
```

Open **http://localhost:3000/play.html in TWO browser tabs**, drive with **WASD** or
the **arrow keys** (your own circle is ringed white). Both tabs render both players,
the pickups, and the obstacles; everything bounces and stays in bounds.

```bash
npm test     # all suites (movement, physics, engine, stability, integration)
npm run bench # engine throughput at 25/100/250 entities
```

## Architecture

One Node process serves the static client (Express, from `client/` + the shared
integrator at `/shared`) **and** hosts the Socket.IO server on the same port. No
bundler, no build step — the browser loads the raw `<script>` tags in `play.html`.

**The server is authoritative.** It owns the simulation; clients render snapshots
and report input. A **fixed-timestep accumulator** advances the sim in constant
`FIXED_DT` increments (deterministic, jitter-immune; a long stall is clamped by
`maxSubStepsPerTick`, not spiralled). Each tick it broadcasts a compact snapshot.

**The client is thin, with one exception: prediction.** It applies your own input
locally the instant you press a key (so controls feel zero-latency), then reconciles
that prediction against each authoritative snapshot. Remote entities are
interpolated. The client owns no authoritative physics.

The flow of one input:

```
keydown ─▶ held flag ─▶ [client fixed step] predict locally + send {seq, keys}
                                                    │
server tick: apply input ─▶ integrate ─▶ collide ─▶ commit  (authoritative)
                                                    │
   snapshot {entities[…], tick, per-entity inputAck} ──▶ every client
                                                    │
   local player: reconcile (snap to truth, replay un-acked inputs)
   remote entities: interpolate ─▶ draw through the camera
```

### Entity model
Everything the engine simulates is an **Entity** (`server/entities/entity.js`) —
a circle with a wire `type`, lifecycle, and a generic collision response. `Player`
adds input; `Pickup` is a free-floating ball (a worked example of a second entity
type — it inherits all collision for free). Static level geometry
(`CircleObstacle`, `BoxObstacle`) is immovable. **To add a new entity type:**
subclass `Entity`, give it a `type` tag, and the broad-phase, collision, and wire
protocol pick it up automatically.

### Game-mode seam
`server/modes/arena.js` is the default mode and the template for your own. A mode
gets lifecycle hooks — `onStart`, `onStop`, `onPlayerJoin`, `onPlayerLeave`,
`onTick`, `checkWin` — and the `game` to read/mutate (`spawnEntity`,
`despawnEntity`, `entities`, `world`). The engine, networking, and entity model
stay game-agnostic; your rules live in the mode. Point `config.gameMode` at a new
file to swap games.

## The contracts you must respect when extending

1. **Lockstep + protocol version.** Payloads are positional arrays (no JSON keys)
   to save bandwidth. Their slot layout is a matched pair between
   `server/compressor.js` (packers) and `client/scripts/client.js` (decoders) —
   change one, change the other in the same slot order. The protocol is **versioned**
   (`config.protocolVersion`, checked on join against `CLIENT_PROTOCOL_VERSION`), so
   a layout drift fails loudly instead of silently misreading.
2. **`config.json` is the single source of truth.** All tuning (world size, tick
   rate, player physics, pickup/obstacle params, the `stateMap`) lives there and is
   shipped to the client on join. Read it on both sides; don't fork the numbers.
3. **The movement integrator is shared.** `shared/movement.js` is the ONE piece of
   sim code that runs on both server and client (prediction). If you change how
   players move, change it there — divergence shows up as reconciliation jitter.

## File tree

```
index.js                      Express static server (client/ + /shared) + Socket.IO + the tick loop.
shared/
  movement.js                 The shared input→velocity→position integrator (server require + browser global).
server/
  config.json                 Single source of truth: protocol version, world, tick, physics, pickups, obstacles, mode.
  utils.js                    Config loader + dt clock + pure math + colour picker.
  engine.js                   Physics core: step() (fixed step), QuadTree broad-phase (dynamic + static), collision dispatch, wall bounce.
  compressor.js               SERVER half of the wire contract — type-tagged entities, input acks, obstacles, positional arrays.
  hostess.js                  Room registry / matchmaker (prototype-less map; validated sigs).
  messenger.js                Socket boundary: getConfig / enterGame / movement (seq-checked) / leave + room broadcasts.
  game.js                     Room + Game: fixed-timestep accumulator, entity bookkeeping, server tick, hosts the game mode.
  modes/
    arena.js                  Default game mode + template (lifecycle hooks; spawns the demo pickups).
  entities/
    entity.js                 Base dynamic entity: lifecycle + generic circle/box collision response.
    player.js                 Input-driven entity; motion via the shared integrator; input sequence acks.
    pickup.js                 Example second entity type — a free-floating bouncing ball.
    obstacles.js              Static level geometry: immovable CircleObstacle + BoxObstacle (AABB).
    shapes.js                 Geometry primitives (Shape / Rect / Circle) and overlap tests.
    world.js                  Arena rect + default obstacle layout + player creation/spawn.
client/
  play.html                   Canvas page; loads the shared integrator + raw client scripts (no bundler).
  scripts/
    utils.js                  Client math + requestAnimationFrame shim.
    camera.js                 Follow camera + world→screen transform (clamped to the world).
    game.js                   Bootstrap + render loop + the fixed-step prediction/emit loop + DPR resize.
    prediction.js             Client-side prediction + server reconciliation for the local player.
    client.js                 Socket handlers + DECODERS (lockstep partner of compressor.js) + protocol-version check.
    draw.js                   Canvas renderer (arena, obstacles, entities) through the camera.
    input.js                  Keyboard → held movement flags (sampled by the prediction loop).
test/
  run.js                      `npm test` runner (standalone suites + spawns a server for integration).
  movement.test.js            Shared integrator: determinism, speed clamp, braking.
  physics.test.js             Entity-vs-entity elastic collision + wall bounce.
  engine.test.js              Obstacle collisions (circle + box), cross-type, pickup-vs-wall.
  stability.test.js           Fixed-timestep determinism under jitter + anti-spiral clamp.
  integration.test.js         Two scripted clients vs a live server (protocol + lockstep + sync).
  perf.bench.js               Engine throughput at 25/100/250 entities.
.github/workflows/ci.yml      CI: npm ci + npm test.
legacy/                       The original 2018 flat-file starter, kept for reference.
```

## What's intentionally NOT here

This is a foundation, so genre/scale-specific machinery is deliberately omitted
until a real game (and a profiler) calls for it: delta/binary snapshot compression,
area-of-interest culling, lag compensation, an ECS, a full asset/sprite pipeline,
persistence/accounts, and (from the donor) maps editor, abilities, AI, scoring,
music. The engine isn't CPU-bound at this scale (~6.5µs/tick for 25 entities, well
under 0.1% of the tick budget), so those optimizations would be premature.

The skeleton also keeps the **simplest correct** version of a few things, with the
upgrade path noted in-code: the server applies the latest reported input each step
(a per-input queue gives tighter determinism); prediction corrects collisions by
reconciliation rather than simulating the whole world client-side (standard).
