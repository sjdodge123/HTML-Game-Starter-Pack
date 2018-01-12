class World {
    constructor(gameboard){
        this.gameboard = gameboard;
        this.worldObjectList = {};
        this.currentObjectList = {};
        this.mapIndex = 0;
        this.worldMaps = 0;
        this.mapReader = new MapReader();
        this.loadMap('exampleMap.json');
    }
    getCurrentMapIndex(){
        return this.mapIndex;
    }
    getPreviousMap(){
        this.mapIndex--;
        this.loadMap();
    }
    getNextMap(){
        this.mapIndex++;
        this.loadMap();
    }
    loadMap(filepath){
        this.gameboard.clear();
        this.mapReader.read(filepath);
    }
    buildMap(map){
        this.mapIndex = map.index;
        //this.worldObjectList[this.mapIndex] = map.getWorldObjects();
        //this.currentObjectList = this.worldObjectList[this.mapIndex];
    }
}
class Map {
    constructor(data){
        this.name = data.name;

        /*
        for(var i=0;i<data.worldObjects.length;i++){
            this.worldObjectList.push()
        }
        */

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
