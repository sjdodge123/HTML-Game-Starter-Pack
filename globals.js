var globals = {};


window.onload = function(){
    globals.canvas = document.getElementById('gameCanvas');
    globals.ctx = globals.canvas.getContext("2d");
    globals.then = 0;
    globals.utils = new Utils();
    globals.myGame = new Game();
    globals.gameboard = globals.myGame.gameboard;
    globals.world = globals.myGame.world;
    globals.mouseX = 0;
    globals.mouseY = 0;
    addEventListeners();
}

function addEventListeners(){
    globals.canvas.addEventListener('mousemove',calcMousePos);
    globals.canvas.addEventListener('click',mouseClicked);
}
