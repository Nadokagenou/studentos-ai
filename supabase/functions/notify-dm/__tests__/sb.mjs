// supabase-js แบบจำลอง — ใช้ของ send-reminders แล้วเติม insert (notify-dm จองคีย์ด้วย insert)
import { makeDb } from '../../send-reminders/__tests__/stubs.js';
export const __tables = {};
export const __log = [];
export function __setTables(t) {
  for (const k of Object.keys(__tables)) delete __tables[k];
  Object.assign(__tables, t);
}
export function createClient() {
  const db = makeDb(__tables, __log);
  const from = db.from;
  db.from = (name) => {
    const api = from(name);
    api.insert = async (row) => {
      const rows = __tables[name] || (__tables[name] = []);
      if (name === 'push_sent' && rows.some(r => r.user_id === row.user_id && r.task_id === row.task_id))
        return { data: null, error: { code: '23505', message: 'duplicate key' } };
      rows.push({ ...row });
      return { data: null, error: null };
    };
    return api;
  };
  return db;
}
