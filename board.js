// ============================================================
// กระดานอันดับ — ใครทำงานเสร็จมากที่สุด (scr-board)
// ------------------------------------------------------------
// เจ้าของสั่ง (9 ต.ค. 69): "ทำเหมือนในเกม" พร้อมภาพอ้างอิง —
// แท่นสามอันดับบนสุด · การ์ดซีซัน (เป้าถัดไป · ช่วงซีซัน · นับถอยหลัง · รางวัล)
// · สลับกระดานหลัก/กระดานเพื่อน · รายชื่อที่เหลือเรียงลงมา
//
// ไม่อยู่บนหน้าแรก — หน้าแรกเต็มแล้ว และอันดับไม่ได้ตอบว่า "ตอนนี้ควรทำอะไร"
// ทางเข้าอยู่ในจอเพื่อน (การ์ดบนสุด) กับแท็บ "ฉัน"
//
// ตัวเลขทั้งหมดมาจาก board() บนเซิร์ฟเวอร์ (supabase/migrations/20261009120000_board.sql)
// ไม่คิดในเครื่อง — ตัวเลขของเราต้องเป็นตัวเดียวกับที่เพื่อนเห็น ไม่ใช่ใกล้เคียง
// ============================================================

// รางวัลท้ายซีซัน (เฉพาะกระดานหลัก) — กระดานเพื่อนไม่มี เพราะกลุ่มเพื่อนสามคนก็ได้ที่สามทุกคน
const BOARD_PRIZE = { 1: 300, 2: 200, 3: 100 };
const BOARD_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

let boardScope = 'all';                       // 'all' | 'friends'
const boardData = { all: null, friends: null };
const boardErr = { all: '', friends: '' };
let boardBack = 'scr-mates';
let boardLoading = false;

function openBoard(from) {
  // ผ่านจอยินยอมเดียวกับชั้นเพื่อนก่อน — กระดานคือการให้คนอื่นเห็นตัวเลขของเรา
  if (currentUser && typeof needsConsent === 'function' && needsConsent()) {
    go('scr-consent');
    if (typeof renderConsent === 'function') renderConsent();
    return;
  }
  boardBack = from || (typeof curScreen !== 'undefined' ? curScreen : 'scr-mates') || 'scr-mates';
  if (boardBack === 'scr-board') boardBack = 'scr-mates';
  go('scr-board');
  boardAnim = true;
  renderBoard();
  loadBoard();
}

async function loadBoard(scope) {
  scope = scope || boardScope;
  if (!sb || !currentUser || boardLoading) return;
  boardLoading = true;
  try {
    // ส่งงานล่าสุดขึ้นไปก่อน — เพิ่งติ๊กเสร็จแล้วเปิดกระดาน ต้องเห็นตัวเลขที่รวมใบนั้นแล้ว
    if (typeof pushToCloud === 'function') await Promise.race([
      pushToCloud(true), new Promise(r => setTimeout(r, 4000))]);
    const { data, error } = await sb.rpc('board', { p_scope: scope });
    if (error) throw error;
    boardData[scope] = data;
    boardErr[scope] = '';
    if (scope === 'all') boardPayout(data);
  } catch (e) {
    console.warn('[board]', e.message);
    boardErr[scope] = typeof rpcMissing === 'function' && rpcMissing(e) ? 'soon' : 'net';
  }
  boardLoading = false;
  if (curScreen === 'scr-board') renderBoard();
  paintBoardEntry();
  // สลับกระดานระหว่างที่อีกกระดานกำลังโหลด — คำขอรอบนั้นถูกข้ามไป ต้องตามเก็บตรงนี้
  if (curScreen === 'scr-board' && !boardData[boardScope] && !boardErr[boardScope]) loadBoard();
}

// จอเพื่อนเปิดเมื่อไหร่ โหลดกระดานหลักไว้เงียบ ๆ ครั้งเดียวต่อรอบเปิดแอป
// การ์ดทางเข้าจะได้บอกอันดับของเราได้เลย ไม่ใช่ป้ายเปล่า ๆ
let boardWarmed = false;
function boardWarm() {
  if (boardWarmed || !sb || !currentUser) return;
  boardWarmed = true;
  loadBoard('all');
}

// ---------- ช่วงเวลาของซีซัน ----------
function boardSeasonLabel(s) {
  if (!s) return '';
  const a = new Date(s.start + 'T00:00:00');
  const b = new Date(new Date(s.end + 'T00:00:00').getTime() - 864e5);
  return `${BOARD_MON[a.getMonth()]}–${BOARD_MON[b.getMonth()]} ${String((b.getFullYear() + 543) % 100).padStart(2, '0')}`;
}
function boardDaysLeft(s) {
  if (!s) return 0;
  return Math.max(0, Math.ceil((new Date(s.end + 'T00:00:00+07:00') - Date.now()) / 864e5));
}
function boardPrevKey(key) {
  const m = /^(\d{4})-Q([1-4])$/.exec(key || '');
  if (!m) return null;
  const y = +m[1], q = +m[2];
  return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
}

// ---------- รางวัลท้ายซีซัน ----------
// เช็คครั้งเดียวต่อซีซันที่จบไปแล้ว · ธงอยู่ใน state.settings จึงซิงก์ตามบัญชี
// (ลบแอปแล้วติดตั้งใหม่ต้องรับซ้ำไม่ได้)
async function boardPayout(cur) {
  const prev = boardPrevKey(cur && cur.season && cur.season.key);
  if (!prev || !state.settings || state.settings.boardPaid === prev) return;
  try {
    const { data, error } = await sb.rpc('board', { p_scope: 'all', p_season: prev });
    if (error || !data) return;
    state.settings.boardPaid = prev;
    const me = data.me;
    const prize = me && me.n > 0 && !data.hidden ? BOARD_PRIZE[me.rank] : 0;
    if (prize && typeof addTokens === 'function') {
      addTokens(prize);
      showToast({ title: `จบซีซันที่อันดับ ${me.rank}`, body: `+${prize} โทเคน` });
    }
    save();
  } catch (_) { /* ไม่ได้รอบนี้ เปิดกระดานครั้งหน้าค่อยเช็คใหม่ */ }
}

// ---------- ชื่อ / รูป ----------
function boardName(r) {
  const nm = (r.name || '').trim();
  const hd = (r.handle || '').trim();
  return nm || (hd ? '@' + hd : 'ไม่มีชื่อ');
}
function boardAv(r) {
  return typeof frAv === 'function'
    ? frAv({ id: r.id, avatar: r.avatar, display_name: r.name, handle: r.handle })
    : `<div class="fr-av">${esc(boardName(r).slice(0, 1))}</div>`;
}
function boardStreak(r) {
  return r.streak > 1 ? `<i class="bd-fire" title="ทำงานเสร็จติดกัน ${r.streak} วัน">${icon('flame')}${r.streak}</i>` : '';
}

// ---------- จอ ----------
// รอบที่สี่ (9 ต.ค. 69) · เจ้าของ: "ดีขึ้นนะ แต่ก็ยังไม่สวย ... เหมือนข้อความมันกระจัดกระจาย
// หรือองค์ประกอบแปลก ๆ อยู่" + ให้หยิบจากภาพอ้างอิงแรกมาใช้ได้
// สิ่งที่กระจัดกระจายในรอบก่อน และที่แก้:
//   · เลขอันดับโผล่สองที่ (เหรียญบนรูป + เลขบนแท่น) → เหลือที่เดียวคือเหรียญ
//   · คะแนนลอยแยกจากแท่น → คะแนนอยู่ "ในแท่น" แบบภาพอ้างอิง
//   · การ์ดของเรามีหกชิ้นแยกกัน (ป้าย · เลข · ชิป · ลู่วิ่ง · มาสคอต · ปุ่ม) → การ์ดเดียวแบบ
//     "การ์ดซีซัน" ของภาพอ้างอิง: เหรียญอันดับซ้าย · เป้าถัดไป + ซีซันกลาง · วงรางวัลขวา · แถบใต้
//   · แถวรายชื่อมีแถบเทียบและ "งาน" ซ้อนใต้ตัวเลข → แถวเรียบเท่ากันทุกแถว
// ลำดับ: แท่นสามอันดับก่อน (เรื่องหลักของกระดาน) → การ์ดของเรา → ที่เหลือ
let boardAnim = true;   // ไล่ขึ้นทีละชิ้นเฉพาะตอนเพิ่งเข้าจอ/สลับกระดาน ไม่ใช่ทุกครั้งที่วาดใหม่

function renderBoard() {
  const body = document.getElementById('boardBody');
  if (!body) return;
  const d = boardData[boardScope];
  const err = boardErr[boardScope];
  const isAll = boardScope === 'all';

  const head = `<div class="sticky-head row sh-inline">
      <div></div>
      <button class="sh-btn" onclick="go(boardBack)" aria-label="กลับ">
        <svg viewBox="0 0 24 24"><use href="#lu-chevron"/></svg></button>
    </div>
    <div class="page-head bd-head"><h1 class="page-title">อันดับ</h1></div>
    ${currentUser ? `<div class="bd-seg${isAll ? '' : ' r'}" role="tablist">
      <i class="bd-seg-k"></i>
      <button role="tab" aria-selected="${isAll}" class="${isAll ? 'on' : ''}" onclick="boardScopeSet('all')">ทั้งหมด</button>
      <button role="tab" aria-selected="${!isAll}" class="${isAll ? '' : 'on'}" onclick="boardScopeSet('friends')">เพื่อน</button>
    </div>` : ''}`;

  if (!sb || !currentUser) {
    body.innerHTML = head + `<div class="bd-gate">${icon('trophy')}
        <b>เข้าบัญชีก่อนถึงจะขึ้นกระดานได้</b>
        <button class="fr-gate-go" onclick="loginFromFriends()">เข้าสู่ระบบ</button></div>`;
    return;
  }
  if (!d) {
    body.innerHTML = head + (err
      ? `<div class="bd-gate">${icon('trophy')}<b>${err === 'soon' ? 'กระดานอันดับยังไม่เปิด' : 'โหลดไม่สำเร็จ'}</b>
          ${err === 'net' ? '<button class="fr-gate-go" onclick="loadBoard()">ลองใหม่</button>' : ''}</div>`
      : `<div class="bd-stage bd-skel"></div><div class="bd-mine bd-skel"></div>`);
    return;
  }

  const rows = d.rows || [];
  const me = d.me || { rank: 0, n: 0, pos: 0, streak: 0 };
  const rest = rows.filter(r => r.pos > 3);
  let i = 0;
  const step = () => `style="--i:${i++}"`;

  body.classList.toggle('bd-anim', boardAnim);
  boardAnim = false;
  body.innerHTML = head
    + boardStage(rows, step())
    + boardMine(d, me, rows, isAll, step())
    + (rest.length ? `<div class="bd-list">${boardList(rest, step)}</div>` : '')
    + (d.hidden ? '' : `<button class="bd-leave" onclick="boardToggleHide()">ซ่อนชื่อฉันจากกระดาน</button>`);
}

function boardScopeSet(scope) {
  if (scope === boardScope) return;
  boardScope = scope;
  boardAnim = true;
  renderBoard();
  if (!boardData[boardScope]) loadBoard();
}

// ---------- แท่นสามอันดับแรก ----------
// แต่ละคนมีสามอย่างเรียงลงมาเป็นแกนเดียว: รูป(+เหรียญ) → ชื่อ → แท่นที่มีคะแนนอยู่ข้างใน
function boardStage(rows, st) {
  const col = place => {
    const r = rows.find(x => x.pos === place);
    if (!r) return `<div class="bd-pc p${place} empty">
        <div class="bd-pc-av"><div class="fr-av"></div><i class="bd-medal">${place}</i></div>
        <div class="bd-pc-nm">ว่าง</div>
        <div class="bd-pc-base"><span class="bd-pc-sc">—</span></div></div>`;
    return `<div class="bd-pc p${place}${r.me ? ' me' : ''}">
        <div class="bd-pc-av">${place === 1 ? `<i class="bd-crown">${icon('crown')}</i>` : ''}${boardAv(r)}<i class="bd-medal">${r.rank}</i></div>
        <div class="bd-pc-nm">${r.me ? 'คุณ' : esc(boardName(r))}</div>
        <div class="bd-pc-base"><span class="bd-pc-sc"><b>${r.n}</b> งาน</span></div>
      </div>`;
  };
  // ฉากหลัง (แสงหมุน · ประกาย · แสงส่องที่ 1) กับพลุกระดาษ เป็นของตกแต่งล้วน — aria-hidden
  const confetti = Array.from({ length: 14 }, (_, k) =>
    `<i style="--x:${(k * 37) % 100}%;--d:${(k % 5) * 0.12}s;--r:${(k * 53) % 360}deg;--c:${k % 4}"></i>`).join('');
  return `<div class="bd-stage bd-in" ${st}>
      <i class="bd-rays" aria-hidden="true"></i><i class="bd-spark" aria-hidden="true"></i>
      <span class="bd-confetti" aria-hidden="true">${confetti}</span>
      ${col(2)}${col(1)}${col(3)}
    </div>`;
}

// ---------- การ์ดของเรา (ทรงการ์ดซีซันของภาพอ้างอิง) ----------
function boardMine(d, me, rows, isAll, st) {
  const above = rows.filter(r => r.pos < me.pos && r.n > me.n).pop();
  const below = rows.find(r => r.pos === me.pos + 1);
  let goal, pct;
  if (d.hidden) { goal = 'ชื่อคุณซ่อนอยู่'; pct = 0; }
  else if (!me.n) { goal = 'ทำงานเสร็จ 1 ใบ เพื่อขึ้นกระดาน'; pct = 0; }
  else if (above) { goal = `อีก ${above.n - me.n + 1} งาน แซง ${esc(boardName(above))}`; pct = me.n / (above.n + 1); }
  else if (below && below.n < me.n) { goal = `นำที่ ${below.rank} อยู่ ${me.n - below.n} งาน`; pct = 1; }
  else if (below) { goal = 'อีก 1 งาน ขึ้นนำคนเดียว'; pct = me.n / (me.n + 1); }
  else { goal = 'คุณนำอยู่'; pct = 1; }
  pct = Math.round(Math.max(0, Math.min(1, pct)) * 100);

  const top3 = isAll && me.n && me.rank <= 3 && !d.hidden;
  const prize = isAll ? (top3 ? BOARD_PRIZE[me.rank] : BOARD_PRIZE[3]) : 0;
  return `<div class="bd-mine bd-in${top3 ? ' top' : ''}" ${st}>
      <div class="bd-mine-row">
        <div class="bd-mine-rk"><small>อันดับ</small><b>${me.n && !d.hidden ? me.rank : '–'}</b></div>
        <div class="bd-mine-tx">
          <b>${goal}</b>
          <span>${boardSeasonLabel(d.season)} · เหลือ ${boardDaysLeft(d.season)} วัน${me.streak > 1 ? ` · <i title="ทำงานเสร็จติดกัน ${me.streak} วัน">${icon('flame')}${me.streak}</i>` : ''}</span>
        </div>
        ${prize ? `<div class="bd-mine-prize${top3 ? ' on' : ''}">${typeof coin === 'function' ? coin(20) : ''}<b>+${prize}</b>${top3 ? '' : '<small>ถ้าติด Top 3</small>'}</div>` : ''}
      </div>
      <div class="bd-mine-bar"><i style="width:${pct}%"></i></div>
      ${d.hidden ? `<button class="bd-join" onclick="boardToggleHide()">แสดงชื่อฉันบนกระดาน</button>` : ''}
    </div>`;
}

// ---------- ที่เหลือ — แถวเรียบเท่ากันทุกแถว ----------
function boardList(rest, step) {
  let out = '', prev = 3;
  for (const r of rest) {
    if (r.pos > prev + 1) out += `<div class="bd-gap" aria-hidden="true"><i></i><i></i><i></i></div>`;
    prev = r.pos;
    out += `<div class="bd-row bd-in${r.me ? ' me' : ''}" ${step()}>
        <span class="bd-rk">${r.rank}</span>
        <span class="bd-rav">${boardAv(r)}</span>
        <span class="bd-rnm">${r.me ? 'คุณ' : esc(boardName(r))}</span>
        ${boardStreak(r)}
        <span class="bd-rn"><b>${r.n}</b> งาน</span>
      </div>`;
  }
  return out;
}

// ซ่อน/แสดงตัว — ค่าเริ่มต้นคืออยู่บนกระดาน (เจ้าของเลือก 9 ต.ค. 69 · ดู 20261009190000_board_everyone.sql)
// รอบแรกเป็น "กดเข้าร่วมเอง" แล้วกระดานจริงมีแต่เจ้าของคนเดียว · ซ่อนแล้วหายจากทั้งสองกระดาน
// ธงอยู่ใน state.settings จึงขึ้น cloud ไปกับก้อนเดียวกับงาน — loadBoard ส่งขึ้นก่อนถามอันดับเสมอ
function boardToggleHide() {
  if (!state.settings) state.settings = {};
  const d = boardData[boardScope];
  state.settings.boardHide = !(d && d.hidden);
  delete state.settings.boardJoin;   // ธงของรอบแรก ไม่มีใครอ่านแล้ว
  save();
  boardData.all = null; boardData.friends = null;
  boardAnim = true;
  renderBoard();
  loadBoard();
}

// ---------- การ์ดทางเข้าในจอเพื่อน ----------
function boardEntryHTML() {
  const d = boardData.all;
  const me = d && d.me;
  return `<button class="bd-entry" onclick="openBoard('scr-mates')">
      <span class="bd-entry-ic">${icon('trophy')}</span>
      <span class="bd-entry-tx"><b>อันดับ</b>${
        me && me.n ? `<i>อันดับ ${me.rank} · ${me.n} งาน</i>` : ''}</span>
      ${icon('chevron')}
    </button>`;
}
// ป้ายบนปุ่มถ้วยหน้าแรก — "#3" เมื่อรู้อันดับแล้ว · ยังไม่รู้ = ป้าย "อันดับ" เฉย ๆ
function boardRankLabel() {
  if (!boardWarmed && typeof sb !== 'undefined' && sb && currentUser) setTimeout(boardWarm, 1500);
  const d = boardData.all;
  return d && d.me && d.me.n && !d.hidden ? '#' + d.me.rank : 'อันดับ';
}

function paintBoardEntry() {
  const th = document.getElementById('thRank');
  if (th) th.textContent = boardRankLabel();
  const el = document.getElementById('frBoardRow');
  if (el) el.innerHTML = boardEntryHTML();
  // แถว "อันดับ" ในแท็บ "ฉัน" — โชว์อันดับเมื่อเคยโหลดแล้วเท่านั้น ไม่เดา
  const v = document.getElementById('peBoardCt');
  const me = boardData.all && boardData.all.me;
  if (v) v.textContent = me && me.n ? 'อันดับ ' + me.rank : '';
}
