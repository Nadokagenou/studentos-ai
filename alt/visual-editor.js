/* ================================================================
   StudentOS — Visual Editor  v2  "ครบทุกอย่าง"
   ----------------------------------------------------------------
     • จิ้มติดทุกชิ้น แม้ไอคอน/ตัวอักษรเล็กที่ซ้อนอยู่ลึก
     • ลากย้าย / ลากมุมย่อขยาย อิสระ
     • ดับเบิลคลิกแก้ข้อความได้เลย
     • ปรับได้ทุก property + ช่องเขียน CSS เองเมื่ออยากได้นอกเหนือจากนี้
     • ปรับตอน hover / กด / โฟกัส แยกได้
     • เปลี่ยนฟอนต์ไทยได้ (โหลดให้อัตโนมัติ)
   ----------------------------------------------------------------
   ใส่ก่อน </body> :  <script src="visual-editor.js"></script>
   ================================================================ */
(function () {
  'use strict';
  if (window.__SOS_VE__) return;
  window.__SOS_VE__ = true;

  /* ============ STATE ============ */
  var LS = 'sos_ve_v2';
  var state = { rules: {}, tokens: {}, texts: {}, fonts: [] };
  try {
    var raw = localStorage.getItem(LS);
    if (raw) { var p = JSON.parse(raw); state.rules = p.rules || {}; state.tokens = p.tokens || {}; state.texts = p.texts || {}; state.fonts = p.fonts || []; }
  } catch (e) {}

  var undoStack = [], redoStack = [];
  var current = null, baseSel = null, pstate = '', groupMode = false;
  var picking = false, tab = 'el', clipboard = null, dragging = null;

  function key() { return baseSel ? baseSel + pstate : null; }
  function theme() { return document.documentElement.getAttribute('data-theme') || 'light'; }
  function save() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} }

  /* ============ CSS OUTPUT ============ */
  var sink = document.createElement('style'); sink.id = 'sos-ve-style';
  document.head.appendChild(sink);

  function ruleText(imp) {
    var out = '', s;
    for (s in state.rules) {
      var d = state.rules[s], b = '', k;
      for (k in d) b += '  ' + k + ':' + d[k] + (imp ? ' !important' : '') + ';\n';
      if (b) out += s + '{\n' + b + '}\n';
    }
    return out;
  }
  function applyRules() { sink.textContent = ruleText(true); save(); }

  var liveTok = [];
  function applyTokens() {
    var r = document.documentElement, i;
    for (i = 0; i < liveTok.length; i++) r.style.removeProperty(liveTok[i]);
    liveTok = [];
    var t = state.tokens[theme()] || {}, n;
    for (n in t) { r.style.setProperty(n, t[n]); liveTok.push(n); }
    save();
  }
  function applyTexts() {
    var s;
    for (s in state.texts) {
      try { var e = document.querySelector(s); if (e && e.textContent !== state.texts[s]) e.textContent = state.texts[s]; } catch (x) {}
    }
  }

  /* ============ SELECTOR ============ */
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
  function selFor(el) { return groupMode ? grpOf(el) : pathOf(el); }

  /* ============ MUTATION ============ */
  function setP(prop, val, silent) {
    var k = key(); if (!k) return;
    var d = state.rules[k] || (state.rules[k] = {});
    if (!silent) { undoStack.push({ t: 'r', k: k, p: prop, v: d.hasOwnProperty(prop) ? d[prop] : null }); redoStack = []; }
    if (val === null || val === '') delete d[prop]; else d[prop] = val;
    if (!Object.keys(d).length) delete state.rules[k];
    applyRules();
  }
  function getP(prop) { var k = key(), d = k && state.rules[k]; return d ? d[prop] : undefined; }
  function setTok(n, v) {
    var th = theme(), t = state.tokens[th] || (state.tokens[th] = {});
    undoStack.push({ t: 't', th: th, n: n, v: t.hasOwnProperty(n) ? t[n] : null }); redoStack = [];
    if (v === null) delete t[n]; else t[n] = v;
    applyTokens();
  }
  function undo() {
    var a = undoStack.pop(); if (!a) { toast('ไม่มีอะไรให้ย้อน'); return; }
    if (a.t === 'r') {
      var d = state.rules[a.k] || (state.rules[a.k] = {});
      redoStack.push({ t: 'r', k: a.k, p: a.p, v: d.hasOwnProperty(a.p) ? d[a.p] : null });
      if (a.v === null) delete d[a.p]; else d[a.p] = a.v;
      if (!Object.keys(d).length) delete state.rules[a.k];
      applyRules();
    } else {
      var t = state.tokens[a.th] || (state.tokens[a.th] = {});
      redoStack.push({ t: 't', th: a.th, n: a.n, v: t.hasOwnProperty(a.n) ? t[a.n] : null });
      if (a.v === null) delete t[a.n]; else t[a.n] = a.v;
      applyTokens();
    }
    render(); frame(); toast('ย้อนกลับ');
  }
  function redo() {
    var a = redoStack.pop(); if (!a) return;
    if (a.t === 'r') { var d = state.rules[a.k] || (state.rules[a.k] = {}); if (a.v === null) delete d[a.p]; else d[a.p] = a.v; if (!Object.keys(d).length) delete state.rules[a.k]; applyRules(); }
    else { var t = state.tokens[a.th] || (state.tokens[a.th] = {}); if (a.v === null) delete t[a.n]; else t[a.n] = a.v; applyTokens(); }
    render(); frame(); toast('ทำซ้ำ');
  }

  /* ============ COLOR ============ */
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
  function nump(v) { return parseFloat(v) || 0; }

  /* ============ FONTS ============ */
  var GFONTS = ['Kanit', 'Prompt', 'Sarabun', 'Mitr', 'Bai Jamjuree', 'Noto Sans Thai', 'IBM Plex Sans Thai', 'Chakra Petch', 'Athiti', 'Taviraj', 'Charm', 'Pridi'];
  function loadFont(f) {
    if (!f || state.fonts.indexOf(f) > -1) return;
    state.fonts.push(f);
    var l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + ':wght@200;300;400;500;600;700;800&display=swap';
    document.head.appendChild(l); save();
  }
  (function () { var f = state.fonts.slice(); state.fonts = []; f.forEach(loadFont); })();

  /* ============ SHELL ============ */
  var host = document.createElement('div');
  host.id = 'sos-ve-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  document.body.appendChild(host);
  var sr = host.attachShadow({ mode: 'open' });

  sr.innerHTML =
'<style>' +
'*{box-sizing:border-box;margin:0;padding:0}' +
'.pe{pointer-events:auto}' +
'#hi{position:fixed;pointer-events:none;outline:2px dashed #6FA8FF;background:rgba(111,168,255,.12);border-radius:3px;display:none}' +
'#se{position:fixed;pointer-events:none;outline:2px solid #F59E0B;border-radius:3px;display:none}' +
'.hnd{position:fixed;width:11px;height:11px;background:#F59E0B;border:2px solid #0E131E;border-radius:50%;pointer-events:auto;display:none;z-index:5}' +
'#mv{position:fixed;pointer-events:auto;display:none;cursor:move;background:transparent}' +
'#tag{position:fixed;font:600 11px ui-monospace,monospace;background:#111827;color:#fff;padding:3px 7px;border-radius:6px;pointer-events:none;white-space:nowrap;display:none;max-width:60vw;overflow:hidden}' +
'#fab{position:fixed;top:14px;right:14px;width:44px;height:44px;border-radius:13px;border:0;background:#111827;color:#fff;font-size:18px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.4)}' +
'#fab.on{background:#F59E0B;color:#111}' +
'#panel{position:fixed;top:0;right:0;width:346px;max-width:94vw;height:100%;background:#0E131E;color:#E7ECF6;font:13px/1.5 -apple-system,"IBM Plex Sans Thai",system-ui,sans-serif;display:flex;flex-direction:column;box-shadow:-14px 0 44px rgba(0,0,0,.55);transform:translateX(105%);transition:transform .22s cubic-bezier(.4,0,.2,1)}' +
'#panel.open{transform:none}' +
'.top{padding:10px 12px;border-bottom:1px solid #202839}' +
'.md{display:flex;gap:5px}' +
'.md button{flex:1;padding:8px 3px;border-radius:9px;border:1px solid #2A3448;background:#161E2C;color:#BFC9DA;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}' +
'.md button.a{background:#F59E0B;border-color:#F59E0B;color:#111}' +
'.tabs{display:flex;border-bottom:1px solid #202839}' +
'.tabs button{flex:1;padding:10px 2px;background:none;border:0;border-bottom:2px solid transparent;color:#7E8AA0;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}' +
'.tabs button.a{color:#F59E0B;border-bottom-color:#F59E0B}' +
'.crumb{padding:7px 12px;background:#121A28;border-bottom:1px solid #202839;font:600 10px ui-monospace,monospace;color:#8B96AC;display:flex;flex-wrap:wrap;gap:3px;align-items:center}' +
'.crumb span{cursor:pointer;padding:2px 5px;border-radius:5px;background:#1B2434}' +
'.crumb span.a{background:#F59E0B;color:#111}' +
'.states{display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid #202839}' +
'.states button{flex:1;padding:6px 2px;border-radius:7px;border:1px solid #2A3448;background:#161E2C;color:#BFC9DA;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}' +
'.states button.a{background:#2563EB;border-color:#2563EB;color:#fff}' +
'.body{flex:1;overflow-y:auto;padding-bottom:64px}' +
'.g{border-bottom:1px solid #19212F}' +
'.gh{padding:10px 12px;font-weight:800;font-size:12px;color:#9AABC6;cursor:pointer;display:flex;justify-content:space-between;user-select:none}' +
'.gb{padding:0 12px 11px;display:none}' +
'.g.o .gb{display:block}' +
'.r{display:flex;align-items:center;gap:7px;margin:8px 0}' +
'.l{flex:0 0 88px;color:#A2AEC4;font-size:11.5px}' +
'.c{flex:1;display:flex;align-items:center;gap:5px;min-width:0}' +
'input[type=range]{flex:1;min-width:0;accent-color:#F59E0B;height:16px}' +
'input[type=color]{width:30px;height:25px;padding:0;border:1px solid #2A3448;border-radius:6px;background:#161E2C;cursor:pointer;flex:0 0 auto}' +
'select,input[type=text],input[type=number],textarea{background:#161E2C;border:1px solid #2A3448;color:#E7ECF6;border-radius:7px;padding:5px 6px;font-size:11.5px;font-family:inherit;min-width:0}' +
'select,input[type=text]{flex:1}' +
'textarea{width:100%;font-family:ui-monospace,monospace;resize:vertical}' +
'.q{display:flex;gap:3px;flex:1}' +
'.q input{width:100%;text-align:center;padding:4px 2px;font-size:11px}' +
'.n{flex:0 0 44px;text-align:right;font:600 10.5px ui-monospace,monospace;color:#FBBF24}' +
'.x{border:0;background:none;color:#55617A;cursor:pointer;font-size:12px;flex:0 0 auto;padding:0 1px}' +
'.ft{position:absolute;bottom:0;left:0;right:0;padding:9px 12px;background:#0E131E;border-top:1px solid #202839;display:flex;gap:6px}' +
'.ft button{padding:9px 6px;border-radius:9px;border:0;font-weight:800;font-size:11.5px;cursor:pointer;font-family:inherit;flex:1}' +
'.b1{background:#F59E0B;color:#111}.b2{background:#1C2635;color:#BFC9DA}.b3{background:#2A1518;color:#F19A9A}' +
'.sm{flex:0 0 36px!important}' +
'.hint{padding:11px 13px;color:#76829A;font-size:11px;line-height:1.75}' +
'.kb{background:#1C2635;border-radius:4px;padding:1px 5px;font:600 10px ui-monospace,monospace;color:#BFC9DA}' +
'.chk{display:flex;align-items:center;gap:7px;padding:8px 12px;font-size:11.5px;color:#A2AEC4}' +
'.chk input{accent-color:#F59E0B;width:15px;height:15px}' +
'#toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:9px 15px;border-radius:10px;font:600 12px system-ui;opacity:0;transition:opacity .2s;pointer-events:none}' +
'#modal{position:fixed;inset:0;background:rgba(3,6,12,.85);display:none;align-items:center;justify-content:center;padding:18px}' +
'#modal.o{display:flex}' +
'.card{background:#0E131E;border:1px solid #2A3448;border-radius:15px;width:660px;max-width:100%;max-height:86vh;display:flex;flex-direction:column;font-family:-apple-system,"IBM Plex Sans Thai",system-ui,sans-serif;color:#E7ECF6}' +
'.card h3{padding:13px 15px;font-size:13.5px;border-bottom:1px solid #202839;font-weight:700}' +
'.card textarea{flex:1;min-height:290px;border:0;border-radius:0;background:#080C14;color:#9FE6B0;font:11.5px/1.65 ui-monospace,monospace;padding:13px;outline:none}' +
'.card .f2{padding:11px 15px;display:flex;gap:7px;border-top:1px solid #202839}' +
'.card .f2 button{flex:1;padding:10px;border-radius:9px;border:0;font-weight:800;font-size:11.5px;cursor:pointer;font-family:inherit}' +
'</style>' +
'<div id="hi"></div><div id="se"></div><div id="tag"></div><div id="mv"></div>' +
'<div class="hnd" data-h="nw"></div><div class="hnd" data-h="n"></div><div class="hnd" data-h="ne"></div>' +
'<div class="hnd" data-h="w"></div><div class="hnd" data-h="e"></div>' +
'<div class="hnd" data-h="sw"></div><div class="hnd" data-h="s"></div><div class="hnd" data-h="se"></div>' +
'<button id="fab" class="pe">&#9998;</button>' +
'<div id="panel" class="pe">' +
 '<div class="top"><div class="md">' +
   '<button id="mPick">&#128070; เลือก</button><button id="mUse" class="a">&#9654; ใช้แอป</button>' +
 '</div></div>' +
 '<div class="tabs"><button data-t="el" class="a">ชิ้นงาน</button><button data-t="th">โทนสี</button><button data-t="css">CSS เอง</button></div>' +
 '<div class="body" id="body"></div>' +
 '<div class="ft"><button class="b1" id="bEx">&#8681; เอาโค้ดออก</button><button class="b2 sm" id="bU">&#8630;</button><button class="b2 sm" id="bR">&#8631;</button><button class="b3 sm" id="bC">&#10005;</button></div>' +
'</div>' +
'<div id="toast"></div>' +
'<div id="modal" class="pe"><div class="card"><h3>วางต่อท้ายไฟล์ style.css</h3><textarea id="out" spellcheck="false"></textarea><div class="f2"><button class="b1" id="bCp">คัดลอก</button><button class="b2" id="bDl">ดาวน์โหลด</button><button class="b2" id="bX">ปิด</button></div></div></div>';

  var $ = function (s) { return sr.querySelector(s); };
  var $$ = function (s) { return [].slice.call(sr.querySelectorAll(s)); };
  var hi = $('#hi'), se = $('#se'), tg = $('#tag'), panel = $('#panel'), body = $('#body'), mv = $('#mv');

  function toast(m) { var t = $('#toast'); t.textContent = m; t.style.opacity = '1'; clearTimeout(t._t); t._t = setTimeout(function () { t.style.opacity = '0'; }, 1300); }
  function place(el, node) {
    var r = el.getBoundingClientRect();
    node.style.left = r.left + 'px'; node.style.top = r.top + 'px';
    node.style.width = r.width + 'px'; node.style.height = r.height + 'px';
    node.style.display = 'block';
    return r;
  }
  var HPOS = { nw: [0, 0], n: [.5, 0], ne: [1, 0], w: [0, .5], e: [1, .5], sw: [0, 1], s: [.5, 1], se: [1, 1] };
  function frame() {
    if (!current) {
      se.style.display = 'none'; mv.style.display = 'none';
      $$('.hnd').forEach(function (h) { h.style.display = 'none'; });
      return;
    }
    var r = place(current, se);
    mv.style.left = r.left + 'px'; mv.style.top = r.top + 'px';
    mv.style.width = r.width + 'px'; mv.style.height = r.height + 'px';
    mv.style.display = picking ? 'block' : 'none';
    $$('.hnd').forEach(function (h) {
      var q = HPOS[h.getAttribute('data-h')];
      h.style.left = (r.left + r.width * q[0] - 5.5) + 'px';
      h.style.top = (r.top + r.height * q[1] - 5.5) + 'px';
      h.style.display = picking ? 'block' : 'none';
      h.style.cursor = h.getAttribute('data-h') + '-resize';
    });
  }
  window.addEventListener('scroll', frame, true);
  window.addEventListener('resize', frame);

  /* ============ DEEP PICK ============ */
  function deepAt(x, y) {
    var list = [];
    try { list = document.elementsFromPoint(x, y); } catch (e) { return null; }
    list = list.filter(function (e) {
      return e !== host && !host.contains(e) && e !== document.body && e !== document.documentElement;
    });
    if (!list.length) return null;
    var best = list[0], ba = Infinity;
    list.forEach(function (e) {
      var r = e.getBoundingClientRect(), a = r.width * r.height;
      if (a > 4 && a < ba) { ba = a; best = e; }
    });
    return best;
  }
  function inHost(e) { return e.composedPath && e.composedPath().indexOf(host) > -1; }

  document.addEventListener('mousemove', function (e) {
    if (!picking || inHost(e) || dragging) { hi.style.display = 'none'; tg.style.display = 'none'; return; }
    var el = deepAt(e.clientX, e.clientY); if (!el) return;
    var r = place(el, hi);
    tg.textContent = el.tagName.toLowerCase() + clsOf(el) + '  ' + Math.round(r.width) + '\u00d7' + Math.round(r.height);
    tg.style.left = Math.max(4, r.left) + 'px';
    tg.style.top = (r.top > 26 ? r.top - 23 : r.bottom + 4) + 'px';
    tg.style.display = 'block';
  }, true);

  ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'pointerdown', 'dblclick'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (!picking || inHost(e)) return;
      if (e.target && e.target.getAttribute && e.target.getAttribute('contenteditable')) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (ev === 'click') { var el = deepAt(e.clientX, e.clientY); if (el) pick(el); }
      if (ev === 'dblclick') editText();
    }, true);
  });

  function pick(el) {
    if (!el || el === document.body) return;
    current = el; baseSel = selFor(el); frame(); render();
  }

  /* ============ TEXT EDIT ============ */
  function editText() {
    if (!current) return;
    var hasEl = [].some.call(current.childNodes, function (n) { return n.nodeType === 1; });
    if (hasEl) { toast('ดับเบิลคลิกที่ตัวอักษรโดยตรง'); return; }
    var el = current, old = el.textContent;
    el.setAttribute('contenteditable', 'true');
    el.style.outline = '2px solid #22C55E';
    el.focus();
    try { var rg = document.createRange(); rg.selectNodeContents(el); var sl = getSelection(); sl.removeAllRanges(); sl.addRange(rg); } catch (x) {}
    toast('พิมพ์แก้ได้เลย · Enter = เสร็จ');
    function done() {
      el.removeAttribute('contenteditable'); el.style.outline = '';
      el.removeEventListener('blur', done); el.removeEventListener('keydown', kd);
      if (el.textContent !== old) { state.texts[pathOf(el)] = el.textContent; save(); toast('บันทึกข้อความแล้ว'); }
      frame();
    }
    function kd(ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
      if (ev.key === 'Escape') { el.textContent = old; el.blur(); }
    }
    el.addEventListener('blur', done); el.addEventListener('keydown', kd);
  }

  /* ============ DRAG & RESIZE ============ */
  function curXY() {
    var t = getP('transform') || '';
    var m = t.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
  }
  function setXY(x, y) {
    var t = (getP('transform') || '').replace(/translate\([^)]*\)\s*/, '').trim();
    setP('transform', ('translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px) ' + t).trim(), true);
  }
  mv.addEventListener('mousedown', function (e) {
    if (!current) return;
    e.preventDefault(); e.stopPropagation();
    var s = curXY(), sx = e.clientX, sy = e.clientY, k = key();
    undoStack.push({ t: 'r', k: k, p: 'transform', v: getP('transform') === undefined ? null : getP('transform') });
    dragging = function (ev) { setXY(s[0] + ev.clientX - sx, s[1] + ev.clientY - sy); frame(); };
  });
  $$('.hnd').forEach(function (h) {
    h.addEventListener('mousedown', function (e) {
      if (!current) return;
      e.preventDefault(); e.stopPropagation();
      var d = h.getAttribute('data-h'), r = current.getBoundingClientRect();
      var sx = e.clientX, sy = e.clientY, w0 = r.width, h0 = r.height, k = key();
      undoStack.push({ t: 'r', k: k, p: 'width', v: getP('width') === undefined ? null : getP('width') });
      undoStack.push({ t: 'r', k: k, p: 'height', v: getP('height') === undefined ? null : getP('height') });
      dragging = function (ev) {
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (d.indexOf('e') > -1) setP('width', Math.max(8, Math.round(w0 + dx)) + 'px', true);
        if (d.indexOf('w') > -1) setP('width', Math.max(8, Math.round(w0 - dx)) + 'px', true);
        if (d.indexOf('s') > -1) setP('height', Math.max(8, Math.round(h0 + dy)) + 'px', true);
        if (d.indexOf('n') > -1) setP('height', Math.max(8, Math.round(h0 - dy)) + 'px', true);
        frame();
      };
    });
  });
  window.addEventListener('mousemove', function (e) { if (dragging) { e.preventDefault(); dragging(e); } }, true);
  window.addEventListener('mouseup', function () { if (dragging) { dragging = null; render(); } }, true);

  /* ============ CONTROL DEFS ============ */
  var FAMS = ['"IBM Plex Sans Thai",sans-serif', '"Noto Sans Thai",sans-serif']
    .concat(GFONTS.map(function (f) { return '"' + f + '",sans-serif'; }))
    .concat(['ui-monospace,monospace', 'Georgia,serif', 'system-ui,sans-serif']);
  var SHAD = [['', '\u2014 ไม่เปลี่ยน \u2014'], ['none', 'ไม่มีเงา'], ['var(--shadow)', 'ตามธีม นุ่ม'], ['var(--shadow-lg)', 'ตามธีม เด่น'],
    ['0 1px 3px rgba(0,0,0,.10)', 'บางมาก'], ['0 4px 14px rgba(0,0,0,.14)', 'บาง'], ['0 10px 28px -8px rgba(0,0,0,.24)', 'กลาง'],
    ['0 22px 50px -14px rgba(0,0,0,.36)', 'ลอยสูง'], ['0 0 0 3px rgba(245,158,11,.45)', 'ขอบเรืองแสง'], ['inset 0 2px 6px rgba(0,0,0,.28)', 'เงาด้านใน']];
  var GRAD = [['', '\u2014 ไม่เปลี่ยน \u2014'], ['none', 'ไม่มี'],
    ['linear-gradient(135deg,var(--blue),var(--blue-deep))', 'ฟ้า \u2192 น้ำเงินเข้ม'],
    ['linear-gradient(135deg,#F59E0B,#EF4444)', 'ส้ม \u2192 แดง'],
    ['linear-gradient(135deg,#8B5CF6,#EC4899)', 'ม่วง \u2192 ชมพู'],
    ['linear-gradient(135deg,#10B981,#06B6D4)', 'เขียว \u2192 ฟ้า'],
    ['linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,0))', 'ไล่ขาวจาง']];

  var GROUPS = [
    { n: '\ud83d\udcd0 ระยะ & ขนาด', o: true, it: [
      { p: 'padding', t: 'quad', l: 'ขอบใน', sub: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'] },
      { p: 'margin', t: 'quad', l: 'ขอบนอก', sub: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] },
      { p: 'width', t: 'px', min: 0, max: 900, l: 'กว้าง' },
      { p: 'height', t: 'px', min: 0, max: 900, l: 'สูง' },
      { p: 'min-height', t: 'px', min: 0, max: 600, l: 'สูงอย่างน้อย' },
      { p: 'gap', t: 'px', min: 0, max: 60, l: 'ช่องไฟลูก' }
    ]},
    { n: '\ud83c\udfa8 สี & พื้นหลัง', o: true, it: [
      { p: 'background-color', t: 'color', a: 1, l: 'สีพื้นหลัง' },
      { p: 'background-image', t: 'sel2', l: 'ไล่เฉดสี', o: GRAD },
      { p: 'color', t: 'color', l: 'สีตัวอักษร' },
      { p: 'opacity', t: 'num', min: 0, max: 1, step: .05, l: 'ความทึบ' },
      { p: 'backdrop-filter', t: 'blur', l: 'เบลอฉากหลัง' },
      { p: 'mix-blend-mode', t: 'sel', l: 'โหมดผสมสี', o: ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'difference'] }
    ]},
    { n: '\u270d\ufe0f ตัวอักษร', o: true, it: [
      { p: 'font-family', t: 'font', l: 'ฟอนต์' },
      { p: 'font-size', t: 'px', min: 6, max: 90, step: .5, l: 'ขนาด' },
      { p: 'font-weight', t: 'sel', l: 'ความหนา', o: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
      { p: 'font-style', t: 'sel', l: 'เอียง', o: ['normal', 'italic'] },
      { p: 'letter-spacing', t: 'px', min: -4, max: 16, step: .1, l: 'ระยะอักษร' },
      { p: 'line-height', t: 'num', min: .7, max: 3, step: .02, l: 'ระยะบรรทัด' },
      { p: 'text-align', t: 'sel', l: 'จัดข้อความ', o: ['left', 'center', 'right', 'justify'] },
      { p: 'text-transform', t: 'sel', l: 'ตัวพิมพ์', o: ['none', 'uppercase', 'lowercase', 'capitalize'] },
      { p: 'text-decoration', t: 'sel', l: 'เส้นตกแต่ง', o: ['none', 'underline', 'line-through'] },
      { p: 'white-space', t: 'sel', l: 'ตัดบรรทัด', o: ['normal', 'nowrap', 'pre-wrap'] },
      { p: 'text-shadow', t: 'sel2', l: 'เงาตัวอักษร', o: [['', '\u2014 ไม่เปลี่ยน \u2014'], ['none', 'ไม่มี'], ['0 1px 2px rgba(0,0,0,.4)', 'บาง'], ['0 2px 10px rgba(0,0,0,.55)', 'ฟุ้ง'], ['0 0 12px currentColor', 'เรืองแสง']] }
    ]},
    { n: '\ud83d\udd32 ขอบ & มุม', o: false, it: [
      { p: 'border-radius', t: 'quad', l: 'ความโค้งมุม', max: 200, sub: ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'] },
      { p: 'border-width', t: 'px', min: 0, max: 14, l: 'หนาเส้นขอบ', x: { 'border-style': 'solid' } },
      { p: 'border-style', t: 'sel', l: 'แบบเส้น', o: ['solid', 'dashed', 'dotted', 'none'] },
      { p: 'border-color', t: 'color', a: 1, l: 'สีเส้นขอบ' },
      { p: 'box-shadow', t: 'sel2', l: 'เงากล่อง', o: SHAD },
      { p: 'overflow', t: 'sel', l: 'ส่วนที่ล้น', o: ['visible', 'hidden', 'auto', 'scroll'] }
    ]},
    { n: '\ud83d\udce6 การจัดวาง', o: false, it: [
      { p: 'display', t: 'sel', l: 'ชนิดกล่อง', o: ['block', 'flex', 'inline-flex', 'grid', 'inline-block', 'none'] },
      { p: 'flex-direction', t: 'sel', l: 'ทิศทาง', o: ['row', 'column', 'row-reverse', 'column-reverse'] },
      { p: 'justify-content', t: 'sel', l: 'จัดแนวหลัก', o: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] },
      { p: 'align-items', t: 'sel', l: 'จัดแนวขวาง', o: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'] },
      { p: 'flex-wrap', t: 'sel', l: 'ตัดขึ้นบรรทัด', o: ['nowrap', 'wrap'] },
      { p: 'grid-template-columns', t: 'txt', l: 'คอลัมน์ grid', ph: 'เช่น 1fr 1fr' },
      { p: 'flex', t: 'txt', l: 'ยืด/หด', ph: 'เช่น 1 หรือ 0 0 auto' },
      { p: 'order', t: 'num', min: -8, max: 8, step: 1, l: 'ลำดับ' }
    ]},
    { n: '\ud83d\udccd ตำแหน่ง', o: false, it: [
      { p: 'position', t: 'sel', l: 'โหมดตำแหน่ง', o: ['static', 'relative', 'absolute', 'fixed', 'sticky'] },
      { p: 'top', t: 'px', min: -300, max: 500, l: 'บน' },
      { p: 'left', t: 'px', min: -300, max: 500, l: 'ซ้าย' },
      { p: 'right', t: 'px', min: -300, max: 500, l: 'ขวา' },
      { p: 'bottom', t: 'px', min: -300, max: 500, l: 'ล่าง' },
      { p: 'z-index', t: 'num', min: -5, max: 300, step: 1, l: 'ชั้นซ้อน' }
    ]},
    { n: '\u2728 เอฟเฟกต์', o: false, it: [
      { p: '_scale', t: 'num', min: .2, max: 3, step: .02, l: 'ย่อ/ขยาย' },
      { p: '_rotate', t: 'num', min: -180, max: 180, step: 1, l: 'หมุน (องศา)' },
      { p: '_blur', t: 'num', min: 0, max: 20, step: .5, l: 'เบลอ' },
      { p: '_bright', t: 'num', min: 0, max: 2.5, step: .05, l: 'ความสว่าง' },
      { p: '_sat', t: 'num', min: 0, max: 3, step: .05, l: 'ความอิ่มสี' },
      { p: '_gray', t: 'num', min: 0, max: 1, step: .05, l: 'ขาวดำ' },
      { p: 'transition', t: 'sel2', l: 'ความหน่วง', o: [['', '\u2014 ไม่เปลี่ยน \u2014'], ['none', 'ไม่มี'], ['all .15s ease', 'เร็ว'], ['all .3s cubic-bezier(.4,0,.2,1)', 'นุ่ม'], ['all .6s cubic-bezier(.34,1.56,.64,1)', 'เด้ง']] },
      { p: 'cursor', t: 'sel', l: 'เคอร์เซอร์', o: ['auto', 'pointer', 'default', 'not-allowed', 'grab'] }
    ]}
  ];

  var TOKENS = [['--scr', 'พื้นจอ'], ['--card', 'การ์ด'], ['--card2', 'การ์ดรอง'], ['--surface', 'พื้นผิว'],
    ['--ink', 'อักษรหลัก'], ['--muted', 'อักษรจาง'], ['--line', 'เส้นคั่น'],
    ['--blue', 'สีแบรนด์'], ['--blue-soft', 'แบรนด์อ่อน'], ['--blue-deep', 'แบรนด์เข้ม'], ['--on-accent', 'อักษรบนสีเน้น'],
    ['--alert', 'สีเตือน'], ['--warn', 'สีระวัง'], ['--good', 'สีสำเร็จ']];
  var TOKPX = [['--r-card', 'โค้งการ์ด'], ['--r-tile', 'โค้งไทล์']];
  var FALLBACK = { '--scr': '#FCFBF7', '--card': '#FFFFFF', '--card2': '#F4F2EC', '--surface': '#FAF9F5',
    '--ink': '#1F2430', '--muted': '#6A6F7E', '--line': 'rgba(31,36,48,.09)', '--blue': '#9E5B04',
    '--blue-soft': '#FFF3DF', '--blue-deep': '#7A4604', '--on-accent': '#FFFFFF',
    '--alert': '#C42B1F', '--warn': '#8A6206', '--good': '#1C6B3B', '--r-card': '20px', '--r-tile': '14px' };

  /* ============ COMPOUND ============ */
  function parts() {
    var t = getP('transform') || '', f = getP('filter') || '';
    function g(re, d) { var m = (t + ' ' + f).match(re); return m ? parseFloat(m[1]) : d; }
    return {
      _scale: g(/scale\(([\d.]+)\)/, 1), _rotate: g(/rotate\((-?[\d.]+)deg\)/, 0),
      _blur: g(/blur\(([\d.]+)px\)/, 0), _bright: g(/brightness\(([\d.]+)\)/, 1),
      _sat: g(/saturate\(([\d.]+)\)/, 1), _gray: g(/grayscale\(([\d.]+)\)/, 0)
    };
  }
  function setPart(name, v) {
    var p = parts(); p[name] = parseFloat(v);
    var xy = curXY(), t = [];
    if (xy[0] || xy[1]) t.push('translate(' + xy[0] + 'px, ' + xy[1] + 'px)');
    if (p._scale !== 1) t.push('scale(' + p._scale + ')');
    if (p._rotate) t.push('rotate(' + p._rotate + 'deg)');
    setP('transform', t.length ? t.join(' ') : null, true);
    var f = [];
    if (p._blur) f.push('blur(' + p._blur + 'px)');
    if (p._bright !== 1) f.push('brightness(' + p._bright + ')');
    if (p._sat !== 1) f.push('saturate(' + p._sat + ')');
    if (p._gray) f.push('grayscale(' + p._gray + ')');
    setP('filter', f.length ? f.join(' ') : null, true);
  }

  /* ============ RENDER ============ */
  function E(t, c, h) { var d = document.createElement(t); if (c) d.className = c; if (h != null) d.innerHTML = h; return d; }

  function render() {
    body.innerHTML = '';
    $$('.tabs button').forEach(function (b) { b.classList.toggle('a', b.getAttribute('data-t') === tab); });
    if (tab === 'th') return renderTokens();
    if (tab === 'css') return renderCustom();
    renderEl();
  }

  function renderTokens() {
    var cs = getComputedStyle(document.documentElement);
    body.appendChild(E('div', 'hint', 'เปลี่ยนที่นี่ = เปลี่ยนทั้งแอปทุกหน้าพร้อมกัน<br>ธีมปัจจุบัน: <b>' + theme() + '</b>'));
    var g = E('div', 'g o'); g.appendChild(E('div', 'gh', '<span>สีหลักของธีม</span><span>&#9662;</span>'));
    var gb = E('div', 'gb');
    TOKENS.forEach(function (t) {
      var cur = (state.tokens[theme()] || {})[t[0]] || cs.getPropertyValue(t[0]).trim() || FALLBACK[t[0]];
      if (!cur) return;
      var r = E('div', 'r'); r.appendChild(E('div', 'l', t[1]));
      var c = E('div', 'c');
      var ci = E('input'); ci.type = 'color'; ci.value = hex(cur);
      var ar = E('input'); ar.type = 'range'; ar.min = 0; ar.max = 1; ar.step = .05; ar.value = alph(cur);
      var up = function () { setTok(t[0], ar.value >= 1 ? ci.value : rgba(ci.value, ar.value)); };
      ci.oninput = up; ar.oninput = up;
      var x = E('button', 'x', '&#8630;'); x.onclick = function () { setTok(t[0], null); render(); };
      c.appendChild(ci); c.appendChild(ar); c.appendChild(x);
      r.appendChild(c); gb.appendChild(r);
    });
    TOKPX.forEach(function (t) {
      var cur = (state.tokens[theme()] || {})[t[0]] || cs.getPropertyValue(t[0]).trim() || FALLBACK[t[0]];
      var r = E('div', 'r'); r.appendChild(E('div', 'l', t[1]));
      var c = E('div', 'c');
      var s = E('input'); s.type = 'range'; s.min = 0; s.max = 60; s.step = 1; s.value = nump(cur);
      var n = E('div', 'n', nump(cur) + 'px');
      s.oninput = function () { n.textContent = s.value + 'px'; setTok(t[0], s.value + 'px'); };
      var x = E('button', 'x', '&#8630;'); x.onclick = function () { setTok(t[0], null); render(); };
      c.appendChild(s); c.appendChild(n); c.appendChild(x);
      r.appendChild(c); gb.appendChild(r);
    });
    g.appendChild(gb); body.appendChild(g);
    g.querySelector('.gh').onclick = function () { g.classList.toggle('o'); };
  }

  function renderCustom() {
    if (!current) { body.appendChild(E('div', 'hint', 'เลือกชิ้นงานก่อน แล้วค่อยมาเขียน CSS เองที่นี่')); return; }
    body.appendChild(E('div', 'hint', 'เขียน CSS อะไรก็ได้ที่ไม่มีในแท็บ "ชิ้นงาน" — พิมพ์ทีละบรรทัดแบบ property: value;'));
    var wrap = E('div'); wrap.style.padding = '0 12px';
    var ta = E('textarea'); ta.rows = 11;
    ta.placeholder = 'clip-path: circle(50%);\nbackdrop-filter: blur(14px);\nanimation: pulse 2s infinite;';
    var d = state.rules[key()] || {}, txt = '', k;
    for (k in d) txt += k + ': ' + d[k] + ';\n';
    ta.value = txt;
    var btn = E('button', '', 'ใช้กับชิ้นนี้');
    btn.style.cssText = 'width:100%;padding:10px;border:0;border-radius:9px;font-weight:800;margin-top:8px;cursor:pointer;font-family:inherit;background:#F59E0B;color:#111';
    btn.onclick = function () {
      var k2 = key(); if (!k2) return;
      undoStack.push({ t: 'r', k: k2, p: '__all', v: null });
      var nd = {};
      ta.value.split(/[;\n]/).forEach(function (line) {
        var i = line.indexOf(':'); if (i < 1) return;
        var pr = line.slice(0, i).trim(), vl = line.slice(i + 1).trim();
        if (pr && vl) nd[pr] = vl;
      });
      if (Object.keys(nd).length) state.rules[k2] = nd; else delete state.rules[k2];
      applyRules(); frame(); toast('ใช้แล้ว');
    };
    wrap.appendChild(ta); wrap.appendChild(btn); body.appendChild(wrap);
  }

  function renderEl() {
    if (!current) {
      body.appendChild(E('div', 'hint',
        '<b>ยังไม่ได้เลือกชิ้นงาน</b><br><br>กด <b>\ud83d\udc46 เลือก</b> ด้านบน แล้วคลิกอะไรก็ได้บนหน้าจอ — จิ้มติดทุกชิ้น แม้ไอคอนเล็ก ๆ<br><br>' +
        '\u2022 <b>ลากตัวชิ้นงาน</b> = ย้ายตำแหน่งอิสระ<br>' +
        '\u2022 <b>ลากจุดส้ม 8 จุด</b> = ย่อ/ขยาย<br>' +
        '\u2022 <b>ดับเบิลคลิก</b> = แก้ข้อความ<br>' +
        '\u2022 <span class="kb">[</span> <span class="kb">]</span> = เลื่อนขึ้น/ลงชั้น<br><br>' +
        'จะกดใช้แอปตามปกติ ให้สลับไป <b>\u25b6 ใช้แอป</b> ก่อน'));
      return;
    }

    var cb = E('div', 'crumb'), chain = [], n = current;
    while (n && n !== document.body && chain.length < 7) { chain.unshift(n); n = n.parentElement; }
    chain.forEach(function (el) {
      var c1 = clsOf(el).split('.')[1];
      var s = E('span', el === current ? 'a' : '', el.tagName.toLowerCase() + (c1 ? '.' + c1 : ''));
      s.onclick = function () { pick(el); };
      cb.appendChild(s);
    });
    if (current.firstElementChild) {
      var dn = E('span', '', '\u2193 ลูก');
      dn.onclick = function () { pick(current.firstElementChild); };
      cb.appendChild(dn);
    }
    body.appendChild(cb);

    var st = E('div', 'states');
    [['', 'ปกติ'], [':hover', 'เมื่อชี้'], [':active', 'เมื่อกด'], [':focus', 'โฟกัส']].forEach(function (s) {
      var b = E('button', pstate === s[0] ? 'a' : '', s[1]);
      b.onclick = function () { pstate = s[0]; render(); };
      st.appendChild(b);
    });
    body.appendChild(st);

    var ck = E('div', 'chk');
    var cbx = E('input'); cbx.type = 'checkbox'; cbx.checked = groupMode;
    cbx.onchange = function () { groupMode = cbx.checked; baseSel = selFor(current); render(); };
    ck.appendChild(cbx); ck.appendChild(E('div', '', 'แก้ทุกชิ้นที่หน้าตาเหมือนกันพร้อมกัน'));
    body.appendChild(ck);

    var comp = getComputedStyle(current), saved = state.rules[key()] || {}, pt = parts();
    GROUPS.forEach(function (G) {
      var g = E('div', 'g' + (G.o ? ' o' : ''));
      g.appendChild(E('div', 'gh', '<span>' + G.n + '</span><span>&#9662;</span>'));
      var gb = E('div', 'gb');
      G.it.forEach(function (it) { gb.appendChild(row(it, saved, comp, pt)); });
      g.appendChild(gb); body.appendChild(g);
      g.querySelector('.gh').onclick = function () { g.classList.toggle('o'); };
    });

    body.appendChild(E('div', 'hint',
      '<span class="kb">ลาก</span> ย้าย \u00b7 <span class="kb">จุดส้ม</span> ย่อขยาย \u00b7 <span class="kb">ดับเบิลคลิก</span> แก้ข้อความ<br>' +
      '<span class="kb">\u2191\u2193\u2190\u2192</span> ขยับ 1px (Shift = 10) \u00b7 <span class="kb">[ ]</span> เปลี่ยนชั้น<br>' +
      '<span class="kb">Ctrl+C / Ctrl+V</span> ก๊อบ/วางสไตล์ \u00b7 <span class="kb">Esc</span> ยกเลิก'));
  }

  function row(it, saved, comp, pt) {
    var r = E('div', 'r'); r.appendChild(E('div', 'l', it.l));
    var c = E('div', 'c');
    var cur = saved[it.p] !== undefined ? saved[it.p] : comp.getPropertyValue(it.p);

    if (it.t === 'color') {
      var ci = E('input'); ci.type = 'color'; ci.value = hex(cur); c.appendChild(ci);
      var ar = null;
      if (it.a) { ar = E('input'); ar.type = 'range'; ar.min = 0; ar.max = 1; ar.step = .05; ar.value = alph(cur); c.appendChild(ar); }
      var up = function () {
        if (it.x) for (var k in it.x) setP(k, it.x[k], true);
        setP(it.p, (ar && ar.value < 1) ? rgba(ci.value, ar.value) : ci.value);
        frame();
      };
      /* ถ้าเดิมโปร่งใสสนิท (alpha=0) พอเลือกสีแล้วจะมองไม่เห็น — ดันเป็นทึบให้อัตโนมัติ */
      ci.oninput = function () { if (ar && parseFloat(ar.value) === 0) ar.value = 1; up(); };
      if (ar) ar.oninput = up;

    } else if (it.t === 'px' || it.t === 'num') {
      var isPx = it.t === 'px';
      var v = it.p.charAt(0) === '_' ? pt[it.p] : nump(cur);
      var s = E('input'); s.type = 'range';
      s.min = it.min !== undefined ? it.min : 0;
      s.max = it.max !== undefined ? it.max : 100;
      s.step = it.step || 1; s.value = v;
      var nn = E('div', 'n', isPx ? Math.round(v) + 'px' : String(Math.round(v * 100) / 100));
      s.oninput = function () {
        nn.textContent = isPx ? s.value + 'px' : s.value;
        if (it.p.charAt(0) === '_') setPart(it.p, s.value);
        else { if (it.x) for (var k in it.x) setP(k, it.x[k], true); setP(it.p, isPx ? s.value + 'px' : s.value, true); }
        frame();
      };
      s.onchange = function () { undoStack.push({ t: 'r', k: key(), p: it.p, v: null }); };
      c.appendChild(s); c.appendChild(nn);

    } else if (it.t === 'quad') {
      var q = E('div', 'q');
      it.sub.forEach(function (sp, i) {
        var inp = E('input'); inp.type = 'number'; inp.min = -300; inp.max = it.max || 200;
        inp.value = Math.round(nump(saved[sp] !== undefined ? saved[sp] : comp.getPropertyValue(sp)));
        inp.title = ['บน', 'ขวา', 'ล่าง', 'ซ้าย'][i];
        inp.oninput = function () { setP(sp, inp.value + 'px'); frame(); };
        q.appendChild(inp);
      });
      c.appendChild(q);

    } else if (it.t === 'sel' || it.t === 'sel2') {
      var sl = E('select');
      if (it.t === 'sel') {
        sl.appendChild(new Option('\u2014 ไม่เปลี่ยน \u2014', ''));
        it.o.forEach(function (o) { sl.appendChild(new Option(o, o)); });
      } else {
        it.o.forEach(function (o) { sl.appendChild(new Option(o[1], o[0])); });
      }
      sl.value = saved[it.p] || '';
      sl.onchange = function () { setP(it.p, sl.value || null); frame(); };
      c.appendChild(sl);

    } else if (it.t === 'font') {
      var sf = E('select');
      sf.appendChild(new Option('\u2014 ไม่เปลี่ยน \u2014', ''));
      FAMS.forEach(function (f) { sf.appendChild(new Option(f.split(',')[0].replace(/"/g, ''), f)); });
      sf.value = saved[it.p] || '';
      sf.onchange = function () {
        var nm = sf.value.split(',')[0].replace(/"/g, '');
        if (GFONTS.indexOf(nm) > -1) loadFont(nm);
        setP(it.p, sf.value || null); frame();
      };
      c.appendChild(sf);

    } else if (it.t === 'blur') {
      var bs = E('input'); bs.type = 'range'; bs.min = 0; bs.max = 30; bs.step = 1;
      bs.value = nump(String(saved[it.p] || '').replace(/[^\d.]/g, ''));
      var bn = E('div', 'n', bs.value + 'px');
      bs.oninput = function () { bn.textContent = bs.value + 'px'; setP(it.p, bs.value > 0 ? 'blur(' + bs.value + 'px)' : null, true); };
      c.appendChild(bs); c.appendChild(bn);

    } else if (it.t === 'txt') {
      var ti = E('input'); ti.type = 'text'; ti.placeholder = it.ph || '';
      ti.value = saved[it.p] || '';
      ti.onchange = function () { setP(it.p, ti.value || null); frame(); };
      c.appendChild(ti);
    }

    var x = E('button', 'x', '&#8630;');
    x.onclick = function () {
      if (it.t === 'quad') { it.sub.forEach(function (sp) { setP(sp, null, true); }); applyRules(); }
      else if (it.p.charAt(0) === '_') setPart(it.p, (it.p === '_scale' || it.p === '_bright' || it.p === '_sat') ? 1 : 0);
      else setP(it.p, null);
      render(); frame();
    };
    c.appendChild(x);
    r.appendChild(c);
    return r;
  }

  /* ============ KEYBOARD ============ */
  document.addEventListener('keydown', function (e) {
    if (!panel.classList.contains('open')) return;
    var t = e.target;
    if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    if (t && t.getAttribute && t.getAttribute('contenteditable')) return;
    var m = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { current = null; frame(); render(); return; }
    if (m && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (m && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (!current) return;
    if (m && e.key.toLowerCase() === 'c') { clipboard = JSON.parse(JSON.stringify(state.rules[key()] || {})); toast('ก๊อบสไตล์แล้ว'); return; }
    if (m && e.key.toLowerCase() === 'v') {
      if (!clipboard) return;
      var k = key();
      undoStack.push({ t: 'r', k: k, p: '__all', v: null });
      state.rules[k] = JSON.parse(JSON.stringify(clipboard));
      applyRules(); render(); frame(); toast('วางสไตล์แล้ว'); return;
    }
    if (e.key === '[') { if (current.parentElement && current.parentElement !== document.body) pick(current.parentElement); return; }
    if (e.key === ']') { if (current.firstElementChild) pick(current.firstElementChild); return; }
    var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    var step = e.shiftKey ? 10 : 1, xy = curXY();
    setXY(xy[0] + d[0] * step, xy[1] + d[1] * step);
    frame();
  }, true);

  /* ============ BUTTONS ============ */
  function mode(on) {
    picking = on;
    $('#mPick').classList.toggle('a', on); $('#mUse').classList.toggle('a', !on);
    if (!on) { hi.style.display = 'none'; tg.style.display = 'none'; }
    frame();
    toast(on ? 'โหมดเลือก — คลิกชิ้นที่จะแก้' : 'ใช้แอปได้ตามปกติ');
  }
  $('#mPick').onclick = function () { mode(true); };
  $('#mUse').onclick = function () { mode(false); };
  $$('.tabs button').forEach(function (b) { b.onclick = function () { tab = b.getAttribute('data-t'); render(); }; });

  $('#fab').onclick = function () {
    var o = panel.classList.toggle('open');
    $('#fab').classList.toggle('on', o);
    $('#fab').style.right = o ? '360px' : '14px';
    if (o) render(); else { mode(false); current = null; frame(); }
  };
  $('#bU').onclick = undo;
  $('#bR').onclick = redo;
  $('#bC').onclick = function () {
    if (!confirm('ล้างการแก้ทั้งหมด กลับเป็นดีไซน์เดิม?')) return;
    state.rules = {}; state.tokens = {}; state.texts = {};
    applyRules(); applyTokens(); current = null; frame(); render(); toast('ล้างแล้ว');
  };

  function exportCSS() {
    var out = '/* ==========================================================\n   StudentOS \u2014 Visual Edits\n   ' + new Date().toLocaleString('th-TH') +
      '\n   วางต่อท้าย style.css\n   ========================================================== */\n\n';
    if (state.fonts.length) {
      state.fonts.forEach(function (f) {
        out += "@import url('https://fonts.googleapis.com/css2?family=" + f.replace(/ /g, '+') + ":wght@200;300;400;500;600;700;800&display=swap');\n";
      });
      out += '\n';
    }
    var th;
    for (th in state.tokens) {
      var t = state.tokens[th], b = '', n;
      for (n in t) b += '  ' + n + ':' + t[n] + ';\n';
      if (!b) continue;
      out += (th === 'light' ? ':root, :root[data-theme="light"]' : ':root[data-theme="' + th + '"]') + '{\n' + b + '}\n\n';
    }
    var r = ruleText(true);
    if (r) out += '/* ---------- ชิ้นงานที่ปรับเอง ---------- */\n' + r;
    var tk = Object.keys(state.texts);
    if (tk.length) {
      out += '\n/* ---------- ข้อความที่แก้ (ไปแก้ใน index.html เอง) ----------\n';
      tk.forEach(function (s) { out += '   ' + s + '\n     \u2192  ' + state.texts[s] + '\n'; });
      out += '   -------------------------------------------------------- */\n';
    }
    return out;
  }
  $('#bEx').onclick = function () { $('#out').value = exportCSS(); $('#modal').classList.add('o'); };
  $('#bX').onclick = function () { $('#modal').classList.remove('o'); };
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

  new MutationObserver(function () { applyTokens(); if (panel.classList.contains('open')) render(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  applyRules(); applyTokens();
  setTimeout(applyTexts, 900);
  setInterval(function () { if (Object.keys(state.texts).length) applyTexts(); }, 2500);

  console.log('%cVisual Editor v2 พร้อมใช้ — กดปุ่มดินสอมุมขวาบน', 'background:#F59E0B;color:#111;padding:4px 10px;border-radius:6px;font-weight:700');
})();
