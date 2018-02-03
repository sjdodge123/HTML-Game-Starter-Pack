class Gameboard {
    constructor(){
        this.dt = 0;
        this.pieces = [];
        this.pieces.push(new Circle(100,100,"blue",50));
        this.pieces.push(new Rect(200,200,"red",100,100,0));
    }
    update(dt){
        this.dt = dt;
        for(var i=0;i<this.pieces.length;i++){
            this.pieces[i].update(dt);
        }
        this.checkCollisions();
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
