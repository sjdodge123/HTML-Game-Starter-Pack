
class Utils {
    constructor(){

    }
    dotProduct(a,b){
        return a.x * b.x + a.y * b.y;
    }
    getMag(x,y){
        return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    }
    getMagSq(x1, y1, x2, y2){
        return Math.pow(x2-x1,2) + Math.pow(y2-y1, 2);
    }
    getRandomInt(min,max){
        min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    findDistance(obj1,obj2){
        var objX1 = obj1.newX || obj1.x;
    	var objY1 = obj1.newY || obj1.y;
    	var objX2 = obj2.newX || obj2.x;
    	var objY2 = obj2.newY || obj2.y;
    	var distance = this.getMag(objX2 - objX1,objY2 - objY1);
        if(obj1.radius != null){
            distance -=  obj1.radius;
        }
        if(obj1.length != null){
            distance -= obj1.length/2;
        }
        if(obj2.radius != null){
            distance -= obj2.radius;
        }
        if(obj2.length != null){
            distance -= obj2.length/2;
        }
        return distance;
    }
    checkDistance(obj1,obj2){
        var distance = this.findDistance(obj1,obj2);
    	if(distance <= 0){
    		return true;
    	}
    	return false;
    }

}
class Timer{
    constructor(duration,callback,ref){
        this.start = Date.now();
        this.callback = callback;
        this.duration = duration;
        this.ref = ref;
        this.elapsedTime = 0;
        this.id = globals.myGame.timers.length;
        globals.myGame.timers.push(this);
    }
    update(){
        this.elapsedTime = Date.now() - this.start;
        if(this.elapsedTime > this.duration){
            this.callback.call(this.ref);
            globals.myGame.timers.splice(this.id,1);
            return;
        }
    }
}
