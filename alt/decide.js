// ============================================================
// decide — "ทางไหนดีกว่ากันเท่าไหร่"  ·  *** ALT ***
// ------------------------------------------------------------
// ชั้นบนสุดของเอนจินตัดสินใจ · เปลี่ยนคำถามของแอปจาก
//
//     f(task) → score → เรียง → หัวแถวคือคำตอบ
// เป็น
//     argmin  E[Loss(อนาคต | ทำ a ในช่วงถัดไป)] + κ·σ
//
// ความต่างไม่ได้อยู่ที่สูตร แต่อยู่ที่ว่าคำตอบมี **ทางเลือกอื่นให้เทียบ** เป็นครั้งแรก
// เมื่อมีทางเลือกให้เทียบ คำอธิบายทั้งหกข้อก็เกิดขึ้นเองจากเลขคณิต ไม่ต้องเขียนเป็นเทมเพลต
// และคำอธิบายที่คำนวณมาจากคำตอบ จะไม่มีวันขัดกับคำตอบได้เลย ซึ่งเป็นบั๊กประเภทที่
// โปรเจกต์นี้เจอซ้ำมาตลอด (การ์ด "ควรทำก่อน" ชี้ไปคนละงานกับหน้าแผน)
// ============================================================

// ---------- จำนวนเส้นอนาคตที่เดิน ----------
// 120 เส้นน้อยกว่าที่ตำราแนะนำสำหรับ Monte Carlo ทั่วไปมาก และตั้งใจให้น้อย —
// เพราะทุกทางเลือกใช้ **เมล็ดสุ่มชุดเดียวกัน** (common random numbers)
// แปลว่าความต่างระหว่างทางเลือกมาจากการกระทำล้วน ๆ ไม่ได้มาจากความบังเอิญของการสุ่ม
// ซึ่งลดจำนวนเส้นที่ต้องใช้ลงมหาศาล · ถ้าวันไหนเผลอสุ่มคนละชุด ตัวเลขจะกระโดดทันที
const MC_RUNS = 120;

// เมล็ดตั้งต้น — ตายตัว ไม่ได้มาจากเวลา
// ผูกกับเวลาเมื่อไหร่ ตัวเลขบนการ์ดจะขยับเองทุกนาทีโดยที่ข้อมูลไม่ได้เปลี่ยนอะไรเลย
const MC_SEED = 0x5AF3;

// ---------- เกลียดความไม่แน่นอน ไม่ใช่แค่เกลียดค่าเฉลี่ยแย่ ----------
// เลือกด้วย mean + κ·sd ไม่ใช่ mean เฉย ๆ
// เด็กที่มีสอบ 30% รับหางความเสี่ยงไม่ไหว — สองทางที่ค่าเฉลี่ยเท่ากัน
// ต้องเลือกทางที่ผลลัพธ์แกว่งน้อยกว่าเสมอ · κ = 0.35 คือ "ยอมจ่ายค่าเฉลี่ยเพิ่มได้
// หนึ่งในสามของส่วนเบี่ยงเบน เพื่อแลกกับความแน่นอน"
const KAPPA = 0.35;

// ---------- ต่างกันน้อยกว่านี้ถือว่าเท่ากัน ----------
// argmin ล้วน ๆ เป็น UX ที่แย่: คำแนะนำจะสลับไปมาทุกนาทีเมื่อสองทางคะแนนไล่เลี่ยกัน
// และการสลับงานมีราคาจริงอยู่แล้ว (ตัวจำลองคิดเวลาตั้งตัวให้แล้ว)
// ต่ำกว่า 0.3 คะแนนเทอมจึงไม่ถือว่าเป็นเหตุผลให้เปลี่ยนใจ
const TIE_MARGIN = 0.3;

// ---------- ทางเลือกที่เอามาเทียบ ----------
// ไม่ได้เทียบทุกใบ เพราะไม่จำเป็นและช้า — เทียบเฉพาะใบที่มีเหตุผลคนละแบบกันจริง ๆ
// สี่ใบนี้คือสี่ "ทฤษฎี" ที่ต่างกันว่าอะไรควรมาก่อน แล้วปล่อยให้ตัวเลขตัดสินว่าใครถูก
function pickCandidates(prep, state, now, opts) {
  const out = [];
  const seen = new Set();

  // ---- งานที่ยังติดใบอื่นอยู่ ห้ามเสนอ (W5) ----
  // ตัวจำลองข้ามมันถูกอยู่แล้ว การตรึงมันเป็น action จึงไม่เกิดผลอะไร คะแนนเลยดูปกติ
  // แล้วเราก็เชียร์งานที่เจ้าตัวเปิดขึ้นมาแล้วเริ่มไม่ได้ — คำแนะนำที่ทำตามไม่ได้
  // แย่กว่าไม่แนะนำอะไรเลย เพราะมันสอนให้คนเลิกเชื่อการ์ดใบนั้น
  //
  // prep.items มีแต่งานที่ยังไม่เสร็จ · blocks ที่ยังชี้ถึงใครอยู่ = ใบนั้นยังไม่เสร็จ
  const ready = idx => idx != null && idx >= 0 && !(prep.items[idx].blocks || []).length;

  const add = (id, label, idx) => {
    if (!ready(idx) || seen.has(idx)) return;
    seen.add(idx);
    out.push({ id, label, idx, action: { kind: 'do', idx }, task: prep.items[idx].task });
  };

  // 0) ใบที่แอปกำลังแนะนำอยู่บนการ์ด "ตอนนี้"
  //
  // ข้อนี้ไม่ใช่ทฤษฎี แต่เป็นกฎ: จอนี้เปิดมาจากบรรทัด "ทำไมถึงเป็นใบนี้" บนการ์ดนั้น
  // ถ้าไม่เอาใบนั้นมาเทียบด้วย จอจะตอบคำถามของงานคนละใบกับที่ผู้ใช้กำลังมองอยู่
  // แล้วสองจอในแอปเดียวก็ชี้ไปคนละที่ — ซึ่งเป็นบั๊กที่ทั้งโปรเจกต์นี้พยายามเลิกทำมาตลอด
  // (เจอจริงตอนทำ 1B77: การ์ดหน้าแรกบอก "ใบงานบทที่ 3" จอนี้บอก "เริ่มฟิสิกส์")
  if (opts && opts.focusId != null) {
    add('focus', 'ใบที่แนะนำอยู่ตอนนี้', prep.items.findIndex(x => x.task.id === opts.focusId));
  }

  // 1) ใบที่เส้นตายใกล้ที่สุด — ทฤษฎีของตัวจัดแผนเดิม (EDF) · items เรียงมาแล้ว
  add('edf', 'ใบที่ใกล้กำหนดที่สุด', prep.items.length ? 0 : -1);

  // 2) ใบที่เสี่ยงพลาดที่สุดแต่ยังกู้ได้ — ทฤษฎี "ดับไฟก่อน"
  if (typeof riskReport === 'function') {
    const rep = riskReport(prep.items.map(x => x.task), now,
      { state, timeline: opts && opts.riskTimeline });
    const alive = rep.filter(r => !r.overdue && r.verdict !== 'safe' && r.pnrHard)
      .sort((a, b) => a.odds - b.odds)[0];
    if (alive) add('risk', 'ใบที่เสี่ยงพลาดที่สุด', prep.items.findIndex(x => x.task === alive.task));
  }

  // 3) ใบที่ใกล้เสร็จที่สุด — ทฤษฎี "ปิดให้จบ"
  // นี่คือทางที่แก้ W6 ให้ตัวเอง: เอนจินเดิมลงโทษความคืบหน้า เพราะให้คุณค่ากับ "นาทีที่เหลือ"
  // ส่วนที่นี่ให้คุณค่ากับ "คะแนนที่จะได้" — งานที่เหลือ 36 นาทีจาก 120 ซื้อคะแนนได้ทั้งก้อน
  let bestProg = -1, bestProgIdx = -1;
  for (let i = 0; i < prep.items.length; i++) {
    const p = prep.items[i].progress;
    if (p > 0 && p > bestProg) { bestProg = p; bestProgIdx = i; }
  }
  add('finish', 'ใบที่ใกล้เสร็จที่สุด', bestProgIdx);

  // 4) ใบที่เดิมพันสูงที่สุด — ทฤษฎี "ของแพงมาก่อน"
  //
  // ข้อนี้ขาดไม่ได้เด็ดขาด และเคยขาดไปจริงตอนเขียนรอบแรก: ถ้าไม่มี
  // "ใบงานการงาน 3% ส่งพรุ่งนี้" กับ "สอบฟิสิกส์ 30% อีกสี่วัน" จะไม่เคยถูกเอามาเทียบกันเลย
  // เพราะสอบยังไม่ด่วน ยังไม่เสี่ยง และยังไม่เคยถูกเลื่อน — ไม่ติดเกณฑ์ไหนข้างบนสักข้อ
  // ทั้งที่มันคือคำถามที่นักเรียนถามบ่อยที่สุดในชีวิตจริง
  let topW = -1, topWIdx = -1;
  for (let i = 0; i < prep.items.length; i++) {
    const w = prep.items[i].scorePct;
    if (w != null && w > topW) { topW = w; topWIdx = i; }
  }
  add('weight', 'ใบที่เดิมพันสูงที่สุด', topWIdx);

  // 5) ใบที่ถูกเลื่อนบ่อยที่สุด — ทฤษฎี "ของที่ติดอะไรอยู่"
  // การเลื่อนซ้ำ ๆ ไม่ใช่เรื่องวินัย มันคือสัญญาณว่างานใบนั้นติดอะไรบางอย่าง
  let bestSnooze = 0, snoozeIdx = -1;
  for (let i = 0; i < prep.items.length; i++) {
    const c = prep.items[i].task.snoozeCount || 0;
    if (c >= 2 && c > bestSnooze) { bestSnooze = c; snoozeIdx = i; }
  }
  add('stuck', 'ใบที่ถูกเลื่อนบ่อยที่สุด', snoozeIdx);

  // 6) เติมให้ครบอย่างน้อยสามทาง ตามลำดับเส้นตาย
  //
  // ห้าทฤษฎีข้างบนอาจชี้ไปที่ใบเดียวกันหมด แล้วเหลือทางเลือกทางเดียว —
  // ซึ่งแปลว่าการ์ด "ถ้าเลือกอีกใบ" ไม่มีอะไรจะเทียบ ทั้งที่บนจอมีงานอีกสี่ใบให้เลือกอยู่จริง
  // (วัดได้จริง: สี่ในหกเคสของ decidebench เหลือทางเดียวก่อนจะมีข้อนี้)
  //
  // เพดานสี่ทาง เพราะเกินจากนั้นได้คำตอบเพิ่มไม่คุ้มเวลาที่เสียไป —
  // และผู้ใช้อ่านการ์ดเทียบเกินสามใบไม่ไหวอยู่แล้ว
  for (let i = 0; i < prep.items.length && out.length < 3; i++) add('near', 'ใบถัดไปตามกำหนดส่ง', i);
  return out.slice(0, 4);
}

// ---------- เดินอนาคตทั้งชุดให้ทางเลือกหนึ่งทาง ----------
function evalAction(prep, action) {
  const losses = [];
  for (let i = 0; i < MC_RUNS; i++) {
    // เมล็ดขึ้นกับรอบที่เท่าไหร่เท่านั้น ไม่ขึ้นกับว่ากำลังประเมินทางไหนอยู่
    losses.push(lossOf(prep, simRollout(prep, MC_SEED + i * 2654435761, action)));
  }
  return lossSummary(prep, losses);
}

// ---------- ทางเข้าหลัก ----------
function decide(state, now = new Date(), opts = {}) {
  if (typeof simPrep !== 'function' || typeof lossOf !== 'function') return null;
  const tasks = (state.tasks || []).filter(t => !t.done && !t.deleted);
  const prep = simPrep(tasks, now, { state, timeline: opts.timeline });
  if (prep.items.length < 1) return null;

  const cands = pickCandidates(prep, state, now, opts);
  if (!cands.length) return null;

  const scen = [];
  for (const c of cands) {
    const s = evalAction(prep, c.action);
    scen.push({ ...c, sum: s, score: s.total + KAPPA * s.sd });
  }

  // ---- ทางเลือกที่ไม่ใช่ "ทำงานใบไหน" ----
  // สองอันนี้ทำให้เอนจินพูดสองประโยคที่ task manager ไม่มีวันพูด:
  // "เลื่อนไปอีกชั่วโมงราคาเท่านี้" และ "คืนนี้ไปนอนเถอะ"
  //
  // ระยะเลื่อนต้องคิดจากช่วงเวลาที่มีจริง ไม่ใช่ตั้งไว้ตายตัวที่ 3 ชม.
  // ตอนแรกตั้งตายตัวไว้ แล้วเจอว่าเย็นวันธรรมดามีเวลาว่าง 140 นาที — เลื่อน 3 ชม.
  // จึงข้ามทั้งเย็นไปเลย กลายเป็นอันเดียวกับ "พักคืนนี้" เป๊ะ ๆ ทั้งสองการ์ด
  // แล้วการ์ด B กับคำแนะนำเรื่องพักก็รายงานเลขเดียวกันโดยอ้างเหตุผลคนละอย่าง
  const firstSpan = prep.slots.length ? prep.slots[0].to - Math.max(0, prep.slots[0].from) : 180;
  const delayMin = Math.round(Math.min(180, Math.max(45, firstSpan / 2)));
  const delay = evalAction(prep, { kind: 'delay', skipMin: delayMin });

  // พักคืนนี้ = ข้ามช่วงว่างของ "วันนี้" ให้ครบทุกช่วง ไม่ใช่ข้ามไปกี่ชั่วโมง
  const todayEnd = prep.slots.filter(s => s.day === 0).reduce((a, s) => Math.max(a, s.to), 0);
  const restMin = Math.max(delayMin + 1, todayEnd);
  const rest = evalAction(prep, { kind: 'delay', skipMin: restMin });

  // ============================================================
  // ยอมทิ้งใบไหนดี — คำแนะนำที่ task manager ไม่มีวันให้
  // ============================================================
  // เมื่อเวลาไม่พอจริง ๆ ที่ปรึกษาตัวจริงไม่ได้บอกว่า "พยายามเข้านะ" — เขาบอกว่าควรปล่อยอะไร
  // ไม่มีแอปไหนกล้าแนะนำให้เลิกทำอะไร เพราะไม่มีแอปไหนมีหน่วยให้เทียบว่าอะไรแพงกว่ากัน
  //
  // เราตอบได้ เพราะทุกอย่างอยู่ในสกุลเดียวกันหมดแล้ว: ลองปล่อยใบนั้นดู
  // ถ้าเวลาที่มันคืนมาช่วยใบอื่นได้มากกว่าที่มันเสียไปเอง — นั่นคือคำตอบ
  //
  // คัดเฉพาะใบที่ "เสี่ยงหลุดอยู่แล้ว" มาลอง ไม่ใช่ลองทุกใบ:
  // การเสนอให้ทิ้งงานที่กำลังจะเสร็จอยู่แล้วเป็นคำแนะนำที่ผิดและน่าตกใจ
  const baseScore0 = Math.min.apply(null, scen.map(x => x.score));
  const baseSum = scen.reduce((a, x) => (x.score < a.score ? x : a), scen[0]).sum;
  const atRisk = prep.items
    .map((it, i) => ({ i, it, miss: baseSum.missP[i], w: it.scorePct == null ? 8 : it.scorePct }))
    .filter(x => x.miss >= 0.5)
    .sort((a, b) => (a.w - b.w) || (b.miss - a.miss))
    .slice(0, 2);

  let sacrifice = null;
  for (const c of atRisk) {
    const sum = evalAction(prep, { kind: 'drop', idx: c.i });
    const sc = sum.total + KAPPA * sum.sd;
    if (sc + TIE_MARGIN < baseScore0 && (!sacrifice || sc < sacrifice.score)) {
      sacrifice = { task: c.it.task, idx: c.i, sum, score: sc,
        saved: baseScore0 - sc, miss: c.miss };
    }
  }

  scen.sort((a, b) => a.score - b.score);
  const best = scen[0];
  const runnerUp = scen[1] || null;
  for (const s of scen) s.regret = s.score - best.score;

  // พักคืนนี้ชนะจริงเมื่อไหร่ ต้องกล้าพูด — แต่ต้องชนะแบบมีนัยสำคัญ ไม่ใช่ชนะเพราะเศษทศนิยม
  const restScore = rest.total + KAPPA * rest.sd;
  const restWins = restScore + TIE_MARGIN < best.score;

  // ภาษาไทยไม่เว้นวรรคระหว่างคำ — ใช้ตัวเดียวกับที่ engine.js ใช้ต่อประโยค
  // ("เริ่มที่ฟิสิกส์ก่อน" ถูก ส่วนชื่องานยาว ๆ ต้องมีอัญประกาศคั่นแทนการเว้นวรรค)
  const nm = t => (typeof taskPhrase === 'function' ? taskPhrase(t)
    : (t.subject || t.detail || 'งานนี้'));
  // ทศนิยมหนึ่งตำแหน่งเสมอ — "ขึ้นเป็น 2.4 (จาก 2)" อ่านแล้วเหมือนพิมพ์ตก
  const n1 = v => v.toFixed(1);
  const pct = v => Math.round(v * 100) + '%';
  const delayTx = delayMin >= 60 ? Math.round(delayMin / 60 * 10) / 10 + ' ชม.' : delayMin + ' นาที';

  // ---- งานที่ "โอกาสพลาด" ต่างกันมากที่สุดระหว่างทางที่แนะนำกับทางอื่น ----
  // ชื่อฟิลด์ต้องบอกชัดว่าตัวไหนของใคร · เคยตั้งชื่อว่า from/to แล้วสลับข้างกันเองตอนเขียนประโยค
  const missShift = other => prep.items.map((it, i) => ({
    i, task: it.task, best: best.sum.missP[i], other: other.missP[i],
    d: other.missP[i] - best.sum.missP[i],
  })).sort((x, y) => y.d - x.d);

  const vsDelay = missShift(delay)[0];
  const vsRunner = runnerUp ? missShift(runnerUp.sum)[0] : null;

  const risk = typeof riskOf === 'function' ? riskOf(best.task, tasks, now, { state }) : null;

  // สองทางที่ต่างกันน้อยกว่านี้ ไม่ควรประกาศว่ามีผู้ชนะ
  // ประกาศเมื่อไหร่ คำแนะนำจะสลับไปมาเองทุกนาทีตามเศษทศนิยม แล้วคนก็เลิกเชื่อทั้งระบบ
  const tie = !!runnerUp && runnerUp.regret < TIE_MARGIN;

  // ประกาศไว้ก่อน why เพราะทั้ง task และ instead ต้องอ่านจากตัวเดียวกัน
  const focusScen = (opts && opts.focusId != null)
    ? scen.find(x => x.task.id === opts.focusId) || null : null;
  const disagree = !!focusScen && focusScen !== best && focusScen.regret >= TIE_MARGIN;

  const why = {
    // เงื่อนไขต้องเป็น "มีงานใบเดียวจริง ๆ" ไม่ใช่ "หาทางเลือกมาเทียบได้ทางเดียว"
    // สองอย่างนี้ไม่เหมือนกัน และการเขียนสลับกันคือการโกหกต่อหน้าจอที่มีงานอีกสี่ใบอยู่
    // ไม่เห็นด้วยกับการ์ดหน้าแรกเมื่อไหร่ ต้องพูดเป็นอย่างแรก ไม่ใช่ซ่อนไว้ท้ายจอ
    task: disagree
      ? 'แผนวันนี้จัดคิวให้' + nm(focusScen.task) + 'ก่อน เพราะเส้นตายใกล้กว่า — '
        + 'แต่พอเดินอนาคตดูทั้งกอง ' + nm(best.task) + 'ให้ผลดีกว่า '
        + n1(focusScen.regret) + ' คะแนน'
      : !runnerUp
      ? (prep.items.length <= 1
          ? 'ตอนนี้มีงานใบเดียวที่ลงมือได้ ยังไม่มีทางเลือกอื่นให้เทียบ'
          : 'ใบอื่นยังไม่ถึงเวลาที่ต้องแย่งช่วงนี้ไป')
      : tie
        ? (runnerUp.regret < 0.05
            ? 'ทางนี้กับ' + nm(runnerUp.task) + 'ให้ผลเท่ากัน — เลือกใบไหนก่อนก็ได้ '
              + 'เวลาที่ใช้ตัดสินใจแพงกว่าผลต่างของสองทางนี้'
            : 'ทางนี้กับ' + nm(runnerUp.task) + 'แทบไม่ต่างกัน (ห่างกัน '
              + n1(runnerUp.regret) + ' คะแนน) — เลือกใบไหนก่อนก็ได้ อย่าเสียเวลาตัดสินใจ')
        : 'ลดความเสียหายที่คาดไว้ได้มากที่สุด — ดีกว่าทางรองลงมา '
          + n1(runnerUp.regret) + ' คะแนนของทั้งเทอม',

    now: risk && risk.pnr && typeof pnrText === 'function'
      ? pnrText(risk, now)
      : 'ช่วงนี้เป็นช่วงว่างที่ยาวที่สุดที่เหลืออยู่ก่อนกำหนดส่งใบนี้',

    // เลื่อนแล้วไม่ต่างก็ต้องบอกว่าไม่ต่าง — ห้ามเขียน "ขึ้นเป็น 0.3 (จาก 0.3)"
    // ซึ่งอ่านแล้วเหมือนแอปพัง และห้ามแต่งให้ดูน่ากลัวกว่าที่คำนวณได้ด้วย
    // "รอได้อีกชั่วโมงโดยไม่เสียอะไร" เป็นข้อมูลที่มีค่าพอ ๆ กับ "ต้องเริ่มเดี๋ยวนี้"
    delayed: (delay.total - best.sum.total < 0.15)
      ? 'เลื่อนไปอีก ' + delayTx + ' แทบไม่ต่าง (' + n1(delay.total) + ' คะแนน) — ยังทันสบาย'
      : 'เลื่อนไปอีก ' + delayTx + ' ความเสียหายที่คาดไว้ขึ้นเป็น ' + n1(delay.total)
        + ' คะแนน (จาก ' + n1(best.sum.total) + ')'
        + (vsDelay && vsDelay.d > 0.05
          ? ' · ' + nm(vsDelay.task) + 'โอกาสพลาดขึ้นจาก ' + pct(vsDelay.best)
            + ' เป็น ' + pct(vsDelay.other) : ''),

    // ห้ามพูดว่า "กันไม่ให้หลุด" ถ้าทางที่แนะนำก็ยังหลุดเกินครึ่ง
    // นั่นคือการรายงานชัยชนะที่ไม่ได้เกิดขึ้น และทำให้เด็กไม่ไปหาทางออกอื่นทั้งที่ยังมีเวลาหา
    // (บั๊กชนิดเดียวกับที่เฟส 1 เจอตอนตอบ "26%" ให้เรื่องที่เป็นไปไม่ได้)
    avoided: !vsDelay || vsDelay.d <= 0.05
      ? 'กันไม่ให้งานไปกองรวมกันในวันเดียวข้างหน้า'
      : best.sum.missP[vsDelay.i] < 0.5
        ? 'กัน' + nm(vsDelay.task) + 'ไม่ให้หลุด — เหลือโอกาสพลาด ' + pct(vsDelay.best)
          + ' แทนที่จะเป็น ' + pct(vsDelay.other) + ' ถ้าเลื่อน'
        : 'ลดความเสียหายของ' + nm(vsDelay.task) + 'ลงได้ (โอกาสพลาด ' + pct(vsDelay.other)
          + ' → ' + pct(vsDelay.best) + ') แต่ยังไม่ปลอดภัย — ควรหาทางยืมเวลาเพิ่มด้วย',

    opened: 'ความแน่นของวันข้างหน้าคิดเป็น ' + n1(best.sum.stress) + ' คะแนน'
      + (delay.stress > best.sum.stress + 0.1
        ? ' — น้อยกว่าทางที่เลื่อนอยู่ ' + n1(delay.stress - best.sum.stress) : '')
      + (best.sum.sleep > 0.1 ? ' · ยังต้องยืมเวลานอนอยู่บ้าง' : ' · ไม่ต้องยืมเวลานอน'),

    instead: disagree
      ? 'ย้ายไปเริ่ม' + nm(best.task) + 'แทนได้ — ลดความเสียหายที่คาดไว้ลง '
        + n1(focusScen.regret) + ' คะแนน · ' + nm(focusScen.task) + 'ยังมีคิวในวันถัดไป'
      : !runnerUp
      ? (prep.items.length <= 1 ? 'ยังไม่มีใบอื่นที่ลงมือได้ในช่วงนี้'
          : 'ใบอื่นเลื่อนไปทำวันหลังได้โดยไม่เสียอะไร')
      : runnerUp.regret < 0.05
        // ปัดแล้วเป็นศูนย์ = ไม่มีผลต่าง · เขียน "แพงกว่า 0 คะแนน" คือประโยคที่อ่านแล้วงง
        // และทำให้คนไม่เชื่อตัวเลขอื่นบนจอเดียวกันไปด้วย
        ? 'เลือก' + nm(runnerUp.task) + 'แทนก็ได้ผลเท่ากัน — ทั้งสองใบยังทันสบายทั้งคู่'
        : 'ถ้าเลือก' + nm(runnerUp.task) + 'แทน จะแพงกว่า ' + n1(runnerUp.regret) + ' คะแนน'
          + (vsRunner && vsRunner.d > 0.05
            ? ' — ' + nm(vsRunner.task) + 'โอกาสพลาดจะขึ้นเป็น ' + pct(vsRunner.other) : ''),
  };

  // ทางที่การ์ดหน้าแรกชี้อยู่ · null เมื่อผู้เรียกไม่ได้บอกมา
  const focus = (opts && opts.focusId != null)
    ? scen.find(x => x.task.id === opts.focusId) || null : null;
  // การจำลองไม่เห็นด้วยกับการ์ด และไม่เห็นด้วยแบบมีนัยสำคัญ — ต้องพูดออกมา ไม่ใช่กลบ
  const disagrees = !!focus && focus !== best && focus.regret >= TIE_MARGIN;

  // ============================================================
  // ซ้อมรับมือ — แผนนี้ทนความจริงได้แค่ไหน
  // ============================================================
  // รันทางที่แนะนำซ้ำ แต่ยัดเหตุร้ายเข้าไป · รายงานว่า "แพงขึ้นเท่าไหร่" ไม่ใช่แค่ "มีแผน"
  // แผนที่พังทันทีที่มีอะไรผิดนิดเดียว ควรถูกบอกตั้งแต่วันนี้ ตอนที่ยังเลือกได้ว่าจะเผื่ออะไร
  const hasPartner = prep.items.some(x => x.facts && x.facts.partnerDependent);
  const sick = evalAction(prep, { ...best.action, shock: { kind: 'sick', days: [1, 2] } });
  const partner = hasPartner
    ? evalAction(prep, { ...best.action, shock: { kind: 'partner', untilDay: 2 } }) : null;
  const fragile = {
    sick: { sum: sick, extra: sick.total - best.sum.total },
    partner: partner ? { sum: partner, extra: partner.total - best.sum.total } : null,
  };

  return {
    best, runnerUp, scenarios: scen, prep, tie, focus, disagrees, sacrifice, fragile,
    delay: { sum: delay, score: delay.total + KAPPA * delay.sd, min: delayMin },
    rest: { sum: rest, score: restScore, wins: restWins, skipMin: restMin },
    why, risk,
    // เส้นฐานเพื่อให้เทียบกับเอนจินเดิมได้เสมอ — ทางที่ EDF เลือกอยู่อันดับที่เท่าไหร่
    edfRank: scen.findIndex(s => s.id === 'edf'),
  };
}

// ---------- ประโยคของ "ยอมทิ้งใบไหน" ----------
// ต้องพูดให้ชัดว่านี่คือการเลือก ไม่ใช่การยอมแพ้ — และต้องบอกราคาของทั้งสองฝั่ง
// ไม่ใช่บอกแค่ฝั่งที่เราเชียร์ · คนจะทำตามคำแนะนำแบบนี้ได้ก็ต่อเมื่อเห็นตัวเลขครบ
function sacrificeText(d) {
  if (!d || !d.sacrifice) return null;
  const nm = t => (typeof taskPhrase === 'function' ? taskPhrase(t) : (t.subject || 'งานนี้'));
  const s = d.sacrifice;
  return 'เวลาที่เหลือไม่พอสำหรับทุกใบจริง ๆ — ถ้ายอมปล่อย' + nm(s.task)
    + ' (โอกาสทำไม่ทันอยู่ที่ ' + Math.round(s.miss * 100) + '% อยู่แล้ว) '
    + 'เวลาที่คืนมาจะช่วยใบที่เหลือได้ ' + (Math.round(s.saved * 10) / 10) + ' คะแนนของทั้งเทอม';
}

// ---------- ประโยคของ "ซ้อมรับมือ" ----------
// เงียบเมื่อแผนทนได้ — คำเตือนที่ขึ้นทุกวันคือคำเตือนที่ไม่มีใครอ่าน
function fragileText(d) {
  if (!d || !d.fragile) return null;
  const bits = [];
  const f = d.fragile;
  if (f.sick && f.sick.extra >= 1) {
    bits.push('ถ้าป่วยสองวัน ความเสียหายขึ้นอีก ' + (Math.round(f.sick.extra * 10) / 10) + ' คะแนน');
  }
  if (f.partner && f.partner.extra >= 1) {
    bits.push('ถ้าเพื่อนในกลุ่มส่งช้า ขึ้นอีก ' + (Math.round(f.partner.extra * 10) / 10) + ' คะแนน');
  }
  if (!bits.length) return null;
  return bits.join(' · ') + ' — เผื่อเวลาไว้ก่อนดีกว่า';
}

// ---------- แปลงเป็นสามการ์ด A / B / C ----------
// A = ทำตามคำแนะนำ · B = เลื่อนออกไป · C = ไปทำอีกใบ
// ตัวเลขบนการ์ดเป็นหน่วยเดียวกันทั้งสามใบเสมอ (คะแนนของทั้งเทอมที่คาดว่าจะเสีย)
// ห้ามเอาหน่วยอื่นมาปนแม้จะดูสวยกว่า — พอปนแล้วสามใบก็เทียบกันไม่ได้ ซึ่งเป็นจุดของมันทั้งหมด
function scenarioCards(d) {
  if (!d) return [];
  // ตัวเลขบนการ์ดสามใบต้องมีทศนิยมเท่ากันเสมอ ไม่งั้นตาเทียบความสูงของตัวเลขแทนค่าของมัน
  // ("2.2 / 3 / 2.3" อ่านผิดได้ทันที · "2.2 / 3.0 / 2.3" อ่านผิดไม่ได้)
  const n1 = v => v.toFixed(1);
  const label = t => (typeof taskLabel === 'function' ? taskLabel(t, 22)
    : (t.subject || t.detail || 'งานนี้'));

  // ป้ายต้องสั้นพอจะอยู่ในหนึ่งในสามของจอกว้าง 375px โดยไม่ถูกตัด
  // "A · ทำตามคำแนะนำ" ถูกตัดเป็น "A · ทำตามคำแน…" ซึ่งแย่กว่าคำสั้นที่อ่านจบ
  // รายละเอียดไปอยู่บรรทัดล่างของการ์ด (act) ซึ่งมีที่มากกว่า
  const dTx = d.delay.min >= 60 ? Math.round(d.delay.min / 60 * 10) / 10 + ' ชม.' : d.delay.min + ' นาที';
  // A = ใบที่ผู้ใช้เห็นอยู่บนการ์ดหน้าแรก (ถ้าผู้เรียกบอกมา) ไม่ใช่ใบที่ argmin เลือก
  // จอนี้เปิดมาเพื่อตอบว่า "ทำไมถึงเป็นใบนี้" — ใบนี้คือใบบนการ์ด
  // ถ้าการจำลองเห็นว่าอีกใบดีกว่า มันจะไปโผล่เป็นการ์ด C พร้อมตัวเลขที่ต่ำกว่า ซึ่งอ่านออกทันที
  const head = d.focus || d.best;
  const cards = [{
    id: 'A', kind: 'best', tone: d.disagrees ? 'flat' : 'good',
    tag: d.disagrees ? 'ที่แนะนำอยู่' : 'ทำตามนี้',
    act: 'เริ่ม' + label(head.task),
    loss: n1(head.sum.total),
    why: d.why.task,
  }, {
    id: 'B', kind: 'delay', tone: d.delay.sum.total - d.best.sum.total < 0.15 ? 'flat' : 'warn',
    tag: 'เลื่อน',
    act: 'รออีก ' + dTx,
    loss: n1(d.delay.sum.total),
    why: d.why.delayed,
  }];

  // C = ทางเลือกอื่นที่น่าสนใจที่สุด · เมื่อการจำลองไม่เห็นด้วยกับการ์ด อันนั้นคือ "ทางที่ดีกว่า"
  const alt = d.disagrees ? d.best : (d.runnerUp !== head ? d.runnerUp : null);
  if (alt) {
    // ผลเท่ากันต้องหน้าตาเท่ากัน — ทาสีเตือนให้ทางที่ดีพอ ๆ กัน คือการบอกข้อมูลที่ผิด
    // ด้วยสีทั้งที่ตัวเลขข้างบนมันบอกถูกอยู่แล้ว
    cards.push({
      id: 'C', kind: 'alt',
      tone: d.disagrees ? 'good' : d.tie ? 'good' : (alt.regret < 1 ? 'flat' : 'warn'),
      tag: d.disagrees ? 'ดีกว่า' : 'อีกใบ',
      act: 'เริ่ม' + label(alt.task),
      loss: n1(alt.sum.total),
      why: d.why.instead,
    });
  }
  return cards;
}
