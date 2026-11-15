(() => {
  "use strict";

  class FrameLoop {
    constructor(request, cancel, frame, onFailure) {
      this.request = request;
      this.cancel = cancel;
      this.frame = frame;
      this.onFailure = onFailure;
      this.active = false;
      this.pending = null;
      this.generation = 0;
    }
    start() {
      if(this.active) return;
      this.active = true;
      this.schedule();
    }
    stop() {
      this.active = false;
      this.generation++;
      if(this.pending !== null) this.cancel(this.pending);
      this.pending = null;
    }
    schedule() {
      if(!this.active || this.pending !== null) return;
      const generation=this.generation;
      this.pending=this.request(now=>{
        if(!this.active || generation!==this.generation) return;
        this.pending=null;
        try {
          this.frame(now);
        } catch(error) {
          this.stop();
          this.onFailure(error);
          return;
        }
        this.schedule();
      });
    }
  }

  class Diagnostics {
    constructor(enabled, limit=40) {
      this.enabled=enabled;
      this.history=enabled?new Array(limit):[];
      this.count=0;
      this.frames=0;
      this.subsystem="startup";
      this.transition=null;
    }
    begin(now) {
      this.frames++;
      this.lastTimestamp=now;
    }
    mark(subsystem) { this.subsystem=subsystem; }
    note(label, detail) {
      if(!this.enabled) return;
      this.history[this.count++%this.history.length]={label,frame:this.frames,detail};
    }
    change(from,to) {
      if(!this.enabled || from===to) return;
      this.transition={from,to,frame:this.frames};
      this.note("transition",this.transition);
    }
    snapshot() {
      const length=Math.min(this.count,this.history.length);
      const history=Array.from({length},(_,index)=>this.history[(this.count-length+index)%this.history.length]);
      return {frame:this.frames,lastFrameTimestamp:this.lastTimestamp,subsystem:this.subsystem,lastTransition:this.transition,history};
    }
  }
  globalThis.FrostStability={FrameLoop,Diagnostics};
})();
