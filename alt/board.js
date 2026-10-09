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
// 9 ต.ค. 69 · แบบ A "ตัวเราก่อน" ที่เจ้าของเลือก — รอบแรกลอกฉากเกาะลอยจากภาพอ้างอิง
// ถูกตีกลับว่า "ไม่สวยเลย อย่าก็อป" · รอบสองแบน ๆ ถูกขอ "สวยกว่านี้" → รอบนี้
// ลำดับบนจอ = ลำดับความสำคัญของคนที่เปิดจอ:
//   1) เราอยู่ตรงไหน และอีกกี่งานถึงจะแซงใคร (ลู่วิ่ง: รูปเราไล่ตามรูปเขา)
//   2) แท่นสามอันดับแรก — เป้าที่ไกลกว่า
//   3) ที่เหลือ พร้อมแถบเทียบกับที่ 1
// สีมาจากโทเคนของธีมทั้งหมด ยกเว้นสีเหรียญเงิน/ทองแดง (ทองใช้ --gold ของแอป)
let boardAnim = true;   // ไล่ขึ้นทีละชิ้นเฉพาะตอนเพิ่งเข้าจอ/สลับกระดาน ไม่ใช่ทุกครั้งที่วาดใหม่

function renderBoard() {
  const body = document.getElementById('boardBody');
  if (!body) return;
  const d = boardData[boardScope];
  const err = boardErr[boardScope];
  const isAll = boardScope === 'all';

  // 11 ต.ค. 69 · ลำดับสายตา (เจ้าของ: "ยังจัดลำดับสายตาผิดทั้งหมด ... ข้อความอื่น ๆ ด้วย")
  //   1) แท่นสามอันดับ: รูป(+ช่อ) → คะแนน → ชื่อ
  //   2) เป้าถัดไปของเรา "อีก 2 งาน แซง ต้นกล้า"
  //   3) อันดับของเรา
  //   4) ที่เหลือ
  //   5) ข้อมูลประกอบ (ซีซัน · วันที่เหลือ · วันติด) — ตัวเล็กสีจาง อยู่บรรทัดเดียวในการ์ดเรา
  // หัวจอเหลือชื่อจอกับตัวสลับ — เดิมวันที่ซีซันอยู่เหนือชื่อจอ ตาจึงอ่านวันที่ก่อนทุกอย่าง
  const head = `<div class="sticky-head row sh-inline">
      <div></div>
      <button class="sh-btn" onclick="go(boardBack)" aria-label="กลับ">
        <svg viewBox="0 0 24 24"><use href="#lu-chevron"/></svg></button>
    </div>
    <div class="page-head"><h1 class="page-title">อันดับ</h1></div>
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
      : `<div class="bd-podium bd-skel"></div><div class="bd-me bd-skel"></div>`);
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
    + boardPodium(rows, step())
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

// ---------- การ์ดของเรา ----------
// สามบรรทัด ลำดับชัด: เป้าถัดไป (ใหญ่สุด) → ลู่วิ่ง (รูปเราไล่รูปเขา) → ข้อมูลประกอบ (เล็กจาง)
// อันดับของเราอยู่ในป้ายกลมทางซ้าย · ถอดน้องฮูก เลขจางตัวโต และชิปออก — แย่งสายตากันเอง
function boardMine(d, me, rows, isAll, st) {
  const mine = rows.find(r => r.me) || { id: 'me', name: 'คุณ' };
  const above = rows.filter(r => r.pos < me.pos && r.n > me.n).pop();
  const below = rows.find(r => r.pos === me.pos + 1);
  let goal, pct, target = null;
  if (d.hidden) { goal = 'ชื่อคุณซ่อนอยู่'; pct = 0; }
  else if (!me.n) { goal = 'ทำงานเสร็จ 1 ใบ เพื่อขึ้นกระดาน'; pct = 0; }
  else if (above) {
    goal = `อีก ${above.n - me.n + 1} งาน แซง ${esc(boardName(above))}`;
    pct = me.n / (above.n + 1); target = above;
  } else if (below && below.n < me.n) { goal = `นำที่ ${below.rank} อยู่ ${me.n - below.n} งาน`; pct = 1; }
  else if (below) { goal = 'อีก 1 งาน ขึ้นนำคนเดียว'; pct = me.n / (me.n + 1); }
  else { goal = 'คุณนำอยู่'; pct = 1; }
  pct = Math.round(Math.max(0, Math.min(1, pct)) * 100);

  const prize = isAll && me.n && !d.hidden ? (BOARD_PRIZE[me.rank] || 0) : 0;
  const meta = [
    me.n ? `${me.n} งาน` : '',
    me.streak > 1 ? `${icon('flame')}${me.streak} วันติด` : '',
    `เหลือ ${boardDaysLeft(d.season)} วัน`,
  ].filter(Boolean).join('<i class="bd-dot"></i>');
  return `<div class="bd-me bd-in" ${st}>
      <div class="bd-me-hd">
        <div class="bd-me-rk${prize ? ' gold' : ''}"><b>${me.n && !d.hidden ? me.rank : '–'}</b><small>${me.n && !d.hidden ? 'จาก ' + d.total : 'อันดับ'}</small></div>
        <div class="bd-me-goal">${goal}</div>
        ${prize ? `<span class="bd-me-prize">${typeof coin === 'function' ? coin(16) : ''}+${prize}</span>` : ''}
      </div>
      <div class="bd-race-track">
        <i class="bd-race-fill" style="width:${pct}%"></i>
        <span class="bd-race-me" style="left:${pct}%">${boardAv(mine)}</span>
        ${target ? `<span class="bd-race-tg">${boardAv(target)}</span>` : `<span class="bd-race-flag">${icon('flag')}</span>`}
      </div>
      <div class="bd-me-meta">${meta}</div>
      ${d.hidden ? `<button class="bd-join" onclick="boardToggleHide()">แสดงชื่อฉันบนกระดาน</button>` : ''}
    </div>`;
}

// ---------- ช่อมะกอกรอบรูปสามอันดับแรก ----------
// เจ้าของชอบ "กรอบรูปคนหรู ๆ" ในภาพอ้างอิง (11 ต.ค. 69) — ช่อใบไม้โลหะสองข้างเป็นของรางวัล
// ที่คนเข้าใจทันทีโดยไม่ต้องมีภาพวาดของใคร · ใบคำนวณตามวงกลม ไม่ได้วาดมือทีละใบ
const BOARD_METAL = { 1: ['#FFF0B8', '#E9B93C', '#9C6C0E'], 2: ['#FFFFFF', '#C3CCDB', '#7D889C'], 3: ['#FBE0CB', '#D8935F', '#8E4E22'] };
function boardLaurel(place) {
  const [hi, mid, lo] = BOARD_METAL[place];
  const g = 'bdlf' + place;
  let leaves = '';
  for (const side of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const a = (side < 0 ? 100 + k * 19 : 80 - k * 19) * Math.PI / 180;
      const x = 50 + 41 * Math.cos(a), y = 50 + 41 * Math.sin(a);
      const rot = (Math.atan2(Math.sin(a), Math.cos(a)) * 180 / Math.PI) + 90 + side * 28;
      const sz = 1 - k * 0.06;
      leaves += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(7.5 * sz).toFixed(1)}" ry="${(3.2 * sz).toFixed(1)}"
        transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#${g})"/>`;
    }
  }
  return `<svg class="bd-laurel" viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/>
    </linearGradient></defs>${leaves}</svg>`;
}

// ---------- แท่นสามอันดับแรก ----------
// ที่ 1 กลาง สูงสุด · ทองของแอปใช้เฉพาะที่ 1 (ทอง = สำเร็จแล้ว) · ที่ 2 เงิน · ที่ 3 ทองแดง
function boardPodium(rows, st) {
  // รูป(+ช่อ) → คะแนน (ตัวหนา) → ชื่อ (เล็กจาง) → แท่นเปล่า · เลขอันดับเหลือที่เดียวคือเหรียญใต้รูป
  // (เดิมมีเลขตัวโตจาง ๆ บนแท่นอีกชุด ตาไปจับเลขนั้นก่อนคะแนน)
  const col = place => {
    const r = rows.find(x => x.pos === place);
    if (!r) return `<div class="bd-pc p${place} empty">
        <div class="bd-pc-av"><div class="fr-av"></div><i class="bd-medal">${place}</i></div>
        <div class="bd-pc-n">&nbsp;</div><div class="bd-pc-nm">ว่าง</div>
        <div class="bd-pc-base"></div></div>`;
    return `<div class="bd-pc p${place}${r.me ? ' me' : ''}">
        <div class="bd-pc-av">${boardLaurel(place)}<i class="bd-ring" aria-hidden="true"></i>${place === 1 ? `<i class="bd-crown">${icon('crown')}</i>` : ''}${boardAv(r)}<i class="bd-medal">${r.rank}</i>${boardStreak(r)}</div>
        <div class="bd-pc-n"><b>${r.n}</b> งาน</div>
        <div class="bd-pc-nm">${r.me ? 'คุณ' : esc(boardName(r))}</div>
        <div class="bd-pc-base"></div>
      </div>`;
  };
  return `<div class="bd-podium bd-in" ${st}>${col(2)}${col(1)}${col(3)}</div>`;
}

// ---------- ที่เหลือ ----------
function boardList(rest, step) {
  // แถวเดียวจบ: อันดับ · รูป · ชื่อ · วันติด · คะแนน — ไม่มีแถบเทียบ ไม่มี "งาน" ซ้อนใต้ตัวเลข
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
