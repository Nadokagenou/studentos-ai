// Renders the read-only insight pages (overview, usage, outcomes, people) as HTML strings.
// The page CSP blocks inline style attributes, so every bar and heat cell is an SVG shape
// sized by attributes and coloured by a class from staff.css.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = v => Number(v || 0);
const fmt = v => n(v).toLocaleString('th-TH', { maximumFractionDigits: 1 });
const pct = (a, b) => (b ? Math.round(n(a) / n(b) * 100) : null);
const pctText = (a, b) => (b ? pct(a, b) + '%' : '—');
const DAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
const thaiDay = d => new Date(d + 'T00:00:00+07:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
const daysAgo = (day, today) => (day && today ? Math.round((Date.parse(today) - Date.parse(day)) / 86400000) : null);

export const SCREENS = {
  'scr-menu': 'หน้าแรก', 'scr-tasks': 'รายการงาน', 'scr-scan': 'สแกนการบ้าน', 'scr-shot': 'ถ่ายรูปงาน', 'scr-crop': 'ครอปรูป',
  'scr-parsing': 'อ่านข้อความ', 'scr-plan': 'แผนวันนี้', 'scr-dayfull': 'ตารางทั้งวัน', 'scr-timeline': 'เส้นเวลา', 'scr-context': 'ตารางเรียน',
  'scr-ttscan': 'สแกนตารางเรียน', 'scr-ctxwiz': 'ตั้งค่าตารางเรียน', 'scr-stats': 'สถิติ', 'scr-shop': 'ร้านค้า', 'scr-wheel': 'วงล้อ',
  'scr-badges': 'ป้ายรางวัล', 'scr-profile': 'โปรไฟล์', 'scr-settings': 'ตั้งค่า', 'scr-setopt': 'ตัวเลือกตั้งค่า', 'scr-notif': 'ตั้งค่าแจ้งเตือน',
  'scr-news': 'ข่าวสาร', 'scr-inbox': 'กล่องจดหมาย', 'scr-sources': 'แหล่งงาน', 'scr-mates': 'เพื่อนร่วมห้อง', 'scr-people': 'ค้นหาคน',
  'scr-friends': 'เพื่อน', 'scr-user': 'หน้าคนอื่น', 'scr-dm': 'แชทส่วนตัว', 'scr-chat': 'แชท', 'scr-room': 'ห้องการบ้าน',
  'scr-classrooms': 'ห้องเรียน', 'scr-board': 'กระดานเพื่อน', 'scr-post': 'โพสต์', 'scr-compose': 'เขียนโพสต์', 'scr-topic': 'หัวข้อถามตอบ',
  'scr-tthread': 'กระทู้', 'scr-explore': 'สำรวจ', 'scr-events': 'กิจกรรม', 'scr-ai': 'ผู้ช่วย AI', 'scr-sai': 'ถาม SAI', 'scr-pro': 'ฟีเจอร์เสริม',
  'scr-tools': 'เครื่องมือ', 'scr-bugs': 'แจ้งปัญหา', 'scr-why': 'ทำไมงานนี้', 'scr-login': 'เข้าสู่ระบบ', 'scr-onboard': 'แนะนำแอป',
  'scr-consent': 'ขอความยินยอม', 'scr-privacy': 'ความเป็นส่วนตัว', 'scr-home': 'รายการงานเก่า',
};
const VIA = { scan: 'สแกนรูป', manual: 'พิมพ์เอง', line: 'LINE', inbox: 'กล่องจดหมาย', sync: 'ซิงก์ปฏิทิน', quick: 'ทางลัด', text: 'วางข้อความ' };
const DEVICES = { android: 'Android', ios: 'iOS', desktop: 'คอมพิวเตอร์', unknown: 'ยังไม่ทราบ' };
const PATHS = { alt: 'เว็บหลัก /alt/', root: 'เว็บเก่า', unknown: 'ยังไม่ทราบ' };
const HEAR = { friend: 'เพื่อนชวน', social: 'โซเชียล', teacher: 'ครู', unknown: 'ไม่ระบุ' };
const label = (map, k) => map[k] || (k === 'unknown' ? 'ไม่ระบุ' : k);

export function delta(cur, prev, unit = '') {
  if (prev == null || cur == null) return '';
  const d = Math.round((n(cur) - n(prev)) * 10) / 10;
  if (!d) return '<span class="d flat">เท่าช่วงก่อน</span>';
  return `<span class="d ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}${unit}</span>`;
}
const kpi = (l, v, d = '', sub = '') => `<div class="kpi"><span class="l">${esc(l)}</span><span class="v">${v}${sub ? ` <small>${sub}</small>` : ''}</span>${d}</div>`;
const card = (title, body, extra = '') => `<article class="card"><div class="card-h"><h2>${esc(title)}</h2>${extra}</div>${body}</article>`;
const foot = t => `<p class="footnote">${esc(t)}</p>`;
const dot = (s, t, sub, jump = '', btn = '') => `<div class="hrow"><span class="dot ${s}"></span><span>${esc(t)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>${jump ? `<button class="ghost" ${jump}>${esc(btn)}</button>` : '<span></span>'}</div>`;

export function bars(rows, max) {
  const top = max || Math.max(1, ...rows.map(r => n(r[1])));
  if (!rows.length) return '<p class="empty">ยังไม่มีข้อมูล</p>';
  return `<div class="bars">${rows.map(([k, v, shown]) => `<div class="bar"><span class="k">${esc(k)}</span><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect class="track" width="100" height="8" rx="4"/><rect class="fill" width="${(n(v) / top * 100).toFixed(1)}" height="8" rx="4"/></svg><span class="v">${esc(shown ?? fmt(v))}</span></div>`).join('')}</div>`;
}
export function stack(parts) {
  const rows = parts.filter(p => n(p[1]) > 0);
  const total = rows.reduce((s, p) => s + n(p[1]), 0);
  if (!total) return '<p class="empty">ยังไม่มีข้อมูล</p>';
  let x = 0;
  const rects = rows.map(([, v], i) => { const w = n(v) / total * 100; const r = `<rect class="s${i % 6}" x="${x.toFixed(2)}" width="${Math.max(0, w - 0.6).toFixed(2)}" height="10"/>`; x += w; return r; }).join('');
  return `<svg class="stack" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">${rects}</svg><div class="legend">${rows.map(([k, v], i) => `<span><i class="s${i % 6}"></i>${esc(k)} <b>${pct(v, total)}%</b></span>`).join('')}</div>`;
}
const funnel = rows => `<div class="bars">${rows.map(([k, v, base]) => `<div class="bar"><span class="k">${esc(k)}</span><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect class="track" width="100" height="8" rx="4"/><rect class="fill" width="${base ? (n(v) / base * 100).toFixed(1) : 0}" height="8" rx="4"/></svg><span class="v"><b>${fmt(v)}</b> ${pctText(v, base)}</span></div>`).join('')}</div>`;

export function trendChart(series = []) {
  if (!series.length) return '<p class="empty">ยังไม่มีข้อมูล</p>';
  const W = 640, H = 200, pl = 28, pr = 10, pt = 10, pb = 24, len = series.length;
  const top = Math.max(4, ...series.flatMap(s => [n(s.active), n(s.created), n(s.done)]));
  const step = top <= 8 ? 2 : top <= 20 ? 5 : top <= 50 ? 10 : Math.ceil(top / 5 / 10) * 10;
  const max = Math.ceil(top / step) * step;
  const x = i => pl + (len === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (len - 1));
  const y = v => pt + (H - pt - pb) * (1 - n(v) / max);
  const bw = Math.max(2, (W - pl - pr) / len * 0.6);
  let s = '';
  for (let v = 0; v <= max; v += step) s += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`;
  series.forEach((d, i) => { s += `<rect class="${i === len - 1 ? 'fill' : 'fill soft'}" x="${(x(i) - bw / 2).toFixed(1)}" y="${y(d.active).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(d.active)).toFixed(1)}" rx="2"><title>${esc(thaiDay(d.day))} · ${n(d.active)} คน</title></rect>`; });
  for (const [k, cls] of [['created', 'l2'], ['done', 'l3']])
    s += `<path class="${cls}" d="${series.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[k]).toFixed(1)).join('')}"/>`;
  const ticks = [0, Math.round((len - 1) / 3), Math.round((len - 1) * 2 / 3), len - 1].filter((v, i, a) => a.indexOf(v) === i);
  ticks.forEach(i => { s += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === len - 1 ? 'end' : 'middle'}">${i === len - 1 ? 'วันนี้' : esc(thaiDay(series[i].day))}</text>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="คนใช้รายวัน งานที่สร้าง และงานที่ทำเสร็จ">${s}</svg><div class="legend"><span><i class="s0"></i>คนใช้</span><span><i class="s1"></i>งานที่สร้าง</span><span><i class="s2"></i>งานที่ทำเสร็จ</span></div>`;
}

export function heatChart(heat = []) {
  const max = Math.max(1, ...heat.map(n));
  const cw = 18, gap = 3, left = 30, top = 16;
  let s = '';
  for (let h = 0; h < 24; h += 3) s += `<text x="${left + h * (cw + gap)}" y="10">${h}:00</text>`;
  DAYS.forEach((d, di) => {
    s += `<text x="0" y="${top + di * (cw + gap) + 13}">${d}</text>`;
    for (let h = 0; h < 24; h++) {
      const v = n(heat[di * 24 + h]);
      s += `<rect class="${v ? 'heat' : 'heat0'}" x="${left + h * (cw + gap)}" y="${top + di * (cw + gap)}" width="${cw}" height="${cw}" rx="3"${v ? ` fill-opacity="${(0.18 + v / max * 0.82).toFixed(2)}"` : ''}><title>${d} ${h}:00–${h + 1}:00 น. · ${v} ครั้ง</title></rect>`;
    }
  });
  return `<div class="scroll-x"><svg class="heatmap" viewBox="0 0 ${left + 24 * (cw + gap)} ${top + 7 * (cw + gap)}" role="img" aria-label="ช่วงเวลาที่ใช้แอปตามวันและชั่วโมง">${s}</svg></div>`;
}

function peaks(heat = []) {
  const block = (days) => {
    let best = -1, at = null;
    for (let h = 0; h <= 21; h++) {
      const v = days.reduce((s, d) => s + n(heat[d * 24 + h]) + n(heat[d * 24 + h + 1]) + n(heat[d * 24 + h + 2]), 0);
      if (v > best) { best = v; at = h; }
    }
    return best > 0 ? `${String(at).padStart(2, '0')}:00–${String(at + 3).padStart(2, '0')}:00` : '—';
  };
  return { school: block([0, 1, 2, 3, 4]), weekend: block([5, 6]) };
}

export function weekdayChart(avg = []) {
  if (!avg.length) return '<p class="empty">ยังไม่มีข้อมูล</p>';
  const W = 340, H = 130, base = 104, max = Math.max(1, ...avg.map(n)), bw = 30, gap = (W - 20 - 7 * bw) / 6;
  let s = '';
  avg.forEach((v, i) => {
    const h = n(v) / max * 84, x = 10 + i * (bw + gap);
    s += `<rect class="${i >= 5 ? 'muted-fill' : 'fill'}" x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="4"/><text x="${x + bw / 2}" y="${base - h - 5}" text-anchor="middle">${fmt(v)}</text><text x="${x + bw / 2}" y="${base + 16}" text-anchor="middle">${DAYS[i]}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="คนใช้เฉลี่ยตามวันในสัปดาห์">${s}</svg>`;
}

const sorted = obj => Object.entries(obj || {}).sort((a, b) => n(b[1]) - n(a[1]));

export function overviewHTML(r) {
  const c = r.kpi?.cur || {}, p = r.kpi?.prev || {}, t = r.today_vs || {}, ret = r.retention || {}, f = r.funnel || {}, h = r.health || {}, e = r.economy || {};
  const span = r.days === 1 ? 'วันนี้' : `${r.days} วัน`;
  const attention = [
    h.push_failed_7d ? dot('bad', `ส่งแจ้งเตือนไม่ถึง ${fmt(h.push_failed_7d)} ครั้งใน 7 วัน`, 'มักเป็นเครื่องที่ถอนการอนุญาตไปแล้ว', 'data-jump="push_status"', 'ดู') : '',
    h.bugs_open ? dot('warn', `ปัญหาแอปรอตรวจ ${fmt(h.bugs_open)} เรื่อง`, '', 'data-jump="issues"', 'เปิด') : '',
    h.reports_open ? dot('warn', `รายงานเนื้อหารอตรวจ ${fmt(h.reports_open)} เรื่อง`, '', 'data-jump="issues"', 'เปิด') : '',
    r.old_count ? dot('warn', `${fmt(r.old_count)} คนยังใช้แอปรุ่นเก่า`, `รุ่นล่าสุดคือ ${r.latest || '—'}`, 'data-jump="users" data-people-filter="old"', 'ดู') : '',
    r.stuck_count ? dot('warn', `${fmt(r.stuck_count)} คนล็อกอินแล้วแต่ยังไม่สร้างงาน`, '', 'data-jump="users" data-people-filter="stuck"', 'ดู') : '',
    h.integration_errors ? dot('warn', `การเชื่อมปฏิทินล้ม ${fmt(h.integration_errors)} บัญชี`, '', '', '') : '',
    h.push_pending ? dot('warn', `แจ้งเตือนรอส่ง ${fmt(h.push_pending)} รายการ`, 'ถ้าอยู่ช่วง 22:00–07:00 น. จะส่งตอนเช้า', 'data-jump="push_status"', 'ดู') : '',
  ].filter(Boolean);
  if (!attention.length) attention.push(dot('good', 'ไม่มีอะไรค้าง', 'แจ้งเตือน รายงาน และรุ่นแอปปกติ'));
  const today = r.today;
  return `
  <div class="kpis">
    ${kpi('คนใช้วันนี้', fmt(t.today), delta(t.today, t.yesterday) + '<span class="d flat"> จากเมื่อวาน</span>')}
    ${kpi(`ใช้ใน ${span}`, fmt(c.active), delta(c.active, p.active), `/ ${fmt(r.users)}`)}
    ${kpi(`คนใหม่ ${span}`, fmt(c.new), delta(c.new, p.new))}
    ${kpi('กลับมาวันที่ 2', pctText(ret.d1, ret.d1_base), `<span class="d flat">${fmt(ret.d1)} จาก ${fmt(ret.d1_base)} คน</span>`)}
    ${kpi('ยังใช้หลัง 7 วัน', pctText(ret.w1, ret.w1_base), `<span class="d flat">${fmt(ret.w1)} จาก ${fmt(ret.w1_base)} คน</span>`)}
    ${kpi('ทำเสร็จก่อนกำหนด', pctText(c.on_time, c.rated), c.rated && p.rated ? delta(pct(c.on_time, c.rated), pct(p.on_time, p.rated), ' จุด') : `<span class="d flat">${fmt(c.rated)} งานที่มีกำหนด</span>`)}
  </div>
  <div class="grid g32">
    ${card('คนใช้รายวัน · งานที่สร้างและทำเสร็จ', trendChart(r.series))}
    ${card('ตอนนี้ต้องดูอะไร', `<div class="hlist">${attention.join('')}</div>`)}
  </div>
  <div class="grid g3">
    ${card('เส้นทางของผู้ใช้', funnel([['ล็อกอิน', f.signed_in, f.signed_in], ['สร้างงานแรก', f.made_task, f.signed_in], ['ทำงานเสร็จชิ้นแรก', f.did_task, f.signed_in], ['ใช้ 2 วันขึ้นไป', f.days_2, f.signed_in], ['ใช้ 7 วันขึ้นไป', f.days_7, f.signed_in], ['เปิดแจ้งเตือน', f.push, f.signed_in]]) + foot('ทุกขั้นนับจากคนที่ล็อกอินทั้งหมด'))}
    ${card('หายไปเกิน 3 วัน', `<div class="hlist">${(r.gone || []).map(g => dot('warn', g.display_name || 'ยังไม่มีชื่อ', '@' + (g.handle || String(g.id).slice(0, 8)) + ' · ' + daysAgo(g.last_day, today) + ' วัน')).join('') || '<p class="empty">ไม่มีใครหายไป</p>'}</div>${n(r.gone_count) > 5 ? foot(`และอีก ${fmt(n(r.gone_count) - 5)} คน`) : ''}<div class="actions"><button data-jump="users" data-people-filter="gone">ดูทั้งหมด</button><button class="primary" data-jump="notices">เขียนข่าวชวนกลับ</button></div>`, `<span class="tag warn">${fmt(r.gone_count)} คน</span>`)}
    ${card('เศรษฐกิจในแอป', `<dl class="dl"><dt>โทเคนในกระเป๋าทุกคนรวม</dt><dd>${fmt(e.circulating)}</dd><dt>ทีมให้ ${span}</dt><dd>${fmt(e.granted)}</dd><dt>ทีมหัก ${span}</dt><dd>${fmt(e.debited)}</dd><dt>รับรางวัลจากงาน ${span}</dt><dd>${e.completions == null ? 'ยังไม่มีข้อมูล' : fmt(e.completions) + ' ครั้ง'}</dd><dt>เล่นกิจกรรมฮาโลวีน</dt><dd>${e.event_players == null ? '—' : fmt(e.event_players) + ' คน'}</dd><dt>รหัสเชิญ (ใช้แล้ว / ทั้งหมด)</dt><dd>${e.invite_codes == null ? '—' : fmt(e.invites_used) + ' / ' + fmt(e.invite_codes)}</dd></dl><div class="actions"><button data-jump="tokens">ให้หรือหักโทเคน</button></div>`)}
  </div>
  <p class="footnote">"ใช้" = วันนั้นเปิดแอป สร้างงาน ติ๊กงานเสร็จ จับเวลา หรือซิงก์อย่างน้อยหนึ่งครั้ง · นับเฉพาะคนที่ล็อกอิน · ช่วงนี้ ${esc(thaiDay(r.period?.from))}–${esc(thaiDay(r.period?.to))} เทียบกับ ${esc(thaiDay(r.period?.prev_from))}–${esc(thaiDay(r.period?.prev_to))}</p>`;
}

export function usageHTML(r) {
  const pk = peaks(r.heat);
  const base = n(r.screens_base) || n(r.users);
  const screens = sorted(r.screens).slice(0, 14).map(([k, v]) => [SCREENS[k] || k, v, pctText(v, base)]);
  const via = {};
  for (const [k, v] of Object.entries(r.via || {})) { const name = VIA[k] || 'อื่น ๆ'; via[name] = (via[name] || 0) + n(v); }
  const pairs = (obj, map) => sorted(obj).map(([k, v]) => [label(map, k), v]);
  return `
  <div class="grid g32">
    ${card('ใช้ช่วงไหนของวัน · เวลาไทย', heatChart(r.heat) + `<div class="legend"><span>น้อย</span><span><i class="heat0"></i></span><span><i class="heat lo"></i></span><span><i class="heat"></i></span><span>มาก</span></div>` + foot(`นับจากเวลาที่สร้างงาน ติ๊กงานเสร็จ และเริ่มจับเวลา ${fmt(r.heat_events)} ครั้ง ตั้งแต่ ${thaiDay(r.heat_from)} · ยังไม่ใช่เวลาเปิดแอปทุกครั้ง`))}
    ${card('ช่วงที่ใช้มากสุด', `<dl class="dl"><dt>วันเรียน (จ.–ศ.)</dt><dd>${pk.school}</dd><dt>วันหยุด (ส.–อา.)</dt><dd>${pk.weekend}</dd></dl>` + foot('ใช้เลือกเวลาส่งข่าวได้') + '<h3>คนใช้เฉลี่ยตามวัน</h3>' + weekdayChart(r.weekday))}
  </div>
  <div class="grid g3">
    ${card('ฟีเจอร์ที่คนเคยเปิด', bars(screens, base) + foot(`% ของ ${fmt(base)} คนที่แอปจดจอที่เปิดไว้`))}
    ${card('งานเข้ามาทางไหน', stack(sorted(via)) + '<h3>อุปกรณ์</h3>' + stack(pairs(r.devices, DEVICES)) + '<h3>เว็บที่ใช้</h3>' + stack(pairs(r.paths, PATHS)) + foot('อุปกรณ์อ่านจากข้อมูลวินิจฉัยแจ้งเตือนล่าสุดของแต่ละคน'))}
    ${card('ใครใช้', '<h3>ชั้นปี</h3>' + stack(pairs(r.grades, {})) + '<h3>รู้จักแอปจาก</h3>' + stack(pairs(r.hear, HEAR)) + '<h3>รุ่นแอป</h3>' + bars(sorted(r.versions).map(([k, v]) => [k === 'unknown' ? 'ไม่ทราบ' : k + (k === r.latest ? ' (ล่าสุด)' : ''), v])) + foot('ชั้นปีและที่มาเป็นคำตอบที่ผู้ใช้กรอกเองตอนสมัคร'))}
  </div>`;
}

export function outcomesHTML(r) {
  const c = r.kpi?.cur || {}, p = r.kpi?.prev || {}, s = r.snooze || {}, pace = r.pace || {}, b = r.backlog || {};
  const span = r.days === 1 ? 'วันนี้' : `${r.days} วัน`;
  const lead = pace.lead_days == null ? '—' : fmt(pace.lead_days) + ' วัน';
  const early = pace.early_hours == null ? '—' : fmt(pace.early_hours) + ' ชม.';
  return `
  <div class="kpis">
    ${kpi(`งานที่สร้าง ${span}`, fmt(c.created), delta(c.created, p.created))}
    ${kpi(`งานที่ทำเสร็จ ${span}`, fmt(c.done), delta(c.done, p.done))}
    ${kpi('ทำเสร็จก่อนกำหนด', pctText(c.on_time, c.rated), `<span class="d flat">${fmt(c.on_time)} จาก ${fmt(c.rated)} งาน</span>`)}
    ${kpi('งานค้างทั้งหมด', fmt(b.pending))}
    ${kpi('เลยกำหนดแล้ว', fmt(b.overdue))}
    ${kpi(`นาทีที่จับเวลา ${span}`, fmt(c.focus), delta(c.focus, p.focus))}
  </div>
  <div class="grid g3">
    ${card('งานที่ถูกเลื่อน', bars([['ไม่เคยเลื่อน', s.none], ['เลื่อน 1 ครั้ง', s.once], ['เลื่อน 2–3 ครั้ง', s.few], ['เลื่อนเกิน 3 ครั้ง', s.many]]) + foot('นับงานทั้งหมดที่ยังไม่ถูกลบ'))}
    ${card('วิชาที่มีงานเยอะสุด', bars((r.subjects || []).filter(x => !/^อื่น\s?ๆ?$/.test(x.name)).map(x => [x.name, x.tasks])) + foot('แสดงเฉพาะวิชาที่มีอย่างน้อย 2 คนและ 3 งาน ไม่แสดงชื่องาน'))}
    ${card('ความเร็วในการทำงาน', `<dl class="dl"><dt>สร้างงาน → ทำเสร็จ (ค่ากลาง)</dt><dd>${lead}</dd><dt>เสร็จก่อนกำหนด (ค่ากลาง)</dt><dd>${early}</dd><dt>งานสอบที่เตรียมทัน</dt><dd>${fmt(pace.exams_ready)} / ${fmt(pace.exams)}</dd></dl>` + foot(`นับตั้งแต่ ${thaiDay(r.heat_from)}`))}
  </div>
  ${card('ยังวัดไม่ได้', `<div class="hlist">${dot('warn', 'คนกด "เริ่มเลย" กับงานที่แอปเลือกให้กี่ครั้ง', 'ต้องให้แอปนับเพิ่ม')}${dot('warn', 'สแกนแล้วต้องแก้ข้อความก่อนบันทึกไหม', 'ต้องให้แอปนับเพิ่ม')}${dot('warn', 'ใช้แอปต่อครั้งนานแค่ไหน', 'ต้องให้แอปจดเวลาเปิดและปิด')}</div>`)}`;
}

export const PEOPLE_FILTERS = [['all', 'ทั้งหมด'], ['today', 'ใช้วันนี้'], ['gone', 'หายไปเกิน 3 วัน'], ['new', 'ใหม่ 7 วัน'], ['stuck', 'ยังไม่สร้างงาน'], ['nopush', 'ไม่เปิดแจ้งเตือน'], ['old', 'รุ่นเก่า'], ['banned', 'ถูกแบน']];
export function peopleChipsHTML(counts = {}, active = 'all') {
  return PEOPLE_FILTERS.map(([k, l]) => `<button data-people-filter="${k}" aria-pressed="${k === active}">${esc(l)} <b>${fmt(counts[k])}</b></button>`).join('');
}
const lastTag = (day, today) => {
  const d = daysAgo(day, today);
  if (d == null) return '<span class="tag dim">ไม่เคย</span>';
  return d === 0 ? '<span class="tag good">วันนี้</span>' : d === 1 ? '<span class="tag">เมื่อวาน</span>' : `<span class="tag ${d > 3 ? 'bad' : ''}">${d} วันก่อน</span>`;
};
const bits = (s = '', cls = 'spark') => `<svg class="${cls}" viewBox="0 0 ${s.length * 9} 14" aria-label="วันที่ใช้ ${s.split('').filter(c => c === '1').length} จาก ${s.length} วัน">${s.split('').map((c, i) => `<rect class="${c === '1' ? 'fill' : 'track'}" x="${i * 9}" width="7" height="14" rx="2"/>`).join('')}</svg>`;
export function peopleRowsHTML(items = [], today) {
  if (!items.length) return '<tr><td colspan="8" class="empty">ไม่พบผู้ใช้ในกลุ่มนี้</td></tr>';
  return items.map(x => `<tr data-person="${esc(x.id)}" tabindex="0"><td><div class="who"><span class="av">${esc((x.display_name || x.handle || '?').charAt(0))}</span><div><b>${esc(x.display_name || 'ยังไม่มีชื่อ')}</b><small>@${esc(x.handle || String(x.id).slice(0, 8))}${x.grade ? ' · ' + esc(x.grade) : ''}${x.banned ? ' · <span class="tag bad">แบน</span>' : ''}</small></div></div></td><td>${lastTag(x.last_day, today)}</td><td>${bits(x.act)}</td><td>${fmt(x.days_total)} วัน</td><td>${fmt(x.done)} / ${fmt(x.made)}</td><td>${pctText(x.on_time, x.rated)}</td><td>${esc(label(DEVICES, x.dev || 'unknown'))}${x.push_devices ? '' : ' <span class="tag dim">ปิดแจ้งเตือน</span>'}${x.old ? ' <span class="tag warn">' + esc(x.ver || 'รุ่นเก่า') + '</span>' : ''}</td><td>${fmt(x.balance)}</td></tr>`).join('');
}
export function streak(act = '') {
  let i = act.length - 1, s = 0;
  if (act[i] === '0') i--; // today may not have started yet
  for (; i >= 0 && act[i] === '1'; i--) s++;
  return s;
}
export function personHTML(p, today) {
  const d = daysAgo(p.first_day, today);
  return `
  <div class="card-h"><div class="who"><span class="av">${esc((p.display_name || p.handle || '?').charAt(0))}</span><div><h2 id="personName">${esc(p.display_name || 'ยังไม่มีชื่อ')}</h2><small>@${esc(p.handle || String(p.id).slice(0, 8))}${p.grade ? ' · ' + esc(p.grade) : ''}</small></div></div><button class="ghost" data-close-person>ปิด</button></div>
  <div class="kpis k3">${kpi('ใช้มาแล้ว', fmt(p.days_total) + ' วัน')}${kpi('ติดต่อกัน', fmt(streak(p.act)) + ' วัน')}${kpi('ทำเสร็จก่อนกำหนด', pctText(p.on_time, p.rated))}</div>
  <section class="sect"><h3>30 วันล่าสุด</h3>${bits(p.act, 'spark wide')}</section>
  <section class="sect"><h3>การใช้งาน</h3><dl class="dl"><dt>ใช้ล่าสุด</dt><dd>${lastTag(p.last_day, today)}</dd><dt>เริ่มใช้</dt><dd>${d == null ? '—' : esc(thaiDay(p.first_day)) + ` (${d} วันก่อน)`}</dd><dt>งานที่สร้าง / ทำเสร็จ</dt><dd>${fmt(p.made)} / ${fmt(p.done)}</dd><dt>งานค้าง / เลยกำหนด</dt><dd>${fmt(p.pending)} / ${fmt(p.overdue)}</dd><dt>จับเวลา 7 วัน</dt><dd>${fmt(p.focus_7)} นาที</dd><dt>จอที่เคยเปิด</dt><dd>${fmt(p.screens)} จอ</dd><dt>รู้จักแอปจาก</dt><dd>${esc(label(HEAR, p.hear || 'unknown'))}</dd></dl></section>
  <section class="sect"><h3>อุปกรณ์</h3><dl class="dl"><dt>เครื่อง</dt><dd>${esc(label(DEVICES, p.dev || 'unknown'))}</dd><dt>เว็บ</dt><dd>${esc(label(PATHS, p.path || 'unknown'))}</dd><dt>รุ่นแอป</dt><dd>${esc(p.ver || '—')}${p.latest && p.ver && p.ver !== p.latest ? ' <span class="tag warn">เก่า</span>' : ''}</dd><dt>แจ้งเตือน</dt><dd>${p.push_devices ? `<span class="tag good">เปิด · ${fmt(p.push_devices)} เครื่อง</span>` : '<span class="tag dim">ไม่เปิด</span>'}</dd><dt>เชื่อม LINE</dt><dd>${p.line_linked ? 'เชื่อมแล้ว' : 'ยังไม่เชื่อม'}</dd></dl></section>
  <section class="sect"><h3>บัญชี</h3><dl class="dl"><dt>โทเคน</dt><dd>${fmt(p.balance)}</dd><dt>ทีมเคยให้ / หัก</dt><dd>+${fmt(p.granted)} / −${fmt(p.debited)}</dd><dt>สถานะ</dt><dd>${p.banned ? `<span class="tag bad">แบน${p.ban_until ? 'ถึง ' + esc(new Date(p.ban_until).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })) : 'ถาวร'}</span>` : p.ever_banned ? 'ใช้งานปกติ · เคยถูกแบน' : 'ใช้งานปกติ'}</dd><dt>แจ้งปัญหาแอป</dt><dd>${p.bug_reports == null ? '—' : fmt(p.bug_reports) + ' เรื่อง'}</dd><dt>ซิงก์ล่าสุด</dt><dd>${p.last_sync ? esc(new Date(p.last_sync).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })) : '—'}</dd></dl></section>
  <div class="actions"><button class="primary" data-message-person="${esc(p.id)}">ส่งข่าวหาคนนี้</button><button data-target="${esc(p.id)}">ให้/หักโทเคน หรือแบน</button></div>
  <p class="footnote">ไม่แสดงชื่องาน การบ้าน อีเมล หรือข้อความแชทของผู้ใช้</p>`;
}
