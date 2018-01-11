var globals = {};
window.onload = function(){
    globals.canvas = document.getElementById('gameCanvas');
    globals.ctx = globals.canvas.getContext("2d");
    globals.then = 0;
    globals.myGame = new Game();
}
