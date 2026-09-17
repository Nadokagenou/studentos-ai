// ---------- supabase-js แบบจำลอง ----------
// รองรับเฉพาะรูปคิวรีที่ send-reminders ใช้จริง ไม่ได้ทำให้ครบทุกอย่างของไลบรารี
export function makeDb(tables, log) {
  const clone = r => JSON.parse(JSON.stringify(r));
  const pick = (row, sel) => {
    if (!sel || sel === '*') return clone(row);
    const out = {};
    // แยกด้วย ',' ไม่ได้ตรง ๆ — embed อย่าง dm_threads!inner(a, b) มีลูกน้ำอยู่ข้างใน
    const parts = []; let buf = '', depth = 0;
    for (const ch of sel) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(buf); buf = ''; continue; }
      buf += ch;
    }
    if (buf.trim()) parts.push(buf);
    for (let part of parts.map(s => s.trim())) {
      const embed = /^([a-z_]+)(?:!\w+)?\(([^)]*)\)$/.exec(part);
      if (embed) {
        const [, tbl, cols] = embed;
        const fk = tbl === 'dm_threads' ? row.thread : null;
        const hit = (tables[tbl] || []).find(r => r.id === fk);
        out[tbl] = hit ? Object.fromEntries(cols.split(',').map(c => [c.trim(), hit[c.trim()]])) : null;
        continue;
      }
      const alias = /^(\w+):(.+)$/.exec(part);
      if (alias) {
        const [, name, path] = alias;
        const segs = path.split('->').map(x => x.replace(/^>/, ''));
        let v = row;
        for (const sg of segs) v = v == null ? v : v[sg];
        out[name] = v;
        continue;
      }
      out[part] = row[part];
    }
    return clone(out);
  };
  const q = (name) => {
    let rows = () => tables[name] || (tables[name] = []);
    const st = { sel: '*', filters: [], range: null, limit: null, op: null, payload: null };
    const api = {
      select(s) { st.sel = s; return api; },
      or(expr) { st.filters.push(r => expr.split(',').some(cl => {
        const [col, op, val] = cl.split('.');
        if (op === 'is') return r[col] == null;
        if (op === 'lt') return r[col] != null && String(r[col]) < cl.slice(cl.indexOf('lt.') + 3);
        return true; })); return api; },
      eq(c, v) { st.filters.push(r => r[c] === v); return api; },
      gte(c, v) { st.filters.push(r => String(r[c]) >= String(v)); return api; },
      in(c, list) { const s = new Set(list); st.filters.push(r => s.has(r[c])); return api; },
      order(c, o) { st.order = [c, o]; return api; },
      limit(n) { st.limit = n; return api; },
      range(a, b) { st.range = [a, b]; return api; },
      upsert(payload) { st.op = 'upsert'; st.payload = payload; return api; },
      update(payload) { st.op = 'update'; st.payload = payload; return api; },
      delete() { st.op = 'delete'; return api; },
      then(res, rej) { return api.run().then(res, rej); },
      async run() {
        let out = rows().filter(r => st.filters.every(f => f(r)));
        if (st.op === 'upsert') {
          const list = Array.isArray(st.payload) ? st.payload : [st.payload];
          for (const p of list) {
            const key = JSON.stringify([p.user_id, p.task_id]);
            const i = rows().findIndex(r => JSON.stringify([r.user_id, r.task_id]) === key);
            if (i >= 0) rows()[i] = { ...rows()[i], ...p }; else rows().push({ ...p });
            log.push('upsert ' + name + ' ' + p.task_id);
          }
          return { data: null, error: null };
        }
        if (st.op === 'update') {
          for (const r of out) Object.assign(r, st.payload);
          return { data: null, error: null };
        }
        if (st.op === 'delete') {
          // ต้องลบในก้อนเดิม ไม่ใช่สร้างก้อนใหม่ทับ — เทสต์ถือ reference ของก้อนเดิมอยู่
          const keep = rows().filter(r => !out.includes(r));
          rows().length = 0; rows().push(...keep);
          return { data: null, error: null };
        }
        if (st.order) out = [...out].sort((a, b) => String(a[st.order[0]]).localeCompare(String(b[st.order[0]])));
        if (st.range) out = out.slice(st.range[0], st.range[1] + 1);
        if (st.limit) out = out.slice(0, st.limit);
        return { data: out.map(r => pick(r, st.sel)), error: null };
      },
    };
    return api;
  };
  return { from: q };
}
