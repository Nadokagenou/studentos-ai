(() => {
  'use strict';
  const Core = window.HalloweenEventCore, Catalog = window.StudentOSHalloweenRewards;
  const Guide=window.HalloweenEventGuide,Balance=window.HalloweenEventBalance,audio=window.HalloweenEventSound.create();
  const StudentMissions=window.HalloweenStudentMissions,Death=window.HalloweenDeathQuests;
  const main = document.getElementById('eventMain'), detail = document.getElementById('detailDialog');
  const preferences = document.getElementById('preferencesDialog');
  const preview = new URLSearchParams(location.search).get('preview') === '1';
  const KEY = 'studentos.alt.halloween.preview.v1';
  const PREF_KEY = 'studentos.alt.halloween.event.preferences';
  const owner = 'halloween-review-only';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const biomeSymbols = ['⚓','❧','♜','☾'];
  const biomeArts = ['theme-ghostship','theme-jackhollow','theme-vampire','theme-graveyard'];
  const ROOM_ROUTES={shop:'shop','shop-stock':'shop',cauldron:'cauldron','cauldron-recipes':'cauldron',ritual:'ritual','ritual-recipes':'ritual',garden:'garden'};
  const PANEL_NAMES={journal:'สมุดรัตติกาล',shop:'ร้านยามเที่ยงคืน','shop-stock':'สินค้าของมอร์โร',cauldron:'ห้องปรุงยาของมอรา','cauldron-recipes':'สูตรผสมเวทมนตร์',ritual:'ห้องวงเวทโบราณ','ritual-recipes':'พิธีอัญเชิญ',quests:'สมุดเควส',vault:'กระเป๋าของฉัน',tasks:'งานวันนี้',ghosts:'ภารกิจสุสาน',totems:'Totem แห่งสี่โลก',village:'หมู่บ้าน Trick or Treat'};
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset = item => '../rewards/' + (item.asset || 'assets/' + item.id + '.svg');
  const image = id => '../rewards/assets/' + id + '.svg';
  let config, store, route = 'gate', vaultTab = 'rewards', toastTimer, detailAfterClose = null;
  let activePanel=null,activeRoom=null,typingFrame=0,typingLines=[],dialogueEpoch=0,market;
  let sourceReturn={},journalPage='index';
  const recipeSelection={cauldron:null,ritual:null};
  let recipePrepared=false;
  let biomeDifficulty={};
  let prefs = {motion:media.matches ? 'still' : 'full', motionChosen:false, sound:false};
  try { prefs = {...prefs,...JSON.parse(localStorage.getItem(PREF_KEY) || '{}')}; } catch {}
  prefs.motion = prefs.motion === 'still' ? 'still' : 'full'; prefs.sound = prefs.sound === true;
  const reduced = () => window.HalloweenAcquisition.motionReduced(prefs,media.matches);
  document.documentElement.dataset.motion = reduced() ? 'still' : 'full';
  const read = () => store.read();
  const now = () => Core.moment(read(),Date.now());
  const name = id => config.items[id]?.name || config.rewards[id]?.name || ({'win-blade-phase':'ส่วนคมของเคียว','win-forge-access':'สิทธิ์สร้างอาวุธ','dech-next-cycle-access':'สิทธิ์รับเควสวัฏจักรถัดไป'}[id]) || id;
  const biomeIndex = id => Core.BIOMES.indexOf(id);
  const biomeName = id => Catalog.biomes[Core.SHORT[biomeIndex(id)]]?.name || 'รอเปิดกิจกรรม';
  const kindName = kind => ({room:'ของแต่งห้อง',effect:'เอฟเฟกต์',costume:'ชุดมาสคอต',theme:'ธีม',relic:'วัตถุ Mystical',badge:'เหรียญสะสม'}[kind] || kind);
  const tierStyle = item => '--tier-color:' + Catalog.tiers[item.rarity].color;
  const duration = ms => {
    const n = Math.max(0,Math.ceil(ms/1000)), h = Math.floor(n/3600), m = Math.floor(n%3600/60);
    return h ? h + ' ชม. ' + m + ' น.' : m ? m + ' น. ' + n%60 + ' วิ.' : n + ' วิ.';
  };
  const pageHead = (eyebrow,title,description,pill='') => '<div class="page-head"><div><span class="eyebrow">' + eyebrow + '</span><h1>' + title + '</h1><p>' + description + '</p></div>' + (pill ? '<span class="pill">' + pill + '</span>' : '') + '</div>';
  function toast(message,error=false) {
    const openDialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (openDialog && !openDialog.classList.contains('hw-acquisition')) {
      let feedback = openDialog.querySelector('.dialog-feedback');
      if (!feedback) { feedback = document.createElement('p'); feedback.className = 'dialog-feedback subtle'; feedback.setAttribute('role','status'); const journalHeader=openDialog.querySelector('.journal-header');if(journalHeader)journalHeader.after(feedback);else openDialog.append(feedback); }
      feedback.textContent = message;
    }
    const box = document.getElementById('eventToast'); clearTimeout(toastTimer); box.textContent = message; box.classList.toggle('error',error); box.hidden = false;
    toastTimer = setTimeout(() => { box.hidden = true;document.querySelector('.journal-binding>.dialog-feedback')?.remove(); },4400);
  }
  function dialogShell(title,body,footer='') {
    if(detail.dataset.journalPage)footer='<button class="secondary" data-journal-page="'+detail.dataset.journalPage+'">กลับหน้าสมุด</button>'+footer;
    return '<div class="dialog-top"><h2 id="detailHeading">' + title + '</h2><a class="dialog-studentos" href="../../">← StudentOS</a><button class="dialog-x" data-open-guide aria-label="วิธีเล่น">?</button><button class="dialog-x" data-close-detail aria-label="ปิดหน้าต่าง">×</button></div>' + body + (footer ? '<div class="dialog-footer">' + footer + '</div>' : '');
  }
  function openDetail(html,afterClose=null) {
    finishTyping();activePanel=null;delete detail.dataset.scenePanel;detail.dataset.room=activeRoom||'';
    delete detail.dataset.guide;
    delete detail.dataset.plotBiome;
    delete detail.dataset.gameInfo;
    detail.innerHTML = html; detailAfterClose = afterClose;
    detail.querySelectorAll('[data-close-detail]').forEach(b => b.addEventListener('click',() => detail.close()));
    if (!detail.open) detail.showModal();
    typeDialogue();
  }
  detail.addEventListener('close',() => {
    finishTyping();activePanel=null;delete detail.dataset.journalPage;
    if(activeRoom){activeRoom=null;if(preview&&store&&!read().event.closed)perform(route==='garden'?{type:'enter-room',room:'garden'}:route==='biome'?{type:'enter-biome',biome:currentBiome()}:{type:'enter-hub'},{silent:true});}
    delete detail.dataset.plotBiome;
    detail.querySelectorAll('iframe').forEach(f => f.removeAttribute('src'));
    const fn = detailAfterClose; detailAfterClose = null; if (fn) fn();
  });
  function finishTyping(){cancelAnimationFrame(typingFrame);dialogueEpoch++;for(const row of typingLines)if(row.el.isConnected){row.el.textContent=row.full;row.el.removeAttribute('data-typing');}typingLines=[];detail.querySelector('.dialogue-skip')?.remove();}
  function typeDialogue(){
    if(reduced())return;
    const epoch=++dialogueEpoch;
    typingLines=[...detail.querySelectorAll('.npc-line,.npc-dialogue,.quest-ask')].filter(el=>!el.closest('.quest-lore')).map(el=>{const full=el.textContent,height=el.getBoundingClientRect().height;el.style.minHeight=height+'px';el.dataset.typing='true';const hidden=document.createElement('span');hidden.className='sr-label';hidden.textContent=full;const shown=document.createElement('span');shown.setAttribute('aria-hidden','true');el.replaceChildren(hidden,shown);return{el,shown,full,parts:typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('th',{granularity:'grapheme'}).segment(full)].map(x=>x.segment):Array.from(full)};});
    if(!typingLines.length)return;
    const start=performance.now();
    const tick=t=>{if(epoch!==dialogueEpoch)return;if(document.hidden){finishTyping();return;}let done=true;for(const row of typingLines){const n=Math.floor((t-start)/9);row.shown.textContent=row.parts.slice(0,n).join('');if(n<row.parts.length)done=false;}if(done)finishTyping();else typingFrame=requestAnimationFrame(tick);};
    typingFrame=requestAnimationFrame(tick);
  }
  function showPanel(id){
    if(id==='journal'||['quests','vault','tasks'].includes(id)){showJournal(id==='journal'?journalPage:id);return;}
    const world=window.HalloweenWorld;
    const content={shop:()=>world.room(worldContext(),'shop'),cauldron:()=>world.room(worldContext(),'cauldron'),ritual:()=>world.room(worldContext(),'ritual'),'shop-stock':shop,'cauldron-recipes':()=>recipes('cauldron'),'ritual-recipes':()=>recipes('ritual'),quests:questList,vault:inventory,tasks,ghosts,totems,village:()=>world.village({...worldContext(),knock:villageInfo()})}[id];
    if(!content)return;
    openDetail(dialogShell(PANEL_NAMES[id],content(),'<button class="secondary" data-close-detail>กลับฉาก</button>'),()=>history.replaceState(null,'','#'+route));
    activePanel=id;detail.dataset.scenePanel=['shop','cauldron','ritual'].includes(id)?'room':'menu';detail.dataset.room=activeRoom||'';
    if(id==='shop-stock'){detail.dataset.scenePanel='counter';detail.querySelector('.dialog-footer').insertAdjacentHTML('afterbegin','<button class="secondary" data-route="shop">กลับห้องร้าน</button>');}
    if(id==='cauldron-recipes'||id==='ritual-recipes'){detail.dataset.scenePanel='workbench';detail.querySelector('.dialog-footer').insertAdjacentHTML('afterbegin','<button class="secondary" data-route="'+(id==='cauldron-recipes'?'cauldron':'ritual')+'">กลับห้อง</button>');}
    if(id==='vault'){const b=document.createElement('button');b.className='primary';b.dataset.equipment='';b.textContent='อาวุธ · ถือและสวมใส่';detail.querySelector('.inventory-tabs').prepend(b);}
    if(id==='village'){const b=document.createElement('button');b.className='secondary';b.dataset.itemPools='';b.textContent='ดูตารางของและขั้นตอนสุ่ม';detail.querySelector('.village-lane~[data-open-balance]')?.after(b);}
    audio.setScene(activeRoom||route);
  }
  function acquisition(ids,channel) {
    const queue = ids.map(id => config.rewards[id]).filter(Boolean);
    function next() {
      const item = queue.shift(); if (!item) return;
      window.HalloweenAcquisition.open(item,{asset:asset(item),color:Catalog.tiers[item.rarity].color,channel,reduced:reduced(),sound:prefs.sound,onClose:next});
    }
    next();
  }
  let pending = false;
  async function perform(action,{silent=false}={}) {
    if (pending && !silent) return null;
    if (!silent) pending = true;
    try {
      const tx = crypto.randomUUID();
      const saved = await store.transact(tx,document => Core.dispatch(document,config,action,{now:Date.now(),tx,...(action.type.startsWith('death-quest')?{studentOS:StudentMissions.read(localStorage),studentOwner:Death.owner(localStorage),studentFocus:Death.get(localStorage,Death.FOCUS_KEY,{})}:{})}));
      const cue=({house:saved.result.candy?'coins':'ghost',quest:'magic',plant:'water',water:'water',harvest:'harvest','sell-crop':'coins','drink-biome-potion':'magic','enter-biome':'door','enter-room':'door','game-move':'tap','equip-weapon':'magic','start-boss':'ghost','battle-move':saved.result.battle?.clear?'magic':action.move==='skill'?'magic':'tap'})[action.type];if(cue)audio.play(cue);
      updateWallet(); updateBanner();
      if (!silent) render();
      return saved.result;
    } catch(error) { audio.play('error');toast(error.message || 'บันทึกไม่สำเร็จ ยังไม่มีการหักของ',true); return null; }
    finally { if (!silent) pending = false; }
  }
  function updateWallet() { const value=preview&&store?read().event.candy.toLocaleString('th-TH'):'—';document.getElementById('wallet').textContent=value;document.querySelectorAll('[data-scene-wallet]').forEach(el=>el.textContent=value); }
  function updateBanner() {
    const banner = document.getElementById('modeBanner');
    if (!preview) { banner.textContent = 'Halloween · กำหนดการเปิดกิจกรรมจะแจ้งให้ทราบ'; return; }
    banner.innerHTML = (read().event.closed ? 'จำลองปิดอีเวนต์แล้ว · เปิดคลังใช้รางวัลต่อได้' : 'ห้องลองอีเวนต์ · ข้อมูลแยกจากบัญชีจริง') + '<a href="#" data-open-preferences>ราคาและสูตรทดลอง</a>';
  }
  async function navigate(next) {
    if (next==='explore') next='hub';
    if(PANEL_NAMES[next]){
      const room=ROOM_ROUTES[next];
      if(room){if(preview&&!read().event.closed&&!await perform({type:'enter-room',room},{silent:true}))return;activeRoom=room;}
      showPanel(next);history.replaceState(null,'','#'+next);return;
    }
    if (detail.open) { activeRoom=null;detail.close(); }
    if(preview&&store&&!read().event.closed){
      if(ROOM_ROUTES[next]&&!await perform({type:'enter-room',room:ROOM_ROUTES[next]},{silent:true}))return;
      if(next==='hub'&&!await perform({type:'enter-hub'},{silent:true}))return;
    }
    route = next; history.replaceState(null,'','#' + next); render();
    main.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'});
  }
  function currentBiome() { return Core.biomeAt(read(),config,Date.now()).id; }
  // ข้อมูลหัวหมู่บ้าน: ของที่เควสตอนนี้ใช้ (มี/ต้องใช้) + ดวงสะสม + โหมดเคาะที่เลือกไว้
  function villageInfo(){
    const doc=read(),biome=currentBiome(),needs=Core.questNeeds(doc,config,biome,Date.now()),O=window.HalloweenObjective,pity=Core.pityTargets(doc,config,biome,Date.now());
    const items=(needs?.requirements?.items||[]).filter(x=>!x.mustBePlayerGrown&&x.consume!==false&&Guide.sources(config,x.id).some(s=>s.kind==='house')).map(x=>({kind:'item',id:x.id,name:O.itemName(config,x.id),icon:O.icon(x.id),need:x.quantity,have:doc.event.inventory[x.id]||0}));
    return {need:items,npc:O.NPC[Core.BIOMES.indexOf(biome)],choice:prefs.knockChoice,luck:pity.wanted.length?{value:doc.event.luck?.[pity.quest]||0,threshold:pity.threshold}:null};
  }
  // เคาะทันทีด้วยโหมดที่เลือก แล้วโชว์ผลในหน้าเดิม (ไม่เปิดหน้าต่างซ้อนสองชั้นเหมือนเดิม)
  async function knock(n){
    const before=currentObjective(),choice=prefs.knockChoice==='trick'?'trick':'treat';
    const door=detail.querySelector('[data-knock="'+n+'"]');door?.classList.add('knocking');
    const result=await perform({type:'house',house:n,choice});
    if(!result){door?.classList.remove('knocking');return;}
    showKnockResult(n,result,before);
  }
  function showKnockResult(n,result,before){
    const O=window.HalloweenObjective,found=result.item,after=currentObjective(),ready=!!after?.ready&&!before?.ready;
    const card=document.createElement('section');
    card.className='knock-result '+(found?(result.wanted?'hit':'found'):result.candy?'miss':'zero');card.setAttribute('role','status');
    const itemLine=found?'<div class="kr-item"><span class="kr-icon">'+O.icon(found.id)+'</span><div><b>'+esc(O.itemName(config,found.id))+'!</b><small>'+(result.wanted?'ของที่ '+esc(O.NPC[Core.BIOMES.indexOf(currentBiome())])+' ตามหา ✓':'เก็บเข้ากระเป๋าแล้ว · '+found.rarity)+(found.pity?' · 🔮 ดวงสะสมการันตี':found.breakthrough?' · ✦ ทะลุมิติจาก'+esc(Guide.names[found.biome]):'')+'</small></div></div>':'<p class="kr-none">'+(result.candy?'รอบนี้ไม่มีของติดมา':'Trick ได้ 0 — ผีแกล้งกลับ!')+(result.luck?' · 🔮 ดวงสะสม '+result.luck.value+'/'+result.luck.threshold:'')+'</p>';
    card.innerHTML='<div class="kr-burst" aria-hidden="true"></div><span class="kr-house">บ้าน '+n+(result.candy?' เปิดประตู!':' ไม่เปิด…')+'</span><b class="kr-candy">'+(result.candy?'+'+result.candy:'0')+' <small>Candy</small></b>'+itemLine+(ready?'<button class="obj-go kr-ready" data-objective-go>ของครบแล้ว! ส่งให้ '+esc(after.npc)+' ▶</button>':'');
    const panel=detail.querySelector('.village-lane');if(!panel)return;
    detail.querySelector('.knock-result')?.remove();
    detail.querySelector('.village-hunt')?.after(card);
    card.scrollIntoView({block:'nearest',behavior:reduced()?'instant':'smooth'});
    audio.play(found?'harvest':result.candy?'coins':'ghost');
    if(found&&!reduced()){
      const from=card.querySelector('.kr-icon'),slot=detail.querySelector('.village-hunt [data-need="'+found.id+'"]');
      if(from&&slot){
        const a=from.getBoundingClientRect(),b=slot.getBoundingClientRect(),fly=document.createElement('span');
        fly.className='kr-fly';fly.textContent=from.textContent;fly.style.left=a.left+'px';fly.style.top=a.top+'px';document.body.append(fly);
        const dx=b.left+b.width/2-(a.left+a.width/2),dy=b.top+b.height/2-(a.top+a.height/2);
        fly.animate([{transform:'translate(0,0) scale(1.2)',opacity:1},{transform:'translate('+dx*0.5+'px,'+(dy*0.5-60)+'px) scale(1.4)',opacity:1,offset:.5},{transform:'translate('+dx+'px,'+dy+'px) scale(.6)',opacity:.2}],{duration:750,easing:'cubic-bezier(.3,.7,.4,1)',delay:350}).finished.then(()=>{fly.remove();slot.classList.add('pop');});
      }
    }
  }
  function worldContext() { return {Core,Catalog,config,doc:read(),now:Date.now(),name,duration,difficulty:biomeDifficulty}; }
  function worldToolbar() {
    return '<div class="scene-hud"><div class="hud-top"><a class="hud-studentos" href="../../" aria-label="กลับระบบหลัก StudentOS">← StudentOS</a><span class="hud-wallet" title="Candy ห้องลอง">◈ <b data-scene-wallet>'+read().event.candy.toLocaleString('th-TH')+'</b></span><button data-toggle-scene-sound aria-label="'+(prefs.sound?'ปิดเสียง':'เปิดเสียง')+'">'+(prefs.sound?'♫':'♪')+'</button><button class="hud-motion" data-toggle-scene-motion aria-label="'+(reduced()?'เปิดอนิเมชัน':'หยุดอนิเมชัน')+'">'+(reduced()?'▶':'Ⅱ')+'</button><button data-open-preferences aria-label="ตั้งค่า">⚙</button></div>'+(route!=='hub'&&route!=='gate'?'<button class="scene-return" data-route="hub" aria-label="กลับโถงกลาง"><span aria-hidden="true">↶</span><b>โถงกลาง</b></button>':'')+window.HalloweenJournal.cover()+'</div>';
  }
  function rememberPrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch{}}
  async function syncSoundUI(){document.querySelectorAll('[data-toggle-scene-sound]').forEach(b=>{b.textContent=prefs.sound?'♫':'♪';b.setAttribute('aria-label',prefs.sound?'ปิดเสียง':'เปิดเสียง');b.setAttribute('aria-pressed',String(prefs.sound));});await audio.setEnabled(prefs.sound);document.documentElement.dataset.sound=audio.state().playing?'on':prefs.sound?'waiting':'off';}
  function showJournal(page='index'){
    journalPage=['index','quests','vault','map','guide','tasks'].includes(page)?page:'index';
    if(journalPage==='guide'&&!prefs.guideSeen){prefs.guideSeen=true;rememberPrefs();}
    const content={quests:questList,vault:inventory,tasks}[journalPage];
    openDetail(window.HalloweenJournal.render({page:journalPage,content:content?.(),Guide,objective:currentObjective(),place:activeRoom||route,biomeName:biomeName(currentBiome()),candy:read().event.candy,garden:Core.gardenUnlocked(read()),portrait:window.HalloweenWorld.portrait('vesper'),biomes:Core.BIOMES.map(id=>({...Core.biomeProgress(read(),config,id),name:Guide.names[id]}))}),()=>history.replaceState(null,'','#'+route));
    activePanel='journal';detail.dataset.scenePanel='journal';detail.dataset.journalPage=journalPage;
    detail.querySelector('.journal-paper').scrollTop=0;const pageFocus=detail.querySelector('[aria-current=page]')||detail.querySelector('#detailHeading');pageFocus.tabIndex=pageFocus.tagName==='BUTTON'?0:-1;pageFocus.focus({preventScroll:true});
    if(journalPage==='vault'){const b=document.createElement('button');b.className='primary';b.dataset.equipment='';b.textContent='อาวุธ · ถือและสวมใส่';detail.querySelector('.inventory-tabs').prepend(b);}
  }
  function showGuide(){prefs.guideSeen=true;rememberPrefs();showJournal('guide');}
  function showTutor(){
    prefs.guideSeen=true;rememberPrefs();
    const o=currentObjective(),line=o?'คืนนี้ประตู'+o.biomeName+'เปิดอยู่ ไปหา '+o.npc+' ที่นั่น เขาจะบอกว่าต้องการอะไร… ไม่ต้องกังวล แถบ “ภารกิจตอนนี้” ด้านล่างจะคอยบอกทางเจ้าเสมอ':'เลือกประตูที่เรืองแสง แล้วไปคุยกับผู้ดูแลไบโอม';
    openDetail(dialogShell('เวสเปอร์ · ผู้แนะนำการเดินทาง',npcSpeech('vesper',line)+'<div class="tutor-notes"><p><b>ป้ายทอง</b> คือจุดที่ควรกดตอนนี้</p><p><b>🔒</b> ยังเล่นไม่ได้ แตะดูว่าต้องทำอะไรก่อน</p><p><b>สมุดมุมบน</b> มีเควส กระเป๋า และวิธีเล่น</p></div>','<button class="secondary" data-close-detail>ขอลองเอง</button><button class="secondary" data-journal-page="guide">วิธีเล่น 3 ข้อ</button>'+(o?'<button class="primary" data-objective-go>'+esc(o.action.label)+' ▶</button>':'')));
  }
  function sourceButton(id,attrs=''){return '<button class="item-source-button" data-item-source="'+esc(id)+'" '+attrs+'>ดูวิธีหา</button>';}
  function percent(value){return (value*100).toLocaleString('th-TH',{maximumFractionDigits:2})+'%';}
  function showSources(id,back={}){
    sourceReturn=back;const priority=s=>s.kind==='game'?-4:s.biome===currentBiome()?-3:0;
    const origin=Guide.sources(config,id),home=origin.filter(s=>s.kind==='house');
    const farms=home.length?Core.BIOMES.map(b=>({kind:'house',biome:b,rarity:home[0].rarity,native:home.some(s=>s.biome===b)})):[];
    const sources=[...farms,...origin.filter(s=>s.kind!=='house')].sort((a,b)=>priority(a)-priority(b)),best=Balance.best(config,id);
    const content=sources.map(s=>{
      if(s.kind==='boss')return '<article class="source-card"><h3>รางวัลจาก '+esc(config.proposals.bosses[s.boss].name)+'</h3><button class="primary" data-boss="'+s.boss+'">ดูการท้าทาย</button></article>';
      if(s.kind==='house'){
        const open=Core.portalStatus(read(),config,s.biome,Date.now()).open,p=Balance.chance(config,id,s.biome);
        return '<article class="source-card"><h3>เคาะบ้านใน'+Guide.names[s.biome]+'</h3><p>'+(s.native?'ออกบ่อยที่สุดที่นี่':'ออกนาน ๆ ครั้ง (ทะลุมิติมาจาก'+home.map(x=>Guide.names[x.biome]).join(' / ')+')')+' · ระดับ '+s.rarity+' · Treat 1 ครั้งมีโอกาส '+percent(p)+' · เฉลี่ยราว '+(1/p).toLocaleString('th-TH',{maximumFractionDigits:1})+' ครั้งต่อ 1 ชิ้น · 🔮 ดวงสะสมช่วยการันตีของระดับ Common/Uncommon ที่เควสตอนนี้ขาด</p><p class="tiny">'+(open?'ประตูนี้เปิดอยู่':'ประตูยังปิด รอรอบหรือใช้ Totem เปิดเส้นทางส่วนตัว')+'</p>'+(open?'<button class="primary" data-source-village="'+s.biome+'">ไปเคาะบ้านที่นี่</button>':'<button class="secondary" data-route="totems">ดูเส้นทาง Totem</button>')+'</article>';
      }
      if(s.kind==='quest')return '<article class="source-card"><h3>'+(s.upgrade?'ปลดข้อจำกัดในเควส ':'รางวัลเควส ')+s.order+' · '+esc(s.npc)+'</h3><p>อยู่ใน'+Guide.names[s.biome]+' ทำตามคำขอและส่งเควสให้ครบเฟส'+(s.upgrade?' ต้องมีไอเท็มชิ้นเดิมก่อน ไม่ได้รับเพิ่มอีกชิ้น':'')+'</p><button class="secondary" data-quest="'+s.quest+'">อ่านเควสนี้</button></article>';
      if(s.kind==='game')return '<article class="source-card"><h3>ผ่านเกมล่าสมบัติเรือผี</h3><p>รับโคมจาก Tang ก่อน แล้วผ่านเกมเรือเพื่อรับ Soul Anchor 1 ชิ้นพร้อม Candy</p><button class="secondary" data-quest="dutchman-light-in-darkness">ดูเควสรับโคมกับ Tang</button></article>';
      if(s.kind==='seed')return '<article class="source-card"><h3>เมล็ดจากเควสใน'+Guide.names[s.biome]+'</h3><p>ทำเควสหลักสำเร็จเพื่อรับเมล็ด หลังเคยทำสำเร็จแล้วขอเมล็ดเพิ่มผ่านคำขอในแปลงได้</p><button class="secondary" data-route="quests">ดูเควส</button></article>';
      if(s.kind==='garden')return '<article class="source-card"><h3>ปลูกและเก็บในสวนรัตติกาล</h3><p>รับเมล็ดจากเควส ปลูก รดน้ำ รอจนโตแล้วกดเก็บ ต้องเป็นผลผลิตที่ปลูกเอง</p><button class="primary" data-route="garden">ไปสวน</button></article>';
      const location={shop:['ร้านมอร์โร','shop'],cauldron:['เตาของมอรา','cauldron-recipes'],ritual:['วงเวทอัญเชิญ','ritual-recipes'],potion:['แม่มดมอรา','cauldron']}[s.kind];
      return location?'<article class="source-card"><h3>'+location[0]+'</h3><p>เตรียม Candy และวัตถุดิบตามรายการก่อนรับของ</p><button class="secondary" data-route="'+location[1]+'">ไปที่นี่</button></article>':'';
    }).join('');
    openDetail(dialogShell('วิธีหา '+esc(name(id)),'<p class="guide-intro">'+esc(Guide.summary(config,id))+'</p>'+content+(!sources.length?'<p class="subtle">ไอเทมนี้ยังไม่มีจุดรับในกติกาที่เปิดอยู่</p>':'')+(best.chance?'<p class="tiny">แนะนำ Treat สำหรับหาวัตถุดิบ · บ้านที่เคาะแล้วพัก 4 ชั่วโมง · อัตราของตามรายการล่าสุด · เวลาและราคาอื่นยังเป็นค่าห้องลอง</p>':''),'<button class="secondary" data-source-back>กลับ</button>'));
  }
  async function goToVillage(biome=currentBiome()){
    if(!Core.portalStatus(read(),config,biome,Date.now()).open){toast('ไบโอมนี้ยังไม่เปิดในรอบนี้',true);return;}
    if(detail.open){activeRoom=null;activePanel=null;detailAfterClose=null;await new Promise(resolve=>{detail.addEventListener('close',resolve,{once:true});detail.close();});}
    if(!await perform({type:'enter-biome',biome},{silent:true}))return;
    await navigate('biome');await navigate('village');
  }
  function showBalance(){
    const cards=Core.BIOMES.map(biome=>{
      const qs=config.quests.filter(q=>q.biome===biome),rows=qs.map(q=>({q,d:Balance.difficulty(config,q)})),hardest=rows.reduce((a,b)=>a.d.level>=b.d.level?a:b);
      return '<article class="source-card"><h3>'+esc(qs[0].npc)+' · '+Guide.names[biome]+'</h3><span class="difficulty" data-level="'+hardest.d.level+'">'+hardest.d.label+'</span><p>โอกาสได้วัตถุดิบสักชิ้นจาก Treat '+percent(Balance.anyItemChance(config,biome))+' ต่อครั้ง รวมโอกาสข้ามไบโอมแล้ว ทุกระดับมีของครบ</p>'+rows.map(({q,d})=>'<p><b>เควส '+q.order+' · '+d.label+'</b><br>'+(d.bottleneck?'ของบ้านรวมเฉลี่ย '+Math.ceil(d.expectedDraws)+' ครั้ง · คอขวด '+esc(name(d.bottleneck.id))+' '+d.bottleneck.need+' ชิ้น':'เน้น'+(d.game?'มินิเกม':'ทำเงื่อนไขเควส'))+(d.nextCycle?' · ต้องรอไบโอมรอบถัดไป':'')+(d.boss?' · ต้องชนะบอสก่อนรับธีม':'')+'</p>').join('')+'</article>';
    }).join('');
    const four=Balance.cooldownComparison(config,4),one=Balance.cooldownComparison(config,1);
    openDetail(dialogShell('โอกาสได้ของและความยาก','<p class="guide-intro">คำนวณจากตารางของล่าสุด ใช้ Treat สมมติเปลี่ยนไบโอมได้ทันทีและไม่มีค่าเดินทาง คิดการสะสมของทุกชิ้นร่วมกัน เป็นค่าเฉลี่ยทางสถิติ ไม่ใช่เวลาที่รับประกันว่าจะจบเควส</p><p class="tiny">ตารางนี้เริ่มของจากศูนย์ ผู้เล่นใหม่เริ่มสะสมเอง ของที่มีอยู่ช่วยลดภาระได้ ส่วนระดับในหน้าคุยเควสคิดจากของที่คุณยังขาดอยู่</p><div class="guide-grid">'+cards+'</div><h3>บ้านพัก 4 ชม. เทียบแนวคิด 1 ชม.</h3><p class="subtle">สมมติอยู่ไบโอมเดิมและเคาะครบ 5 หลังทุกรอบ: ทั้งสองแบบติดเพดาน 300 Candy หลัง Treat '+four.attempts+' ครั้ง ซึ่งมีจังหวะสุ่มของเฉลี่ย '+four.expectedDraws+' ครั้งทุกระดับมีของแล้ว แบบ 4 ชม. ใช้ประมาณ '+four.capHours+' ชม. ส่วน 1 ชม. ใช้ '+one.capHours+' ชม. จึงใช้โควตาเร็วขึ้น แต่ไม่ได้เพิ่มโควตาของต่อ 24 ชม.</p><p class="tiny">1 ชั่วโมงยังไม่ยืนยัน · การหมุนไบโอมทุก 6 ชั่วโมงและค่า Totem อาจทำให้เวลาที่เล่นจริงต่างจากสมมติฐานนี้</p><h3>งาน StudentOS เป็นอีกทางหา Candy</h3><p class="subtle">รับเควสมรณะจากสมุด แล้วทำงานที่เสกเข้า StudentOS เปิดโฟกัสให้ครบ 20 นาทีและกดทำเสร็จ รับเควสละ '+config.proposals.taskCandy+' Candy เพดาน '+config.proposals.taskDailyCap+' Candy ใน 24 ชั่วโมง แยกจากเพดานบ้าน รางวัลยังอยู่เฉพาะห้องลอง ส่วนการยืนยันเพื่อนใหม่ยังไม่เปิด</p>','<button class="secondary" data-close-detail>กลับฉาก</button><button class="primary" data-route="tasks">ดูภารกิจ StudentOS</button>'));
  }
  function syncMotionUI(){document.documentElement.dataset.motion=reduced()?'still':'full';document.querySelectorAll('[data-toggle-scene-motion]').forEach(b=>{b.textContent=reduced()?'▶':'Ⅱ';b.setAttribute('aria-label',reduced()?'เปิดอนิเมชัน':'หยุดอนิเมชัน');});if(reduced())finishTyping();}
  function npcSpeech(id,line){
    const npc=window.HalloweenNPCs.characters[id];
    return '<div class="npc-conversation"><div class="npc-portrait">'+window.HalloweenWorld.portrait(id)+'</div><div><small>'+esc(npc.role)+'</small><p class="npc-line">'+esc(line)+'</p></div></div>';
  }
  function showNPC(id,topic='greeting'){
    const npc=window.HalloweenNPCs.characters[id];if(!npc?.greeting)return;
    const line=npc.topics[topic]?.line||npc.greeting;
    const choices='<div class="npc-topics">'+Object.entries(npc.topics).map(([key,t])=>'<button class="quiet-button" data-npc="'+id+'" data-topic="'+key+'">'+esc(t.label)+'</button>').join('')+'</div>';
    const actions=npc.actions.map(a=>'<button class="primary" '+(a.route?'data-route="'+a.route+'"':a.action==='potion'?'data-open-potion':'data-trade')+'>'+esc(a.label)+'</button>').join('');
    openDetail(dialogShell(esc(npc.name),npcSpeech(id,line)+choices,'<button class="secondary" data-close-detail>ไว้คุยกันใหม่</button>'+actions+(id==='vesper'?'<button class="primary" data-boss-list>ถามถึงบัลลังก์เที่ยงคืน</button>':'')));
  }
  function showEquipment(){
    const doc=read();
    openDetail(dialogShell('อาวุธของนักผจญภัย','<div class="equipment-hero">'+window.HalloweenWorld.hero(worldContext())+'</div><p class="subtle">อาวุธที่ได้รับจากเควสถือได้จริงและใช้สู้บอส เปลี่ยนชิ้นที่ถือได้ที่นี่ อาวุธไม่หายเมื่อแพ้หรือถอยกลับ</p><div class="equipment-grid">'+Object.entries(config.proposals.weapons).map(([id,w])=>{
      const s=Core.weaponStatus(doc,config,id),q=config.quests.find(q=>q.rewards.some(r=>r.id===id&&r.kind!=='upgrade-existing'));
      return '<article class="equipment-card"><div class="weapon-preview">'+window.HalloweenWorld.weaponArt(w.type,w.color)+'</div><h3>'+esc(w.name)+'</h3><p class="weapon-skill"><b>'+esc(window.HalloweenCombat.skillInfo(w).name)+'</b><br>'+esc(window.HalloweenCombat.skillInfo(w).description)+'</p><p>พลัง '+w.power+' · '+(s.usable?'พร้อมถือ':s.reason)+'</p>'+(s.usable?'<button class="primary" data-equip-weapon="'+id+'" '+(doc.event.equipment===id?'disabled':'')+'>'+(doc.event.equipment===id?'กำลังถือ':'ถืออาวุธนี้')+'</button>':'<button class="secondary" data-quest="'+(s.owned?'win-unbind-scythe':q.id)+'">ดูเควสรับ / ปลดผนึก</button>')+'</article>';
    }).join('')+'</div>','<button class="secondary" data-route="vault">กลับกระเป๋า</button>'));
  }
  function showBoss(id){
    const status=Core.bossStatus(read(),config,id,Date.now()),rule=status.rule;if(!rule)return;
    const usable=Core.weaponStatus(read(),config,read().event.equipment).usable;
    openDetail(dialogShell(esc(rule.name),'<div class="boss-card-head">'+window.HalloweenBattleUI.bossArt(rule)+'<div><span class="difficulty" data-level="5">'+esc(rule.level)+'</span><p>พลังชีวิต '+rule.hp+' · โจมตี '+rule.damage+'</p></div></div><p class="npc-line">'+esc(rule.intro)+'</p><p class="subtle">อ่านช่องโจมตีที่บอสบอก เลือกหลบ ตั้งรับ หรือใช้ท่าอาวุธ เป็นการต่อสู้ทีละเทิร์น แพ้ลองใหม่ได้โดยไม่เสียอาวุธ</p><p class="boss-unlock-note">'+(status.won?'✓ พิชิตและรับรางวัลแล้ว':!status.unlocked?esc(status.reason):!usable?'ต้องถืออาวุธที่ใช้ได้ก่อนเริ่มต่อสู้':rule.theme?'ชนะจึงได้รับธีม '+esc(config.rewards[rule.theme].name):id==='midnight-sovereign'?'รางวัล: Halloween + Moon & Candle + ตราผู้พิชิต':'รางวัล: มงกุฎเงาไร้นาม และบทส่งท้ายลับ')+'</p>',
      '<button class="secondary" data-close-detail>กลับฉาก</button><button class="secondary" data-equipment>เลือกอาวุธ</button>'+(!status.won?'<button class="primary" data-start-boss="'+id+'" '+(!status.unlocked||!usable||read().event.closed?'disabled':'')+'>เริ่มต่อสู้</button>':'')));
  }
  function showBossList(){
    const doc=read(),ids=['midnight-sovereign'];if(doc.event.bossWins?.['midnight-sovereign']&&doc.rewards['theme-midnight-academy'])ids.push('nameless-afterlight');
    openDetail(dialogShell('บัลลังก์เที่ยงคืน','<p class="subtle">จบเควสและชนะผู้พิทักษ์สี่ไบโอม รับธีมทั้งสี่ แล้วกลับมาท้าราชันเพื่อรับธีมทั้งสองโทนพร้อมตราชัยชนะ</p><div class="boss-list">'+Object.entries(config.proposals.bosses).filter(([id,b])=>b.biome||ids.includes(id)).map(([id,b])=>{
      const s=Core.bossStatus(doc,config,id,Date.now());return '<article class="boss-card"><div class="boss-card-head">'+window.HalloweenBattleUI.bossArt(b)+'<div><h3>'+esc(b.name)+'</h3><small>'+esc(b.level)+'</small></div></div><p>'+(s.won?'✓ พิชิตแล้ว':s.unlocked?'พร้อมท้าสู้':esc(s.reason))+'</p><button class="secondary" data-boss="'+id+'">ดูการท้าทาย</button></article>';
    }).join('')+'</div>','<button class="secondary" data-close-detail>กลับวงเวท</button>'));
  }
  async function openBattle(id){
    const biome=config.proposals.bosses[id]?.biome;
    if(biome){if(!await perform({type:'enter-biome',biome},{silent:true}))return;activeRoom=null;route='biome';history.replaceState(null,'','#biome');render();}
    await window.HalloweenBattleUI.open(id,{read,config,perform,context:worldContext,onClose:()=>{render();showBoss(id);},onRewards:ids=>acquisition(ids,'quest')});
  }
  function showPotion(){
    const quantity=read().event.inventory['random-biome-potion']||0,rule=config.proposals.randomBiomePotion,canBuy=activeRoom==='cauldron',closed=read().event.closed;
    const bottle='<svg class="potion-icon" viewBox="0 0 32 48" shape-rendering="crispEdges" aria-hidden="true"><path d="M11 1h10v7H11z" fill="#b59a72"/><path d="M10 8h12v12l7 7v16l-4 4H7l-4-4V27l7-7z" fill="#213c54" stroke="#a2b9bf" stroke-width="2"/><path d="M6 29h20v12l-3 3H9l-3-3z" fill="#9a72bf"/><path d="M8 29h6v3H8zm2 8h3v4h-3z" fill="#d5c0d9"/><path d="M14 11h3v10h-3z" fill="#c3d8d6"/></svg>';
    openDetail(dialogShell('น้ำยาหลงไบโอม',bottle+'<p class="subtle">ดื่ม 1 ขวดเพื่อสุ่มเดินทางไปไบโอมอื่นจากอีก 3 แห่ง เป็นเวลา 15 นาที คูลดาวน์บ้านและวัฏจักรเควสยังใช้เวลาเดิม</p><p class="plot-inventory">มี '+quantity+' ขวด</p><p class="tiny">ราคา '+rule.price+' Candy และระยะเวลาเป็นค่าห้องลอง</p>','<button class="secondary" data-close-detail>เก็บไว้ก่อน</button>'+(canBuy?'<button class="secondary" data-buy-potion '+(closed||read().event.candy<rule.price?'disabled':'')+'>ซื้อ 1 ขวด · '+rule.price+' Candy</button>':'<button class="secondary" data-route="cauldron">ไปหามอรา</button>')+'<button class="primary" data-drink-potion '+(!quantity||closed?'disabled':'')+'>ดื่มน้ำยา</button>'));
  }
  async function drinkPotion(button){
    button.disabled=true;const result=await perform({type:'drink-biome-potion'},{silent:true});if(!result){button.disabled=false;return;}
    activePanel=null;activeRoom=null;route='biome';detail.close();history.replaceState(null,'','#biome');render();
    const shift=document.createElement('div');shift.className='biome-shift';shift.innerHTML='<div class="shift-rings" aria-hidden="true"></div><p>ม่านหมอกพาเจ้ามาถึง<br><b>'+esc(biomeName(result.biome))+'</b></p>';main.append(shift);
    setTimeout(()=>{shift.remove();if(result.firstStory)showStory(result.biome);else toast('เดินทางถึง '+biomeName(result.biome));},reduced()?80:1150);
  }
  function showTrade(){market.setMode('sell');showPanel('shop-stock');}
  function showPlot(id){
    if(!config.proposals.crops[id])return;
    const s=window.HalloweenWorld.cropState(worldContext(),id),attrs=' data-crop-biome="'+id+'"',doc=read(),first=config.quests.find(q=>q.biome===id),done=config.quests.some(q=>q.biome===id&&doc.event.quests[q.id]?.complete);
    const stage=!s.unlocked?'รับแปลงจาก Jack ก่อน':!s.planted?'แปลงว่าง พร้อมปลูก':s.ready?'โตเต็มที่แล้ว เก็บเกี่ยวได้':'กำลังเติบโต';
    const actions=!s.unlocked?'<button class="primary" data-quest="jack-clear-garden">ไปดูเควส Jack</button>':!s.planted?'<button class="primary" data-action="plant"'+attrs+' '+(!s.seeds||doc.event.closed?'disabled':'')+'>ปลูกเมล็ด</button>':'<button class="secondary" data-action="water"'+attrs+' '+(s.g.watered||doc.event.closed?'disabled':'')+'>รดน้ำ</button><button class="primary" data-action="harvest"'+attrs+' '+(!s.ready||doc.event.closed?'disabled':'')+'>เก็บเกี่ยว</button>';
    const repeat=!s.unlocked?'<p>สวนทุกแปลงยังล็อกอยู่ จบเควสแรกของ Jack ก่อน เมล็ดที่ได้รับจาก NPC คนอื่นจะเก็บรอไว้ในกระเป๋า</p>':done?(currentBiome()===id?'<p>ส่ง '+esc(name(s.crop.request))+' 2 ชิ้นเพื่อทำเควสรับเมล็ดเพิ่ม 2 ชิ้น</p><button class="secondary" data-seed-quest="'+id+'">ส่งเควสรับเมล็ดเพิ่ม</button>':'<p>ผ่านเควสแล้ว ขอเมล็ดเพิ่มได้เมื่อ'+esc(biomeName(id))+' เปิดอยู่ ส่วนเมล็ดที่มีนำมาปลูกต่อได้ทันที</p><button class="secondary" data-route="totems">ดูเส้นทางไบโอม</button>'):'<p>ทำเควสกับ NPC ใน '+esc(biomeName(id))+' เพื่อรับเมล็ด</p><button class="secondary" data-quest="'+first.id+'">ดูเควสประจำไบโอม</button>';
    openDetail(dialogShell('แปลง'+esc(s.crop.name),'<p class="plot-inventory">เมล็ด '+s.seeds+' · ผลผลิตที่เก็บแล้ว '+s.harvested+'</p><h3 class="crop-stage-title">'+stage+'</h3><p class="subtle">'+(!s.planted?'ปลูกด้วยเมล็ดจากเควส 1 ชิ้น รดน้ำแล้วรอให้โต':(s.g.watered?'รดน้ำแล้ว':'ยังไม่ได้รดน้ำ')+' · <span data-crop-countdown data-biome="'+id+'" data-until="'+s.until+'">'+duration(s.until-now())+'</span>')+'</p><div class="crop-actions">'+actions+'</div><div class="seed-request">'+repeat+'</div><p class="tiny">เวลาโต 1 นาที ผลผลิต 3 ชิ้นเป็นค่าห้องลอง</p>','<button class="secondary" data-close-detail>กลับสวน</button><button class="primary" data-route="shop">นำผลผลิตไปหาพ่อค้า</button>'));
    detail.dataset.plotBiome=id;
  }
  function showStory(id) {
    const index=biomeIndex(id), q=config.quests.find(q=>q.biome===id);
    const sea="ในช่วงเวลาที่ทะเลถูกปกคลุมด้วยหมอกหนา เสียงระฆังจากเรือที่สูญหายไปนานจะดังขึ้นกลางมหาสมุทร\n\nเรือ Dutchman's Soul ปรากฏตัวเพียงชั่วครู่ ก่อนจะหายไปในม่านหมอก ผู้ที่ต้องการค้นพบสมบัติของมันต้องรวบรวมเบาะแสและตามหาแสงไฟจากเรือผีให้พบ ก่อนรุ่งสางจะมาถึง";
    openDetail(dialogShell(esc(biomeName(id)),'<img class="story-image" src="assets/world-'+Core.SHORT[index]+'.png" alt="'+esc(biomeName(id))+'"><p class="story-npc">'+esc(q.npc)+'</p><div class="story-copy npc-line">'+esc(index===0?sea:q.phases[0].acceptDialogue)+'</div>','<button class="primary" data-finish-story="'+id+'">เริ่มสำรวจ →</button>'));
  }
  function visitors(biome) {
    const doc = read(), rule = config.proposals.anonymousNpc, slot = Math.floor(now()/rule.lifetimeMs);
    const common = config.materials.biomes.find(b => b.id===biome).items.filter(x => x.rarity==='Common');
    return Array.from({length:rule.count},(_,i) => {
      const id = common[i%common.length]?.id || (i ? 'pending-human-skull' : 'pending-human-bone'), done = doc.event.visitors[slot+':'+i];
      return '<article class="visitor-card"><span aria-hidden="true">♙</span><div><b>นักเดินทางนิรนาม ' + (i+1) + '</b><small>' + esc(name(id)) + ' ×' + rule.quantity + ' → ' + rule.candy + ' Candy</small></div><button class="secondary" data-visitor="' + i + '" ' + (done || doc.event.closed ? 'disabled' : '') + '>' + (done ? 'ส่งแล้ว' : 'ส่งของ') + '</button></article>';
    }).join('');
  }
  function showVisitors(){openDetail(dialogShell('นักเดินทางในม่านหมอก','<p class="story-copy">ระหว่างทางยังมีคนรอความช่วยเหลืออยู่ ลองฟังคำขอของพวกเขา</p><div class="visitor-grid">'+visitors(currentBiome())+'</div>','<button class="secondary" data-close-detail>กลับไปสำรวจ</button>'));}
  function shop() { return market.view(); }
  function houseRuleSummary(){
    return '<p class="guide-intro">ทุกไบโอมมีบ้าน 5 หลัง · Treat ได้ 10 Candy แน่นอน · Trick สุ่ม 50/50 ได้ 20 หรือ 0 Candy เฉพาะครั้งที่ได้ Candy จึงสุ่มของตามขั้นตอนนี้</p><ol class="guide-steps"><li><h3>1 · มีของตามมา 60%</h3><p>อีก 40% ได้ Candy อย่างเดียว ถ้า Trick ได้ 0 จะไม่สุ่มของ</p></li><li><h3>2 · สุ่มระดับไอเท็ม</h3><div class="house-rules">'+Object.entries(config.materials.houseItems.rarityWeightsPercent).map(([r,n])=>'<span>'+r+' '+n+'%</span>').join('')+'</div><p>Mystical ได้จากเควสหลักของ NPC เท่านั้น ไม่อยู่ในกล่องบ้าน</p></li><li><h3>3 · Breakthrough 10%</h3><p>ถ้าติด Breakthrough สุ่มปลายทางอีก 1 ใน 4 รวมไบโอมปัจจุบัน ถ้าไม่ติดใช้พูลไบโอมที่เคาะอยู่ จึงออกไบโอมเดิมรวม 92.5% และแต่ละไบโอมอื่น 2.5%</p></li></ol><p class="subtle">จากนั้นสุ่มของในระดับและไบโอมที่ได้เท่า ๆ กัน 1 ชิ้น ทุกระดับมีของครบทุกไบโอม วัตถุดิบชิ้นเดียวกันใช้ส่งเควส ผสม หรือทำพิธีได้เมื่อสูตรระบุไว้</p>';
  }
  function showItemPools(){
    openDetail(dialogShell('ของที่หาได้ · กติกาบ้าน',houseRuleSummary()+'<div class="guide-grid">'+config.materials.biomes.map(b=>'<section class="source-card"><h3>'+esc(b.name)+'</h3>'+b.items.map(item=>'<div class="pool-row"><span>'+esc(item.name)+'</span><small>'+item.rarity+'</small>'+sourceButton(item.id)+'</div>').join('')+'</section>').join('')+'</div>','<button class="secondary" data-close-detail>กลับฉาก</button>'));
  }
  function recipes(channel) {
    const doc=read(),ritual=channel==='ritual',list=config.proposals.recipes.filter(r=>r.channel===channel&&!r.retired);
    const recipe=list.find(r=>r.id===recipeSelection[channel])||list[0],item=config.rewards[recipe.reward],owned=!!doc.rewards[item.id];
    let blocked='';
    try{Core.checkRequirements(doc,{candy:recipe.candy,items:recipe.items.map(([id,quantity])=>({id,quantity}))});}catch(e){blocked=e.message;}
    if(recipe.requiresAllMainQuests&&!config.quests.filter(q=>q.finalMainQuest).every(q=>doc.event.quests[q.id]?.complete))blocked='จบ Main Quest ทั้งสี่คนก่อน';
    if(recipe.requiresBoss&&!doc.event.bossWins?.[recipe.requiresBoss])blocked='ชนะราชันเที่ยงคืนก่อน';
    if(doc.event.closed)blocked='อีเวนต์ปิดแล้ว';
    if(owned)blocked='รับรางวัลสูตรนี้แล้ว';
    return '<section class="workbench-scene '+(ritual?'ritual-workbench':'cauldron-workbench')+' '+(recipePrepared?'ingredients-prepared':'')+'"><p class="workbench-instruction">1 เลือกสูตร · 2 เตรียมของ · 3 ตรวจแล้ว'+(ritual?'เริ่มพิธี':'ผสม')+'</p><nav class="recipe-book" aria-label="เลือกสูตร">'+list.map(r=>'<button data-choose-recipe="'+r.id+'" aria-pressed="'+(r.id===recipe.id)+'"><img src="'+asset(config.rewards[r.reward])+'" alt=""><span>'+esc(name(r.reward))+'</span>'+(doc.rewards[r.reward]?'<small>✓ อยู่ในคลัง</small>':'')+'</button>').join('')+'</nav><div class="workbench-layout"><div class="craft-stage"><div class="craft-keeper npc-portrait">'+window.HalloweenWorld.portrait(ritual?'vesper':'mora')+'</div><div class="craft-vessel" aria-hidden="true">'+(ritual?'<span class="ritual-floor">✧</span>':'<svg class="pixel-brew-pot" viewBox="0 0 160 135" shape-rendering="crispEdges"><path d="M30 35H14v15H8v36h12V58h10m100-23h16v15h6v36h-12V58h-10" fill="#6b7183"/><path d="M35 35h90v12h10v56h-10v12h-14v12H96v-12H64v12H49v-12H35v-12H25V47h10z" fill="#303c52" stroke="#7c8296" stroke-width="4"/><path d="M33 31h94v8H33zM27 39h106v8H27z" fill="#a0a0ad"/><path class="brew-liquid" d="M40 34h80v7H40z" fill="#b696cd"/><path d="M37 57h9v38h-9zM46 95h13v8H46z" fill="#5c6b80"/><path d="M69 67h22v7H69zm-7 7h36v18H62zm7 18h22v7H69z" fill="#56627b"/><path d="M68 120h8v-7h8v7h8v9H68z" fill="#d2a267"/></svg>')+'</div><div class="craft-result"><img src="'+asset(item)+'" alt="'+esc(item.name)+'"></div><p>'+(recipePrepared?'ส่วนผสมพร้อมแล้ว ยังไม่หักของ':ritual?'เวสเปอร์รอคำยืนยันของเจ้า':'มอรารอให้เจ้าเลือกสูตร')+'</p></div><div class="recipe-manuscript"><span class="eyebrow">'+(ritual?'THE SUMMONING CIRCLE':'THE WITCH’S CAULDRON')+'</span><h3>'+esc(item.name)+'</h3><p>'+esc(item.description)+'</p><span class="item-tier" style="'+tierStyle(item)+'">'+item.rarity+'</span><div class="ingredient-tray">'+recipe.items.map(([id,n])=>{const have=doc.event.inventory[id]||0;return '<div class="ingredient-cup '+(have>=n?'ingredient-ready':'ingredient-missing')+'"><span aria-hidden="true">◈</span><b>'+esc(name(id))+'</b><small>มี '+have+' / ใช้ '+n+' · เหลือ '+Math.max(0,have-n)+'</small>'+sourceButton(id,'data-source-panel="'+channel+'-recipes"')+'</div>';}).join('')+'</div><p class="craft-price">◈ '+recipe.candy+' Candy · มี '+doc.event.candy+' → เหลือ '+Math.max(0,doc.event.candy-recipe.candy)+'</p>'+(blocked?'<p class="craft-blocked" role="status">'+esc(blocked)+'</p>':'<p class="craft-blocked" role="status">'+(recipePrepared?'ตรวจของพร้อมแล้ว ยืนยันเพื่อรับรางวัล':'มีส่วนผสมครบ เตรียมลง'+(ritual?'วงเวท':'หม้อ')+'ได้')+'</p>')+(recipe.requiresBoss?'<button class="quiet-button" data-boss-list>ดูบอสที่วงเวท</button>':'')+'<div class="craft-actions">'+(recipePrepared?'<button class="secondary" data-return-ingredients="'+channel+'">เก็บส่วนผสมคืน</button><button class="primary" data-craft="'+recipe.id+'" '+(blocked?'disabled':'')+'>'+(ritual?'ยืนยันเริ่มพิธี':'ยืนยันผสม')+'</button>':'<button class="primary" data-prepare-recipe="'+channel+'" '+(blocked?'disabled':'')+'>เตรียมส่วนผสม</button>')+'</div><p class="tiny">สูตรและราคาเป็นค่าห้องลอง ยืนยันจึงหักของและ Candy ครั้งเดียว</p></div></div></section>';
  }
  function theatre() {
    return '<section class="recipe-theatre"><span class="eyebrow">THE ART OF REVEAL</span><h2>ยิ่งหายาก ยิ่งมีเรื่องให้จดจำ</h2><p>ลองชมฉากรับรางวัลแต่ละระดับได้โดยไม่หัก Candy หรือเพิ่มของในคลัง</p><div class="tier-buttons">' + Object.keys(window.HalloweenAcquisition.profiles).map(tier => '<button data-theatre="' + tier + '">' + tier + '</button>').join('') + '</div></section>';
  }
  function questList() {
    const doc = read();
    return pageHead('FOUR STORIES TO REMEMBER','ทุกคำสัญญา มีเรื่องราว','คุยกับทั้งสี่ NPC ทำเควสทีละเฟส และเก็บของข้ามไบโอมไว้ส่งต่อกัน','14 เควส · 18 เฟส') + Core.BIOMES.map((biome,i) => {
      const meta = Catalog.biomes[Core.SHORT[i]], chain = config.quests.filter(q => q.biome===biome), done = chain.filter(q => doc.event.quests[q.id]?.complete).length;
      return '<section class="quest-chain" style="--biome:' + meta.color + ';--glow:' + meta.dark + '66"><div class="chain-head"><span class="chain-seal">' + biomeSymbols[i] + '</span><div><h2>' + esc(meta.npc) + '</h2><small>' + esc(meta.name) + '</small></div><span class="pill">' + done + ' / ' + chain.length + '</span></div><div class="chain-progress"><progress value="'+Core.biomeProgress(doc,config,biome).value+'" max="'+Core.biomeProgress(doc,config,biome).total+'" aria-label="ความคืบหน้า '+esc(meta.name)+'"></progress><span>'+Core.biomeProgress(doc,config,biome).percent+'% · '+(Core.biomeProgress(doc,config,biome).bossWon?'พิชิตผู้พิทักษ์แล้ว':'รวมการพิชิตผู้พิทักษ์')+'</span></div>' + chain.map(q => {
        const s = Core.questStatus(doc,config,q), status = s.complete ? (q.bossId&&!doc.event.bossWins?.[q.bossId]?'เควสสำเร็จ · รอชนะบอส':'รับรางวัลแล้ว') : !s.unlocked ? 'รอเควสก่อนหน้า' : q.biome!==currentBiome() ? 'อยู่ไบโอมอื่น' : 'เฟส ' + (s.phase+1) + '/' + q.phases.length;
        return '<button class="quest-row" data-quest="' + q.id + '"><span class="quest-order ' + (s.complete ? 'done' : '') + '">' + (s.complete ? '✓' : String(q.order).padStart(2,'0')) + '</span><div><h3>' + esc(q.name) + '</h3><p>' + q.rewards.map(r => esc(r.name)).join(' · ') + '</p></div><span class="quest-status ' + (s.complete ? 'done' : '') + '">' + status + '</span></button>';
      }).join('') + '</section>';
    }).join('');
  }
  function requirementRows(req,questId='',branch='') {
    const doc = read(), rows = [];
    if (req.candy) rows.push({label:'Candy', need:req.candy, have:doc.event.candy});
    for (const item of req.items || []) rows.push({id:item.id,label:item.name + (item.mustBePlayerGrown ? ' · ปลูกเอง' : '') + (item.consume===false ? ' · แสดง ไม่หักของ' : ''),need:item.consume===false && item.mustPossess ? 1 : item.quantity,have:item.mustBePlayerGrown ? doc.event.grown[item.id] || 0 : doc.event.inventory[item.id] || 0});
    if (req.objective) rows.push({label:req.objective.description,need:1,have:doc.event.proofs[req.objective.id]?.complete ? 1 : 0});
    if (req.minigame) {
      const m = req.minigame, proof = doc.event.proofs[m.id || 'ghost-ship-hunt'];
      rows.push({label:(m.mustComplete && !m.mustClear ? 'เล่นให้จบ: ' : 'ผ่าน: ') + (m.name || 'Ghost Ship Hunt'),need:1,have:(m.mustClear ? proof?.clear : proof?.complete) ? 1 : 0});
    }
    return rows.map(x => '<div class="requirement ' + (x.have<x.need ? 'missing' : '') + '"><div><span>' + esc(x.label) + '</span>'+(x.id?'<small class="source-summary">'+esc(Guide.summary(config,x.id))+'</small>'+sourceButton(x.id,'data-source-quest="'+questId+'" data-source-branch="'+esc(branch||'')+'"'):'')+'</div><b>' + x.have + ' / ' + x.need + '</b></div>').join('');
  }
  // ของ 1 แถวในหน้าเควส: ไอคอน · ชื่อไทย · มี/ต้องใช้ · หาที่ไหน (พร้อมโอกาสต่อการเคาะ)
  function needRow(x,questId,branch){
    const O=window.HalloweenObjective,got=x.have>=x.need,bio=currentBiome();
    let how='';
    if(x.id){
      const p=Balance.chance(config,x.id,bio);
      const pity=Core.pityTargets(read(),config,bio,Date.now()).wanted.some(w=>w.id===x.id);
      how=p>0?'เคาะบ้านใน'+Guide.names[bio]+' · ออกราว 1 ใน '+Math.max(1,Math.round(1/p))+' ครั้ง'+(pity?' · 🔮 ดวงสะสมการันตี':''):Guide.summary(config,x.id).replace(/ · ข้ามได้ด้วย Breakthrough/,'');
    }
    return '<div class="need-row'+(got?' got':'')+'"><span class="need-icon" aria-hidden="true">'+(x.icon||'◈')+'</span><div class="need-copy"><b>'+esc(x.label)+'</b>'+(x.en&&x.en!==x.label?'<small class="need-en">'+esc(x.en)+'</small>':'')+(how&&!got?'<small>'+esc(how)+'</small>':'')+(x.id&&!got?sourceButton(x.id,'data-source-quest="'+questId+'" data-source-branch="'+esc(branch||'')+'"'):'')+'</div><b class="need-count">'+(got?'✓ ':'')+x.have+'/'+x.need+'</b></div>';
  }
  function questNeedRows(req){
    const doc=read(),O=window.HalloweenObjective,rows=[];
    if(req.candy)rows.push({label:'Candy',icon:'🍬',need:req.candy,have:doc.event.candy});
    for(const item of req.items||[])rows.push({id:item.id,label:O.itemName(config,item.id)+(item.mustBePlayerGrown?' · ปลูกเอง':'')+(item.consume===false?' · แค่โชว์ ไม่หักของ':''),en:item.name,icon:O.icon(item.id),need:item.consume===false&&item.mustPossess?1:item.quantity,have:item.mustBePlayerGrown?Math.min(doc.event.grown[item.id]||0,doc.event.inventory[item.id]||0):doc.event.inventory[item.id]||0});
    if(req.objective)rows.push({label:'เล่นให้จบ: '+(O.GAME_NAMES[req.objective.id]||req.objective.description),icon:'🎮',need:1,have:doc.event.proofs[req.objective.id]?.complete?1:0});
    if(req.minigame){const m=req.minigame,id=m.id||'ghost-ship-hunt',proof=doc.event.proofs[id];rows.push({label:(m.mustClear?'เล่นให้ผ่าน: ':'เล่นให้จบ: ')+(O.GAME_NAMES[id]||m.name),icon:'🎮',need:1,have:(m.mustClear?proof?.clear:proof?.complete)?1:0});}
    return rows;
  }
  // ประโยคเดียวที่บอกว่า NPC ขออะไร (บทพูดเต็มย้ายไปไว้ใน "อ่านเรื่องเต็ม")
  function askLine(rows,npc){
    const parts=rows.map(r=>r.icon+' '+r.label.replace(/ · .*/,'')+(r.need>1||r.label==='Candy'?' ×'+r.need:''));
    if(!parts.length)return 'มีเรื่องจะเล่าให้ฟัง…';
    return 'ข้าต้องการ '+parts.join(' + ')+' — หามาให้ข้าที';
  }
  function rewardChips(q){
    const O=window.HalloweenObjective,crop=config.proposals.crops[q.biome],list=q.rewards.map(r=>r.afterBoss?{icon:'🏆',text:r.name+' · หลังชนะบอส',boss:true}:r.id==='candy'?{icon:'🍬',text:r.quantity+' Candy'}:{icon:config.rewards[r.id]?'✦':O.icon(r.id),text:O.itemName(config,r.id)+(r.quantity>1?' ×'+r.quantity:'')});
    if(crop)list.push({icon:'🌱',text:'เมล็ด'+crop.name+' ×'+crop.questSeeds});
    return '<div class="reward-chips">'+list.map(x=>'<span class="reward-chip'+(x.boss?' boss':'')+'"><i>'+x.icon+'</i>'+esc(x.text)+'</span>').join('')+'</div>';
  }
  function showQuest(id,branch=null) {
    const q = config.quests.find(x => x.id===id), doc = read(); if (!q) return;
    const status = Core.questStatus(doc,config,q), phase = q.phases[Math.min(status.phase,q.phases.length-1)];
    let requirements, blocked='';
    if (!branch && phase.requirements.anyOf) branch = Core.questNeeds(doc,config,q.biome,Date.now())?.quest?.id===q.id?Core.questNeeds(doc,config,q.biome,Date.now()).branch:phase.requirements.anyOf[0].id;
    try { requirements = Core.resolveRequirements(config,q,phase.requirements,branch); Core.checkRequirements(doc,requirements); }
    catch(error) { blocked = error.message; }
    if (status.complete) blocked='รับรางวัลแล้ว';
    else if (!status.unlocked) blocked='ต้องทำเควสก่อนหน้าให้ครบ';
    else if (q.biome!==currentBiome()) blocked='เปลี่ยนไปหา NPC ใน ' + biomeName(q.biome);
    else if (q.availability?.mustWaitForNextOccurrence && Core.biomeAt(doc,config,Date.now()).cycle <= doc.event.quests[q.prerequisite].completedCycle) blocked='รอไบโอมวนกลับมาในวัฏจักรถัดไป';
    if (doc.event.closed) blocked='อีเวนต์ปิดแล้ว';
    const offer = phase.requirements.anyOf ? '<div class="offer-options">' + phase.requirements.anyOf.map(x => '<label><input type="radio" name="quest-offer" value="' + x.id + '" ' + (branch===x.id ? 'checked' : '') + '> ' + (x.candy ? 'จ่าย '+x.candy+' Candy' : 'ส่งวัตถุดิบแทน') + '</label>').join('') + '</div>' : '';
    const text = status.complete ? phase.completeDialogue : phase.acceptDialogue || q.phases[Math.max(0,status.phase-1)]?.completeDialogue;
    const game = requirements?.minigame ? requirements.minigame.id || 'ghost-ship-hunt' : requirements?.objective?.id;
    const rows = requirements ? questNeedRows(requirements) : [];
    const ready = !blocked && !status.complete;
    const missingHouse = rows.some(r=>r.id&&r.have<r.need&&Guide.sources(config,r.id).some(s=>s.kind==='house'));
    const npcId = window.HalloweenNPCs.biomeCharacters[biomeIndex(q.biome)];
    const ask = status.complete ? 'ขอบใจนะ… รางวัลอยู่ในกระเป๋าเจ้าแล้ว' : askLine(rows);
    const difficulty = Balance.difficulty(config,q,doc.event.inventory);
    const body = '<div class="quest-head"><div class="quest-portrait">'+window.HalloweenWorld.portrait(npcId)+'</div><div><span class="eyebrow">เควส '+q.order+' / '+config.quests.filter(x=>x.biome===q.biome).length+(q.phases.length>1?' · เฟส '+Math.min(status.phase+1,q.phases.length)+' / '+q.phases.length:'')+'</span><h3 class="quest-title">'+esc(q.name)+'</h3><p class="quest-ask">'+esc(ask)+'</p></div></div>'
      + offer
      + (status.complete ? '<p class="subtle">✓ รางวัลอยู่ในคลังแล้ว</p>' : requirements ? '<span class="quest-label">ต้องเตรียม</span><div class="need-list">'+rows.map(r=>needRow(r,id,branch)).join('')+'</div>' : '<p class="subtle">'+esc(blocked)+'</p>')
      + (!status.complete ? '<span class="quest-label">ได้รับ</span>'+rewardChips(q) : '')
      + (blocked && !status.complete && !/ขาด|ไม่พอ|ยังไม่ได้|ยังไม่ผ่าน|ยังเล่น|Pumpkin ต้อง/.test(blocked) ? '<p class="quest-block">🔒 '+esc(blocked)+'</p>' : '')
      + '<details class="quest-lore"><summary>📜 อ่านเรื่องเต็ม · ความยาก '+esc(difficulty.label)+'</summary><p class="npc-dialogue">'+esc(text)+'</p><button class="quiet-button" data-open-balance>ดูโอกาสได้ของและเกณฑ์ความยาก</button></details>';
    let primary='';
    if (ready) primary='<button class="primary quest-submit" id="submitQuest">ส่งเควส ✦</button>';
    else if (!status.complete && !blocked.startsWith('เปลี่ยนไป') && !blocked.startsWith('รอ') && !blocked.startsWith('ต้องทำ') && game && rows.some(r=>r.icon==='🎮'&&r.have<r.need)) primary='<button class="primary" data-quest-game="'+game+'">ไปเล่น '+esc(window.HalloweenEventGames.names[game])+' ▶</button>';
    else if (!status.complete && missingHouse && q.biome===currentBiome()) primary='<button class="primary" data-guide-village>ไปเคาะบ้านหาของ ▶</button>';
    if (status.complete && q.bossId && !doc.event.bossWins?.[q.bossId]) primary='<button class="primary" data-boss="'+q.bossId+'">ท้าผู้พิทักษ์เพื่อรับธีม ⚔️</button>';
    openDetail(dialogShell(esc(q.npc),body,'<button class="secondary" data-close-detail>กลับ</button>'+primary));
    detail.dataset.quest=id;
    detail.querySelectorAll('[name=quest-offer]').forEach(r => r.addEventListener('change',() => showQuest(id,r.value)));
    detail.querySelector('[data-quest-game]')?.addEventListener('click',() => { detail.close(); openGame(game); });
    detail.querySelector('#submitQuest')?.addEventListener('click',async e => {
      e.currentTarget.disabled=true;
      const result = await perform({type:'quest',quest:id,branch});
      if (!result) { e.currentTarget.disabled=false; return; }
      const O=window.HalloweenObjective,done=Core.questStatus(read(),config,q).complete;
      const gained=done?q.rewards.filter(r=>!r.afterBoss).map(r=>r.id==='candy'?{icon:'🍬',text:r.quantity+' Candy'}:config.rewards[r.id]?{icon:'✦',text:config.rewards[r.id].name+(r.kind==='upgrade-existing'?' · ปลดผนึกแล้ว':'')}:{icon:O.icon(r.id),text:O.itemName(config,r.id)+' ×'+r.quantity}):[];
      if(result.seeds)gained.push({icon:'🌱',text:name(result.seeds.id)+' ×'+result.seeds.quantity});
      const after=currentObjective();
      openDetail(dialogShell(esc(result.npc),'<div class="quest-done"><div class="quest-done-burst" aria-hidden="true"></div><span class="eyebrow">'+(done?'เควสสำเร็จ!':'ผ่านเฟสนี้แล้ว!')+'</span><h3 class="quest-title">'+esc(q.name)+'</h3>'+(gained.length?'<div class="reward-chips big">'+gained.map(x=>'<span class="reward-chip"><i>'+x.icon+'</i>'+esc(x.text)+'</span>').join('')+'</div>':'')+'<p class="quest-ask">“'+esc(result.dialogue)+'”</p>'+(after?'<p class="quest-next">ต่อไป: <b>'+esc(after.title)+'</b></p>':'')+'</div>','<button class="primary" data-close-detail>' + (result.rewards.length ? 'รับของที่สัญญาไว้ ✦' : 'ไปต่อ ▶') + '</button>'),() => acquisition(result.rewards,'quest'));
      if(result.boss){const p=document.createElement('div');p.className='boss-unlock-note';p.innerHTML='ธีมถูกผู้พิทักษ์ผนึกไว้ ชนะบอสก่อนจึงได้ธีม<br><button class="primary" data-boss="'+result.boss+'">พบผู้พิทักษ์ ⚔️</button><button class="secondary" data-equipment>ดูอาวุธที่ถือ</button>';detail.querySelector('.dialog-footer').before(p);}
      if(result.seeds&&!Core.gardenUnlocked(read())){const p=document.createElement('p');p.className='subtle';p.textContent='เก็บเมล็ดไว้ก่อน สวนเปิดเมื่อจบเควสแรกของ Jack';detail.querySelector('.dialog-footer').before(p);}
    });
  }
  function inventory() {
    const doc = read(), owned = Object.keys(doc.rewards);
    const inventory = Object.entries(doc.event.inventory).filter(([,n]) => n>0);
    return '<section class="satchel-scene">'+pageHead('THE ADVENTURER’S SATCHEL','กระเป๋าเดินทางของฉัน','แตะของเพื่อดูรายละเอียด อาวุธถือได้จากช่องอาวุธ', owned.length+' / '+Catalog.items.length+' รางวัล') +
      '<div class="shop-controls inventory-tabs"><button class="filter-button" data-vault-tab="rewards" aria-pressed="' + (vaultTab==='rewards') + '">รางวัล ' + owned.length + '</button><button class="filter-button" data-vault-tab="materials" aria-pressed="' + (vaultTab==='materials') + '">วัตถุดิบ ' + inventory.length + '</button><button class="filter-button" data-vault-tab="ledger" aria-pressed="' + (vaultTab==='ledger') + '">รับ–ใช้ Candy</button><button class="filter-button" data-open-potion>น้ำยาไบโอม</button><span class="tiny">รางวัลที่รับไว้เก็บถาวร</span></div>' +
      (vaultTab==='materials' ? (inventory.length?'<div class="satchel-slots">' + inventory.map(([id,n]) => '<button class="bag-slot" data-bag-item="'+esc(id)+'"><span class="bag-pouch" aria-hidden="true">◈</span><b>' + esc(name(id)) + '</b><small>' + esc(config.items[id]?.rarity || 'ไอเท็มเควส') + (doc.event.grown[id] ? ' · ปลูกเอง '+doc.event.grown[id] : '') + '</small><strong>×' + n + '</strong></button>').join('')+'</div>':'<p class="satchel-empty">ช่องวัตถุดิบยังว่างอยู่ เคาะบ้านหรือทำเควสแล้วของจะเก็บที่นี่</p>') : vaultTab==='ledger' ? '<div class="ledger">' + (doc.event.ledger.length?[...doc.event.ledger].reverse().map(row => '<div class="ledger-row"><span>' + esc({'preview-supplies':'ชุดทดสอบ','house':'เคาะบ้าน','spend':'ส่งเควส / ผสม','quest':'รางวัลเควส','shop':'ซื้อจากร้าน','crop-sale':'ขายผลผลิต','studentos-mission':'ภารกิจ StudentOS','death-quest':'เควสมรณะ','potion-purchase':'ซื้อน้ำยา','ship-chest':'กล่องจากเรือ','ship-repair':'ซ่อมเรือ','visitor':'นักเดินทาง','task':'งานตัวอย่าง','totem':'Totem'}[row.source] || row.source) + '</span><small>' + new Date(row.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}) + '</small><b>' + (row.amount>0 ? '+' : '') + row.amount + '</b></div>').join(''):'<p class="satchel-empty">ยังไม่มีรายการรับหรือใช้ Candy</p>') + '</div>' : owned.length ? '<div class="satchel-rewards">' + owned.map(id => {
        const item = config.rewards[id], restriction = doc.rewards[id].restriction;
        return '<button class="bag-slot reward-slot" data-inspect="'+id+'" style="'+tierStyle(item)+'"><img src="'+asset(item)+'" alt=""><b>'+esc(item.name)+'</b><small>'+item.rarity+'</small>'+(restriction?'<span class="relic-restriction">Restricted · รอ Win Q5</span>':'')+'</button>';
      }).join('') + '</div>' : '<div class="empty-state"><span>◇</span><h2>รอเรื่องเล่าชิ้นแรกของเธอ</h2><p>เคาะบ้าน ทำเควส หรือแวะร้านยามเที่ยงคืน</p><button class="primary" data-route="shop">ไปเลือกรางวัล →</button></div>')+'</section>';
  }
  function activeDeathQuest(){const e=read().event,at=Date.now();return e.deathQuests?.[Death.day(at)]||Object.values(e.deathQuests||{}).find(q=>!e.taskClaims['death:'+q.taskId]&&at-q.issuedAt<Core.DAY)||null;}
  function deathView(q){const e=read().event,earned=e.taskEarned.filter(x=>x.at>now()-Core.DAY).reduce((s,x)=>s+x.amount,0),remaining=Math.max(0,config.proposals.taskDailyCap-earned),claimed=!!q&&!!e.taskClaims['death:'+q.taskId];return {remaining,claimed,status:q?Death.status(q,StudentMissions.read(localStorage),Death.get(localStorage,Death.FOCUS_KEY,{})[q.taskId],Death.owner(localStorage),Date.now()):null};}
  function tasks() {
    const q=activeDeathQuest(),v=deathView(q);
    return pageHead('A PACT WITH THE MIDNIGHT','เควสมรณะ','รับคำท้า แล้วให้เวทมนตร์ฝากงานพิเศษลงใน StudentOS ของเธอ','พรีวิว · อยู่เฉพาะเครื่อง')+'<section class="death-contract">'+npcSpeech('vesper','ข้าไม่ได้ขอให้เจ้ารีบกดว่าทำสำเร็จ… จงเลือกงานที่อยากลงมือ เปิดงานเควสที่ข้าเสกไว้ แล้วรักษาแสงโฟกัสให้ครบยี่สิบนาที เมื่อทำเสร็จค่อยกลับมารับของขวัญ')+'<div class="death-seal" aria-hidden="true">☾</div><h3>พันธสัญญา 20 นาที</h3><p>งานเควสจะเพิ่มในรายการงานของ StudentOS บนเครื่องนี้ เปิดโฟกัสของงานเควส ค้างหน้านั้นไว้จนครบเวลา แล้วกดทำเสร็จ งานอื่นและกำหนดส่งเดิมของเธอยังอยู่ครบ</p><p class="death-conditions">รับได้วันละ 1 เควส · แต่ละเควสมีเวลา 24 ชั่วโมง · รางวัลทดลอง '+config.proposals.taskCandy+' Candy</p>'+(q?'<progress class="death-progress" data-death-progress value="'+v.status.minutes+'" max="20" aria-label="แสงโฟกัสของเควสมรณะ"></progress><p class="death-count"><b data-death-minutes>'+v.status.minutes+'</b> / 20 นาที</p><p class="death-status" data-death-status role="status">'+esc(v.claimed?'รับรางวัลของเควสนี้แล้ว':v.status.reason)+'</p><div class="death-actions"><a href="../../?go=tasks" target="_blank" rel="noopener">ไปทำเควสใน StudentOS ↗</a><button class="secondary" data-death-action="retry">ส่งงานเควสอีกครั้ง</button><button class="primary" data-death-action="claim" '+(!v.status.ready||v.claimed||!v.remaining||read().event.closed?'disabled':'')+'>'+(v.claimed?'รับแล้ว ✓':'รับ '+Math.min(config.proposals.taskCandy,v.remaining)+' Candy')+'</button></div>':'<button class="primary death-accept" data-death-action="enroll" '+(read().event.closed?'disabled':'')+'>รับเควสมรณะ · เสกงานเข้า StudentOS</button>')+'<button class="quiet-button" data-refresh-studentos>ตรวจความคืบหน้า</button><p class="mission-cap">ภารกิจรับรวมได้อีก '+v.remaining+' / '+config.proposals.taskDailyCap+' Candy ใน 24 ชั่วโมง · แยกจาก Candy ที่เคาะบ้าน</p></section><section class="student-invite"><small>ชวนเพื่อนมาร่วมทาง</small><h3>เปิดประตูให้เพื่อนอีกคน</h3><p>ชวนเพื่อนมาใช้ StudentOS จัดงานไปด้วยกัน</p><p class="invite-status">กำลังเตรียมภารกิจนี้ · ยังไม่เปิดนับเพื่อนใหม่หรือรับรางวัล</p><label>ลิงก์ StudentOS<input readonly value="https://nadokagenou.github.io/studentos-ai/alt/" aria-label="ลิงก์ชวนเพื่อนมาใช้ StudentOS"></label><button class="secondary" data-copy-studentos>คัดลอกลิงก์ชวนเพื่อน</button></section>';
  }
  function updateDeathProgress(){
    if(!preview||!store||!detail.open||activePanel!=='journal'||journalPage!=='tasks')return;const q=activeDeathQuest();if(!q)return;const v=deathView(q),bar=detail.querySelector('[data-death-progress]'),minutes=detail.querySelector('[data-death-minutes]'),text=detail.querySelector('[data-death-status]'),claim=detail.querySelector('[data-death-action=claim]');if(bar)bar.value=v.status.minutes;if(minutes)minutes.textContent=v.status.minutes;if(text)text.textContent=v.claimed?'รับรางวัลของเควสนี้แล้ว':v.status.reason;if(claim)claim.disabled=!v.status.ready||v.claimed||!v.remaining||read().event.closed;
  }
  function refreshStudentMissions(){
    if(!preview||!store||!detail.open||activePanel!=='journal'||journalPage!=='tasks')return;
    const scroll=detail.querySelector('.journal-paper')?.scrollTop||0;showJournal('tasks');detail.querySelector('.journal-paper').scrollTop=scroll;
  }
  function ghosts() {
    return pageHead('ETERNAL GRAVEYARD','อย่าปล่อยให้วิญญาณหลงทาง','รับพลั่วจากเควสแรกของ Win เล่นขุดหลุมศพให้จบ แล้วจับผีทั้งหมดใน 30 วินาที') + '<div class="activity-grid"><button class="activity-card" data-game="grave-digging"><span class="activity-icon">⚒</span><h3>ขุดหลุมศพ</h3><p>เล่นให้จบหนึ่งครั้งเพื่อปลุกวิญญาณ</p><span class="arrow">→</span></button><button class="activity-card" data-game="catch-all-ghosts"><span class="activity-icon">♙</span><h3>จับผีทั้งหมด</h3><p>นำทุกดวงวิญญาณกลับมาภายใน 30 วินาที</p><span class="arrow">→</span></button><button class="activity-card" data-quest="win-gravekeeper-trial"><span class="activity-icon">☾</span><h3>กลับไปหา Win</h3><p>ส่งผลทดสอบเพื่อปลดล็อกเควสสร้างอาวุธ</p><span class="arrow">→</span></button></div>';
  }
  function totems() {
    return pageHead('A PATH OF YOUR OWN','Totem แห่งสี่โลก','เปลี่ยนไบโอมส่วนตัว 15 นาที · คูลดาวน์บ้านยังอยู่ · ไม่ข้ามวัฏจักรเควส','ค่าลองเล่น') + '<div class="totem-options">' + Core.BIOMES.map((id,i) => '<button data-totem="' + id + '"><img src="' + image(biomeArts[i]) + '" alt=""><b>' + esc(biomeName(id)) + '</b><br>◈ ' + config.proposals.totem.price + ' Candy</button>').join('') + '</div>';
  }
  function inspect(id) {
    const item = config.rewards[id], owned = read().rewards[id]; if (!item || !owned) return;
    if(config.proposals.weapons?.[id]){showEquipment();return;}
    openDetail(dialogShell(esc(item.name),'<div class="buy-detail-art"><img src="' + asset(item) + '" alt="' + esc(item.name) + '"></div><span class="item-tier" style="' + tierStyle(item) + '">' + item.rarity + '</span><p class="subtle">' + esc(item.description) + '</p><p class="tiny">' + (owned.restriction ? 'Restricted · ยังถือไม่ได้ รอ Win Q5 รอปลดผนึกใน Win Q5' : 'รางวัลถาวรในห้องลอง · ยังอยู่หลังจำลองปิดอีเวนต์') + '</p>', '<button class="secondary" data-close-detail>เก็บกลับเข้าคลัง</button>' + (['theme','costume','room','effect'].includes(item.kind) ? '<button class="primary" id="tryOwned">ลองใน StudentOS ↗</button>' : '')));
    detail.querySelector('#tryOwned')?.addEventListener('click',() => tryInApp(item));
  }
  function tryInApp(item) {
    window.__STUDENTOS_HALLOWEEN_COLLECTION__ = true;
    openDetail(dialogShell('ลอง ' + esc(item.name),'<p class="tiny">ข้อมูลตัวอย่างในหน่วยความจำ · ไม่เปลี่ยนบัญชีจริง</p><div class="owned-app-preview"><iframe title="ลองรางวัลใน StudentOS" src="../../?halloween-showroom=1"></iframe></div>','<button class="secondary" data-close-detail>กลับคลัง</button>'));
    const frame = detail.querySelector('iframe');
    const send = () => frame.contentWindow?.postMessage({type:'studentos-halloween-reward-preview',id:item.id,request:crypto.randomUUID()},location.origin);
    const ready = e => { if (e.origin===location.origin && e.source===frame.contentWindow && e.data?.type==='studentos-halloween-reward-ready') send(); };
    frame.addEventListener('load',send); window.addEventListener('message',ready);
    detailAfterClose = () => { window.removeEventListener('message',ready); frame.removeAttribute('src'); };
  }
  async function openGame(id) {
    await window.HalloweenEventGames.open(id,{perform,read,now,reduced,toast,onClose:()=>{render();if(detail.open&&detail.dataset.gameInfo)showGameInfo(detail.dataset.gameInfo);}});
  }
  function showGameInfo(id){
    const info=window.HalloweenWorld.activity(worldContext(),id);if(!info)return;
    let action;
    if(info.quest)action='<button class="primary" data-quest="'+info.quest+'">ดูเควสที่ต้องทำก่อน</button>';
    else if(info.game)action='<button class="primary" data-game-info="'+info.game+'">ไปดูเกมขุดหลุมศพ</button>';
    else if(info.repair)action='<button class="primary" data-action="repair">ซ่อมเรือ · '+read().event.repairs+' Candy</button>';
    else action='<button class="primary" data-game="'+id+'" '+(read().event.closed?'disabled':'')+'>'+(info.complete?'เล่นอีกครั้ง':'เริ่มมินิเกม')+'</button>';
    openDetail(dialogShell(esc(info.name),'<span class="activity-tag">▶ มินิเกมในฉากนี้</span><p class="story-copy">'+esc(info.description)+'</p><p class="subtle">'+esc(info.instructions)+'</p><p class="activity-status '+(info.locked?'activity-locked':'')+'">'+esc(info.locked?'ยังไม่เปิด · '+info.reason:info.complete?'✓ ผ่านแล้ว · เล่นซ้ำได้':'พร้อมเล่น · กดเริ่มเมื่อพร้อม')+'</p>','<button class="secondary" data-close-detail>กลับฉาก</button>'+action));
    detail.dataset.gameInfo=id;
  }
  function showPreferences() {
    const closed = preview && store && read().event.closed;
    preferences.innerHTML = '<div class="dialog-top"><h2 id="preferencesHeading">บรรยากาศและห้องลอง</h2><button class="dialog-x" id="closePreferences" aria-label="ปิดตั้งค่า">×</button></div><div class="preference-row"><div>ภาพเคลื่อนไหว<small>เคารพการลดการเคลื่อนไหวของอุปกรณ์</small></div><button class="secondary" id="toggleMotion">' + (reduced() ? 'ภาพนิ่ง' : 'เปิดอยู่') + '</button></div><div class="preference-row"><div>เสียงบรรยากาศและกิจกรรม<small>เพลงเบา ๆ ลม ประตู คุย รดน้ำ เก็บเกี่ยว และรับของ ปิดเสียงได้ตลอด</small></div><button class="secondary" id="toggleSound">' + (prefs.sound ? 'เปิดอยู่' : 'ปิดอยู่') + '</button></div>' + (preview ? '<details class="review-tools"><summary>เครื่องมือสำหรับลองให้ครบ</summary><p>เปลี่ยนเฉพาะชุดข้อมูลห้องลองนี้ ไม่เพิ่ม Candy วัตถุดิบ หรือสิทธิ์ในบัญชีจริง</p><div class="tool-buttons"><button class="secondary" data-tool="supplies">เติม Candy + วัตถุดิบ</button><button class="secondary" data-tool="stock-hour">ข้ามเวลาร้าน 1 ชม.</button><button class="secondary" data-tool="hour">ข้ามเวลา 4 ชม.</button><button class="secondary" data-tool="day">ข้ามเวลา 1 วัน</button><button class="secondary" data-tool="minute">ข้ามเวลา 1 นาที</button><button class="secondary" data-preview-reveals>ลองฉากรับของทุกระดับ</button><button class="secondary" data-tool="close">' + (closed ? 'เปิดห้องลองอีกครั้ง' : 'จำลองปิดอีเวนต์') + '</button></div></details><details class="review-tools"><summary>ค่าทดลองที่ยังรอเจ้าของยืนยัน</summary><ul class="rules-list"><li>บ้านนับคูลดาวน์รายหลังแยกไบโอม เพดานย้อนหลัง 24 ชม. จ่ายเท่าที่เหลือ ไม่สุ่มของเมื่อจ่าย 0</li><li>ดรอปครั้งละ 1 สุ่มชื่อเท่ากัน ตาราง Vampire/Graveyard และกรณีระดับว่างเป็นค่าลองเล่น</li><li>ร้านทดลอง 6 ชิ้นทุกต้นชั่วโมง Common 60 / Uncommon 30 / Epic 10 สุ่มชื่อเท่ากัน ไม่ขายของเควส สต็อกเฉพาะเซฟนี้; บ้านยังคูลดาวน์ 4 ชั่วโมง</li><li>ราคา/รายการร้าน สูตรหม้อและพิธี รวมเงื่อนไขธีมหลักเป็นข้อเสนอ</li><li>Dech Q2/Q3 ใช้จำนวนอย่างละ 1 เพื่อเดินทดสอบ; Shovel ไม่หักในห้องลอง</li><li>สวนใช้เมล็ด 1 โต 1 นาที ได้ 3 Pumpkin; Totem 40 Candy ใช้ 15 นาที</li><li>มินิเกม: เรือเวลา 15/13/11/9/7/5 วินาที กล่อง 35 Candy; จับผิดภาพ 5 จุด; ขุด 8 ชั้น; ผี 6 ตัว</li><li>กำหนดวันจริง timezone และการรับของข้ามเครื่องยังไม่เปิดใช้งาน</li></ul></details><button class="quiet-button" data-preference-route="totems">ไปดู Totem ทั้งสี่ไบโอม →</button>' : '<p class="subtle">ระบบรับรางวัลจริงยังปิดอยู่ เปิดห้องลองเพื่อชมและเล่นได้</p>');
    preferences.querySelector('#closePreferences').addEventListener('click',() => preferences.close());
    if(preview){
      const tools=document.createElement('div');tools.className='review-tools';
      tools.innerHTML='<p>เปิดประตูไบโอมเพื่อทดสอบ · เฉพาะห้องลอง</p><div class="tool-buttons">'+Core.BIOMES.map(id=>'<button class="secondary" data-biome="'+id+'">'+esc(biomeName(id))+'</button>').join('')+'</div>';
      preferences.querySelector('.review-tools').append(tools);
      const reset=document.createElement('section');reset.className='preview-reset';reset.innerHTML='<h3>เริ่มตรวจตั้งแต่ต้น</h3><p>คืนความคืบหน้าเกม ของทดลอง Candy เควส และการตั้งค่าห้องลองเป็นจุดเริ่มต้น รวมถึงล้างงานเควสมรณะที่เสกไว้ งานปกติใน StudentOS ยังอยู่ครบ</p><button class="secondary" data-reset-preview>เริ่มใหม่ทั้งหมด</button><div data-reset-confirm hidden><p>ยืนยันเริ่มห้องลองใหม่? ความคืบหน้าและของทดลองเดิมจะหายไป</p><button class="primary" data-reset-yes>ยืนยัน · เริ่มตั้งแต่ต้น</button><button class="secondary" data-reset-no>เก็บเซฟเดิม</button></div>';
      preferences.append(reset);reset.querySelector('[data-reset-preview]').onclick=()=>{reset.querySelector('[data-reset-confirm]').hidden=false;reset.querySelector('[data-reset-yes]').focus();};reset.querySelector('[data-reset-no]').onclick=()=>{reset.querySelector('[data-reset-confirm]').hidden=true;reset.querySelector('[data-reset-preview]').focus();};
      reset.querySelector('[data-reset-yes]').onclick=async e=>{e.currentTarget.disabled=true;try{const clear=()=>{const at=Date.now();localStorage.setItem(Death.REQUEST_KEY,'[]');localStorage.setItem(Death.RESET_KEY,JSON.stringify({at,owner:Death.owner(localStorage)}));localStorage.setItem(Death.FOCUS_KEY,'{}');localStorage.setItem(KEY,JSON.stringify(Core.initial(config,owner,at,crypto.getRandomValues(new Uint32Array(1))[0])));localStorage.removeItem(PREF_KEY);};if(navigator.locks?.request)await navigator.locks.request('studentos-halloween:'+KEY,clear);else clear();location.hash='gate';location.reload();}catch{toast('เริ่มใหม่ไม่สำเร็จ ตรวจพื้นที่เก็บข้อมูลแล้วลองอีกครั้ง',true);e.currentTarget.disabled=false;}};
    }
    const savePrefs = () => { try { localStorage.setItem(PREF_KEY,JSON.stringify(prefs)); } catch { toast('จำการตั้งค่าไม่ได้ในเบราว์เซอร์นี้',true); } syncMotionUI(); syncSoundUI(); };
    preferences.querySelector('#toggleMotion').addEventListener('click',e => { prefs.motion = reduced() ? 'full' : 'still'; prefs.motionChosen = true; savePrefs(); e.currentTarget.textContent = reduced() ? 'ภาพนิ่ง' : 'เปิดอยู่'; });
    preferences.querySelector('#toggleSound').addEventListener('click',e => { prefs.sound=!prefs.sound; savePrefs(); e.currentTarget.textContent=prefs.sound ? 'เปิดอยู่' : 'ปิดอยู่'; });
    preferences.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click',async () => {
      const tool = button.dataset.tool;
      const action = tool==='supplies' ? {type:'preview-supplies'} : tool==='close' ? {type:'preview-close'} : {type:'preview-time',ms:tool==='hour' ? 4*Core.HOUR : tool==='day' ? Core.DAY : tool==='stock-hour' ? Core.HOUR : 60000};
      const result = await perform(action);
      if (result) { if (tool==='close') button.textContent=read().event.closed ? 'เปิดห้องลองอีกครั้ง' : 'จำลองปิดอีเวนต์'; toast('อัปเดตข้อมูลห้องลองแล้ว'); }
    }));
    preferences.querySelector('[data-preview-reveals]')?.addEventListener('click',()=>{preferences.close();openDetail(dialogShell('ลองฉากรับของ',theatre(),'<button class="secondary" data-close-detail>กลับฉาก</button>'));});
    preferences.querySelector('[data-preference-route]')?.addEventListener('click',() => { preferences.close(); navigate('totems'); });
    const leave=document.createElement('a');leave.className='quiet-button';leave.href='../../';leave.textContent='กลับ StudentOS';preferences.append(leave);
    preferences.showModal();
  }
  function currentObjective(){return preview&&store?window.HalloweenObjective.next({Core,Guide,config,doc:read(),now:Date.now(),route}):null;}
  // ไฟนำทาง + ป้ายบนจุด + แถบภารกิจ: ทุกจออ่านจาก currentObjective() ตัวเดียว
  function guideScene(){
    const scene=main.querySelector('.world-scene');if(!scene||!preview||!store)return;
    const o=currentObjective(),ctx=worldContext();
    window.HalloweenHUD.decorate(scene,{objective:o,activity:id=>window.HalloweenWorld.activity(ctx,id),gardenUnlocked:Core.gardenUnlocked(read()),openAt:id=>window.HalloweenObjective.nextOpen(Core,read(),Date.now(),id),npcName:b=>(b.getAttribute('aria-label')||'').replace(/^คุยกับ /,'').split(/[ ,]/)[0]});
    main.querySelector('.objective-bar')?.remove();
    if(['hub','biome'].includes(route)&&!read().event.closed){const previous=main.dataset.objective;main.insertAdjacentHTML('beforeend',window.HalloweenHUD.bar(o,{duration,now:now()}));main.dataset.objective=o?.key||'';if(previous&&o&&previous!==o.key&&!reduced())main.querySelector('.objective-bar')?.classList.add('is-new');const bar=main.querySelector('.objective-bar');main.style.setProperty('--obj-h',(bar?bar.offsetHeight:0)+'px');}
    else{main.dataset.objective='';}
  }
  async function runObjective(){
    const o=currentObjective();if(!o)return;const a=o.action;
    if(a.kind==='enter-hub'){main.querySelector('[data-enter-hub]')?.click();return;}
    if(a.kind==='enter-biome'){const result=await perform({type:'enter-biome',biome:a.biome},{silent:true});if(result){await navigate('biome');if(result.firstStory)showStory(a.biome);}return;}
    if(a.kind==='village'){await goToVillage();return;}
    if(a.kind==='quest'){showQuest(a.quest);return;}
    if(a.kind==='game'){showGameInfo(a.game);return;}
    if(a.kind==='boss'){showBoss(a.boss);return;}
    if(a.kind==='garden'){navigate('garden');return;}
    if(a.kind==='room'){navigate(a.route);return;}
    if(a.kind==='wait'){toast((o.wait?'ประตู'+window.HalloweenObjective.THAI[Core.BIOMES.indexOf(o.wait.biome)]+'เปิด '+window.HalloweenHUD.clock(o.wait.at)+' · ':'')+'ระหว่างรอ: ทำเควสมรณะในสมุดเพื่อรับ Candy หรือแวะสวนและร้าน');return;}
  }
  function render() {
    const previousPanel=activePanel;
    requestAnimationFrame(publishDeviceStatus);
    if (!preview) {
      main.innerHTML = '<section class="locked-event"><span class="eyebrow">STUDENTOS · THE HALLOWEEN CHAPTER</span><h1>เรื่องราวรัตติกาล กำลังจะเริ่ม</h1><img src="' + image('theme-midnight-academy') + '" alt="Midnight Academy"><p>บ้าน เควส สวนฟักทอง และร้านยามเที่ยงคืนพร้อมให้ลองในห้องแยก กำหนดการและกติกาที่ยังไม่ยืนยันจะประกาศก่อนเปิดรับรางวัลจริง</p><a class="primary" href="?preview=1">เปิดห้องลองอีเวนต์ ✧</a><p class="tiny">ไม่เชื่อมบัญชีจริง · ไม่แจก Candy หรือรางวัลอีเวนต์จริง</p></section>'; return;
    }
    const biome = currentBiome(), meta = Catalog.biomes[Core.SHORT[biomeIndex(biome)]];
    main.dataset.biome=biome;
    document.documentElement.style.setProperty('--biome',meta.color); document.documentElement.style.setProperty('--glow',meta.dark+'66');
    const world=window.HalloweenWorld;
    const views = {gate:world.gate,hub:()=>world.hub(worldContext()),biome:()=>world.biome(worldContext()),garden:()=>world.garden(worldContext())};
    main.innerHTML = worldToolbar() + (views[route] || views.hub)();audio.setScene(activeRoom||route);if(previousPanel)showPanel(previousPanel);updateClock();
    if(['hub','garden'].includes(route))main.querySelector('.world-scene')?.insertAdjacentHTML('beforeend',world.player(worldContext()));
    guideScene();
  }
  function updateClock() {
    if (!store || !preview) return;
    if(main.dataset.biome!==currentBiome()&&['hub','biome'].includes(route)&&!detail.open&&!document.getElementById('gameDialog').open){render();return;}
    market?.tick();
    const at=now();
    main.querySelectorAll('[data-closes-at]').forEach(el=>{const left=Number(el.dataset.closesAt)-at;if(left<=0){if(!detail.open)render();return;}el.textContent=el.textContent.replace(/ปิดใน .*/,'ปิดใน '+duration(left));});
    detail.querySelectorAll('[data-house-status]').forEach(label=>{
      const a=Core.houseAvailability(read(),config,Number(label.dataset.houseStatus),Date.now()),door=label.closest('button'),wait=a.availableAt;
      door.disabled=!a.ready||read().event.closed;
      label.textContent=a.ready?'เคาะประตู':(a.remaining===0?'เปิดได้เร็วสุดอีก ':'เปิดอีก ')+duration(wait-at);
      if(!a.ready){
        // บ้านพักนานกว่าประตูเปิด: บอกตรง ๆ ว่าได้เคาะอีกทีรอบหน้า ไม่ใช่เวลาที่ประตูปิดไปแล้ว
        const O=window.HalloweenObjective,closes=O.windowOf(Core,read(),config,Date.now()).closesAt;
        if(closes&&wait>=closes&&a.remaining>0)label.textContent='เคาะได้อีกรอบหน้า · '+window.HalloweenHUD.clock(Math.max(wait,O.nextOpen(Core,read(),Date.now(),currentBiome(),true)));
        else label.textContent+=' · '+window.HalloweenHUD.clock(wait);
      }
    });
    const lane=detail.querySelector('.village-lane');
    if(lane){const idle=![...lane.querySelectorAll('[data-knock]')].some(b=>!b.disabled);let note=detail.querySelector('.village-rest');if(idle&&!note){note=document.createElement('p');note.className='village-rest';note.innerHTML='บ้านทุกหลังกำลังพัก 💤 ระหว่างรอ: รับ <b>เควสมรณะ</b> ในสมุดเพื่อเก็บ Candy จากงานจริงใน StudentOS';lane.before(note);}else if(!idle)note?.remove();}
    const houseLimit=detail.querySelector('[data-house-limit]');if(houseLimit){const a=Core.houseAvailability(read(),config,1,Date.now());houseLimit.textContent='รับ Candy จากบ้านได้อีก '+a.remaining+' ในช่วง 24 ชั่วโมงนี้'+(a.capNextAt?' · โควตาเริ่มคืนอีก '+duration(a.capNextAt-at):'');}
    detail.querySelectorAll('[data-crop-countdown]').forEach(label=>{label.textContent=at>=Number(label.dataset.until)?'โตเต็มที่แล้ว':duration(Number(label.dataset.until)-at);});
    const plotId=detail.open&&detail.dataset.plotBiome;
    if(plotId){const s=window.HalloweenWorld.cropState(worldContext(),plotId),harvest=detail.querySelector('[data-action="harvest"]');if(harvest){harvest.disabled=!s.ready||read().event.closed;if(s.ready)detail.querySelector('.crop-stage-title').textContent='โตเต็มที่แล้ว เก็บเกี่ยวได้';}}
    main.querySelectorAll('[data-plot-biome]').forEach(b=>{
      const s=window.HalloweenWorld.cropState(worldContext(),b.dataset.plotBiome),label=!s.unlocked?'รอเปิดแปลง':!s.planted?'แปลงว่าง':s.ready?'เก็บเกี่ยวได้':!s.g.watered?'รอรดน้ำ':'กำลังเติบโต';
      b.classList.toggle('crop-ready',s.ready);b.setAttribute('aria-label','แปลง'+s.crop.name+' · '+label);b.querySelector('.spot-label small').textContent=label;
    });
  }
  function publishDeviceStatus() {
    if (parent === window) return;
    parent.postMessage({type:'studentos-device-preview-status',viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth,screenScroll:main.scrollHeight-main.clientHeight,theme:'halloween',screen:route,moving:!reduced()},location.origin);
  }
  window.addEventListener('resize',() => requestAnimationFrame(publishDeviceStatus));
  document.addEventListener('visibilitychange',()=>{audio.setVisible(!document.hidden);if(!document.hidden)refreshStudentMissions();});
  window.addEventListener('pagehide',()=>audio.dispose());
  let lastPointerType='mouse';
  document.addEventListener('pointerdown',e=>{lastPointerType=e.pointerType||'mouse';const target=e.target.closest('.world-spot,.world-portal,.garden-bed');document.querySelectorAll('[data-armed]').forEach(b=>{if(b!==target)delete b.dataset.armed;});});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('[data-armed]').forEach(b=>delete b.dataset.armed);});
  document.addEventListener('click',async e => {
    if(e.target.closest('[data-typing]')){finishTyping();return;}
    const button = e.target.closest('button,a'); if (!button) return;
    if(prefs.sound)await audio.setEnabled(true);
    if(button.dataset.market){await market.handle(button);return;}
    if(button.dataset.chooseRecipe){const r=config.proposals.recipes.find(r=>r.id===button.dataset.chooseRecipe);recipeSelection[r.channel]=r.id;recipePrepared=false;showPanel(r.channel+'-recipes');return;}
    if(button.dataset.prepareRecipe){recipePrepared=true;showPanel(button.dataset.prepareRecipe+'-recipes');detail.querySelector('.craft-stage')?.scrollIntoView({block:'center',behavior:reduced()?'instant':'smooth'});audio.play('water');return;}
    if(button.dataset.returnIngredients){recipePrepared=false;showPanel(button.dataset.returnIngredients+'-recipes');return;}
    if(button.dataset.bagItem){const id=button.dataset.bagItem,doc=read();openDetail(dialogShell(esc(name(id)),'<div class="bag-detail"><span class="bag-pouch" aria-hidden="true">◈</span><p>มี '+(doc.event.inventory[id]||0)+' ชิ้น'+(doc.event.grown[id]?' · ปลูกเอง '+doc.event.grown[id]+' ชิ้น':'')+'</p><p class="subtle">เก็บไว้ส่งเควสหรือใช้ตามสูตร ของจะถูกหักเมื่อยืนยันเท่านั้น</p>'+sourceButton(id,'data-source-panel="vault"')+'</div>','<button class="secondary" data-route="vault">กลับกระเป๋า</button>'));return;}
    const mapTarget=button.matches('.world-scene .world-spot,.world-scene .world-portal,.world-scene .garden-bed');
    if(mapTarget&&button.classList.contains('is-locked')&&button.dataset.lockReason){button.classList.remove('shake');void button.offsetWidth;button.classList.add('shake');audio.play('error');toast('🔒 '+button.dataset.lockReason);return;}
    if(mapTarget&&window.HalloweenWorld.shouldArm({pointerType:e.pointerType||lastPointerType,detail:e.detail,armed:button.dataset.armed==='true',labelVisible:button.matches('.village-sign,.portal-open'),markerVisible:button.matches('.scene-point,.npc-character,.garden-bed,.world-portal')})){
      e.preventDefault();document.querySelectorAll('[data-armed]').forEach(b=>delete b.dataset.armed);button.dataset.armed='true';return;
    }
    document.querySelectorAll('[data-armed]').forEach(b=>delete b.dataset.armed);
    if(button.hasAttribute('data-toggle-scene-sound')){prefs.sound=!prefs.sound;rememberPrefs();syncSoundUI();return;}
    if(button.hasAttribute('data-start-with-sound')){prefs.sound=true;prefs.motion='full';prefs.motionChosen=true;rememberPrefs();syncSoundUI();syncMotionUI();detail.close();return;}
    if(button.dataset.deathAction){button.disabled=true;const action=button.dataset.deathAction;if(action==='claim'){const q=activeDeathQuest(),result=q&&await perform({type:'death-quest-claim',quest:q.id});refreshStudentMissions();if(result)toast('พันธสัญญาสำเร็จ รับ '+result.candy+' Candy ห้องลองแล้ว');return;}const result=action==='enroll'?await perform({type:'death-quest-enroll'}):{deathQuest:activeDeathQuest()};try{if(result?.deathQuest){Death.publish(localStorage,result.deathQuest,action==='retry');refreshStudentMissions();toast('ส่งคำขอแล้ว เปิด StudentOS เพื่อให้เควสปรากฏในรายการงาน');}}catch{toast('ส่งงานเควสไม่สำเร็จ ลองส่งอีกครั้งได้โดยไม่สร้างเควสซ้ำ',true);}button.disabled=false;return;}
    if(button.hasAttribute('data-refresh-studentos')){refreshStudentMissions();return;}
    if(button.hasAttribute('data-copy-studentos')){try{await navigator.clipboard.writeText('https://nadokagenou.github.io/studentos-ai/alt/');toast('คัดลอกลิงก์แล้ว ส่งชวนเพื่อนได้เลย');}catch{toast('คัดลอกอัตโนมัติไม่ได้ กดเลือกลิงก์ด้านบนแล้วคัดลอกได้เลย');}return;}
    if(button.dataset.studentosMission){button.disabled=true;const result=await perform({type:'studentos-mission',mission:button.dataset.studentosMission});refreshStudentMissions();if(result)toast('รับ '+result.candy+' Candy ห้องลองจากภารกิจ StudentOS แล้ว');return;}
    if(button.hasAttribute('data-objective-go')){button.disabled=true;try{await runObjective();}finally{button.disabled=false;}return;}
    if(button.hasAttribute('data-open-journal')){showJournal();return;}
    if(button.dataset.journalPage){showJournal(button.dataset.journalPage);return;}
    if(button.hasAttribute('data-tutor')){showTutor();return;}
    if(button.hasAttribute('data-open-guide')){showGuide();return;}
    if(button.dataset.gameInfo){showGameInfo(button.dataset.gameInfo);return;}
    if(button.hasAttribute('data-open-balance')){showBalance();return;}
    if(button.hasAttribute('data-item-pools')){showItemPools();return;}
    if(button.hasAttribute('data-equipment')){showEquipment();return;}
    if(button.dataset.equipWeapon){if(await perform({type:'equip-weapon',weapon:button.dataset.equipWeapon})){showEquipment();toast('ถือ '+config.proposals.weapons[button.dataset.equipWeapon].name+' แล้ว');}return;}
    if(button.hasAttribute('data-boss-list')){showBossList();return;}
    if(button.dataset.boss){showBoss(button.dataset.boss);return;}
    if(button.dataset.startBoss){await openBattle(button.dataset.startBoss);return;}
    if(button.hasAttribute('data-guide-village')){await goToVillage();return;}
    if(button.dataset.sourceVillage){await goToVillage(button.dataset.sourceVillage);return;}
    if(button.dataset.itemSource){showSources(button.dataset.itemSource,{quest:button.dataset.sourceQuest,branch:button.dataset.sourceBranch,panel:button.dataset.sourcePanel});return;}
    if(button.hasAttribute('data-source-back')){if(sourceReturn.quest)showQuest(sourceReturn.quest,sourceReturn.branch||null);else if(sourceReturn.panel)navigate(sourceReturn.panel);else detail.close();return;}
    audio.play(button.dataset.npc||button.dataset.quest?'npc':'tap');
    if(mapTarget&&!reduced()){
      const rect=button.getBoundingClientRect(),spark=document.createElement('i');spark.className='scene-tap';spark.style.left=(e.clientX||rect.x+rect.width/2)+'px';spark.style.top=(e.clientY||rect.y+rect.height/2)+'px';document.body.append(spark);setTimeout(()=>spark.remove(),500);
    }
    if(button.hasAttribute('data-toggle-scene-motion')){prefs.motion=reduced()?'full':'still';prefs.motionChosen=true;try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch{}syncMotionUI();return;}
    if(button.hasAttribute('data-open-potion')){showPotion();return;}
    if(button.hasAttribute('data-buy-potion')){button.disabled=true;if(await perform({type:'buy-biome-potion'})){showPotion();toast('มอราเตรียมน้ำยาให้แล้ว 1 ขวด');}else button.disabled=false;return;}
    if(button.hasAttribute('data-drink-potion')){drinkPotion(button);return;}
    if(button.dataset.npc){showNPC(button.dataset.npc,button.dataset.topic);return;}
    if(button.hasAttribute('data-trade')){showTrade();return;}
    if(button.dataset.plotBiome){showPlot(button.dataset.plotBiome);return;}
    if(button.hasAttribute('data-enter-hub')){
      button.disabled=true;main.querySelector('.world-scene')?.classList.add('gate-opening');
      const result=await perform({type:'enter-hub'},{silent:true});
      if(result)setTimeout(()=>navigate('hub'),reduced()?0:650);else button.disabled=false;
      return;
    }
    if(button.dataset.enterBiome){
      const id=button.dataset.enterBiome;
      if(!Core.portalStatus(read(),config,id,Date.now()).open){openDetail(dialogShell('ประตูนี้ยังหลับอยู่','<p class="story-copy">'+esc(biomeName(id))+' ยังไม่เปิดในรอบนี้ กลับมาตอนประตูมีแสง หรือใช้ Totem เพื่อเปิดเส้นทางส่วนตัว</p>','<button class="secondary" data-close-detail>กลับโถงกลาง</button><button class="primary" data-route="totems">ดู Totem</button>'));return;}
      const result=await perform({type:'enter-biome',biome:id},{silent:true});
      if(result){navigate('biome');if(result.firstStory)showStory(id);}return;
    }
    if(button.dataset.story){showStory(button.dataset.story);return;}
    if(button.hasAttribute('data-visitors')){showVisitors();return;}
    if(button.dataset.finishStory){if(await perform({type:'story-seen',biome:button.dataset.finishStory},{silent:true})){detail.close();render();}return;}
    if(button.dataset.knock){await knock(Number(button.dataset.knock));return;}
    if(button.dataset.knockChoice){prefs.knockChoice=button.dataset.knockChoice;rememberPrefs();detail.querySelectorAll('[data-knock-choice]').forEach(b=>b.setAttribute('aria-checked',String(b===button)));return;}
    if(button.dataset.seedQuest){const r=await perform({type:'seed-quest',biome:button.dataset.seedQuest});if(r){showPlot(button.dataset.seedQuest);toast('ส่งเควสสำเร็จ ได้เมล็ด '+r.seeds.quantity+' ชิ้น');}return;}
    if (button.matches('[data-open-preferences]')) { e.preventDefault(); showPreferences(); return; }
    if (!preview && button.matches('[data-route]')) { e.preventDefault(); toast('เปิดห้องลองก่อนเพื่อสำรวจ'); return; }
    if (button.dataset.route==='biome') {
      const id=currentBiome(),result=await perform({type:'enter-biome',biome:id},{silent:true});
      if(result){navigate('biome');if(result.firstStory)showStory(id);}return;
    }
    if (button.dataset.route) { navigate(button.dataset.route); return; }
    if (button.dataset.biome) { if (await perform({type:'preview-biome',biome:button.dataset.biome})) {preferences.close();navigate('hub');toast('เปิดประตูทดลอง ' + biomeName(button.dataset.biome));} return; }
    if (button.dataset.quest) { showQuest(button.dataset.quest); return; }
    if (button.dataset.vaultTab) { vaultTab=button.dataset.vaultTab; render(); return; }
    if (button.dataset.inspect) { inspect(button.dataset.inspect); return; }
    if (button.dataset.craft) {
      const recipe = config.proposals.recipes.find(r => r.id===button.dataset.craft);
      button.disabled=true;
      const result = await perform({type:'craft',recipe:recipe.id}); if (result) {recipePrepared=false;showPanel(recipe.channel+'-recipes');acquisition(result.rewards,recipe.channel);}else button.disabled=false; return;
    }
    if (button.dataset.theatre) {
      const item = Catalog.items.find(x => x.rarity===button.dataset.theatre);
      window.HalloweenAcquisition.open(item,{asset:asset(item),color:Catalog.tiers[item.rarity].color,channel:'cauldron',reduced:reduced(),sound:prefs.sound,presentationOnly:true}); return;
    }
    if (button.dataset.game) { openGame(button.dataset.game); return; }
    if (button.hasAttribute('data-visitor')) { if (await perform({type:'visitor',index:Number(button.dataset.visitor)})) {showVisitors();toast('ส่งของแล้ว นักเดินทางฝาก Candy ไว้ให้');} return; }
    if (button.dataset.task) { if (await perform({type:'task',task:button.dataset.task})) toast('งานตัวอย่างเสร็จแล้ว รับ Candy เรียบร้อย ✓'); return; }
    if (button.dataset.totem) { if (await perform({type:'totem',biome:button.dataset.totem})) { navigate('explore'); toast('Totem เปิดเส้นทางส่วนตัว 15 นาที'); } return; }
    if (button.dataset.action) { if (await perform({type:button.dataset.action,biome:button.dataset.cropBiome})) {if(button.dataset.cropBiome)showPlot(button.dataset.cropBiome);if(button.dataset.action==='repair'&&detail.dataset.gameInfo)showGameInfo(detail.dataset.gameInfo);toast(({harvest:'เก็บผลผลิตแล้ว นำไปขายกับพ่อค้าในร้านได้',water:'รดน้ำแล้ว รอผลผลิตได้เลย',plant:'ปลูกเมล็ดจากเควสแล้ว อย่าลืมรดน้ำ',repair:'ซ่อมเรือแล้ว ออกเดินทางได้เลย'})[button.dataset.action]);} }
  });
  document.getElementById('preferencesButton').addEventListener('click',showPreferences);
  window.addEventListener('storage',e=>{if(e.key===StudentMissions.STORE_KEY||e.key===Death.FOCUS_KEY)updateDeathProgress();});
  window.addEventListener('storage',e => { if (e.key===KEY && preview) { try { updateWallet(); updateBanner(); render(); } catch { toast('อ่านการเปลี่ยนแปลงห้องลองไม่ได้',true); } } });
  media.addEventListener('change',syncMotionUI);
  async function boot() {
    try {
      const load = path => fetch(path,{cache:'no-store'}).then(r => { if (!r.ok) throw Error('อ่านข้อมูลอีเวนต์ไม่สำเร็จ'); return r.json(); });
      const [materials,...rest] = await Promise.all([load('data/materials.json'),...['dutchman','jack','vampire','graveyard'].map(id => load('data/quests.'+id+'.json')),load('data/preview-rules.json')]);
      const proposals = rest.pop(); config = Core.build({materials,chains:rest,catalog:Catalog,proposals,preview});
      if(preview)biomeDifficulty=Object.fromEntries(Core.BIOMES.map(id=>{const levels=config.quests.filter(q=>q.biome===id).map(q=>Balance.difficulty(config,q).level);return[id,Balance.labels[Math.min(...levels)-1]+' → '+Balance.labels[Math.max(...levels)-1]];}));
      if (preview) {
        const seedTime = Date.now();
        store = window.HalloweenOwnership.createStore({storage:localStorage,key:KEY,owner,season:config.season.id,locks:navigator.locks,initial:() => {
          const doc = Core.initial(config,owner,seedTime,crypto.getRandomValues(new Uint32Array(1))[0]);
          // New adventurers gather from houses; existing saves are never reset.
          return doc;
        }});
        read();
        if(!read().event.closed&&read().event.bossWins?.['midnight-sovereign']&&config.proposals.bosses['midnight-sovereign'].rewards.some(id=>!read().rewards[id]))await perform({type:'claim-final-theme-set'},{silent:true});
      }
      if(preview)market=window.HalloweenMarket.create({Core,config:()=>config,read,now,detail,refresh:()=>showPanel('shop-stock'),perform,audio,onRewards:acquisition,esc,asset,name,duration,portrait:id=>window.HalloweenWorld.portrait(id),cropArt:index=>window.HalloweenWorld.pixelCrop(index)});
      const hash = location.hash.slice(1); if (['gate','hub','biome','garden'].includes(hash)) route=hash;
      else if(preview&&read().event.visits?.hub)route='hub';
      else if(PANEL_NAMES[hash])route='hub';
      if(preview&&ROOM_ROUTES[route]&&!read().event.closed)await perform({type:'enter-room',room:ROOM_ROUTES[route]},{silent:true});
      updateWallet(); updateBanner(); render();
      if(preview&&PANEL_NAMES[hash])await navigate(hash);
      setInterval(updateClock,1000);
    } catch(error) {
      main.innerHTML = '<section class="locked-event"><h1>เปิดห้องลองไม่ได้ในตอนนี้</h1><p>' + esc(error.message) + '</p><p class="tiny">ข้อมูลเดิมยังอยู่ ไม่มีการล้างหรือรับของเพิ่ม</p><button class="secondary" id="retryEvent">ลองเปิดอีกครั้ง</button></section>';
      document.getElementById('retryEvent').addEventListener('click',() => location.reload());
      document.getElementById('modeBanner').textContent='ยังไม่พร้อมใช้งาน';
    }
  }
  boot();
})();
