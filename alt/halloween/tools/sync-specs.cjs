const fs=require('node:fs'),path=require('node:path');
const hw=path.resolve(__dirname,'..'),team=path.resolve(hw,'../../../halloween');
const hasTeam=fs.existsSync(path.join(team,'data/item-catalog.json'));
const materialPath=hasTeam?path.join(team,'data/item-catalog.json'):path.join(hw,'event/data/materials.json'),materials=JSON.parse(fs.readFileSync(materialPath,'utf8'));
const materialMap=new Map(materials.biomes.flatMap(x=>x.items).map(x=>[x.name,x]));
const C=require('../rewards/catalog.js');
for(const name of ['dutchman','jack','vampire']){
 const p=path.join(hw,'event/data/quests.'+name+'.json'),spec=JSON.parse(fs.readFileSync(p,'utf8'));
 for(const quest of spec.quests){
  for(const phase of quest.phases){for(const group of [phase.requirements,...(phase.requirements.anyOf||[])])for(const item of group.items||[]){const known=materialMap.get(item.name);if(known)item.id=known.id;}}
  for(const reward of quest.rewards){const known=materialMap.get(reward.name);if(known){if(C.find(reward.id))reward.inventoryId=known.id;else reward.id=known.id;}}
 }
 fs.writeFileSync(p,JSON.stringify(spec,null,2)+'\n');
 let md='# '+spec.biomeName+' — '+spec.npc+'\n\nอัปเดต 22 ตุลาคม 2026 · บทและเงื่อนไขที่เจ้าของยืนยัน\n';
 for(const quest of spec.quests){md+='\n## Quest '+quest.order+': '+quest.name+'\n';for(let i=0;i<quest.phases.length;i++){const phase=quest.phases[i];md+='\n### เฟส '+(i+1)+(phase.surpriseRequest?' · Surprise Request':'')+'\n';const format=req=>[...(req.candy!=null?[req.candy+' Candy']:[]),...(req.items||[]).map(x=>x.name+(x.quantity==null?' (จำนวนยังไม่กำหนด)':' ×'+x.quantity)+(x.mustBePlayerGrown?' (ปลูกเอง)':'')),...(req.minigame?['ผ่าน'+(req.minigame.name||'มินิเกมของไบโอม')+(req.minigame.clears?' '+req.minigame.clears+' ครั้ง':'')]:[]),...(req.objective?[req.objective.description]:[])].join(' + ');md+='\nเงื่อนไข: '+(phase.requirements.anyOf?phase.requirements.anyOf.map(format).join(' **หรือ** '):format(phase.requirements))+'\n';if(phase.acceptDialogue)md+='\n**ตอนรับเควส**\n\n> '+phase.acceptDialogue.replaceAll('\n','\n> ')+'\n';if(phase.additionalCompleteDialogue)md+='\n**บทส่งเควสเพิ่มเติมจากเจ้าของ**\n\n> '+phase.additionalCompleteDialogue+'\n';if(phase.completeDialogue)md+='\n**ตอนส่ง/เปลี่ยนเฟส**\n\n> '+phase.completeDialogue.replaceAll('\n','\n> ')+'\n';}if(quest.nextQuestGate)md+='\n**เงื่อนไขรับเควสถัดไป:** รอไบโอมกลับมาในวัฏจักรถัดไปหลังส่งเควสนี้\n';if(quest.availability?.mustWaitForNextOccurrence)md+='\n**รับได้เมื่อ:** ผ่านเควสก่อนหน้าและกลับมาในวัฏจักรไบโอมใหม่\n';md+='\n**รางวัลหลังทำครบ:** '+quest.rewards.map(x=>x.name+' ×'+x.quantity).join(' + ')+'\n';}
 if(spec.unresolved?.length)md+='\n## รายละเอียดที่ยังไม่กำหนด\n\n'+spec.unresolved.map(x=>'- '+x).join('\n')+'\n';
 fs.mkdirSync(path.join(hw,'docs'),{recursive:true});fs.writeFileSync(path.join(hw,'docs/quests.'+name+'.md'),md);if(hasTeam){fs.writeFileSync(path.join(team,'QUESTS-'+name.toUpperCase()+'.md'),md);fs.writeFileSync(path.join(team,'data/quests.'+name+'.json'),JSON.stringify(spec,null,2)+'\n');}
}
materials.spectralLanternRecipe={quest:'dutchman-light-in-darkness',candy:50,items:[{id:'dutchmans-soul-abyssal-rock',quantity:1},{id:'dutchmans-soul-dutchman-s-lantern',quantity:1}],preserveExistingCraft:true};
materials.newEventDefinitions=['jack','vampire'].flatMap(name=>JSON.parse(fs.readFileSync(path.join(hw,'event/data/quests.'+name+'.json'),'utf8')).newDefinitions||[]);
materials.minigames={vampire:JSON.parse(fs.readFileSync(path.join(hw,'event/data/quests.vampire.json'),'utf8')).minigame};
materials.garden={biome:'jacks-hollow',style:'Grow a Garden',crop:'Pumpkin',unlockQuest:'jack-clear-garden',questUse:{quest:'jack-harvest-wisp',quantity:3,mustBePlayerGrown:true},growthMinutes:null,watering:null,harvestYield:null};
fs.writeFileSync(materialPath,JSON.stringify(materials,null,2)+'\n');fs.writeFileSync(path.join(hw,'event/data/materials.json'),JSON.stringify(materials,null,2)+'\n');
if(!hasTeam){console.log('Saved repository quest specifications.');process.exit(0);}
const replace=(file,fn)=>{const p=path.join(team,file);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));};
const oldFormula="Dutchman's Lantern ×1 + Rotten Pumpkin ×1 + 100 Candy",newFormula="Abyssal rock ×1 + Dutchman's Lantern ×1 + 50 Candy";
for(const file of ['README.md','MATERIALS.md','SYSTEMS.md','ECONOMY.md'])replace(file,s=>s.replaceAll(oldFormula,newFormula));
replace('README.md',s=>s.includes('**สายเควสล่าสุด:**')?s:s.replace('**ระบบล่าสุดจากเจ้าของ:**','**สายเควสล่าสุด:** [Tang The Sailor](QUESTS-DUTCHMAN.md) · [Jack\'o Tigger และสวนฟักทอง](QUESTS-JACK.md) · ชุด Rare ทั้งสองมาจากพิธีอัญเชิญ\n\n**ระบบล่าสุดจากเจ้าของ:**'));
replace('SYSTEMS.md',s=>s.replace("รวบรวม **Dutchman's Lantern 1 ชิ้น** และ **Rotten Pumpkin 1 ชิ้น**","รวบรวม **Abyssal rock 1 ชิ้น** และ **Dutchman's Lantern 1 ชิ้น**").replace('ขอ **100 Candy**','ขอ **50 Candy**').replace("| Rotten Pumpkin | Common | สุ่มจากการเคาะบ้านทุกไบโอม | Jack's Hollow |","| Abyssal rock | Common | สุ่มจากการเคาะบ้านทุกไบโอม | Dutchman's Soul |").replace('ตอนจ่าย 100 Candy','ตอนจ่าย 50 Candy').replace('- เงื่อนไขเคลียร์ Main Quest ของ Tang The Sailor เพื่อรับ Greater Spear of Dutchman; ยังไม่ยืนยันว่าเป็นการชนะเรือครั้งแรกหรือเงื่อนไขอื่น','- สาย Main Quest ของ Tang The Sailor ยืนยัน 3 เควสแล้ว เควสสุดท้ายมี 2 เฟสและให้ Greater Spear of Dutchman + ธีม Dutchman ดู [บทเต็ม](QUESTS-DUTCHMAN.md)'));
replace('MATERIALS.md',s=>s.replace("- Rotten Pumpkin: Common ของ **Jack's Hollow** ตามรายการใหม่ ไม่ใช่ Pumpkin Patch ที่ถูกแทนแล้ว","- Abyssal rock: Common ของ **Dutchman's Soul** ตามสูตรเควสใหม่ 22 ตุลาคม 2026; Rotten Pumpkin ยังอยู่ในไอเทมบ้านและเควสสวนของ Jack แต่ไม่ใช่สูตร Spectral Lantern แล้ว"));
replace('ECONOMY.md',s=>s.replace('- ผู้เล่นวันละ 1 ชุดหา 100 Candy ได้ใน 2 วันโดยเลือก Treat และยังไม่ใช้ Candy ทำอย่างอื่น','- Treat ครบ 1 ชุดได้ 50 Candy พอส่วน Candy ของโคมตามสูตรใหม่ โดยยังต้องหาวัตถุดิบให้ครบ').replace('ทุกคนจะมี 100 Candy','ทุกคนจะมี 50 Candy').replace('| คราฟต์ Spectral Lantern | 100 | 10 บ้าน หรือ 2 ชุด |','| คราฟต์ Spectral Lantern | 50 | 5 บ้าน หรือ 1 ชุด |'));
console.log('Saved all three quest chains, full dialogues, new lantern recipe and garden concept.');
