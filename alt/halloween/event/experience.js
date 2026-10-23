(() => {
  'use strict';
  const Core = window.HalloweenEventCore, Catalog = window.StudentOSHalloweenRewards;
  const Guide=window.HalloweenEventGuide,Balance=window.HalloweenEventBalance,audio=window.HalloweenEventSound.create();
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
  const PANEL_NAMES={shop:'ร้านยามเที่ยงคืน','shop-stock':'สินค้าของมอร์โร',cauldron:'ห้องปรุงยาของมอรา','cauldron-recipes':'สูตรผสมเวทมนตร์',ritual:'ห้องวงเวทโบราณ','ritual-recipes':'พิธีอัญเชิญ',quests:'สมุดเควส',vault:'กระเป๋าของฉัน',tasks:'งานวันนี้',ghosts:'ภารกิจสุสาน',totems:'Totem แห่งสี่โลก',village:'หมู่บ้าน Trick or Treat'};
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset = item => '../rewards/' + (item.asset || 'assets/' + item.id + '.svg');
  const image = id => '../rewards/assets/' + id + '.svg';
  let config, store, route = 'gate', shopFilter = 'all', vaultTab = 'rewards', toastTimer, detailAfterClose = null;
  let activePanel=null,activeRoom=null,typingFrame=0,typingLines=[],dialogueEpoch=0;
  let sourceReturn={};
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
      if (!feedback) { feedback = document.createElement('p'); feedback.className = 'dialog-feedback subtle'; feedback.setAttribute('role','status'); openDialog.append(feedback); }
      feedback.textContent = message;
    }
    const box = document.getElementById('eventToast'); clearTimeout(toastTimer); box.textContent = message; box.classList.toggle('error',error); box.hidden = false;
    toastTimer = setTimeout(() => { box.hidden = true; },4400);
  }
  function dialogShell(title,body,footer='') {
    return '<div class="dialog-top"><h2 id="detailHeading">' + title + '</h2><button class="dialog-x" data-open-guide aria-label="วิธีเล่น">?</button><button class="dialog-x" data-close-detail aria-label="ปิดหน้าต่าง">×</button></div>' + body + (footer ? '<div class="dialog-footer">' + footer + '</div>' : '');
  }
  function openDetail(html,afterClose=null) {
    finishTyping();activePanel=null;delete detail.dataset.scenePanel;detail.dataset.room=activeRoom||'';
    delete detail.dataset.guide;
    delete detail.dataset.plotBiome;
    detail.innerHTML = html; detailAfterClose = afterClose;
    detail.querySelectorAll('[data-close-detail]').forEach(b => b.addEventListener('click',() => detail.close()));
    if (!detail.open) detail.showModal();
    typeDialogue();
  }
  detail.addEventListener('close',() => {
    finishTyping();activePanel=null;
    if(activeRoom){activeRoom=null;if(preview&&store&&!read().event.closed)perform(route==='garden'?{type:'enter-room',room:'garden'}:route==='biome'?{type:'enter-biome',biome:currentBiome()}:{type:'enter-hub'},{silent:true});}
    delete detail.dataset.plotBiome;
    detail.querySelectorAll('iframe').forEach(f => f.removeAttribute('src'));
    const fn = detailAfterClose; detailAfterClose = null; if (fn) fn();
  });
  function finishTyping(){cancelAnimationFrame(typingFrame);dialogueEpoch++;for(const row of typingLines)if(row.el.isConnected){row.el.textContent=row.full;row.el.removeAttribute('data-typing');}typingLines=[];detail.querySelector('.dialogue-skip')?.remove();}
  function typeDialogue(){
    if(reduced())return;
    const epoch=++dialogueEpoch;
    typingLines=[...detail.querySelectorAll('.npc-line,.npc-dialogue')].map(el=>{const full=el.textContent,height=el.getBoundingClientRect().height;el.style.minHeight=height+'px';el.dataset.typing='true';const hidden=document.createElement('span');hidden.className='sr-label';hidden.textContent=full;const shown=document.createElement('span');shown.setAttribute('aria-hidden','true');el.replaceChildren(hidden,shown);return{el,shown,full,parts:typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('th',{granularity:'grapheme'}).segment(full)].map(x=>x.segment):Array.from(full)};});
    if(!typingLines.length)return;
    const skip=document.createElement('button');skip.className='quiet-button dialogue-skip';skip.textContent='แสดงข้อความทั้งหมด';skip.addEventListener('click',finishTyping);detail.querySelector('.dialog-footer')?.before(skip);
    const start=performance.now();
    const tick=t=>{if(epoch!==dialogueEpoch)return;if(document.hidden){finishTyping();return;}let done=true;for(const row of typingLines){const n=Math.floor((t-start)/18);row.shown.textContent=row.parts.slice(0,n).join('');if(n<row.parts.length)done=false;}if(done)finishTyping();else typingFrame=requestAnimationFrame(tick);};
    typingFrame=requestAnimationFrame(tick);
  }
  function showPanel(id){
    const world=window.HalloweenWorld;
    const content={shop:()=>world.room(worldContext(),'shop'),cauldron:()=>world.room(worldContext(),'cauldron'),ritual:()=>world.room(worldContext(),'ritual'),'shop-stock':shop,'cauldron-recipes':()=>recipes('cauldron'),'ritual-recipes':()=>recipes('ritual'),quests:questList,vault:inventory,tasks,ghosts,totems,village:()=>world.village(worldContext())}[id];
    if(!content)return;
    openDetail(dialogShell(PANEL_NAMES[id],content(),'<button class="secondary" data-close-detail>กลับฉาก</button>'),()=>history.replaceState(null,'','#'+route));
    activePanel=id;detail.dataset.scenePanel=['shop','cauldron','ritual'].includes(id)?'room':'menu';detail.dataset.room=activeRoom||'';
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
      const saved = await store.transact(tx,document => Core.dispatch(document,config,action,{now:Date.now(),tx}));
      const cue=({house:saved.result.candy?'coins':'ghost',quest:'magic',plant:'water',water:'water',harvest:'harvest','sell-crop':'coins','drink-biome-potion':'magic','enter-biome':'door','enter-room':'door','game-move':'tap'})[action.type];if(cue)audio.play(cue);
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
    if(next==='hub'&&!prefs.guideSeen)showGuide(true);
  }
  function currentBiome() { return Core.biomeAt(read(),config,Date.now()).id; }
  function worldContext() { return {Core,Catalog,config,doc:read(),now:Date.now(),name,duration,difficulty:biomeDifficulty}; }
  function worldToolbar() {
    return '<div class="scene-hud"><div class="hud-top"><button class="hud-home" data-route="hub" aria-label="กลับโถงกลาง">⌂</button><button class="hud-guide" data-open-guide aria-label="วิธีเล่น">? วิธีเล่น</button><span class="hud-wallet" title="Candy ห้องลอง">◈ <b data-scene-wallet>'+read().event.candy.toLocaleString('th-TH')+'</b></span><button data-toggle-scene-sound aria-label="'+(prefs.sound?'ปิดเสียง':'เปิดเสียง')+'">'+(prefs.sound?'♫':'♪')+'</button><button class="hud-motion" data-toggle-scene-motion aria-label="'+(reduced()?'เปิดอนิเมชัน':'หยุดอนิเมชัน')+'">'+(reduced()?'▶':'Ⅱ')+'</button><button data-open-preferences aria-label="ตั้งค่า">⚙</button></div><nav class="hud-tools" aria-label="อุปกรณ์การผจญภัย">'+[['biome','ไบโอมคืนนี้','✧'],['quests','สมุดเควส','▤'],['vault','กระเป๋า','◇'],['garden','สวน','❧'],['tasks','งานวันนี้','✓']].map(([id,label,symbol])=>'<button data-route="'+id+'" aria-label="'+label+'"><span aria-hidden="true">'+symbol+'</span><small>'+label+'</small></button>').join('')+'<button data-open-potion aria-label="น้ำยาหลงไบโอม"><span aria-hidden="true">⚗</span><small>น้ำยา</small></button></nav></div>';
  }
  function rememberPrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch{}}
  async function syncSoundUI(){document.querySelectorAll('[data-toggle-scene-sound]').forEach(b=>{b.textContent=prefs.sound?'♫':'♪';b.setAttribute('aria-label',prefs.sound?'ปิดเสียง':'เปิดเสียง');b.setAttribute('aria-pressed',String(prefs.sound));});await audio.setEnabled(prefs.sound);document.documentElement.dataset.sound=audio.state().playing?'on':prefs.sound?'waiting':'off';}
  function showGuide(first=false){
    const info=Guide.instructions(activeRoom||route);prefs.guideSeen=true;rememberPrefs();
    openDetail(dialogShell(first?'ยินดีต้อนรับ · เริ่มเล่นตรงนี้':info.title,'<p class="guide-intro">ทุกอย่างกดจากในฉากได้ ถ้าหาของไม่เจอ ให้กด “ดูวิธีหา” ใต้ของที่เควสต้องการ</p><ol class="guide-steps">'+info.steps.map(s=>'<li><h3>'+esc(s.title)+'</h3><p>'+esc(s.text)+'</p>'+(s.route?'<button class="secondary" data-route="'+s.route+'">'+esc(s.action)+'</button>':s.village?'<button class="secondary" data-guide-village>ไปหาวัตถุดิบ</button>':'')+'</li>').join('')+'</ol><button class="quiet-button" data-open-balance>โอกาสได้ของ · ความยากแต่ละ NPC</button>',(first?'<button class="secondary" data-start-with-sound>เริ่มพร้อมเสียงและอนิเมชัน</button>':'')+'<button class="primary" data-close-detail>เข้าใจแล้ว</button>'));
    detail.dataset.guide='true';
  }
  function sourceButton(id,attrs=''){return '<button class="item-source-button" data-item-source="'+esc(id)+'" '+attrs+'>ดูวิธีหา</button>';}
  function percent(value){return (value*100).toLocaleString('th-TH',{maximumFractionDigits:2})+'%';}
  function showSources(id,back={}){
    sourceReturn=back;const priority=s=>s.kind==='game'?-4:s.biome===currentBiome()?-3:0;
    const sources=Guide.sources(config,id).sort((a,b)=>priority(a)-priority(b)),best=Balance.best(config,id);
    const content=sources.map(s=>{
      if(s.kind==='house'){
        const open=Core.portalStatus(read(),config,s.biome,Date.now()).open,p=Balance.chance(config,id,s.biome);
        return '<article class="source-card"><h3>เคาะบ้านใน'+Guide.names[s.biome]+'</h3><p>ระดับ '+s.rarity+' · เมื่อใช้ Treat มีโอกาสได้ชิ้นนี้ '+percent(p)+' ต่อการเคาะ 1 ครั้ง รวมโอกาสข้ามไบโอมแล้ว เฉลี่ยประมาณ '+(1/p).toLocaleString('th-TH',{maximumFractionDigits:1})+' ครั้งต่อ 1 ชิ้น ไม่รับประกันจำนวนครั้ง</p><p class="tiny">'+(open?'ประตูนี้เปิดอยู่':'ประตูยังปิด รอรอบหรือใช้ Totem เปิดเส้นทางส่วนตัว')+'</p>'+(open?'<button class="primary" data-source-village="'+s.biome+'">ไปเคาะบ้านที่นี่</button>':'<button class="secondary" data-route="totems">ดูเส้นทาง Totem</button>')+'</article>';
      }
      if(s.kind==='quest')return '<article class="source-card"><h3>'+(s.upgrade?'ปลดข้อจำกัดในเควส ':'รางวัลเควส ')+s.order+' · '+esc(s.npc)+'</h3><p>อยู่ใน'+Guide.names[s.biome]+' ทำตามคำขอและส่งเควสให้ครบเฟส'+(s.upgrade?' ต้องมีไอเท็มชิ้นเดิมก่อน ไม่ได้รับเพิ่มอีกชิ้น':'')+'</p><button class="secondary" data-quest="'+s.quest+'">อ่านเควสนี้</button></article>';
      if(s.kind==='game')return '<article class="source-card"><h3>ผ่านเกมล่าสมบัติเรือผี</h3><p>รับโคมจาก Tang ก่อน แล้วผ่านเกมเรือเพื่อรับ Soul Anchor 1 ชิ้นพร้อม Candy</p><button class="secondary" data-quest="dutchman-light-in-darkness">ดูเควสรับโคมกับ Tang</button></article>';
      if(s.kind==='seed')return '<article class="source-card"><h3>เมล็ดจากเควสใน'+Guide.names[s.biome]+'</h3><p>ทำเควสหลักสำเร็จเพื่อรับเมล็ด หลังเคยทำสำเร็จแล้วขอเมล็ดเพิ่มผ่านคำขอในแปลงได้</p><button class="secondary" data-route="quests">ดูเควส</button></article>';
      if(s.kind==='garden')return '<article class="source-card"><h3>ปลูกและเก็บในสวนรัตติกาล</h3><p>รับเมล็ดจากเควส ปลูก รดน้ำ รอจนโตแล้วกดเก็บ ต้องเป็นผลผลิตที่ปลูกเอง</p><button class="primary" data-route="garden">ไปสวน</button></article>';
      const location={shop:['ร้านมอร์โร','shop'],cauldron:['เตาของมอรา','cauldron-recipes'],ritual:['วงเวทอัญเชิญ','ritual-recipes'],potion:['แม่มดมอรา','cauldron']}[s.kind];
      return location?'<article class="source-card"><h3>'+location[0]+'</h3><p>เตรียม Candy และวัตถุดิบตามรายการก่อนรับของ</p><button class="secondary" data-route="'+location[1]+'">ไปที่นี่</button></article>':'';
    }).join('');
    openDetail(dialogShell('วิธีหา '+esc(name(id)),'<p class="guide-intro">'+esc(Guide.summary(config,id))+'</p>'+content+(!sources.length?'<p class="subtle">ไอเทมนี้ยังไม่มีจุดรับในกติกาที่เปิดอยู่</p>':'')+(best.chance?'<p class="tiny">แนะนำ Treat สำหรับหาวัตถุดิบ · บ้านที่เคาะแล้วพัก 4 ชั่วโมง · อัตราในชุดลองเล่นยังรอยืนยัน</p>':''),'<button class="secondary" data-source-back>กลับ</button>'));
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
      return '<article class="source-card"><h3>'+esc(qs[0].npc)+' · '+Guide.names[biome]+'</h3><span class="difficulty" data-level="'+hardest.d.level+'">'+hardest.d.label+'</span><p>โอกาสได้วัตถุดิบสักชิ้นจาก Treat '+percent(Balance.anyItemChance(config,biome))+' ต่อครั้ง รวมระดับที่ไม่มีของและโอกาสข้ามไบโอมแล้ว</p>'+rows.map(({q,d})=>'<p><b>เควส '+q.order+' · '+d.label+'</b><br>'+(d.bottleneck?'ของบ้านรวมเฉลี่ย '+Math.ceil(d.expectedDraws)+' ครั้ง · คอขวด '+esc(name(d.bottleneck.id))+' '+d.bottleneck.need+' ชิ้น':'เน้น'+(d.game?'มินิเกม':'ทำเงื่อนไขเควส'))+(d.nextCycle?' · ต้องรอไบโอมรอบถัดไป':'')+'</p>').join('')+'</article>';
    }).join('');
    const four=Balance.cooldownComparison(config,4),one=Balance.cooldownComparison(config,1);
    openDetail(dialogShell('โอกาสได้ของและความยาก','<p class="guide-intro">คำนวณจากอัตราของชุดลองเล่น ใช้ Treat สมมติเปลี่ยนไบโอมได้ทันทีและไม่มีค่าเดินทาง คิดการสะสมของทุกชิ้นร่วมกัน เป็นค่าเฉลี่ยทางสถิติ ไม่ใช่เวลาที่รับประกันว่าจะจบเควส</p><p class="tiny">ตารางนี้เริ่มของจากศูนย์ ของแจกเริ่มต้นและของที่มีอยู่ช่วยลดภาระได้ ส่วนระดับในหน้าคุยเควสคิดจากของที่คุณยังขาดอยู่</p><div class="guide-grid">'+cards+'</div><h3>บ้านพัก 4 ชม. เทียบแนวคิด 1 ชม.</h3><p class="subtle">สมมติอยู่ไบโอมเดิมและเคาะครบ 5 หลังทุกรอบ: ทั้งสองแบบติดเพดาน 300 Candy หลัง Treat '+four.attempts+' ครั้ง ซึ่งมีจังหวะสุ่มของเฉลี่ย '+four.expectedDraws+' ครั้งก่อนหักระดับที่ไม่มีของ แบบ 4 ชม. ใช้ประมาณ '+four.capHours+' ชม. ส่วน 1 ชม. ใช้ '+one.capHours+' ชม. จึงใช้โควตาเร็วขึ้น แต่ไม่ได้เพิ่มโควตาของต่อ 24 ชม.</p><p class="tiny">1 ชั่วโมงยังไม่ยืนยัน · การหมุนไบโอมทุก 6 ชั่วโมงและค่า Totem อาจทำให้เวลาที่เล่นจริงต่างจากสมมติฐานนี้</p><h3>งาน StudentOS เป็นอีกทางหา Candy</h3><p class="subtle">งานวันนี้ในเกมยังเป็นตัวอย่าง รับงานละ '+config.proposals.taskCandy+' Candy เพดาน '+config.proposals.taskDailyCap+' Candy/วัน แยกจากเพดานบ้าน ยังไม่เชื่อมการทำงานเรียนจริงของบัญชี</p>','<button class="secondary" data-close-detail>กลับฉาก</button><button class="primary" data-route="tasks">ดูงานวันนี้</button>'));
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
    openDetail(dialogShell(esc(npc.name),npcSpeech(id,line)+choices,'<button class="secondary" data-close-detail>ไว้คุยกันใหม่</button>'+actions));
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
  function showTrade(message='มีผลผลิตมาขายหรือ? วางบนตาชั่งได้เลย ข้ารับเฉพาะของที่เจ้าปลูกจนโตและเก็บมาเอง'){
    const doc=read(),rows=Core.BIOMES.map(id=>{
      const c=config.proposals.crops[id],available=Math.min(doc.event.grown[c.harvest]||0,doc.event.inventory[c.harvest]||0);
      return '<div class="produce-row"><div><b>'+esc(c.name)+'</b><small>มี '+available+' ชิ้น · '+c.sellCandy+' Candy/ชิ้น</small></div><label><span class="sr-label">จำนวน'+esc(c.name)+'</span><input type="number" inputmode="numeric" min="1" max="'+available+'" step="1" value="'+(available||'')+'" id="sell-'+id+'" '+(!available?'disabled':'')+'></label><button class="secondary" data-offer-crop="'+id+'" '+(!available||doc.event.closed?'disabled':'')+'>ขาย</button></div>';
    }).join('');
    openDetail(dialogShell('มอร์โร · รับซื้อผลผลิต',npcSpeech('morro',message)+'<div class="produce-list">'+rows+'</div><p class="tiny">ราคาแลกเป็นค่าห้องลอง · ฟักทองปลูกเอง 3 ชิ้นใช้ส่ง Jack Q2 ได้</p>','<button class="secondary" data-npc="morro">กลับไปคุย</button><button class="primary" data-route="garden">กลับสวน</button>'));
  }
  function showPlot(id){
    if(!config.proposals.crops[id])return;
    const s=window.HalloweenWorld.cropState(worldContext(),id),attrs=' data-crop-biome="'+id+'"',doc=read(),first=config.quests.find(q=>q.biome===id),done=config.quests.some(q=>q.biome===id&&doc.event.quests[q.id]?.complete);
    const stage=!s.unlocked?'รับแปลงจาก Jack ก่อน':!s.planted?'แปลงว่าง พร้อมปลูก':s.ready?'โตเต็มที่แล้ว เก็บเกี่ยวได้':'กำลังเติบโต';
    const actions=!s.unlocked?'<button class="primary" data-quest="jack-clear-garden">ไปดูเควส Jack</button>':!s.planted?'<button class="primary" data-action="plant"'+attrs+' '+(!s.seeds||doc.event.closed?'disabled':'')+'>ปลูกเมล็ด</button>':'<button class="secondary" data-action="water"'+attrs+' '+(s.g.watered||doc.event.closed?'disabled':'')+'>รดน้ำ</button><button class="primary" data-action="harvest"'+attrs+' '+(!s.ready||doc.event.closed?'disabled':'')+'>เก็บเกี่ยว</button>';
    const repeat=done?(currentBiome()===id?'<p>ส่ง '+esc(name(s.crop.request))+' 2 ชิ้นเพื่อทำเควสรับเมล็ดเพิ่ม 2 ชิ้น</p><button class="secondary" data-seed-quest="'+id+'">ส่งเควสรับเมล็ดเพิ่ม</button>':'<p>ผ่านเควสแล้ว ขอเมล็ดเพิ่มได้เมื่อ'+esc(biomeName(id))+' เปิดอยู่ ส่วนเมล็ดที่มีนำมาปลูกต่อได้ทันที</p><button class="secondary" data-route="totems">ดูเส้นทางไบโอม</button>'):'<p>ทำเควสกับ NPC ใน '+esc(biomeName(id))+' เพื่อรับเมล็ด</p><button class="secondary" data-quest="'+first.id+'">ดูเควสประจำไบโอม</button>';
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
  function itemCard(item,button,extra='') {
    const owned = !!read().rewards[item.id];
    return '<article class="item-card" data-tier="' + item.rarity + '" style="' + tierStyle(item) + '"><span class="item-kind">' + esc(kindName(item.kind)) + '</span>' + (owned ? '<span class="item-owned">✓ อยู่ในคลัง</span>' : '') + '<div class="item-visual"><img src="' + asset(item) + '" alt="' + esc(item.name) + '" loading="lazy"></div><div class="item-info"><span class="item-tier">' + item.rarity + '</span><h3>' + esc(item.name) + '</h3><p>' + esc(Catalog.biomes[item.biome].name) + '</p>' + extra + button + '</div></article>';
  }
  function shop() {
    const doc = read(), closed = doc.event.closed;
    const items = Object.keys(config.proposals.shop).map(id => config.rewards[id]).filter(x => shopFilter==='all' || x.kind===shopFilter || x.rarity===shopFilter);
    return '<section class="shop-hero"><span class="eyebrow">THE MIDNIGHT EMPORIUM</span><h1>A little magic,<br>yours to keep.</h1><p>บางชิ้นเก็บแสงจากท่าเรือ บางชิ้นซ่อนเสียงหัวเราะ<br>เลือกของที่ทำให้ห้องเป็นโลกของเธอ</p><div class="shop-emblem"><img src="' + image('bottled-dutchman') + '" alt="เรือผีในขวด"></div></section>' +
      '<div class="shop-controls">' + [['all','ทั้งหมด'],['room','ของแต่งห้อง'],['effect','เอฟเฟกต์'],['Common','Common'],['Uncommon','Uncommon'],['Epic','Epic']].map(([id,label]) => '<button class="filter-button" data-shop-filter="' + id + '" aria-pressed="' + (shopFilter===id) + '">' + label + '</button>').join('') + '<span class="tiny">ราคาลองเล่น · ไม่ใช่ราคาที่ยืนยันแล้ว</span></div><div class="reward-grid">' + items.map(item => itemCard(item,'<button data-buy="' + item.id + '" ' + (doc.rewards[item.id] || closed ? 'disabled' : '') + '>' + (doc.rewards[item.id] ? 'อยู่ในคลังแล้ว' : '◈ ' + config.proposals.shop[item.id] + ' Candy · แลก') + '</button>')).join('') + '</div>' +
      '<section class="collection-progress"><img src="' + image('crown-of-midnight') + '" alt="เหรียญผู้สะสมแห่งรัตติกาล"><div><b>คำขอบคุณจากร้านยามเที่ยงคืน</b><p>ซื้อครบรายการร้าน รับเหรียญถาวร · ไม่นับของจากเควส หม้อ หรือพิธี</p></div><span class="count">' + doc.event.purchases.length + ' / ' + Object.keys(config.proposals.shop).length + '</span></section>' + theatre();
  }
  function recipeCosts(recipe) {
    return '<div class="recipe-cost"><span>◈ ' + recipe.candy + ' Candy</span>' + recipe.items.map(([id,n]) => '<button data-item-source="'+id+'" data-source-panel="'+(recipe.channel==='ritual'?'ritual-recipes':'cauldron-recipes')+'">' + esc(name(id)) + ' ×' + n + ' · วิธีหา</button>').join('') + (recipe.requiresAllMainQuests ? '<span>Main Quest ทั้ง 4 คน</span>' : '') + '</div>';
  }
  function recipes(channel) {
    const title = channel==='ritual' ? 'เมื่ออีกฟากตอบรับคำเรียก' : 'ผสมเรื่องเล่า ลงในหม้อเวท';
    return pageHead(channel==='ritual' ? 'THE SUMMONING CIRCLE' : 'THE WITCH’S CAULDRON',title,channel==='ritual' ? 'ชุด Rare อยู่ในพิธีอัญเชิญ · รางวัลที่ได้เก็บไว้ในคลังหลังวงเวทจางลง' : 'วัตถุดิบจากทั้งสี่โลก มีที่ทางในสูตรของแม่มด', 'สูตรลองเล่น') + '<div class="reward-grid ' + (channel==='ritual' ? 'ritual-grid' : 'recipe-grid') + '">' + config.proposals.recipes.filter(r => r.channel===channel).map(recipe => {
      const item = config.rewards[recipe.reward], owned = read().rewards[item.id];
      let html = itemCard(item,'<button data-craft="' + recipe.id + '" ' + (owned || read().event.closed ? 'disabled' : '') + '>' + (owned ? 'อยู่ในคลังแล้ว' : channel==='ritual' ? 'เริ่มพิธีอัญเชิญ ✦' : 'ใส่ส่วนผสม ♨') + '</button>',recipeCosts(recipe));
      html = html.replace('class="item-card"','class="item-card recipe-card ' + (item.rarity==='Secret' ? 'secret-card' : '') + '"');
      return html;
    }).join('') + '</div><p class="tiny" style="margin-top:20px">สูตร ราคา และเงื่อนไขธีมหลักในห้องลองเป็นข้อเสนอ ยังไม่ใช้รับรางวัลบัญชีจริง</p>' + theatre();
  }
  function theatre() {
    return '<section class="recipe-theatre"><span class="eyebrow">THE ART OF REVEAL</span><h2>ยิ่งหายาก ยิ่งมีเรื่องให้จดจำ</h2><p>ลองชมฉากรับรางวัลแต่ละระดับได้โดยไม่หัก Candy หรือเพิ่มของในคลัง</p><div class="tier-buttons">' + Object.keys(window.HalloweenAcquisition.profiles).map(tier => '<button data-theatre="' + tier + '">' + tier + '</button>').join('') + '</div></section>';
  }
  function questList() {
    const doc = read();
    return pageHead('FOUR STORIES TO REMEMBER','ทุกคำสัญญา มีเรื่องราว','คุยกับทั้งสี่ NPC ทำเควสทีละเฟส และเก็บของข้ามไบโอมไว้ส่งต่อกัน','14 เควส · 18 เฟส') + Core.BIOMES.map((biome,i) => {
      const meta = Catalog.biomes[Core.SHORT[i]], chain = config.quests.filter(q => q.biome===biome), done = chain.filter(q => doc.event.quests[q.id]?.complete).length;
      return '<section class="quest-chain" style="--biome:' + meta.color + ';--glow:' + meta.dark + '66"><div class="chain-head"><span class="chain-seal">' + biomeSymbols[i] + '</span><div><h2>' + esc(meta.npc) + '</h2><small>' + esc(meta.name) + '</small></div><span class="pill">' + done + ' / ' + chain.length + '</span></div>' + chain.map(q => {
        const s = Core.questStatus(doc,config,q), status = s.complete ? 'รับรางวัลแล้ว' : !s.unlocked ? 'รอเควสก่อนหน้า' : q.biome!==currentBiome() ? 'อยู่ไบโอมอื่น' : 'เฟส ' + (s.phase+1) + '/' + q.phases.length;
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
  function showQuest(id,branch=null) {
    const q = config.quests.find(x => x.id===id), doc = read(); if (!q) return;
    const status = Core.questStatus(doc,config,q), phase = q.phases[Math.min(status.phase,q.phases.length-1)];
    let requirements, blocked='';
    if (!branch && phase.requirements.anyOf) branch = phase.requirements.anyOf[0].id;
    try { requirements = Core.resolveRequirements(config,q,phase.requirements,branch); Core.checkRequirements(doc,requirements); }
    catch(error) { blocked = error.message; }
    if (status.complete) blocked='รับรางวัลแล้ว';
    else if (!status.unlocked) blocked='ต้องทำเควสก่อนหน้าให้ครบ';
    else if (q.biome!==currentBiome()) blocked='เปลี่ยนไปหา NPC ใน ' + biomeName(q.biome);
    else if (q.availability?.mustWaitForNextOccurrence && Core.biomeAt(doc,config,Date.now()).cycle <= doc.event.quests[q.prerequisite].completedCycle) blocked='รอไบโอมวนกลับมาในวัฏจักรถัดไป';
    if (doc.event.closed) blocked='อีเวนต์ปิดแล้ว';
    const offer = phase.requirements.anyOf ? '<div class="offer-options">' + phase.requirements.anyOf.map(x => '<label><input type="radio" name="quest-offer" value="' + x.id + '" ' + (branch===x.id ? 'checked' : '') + '> ' + (x.candy ? x.candy+' Candy' : 'ส่งวัตถุดิบ') + '</label>').join('') + '</div>' : '';
    const text = status.complete ? phase.completeDialogue : phase.acceptDialogue || q.phases[Math.max(0,status.phase-1)]?.completeDialogue;
    const game = requirements?.minigame ? requirements.minigame.id || 'ghost-ship-hunt' : requirements?.objective?.id;
    openDetail(dialogShell(esc(q.npc),'<span class="eyebrow">QUEST ' + q.order + ' · PHASE ' + Math.min(status.phase+1,q.phases.length) + ' / ' + q.phases.length + '</span><h3 style="font-weight:400;font-size:19px;line-height:1.7">' + esc(q.name) + '</h3><p class="npc-dialogue">' + esc(text) + '</p>' + offer + (status.complete ? '<p class="subtle">✓ รางวัลอยู่ในคลังแล้ว</p>' : '<div class="requirement-list">' + (requirements ? requirementRows(requirements,id,branch) : '<p class="subtle">' + esc(blocked) + '</p>') + '</div>') + (game && !status.complete ? '<button class="quiet-button" data-quest-game="' + game + '">ไปเล่น ' + esc(window.HalloweenEventGames.names[game]) + ' →</button>' : '') + (blocked && !status.complete ? '<p class="tiny">' + esc(blocked) + '</p>' : ''),
      '<button class="secondary" data-close-detail>กลับ</button>' + (!status.complete ? '<button class="primary" id="submitQuest" ' + (blocked ? 'disabled' : '') + '>ส่งเควส</button>' : '')));
    detail.querySelectorAll('[name=quest-offer]').forEach(r => r.addEventListener('change',() => showQuest(id,r.value)));
    const difficulty=Balance.difficulty(config,q,doc.event.inventory);const badge=document.createElement('p');badge.className='quest-difficulty';badge.innerHTML='<span class="difficulty" data-level="'+difficulty.level+'">ความยากตอนนี้: '+difficulty.label+'</span><button class="quiet-button" data-open-balance>ดูโอกาสและเกณฑ์</button>';detail.querySelector('.npc-dialogue').before(badge);
    const portrait=document.createElement('div');portrait.className='quest-npc-portrait';portrait.innerHTML=window.HalloweenWorld.portrait(window.HalloweenNPCs.biomeCharacters[biomeIndex(q.biome)]);detail.querySelector('.npc-dialogue').before(portrait);
    if(!status.complete){const p=document.createElement('p');p.className='subtle';p.textContent='เมื่อเควสสำเร็จ จะได้รับเมล็ด'+config.proposals.crops[q.biome].name+' '+config.proposals.crops[q.biome].questSeeds+' ชิ้น';detail.querySelector('.dialog-footer').before(p);}
    detail.querySelector('[data-quest-game]')?.addEventListener('click',() => { detail.close(); openGame(game); });
    detail.querySelector('#submitQuest')?.addEventListener('click',async e => {
      e.currentTarget.disabled=true;
      const result = await perform({type:'quest',quest:id,branch});
      if (!result) { e.currentTarget.disabled=false; return; }
      openDetail(dialogShell(esc(result.npc),'<p class="npc-dialogue">' + esc(result.dialogue) + '</p>'+(result.seeds?'<p class="story-copy">❧ ได้รับ '+esc(name(result.seeds.id))+' ×'+result.seeds.quantity+'<br>นำไปปลูกในแปลงของไบโอมนี้ได้เลย</p>':''),'<button class="primary" data-close-detail>' + (result.rewards.length ? 'รับของที่สัญญาไว้ ✦' : 'เดินทางต่อ →') + '</button>'),() => acquisition(result.rewards,'quest'));
    });
  }
  function showPurchase(id) {
    const item = config.rewards[id], price = config.proposals.shop[id]; if (!item || !price) return;
    openDetail(dialogShell('ของชิ้นนี้… กลับบ้านกับเธอ','<div class="buy-detail-art"><img src="' + asset(item) + '" alt="' + esc(item.name) + '"></div><div class="buy-detail-copy"><span class="item-tier" style="' + tierStyle(item) + '">' + item.rarity + '</span><h3>' + esc(item.name) + '</h3><p>' + esc(item.description) + '</p></div><div class="purchase-total"><span>ราคาลองเล่น</span><strong>◈ ' + price + ' Candy</strong></div>', '<button class="secondary" data-close-detail>เก็บไว้คิดก่อน</button><button class="primary" id="confirmPurchase" ' + (read().event.candy<price ? 'disabled' : '') + '>แลกและปลุกเวทมนตร์</button>'));
    detail.querySelector('#confirmPurchase').addEventListener('click',async e => {
      e.currentTarget.disabled=true;
      const result = await perform({type:'buy',item:id});
      if (!result) { e.currentTarget.disabled=false; return; }
      detail.close(); acquisition(result.rewards,'shop');
    });
  }
  function inventory() {
    const doc = read(), owned = Object.keys(doc.rewards);
    const inventory = Object.entries(doc.event.inventory).filter(([,n]) => n>0);
    return pageHead('THE THINGS WE BRING HOME','ความทรงจำในคลังของฉัน','ของที่รับไว้จะยังอยู่ หลังประตูอีเวนต์ปิดลง', owned.length+' / 28 รางวัล') +
      '<div class="shop-controls inventory-tabs"><button class="filter-button" data-vault-tab="rewards" aria-pressed="' + (vaultTab==='rewards') + '">รางวัล ' + owned.length + '</button><button class="filter-button" data-vault-tab="materials" aria-pressed="' + (vaultTab==='materials') + '">วัตถุดิบ ' + inventory.length + '</button><button class="filter-button" data-vault-tab="ledger" aria-pressed="' + (vaultTab==='ledger') + '">รับ–ใช้ Candy</button><button class="filter-button" data-open-potion>น้ำยาไบโอม</button><span class="tiny">รางวัลที่รับไว้เก็บถาวร</span></div>' +
      (vaultTab==='materials' ? '<div class="inventory-grid">' + inventory.map(([id,n]) => '<article class="material-card"><span class="material-icon">◈</span><div><b>' + esc(name(id)) + '</b><small>' + esc(config.items[id]?.rarity || 'ไอเท็มเควส / ระดับยังไม่กำหนด') + (doc.event.grown[id] ? ' · ปลูกเอง '+doc.event.grown[id] : '') + '</small></div><strong>' + n + '</strong></article>').join('') + '</div>' : vaultTab==='ledger' ? '<div class="ledger">' + [...doc.event.ledger].reverse().map(row => '<div class="ledger-row"><span>' + esc({'preview-supplies':'ชุดทดสอบ','house':'เคาะบ้าน','spend':'ส่งเควส / ผสม','quest':'รางวัลเควส','shop':'ร้านค้า','ship-chest':'กล่องจากเรือ','ship-repair':'ซ่อมเรือ','visitor':'นักเดินทาง','task':'งานตัวอย่าง','totem':'Totem'}[row.source] || row.source) + '</span><small>' + new Date(row.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}) + '</small><b>' + (row.amount>0 ? '+' : '') + row.amount + '</b></div>').join('') + '</div>' : owned.length ? '<div class="reward-grid">' + owned.map(id => {
        const item = config.rewards[id], restriction = doc.rewards[id].restriction;
        return itemCard(item,'<button data-inspect="' + id + '">เปิดดูความทรงจำ ↗</button>',restriction ? '<span class="relic-restriction">Restricted · ใช้เฉพาะ Eternal Graveyard</span>' : item.kind==='relic' && id==='dullahan-scythe' ? '<span class="tiny" style="margin-bottom:12px">ปลดผนึกแล้ว · ใช้ได้ทุกไบโอม</span>' : '');
      }).join('') + '</div>' : '<div class="empty-state"><span>◇</span><h2>รอเรื่องเล่าชิ้นแรกของเธอ</h2><p>เคาะบ้าน ทำเควส หรือแวะร้านยามเที่ยงคืน</p><button class="primary" data-route="shop">ไปเลือกรางวัล →</button></div>');
  }
  function tasks() {
    return pageHead('A LITTLE MAGIC IN REAL LIFE','งานเสร็จ ก็มีของขวัญ','ทดลองวงจรรับ Candy จากงานตัวอย่าง · ไม่เปลี่ยนงานเรียนในบัญชีจริง','ค่ารางวัลยังรอยืนยัน') + '<div class="task-list">' + ['ทบทวนคำศัพท์ภาษาอังกฤษ 10 คำ','สรุปสูตรคณิตศาสตร์หนึ่งหน้า','อ่านบทเรียนแล้วจดประเด็นสำคัญ'].map((title,i) => {
      const id = 'review-task-'+(i+1), done = read().event.taskClaims[id];
      return '<article class="task-card"><span class="material-icon">' + (done ? '✓' : '◇') + '</span><div><b>' + title + '</b><p>งานตัวอย่าง · รับ ' + config.proposals.taskCandy + ' Candy ได้ครั้งเดียว</p></div><button class="' + (done ? 'secondary' : 'primary') + '" data-task="' + id + '" ' + (done || read().event.closed ? 'disabled' : '') + '>' + (done ? 'รับแล้ว ✓' : 'ลองทำเสร็จ') + '</button></article>';
    }).join('') + '</div>';
  }
  function ghosts() {
    return pageHead('ETERNAL GRAVEYARD','อย่าปล่อยให้วิญญาณหลงทาง','รับ Shovel จาก Win Q1 เล่นขุดหลุมศพให้จบ แล้วจับผีทั้งหมดใน 30 วินาที') + '<div class="activity-grid"><button class="activity-card" data-game="grave-digging"><span class="activity-icon">⚒</span><h3>ขุดหลุมศพ</h3><p>เล่นให้จบหนึ่งครั้งเพื่อปลุกวิญญาณ</p><span class="arrow">→</span></button><button class="activity-card" data-game="catch-all-ghosts"><span class="activity-icon">♙</span><h3>จับผีทั้งหมด</h3><p>นำทุกดวงวิญญาณกลับมาภายใน 30 วินาที</p><span class="arrow">→</span></button><button class="activity-card" data-quest="win-gravekeeper-trial"><span class="activity-icon">☾</span><h3>กลับไปหา Win</h3><p>ส่งผลทดสอบเพื่อปลดล็อกเควสสร้างอาวุธ</p><span class="arrow">→</span></button></div>';
  }
  function totems() {
    return pageHead('A PATH OF YOUR OWN','Totem แห่งสี่โลก','เปลี่ยนไบโอมส่วนตัว 15 นาที · คูลดาวน์บ้านยังอยู่ · ไม่ข้ามวัฏจักรเควส','ค่าลองเล่น') + '<div class="totem-options">' + Core.BIOMES.map((id,i) => '<button data-totem="' + id + '"><img src="' + image(biomeArts[i]) + '" alt=""><b>' + esc(biomeName(id)) + '</b><br>◈ ' + config.proposals.totem.price + ' Candy</button>').join('') + '</div>';
  }
  function inspect(id) {
    const item = config.rewards[id], owned = read().rewards[id]; if (!item || !owned) return;
    openDetail(dialogShell(esc(item.name),'<div class="buy-detail-art"><img src="' + asset(item) + '" alt="' + esc(item.name) + '"></div><span class="item-tier" style="' + tierStyle(item) + '">' + item.rarity + '</span><p class="subtle">' + esc(item.description) + '</p><p class="tiny">' + (owned.restriction ? 'Restricted · ใช้เฉพาะ Eternal Graveyard รอปลดผนึกใน Win Q5' : 'รางวัลถาวรในห้องลอง · ยังอยู่หลังจำลองปิดอีเวนต์') + '</p>', '<button class="secondary" data-close-detail>เก็บกลับเข้าคลัง</button>' + (['theme','costume','room','effect'].includes(item.kind) ? '<button class="primary" id="tryOwned">ลองใน StudentOS ↗</button>' : '')));
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
    await window.HalloweenEventGames.open(id,{perform,read,now,reduced,toast,onClose:render});
  }
  function showPreferences() {
    const closed = preview && store && read().event.closed;
    preferences.innerHTML = '<div class="dialog-top"><h2 id="preferencesHeading">บรรยากาศและห้องลอง</h2><button class="dialog-x" id="closePreferences" aria-label="ปิดตั้งค่า">×</button></div><div class="preference-row"><div>ภาพเคลื่อนไหว<small>เคารพการลดการเคลื่อนไหวของอุปกรณ์</small></div><button class="secondary" id="toggleMotion">' + (reduced() ? 'ภาพนิ่ง' : 'เปิดอยู่') + '</button></div><div class="preference-row"><div>เสียงบรรยากาศและกิจกรรม<small>เพลงเบา ๆ ลม ประตู คุย รดน้ำ เก็บเกี่ยว และรับของ ปิดเสียงได้ตลอด</small></div><button class="secondary" id="toggleSound">' + (prefs.sound ? 'เปิดอยู่' : 'ปิดอยู่') + '</button></div>' + (preview ? '<details class="review-tools"><summary>เครื่องมือสำหรับลองให้ครบ</summary><p>เปลี่ยนเฉพาะชุดข้อมูลห้องลองนี้ ไม่เพิ่ม Candy วัตถุดิบ หรือสิทธิ์ในบัญชีจริง</p><div class="tool-buttons"><button class="secondary" data-tool="supplies">เติม Candy + วัตถุดิบ</button><button class="secondary" data-tool="hour">ข้ามเวลา 4 ชม.</button><button class="secondary" data-tool="day">ข้ามเวลา 1 วัน</button><button class="secondary" data-tool="minute">ข้ามเวลา 1 นาที</button><button class="secondary" data-tool="close">' + (closed ? 'เปิดห้องลองอีกครั้ง' : 'จำลองปิดอีเวนต์') + '</button></div></details><details class="review-tools"><summary>ค่าทดลองที่ยังรอเจ้าของยืนยัน</summary><ul class="rules-list"><li>บ้านนับคูลดาวน์รายหลังแยกไบโอม เพดานย้อนหลัง 24 ชม. จ่ายเท่าที่เหลือ ไม่สุ่มของเมื่อจ่าย 0</li><li>ดรอปครั้งละ 1 สุ่มชื่อเท่ากัน ตาราง Vampire/Graveyard และกรณีระดับว่างเป็นค่าลองเล่น</li><li>ราคา/รายการร้าน สูตรหม้อและพิธี รวมเงื่อนไขธีมหลักเป็นข้อเสนอ</li><li>Dech Q2/Q3 ใช้จำนวนอย่างละ 1 เพื่อเดินทดสอบ; Shovel ไม่หักในห้องลอง</li><li>สวนใช้เมล็ด 1 โต 1 นาที ได้ 3 Pumpkin; Totem 40 Candy ใช้ 15 นาที</li><li>มินิเกม: เรือเวลา 15/13/11/9/7/5 วินาที กล่อง 35 Candy; จับผิดภาพ 5 จุด; ขุด 8 ชั้น; ผี 6 ตัว</li><li>กำหนดวันจริง timezone และการรับของข้ามเครื่องยังไม่เปิดใช้งาน</li></ul></details><button class="quiet-button" data-preference-route="totems">ไปดู Totem ทั้งสี่ไบโอม →</button>' : '<p class="subtle">ระบบรับรางวัลจริงยังปิดอยู่ เปิดห้องลองเพื่อชมและเล่นได้</p>');
    preferences.querySelector('#closePreferences').addEventListener('click',() => preferences.close());
    if(preview){
      const tools=document.createElement('div');tools.className='review-tools';
      tools.innerHTML='<p>เปิดประตูไบโอมเพื่อทดสอบ · เฉพาะห้องลอง</p><div class="tool-buttons">'+Core.BIOMES.map(id=>'<button class="secondary" data-biome="'+id+'">'+esc(biomeName(id))+'</button>').join('')+'</div>';
      preferences.querySelector('.review-tools').append(tools);
    }
    const savePrefs = () => { try { localStorage.setItem(PREF_KEY,JSON.stringify(prefs)); } catch { toast('จำการตั้งค่าไม่ได้ในเบราว์เซอร์นี้',true); } syncMotionUI(); syncSoundUI(); };
    preferences.querySelector('#toggleMotion').addEventListener('click',e => { prefs.motion = reduced() ? 'full' : 'still'; prefs.motionChosen = true; savePrefs(); e.currentTarget.textContent = reduced() ? 'ภาพนิ่ง' : 'เปิดอยู่'; });
    preferences.querySelector('#toggleSound').addEventListener('click',e => { prefs.sound=!prefs.sound; savePrefs(); e.currentTarget.textContent=prefs.sound ? 'เปิดอยู่' : 'ปิดอยู่'; });
    preferences.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click',async () => {
      const tool = button.dataset.tool;
      const action = tool==='supplies' ? {type:'preview-supplies'} : tool==='close' ? {type:'preview-close'} : {type:'preview-time',ms:tool==='hour' ? 4*Core.HOUR : tool==='day' ? Core.DAY : 60000};
      const result = await perform(action);
      if (result) { if (tool==='close') button.textContent=read().event.closed ? 'เปิดห้องลองอีกครั้ง' : 'จำลองปิดอีเวนต์'; toast('อัปเดตข้อมูลห้องลองแล้ว'); }
    }));
    preferences.querySelector('[data-preference-route]')?.addEventListener('click',() => { preferences.close(); navigate('totems'); });
    const leave=document.createElement('a');leave.className='quiet-button';leave.href='../../';leave.textContent='กลับ StudentOS';preferences.append(leave);
    preferences.showModal();
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
  }
  function updateClock() {
    if (!store || !preview) return;
    if(main.dataset.biome!==currentBiome()&&['hub','biome'].includes(route)&&!detail.open&&!document.getElementById('gameDialog').open){render();return;}
    const at=now();
    detail.querySelectorAll('[data-house-status]').forEach(label=>{
      const a=Core.houseAvailability(read(),config,Number(label.dataset.houseStatus),Date.now()),door=label.closest('button'),wait=a.availableAt;
      door.disabled=!a.ready||read().event.closed;
      label.textContent=a.ready?'เคาะประตู':(a.remaining===0?'เปิดได้เร็วสุดอีก ':'เปิดอีก ')+duration(wait-at);
      if(!a.ready){const clock=new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(wait));label.textContent+=' · '+clock+' น.';}
    });
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
  document.addEventListener('visibilitychange',()=>audio.setVisible(!document.hidden));
  window.addEventListener('pagehide',()=>audio.dispose());
  let lastPointerType='mouse';
  document.addEventListener('pointerdown',e=>{lastPointerType=e.pointerType||'mouse';const target=e.target.closest('.world-spot,.world-portal,.garden-bed');document.querySelectorAll('[data-armed]').forEach(b=>{if(b!==target)delete b.dataset.armed;});});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('[data-armed]').forEach(b=>delete b.dataset.armed);});
  document.addEventListener('click',async e => {
    if(e.target.closest('.npc-line[data-typing],.npc-dialogue[data-typing]')){finishTyping();return;}
    const button = e.target.closest('button,a'); if (!button) return;
    const mapTarget=button.matches('.world-scene .world-spot,.world-scene .world-portal,.world-scene .garden-bed');
    if(mapTarget&&window.HalloweenWorld.shouldArm({pointerType:e.pointerType||lastPointerType,detail:e.detail,armed:button.dataset.armed==='true',labelVisible:button.matches('.village-sign,.portal-open')})){
      e.preventDefault();document.querySelectorAll('[data-armed]').forEach(b=>delete b.dataset.armed);button.dataset.armed='true';return;
    }
    document.querySelectorAll('[data-armed]').forEach(b=>delete b.dataset.armed);
    if(prefs.sound)audio.setEnabled(true);
    if(button.hasAttribute('data-toggle-scene-sound')){prefs.sound=!prefs.sound;rememberPrefs();syncSoundUI();return;}
    if(button.hasAttribute('data-start-with-sound')){prefs.sound=true;prefs.motion='full';prefs.motionChosen=true;rememberPrefs();syncSoundUI();syncMotionUI();detail.close();return;}
    if(button.hasAttribute('data-open-guide')){showGuide();return;}
    if(button.hasAttribute('data-open-balance')){showBalance();return;}
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
    if(button.dataset.offerCrop){
      const id=button.dataset.offerCrop,crop=config.proposals.crops[id],quantity=Number(detail.querySelector('#sell-'+id).value),doc=read(),available=Math.min(doc.event.grown[crop.harvest]||0,doc.event.inventory[crop.harvest]||0);
      if(!Number.isSafeInteger(quantity)||quantity<1||quantity>available){toast('เลือกจำนวนเต็มตั้งแต่ 1 ถึง '+available+' ชิ้น',true);return;}
      openDetail(dialogShell('มอร์โร · ตกลงรับซื้อ',npcSpeech('morro','ข้ารับ'+crop.name+' '+quantity+' ชิ้น แลก '+quantity*crop.sellCandy+' Candy ตกลงไหม?')+(id===Core.BIOMES[1]?'<p class="subtle">Jack Q2 ต้องใช้ฟักทองปลูกเอง 3 ชิ้น เผื่อไว้ส่งเควสได้</p>':''),'<button class="secondary" data-trade>เก็บไว้ก่อน</button><button class="primary" data-confirm-crop="'+id+'" data-quantity="'+quantity+'">ตกลงขาย</button>'));return;
    }
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
    if(button.dataset.finishStory){if(await perform({type:'story-seen',biome:button.dataset.finishStory},{silent:true}))detail.close();return;}
    if(button.dataset.knock){
      const n=Number(button.dataset.knock);openDetail(dialogShell('บ้านหลังที่ '+n+' · เคาะ เคาะ…','<p class="story-copy">ใครอยู่หลังประตู เลือกทักทายแล้วรอของขวัญจากเจ้าบ้าน</p>','<button class="secondary" data-house="'+n+'" data-choice="trick">Trick · ลุ้น 20 หรือ 0</button><button class="primary" data-house="'+n+'" data-choice="treat">Treat · รับ 10 Candy</button>'));return;
    }
    if(button.dataset.seedQuest){const r=await perform({type:'seed-quest',biome:button.dataset.seedQuest});if(r){showPlot(button.dataset.seedQuest);toast('ส่งเควสสำเร็จ ได้เมล็ด '+r.seeds.quantity+' ชิ้น');}return;}
    if(button.dataset.confirmCrop){button.disabled=true;const r=await perform({type:'sell-crop',biome:button.dataset.confirmCrop,quantity:Number(button.dataset.quantity)});if(r){showTrade('รับของเรียบร้อยแล้ว นี่ Candy '+r.candy+' ที่ข้าตกลงไว้ ไว้เก็บเกี่ยวรอบหน้าก็แวะมาอีกนะ');toast('มอร์โรรับซื้อแล้ว +'+r.candy+' Candy');}else button.disabled=false;return;}
    if (button.matches('[data-open-preferences]')) { e.preventDefault(); showPreferences(); return; }
    if (!preview && button.matches('[data-route]')) { e.preventDefault(); toast('เปิดห้องลองก่อนเพื่อสำรวจ'); return; }
    if (button.dataset.route==='biome') {
      const id=currentBiome(),result=await perform({type:'enter-biome',biome:id},{silent:true});
      if(result){navigate('biome');if(result.firstStory)showStory(id);}return;
    }
    if (button.dataset.route) { navigate(button.dataset.route); return; }
    if (button.dataset.biome) { if (await perform({type:'preview-biome',biome:button.dataset.biome})) {preferences.close();navigate('hub');toast('เปิดประตูทดลอง ' + biomeName(button.dataset.biome));} return; }
    if (button.dataset.quest) { showQuest(button.dataset.quest); return; }
    if (button.dataset.buy) { showPurchase(button.dataset.buy); return; }
    if (button.dataset.shopFilter) { shopFilter=button.dataset.shopFilter; render(); return; }
    if (button.dataset.vaultTab) { vaultTab=button.dataset.vaultTab; render(); return; }
    if (button.dataset.inspect) { inspect(button.dataset.inspect); return; }
    if (button.dataset.house) {
      const result = await perform({type:'house',house:Number(button.dataset.house),choice:button.dataset.choice});
      if (result) {
        const found = result.item;
        openDetail(dialogShell(result.candy ? 'ประตูเปิด พร้อมของขวัญเล็ก ๆ' : 'แกล้งผี… ผีแกล้งกลับ','<div class="buy-detail-copy"><p style="font:52px Georgia,serif;color:#e2bf90;margin:24px 0">' + (result.candy ? '+'+result.candy : '0') + '</p><span class="eyebrow">CANDY</span><p>' + (found ? 'และ ' + esc(name(found.id)) + ' ×'+found.quantity+' · '+found.rarity + (found.breakthrough ? '<br>✦ Breakthrough จาก '+esc(biomeName(found.biome)) : '') : result.candy ? 'รอบนี้ได้รับ Candy แต่ยังไม่พบวัตถุดิบ ลองแวะบ้านถัดไป' : 'รอบนี้ได้เสียงหัวเราะกลับมา ครั้งหน้าค่อยลองใหม่') + '</p></div>','<button class="secondary" data-close-detail>กลับฉาก</button><button class="primary" data-route="village">เคาะบ้านถัดไป</button>'));
      }
      return;
    }
    if (button.dataset.craft) {
      const recipe = config.proposals.recipes.find(r => r.id===button.dataset.craft);
      const result = await perform({type:'craft',recipe:recipe.id}); if (result) acquisition(result.rewards,recipe.channel); return;
    }
    if (button.dataset.theatre) {
      const item = Catalog.items.find(x => x.rarity===button.dataset.theatre);
      window.HalloweenAcquisition.open(item,{asset:asset(item),color:Catalog.tiers[item.rarity].color,channel:'cauldron',reduced:reduced(),sound:prefs.sound,presentationOnly:true}); return;
    }
    if (button.dataset.game) { openGame(button.dataset.game); return; }
    if (button.hasAttribute('data-visitor')) { if (await perform({type:'visitor',index:Number(button.dataset.visitor)})) {showVisitors();toast('ส่งของแล้ว นักเดินทางฝาก Candy ไว้ให้');} return; }
    if (button.dataset.task) { if (await perform({type:'task',task:button.dataset.task})) toast('งานตัวอย่างเสร็จแล้ว รับ Candy เรียบร้อย ✓'); return; }
    if (button.dataset.totem) { if (await perform({type:'totem',biome:button.dataset.totem})) { navigate('explore'); toast('Totem เปิดเส้นทางส่วนตัว 15 นาที'); } return; }
    if (button.dataset.action) { if (await perform({type:button.dataset.action,biome:button.dataset.cropBiome})) {if(button.dataset.cropBiome)showPlot(button.dataset.cropBiome);toast(({harvest:'เก็บผลผลิตแล้ว นำไปขายกับพ่อค้าในร้านได้',water:'รดน้ำแล้ว รอผลผลิตได้เลย',plant:'ปลูกเมล็ดจากเควสแล้ว อย่าลืมรดน้ำ',repair:'ซ่อมเรือแล้ว ออกเดินทางได้เลย'})[button.dataset.action]);} }
  });
  document.getElementById('preferencesButton').addEventListener('click',showPreferences);
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
          doc.event.candy=260; doc.event.ledger.push({id:'review-welcome',source:'preview-supplies',amount:260,at:seedTime});
          doc.event.inventory={'dutchmans-soul-abyssal-rock':2,'dutchmans-soul-dutchman-s-lantern':1,'jacks-hollow-rotten-pumpkin':2};
          return doc;
        }});
        read();
      }
      const hash = location.hash.slice(1); if (['gate','hub','biome','garden'].includes(hash)) route=hash;
      else if(preview&&read().event.visits?.hub)route='hub';
      else if(PANEL_NAMES[hash])route='hub';
      if(preview&&ROOM_ROUTES[route]&&!read().event.closed)await perform({type:'enter-room',room:ROOM_ROUTES[route]},{silent:true});
      updateWallet(); updateBanner(); render();
      if(preview&&PANEL_NAMES[hash])await navigate(hash);
      else if(preview&&route==='hub'&&!prefs.guideSeen)showGuide(true);
      setInterval(updateClock,1000);
    } catch(error) {
      main.innerHTML = '<section class="locked-event"><h1>เปิดห้องลองไม่ได้ในตอนนี้</h1><p>' + esc(error.message) + '</p><p class="tiny">ข้อมูลเดิมยังอยู่ ไม่มีการล้างหรือรับของเพิ่ม</p><button class="secondary" id="retryEvent">ลองเปิดอีกครั้ง</button></section>';
      document.getElementById('retryEvent').addEventListener('click',() => location.reload());
      document.getElementById('modeBanner').textContent='ยังไม่พร้อมใช้งาน';
    }
  }
  boot();
})();
