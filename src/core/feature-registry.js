// ============================================================
// Feature registry · โหลดฟีเจอร์ตอนใช้ครั้งแรก (lazy loading) — 7 พ.ย. 69
// ------------------------------------------------------------
// ทำไมมีไฟล์นี้: index.html โหลดสคริปต์ 60 ไฟล์ทันทีตอนเปิดแอป ทั้งที่บางไฟล์ใช้แค่ตอนกดเท่านั้น
// ไฟล์นี้ให้ฟีเจอร์แบบนั้น "ลงทะเบียน" ไว้ก่อน: สร้างฟังก์ชันตัวแทน (stub) ชื่อเดียวกับของจริงบน window
// เรียกครั้งแรก = โหลดไฟล์จริงด้วย <script> คลาสสิก → function ระดับบนสุดของไฟล์จริงเขียนทับตัวแทนเอง
// แล้วส่งต่อคำสั่งเดิมไปที่ของจริง · โค้ดที่เรียก (เช่น hoop.js) ไม่ต้องรู้ว่าโหลดแล้วหรือยัง
//
// กติกา (อย่าแก้โดยไม่รู้เหตุผล):
//   • ใช้ได้เฉพาะฟีเจอร์ที่ไฟล์จริง "ไม่ทำอะไรตอนโหลด" นอกจากประกาศฟังก์ชัน/ข้อมูล
//     (ตรวจด้วยการรันไฟล์ใน vm เปล่า — ดู devtools/feature-registry.test.mjs)
//   • ของที่ export ต้องเป็น function — ค่าคงที่ (const) ที่โค้ดอื่นอ่านทันทีห้ามลงทะเบียนแบบนี้
//   • ไฟล์จริงต้องอยู่ใน SHELL ของ sw.js ต่อไป → เปิดออฟไลน์แล้วยังเล่นได้
//   • กดซ้ำระหว่างกำลังโหลด = คำสั่งเดียว (เหมือน fxOpenNow ใน hoop.js กันเปิดซ้ำ)
//   • โหลดไม่ได้ = เรียก fallback (เช่นเล่นแบบ 2D) แล้วครั้งหน้าลองโหลดใหม่ ไม่ค้างสถานะพัง
//   • ห้ามใส่ฟีเจอร์ที่เกี่ยวกับรางวัล/โทเคน/ข้อมูลผู้ใช้ — ตัวแทนไม่รู้กติกาเศรษฐกิจ
// ============================================================
(function (root) {
  'use strict';

  function scriptLoader(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { s.remove(); reject(new Error('โหลดไม่ได้: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function create(opts) {
    const scope = (opts && opts.scope) || root;
    const loadScript = (opts && opts.loadScript) || scriptLoader;
    const features = new Map();

    function define(name, spec) {
      if (features.has(name)) return;           // ลงทะเบียนซ้ำ = ไม่ทำอะไร (กัน init ซ้ำ)
      const exportsList = spec.exports || [];
      const f = { status: 'idle', promise: null, pending: null, stubs: {} };
      features.set(name, f);

      f.load = () => {
        if (f.status === 'ready') return Promise.resolve(true);
        if (f.promise) return f.promise;
        f.status = 'loading';
        f.promise = Promise.resolve()
          .then(() => loadScript(spec.src))
          .then(() => {
            const missing = exportsList.filter(n => typeof scope[n] !== 'function' || scope[n] === f.stubs[n]);
            if (missing.length) throw new Error(spec.src + ' ไม่มี ' + missing.join(', '));
            f.status = 'ready';
            return true;
          })
          .catch(e => { f.status = 'failed'; f.promise = null; throw e; });
        return f.promise;
      };

      const already = exportsList.length && exportsList.every(n => typeof scope[n] === 'function');
      if (already) { f.status = 'ready'; return; }  // โหลดมาแล้วแบบเดิม (เช่น ถอดตัวโหลดกลับ) = ไม่สร้างตัวแทน

      for (const n of exportsList) {
        const stub = function () {
          if (f.pending) return f.pending;
          const args = Array.prototype.slice.call(arguments);
          f.pending = f.load().then(
            () => scope[n].apply(this, args),
            e => {
              if (scope.console) scope.console.warn('[feature:' + name + ']', e && e.message);
              return spec.fallback ? spec.fallback(n, args, e) : undefined;
            }
          ).finally(() => { f.pending = null; });
          return f.pending;
        };
        f.stubs[n] = stub;
        scope[n] = stub;
      }
    }

    return {
      define,
      load(name) { const f = features.get(name); return f ? f.load() : Promise.reject(new Error('ไม่รู้จักฟีเจอร์ ' + name)); },
      status(name) { const f = features.get(name); return f ? f.status : 'unknown'; },
      list() { return Array.from(features.keys()); },
    };
  }

  // ---------- FEATURE MANIFEST · ฟีเจอร์ที่โหลดตอนใช้ ----------
  // เพิ่มฟีเจอร์ใหม่: อ่าน docs/ARCHITECTURE.md › "ย้ายฟีเจอร์ไปโหลดตอนใช้" ก่อน
  const manifest = {
    // เอฟเฟกต์ 3D ตอนงานเสร็จ (165 KB) — เปิดจาก openDoneFx / previewFx3d ใน hoop.js เท่านั้น
    // โหลดไม่ได้ = เล่นแบบ 2D เหมือน fx3dFallback ใน fx3d.js
    fx3d: {
      src: 'fx3d.js',
      exports: ['open3D'],
      fallback(_name, args) {
        const id = args[0], title = args[1], onClose = args[2], preview = args[3];
        if (id === 'hoop' && typeof root.openHoop === 'function') return root.openHoop(title, onClose, preview);
        if (typeof root.openFxGame === 'function') return root.openFxGame(id, title, onClose, preview);
        if (onClose) onClose();
      },
    },
  };

  if (typeof module === 'object' && module.exports) { module.exports = { create, manifest }; return; }

  if (!root.StudentOSFeatures) {
    const api = create();
    for (const name of Object.keys(manifest)) api.define(name, manifest[name]);
    root.StudentOSFeatures = Object.freeze(Object.assign({ manifest, __createForTest: create }, api));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
