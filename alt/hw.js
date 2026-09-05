// ============================================================
// ห้องการบ้าน — งานหนึ่งชิ้นคือห้องหนึ่งห้อง แล้วห้องปิดตัวเองตอนถึงกำหนดส่ง
// ------------------------------------------------------------
// แนวคิดทั้งหมดอยู่ในหัวไฟล์ของ migration 20260902090000_homework_rooms.sql
// สรุปสั้น: ชั้นสังคมเดิม (โปรไฟล์ · เพิ่มเพื่อน · ฟีด) มีรูปทรงเหมือนทุกแอปที่นักเรียนมีอยู่แล้ว
// ของที่แอปนี้มีอยู่คนเดียวคือกำหนดส่ง — เราจึงเอากำหนดส่งมาทำเป็นห้อง
//
// สามอย่างที่ไฟล์นี้ทำ:
//   1) แถวเล็ก ๆ ใต้การ์ดงาน บอกว่ามีเพื่อนกี่คนยังไม่เสร็จ และกี่คนกำลังทำอยู่ตอนนี้
//   2) จอห้อง — คุยกันเฉพาะเรื่องงานชิ้นนั้น พิมพ์ไม่ได้อีกเมื่อเลยกำหนด
//   3) ช่องบอกสถานะสด ๆ ช่องเดียวต่อห้องเรียน ไม่ใช่ช่องละงาน (เหตุผลอยู่ที่ watchHw)
// ============================================================

// ---------- สวิตช์: ต้องกดเองครั้งแรก ----------
// สิ่งที่ออกจากเครื่องคือ "ฉันมีงานวิชานี้ ส่งวันนี้ ยังไม่เสร็จ" เท่านั้น
// เล็กก็จริง แต่มันเป็นข้อมูลที่คนอื่นเห็น จึงไม่ควรเริ่มทำงานเองโดยไม่มีใครกด
// (ไม่ได้เอาไปซ่อนในหน้าตั้งค่า — ถามตรงจุดที่มันจะเริ่มมีประโยชน์ ที่ใต้การ์ดงานใบแรก)
function hwOn() {
  const s = (state && state.settings && state.settings.social) || {};
  return s.hw === true;
}
function hwAsked() {
  const s = (state && state.settings && state.settings.social) || {};
  return s.hw != null;
}
async function hwSet(on) {
  if (!state.settings.social) state.settings.social = {};
  state.settings.social.hw = !!on;
  save();
  if (!on) {
    hwRows = {};
    unwatchHw();
    if (sb && currentUser) { try { await sb.rpc('hw_leave_all'); } catch (_) {} }
  }
  renderAll();
  if (on) hwSync(true);
}

// ---------- กุญแจฝั่งแอป ----------
// ฝั่งเซิร์ฟเวอร์คิดกุญแจจริงจาก md5(ห้องเรียน|วิชา|วันที่) และส่งกลับมาพร้อมวิชา+วันที่
// ฝั่งนี้จึงไม่ต้องรู้ห้องเรียนหรือสูตร แค่จับคู่กลับด้วย "วิชา|วันที่" ที่อ่านออกด้วยตา
function ymd(v) {
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return null;
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
}
function hwTag(t) {
  const s = (t.subject || '').trim();
  if (!s || s === 'อื่น ๆ' || !t.due) return null;
  const d = ymd(t.due);
  return d ? s.toLowerCase() + '|' + d : null;
}

let hwRows = {};        // 'วิชา|วันที่' -> { key, others, talking }
let hwBusy = false;
let hwTimer = null;
let hwLast = 0;         // ยิงจริงครั้งล่าสุดเมื่อไหร่
// hw_sync คืนอะไรมาเลยถ้าบัญชีนี้ยังไม่ได้ผูกห้องเรียน (บรรทัดแรกของฟังก์ชัน return ทิ้ง)
// ก่อนหน้านี้แปลว่าแถวใต้การ์ดเงียบสนิท — ผู้ใช้จึงเปิดสวิตช์ไปแล้วไม่เห็นอะไรเกิดขึ้นเลย
// และไม่มีทางรู้เลยว่าตัวเองติดอยู่ตรงไหน — ฟีเจอร์ที่เงียบสนิทคือฟีเจอร์ที่ไม่มีอยู่
let hwNoRoom = false;
const HW_MIN_GAP = 20000;

// ---------- ลงชื่อ + รับตัวเลข รอบเดียวจบ ----------
// เรียกได้บ่อยโดยไม่เปลืองเน็ต เพราะรวบงานทุกใบเป็นคำสั่งเดียว และหน่วงไว้ 600ms
// ก่อนยิงจริง — ติ๊กงานรัว ๆ ห้าใบจะกลายเป็นคำสั่งเดียว ไม่ใช่ห้าคำสั่ง
// renderAll() ถูกเรียกทุกครั้งที่ข้อมูลเปลี่ยน ซึ่งบางจังหวะคือสิบครั้งในวินาทีเดียว
// จึงกันสองชั้น: หน่วง 600ms ให้พายุรวมเป็นครั้งเดียว แล้วเว้นอย่างน้อย 20 วินาทีต่อรอบ
// (ตัวเลขบนการ์ดเป็นของที่ช้าไป 20 วินาทีได้ ไม่มีใครสังเกต — แต่ยิงทุกเรนเดอร์คือเน็ตของเด็ก)
function hwSync(now) {
  clearTimeout(hwTimer);
  if (!sb || !currentUser || !hwOn()) return;
  hwTimer = setTimeout(() => doHwSync(now), now ? 0 : 600);
}
async function doHwSync(force) {
  if (hwBusy || !sb || !currentUser || !hwOn()) return;
  if (!force && Date.now() - hwLast < HW_MIN_GAP) return;
  hwLast = Date.now();
  const today = ymd(new Date());
  const payload = [];
  const seen = new Set();
  for (const t of (typeof liveTasks === 'function' ? liveTasks() : (state.tasks || []))) {
    const tag = hwTag(t);
    if (!tag || seen.has(tag)) continue;      // งานสองใบวิชาเดียววันเดียว = ห้องเดียวกัน
    const d = ymd(t.due);
    if (d < today) continue;                  // เลยกำหนดแล้ว ไม่ต้องสร้างห้องที่ตายแล้ว
    seen.add(tag);
    payload.push({ subject: (t.subject || '').trim(), due: d, title: t.detail || '', done: !!t.done });
  }
  if (!payload.length) { hwRows = {}; return; }

  hwBusy = true;
  const { data, error } = await sb.rpc('hw_sync', { p_tasks: payload });
  hwBusy = false;
  if (error) return;                          // เงียบ ๆ — แถวนี้เป็นของแถม ไม่ใช่ของหลัก
  const next = {};
  // ชื่อคอลัมน์ฝั่ง SQL ขึ้นต้นด้วย r_ ทุกตัว — เหตุผลอยู่ในหัวของ hw_sync ใน migration
  for (const r of (data || [])) {
    next[String(r.r_subject || '').toLowerCase() + '|' + r.r_due] =
      { key: r.r_key, others: r.r_others || 0, talking: r.r_talking || 0 };
  }
  hwRows = next;
  // ส่งงานขึ้นไปแล้วไม่มีแถวกลับมาเลยสักแถว = ยังไม่ได้ผูกห้องเรียน
  // (ถ้าผูกแล้ว อย่างน้อยต้องมีแถวของตัวเองกลับมา เพราะฟังก์ชันลงชื่อเราเข้าห้องก่อนคืนค่า)
  hwNoRoom = !(data || []).length;
  watchHw();
  if (typeof renderTasks === 'function') renderTasks();
  if (typeof renderHome === 'function') renderHome();
}

// ============================================================
// ใครกำลังนั่งทำงานชิ้นไหนอยู่ตอนนี้
// ------------------------------------------------------------
// ช่องเดียวต่อห้องเรียน ไม่ใช่ช่องละงาน — หน้าแรกมีงานพร้อมกันได้สิบใบ
// ถ้าเปิดช่องละใบก็คือสิบช่อง ซึ่ง realtime ของ Supabase นับเป็นสิบ และเงียบไปทั้งชุด
// แต่ละคนจึงประกาศแค่ "ตอนนี้อยู่กับกุญแจไหน" แล้วทุกการ์ดอ่านจากก้อนเดียวกัน
let hwSub = null;
let hwLive = {};        // key -> จำนวนคนอื่นที่กำลังอยู่กับงานชิ้นนั้น
let hwLiveN = 0;        // จำนวน "คน" ไม่ใช่จำนวนต่อห้อง — คนเดียวนับได้สองห้อง (key + open)
let hwOpenKey = null;   // ห้องที่เปิดค้างอยู่บนจอตอนนี้

async function watchHw() {
  if (hwSub || !sb || !currentUser || !hwOn()) return;
  // ห้ามให้ตัวนี้ปาดข้อผิดพลาดออกไปข้างนอก — มันถูกเรียกจากท้าย doHwSync ซึ่งไม่มีใครรอผล
  // rejection ที่ไม่มีคนรับจะไปโผล่เป็น error แดงในคอนโซลโดยไม่มีอะไรพังจริงสักอย่าง
  let room = null;
  try { room = typeof myFirstRoom === 'function' ? await myFirstRoom() : null; } catch (_) {}
  if (!room) return;
  const ch = sb.channel('hwx:' + room, { config: { presence: { key: currentUser.id } } });
  ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState();
    const c = {};
    // นับหัวคนแยกอีกตัว: บวก c[key] ทุกช่องรวมกันไม่ได้ เพราะคนที่กำลังทำงานอยู่
    // และเปิดห้องค้างไว้ด้วย จะถูกนับสองรอบ แล้วบล็อกหน้าแรกจะโม้จำนวนคน
    let people = 0;
    for (const k of Object.keys(st)) {
      const u = (st[k] && st[k][0]) || null;
      if (!u || u.id === currentUser.id) continue;
      if (u.key || u.open) people++;
      for (const key of [u.key, u.open]) if (key) c[key] = (c[key] || 0) + 1;
    }
    hwLive = c;
    hwLiveN = people;
    if (typeof renderTasks === 'function') renderTasks();
    // หน้าแรกมีบล็อก "กำลังทำอยู่ตอนนี้" ที่อ่านจากก้อนเดียวกัน — ต้องวาดใหม่ด้วย
    // ไม่งั้นตัวเลขจะนิ่งอยู่ที่ค่าตอนเปิดจอจนกว่าจะสลับแท็บไปกลับ
    if (typeof renderMenu === 'function') renderMenu();
    if (hwOpenKey) renderHwRoom();
  }).subscribe(async status => {
    if (status === 'SUBSCRIBED') await ch.track(hwCard());
  });
  hwSub = ch;
  clearInterval(watchHw._t);
  watchHw._t = setInterval(() => { if (hwSub) hwSub.track(hwCard()).catch(() => {}); }, 45000);
}
function hwCard() {
  // งานที่กำลังจับเวลาอยู่ = "กำลังทำอยู่จริง" · ห้องที่เปิดค้าง = "อยู่ในห้องนั้น"
  let key = null;
  try {
    const r = typeof runningWork === 'function' ? runningWork() : null;
    if (r) {
      const t = (state.tasks || []).find(x => x.id === r.taskId);
      const row = t && hwRows[hwTag(t)];
      key = (row && row.key) || null;
    }
  } catch (_) {}
  return { id: currentUser.id, key, open: hwOpenKey };
}
function pushHwCard() { if (hwSub) hwSub.track(hwCard()).catch(() => {}); }
function unwatchHw() {
  clearInterval(watchHw._t);
  if (hwSub) { try { sb.removeChannel(hwSub); } catch (_) {} hwSub = null; }
  hwLive = {};
  hwLiveN = 0;
}

// ============================================================
// บล็อกหน้าแรก — "กำลังทำอยู่ตอนนี้"
// ------------------------------------------------------------
// ของที่มาเติมครึ่งล่างจอ "วันนี้" ที่ว่างลงหลัง 1B39 ถอดกริดกับก้อนเสี่ยงพังออก
// เกณฑ์ที่ใช้เลือกของมาใส่: ต้องไม่ขอให้ตัดสินใจอะไรเพิ่ม จอนี้มีคำสั่งได้คำสั่งเดียว
// บล็อกนี้ผ่านเพราะมันเป็น "ข่าว" ไม่ใช่ "ลิสต์" — อ่านแล้วรู้ว่าไม่ได้นั่งทำอยู่คนเดียว
// ซึ่งเป็นแรงที่มาจากคน ไม่ใช่จากแอปเตือน
//
// ---- ทำไมไม่มีชื่อกับรูปเพื่อน ----
// ก้อน presence ที่วิ่งอยู่มีแค่ {id, key, open} — ไม่มีชื่อ ไม่มีรูป โดยตั้งใจ
// ข้อความขอความยินยอมตอนเปิดสวิตช์เขียนไว้ว่า "เพื่อนจะเห็นแค่ว่าเธอมีงานวิชานี้
// ส่งวันไหน และเสร็จหรือยัง — ไม่เห็นอย่างอื่น" · การใส่ชื่อลงไปในก้อนนี้คือการ
// ขยายสิ่งที่ออกจากเครื่องเกินกว่าที่เขากดยินยอมไว้ ซึ่งทำเงียบ ๆ ไม่ได้
// ถ้าจะมีชื่อจริง ต้องถามใหม่ทั้งจอ ไม่ใช่แก้บรรทัดเดียวตรงนี้
//
// กติกาการโผล่ใช้ชุดเดียวกับ hwStrip: ไม่มีอะไรจะบอกก็ไม่ต้องโผล่
// บล็อกที่ขึ้นว่า "0 คน" ทุกวันคือบล็อกที่สอนให้คนเลิกมองมุมนั้นของจอภายในสองวัน
function hwNowBlock() {
  if (!sb || !currentUser || !hwOn() || !hwLiveN) return '';

  // แปลงกุญแจกลับเป็นชื่อวิชา เพื่อบอกว่าเขากำลังทำ "อะไร" ไม่ใช่แค่ "มีคนอยู่"
  // hwRows คิดจากงานของเราเอง วิชาที่โผล่จึงเป็นวิชาที่เรามีงานอยู่ด้วยเท่านั้น
  // ซึ่งถูกแล้ว: "มีคนทำวิชาที่เราก็ต้องทำ" คือข่าว ส่วนวิชาที่เราไม่มีงานไม่ใช่
  const subj = [];
  let top = null, topN = 0;
  for (const tag of Object.keys(hwRows)) {
    const row = hwRows[tag];
    const n = hwLive[row.key] || 0;
    if (!n) continue;
    const name = tag.split('|')[0];
    if (name && subj.indexOf(name) === -1) subj.push(name);
    if (n > topN) { topN = n; top = row.key; }
  }

  const line = subj.length
    ? subj.slice(0, 2).join(' · ') + (subj.length > 2 ? ' และอีก ' + (subj.length - 2) : '')
    : 'ในห้องเรียนเดียวกับคุณ';

  // แตะแล้วเข้าห้องที่มีคนเยอะสุด · ถ้าจับคู่วิชาไม่ได้ (คนอยู่ในห้องของงานที่เราไม่มี)
  // ก็ไม่มีห้องให้เปิด บล็อกจึงเป็นก้อนอ่านอย่างเดียว ไม่ใช่ปุ่มที่กดแล้วไม่เกิดอะไร
  const act = top ? ` onclick="openHwRoom('${top}')"` : '';
  const tag = top ? 'button' : 'div';

  return `<${tag} class="hw-now${top ? ' tap' : ''}"${act}>
    <span class="hn-live"><i></i></span>
    <span class="hn-tx">
      <b>${hwLiveN} คนกำลังทำงานอยู่ตอนนี้</b>
      <span>${esc(line)}</span>
    </span>
    ${top ? `<span class="hn-go">ทำด้วยกัน ${icon('chevron')}</span>` : ''}
  </${tag}>`;
}

// ============================================================
// แถวใต้การ์ดงาน
// ------------------------------------------------------------
// กติกาเดียวที่ยึด: ไม่มีอะไรจะบอกก็ไม่ต้องโผล่ · การ์ดงานเป็นของที่คนดูวันละหลายสิบครั้ง
// แถวที่ขึ้นว่า "ยังไม่มีใคร" ทุกใบคือแถวที่สอนให้คนเลิกอ่านตรงนั้นภายในสองวัน
// ============================================================
// ---------- ใบไหนได้ถือคำถาม ----------
// ถามใบเดียวเท่านั้น · คำถามเดียวกันซ้ำทุกใบทั้งหน้าอ่านเป็นโฆษณา ไม่ใช่คำถาม
// เลือกด้วยการคำนวณใหม่ทุกครั้ง (ไม่ใช่ธงที่ค้างไว้) — วาดจอสองรอบติดในจังหวะเดียว
// แล้วรอบที่สองต้องได้คำตอบเดิม ไม่ใช่หายไปเพราะรอบแรกกินธงไปแล้ว
function hwAskId() {
  const today = ymd(new Date());
  for (const t of (typeof liveTasks === 'function' ? liveTasks() : (state.tasks || []))) {
    if (t.done || !hwTag(t) || ymd(t.due) < today) continue;
    return t.id;
  }
  return null;
}

function hwStrip(t) {
  if (!t || t.done || !sb || !currentUser) return '';
  const tag = hwTag(t);
  if (!tag) return '';

  // ยังไม่เคยถูกถาม — ถามตรงนี้ ที่จุดที่มันเพิ่งจะเริ่มมีความหมาย ไม่ใช่ในหน้าตั้งค่า
  if (!hwAsked()) {
    if (t.id !== hwAskId()) return '';
    return `<div class="hw hw-ask" onclick="event.stopPropagation()">
      <p>รู้ไหมว่ามีเพื่อนร่วมห้องอีกกี่คนที่ยังไม่ได้ทำงานชิ้นนี้</p>
      <span class="hw-fine">เพื่อนจะเห็นแค่ว่าเธอมีงานวิชานี้ ส่งวันไหน และเสร็จหรือยัง — ไม่เห็นอย่างอื่น</span>
      <div class="hw-ask-row">
        <button class="hw-no" onclick="hwSet(false)">ไม่เอา</button>
        <button class="hw-yes" onclick="hwSet(true)">เปิดใช้</button>
      </div>
    </div>`;
  }
  if (!hwOn()) return '';

  // เปิดสวิตช์แล้วแต่ยังไม่ได้ผูกห้องเรียน — ก่อนหน้านี้แถวนี้เงียบสนิท
  // ทำให้คนที่กด "เปิดใช้" ไปแล้วคิดว่าฟีเจอร์พัง ทั้งที่มันแค่ยังขาดขั้นตอนเดียว
  // ขึ้นใบเดียวเหมือนกันกับคำถามข้างบน — ขึ้นทุกใบคือโฆษณา ไม่ใช่คำแนะนำ
  if (hwNoRoom) {
    if (t.id !== hwAskId()) return '';
    return `<div class="hw hw-link" onclick="event.stopPropagation();go('scr-sources')">
      <span class="hw-n">เพื่อนที่มีงานชิ้นเดียวกันคุยกันได้ที่นี่</span>
      <span class="hw-go">เชื่อมห้องเรียน ${icon('chevron')}</span>
    </div>`;
  }

  const row = hwRows[tag];
  if (!row) return '';
  const live = hwLive[row.key] || 0;
  if (!row.others && !live && !row.talking) return '';   // ไม่มีอะไรจะบอก

  const bits = [];
  if (row.others) bits.push(`<span class="hw-n">อีก ${row.others} คนในห้องยังไม่เสร็จ</span>`);
  if (live) bits.push(`<span class="hw-live"><i></i>${live} คนกำลังทำอยู่ตอนนี้</span>`);
  else if (row.talking) bits.push(`<span class="hw-talk">${row.talking} คนคุยกันอยู่ในห้องนี้</span>`);

  return `<div class="hw" onclick="event.stopPropagation();openHwRoom('${row.key}')">
    ${bits.join('')}
    <span class="hw-go">ทำด้วยกัน ${icon('chevron')}</span>
  </div>`;
}

// ============================================================
// จอห้อง
// ============================================================
let hwRoom = null;      // ก้อนจาก hw_open
let hwErr = null;
let hwMsgSub = null;

async function openHwRoom(key) {
  if (!sb || !currentUser) return;
  hwOpenKey = key; hwRoom = null; hwErr = null;
  go('scr-hw');
  renderHwRoom();
  pushHwCard();

  const { data, error } = await sb.rpc('hw_open', { p_key: key });
  if (error) hwErr = error.message;
  else if (!data) hwErr = 'ไม่พบห้องนี้';
  else hwRoom = data;
  renderHwRoom();

  // ข้อความใหม่เด้งเข้าเอง — ห้องที่ต้องปัดลงรีเฟรชคือห้องที่ไม่มีใครรู้สึกว่ามีคนอยู่
  closeHwRoom(true);
  hwMsgSub = sb.channel('hw:' + key)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'hw_msgs', filter: 'key=eq.' + key },
      p => {
        if (!hwRoom || !p.new) return;
        if (hwRoom.msgs.some(m => String(m.id) === String(p.new.id))) return;
        const who = (hwRoom.people || []).find(x => x.id === p.new.author);
        hwRoom.msgs.push({
          id: p.new.id, author: p.new.author, ai: p.new.is_ai, body: p.new.body,
          at: p.new.created_at, name: (who && who.name) || (p.new.is_ai ? 'น้องไซ' : 'เพื่อนร่วมห้อง'),
          avatar: (who && who.avatar) || null,
        });
        renderHwRoom();
      })
    .subscribe();
}

// ต้องเรียกทุกครั้งที่ออกจากจอ — ช่องที่เปิดค้างไว้กินโควตา realtime ซึ่งนับจำนวนช่อง
// ที่เปิดพร้อมกัน ไม่ใช่จำนวนข้อความ (บทเรียนเดียวกับ closeChat ใน social.js)
function closeHwRoom(keepKey) {
  if (hwMsgSub) { try { sb.removeChannel(hwMsgSub); } catch (_) {} hwMsgSub = null; }
  if (!keepKey) { hwOpenKey = null; pushHwCard(); }
}

function hwAv(m) {
  if (m.ai) return `<span class="hw-av ai">${icon('sparkles')}</span>`;
  const name = m.name || '?';
  if (m.avatar) return `<span class="hw-av" style="background-image:url('${esc(m.avatar)}')"></span>`;
  const st = typeof avStyle === 'function' ? avStyle(name) : '';
  return `<span class="hw-av" style="${st}">${esc(name.slice(0, 1))}</span>`;
}

function renderHwRoom() {
  const box = document.getElementById('hwBody');
  if (!box) return;
  const me = currentUser && currentUser.id;

  if (hwErr) {
    box.innerHTML = `<div class="hw-top"><button class="hw-back" onclick="go('scr-tasks')"
      aria-label="กลับ">${icon('chevron')}</button><div class="hw-who"><b>ห้องการบ้าน</b></div></div>
      <p class="hw-empty">${esc(hwErr)}</p>`;
    return;
  }
  if (!hwRoom) {
    box.innerHTML = `<div class="hw-top"><button class="hw-back" onclick="go('scr-tasks')"
      aria-label="กลับ">${icon('chevron')}</button><div class="hw-who"><b>กำลังเปิดห้อง…</b></div></div>`;
    return;
  }

  const live = hwLive[hwRoom.key] || 0;
  const closed = !!hwRoom.closed;
  const msgs = hwRoom.msgs || [];

  box.innerHTML = `
    <div class="hw-top">
      <button class="hw-back" onclick="go('scr-tasks')" aria-label="กลับ">${icon('chevron')}</button>
      <div class="hw-who">
        <b>${esc(hwRoom.title || hwRoom.subject)}</b>
        <i>${closed ? 'ห้องนี้ปิดแล้ว' : 'ห้องนี้ปิดตัวเอง' + esc(hwDueText(hwRoom.due))}</i>
      </div>
    </div>

    <div class="hw-here">
      ${(hwRoom.people || []).length
        ? `<span class="hw-faces">${(hwRoom.people || []).slice(0, 6).map(p => hwAv(p)).join('')}</span>
           <span>${hwRoom.people.length} คนยังไม่เสร็จ${live ? ` · <b class="hw-live"><i></i>${live} คนอยู่ตอนนี้</b>` : ''}</span>`
        : '<span>ตอนนี้มีแค่เธอที่ยังไม่เสร็จ</span>'}
    </div>

    <div class="hw-list" id="hwList">
      ${msgs.length
        ? msgs.map(m => `<div class="hw-msg${m.author === me ? ' me' : ''}${m.ai ? ' ai' : ''}">
            ${m.author === me ? '' : hwAv(m)}
            <div class="hw-bub">
              ${m.author === me ? '' : `<span class="hw-nm">${esc(m.name)}${m.ai ? '<em>AI</em>' : ''}</span>`}
              ${esc(m.body)}
            </div>
          </div>`).join('')
        : `<p class="hw-empty">ยังไม่มีใครพิมพ์อะไร<br>
             ห้องนี้มีไว้ถามเรื่องงานชิ้นนี้อย่างเดียว — ถามข้อไหนที่ติดได้เลย</p>`}
    </div>

    ${closed
      ? '<p class="hw-shut">งานชิ้นนี้เลยกำหนดส่งแล้ว ห้องจึงปิดรับข้อความ</p>'
      : `<div class="hw-bar">
          <input id="hwIn" type="text" maxlength="1000" placeholder="ติดข้อไหน"
                 onkeydown="if(event.key==='Enter')sendHw()">
          <button class="hw-send" onclick="sendHw()" aria-label="ส่ง">${icon('check')}</button>
        </div>`}`;

  const list = document.getElementById('hwList');
  if (list) list.scrollTop = list.scrollHeight;
}

function hwDueText(due) {
  const d = new Date(due + 'T23:59:59');
  const today = ymd(new Date());
  if (due === today) return 'คืนนี้';
  const t = new Date(); t.setDate(t.getDate() + 1);
  if (due === ymd(t)) return 'พรุ่งนี้';
  return 'วัน' + (typeof fmtThaiDate === 'function' ? fmtThaiDate(d) : due);
}

async function sendHw() {
  const el = document.getElementById('hwIn');
  if (!el || !hwRoom) return;
  const body = el.value.trim();
  if (!body) return;
  el.value = '';
  const { data, error } = await sb.rpc('hw_say', { p_key: hwRoom.key, p_body: body });
  if (error) {
    el.value = body;                       // คืนข้อความให้ ไม่ใช่กลืนหายไปเฉย ๆ
    if (typeof haptic === 'function') haptic('snooze');
    showToast({ title: 'ส่งไม่สำเร็จ', body: error.message });
    return;
  }
  hwRoom.msgs.push({
    id: data && data.id, author: currentUser.id, ai: false, body,
    at: (data && data.at) || new Date().toISOString(),
    name: (state.settings.name || '').trim() || 'ฉัน', avatar: state.settings.avatar || null,
  });
  renderHwRoom();
}
