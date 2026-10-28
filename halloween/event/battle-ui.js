(() => {
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function bossArt(rule){
    if(rule.shape==='training')return window.HalloweenWorld.portrait('vesper');
    const sprite={admiral:1,pumpkin:2,vampire:3,reaper:4,sovereign:5,shadow:6}[rule.shape];
    if(sprite!=null)return '<span class="rpg-sprite boss-sprite" role="img" aria-label="'+esc(rule.name)+'" style="--atlas-x:'+sprite%4*100/3+'%;--atlas-y:'+(sprite<4?0:100)+'%"></span>';
    const skull='<path d="M10 6h16v3h3v12h-4v5H11v-5H7V9h3z" fill="#c5bca9"/><path d="M12 13h5v5h-5zm9 0h5v5h-5z" fill="#181828"/>';
    const face=rule.shape==='pumpkin'?'<path d="M6 10h25v4h4v16h-4v4H6v-4H2V14h4z" fill="#c58244"/><path d="M16 2h6v9h-6z" fill="#738461"/><path d="M7 17h8v5H7zm15 0h8v5h-8zM9 28h19v3H9z" fill="#27212c"/>':rule.shape==='shadow'?'<path d="M10 5h18v6h5v28H5V11h5z" fill="#4a395e"/><path d="M10 14h7v3h-7zm13 0h7v3h-7z" fill="#dcbee9"/>':skull;
    const crown=['sovereign','shadow'].includes(rule.shape)?'<path d="M9 8V0l7 4 4-4 5 4 6-4v9z" fill="#d2b588"/>':'';
    const hat=rule.shape==='admiral'?'<path d="M5 5h28v6H5zm5-4h18v7H10z" fill="#465a62"/>':'';
    return '<svg viewBox="0 0 40 52" shape-rendering="crispEdges" role="img" aria-label="'+esc(rule.name)+'"><ellipse cx="20" cy="49" rx="19" ry="3" fill="#080a12"/><path d="M10 23h20v5h5v17H5V28h5z" fill="'+rule.color+'"/><path d="M15 27h10v20H15zM3 30h7v11H3zm27 0h7v11h-7z" fill="#33273e"/>'+face+crown+hat+'<path d="M6 45h11v4H6zm18 0h10v4H24z" fill="#62516b"/></svg>';
  }
  let active=null,inFlight=null;
  async function open(id,api){
    const {read,config,perform,context,onClose,onRewards}=api,dialog=document.getElementById('gameDialog'),training=id==='training',rule=training?{id,name:'ฝึกสามท่ากับเวสเปอร์',hp:1000,damage:12,color:'#c4b1e5',level:'สนามฝึก · ไม่มีค่าใช้จ่าย',shape:'training'}:config.proposals.bosses[id];
    const getBattle=()=>read().event[training?'trainingBattle':'battle'];
    if(active||dialog.open||!rule)return;
    let session,busy=false,last='',closed=false,localError='';const prizes=[];
    async function send(action){const job=Promise.resolve().then(()=>perform(action,{silent:true}));inFlight=job;try{return await job;}finally{if(inFlight===job)inFlight=null;}}
    function waiting(){dialog.setAttribute('aria-busy',String(busy));if(busy){dialog.querySelectorAll('[data-battle-move]').forEach(b=>b.disabled=true);const log=dialog.querySelector('.battle-log');if(log)log.textContent='กำลังยืนยันเทิร์น… ปิดหน้าต่างเพื่อถอยได้ ไม่ต้องกดซ้ำ';}}
    async function act(move){
      if(busy||closed)return;busy=true;waiting();
      try{const r=await send({type:training?'training-move':'battle-move',session,move});localError=r?'':'ยังยืนยันเทิร์นไม่ได้ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง';if(r){prizes.push(...(r.rewards||[]));last=move;if(closed&&r.rewards?.length)api.toast?.('บันทึกรางวัลบอสแล้ว ดูของที่ได้รับในคลังได้');}}
      catch{localError='ยังยืนยันเทิร์นไม่ได้ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง';}
      finally{busy=false;if(!closed)render();}
    }
    function close(){
      if(closed)return;closed=true;const previous=inFlight;
      dialog.close();dialog.classList.remove('battle-dialog');dialog.innerHTML='';dialog.removeAttribute('aria-busy');dialog.oncancel=null;active=null;onClose();if(prizes.length)onRewards([...new Set(prizes)]);
      // Leave the view immediately; serialize retreat behind any committed turn/start.
      const job=Promise.resolve(previous).catch(()=>{}).then(async()=>{const b=getBattle();if(!b||b.id!==id||b.finished)return;const r=await perform({type:training?'training-move':'battle-move',session:b.session,move:'retreat'},{silent:true});if(!r)api.toast?.('ยังยืนยันการถอยไม่ได้ เปิดบอสอีกครั้งเพื่อตรวจรอบเดิม');}).catch(()=>api.toast?.('ยังยืนยันการถอยไม่ได้ ตรวจการเชื่อมต่อแล้วเปิดบอสอีกครั้ง'));
      inFlight=job;void job.finally(()=>{if(inFlight===job)inFlight=null;});
    }
    function render(){
      if(closed)return;
      const b=getBattle(),w=config.proposals.weapons[b.weapon],stage=rule.biome?'world-'+['dutchman','jack','vampire','graveyard'][window.HalloweenEventCore.BIOMES.indexOf(rule.biome)]:'world-ritual';
      const skill=window.HalloweenCombat.skillInfo(w),effects=b.effects||{};
      const lesson=['หลบไปซ้ายหรือขวาที่ว่าง · สวนกลับและฟื้นเวท','คำสาปโดนทุกช่อง · ตั้งรับเพื่อลดดาเมจ','เวทพร้อมแล้ว · ใช้ยึดสมอ'][b.lesson]||'ฝึกครบแล้ว พร้อมท้าผู้พิทักษ์';
      const forecast=move=>{const f=window.HalloweenCombat.forecast(b,rule,w,move);return '<small>โต้ '+f.hit+' · รับ '+f.damage+' · HP '+f.hp+'</small>';};
      const finished=b.finished,won=finished&&b.clear,focus=document.activeElement?.getAttribute('data-battle-move');
      dialog.classList.add('battle-dialog');
      dialog.innerHTML='<div class="battle-shell" style="--boss-color:'+rule.color+';--battle-art:url(assets/'+stage+'.webp)"><div class="battle-top"><div><small>'+esc(rule.level)+' · '+(finished?'จบการต่อสู้':'เทิร์น '+(b.turn+1))+'</small><h2 id="gameHeading">'+esc(rule.name)+'</h2></div><a class="dialog-studentos" href="../../">← StudentOS</a><button class="dialog-x" data-battle-close aria-label="'+(finished?'กลับฉาก':'ถอยจากการต่อสู้')+'">×</button></div><div class="battle-hp"><span>'+(training?'บทฝึก <b>'+b.lesson+' / 3</b>':'บอส <b>'+b.bossHp+' / '+b.maxBossHp+'</b>')+'</span><meter min="0" max="'+(training?3:b.maxBossHp)+'" value="'+(training?b.lesson:b.bossHp)+'">'+(training?b.lesson:b.bossHp)+'</meter></div><div class="battle-stage" data-weapon-kind="'+esc(w.type)+'" data-last-move="'+esc(last)+'" data-won="'+won+'"><div class="battle-enemy '+(won?'enemy-defeated':'')+'">'+bossArt(rule)+'</div><div class="battle-hero">'+window.HalloweenWorld.hero(context(),b.weapon,training)+'</div><div class="battle-impact" aria-hidden="true">'+(last==='skill'?'✧':'╱')+'</div><div class="battle-lanes" aria-label="ช่องที่บอสกำลังจะโจมตี">'+window.HalloweenCombat.lanes.map((n,i)=>'<span class="'+(!finished&&b.intent.danger.includes(i)?'danger':'safe')+'">'+n+'</span>').join('')+'</div></div><div class="battle-player-hp"><span>พลังชีวิต <b>'+b.hp+' / '+b.maxHp+'</b></span><meter min="0" max="'+b.maxHp+'" value="'+b.hp+'">'+b.hp+'</meter><small>'+(training?'อาวุธยืมฝึก · ':'')+esc(w.name)+(effects.anchor?' · สมอคุ้มกัน 1 เทิร์น':'')+(effects.bleed?' · เลือดไหลอีก '+effects.bleed+' เทิร์น':'')+' · เวท '+b.mana+'/4 · ยา '+b.heals+' ขวด</small></div><p class="battle-log" role="status">'+esc(localError||b.log)+'</p>'+(finished?'<div class="battle-result"><h3>'+(won?(training?'ฝึกครบสามท่าแล้ว!':'ชนะแล้ว!'):b.hp===0?'พ่ายแพ้… กลับมาตั้งหลัก':'ถอยกลับอย่างปลอดภัย')+'</h3><p>'+(won?(training?'หลบ ตั้งรับ และใช้สกิลเป็นแล้ว · สนามฝึกไม่แจก Candy หรือรางวัลบอส':rule.theme?'รับธีมของไบโอมแล้ว พร้อมอนิเมชันรางวัล':id==='midnight-sovereign'?'บัลลังก์สงบแล้ว ได้รับตราผู้พิชิต พร้อม ธีม Halloween และ Moon & Candle':'เงาไร้นามสลาย… ได้รับมงกุฎเงาไร้นาม สวมให้ตัวละครโดยอัตโนมัติ'):'ไม่มีการริบอาวุธ วัตถุดิบ หรือ Candy ลองใหม่ได้เมื่อพร้อม')+'</p><button class="primary" data-battle-close>กลับฉาก</button></div>':'<p class="battle-intent"><b>สัญญาณโจมตีถัดไป · เฟส '+b.intent.phase+'</b><br>'+esc(training?lesson:window.HalloweenCombat.hint(b.intent))+'</p><div class="battle-actions"><button data-battle-move="strike" '+(training?'disabled':'')+'>โจมตี'+forecast('strike')+'</button><button data-battle-move="skill" title="'+esc(skill.description)+'" '+(b.mana<2||training&&b.lesson!==2?'disabled':'')+'>'+esc(skill.name)+' · เวท 2'+(b.mana>=2?forecast('skill'):'')+'</button><button data-battle-move="guard" '+(training&&b.lesson!==1?'disabled':'')+'>ตั้งรับ · ฟื้นเวท'+forecast('guard')+'</button><button data-battle-move="heal" '+(!b.heals||training?'disabled':'')+'>ฟื้นพลัง +48'+(b.heals?forecast('heal'):'')+'</button>'+window.HalloweenCombat.lanes.map((n,i)=>'<button data-battle-move="dodge-'+i+'" '+(training&&(b.lesson!==0||i===1)?'disabled':'')+'>หลบ'+n+forecast('dodge-'+i)+'</button>').join('')+'</div><p class="battle-tip">หลบสำเร็จจะสวนกลับและฟื้นเวท · ไม่มีเวลาบังคับให้รีบกด</p>')+'</div>';
      dialog.querySelectorAll('[data-battle-move]').forEach(button=>button.addEventListener('click',()=>act(button.dataset.battleMove)));
      dialog.querySelectorAll('[data-battle-close]').forEach(button=>button.addEventListener('click',close));
      waiting();
      if(dialog.open)(dialog.querySelector('[data-battle-move="'+focus+'"]:not(:disabled)')||dialog.querySelector('[data-battle-move]:not(:disabled)')||dialog.querySelector('.primary'))?.focus({preventScroll:true});
    }
    active={close};dialog.classList.add('battle-dialog');dialog.oncancel=e=>{e.preventDefault();close();};
    dialog.innerHTML='<div class="battle-top"><h2 id="gameHeading">'+esc(rule.name)+'</h2><button class="dialog-x" data-battle-close aria-label="ถอยจากการต่อสู้">×</button></div><p class="battle-log" role="status">กำลังเปิดสนามต่อสู้… ปิดหน้าต่างได้</p>';
    dialog.querySelector('[data-battle-close]').addEventListener('click',close);dialog.setAttribute('aria-busy','true');dialog.showModal();
    try{
      if(inFlight)await inFlight.catch(()=>{});if(closed)return;
      let battle=getBattle();if(!battle||battle.id!==id||battle.finished){const r=await send(training?{type:'training-start'}:{type:'start-boss',boss:id});if(!r)throw Error('open');battle=getBattle();}
      if(closed)return;session=battle.session;render();
    }catch{if(closed)return;dialog.removeAttribute('aria-busy');dialog.innerHTML='<h2 id="gameHeading">ยังเปิดสนามไม่ได้</h2><p class="battle-log" role="status">ตรวจการเชื่อมต่อแล้วลองอีกครั้ง ของและรอบเดิมยังอยู่</p><button class="primary" data-battle-retry>ลองเปิดอีกครั้ง</button><button class="secondary" data-battle-close>กลับฉาก</button>';dialog.querySelector('[data-battle-close]').addEventListener('click',close);dialog.querySelector('[data-battle-retry]').addEventListener('click',()=>{close();open(id,api);});}
  }
  window.HalloweenBattleUI={open,bossArt};
})();
