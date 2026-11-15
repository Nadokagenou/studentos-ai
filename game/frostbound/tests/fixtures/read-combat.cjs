function readCombat(root) {
  for(const name of ["items","loot","build","world","events","enemy-ai","mutations","boss-ai","mini-bosses",
    "environment","regions","combat"]) require(require("node:path").join(root,name));
  const {Run,STEP}=FrostCombat;
  const stable=["windup","active","recovery","damage","posture","range","cone","cost","parry","shape","width","speed","count","reach","followUp"];
  const attack=data=>Object.fromEntries(stable.filter(key=>data[key]!==undefined).map(key=>[key,data[key]]));
  const weapons={};
  function contact(family,type,combo) {
    const room=new Run("story",4212,family);
    room.pending=[];
    room.room.pillars=[];
    room.addEnemy("soldier",room.player.x+42,room.player.y,0);
    const foe=room.enemies[0];
    Object.assign(foe,{state:"chase",frozenUntil:50});
    room.player.combo=combo-1;
    room.player.comboUntil=1;
    room.request(type,{x:0,y:0,aim:0});
    const spent=100-room.player.stamina;
    let hitStep=0;
    for(let step=1;step<120&&!hitStep;step++) {
      room.tick({x:0,y:0,aim:0});
      if(foe.hp<foe.maxHp) hitStep=step;
    }
    return {damage:foe.maxHp-foe.hp,posture:foe.posture,spent,hitStep};
  }
  for(const id of ["edge","fang","spear","great","ash","moon"]) {
    const data=FrostItems.ITEMS[id];
    const run=new Run("training",4212,id);
    run.enemies=[];
    run.request("dash",{x:1,y:0,aim:0});
    const dash=run.player.action.duration;
    const distance=run.player.x;
    for(let i=0;i<60;i++) run.tick({x:0,y:0});
    const lands=(action,age)=>{
      const r=new Run("training",4212,id);
      Object.assign(r.player,{action:{type:action,age,used:false,refunded:false}});
      r.receiveHit({damage:10,parry:true},null,{x:435,y:355});
      return {parried:r.stats.parries,damage:r.stats.damage,stop:r.parryStop};
    };
    const parry=data.parry??.14;
    run.request("parry",{x:0,y:0,aim:0});
    weapons[id]={light:data.light.map(attack),heavy:attack(data.heavy),dashCost:data.dashCost??25,dash,
      dashDistance:run.player.x-distance,dodgeEnd:lands("dash",.16),dodgeAfter:lands("dash",.16001),parry,
      parryRecovery:run.player.action.duration,parryEnd:lands("parry",parry),parryAfter:lands("parry",parry+.00001),
      contact:{light:data.light.map((_,i)=>contact(id,"light",i)),heavy:contact(id,"heavy",0)}};
  }
  const ids=[...new Set([...Object.keys(FrostEnemyAI.attacks),...Object.keys(FrostBossAI.attacks),
    ...Object.keys(FrostMiniBosses.attacks),"wolf","elite","frost","debris","slash","thrust","shock","combo","comboEnd","collapse","dummy"])];
  const enemies=Object.fromEntries(["story","hardcore","boss"].map(mode=>{
    const run=new Run(mode,4212);
    run.addEnemy("king",450,280,0);
    const result={};
    for(const id of ids) {run.startAttack(run.boss,id,0);result[id]=attack(run.boss.attack.data);}
    return [mode,result];
  }));
  const actives=Object.fromEntries(Object.entries(FrostLoot.ACTIVES).map(([id,skill])=>[id,[skill.cooldown,skill.cost,skill.charge]]));
  return {step:STEP,weapons,enemies,actives};
}
module.exports=readCombat;
