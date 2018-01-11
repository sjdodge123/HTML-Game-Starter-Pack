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
