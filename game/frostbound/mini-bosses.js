(() => {
  "use strict";
  const fighters={
    hollow:{name:"The Hollow Warden",mini:true,hp:420,posture:160,radius:21,speed:132,range:144},
    heart:{name:"Crystal Heart",mini:true,hp:500,posture:180,radius:25,speed:71,range:275}
  };
  const attacks={
    hollowCleave:{name:"Warden’s Riposte",windup:.56,active:.18,recovery:.79,damage:18,range:94,cone:1.05,parry:true},
    hollowLunge:{name:"Hollow Lunge",windup:.76,active:.22,recovery:1,damage:23,range:144,cone:.40,parry:true,trail:true},
    heartBolt:{name:"Prism Bolt",windup:.67,active:.18,recovery:.83,damage:19,range:275,cone:.08,parry:true,shape:"arrow",frost:true,speed:240},
    heartFault:{name:"Shattering Fault",windup:1.08,active:.30,recovery:1.12,damage:22,range:52,reach:225,count:1,
      shape:"spots",parry:false,frost:true,barrier:true}
  };
  const trail={name:"Hollow frost trail",windup:.84,active:1.15,damage:12,range:31,shape:"spots",parry:false,frost:true};
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function choose(boss,length) {
    if(boss.type==="hollow") return length>=83&&boss.lastAttack!=="hollowLunge"?"hollowLunge":"hollowCleave";
    return length<=225&&boss.lastAttack!=="heartFault"?"heartFault":"heartBolt";
  }
  function leaveTrail(run,attack,bounds) {
    const {origin}=attack;
    const spots=[37,81,119].map(d=>({x:origin.x+Math.cos(origin.dir)*d,y:origin.y+Math.sin(origin.dir)*d}))
      .filter(p=>p.x>bounds.left+22&&p.x<bounds.right-22&&p.y>bounds.top+22&&p.y<bounds.bottom-22);
    if(spots.length) run.mutationHazards.push({state:"windup",attack:{data:trail,spots,age:0,hit:false}});
  }
  function raiseBarrier(run,enemy,point,bounds) {
    const radius=24;
    for(const dx of [76,-76,110,-110]) {
      const x=point.x+dx,y=point.y+31;
      if(x<bounds.left+radius+25||x>bounds.right-radius-25||y>bounds.bottom-radius-25||
        distance({x,y},run.player)<radius+42||distance({x,y},enemy)<radius+enemy.radius+12||
        run.room.pillars.some(([px,py,pr])=>Math.hypot(px-x,py-y)<pr+radius+30)) continue;
      run.crystalWall={pillar:[x,y,radius],until:run.time+4.5};
      return;
    }
  }
  globalThis.FrostMiniBosses={fighters,attacks,choose,leaveTrail,raiseBarrier};
})();
