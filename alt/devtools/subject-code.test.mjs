// แปลรหัสวิชาในตารางเรียน · รัน: node --test alt/devtools/subject-code.test.mjs
// โหลด context.js ตัวจริงเข้า vm แล้วเช็ค ctxSubjInfo กับชื่อคาบที่ busyBlocks ส่งให้แผน
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync(new URL('../context.js', import.meta.url), 'utf8');
const store = new Map();
const localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const ctx = vm.createContext({ localStorage, console, Date, Math, JSON });
vm.runInContext(src, ctx);
const info = s => JSON.parse(vm.runInContext('JSON.stringify(ctxSubjInfo(' + JSON.stringify(s) + '))', ctx));

test('รหัสล้วนแปลเป็นกลุ่มสาระ', () => {
  assert.deepEqual(info('ค23101'), { name: 'คณิตศาสตร์', code: 'ค23101', extra: '' });
  assert.deepEqual(info('อ31101'), { name: 'ภาษาอังกฤษ', code: 'อ31101', extra: '' });
  assert.deepEqual(info('พ 21103'), { name: 'สุขศึกษา/พลศึกษา', code: 'พ21103', extra: '' });
  assert.equal(info('จ20201').name, 'ภาษาจีน');
});
test('ประเภท 2 = เพิ่มเติม แต่ไม่เดาว่าเป็นฟิสิกส์หรือเคมี', () => {
  assert.deepEqual(info('ว32201'), { name: 'วิทยาศาสตร์', code: 'ว32201', extra: 'เพิ่มเติม' });
});
test('มีชื่อเขียนต่อท้ายรหัส ชื่อที่เขียนชนะ', () => {
  assert.deepEqual(info('ว30201 ฟิสิกส์ 1'), { name: 'ฟิสิกส์ 1', code: 'ว30201', extra: '' });
  assert.equal(info('ค23101 - คณิต').name, 'คณิตศาสตร์');
});
test('ชื่อย่อทั้งช่องแปล · ชื่อยาวกว่านั้นไม่แตะ', () => {
  assert.equal(info('Math').name, 'คณิตศาสตร์');
  assert.equal(info('ENG').name, 'ภาษาอังกฤษ');
  assert.equal(info('คณิตเพิ่มเติม').name, 'คณิตเพิ่มเติม');
  assert.equal(info('ชุมนุมหุ่นยนต์').name, 'ชุมนุมหุ่นยนต์');
});
test('ไม่แปลของที่ไม่แน่ใจ', () => {
  assert.equal(info('ก21901').name, 'ก21901');        // กิจกรรม หรือ ภาษาเกาหลี — แล้วแต่โรงเรียน
  assert.equal(info('ค231011').name, 'ค231011');      // เลขเกิน ไม่ใช่รหัส
  assert.equal(info('พักกลางวัน').name, 'พักกลางวัน');
  assert.equal(info('').name, '');
});
test('แผนเห็นชื่อวิชา ไม่ใช่รหัส · ของที่เก็บไว้ไม่ถูกแก้', () => {
  vm.runInContext(`ctxUpsert('class', { subject: 'ค23101', start: '08:30', end: '09:20', weekday: [1] })`, ctx);
  const mon = 'new Date(2026, 10, 2)'; // 2 พ.ย. 69 = วันจันทร์
  const t = vm.runInContext(`busyBlocks(${mon}, { typical: true }).filter(b => b.kind === 'class').map(b => b.title).join()`, ctx);
  assert.equal(t, 'คณิตศาสตร์');
  assert.equal(vm.runInContext('ctxClasses()[0].subject', ctx), 'ค23101');
});
test('วิทย์เพิ่มเติม ม.ปลาย บอกเล่มได้', () => {
  assert.equal(info('ว30201').name, 'ฟิสิกส์ 1');
  assert.equal(info('ว30222').name, 'เคมี 2');
  assert.equal(info('ว30243').name, 'ชีววิทยา 3');
  assert.deepEqual(info('ว30261'), { name: 'วิทยาศาสตร์', code: 'ว30261', extra: 'เพิ่มเติม' });  // ยังไม่มีหลักฐาน
  assert.equal(info('ว30201 ฟิสิกส์กับการใช้งาน').name, 'ฟิสิกส์กับการใช้งาน');            // ชื่อในรูปชนะ
});
