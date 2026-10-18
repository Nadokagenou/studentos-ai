const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=v=>v?new Date(v).toLocaleString('th-TH'):'—';
export function pushStatusHTML(result) {
  const m=result.metrics||{};
  const metrics=[['รอส่ง',m.pending],['กำลังส่ง',m.sending],['บริการตอบรับใน 24 ชม.',m.accepted_24h],['ส่งไม่สำเร็จ',m.failed]]
    .map(([label,value])=>`<article class="metric"><span>${label}</span><b>${Number(value||0).toLocaleString('th-TH')}</b></article>`).join('');
  const rows=(result.items||[]).map(n=>`<article class="item"><h3>${esc(n.title)} <span class="tag">${n.audience==='personal'?'ส่วนตัว':'ประกาศ'}</span></h3><p>${esc(when(n.published_at))} · ${Number(n.total)} บัญชีในคิว</p><p>รอ ${Number(n.pending)} · กำลังส่ง ${Number(n.sending)} · บริการตอบรับ ${Number(n.accepted)} · ไม่สำเร็จ ${Number(n.failed)} · ยกเลิก ${Number(n.cancelled)}</p><p>ลองส่งสูงสุด ${Number(n.attempts||0)} ครั้ง${n.delivery_seconds!=null?' · หลังเผยแพร่ถึงบริการตอบรับเฉลี่ย '+esc(n.delivery_seconds)+' วินาที':''}</p></article>`).join('')||'<p class="empty">ยังไม่มีรายการในหมวดนี้</p>';
  return {metrics,rows,updated:'อัปเดต '+when(result.generated_at),hint:(result.quiet_hours?'อยู่ในช่วงงดรบกวน ส่งต่อได้หลัง '+when(result.resume_at):'ส่งตามคิวเมื่อผู้ใช้เปิดรับแจ้งเตือน')+(result.oldest_pending_at?' · รายการรอเก่าสุด '+when(result.oldest_pending_at):'')};
}
