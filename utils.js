
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
