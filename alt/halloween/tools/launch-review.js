/* Explicit memory fixtures for visual review; never imported by the app or live service. */
(async()=>{
 const Core=window.HalloweenEventCore,json=async n=>(await fetch('../event/data/'+n+'.json',{cache:'no-store'})).json();
 const [materials,proposals,...chains]=await Promise.all(['materials','preview-rules',...['dutchman','jack','vampire','graveyard'].map(n=>'quests.'+n)].map(json));
 const config=Core.build({materials,proposals,chains,catalog:window.StudentOSHalloweenRewards,preview:true}),status=document.getElementById('reviewStatus');let doc;
 for(const [id,label]of Object.entries(window.HalloweenEventGames.names)){
  const button=document.createElement('button');button.className='primary';button.textContent=label;document.getElementById('reviewGames').append(button);
  button.addEventListener('click',()=>{
   doc=Core.initial(config,'isolated-visual-fixture',Date.now(),crypto.getRandomValues(new Uint32Array(1))[0]);doc.event.previewBiome=Core.gameDefinition(id,config).biome;doc.event.inventory['spectral-lantern']=1;doc.event.quests['jack-clear-garden']={phase:1};doc.event.quests['win-death-fragments']={complete:true};doc.event.proofs['grave-digging']={complete:true};
   window.HalloweenEventGames.open(id,{read:()=>doc,now:()=>Date.now(),reduced:()=>document.documentElement.dataset.motion==='still',toast:message=>status.textContent=message,onClose:()=>{status.textContent='ปิดรอบข้อมูลทดสอบแล้ว · เปิดใหม่เพื่อสุ่มอีกชุด';},perform:async action=>{try{const next=JSON.parse(JSON.stringify(doc)),result=Core.dispatch(next,config,action,{now:Date.now(),tx:crypto.randomUUID()});doc=next;return result;}catch(error){status.textContent=error.message;return null;}}});
  });
 }
 status.textContent='พร้อมตรวจ · ทุกครั้งที่เริ่มจะสุ่มฉากและตำแหน่งใหม่';
})();
