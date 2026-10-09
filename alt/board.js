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
// รอบที่ห้า (9 ต.ค. 69) · เจ้าของ: "ยังไม่ชอบ ลองวิเคราะห์จากรูปนี้แล้วดูของเราว่าต่างกันยังไง"
// สิ่งที่ภาพอ้างอิงทำแล้วของเราไม่ได้ทำ (และรอบนี้ทำตาม — โดยไม่ลอกภาพของเขา):
//   1) ภาพประกอบครองครึ่งบนของจอ → น้องฮูกถือถ้วยทองบนที่ 1 · ถ้วยเงิน/ทองแดง (SVG) บนที่ 2–3
//      เจ้าของเลือก "น้องฮูกถือถ้วย" · ใช้มาสคอตที่ผู้ใช้เลือกไว้ (synBody)
//   2) เป็น "ฉาก" เต็มขอบจอ ไม่ใช่การ์ดในหน้า → พื้นไล่สีทั้งหัวจอ แผ่นรายชื่อโค้งขึ้นมาทับจากล่าง
//   3) สีชุดเดียวทั้งจอ → ทุกอย่างผสมจากสีหลักของธีม ทองเหลือแค่ที่ 1 กับรางวัล
//   4) ทุกชิ้นทรงแคปซูลเดียวกัน
//   5) คะแนนเด่นสุด · อันดับเป็นฟองเล็กที่มุม · รูปกับชื่อเล็กอยู่ใต้ภาพ
// หัวข้อใหญ่ "อันดับ" ถูกถอด — ชื่อกระดานอยู่ในการ์ดซีซันแทน (แบบภาพอ้างอิง) ฉากจะได้เริ่มจากบนสุด
let boardAnim = true;   // ไล่ขึ้นทีละชิ้นเฉพาะตอนเพิ่งเข้าจอ/สลับกระดาน ไม่ใช่ทุกครั้งที่วาดใหม่

function renderBoard() {
  const body = document.getElementById('boardBody');
  if (!body) return;
  const d = boardData[boardScope];
  const err = boardErr[boardScope];
  const isAll = boardScope === 'all';

  const head = `<div class="bd-top">
      <button class="sh-btn" onclick="go(boardBack)" aria-label="กลับ">
        <svg viewBox="0 0 24 24"><use href="#lu-chevron"/></svg></button>
      ${currentUser ? `<button class="bd-swap" onclick="boardScopeSet('${isAll ? 'friends' : 'all'}')">${
        isAll ? `${icon('users')}กระดานเพื่อน` : `${icon('trophy')}กระดานหลัก`}</button>` : ''}
    </div>`;

  if (!sb || !currentUser) {
    body.innerHTML = head + `<div class="bd-sheet"><div class="bd-gate">${icon('trophy')}
        <b>เข้าบัญชีก่อนถึงจะขึ้นกระดานได้</b>
        <button class="fr-gate-go" onclick="loginFromFriends()">เข้าสู่ระบบ</button></div></div>`;
    return;
  }
  if (!d) {
    body.innerHTML = head + (err
      ? `<div class="bd-sheet"><div class="bd-gate">${icon('trophy')}<b>${err === 'soon' ? 'กระดานอันดับยังไม่เปิด' : 'โหลดไม่สำเร็จ'}</b>
          ${err === 'net' ? '<button class="fr-gate-go" onclick="loadBoard()">ลองใหม่</button>' : ''}</div></div>`
      : `<div class="bd-scene bd-skel"></div><div class="bd-sheet"><div class="bd-season bd-skel"></div></div>`);
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
    + boardScene(rows)
    + `<div class="bd-sheet">
        ${boardSeason(d, me, rows, isAll, step())}
        ${rest.length ? `<div class="bd-list">${boardList(rest, step)}</div>` : ''}
        ${d.hidden ? '' : `<button class="bd-leave" onclick="boardToggleHide()">ซ่อนชื่อฉันจากกระดาน</button>`}
      </div>`;
}

function boardScopeSet(scope) {
  if (scope === boardScope) return;
  boardScope = scope;
  boardAnim = true;
  renderBoard();
  if (!boardData[boardScope]) loadBoard();
}

// ---------- ถ้วยรางวัล (SVG) ----------
// วาดเองทั้งใบ ไม่ใช้ไอคอนเส้น — ถ้วยต้องมีเนื้อ มีแสง มีเงา ถึงจะเป็น "ภาพ" ไม่ใช่ "ไอคอน"
const BOARD_CUP = {
  1: ['#FFF3C4', '#F5C542', '#B7811A'],
  2: ['#FFFFFF', '#C9D2E3', '#8592AA'],
  3: ['#FCE3CF', '#E0A271', '#9C5A2C'],
};
function boardTrophy(place) {
  const [hi, mid, lo] = BOARD_CUP[place];
  const g = 'bdcup' + place;
  return `<svg class="bd-cup" viewBox="0 0 64 76" aria-hidden="true">
    <defs>
      <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${mid}"/><stop offset=".35" stop-color="${hi}"/>
        <stop offset=".7" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/>
      </linearGradient>
      <linearGradient id="${g}b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/>
      </linearGradient>
    </defs>
    <path d="M15 12H8.5a5.5 5.5 0 0 0 0 11c3.4 0 6.3-1.4 8.2-3.6M49 12h6.5a5.5 5.5 0 0 1 0 11c-3.4 0-6.3-1.4-8.2-3.6"
      fill="none" stroke="${lo}" stroke-width="4" stroke-linecap="round"/>
    <path d="M13 6h38v15c0 11.6-8.5 21-19 21S13 32.6 13 21z" fill="url(#${g})"/>
    <path d="M13 6h38v4H13z" fill="${lo}" opacity=".25"/>
    <path d="M19 11c0 10 3 17 8 21" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>
    <path d="M32 15.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" fill="#fff" opacity=".85"/>
    <rect x="28" y="41" width="8" height="10" fill="url(#${g}b)"/>
    <rect x="19" y="51" width="26" height="8" rx="3" fill="url(#${g})"/>
    <rect x="14" y="59" width="36" height="11" rx="4" fill="url(#${g}b)"/>
    <rect x="24" y="62.5" width="16" height="4" rx="2" fill="#fff" opacity=".45"/>
  </svg>`;
}

// ---------- ฉาก: สามอันดับแรก ----------
// แต่ละคน: ภาพ (มาสคอต/ถ้วย) → ป้ายคะแนนทับขอบล่างของภาพ → รูปคนเล็ก → ชื่อ · อันดับเป็นฟองที่มุมภาพ
function boardScene(rows) {
  const pet = typeof synBody === 'function' ? synBody() : '';
  const col = place => {
    const r = rows.find(x => x.pos === place);
    const art = place === 1 && pet
      ? `<img class="bd-pet" src="${pet}" alt="" aria-hidden="true">${boardTrophy(1)}`
      : boardTrophy(place);
    return `<div class="bd-pc p${place}${r ? '' : ' empty'}${r && r.me ? ' me' : ''}">
        <div class="bd-art">
          <i class="bd-glow" aria-hidden="true"></i>
          ${art}
          <i class="bd-disc" aria-hidden="true"></i>
          <span class="bd-place">${r ? r.rank : place}</span>
          <span class="bd-score">${r ? `<b>${r.n}</b> งาน` : 'ว่าง'}</span>
        </div>
        ${r ? `<div class="bd-who">${boardAv(r)}${boardStreak(r)}</div>
        <div class="bd-pc-nm">${r.me ? 'คุณ' : esc(boardName(r))}</div>` : '<div class="bd-who"></div><div class="bd-pc-nm">&nbsp;</div>'}
      </div>`;
  };
  const confetti = Array.from({ length: 14 }, (_, k) =>
    `<i style="--x:${(k * 37) % 100}%;--d:${(k % 5) * 0.12}s;--r:${(k * 53) % 360}deg"></i>`).join('');
  return `<div class="bd-scene">
      <span class="bd-confetti" aria-hidden="true">${confetti}</span>
      ${col(2)}${col(1)}${col(3)}
    </div>`;
}

// ---------- การ์ดซีซัน (ทรงเดียวกับการ์ด "กระดานหลัก" ของภาพอ้างอิง) ----------
function boardSeason(d, me, rows, isAll, st) {
  const above = rows.filter(r => r.pos < me.pos && r.n > me.n).pop();
  const below = rows.find(r => r.pos === me.pos + 1);
  let goal;
  if (d.hidden) goal = 'ชื่อคุณซ่อนอยู่';
  else if (!me.n) goal = 'ทำงานเสร็จ 1 ใบ → ขึ้นกระดาน';
  else if (above) goal = `อีก ${above.n - me.n + 1} งาน → แซง ${esc(boardName(above))}`;
  else if (below && below.n < me.n) goal = `นำที่ ${below.rank} อยู่ ${me.n - below.n} งาน`;
  else if (below) goal = 'อีก 1 งาน → ขึ้นนำคนเดียว';
  else goal = 'คุณนำอยู่';

  const top3 = isAll && me.n && me.rank <= 3 && !d.hidden;
  const prize = isAll ? (top3 ? BOARD_PRIZE[me.rank] : BOARD_PRIZE[3]) : 0;
  const rankTx = me.n && !d.hidden ? `อันดับ ${me.rank} จาก ${d.total}` : '';
  return `<div class="bd-season bd-in${top3 ? ' top' : ''}" ${st}>
      <div class="bd-s-main">
        <b class="bd-s-title"><i class="bd-orb"></i>${isAll ? 'กระดานหลัก' : 'กระดานเพื่อน'}</b>
        <div class="bd-s-goal">${goal}</div>
        <div class="bd-s-sub">${boardSeasonLabel(d.season)}${rankTx ? ' · ' + rankTx : ''}</div>
        <span class="bd-s-left">จบซีซันใน <b>${boardDaysLeft(d.season)}</b> วัน</span>
      </div>
      ${prize ? `<div class="bd-prize${top3 ? ' on' : ''}">${typeof coin === 'function' ? coin(22) : ''}<b>+${prize}</b></div>` : ''}
      ${d.hidden ? `<button class="bd-join" onclick="boardToggleHide()">แสดงชื่อฉันบนกระดาน</button>` : ''}
    </div>`;
}

// ---------- ที่เหลือ ----------
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
