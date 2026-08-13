/* ================================================================
   StudentOS — Visual Editor  v3  "ง่ายที่สุด"
   ----------------------------------------------------------------
   • แตะชิ้นไหน → แถบเครื่องมือเด้งมาข้าง ๆ ชิ้นนั้นเลย ไม่ต้องเลื่อนหา
   • ใช้ได้ทั้งเมาส์และนิ้ว — ตอนแก้อยู่ก็ยังเลื่อนจอได้ตามปกติ
   • ปุ่ม ✋ = พักการแก้ชั่วคราว ไปกดใช้แอปจริง (เปลี่ยนหน้า/เปิดเมนู) แล้วกลับมาแก้ต่อ
   • ปุ่มใหญ่ กดทีเดียวเห็นผล  (ใหญ่ขึ้น / มนขึ้น / ห่างขึ้น / สี)
   • ประวัติทุกก้าว ย้อนกลับไปจุดไหนก็ได้ (Time Travel) — ปิดแท็บแล้วเปิดใหม่ก็ยังอยู่
   • กดค้างดู "ก่อน–หลัง" เทียบได้ทันที
   • บันทึกเป็นเวอร์ชันไว้เทียบหลายแบบ
   • โหมดละเอียด สำหรับปรับครบทุก property
   ----------------------------------------------------------------
   ใส่ก่อน </body> :  <script src="visual-editor.js"></script>
   ================================================================ */
(function () {
  'use strict';
  if (window.__SOS_VE__) return;
  window.__SOS_VE__ = true;

  /* ==================== STATE ==================== */
  var LS = 'sos_ve_v3';
  var S = { rules: {}, tokens: {}, texts: {}, fonts: [], versions: [], seen: false };
  try {
    var raw = localStorage.getItem(LS);
    if (raw) { var o = JSON.parse(raw); for (var k in o) S[k] = o[k]; }
  } catch (e) {}

  /* ประวัติเก็บลง localStorage ด้วย — ปิดแท็บแล้วกลับมา ยังย้อนได้เหมือนเดิม */
  var hist = (S.hist && S.hist.length) ? S.hist : [];
  var hIdx = (typeof S.hIdx === 'number') ? S.hIdx : -1;
  if (hIdx < 0 || hIdx >= hist.length) hIdx = hist.length - 1;

  var cur = null, sel = null, pstate = '', groupMode = false;
  var editing = false, paused = false, tab = 'hist', drag = null, target = 'bg';

  function ck() { return sel ? sel + pstate : null; }
  function theme() { return document.documentElement.getAttribute('data-theme') || 'light'; }
  function core() { return JSON.stringify({ rules: S.rules, tokens: S.tokens, texts: S.texts }); }
  function saveLS() {
    S.hist = hist; S.hIdx = hIdx;
    try { localStorage.setItem(LS, JSON.stringify(S)); return; } catch (e) {}
    /* เต็มโควตา — ตัดประวัติเก่าทิ้งแล้วลองใหม่ ดีกว่าเงียบแล้วหายทั้งงาน */
    try {
      hist = hist.slice(-10); hIdx = hist.length - 1;
      S.hist = hist; S.hIdx = hIdx;
      localStorage.setItem(LS, JSON.stringify(S));
    } catch (x) {}
  }

  function commit(label) {
    var snap = core();
    if (hIdx >= 0 && hist[hIdx] && hist[hIdx].s === snap) return;
    hist = hist.slice(0, hIdx + 1);
    hist.push({ l: label, s: snap, t: Date.now() });
    if (hist.length > 40) hist.shift();
    hIdx = hist.length - 1;
    saveLS();
    if (tab === 'hist') paint();
  }
  function jump(i) {
    if (i < 0 || i >= hist.length) return;
    var o = JSON.parse(hist[i].s);
    S.rules = o.rules; S.tokens = o.tokens; S.texts = o.texts;
    hIdx = i; applyAll(); saveLS(); paint(); bar(); toast(hist[i].l);
  }
  function undo() { if (hIdx > 0) jump(hIdx - 1); else toast('ถึงจุดเริ่มต้นแล้ว'); }
  function redo() { if (hIdx < hist.length - 1) jump(hIdx + 1); }

  /* ==================== APPLY ==================== */
  var sink = document.createElement('style'); sink.id = 'sos-ve-style';
  document.head.appendChild(sink);

  function ruleText(imp) {
    var out = '', s;
    for (s in S.rules) {
      var d = S.rules[s], b = '', p;
      for (p in d) b += '  ' + p + ':' + d[p] + (imp ? ' !important' : '') + ';\n';
      if (b) out += s + '{\n' + b + '}\n';
    }
    return out;
  }
  var muted = false;
  function applyRules() { sink.textContent = muted ? '' : ruleText(true); }
  var liveTok = [];
  function applyTokens() {
    var r = document.documentElement, i;
    for (i = 0; i < liveTok.length; i++) r.style.removeProperty(liveTok[i]);
    liveTok = [];
    if (muted) return;
    var t = S.tokens[theme()] || {}, n;
    for (n in t) { r.style.setProperty(n, t[n]); liveTok.push(n); }
  }
  function applyTexts() {
    if (muted) return;
    for (var s in S.texts) {
      try {
        var e = document.querySelector(s);
        if (!e) continue;
        /* ชิ้นที่มีลูกเป็นอิลิเมนต์ ห้ามเขียนทับ — ไม่งั้นลูกหายทั้งกิ่ง */
        if ([].some.call(e.childNodes, function (n) { return n.nodeType === 1; })) continue;
        if (e.textContent !== S.texts[s]) e.textContent = S.texts[s];
      } catch (x) {}
    }
  }
  function applyAll() { applyRules(); applyTokens(); applyTexts(); }

  /* ==================== SELECTOR ==================== */
  var VOL = /^(is-|has-|js-|ve-)|^(active|on|open|show|shown|hide|hidden|selected|sel|current|done|loading|visible|anim|in|out)$/;
  function clsOf(el) {
    var c = (el.className && el.className.baseVal !== undefined) ? el.className.baseVal : el.className;
    if (typeof c !== 'string') return '';
    return c.trim().split(/\s+/).filter(function (x) { return x && !VOL.test(x); })
      .map(function (x) { return '.' + CSS.escape(x); }).join('');
  }
  function uniq(s) { try { return document.querySelectorAll(s).length === 1; } catch (e) { return false; } }
  function pathOf(el) {
    if (el.id && uniq('#' + CSS.escape(el.id))) return '#' + CSS.escape(el.id);
    var parts = [], n = el;
    while (n && n.nodeType === 1 && n !== document.documentElement) {
      var seg = n.tagName.toLowerCase() + clsOf(n);
      if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; }
      var par = n.parentElement;
      if (par) {
        var sib = [].filter.call(par.children, function (c) { return c.tagName === n.tagName; });
        if (sib.length > 1) seg += ':nth-of-type(' + (sib.indexOf(n) + 1) + ')';
      }
      parts.unshift(seg);
      if (uniq(parts.join(' > '))) return parts.join(' > ');
      n = par;
    }
    return parts.join(' > ');
  }
  function grpOf(el) { var c = clsOf(el); return c ? el.tagName.toLowerCase() + c : el.tagName.toLowerCase(); }
  /* "แก้พร้อมกัน" ใช้ได้เฉพาะชิ้นที่มีคลาสจริง ๆ — ไม่งั้น div เปล่า 1 ชิ้น
     จะลากทุก div ในแอปไปด้วย ซึ่งไม่มีทางเป็นสิ่งที่คนกดตั้งใจ */
  function selFor(el) { return (groupMode && clsOf(el)) ? grpOf(el) : pathOf(el); }
  function twins(el) {
    if (!clsOf(el)) return 1;
    try { return document.querySelectorAll(grpOf(el)).length; } catch (e) { return 1; }
  }

  /* ==================== MUTATE ==================== */
  function setP(p, v, quiet) {
    var k = ck(); if (!k) return;
    var d = S.rules[k] || (S.rules[k] = {});
    if (v === null || v === '') delete d[p]; else d[p] = v;
    if (!Object.keys(d).length) delete S.rules[k];
    applyRules(); if (!quiet) saveLS();
  }
  function getP(p) { var k = ck(), d = k && S.rules[k]; return d ? d[p] : undefined; }
  function comp(p) { return cur ? getComputedStyle(cur).getPropertyValue(p) : ''; }
  function val(p) { var v = getP(p); return v !== undefined ? v : comp(p); }
  function setTok(n, v, quiet) {
    var th = theme(), t = S.tokens[th] || (S.tokens[th] = {});
    if (v === null) delete t[n]; else t[n] = v;
    applyTokens(); if (!quiet) saveLS();
  }

  /* ==================== UTILS ==================== */
  function hex(c) {
    if (!c) return '#000000';
    c = String(c).trim();
    if (c.charAt(0) === '#') { if (c.length === 4) return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return c.slice(0, 7); }
    var m = c.match(/rgba?\(([^)]+)\)/); if (!m) return '#000000';
    var n = m[1].split(',').map(parseFloat);
    return '#' + [n[0], n[1], n[2]].map(function (v) { return ('0' + Math.round(v || 0).toString(16)).slice(-2); }).join('');
  }
  function alph(c) { var m = c && String(c).match(/rgba\(([^)]+)\)/); if (!m) return 1; var a = parseFloat(m[1].split(',')[3]); return isNaN(a) ? 1 : a; }
  function rgba(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function num(v) { return parseFloat(v) || 0; }
  function ago(t) {
    var d = (Date.now() - t) / 1000;
    if (d < 60) return 'เมื่อครู่';
    if (d < 3600) return Math.floor(d / 60) + ' นาทีก่อน';
    if (d < 86400) return Math.floor(d / 3600) + ' ชม.ก่อน';
    return Math.floor(d / 86400) + ' วันก่อน';
  }

  /* ==================== FONTS ==================== */
  var GF = ['Kanit', 'Prompt', 'Sarabun', 'Mitr', 'Bai Jamjuree', 'Noto Sans Thai', 'IBM Plex Sans Thai', 'Chakra Petch', 'Athiti', 'Charm', 'Pridi'];
  function loadFont(f) {
    if (!f || S.fonts.indexOf(f) > -1) return;
    S.fonts.push(f);
    var l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + ':wght@200;300;400;500;600;700;800&display=swap';
    document.head.appendChild(l); saveLS();
  }
  (function () { var f = S.fonts.slice(); S.fonts = []; f.forEach(loadFont); })();

  /* ==================== COLOR SCIENCE ==================== */
  function h2r(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function r2h(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2);
    }).join('');
  }
  function r2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0, s = 0, l = (mx + mn) / 2;
    if (d) {
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }
  function hsl2h(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r, g, b;
    if (h < 60) { r = c; g = x; b = 0; } else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; } else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; } else { r = c; g = 0; b = x; }
    return r2h((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  function hslOf(hx) { var c = h2r(hx); return r2hsl(c[0], c[1], c[2]); }
  function lum(hx) {
    var c = h2r(hx).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }
  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b);
    if (l1 < l2) { var t = l1; l1 = l2; l2 = t; }
    return (l1 + .05) / (l2 + .05);
  }
  function bestOn(bg) { return ratio('#FFFFFF', bg) >= ratio('#111111', bg) ? '#FFFFFF' : '#111111'; }
  function rate(r) {
    if (r >= 7) return { t: 'อ่านง่ายมาก (AAA)', ok: 1 };
    if (r >= 4.5) return { t: 'อ่านง่าย (AA)', ok: 1 };
    if (r >= 3) return { t: 'พอไหว — ใช้ได้กับตัวใหญ่เท่านั้น', ok: 0 };
    return { t: 'อ่านยาก ควรแก้', ok: 0 };
  }
  /* หาสีตัวอักษรที่คงโทนเดิมไว้ แต่อ่านออกบนพื้นนี้ */
  function fixOn(bg, fg) {
    var h = hslOf(fg), dir = lum(bg) > .4 ? -1 : 1, l;
    for (l = h[2]; l >= 0 && l <= 100; l += dir * 2) {
      var c = hsl2h(h[0], h[1], l);
      if (ratio(c, bg) >= 4.5) return c;
    }
    return bestOn(bg);
  }
  /* พื้นหลังจริงที่ตัวอักษรวางอยู่ (ไล่ขึ้นไปหาชิ้นแม่ที่มีสีจริง) */
  function effBg(el) {
    var n = el;
    while (n && n !== document.documentElement) {
      var b = getComputedStyle(n).backgroundColor;
      if (b && alph(b) > .05 && b !== 'transparent') return hex(b);
      n = n.parentElement;
    }
    return '#FFFFFF';
  }
  /* สีที่เข้ากันตามหลักวงล้อสี */
  function harmony(seed) {
    var s = hslOf(seed), H = s[0], S = s[1], L = s[2];
    return [
      { n: 'สีข้างเคียง — กลมกลืน สบายตา', c: [hsl2h(H - 30, S, L), hsl2h(H - 15, S, L), seed, hsl2h(H + 15, S, L), hsl2h(H + 30, S, L)] },
      { n: 'สีตรงข้าม — ตัดกันชัด เด่นมาก', c: [seed, hsl2h(H + 180, S, L), hsl2h(H + 180, S * .6, L + 18), hsl2h(H, S * .5, L + 22)] },
      { n: 'สามเหลี่ยม — สดใส มีชีวิตชีวา', c: [seed, hsl2h(H + 120, S, L), hsl2h(H + 240, S, L)] },
      { n: 'ไล่เฉดสีเดียว — เรียบหรู ดูแพง', c: [hsl2h(H, S, 92), hsl2h(H, S, 74), hsl2h(H, S, L), hsl2h(H, S, Math.max(16, L - 18)), hsl2h(H, S, Math.max(10, L - 32))] }
    ];
  }
  /* สร้างชุดสีทั้งธีมจากสีหลักสีเดียว */
  function genTheme(seed, nh, warm) {
    var s = hslOf(seed), H = s[0], S = s[1], L = s[2];
    var N = (nh === undefined || nh === null) ? H : nh;
    var ws = warm ? 1 : 0;
    var light = {
      '--scr': hsl2h(N, 12 + ws * 10, 97), '--card': hsl2h(N, 6 + ws * 14, 99.5),
      '--card2': hsl2h(N, 10 + ws * 10, 94.5), '--surface': hsl2h(N, 9 + ws * 9, 98),
      '--ink': hsl2h(N, 14, 13), '--muted': hsl2h(N, 9, 45), '--line': 'rgba(0,0,0,.09)',
      '--blue': seed, '--blue-soft': hsl2h(H, Math.min(S, 72), 93),
      '--blue-deep': hsl2h(H, Math.min(S + 6, 100), Math.max(18, L - 16)), '--on-accent': bestOn(seed)
    };
    var ds = hsl2h(H, Math.min(S, 74), Math.max(52, Math.min(68, L + 14)));
    var dark = {
      '--scr': hsl2h(N, 16, 7), '--card': hsl2h(N, 15, 11.5), '--card2': hsl2h(N, 14, 16),
      '--surface': hsl2h(N, 15, 9), '--ink': hsl2h(N, 8, 96), '--muted': hsl2h(N, 7, 62),
      '--line': 'rgba(255,255,255,.10)', '--blue': ds, '--blue-soft': hsl2h(H, 30, 22),
      '--blue-deep': hsl2h(H, Math.min(S, 70), 38), '--on-accent': bestOn(ds)
    };
    return { light: light, dark: dark };
  }
  function isDarkTheme() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--scr').trim();
    try { return lum(hex(v || '#ffffff')) < .35; } catch (e) { return false; }
  }
  function applyTheme(set, label) {
    S.tokens.light = S.tokens.light || {}; S.tokens.dark = S.tokens.dark || {};
    var k;
    for (k in set.light) S.tokens.light[k] = set.light[k];
    for (k in set.dark) S.tokens.dark[k] = set.dark[k];
    var th = theme();
    if (th !== 'light' && th !== 'dark') {
      var v = isDarkTheme() ? set.dark : set.light;
      S.tokens[th] = S.tokens[th] || {};
      for (k in v) S.tokens[th][k] = v[k];
    }
    applyTokens(); commit(label); paint(); toast(label);
  }

  var PALETTES = [
    { n: 'สดใสวัยเรียน', m: 'ฟ้าสด อ่านง่าย ดูน่าเชื่อถือ', s: '#2563EB', h: 222 },
    { n: 'อบอุ่นมินิมอล', m: 'โทนครีม–น้ำตาล เรียบ สบายตา', s: '#C2703D', h: 30, w: 1 },
    { n: 'เขียวสงบ', m: 'ธรรมชาติ ผ่อนคลาย ดูสะอาด', s: '#12855F', h: 150 },
    { n: 'ม่วงครีเอทีฟ', m: 'ทันสมัย มีความเป็นแบรนด์', s: '#7C3AED', h: 265 },
    { n: 'ชมพูหวาน', m: 'อ่อนโยน เป็นมิตร เข้าถึงง่าย', s: '#DB2777', h: 330, w: 1 },
    { n: 'ส้มพลังงาน', m: 'กระตือรือร้น เหมาะกับแอปงาน', s: '#EA580C', h: 25, w: 1 },
    { n: 'ฟ้าน้ำทะเล', m: 'สดชื่น โปร่ง โมเดิร์น', s: '#0891B2', h: 192 },
    { n: 'แดงเข้มพรีเมียม', m: 'เข้ม มั่นใจ ดูมีระดับ', s: '#B91C1C', h: 6 },
    { n: 'เหลืองทองอบอุ่น', m: 'สว่าง เป็นกันเอง', s: '#CA8A04', h: 45, w: 1 },
    { n: 'เทาโมโนคลาสสิก', m: 'สุขุม เรียบร้อย ไม่ฉูดฉาด', s: '#475569', h: 220 },
    { n: 'ครามอินดิโก', m: 'ลึก จริงจัง เหมาะงานวิชาการ', s: '#4338CA', h: 245 },
    { n: 'มิ้นต์สดชื่น', m: 'เบา สบาย ดูเป็นมิตร', s: '#059669', h: 165 }
  ];
  function palColors(p) {
    var t = genTheme(p.s, p.h, p.w);
    return [t.light['--scr'], t.light['--card2'], p.s, t.light['--blue-deep'], t.light['--ink']];
  }

  /* ==================== SHELL ==================== */
  var host = document.createElement('div');
  host.id = 'sos-ve-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  document.body.appendChild(host);
  var sr = host.attachShadow({ mode: 'open' });

  sr.innerHTML =
'<style>' +
'*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,"IBM Plex Sans Thai",system-ui,sans-serif}' +
'.pe{pointer-events:auto}' +
'#hl{position:fixed;pointer-events:none;outline:2px dashed #6FA8FF;background:rgba(111,168,255,.13);border-radius:4px;display:none}' +
'#se{position:fixed;pointer-events:none;outline:2.5px solid #F59E0B;border-radius:4px;display:none}' +
'#mv{position:fixed;pointer-events:auto;display:none;cursor:move;touch-action:none}' +
'.hd{position:fixed;width:12px;height:12px;background:#F59E0B;border:2.5px solid #0B0F17;border-radius:50%;pointer-events:auto;display:none;z-index:6;touch-action:none}' +
'#tip{position:fixed;font:600 11px ui-monospace,monospace;background:#0B0F17;color:#fff;padding:3px 8px;border-radius:7px;pointer-events:none;white-space:nowrap;display:none}' +

/* FAB */
'#fabs{position:fixed;top:14px;right:14px;display:flex;gap:8px;align-items:center;z-index:9}' +
'#fab{height:44px;padding:0 16px;border-radius:14px;border:0;background:#0B0F17;color:#fff;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 10px 26px rgba(0,0,0,.45);display:flex;align-items:center;gap:7px;transition:.2s}' +
'#fab.on{background:#F59E0B;color:#111}' +
'#pauseB{display:none;width:44px;height:44px;border-radius:14px;border:0;background:#0B0F17;color:#fff;font-size:17px;cursor:pointer;box-shadow:0 10px 26px rgba(0,0,0,.45)}' +
'#pauseB.show{display:block}' +
'#pauseB.on{background:#22C55E;color:#052E16}' +

/* QUICK BAR */
'#qb{position:fixed;display:none;background:#0F1521;border:1px solid #2B364B;border-radius:16px;padding:9px;box-shadow:0 18px 50px rgba(0,0,0,.6);pointer-events:auto;width:322px;max-width:94vw}' +
'#qb.show{display:block}' +
'.qh{display:flex;align-items:center;gap:6px;margin-bottom:8px}' +
'.qh .nm{flex:1;font:700 11px ui-monospace,monospace;color:#FBBF24;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
'.ic{width:26px;height:26px;border-radius:8px;border:1px solid #2B364B;background:#182130;color:#C6D0E0;font-size:12px;cursor:pointer;flex:0 0 auto;display:flex;align-items:center;justify-content:center}' +
'.ic:hover{background:#232F42}' +
'.seg{display:flex;gap:4px;margin-bottom:8px}' +
'.seg button{flex:1;padding:7px 2px;border-radius:9px;border:1px solid #2B364B;background:#182130;color:#B9C4D6;font-size:11.5px;font-weight:700;cursor:pointer}' +
'.seg button.a{background:#2563EB;border-color:#2563EB;color:#fff}' +
'.sw{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:9px}' +
'.sw i{width:28px;height:28px;border-radius:9px;cursor:pointer;border:2px solid rgba(255,255,255,.14);display:block}' +
'.sw i:hover{transform:scale(1.12)}' +
'.sw label{width:28px;height:28px;border-radius:9px;cursor:pointer;border:2px solid rgba(255,255,255,.14);background:conic-gradient(red,yellow,lime,aqua,blue,magenta,red);position:relative;overflow:hidden}' +
'.sw label input{opacity:0;width:100%;height:100%;cursor:pointer}' +
'.stp{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}' +
'.st{display:flex;align-items:center;background:#182130;border:1px solid #2B364B;border-radius:10px;overflow:hidden}' +
'.st b{flex:1;text-align:center;font-size:11px;color:#B9C4D6;font-weight:700}' +
'.st button{width:30px;height:32px;border:0;background:transparent;color:#F59E0B;font-size:17px;font-weight:800;cursor:pointer}' +
'.st button:hover{background:#232F42}' +
'.tg{display:flex;gap:5px}' +
'.tg button{flex:1;padding:8px 2px;border-radius:10px;border:1px solid #2B364B;background:#182130;color:#B9C4D6;font-size:11.5px;font-weight:700;cursor:pointer}' +
'.tg button.a{background:#F59E0B;border-color:#F59E0B;color:#111}' +
'.chip{display:block;width:100%;margin-top:8px;padding:8px;border-radius:10px;border:1px dashed #3A4A66;background:#141C29;color:#93A3BD;font-size:11.5px;font-weight:700;cursor:pointer}' +
'.chip.a{border-style:solid;border-color:#22C55E;background:#0F2318;color:#7EE2A8}' +

/* PANEL */
'#pn{position:fixed;top:0;right:0;width:330px;max-width:94vw;height:100%;background:#0B1018;color:#E6ECF7;display:flex;flex-direction:column;box-shadow:-14px 0 44px rgba(0,0,0,.6);transform:translateX(105%);transition:transform .24s cubic-bezier(.4,0,.2,1)}' +
'#pn.open{transform:none}' +
'.ph{padding:11px 13px;border-bottom:1px solid #1D2634;display:flex;align-items:center;gap:8px}' +
'.ph .t{flex:1;font-weight:800;font-size:13.5px}' +
'.tabs{display:flex;border-bottom:1px solid #1D2634}' +
'.tabs button{flex:1;padding:10px 2px;background:none;border:0;border-bottom:2px solid transparent;color:#76839B;font-size:11.5px;font-weight:800;cursor:pointer}' +
'.tabs button.a{color:#F59E0B;border-bottom-color:#F59E0B}' +
'.bd{flex:1;overflow-y:auto;padding-bottom:60px}' +

/* history */
'.hrow{display:flex;align-items:center;gap:9px;padding:9px 13px;cursor:pointer;border-left:3px solid transparent}' +
'.hrow:hover{background:#131B27}' +
'.hrow.a{background:#1A2333;border-left-color:#F59E0B}' +
'.hrow.fut{opacity:.42}' +
'.dot{width:8px;height:8px;border-radius:50%;background:#3A4A66;flex:0 0 auto}' +
'.hrow.a .dot{background:#F59E0B}' +
'.hl{flex:1;font-size:12px;color:#CBD5E6}' +
'.ht{font-size:10px;color:#66748C}' +
'.vrow{display:flex;align-items:center;gap:7px;padding:9px 13px;border-bottom:1px solid #141C29}' +
'.vrow .vn{flex:1;font-size:12px;font-weight:700;color:#CBD5E6}' +

/* generic controls */
'.g{border-bottom:1px solid #141C29}' +
'.gh{padding:10px 13px;font-weight:800;font-size:11.5px;color:#93A3BD;cursor:pointer;display:flex;justify-content:space-between;user-select:none}' +
'.gb{padding:0 13px 11px;display:none}.g.o .gb{display:block}' +
'.r{display:flex;align-items:center;gap:7px;margin:8px 0}' +
'.l{flex:0 0 84px;color:#9EAAC0;font-size:11px}' +
'.c{flex:1;display:flex;align-items:center;gap:5px;min-width:0}' +
'input[type=range]{flex:1;min-width:0;accent-color:#F59E0B;height:16px}' +
'input[type=color]{width:30px;height:25px;padding:0;border:1px solid #2B364B;border-radius:6px;background:#182130;cursor:pointer;flex:0 0 auto}' +
'select,input[type=text],input[type=number],textarea{background:#182130;border:1px solid #2B364B;color:#E6ECF7;border-radius:7px;padding:5px 6px;font-size:11.5px;min-width:0}' +
'select,input[type=text]{flex:1}textarea{width:100%;font-family:ui-monospace,monospace;resize:vertical}' +
'.q{display:flex;gap:3px;flex:1}.q input{width:100%;text-align:center;padding:4px 2px;font-size:11px}' +
'.n{flex:0 0 44px;text-align:right;font:700 10.5px ui-monospace,monospace;color:#FBBF24}' +
'.x{border:0;background:none;color:#4E5A72;cursor:pointer;font-size:12px;padding:0 1px}.x:hover{color:#F59E0B}' +
'.hint{padding:12px 14px;color:#6E7B92;font-size:11.5px;line-height:1.8}' +
'.sec{padding:11px 13px 3px;font-weight:800;font-size:11.5px;color:#93A3BD}' +
'.pcard{display:flex;align-items:center;gap:9px;padding:7px;margin:0 13px 7px;border-radius:11px;background:#131B27;border:1px solid #1F2A3B;cursor:pointer}' +
'.pcard:hover{border-color:#F59E0B;background:#18212F}' +
'.strip{display:flex;border-radius:7px;overflow:hidden;flex:0 0 76px;height:28px;border:1px solid rgba(255,255,255,.10)}' +
'.strip i{flex:1;display:block}' +
'.pi{flex:1;min-width:0}' +
'.pi b{display:block;font-size:11.5px;color:#DCE4F2;font-weight:800}' +
'.pi span{display:block;font-size:10px;color:#6E7B92;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
'.seedrow{display:flex;gap:7px;align-items:center;padding:4px 13px 10px}' +
'.seedrow input[type=color]{width:46px;height:36px;flex:0 0 auto}' +
'.seedrow button{flex:1;padding:11px;border:0;border-radius:10px;background:#F59E0B;color:#111;font-weight:800;font-size:11.5px;cursor:pointer}' +
'.harm{padding:0 13px 9px}' +
'.harm .hn{font-size:10.5px;color:#8B98AF;margin-bottom:5px}' +
'.harm .hs{display:flex;gap:4px}' +
'.harm .hs i{flex:1;height:32px;border-radius:8px;cursor:pointer;border:2px solid rgba(255,255,255,.10);display:block}' +
'.harm .hs i:hover{border-color:#F59E0B}' +
'.badge{display:flex;align-items:center;gap:7px;margin:0 13px 8px;padding:9px 10px;border-radius:10px;font-size:11px;font-weight:700;line-height:1.45}' +
'.badge.ok{background:#0F2318;color:#7EE2A8}' +
'.badge.no{background:#2A1518;color:#F9B3B3}' +
'.badge button{margin-left:auto;flex:0 0 auto;padding:6px 10px;border:0;border-radius:7px;background:#F59E0B;color:#111;font-weight:800;font-size:10.5px;cursor:pointer}' +
'.qbadge{display:flex;align-items:center;gap:6px;margin-top:8px;padding:8px 9px;border-radius:10px;font-size:10.5px;font-weight:700}' +
'.qbadge.ok{background:#0F2318;color:#7EE2A8}' +
'.qbadge.no{background:#2A1518;color:#F9B3B3}' +
'.qbadge button{margin-left:auto;padding:5px 9px;border:0;border-radius:7px;background:#F59E0B;color:#111;font-weight:800;font-size:10px;cursor:pointer}' +
'.kb{background:#182130;border-radius:4px;padding:1px 5px;font:700 10px ui-monospace,monospace;color:#B9C4D6}' +
'.ft{position:absolute;bottom:0;left:0;right:0;padding:9px 12px;background:#0B1018;border-top:1px solid #1D2634;display:flex;gap:6px}' +
'.ft button{padding:10px 6px;border-radius:10px;border:0;font-weight:800;font-size:11.5px;cursor:pointer;flex:1}' +
'.b1{background:#F59E0B;color:#111}.b2{background:#18212F;color:#B9C4D6}.b3{background:#2A1518;color:#F19A9A}' +
'.sm{flex:0 0 40px!important}' +

'#toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#0B0F17;color:#fff;padding:10px 16px;border-radius:11px;font:700 12px system-ui;opacity:0;transition:opacity .2s;pointer-events:none;box-shadow:0 8px 26px rgba(0,0,0,.5)}' +
'#coach{position:fixed;top:66px;right:14px;width:236px;background:#F59E0B;color:#111;padding:12px 13px;border-radius:13px;font-size:12px;font-weight:700;line-height:1.6;display:none;box-shadow:0 12px 32px rgba(0,0,0,.4)}' +
'#coach.show{display:block}' +
'#coach button{margin-top:8px;width:100%;padding:7px;border:0;border-radius:8px;background:#111;color:#fff;font-weight:800;font-size:11.5px;cursor:pointer}' +
'#md{position:fixed;inset:0;background:rgba(3,6,12,.86);display:none;align-items:center;justify-content:center;padding:18px}' +
'#md.o{display:flex}' +
'.cd{background:#0B1018;border:1px solid #2B364B;border-radius:16px;width:660px;max-width:100%;max-height:86vh;display:flex;flex-direction:column;color:#E6ECF7}' +
'.cd h3{padding:13px 15px;font-size:13px;border-bottom:1px solid #1D2634;font-weight:800}' +
'.cd textarea{flex:1;min-height:280px;border:0;border-radius:0;background:#060A11;color:#9FE6B0;font:11.5px/1.65 ui-monospace,monospace;padding:13px;outline:none}' +
'.cd .f2{padding:11px 15px;display:flex;gap:7px;border-top:1px solid #1D2634}' +
'.cd .f2 button{flex:1;padding:11px;border-radius:10px;border:0;font-weight:800;font-size:11.5px;cursor:pointer}' +
'</style>' +

'<div id="hl"></div><div id="se"></div><div id="mv"></div><div id="tip"></div>' +
'<div class="hd" data-h="nw"></div><div class="hd" data-h="n"></div><div class="hd" data-h="ne"></div>' +
'<div class="hd" data-h="w"></div><div class="hd" data-h="e"></div>' +
'<div class="hd" data-h="sw"></div><div class="hd" data-h="s"></div><div class="hd" data-h="se"></div>' +
'<div id="fabs" class="pe">' +
  '<button id="pauseB" title="พักการแก้ ไปกดใช้แอปตามปกติ">&#9995;</button>' +
  '<button id="fab"><span>&#9998;</span><span id="fabT">แก้ดีไซน์</span></button></div>' +
'<div id="coach" class="pe"></div>' +
'<div id="qb" class="pe"></div>' +
'<div id="pn" class="pe">' +
  '<div class="ph"><div class="t">แผงควบคุม</div>' +
    '<button class="ic" id="pUndo" title="ย้อนกลับ">&#8630;</button>' +
    '<button class="ic" id="pRedo" title="ทำซ้ำ">&#8631;</button>' +
    '<button class="ic" id="pClose" title="ปิด">&#10005;</button></div>' +
  '<div class="tabs">' +
    '<button data-t="hist" class="a">ประวัติ</button><button data-t="el">ละเอียด</button>' +
    '<button data-t="th">สี &#10024;</button><button data-t="css">CSS</button></div>' +
  '<div class="bd" id="bd"></div>' +
  '<div class="ft">' +
    '<button class="b1" id="bEx">&#8681; เอาโค้ดออก</button>' +
    '<button class="b2" id="bVer">&#128190; เก็บเวอร์ชัน</button>' +
    '<button class="b3 sm" id="bClr">&#10005;</button></div>' +
'</div>' +
'<div id="toast"></div>' +
'<div id="md" class="pe"><div class="cd"><h3>วางต่อท้ายไฟล์ style.css แล้วอัปขึ้น GitHub</h3>' +
  '<textarea id="out" spellcheck="false"></textarea>' +
  '<div class="f2"><button class="b1" id="bCp">คัดลอกทั้งหมด</button><button class="b2" id="bDl">ดาวน์โหลด</button><button class="b2" id="bX">ปิด</button></div></div></div>';

  var $ = function (s) { return sr.querySelector(s); };
  var $$ = function (s) { return [].slice.call(sr.querySelectorAll(s)); };
  var hl = $('#hl'), se = $('#se'), mv = $('#mv'), tip = $('#tip'), qb = $('#qb'), pn = $('#pn'), bd = $('#bd');

  function toast(m) { var t = $('#toast'); t.textContent = m; t.style.opacity = '1'; clearTimeout(t._t); t._t = setTimeout(function () { t.style.opacity = '0'; }, 1400); }
  function E(t, c, h) { var d = document.createElement(t); if (c) d.className = c; if (h != null) d.innerHTML = h; return d; }
  function box(el, n) {
    var r = el.getBoundingClientRect();
    n.style.left = r.left + 'px'; n.style.top = r.top + 'px';
    n.style.width = r.width + 'px'; n.style.height = r.height + 'px'; n.style.display = 'block';
    return r;
  }

  /* ==================== FRAME ==================== */
  var HP = { nw: [0, 0], n: [.5, 0], ne: [1, 0], w: [0, .5], e: [1, .5], sw: [0, 1], s: [.5, 1], se: [1, 1] };
  function wide() { return innerWidth > 720; }
  function panelOpen() { return pn.classList.contains('open'); }
  function frame() {
    /* ชิ้นที่เลือกไว้อาจถูกซ่อน (สลับหน้าจอ) — ยังไม่ปล่อยการเลือก แต่ต้องเก็บกรอบกับแถบเครื่องมือ
       ไม่งั้นมันจะไปกองอยู่มุมซ้ายบนแบบชี้ไปที่ความว่างเปล่า แล้วกดอะไรก็ไม่เห็นอะไรเกิดขึ้น */
    var vis = cur && (cur.offsetWidth || cur.offsetHeight || cur.getClientRects().length);
    if (!cur || !editing || paused || !vis) {
      se.style.display = 'none'; mv.style.display = 'none';
      $$('.hd').forEach(function (h) { h.style.display = 'none'; });
      qb.classList.remove('show');
      return;
    }
    var r = box(cur, se);
    mv.style.left = r.left + 'px'; mv.style.top = r.top + 'px';
    mv.style.width = r.width + 'px'; mv.style.height = r.height + 'px'; mv.style.display = 'block';
    $$('.hd').forEach(function (h) {
      var q = HP[h.getAttribute('data-h')];
      h.style.left = (r.left + r.width * q[0] - 6) + 'px';
      h.style.top = (r.top + r.height * q[1] - 6) + 'px';
      h.style.display = 'block'; h.style.cursor = h.getAttribute('data-h') + '-resize';
    });
    /* จอแคบ + แผงเปิดอยู่ = แผงบังทั้งจอ แถบเครื่องมือจะโผล่ใต้แผงแบบกดไม่ได้ ซ่อนไปเลยดีกว่า */
    if (panelOpen() && !wide()) { qb.classList.remove('show'); return; }
    var qh = qb.offsetHeight || 250, qw = qb.offsetWidth || 322;
    var top = r.bottom + 12;
    if (top + qh > innerHeight - 8) top = Math.max(8, r.top - qh - 12);
    if (top + qh > innerHeight - 8) top = Math.max(8, innerHeight - qh - 8);
    var left = r.left + r.width / 2 - qw / 2;
    left = Math.max(8, Math.min(left, innerWidth - qw - 8));
    if (panelOpen() && wide()) left = Math.min(left, innerWidth - qw - 342);
    qb.style.left = Math.max(8, left) + 'px'; qb.style.top = top + 'px';
    qb.classList.add('show');
  }
  /* ใช้ timer ไม่ใช่ requestAnimationFrame — rAF จะหยุดเดินเมื่อแท็บไม่ได้วาดภาพอยู่
     พอกลับมาดูอีกที กรอบจะค้างผิดที่โดยไม่มีอะไรมาปลุกให้คำนวณใหม่ */
  var fq = 0;
  function frameSoon() {
    if (fq) return;
    fq = setTimeout(function () { fq = 0; frame(); }, 16);
  }
  window.addEventListener('scroll', frameSoon, true);
  window.addEventListener('resize', frameSoon);

  /* ==================== PICK ==================== */
  /* เอาชิ้นบนสุดตรงจุดที่กด = ได้ชิ้นที่ตาเห็นจริง ๆ (ขึ้นไปหาชิ้นแม่ด้วยปุ่ม ↑ ได้) */
  function deepAt(x, y) {
    var list = [];
    try { list = document.elementsFromPoint(x, y); } catch (e) { return null; }
    list = list.filter(function (e) { return e !== host && !host.contains(e) && e !== document.body && e !== document.documentElement; });
    if (!list.length) return null;
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.width * r.height > 16) return list[i];
    }
    return list[0];
  }
  function inHost(e) { return e.composedPath && e.composedPath().indexOf(host) > -1; }
  function inText(t) { try { return !!(t && t.closest && t.closest('[contenteditable]')); } catch (e) { return false; } }
  function off(e) { return !editing || paused || inHost(e) || inText(e.target); }

  document.addEventListener('mousemove', function (e) {
    if (off(e) || drag) { hl.style.display = 'none'; tip.style.display = 'none'; return; }
    var el = deepAt(e.clientX, e.clientY); if (!el) return;
    var r = box(el, hl);
    tip.textContent = el.tagName.toLowerCase() + clsOf(el);
    tip.style.left = Math.max(4, r.left) + 'px';
    tip.style.top = (r.top > 26 ? r.top - 23 : r.bottom + 4) + 'px';
    tip.style.display = 'block';
  }, true);

  /* กันไม่ให้แอปทำงานตอนกำลังแก้ดีไซน์ — แต่ห้าม preventDefault ที่ touch/pointer
     ไม่งั้นบนมือถือจะเลื่อนจอไม่ได้เลย ปิดแค่ไม่ให้อีเวนต์ไหลไปถึงแอปก็พอ */
  ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'change'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (off(e)) return;
      e.stopPropagation(); e.stopImmediatePropagation();
      /* นิ้วไม่มี hover — ถ้าไม่ขึ้นกรอบให้ตอนแตะ จะไม่มีทางรู้เลยว่ากำลังจะเลือกชิ้นไหน */
      if (ev === 'pointerdown') {
        var el = deepAt(e.clientX, e.clientY);
        if (el) {
          var r = box(el, hl);
          tip.textContent = el.tagName.toLowerCase() + clsOf(el);
          tip.style.left = Math.max(4, r.left) + 'px';
          tip.style.top = (r.top > 26 ? r.top - 23 : r.bottom + 4) + 'px';
          tip.style.display = 'block';
        }
      }
    }, true);
  });
  /* ฟอร์มต้องกัน default ด้วย ไม่งั้นหน้าเด้งทิ้งงานที่แก้ค้างไว้ */
  document.addEventListener('submit', function (e) {
    if (off(e)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  }, true);
  document.addEventListener('click', function (e) {
    if (off(e)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var el = deepAt(e.clientX, e.clientY); if (el) pick(el);
  }, true);
  document.addEventListener('dblclick', function (e) {
    if (off(e)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    editText();
  }, true);

  /* แอปนี้วาดหน้าจอใหม่ตลอด ชิ้นที่เลือกไว้จะถูกแทนที่ด้วยชิ้นใหม่หน้าตาเหมือนกันเป๊ะ
     ถ้าไม่ตามให้ กรอบส้มจะค้างอยู่ที่เดิม แล้วทุกค่าที่อ่านจากชิ้นที่หลุดไปแล้วจะกลายเป็น 0
     — นี่คือต้นเหตุที่กดอะไรก็เหมือนไม่ตรงใจ */
  function relink() {
    if (!cur || document.contains(cur)) return true;
    var n = null;
    try { n = document.querySelector(sel); } catch (e) {}
    if (n) { cur = n; return true; }
    cur = null;
    return false;
  }
  var mq = 0, barT = 0;
  function sync() {
    if (!editing || paused || drag) return;
    var had = cur;
    if (!relink()) {
      qb.classList.remove('show'); frame();
      if (tab === 'el' || tab === 'css') paint();
      return;
    }
    frame();
    if (cur !== had) { clearTimeout(barT); barT = setTimeout(function () { bar(); frame(); }, 180); }
  }
  new MutationObserver(function () {
    if (mq) return;
    mq = setTimeout(function () { mq = 0; sync(); }, 60);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });

  function pick(el) {
    if (!el || el === document.body) return;
    cur = el; sel = selFor(el); pstate = '';
    hl.style.display = 'none'; tip.style.display = 'none';
    /* จอแคบ: แผงบังทั้งจอ พอเลือกชิ้นใหม่ก็ปิดแผงให้ จะได้เห็นแถบเครื่องมือของชิ้นนั้น */
    if (panelOpen() && !wide()) openPanel(false);
    bar(); frame(); if (tab === 'el' || tab === 'css') paint();
  }

  /* ==================== TEXT ==================== */
  function leafText(el) {
    if (!el || !(el.textContent || '').trim()) return false;
    return ![].some.call(el.childNodes, function (n) { return n.nodeType === 1; });
  }
  function editText() {
    if (!cur) return;
    if (!leafText(cur)) { toast('แตะตรงตัวอักษรโดยตรงก่อน แล้วค่อยกดแก้ข้อความ'); return; }
    var el = cur, old = el.textContent;
    el.setAttribute('contenteditable', 'true');
    el.style.outline = '2px solid #22C55E'; el.focus();
    try { var g = document.createRange(); g.selectNodeContents(el); var s2 = getSelection(); s2.removeAllRanges(); s2.addRange(g); } catch (x) {}
    toast('พิมพ์แก้ได้เลย · Enter = เสร็จ');
    function done() {
      el.removeAttribute('contenteditable'); el.style.outline = '';
      el.removeEventListener('blur', done); el.removeEventListener('keydown', kd);
      if (el.textContent !== old) { S.texts[pathOf(el)] = el.textContent; commit('แก้ข้อความ "' + el.textContent.slice(0, 14) + '"'); }
      frame();
    }
    function kd(ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
      if (ev.key === 'Escape') { el.textContent = old; el.blur(); }
    }
    el.addEventListener('blur', done); el.addEventListener('keydown', kd);
  }

  /* ==================== DRAG / RESIZE ==================== */
  function xy() {
    var m = (getP('transform') || '').match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
  }
  function setXY(x, y) {
    var t = (getP('transform') || '').replace(/translate\([^)]*\)\s*/, '').trim();
    setP('transform', ('translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px) ' + t).trim(), true);
  }
  function grab(el, make) {
    el.addEventListener('pointerdown', function (e) {
      if (!cur) return;
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      make(e);
    });
  }
  grab(mv, function (e) {
    var s0 = xy(), sx = e.clientX, sy = e.clientY, moved = false;
    drag = function (ev) { moved = true; setXY(s0[0] + ev.clientX - sx, s0[1] + ev.clientY - sy); frame(); };
    drag.end = function () { if (moved) commit('ย้ายตำแหน่ง'); };
  });
  $$('.hd').forEach(function (h) {
    grab(h, function (e) {
      var d = h.getAttribute('data-h'), r = cur.getBoundingClientRect();
      var sx = e.clientX, sy = e.clientY, w0 = r.width, h0 = r.height;
      var t0 = xy(), moved = false;
      var west = d.indexOf('w') > -1, north = d.indexOf('n') > -1;
      drag = function (ev) {
        moved = true;
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (d.indexOf('e') > -1) setP('width', Math.max(8, Math.round(w0 + dx)) + 'px', true);
        if (d.indexOf('s') > -1) setP('height', Math.max(8, Math.round(h0 + dy)) + 'px', true);
        if (west) setP('width', Math.max(8, Math.round(w0 - dx)) + 'px', true);
        if (north) setP('height', Math.max(8, Math.round(h0 - dy)) + 'px', true);
        /* ลากขอบซ้าย/บน: ขอบอีกฝั่งต้องอยู่ที่เดิม ไม่งั้นชิ้นงานจะวิ่งสวนมือ
           วัดจากของจริงหลังจัดหน้าใหม่ เพราะชิ้นที่จัดกึ่งกลางจะขยับเองอีกครึ่งหนึ่ง */
        if (west || north) {
          setXY(t0[0], t0[1]);
          var n2 = cur.getBoundingClientRect();
          setXY(t0[0] + (west ? r.right - n2.right : 0), t0[1] + (north ? r.bottom - n2.bottom : 0));
        }
        frame();
      };
      drag.end = function () { if (moved) commit('ปรับขนาด'); };
    });
  });
  window.addEventListener('pointermove', function (e) { if (drag) { e.preventDefault(); drag(e); } }, true);
  function dragDone() { if (drag) { if (drag.end) drag.end(); drag = null; bar(); } }
  window.addEventListener('pointerup', dragDone, true);
  window.addEventListener('pointercancel', dragDone, true);

  /* ==================== QUICK BAR ==================== */
  var SWATCH = ['var(--blue)', 'var(--blue-deep)', 'var(--blue-soft)', 'var(--good)', 'var(--warn)', 'var(--alert)',
    'var(--card)', 'var(--card2)', 'var(--ink)', 'var(--muted)', '#FFFFFF', 'transparent'];
  var TPROP = { bg: 'background-color', tx: 'color', bd: 'border-color' };
  /* ตัวย่อ var(--x) ที่ธีมนี้ไม่มีค่า จะกลายเป็นช่องสีใส กดแล้วไม่เกิดอะไร — คัดออกก่อน */
  function hasTok(c) {
    if (String(c).slice(0, 4) !== 'var(') return true;
    var n = String(c).slice(4, -1).trim();
    return !!getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  }
  function weight(v) {
    v = String(v == null ? '' : v).trim();
    if (v === 'bold' || v === 'bolder') return 700;
    if (v === 'normal' || v === 'lighter') return 400;
    return num(v);
  }

  function step(prop, delta, unit, min, max, label, read) {
    var v = num(val(read || prop)) + delta;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    if (prop === 'border-width') setP('border-style', 'solid', true);
    setP(prop, v + (unit || 'px'));
    commit(label + ' → ' + Math.round(v) + (unit || 'px'));
    bar(); frame();
  }

  function bar() {
    if (!cur || !editing || paused) { qb.classList.remove('show'); return; }
    qb.innerHTML = '';

    /* header */
    var h = E('div', 'qh');
    var up = E('button', 'ic', '&#8593;'); up.title = 'เลือกชิ้นที่ครอบอยู่';
    up.onclick = function () { if (cur.parentElement && cur.parentElement !== document.body) pick(cur.parentElement); };
    var dn = E('button', 'ic', '&#8595;'); dn.title = 'เลือกชิ้นข้างใน';
    dn.onclick = function () { if (cur.firstElementChild) pick(cur.firstElementChild); };
    var nm = E('div', 'nm', cur.tagName.toLowerCase() + (clsOf(cur).split('.')[1] ? '.' + clsOf(cur).split('.')[1] : ''));
    var rs = E('button', 'ic', '&#8630;'); rs.title = 'คืนค่าชิ้นนี้';
    rs.onclick = function () {
      /* คืนค่าให้ครบทุกสถานะของชิ้นนี้ (ปกติ / เมื่อชี้ / เมื่อกด) ไม่ใช่แค่สถานะที่เปิดค้างอยู่ */
      Object.keys(S.rules).forEach(function (k) {
        if (k === sel || k.indexOf(sel + ':') === 0) delete S.rules[k];
      });
      applyRules(); commit('คืนค่าชิ้นนี้'); bar(); frame();
    };
    var mo = E('button', 'ic', '&#9776;'); mo.title = 'ปรับละเอียด';
    mo.onclick = function () { tab = 'el'; openPanel(true); paint(); };
    h.appendChild(up); h.appendChild(dn); h.appendChild(nm);
    /* ดับเบิลแตะบนมือถือแทบไม่ติด (โดนซูมแทน) — ให้ปุ่มไปเลยตรง ๆ */
    if (!leafText(cur)) h.appendChild(rs);
    else {
      var tx = E('button', 'ic', '&#9998;'); tx.title = 'แก้ข้อความ';
      tx.onclick = function () { editText(); };
      h.appendChild(tx); h.appendChild(rs);
    }
    h.appendChild(mo);
    qb.appendChild(h);

    /* target segment */
    var sg = E('div', 'seg');
    [['bg', 'พื้นหลัง'], ['tx', 'ตัวอักษร'], ['bd', 'เส้นขอบ']].forEach(function (t) {
      var b = E('button', target === t[0] ? 'a' : '', t[1]);
      b.onclick = function () { target = t[0]; bar(); };
      sg.appendChild(b);
    });
    qb.appendChild(sg);

    /* swatches */
    var sw = E('div', 'sw');
    SWATCH.filter(hasTok).forEach(function (c) {
      var i = E('i'); i.style.background = c === 'transparent' ? 'repeating-conic-gradient(#555 0 25%,#333 0 50%) 50%/8px 8px' : c;
      i.title = c;
      i.onclick = function () {
        if (target === 'bd') setP('border-style', 'solid', true), setP('border-width', Math.max(1, num(val('border-width'))) + 'px', true);
        setP(TPROP[target], c);
        commit('เปลี่ยนสี' + (target === 'bg' ? 'พื้นหลัง' : target === 'tx' ? 'ตัวอักษร' : 'เส้นขอบ'));
        frame();
      };
      sw.appendChild(i);
    });
    var lb = E('label');
    var ci = E('input'); ci.type = 'color'; ci.value = hex(val(TPROP[target]));
    ci.oninput = function () { setP(TPROP[target], ci.value, true); frame(); };
    ci.onchange = function () { setP(TPROP[target], ci.value); commit('เลือกสีเอง'); };
    lb.appendChild(ci); sw.appendChild(lb);
    qb.appendChild(sw);

    /* steppers */
    var st = E('div', 'stp');
    /* ช่องท้าย = property ที่ใช้ "อ่าน" ค่าปัจจุบัน — ตัวย่ออย่าง padding อ่านค่ารวมไม่ตรง
       ("8px 16px" จะถูกอ่านเป็น 8 แล้วกดทีเดียวกลายเป็น 10px รอบด้าน) */
    [['ตัวอักษร', 'font-size', 1, 6, 90, 'font-size'],
     ['ความมน', 'border-radius', 2, 0, 200, 'border-top-left-radius'],
     ['ระยะใน', 'padding', 2, 0, 120, 'padding-top'],
     ['ระยะนอก', 'margin', 2, -60, 160, 'margin-top']].forEach(function (s) {
      var w = E('div', 'st');
      var m = E('button', '', '\u2212'), b = E('b', '', Math.round(num(val(s[5]))) + 'px'), p = E('button', '', '+');
      m.onclick = function () { step(s[1], -s[2], 'px', s[3], s[4], s[0], s[5]); };
      p.onclick = function () { step(s[1], s[2], 'px', s[3], s[4], s[0], s[5]); };
      w.appendChild(m); w.appendChild(b); w.appendChild(p); st.appendChild(w);
    });
    qb.appendChild(st);

    /* toggles */
    var tg = E('div', 'tg');
    /* ปิด = เขียนค่าตรงข้ามลงไปจริง ๆ ไม่ใช่แค่ลบค่าที่เราตั้ง
       (ถ้าแค่ลบ ชิ้นที่ CSS เดิมของแอปตั้งไว้อยู่แล้ว จะกดปิดไม่ลงสักที) */
    var isB = weight(val('font-weight')) >= 600;
    var bB = E('button', isB ? 'a' : '', 'หนา');
    bB.onclick = function () { setP('font-weight', isB ? '400' : '700'); commit(isB ? 'ยกเลิกตัวหนา' : 'ทำตัวหนา'); bar(); frame(); };
    var isC = (val('text-align') || '').indexOf('center') > -1;
    var bC = E('button', isC ? 'a' : '', 'กึ่งกลาง');
    bC.onclick = function () { setP('text-align', isC ? 'left' : 'center'); commit(isC ? 'ยกเลิกกึ่งกลาง' : 'จัดกึ่งกลาง'); bar(); frame(); };
    var sh = val('box-shadow');
    var isS = !!sh && String(sh).indexOf('none') !== 0;
    var bS = E('button', isS ? 'a' : '', 'เงา');
    bS.onclick = function () { setP('box-shadow', isS ? 'none' : '0 10px 28px -8px rgba(0,0,0,.28)'); commit(isS ? 'เอาเงาออก' : 'ใส่เงา'); bar(); frame(); };
    tg.appendChild(bB); tg.appendChild(bC); tg.appendChild(bS);
    qb.appendChild(tg);

    /* contrast advisor — เตือนทันทีถ้าสีอ่านไม่ออก */
    var txt = (cur.textContent || '').trim();
    if (txt && txt.length < 400) {
      try {
        var fg = hex(val('color')), bg = effBg(cur);
        var rr = ratio(fg, bg), vv = rate(rr);
        var big = num(val('font-size')) >= 24 || weight(val('font-weight')) >= 700;
        var pass = vv.ok || (big && rr >= 3);
        var qb2 = E('div', 'qbadge ' + (pass ? 'ok' : 'no'));
        qb2.appendChild(E('div', '', (pass ? '\u2713 อ่านง่าย ' : '\u26a0 สีตัวอักษรกลืนพื้นหลัง ') + rr.toFixed(1) + ':1'));
        if (!pass) {
          var fx = E('button', '', 'แก้ให้');
          fx.onclick = function () {
            setP('color', fixOn(bg, fg));
            commit('แก้สีตัวอักษรให้อ่านง่าย'); bar(); frame();
          };
          qb2.appendChild(fx);
        }
        qb.appendChild(qb2);
      } catch (e) {}
    }

    /* twins chip */
    var n = twins(cur);
    if (n > 1) {
      var ch = E('button', 'chip' + (groupMode ? ' a' : ''),
        groupMode ? '\u2713 กำลังแก้พร้อมกันทั้ง ' + n + ' ชิ้น' : 'มีชิ้นหน้าตาเหมือนกันอีก ' + (n - 1) + ' \u2014 แก้พร้อมกันไหม?');
      ch.onclick = function () { groupMode = !groupMode; sel = selFor(cur); bar(); toast(groupMode ? 'แก้พร้อมกันทั้งหมด' : 'แก้เฉพาะชิ้นนี้'); };
      qb.appendChild(ch);
    }
    qb.classList.add('show');
  }

  /* ==================== PANEL: DETAIL ==================== */
  var GRP = [
    { n: 'ระยะ & ขนาด', o: true, it: [
      { p: 'padding', t: 'quad', l: 'ขอบใน', sub: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'] },
      { p: 'margin', t: 'quad', l: 'ขอบนอก', sub: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] },
      { p: 'width', t: 'px', min: 0, max: 900, l: 'กว้าง' }, { p: 'height', t: 'px', min: 0, max: 900, l: 'สูง' },
      { p: 'gap', t: 'px', min: 0, max: 60, l: 'ช่องไฟลูก' }
    ]},
    { n: 'ตัวอักษร', o: true, it: [
      { p: 'font-family', t: 'font', l: 'ฟอนต์' },
      { p: 'font-size', t: 'px', min: 6, max: 90, step: .5, l: 'ขนาด' },
      { p: 'font-weight', t: 'sel', l: 'ความหนา', o: ['300', '400', '500', '600', '700', '800', '900'] },
      { p: 'letter-spacing', t: 'px', min: -4, max: 16, step: .1, l: 'ระยะอักษร' },
      { p: 'line-height', t: 'num', min: .7, max: 3, step: .02, l: 'ระยะบรรทัด' },
      { p: 'text-align', t: 'sel', l: 'จัดข้อความ', o: ['left', 'center', 'right'] },
      { p: 'text-transform', t: 'sel', l: 'ตัวพิมพ์', o: ['none', 'uppercase', 'capitalize'] }
    ]},
    { n: 'ขอบ & เงา', o: false, it: [
      { p: 'border-radius', t: 'quad', max: 200, l: 'มุมทีละมุม', sub: ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'] },
      { p: 'border-width', t: 'px', min: 0, max: 14, l: 'หนาเส้นขอบ', x: { 'border-style': 'solid' } },
      { p: 'border-style', t: 'sel', l: 'แบบเส้น', o: ['solid', 'dashed', 'dotted', 'none'] },
      { p: 'box-shadow', t: 'sel2', l: 'เงากล่อง', o: [['', '— ไม่เปลี่ยน —'], ['none', 'ไม่มี'], ['0 1px 3px rgba(0,0,0,.10)', 'บางมาก'], ['0 4px 14px rgba(0,0,0,.14)', 'บาง'], ['0 10px 28px -8px rgba(0,0,0,.24)', 'กลาง'], ['0 22px 50px -14px rgba(0,0,0,.36)', 'ลอยสูง'], ['0 0 0 3px rgba(245,158,11,.45)', 'ขอบเรืองแสง'], ['inset 0 2px 6px rgba(0,0,0,.28)', 'เงาด้านใน']] },
      { p: 'overflow', t: 'sel', l: 'ส่วนที่ล้น', o: ['visible', 'hidden', 'auto'] }
    ]},
    { n: 'การจัดวาง', o: false, it: [
      { p: 'display', t: 'sel', l: 'ชนิดกล่อง', o: ['block', 'flex', 'inline-flex', 'grid', 'inline-block', 'none'] },
      { p: 'flex-direction', t: 'sel', l: 'ทิศทาง', o: ['row', 'column'] },
      { p: 'justify-content', t: 'sel', l: 'จัดแนวหลัก', o: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'] },
      { p: 'align-items', t: 'sel', l: 'จัดแนวขวาง', o: ['stretch', 'flex-start', 'center', 'flex-end'] },
      { p: 'grid-template-columns', t: 'txt', l: 'คอลัมน์ grid', ph: '1fr 1fr' },
      { p: 'position', t: 'sel', l: 'ตำแหน่ง', o: ['static', 'relative', 'absolute', 'fixed', 'sticky'] },
      { p: 'z-index', t: 'num', min: -5, max: 300, step: 1, l: 'ชั้นซ้อน' }
    ]},
    { n: 'เอฟเฟกต์', o: false, it: [
      { p: 'opacity', t: 'num', min: 0, max: 1, step: .05, l: 'ความทึบ' },
      { p: '_scale', t: 'num', min: .2, max: 3, step: .02, l: 'ย่อ/ขยาย' },
      { p: '_rotate', t: 'num', min: -180, max: 180, step: 1, l: 'หมุน' },
      { p: '_blur', t: 'num', min: 0, max: 20, step: .5, l: 'เบลอ' },
      { p: '_gray', t: 'num', min: 0, max: 1, step: .05, l: 'ขาวดำ' },
      { p: 'background-image', t: 'sel2', l: 'ไล่เฉดสี', o: [['', '— ไม่เปลี่ยน —'], ['none', 'ไม่มี'], ['linear-gradient(135deg,var(--blue),var(--blue-deep))', 'ฟ้า → เข้ม'], ['linear-gradient(135deg,#F59E0B,#EF4444)', 'ส้ม → แดง'], ['linear-gradient(135deg,#8B5CF6,#EC4899)', 'ม่วง → ชมพู'], ['linear-gradient(135deg,#10B981,#06B6D4)', 'เขียว → ฟ้า']] },
      { p: 'transition', t: 'sel2', l: 'ความหน่วง', o: [['', '— ไม่เปลี่ยน —'], ['none', 'ไม่มี'], ['all .15s ease', 'เร็ว'], ['all .3s cubic-bezier(.4,0,.2,1)', 'นุ่ม'], ['all .6s cubic-bezier(.34,1.56,.64,1)', 'เด้ง']] }
    ]}
  ];
  var FAMS = ['"IBM Plex Sans Thai",sans-serif', '"Noto Sans Thai",sans-serif']
    .concat(GF.map(function (f) { return '"' + f + '",sans-serif'; }))
    .concat(['ui-monospace,monospace', 'Georgia,serif']);

  function fparts() {
    var t = (getP('transform') || '') + ' ' + (getP('filter') || '');
    function g(re, d) { var m = t.match(re); return m ? parseFloat(m[1]) : d; }
    return { _scale: g(/scale\(([\d.]+)\)/, 1), _rotate: g(/rotate\((-?[\d.]+)deg\)/, 0), _blur: g(/blur\(([\d.]+)px\)/, 0), _gray: g(/grayscale\(([\d.]+)\)/, 0) };
  }
  function setPart(n, v) {
    var p = fparts(); p[n] = parseFloat(v);
    var c = xy(), t = [];
    if (c[0] || c[1]) t.push('translate(' + c[0] + 'px, ' + c[1] + 'px)');
    if (p._scale !== 1) t.push('scale(' + p._scale + ')');
    if (p._rotate) t.push('rotate(' + p._rotate + 'deg)');
    setP('transform', t.length ? t.join(' ') : null, true);
    var f = [];
    if (p._blur) f.push('blur(' + p._blur + 'px)');
    if (p._gray) f.push('grayscale(' + p._gray + ')');
    setP('filter', f.length ? f.join(' ') : null, true);
  }

  function ctrl(it) {
    var r = E('div', 'r'); r.appendChild(E('div', 'l', it.l));
    var c = E('div', 'c'), sv = (S.rules[ck()] || {});
    var v0 = sv[it.p] !== undefined ? sv[it.p] : comp(it.p);

    if (it.t === 'px' || it.t === 'num') {
      var isPx = it.t === 'px', fp = fparts();
      var v = it.p.charAt(0) === '_' ? fp[it.p] : num(v0);
      var s = E('input'); s.type = 'range';
      s.min = it.min !== undefined ? it.min : 0; s.max = it.max !== undefined ? it.max : 100;
      s.step = it.step || 1; s.value = v;
      var n = E('div', 'n', isPx ? Math.round(v) + 'px' : String(Math.round(v * 100) / 100));
      s.oninput = function () {
        n.textContent = isPx ? s.value + 'px' : s.value;
        if (it.p.charAt(0) === '_') setPart(it.p, s.value);
        else { if (it.x) for (var k in it.x) setP(k, it.x[k], true); setP(it.p, isPx ? s.value + 'px' : s.value, true); }
        frame();
      };
      s.onchange = function () { commit(it.l + ' → ' + s.value); bar(); };
      c.appendChild(s); c.appendChild(n);

    } else if (it.t === 'quad') {
      var q = E('div', 'q');
      it.sub.forEach(function (sp, i) {
        var inp = E('input'); inp.type = 'number'; inp.min = -300; inp.max = it.max || 200;
        inp.value = Math.round(num(sv[sp] !== undefined ? sv[sp] : comp(sp)));
        inp.title = ['บน', 'ขวา', 'ล่าง', 'ซ้าย'][i];
        inp.oninput = function () { setP(sp, inp.value + 'px', true); frame(); };
        inp.onchange = function () { commit(it.l + ' ' + inp.title); bar(); };
        q.appendChild(inp);
      });
      c.appendChild(q);

    } else if (it.t === 'sel' || it.t === 'sel2') {
      var sl = E('select');
      if (it.t === 'sel') { sl.appendChild(new Option('— ไม่เปลี่ยน —', '')); it.o.forEach(function (o) { sl.appendChild(new Option(o, o)); }); }
      else it.o.forEach(function (o) { sl.appendChild(new Option(o[1], o[0])); });
      sl.value = sv[it.p] || '';
      sl.onchange = function () { setP(it.p, sl.value || null); commit(it.l + ' → ' + (sl.selectedOptions[0] || {}).text); bar(); frame(); };
      c.appendChild(sl);

    } else if (it.t === 'font') {
      var sf = E('select'); sf.appendChild(new Option('— ไม่เปลี่ยน —', ''));
      FAMS.forEach(function (f) { sf.appendChild(new Option(f.split(',')[0].replace(/"/g, ''), f)); });
      sf.value = sv[it.p] || '';
      sf.onchange = function () {
        var nm2 = sf.value.split(',')[0].replace(/"/g, '');
        if (GF.indexOf(nm2) > -1) loadFont(nm2);
        setP(it.p, sf.value || null); commit('เปลี่ยนฟอนต์ ' + nm2); frame();
      };
      c.appendChild(sf);

    } else if (it.t === 'txt') {
      var ti = E('input'); ti.type = 'text'; ti.placeholder = it.ph || ''; ti.value = sv[it.p] || '';
      ti.onchange = function () { setP(it.p, ti.value || null); commit(it.l); frame(); };
      c.appendChild(ti);
    }

    var x = E('button', 'x', '&#8630;');
    x.onclick = function () {
      if (it.t === 'quad') { it.sub.forEach(function (sp) { setP(sp, null, true); }); applyRules(); }
      else if (it.p.charAt(0) === '_') setPart(it.p, it.p === '_scale' ? 1 : 0);
      else setP(it.p, null);
      commit('คืนค่า ' + it.l); paint(); bar(); frame();
    };
    c.appendChild(x); r.appendChild(c);
    return r;
  }

  /* ==================== PANEL PAINT ==================== */
  function paint() {
    bd.innerHTML = '';
    $$('.tabs button').forEach(function (b) { b.classList.toggle('a', b.getAttribute('data-t') === tab); });
    if (tab === 'hist') return paintHist();
    if (tab === 'th') return paintTok();
    if (tab === 'css') return paintCss();
    paintEl();
  }

  function paintHist() {
    var top = E('div');
    top.style.cssText = 'padding:10px 13px;display:flex;gap:6px;border-bottom:1px solid #141C29';
    var ba = E('button', 'b2', '&#8630; ย้อนกลับ'); ba.style.cssText = 'flex:1;padding:10px;border:0;border-radius:10px;font-weight:800;font-size:11.5px;cursor:pointer;background:#18212F;color:#B9C4D6';
    ba.onclick = undo;
    var bb = E('button', 'b2', 'ทำซ้ำ &#8631;'); bb.style.cssText = ba.style.cssText; bb.onclick = redo;
    var bc = E('button', '', '&#128065;'); bc.title = 'กดค้างเพื่อดูดีไซน์เดิม';
    bc.style.cssText = 'flex:0 0 44px;padding:10px;border:0;border-radius:10px;font-weight:800;cursor:pointer;background:#18212F;color:#B9C4D6';
    bc.onpointerdown = function (e) {
      try { bc.setPointerCapture(e.pointerId); } catch (x) {}
      muted = true; applyAll(); toast('นี่คือดีไซน์เดิม');
    };
    bc.onpointerup = bc.onpointercancel = bc.onpointerleave = function () {
      if (muted) { muted = false; applyAll(); }
    };
    top.appendChild(ba); top.appendChild(bb); top.appendChild(bc);
    bd.appendChild(top);

    if (S.versions.length) {
      bd.appendChild(E('div', 'hint', '<b>เวอร์ชันที่เก็บไว้</b>'));
      S.versions.forEach(function (v, i) {
        var r = E('div', 'vrow');
        r.appendChild(E('div', 'vn', v.n));
        var lo = E('button', 'ic', '&#8617;'); lo.title = 'เรียกกลับมา';
        lo.onclick = function () {
          var o = JSON.parse(v.s); S.rules = o.rules; S.tokens = o.tokens; S.texts = o.texts;
          applyAll(); commit('เรียกเวอร์ชัน "' + v.n + '"'); bar();
        };
        var dl = E('button', 'ic', '&#10005;'); dl.title = 'ลบ';
        dl.onclick = function () { S.versions.splice(i, 1); saveLS(); paint(); };
        r.appendChild(lo); r.appendChild(dl); bd.appendChild(r);
      });
    }

    bd.appendChild(E('div', 'hint', '<b>ทุกก้าวที่แก้</b> — กดแถวไหนก็ย้อนไปจุดนั้นได้ทันที'));
    for (var i = hist.length - 1; i >= 0; i--) {
      (function (i) {
        var h = hist[i];
        var r = E('div', 'hrow' + (i === hIdx ? ' a' : '') + (i > hIdx ? ' fut' : ''));
        r.appendChild(E('div', 'dot'));
        r.appendChild(E('div', 'hl', h.l));
        r.appendChild(E('div', 'ht', ago(h.t)));
        r.onclick = function () { jump(i); };
        bd.appendChild(r);
      })(i);
    }
  }

  function paintEl() {
    if (!cur) { bd.appendChild(E('div', 'hint', 'ยังไม่ได้เลือกชิ้นงาน<br><br>กด <b>แก้ดีไซน์</b> แล้วคลิกอะไรก็ได้บนหน้าจอ')); return; }
    var st = E('div'); st.style.cssText = 'display:flex;gap:4px;padding:9px 13px;border-bottom:1px solid #141C29';
    [['', 'ปกติ'], [':hover', 'เมื่อชี้'], [':active', 'เมื่อกด']].forEach(function (s) {
      var b = E('button', '', s[1]);
      b.style.cssText = 'flex:1;padding:7px 2px;border-radius:8px;border:1px solid #2B364B;font-size:11px;font-weight:700;cursor:pointer;' +
        (pstate === s[0] ? 'background:#2563EB;border-color:#2563EB;color:#fff' : 'background:#182130;color:#B9C4D6');
      b.onclick = function () { pstate = s[0]; paint(); };
      st.appendChild(b);
    });
    bd.appendChild(st);
    GRP.forEach(function (G) {
      var g = E('div', 'g' + (G.o ? ' o' : ''));
      g.appendChild(E('div', 'gh', '<span>' + G.n + '</span><span>&#9662;</span>'));
      var gb = E('div', 'gb');
      G.it.forEach(function (it) { gb.appendChild(ctrl(it)); });
      g.appendChild(gb); bd.appendChild(g);
      g.querySelector('.gh').onclick = function () { g.classList.toggle('o'); };
    });
  }

  var TOKS = [['--scr', 'พื้นจอ'], ['--card', 'การ์ด'], ['--card2', 'การ์ดรอง'], ['--surface', 'พื้นผิว'],
    ['--ink', 'อักษรหลัก'], ['--muted', 'อักษรจาง'], ['--line', 'เส้นคั่น'], ['--blue', 'สีแบรนด์'],
    ['--blue-soft', 'แบรนด์อ่อน'], ['--blue-deep', 'แบรนด์เข้ม'], ['--on-accent', 'อักษรบนสีเน้น'],
    ['--alert', 'สีเตือน'], ['--warn', 'สีระวัง'], ['--good', 'สีสำเร็จ']];
  var TOKPX = [['--r-card', 'โค้งการ์ด'], ['--r-tile', 'โค้งไทล์']];
  var FB = { '--scr': '#FCFBF7', '--card': '#FFFFFF', '--card2': '#F4F2EC', '--surface': '#FAF9F5', '--ink': '#1F2430',
    '--muted': '#6A6F7E', '--line': 'rgba(31,36,48,.09)', '--blue': '#9E5B04', '--blue-soft': '#FFF3DF',
    '--blue-deep': '#7A4604', '--on-accent': '#FFFFFF', '--alert': '#C42B1F', '--warn': '#8A6206', '--good': '#1C6B3B',
    '--r-card': '20px', '--r-tile': '14px' };

  function paintTok() {
    var cs = getComputedStyle(document.documentElement);
    function tok(n) { return (S.tokens[theme()] || {})[n] || cs.getPropertyValue(n).trim() || FB[n]; }
    var seed = hex(tok('--blue'));

    /* ---- 1. สร้างธีมจากสีเดียว ---- */
    bd.appendChild(E('div', 'sec', '\ud83e\ude84 สร้างชุดสีทั้งแอปจากสีเดียว'));
    bd.appendChild(E('div', 'hint', 'เลือกสีที่ชอบมา 1 สี เดี๋ยวคำนวณสีพื้น สีการ์ด สีตัวอักษร ให้เข้ากันทั้งหมดเอง'));
    var sro = E('div', 'seedrow');
    var sc = E('input'); sc.type = 'color'; sc.value = seed;
    var sb = E('button', '', 'สร้างชุดสีให้เลย');
    sb.onclick = function () { applyTheme(genTheme(sc.value, null, false), 'สร้างชุดสีจาก ' + sc.value); };
    sro.appendChild(sc); sro.appendChild(sb);
    bd.appendChild(sro);

    /* ---- 2. ตรวจว่าสีที่ใช้อยู่อ่านออกไหม ---- */
    bd.appendChild(E('div', 'sec', '\ud83d\udc41\ufe0f ตรวจว่าสีอ่านออกไหม'));
    var CHECK = [
      { a: '--ink', b: '--card', l: 'ตัวอักษรหลัก บนการ์ด' },
      { a: '--muted', b: '--card', l: 'ตัวอักษรจาง บนการ์ด' },
      { a: '--ink', b: '--scr', l: 'ตัวอักษรหลัก บนพื้นจอ' },
      { a: '--on-accent', b: '--blue', l: 'ตัวอักษร บนปุ่มสีแบรนด์' }
    ];
    var bad = 0;
    CHECK.forEach(function (c) {
      var fg = hex(tok(c.a)), bg = hex(tok(c.b));
      var r = ratio(fg, bg), v = rate(r);
      if (!v.ok) bad++;
      var d = E('div', 'badge ' + (v.ok ? 'ok' : 'no'));
      d.appendChild(E('div', '', (v.ok ? '\u2713 ' : '\u26a0 ') + c.l + '<br>' + r.toFixed(1) + ' : 1 — ' + v.t));
      if (!v.ok) {
        var f = E('button', '', 'แก้ให้');
        f.onclick = function () {
          setTok(c.a, fixOn(bg, fg));
          commit('แก้สีให้อ่านง่าย: ' + c.l);
          paint();
        };
        d.appendChild(f);
      }
      bd.appendChild(d);
    });
    if (!bad) bd.appendChild(E('div', 'hint', 'สีที่ใช้อยู่ผ่านมาตรฐานการอ่าน (WCAG AA) ทุกคู่ \u2014 ดีมาก'));

    /* ---- 3. พาเลตต์สำเร็จรูป ---- */
    bd.appendChild(E('div', 'sec', '\ud83c\udfa8 พาเลตต์สำเร็จรูป — กดทีเดียวเปลี่ยนทั้งแอป'));
    PALETTES.forEach(function (p) {
      var card = E('div', 'pcard');
      var st = E('div', 'strip');
      palColors(p).forEach(function (c) { var i = E('i'); i.style.background = c; st.appendChild(i); });
      var info = E('div', 'pi');
      info.appendChild(E('b', '', p.n));
      info.appendChild(E('span', '', p.m));
      card.appendChild(st); card.appendChild(info);
      card.onclick = function () { applyTheme(genTheme(p.s, p.h, p.w), 'ใช้พาเลตต์ "' + p.n + '"'); };
      bd.appendChild(card);
    });

    /* ---- 4. สีที่เข้ากับสีแบรนด์ ---- */
    bd.appendChild(E('div', 'sec', '\ud83e\uddee สีที่เข้ากับสีแบรนด์ตอนนี้'));
    bd.appendChild(E('div', 'hint', 'กดสีเพื่อใช้กับชิ้นที่เลือกอยู่ (ถ้ายังไม่ได้เลือก จะตั้งเป็นสีแบรนด์ใหม่)'));
    harmony(seed).forEach(function (h) {
      var w = E('div', 'harm');
      w.appendChild(E('div', 'hn', h.n));
      var hs = E('div', 'hs');
      h.c.forEach(function (c) {
        var i = E('i'); i.style.background = c; i.title = c;
        i.onclick = function () {
          if (cur) { setP(TPROP[target], c); commit('ใช้สีที่เข้ากัน ' + c); bar(); }
          else { setTok('--blue', c); setTok('--on-accent', bestOn(c)); commit('เปลี่ยนสีแบรนด์เป็น ' + c); paint(); }
        };
        hs.appendChild(i);
      });
      w.appendChild(hs); bd.appendChild(w);
    });

    /* ---- 5. ปรับเอง ---- */
    bd.appendChild(E('div', 'sec', '\u2699\ufe0f ปรับเองทีละสี'));
    bd.appendChild(E('div', 'hint', 'เปลี่ยนตรงนี้ = เปลี่ยน<b>ทั้งแอปทุกหน้า</b>พร้อมกัน · ธีมตอนนี้: <b>' + theme() + '</b>'));
    TOKS.forEach(function (t) {
      var v = (S.tokens[theme()] || {})[t[0]] || cs.getPropertyValue(t[0]).trim() || FB[t[0]];
      if (!v) return;
      var r = E('div', 'r'); r.style.padding = '0 13px'; r.appendChild(E('div', 'l', t[1]));
      var c = E('div', 'c');
      var ci = E('input'); ci.type = 'color'; ci.value = hex(v);
      var ar = E('input'); ar.type = 'range'; ar.min = 0; ar.max = 1; ar.step = .05; ar.value = alph(v);
      var up = function (q) { setTok(t[0], parseFloat(ar.value) >= 1 ? ci.value : rgba(ci.value, ar.value), q); };
      ci.oninput = function () { if (parseFloat(ar.value) === 0) ar.value = 1; up(true); };
      ar.oninput = function () { up(true); };
      ci.onchange = ar.onchange = function () { up(); commit('สีธีม: ' + t[1]); };
      var x = E('button', 'x', '&#8630;'); x.onclick = function () { setTok(t[0], null); commit('คืนค่าสีธีม ' + t[1]); paint(); };
      c.appendChild(ci); c.appendChild(ar); c.appendChild(x); r.appendChild(c); bd.appendChild(r);
    });
    TOKPX.forEach(function (t) {
      var v = (S.tokens[theme()] || {})[t[0]] || cs.getPropertyValue(t[0]).trim() || FB[t[0]];
      var r = E('div', 'r'); r.style.padding = '0 13px'; r.appendChild(E('div', 'l', t[1]));
      var c = E('div', 'c');
      var s = E('input'); s.type = 'range'; s.min = 0; s.max = 60; s.value = num(v);
      var n = E('div', 'n', num(v) + 'px');
      s.oninput = function () { n.textContent = s.value + 'px'; setTok(t[0], s.value + 'px', true); };
      s.onchange = function () { saveLS(); commit('ความมนธีม: ' + t[1]); };
      var x = E('button', 'x', '&#8630;'); x.onclick = function () { setTok(t[0], null); commit('คืนค่า ' + t[1]); paint(); };
      c.appendChild(s); c.appendChild(n); c.appendChild(x); r.appendChild(c); bd.appendChild(r);
    });
  }

  function paintCss() {
    if (!cur) { bd.appendChild(E('div', 'hint', 'เลือกชิ้นงานก่อน')); return; }
    bd.appendChild(E('div', 'hint', 'เขียน CSS อะไรก็ได้ ทีละบรรทัดแบบ <b>property: value;</b>'));
    var w = E('div'); w.style.padding = '0 13px';
    var ta = E('textarea'); ta.rows = 12;
    ta.placeholder = 'clip-path: circle(45%);\nanimation: pulse 2s infinite;\nbackdrop-filter: blur(12px);';
    var d = S.rules[ck()] || {}, t = '', k;
    for (k in d) t += k + ': ' + d[k] + ';\n';
    ta.value = t;
    var b = E('button', '', 'ใช้กับชิ้นนี้');
    b.style.cssText = 'width:100%;padding:11px;border:0;border-radius:10px;font-weight:800;margin-top:8px;cursor:pointer;background:#F59E0B;color:#111';
    b.onclick = function () {
      var k2 = ck(); if (!k2) return;
      var nd = {};
      ta.value.split(/[;\n]/).forEach(function (ln) {
        var i = ln.indexOf(':'); if (i < 1) return;
        var p = ln.slice(0, i).trim(), v = ln.slice(i + 1).trim();
        if (p && v) nd[p] = v;
      });
      if (Object.keys(nd).length) S.rules[k2] = nd; else delete S.rules[k2];
      applyRules(); commit('เขียน CSS เอง'); bar(); frame(); toast('ใช้แล้ว');
    };
    w.appendChild(ta); w.appendChild(b); bd.appendChild(w);
  }

  /* ==================== KEYBOARD ==================== */
  document.addEventListener('keydown', function (e) {
    if (!editing || paused) return;
    var t = e.target;
    if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    if (t && t.getAttribute && t.getAttribute('contenteditable')) return;
    var m = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { cur = null; frame(); paint(); return; }
    if (m && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (m && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (!cur) return;
    if (e.key === '[') { if (cur.parentElement && cur.parentElement !== document.body) pick(cur.parentElement); return; }
    if (e.key === ']') { if (cur.firstElementChild) pick(cur.firstElementChild); return; }
    var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    var st = e.shiftKey ? 10 : 1, c = xy();
    setXY(c[0] + d[0] * st, c[1] + d[1] * st);
    frame();
    clearTimeout(window.__veNudge);
    window.__veNudge = setTimeout(function () { commit('ขยับตำแหน่ง'); }, 500);
  }, true);

  /* ==================== BUTTONS ==================== */
  function openPanel(o) {
    pn.classList.toggle('open', o);
    /* จอกว้าง: ขยับปุ่มมาซ้ายของแผง · จอแคบ: แผงกินทั้งจอ ซ่อนปุ่มไปเลย (ปิดแผงด้วยกากบาทในแผง) */
    var f = $('#fabs');
    f.style.right = (o && wide()) ? '344px' : '14px';
    f.style.display = (o && !wide()) ? 'none' : 'flex';
    frame();
  }
  $('#fab').onclick = function () {
    editing = !editing;
    paused = false;
    $('#fab').classList.toggle('on', editing);
    $('#pauseB').classList.toggle('show', editing);
    $('#pauseB').classList.remove('on');
    $('#fabT').textContent = editing ? 'เสร็จแล้ว' : 'แก้ดีไซน์';
    if (editing) {
      openPanel(true); paint();
      if (!S.seen) { showCoach(); }
      toast('แตะอะไรก็ได้บนหน้าจอเพื่อเริ่มแก้');
    } else {
      cur = null; openPanel(false); hl.style.display = 'none'; tip.style.display = 'none';
      toast('ใช้แอปได้ตามปกติ');
    }
    frame();
  };
  /* พักการแก้ชั่วคราว — กดใช้แอปจริง ๆ ได้ (เปลี่ยนหน้า เปิดเมนู) โดยไม่เสียงานที่แก้ไว้ */
  $('#pauseB').onclick = function () {
    paused = !paused;
    $('#pauseB').classList.toggle('on', paused);
    hl.style.display = 'none'; tip.style.display = 'none';
    frame();
    toast(paused ? 'กดใช้แอปได้ตามปกติ · กด ✋ อีกครั้งเพื่อกลับมาแก้' : 'กลับมาโหมดแก้ดีไซน์แล้ว');
  };
  $('#pClose').onclick = function () { openPanel(false); };
  $('#pUndo').onclick = undo;
  $('#pRedo').onclick = redo;
  $$('.tabs button').forEach(function (b) { b.onclick = function () { tab = b.getAttribute('data-t'); paint(); }; });

  $('#bVer').onclick = function () {
    var n = prompt('ตั้งชื่อเวอร์ชันนี้', 'แบบที่ ' + (S.versions.length + 1));
    if (!n) return;
    S.versions.push({ n: n, s: core(), t: Date.now() });
    saveLS(); tab = 'hist'; paint(); toast('เก็บเวอร์ชัน "' + n + '" แล้ว');
  };
  $('#bClr').onclick = function () {
    if (!confirm('ล้างการแก้ทั้งหมด กลับเป็นดีไซน์เดิม?')) return;
    S.rules = {}; S.tokens = {}; S.texts = {};
    applyAll(); commit('ล้างทั้งหมด'); cur = null; frame(); paint();
  };

  function exportCSS() {
    var out = '/* ==========================================================\n   StudentOS — Visual Edits\n   ' + new Date().toLocaleString('th-TH') +
      '\n   วางต่อท้าย style.css\n   ========================================================== */\n\n';
    S.fonts.forEach(function (f) {
      out += "@import url('https://fonts.googleapis.com/css2?family=" + f.replace(/ /g, '+') + ":wght@200;300;400;500;600;700;800&display=swap');\n";
    });
    if (S.fonts.length) out += '\n';
    for (var th in S.tokens) {
      var t = S.tokens[th], b = '', n;
      for (n in t) b += '  ' + n + ':' + t[n] + ';\n';
      if (!b) continue;
      out += (th === 'light' ? ':root, :root[data-theme="light"]' : ':root[data-theme="' + th + '"]') + '{\n' + b + '}\n\n';
    }
    var r = ruleText(true);
    if (r) out += '/* ---------- ชิ้นงานที่ปรับเอง ---------- */\n' + r;
    var tk = Object.keys(S.texts);
    if (tk.length) {
      out += '\n/* ---------- ข้อความที่แก้ (ไปแก้ใน index.html เอง) ----------\n';
      tk.forEach(function (s) { out += '   ' + s + '\n     → ' + S.texts[s] + '\n'; });
      out += '   -------------------------------------------------------- */\n';
    }
    return out;
  }
  $('#bEx').onclick = function () { $('#out').value = exportCSS(); $('#md').classList.add('o'); };
  $('#bX').onclick = function () { $('#md').classList.remove('o'); };
  $('#bCp').onclick = function () {
    var ta = $('#out'); ta.select();
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(function () { toast('คัดลอกแล้ว'); }, function () {});
    else { try { document.execCommand('copy'); toast('คัดลอกแล้ว'); } catch (e) {} }
  };
  $('#bDl').onclick = function () {
    var b = new Blob([$('#out').value], { type: 'text/css' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'custom.css'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000); toast('ดาวน์โหลดแล้ว');
  };

  /* ==================== COACH ==================== */
  function showCoach() {
    var c = $('#coach');
    c.innerHTML = 'แตะการ์ด ปุ่ม หรือตัวอักษรอะไรก็ได้บนจอ<br>แถบเครื่องมือจะเด้งมาให้ปรับทันที<br><br>' +
      'อยากกดใช้แอปจริง ๆ กด <b>✋</b> ข้างปุ่มนี้<br>' +
      'ทุกอย่างที่แก้ ย้อนกลับได้หมดในแท็บ <b>ประวัติ</b>' +
      '<button id="cOK">เข้าใจแล้ว</button>';
    c.classList.add('show');
    c.querySelector('#cOK').onclick = function () { c.classList.remove('show'); S.seen = true; saveLS(); };
  }

  /* ==================== INIT ==================== */
  new MutationObserver(function () { applyTokens(); if (pn.classList.contains('open')) paint(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  applyAll();
  setTimeout(applyTexts, 900);
  setInterval(function () { if (Object.keys(S.texts).length) applyTexts(); }, 2500);

  if (!hist.length) {
    hist = [{ l: 'ดีไซน์เดิม', s: JSON.stringify({ rules: {}, tokens: {}, texts: {} }), t: Date.now() }];
    hIdx = 0;
  }
  /* ถ้าสิ่งที่อยู่บนจอไม่ตรงกับหมุดล่าสุดในประวัติ (เช่นประวัติเคยถูกตัดทิ้ง) ปักหมุดใหม่ให้ตรงกัน */
  if (!hist[hIdx] || hist[hIdx].s !== core()) {
    hist = hist.slice(0, hIdx + 1);
    hist.push({ l: 'งานที่บันทึกไว้ก่อนหน้า', s: core(), t: Date.now() });
    hIdx = hist.length - 1;
  }

  console.log('%cVisual Editor v3 พร้อมใช้ — กดปุ่ม "แก้ดีไซน์" มุมขวาบน', 'background:#F59E0B;color:#111;padding:4px 10px;border-radius:6px;font-weight:700');
})();
