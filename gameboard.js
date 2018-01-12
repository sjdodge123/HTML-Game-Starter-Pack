class Gameboard {
    constructor(){
        this.dt = 0;
        this.pieces = [];
    }
    update(dt){
        this.dt = dt;
        for(var i=0;i<this.pieces.length;i++){
            this.pieces.update(dt);
        }
    }
    clear(){
        this.pieces = [];
    }
}
