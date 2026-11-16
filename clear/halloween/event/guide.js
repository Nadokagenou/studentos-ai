/* คู่มืออ่านแหล่งของจากกติกาที่เกมใช้อยู่ ไม่เพิ่มของหรือเปลี่ยนข้อมูลผู้เล่น */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HalloweenEventGuide=factory();
})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const names={'dutchmans-soul':'ท่าเรือผี','jacks-hollow':'สวนฟักทอง','vampire-mansion':'คฤหาสน์แวมไพร์','eternal-graveyard':'สุสานนิรันดร์'};
  function housePool(config,biome,rarity){
    return config.materials.biomes.find(b=>b.id===biome)?.items.filter(x=>x.source==='house-item-pool'&&x.rarity===rarity&&x.rarity!=='Mystical').map(x=>x.id)||[];
  }
  function sources(config,id){
    const found=[],crops=Object.entries(config.proposals?.crops||{});
    for(const biome of config.materials.biomes){
      for(const rarity of Object.keys(config.materials.houseItems.rarityWeightsPercent)){
        const pool=housePool(config,biome.id,rarity);
        if(pool.includes(id))found.push({kind:'house',biome:biome.id,rarity});
      }
    }
    for(const quest of config.quests){
      const reward=quest.rewards.find(r=>r.id===id||r.inventoryId===id);
      if(reward)found.push(reward.afterBoss?{kind:'boss',biome:quest.biome,boss:reward.afterBoss}:{kind:'quest',biome:quest.biome,quest:quest.id,npc:quest.npc,order:quest.order,upgrade:reward.kind==='upgrade-existing'});
    }
    for(const [biome,crop]of crops){
      if(crop.seed===id)found.push({kind:'seed',biome});
      if(crop.harvest===id)found.push({kind:'garden',biome});
    }
    for(const [boss,rule]of Object.entries(config.proposals?.bosses||{}))if(rule.rewards?.includes(id))found.push({kind:'boss',boss});
    for(const recipe of config.proposals?.recipes||[])if(recipe.reward===id&&!recipe.retired)found.push({kind:recipe.channel,recipe:recipe.id});
    if(id==='dutchmans-soul-soul-anchor')found.push({kind:'game',biome:'dutchmans-soul',game:'ghost-ship-hunt'});
    if(config.proposals?.shop?.[id])found.push({kind:'shop'});
    if(id==='random-biome-potion')found.push({kind:'potion'});
    if(id==='nameless-crown')found.push({kind:'boss',boss:'nameless-afterlight'});
    return found;
  }
  function summary(config,id){
    const all=sources(config,id),houses=all.filter(x=>x.kind==='house');
    if(all.some(x=>x.kind==='game'))return 'ผ่านเกมเรือ หรือเคาะบ้าน · ออกบ่อยสุดที่ท่าเรือผี';
    if(houses.length)return 'เคาะบ้าน · ออกบ่อยสุดที่'+houses.map(x=>names[x.biome]).join(' / ');
    const s=all[0];if(!s)return 'ดูแหล่งที่มาและเงื่อนไข';
    if(s.kind==='quest')return 'เควส '+s.order+' ของ '+s.npc;
    if(s.kind==='seed')return 'ทำเควสสำเร็จใน'+names[s.biome];
    if(s.kind==='garden')return 'ปลูกจนโตแล้วเก็บในสวนรัตติกาล';
    if(s.kind==='boss')return 'ชนะบอส '+config.proposals.bosses[s.boss].name;
    return ({shop:'แลก Candy ที่ร้านมอร์โร',cauldron:'ผสมที่เตาของมอรา',ritual:'อัญเชิญที่วงเวท',potion:'ซื้อกับแม่มดมอรา'})[s.kind];
  }
  return {names,housePool,sources,summary};
});
