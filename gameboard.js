class Gameboard {
    constructor(){
        this.dt = 0;
        this.selectedUnit = null;
        this.selectedUnits = [];
        this.pieces = [];
        var redCircle = new Circle(100,100,"red",50);
        var blueCircle = new Circle(500,425,"blue",75)
        redCircle.setRandomMovement();
        blueCircle.setRandomMovement();
        this.pieces.push(redCircle);
        this.pieces.push(blueCircle);
        //this.pieces.push(new Rect(500,500,"red",100,100,0));
    }
    update(dt){
        this.dt = dt;
        for(var i=0;i<this.pieces.length;i++){
            if(this.pieces[i].alive == false){
                this.removePiece(i);
                continue;
            }
            this.pieces[i].update(dt);
            globals.world.keepInBounds(this.pieces[i]);
        }
        this.checkCollisions();
    }
    addPiece(object){
        this.pieces.push(object);
    }
    removePiece(index){
        this.pieces.splice(index,1);
    }
    selectNearestUnit(x,y){
        var nearestUnit = null,
            minDistanceSq = Infinity,
            loc = new TargetingCircle(x,y,"purple",10,100);

        //Add the piece to the world to display the selection radius
        globals.world.addPiece(loc);

        for(var piece in this.pieces){
            if(loc.inBounds(this.pieces[piece])){
                var lastDistance = globals.utils.findDistance(this.pieces[piece],loc);
                if(lastDistance <= 0 && lastDistance < minDistanceSq){
                    minDistanceSq = lastDistance;
                    nearestUnit = this.pieces[piece];
                }
            }
        }

        if(nearestUnit == null){
            this.unselectUnits();
            return;
        }
        this.selectedUnit = nearestUnit;
        this.selectedUnit.select();
    }
    unselectUnits(){
        if(this.selectedUnit == null){
            return;
        }
        this.selectedUnit.unselect();
        this.selectedUnit = null;
        this.selectedUnits = [];
    }
    checkCollisions(){
        for(var i=0;i<this.pieces.length-1;i++){
            for(var j=1;j<this.pieces.length;j++){
                if(globals.utils.checkDistance(this.pieces[i],this.pieces[j]) == false){
                    continue;
                }
                //TODO: Check for more advanced collision
                this.pieces[i].handleHit(this.pieces[j]);
                this.pieces[j].handleHit(this.pieces[i]);
            }
        }


    }
    clear(){
        this.pieces = [];
    }
}
