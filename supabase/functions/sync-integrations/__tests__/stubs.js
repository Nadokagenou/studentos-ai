// ---------- supabase-js แบบจำลอง ----------
// รองรับเฉพาะรูปคิวรีที่ sync-integrations ใช้จริง ไม่ได้ทำให้ครบทุกอย่างของไลบรารี
// เพิ่มคิวรีรูปใหม่ในฟังก์ชันเมื่อไหร่ ต้องมาเพิ่มที่นี่ด้วย ไม่งั้นเทสต์จะผ่านแบบไม่ได้ทดสอบ
//
// ⚠️ กับดักเดียวกับของ send-reminders: __setTables() ต้องแก้ไส้ในก้อนเดิม
// เพราะฟังก์ชันถือ reference ของ client ที่สร้างครั้งเดียวไว้ตลอดอายุ instance
export function makeDb(tables, log) {
  const clone = r => JSON.parse(JSON.stringify(r));

  const pick = (row, sel) => {
    if (!sel || sel === '*') return clone(row);
    const out = {};
    for (const part of sel.split(',').map(s => s.trim())) {
      // รูป alias:data->settings  (ดึงค่าจาก jsonb)
      const alias = /^(\w+):(.+)$/.exec(part);
      if (alias) {
        const [, name, path] = alias;
        let v = row;
        for (const sg of path.split('->').map(x => x.replace(/^>/, ''))) v = v == null ? v : v[sg];
        out[name] = v;
        continue;
      }
      out[part] = row[part];
    }
    return clone(out);
  };

  const q = (name) => {
    const rows = () => tables[name] || (tables[name] = []);
    const st = { sel: '*', filters: [], limit: null, order: null, op: null, payload: null, conflict: null };
    const api = {
      select(s) { if (s) st.sel = s; return api; },
      eq(c, v) { st.filters.push(r => r[c] === v); return api; },
      in(c, list) { const s = new Set(list); st.filters.push(r => s.has(r[c])); return api; },
      lte(c, v) { st.filters.push(r => String(r[c]) <= String(v)); return api; },
      gte(c, v) { st.filters.push(r => String(r[c]) >= String(v)); return api; },
      not(c, op, v) {
        if (op === 'is' && v === null) st.filters.push(r => r[c] != null);
        return api;
      },
      order(c, o) { st.order = [c, o]; return api; },
      limit(n) { st.limit = n; return api; },
      insert(payload) { st.op = 'insert'; st.payload = payload; return api; },
      upsert(payload, opts) { st.op = 'upsert'; st.payload = payload; st.conflict = opts?.onConflict ?? null; return api; },
      update(payload) { st.op = 'update'; st.payload = payload; return api; },
      delete() { st.op = 'delete'; return api; },
      maybeSingle() { st.single = 'maybe'; return api; },
      single() { st.single = 'one'; return api; },
      then(res, rej) { return api.run().then(res, rej); },

      async run() {
        let out = rows().filter(r => st.filters.every(f => f(r)));

        if (st.op === 'insert') {
          const list = Array.isArray(st.payload) ? st.payload : [st.payload];
          for (const p of list) { rows().push({ ...p }); log.push(`insert ${name}`); }
          return { data: null, error: null };
        }

        if (st.op === 'upsert') {
          // คีย์กันซ้ำมาจาก onConflict · ไม่ระบุ = ใช้ (user_id, task_id) แบบ push_sent
          const cols = (st.conflict || 'user_id,task_id').split(',').map(s => s.trim());
          const keyOf = r => JSON.stringify(cols.map(c => r[c]));
          const list = Array.isArray(st.payload) ? st.payload : [st.payload];
          for (const p of list) {
            const i = rows().findIndex(r => keyOf(r) === keyOf(p));
            if (i >= 0) rows()[i] = { ...rows()[i], ...p }; else rows().push({ ...p });
            log.push(`upsert ${name}`);
          }
          return { data: null, error: null };
        }

        if (st.op === 'update') {
          for (const r of out) Object.assign(r, st.payload);
          return { data: null, error: null };
        }

        if (st.op === 'delete') {
          // ลบในก้อนเดิม ไม่ใช่สร้างก้อนใหม่ทับ — เทสต์ถือ reference ของก้อนเดิมอยู่
          const keep = rows().filter(r => !out.includes(r));
          rows().length = 0; rows().push(...keep);
          log.push(`delete ${name}`);
          return { data: null, error: null };
        }

        if (st.order) {
          const [c, o] = st.order;
          const asc = o?.ascending !== false;
          out = [...out].sort((a, b) => (String(a[c]).localeCompare(String(b[c]))) * (asc ? 1 : -1));
        }
        if (st.limit) out = out.slice(0, st.limit);
        const mapped = out.map(r => pick(r, st.sel));
        if (st.single) return { data: mapped[0] ?? null, error: null };
        return { data: mapped, error: null };
      },
    };
    return api;
  };
  return { from: q };
}
