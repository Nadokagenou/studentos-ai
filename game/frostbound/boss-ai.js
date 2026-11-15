(() => {
  "use strict";
  const sword=(name,windup,active,recovery,damage,range,cone,more={})=>
    ({name,windup,active,recovery,damage,range,cone,parry:true,...more});
  const attacks={
    kingSlash:sword("Royal Slash",.60,.20,.80,22,133,1.08),
    kingThrust:sword("Frozen Thrust",.75,.18,.95,26,189,.26),
    kingSweep:sword("King’s Sweep",.90,.25,1.10,24,148,1.47,{parry:false}),
    kingPillars:sword("Ice Pillars",1.10,.30,1.15,18,39,0,{shape:"spots",count:4,reach:315,parry:false,frost:true}),
    kingWave:sword("Frozen Wave",1,.18,1.05,20,330,0,{shape:"wave",speed:240,width:58,parry:false,frost:true}),
    kingCombo:sword("Royal Combination · I of III",.70,.15,1.25,14,135,1.02,{followUp:"kingComboTwo"}),
    kingComboTwo:sword("Royal Combination · II of III",.51,.16,1.25,14,140,1.12,{followUp:"kingComboThree"}),
    kingComboThree:sword("Royal Combination · III of III",.68,.23,1.25,24,150,1.20),
    kingCollapse:sword("Winter Collapse",1.35,.32,1.28,32,370,0,{shape:"sector",parry:false,frost:true}),
    kingJudgment:sword("King’s Final Judgment",1.20,.25,1.50,38,165,.82,{parry:false}),
    kingCounter:sword("Frostbound Reversal",.55,.18,1.12,24,122,1.02)
  };
  const phases=[
    [["kingSlash",40,1.2],["kingThrust",28,1.4],["kingSweep",20,3.5]],
    [["kingPillars",27,7],["kingWave",25,5.5],["kingCombo",35,3.2]],
    [["kingCollapse",26,8],["kingJudgment",37,4.8],["reversal",25,6],["kingCombo",18,3.4],["kingWave",13,6]]
  ];
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function choose(run,boss,length) {
    if(!Number.isFinite(length)) return;
    const patterns=phases[boss.phase-1];
    const eligible=patterns.filter(([id])=>{
      const data=attacks[id];
      const reach=id==="reversal"?119:data.reach??data.range;
      if(length>reach||(boss.patternCooldowns[id]??0)>run.time) return false;
      if(id==="kingWave"&&length<101) return false;
      if(id==="kingCollapse"||id==="kingPillars"||id==="kingWave") {
        if(run.hazard||run.mutationHazards.length||run.shots.some(shot=>shot.attack.shape==="wave")) return false;
        if(!FrostEnemyAI.spaceFor(run,data)) return false;
      }
      return true;
    });
    const alternatives=eligible.filter(([id])=>id!==boss.lastPattern);
    const repeat=boss.patternRepeats??0;
    const source=repeat>=2?alternatives:eligible;
    const options=source.map(([id,weight,cooldown])=>{
      let factor=id===boss.lastPattern?.29:1;
      if(id==="kingSlash"&&length<95) factor*=1.25;
      if(id==="kingThrust"&&length>132) factor*=1.38;
      if(id==="kingPillars"&&(run.player.x<180||run.player.x>780)) factor*=.55;
      if(id==="kingCombo"&&length<104) factor*=1.30;
      return {id,weight:weight*factor,cooldown};
    });
    const reposition=options.length?13:0;
    let roll=run.bossRandom()*(reposition+options.reduce((sum,option)=>sum+option.weight,0));
    return options.find(option=>(roll-=option.weight)<0);
  }
  function decide(run,boss) {
    const player=run.player, length=distance(boss,player);
    const visible=FrostEnemyAI.clearSight(boss,player,run.room.pillars);
    if(boss.cooldown>0||!visible) return;
    const pattern=choose(run,boss,length);
    if(!pattern) return;
    boss.patternRepeats=pattern.id===boss.lastPattern?(boss.patternRepeats??0)+1:1;
    boss.lastPattern=pattern.id;
    boss.patternCooldowns[pattern.id]=run.time+pattern.cooldown;
    if(pattern.id==="reversal") {
      boss.state="defend";
      boss.defendUntil=run.time+1;
      run.emit("tell",{heavy:false,boss:true});
    } else run.startAttack(boss,pattern.id);
  }
  function pillarSpots(player,bounds,pillars) {
    const offsets=[[0,0],[-143,67],[143,-67],[0,146],[0,-146]];
    const spots=[];
    for(const [dx,dy] of offsets) {
      const x=Math.min(bounds.right-43,Math.max(bounds.left+43,player.x+dx));
      const y=Math.min(bounds.bottom-43,Math.max(bounds.top+43,player.y+dy));
      const point={x,y};
      if(pillars.some(([cx,cy,r])=>distance(point,{x:cx,y:cy})<r+38)||
        spots.some(spot=>distance(point,spot)<112)) continue;
      spots.push(point);
      if(spots.length===4) break;
    }
    return spots.length?spots:[{x:player.x,y:player.y}];
  }
  function collapseZone(player,bounds) {
    const width=260;
    const x=Math.max(bounds.left,Math.min(bounds.right-width,player.x-width/2));
    return {x,y:bounds.top,width,height:bounds.bottom-bounds.top};
  }
  function wavePoint(origin,point) {
    const dx=point.x-origin.x,dy=point.y-origin.y;
    return {forward:dx*Math.cos(origin.dir)+dy*Math.sin(origin.dir),across:-dx*Math.sin(origin.dir)+dy*Math.cos(origin.dir)};
  }
  globalThis.FrostBossAI={attacks,choose,decide,pillarSpots,collapseZone,wavePoint};
})();
