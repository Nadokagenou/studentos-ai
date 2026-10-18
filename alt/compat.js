// compat.js — ให้มือถือรุ่นเก่ายังใช้แอปได้และอ่านออก (17 ต.ค. 69)
// ------------------------------------------------------------
// iPhone 6s · 7 · SE รุ่นแรก อัปได้สุด iOS 15 (Safari 15) — เครื่องสเปคต่ำที่นักเรียนใช้กันจริง
// Safari 15 ไม่มีของหลายอย่างที่แอปใช้ และไม่ได้แค่ "สวยน้อยลง" แต่อ่านไม่ออก/กดไม่ได้:
//   ① color-mix() ใน CSS (~550 จุด 10 ไฟล์ · มีตั้งแต่ Safari 16.2) — เบราว์เซอร์ที่ไม่รู้จักทิ้งค่านั้นทั้งบรรทัด
//      หัวการ์ด "ตอนนี้" บนหน้าแรกเหลือพื้นขาว · ชื่องานกับเวลาเป็นตัวขาว = มองไม่เห็นคำตอบหลักของแอปเลย
//   ② AbortSignal.timeout (16.0) — ข่าวจากทีม/ประกาศส่วนตัวโหลดไม่ขึ้นเงียบ ๆ
//   ③ Object.hasOwn · Array.prototype.at · crypto.randomUUID (15.4) — จอสำรวจเปิดไม่ได้ · แจ้งปัญหาพัง (iOS 15.0–15.3)
// เครื่องที่มีของครบ ไฟล์นี้ไม่ทำอะไรเลย (เช็คแล้วออกทันที)
//
// ① ทำอย่างไร: อ่านข้อความ CSS ต้นฉบับ (จากแคชของ service worker ก่อน · ไม่มีค่อยโหลด) แล้วคำนวณ color-mix
//    ทุกตัวเป็นสีจริงจากโทเคนของธีมที่ใช้อยู่ วางเป็น <style> ต่อท้าย <link> เดิมแล้วปิด <link> (ลำดับในหน้าคงเดิม)
//    เปลี่ยนธีม = คำนวณใหม่ · ตัวแปรที่ตั้งเฉพาะชิ้น (เช่นสีวิชาต่อการ์ด) ใช้ค่าของชิ้นแรกที่ตรงกับตัวเลือก — ใกล้เคียง ไม่ตรงเป๊ะ
//    ผสมสีแบบ srgb ตามสเปค (premultiplied alpha · เปอร์เซ็นต์รวมไม่ถึง 100 = จางลงตามสัดส่วน) · in oklab ใช้ srgb แทน (มี 2 จุด)
// ต้องโหลดก่อน staff-news.js (ข้อ ② ถูกเรียกตั้งแต่แอปเริ่ม) · ไม่พึ่งไฟล์อื่น
// ทดสอบ: node devtools/oldphone.mjs (จำลอง iOS 15 บน Chrome · เทียบสีทุกชิ้นกับเครื่องใหม่)
(function () {
  'use strict';

  // ---------- ② ③ ฟังก์ชันที่ขาด ----------
  if (window.AbortController && window.AbortSignal && typeof AbortSignal.timeout !== 'function') {
    AbortSignal.timeout = function (ms) {
      var c = new AbortController();
      setTimeout(function () { try { c.abort(new DOMException('signal timed out', 'TimeoutError')); } catch (e) { c.abort(); } }, ms);
      return c.signal;
    };
  }
  if (typeof Object.hasOwn !== 'function') {
    Object.defineProperty(Object, 'hasOwn', { value: function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); }, configurable: true, writable: true });
  }
  if (typeof Array.prototype.at !== 'function') {
    Object.defineProperty(Array.prototype, 'at', { value: function (n) { n = Math.trunc(n) || 0; if (n < 0) n += this.length; return this[n]; }, configurable: true, writable: true });
  }
  if (window.crypto && crypto.getRandomValues && typeof crypto.randomUUID !== 'function') {
    var uuid = function () {
      var b = crypto.getRandomValues(new Uint8Array(16)), h = [];
      b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;   // รุ่น 4 · variant RFC 4122
      for (var i = 0; i < 16; i++) h.push((b[i] + 256).toString(16).slice(1));
      return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' + h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' + h.slice(10).join('');
    };
    try { Object.defineProperty(Crypto.prototype, 'randomUUID', { value: uuid, configurable: true, writable: true }); } catch (e) { crypto.randomUUID = uuid; }
  }

  // ---------- ① color-mix ----------
  if (!window.CSS || !CSS.supports || CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')) return;

  var entries = [];          // { link, style, text } — เฉพาะไฟล์ที่มี color-mix
  var rootCs = null;
  var ctx2d = document.createElement('canvas').getContext('2d');

  function closeParen(s, open) {          // s[open] === '(' → ตำแหน่ง ')' ที่คู่กัน
    for (var d = 0, i = open; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '(') d++; else if (ch === ')' && --d === 0) return i;
    }
    return -1;
  }
  function splitTop(s) {                  // แยกด้วยจุลภาคชั้นนอกสุด
    var out = [], d = 0, from = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '(') d++; else if (ch === ')') d--;
      else if (ch === ',' && !d) { out.push(s.slice(from, i)); from = i + 1; }
    }
    out.push(s.slice(from));
    return out;
  }
  function subVars(s, cs, depth) {        // แทน var(--x, สำรอง) ด้วยค่าจริง (ของชิ้นนั้น → ของราก → ค่าสำรอง)
    var i;
    while ((i = s.indexOf('var(')) !== -1) {
      var end = closeParen(s, i + 3);
      if (end < 0 || depth > 12) return null;
      var parts = splitTop(s.slice(i + 4, end)), name = parts[0].trim();
      var v = ((cs && cs.getPropertyValue(name)) || '').trim() || (rootCs.getPropertyValue(name) || '').trim();
      if (!v) v = parts.length > 1 ? parts.slice(1).join(',').trim() : null;
      if (v == null) return null;
      v = subVars(v, cs, depth + 1);
      if (v == null) return null;
      s = s.slice(0, i) + v + s.slice(end + 1);
    }
    return s;
  }
  function parseColor(c) {                // ให้ canvas อ่านสีแทน (รู้จักทุกแบบที่เบราว์เซอร์รู้จัก) → [r,g,b,a]
    c = c.trim();
    if (!c || /currentcolor/i.test(c)) return null;
    ctx2d.fillStyle = '#010203'; ctx2d.fillStyle = c;
    var v = ctx2d.fillStyle;
    if (v === '#010203' && !/^#010203$/i.test(c)) return null;
    if (v.charAt(0) === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
    var m = v.match(/[\d.]+/g);
    return m && m.length >= 3 ? [+m[0], +m[1], +m[2], m.length > 3 ? +m[3] : 1] : null;
  }
  function evalMix(inner, cs, depth) {    // ข้างใน color-mix( … ) → 'rgba(…)'
    var parts = splitTop(inner);
    if (parts.length !== 3 || !/^\s*in\s/.test(parts[0])) return null;
    var cols = [], pcts = [];
    for (var k = 1; k < 3; k++) {
      var p = parts[k].trim(), m = p.match(/^([\s\S]*?)\s+(-?[\d.]+)%$/) || p.match(/^(-?[\d.]+)%\s+([\s\S]*)$/), col = p, pct = null;
      if (m) { if (/%$/.test(p)) { col = m[1]; pct = +m[2]; } else { pct = +m[1]; col = m[2]; } }
      var r = resolve(col, cs, depth + 1), c = r == null ? null : parseColor(r);
      if (!c) return null;
      cols.push(c); pcts.push(pct);
    }
    var p1 = pcts[0], p2 = pcts[1];
    if (p1 == null && p2 == null) p1 = p2 = 50;
    else if (p1 == null) p1 = 100 - p2;
    else if (p2 == null) p2 = 100 - p1;
    var sum = p1 + p2;
    if (!(sum > 0)) return null;
    var mult = sum < 100 ? sum / 100 : 1; p1 /= sum; p2 /= sum;
    var a = cols[0][3] * p1 + cols[1][3] * p2, rgb = [];
    for (var j = 0; j < 3; j++) rgb.push(a ? Math.round((cols[0][j] * cols[0][3] * p1 + cols[1][j] * cols[1][3] * p2) / a) : 0);
    return 'rgba(' + rgb.join(', ') + ', ' + Math.round(a * mult * 1000) / 1000 + ')';
  }
  function resolve(s, cs, depth) {        // แทนตัวแปร แล้วคำนวณ color-mix ทุกตัวในข้อความ (ซ้อนกันได้)
    if (depth > 12) return null;
    s = subVars(s, cs, depth);
    if (s == null) return null;
    var out = '', i = 0, j;
    while ((j = s.indexOf('color-mix(', i)) !== -1) {
      var end = closeParen(s, j + 9);
      if (end < 0) return null;
      var v = evalMix(s.slice(j + 10, end), cs, depth + 1);
      if (v == null) return null;
      out += s.slice(i, j) + v; i = end + 1;
    }
    return out + s.slice(i);
  }
  var PSEUDO = /::?(before|after|placeholder|selection|marker|backdrop|first-line|first-letter|-webkit-[\w-]+)(\([^)]*\))?|:(hover|active|focus|focus-visible|focus-within|visited|target)\b/g;
  function ctxFor(text, pos, cache) {     // สไตล์ของชิ้นแรกที่ตรงกับตัวเลือกของกฎนี้ (ไว้อ่านตัวแปรที่ตั้งเฉพาะชิ้น)
    var open = text.lastIndexOf('{', pos);
    if (open < 0) return null;
    var start = Math.max(text.lastIndexOf('}', open), text.lastIndexOf('{', open - 1), text.lastIndexOf(';', open)) + 1;
    var sel = text.slice(start, open).trim();
    if (sel in cache) return cache[sel];
    var el = null;
    if (sel && sel.charAt(0) !== '@' && !/^(from|to|[\d.\s%,]+)$/.test(sel)) {
      try { el = document.querySelector(sel.replace(PSEUDO, '') || '*'); } catch (e) { el = null; }
    }
    return (cache[sel] = el && el !== document.documentElement ? getComputedStyle(el) : null);
  }
  function rewrite(text, cache) {
    var out = '', i = 0, j;
    while ((j = text.indexOf('color-mix(', i)) !== -1) {
      var end = closeParen(text, j + 9);
      if (end < 0) break;
      var v = resolve(text.slice(j, end + 1), ctxFor(text, j, cache), 0);
      out += text.slice(i, j) + (v == null ? text.slice(j, end + 1) : v);   // คำนวณไม่ได้ = คงเดิม (ไม่แย่กว่าเดิม)
      i = end + 1;
    }
    return out + text.slice(i);
  }
  function apply(first) {
    // รอบหลัง (เปลี่ยนธีม): คืนข้อความดิบก่อน ให้อ่านโทเคนของธีมใหม่ได้ถูก ไม่ใช่ค่าที่คำนวณไว้ของธีมเก่า
    if (!first) entries.forEach(function (e) { e.style.textContent = e.text; });
    rootCs = getComputedStyle(document.documentElement);
    var cache = {}, outs = entries.map(function (e) { return rewrite(e.text, cache); });
    entries.forEach(function (e, k) { e.style.textContent = outs[k]; if (first) e.link.disabled = true; });
  }
  function readCss(href) {                // แคชของ service worker ก่อน (ไม่เปลืองเน็ต) · ไม่มีค่อยโหลด
    var net = function () { return fetch(href, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; }); };
    if (!window.caches) return net();
    return caches.match(href).then(function (r) { return r ? r.text() : net(); }, net);
  }
  function start() {
    var links = Array.prototype.filter.call(document.querySelectorAll('link[rel~="stylesheet"]'), function (l) {
      return !l.disabled && l.href && l.href.indexOf(location.origin + '/') === 0;
    });
    Promise.all(links.map(function (l) { return readCss(l.href).catch(function () { return ''; }); })).then(function (texts) {
      links.forEach(function (l, k) {
        var t = (texts[k] || '').replace(/\/\*[\s\S]*?\*\//g, '');
        if (t.indexOf('color-mix(') === -1) return;
        var st = document.createElement('style');
        st.setAttribute('data-compat', l.getAttribute('href'));
        if (l.media) st.media = l.media;
        l.parentNode.insertBefore(st, l.nextSibling);
        entries.push({ link: l, style: st, text: t });
      });
      if (!entries.length) return;
      apply(true);
      var timer = 0;
      new MutationObserver(function () { clearTimeout(timer); timer = setTimeout(function () { apply(false); }, 30); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
