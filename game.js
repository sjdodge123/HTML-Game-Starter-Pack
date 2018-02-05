class Game{
    constructor(){
        this.dt = 0;
        this.gameRunning = false;
        this.timers = [];
        this.world = new World(25,25);
        this.gameboard = new Gameboard();
    }
    update(dt){
        this.dt = dt;
        for(var i=0;i<this.timers.length;i++){
            this.timers[i].update();
        }
        this.world.update(dt);
        this.gameboard.update(dt);
        //console.log("Game updating :" + dt);
    }
    startGame(){
        this.gameRunning = true;
        animloop();
    }
    //When called stop the main game update loop
    endGame(){
        this.gameRunning = false;
    }
}




//Start main update loop
function animloop(){
    if(globals.myGame.gameRunning){
        var now = Date.now();
        dt = now - globals.then;
        gameLoop(dt);
        globals.then = now;
        requestAnimationFrame(animloop);
    }
}

//For now the game loop will simply consist of updating the timers array and logging the dt or DeltaTime
function gameLoop(dt){
    globals.myGame.update(dt);
}

//Function to call when the button on the screen is clicked
function stopClicked(){
    globals.myGame.endGame();
}
function startClicked(){
    globals.myGame.startGame();
}

function calcMousePos(evt){
    var mousePos = getMousePos(evt);
    globals.mouseX = mousePos.x;
    globals.mouseY = mousePos.y;
}
function mouseClicked(evt){
    switch (event.which) {
       case 1:
           globals.gameboard.selectNearestUnit(globals.mouseX,globals.mouseY);
           break;
       case 2:
           console.log('Middle Mouse button pressed.');
           break;
       case 3:
           console.log('Right Mouse button pressed.');
           break;
       default:
           console.log('You have a strange Mouse!');
   }
}

function getMousePos(evt) {
    var rect = globals.canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
}
