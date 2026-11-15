(() => {
  "use strict";
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const TAU=Math.PI*2;
  const attacks=new Set(["light","heavy","skill"]);
  const moves=new Set(["chase","patrol","position","investigate"]);
  const enemyAttacks=new Set(["windup","active","recover"]);

  function phase(age,windup,active,recovery) {
    if(age<windup) return ["startup",clamp(age/Math.max(windup,.001))];
    if(age<windup+active) return ["active",clamp((age-windup)/Math.max(active,.001))];
    return ["recovery",clamp((age-windup-active)/Math.max(recovery,.001))];
  }

  function state(fighter,time,pace=0) {
    const action=fighter.action;
    if(fighter.dead!==undefined&&(!fighter.type||fighter.state==="dead")) return "death";
    if(fighter.state==="stagger") return "stagger";
    if(fighter.state==="transition") return "transition";
    if(fighter.state==="spawn") return "spawn";
    if(fighter.frozenUntil>time) return "frozen";
    if(action&&attacks.has(action.type)) return action.type;
    if(action?.type==="parry") return action.used?"perfect":"parry";
    if(action?.type==="dash") return "dash";
    if(action?.type==="hurt") return "hurt";
    if(action?.type==="potion") return "potion";
    if(fighter.attack&&enemyAttacks.has(fighter.state)) return "enemy-attack";
    if(fighter.state==="defend") return "defend";
    if(fighter.moving||moves.has(fighter.state)&&pace>4) return pace>=135?"run":"walk";
    return "idle";
  }

  function sample(fighter,time,track,motion=true) {
    const action=fighter.action;
    const dt=time-track.time;
    if(dt>0) {
      const dx=fighter.x-track.x,dy=fighter.y-track.y;
      const traveled=Math.hypot(dx,dy);
      const speed=traveled<60?traveled/dt:0;
      if(traveled>.03) track.heading=Math.atan2(dy,dx);
      track.speed+= (speed-track.speed)*clamp(dt*17,.08,1);
      track.stride=(track.stride+Math.min(traveled,40)*TAU/62)%TAU;
      track.x=fighter.x;track.y=fighter.y;track.time=time;
    }
    const visual=state(fighter,time,track.speed);
    const moving=visual==="walk"||visual==="run";
    const amplitude=moving?clamp(track.speed/165,.28,1.22):0;
    if(fighter.type&&fighter.lastSeen&&fighter.memory>time&&track.state&&
      ["idle","walk"].includes(track.state)&&fighter.state==="chase"&&!track.sawPlayer&&!(track.spottedUntil>time))
      track.spottedUntil=time+.19;
    if(!fighter.lastSeen&&fighter.type) track.sawPlayer=false;
    track.spotted=Boolean(track.spottedUntil>time&&!track.sawPlayer);
    if(track.spottedUntil&&track.spottedUntil<=time) {
      track.sawPlayer=true;
      track.spottedUntil=0;
    }
    track.state=visual;
    track.step=motion?Math.sin(track.stride)*4*amplitude:0;
    track.bob=motion?(moving?-Math.abs(track.step)*.43:Math.sin(time*TAU/1.6)*.68):0;
    track.facing=fighter.dir;
    track.phase=null;
    track.progress=0;
    const enemyAttack=visual==="enemy-attack"?fighter.attack:null;
    const timing=action?.attack??enemyAttack?.data;
    if(timing&&(visual==="light"||visual==="heavy"||enemyAttack)) {
      const recovery=action?.attack?Math.max(timing.recovery,action.duration-timing.windup-timing.active):timing.recovery;
      [track.phase,track.progress]=phase(enemyAttack?.age??action.age,timing.windup,timing.active,recovery);
    } else if(action) track.progress=clamp(action.age/action.duration);
    return track;
  }

  const makeTrack=(fighter,time)=>({x:fighter.x,y:fighter.y,time,heading:fighter.dir,speed:0,stride:0});
  class Scene {
    constructor() { this.reset(); }
    reset() { this.actors=new WeakMap(); }
    pose(fighter,time,motion=true) {
      let track=this.actors.get(fighter);
      if(!track) { track=makeTrack(fighter,time);this.actors.set(fighter,track); }
      return sample(fighter,time,track,motion);
    }
  }

  globalThis.FrostAnimation={Scene,phase,state,clamp,preview:(fighter,time,motion)=>sample(fighter,time,makeTrack(fighter,time),motion)};
})();
