// ============================================================
// classroom — ดึงงานที่ครูมอบหมายจาก Google Classroom
// ------------------------------------------------------------
// ต่างจาก LINE ตรงที่ไม่ต้องมี Edge Function เลย เพราะ Classroom เป็น API ที่
// เรียกจากเบราว์เซอร์ตรง ๆ ได้ด้วย access token ของผู้ใช้เอง
//
//   1. ผู้ใช้กด "เชื่อม" -> ล็อกอิน Google อีกรอบ แต่ขอสิทธิ์อ่าน Classroom เพิ่ม
//   2. Supabase คืน provider_token (= access token ของ Google) มาให้ในเซสชัน
//   3. เอา token ยิง classroom.googleapis.com เอง แล้วส่งผลเข้า inboxAdd()
//
// ⚠️ provider_token ของ Supabase อยู่แค่ในเซสชันหลัง OAuth เท่านั้น
//    รีเฟรชหน้าแล้วมันหาย (Supabase ไม่เก็บให้) จึงต้องคว้าเก็บเองตอนได้มา
//    และมันหมดอายุใน ~1 ชม. — หมดแล้วต้องกดเชื่อมใหม่ ซึ่งเรายอมรับได้
//    เพราะการดึงงานเป็นเรื่องที่ทำเป็นครั้ง ๆ ไม่ใช่ทุกวินาที
//
// สิทธิ์ที่ขอเป็น readonly ทั้งหมด — แอปนี้อ่านอย่างเดียว ไม่เคยเขียนอะไรกลับ
// เข้า Classroom เลย ขอเท่าที่ใช้จริงเพราะหน้ายินยอมของ Google จะลิสต์ให้ผู้ใช้เห็นหมด
// ============================================================

const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
].join(' ');

const CR_TOKEN_KEY = 'studentos.alt.crToken';   // { token, exp }
const CR_LAST_KEY  = 'studentos.alt.crLastPull';

// ---------- โทเคน ----------
function crToken() {
  try {
    const raw = localStorage.getItem(CR_TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw);
    // เผื่อเวลาไว้ 2 นาที กันกรณีเรียกตอนใกล้หมดอายุพอดีแล้วพังกลางคัน
    if (!t.token || Date.now() > t.exp - 120000) return null;
    return t.token;
  } catch (_) { return null; }
}

function crSaveToken(token, expiresInSec) {
  try {
    localStorage.setItem(CR_TOKEN_KEY, JSON.stringify({
      token,
      exp: Date.now() + (expiresInSec || 3600) * 1000,
    }));
  } catch (_) {}
}

function crForget() {
  try { localStorage.removeItem(CR_TOKEN_KEY); localStorage.removeItem(CR_LAST_KEY); } catch (_) {}
  renderAll();
}

// เรียกตอนแอปเปิด/ล็อกอินเสร็จ — คว้า provider_token จากเซสชันก่อนที่มันจะหายไป
async function crCaptureToken(session) {
  if (!session || !session.provider_token) return;
  crSaveToken(session.provider_token, session.expires_in);
}

// ---------- เชื่อม ----------
function crConnect() {
  if (!cloudConfigured() || !sb) {
    showToast({ title: 'ยังเชื่อมไม่ได้', body: 'ต้องตั้งค่า Supabase ก่อน' });
    return;
  }
  // ขอสิทธิ์ Classroom เพิ่มจากบัญชีเดิม — ผู้ใช้จะเห็นหน้ายินยอมของ Google อีกรอบ
  // prompt=consent บังคับให้ถามใหม่ทุกครั้ง ไม่งั้น Google จะข้ามแล้วไม่ส่ง token กลับมา
  sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: CLASSROOM_SCOPES,
      redirectTo: location.origin + location.pathname,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
}

// ---------- ดึงข้อมูล ----------
async function crFetch(path) {
  const token = crToken();
  if (!token) throw new Error('NO_TOKEN');
  const r = await fetch('https://classroom.googleapis.com/v1/' + path, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (r.status === 401 || r.status === 403) {
    // 401 = โทเคนหมดอายุ · 403 = ยังไม่ได้อนุญาตสิทธิ์นั้น หรือยังไม่เปิด API ใน Cloud project
    const body = await r.text().catch(() => '');
    throw new Error(r.status === 401 ? 'EXPIRED' : 'FORBIDDEN:' + body.slice(0, 200));
  }
  if (!r.ok) throw new Error('HTTP_' + r.status);
  return r.json();
}

// แปลงงานหนึ่งชิ้นจาก Classroom เป็นข้อความไทยที่ parser ของเราอ่านออก
// จงใจไม่แกะเองตรงนี้ — ส่งเป็นข้อความให้ inboxAdd() แกะ จะได้มีตรรกะการอ่านชุดเดียว
// ทั้งแอป (เหมือนที่ทำกับ LINE) ไม่ต้องดูแลสองที่ให้ตรงกัน
function crWorkToText(work, courseName) {
  const parts = [courseName];
  if (work.title) parts.push(work.title);
  if (work.description) parts.push(String(work.description).slice(0, 160));

  const d = work.dueDate;
  if (d) {
    const t = work.dueTime;
    let due;
    if (t && (t.hours != null || t.minutes != null)) {
      // มีเวลากำหนดส่ง: Classroom ส่งมาเป็น UTC ต้องแปลงเป็นเวลาเครื่องก่อน
      // ใช้ ?? ไม่ใช่ || เพราะ 0 เป็นค่าที่ถูกต้อง (เที่ยงคืน / นาทีที่ 0)
      // เคยใช้ || แล้วเจอว่า "ส่ง 16:00 ตรง" กลายเป็น 16:59 และเที่ยงคืนเลื่อนไปอีกวัน
      due = new Date(Date.UTC(d.year, (d.month || 1) - 1, d.day || 1,
        t.hours ?? 0, t.minutes ?? 0));
    } else {
      // ไม่ระบุเวลา = ส่งภายในวันนั้น ซึ่งหมายถึงสิ้นวันตาม "เวลาเครื่องผู้ใช้"
      // ถ้าเอาไปตีเป็น UTC เหมือนกรณีบน วันที่จะเลื่อนไปอีกวันทันทีในไทย (+7)
      due = new Date(d.year, (d.month || 1) - 1, d.day || 1, 23, 59);
    }
    parts.push('ส่ง ' + due.getDate() + ' ' + MONTH_SHORT[due.getMonth()] +
      ' ' + String(due.getHours()).padStart(2, '0') + ':' +
      String(due.getMinutes()).padStart(2, '0'));
  }
  if (work.maxPoints) parts.push('คะแนน ' + work.maxPoints);
  return parts.filter(Boolean).join(' ');
}

let crBusy = false;

async function crPull(silent) {
  if (crBusy) return 0;
  if (!crToken()) { if (!silent) crConnect(); return 0; }
  crBusy = true;
  renderAll();
  try {
    const courses = (await crFetch('courses?courseStates=ACTIVE&pageSize=30')).courses || [];
    let added = 0, seen = 0;

    for (const c of courses) {
      let work = [];
      try {
        work = (await crFetch(
          `courses/${c.id}/courseWork?pageSize=30&orderBy=dueDate desc`)).courseWork || [];
      } catch (_) { continue; }   // บางวิชาครูปิดสิทธิ์ไว้ ข้ามไปวิชาถัดไป ไม่ต้องล้มทั้งรอบ

      for (const w of work) {
        if (w.state && w.state !== 'PUBLISHED') continue;
        seen++;
        const r = inboxAdd(crWorkToText(w, c.name || ''), 'classroom',
          { courseId: c.id, workId: w.id, link: w.alternateLink });
        if (r.status === 'accepted' || r.status === 'pending') added++;
      }
    }

    try { localStorage.setItem(CR_LAST_KEY, String(Date.now())); } catch (_) {}
    crBusy = false;
    renderAll();

    if (!silent) {
      const wait = inboxPending().length;
      showToast(added
        ? { title: `ดึงจาก Classroom ได้ ${added} งาน`,
            body: wait ? `เข้าแผนให้แล้วบางส่วน · เหลือ ${wait} รายการที่อยากให้คุณดูก่อน`
                       : 'AI มั่นใจพอ เลยเพิ่มเข้าแผนให้หมดแล้ว' }
        : { title: 'ไม่มีงานใหม่', body: `ดูแล้ว ${seen} งานจาก ${courses.length} วิชา — มีอยู่ในแอปครบแล้ว` });
    }
    return added;
  } catch (e) {
    crBusy = false;
    const msg = String(e.message || e);
    if (msg === 'NO_TOKEN' || msg === 'EXPIRED') {
      crForget();
      if (!silent) showToast({ title: 'ต้องเชื่อมใหม่', body: 'สิทธิ์เข้าถึงหมดอายุแล้ว — กดเชื่อมอีกครั้งได้เลย' });
    } else if (msg.startsWith('FORBIDDEN')) {
      if (!silent) showToast({
        title: 'Google ยังไม่อนุญาต',
        body: 'ตรวจว่าเปิด Classroom API ใน Cloud project แล้ว และใส่อีเมลนี้ใน Test users',
      });
    } else if (!silent) {
      showToast({ title: 'ดึงข้อมูลไม่สำเร็จ', body: msg });
    }
    renderAll();
    return 0;
  }
}

// ---------- ส่วนที่แสดงในจอ "แหล่งข้อมูล" ----------
function crPanel() {
  if (!cloudConfigured()) {
    return `<div class="src-need">${icon('lock')}ยังไม่ได้ตั้งค่า Supabase — เชื่อม Classroom ไม่ได้</div>`;
  }
  if (!currentUser) {
    return `<div class="src-need">${icon('lock')}ต้องล็อกอินก่อน เพราะต้องรู้ว่าดึงงานของใคร</div>
      <button class="ib-go" style="margin-top:10px" onclick="go('scr-profile')">ไปล็อกอิน</button>`;
  }

  if (!crToken()) {
    return `<button class="ib-go" style="margin-top:10px" onclick="crConnect()">
        ${icon('book')}เชื่อม Google Classroom</button>
      <p class="src-note">จะพาไปหน้ายินยอมของ Google — ขอสิทธิ์<b>อ่านอย่างเดียว</b>
        แอปไม่เคยเขียนอะไรกลับเข้า Classroom</p>`;
  }

  const last = Number(localStorage.getItem(CR_LAST_KEY) || 0);
  const ago = last ? Math.round((Date.now() - last) / 60000) : null;
  return `<div class="cr-on">
      <span class="cr-dot"></span>เชื่อมแล้ว${ago != null
        ? ` · ดึงล่าสุด ${ago < 1 ? 'เมื่อสักครู่' : ago < 60 ? ago + ' นาทีก่อน'
            : Math.round(ago / 60) + ' ชม.ก่อน'}` : ''}
    </div>
    <div class="cr-act">
      <button class="ib-go" onclick="crPull()" ${crBusy ? 'disabled' : ''}>
        ${crBusy ? 'กำลังดึง…' : 'ดึงงานตอนนี้'}</button>
      <button class="cr-off" onclick="crForget()">เลิกเชื่อม</button>
    </div>`;
}
