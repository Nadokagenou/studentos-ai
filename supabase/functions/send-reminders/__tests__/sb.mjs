import { makeDb } from './stubs.js';
// ต้องเป็น "ก้อนเดิมที่ถูกแก้ไส้ใน" ไม่ใช่ก้อนใหม่ — ตัวฟังก์ชันจริงสร้าง client ครั้งเดียว
// ตอน ensureInit() แล้วถือ reference นั้นไว้ตลอดอายุ instance
// ถ้าเทสต์สลับก้อนใหม่ client เดิมจะยังชี้ก้อนเก่า แล้วเทสต์ที่สองเป็นต้นไปจะอ่านข้อมูลผิด
export const __tables = {};
export const __log = [];
export function __setTables(t) {
  for (const k of Object.keys(__tables)) delete __tables[k];
  for (const k of Object.keys(t)) {
    const d = Object.getOwnPropertyDescriptor(t, k);
    Object.defineProperty(__tables, k, d);
  }
}
export function createClient() { return makeDb(__tables, __log); }
