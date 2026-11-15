(() => {
  "use strict";
  const profiles={
    light:{color:"#d7f5ff",r:15,duration:.10,particles:4},
    heavy:{color:"#ffe2b6",r:27,duration:.14,particles:8,shake:2.4,hold:.08},
    bossHit:{color:"#c2e5ff",r:13,duration:.11,particles:3},
    bossHeavy:{color:"#e7f7ff",r:27,duration:.15,particles:7,shake:3.4,hold:.134},
    block:{color:"#ffcd85",r:18,duration:.16,particles:6},
    perfect:{color:"#c7f5ff",r:29,duration:.24,particles:10,shake:1.7,hold:.072},
    posture:{color:"#ffe0a6",r:34,duration:.27,particles:11,shake:3,hold:.112},
    frost:{color:"#9dc8ff",r:12,duration:.14,particles:4},
    ash:{color:"#ef7986",r:17,duration:.22,particles:5},
    freeze:{color:"#bff3ff",r:24,duration:.30,particles:7},
    dodge:{color:"#a9e9ff",r:18,duration:.16,particles:4},
    armor:{color:"#f4cda1",r:24,duration:.21,particles:5},
    skill:{color:"#b5a7f9",r:23,duration:.25,particles:6},
    potion:{color:"#9fe1c8",r:21,duration:.36,particles:6},
    defeat:{color:"#a4c1df",r:25,duration:.27,particles:6},
    phase:{color:"#b2ddff",r:54,duration:.45,particles:12,shake:3.1,hold:.14},
    bossDefeat:{color:"#e6f9ff",r:48,duration:.46,particles:14,shake:3.2,hold:.14}
  };

  const messages={
    tired:{title:"NOT ENOUGH STAMINA",priority:1,seconds:.74},
    recharging:{title:"SKILL ON COOLDOWN",priority:1,seconds:.72},
    block:{title:"BLOCKED",priority:1,seconds:.44},
    dodge:{title:"PERFECT DODGE",priority:2,seconds:.56},
    posture:{title:"STAGGERED",priority:3,seconds:.70},
    perfect:{title:"PERFECT PARRY",priority:4,seconds:.58}
  };

  class Particles {
    constructor(size=84) {
      this.active=[];
      this.free=Array.from({length:size},()=>({}));
      this.seen=new WeakSet();
    }
    reset() {
      while(this.active.length) this.free.push(this.active.pop());
      this.seen=new WeakSet();
    }
    consume(fx,time,quality) {
      const profile=profiles[fx.category];
      if(!profile||this.seen.has(fx)) return;
      this.seen.add(fx);
      const ratio=quality==="low"?.25:quality==="medium"?.65:1;
      const count=Math.min(this.free.length,Math.ceil(profile.particles*ratio));
      const start=time-fx.age;
      for(let i=0;i<count;i++) {
        const part=this.free.pop(), heading=(fx.dir??0)+(i/count)*Math.PI*2;
        part.x=fx.x;part.y=fx.y;
        part.vx=Math.cos(heading)*(48+i%3*26);part.vy=Math.sin(heading)*(44+i%5*12);
        part.start=start;part.duration=fx.duration+i%3*.015;
        part.color=fx.color??profile.color;part.size=i%3===0?3:2;
        this.active.push(part);
      }
    }
    expire(time) {
      for(let i=this.active.length-1;i>=0;i--) {
        const part=this.active[i];
        if(time-part.start<part.duration) continue;
        this.free.push(part);
        this.active[i]=this.active.at(-1);
        this.active.pop();
      }
    }
  }

  function impulse(effects,settings) {
    if(!settings.shake||settings.reduced) return 0;
    let shift=0,strength=0;
    for(const fx of effects) {
      const item=profiles[fx.category];
      if(!item?.shake||fx.age>=item.hold) continue;
      const amount=item.shake*(1-fx.age/item.hold);
      if(amount>strength) {strength=amount;shift=amount*Math.sin((fx.age+.007)*108);}
    }
    return Math.max(-4,Math.min(4,shift));
  }

  globalThis.FrostFeedback={profiles,messages,Particles,impulse};
})();
