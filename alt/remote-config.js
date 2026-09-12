/* ============================================================
   remote-config — ค่าตั้งของแอปที่มาจากเซิร์ฟเวอร์  ·  *** ALT ***
   ------------------------------------------------------------
   เป้าหมายเดียว: เปลี่ยนพฤติกรรมของแอปได้โดยไม่ต้อง deploy

   กติกาสามข้อที่ไฟล์นี้ห้ามละเมิด เพราะทั้งสามข้อคือเส้นแบ่งระหว่าง
   "ค่าตั้งที่ปรับได้" กับ "แอปที่เปิดไม่ขึ้นเพราะเน็ตช้า":

   1. ค่าเริ่มต้นอยู่ในไฟล์นี้ และต้องให้ผลเหมือนแอปทุกวันนี้เป๊ะ
      เซิร์ฟเวอร์ล่ม · ยังไม่ได้ตั้งอะไร · เพิ่งติดตั้งครั้งแรก → แอปต้องเหมือนเดิม
   2. อ่านค่าได้ทันทีแบบ synchronous ตั้งแต่บรรทัดแรกที่สคริปต์นี้จบ
      engine.js เรียก priorityInfo() ได้ตั้งแต่ก่อน fetch จะกลับมา
      ถ้าต้องรอเน็ตก่อนถึงจะคิดคะแนนได้ แอปจะค้างที่จอเปิดทุกครั้งที่เน็ตช้า
   3. ของที่โหลดมาได้ถูกแคชลงเครื่อง — เปิดครั้งต่อไปได้ค่าล่าสุดทันทีตั้งแต่เฟรมแรก
      แล้วค่อยอัปเดตเงียบ ๆ ข้างหลัง

   คีย์แคชคือ studentos.alt.remoteConfig · เป็นคีย์ใหม่ ไม่ทับของเดิม
   ล้างทิ้งได้เสมอโดยไม่เสียข้อมูลผู้ใช้ เพราะมันเป็นแค่สำเนาของสิ่งที่อยู่บนเซิร์ฟเวอร์
   ============================================================ */
(function () {
  'use strict';

  var CACHE_KEY = 'studentos.alt.remoteConfig';
  var CHANNEL = 'live';

  /* ==================== ค่าเริ่มต้น ====================
     ตัวเลขทุกตัวในก้อนนี้ถูกเลือกให้ "ไม่เปลี่ยนอะไรเลย" เมื่อเทียบกับแอกรุ่น 1B82
     สไลเดอร์ใน Control Center ทำงานเป็นตัวคูณเทียบกับค่าเหล่านี้
     (ดู prioWeight ข้างล่าง) — ตั้งไว้ที่ค่าเริ่มต้น = ตัวคูณ 1.0 = พฤติกรรมเดิม
     ========================================================= */
  var DEFAULTS = {
    home: {
      /* ลำดับเดียวกับที่ renderMenu() ต่อสตริงอยู่ตอนนี้ (1B38) */
      blocks: [
        { id: 'todayHead',  on: true },
        { id: 'todayStats', on: true },
        { id: 'askBar',     on: true },
        { id: 'nowCard',    on: true },
        { id: 'dayRail',    on: true },
        { id: 'hwNowBlock', on: true },
        { id: 'toolsLink',  on: true }
      ]
    },

    /* ---------- ชิ้นส่วนภายในการ์ด ----------
       ละเอียดกว่า home.blocks หนึ่งชั้น: home จัดว่า "การ์ดไหนอยู่ตรงไหน"
       ส่วนตรงนี้จัดว่า "ในการ์ดใบนั้นมีอะไร เรียงยังไง"
       โซน (หัวการ์ด/ตัวการ์ด) ตายตัว ย้ายข้ามไม่ได้ — ดู NOW_PARTS ใน app.js ว่าทำไม */
    cards: {
      // โซนของแต่ละชิ้นอยู่ในโค้ด (NOW_PARTS · RAIL_PARTS · STATS_PARTS ใน app.js)
      // ตรงนี้เก็บแค่ลำดับกับเปิด/ปิด
      stats: [
        { id: 'free',    on: true },
        { id: 'pending', on: true },
        { id: 'streak',  on: true }
      ],
      rail: [
        { id: 'label', on: true },
        { id: 'rows',  on: true },
        { id: 'end',   on: true }
      ],
      now: [
        { id: 'top',      on: true },
        { id: 'title',    on: true },
        { id: 'route',    on: true },
        { id: 'why',      on: true },
        { id: 'progress', on: true },
        { id: 'actions',  on: true },
        { id: 'askDue',   on: true },
        { id: 'whyGo',    on: true }
      ]
    },

    /* 0–100 · ค่าที่เห็นนี้ = ตัวคูณ 1.0 (พฤติกรรมเดิมของ priorityInfo)
       ครึ่งหนึ่งของค่า = ครึ่งหนึ่งของน้ำหนัก · 0 = ตัดทิ้งจากการคิดคะแนน */
    prio: {
      deadline: 90,   // เส้นโค้ง urgencyScore()
      exam:     100,  // prepHours — สอบต้องเริ่มอ่านล่วงหน้า
      score:    80,   // คะแนนเก็บ
      hard:     50,   // ดาวที่ผู้ใช้กำหนดเอง
      size:     60,   // เวลาที่ต้องใช้
      overdue:  90    // เลยกำหนดแล้ว
    },

    features: {
      ocr: true, social: true, cloud: true, ttscan: true,
      shop: true, wheel: true, line: true
    },

    theme: {
      /* ว่าง = ใช้โทเคนที่อยู่ใน style.css/alt.css ตามเดิม
         ใส่ค่าเมื่อไหร่ = ทับเฉพาะตัวที่ใส่ ไม่ได้ทับทั้งชุด */
      colors: {},
      radius: null,      // px — --r-card
      spacing: null,     // 0.8–1.4 ตัวคูณระยะห่างของเนื้อหาในจอ
      fontScale: null,   // 0.85–1.3 ตัวคูณขนาดตัวอักษร (คูณทับค่าที่ผู้ใช้เลือกเอง)
      fontFamily: null,  // ชื่อฟอนต์ชุดแรกของ stack
      shadow: null       // 'none' | 'soft' | 'mid' | 'deep'
    },

    texts: {},           // id → ข้อความที่ทับของเดิม (ดู sosText)

    /* ---------- งานที่แก้ด้วยมือจาก Visual Editor ----------
       rules  : { 'ตัวเลือก CSS': { prop: value } }   — ทับสไตล์ของชิ้นนั้น
       tokens : { 'ชื่อธีม': { '--var': value } }      — ทับโทเคนเฉพาะธีมนั้น
       texts  : { 'ตัวเลือก CSS': 'ข้อความใหม่' }

       รูปเดียวกับที่ visual-editor.js ใช้อยู่แล้วเป๊ะ ๆ โดยตั้งใจ —
       ของเดิมมันเก็บลง localStorage ของเครื่องเดียว ตรงนี้คือทางที่ทำให้
       สิ่งที่เจ้าของระบบแก้ด้วยมือ เดินทางไปถึงเครื่องของทุกคน */
    ui: { rules: {}, tokens: {}, texts: {} },

    noti: {
      flags: { exam: true, urgent: true, overdue: true, daily: false, streak: false },
      // ว่าง = ส่งตามจังหวะของงานเหมือนเดิม (ไม่จำกัดหน้าต่างเวลา)
      // ใส่เวลาเมื่อไหร่ = ส่งเฉพาะ ±15 นาทีรอบเวลานั้น · ดู inSendWindow() ใน send-reminders
      // ค่าเริ่มต้นต้องเป็นว่าง ไม่ใช่ '18:00' — ตั้งเวลาเดียวเป็นค่าเริ่มต้นแปลว่า
      // แค่รัน migration ก็ตัดการเตือนของทุกคนเหลือวันละหน้าต่างเดียวโดยไม่มีใครสั่ง
      times: [],
      examDays: 3,
      quietAfter: '22:00',
      templates: {},     // id → ข้อความแจ้งเตือน (ใช้ {{...}} แทนค่า)
      rules: []
    },

    ocr: {
      provider: 'google-vision',
      confidence: 80,    // เส้น auto-file — ดูหมายเหตุใน Control Center ก่อนลด
      retries: 1,
      timeout: 20,
      autoRetry: true,
      autoFile: true,
      keepImg: false
    },

    ai: {
      prompt: '', rules: '',      // ว่าง = ใช้พรอมป์ที่ฝังอยู่ใน Edge Function
      provider: 'gemini-flash', temp: 0.4, maxTokens: 800, dailyCap: 40
    },

    exp: { on: false, id: '', a: '', b: '', split: 50 }
  };

  /* ==================== รวมค่า ====================
     รวมแบบลึก แต่ "อาเรย์ทับทั้งก้อน" โดยตั้งใจ —
     ลำดับบล็อกหน้าแรกคืออาเรย์ที่ความหมายอยู่ที่ลำดับ
     ถ้ารวมทีละช่องจะได้ลำดับที่ไม่มีใครตั้งใจให้เป็น
     ================================================= */
  function merge(base, over) {
    if (over === null || over === undefined) return base;
    if (Array.isArray(base) || Array.isArray(over)) return over;
    if (typeof base !== 'object' || typeof over !== 'object') return over;
    var out = {}, k;
    for (k in base) out[k] = base[k];
    for (k in over) out[k] = (k in base) ? merge(base[k], over[k]) : over[k];
    return out;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var overrides = {};
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (raw) overrides = JSON.parse(raw).data || {};
  } catch (e) {}

  window.SOSCFG = merge(clone(DEFAULTS), overrides);
  window.SOSCFG_DEFAULTS = clone(DEFAULTS);

  /* อ่านค่าด้วยเส้นทาง: sosCfg('prio.deadline') · ไม่เจอ → คืน fallback */
  window.sosCfg = function (path, fb) {
    var cur = window.SOSCFG, parts = String(path).split('.'), i;
    for (i = 0; i < parts.length; i++) {
      if (cur === null || typeof cur !== 'object' || !(parts[i] in cur)) return fb;
      cur = cur[parts[i]];
    }
    return (cur === null || cur === undefined) ? fb : cur;
  };

  /* ---------- น้ำหนักลำดับงาน ----------
     คืนตัวคูณเทียบค่าเริ่มต้น · engine.js เรียกตัวนี้ตัวเดียว
     ค่าเริ่มต้น → 1 เสมอ แปลว่าไฟล์ที่ยังไม่ได้ตั้งอะไรทำงานเหมือนก่อนมีระบบนี้ */
  window.prioWeight = function (key) {
    var d = DEFAULTS.prio[key];
    if (!d) return 1;
    var v = window.sosCfg('prio.' + key, d);
    if (typeof v !== 'number' || !isFinite(v) || v < 0) return 1;
    return v / d;
  };

  /* ---------- ฟีเจอร์เปิดอยู่ไหม ----------
     ไม่รู้จัก = เปิด · ฟีเจอร์ใหม่ที่ยังไม่มีในค่าตั้งต้องใช้งานได้ทันที
     ไม่ใช่ถูกปิดเงียบ ๆ เพราะไม่มีใครไปเพิ่มชื่อมันในตาราง */
  window.sosFeature = function (id) {
    var v = window.sosCfg('features.' + id, true);
    return v !== false;
  };

  /* ---------- ข้อความที่ทับได้ ----------
     sosText('nowTitle', 'ตอนนี้ควรทำอะไร') — ไม่ได้ตั้ง = ได้ของเดิม
     ค่าเริ่มต้นอยู่ที่จุดเรียกใช้ ไม่ได้อยู่ในไฟล์นี้ เพราะข้อความควรอ่านเจอ
     ตรงที่มันถูกใช้ ไม่ใช่ต้องเปิดอีกไฟล์ไปเทียบ */
  window.sosText = function (id, fb) {
    var v = window.sosCfg('texts.' + id, null);
    return (typeof v === 'string' && v.trim()) ? v : fb;
  };

  /* ==================== ธีม ====================
     เขียนเป็น CSS custom property ทับที่ :root
     ทับเฉพาะตัวที่ตั้งไว้จริง — ธีมมืด/ธีมอุ่นที่ไม่ได้ถูกแตะจึงยังทำงานเหมือนเดิม
     ================================================= */
  var SHADOWS = {
    none: 'none',
    soft: '0 1px 2px rgba(31,36,48,.04)',
    mid:  '0 1px 2px rgba(31,36,48,.04), 0 12px 28px -12px rgba(31,36,48,.16)',
    deep: '0 2px 6px rgba(31,36,48,.07), 0 26px 50px -14px rgba(31,36,48,.30)'
  };
  var COLOR_VAR = {
    blue: '--blue', good: '--good', warn: '--warn', alert: '--alert',
    scr: '--scr', card: '--card', ink: '--ink'
  };

  function applyTheme() {
    var t = window.SOSCFG.theme || {}, css = [], k;
    var c = t.colors || {};
    for (k in c) {
      if (COLOR_VAR[k] && /^#[0-9a-f]{3,8}$/i.test(String(c[k]))) {
        css.push(COLOR_VAR[k] + ':' + c[k] + ';');
        /* สีเน้นมีสองบทบาทที่ใช้ค่าเดียวกันไม่ได้ (ตัวอักษรบนพื้นขาว · พื้นทึบ)
           แต่ถ้าเจ้าของระบบเปลี่ยนสีเน้น เขาหมายถึงทั้งสองที่แน่นอน */
        if (k === 'blue') css.push('--fill:' + c[k] + ';--neon:' + c[k] + ';');
      }
    }
    if (typeof t.radius === 'number') {
      css.push('--r-card:' + t.radius + 'px;');
      css.push('--r-tile:' + Math.max(6, Math.round(t.radius * 0.7)) + 'px;');
    }
    if (t.shadow && SHADOWS[t.shadow]) css.push('--shadow:' + SHADOWS[t.shadow] + ';');
    if (typeof t.spacing === 'number') css.push('--cc-space:' + t.spacing + ';');
    if (typeof t.fontScale === 'number') css.push('--cc-fs:' + t.fontScale + ';');

    var extra = '';
    if (t.fontFamily) {
      extra += 'body,button,input,textarea,select{font-family:' +
        JSON.stringify(String(t.fontFamily)) +
        ',"IBM Plex Sans Thai","Leelawadee UI","Noto Sans Thai",-apple-system,sans-serif}';
    }
    /* ระยะห่าง: ขยับที่เดียวคือช่องไฟระหว่างก้อนในจอ
       ดีไซน์กำหนดขนาดเป็น px ทุกจุด การไล่คูณทุกที่จึงทำให้จอพังมากกว่าจะสวยขึ้น */
    if (typeof t.spacing === 'number' && t.spacing !== 1) {
      extra += '.scr-body,.menu-body,.home-body{padding-top:calc(14px * ' + t.spacing +
        ');padding-bottom:calc(14px * ' + t.spacing + ')}';
    }

    /* ---------- สไตล์ที่แก้ด้วยมือ ----------
       ต่อท้ายโทเคน เพราะมันต้องชนะโทเคน: คนที่ไปแตะชิ้นนั้นด้วยมือ ตั้งใจให้ชิ้นนั้น
       เป็นแบบนั้นจริง ๆ ไม่ใช่ให้ธีมมาตัดสินแทน · ใช้ !important ด้วยเหตุผลเดียวกับ
       ที่ visual-editor.js ใช้: ตัวเลือกที่มันสร้างมักสู้ตัวเลือกใน alt.css ไม่ได้ */
    var rules = (window.SOSCFG.ui && window.SOSCFG.ui.rules) || {};
    for (k in rules) {
      var decl = rules[k], body = '', prop;
      if (!decl || typeof decl !== 'object') continue;
      for (prop in decl) body += prop + ':' + decl[prop] + ' !important;';
      if (body) extra += k + '{' + body + '}';
    }

    var el = document.getElementById('sos-remote-theme');
    if (!el) {
      el = document.createElement('style');
      el.id = 'sos-remote-theme';
      (document.head || document.documentElement).appendChild(el);
    }
    /* ---------- ทำไมต้อง :root สามชั้น ----------
       ธีมของแอปประกาศโทเคนไว้ที่ `:root[data-theme="light"]` (ค่าเฉพาะเจาะจง 0,2,0)
       ส่วน `:root` เปล่า ๆ อยู่ที่ (0,1,0) — แพ้เสมอ ไม่ว่าจะฉีดทีหลังแค่ไหน
       อาการที่ได้คือ "เปลี่ยนสีใน Theme Studio แล้วบางสีไม่ยอมเปลี่ยน" ซึ่งดูเหมือน
       ระบบพัง ทั้งที่ค่าเดินทางมาถึงเรียบร้อยแล้ว (เจอจริงตอนทดสอบ: --blue กับ --r-card
       ไม่ขยับ ส่วนตัวอื่นขยับหมด)
       :root ซ้ำสามครั้งได้ (0,3,0) ชนะทุกธีม และยังแมตช์ <html> เสมอไม่ว่าจะตั้ง
       data-theme ไว้หรือไม่ — ต่างจากการเขียน [data-theme] ที่จะพลาดตอนไม่มีแอตทริบิวต์ */
    el.textContent = (css.length ? ':root:root:root{' + css.join('') + '}' : '') + extra;
  }
  /* ---------- โทเคนรายธีม + ข้อความที่แก้ด้วยมือ ----------
     โทเคนเขียนเป็น inline style บน <html> เหมือนที่ visual-editor.js ทำ เพราะมันต้อง
     เปลี่ยนตามธีมที่ผู้ใช้เลือกอยู่ ไม่ใช่ตายตัวก้อนเดียว */
  var liveTokens = [];
  function applyUiTokens() {
    var r = document.documentElement, i;
    for (i = 0; i < liveTokens.length; i++) r.style.removeProperty(liveTokens[i]);
    liveTokens = [];
    var all = (window.SOSCFG.ui && window.SOSCFG.ui.tokens) || {};
    var t = all[r.getAttribute('data-theme') || 'light'] || {};
    for (var n in t) {
      if (/^--[\w-]+$/.test(n)) { r.style.setProperty(n, t[n]); liveTokens.push(n); }
    }
  }

  /* ข้อความต้องทาซ้ำ เพราะแอปเขียนทับ innerHTML ทั้งก้อนทุกครั้งที่วาดใหม่ (ทุกนาที
     และทุกครั้งที่ข้อมูลเปลี่ยน) · ตัวจับเวลาเดินเฉพาะตอนมีข้อความที่ตั้งไว้จริง —
     เด็กที่เจ้าของระบบไม่ได้แก้ข้อความอะไรเลย จะไม่มี timer เดินในเครื่องเขาสักตัว */
  var textTimer = null;
  function applyUiTexts() {
    var map = (window.SOSCFG.ui && window.SOSCFG.ui.texts) || {};
    for (var sel in map) {
      try {
        var e = document.querySelector(sel);
        if (!e) continue;
        if (e.getAttribute('contenteditable')) continue;
        /* ชิ้นที่มีลูกเป็นอิลิเมนต์ ห้ามเขียนทับ — ไม่งั้นลูกหายทั้งกิ่ง
           (กติกาเดียวกับ visual-editor.js ซึ่งเจอปัญหานี้มาแล้ว) */
        var hasEl = false, c;
        for (c = 0; c < e.childNodes.length; c++) {
          if (e.childNodes[c].nodeType === 1) { hasEl = true; break; }
        }
        if (hasEl) continue;
        if (e.textContent !== map[sel]) e.textContent = map[sel];
      } catch (x) {}
    }
  }
  function scheduleTexts() {
    var map = (window.SOSCFG.ui && window.SOSCFG.ui.texts) || {};
    var any = false, kk;
    for (kk in map) { any = true; break; }
    if (any && !textTimer) textTimer = setInterval(applyUiTexts, 2500);
    if (!any && textTimer) { clearInterval(textTimer); textTimer = null; }
    if (any) applyUiTexts();
  }

  function applyAll() { applyTheme(); applyUiTokens(); scheduleTexts(); }
  applyAll();
  window.sosApplyTheme = applyAll;

  /* ==================== โหลดจากเซิร์ฟเวอร์ ====================
     ใช้ fetch ตรง ๆ ไม่ผ่าน supabase-js เพราะไฟล์นี้ต้องทำงานได้ก่อนที่
     ไลบรารีจะพร้อม และ policy ของตารางนี้เปิดให้ anon อ่านได้อยู่แล้ว
     ล้มเหลวเมื่อไหร่ = เงียบ แล้วใช้แคช/ค่าเริ่มต้นต่อ — ไม่มีทางที่จอจะค้างเพราะไฟล์นี้
     ============================================================= */
  function announce(source) {
    applyAll();
    try {
      window.dispatchEvent(new CustomEvent('sos-config', { detail: { source: source } }));
    } catch (e) {}
  }

  function load() {
    var c = window.SUPABASE_CONFIG || {};
    if (!c.url || !c.anonKey || typeof fetch !== 'function') return Promise.resolve(false);

    var url = c.url.replace(/\/+$/, '') +
      '/rest/v1/app_config?select=data,version&channel=eq.' + encodeURIComponent(CHANNEL);

    /* 8 วินาทีแล้วเลิกรอ — ค่าตั้งไม่ใช่ของที่คุ้มกับการทำให้แอปเปิดช้า */
    var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);

    return fetch(url, {
      headers: { apikey: c.anonKey, Authorization: 'Bearer ' + c.anonKey },
      signal: ctl ? ctl.signal : undefined,
      cache: 'no-store'
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        clearTimeout(timer);
        if (!rows || !rows.length || !rows[0].data) return false;
        var data = rows[0].data;
        delete data.__label;
        overrides = data;
        window.SOSCFG = merge(clone(DEFAULTS), overrides);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: data, version: rows[0].version, at: Date.now()
          }));
        } catch (e) {}
        announce('server');
        return true;
      })
      .catch(function () { clearTimeout(timer); return false; });
  }

  window.sosConfigReload = load;
  window.sosConfigRaw = function () { return clone(overrides); };

  /* ==================== โหมดพรีวิว ====================
     Control Center ฝังแอปนี้ไว้ใน iframe เพื่อให้ "ลากแล้วเห็นของจริงเปลี่ยน"
     ไม่ใช่เห็นภาพวาดของแอป · โหมดนี้ต่างจากปกติสามอย่าง และทั้งสามอย่างจำเป็น:

     1. **ไม่โหลดจากเซิร์ฟเวอร์** — ค่าที่ต้องเห็นคือค่าที่กำลังลากอยู่ ไม่ใช่ค่าที่เผยแพร่แล้ว
     2. **ไม่เขียนแคชเด็ดขาด** — นี่คือข้อที่พลาดแล้วเจ็บที่สุด: iframe ใช้ localStorage
        ก้อนเดียวกับแอปจริงของคนที่เปิดอยู่ (โดเมนเดียวกัน) เผลอเขียนเมื่อไหร่
        ค่าที่ยัง "ลากเล่นอยู่" จะกลายเป็นค่าจริงบนเครื่องเขาทันทีโดยไม่มีใครกดเผยแพร่
     3. **ไม่ฟัง visibilitychange** — ไม่งั้นสลับแท็บกลับมาแล้วค่าที่ลากไว้ถูกทับด้วยของเซิร์ฟเวอร์

     เงื่อนไขต้องอยู่ใน iframe ก่อนเสมอ แล้วดูสัญญาณอีกชั้น — แอปนี้ถูกฝังที่อื่นได้
     และหน้าไหนก็ตั้งคิวรีเองได้ ข้อเดียวจึงไม่พอ

     **ห้ามพึ่งคิวรีอย่างเดียวเด็ดขาด** — เจอมาแล้วตอนทดสอบ:
       app.js ลบคิวรีทิ้งตอนบูต (history.replaceState) แล้วพอ service worker
       เข้าคุมครั้งแรก มันสั่ง location.reload() ด้วย URL ที่ถูกลบไปแล้ว
       พรีวิวจึงกลายเป็นแอปธรรมดาเงียบ ๆ — ซึ่งอันตราย เพราะมันจะเริ่มเขียนแคช
       ทับค่าจริงบนเครื่องของคนที่กำลังเปิด Control Center อยู่
     ตัวที่เชื่อได้คือธงบนหน้าแม่ ซึ่งอยู่รอดทุกการรีโหลดของ iframe
     (ข้ามโดเมนจะโยน error ตอนแตะ parent — catch แล้วถือว่าไม่ใช่พรีวิว ซึ่งปลอดภัยกว่า)
     ===================================================== */
  var PREVIEW = false;
  try {
    PREVIEW = window.parent !== window
      && (window.parent.__SOS_CONTROL_PREVIEW__ === true
          || /[?&]sosPreview=1/.test(location.search));
  } catch (e) { PREVIEW = false; }
  window.SOS_PREVIEW = PREVIEW;

  if (PREVIEW) {
    /* ตัวแก้ดีไซน์โหลดเฉพาะในพรีวิว — ไฟล์มันหนัก ~50KB และเด็กไม่เคยต้องใช้
       การใส่ไว้ใน index.html ถาวรแปลว่าทุกคนโหลดของที่มีคนเดียวที่ได้ใช้ */
    var uiSeeded = false;
    function loadEditor() {
      if (document.getElementById('sos-ve-script')) return;
      var sc = document.createElement('script');
      sc.id = 'sos-ve-script';
      sc.src = 'visual-editor.js';
      sc.onload = function () {
        if (!window.sosVE) return;
        /* ใส่ของที่เผยแพร่ไว้แล้วกลับเข้าไป เพื่อให้เปิดมาแก้ต่อได้ ไม่ใช่เริ่มจากศูนย์ */
        if (!uiSeeded) { window.sosVE.set((window.SOSCFG.ui) || {}); uiSeeded = true; }
        window.sosVE.onChange = function (ui) {
          try { window.parent.postMessage({ type: 'sos-preview-ui', ui: ui }, location.origin); }
          catch (e) {}
        };
      };
      document.body.appendChild(sc);
    }

    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin) return;          // หน้าอื่นห้ามสั่ง
      var d = e.data;
      if (!d || d.type !== 'sos-preview-config') return;
      overrides = (d.config && typeof d.config === 'object') ? d.config : {};
      window.SOSCFG = merge(clone(DEFAULTS), overrides);
      announce('preview');
      /* โหลดตัวแก้ดีไซน์หลังได้ค่าตั้งก้อนแรก — โหลดก่อนหน้านั้นแล้วมันจะ seed ด้วยของว่าง
         แล้วทับงานที่เคยเผยแพร่ไว้ทิ้งทันทีที่มีการแก้ครั้งแรก */
      loadEditor();
    });

    /* หน้าแม่สั่งให้ไปจอไหน — แก้ Home Builder อยู่แล้วมองเห็นจออื่น คือพรีวิวที่ไม่ได้ช่วยอะไร
       ผลข้างเคียงคือคีย์ "จอล่าสุด" ถูกเขียน ซึ่งเท่ากับผู้ใช้กดแท็บเองในแอปของตัวเอง
       ไม่ใช่ข้อมูลที่หายได้ · ยอมแลกกับการได้เห็นสิ่งที่กำลังแก้อยู่จริง ๆ */
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin) return;
      var d = e.data;
      if (!d || d.type !== 'sos-preview-screen' || !d.id) return;
      try { if (typeof window.go === 'function') window.go(d.id); } catch (x) {}
    });
    /* บอกหน้าแม่ว่าพร้อมรับแล้ว — หน้าแม่ส่งก่อนที่ไฟล์นี้จะรันเสร็จไม่ได้
       และการให้หน้าแม่ยิงซ้ำ ๆ เผื่อไว้ แพงกว่าจับมือกันหนึ่งครั้ง */
    try { window.parent.postMessage({ type: 'sos-preview-ready' }, location.origin); } catch (e) {}
  } else {
    /* ยิงทันที ไม่รอ DOMContentLoaded — ยิ่งกลับมาเร็ว จอแรกยิ่งมีโอกาสได้ค่าจริง */
    load();

    /* กลับมาเปิดแอปอีกครั้งหลังพับไว้นาน = จังหวะที่ถูกที่สุดในการเช็คค่าใหม่
       ไม่ตั้ง interval เพราะค่าตั้งไม่ได้เปลี่ยนบ่อยพอจะคุ้มกับการยิงทุกนาที */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') load();
    });
  }
})();
