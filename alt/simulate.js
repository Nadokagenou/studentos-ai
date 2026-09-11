// ============================================================
// simulate — "ยังเริ่มทันอยู่ไหม และเริ่มไม่ทันตอนกี่โมง"  ·  *** ALT ***
// ------------------------------------------------------------
// ไฟล์นี้คือเฟส 1 ของการรื้อเอนจินตัดสินใจ (ดูเอกสารสถาปัตยกรรม)
// มันไม่ได้มาแทน priorityInfo() — มันมาตอบคำถามที่ priorityInfo() ตอบไม่ได้เลย
//
// ทุกแอปโชว์ "วันส่ง" ซึ่งเป็นข้อมูลที่ครูให้มา ไม่ใช่ข้อมูลที่ตัดสินใจได้
// สิ่งที่ตัดสินใจได้คือ **วินาทีสุดท้ายที่ยังเริ่มแล้วทำเสร็จทัน** ซึ่งคนละเรื่องกันคนละโลก:
// งานสองชั่วโมงที่ส่งวันศุกร์ แต่พฤหัสติดเรียนพิเศษถึงสามทุ่ม — เส้นตายจริงของมันคือคืนพุธ
// ไม่ใช่วันศุกร์ และไม่มีอะไรในแอปเคยบอกเรื่องนี้มาก่อน
//
// ------------------------------------------------------------
// สามอย่างที่ไฟล์นี้ทำ และของเดิมไม่ได้ทำ
//
//   1. มองงานทั้งกอง ไม่ใช่ทีละใบ
//      priorityInfo(task, now) รับงานใบเดียว คะแนนของมันไม่เปลี่ยนไม่ว่าจะมีงานอื่นอีกกี่ใบ
//      แต่ "เวลาว่างวันพุธ" ไม่ได้เป็นของงานทุกใบพร้อมกัน — ใครเส้นตายมาก่อนได้จองก่อน
//      ที่นี่จึงจองเวลาให้ตามลำดับเส้นตาย (EDF) แล้วงานที่เหลือเห็น "รันเวย์" ที่เหลือจริง ๆ
//
//   2. ยอมรับว่าคนไม่ได้ใช้เวลาว่างทุกนาที
//      isLastChanceToday() ของเดิมถามว่า "เวลาว่างพอไหม" โดยสมมติว่าใช้ได้ครบ 100%
//      ซึ่งไม่เคยเกิดขึ้นกับใคร · ที่นี่คูณด้วยอัตราลงมือจริงก่อนเสมอ
//
//   3. ตอบเป็นความน่าจะเป็น ไม่ใช่จริง/เท็จ
//      ของเดิมคืน boolean ซึ่งกระโดดจาก "สบาย" เป็น "ไม่ทัน" ในนาทีเดียวโดยไม่มีสัญญาณล่วงหน้า
//      ที่นี่คืนค่า 0–1 ที่ค่อย ๆ ลง — และตัวเลขที่ค่อย ๆ ลงคือตัวเลขที่เตือนได้ทัน
//
// ------------------------------------------------------------
// สิ่งที่ยัง **ไม่** ทำในเฟสนี้ (อย่าเผลอยัดเข้ามา)
//   · ไม่สุ่ม Monte Carlo — เดินอนาคตเส้นเดียว เฟส 2 ค่อยแตกเป็นหลายเส้น
//   · ไม่มีฟังก์ชันความสูญเสีย — ยังไม่ตีราคาเป็นคะแนนเทอม เฟส 2 เช่นกัน
//   · ไม่เรียนรู้อัตราลงมือจากผู้ใช้ — ใช้ค่ากลางไปก่อน เฟส 3 ค่อยเรียน (ดู followRate)
//
// คำนวณในเครื่องล้วน ไม่มีเน็ต ไม่มีโมเดลภาษา ใส่ now เดิมแล้วต้องได้คำตอบเดิมทุกครั้ง
// ============================================================

// ---------- อัตราลงมือจริง ----------
// เวลาว่าง 100 นาที ไม่ได้แปลว่าได้ทำงาน 100 นาที — มีเดินไปหาของ มีแชทเด้ง มีเหม่อ
// ตัวเลขนี้คือตัวคูณที่แปลง "เวลาว่างบนปฏิทิน" เป็น "เวลาที่ได้ทำงานจริง"
//
// 0.7 เป็นค่ากลางที่ตั้งไว้ก่อน ไม่ใช่ค่าที่วัดจากผู้ใช้คนนี้ — และนั่นคือเหตุผลที่มันต้องอยู่
// ในฟังก์ชันไม่ใช่ค่าคงที่ลอย ๆ: เฟส 3 จะเปลี่ยนที่นี่ที่เดียวให้อ่านจากประวัติจริง
// (วางแผนไว้กี่นาที กดจับเวลาจริงกี่นาที) แล้วทั้งไฟล์ได้ตัวเลขของคนคนนั้นทันทีโดยไม่ต้องแก้ที่อื่น
//
// ห้ามตั้งเป็น 1.0 แม้จะดู "เป็นกลาง" กว่า — 1.0 คือการกลับไปเป็น isLastChanceToday
// ซึ่งบอกว่าทันจนถึงนาทีสุดท้ายแล้วค่อยบอกว่าไม่ทัน ซึ่งสายเกินกว่าจะทำอะไรได้แล้ว
const FOLLOW_RATE_PRIOR = 0.7;

function followRate() {
  // เฟส 3: ถ้ามีประวัติมากพอ ให้คืนค่าที่วัดได้จริงพร้อม learned: true
  // จนกว่าจะถึงตอนนั้น ต้องประกาศตรง ๆ ว่านี่คือค่ากลาง ไม่ใช่ค่าของผู้ใช้คนนี้
  return { rate: FOLLOW_RATE_PRIOR, learned: false, n: 0 };
}

// ---------- ขอบเขตที่มองไปข้างหน้า ----------
// 14 วันพอสำหรับทุกอย่างที่ครูมัธยมสั่ง และเป็นเลขเดียวกับ freeMinutesBefore ของ context.js
const SIM_HORIZON_DAYS = 14;

// ต่ำกว่านี้ไม่นับเป็นช่วงที่นั่งทำงานได้ — ตรงกับที่ context.js กรองไว้อยู่แล้ว
const SIM_MIN_SLOT = 10;

// ---------- 1) เส้นเวลาของช่องว่างจริง ----------
// แปลงช่องว่างรายวันจาก context.js ให้เป็นรายการเดียวเรียงตามเวลาจริง (Date)
// คิดครั้งเดียวต่อการเรียก riskReport หนึ่งครั้ง แล้วส่งต่อให้ทุกงานใช้ร่วมกัน —
// ไม่งั้นงาน 20 ใบจะสั่ง freeSlots() ซ้ำวันละ 20 รอบโดยได้คำตอบเดียวกันทุกรอบ
function simTimeline(now = new Date(), days = SIM_HORIZON_DAYS) {
  if (typeof freeSlots !== 'function') return [];
  const out = [];
  for (let i = 0; i <= days; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    const mid = new Date(day); mid.setHours(0, 0, 0, 0);
    for (const s of freeSlots(day, i === 0 ? now : null)) {
      if (s.min < SIM_MIN_SLOT) continue;
      out.push({
        start: new Date(mid.getTime() + s.from * 60000),
        end: new Date(mid.getTime() + s.to * 60000),
        min: s.min,
        used: 0,          // นาทีที่ถูกจองไปแล้วโดยงานที่เส้นตายมาก่อน
      });
    }
  }
  return out;
}

// นาทีของช่วงนี้ที่ยังว่างอยู่จริง และตกอยู่ก่อนเส้นตาย `due`
// ช่วงที่คร่อมเส้นตายถูกตัดครึ่ง — เวลาหลังกำหนดส่งไม่ใช่เวลาที่ใช้ส่งงานได้
function slotRoomBefore(slot, due) {
  if (slot.start >= due) return 0;
  const end = slot.end <= due ? slot.end : due;
  const span = Math.round((end - slot.start) / 60000);
  return Math.max(0, Math.min(span, slot.min - slot.used));
}

// ---------- 2) นาทีที่งานใบนี้ยังต้องใช้จริง ----------
// ใช้ตัวเลขเดียวกับที่ตัวจัดแผนใช้ ไม่ใช่ estMin ดิบ —
// planner.js เรียนรู้ไว้แล้วว่างานวิชาไหนบานกว่าที่ประเมิน (durationStats)
// ถ้าตรงนี้ใช้เลขดิบ นาฬิกาจะบอกว่ายังทันในขณะที่แผนบอกว่าไม่ทัน แล้วสองจอก็เถียงกันอีกรอบ
function simNeedMin(task, stats) {
  if (typeof plannedMin === 'function') return plannedMin(task, stats);
  if (typeof remainingMin === 'function') return remainingMin(task);
  return Math.max(10, Math.round((task.estMin || 30) * (1 - (task.progress || 0) / 100)));
}

// ---------- 3) ความน่าจะเป็นที่จะเสร็จทัน ----------
// r = เวลาที่ทำได้จริงก่อนกำหนด ÷ เวลาที่ต้องใช้
//
// เส้นโค้งลอจิสติกแทนการเทียบตรง ๆ เพราะ r = 0.99 กับ r = 1.01 ไม่ควรเป็นคนละโลกกัน
// ทั้งที่ต่างกันหนึ่งนาที · k = 2.2 ให้:  r=0.5 → 25% · r=1 → 50% · r=1.5 → 75% · r=2 → 89%
//
// เพดาน 97% ไม่ใช่ 100% โดยตั้งใจ — แอปไม่มีทางรู้ว่าพรุ่งนี้เขาจะป่วยไหม
// ตัวเลขที่พูดว่า "แน่นอน 100%" คือตัวเลขที่พังครั้งเดียวแล้วเสียความเชื่อถือทั้งระบบ
function completionOdds(effAvailMin, needMin) {
  if (needMin <= 0) return 0.97;
  const r = effAvailMin / needMin;
  const p = 1 / (1 + Math.exp(-2.2 * (r - 1)));
  return Math.max(0.02, Math.min(0.97, Math.round(p * 100) / 100));
}

// pnrHard = null แปลว่า "ต่อให้ใช้เวลาว่างทุกนาทีแบบไม่พักเลยก็ยังไม่พอ"
// อันนั้นไม่ใช่ความน่าจะเป็น มันคือเลขคณิต — เวลาว่าง 90 นาที กับงาน 120 นาที ไม่มีทางจบ
// ปล่อยให้เส้นโค้งลอจิสติกตอบว่า "26%" คือการให้ความหวังที่คำนวณแล้วว่าไม่มีอยู่จริง
// และเป็นความผิดชนิดที่แพงที่สุด เพราะเด็กจะไม่ไปหาทางออกอื่น (ขอเลื่อน ยืมเวลา ตัดสโคป) ทั้งที่ยังมีเวลาหา
function verdictOf(odds, pnr, now, pnrHard) {
  if (!pnrHard) return 'lost';
  if (odds <= 0.05 || (pnr && pnr <= now)) return 'lost';
  if (odds < 0.5) return 'critical';
  if (odds < 0.85) return 'tight';
  return 'safe';
}

// ---------- 4) จุดที่เริ่มไม่ทัน (point of no return) ----------
// เดินถอยหลังจากเส้นตาย เก็บเวลาที่ทำได้จริงสะสมไปเรื่อย ๆ จนครบที่ต้องใช้
// จุดที่ครบพอดี = วินาทีสุดท้ายที่ยังเริ่มแล้วทัน · หลังจากนั้นต่อให้ใช้ทุกนาทีที่เหลือก็ไม่พอ
//
// rate = 1 ให้ "กำแพงจริง" (ถ้าทำได้เต็มร้อยทุกนาที) · rate < 1 ให้เส้นที่เกิดขึ้นจริง
// คืนทั้งสองค่าเพราะเป็นคนละข่าวกัน: เส้นแรกคือข้อเท็จจริง เส้นหลังคือคำทำนาย
// และผู้ใช้ควรได้เห็นคำทำนายเป็นตัวหลัก แต่ต้องตรวจสอบข้อเท็จจริงได้เสมอ
function pointOfNoReturn(timeline, due, needMin, rate) {
  let acc = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const slot = timeline[i];
    if (slot.start >= due) continue;
    const room = slotRoomBefore(slot, due);
    if (room <= 0) continue;
    const eff = room * rate;
    if (acc + eff >= needMin) {
      // ต้องการอีกกี่นาที "ที่ทำได้จริง" → แปลงกลับเป็นนาทีบนนาฬิกา
      const stillNeed = needMin - acc;
      const rawNeeded = stillNeed / rate;
      const end = slot.end <= due ? slot.end : due;
      return new Date(end.getTime() - rawNeeded * 60000);
    }
    acc += eff;
  }
  return null;   // รวมทั้งรันเวย์ก็ยังไม่พอ — ไม่มีจุดเริ่มไหนที่ทันแล้ว
}

// ---------- 5) รายงานความเสี่ยงของทั้งกอง ----------
// นี่คือทางเข้าหลักของไฟล์นี้ · ทุกจอที่อยากรู้ว่า "ทันไหม" ต้องอ่านจากที่นี่ที่เดียว
//
// ลำดับการคิดสำคัญมาก: ไล่ตามเส้นตายจากใกล้ไปไกล (Earliest Deadline First)
// แล้ว **คิดรันเวย์ของงานใบนั้นก่อนจะจองเวลาให้มัน** — ตอนที่คิด ช่องว่างที่ถูกจองไปแล้ว
// จึงเป็นของงานที่เส้นตายมาก่อนเท่านั้น ซึ่งตรงกับความจริง: งานส่งพรุ่งนี้ได้จองคืนนี้ก่อน
// งานส่งศุกร์เห็นเฉพาะที่เหลือ
//
// EDF ไม่ใช่การเดา — ถ้ามีลำดับไหนที่ทำทันทุกใบ EDF ก็ทำทันทุกใบด้วย (พิสูจน์ได้)
// จึงเป็นเกณฑ์ที่ถูกต้องสำหรับคำถาม "ยังเป็นไปได้ไหม" โดยเฉพาะ
function riskReport(tasks, now = new Date(), opts = {}) {
  const rate = opts.rate != null ? opts.rate : followRate().rate;
  const timeline = opts.timeline || simTimeline(now);
  const stats = opts.stats || (typeof durationStats === 'function' && opts.state
    ? durationStats(opts.state) : null);

  // เอาเฉพาะงานที่ต้องเจียดเวลานั่งทำและมีเส้นตาย —
  // กิจกรรมกับเตือนความจำไม่มี "เริ่มไม่ทัน" เพราะไม่ต้องเริ่มอะไรล่วงหน้า
  const live = (tasks || []).filter(t => {
    if (!t || t.done || t.deleted || !t.due) return false;
    if (typeof TASK_TYPES === 'object' && typeof taskType === 'function') {
      return TASK_TYPES[taskType(t)].schedulable;
    }
    return true;
  });

  const queue = live
    .map(t => ({ t, due: new Date(t.due), need: simNeedMin(t, stats) }))
    .filter(x => !isNaN(x.due))
    // เส้นตายเท่ากันให้ใบที่สั้นกว่าไปก่อน — ได้จำนวนใบที่ทันมากกว่าเมื่อเวลาไม่พอ
    .sort((a, b) => (a.due - b.due) || (a.need - b.need));

  const out = [];
  for (const item of queue) {
    const { t, due, need } = item;

    // เลยกำหนดไปแล้ว: ไม่มีอนาคตให้จำลอง และห้ามให้มันไปแย่งจองเวลาของงานที่ยังกู้ได้
    if (due <= now) {
      out.push({ task: t, needMin: need, runwayMin: 0, effAvailMin: 0,
        pnr: null, pnrHard: null, hoursToPnr: null, odds: 0,
        verdict: 'lost', overdue: true, eats: [], rate });
      continue;
    }

    // รันเวย์ = เวลาว่างก่อนเส้นตายที่ "งานใบนี้เอื้อมถึงได้จริง"
    // (หักส่วนที่งานเส้นตายก่อนหน้าจองไปแล้ว ซึ่งอยู่ใน slot.used ตอนนี้พอดี)
    //
    // eatenMin นับแยกไว้ด้วย เพราะ "ใครจองไปก่อน" จะเป็นข่าวก็ต่อเมื่อมันกินไปเยอะจริง
    // งานที่ยังสบายอยู่แล้วไม่ต้องรู้ว่ามีใครใช้เวลาว่างวันจันทร์ไปบ้าง — พูดไปก็เป็นเสียงรบกวน
    let runway = 0, eaten = 0;
    const eats = [];
    for (const slot of timeline) {
      if (slot.start >= due) break;
      runway += slotRoomBefore(slot, due);
      if (slot.used > 0) {
        eaten += Math.min(slot.used, Math.round((Math.min(slot.end, due) - slot.start) / 60000));
        for (const owner of (slot.owners || [])) {
          if (!eats.includes(owner)) eats.push(owner);
        }
      }
    }

    const effAvail = runway * rate;
    const pnr = pointOfNoReturn(timeline, due, need, rate);
    const pnrHard = pointOfNoReturn(timeline, due, need, 1);
    // เวลาว่างดิบไม่พอ = จบแล้วโดยเลขคณิต · ตัวเลขความน่าจะเป็นต้องไม่เถียงกับข้อเท็จจริงนั้น
    const odds = pnrHard ? completionOdds(effAvail, need) : 0.02;

    out.push({
      task: t, needMin: need, runwayMin: Math.round(runway),
      effAvailMin: Math.round(effAvail),
      pnr, pnrHard,
      hoursToPnr: pnr ? Math.round((pnr - now) / 3.6e5) / 10 : null,
      odds, verdict: verdictOf(odds, pnr, now, pnrHard), overdue: false,
      eats, eatenMin: Math.round(eaten), rate,
    });

    // จองเวลาให้งานใบนี้ **หลัง** คิดรันเวย์เสร็จแล้ว — ใบถัดไป (เส้นตายไกลกว่า) จะได้เห็นที่เหลือจริง
    let left = need / rate;    // นาทีบนนาฬิกาที่ต้องใช้ เพื่อให้ได้เวลาทำงานจริงครบ need
    for (const slot of timeline) {
      if (left <= 0) break;
      if (slot.start >= due) break;
      const room = slotRoomBefore(slot, due);
      if (room <= 0) continue;
      const take = Math.min(room, left);
      slot.used += take;
      (slot.owners || (slot.owners = [])).push(t);
      left -= take;
    }
  }

  // คืนตามลำดับเดิมของ tasks ที่ส่งเข้ามา ไม่ใช่ลำดับ EDF ที่ใช้คำนวณภายใน —
  // ผู้เรียกไม่ควรต้องรู้ว่าข้างในเรียงยังไง และไม่ควรมีจอไหนเผลอเอาลำดับนี้ไปแสดงผล
  // (ลำดับ EDF เป็นเรื่องของการคำนวณว่าใครได้จองเวลาก่อน ไม่ใช่ลำดับที่ควรโชว์ให้ใครดู)
  const byTask = new Map(out.map(r => [r.task, r]));
  return (tasks || []).map(t => byTask.get(t)).filter(Boolean);
}

// หา record ของงานใบเดียวจากรายงานทั้งกอง
// **ห้ามคำนวณงานใบเดียวโดด ๆ** — คำตอบจะผิดเสมอเพราะไม่เห็นว่ามีใครแย่งเวลาอยู่บ้าง
// ซึ่งเป็นความผิดข้อเดียวกับที่ priorityInfo() ทำอยู่ (W1 ในเอกสารสถาปัตยกรรม)
function riskOf(task, tasks, now = new Date(), opts = {}) {
  const rep = riskReport(tasks, now, opts);
  return rep.find(r => r.task === task || r.task.id === task.id) || null;
}

// ---------- 6) แปลงเป็นภาษาที่คนอ่านแล้วตัดสินใจได้ ----------
// กติกา: ทุกประโยคต้องมีเวลาที่ชี้ได้บนนาฬิกา หรือไม่ก็ไม่ต้องพูด
// "ควรเริ่มเร็ว ๆ นะ" ไม่ใช่ข้อมูล · "เริ่มได้ถึงสี่ทุ่มคืนพรุ่งนี้" คือข้อมูล
const SIM_DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];

function simWhen(d, now) {
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b - a) / 864e5);
  if (diff <= 0) return hm + ' วันนี้';
  if (diff === 1) return hm + ' พรุ่งนี้';
  if (diff <= 6) return hm + ' วัน' + SIM_DAY_NAMES[d.getDay()];
  return hm + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
}

// ข้อความบนนาฬิกา — ตัวเอกของเฟสนี้
function pnrText(r, now = new Date()) {
  if (!r) return null;
  if (r.overdue) return 'เลยกำหนดส่งแล้ว';

  // ไม่มีจุดเริ่มที่ทัน "ตามอัตราที่คนทำได้จริง" แต่ยังมีกำแพงจริงอยู่ = คนละข่าวกับไม่ทันเลย
  // ถ้าเขียนรวมกันจะได้ประโยคที่ขัดกับตัวเลขข้าง ๆ ตัวเอง ("ไม่พอแล้ว" คู่กับ "โอกาส 48%")
  // ซึ่งเป็นอาการเดียวกับที่ทั้งโปรเจกต์นี้พยายามเลิกทำ — จอเดียวห้ามพูดสองอย่าง
  if (!r.pnr) {
    return r.pnrHard && r.pnrHard > now
      ? 'ต้องใช้เวลาว่างที่เหลือแทบทุกนาที — ช้ากว่า ' + simWhen(r.pnrHard, now) + ' คือไม่ทันแน่'
      : 'เวลาว่างที่เหลือไม่พอทำให้เสร็จทันแล้ว';
  }
  if (r.pnr <= now) return 'เลยจุดที่เริ่มแล้วทันไปแล้ว — เหลือทางเดียวคือยืมเวลาจากอย่างอื่น';

  const h = (r.pnr - now) / 3.6e6;
  if (h < 1) return 'ต้องเริ่มภายใน ' + Math.max(1, Math.round(h * 60)) + ' นาที';
  if (h < 12) return 'เริ่มได้ถึง ' + simWhen(r.pnr, now) + ' (อีก ' + Math.round(h) + ' ชม.)';
  return 'เริ่มได้ถึง ' + simWhen(r.pnr, now);
}

// ข้อความสั้นสำหรับชิปบนการ์ด — คนละตัวกับ pnrText โดยตั้งใจ
// .tk-chip เป็น white-space: nowrap ประโยคเต็มจึงดันการ์ดล้นขอบจอบนมือถือแคบ
// และชิปมีหน้าที่ต่างจากประโยค: ชิปให้ "ตัวเลขที่ต้องเห็นตอนกวาดสายตา" ส่วนประโยคให้เหตุผล
function pnrChip(r, now = new Date()) {
  if (!r || r.overdue) return null;
  // ต้องแยกสองกรณีเหมือน pnrText เป๊ะ ๆ — "ไม่มีจุดเริ่มที่ทันตามอัตราจริง"
  // ไม่เท่ากับ "เวลาไม่พอ" · เขียนรวมกันเมื่อไหร่ ชิปนี้จะขัดกับชิปโอกาสที่อยู่ติดกัน
  // (เคยเป็นแบบนั้นจริงตอน 1B76: ชิปซ้ายบอก "เวลาว่างไม่พอแล้ว" ชิปขวาบอก "โอกาสเสร็จทัน 46%")
  if (!r.pnr) {
    return r.pnrHard && r.pnrHard > now
      ? 'ช้ากว่า ' + simWhen(r.pnrHard, now) + ' ไม่ทัน'
      : 'เวลาว่างไม่พอแล้ว';
  }
  if (r.pnr <= now) return 'เลยจุดที่เริ่มทันแล้ว';
  const h = (r.pnr - now) / 3.6e6;
  if (h < 1) return 'เริ่มภายใน ' + Math.max(1, Math.round(h * 60)) + ' นาที';
  if (h < 6) return 'เริ่มภายใน ' + Math.round(h) + ' ชม.';
  return 'เริ่มได้ถึง ' + simWhen(r.pnr, now);
}

// แบบสั้นที่สุด — สำหรับช่องตัวเลขขวาสุดของชิปบรรทัดเดียวในมุมมองสัปดาห์
// ช่องนั้นกว้างพอ ๆ กับคำว่า "−2ว." เท่านั้น · ยาวกว่านี้ชิปจะขึ้นบรรทัดที่สอง
// แล้วมุมมองสัปดาห์ก็เสียเหตุผลเดียวที่มันมีอยู่ (เห็นทั้งสัปดาห์ในจอเดียว)
//
// คืน null เมื่อไม่มีอะไรด่วนจะบอก — ผู้เรียกจะได้ถอยไปโชว์จำนวนนาทีตามเดิม
function pnrShort(r, now = new Date()) {
  if (!r || r.overdue) return null;
  if (!r.pnrHard) return 'ไม่ทัน';
  // เลยจุดเริ่มตามอัตราจริงแล้ว แต่กำแพงจริงยังอยู่ = ยังทำได้ ถ้าลงมือเดี๋ยวนี้จริง ๆ
  if (!r.pnr || r.pnr <= now) return 'เริ่มเลย';
  const h = (r.pnr - now) / 3.6e6;
  if (h < 1) return 'เริ่มใน ' + Math.max(1, Math.round(h * 60)) + 'น.';
  if (h <= 48) return 'เริ่มใน ' + Math.round(h) + 'ชม.';
  return null;                     // ยังอีกไกล ปล่อยให้ช่องนี้บอกเวลาที่ต้องใช้ตามเดิม
}

// ประโยคบอกโอกาส — ใช้คำที่คนพูดกัน ไม่ใช่เปอร์เซ็นต์ลอย ๆ
// เปอร์เซ็นต์ให้เฉพาะตอนที่มันต่ำพอจะเป็นข่าว · 91% ไม่ต้องบอกเป็นตัวเลข บอกว่า "สบาย" พอ
function oddsText(r) {
  if (!r || r.overdue) return null;
  const pct = Math.round(r.odds * 100);
  if (r.verdict === 'lost') return 'ไม่ทันแล้วถ้าไม่เปลี่ยนอะไร';
  if (r.verdict === 'critical') return 'โอกาสเสร็จทัน ' + pct + '%';
  if (r.verdict === 'tight') return 'ค่อนข้างตึง — โอกาสเสร็จทัน ' + pct + '%';
  return 'เวลาพอสบาย';
}

// ใครกินรันเวย์ของงานใบนี้ไป — ประโยคที่ priorityInfo() พูดไม่ได้เลยเพราะมันมองทีละใบ
// นี่คือคำตอบของ "ทำไมงานที่ส่งอีกตั้งห้าวันถึงตึง": เพราะสี่วันแรกมีเจ้าของอยู่แล้ว
// ต่ำกว่านี้ไม่ต้องพูดถึง — ครึ่งชั่วโมงที่ถูกจองไปในหนึ่งสัปดาห์ไม่ได้เปลี่ยนอะไรของใคร
const CROWD_MIN = 30;

function crowdText(r) {
  if (!r || !r.eats || !r.eats.length) return null;
  // งานที่ยังสบายอยู่ ไม่ต้องรู้ว่าใครใช้เวลาว่างไปบ้าง · พูดตอนที่มันเปลี่ยนคำตอบเท่านั้น
  if (r.verdict === 'safe' || (r.eatenMin || 0) < CROWD_MIN) return null;
  const names = r.eats
    .map(t => (typeof taskLabel === 'function' ? taskLabel(t, 18) : (t.subject || t.detail || 'งานอื่น')))
    .slice(0, 2);
  const more = r.eats.length - names.length;
  return 'เวลาว่างก่อนกำหนดถูกจองไว้ให้' + names.join(' · ')
    + (more > 0 ? ' และอีก ' + more + ' งาน' : '') + ' ก่อนแล้ว';
}

// ---------- 7) เส้นตายที่ใกล้ที่สุดที่ยังกู้ได้ ----------
// ไว้ให้จอไหนก็ตามที่อยากขึ้นแถบเดียวสรุปทั้งกอง โดยไม่ต้องไปไล่ record เอง
// เลือกใบที่ "จุดเริ่มไม่ทัน" มาถึงเร็วที่สุด ไม่ใช่ใบที่กำหนดส่งเร็วที่สุด — คนละใบกันบ่อยมาก
function mostUrgentRisk(report, now = new Date()) {
  const live = (report || []).filter(r => !r.overdue && r.pnr && r.pnr > now);
  if (!live.length) return null;
  return live.sort((a, b) => a.pnr - b.pnr)[0];
}

// ============================================================
// เฟส 2 — สุ่มอนาคตหลายเส้น
// ------------------------------------------------------------
// เฟส 1 เดินอนาคตเส้นเดียวด้วยอัตราคงที่ 0.7 ซึ่งตอบได้ดีว่า "ทันไหม"
// แต่ตอบไม่ได้ว่า "ทางเลือกไหนดีกว่ากันเท่าไหร่" เพราะเส้นเดียวไม่มีการกระจายให้เทียบ
//
// ตรงนี้จึงเดินอนาคตหลายร้อยเส้น แต่ละเส้นสุ่มนิสัยจริงของคน:
// บางคืนทำได้ 90% บางคืนได้ 40% · งานบางใบบานกว่าที่ประเมิน บางใบไม่บาน
// แล้วดูว่าจากทั้งหมดนั้น ทางเลือกไหนพาไปจบที่ไหนบ่อยแค่ไหน
//
// **ห้ามใช้ Math.random()** — ทั้งไฟล์นี้ต้องให้คำตอบเดิมเมื่อใส่ข้อมูลเดิม
// ไม่งั้นการ์ดบนจอจะขยับตัวเลขเองทุกครั้งที่วาดใหม่ (renderMenu ถูกเรียกทุกนาที)
// และ riskbench ก็จะทดสอบอะไรไม่ได้เลย
// ============================================================

// mulberry32 — PRNG 32 บิตที่สั้นพอจะอ่านจบและกระจายดีพอสำหรับงานแบบนี้
function simRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// สุ่มแบบระฆังคว่ำ (ผลรวมสามค่าจากการสุ่มแบน ~ normal) แล้วตัดปลายทั้งสองข้าง
// ใช้แทน Box-Muller เพราะไม่ต้องเรียก log/cos และไม่มีทางคืนค่าหลุดขอบ
function simBell(rnd, mean, sd, lo, hi) {
  const z = (rnd() + rnd() + rnd() - 1.5) * 2;   // sd ~ 1
  return Math.max(lo, Math.min(hi, mean + z * sd));
}

// ---------- ความไม่แน่นอนสองก้อนที่แยกกันชัดเจน ----------
// 1) อัตราลงมือ - สุ่มใหม่ "ทุกช่วงเวลา" เพราะแต่ละคืนไม่เหมือนกัน
//    ค่ากลางเท่ากับ FOLLOW_RATE_PRIOR ของเฟส 1 เป๊ะ ๆ นาฬิกากับ Scenario จะได้ไม่เถียงกัน
// 2) ความคลาดของการประเมินเวลา - สุ่มครั้งเดียว "ต่องานหนึ่งใบ"
//    งานใบเดียวไม่ได้บานเป็นบางช่วง มันบานทั้งใบ · ค่ากลางมาจาก durationStats ถ้ามี
const FOLLOW_SD = 0.18;
const BIAS_SD = 0.28;

// เวลาตั้งตัวตอนสลับวิชา - งานที่ต้องต่อความคิดแพงกว่างานที่หยิบมาทำต่อได้ทันที
// อยู่ในตัวจำลอง ไม่ได้อยู่ในฟังก์ชันความสูญเสีย โดยตั้งใจ:
// การสลับวิชาไม่ได้ "ผิด" มันแค่ "กินเวลา" - ให้มันกินเวลาจริงในแบบจำลอง
// แล้วผลเสียจะโผล่เองในรูปของงานที่ทำไม่ทัน ไม่ต้องมีใครตั้งค่าปรับ
const RAMP_DEEP = 12;
const RAMP_LIGHT = 6;
const DEEP_SUBJECTS = ['คณิตศาสตร์', 'ฟิสิกส์', 'เคมี', 'วิทยาการคำนวณ', 'ภาษาอังกฤษ'];

// ยืมเวลาจากการนอนได้ แต่ยืมได้ไม่เยอะและได้งานน้อยกว่าปกติ
// ต้องมีในแบบจำลอง เพราะเด็กทำจริง - แบบจำลองที่บอกว่า "หมดเวลาแล้วจบ" จะประเมิน
// ความเสียหายสูงเกินจริงทุกครั้งที่งานส่งเช้าวันรุ่งขึ้น
// ราคาของมันไปโผล่ที่ SleepDebt ใน loss.js ไม่ใช่ที่นี่
const NIGHT_BORROW_MAX = 90;
const NIGHT_BORROW_RATE = 0.55;

// ---------- เตรียมข้อมูลครั้งเดียว ใช้ซ้ำทุกเส้น ----------
// สร้างใหม่ทุกเส้นคือการเรียก freeSlots() หกร้อยรอบโดยได้คำตอบเดียวกันทุกรอบ
// ทุกอย่างในนี้เป็นตัวเลขล้วน ไม่มี Date - วนหกแสนรอบแล้วต่างกันชัดเจน
function simPrep(tasks, now = new Date(), opts = {}) {
  // opts.timeline เอาไว้ให้เครื่องมือทดสอบยัดตารางเวลาเข้ามาเองได้
  // ผลของ decide() จะได้ไม่ขึ้นกับว่าเครื่องที่รันตั้งตารางเรียนไว้ยังไง
  const timeline = opts.timeline || simTimeline(now, opts.days || 10);
  const stats = opts.stats || (typeof durationStats === 'function' && opts.state
    ? durationStats(opts.state) : null);
  const t0 = now.getTime();
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);

  const slots = timeline.map(s => ({
    from: (s.start - t0) / 60000,          // นาทีนับจาก "ตอนนี้"
    to: (s.end - t0) / 60000,
    min: s.min,
    day: Math.round((new Date(s.start).setHours(0, 0, 0, 0) - midnight.getTime()) / 864e5),
  }));

  const list = (tasks || []).filter(t => {
    if (!t || t.done || t.deleted || !t.due) return false;
    if (typeof TASK_TYPES === 'object' && typeof taskType === 'function') {
      return TASK_TYPES[taskType(t)].schedulable;
    }
    return true;
  });

  const items = list.map(t => {
    const subject = (t.subject || 'อื่น ๆ').trim();
    const s = stats && stats[subject];
    return {
      task: t,
      subject,
      type: typeof taskType === 'function' ? taskType(t) : 'homework',
      due: (new Date(t.due) - now) / 60000,           // นาทีจากตอนนี้ · ติดลบ = เลยกำหนด
      need: typeof remainingMin === 'function' ? remainingMin(t) : (t.estMin || 30),
      biasMean: s ? s.factor : 1,
      deep: DEEP_SUBJECTS.includes(subject),
      scorePct: t.scorePct,
      progress: t.progress || 0,
    };
  }).sort((a, b) => (a.due - b.due) || (a.need - b.need));

  // ความจุรายวัน - ใช้เป็นตัวหารของ StressCost ("วันนั้นแน่นแค่ไหน" ไม่ใช่ "ทำไปกี่นาที")
  const dayCap = {};
  for (const s of slots) dayCap[s.day] = (dayCap[s.day] || 0) + s.min;

  return { slots, items, dayCap, nowMs: t0 };
}

// ---------- เดินอนาคตหนึ่งเส้น ----------
// action บอกว่า "ช่วงเวลาถัดไปเอาไปทำอะไร" ซึ่งเป็นสิ่งเดียวที่ผู้ใช้ตัดสินใจได้จริงตอนนี้
//   {kind:'do', idx}          ทำงานใบนี้ก่อนในช่วงแรก
//   {kind:'delay', skipMin}   ไม่ทำอะไรไปอีกกี่นาที แล้วค่อยเริ่มตามปกติ
//   {kind:'free'}             ปล่อยให้ EDF จัดเอง (เส้นฐาน)
function simRollout(prep, seed, action) {
  const rnd = simRng(seed);
  const n = prep.items.length;
  if (!n) return { frac: [], dayLoad: {}, pastBed: 0 };

  // เวลาที่ต้องใช้จริงของแต่ละใบ - สุ่มครั้งเดียวต่อใบ ต่อหนึ่งเส้นอนาคต
  const need = new Array(n);
  for (let i = 0; i < n; i++) {
    need[i] = prep.items[i].need * simBell(rnd, prep.items[i].biasMean, BIAS_SD, 0.6, 2.2);
  }
  const left = need.slice();
  const dayLoad = {};
  let pastBed = 0;
  let lastSubj = null;

  const skipMin = action && action.kind === 'delay' ? action.skipMin : 0;
  const pinned = action && action.kind === 'do' ? action.idx : -1;
  let firstWorkingSlot = true;

  for (const slot of prep.slots) {
    if (slot.to <= skipMin) continue;                     // ช่วงนี้ถูกข้ามไปทั้งก้อน
    const startAt = Math.max(slot.from, skipMin);
    let room = (slot.to - startAt) * simBell(rnd, FOLLOW_RATE_PRIOR, FOLLOW_SD, 0.15, 1);
    if (room < 5) continue;

    // ลำดับในช่วงนี้: EDF ตามปกติ · ยกเว้นช่วงแรกที่ถูกตรึงด้วย action
    const order = [];
    for (let i = 0; i < n; i++) if (left[i] > 0 && prep.items[i].due > startAt) order.push(i);
    if (!order.length) continue;
    if (firstWorkingSlot && pinned >= 0 && left[pinned] > 0) {
      const at = order.indexOf(pinned);
      if (at > 0) { order.splice(at, 1); order.unshift(pinned); }
    }
    firstWorkingSlot = false;

    for (const i of order) {
      if (room < 5) break;
      const it = prep.items[i];
      if (it.due <= startAt) continue;
      if (lastSubj !== null && lastSubj !== it.subject) {
        room -= it.deep ? RAMP_DEEP : RAMP_LIGHT;
        if (room < 5) break;
      }
      lastSubj = it.subject;
      // ทำได้ไม่เกินเวลาที่เหลือในช่วง และไม่เกินเวลาที่เหลือก่อนกำหนดส่งของใบนั้น
      const untilDue = Math.max(0, it.due - startAt);
      const take = Math.min(left[i], room, untilDue);
      if (take <= 0) continue;
      left[i] -= take;
      room -= take;
      dayLoad[slot.day] = (dayLoad[slot.day] || 0) + take;
    }
  }

  // ---- ยืมเวลาจากการนอน ----
  // เฉพาะใบที่ยังไม่เสร็จ และไม่มีช่วงว่างเหลืออีกแล้วก่อนกำหนดส่ง (คือ "คืนนี้ต้องเสร็จ" จริง ๆ)
  let borrow = NIGHT_BORROW_MAX;
  for (let i = 0; i < n && borrow > 5; i++) {
    const it = prep.items[i];
    if (left[i] <= 0 || it.due <= 0) continue;
    if (prep.slots.some(s => s.from > 0 && s.from < it.due)) continue;
    const take = Math.min(left[i], borrow * NIGHT_BORROW_RATE);
    left[i] -= take;
    pastBed += take / NIGHT_BORROW_RATE;
    borrow -= take / NIGHT_BORROW_RATE;
  }

  // frac = ทำไปได้กี่ส่วนของงานทั้งใบ (0-1) · นี่คือสิ่งเดียวที่ loss.js ต้องรู้
  const frac = new Array(n);
  for (let i = 0; i < n; i++) frac[i] = need[i] <= 0 ? 1 : Math.max(0, 1 - left[i] / need[i]);
  return { frac, dayLoad, pastBed };
}
