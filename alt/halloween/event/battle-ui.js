(() => {
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function bossArt(rule){
    const sprite={admiral:1,pumpkin:2,vampire:3,reaper:4,sovereign:5,shadow:6}[rule.shape];
    if(sprite!=null)return '<span class="rpg-sprite boss-sprite" role="img" aria-label="'+esc(rule.name)+'" style="--atlas-x:'+sprite%4*100/3+'%;--atlas-y:'+(sprite<4?0:100)+'%"></span>';
    const skull='<path d="M10 6h16v3h3v12h-4v5H11v-5H7V9h3z" fill="#c5bca9"/><path d="M12 13h5v5h-5zm9 0h5v5h-5z" fill="#181828"/>';
    const face=rule.shape==='pumpkin'?'<path d="M6 10h25v4h4v16h-4v4H6v-4H2V14h4z" fill="#c58244"/><path d="M16 2h6v9h-6z" fill="#738461"/><path d="M7 17h8v5H7zm15 0h8v5h-8zM9 28h19v3H9z" fill="#27212c"/>':rule.shape==='shadow'?'<path d="M10 5h18v6h5v28H5V11h5z" fill="#4a395e"/><path d="M10 14h7v3h-7zm13 0h7v3h-7z" fill="#dcbee9"/>':skull;
    const crown=['sovereign','shadow'].includes(rule.shape)?'<path d="M9 8V0l7 4 4-4 5 4 6-4v9z" fill="#d2b588"/>':'';
    const hat=rule.shape==='admiral'?'<path d="M5 5h28v6H5zm5-4h18v7H10z" fill="#465a62"/>':'';
    return '<svg viewBox="0 0 40 52" shape-rendering="crispEdges" role="img" aria-label="'+esc(rule.name)+'"><ellipse cx="20" cy="49" rx="19" ry="3" fill="#080a12"/><path d="M10 23h20v5h5v17H5V28h5z" fill="'+rule.color+'"/><path d="M15 27h10v20H15zM3 30h7v11H3zm27 0h7v11h-7z" fill="#33273e"/>'+face+crown+hat+'<path d="M6 45h11v4H6zm18 0h10v4H24z" fill="#62516b"/></svg>';
  }
  async function open(id,api){
    const {read,config,perform,context,onClose,onRewards}=api,dialog=document.getElementById('gameDialog'),rule=config.proposals.bosses[id];
    if(dialog.open||!rule)return;
    let battle=read().event.battle,busy=false,last='';
    if(!battle||battle.id!==id||battle.finished){const r=await perform({type:'start-boss',boss:id},{silent:true});if(!r)return;battle=r.battle;}
    const session=battle.session,prizes=[];
    async function act(move){
      if(busy)return;busy=true;
      const r=await perform({type:'battle-move',session,move},{silent:true});busy=false;
      if(r){prizes.push(...r.rewards);last=move;render();}
    }
    async function close(){
      if(busy)return;
      if(!read().event.battle.finished){await act('retreat');if(!read().event.battle.finished)return;}
      dialog.close();dialog.classList.remove('battle-dialog');dialog.innerHTML='';dialog.oncancel=null;onClose();if(prizes.length)onRewards(prizes);
    }
    function render(){
      const b=read().event.battle,w=config.proposals.weapons[b.weapon],stage=rule.biome?'world-'+['dutchman','jack','vampire','graveyard'][window.HalloweenEventCore.BIOMES.indexOf(rule.biome)]:'world-ritual';
      const skill=window.HalloweenCombat.skillInfo(w),effects=b.effects||{};
      const finished=b.finished,won=finished&&b.clear,focus=document.activeElement?.getAttribute('data-battle-move');
      dialog.classList.add('battle-dialog');
      dialog.innerHTML='<div class="battle-shell" style="--boss-color:'+rule.color+';--battle-art:url(assets/'+stage+'.png)"><div class="battle-top"><div><small>'+esc(rule.level)+' · '+(finished?'จบการต่อสู้':'เทิร์น '+(b.turn+1))+'</small><h2 id="gameHeading">'+esc(rule.name)+'</h2></div><a class="dialog-studentos" href="../../">← StudentOS</a><button class="dialog-x" data-battle-close aria-label="'+(finished?'กลับฉาก':'ถอยจากการต่อสู้')+'">×</button></div><div class="battle-hp"><span>บอส <b>'+b.bossHp+' / '+b.maxBossHp+'</b></span><meter min="0" max="'+b.maxBossHp+'" value="'+b.bossHp+'">'+b.bossHp+'</meter></div><div class="battle-stage" data-weapon-kind="'+esc(w.type)+'" data-last-move="'+esc(last)+'" data-won="'+won+'"><div class="battle-enemy '+(won?'enemy-defeated':'')+'">'+bossArt(rule)+'</div><div class="battle-hero">'+window.HalloweenWorld.hero(context(),b.weapon)+'</div><div class="battle-impact" aria-hidden="true">'+(last==='skill'?'✧':'╱')+'</div><div class="battle-lanes" aria-label="ช่องที่บอสกำลังจะโจมตี">'+window.HalloweenCombat.lanes.map((n,i)=>'<span class="'+(!finished&&b.intent.danger.includes(i)?'danger':'safe')+'">'+n+'</span>').join('')+'</div></div><div class="battle-player-hp"><span>พลังชีวิต <b>'+b.hp+' / '+b.maxHp+'</b></span><meter min="0" max="'+b.maxHp+'" value="'+b.hp+'">'+b.hp+'</meter><small>'+esc(w.name)+(effects.anchor?' · สมอคุ้มกัน 1 เทิร์น':'')+(effects.bleed?' · เลือดไหลอีก '+effects.bleed+' เทิร์น':'')+' · เวท '+b.mana+'/4 · ยา '+b.heals+' ขวด</small></div><p class="battle-log" role="status">'+esc(b.log)+'</p>'+(finished?'<div class="battle-result"><h3>'+(won?'ชนะแล้ว!':b.hp===0?'พ่ายแพ้… กลับมาตั้งหลัก':'ถอยกลับอย่างปลอดภัย')+'</h3><p>'+(won?(rule.theme?'รับธีมของไบโอมแล้ว พร้อมอนิเมชันรางวัล':id==='midnight-sovereign'?'บัลลังก์สงบแล้ว ได้รับตราผู้พิชิต พร้อม Halloween โทนมืดและ Moon & Candle โทนสว่าง':'เงาไร้นามสลาย… ได้รับมงกุฎเงาไร้นาม สวมให้ตัวละครโดยอัตโนมัติ'):'ไม่มีการริบอาวุธ วัตถุดิบ หรือ Candy ลองใหม่ได้เมื่อพร้อม')+'</p><button class="primary" data-battle-close>กลับฉาก</button></div>':'<p class="battle-intent"><b>สัญญาณโจมตีถัดไป · เฟส '+b.intent.phase+'</b><br>'+esc(window.HalloweenCombat.hint(b.intent))+'</p><div class="battle-actions"><button data-battle-move="strike">โจมตี</button><button data-battle-move="skill" title="'+esc(skill.description)+'" '+(b.mana<2?'disabled':'')+'>'+esc(skill.name)+' · เวท 2</button><button data-battle-move="guard">ตั้งรับ · ฟื้นเวท</button><button data-battle-move="heal" '+(!b.heals?'disabled':'')+'>ฟื้นพลัง +48</button>'+window.HalloweenCombat.lanes.map((n,i)=>'<button data-battle-move="dodge-'+i+'">หลบ'+n+'</button>').join('')+'</div><p class="battle-tip">หลบสำเร็จจะสวนกลับและฟื้นเวท · ไม่มีเวลาบังคับให้รีบกด</p>')+'</div>';
      dialog.querySelectorAll('[data-battle-move]').forEach(button=>button.addEventListener('click',()=>act(button.dataset.battleMove)));
      dialog.querySelectorAll('[data-battle-close]').forEach(button=>button.addEventListener('click',close));
      if(dialog.open)(dialog.querySelector('[data-battle-move="'+focus+'"]:not(:disabled)')||dialog.querySelector('[data-battle-move]:not(:disabled)')||dialog.querySelector('.primary'))?.focus({preventScroll:true});
    }
    dialog.oncancel=e=>{e.preventDefault();close();};render();dialog.showModal();
  }
  window.HalloweenBattleUI={open,bossArt};
})();
