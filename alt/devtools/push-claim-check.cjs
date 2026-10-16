// เครื่องที่สลับบัญชีต้องย้ายสิทธิ์รับแจ้งเตือนตามไป — ฝั่งแอป (คู่กับ supabase/tests/push_claim.test.mjs)
// รัน: node alt/devtools/push-claim-check.cjs
// ดึงฟังก์ชันจริงสองตัวออกจาก alt/app.js มารันกับ supabase จำลอง ไม่ได้เขียนสำเนาขึ้นใหม่
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// อาร์กิวเมนต์แรก = ไฟล์ app.js ที่จะตรวจ (บิลด์ราก) · ไม่ใส่ = alt/app.js
const src = fs.readFileSync(process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', 'app.js'), 'utf8')
  .split('\r\n').join('\n');
function grab(name) {
  const i = src.indexOf(`async function ${name}(`);
  if (i < 0) return null;
  // ฟังก์ชันระดับบนสุดจบที่ "\n}" ตัวแรกหลังหัวฟังก์ชัน (สไตล์ของไฟล์นี้)
  return src.slice(i, src.indexOf('\n}', i) + 2);
}

const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });

const saveSrc = grab('pushSaveRow');
const forgetSrc = grab('pushForgetDevice');
check('alt/app.js มี pushSaveRow', !!saveSrc, 'ไม่เจอฟังก์ชัน');
check('alt/app.js มี pushForgetDevice', !!forgetSrc, 'ไม่เจอฟังก์ชัน');

function sandbox({ rpcError = null, rpcData = 'moved', upsertError = null, hasSub = true } = {}) {
  const calls = [];
  const sb = {
    rpc: async (fn, args) => { calls.push(['rpc', fn, args]); return { data: rpcError ? null : rpcData, error: rpcError }; },
    from: (t) => ({
      upsert: async (row, opts) => { calls.push(['upsert', t, row, opts]); return { error: upsertError }; },
      delete: () => ({ eq: async (c, v) => { calls.push(['delete', t, c, v]); return { error: null }; } }),
    }),
  };
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/dev-1', unsubscribe: async () => { calls.push(['unsubscribe']); } };
  const ctx = vm.createContext({
    sb, currentUser: { id: 'user-b' }, pushErr: '', console: { warn() {} },
    navigator: { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: async () => (hasSub ? sub : null) } }) } },
    pushSupported: () => true,
    withTimeout: (p) => p,
  });
  vm.runInContext(`${saveSrc || ''}\n${forgetSrc || ''}\nvar __get = () => pushErr;`, ctx);
  return { ctx, calls };
}
const J = { endpoint: 'https://fcm.googleapis.com/fcm/send/dev-1', keys: { p256dh: 'P1', auth: 'S1' } };

(async () => {
  if (saveSrc) {
    // 1) ฟังก์ชันใหม่มีบนเซิร์ฟเวอร์ → ใช้มัน ไม่ upsert ตรง (upsert ตรงคือทางที่ชน RLS)
    {
      const { ctx, calls } = sandbox();
      const ok = await ctx.pushSaveRow(J);
      check('เรียก claim_push_subscription พร้อมกุญแจของ subscription', ok === true && calls[0]?.[0] === 'rpc'
        && calls[0][1] === 'claim_push_subscription' && calls[0][2].p_endpoint === J.endpoint
        && calls[0][2].p_p256dh === 'P1' && calls[0][2].p_auth === 'S1', JSON.stringify(calls));
      check('ไม่ upsert ตรงเมื่อฟังก์ชันใช้ได้', !calls.some(c => c[0] === 'upsert'), JSON.stringify(calls));
    }
    // 2) ยังไม่ได้รัน migration (PostgREST ตอบ PGRST202) → ถอยไปใช้ upsert แบบเดิม แอปต้องไม่แย่ลง
    {
      const { ctx, calls } = sandbox({ rpcError: { code: 'PGRST202', message: 'Could not find the function' } });
      const ok = await ctx.pushSaveRow(J);
      check('ไม่มีฟังก์ชันบนเซิร์ฟเวอร์ → ถอยไป upsert เดิม', ok === true && calls.some(c => c[0] === 'upsert'), JSON.stringify(calls));
    }
    // 3) กุญแจไม่ตรง / ล้มอื่น ๆ → บอกว่าบันทึกไม่ได้ และไม่ลองทางที่รู้อยู่แล้วว่าจะชน RLS
    {
      const { ctx, calls } = sandbox({ rpcError: { code: '42501', message: 'key mismatch' } });
      const ok = await ctx.pushSaveRow(J);
      check('ฟังก์ชันปฏิเสธ → คืน false พร้อมข้อความ', ok === false && ctx.__get() === 'บันทึกขึ้นเซิร์ฟเวอร์ไม่ได้', JSON.stringify([ok, ctx.__get()]));
      check('ฟังก์ชันปฏิเสธ → ไม่ upsert ตรงต่อ', !calls.some(c => c[0] === 'upsert'), JSON.stringify(calls));
    }
  }
  if (forgetSrc) {
    // 4) ออกจากระบบ → ลบแถวของเครื่องนี้ (แจ้งเตือนของบัญชีที่ออกไปต้องไม่เด้งที่นี่อีก)
    //    แต่ไม่ถอน subscription ในเบราว์เซอร์ — บัญชีถัดไปที่ล็อกอินจะได้ใช้ต่อโดยไม่ต้องขอสิทธิ์ใหม่
    {
      const { ctx, calls } = sandbox();
      await ctx.pushForgetDevice();
      check('ออกจากระบบ → ลบแถวของเครื่องนี้', calls.some(c => c[0] === 'delete' && c[1] === 'push_subscriptions' && c[3] === J.endpoint), JSON.stringify(calls));
      check('ออกจากระบบ → ไม่ถอน subscription ในเบราว์เซอร์', !calls.some(c => c[0] === 'unsubscribe'), JSON.stringify(calls));
    }
    {
      const { ctx, calls } = sandbox({ hasSub: false });
      let threw = false;
      try { await ctx.pushForgetDevice(); } catch (_) { threw = true; }
      check('ไม่มี subscription → ไม่พัง ไม่ลบอะไร', !threw && !calls.some(c => c[0] === 'delete'), JSON.stringify(calls));
    }
  }
  // 5) logout ต้องลบแถว "ก่อน" signOut — หลัง signOut ไม่มีสิทธิ์ลบแถวของตัวเองแล้ว (RLS)
  {
    const i = src.indexOf('async function logout(');
    const body = src.slice(i, src.indexOf('\n}', i));
    const a = body.indexOf('pushForgetDevice('), b = body.indexOf('sb.auth.signOut(');
    check('logout ลบแถวของเครื่องก่อน signOut', a > 0 && b > 0 && a < b, `forget@${a} signOut@${b}`);
  }
  // 6) subscribePush บันทึกผ่าน pushSaveRow ไม่ upsert ตรงเองอีก
  {
    const i = src.indexOf('async function subscribePush(');
    const body = src.slice(i, src.indexOf('\n}', i));
    check('subscribePush บันทึกผ่าน pushSaveRow', body.includes('pushSaveRow(') && !body.includes(".upsert("), 'ยังมี upsert ตรงใน subscribePush');
  }

  const pass = results.filter(r => r.pass).length;
  for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   → ' + r.detail));
  console.log(`\n${pass}/${results.length} ผ่าน`);
  process.exit(pass === results.length ? 0 : 1);
})();
