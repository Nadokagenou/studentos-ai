import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const source = read('../season/cursed-ship.js');
const app = read('../../app.js');
const hoop = read('../../hoop.js');

// โหลดไฟล์จริงในบริบทจำลอง — มีแค่ของที่ไฟล์แตะตอนโหลดและตอนตัดสินใจ
function load({ chosen = false, reduced = false, shop = {} } = {}) {
  const store = new Map(chosen ? [['studentos.alt.doneFx', 'cursedship']] : []);
  const root = { classList: { contains: () => false }, dataset: {} };
  const window = { addEventListener() {} };
  const toasts = [];
  window.showToast = t => toasts.push(t);
  const ctx = { window, URL, setTimeout() {}, FX_SHOP: shop, renderFxPick() { ctx.picked = true; },
    document: { documentElement: root, currentScript: { src: 'https://x.test/alt/halloween/season/cursed-ship.js' }, querySelector: () => null },
    matchMedia: () => ({ matches: reduced }),
    liveTasks: () => [{ done: true, doneAt: new Date().toISOString() }, { done: true, doneAt: '2020-01-01T00:00:00Z' }, { done: false }],
    doneCount: () => 146,
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) } };
  window.matchMedia = ctx.matchMedia;
  vm.runInNewContext(source, ctx);
  return { api: window.CursedShip, ctx, toasts };
}

test('registers itself as a free completion effect and refreshes the picker', () => {
  const { ctx } = load();
  const fx = ctx.FX_SHOP.cursedship;
  assert.ok(fx, 'FX_SHOP.cursedship');
  assert.equal(fx.cost, 0);
  assert.equal(fx.free, true);
  assert.match(fx.icon, /seal\.webp/);
  assert.equal(ctx.picked, true);
});
test('the summary skin follows the chosen effect only, not the season', () => {
  assert.equal(load().api.skinOn(), false);
  assert.equal(load({ chosen: true }).api.skinOn(), true);
});
test('reduced motion, still Halloween motion and low graphics never play the sequence', () => {
  const { api } = load();
  assert.equal(api.motionOk({ reduced: false, still: false, quality: '' }), true);
  assert.equal(api.motionOk({ reduced: true, still: false, quality: '' }), false);
  assert.equal(api.motionOk({ reduced: false, still: true, quality: '' }), false);
  assert.equal(api.motionOk({ reduced: false, still: false, quality: 'low' }), false);
  assert.equal(load({ reduced: true }).api.canPlay(), false);
});
test('the effect refuses to play until every storyboard image has loaded, and still closes', () => {
  const { api } = load({ chosen: true });
  assert.equal(api.ready(), false);
  assert.equal(api.canPlay(), false);
  let closed = 0;
  api.playFx('งาน', () => { closed++; });
  assert.equal(closed, 1, 'onClose runs so the app can continue');
});
test('card numbers come from real tasks: done today and done overall', () => {
  assert.equal(JSON.stringify(load().api.stats()), JSON.stringify([[1, 'งานเสร็จวันนี้'], [146, 'เสร็จทั้งหมด']]));
});
test('hoop.js routes the new id through the shared effect path', () => {
  assert.match(hoop, /if \(window\.HalloweenCosmetics\?\.isEffect\(id\)\) return window\.HalloweenCosmetics\.owns\(id\)/);
  assert.match(hoop, /if \(id === 'cursedship'\) return !!window\.CursedShip\?\.canPlay\(\)/);
  assert.match(hoop, /if \(id === 'cursedship' && window\.CursedShip\) return window\.CursedShip\.playFx\(title, onClose, preview\)/);
  assert.match(hoop, /const fxOpenNow = \(\) => !!document\.querySelector\('\.hoop-ov:not\(\.out\), \.cs-ov:not\(\.out\)'\)/);
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
// เป้าเดิม 2.5–3 วิ · เจ้าของดูบนมือถือแล้วไม่เข้าใจเพราะช็อตสั้นเกิน จึงยอมยาวขึ้นได้ไม่เกิน 3.5 วิ (ข้ามได้ตลอด)
test('the whole sequence stays short (at most 3.5 seconds) and every shot holds long enough to read', () => {
  const { api } = load();
  assert.ok(api.TOTAL >= 2500 && api.TOTAL <= 3500, String(api.TOTAL));
  const css = read('../season/cursed-ship.css');
  for (const k of ['Ship', 'Deck', 'Far']) {
    // เวลาที่เห็นช็อตนี้เต็มตา = ตั้งแต่ขึ้นเต็ม จนจางหายหมด
    const m = css.match(new RegExp('@keyframes csShot' + k + '\\s+\\{ 0%, [\\d.]+% \\{ opacity: 0; \\} ([\\d.]+)% \\{ opacity: 1; \\} [\\d.]+% \\{ opacity: 1; \\} ([\\d.]+)%'));
    assert.ok(m, k);
    const heldMs = (+m[2] - +m[1]) / 100 * api.TOTAL;
    assert.ok(heldMs >= 600, k + ' holds ' + Math.round(heldMs) + 'ms');
  }
});
test('finishFocus saves before any effect and refuses a second save', () => {
  const body = app.slice(app.indexOf('function finishFocus()'), app.indexOf('// ---------- task actions ----------'));
  const guard = body.indexOf("if (document.querySelector('#focusWrap .fc-sheet.done')) return;");
  assert.ok(guard > 0, 'duplicate guard');
  assert.ok(guard < body.indexOf('funnelDone()'), 'guard runs before any counter moves');
  assert.ok(body.indexOf('save();') < body.indexOf('openDoneFx('), 'state is saved before the effect starts');
  assert.match(body, /CursedShip\.skinOn\(\)/);
  assert.doesNotMatch(body, /hw-season|CursedShip\.mode/, 'no automatic season trigger any more');
});
test('back button and Escape skip the ship before they close focus mode', () => {
  const list = app.slice(app.indexOf('const OVERLAYS = ['), app.indexOf("{ sel: '#focusWrap'"));
  assert.match(list, /\.cs-ov:not\(\.out\)'.*CursedShip\.skip\(\)/);
});
test('the page loads the effect after hoop.js and the offline shell ships both files', () => {
  const html = read('../../index.html'), sw = read('../../sw.js');
  assert.match(html, /halloween\/season\/cursed-ship\.css/);
  assert.ok(html.indexOf('halloween/season/cursed-ship.js') > html.indexOf('<script src="hoop.js">'));
  assert.match(sw, /'halloween\/season\/cursed-ship\.js', 'halloween\/season\/cursed-ship\.css'/);
});
test('the motion CSS honours reduced motion and the lite device mode', () => {
  const css = read('../season/cursed-ship.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.cs-ov\.lite/);
  assert.doesNotMatch(css, /filter:\s*blur/, 'no full-layer blur on phones');
});
