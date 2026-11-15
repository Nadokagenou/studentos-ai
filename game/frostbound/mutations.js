(() => {
  "use strict";
  const definitions={
    swift:{name:"Swift",icon:"»",color:"#fff1ae",detail:"Faster movement and shorter tells."},
    armored:{name:"Armored",icon:"◆",color:"#c0cbda",detail:"More Posture, slower movement."},
    frostborn:{name:"Frostborn",icon:"✧",color:"#a1e8ff",detail:"Adds 12 Frost buildup to eligible hits."},
    regenerative:{name:"Regenerative",icon:"+",color:"#98e4b5",detail:"Heals periodically unless staggered."},
    vengeful:{name:"Vengeful",icon:"!",color:"#ffb49c",detail:"A parry empowers its next attack."},
    unstable:{name:"Unstable",icon:"◇",color:"#e0aeff",detail:"Leaves a marked crystal hazard when defeated."}
  };
  const ids=Object.keys(definitions);
  function pick(rng) {return ids[Math.floor(rng()*ids.length)];}
  function prepare(enemy,id,time) {
    if(!id) return;
    enemy.mutation=id;
    enemy.hp=enemy.maxHp=Math.ceil(enemy.maxHp*1.35);
    if(id==="swift") enemy.speed*=1.18;
    if(id==="armored") {
      enemy.speed*=.90;
      enemy.posture=0;
      enemy.maxPosture=Math.round(enemy.maxPosture*1.30);
    }
    enemy.regenAt=time+5;
    enemy.regenerated=0;
  }
  function empower(enemy,data) {
    if(!enemy.mutation) return;
    data.damage*=1.12;
    if(enemy.mutation==="swift") data.windup=Math.max(.35,data.windup*.90);
    if(enemy.mutation==="frostborn") data.extraFrost=12;
    if(enemy.vengeful) {
      enemy.vengeful=false;
      data.damage*=1.10;
    }
  }
  function regenerate(enemy,time) {
    if(enemy.mutation!=="regenerative"||time<enemy.regenAt) return;
    enemy.regenAt=time+5;
    if(["stagger","spawn","dead"].includes(enemy.state)||enemy.frozenUntil>time) return;
    const amount=Math.min(enemy.maxHp*.02,enemy.maxHp*.20-enemy.regenerated,enemy.maxHp-enemy.hp);
    enemy.hp+=Math.max(0,amount);
    enemy.regenerated+=Math.max(0,amount);
  }
  const crystal={name:"Unstable crystal",windup:1,active:2,damage:12,range:45,shape:"spots",parry:false};
  function onDeath(run,enemy) {
    if(enemy.mutation!=="unstable") return;
    const spot={x:enemy.x,y:enemy.y};
    run.mutationHazards.push({state:"windup",attack:{data:crystal,age:0,hit:false,spots:[spot]}});
  }
  globalThis.FrostMutations={definitions,pick,prepare,empower,regenerate,onDeath};
})();
