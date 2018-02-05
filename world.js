class World extends Rect{
    constructor(offsetX,offsetY){
        super(0,0,"orange",globals.canvas.height-(offsetY*2),globals.canvas.width-(offsetX*2),0);
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.pieces = [];
    }
    update(dt){
        super.update(dt);
        for(var i=0;i<this.pieces.length;i++){
            if(this.pieces[i].alive == false){
                this.removePiece(i);
                continue;
            }
            this.pieces[i].update(dt);
        }
    }
    addPiece(object){
        this.pieces.push(object);
    }
    removePiece(index){
        this.pieces.splice(index,1);
    }
    draw(){
        globals.ctx.clearRect(this.offsetX,this.offsetY,this.width,this.length);

        globals.ctx.save();
        globals.ctx.strokeStyle = this.color;
        globals.ctx.rect(this.offsetX,this.offsetY,this.width,this.length);
        globals.ctx.stroke();
        globals.ctx.restore();
    }
    testCircle(shape){
        if(shape.newX - shape.radius < this.x){
    		shape.newX = shape.x;
    		shape.velX = -shape.velX;
    	}
    	if(shape.newX + shape.radius > this.x + this.width){
    		shape.newX = shape.x;
    		shape.velX = -shape.velX;
    	}
    	if (shape.newY - shape.radius < this.y){
    		shape.newY = shape.y;
    		shape.velY = -shape.velY;
    	}
    	if(shape.newY + shape.radius > this.y + this.height){
    		shape.newY = shape.y;
    		shape.velY = -shape.velY;;
    	}
    }
}
/*
class Map {
    constructor(data){
        this.name = data.name;

        for(var i=0;i<data.worldObjects.length;i++){
            this.worldObjectList.push()
        }

    }
    getWorldObjects(){
        return this.mapObjectList;
    }
}
class MapReader {
    constructor(){
        this.srcList = [];
    }
    readAll(){
        var mapList = [];
        for(var i=0;i<this.srcList.length;i++){
            mapList = JSON.parse(this.srcList[i]);
        }
        return mapList;
    }
    read(filepath){
        $.getJSON(filepath,function(data){
            globals.world.buildMap(new Map(data));
        });
    }
}
*/
