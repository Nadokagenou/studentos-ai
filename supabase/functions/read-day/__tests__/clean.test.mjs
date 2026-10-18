// รัน: node --test supabase/functions/read-day/__tests__/clean.test.mjs
// (Node 24 ตัด type ของ .ts เองได้ · clean.ts ไม่มี import จึงโหลดตรงได้)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, cleanDay, cleanInput } from '../clean.ts';

const T = '2026-10-18';

test('addDays ข้ามเดือนได้', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
});

test('ช่วงเวลาที่ดีผ่าน · เสียถูกทิ้ง · เรียงตามเวลา · สูงสุด 6', () => {
  const r = cleanDay({ date: T, school: false, blocks: [
    { start: '17:30', end: '19:00', title: 'เรียนพิเศษ' },
    { start: '13:00', end: '17:00', title: 'ไปห้าง' },
    { start: '25:00', end: '26:00', title: 'x' },
    { start: '10:00', end: '09:00', title: 'y' },
  ] }, T);
  assert.deepEqual(r.blocks.map(b => b.start), ['13:00', '17:30']);
  assert.equal(r.school, false);
  const many = cleanDay({ blocks: Array.from({ length: 9 }, (_, i) => ({
    start: String(8 + i).padStart(2, '0') + ':00', end: String(8 + i).padStart(2, '0') + ':30', title: 'ช่วง' })) }, T);
  assert.equal(many.blocks.length, 6);
});

test('วันที่นอกช่วง วันนี้ถึง +7 → ใช้วันนี้', () => {
  assert.equal(cleanDay({ date: '2026-12-25' }, T).date, T);
  assert.equal(cleanDay({ date: '2026-10-19' }, T).date, '2026-10-19');
  assert.equal(cleanDay({ date: 'พรุ่งนี้' }, T).date, T);
});

test('breakUntil ต้องเป็นอนาคตไม่เกิน 200 วัน', () => {
  assert.equal(cleanDay({ breakUntil: '2026-11-02' }, T).breakUntil, '2026-11-02');
  assert.equal(cleanDay({ breakUntil: '2026-10-01' }, T).breakUntil, null);
  assert.equal(cleanDay({ breakUntil: '2028-01-01' }, T).breakUntil, null);
});

test('school ที่ไม่ใช่ boolean = null · ข้อความถูกตัดความยาว', () => {
  const r = cleanDay({ school: 'yes', advice: 'ก'.repeat(500), note: 'ข'.repeat(500) }, T);
  assert.equal(r.school, null);
  assert.equal(r.advice.length, 160);
  assert.equal(r.note.length, 200);
});

test('cleanInput ต้องมีข้อความกับวันที่ถูกรูปแบบ', () => {
  assert.equal(cleanInput({ text: '', today: T }), null);
  assert.equal(cleanInput({ text: 'ไปห้าง', today: '18/10' }), null);
  const ok = cleanInput({ text: 'ไปห้าง'.repeat(100), today: T, now: '9:05', summary: 's'.repeat(5000) });
  assert.equal(ok.text.length, 300);
  assert.equal(ok.summary.length, 2000);
  assert.equal(ok.now, '');   // '9:05' ไม่ใช่ HH:MM สองหลัก — ไม่เดา
});
