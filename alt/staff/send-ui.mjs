// Send-news list and wording for the Control Room. Kept apart from staff.js so it can be tested in Node.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = v => (v ? new Date(v).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : '—');

export const AUDIENCE_LABELS = { all: 'ทุกคน', active: 'ใช้ใน 7 วัน', gone: 'หายไปเกิน 3 วัน', new: 'คนใหม่ 7 วัน', old: 'ใช้แอปรุ่นเก่า', stuck: 'ยังไม่สร้างงาน', grade: 'ชั้นปี', pick: 'เลือกเอง' };
// People-page filters that have a matching send group.
export const FILTER_TO_AUDIENCE = { all: 'all', gone: 'gone', new: 'new', old: 'old', stuck: 'stuck' };

export function audienceLabel(aud, picked = []) {
  if (aud.kind === 'grade') return 'ชั้น ' + aud.grade;
  if (aud.kind === 'pick') return picked.length === 1 ? picked[0].name : `เลือกเอง ${picked.length} คน`;
  return AUDIENCE_LABELS[aud.kind] || aud.kind;
}

export function sendsHTML(items = []) {
  if (!items.length) return '<p class="empty">ยังไม่มีข่าวที่ส่งจากหน้านี้</p>';
  return items.map(x => {
    const status = x.status === 'scheduled' ? `<span class="tag warn">ตั้งเวลา ${esc(when(x.scheduled_at))}</span>`
      : x.status === 'withdrawn' ? '<span class="tag dim">ถอนแล้ว</span>' : '<span class="tag good">ส่งแล้ว</span>';
    const reach = x.public ? 'ทุกคน (หน้าข่าวสาร)' : `${esc(x.audience || 'กลุ่ม')} · ${Number(x.recipients || 0).toLocaleString('th-TH')} คน (กระดิ่ง)`;
    const push = x.push ? `มือถือรับ ${Number(x.push_accepted || 0)}/${Number(x.push_total || 0)}${x.push_failed ? ` · ไม่ถึง ${Number(x.push_failed)}` : ''}` : 'ไม่เด้งแจ้งเตือน';
    return `<div class="item"><h3>${esc(x.title)} ${status}</h3><p>${esc(x.body)}</p><p>${reach} · ${esc(x.status === 'scheduled' ? 'ยังไม่ส่ง' : when(x.published_at))} · ${push}${x.until_at ? ' · หายเมื่อ ' + esc(when(x.until_at)) : ''}</p>${x.status !== 'withdrawn' ? `<div class="actions"><button data-cancel-send="${esc(x.id)}">${x.status === 'scheduled' ? 'ยกเลิกการตั้งเวลา' : 'ถอนข่าว'}</button></div>` : ''}</div>`;
  }).join('') + '<p class="footnote">"มือถือรับ" คือบริการแจ้งเตือนรับไปแล้ว ไม่ได้แปลว่าผู้ใช้เปิดอ่าน · ถอนข่าวได้ แต่แจ้งเตือนที่เด้งไปแล้วเรียกคืนไม่ได้</p>';
}

export function sendSummary({ title, body, aud, label, recipients, pushReady, at, until, push }) {
  return [
    title, '', body, '',
    `ถึง: ${label}${recipients == null ? '' : ` · ${recipients} คน`}`,
    aud.kind === 'all' ? 'ขึ้นในหน้าข่าวสารของทุกคน' : 'ขึ้นในกระดิ่งของคนในกลุ่มเท่านั้น',
    `เวลา: ${at ? 'ตั้งเวลา ' + when(at) : 'ส่งทันที'}`,
    until ? `หายจากแอป: ${when(until)}` : '',
    push ? `เด้งบนมือถือ: ${pushReady == null ? 'เครื่องที่อนุญาตไว้' : pushReady + ' คน'} (พัก 22:00–07:00 น.)` : 'ไม่เด้งแจ้งเตือน',
  ].filter(x => x !== '').join('\n');
}
