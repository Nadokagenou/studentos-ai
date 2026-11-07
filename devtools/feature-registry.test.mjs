// Feature registry + lazy 3D effects (src/core/feature-registry.js)
// รัน: node --test devtools/feature-registry.test.mjs
// ทดสอบด้วย vm ที่มีกติกาสคริปต์คลาสสิกจริง (function ระดับบนสุดเขียนทับตัวแทนบน global ได้)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const Registry = require('../src/core/feature-registry.js');

// global จำลอง: โหลดสคริปต์ = รันซอร์สในบริบทเดียวกันแบบสคริปต์คลาสสิก
function sandbox(sources, {fail = new Set()} = {}) {
  const ctx = vm.createContext({console: {warn() {}, log() {}}});
  const loads = [];
  const loadScript = src => new Promise((resolve, reject) => {
    loads.push(src);
    setImmediate(() => {
      if (fail.has(src)) return reject(new Error('offline'));
      vm.runInContext(sources[src], ctx, {filename: src});
      resolve();
    });
  });
  return {ctx, loads, loadScript};
}

test('stub loads the feature once, then calls the real function with the same arguments', async () => {
  const {ctx, loads, loadScript} = sandbox({'fx.js': 'var calls=[];async function play(a,b){calls.push([a,b]);return "real:"+a;}'});
  const api = Registry.create({scope: ctx, loadScript});
  api.define('fx', {src: 'fx.js', exports: ['play']});
  assert.equal(api.status('fx'), 'idle');
  assert.equal(loads.length, 0, 'nothing loads before first use');
  assert.equal(await ctx.play('hoop', 'title'), 'real:hoop');
  assert.equal(api.status('fx'), 'ready');
  assert.equal(await ctx.play('goal'), 'real:goal');
  assert.deepEqual(loads, ['fx.js']);
  assert.equal(vm.runInContext('JSON.stringify(calls)', ctx), '[["hoop","title"],["goal",null]]');
});

test('repeated taps while loading open the feature once', async () => {
  const {ctx, loads, loadScript} = sandbox({'fx.js': 'var n=0;function play(){return ++n;}'});
  const api = Registry.create({scope: ctx, loadScript});
  api.define('fx', {src: 'fx.js', exports: ['play']});
  const a = ctx.play(), b = ctx.play(), c = ctx.play();
  assert.equal(a, b); assert.equal(b, c);
  await a;
  assert.equal(vm.runInContext('n', ctx), 1);
  assert.deepEqual(loads, ['fx.js']);
});

test('a failed load runs the fallback, keeps onClose, and can retry later', async () => {
  const fail = new Set(['fx.js']);
  const {ctx, loads, loadScript} = sandbox({'fx.js': 'function play(id,t,onClose){return "3d:"+id;}'}, {fail});
  const api = Registry.create({scope: ctx, loadScript});
  const fell = [];
  api.define('fx', {src: 'fx.js', exports: ['play'], fallback: (name, args) => { fell.push([name, args[0]]); args[2]?.(); return '2d'; }});
  let closed = 0;
  assert.equal(await ctx.play('bat', 't', () => closed++), '2d');
  assert.deepEqual(fell, [['play', 'bat']]);
  assert.equal(closed, 1);
  assert.equal(api.status('fx'), 'failed');
  fail.clear();
  assert.equal(await ctx.play('bat'), '3d:bat');
  assert.equal(api.status('fx'), 'ready');
  assert.deepEqual(loads, ['fx.js', 'fx.js']);
});

test('a script that loads but never defines the export counts as failed', async () => {
  const {ctx, loadScript} = sandbox({'fx.js': 'var other=1;'});
  const api = Registry.create({scope: ctx, loadScript});
  let fell = 0;
  api.define('fx', {src: 'fx.js', exports: ['play'], fallback: () => { fell++; }});
  await ctx.play();
  assert.equal(fell, 1);
  assert.equal(api.status('fx'), 'failed');
});

test('defining a feature twice keeps the first registration (no duplicate init)', () => {
  const {ctx, loadScript} = sandbox({});
  const api = Registry.create({scope: ctx, loadScript});
  api.define('fx', {src: 'a.js', exports: ['play']});
  const first = ctx.play;
  api.define('fx', {src: 'b.js', exports: ['play']});
  assert.equal(ctx.play, first);
  assert.equal(api.status('fx'), 'idle', 'second define must not mistake the stub for a loaded feature');
  assert.deepEqual(api.list(), ['fx']);
});

test('an already loaded export is left alone', () => {
  const {ctx, loadScript} = sandbox({});
  vm.runInContext('function play(){return "eager";}', ctx);
  const api = Registry.create({scope: ctx, loadScript});
  api.define('fx', {src: 'fx.js', exports: ['play']});
  assert.equal(ctx.play(), 'eager');
  assert.equal(api.status('fx'), 'ready');
});

// ---------- สัญญากับแอปหลักจริง ----------
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
const eager = [...html.matchAll(/<script[^>]*\ssrc="([^"?]+)/g)].map(m => m[1]);
const sw = read('sw.js');
const shell = [...sw.slice(sw.indexOf('const SHELL')).split('];')[0].matchAll(/"([^"]+)"/g)].map(m => m[1]);

test('fx3d.js is not loaded at startup; the registry loads before hoop.js uses open3D', () => {
  assert.ok(!eager.includes('fx3d.js'), 'fx3d.js must not be an eager <script>');
  const reg = eager.indexOf('src/core/feature-registry.js');
  assert.ok(reg >= 0, 'registry script tag present');
  assert.ok(reg < eager.indexOf('app.js'), 'registry before app.js');
});

test('both the registry and fx3d.js stay in the offline shell', () => {
  assert.ok(shell.includes('src/core/feature-registry.js'));
  assert.ok(shell.includes('fx3d.js'));
});

test('the real fx3d.js replaces the stub and covers every 3D id the app sells', async () => {
  const src = read('fx3d.js');
  const {ctx, loadScript} = sandbox({'fx3d.js': src});
  const reg = read('src/core/feature-registry.js');
  ctx.document = {createElement() { throw new Error('use injected loader'); }, head: {}};
  vm.runInContext(reg, ctx, {filename: 'feature-registry.js'});
  assert.equal(typeof ctx.open3D, 'function', 'browser path installs the open3D stub at startup');
  assert.equal(ctx.StudentOSFeatures.status('fx3d'), 'idle');
  delete ctx.open3D; // ตัวทดสอบใช้ตัวโหลดที่ฉีดเอง แทนตัวที่ต้องใช้ document จริง
  const api = ctx.StudentOSFeatures.__createForTest({scope: ctx, loadScript});
  api.define('fx3d', ctx.StudentOSFeatures.manifest.fx3d);
  const stub = ctx.open3D;
  await api.load('fx3d');
  assert.notEqual(ctx.open3D, stub, 'real open3D took over');
  const ids = JSON.parse(read('app.js').match(/const FX3D_IDS = (\[[^\]]+\])/)[1].replaceAll("'", '"'));
  assert.deepEqual(Object.keys(vm.runInContext('FX3D_GAMES', ctx)).sort(), [...ids].sort());
});

test('hoop.js no longer needs FX3D_GAMES before 3D has loaded', () => {
  const hoop = read('hoop.js');
  assert.ok(!/FX3D_GAMES/.test(hoop), 'preview check uses FX3D_IDS (app.js) instead');
});
