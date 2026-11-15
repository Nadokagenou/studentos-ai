(() => {
  "use strict";
  const fighter=(name,hp,speed,posture,radius,detect,preferred,threat)=>({name,hp,speed,posture,radius,detect,preferred,threat});
  const profiles={
    stalker:fighter("Frost Stalker",65,145,40,13,260,40,2),
    soldier:fighter("Broken Soldier",90,100,65,14,265,58,2),
    archer:fighter("Glacial Archer",55,90,35,12,380,220,3),
    wisp:fighter("Crystal Wisp",48,125,30,11,350,145,3),
    sentinel:fighter("Frost Sentinel",165,75,120,17,260,60,5),
    hunter:fighter("Hollowpine Hunter",75,125,50,13,360,150,3),
    burrower:fighter("Crystal Burrower",110,85,70,17,325,135,4),
    remnant:fighter("Royal Remnant",130,115,90,17,320,74,5)
  };
  const attack=(name,windup,active,recovery,damage,range,cone,more={})=>
    ({name,windup,active,recovery,damage,range,cone,parry:true,...more});
  const arrow=(name,windup,recovery,damage,range,speed,more={})=>
    attack(name,windup,.14,recovery,damage,range,.055,{shape:"arrow",speed,...more});
  const attacks={
    stalker:attack("Claw Strike",.45,.16,.55,14,57,.74),
    leap:attack("Leaping Strike",.75,.20,.80,19,120,.29),
    soldier:attack("Basic Slash",.55,.16,.65,17,76,.85),
    heavySlash:attack("Heavy Slash",.90,.20,1,25,94,1.02,{retreat:true}),
    archer:arrow("Frost Arrow",.75,.75,13,280,260,{frost:true}),
    doubleArrow:arrow("Double Arrow",1,1.20,10,280,260,{followUp:"secondArrow"}),
    secondArrow:arrow("Second Arrow",.40,1.20,10,280,260),
    wisp:arrow("Frost Bolt",.60,.72,10,245,220,{frost:true}),
    pulse:attack("Crystal Pulse",.80,.20,.90,12,85,0,{shape:"ring",parry:false}),
    sentinel:attack("Shield Bash",.65,.17,.85,20,79,.7),
    royalCleave:attack("Royal Cleave",1.05,.22,1.20,30,103,1),
    hunter:arrow("Hunting Arrow",.70,.70,14,265,265),
    huntingKnife:attack("Knife Strike",.40,.15,.60,15,66,.75),
    spike:attack("Crystal Spike",1,.20,1.10,18,50,0,{shape:"spots",count:1,reach:216,parry:false}),
    burrower:attack("Burrow Charge",1.15,.23,1.30,24,157,.27,{parry:false}),
    remnant:attack("Royal Combo · I",.65,.16,.96,12,96,.75,{followUp:"remnantTwo"}),
    remnantTwo:attack("Royal Combo · II",.49,.16,.96,12,99,.85,{followUp:"remnantThree"}),
    remnantThree:attack("Royal Combo · III",.58,.21,.96,20,106,1.03),
    remnantCounter:attack("Royal Counter",.42,.17,.95,18,94,.72)
  };
  const encounters={
    melee:["stalker","stalker","soldier"],ranged:["archer","stalker","stalker"],defensive:["sentinel","archer"],
    hunt:["hunter","stalker","soldier"],ambush:["wisp","wisp","burrower"],guard:["remnant","soldier","soldier"],
    garrison:["remnant","sentinel","soldier"],throne:["remnant","sentinel","archer"],duel:["elite"]
  };
  const budgets=[[4,7],[6,9],[8,11],[10,14],[12,16]];
  const choices=[["melee","ranged"],["melee","hunt","defensive"],["defensive","ambush","guard"],["ambush","garrison"],["throne","garrison"]];
  const threats={...Object.fromEntries(Object.entries(profiles).map(([id,p])=>[id,p.threat])),elite:8,wolf:2};
  function group(stage,rng,elite=false) {
    const pool=choices[stage-1];
    const normal=encounters[pool[Math.floor(rng()*pool.length)]].slice();
    if(!elite) return normal;
    if(stage<=2) return encounters.duel.slice();
    const patrol=["elite"];
    for(const type of normal.slice(1))
      if(patrol.reduce((sum,id)=>sum+threats[id],0)+threats[type]<=budgets[stage-1][1]*1.25) patrol.push(type);
    return patrol;
  }
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const heading=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
  const turn=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  const validPoint=point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y);
  function clearSight(a,b,pillars) {
    if(!validPoint(a)||!validPoint(b)) return false;
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    if(!length) return true;
    return pillars.every(([x,y,radius])=>{
      const t=Math.min(1,Math.max(0,((x-a.x)*dx+(y-a.y)*dy)/length));
      return Math.hypot(a.x+dx*t-x,a.y+dy*t-y)>=radius;
    });
  }
  const isArea=attack=>["ring","spots","sector","wave"].includes(attack.shape);
  function spaceFor(run,data) {
    const group=isArea(data)?"area":data.shape==="arrow"?"ranged":"melee";
    const reservations=run.attackBegins.filter(begin=>run.time-begin.time<.5);
    const limit=group==="area"?1:group==="melee"?2:1;
    return reservations.filter(begin=>begin.group===group).length<limit;
  }
  function reserve(run,data) {
    run.attackBegins=run.attackBegins.filter(begin=>run.time-begin.time<.5);
    run.attackBegins.push({time:run.time,group:isArea(data)?"area":data.shape==="arrow"?"ranged":"melee"});
  }
  function choose(enemy,distance,rng) {
    const id=enemy.type==="elite"?"remnant":enemy.type;
    switch(id) {
      case "stalker":return distance>68&&enemy.lastAttack!=="leap"?"leap":"stalker";
      case "soldier":return enemy.nearFor>.65&&enemy.lastAttack!=="heavySlash"&&rng()<.43?"heavySlash":"soldier";
      case "archer":return distance>170&&enemy.lastAttack!=="doubleArrow"&&rng()<.34?"doubleArrow":"archer";
      case "wisp":return distance<84?"pulse":"wisp";
      case "sentinel":return enemy.lastAttack==="sentinel"&&rng()<.68?"royalCleave":"sentinel";
      case "hunter":return distance<74?"huntingKnife":"hunter";
      case "burrower":return distance<151&&enemy.lastAttack!=="burrower"?"burrower":"spike";
      default:return "remnant";
    }
  }
  function decision(run,enemy,target,allAttacks) {
    const {pillars}=run.room, rng=run.enemyRandom;
    const type=enemy.type==="elite"?"remnant":enemy.type;
    const settings=profiles[type];
    const validTarget=validPoint(target);
    const length=validTarget?distance(enemy,target):Infinity;
    const toward=validTarget?heading(enemy,target):enemy.dir;
    const visible=length<=settings.detect&&clearSight(enemy,target,pillars)&&
      (enemy.memory>run.time||length<=135||Math.abs(turn(toward,enemy.dir))<=2.28);
    if(visible) {
      enemy.lastSeen={x:target.x,y:target.y};
      enemy.memory=run.time+2.8;
      enemy.nearFor=length<85?enemy.nearFor+enemy.decisionInterval:0;
    }
    if(enemy.defendUntil>run.time) return;
    if(!visible) {
      if(!enemy.lastSeen&&length<175&&target.moving) {
        enemy.lastSeen={x:target.x,y:target.y};
        enemy.memory=run.time+1.4;
      }
      if(validPoint(enemy.lastSeen)&&enemy.memory>run.time&&distance(enemy,enemy.lastSeen)>20) {
        enemy.state="investigate";
        enemy.moveDir=heading(enemy,enemy.lastSeen);
        return;
      }
      enemy.lastSeen=null;
      enemy.memory=0;
      const patrol=run.room.spawns?.[enemy.patrol];
      if(validPoint(patrol)&&distance(enemy,patrol)>24) {
        enemy.state="patrol";
        enemy.moveDir=heading(enemy,patrol);
      } else {
        enemy.patrol=(enemy.patrol+1)%(run.room.spawns?.length||1);
        enemy.state="idle";
        enemy.moveDir=null;
      }
      return;
    }
    enemy.dir=toward;
    const id=choose(enemy,length,rng), data=allAttacks[id];
    const reach=data.reach??data.range;
    const limit=enemy.type==="elite"?0.14:0.2;
    if(type==="remnant"&&enemy.cooldown<=0&&length<87&&length>44&&run.time>=enemy.nextDefend&&rng()<limit) {
      enemy.state="defend";
      enemy.moveDir=null;
      enemy.defendUntil=run.time+.8;
      enemy.nextDefend=run.time+6;
      return;
    }
    if(enemy.cooldown<=0&&length<=reach&&spaceFor(run,data)) {
      run.startAttack(enemy,id,toward,target);
      return;
    }
    if(enemy.retreatUntil>run.time||(settings.preferred>=120&&length<settings.preferred*.72)) {
      enemy.state="position";
      enemy.moveDir=toward+Math.PI;
    } else if(length>settings.preferred) {
      enemy.state="chase";
      enemy.moveDir=toward;
    } else if(type==="wisp"||enemy.cooldown<=0) {
      enemy.state="position";
      enemy.moveDir=toward+enemy.flank*Math.PI*.51;
    } else {
      enemy.state="position";
      enemy.moveDir=null;
    }
  }
  globalThis.FrostEnemyAI={profiles,attacks,group,budgets,threats,clearSight,spaceFor,reserve,decision,validPoint};
})();
