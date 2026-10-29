// Made-up numbers for preview.html only. Shapes match staff_insights() so the preview exercises
// the real renderers; nothing here is read from or sent to the live project.
const DAY = 86400000;
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const day = n => new Date(Date.parse(today + 'T00:00:00Z') - n * DAY).toISOString().slice(0, 10);
const wave = (len, base, amp, seed) => Array.from({ length: len }, (_, i) => Math.max(0, Math.round(base + amp * Math.sin(i * 0.9 + seed) + (i / len) * amp)));
const people = [
  ['นักเรียนตัวอย่าง มิ้นท์', 'demo_mint', 'ม.4', 0, 41, 'ios', 1, '1C61', 88, 71, 312],
  ['นักเรียนตัวอย่าง บอส', 'demo_boss', 'ม.4', 0, 33, 'android', 1, '1C61', 54, 40, 120],
  ['นักเรียนตัวอย่าง แพรว', 'demo_praew', 'ม.5', 0, 3, 'ios', 0, '1C61', 6, 2, 15],
  ['นักเรียนตัวอย่าง ไอซ์', 'demo_ice', 'ม.4', 1, 19, 'android', 0, '1C60', 23, 12, 64],
  ['นักเรียนตัวอย่าง พลอย', 'demo_ploy', 'ม.4', 4, 12, 'ios', 0, '1C58', 17, 9, 40],
  ['นักเรียนตัวอย่าง ต้นกล้า', 'demo_tonkla', null, 6, 8, 'android', 1, '1C58', 11, 3, 22],
  ['นักเรียนตัวอย่าง เฟิร์น', 'demo_fern', null, 9, 1, null, 0, '1C55', 0, 0, 5],
].map(([display_name, handle, grade, last, days_total, dev, push_devices, ver, made, done, balance], i) => {
  const act = Array.from({ length: 30 }, (_, k) => { const ago = 29 - k; return ago < last || ago > last + days_total * 1.4 ? '0' : (ago === last || (ago * 7 + i) % 3 ? '1' : '0'); }).join('');
  return { id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, display_name, handle, grade, ver, dev, path: i === 5 ? 'root' : 'alt', push_devices,
    first_day: day(last + days_total), last_day: day(last), days_total, act, made, done, rated: Math.round(done * 0.8), on_time: Math.round(done * 0.65),
    pending: made - done, overdue: Math.max(0, Math.round((made - done) / 3)), focus_7: i < 3 ? 180 - i * 60 : 0, screens: 8 + Math.min(30, days_total),
    balance, banned: false, ban_until: null, old: ver !== '1C61' && last <= 29, hear: i % 3 ? 'friend' : 'social', line_linked: i === 0, notif: push_devices ? 'granted' : 'default' };
});
const matches = (p, f) => f === 'all' || (f === 'today' && p.last_day === today) || (f === 'gone' && p.last_day < day(3)) || (f === 'new' && p.first_day >= day(6))
  || (f === 'stuck' && !p.made) || (f === 'nopush' && !p.push_devices) || (f === 'old' && p.old) || (f === 'banned' && p.banned);

export function demoInsights(action, p = {}) {
  if (action === 'people') {
    const q = String(p.query || '').replace(/^@/, '').toLowerCase();
    const counts = Object.fromEntries(['all', 'today', 'gone', 'new', 'stuck', 'nopush', 'old', 'banned'].map(f => [f, people.filter(x => matches(x, f)).length]));
    const items = people.filter(x => matches(x, p.filter || 'all') && (!q || (x.handle + x.display_name).toLowerCase().includes(q))).map(x => ({ ...x, act: x.act.slice(-14) }));
    return { today, latest: '1C61', counts, items, has_more: false };
  }
  if (action === 'person') {
    const x = people.find(y => y.id === p.id);
    if (!x) throw Error('ไม่พบผู้ใช้');
    return { ...x, latest: '1C61', today, granted: x.handle === 'demo_mint' ? 50 : 0, debited: 0, ever_banned: false, bug_reports: x.handle === 'demo_ice' ? 1 : 0, last_sync: new Date(Date.parse(x.last_day + 'T19:00:00+07:00')).toISOString() };
  }
  const n = [1, 7, 30, 90].includes(p.days) ? p.days : 7, len = Math.max(n, 14);
  const active = wave(len, 6, 3, 1), created = wave(len, 11, 6, 2), done = created.map(v => Math.round(v * 0.75));
  const heat = Array.from({ length: 168 }, (_, c) => { const d = Math.floor(c / 24), h = c % 24, we = d >= 5;
    const v = we ? Math.exp(-(((h - 14.5) / 3) ** 2)) * 8 + Math.exp(-(((h - 20) / 2) ** 2)) * 5 : Math.exp(-(((h - 20.5) / 1.8) ** 2)) * 12 + Math.exp(-(((h - 12.3) / 0.8) ** 2)) * 4;
    return h < 6 ? 0 : Math.round(v * (0.8 + ((c * 37) % 10) / 25)); });
  return {
    generated_at: new Date().toISOString(), today, days: n, latest: '1C61',
    period: { from: day(n - 1), to: today, prev_from: day(2 * n - 1), prev_to: day(n) },
    kpi: { cur: { active: 14, new: 3, created: 97, done: 76, rated: 60, on_time: 47, focus: 645 }, prev: { active: 11, new: 3, created: 83, done: 67, rated: 55, on_time: 42, focus: 525 } },
    today_vs: { today: 9, yesterday: 7, last_week: 11 }, users: 24,
    retention: { d1_base: 23, d1: 14, w1_base: 17, w1: 7 },
    funnel: { signed_in: 24, made_task: 21, did_task: 19, days_2: 17, days_7: 10, push: 7 },
    series: active.map((a, i) => ({ day: day(len - 1 - i), active: a, created: created[i], done: done[i] })),
    heat, heat_events: heat.reduce((a, b) => a + b, 0), heat_from: day(Math.max(n, 30) - 1),
    weekday: [7.2, 6.8, 7.5, 6.9, 5.1, 3.4, 4.6],
    screens: { 'scr-menu': 16, 'scr-tasks': 16, 'scr-ai': 16, 'scr-shop': 14, 'scr-settings': 14, 'scr-context': 14, 'scr-plan': 13, 'scr-scan': 12, 'scr-stats': 12, 'scr-wheel': 12, 'scr-mates': 12, 'scr-news': 10, 'scr-dm': 10, 'scr-board': 8, 'scr-room': 6, 'scr-classrooms': 2 },
    screens_base: 16,
    via: { scan: 78, manual: 36, line: 72, inbox: 26, sync: 24, quick: 3, text: 2 },
    devices: { android: 9, ios: 6, desktop: 1, unknown: 8 }, paths: { alt: 14, root: 2, unknown: 8 },
    grades: { 'ม.4': 10, 'ม.5': 1, unknown: 13 }, hear: { friend: 10, social: 2, unknown: 12 }, versions: { '1C61': 16, '1C60': 4, '1C58': 3, '1C55': 1 },
    subjects: [{ name: 'คณิตศาสตร์', tasks: 142 }, { name: 'ภาษาอังกฤษ', tasks: 118 }, { name: 'ฟิสิกส์', tasks: 96 }, { name: 'เคมี', tasks: 88 }, { name: 'ภาษาไทย', tasks: 71 }],
    snooze: { none: 612, once: 168, few: 74, many: 28 },
    pace: { lead_days: 1.8, early_hours: 14, exams: 9, exams_ready: 7 }, backlog: { pending: 141, overdue: 23 },
    gone: people.filter(x => x.last_day < day(3)).map(({ id, display_name, handle, last_day }) => ({ id, display_name, handle, last_day })),
    gone_count: people.filter(x => x.last_day < day(3)).length, stuck_count: 1, old_count: 3,
    economy: { circulating: 4812, granted: 120, debited: 15, completions: 162, event_players: 11, invite_codes: 11, invites_used: 7 },
    health: { push_users: 7, push_accepted_7d: 52, push_failed_7d: 2, push_pending: 0, reminders_7d: 61, bugs_open: 2, reports_open: 0, integration_errors: 0, bans_active: 1 },
  };
}
