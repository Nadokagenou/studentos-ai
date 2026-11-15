function controller(run) {
  const {angle,distance,GATE}=FrostCombat;
  const PILLARS=run.room.pillars;
  const p=run.player;
  const input={x:0,y:0,aim:null,action:null};
  const foes=run.enemies.filter(e=>!['dead','spawn','transition'].includes(e.state));
  const target=foes.sort((a,b)=>(distance(a,p)-(a.type==='archer'?90:0))-(distance(b,p)-(b.type==='archer'?90:0)))[0];
  if (run.gateOpen) {
    const dir=angle(p,GATE);
    return {...input,x:Math.cos(dir),y:Math.sin(dir),aim:dir};
  }
  if(!target) return input;
  const d=distance(target,p);
  const aim=angle(p,target);
  input.aim=aim;
  const move = direction => {input.x=Math.cos(direction);input.y=Math.sin(direction);};
  if(d>65){
    const blocked=PILLARS.find(([x,y,r])=> distance(p,{x,y})<r+53 && Math.abs(Math.atan2(Math.sin(angle(p,{x,y})-aim),Math.cos(angle(p,{x,y})-aim)))<.72);
    if(blocked) {
      const toward=angle(p,{x:blocked[0],y:blocked[1]});
      move(toward+(Math.sin(aim-toward)<0?-1:1)*1.34);
    } else move(aim);
  }
  const attacks=foes.filter(e=>e.attack && ['windup','active'].includes(e.state));
  if(run.hazard) attacks.push(run.hazard);
  const incoming=attacks.find(e=>!['wave','arrow'].includes(e.attack.data.shape) && e.attack.age>=e.attack.data.windup-.115 && !e.attack.hit && run.inDanger(e.attack.data,e.attack.origin,e.attack.spots));
  const arrow=run.shots.find(s=>s.attack.shape!=="wave" && distance(s,p)<48 && Math.abs(Math.atan2(Math.sin(angle(s,p)-s.dir),Math.cos(angle(s,p)-s.dir)))<.42);
  const zone=attacks.find(e=>!e.attack.data.parry && run.inDanger(e.attack.data,e.attack.origin,e.attack.spots));
  const canCancel=!p.action || p.action.type==='light' && p.action.age>=p.action.attack.windup+p.action.attack.active || p.action.duration-p.action.age<.095;
  const wave=run.shots.find(s=>s.attack.shape==="wave" && Math.abs(FrostBossAI.wavePoint(s,p).forward)<80 && Math.abs(FrostBossAI.wavePoint(s,p).across)<s.attack.width+4);
  if(wave) {
    const offset=FrostBossAI.wavePoint(wave,p).across;
    move(wave.dir+(offset<0?-1:1)*Math.PI/2);
    if(Math.abs(FrostBossAI.wavePoint(wave,p).forward)<49 && canCancel) input.action="dash";
  } else if(!p.action && run.inventory.potion==='flask' && p.hp<=55 && (!target.attack || target.state==='recover' || target.state==='defend') && !incoming && !arrow && !zone) {
    input.action='potion';
  } else if(zone){

    const {data,origin,spots}=zone.attack;
    const foesTooClose=q=>foes.some(e=>distance(e,q)<e.radius+20);
    const danger=q=>{
      if(data.zone) return q.x>=data.zone.x&&q.x<=data.zone.x+data.zone.width;
      if(spots) return spots.some(s=>distance(s,q)<data.range+12);
      if(data.shape==="wave"){const offset=FrostBossAI.wavePoint(origin,q);return offset.forward>0&&offset.forward<data.range&&Math.abs(offset.across)<data.width+10;}
      if(distance(origin,q)>data.range+12) return false;
      if(data.shape==="ring") return true;
      return Math.abs(Math.atan2(Math.sin(angle(origin,q)-origin.dir),Math.cos(angle(origin,q)-origin.dir)))<data.cone+.12;
    };
    const choices=[];
    for(let i=0;i<24;i++) {
      const dir=i*Math.PI/12;
      let score=0;
      for(const d of [28,56,84,112,140,176]) {
        const q={x:p.x+Math.cos(dir)*d,y:p.y+Math.sin(dir)*d};
        if(q.x<79||q.x>880||q.y<126||q.y>523||PILLARS.some(([x,y,r])=>distance({x,y},q)<r+15)) break;
        score+=danger(q)?1:8;
        if(foesTooClose(q))score-=3;
      }
      choices.push({dir,score});
    }
    choices.sort((a,b)=>b.score-a.score);
    move(choices[0].dir);
    if(zone.attack.age>data.windup-.39&&canCancel&&p.stamina>=25) input.action='dash';
  } else if(incoming||arrow){
    if(canCancel) input.action='parry';
    if(arrow) move(arrow.dir + Math.PI/2);
    else if(!canCancel) move(aim+Math.PI);
  } else if(!p.action && d<88 && target.state!=="defend") {
    const fromTarget=attacks.find(e=>e===target);
    const others=attacks.some(e=>e!==target);
    const early=target.state==='recover' && target.attack && target.attack.age<target.attack.data.windup+target.attack.data.active+.20;
    if((early || target.state==='stagger' || target.type==='archer') && !others && p.stamina>38 && (target.type!=='archer'|| d<70) && !fromTarget) input.action='heavy';
    else if((!fromTarget||target.type==='archer'|| fromTarget.attack.age < fromTarget.attack.data.windup-.34) && (!run.shots.some(s=>distance(s,p)<100))) input.action='light';
  }
  return input;
}
module.exports=controller;
