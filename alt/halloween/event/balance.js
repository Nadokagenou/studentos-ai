/* วิเคราะห์กติกาปัจจุบันเท่านั้น ไม่ปรับอัตราดรอปหรือคูลดาวน์ */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'),require('./guide.js'));
  else root.HalloweenEventBalance=factory(root.HalloweenEventCore,root.HalloweenEventGuide);
})(typeof globalThis==='undefined'?this:globalThis,(Core,Guide)=>{
  'use strict';
  const labels=['เริ่มต้น','ปานกลาง','ยาก','ยากมาก','ท้าทายสูง'];
  function chance(config,id,current,choice='treat'){
    if(!config.preview)return 0;
    const rule=config.materials.houseItems,b=rule.breakthrough,n=config.materials.biomes.length;
    return Guide.sources(config,id).filter(s=>s.kind==='house').reduce((sum,s)=>{
      const destination=b.triggerChance/n+(s.biome===current?1-b.triggerChance:0);
      return sum+destination*rule.rarityWeightsPercent[s.rarity]/100/Guide.housePool(config,s.biome,s.rarity).length;
    },0)*rule.dropChanceGivenCandy*(choice==='trick'?config.materials.houseCandy.trick.successChance:1);
  }
  function best(config,id){return Core.BIOMES.map(biome=>({biome,chance:chance(config,id,biome)})).sort((a,b)=>b.chance-a.chance)[0];}
  function anyItemChance(config,current){
    const ids=new Set();for(const biome of Core.BIOMES)for(const rarity of Object.keys(config.materials.houseItems.rarityWeightsPercent))for(const id of Guide.housePool(config,biome,rarity))ids.add(id);
    return [...ids].reduce((n,id)=>n+chance(config,id,current),0);
  }
  function expectedCollection(config,items){
    const needed=items.filter(x=>x.need>0&&!Guide.sources(config,x.id).some(s=>s.kind==='game'));
    if(!needed.length)return 0;
    const probabilities=Core.BIOMES.map(b=>needed.map(x=>chance(config,x.id,b))),memo=new Map();
    function solve(state){
      const key=state.join(',');if(memo.has(key))return memo.get(key);if(state.every(n=>n===0))return 0;
      const next=state.map((n,i)=>{if(!n)return 0;const s=state.slice();s[i]--;return solve(s);});
      let answer=Infinity;
      for(const row of probabilities){let useful=0,continuation=0;for(let i=0;i<state.length;i++)if(state[i]){useful+=row[i];continuation+=row[i]*next[i];}if(useful)answer=Math.min(answer,(1+continuation)/useful);}
      memo.set(key,answer);return answer;
    }
    return solve(needed.map(x=>x.need));
  }
  function difficulty(config,q,inventory={}){
    const totals={},dependencies=new Set();let game=false,timed=false,candy=0;
    for(const phase of q.phases){
      const candidates=phase.requirements.anyOf||[phase.requirements];
      const chosen=candidates.find(x=>x.candy)||candidates[0];
      const req=Core.resolveRequirements(config,q,phase.requirements,chosen.id);
      candy+=req.candy||0;game ||= !!(req.minigame||req.objective);timed ||= !!req.minigame?.timeLimitSeconds;
      for(const item of req.items||[]){
        const quantity=item.consume===false?1:item.quantity;
        if(item.mustBePlayerGrown){dependencies.add('ปลูกและเก็บผลผลิตเอง');continue;}
        const drop=best(config,item.id);
        if(drop.chance)totals[item.id]=(totals[item.id]||0)+quantity;
        else dependencies.add(Guide.summary(config,item.id));
      }
    }
    const items=Object.entries(totals).map(([id,n])=>{const drop=best(config,id),need=Math.max(0,n-(inventory[id]||0));return{id,need,...drop,expected:need/drop.chance};}).sort((a,b)=>b.expected-a.expected);
    const bottleneck=items[0],draws=expectedCollection(config,items);
    let level=draws>=500?5:draws>=100?4:draws>=30?3:draws>=10?2:1;
    if(game)level=Math.max(level,timed?3:2);if(dependencies.size)level=Math.max(level,3);
    const nextCycle=!!q.availability?.mustWaitForNextOccurrence;
    if(nextCycle)level=Math.max(level,4);
    return {level,label:labels[level-1],items,bottleneck,expectedDraws:draws,dependencies:[...dependencies],game,timed,nextCycle,candy};
  }
  function cooldownComparison(config,hours){
    const rules=config.materials.houseCandy,sets=Math.ceil(rules.maxHouseCandyPer24Hours/(rules.housesPerSet*rules.treat));
    return {hours,sets,attempts:sets*rules.housesPerSet,capHours:(sets-1)*hours,expectedDraws:sets*rules.housesPerSet*config.materials.houseItems.dropChanceGivenCandy};
  }
  return {chance,best,anyItemChance,expectedCollection,difficulty,cooldownComparison,labels};
});
