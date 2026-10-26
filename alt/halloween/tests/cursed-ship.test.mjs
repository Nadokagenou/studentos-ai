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
  assert.match(hoop, /function fxOwned\(id\) \{ return !!\(typeof FX_SHOP === 'object' && FX_SHOP\[id\]\?\.free\)/);
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
// เจ้าของ (26 ต.ค. 69): "เกลียดแสงเลเซอร์ · ฉากเปลี่ยนไปมาเหมือน AI · ไม่ต้องสลับตำแหน่งเยอะ" → ภาพเรือภาพเดียว ไม่มีลำแสง
test('the scene stays on one ship image with no beam and no cut, about 5–7 seconds', () => {
  const { api } = load();
  assert.ok(api.TOTAL >= 5000 && api.TOTAL <= 7000, String(api.TOTAL));
  const shots = [...source.matchAll(/\$\{shot\('(\w+)'\)\}/g)].map(m => m[1]);
  assert.deepEqual(shots, ['ship'], 'one shot only');
  const css = read('../season/cursed-ship.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /\.cs-beam|csShotFog|csShotFar|csShotDeck/);
  assert.doesNotMatch(source, /cs-beam/);
  // ใบงานขยับครั้งเดียว: มีจุดหมายนอกตำแหน่งเดิมจุดเดียวคือโคมเรือ
  assert.equal((source.match(/to\(lamp,/g) || []).length, 2, 'card moves only to the lantern');
});
// ทุกจังหวะต้องมีคำบรรยายบนจอ และตราต้องตกตรงเวลาเดียวกันทั้งใน JS และ CSS
test('each beat has an on-screen caption and the seal drops at the same moment in JS and CSS', () => {
  const caps = source.match(/const CAPS = \[([^\]]+)\]/);
  assert.ok(caps && caps[1].split(',').length === 3, 'three captions');
  const stamp = +source.match(/const STAMP_AT = (\d+)/)[1];
  const css = read('../season/cursed-ship.css');
  assert.match(css, new RegExp('csSeal [.\\d]+s cubic-bezier\\([^)]+\\) ' + stamp / 1000 + 's both'));
  assert.match(css, new RegExp('csShake [.\\d]+s linear ' + stamp / 1000 + 's 1'));
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

// คลิปของเจ้าของ (CLIP ใน cursed-ship.js) — ยังไม่มี = null · มีเมื่อไหร่ต้องตั้งค่าครบและไฟล์ต้องอยู่จริง
test('the clip setting is either off or complete and points at a real file', () => {
  const { api } = load();
  const c = api.CLIP;
  if (c === null) return;
  assert.ok(fs.existsSync(new URL('../season/cursed-ship/' + c.file, import.meta.url)), c.file);
  assert.ok(c.out > 0 && c.out <= 5, 'out ' + c.out);
  assert.ok(c.seal > 0 && c.seal < c.out, 'seal inside the clip');
  assert.equal(c.path[0].t, 0);
  for (let i = 1; i < c.path.length; i++) assert.ok(c.path[i].t > c.path[i - 1].t, 'path times rise');
  assert.ok(c.path.at(-1).t <= c.out, 'path ends inside the clip');
});
test('a clip that will not play falls back to the still scene instead of leaving a black screen', () => {
  assert.match(source, /Promise\.resolve\(p\)\.then\(go, \(\) => \{/);
  assert.match(source, /if \(ready\(\)\) playStills\(title, onClose, host, sheet\);/);
  assert.match(source, /at\(\(end \+ 2\) \* 1000, finish\)/, 'stalled clip still ends');
});
