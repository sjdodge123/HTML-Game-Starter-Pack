// Entry point — chaochao's index.js, stripped of the auth handshake, Supabase
// config injection, news banner, production bundle rewriter, and per-asset
// cache-control tuning. What remains is the shape every realtime-multiplayer
// Node server has:
//   - one Express app serving the static client,
//   - a Socket.IO server sharing the same HTTP server,
//   - a fixed-timestep tick loop that simulates every room and broadcasts,
//   - wake/sleep so the loop only runs while someone is connected.

var express = require('express');
var compression = require('compression');
var http = require('http');
var path = require('path');
var { Server } = require('socket.io');

var app = express();
var server = http.createServer(app);
var io = new Server(server);

app.use(compression());
// Serve the raw client as-is — no bundler, no build step. The browser loads the
// individual <script> tags in client/play.html directly (chaochao's dev mode).
app.use(express.static(path.join(__dirname, 'client')));

var utils = require('./server/utils.js');
var messenger = require('./server/messenger.js');
var hostess = require('./server/hostess.js');
var c = utils.loadConfig();

// The server sleeps while empty: no clients means nothing to simulate, so the
// tick loop isn't even scheduled. The first connection wakes it; the last
// disconnect puts it back to sleep.
var serverSleeping = true,
    clientCount = 0,
    serverTickSpeed = c.serverTickSpeed,
    serverUpdates = null;

server.listen(c.port, function () {
    console.log('listening on *:' + c.port);
    messenger.build(io);
});

io.on('connection', function (client) {
    checkForWake();
    clientCount++;
    messenger.addMailBox(client.id, client);

    client.on('disconnect', function () {
        hostess.kickFromRoom(client.id);
        messenger.removeMailBox(client.id);
        clientCount--;
        checkForSleep();
    });
});

process.on('SIGINT', function () {
    console.log('\nServer shutting down (Ctrl-C)');
    process.exit();
});

// The fixed-timestep tick. getDT() yields the real seconds since the last tick,
// so the simulation is framed in real time; hostess fans the tick out to every
// live room (which simulates and broadcasts its snapshot).
function update() {
    if (serverSleeping) {
        return;
    }
    var dt = utils.getDT();
    hostess.updateRooms(dt);
}

function checkForWake() {
    if (serverSleeping) {
        console.log('Server wake');
        utils.getDT(); // reset the dt clock so the first tick isn't a huge delta
        serverSleeping = false;
        serverUpdates = setInterval(update, serverTickSpeed);
    }
}

function checkForSleep() {
    if (clientCount == 0) {
        console.log('Server sleep ZZZ..');
        serverSleeping = true;
        clearInterval(serverUpdates);
    }
}
