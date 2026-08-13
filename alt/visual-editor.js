/* ============================================================
   StudentOS — Visual Editor  v1
   แก้ UI ด้วยการคลิก + ลากสไลเดอร์ ไม่ต้องแตะโค้ด
   ------------------------------------------------------------
   วิธีใช้: เติมบรรทัดนี้ก่อน </body> ใน index.html
       <script src="visual-editor.js"></script>
   แล้วเปิดเว็บ กดปุ่มดินสอมุมขวาบน
   ปิดถาวรเมื่อทำเสร็จ: ลบบรรทัดนั้นออก (ไฟล์นี้ไม่แตะ CSS/JS เดิมเลย)
   ============================================================ */
(function () {
  'use strict';
  if (window.__SOS_VE__) return;
  window.__SOS_VE__ = true;

  /* ---------- state ---------- */
  var LS = 'sos_ve_v1';
  var state = { rules: {}, tokens: {} };
  try {
    var raw = localStorage.getItem(LS);
    if (raw) { var p = JSON.parse(raw); state.rules = p.rules || {}; state.tokens = p.tokens || {}; }
  } catch (e) {}

  var undoStack = [];
  var current = null;     // element ที่เลือกอยู่
  var currentSel = null;  // selector ของ element นั้น
  var picking = false;    // โหมดเลือกชิ้นงาน
  var groupMode = false;  // แก้ทุกชิ้นที่หน้าตาเหมือนกัน

  function theme() { return document.documentElement.getAttribute('data-theme') || 'light'; }
  function save() { try { localStorage.setItem(LS, JSON.stringify({ rules: state.rules, tokens: state.tokens })); } catch (e) {} }

  /* ---------- style sink ---------- */
  var sink = document.createElement('style');
  sink.id = 'sos-ve-style';
  document.head.appendChild(sink);

  function buildRuleCSS(important) {
    var out = '', sel;
    for (sel in state.rules) {
      var d = state.rules[sel], body = '', k;
      for (k in d) body += '  ' + k + ':' + d[k] + (important ? ' !important' : '') + ';\n';
      if (body) out += sel + '{\n' + body + '}\n';
    }
    return out;
  }
  function applyRules() { sink.textContent = buildRuleCSS(true); save(); }

  var liveTokenNames = [];
  function applyTokens() {
    var root = document.documentElement, i;
    for (i = 0; i < liveTokenNames.length; i++) root.style.removeProperty(liveTokenNames[i]);
    liveTokenNames = [];
    var t = state.tokens[theme()] || {}, n;
    for (n in t) { root.style.setProperty(n, t[n]); liveTokenNames.push(n); }
    save();
  }

  /* ---------- selector ---------- */
  var VOLATILE = /^(is-|has-|js-|ve-)|^(active|on|open|show|shown|hide|hidden|selected|sel|current|done|loading|visible|anim)$/;
  function classesOf(el, arr) {
    var c = (el.className && el.className.baseVal !== undefined) ? el.className.baseVal : el.className;
    if (typeof c !== 'string') return '';
    var list = c.trim().split(/\s+/).filter(function (x) { return x && !VOLATILE.test(x); });
    if (arr) return list;
    return list.map(function (x) { return '.' + CSS.escape(x); }).join('');
  }
  function unique(s) { try { return document.querySelectorAll(s).length === 1; } catch (e) { return false; } }

  function groupSelector(el) {
    var c = classesOf(el);
    return c ? el.tagName.toLowerCase() + c : el.tagName.toLowerCase();
  }
  function cssPath(el) {
    if (el.id && unique('#' + CSS.escape(el.id))) return '#' + CSS.escape(el.id);
    var parts = [], node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      var seg = node.tagName.toLowerCase() + classesOf(node);
      if (node.id) { parts.unshift('#' + CSS.escape(node.id)); break; }
      var par = node.parentElement;
      if (par) {
        var same = [].filter.call(par.children, function (c) { return c.tagName === node.tagName; });
        if (same.length > 1) seg += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(seg);
      var join = parts.join(' > ');
      if (unique(join)) return join;
      node = par;
    }
    return parts.join(' > ');
  }
  function selectorFor(el) { return groupMode ? groupSelector(el) : cssPath(el); }

  /* ---------- set / clear ---------- */
  function setProp(prop, val, silent) {
    if (!currentSel) return;
    var d = state.rules[currentSel] || (state.rules[currentSel] = {});
    if (!silent) undoStack.push({ kind: 'rule', sel: currentSel, prop: prop, prev: d.hasOwnProperty(prop) ? d[prop] : null });
    if (val === null) delete d[prop]; else d[prop] = val;
    if (!Object.keys(d).length) delete state.rules[currentSel];
    applyRules();
  }
  function setToken(name, val) {
    var th = theme(), t = state.tokens[th] || (state.tokens[th] = {});
    undoStack.push({ kind: 'token', theme: th, name: name, prev: t.hasOwnProperty(name) ? t[name] : null });
    if (val === null) delete t[name]; else t[name] = val;
    applyTokens();
  }
  function undo() {
    var a = undoStack.pop(); if (!a) return;
    if (a.kind === 'rule') {
      var d = state.rules[a.sel] || (state.rules[a.sel] = {});
      if (a.prev === null) delete d[a.prop]; else d[a.prop] = a.prev;
      if (!Object.keys(d).length) delete state.rules[a.sel];
      applyRules();
    } else {
      var t = state.tokens[a.theme] || (state.tokens[a.theme] = {});
      if (a.prev === null) delete t[a.name]; else t[a.name] = a.prev;
      applyTokens();
    }
    if (current) renderPanel();
    toast('ย้อนกลับแล้ว');
  }

  /* ---------- colour helpers ---------- */
  function toHex(c) {
    if (!c) return '#000000';
    var m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return (c[0] === '#' && c.length === 7) ? c : '#000000';
    var n = m[1].split(',').map(parseFloat);
    return '#' + [n[0], n[1], n[2]].map(function (v) {
      return ('0' + Math.round(v).toString(16)).slice(-2);
    }).join('');
  }
  function alphaOf(c) { var m = c && c.match(/rgba\(([^)]+)\)/); return m ? (parseFloat(m[1].split(',')[3]) || 0) : 1; }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function px(v) { return Math.round(parseFloat(v) || 0); }

  /* ---------- shell ---------- */
  var host = document.createElement('div');
  host.id = 'sos-ve-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  document.body.appendChild(host);
  var sr = host.attachShadow({ mode: 'open' });

  sr.innerHTML =
'<style>' +
':host,*{box-sizing:border-box}' +
'.pe{pointer-events:auto}' +
'#hi,#se{position:fixed;pointer-events:none;border-radius:4px;transition:all .07s linear}' +
'#hi{outline:2px dashed #6FA8FF;outline-offset:1px;background:rgba(111,168,255,.10)}' +
'#se{outline:2px solid #F59E0B;outline-offset:1px;box-shadow:0 0 0 9999px rgba(0,0,0,.04)}' +
'#tag{position:fixed;font:600 11px ui-monospace,monospace;background:#111827;color:#fff;padding:3px 7px;border-radius:6px;pointer-events:none;white-space:nowrap;max-width:70vw;overflow:hidden;text-overflow:ellipsis}' +
'#fab{position:fixed;top:14px;right:14px;width:46px;height:46px;border-radius:14px;border:0;background:#111827;color:#fff;font-size:19px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.35)}' +
'#fab.on{background:#F59E0B;color:#111}' +
'#panel{position:fixed;top:0;right:0;width:330px;max-width:92vw;height:100%;background:#0F1420;color:#E7ECF6;font:13px/1.5 -apple-system,"IBM Plex Sans Thai",system-ui,sans-serif;display:flex;flex-direction:column;box-shadow:-14px 0 44px rgba(0,0,0,.5);transform:translateX(105%);transition:transform .22s cubic-bezier(.4,0,.2,1)}' +
'#panel.open{transform:none}' +
'.hd{padding:12px 14px;border-bottom:1px solid #232C3E;flex:0 0 auto}' +
'.ttl{font-weight:800;font-size:14px;letter-spacing:-.2px}' +
'.sub{color:#8B96AC;font-size:11px;margin-top:2px}' +
'.mode{display:flex;gap:6px;margin-top:10px}' +
'.mode button{flex:1;padding:8px 4px;border-radius:9px;border:1px solid #2C3648;background:#18202F;color:#C3CBDA;font-size:12px;font-weight:700;cursor:pointer}' +
'.mode button.act{background:#F59E0B;border-color:#F59E0B;color:#111}' +
'.body{flex:1;overflow-y:auto;padding:4px 0 90px}' +
'.selbar{padding:9px 14px;background:#151C2A;border-bottom:1px solid #232C3E;display:flex;align-items:center;gap:6px}' +
'.selbar code{flex:1;font:600 11px ui-monospace,monospace;color:#FBBF24;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
'.nav{border:1px solid #2C3648;background:#18202F;color:#C3CBDA;border-radius:7px;width:26px;height:26px;font-size:12px;cursor:pointer;flex:0 0 auto}' +
'.grp{border-bottom:1px solid #1C2434}' +
'.gh{padding:11px 14px;font-weight:800;font-size:12px;color:#9FB0CC;cursor:pointer;display:flex;justify-content:space-between;user-select:none}' +
'.gb{padding:0 14px 12px;display:none}' +
'.grp.open .gb{display:block}' +
'.row{display:flex;align-items:center;gap:8px;margin:9px 0}' +
'.lb{flex:0 0 96px;color:#A8B4C8;font-size:12px}' +
'.ctl{flex:1;display:flex;align-items:center;gap:6px;min-width:0}' +
'input[type=range]{flex:1;min-width:0;accent-color:#F59E0B;height:18px}' +
'input[type=color]{width:32px;height:26px;padding:0;border:1px solid #2C3648;border-radius:6px;background:#18202F;cursor:pointer}' +
'select,input[type=text]{flex:1;min-width:0;background:#18202F;border:1px solid #2C3648;color:#E7ECF6;border-radius:7px;padding:5px 7px;font-size:12px}' +
'.num{flex:0 0 44px;text-align:right;font:600 11px ui-monospace,monospace;color:#FBBF24}' +
'.rst{border:0;background:none;color:#5C6880;cursor:pointer;font-size:13px;flex:0 0 auto;padding:0 2px}' +
'.rst:hover{color:#F59E0B}' +
'.ft{position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:#0F1420;border-top:1px solid #232C3E;display:flex;gap:7px}' +
'.ft button{flex:1;padding:10px 4px;border-radius:10px;border:0;font-weight:800;font-size:12px;cursor:pointer}' +
'.b1{background:#F59E0B;color:#111}.b2{background:#1E2838;color:#C3CBDA}.b3{background:#2A1518;color:#F19A9A}' +
'.hint{padding:10px 14px;color:#7B879C;font-size:11px;line-height:1.7}' +
'.kbd{background:#1E2838;border-radius:4px;padding:1px 5px;font:600 10px ui-monospace,monospace;color:#C3CBDA}' +
'#toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:9px 15px;border-radius:10px;font:600 12px system-ui;opacity:0;transition:opacity .2s}' +
'#modal{position:fixed;inset:0;background:rgba(4,7,14,.82);display:none;align-items:center;justify-content:center;padding:20px}' +
'#modal.open{display:flex}' +
'.card{background:#0F1420;border:1px solid #2C3648;border-radius:16px;width:640px;max-width:100%;max-height:84vh;display:flex;flex-direction:column;color:#E7ECF6;font-family:-apple-system,"IBM Plex Sans Thai",system-ui,sans-serif}' +
'.card h3{margin:0;padding:14px 16px;font-size:14px;border-bottom:1px solid #232C3E}' +
'.card textarea{flex:1;min-height:300px;margin:0;border:0;background:#0A0E17;color:#9FE6B0;font:12px/1.6 ui-monospace,monospace;padding:14px;resize:none;outline:none}' +
'.card .ft2{padding:12px 16px;display:flex;gap:8px;border-top:1px solid #232C3E}' +
'.card .ft2 button{flex:1;padding:11px;border-radius:10px;border:0;font-weight:800;font-size:12px;cursor:pointer}' +
'</style>' +
'<div id="hi" style="display:none"></div><div id="se" style="display:none"></div><div id="tag" style="display:none"></div>' +
'<button id="fab" class="pe" title="Visual Editor">&#9998;</button>' +
'<div id="panel" class="pe">' +
 '<div class="hd"><div class="ttl">Visual Editor</div><div class="sub">แก้หน้าตาแอปโดยไม่ต้องแตะโค้ด</div>' +
  '<div class="mode"><button id="mPick">&#128070; เลือกชิ้นงาน</button><button id="mUse" class="act">&#9654; ใช้แอปปกติ</button></div>' +
 '</div>' +
 '<div class="body" id="body"></div>' +
 '<div class="ft"><button class="b1" id="bExport">&#8681; เอาโค้ดออก</button><button class="b2" id="bUndo">&#8630;</button><button class="b3" id="bReset">ล้าง</button></div>' +
'</div>' +
'<div id="toast"></div>' +
'<div id="modal" class="pe"><div class="card"><h3>วางโค้ดนี้ต่อท้ายไฟล์ <b>style.css</b> ของคุณ</h3><textarea id="out" spellcheck="false"></textarea><div class="ft2"><button class="b1" id="bCopy">คัดลอก</button><button class="b2" id="bDl">ดาวน์โหลด custom.css</button><button class="b2" id="bClose">ปิด</button></div></div></div>';

  var $ = function (s) { return sr.querySelector(s); };
  var hi = $('#hi'), se = $('#se'), tagEl = $('#tag'), panel = $('#panel'), body = $('#body'), fab = $('#fab');

  function toast(m) {
    var t = $('#toast'); t.textContent = m; t.style.opacity = '1';
    clearTimeout(t._t); t._t = setTimeout(function () { t.style.opacity = '0'; }, 1400);
  }
  function box(el, node) {
    var r = el.getBoundingClientRect();
    node.style.cssText += ';display:block;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;';
  }

  /* ---------- picking ---------- */
  function inHost(e) { return e.composedPath && e.composedPath().indexOf(host) > -1; }

  document.addEventListener('mousemove', function (e) {
    if (!picking || inHost(e)) { hi.style.display = 'none'; tagEl.style.display = 'none'; return; }
    var el = e.target;
    if (!el || el === document.body || el === document.documentElement) return;
    box(el, hi);
    var r = el.getBoundingClientRect();
    tagEl.textContent = el.tagName.toLowerCase() + (classesOf(el) || '');
    tagEl.style.cssText += ';display:block;left:' + Math.max(4, r.left) + 'px;top:' + (r.top > 26 ? r.top - 24 : r.bottom + 5) + 'px;';
  }, true);

  ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'pointerdown'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (!picking || inHost(e)) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (ev === 'click') select(e.target);
    }, true);
  });

  var lastPick = 0;
  function select(el) {
    if (!el || el === document.body) return;
    /* <label> จะยิง click ซ้ำไปที่ input ข้างใน — รับเฉพาะคลิกแรก */
    var now = Date.now();
    if (now - lastPick < 120) return;
    lastPick = now;
    current = el; currentSel = selectorFor(el);
    box(el, se); se.style.display = 'block';
    renderPanel();
  }
  function reframe() { if (current) box(current, se); }
  window.addEventListener('scroll', reframe, true);
  window.addEventListener('resize', reframe);

  /* ---------- controls ---------- */
  var GROUPS = [
    { n: 'ตัวอักษร', open: true, items: [
      { p: 'color', t: 'color', l: 'สีตัวอักษร' },
      { p: 'font-size', t: 'px', min: 8, max: 64, step: 1, l: 'ขนาดตัวอักษร' },
      { p: 'font-weight', t: 'sel', l: 'ความหนา', o: ['300', '400', '500', '600', '700', '800', '900'] },
      { p: 'letter-spacing', t: 'px', min: -3, max: 10, step: .1, l: 'ระยะห่างอักษร' },
      { p: 'line-height', t: 'num', min: .8, max: 2.6, step: .05, l: 'ระยะบรรทัด' },
      { p: 'text-align', t: 'sel', l: 'จัดข้อความ', o: ['left', 'center', 'right'] }
    ]},
    { n: 'กล่อง / การ์ด', open: true, items: [
      { p: 'background-color', t: 'color', a: true, l: 'สีพื้นหลัง' },
      { p: 'border-radius', t: 'px', min: 0, max: 60, step: 1, l: 'ความโค้งมุม' },
      { p: 'padding', t: 'px', min: 0, max: 60, step: 1, l: 'ระยะขอบใน' },
      { p: 'gap', t: 'px', min: 0, max: 48, step: 1, l: 'ช่องไฟลูก' },
      { p: 'border-width', t: 'px', min: 0, max: 8, step: 1, l: 'ความหนาขอบ', x: { 'border-style': 'solid' } },
      { p: 'border-color', t: 'color', a: true, l: 'สีเส้นขอบ' },
      { p: 'box-shadow', t: 'shadow', l: 'เงา' },
      { p: 'opacity', t: 'num', min: 0, max: 1, step: .05, l: 'ความทึบ' }
    ]},
    { n: 'ตำแหน่ง / ขนาด', open: false, items: [
      { p: 'margin-top', t: 'px', min: -40, max: 80, step: 1, l: 'ห่างด้านบน' },
      { p: 'margin-bottom', t: 'px', min: -40, max: 80, step: 1, l: 'ห่างด้านล่าง' },
      { p: 'width', t: 'px', min: 0, max: 520, step: 1, l: 'ความกว้าง' },
      { p: 'height', t: 'px', min: 0, max: 520, step: 1, l: 'ความสูง' }
    ]}
  ];

  var SHADOWS = [
    ['', '— ไม่เปลี่ยน —'], ['none', 'ไม่มีเงา'],
    ['var(--shadow)', 'ตามธีม (นุ่ม)'], ['var(--shadow-lg)', 'ตามธีม (เด่น)'],
    ['0 2px 8px rgba(0,0,0,.08)', 'บาง'],
    ['0 8px 24px -8px rgba(0,0,0,.20)', 'กลาง'],
    ['0 20px 46px -14px rgba(0,0,0,.32)', 'ลอยสูง']
  ];

  var TOKENS = [
    ['--scr', 'สีพื้นจอ', 'c'], ['--card', 'สีการ์ด', 'c'], ['--card2', 'สีการ์ดรอง', 'c'],
    ['--ink', 'สีตัวอักษรหลัก', 'c'], ['--muted', 'สีตัวอักษรจาง', 'c'], ['--line', 'สีเส้นคั่น', 'c'],
    ['--blue', 'สีเน้น (แบรนด์)', 'c'], ['--blue-soft', 'สีเน้นอ่อน', 'c'], ['--blue-deep', 'สีเน้นเข้ม', 'c'],
    ['--on-accent', 'ตัวอักษรบนสีเน้น', 'c'],
    ['--alert', 'สีเตือน/ด่วน', 'c'], ['--warn', 'สีระวัง', 'c'], ['--good', 'สีสำเร็จ', 'c'],
    ['--r-card', 'ความโค้งการ์ด', 'p'], ['--r-tile', 'ความโค้งไทล์', 'p']
  ];

  /* ค่าสำรอง เผื่ออ่านค่าจาก stylesheet ไม่ได้ (เช่น CSS ยังโหลดไม่เสร็จ) */
  var FALLBACK = {
    '--scr': '#FCFBF7', '--card': '#FFFFFF', '--card2': '#F4F2EC',
    '--ink': '#1F2430', '--muted': '#6A6F7E', '--line': 'rgba(31,36,48,.09)',
    '--blue': '#9E5B04', '--blue-soft': '#FFF3DF', '--blue-deep': '#7A4604',
    '--on-accent': '#FFFFFF', '--alert': '#C42B1F', '--warn': '#8A6206',
    '--good': '#1C6B3B', '--r-card': '20px', '--r-tile': '14px'
  };

  function el(tag, cls, html) { var d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }

  function renderPanel() {
    body.innerHTML = '';

    /* --- โทนสีทั้งแอป --- */
    var g0 = el('div', 'grp open');
    g0.appendChild(el('div', 'gh', '<span>&#127912; โทนสีทั้งแอป (ธีม: ' + theme() + ')</span><span>&#9662;</span>'));
    var b0 = el('div', 'gb');
    var cs = getComputedStyle(document.documentElement);
    TOKENS.forEach(function (t) {
      var name = t[0], label = t[1], kind = t[2];
      var cur = (state.tokens[theme()] && state.tokens[theme()][name]) || cs.getPropertyValue(name).trim() || FALLBACK[name];
      if (!cur) return;
      var row = el('div', 'row');
      row.appendChild(el('div', 'lb', label));
      var ctl = el('div', 'ctl');
      if (kind === 'c') {
        var ci = el('input'); ci.type = 'color'; ci.value = toHex(cur.indexOf('rgb') === 0 ? cur : cur);
        var ar = el('input'); ar.type = 'range'; ar.min = 0; ar.max = 1; ar.step = .05; ar.value = alphaOf(cur);
        var upd = function () { setToken(name, ar.value >= 1 ? ci.value : rgba(ci.value, ar.value)); };
        ci.oninput = upd; ar.oninput = upd;
        ctl.appendChild(ci); ctl.appendChild(ar);
      } else {
        var pr = el('input'); pr.type = 'range'; pr.min = 0; pr.max = 40; pr.step = 1; pr.value = px(cur);
        var nm = el('div', 'num', px(cur) + 'px');
        pr.oninput = function () { nm.textContent = pr.value + 'px'; setToken(name, pr.value + 'px'); };
        ctl.appendChild(pr); ctl.appendChild(nm);
      }
      var rs = el('button', 'rst', '&#8630;');
      rs.onclick = function () { setToken(name, null); renderPanel(); };
      ctl.appendChild(rs);
      row.appendChild(ctl); b0.appendChild(row);
    });
    g0.appendChild(b0); body.appendChild(g0);
    g0.querySelector('.gh').onclick = function () { g0.classList.toggle('open'); };

    /* --- ชิ้นที่เลือก --- */
    if (!current) {
      body.appendChild(el('div', 'hint',
        'ยังไม่ได้เลือกชิ้นงาน<br><br>กด <b>&#128070; เลือกชิ้นงาน</b> ด้านบน แล้วคลิกการ์ด / ปุ่ม / ข้อความบนหน้าจอได้เลย<br><br>' +
        'ระหว่างเลือกอยู่ แอปจะไม่ตอบสนอง — ถ้าจะกดเปลี่ยนหน้าให้สลับไป <b>&#9654; ใช้แอปปกติ</b> ก่อน'));
      return;
    }

    var sb = el('div', 'selbar');
    var b1 = el('button', 'nav', '&#8593;'); b1.title = 'เลือกชิ้นแม่';
    var b2 = el('button', 'nav', '&#8595;'); b2.title = 'เลือกชิ้นลูก';
    b1.onclick = function () { if (current.parentElement && current.parentElement !== document.body) select(current.parentElement); };
    b2.onclick = function () { if (current.firstElementChild) select(current.firstElementChild); };
    var code = el('code'); code.textContent = currentSel;
    sb.appendChild(b1); sb.appendChild(b2); sb.appendChild(code);
    body.appendChild(sb);

    var gm = el('div', 'row'); gm.style.cssText = 'padding:0 14px;margin:10px 0';
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = groupMode; cb.style.cssText = 'accent-color:#F59E0B;width:16px;height:16px';
    var lab = el('div', '', 'แก้ <b>ทุกชิ้นที่หน้าตาเหมือนกัน</b> พร้อมกัน');
    lab.style.cssText = 'font-size:12px;color:#A8B4C8';
    cb.onchange = function () { groupMode = cb.checked; currentSel = selectorFor(current); renderPanel(); };
    gm.appendChild(cb); gm.appendChild(lab); body.appendChild(gm);

    var comp = getComputedStyle(current);
    var saved = state.rules[currentSel] || {};

    GROUPS.forEach(function (G) {
      var g = el('div', 'grp' + (G.open ? ' open' : ''));
      g.appendChild(el('div', 'gh', '<span>' + G.n + '</span><span>&#9662;</span>'));
      var gb = el('div', 'gb');
      G.items.forEach(function (it) {
        var cur = saved[it.p] || comp.getPropertyValue(it.p);
        var row = el('div', 'row');
        row.appendChild(el('div', 'lb', it.l));
        var ctl = el('div', 'ctl');

        if (it.t === 'color') {
          var ci = el('input'); ci.type = 'color'; ci.value = toHex(cur);
          ctl.appendChild(ci);
          var ar = null;
          if (it.a) { ar = el('input'); ar.type = 'range'; ar.min = 0; ar.max = 1; ar.step = .05; ar.value = alphaOf(cur); ctl.appendChild(ar); }
          var up = function () {
            if (it.x) for (var k in it.x) setProp(k, it.x[k], true);
            setProp(it.p, (ar && ar.value < 1) ? rgba(ci.value, ar.value) : ci.value);
          };
          ci.oninput = up; if (ar) ar.oninput = up;

        } else if (it.t === 'px' || it.t === 'num') {
          var isPx = it.t === 'px';
          var r = el('input'); r.type = 'range'; r.min = it.min; r.max = it.max; r.step = it.step;
          var v = parseFloat(cur) || 0; r.value = v;
          var nm = el('div', 'num', isPx ? Math.round(v) + 'px' : String(Math.round(v * 100) / 100));
          r.oninput = function () {
            nm.textContent = isPx ? r.value + 'px' : r.value;
            if (it.x) for (var k in it.x) setProp(k, it.x[k], true);
            setProp(it.p, isPx ? r.value + 'px' : r.value);
          };
          ctl.appendChild(r); ctl.appendChild(nm);

        } else if (it.t === 'sel') {
          var s = el('select');
          s.appendChild(new Option('— ไม่เปลี่ยน —', ''));
          it.o.forEach(function (o) { s.appendChild(new Option(o, o)); });
          s.value = saved[it.p] || '';
          s.onchange = function () { setProp(it.p, s.value || null); };
          ctl.appendChild(s);

        } else if (it.t === 'shadow') {
          var s2 = el('select');
          SHADOWS.forEach(function (o) { s2.appendChild(new Option(o[1], o[0])); });
          s2.value = saved[it.p] || '';
          s2.onchange = function () { setProp(it.p, s2.value || null); };
          ctl.appendChild(s2);
        }

        var rs = el('button', 'rst', '&#8630;');
        rs.onclick = function () { setProp(it.p, null); renderPanel(); };
        ctl.appendChild(rs);
        row.appendChild(ctl); gb.appendChild(row);
      });
      g.appendChild(gb); body.appendChild(g);
      g.querySelector('.gh').onclick = function () { g.classList.toggle('open'); };
    });

    body.appendChild(el('div', 'hint',
      'ลูกศร <span class="kbd">&#8592;&#8593;&#8594;&#8595;</span> ขยับชิ้นที่เลือกทีละ 1px · ' +
      '<span class="kbd">Esc</span> ยกเลิกการเลือก · <span class="kbd">Ctrl+Z</span> ย้อนกลับ'));
  }

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', function (e) {
    if (!panel.classList.contains('open')) return;
    var t = e.target;
    if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    if (e.key === 'Escape') { current = null; se.style.display = 'none'; renderPanel(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (!current) return;
    var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    var cur = (state.rules[currentSel] || {})['transform'] || '';
    var m = cur.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    var x = m ? parseFloat(m[1]) : 0, y = m ? parseFloat(m[2]) : 0;
    setProp('transform', 'translate(' + (x + d[0]) + 'px, ' + (y + d[1]) + 'px)');
    setTimeout(reframe, 20);
  }, true);

  /* ---------- buttons ---------- */
  function setMode(on) {
    picking = on;
    $('#mPick').classList.toggle('act', on);
    $('#mUse').classList.toggle('act', !on);
    if (!on) { hi.style.display = 'none'; tagEl.style.display = 'none'; }
    toast(on ? 'โหมดเลือก — คลิกชิ้นที่จะแก้' : 'ใช้แอปได้ตามปกติ');
  }
  $('#mPick').onclick = function () { setMode(true); };
  $('#mUse').onclick = function () { setMode(false); };

  fab.onclick = function () {
    var open = panel.classList.toggle('open');
    fab.classList.toggle('on', open);
    fab.style.right = open ? '344px' : '14px';
    if (open) renderPanel(); else { setMode(false); se.style.display = 'none'; }
  };

  $('#bUndo').onclick = undo;
  $('#bReset').onclick = function () {
    if (!confirm('ล้างการแก้ทั้งหมด กลับเป็นดีไซน์เดิม?')) return;
    state.rules = {}; state.tokens = {}; applyRules(); applyTokens(); current = null; se.style.display = 'none'; renderPanel();
    toast('ล้างแล้ว');
  };

  function exportCSS() {
    var out = '/* ============================================\n   StudentOS — Visual Edits\n   สร้างจาก Visual Editor ' + new Date().toLocaleString('th-TH') +
      '\n   วางต่อท้าย style.css ได้เลย\n   ============================================ */\n\n';
    var th;
    for (th in state.tokens) {
      var t = state.tokens[th], b = '', n;
      for (n in t) b += '  ' + n + ':' + t[n] + ';\n';
      if (!b) continue;
      out += (th === 'light' ? ':root, :root[data-theme="light"]' : ':root[data-theme="' + th + '"]') + '{\n' + b + '}\n\n';
    }
    var r = buildRuleCSS(true);
    if (r) out += '/* ---------- ชิ้นงานที่ปรับเอง ---------- */\n' + r;
    return out;
  }
  $('#bExport').onclick = function () { $('#out').value = exportCSS(); $('#modal').classList.add('open'); };
  $('#bClose').onclick = function () { $('#modal').classList.remove('open'); };
  $('#bCopy').onclick = function () {
    var ta = $('#out'); ta.select();
    navigator.clipboard.writeText(ta.value).then(function () { toast('คัดลอกแล้ว'); }, function () { document.execCommand('copy'); toast('คัดลอกแล้ว'); });
  };
  $('#bDl').onclick = function () {
    var blob = new Blob([$('#out').value], { type: 'text/css' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'custom.css'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    toast('ดาวน์โหลดแล้ว');
  };

  /* ---------- theme watcher ---------- */
  new MutationObserver(function () { applyTokens(); if (panel.classList.contains('open')) renderPanel(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- go ---------- */
  applyRules(); applyTokens();
  console.log('%cStudentOS Visual Editor พร้อมใช้ — กดปุ่มดินสอมุมขวาบน', 'background:#F59E0B;color:#111;padding:4px 10px;border-radius:6px;font-weight:700');
})();
