(() => {
  "use strict";
  const HAZARDS={
    ice:{name:"Cracked ice",note:"Marked ice breaks after you stand on it."},
    whiteout:{name:"Whiteout",note:"Wind warns of a six-second storm. Attack warnings stay visible."},
    resonance:{name:"Crystal resonance",note:"Marked crystals briefly pulse after a warning glow."},
    bell:{name:"Frozen bell",note:"The bell hastens royal guards. Silence it when the arena is clear."},
    frost:{name:"Frost fissures",note:"Step away from the circles before the ice erupts."}
  };
  const byRegion=["ice","whiteout","resonance","bell","frost"];
  const ice={name:"Cracked ice",windup:.70,active:3,damage:12,range:43,shape:"spots",parry:false};
  const pulse={name:"Crystal resonance",windup:1.20,active:.35,damage:16,range:55,shape:"spots",parry:false};
  const preferred={ice:[[219,330],[730,363],[258,430]],resonance:[[175,327],[799,329],[260,366],[705,236]],bell:[[785,323],[815,388],[735,258]]};
  const guard=new Set(["soldier","sentinel","hunter","remnant","elite"]);
  function create(room) {
    const id=room.hazard;
    if(!HAZARDS[id]) return null;
    const points=(preferred[id]??[]).filter(([x,y])=>room.pillars.every(([px,py,r])=>Math.hypot(px-x,py-y)>r+34))
      .map(([x,y])=>({x,y}));
    return {id,points,time:0,next:id==="bell"?18:5,warned:false,occupancy:0,whiteout:"clear"};
  }
  function zone(run,data,spot) {
    run.hazard={state:"windup",attack:{data,spots:[spot],age:0,hit:false}};
    run.emit("environment",{id:run.environment.id});
    FrostEnemyAI.reserve(run,data);
  }
  function tick(run,dt) {
    const state=run.environment;
    if(!state||state.id==="frost") return;
    if(run.gateOpen) {
      state.whiteout="clear";
      state.hasteUntil=0;
      return;
    }
    state.time+=dt;
    const danger=run.room.path==="danger";
    if(state.id==="whiteout") {
      const cycle=danger?17:20, clear=danger?9:12;
      const time=state.time%cycle, next=time<clear?"clear":time<clear+2?"warning":"active";
      if(next==="warning"&&state.whiteout!==next) run.emit("environment",{id:"whiteout"});
      state.whiteout=next;
    } else if(state.id==="bell") {
      if(!run.bellSilenced&&state.time>=state.next&&run.remaining) {
        state.next=state.time+(danger?14:18);
        state.hasteUntil=state.time+6;
        run.emit("environment",{id:"bell"});
      }
    } else if(state.id==="ice"&&!run.hazard&&run.remaining) {
      const spot=state.points.find(p=>Math.hypot(p.x-run.player.x,p.y-run.player.y)<36);
      state.occupancy=spot?state.occupancy+dt:0;
      if(state.occupancy>=.8&&spot&&FrostEnemyAI.spaceFor(run,ice)) {
        zone(run,ice,spot);
        state.occupancy=0;
      }
    } else if(state.id==="resonance"&&!run.hazard&&run.remaining&&state.time>=state.next&&state.points.length&&FrostEnemyAI.spaceFor(run,pulse)) {
      const spot=state.points[state.pointIndex??0];
      zone(run,pulse,spot);
      state.pointIndex=((state.pointIndex??0)+1)%state.points.length;
      state.next=state.time+(danger?3.9:5);
    }
  }
  function speed(run,enemy) {
    const state=run.environment;
    return state?.id==="bell"&&!run.bellSilenced&&state.hasteUntil>state.time&&guard.has(enemy.type)?1.10:1;
  }
  function bellNearby(run) {
    if(run.environment?.id!=="bell"||!run.gateOpen||run.bellSilenced) return false;
    return run.environment.points.some(p=>Math.hypot(p.x-run.player.x,p.y-run.player.y)<58);
  }
  globalThis.FrostEnvironment={HAZARDS,byRegion,create,tick,speed,bellNearby};
})();
