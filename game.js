class Game{
    constructor(){
        this.gameRunning = false;
        this.timers = [];
    }
    update(){
        for(var i=0;i<this.timers.length;i++){
            this.timers[i].update();
        }
        console.log("Game updating :" + dt);
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
    globals.myGame.update();
}

//Function to call when the button on the screen is clicked
function stopClicked(){
    globals.myGame.endGame();
}
function startClicked(){
    globals.myGame.startGame();
}
