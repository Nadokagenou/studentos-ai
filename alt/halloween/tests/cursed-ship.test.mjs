import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const source = read('../season/cursed-ship.js');
const app = read('../../app.js');

// โหลดไฟล์จริงในบริบทจำลอง — มีแค่ของที่ไฟล์แตะตอนโหลดและตอนตัดสินใจ
function load({ season = true, pref = null, reduced = false, motion, quality } = {}) {
  const store = new Map(pref == null ? [] : [['studentos.alt.cursedShip', pref]]);
  const root = { classList: { contains: c => c === 'hw-season' && season }, dataset: {} };
  if (motion) root.dataset.hwMotion = motion;
  if (quality) root.dataset.quality = quality;
  const window = { addEventListener() {} };
  const ctx = { window, document: { documentElement: root, currentScript: { src: 'https://x.test/alt/halloween/season/cursed-ship.js' } }, URL, setTimeout() {}, matchMedia: () => ({ matches: reduced }),
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) } };
  window.matchMedia = ctx.matchMedia;
  vm.runInNewContext(source, ctx);
  return { api: window.CursedShip, store };
}

test('only the Halloween season changes the completion screen', () => {
  assert.equal(load({ season: false }).api.mode(false), 'off');
  assert.equal(load().api.mode(false), 'cinematic');
});
test('reduced motion, still Halloween motion, low graphics and the owner toggle all skip the cinematic', () => {
  assert.equal(load({ reduced: true }).api.mode(false), 'still');
  assert.equal(load({ motion: 'still' }).api.mode(false), 'still');
  assert.equal(load({ quality: 'low' }).api.mode(false), 'still');
  assert.equal(load({ pref: '0' }).api.mode(false), 'still');
});
test('a completion game the student chose keeps priority over the ship', () => {
  assert.equal(load().api.mode(true), 'still');
});
test('the effect toggle writes one new key and turning it back on removes it', () => {
  const { api, store } = load();
  api.toggle(null);
  assert.equal(store.get('studentos.alt.cursedShip'), '0');
  assert.equal(api.mode(false), 'still');
  api.toggle(null);
  assert.equal(store.has('studentos.alt.cursedShip'), false);
});
test('the cinematic refuses to start until every storyboard image has loaded', () => {
  const { api } = load();
  assert.equal(api.ready(), false);
  const sheet = { parentElement: {}, querySelector: () => null, classList: { add() {} } };
  assert.equal(api.play(sheet, { title: 'x', stats: [] }, () => assert.fail('onEnd must not run')), false);
});
test('every image the CSS and the script name exists and is in the offline shell', () => {
  const { api } = load();
  const css = read('../season/cursed-ship.css'), sw = read('../../sw.js');
  const used = new Set([...css.matchAll(/url\(cursed-ship\/([\w-]+\.webp)\)/g)].map(m => m[1]));
  for (const f of new Set([...api.FILES, ...used])) {
    assert.ok(fs.existsSync(new URL('../season/cursed-ship/' + f, import.meta.url)), f);
    assert.ok(sw.includes("'halloween/season/cursed-ship/" + f + "'"), 'sw shell: ' + f);
  }
  for (const f of used) assert.ok(api.FILES.includes(f), 'preloaded: ' + f);
});
test('the whole sequence stays inside the 2.5–3 second target', () => {
  const { api } = load();
  assert.ok(api.TOTAL >= 2500 && api.TOTAL <= 3000, String(api.TOTAL));
});
test('finishFocus records the task before the ship and refuses a second save', () => {
  const body = app.slice(app.indexOf('function finishFocus()'), app.indexOf('// ---------- task actions ----------'));
  const guard = body.indexOf("if (document.querySelector('#focusWrap .fc-sheet.done')) return;");
  assert.ok(guard > 0, 'duplicate guard');
  assert.ok(guard < body.indexOf('funnelDone()'), 'guard runs before any counter moves');
  assert.ok(body.indexOf('save();') < body.indexOf('CursedShip.play('), 'state is saved before the cinematic starts');
});
test('back button and Escape skip the ship before they close focus mode', () => {
  const list = app.slice(app.indexOf('const OVERLAYS = ['), app.indexOf("{ sel: '#focusWrap'"));
  assert.match(list, /\.cs-ov:not\(\.out\)'.*CursedShip\.skip\(\)/);
});
test('the page and the offline shell both ship the new files', () => {
  const html = read('../../index.html'), sw = read('../../sw.js');
  assert.match(html, /halloween\/season\/cursed-ship\.css/);
  assert.ok(html.indexOf('halloween/season/cursed-ship.js') > html.indexOf('<script src="app.js">'));
  assert.match(sw, /'halloween\/season\/cursed-ship\.js', 'halloween\/season\/cursed-ship\.css'/);
});
test('the motion CSS honours reduced motion and the lite device mode', () => {
  const css = read('../season/cursed-ship.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.cs-ov\.lite/);
  assert.doesNotMatch(css, /filter:\s*blur/, 'no full-layer blur on phones');
});
