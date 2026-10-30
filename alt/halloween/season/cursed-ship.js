// ============================================================
// THE CURSED SHIP · เอฟเฟกต์ตอนงานเสร็จ (ตัวเลือกในตั้งค่า › ธีมสี › เอฟเฟกต์ตอนงานเสร็จ)
// ------------------------------------------------------------
// เจ้าของส่งสตอรีบอร์ด 12 ช่อง (25 ต.ค. 69) แล้วขอ "ให้เหมือนที่สุดเท่าที่เป็นไปได้"
// ภาพทุกช็อตตัดมาจากสตอรีบอร์ดของเจ้าของเอง (cursed-ship/*.webp · ลบป้ายตัวเลข/การ์ดเดิมออกแล้ว
// สร้างใหม่ได้ด้วย halloween/tools/build-cursed-ship-art.py) แล้วตัดต่อเป็นช็อตตามลำดับช่อง:
//   ช่อง 1 ใบงานเรือง → 2 หมอกม่วง → 3 เรือผีโผล่ → 4 ใบงานลอยบนดาดฟ้า (พลังเขียว)
//   → 5 ตราประทับ CLAIMED BY DUTCHMAN → 6 เรือแล่นหาย → 11 จันทร์กับป่าช้า → 7–10 หน้าสรุป
// ตัวหนังสือและตัวเลขทั้งหมดเป็น HTML ของจริงที่วางทับภาพ ไม่ใช่ตัวหนังสือในภาพ
//
// รอบแรกฉากนี้เล่นเองทุกครั้งในช่วงฮาโลวีน เฉพาะโหมดโฟกัส — เจ้าของหาไม่เจอ แล้วสั่งให้เป็น
// "เอฟเฟกต์ตอนงานเสร็จอันใหม่" แทน: เลือกเองในตั้งค่า แล้วเล่นทุกที่ที่ติ๊กงานเสร็จ
// (โหมดโฟกัส · ติ๊กจากหน้าแรก/รายการ) ผ่านช่องทางเดียวกับเอฟเฟกต์อื่นใน hoop.js
//
// กติกาที่ตั้งใจ (อย่าแก้โดยไม่รู้เหตุผล):
//   • งานถูกบันทึกว่าเสร็จก่อนฉากนี้เริ่ม (finishFocus / toggleDone ใน app.js) — ฉากเป็นแค่ฉลอง
//     ไฟล์นี้ไม่แตะ state ไม่แตะสถิติ ตัวเลขบนใบคืออ่านจากงานจริงด้วยสูตรเดียวกับจอ "เสร็จแล้ว"
//   • ทั้งฉาก 6 วิ แตะตรงไหนก็ข้าม · Esc/ปุ่มย้อนกลับ = ข้าม · onClose เรียกครั้งเดียวเสมอ
//   • ลดการเคลื่อนไหว (ระบบ) · ภาพนิ่งฮาโลวีน (data-hw-motion="still") · กราฟิกน้อย · ภาพยังโหลดไม่ครบ
//     = ใช้ภาพนิ่งตามค่าเริ่มต้น ผู้ใช้เปิดเฉพาะฉากรางวัลได้ที่ตัวเลือกเอฟเฟกต์ โดยจอ "เสร็จแล้ว" ของโหมดโฟกัสยังเป็นฉบับเรือผี (ช่อง 12)
//   • ไม่มีเสียง — ฉากไม่พึ่งเสียง จึงไม่มีอะไรพังตอนปิดเสียง/ไม่มีไฟล์
// ============================================================
(function () {
  'use strict';
  const ID = 'cursedship';        // id ใน FX_SHOP / ค่าใน localStorage['studentos.alt.doneFx']
  // ประวัติจังหวะ: 2.95 วิ 6 ช็อต ("ไม่เข้าใจ") → 3.2 วิ 3 ช็อต → 8.6 วิ เล่าเรื่องมีลำแสงเขียว
  // 26 ต.ค. 69 · เจ้าของ: "เกลียดแสงเลเซอร์ · ฉากเปลี่ยนไปมาเหมือน AI · ไม่ต้องสลับตำแหน่งเยอะ
  // แค่ดูมีคุณภาพ เข้าใจ จบ" → ภาพเรือภาพเดียวตลอดฉาก ไม่มีลำแสง ไม่ตัดช็อต ใบงานอยู่ที่เดิม
  // ขยับครั้งเดียวตอนท้าย (ลอยเข้าหาโคมเรือแล้วจาง) · ไทม์ไลน์เต็มอยู่หัวส่วนฉากใน cursed-ship.css
  const TOTAL = 6000;             // ฉากทั้งชุด (ms)
  const REVEAL_AT = 5600;         // จอข้างหลังเริ่มโผล่ — ซ้อนกับตอนหมอกคลุมเรือ
  const STAMP_AT = 2400;          // ตราประทับตก (ต้องตรงกับ animation-delay ของ .cs-seal ใน cursed-ship.css)
  const CAPS = ['งานนี้เสร็จแล้ว…', 'ประทับตรา · ส่งงานแล้ว', 'เรือผีรับงานไปแล้ว'];

  // cx = จุดบนภาพ (แนวนอน) ที่อยากให้อยู่กลางจอ — ต้องตรงกับ --cx ใน cursed-ship.css
  const ART = { ship: { cx: .5 }, yard: { cx: .62 } };
  const FILES = ['ship', 'yard'].flatMap(k => [k + '.webp', k + '-bg.webp']).concat('banner.webp', 'seal.webp');

  // ---------- คลิปวิดีโอ (เจ้าของสร้างเองตามบรีฟ · 25 ต.ค. 69) ----------
  // เจ้าของ: "ภาพเบลอ ดูไม่รู้เรื่อง ทำเป็นเฟรมให้สมจริง ไม่ใช่เอาภาพเดียว" — เครื่องที่ทำงานนี้สร้างภาพ/วิดีโอเองไม่ได้
  // เจ้าของจึงสร้างคลิปแนวตั้งด้วย AI วิดีโอ แล้วแอปเล่นคลิปนั้น วางใบงานจริง (HTML) ลอยตามเส้นทางข้างล่าง
  // ใส่ไฟล์ที่ cursed-ship/<file> แล้วตั้งค่าตรงนี้ · null = ใช้ฉากภาพนิ่ง 3 ช็อตเดิม
  //   path: t = วินาทีในคลิป · x, y = สัดส่วนบนเฟรมคลิป (0–1) · w = ความกว้างใบเทียบเฟรม · r = องศา · o = ความทึบ
  //         จุดที่ไม่มี x, y = ตำแหน่งเดิมของใบ (ใบพระเอก/การ์ดที่เพิ่งติ๊ก)
  //   seal = วินาทีที่ตราประทับตก · out = วินาทีที่ฉากจบ (ตัดท้ายคลิปได้)
  // คลิปเล่นไม่ได้ (เช่น iPhone โหมดประหยัดพลังงานไม่ยอมเล่นวิดีโอเอง) = ถอยไปฉากภาพนิ่งเดิม
  const CLIP = null;

  const root = document.documentElement;
  const DONEFX = 'studentos.alt.doneFx';   // คีย์เดียวกับ DONEFX_KEY ใน hoop.js (อ่านอย่างเดียว)
  const selected = () => { try { return localStorage.getItem(DONEFX) === ID; } catch (_) { return false; } };
  // Only reward cinematics opt in; OS, theme motion and graphics settings stay unchanged.
  const MOTION_KEY = 'studentos.alt.cinematicMotion';
  const motionValues = ['system','full','still'];
  let motionChoice = 'system';
  try { const saved=localStorage.getItem(MOTION_KEY);if(motionValues.includes(saved))motionChoice=saved; } catch (_) {}
  root.dataset.csMotion=motionChoice;
  const motionPreference = () => motionChoice;
  function setMotionPreference(value) {
    if(!motionValues.includes(value))return false;
    motionChoice=value;root.dataset.csMotion=value;
    try { localStorage.setItem(MOTION_KEY,value); } catch (_) {}
    if(!motionAllowed()&&active())stop();
    if(typeof renderFxPick==='function')renderFxPick();
    return true;
  }

  // เล่นฉากได้ไหม — แยกเป็นฟังก์ชันล้วนให้เทสต์ได้โดยไม่ต้องมี DOM
  function motionOk(o) { return !o.reduced && !o.still && o.quality !== 'low'; }
  function env(preview=false) {
    const full=motionChoice==='full'||(preview&&root.dataset.csPreviewMotion==='full');
    return {
      reduced: !full&&!!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
      still: !full&&(motionChoice==='still'||root.dataset.hwMotion === 'still'),
      quality: full?'':root.dataset.quality || '',
    };
  }
  const motionAllowed=()=>motionOk(env());
  function motionControlsHTML(id) {
    if(id!==ID&&!Object.hasOwn(variants,id))return '';
    const options=[['system','ตามการตั้งค่าเครื่อง'],['full','เปิดฉากรางวัล'],['still','ภาพนิ่ง']];
    const hint=motionChoice==='full'?'เปิดเฉพาะฉากรางวัล ไม่เปลี่ยนธีมหรือค่าทั้งเครื่อง':motionAllowed()?'ฉากพร้อมเคลื่อนไหว · กดข้ามได้ตลอด':'ฉากเป็นภาพนิ่งอยู่ เลือก “เปิดฉากรางวัล” เพื่อชมได้';
    return '<div class="cs-motion-control"><label>การเคลื่อนไหวฉากรางวัล<select aria-label="การเคลื่อนไหวฉากรางวัล" onchange="CursedShip.setMotionPreference(this.value)">'+options.map(([value,label])=>'<option value="'+value+'"'+(value===motionChoice?' selected':'')+'>'+label+'</option>').join('')+'</select></label><p role="status">'+hint+'</p></div>';
  }
  function offerMotion(replay) {
    if(typeof window.showToast==='function')window.showToast({title:'ฉากรางวัลเป็นภาพนิ่งอยู่',body:'เปิดเฉพาะฉากรางวัลได้ ไม่ต้องเปลี่ยนธีมหรือค่าทั้งเครื่อง',action:{label:'เปิดฉากรางวัล',fn:()=>{setMotionPreference('full');replay();}}});
  }

  // ---------- ภาพ: โหลดล่วงหน้าตอนว่าง (~150KB ทั้งชุด) เฉพาะคนที่เลือกเอฟเฟกต์นี้ ----------
  const script = document.currentScript;
  const BASE = (() => { try { return new URL('cursed-ship/', script && script.src).href; } catch (_) { return 'halloween/season/cursed-ship/'; } })();
  let loaded = 0, failed = false, started = false;
  // คลิปโหลดทั้งไฟล์เป็น blob ก่อนเล่น — iOS ขอวิดีโอเป็นช่วง ๆ (Range) ซึ่ง service worker ของแอปเก็บแคชให้ไม่ได้
  // และฉากที่ค้างรอโหลดกลางทางแย่กว่าไม่เล่นเลย
  let clipUrl = null, clipStarted = false;
  function preloadClip() {
    if (!CLIP || clipStarted || typeof fetch !== 'function' || typeof URL.createObjectURL !== 'function') return;
    clipStarted = true;
    fetch(BASE + CLIP.file).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(b => { clipUrl = URL.createObjectURL(b); }).catch(() => {});
  }
  function preload() {
    preloadClip();
    if (started || typeof Image !== 'function') return;
    started = true;
    FILES.forEach(f => {
      const im = new Image();
      im.onload = () => { loaded++; };
      im.onerror = () => { failed = true; };
      im.src = BASE + f;
    });
  }
  const ready = () => !failed && loaded >= FILES.length;
  const usable = () => !!clipUrl || ready();
  if (selected()) {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(preload, { timeout: 5000 });
    else setTimeout(preload, 2500);
  }
  // hoop.js ถามก่อนเปิดเอฟเฟกต์ทุกครั้ง — ภาพไม่ครบ/ขอลดการเคลื่อนไหว = ตอบ false แอปฉลองแบบปกติแทน
  const canPlay = () => { preload(); return motionOk(env()) && usable(); };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ตัวเลขบนใบ = สองช่องเดียวกับสตอรีบอร์ด (งานเสร็จวันนี้ · เสร็จทั้งหมด) จากงานจริง
  // สูตรเดียวกับ finishFocus ใน app.js — ห้ามแต่งตัวเลขให้ฉากดูดี
  function stats() {
    try {
      const dk = new Date().toDateString();
      const today = liveTasks().filter(x => x.done && x.doneAt && new Date(x.doneAt).toDateString() === dk).length;
      return [[today, 'งานเสร็จวันนี้'], [doneCount(), 'เสร็จทั้งหมด']];
    } catch (_) { return []; }
  }

  // ---------- จอ "เสร็จแล้ว" ของโหมดโฟกัส (ใช้เมื่อเลือกเอฟเฟกต์นี้) ----------
  const skinOn = () => selected();
  // ฉากหลัง = ช็อตป่าช้าตัวเดียวกับท้ายฉาก (ช่อง 11) + แสงโคม/เทียนมุมล่าง (ช่อง 7, 9)
  function scene() {
    return `<div class="cs-scene" aria-hidden="true"><i class="cs-bgl k-yard"></i><i class="cs-art k-yard"></i>
      <i class="cs-mist"></i><i class="cs-lamp l"></i><i class="cs-lamp r"></i></div>`;
  }

  const biomeScenes=Object.freeze({
    jack:{sealLabel:'JACK’S HOLLOW',scene:'biome-cinematics/jack-night.webp',target:{x:.5,y:.62},captions:['งานนี้เสร็จแล้ว…','ประทับตราแห่ง Jack’s Hollow','ฟักทองรับงานไว้แล้ว']},
    vampire:{sealLabel:'VAMPIRE MANSION',scene:'biome-cinematics/vampire-night.webp',target:{x:.5,y:.69},captions:['งานนี้เสร็จแล้ว…','ประทับตราแห่งคฤหาสน์','บันทึกงานลงสมุดรัตติกาลแล้ว']},
    graveyard:{sealLabel:'ETERNAL GRAVEYARD',scene:'biome-cinematics/graveyard-night.webp',target:{x:.54,y:.66},captions:['งานนี้เสร็จแล้ว…','ประทับตราแห่งสุสาน','ฝากงานไว้หลังประตูวิญญาณแล้ว']}
  });
  const variants = Object.freeze({
    'fx-soulwake':{biome:'dutchman',color:'#9ACFC4',metal:'#B7C8BA'},
    'fx-dutchman-arrival':{biome:'dutchman',color:'#8CDEC9',metal:'#E2C789'},
    'fx-pumpkin-sparks':{...biomeScenes.jack,biome:'jack',color:'#D6A268',metal:'#CAA273'},
    'fx-jacks-verdict':{...biomeScenes.jack,biome:'jack',color:'#EDBC79',metal:'#E5CC91'},
    'fx-velvet-flight':{...biomeScenes.vampire,biome:'vampire',color:'#B97996',metal:'#C2ADB9'},
    'fx-crimson-eclipse':{...biomeScenes.vampire,biome:'vampire',color:'#D78FA7',metal:'#E1C78F'},
    'fx-soul-bloom':{...biomeScenes.graveyard,biome:'graveyard',color:'#B9A5D2',metal:'#C0B7D0'},
    'fx-reaper-gate':{...biomeScenes.graveyard,biome:'graveyard',color:'#CBB4EB',metal:'#E5D09C'}
  });
  const sceneLoads=new Map();
  function sceneUrl(v){return new URL(v.scene,BASE+'../').href;}
  function preloadVariant(item){const extra=window.HalloweenCinematicFinishes?.preload?.(item?.id)||Promise.resolve(true),v=variants[item?.id];if(!v?.scene)return extra;const combine=p=>Promise.all([p,extra]).then(values=>values.every(Boolean));if(sceneLoads.has(v.scene))return combine(sceneLoads.get(v.scene).promise);if(typeof Image!=='function')return Promise.resolve(false);const state={ready:false,promise:null};state.promise=new Promise(resolve=>{const image=new Image();image.onload=()=>{state.ready=true;resolve(true);};image.onerror=()=>resolve(false);image.src=sceneUrl(v);});sceneLoads.set(v.scene,state);return combine(state.promise);}
  function variantReady(item){const v=variants[item?.id];return (!v?.scene||sceneLoads.get(v.scene)?.ready===true)&&window.HalloweenCinematicFinishes?.ready?.(item?.id)!==false;}
  function decorateVariant(ov,item) {
    const v=variants[item?.id];if(!v)return;
    if(v.scene){ov.style.setProperty('--cs-scene','url("'+sceneUrl(v)+'")');ov.style.setProperty('--cs-point-x',v.target.x*100+'%');ov.style.setProperty('--cs-point-y',v.target.y*100+'%');}
    if(v.scene){const seal=ov.querySelector('.cs-seal');if(seal)seal.innerHTML='<span class="cs-biome-wax"><img src="'+new URL('../rewards/'+(item.asset||'assets/'+item.id+'.svg'),BASE+'../').href+'" alt=""><b>'+esc(v.sealLabel)+'</b></span>';}
    ov.dataset.rewardBiome=v.biome;ov.dataset.rewardTier=item.rarity;ov.style.setProperty('--cs-accent',v.color);ov.style.setProperty('--cs-metal',v.metal);
    const wash=document.createElement('i');wash.className='cs-variant-wash';wash.setAttribute('aria-hidden','true');ov.prepend(wash);
    const mark=document.createElement('div');mark.className='cs-variant-mark';mark.innerHTML='<img src="'+new URL('../rewards/'+(item.asset||'assets/'+item.id+'.svg'),BASE+'../').href+'" alt=""><span><small>'+esc(item.rarity.toUpperCase())+' · HALLOWEEN</small>'+esc(item.name)+'</span>';ov.append(mark);
  }
  function stillVariant(item,title,onClose) {
    const host=document.querySelector('.phone');if(!host){if(typeof onClose==='function')onClose();return false;}stop(true);
    const ov=document.createElement('div');ov.className='cs-ov cs-still';ov.setAttribute('role','dialog');ov.setAttribute('aria-label','งานเสร็จแล้ว · ข้ามได้');
    const src=new URL('../rewards/'+(item.asset||'assets/'+item.id+'.svg'),BASE+'../').href;
    ov.innerHTML='<div class="cs-still-card"><img src="'+src+'" alt=""><strong>เสร็จแล้ว</strong><p>'+esc(title||'ผ่านไปอีกหนึ่งงาน')+'</p><small>'+esc(item.name)+'</small></div><button type="button" class="cs-skip">ข้าม</button>';
    host.appendChild(ov);run={ov,sheet:null,timers:[],onClose,done:false,anims:[],previousFocus:document.activeElement};ov.addEventListener('pointerdown',skip);ov.querySelector('.cs-skip').addEventListener('click',skip);ov.querySelector('.cs-skip').focus({preventScroll:true});at(1000,finish);return true;
  }
  function playVariant(item,onClose,title,preview=false) {
    const canonical=window.StudentOSHalloweenRewards?.find(item?.id);
    if(!canonical||!variants[canonical.id]||!document.querySelector('.phone')){if(typeof onClose==='function')onClose();return false;}preload();const loading=preloadVariant(canonical);
    if(!motionOk(env(preview))){if(preview){offerMotion(()=>playVariant(canonical,null,title,true));if(typeof onClose==='function')onClose();return false;}return stillVariant(canonical,title,onClose);}
    if(!variantReady(canonical)){
      if(!preview)return stillVariant(canonical,title,onClose);
      let settled=false;const finishLoad=ok=>{if(settled)return;settled=true;clearTimeout(timeout);if(ok)playFx(title,onClose,preview,canonical);else stillVariant(canonical,title,onClose);};
      const timeout=setTimeout(()=>finishLoad(false),3000);loading.then(finishLoad);return true;
    }
    if(!usable()&&!preview)return stillVariant(canonical,title,onClose);
    playFx(title,onClose,preview,canonical);return true;
  }

  // ---------- ฉาก ----------
  let run = null;   // { ov, sheet, timers, anims, onClose, done }

  function cardHtml(title, st) {
    return `<div class="cs-card">
      <div class="cs-card-h"><span class="cs-card-tick"></span><b>เสร็จแล้ว</b></div>
      <p class="cs-card-p">${esc(title)}</p>
      <div class="cs-card-s">${st.map(([v, k]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>
      <i class="cs-seal"></i>
    </div>`;
  }
  const shot = k => `<div class="cs-shot k-${k}"><i class="cs-bgl k-${k}"></i><i class="cs-art k-${k}"></i></div>`;
  function at(ms, fn) { run.timers.push(setTimeout(fn, ms)); }

  // จุดบนภาพของช็อต k (fx, fy = สัดส่วนบนไฟล์ภาพ) → พิกัดในกรอบฉาก
  // ภาพวางด้วย left:50% top:50% แล้วเลื่อนกลับ cx·กว้าง / ครึ่งสูง (ดู .cs-art ใน CSS)
  function artPoint(ov, k, fx, fy) {
    const el = ov.querySelector('.cs-art.k-' + k);
    const W = ov.clientWidth, H = ov.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
    return { x: W / 2 - ART[k].cx * w + fx * w, y: H / 2 - h / 2 + fy * h, w };
  }

  // ใบงานเริ่มที่ "ตำแหน่งเดิม": ใบพระเอกของจอเสร็จแล้ว (โหมดโฟกัส) · การ์ดที่เพิ่งติ๊ก (หน้าแรก/รายการ) · กลางจอ
  function origin(host) {
    const hero = document.querySelector('#focusWrap:not([hidden]) .fw-hero');
    const card = !hero && document.querySelector('.just-done');
    const el = hero || card;
    const hr = host.getBoundingClientRect();
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.bottom < hr.top || r.top > hr.bottom) return null;
    return { x: r.left - hr.left + r.width / 2, y: r.top - hr.top + Math.min(r.height, 260) / 2, w: r.width };
  }

  // เปิดจาก openDoneFx (hoop.js) — title = ชื่องาน · onClose = ทุกอย่างที่แอปรอทำหลังฉลอง (วาดใหม่ · บอกงานถัดไป)
  function playFx(title, onClose, preview, variant) {
    const host = document.querySelector('.phone');
    preload();
    // ปุ่ม "ลองเล่นดู" กดทันทีหลังเลือก — ภาพอาจยังโหลดไม่เสร็จ รอได้ไม่เกิน 3 วิ (งานจริงไม่รอ: doneFxActive กันไว้แล้ว)
    if (preview && host && motionOk(env(preview)) && !usable() && !failed && !(preview > 25)) {
      setTimeout(() => playFx(title, onClose, (typeof preview === 'number' ? preview : 0) + 1, variant), 120);
      return;
    }
    if (!host || !motionOk(env(preview)) || !usable()) {
      if(preview&&!motionOk(env(preview)))offerMotion(()=>playFx(title,null,true,variant));
      else if(preview&&typeof window.showToast==='function')window.showToast({title:'กำลังโหลดภาพฉาก',body:'ลองกดอีกครั้งในอีกสักครู่'});
      if (typeof onClose === 'function') onClose();
      return;
    }
    stop(true);
    const sheet = document.querySelector('#focusWrap:not([hidden]) .fc-sheet.done.cs-done');
    if (clipUrl&&!variants[variant?.id]?.scene) return playClip(title, onClose, host, sheet, variant);
    playStills(title, onClose, host, sheet, variant);
  }

  // ทั้งสองแบบใช้: แตะที่ไหนก็ข้าม (pointerdown ไม่ใช่ click จะได้ไม่ต้องรอปล่อยนิ้ว) · Enter/Space บนปุ่มข้าม
  function mount(host, sheet, ov, onClose, variant) {
    decorateVariant(ov,variant);
    if (sheet) sheet.classList.add('cs-playing');
    host.appendChild(ov);
    run = { ov, sheet, timers: [], onClose, done: false, anims: [], raf: 0, video: null, previousFocus:document.activeElement };
    ov.addEventListener('pointerdown', e => { e.preventDefault(); skip(); });
    ov.querySelector('.cs-skip').addEventListener('click', skip);
    ov.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); } });
    try { ov.querySelector('.cs-skip').focus({ preventScroll: true }); } catch (_) {}
  }
  // วางใบงานไว้ที่ตำแหน่งเดิมก่อนเริ่มขยับ — คืนจุดกลาง (x0, y0) กับความกว้าง cw
  function placeCard(ov, host) {
    const card = ov.querySelector('.cs-card');
    const W = ov.clientWidth, H = ov.clientHeight;
    const o0 = origin(host);
    const cw = Math.min(o0 ? o0.w - 24 : W - 48, 360);
    card.style.width = cw + 'px';
    const ch = card.offsetHeight || 150;
    const x0 = o0 ? o0.x : W / 2, y0 = o0 ? o0.y : H * .3;
    card.style.left = (x0 - cw / 2) + 'px';
    card.style.top = (y0 - ch / 2) + 'px';
    return { card, W, H, cw, ch, x0, y0 };
  }
  const reveal = sheet => { if (sheet) { sheet.classList.add('cs-reveal'); sheet.classList.remove('cs-playing'); } };

  // จุดบนเฟรมคลิป → พิกัดในกรอบ (คลิปแสดงแบบ object-fit: cover — ขอบซ้ายขวาหรือบนล่างถูกตัด)
  function clipBox(ov, video) {
    const W = ov.clientWidth, H = ov.clientHeight;
    const vw = video.videoWidth || 1080, vh = video.videoHeight || 1920;
    const k = Math.max(W / vw, H / vh), w = vw * k, h = vh * k;
    return { left: (W - w) / 2, top: (H - h) / 2, w, h };
  }

  function playClip(title, onClose, host, sheet, variant) {
    const ov = document.createElement('div');
    ov.className = 'cs-ov cs-clip';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'งานเสร็จแล้ว · เรือผีมารับงาน แตะเพื่อข้าม');
    ov.innerHTML = `<video class="cs-video" muted playsinline webkit-playsinline preload="auto" aria-hidden="true"></video>
      <i class="cs-vig"></i>${cardHtml(title, stats())}
      <button type="button" class="cs-skip">ข้าม</button>`;
    const video = ov.querySelector('video');
    video.muted = true; video.defaultMuted = true;   // iOS เล่นเองได้เฉพาะวิดีโอที่ปิดเสียง
    video.src = clipUrl;
    mount(host, sheet, ov, onClose, variant);
    run.video = video;
    const me = run;
    const { card, cw, x0, y0 } = placeCard(ov, host);
    const end = CLIP.out;
    let anim = null, stamped = false, outed = false;

    const build = () => {
      if (anim || !card.animate) return;
      const b = clipBox(ov, video);
      anim = card.animate(CLIP.path.map(p => {
        const x = p.x == null ? x0 : b.left + p.x * b.w, y = p.y == null ? y0 : b.top + p.y * b.h;
        const sc = p.w == null ? 1 : (p.w * b.w) / cw;
        return { offset: Math.min(1, p.t / end), opacity: p.o == null ? 1 : p.o, easing: 'ease-in-out',
          transform: `translate(${x - x0}px,${y - y0}px) rotate(${p.r || 0}deg) scale(${sc})` };
      }), { duration: end * 1000, easing: 'linear', fill: 'both' });
      anim.pause();
      me.anims.push(anim);
    };
    // ใบงานเดินตามเวลาของคลิปทุกเฟรม ไม่ใช่นาฬิกาแยก — คลิปสะดุด ใบก็หยุดรอ ไม่หลุดจากเรือ
    const tick = () => {
      if (run !== me || me.done) return;
      const t = video.currentTime || 0;
      if (anim) anim.currentTime = Math.min(t, end) * 1000;
      if (!stamped && t >= CLIP.seal) {
        stamped = true; card.classList.add('stamp'); ov.classList.add('shake');
        if (typeof window.haptic === 'function') window.haptic('tap');
      }
      if (!outed && t >= end - .25) { outed = true; reveal(sheet); ov.classList.add('out'); }
      if (t >= end || video.ended) { finish(); return; }
      me.raf = requestAnimationFrame(tick);
    };
    const go = () => { build(); tick(); };
    let p;
    try { p = video.play(); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(go, () => {
      // เครื่องไม่ยอมเล่นวิดีโอ — ปิดฉากคลิปเงียบ ๆ แล้วเล่นฉากภาพนิ่งแทน (ถ้าภาพพร้อม) ไม่งั้นจบเลย
      if (run !== me || me.done) return;
      me.onClose = null; finish();
      if (ready()) playStills(title, onClose, host, sheet, variant);
      else if (typeof onClose === 'function') onClose();
    });
    // กันคลิปค้าง (เน็ต/ถอดรหัสสะดุด) — ไม่ว่าอะไรเกิดขึ้น ฉากจบภายใน out + 2 วิ
    at((end + 2) * 1000, finish);
  }

  function playStills(title, onClose, host, sheet, variant) {
    const v=variants[variant?.id],captions=v?.captions||CAPS;
    const lite = root.dataset.lite === '1';

    const ov = document.createElement('div');
    ov.className = 'cs-ov' + (lite ? ' lite' : '');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label',v?.scene?'งานเสร็จแล้ว · ฉากฉลอง Halloween แตะเพื่อข้าม':'งานเสร็จแล้ว · เรือผีมารับงาน แตะเพื่อข้าม');
    ov.innerHTML = `<i class="cs-dark"></i>
      ${v?.scene?'<div class="cs-biome-shot"><i class="cs-biome-backdrop"></i></div>':shot('ship')}
      <i class="cs-blood"></i>
      <i class="cs-fog l"></i><i class="cs-fog r"></i><i class="cs-fog front"></i>
      <i class="cs-halo"></i><i class="cs-glint"></i>
      ${cardHtml(title, stats())}
      <i class="cs-vig"></i>
      <div class="cs-cap" aria-live="polite">${captions.map((c, i) => `<span class="c${i + 1}">${esc(c)}</span>`).join('')}</div>
      <button type="button" class="cs-skip">ข้าม</button>`;
    mount(host, sheet, ov, onClose, variant);

    // ตำแหน่งอ่านจากภาพจริง: โคมเขียวบนดาดฟ้าเรือ (ช่อง 3) คือที่ที่ใบงานถูกดูดเข้าไป
    const { card, W, H, cw, ch, x0, y0 } = placeCard(ov, host);
    const halo = ov.querySelector('.cs-halo');
    halo.style.left = x0 + 'px'; halo.style.top = (y0 + ch / 2 + 6) + 'px'; halo.style.width = cw * 1.1 + 'px';

    // ตำแหน่งอ่านจากภาพจริง: โคมเขียวบนดาดฟ้าเรือ (ช่อง 3) คือที่ที่ใบงานลอยเข้าไปตอนจบ
    const lamp = v?.scene ? {x:W*v.target.x,y:H*v.target.y} : artPoint(ov, 'ship', .655, .7);
    const glint = ov.querySelector('.cs-glint');
    glint.style.left = lamp.x + 'px'; glint.style.top = lamp.y + 'px';
    const to = (p, sc, r) => `translate(${p.x - x0}px,${p.y - y0}px) rotate(${r}deg) scale(${sc})`;
    const o = { x: x0, y: y0 };
    const customFinish=card.animate&&variant&&window.HalloweenCinematicFinishes?.play(variant.id,{ov,card,W,H,cw,ch,x0,y0,target:lamp,schedule:at,animate(node,frames,timing){if(typeof node.animate==='function')run.anims.push(node.animate(frames,timing));}});
    if (card.animate&&!customFinish) {
      // easing ต้องอยู่รายช่วง — ใส่ที่ตัว animation จะบิดเวลาทั้งเส้น ฉากคลาดจาก CSS
      const K = (t, transform, opacity = 1, easing = 'ease-in-out') => ({ offset: t / TOTAL, transform, opacity, easing });
      run.anims.push(card.animate([
        K(0, to(o, 1, 0)),
        K(600, to({ x: x0, y: y0 - 8 }, 1.02, -1)),                 // งานนี้เสร็จแล้ว… ใบเรือง ยกตัวนิดเดียว
        K(2380, to({ x: x0, y: y0 - 8 }, 1.02, -1), 1, 'ease-out'),
        K(2500, to({ x: x0, y: y0 - 3 }, .99, -1.5)),               // ตราตก (2.4 วิ) ใบยุบลงตามแรงกระแทก
        K(3600, to({ x: x0, y: y0 - 6 }, 1, -1.5), 1, 'cubic-bezier(.5, 0, .3, 1)'),  // ค้างให้อ่านตรา
        K(4900, to(lamp, .12, -4), 0),                              // ลอยเข้าหาโคมเรือครั้งเดียว แล้วจาง
        K(TOTAL, to(lamp, .12, -4), 0),
      ], { duration: TOTAL, easing: 'linear', fill: 'both' }));
    }

    at(STAMP_AT, () => { if (typeof window.haptic === 'function') window.haptic('tap'); });
    at(REVEAL_AT, () => { reveal(sheet); ov.classList.add('out'); });
    at(TOTAL, () => finish());
  }

  function finish() {
    if (!run || run.done) return;
    const r = run;
    r.done = true;
    r.timers.forEach(clearTimeout);
    if (r.raf) cancelAnimationFrame(r.raf);
    if (r.video) try { r.video.pause(); } catch (_) {}
    r.anims.forEach(a => { try { a.cancel(); } catch (_) {} });
    if (r.sheet) { r.sheet.classList.remove('cs-playing'); r.sheet.classList.add('cs-reveal'); }
    const hadFocus = r.ov.contains(document.activeElement);
    r.ov.remove();
    run = null;
    if (hadFocus && r.sheet) { const go = r.sheet.querySelector('.fc-go'); if (go) try { go.focus({ preventScroll: true }); } catch (_) {} }
    if(hadFocus&&!r.sheet&&r.previousFocus?.isConnected)try{r.previousFocus.focus({preventScroll:true});}catch{}
    if (typeof r.onClose === 'function') r.onClose();
  }
  // ข้าม = จอข้างหลังขึ้นทันที ไม่มีจังหวะจางรอ — คนที่กดข้ามคือคนที่รีบ
  function skip() { if (run && !run.done) { if (run.sheet) run.sheet.classList.add('cs-skipped'); finish(); } }
  // หยุดเงียบ ๆ (ไม่เรียก onClose) — ใช้ตอนเริ่มฉากใหม่ทับ
  function stop(silent) {
    if (!run) return;
    if (silent) run.onClose = null;
    finish();
  }
  const active = () => !!(run && !run.done && run.ov.isConnected);

  // Esc ต้องข้ามฉากก่อน ไม่ใช่ปิดทั้งโหมดโฟกัส (ตัวจัดการ Esc ของแอปฟังที่ document)
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && active()) { e.preventDefault(); e.stopImmediatePropagation(); skip(); }
  }, true);

  document.addEventListener?.('visibilitychange',()=>{if(document.hidden&&active())skip();});
  window.addEventListener('pagehide',()=>{if(active())skip();});

  // ลงทะเบียนเป็นเอฟเฟกต์ตอนงานเสร็จ — ฟรีแบบเดียวกับเอฟเฟกต์ Halloween ชุดอื่น (integration.js)
  // ต่อท้ายตาราง = อยู่ท้ายแถวในหน้าธีม
  const ICON = `<img class="hw-effect-icon" src="${BASE}seal.webp" alt="">`;
  if (typeof FX_SHOP !== 'undefined' && !FX_SHOP[ID]) {
    FX_SHOP[ID] = { cost: 0, name: 'The Cursed Ship', desc: 'เรือผีมารับงาน ตราประทับคำสาป แล้วแล่นหายในหมอก', emoji: '⚓', halloween: true, free: true, icon: ICON };
  }

  window.CursedShip = Object.freeze({
    ID, TOTAL, FILES, CLIP, motionOk, motionAllowed, motionPreference, setMotionPreference, motionControlsHTML, ready, preload, canPlay, stats,
    skinOn, scene, playFx, playVariant, variants, preloadVariant, skip, stop, active,
  });
  if (typeof renderFxPick === 'function') try { renderFxPick(); } catch (_) {}
  try{const saved=localStorage.getItem(DONEFX);if(variants[saved]){preload();preloadVariant({id:saved});}}catch{}
})();
