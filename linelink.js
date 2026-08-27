// ============================================================
// linelink — ฝั่งแอปของการเชื่อม LINE  ·  *** ALT ***
// ------------------------------------------------------------
// แบ่งหน้าที่ชัดเจนกับฝั่งเซิร์ฟเวอร์:
//   Edge Function   หย่อนข้อความ "ดิบ" ลงตาราง inbox_items เฉย ๆ
//   ไฟล์นี้          ดึงของดิบมา แล้วส่งเข้า inboxAdd() ตัวเดิม
//
// ทำแบบนี้เพราะตรรกะการแกะ/จับซ้ำ/ให้คะแนนความมั่นใจ ควรมีที่เดียว
// ถ้าไปแกะฝั่งเซิร์ฟเวอร์ด้วย จะกลายเป็นสองชุดที่ต้องคอยดูแลให้ตรงกันตลอด
// ============================================================

function lineReady() { return !!(sb && currentUser); }

// ---------- ขอรหัสเชื่อม ----------
// รหัสสั้น อ่านออกเสียงได้ ไม่มีตัวที่สับสน (0/O, 1/I) เพราะต้องพิมพ์ในกลุ่มด้วยมือ
function makeLineCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return 'SOS-' + s;
}

let linkCode = null, linkTimer = null;

async function requestLineCode() {
  if (!lineReady()) {
    showToast({ title: 'ต้องล็อกอินก่อน', body: 'เชื่อม LINE ต้องรู้ว่าเป็นบัญชีใคร — ไปล็อกอินที่แท็บ “ฉัน” ก่อนนะ' });
    return;
  }
  const code = makeLineCode();
  const { error } = await sb.from('line_codes').insert({ code, user_id: currentUser.id });
  if (error) {
    showToast({ title: 'ขอรหัสไม่สำเร็จ', body: error.message });
    return;
  }
  linkCode = { code, at: Date.now() };
  renderAll();

  // เฝ้าดูว่ารหัสถูกใช้ไปหรือยัง — ถูกใช้แล้ว = เชื่อมสำเร็จ
  clearInterval(linkTimer);
  linkTimer = setInterval(checkLineLinked, 4000);
  setTimeout(() => { clearInterval(linkTimer); }, 60 * 60000); // ตรงกับอายุรหัสในฐานข้อมูล (1 ชม.)
}

async function checkLineLinked() {
  if (!lineReady() || !linkCode) return;
  const { data } = await sb.from('line_codes').select('code').eq('code', linkCode.code).maybeSingle();
  if (data) return;                       // ยังไม่มีใครใช้
  clearInterval(linkTimer);
  linkCode = null;

  // รหัสหายไปมีได้สองสาเหตุ — บอทใช้ไปแล้ว หรือหมดอายุแล้วถูกเก็บกวาดทิ้ง
  // ต้องดูว่ามีกลุ่มเพิ่มขึ้นจริงไหมก่อนถึงจะบอกว่าสำเร็จ
  // ไม่งั้นรหัสหมดอายุเฉย ๆ จะขึ้นว่า "เชื่อมสำเร็จ" ทั้งที่ไม่มีอะไรเชื่อมเลย
  const before = lineLinks.length;
  await loadLineLinks();
  renderAll();

  if (lineLinks.length > before) {
    // ขั้นที่ลึกที่สุดของกรวย — คนที่มาถึงตรงนี้คือคนที่แอปทำงานให้ได้จริงโดยเขาไม่ต้องพิมพ์
    if (typeof funnelMark === 'function') { funnelMark('lineLinkedAt'); save(); }
    showToast({ title: 'เชื่อมกลุ่ม LINE สำเร็จ 🎉',
      body: 'งานที่ครูสั่งในกลุ่มนั้นจะไหลเข้ากล่องเข้าให้เอง ไม่ต้องพิมพ์อีกแล้ว' });
    pullInbox();
  } else {
    showToast({ title: 'รหัสหมดอายุแล้ว',
      body: 'ยังไม่มีกลุ่มไหนใช้รหัสนี้ — กดขอรหัสใหม่แล้วพิมพ์ในกลุ่มได้เลย' });
  }
}

// ---------- กลุ่มที่เชื่อมไว้แล้ว ----------
let lineLinks = [];
async function loadLineLinks() {
  if (!lineReady()) { lineLinks = []; return; }
  const { data } = await sb.from('line_links').select('room_id, created_at').order('created_at');
  lineLinks = data || [];

  // รหัสที่ขอไว้แล้วยังไม่ได้ใช้ — เอากลับมาโชว์ ไม่ต้องให้จำเอง
  // (ปิดแอปไปแล้วเปิดใหม่ หรือสลับหน้าจอ ก็ยังเห็นรหัสเดิม)
  const { data: codes } = await sb.from('line_codes')
    .select('code, created_at').order('created_at', { ascending: false }).limit(1);
  const c = codes && codes[0];
  if (c) {
    linkCode = { code: c.code, at: new Date(c.created_at).getTime() };
    clearInterval(linkTimer);
    linkTimer = setInterval(checkLineLinked, 4000);
  } else {
    linkCode = null;
  }
}

// ทิ้งรหัสเดิมแล้วขอใหม่ — เผื่อพิมพ์ผิดจนสับสน อยากเริ่มใหม่ให้สะอาด
async function resetLineCode() {
  if (!lineReady()) return;
  if (linkCode) await sb.from('line_codes').delete().eq('code', linkCode.code);
  linkCode = null;
  await requestLineCode();
}

async function unlinkLineRoom(roomId) {
  if (!lineReady()) return;
  await sb.from('line_links').delete().eq('room_id', roomId);
  await loadLineLinks();
  renderAll();
  showToast({ title: 'เลิกเชื่อมกลุ่มนี้แล้ว', body: 'ข้อความจากกลุ่มนี้จะไม่เข้าแอปอีก' });
}

// ---------- ดึงของดิบเข้ากล่องเข้า ----------
// เรียกตอนเปิดแอปและทุกครั้งที่ซิงก์ — ของที่อ่านแล้วมาร์ค consumed กันดึงซ้ำ
async function pullInbox() {
  if (!lineReady()) return 0;
  const { data, error } = await sb.from('inbox_items')
    .select('id, source, raw, meta, created_at')
    .eq('consumed', false)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error || !data || !data.length) return 0;

  let added = 0;
  for (const row of data) {
    const r = inboxAdd(row.raw, row.source || 'line', row.meta || {});
    if (r.status === 'accepted' || r.status === 'pending') added++;
  }
  await sb.from('inbox_items').update({ consumed: true }).in('id', data.map(r => r.id));

  if (added) {
    renderAll();
    const wait = inboxPending().length;
    showToast({
      title: `มีของใหม่จากกลุ่ม LINE ${added} รายการ`,
      body: wait ? `เข้าแผนให้แล้วบางส่วน · เหลือ ${wait} รายการที่อยากให้คุณดูก่อน`
                 : 'AI มั่นใจพอ เลยเพิ่มเข้าแผนให้หมดแล้ว',
    });
  }
  return added;
}

// ---------- คอยดึงของใหม่ระหว่างที่แอปเปิดค้างอยู่ ----------
// เดิมดึงแค่ตอนเปิดแอป/ล็อกอินเท่านั้น — ครูสั่งงานตอนที่นักเรียนเปิดแอปค้างไว้อยู่แล้ว
// จะไม่มีอะไรเกิดขึ้นเลยจนกว่าจะปิดแล้วเปิดใหม่ ซึ่งพังทั้งแนวคิด "ไม่ต้องทำอะไรเลย"
// ถ้าต้องคอยรีเฟรชเอง ก็ไม่ต่างอะไรกับแอปที่ต้องกรอกเอง
const INBOX_POLL_MS = 45000;
let inboxPoll = null;

function startInboxPolling() {
  clearInterval(inboxPoll);
  // ถามเฉพาะตอนที่หน้าจอเปิดอยู่จริง — อยู่ในกระเป๋าแล้วยังยิงทุก 45 วิ คือกินแบตฟรี ๆ
  inboxPoll = setInterval(() => {
    if (document.visibilityState === 'visible') pullInbox();
  }, INBOX_POLL_MS);
}

// สลับจากแชทกลับมาที่แอป = จังหวะที่มีของใหม่รออยู่มากที่สุด
// ดึงทันทีเลย ไม่ต้องให้รอจนครบรอบถัดไป
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') pullInbox();
});

startInboxPolling();

// ---------- ส่วนที่แสดงในจอ "แหล่งข้อมูล" ----------
function lineLinkPanel() {
  if (!cloudConfigured()) {
    return `<div class="src-need">${icon('lock')}ยังไม่ได้ตั้งค่า Supabase — เชื่อม LINE ไม่ได้</div>`;
  }
  if (!currentUser) {
    return `<div class="src-need">${icon('lock')}ต้องล็อกอินก่อน เพราะระบบต้องรู้ว่ากลุ่มนี้ส่งงานให้ใคร</div>
      <button class="ib-go" style="margin-top:10px" onclick="go('scr-profile')">ไปล็อกอิน</button>`;
  }

  if (linkCode) {
    // รหัสมีอายุ 1 ชม. ตามที่ตั้งไว้ในฐานข้อมูล — บอกเวลาที่เหลือจริง ไม่ใช่เดา
    const leftMin = Math.max(0, 60 - Math.round((Date.now() - linkCode.at) / 60000));
    return `<div class="lk-code">
      <div class="lk-lb">พิมพ์รหัสนี้ในกลุ่มห้องเรียนที่มีบอทอยู่</div>
      <div class="lk-val">${esc(linkCode.code)}</div>
      <div class="lk-hint">${icon('clock')}${leftMin
        ? `รอบอทตอบกลับในกลุ่ม… รหัสใช้ได้อีก ${leftMin} นาที`
        : 'รหัสหมดอายุแล้ว กดขอใหม่ได้เลย'}</div>
      <button class="lk-new" onclick="resetLineCode()">${icon('pencil')}ขอรหัสใหม่</button>
    </div>`;
  }

  const rooms = lineLinks.length
    ? lineLinks.map((l, i) => `<div class="lk-room">
        <span class="lk-room-ic">${icon('chat')}</span>
        <span class="lk-room-bd"><span class="t">กลุ่มที่ ${i + 1}</span>
          <span class="s">${esc(String(l.room_id).slice(0, 10))}…</span></span>
        <button onclick="unlinkLineRoom('${esc(l.room_id)}')">เลิกเชื่อม</button>
      </div>`).join('')
    : '';

  return rooms + `<button class="ib-go" style="margin-top:10px" onclick="requestLineCode()">
      ${icon('chat')}${lineLinks.length ? 'เชื่อมกลุ่มเพิ่ม' : 'ขอรหัสเชื่อมกลุ่ม'}</button>`;
}
