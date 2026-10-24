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
    for(const recipe of config.proposals?.recipes||[])if(recipe.reward===id)found.push({kind:recipe.channel,recipe:recipe.id});
    if(id==='dutchmans-soul-soul-anchor')found.push({kind:'game',biome:'dutchmans-soul',game:'ghost-ship-hunt'});
    if(config.proposals?.shop?.[id])found.push({kind:'shop'});
    if(id==='random-biome-potion')found.push({kind:'potion'});
    if(id==='nameless-crown')found.push({kind:'boss',boss:'nameless-afterlight'});
    return found;
  }
  function summary(config,id){
    const all=sources(config,id),houses=all.filter(x=>x.kind==='house');
    if(all.some(x=>x.kind==='game'))return 'ผ่านเกมเรือ หรือบ้านทุกไบโอม · พูลหลักท่าเรือผี';
    if(houses.length)return 'บ้านทุกไบโอม · พูลหลัก'+houses.map(x=>names[x.biome]).join(' / ')+' · ข้ามได้ด้วย Breakthrough';
    const s=all[0];if(!s)return 'ดูแหล่งที่มาและเงื่อนไข';
    if(s.kind==='quest')return 'เควส '+s.order+' ของ '+s.npc;
    if(s.kind==='seed')return 'ทำเควสสำเร็จใน'+names[s.biome];
    if(s.kind==='garden')return 'ปลูกจนโตแล้วเก็บในสวนรัตติกาล';
    if(s.kind==='boss')return 'ชนะบอส '+config.proposals.bosses[s.boss].name;
    return ({shop:'แลก Candy ที่ร้านมอร์โร',cauldron:'ผสมที่เตาของมอรา',ritual:'อัญเชิญที่วงเวท',potion:'ซื้อกับแม่มดมอรา'})[s.kind];
  }
  function instructions(place){
    const control={title:'กดสถานที่ในฉาก',text:'จุดสีแดงคือสถานที่หรือกิจกรรมที่กดได้ คลิกหรือแตะครั้งเดียวเพื่อดูรายละเอียด จุดบนตัวละครใช้คุย ป้ายยาวแสดงเมื่อชี้หรือโฟกัส ไม่ต้องบังคับตัวละครเดิน'};
    const quest={title:'คุยกับ NPC แล้วทำตามเควส',text:'กดตัวละครเพื่ออ่านคำขอ ของที่ขาดมีปุ่ม “ดูวิธีหา” บอกแหล่งและพาไปยังจุดนั้นได้',route:'quests',action:'เปิดสมุดเควส'};
    const gather={title:'หาวัตถุดิบจากหมู่บ้าน',text:'เข้าไบโอมแล้วกดป้าย “หาของ · เคาะบ้าน” เลือก Treat เพื่อรับ Candy พร้อมโอกาสสุ่มของ ของไม่ได้ออกทุกครั้ง',village:true,action:'ไปหาวัตถุดิบ'};
    const garden={title:'จบ Jack Q1 ก่อนใช้สวนทุกแปลง',text:'ส่ง Rotten Pumpkin 2 ชิ้น เคลียร์เถาวัลย์แล้วกลับไปส่งเควสกับ Jack เมื่อสำเร็จสวนทั้งหมดจึงเปิด ใช้เมล็ดจากเควสปลูก รดน้ำ รอจนโต เก็บแล้วขายกับมอร์โร',route:'garden',action:'ไปสวนรัตติกาล'};
    if(place==='shop')return {title:'ร้านยามเที่ยงคืน',steps:[control,{title:'คุยกับมอร์โร',text:'เลือกขอดูสินค้าเพื่อแลก Candy หรือขายผลผลิตที่ปลูกและเก็บเอง เลือกจำนวนขายได้'},garden]};
    if(place==='cauldron')return {title:'เตาผสมของแม่มด',steps:[control,{title:'คุยกับมอรา',text:'ขอดูสูตร ผสมเมื่อมีของครบ กดชื่อวัตถุดิบในสูตรเพื่อดูแหล่งที่มา น้ำยาหลงไบโอมซื้อเก็บไว้แล้วดื่มจากหน้ากระเป๋าหรือเส้นทางในสมุดได้'},gather]};
    if(place==='ritual')return {title:'วงเวทอัญเชิญ',steps:[control,{title:'คุยกับเวสเปอร์',text:'ขอดูพิธี ชุด Rare รับจากพิธีอัญเชิญ ตรวจ Candy และวัตถุดิบก่อนเริ่ม กดชื่อของในสูตรเพื่อดูวิธีหา'},gather]};
    if(place==='garden')return {title:'ปลูกจนโต แล้วเก็บไปขาย',steps:[garden,{title:'แตะแปลงที่ต้องการปลูก',text:'ตรวจจำนวนเมล็ด กดปลูกแล้วรดน้ำ แปลงจะแจ้งเมื่อเก็บได้ สวนทุกแปลงต้องจบเควสแรกของ Jack ก่อน'},{title:'ขายกับมอร์โรในร้าน',text:'กลับโถงกลาง เข้าร้านฝั่งซ้าย แล้วคุยกับมอร์โรเพื่อขายผลผลิต',route:'shop',action:'ไปหาพ่อค้า'}]};
    if(place==='biome')return {title:'เริ่มสำรวจไบโอมนี้',steps:[quest,gather,{title:'มินิเกมช่วยทำเควส',text:'กดจุดกิจกรรมในฉาก เกมเรือใช้โคมจาก Tang ส่วนขุดหลุมและจับผีต้องรับพลั่วจาก Win ก่อน'},garden]};
    return {title:'เริ่มผจญภัยรัตติกาล',steps:[control,{title:'เริ่มที่ประตูซึ่งเรืองแสง',text:'ประตูสี่ไบโอมอยู่ด้านหน้า เข้าได้เฉพาะประตูที่เปิดในรอบนี้ ของและเควสที่ทำไว้ยังอยู่เมื่อกลับมา',route:'biome',action:'เข้าไบโอมที่เปิดอยู่'},quest,gather,garden]};
  }
  return {names,housePool,sources,summary,instructions};
});
