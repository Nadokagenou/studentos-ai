import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Moon & Candle sample theme (theme-moonlight.css). Reads the 60:30:10 token blocks straight from the theme so a colour edit cannot skip the contrast check.
const css = fs.readFileSync(new URL('../rewards/theme-moonlight.css', import.meta.url), 'utf8');
function block(selector) {
  const start = css.indexOf(selector + '{');
  assert.ok(start >= 0, 'missing block ' + selector);
  const body = css.slice(start + selector.length + 1, css.indexOf('}', start));
  const map = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+):([^;]+);/g)) map[name] = value.trim();
  return map;
}
const night = block(':root[data-theme="moonlight"]');
const light = { ...night, ...block(':root[data-theme="moonlight"][data-hw-tone="light"]') };
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
// Paint a possibly translucent colour over an opaque one.
const over = (top, under) => { const a = top.length > 7 ? parseInt(top.slice(7, 9), 16) / 255 : 1; return toHex(rgb(top).map((v, i) => v * a + rgb(under)[i] * (1 - a))); };
function raw(map, name) {
  let value = map[name];
  for (let i = 0; value && i < 5; i++) { const ref = /^var\((--[\w-]+)\)$/.exec(value); if (!ref) break; value = map[ref[1]]; }
  assert.match(value || '', /^#[0-9a-f]{6}([0-9a-f]{2})?$/i, name + ' must resolve to a hex colour, got ' + value);
  return value;
}
// Glass is translucent and always sits on --hw-glass-base; `backdrop` is what shows through (the canvas by default).
function resolve(map, name, backdrop = raw(map, '--hw-canvas')) {
  const value = raw(map, name);
  if (value.length === 7) return value;
  return over(value, over(raw(map, '--hw-glass-base'), backdrop));
}
const luminance = hex => { const [r, g, b] = rgb(hex).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// [foreground, background, minimum] — 4.5 for text, 3 for large shapes against their surroundings.
const text = [
  ['--hw-ink', '--hw-canvas'], ['--hw-ink-2', '--hw-canvas'], ['--hw-ink-blue', '--hw-canvas'], ['--hw-sky-text', '--hw-canvas'],
  ['--hw-ink', '--hw-chrome'], ['--hw-ink-2', '--hw-chrome'], ['--hw-ink-2', '--hw-chrome-2'], ['--hw-sky-text', '--hw-chrome'],
  ['--hw-ink', '--hw-card'], ['--hw-ink-blue', '--hw-card'], ['--hw-ink-3', '--hw-card'], ['--hw-sky-text', '--hw-card'],
  ['--hw-ink', '--hw-card-hi'], ['--hw-ink-blue', '--hw-card-hi'], ['--hw-ink-3', '--hw-card-hi'],
  ['--hw-ink', '--hw-card-low'], ['--hw-ink-blue', '--hw-card-low'], ['--hw-sky-text', '--hw-card-low'],
  ['--on-fill', '--fill'], ['--hw-ink', '--hw-well'], ['--hw-ink-2', '--hw-well'],
  ['--fill', '--hw-card'], ['--fill', '--hw-card-hi'], ['--blue', '--hw-card'], ['--blue', '--hw-card-hi'], ['--blue', '--blue-soft'], ['--blue-deep', '--blue-soft'],
  ['--hw-on-orange', '--hw-orange-cta'], ['--hw-on-orange', '--hw-orange-cta-low'],
  ['--hw-orange', '--hw-canvas'], ['--hw-orange', '--hw-chrome'], ['--hw-orange', '--hw-chrome-2'],
  ['--hw-good', '--hw-card'], ['--hw-warn', '--hw-card'], ['--hw-alert', '--hw-card'],
  ['--hw-good', '--hw-card-hi'], ['--hw-warn', '--hw-card-hi'], ['--hw-alert', '--hw-card-hi'],
  ['--hw-good-ink', '--hw-good-bg'], ['--hw-alert-ink', '--hw-alert-bg'],
  ['--hw-ink', '--hw-hero-a'], ['--hw-ink', '--hw-hero-b'], ['--hw-ink-blue', '--hw-hero-a'], ['--hw-sky-text', '--hw-hero-a'],
  ['--ink', '--card'], ['--muted', '--card'], ['--faint', '--card'], ['--blue', '--card'], ['--ink', '--card2'], ['--muted', '--card2'],
].map(([fg, bg]) => [fg, bg, 4.5]);
const shapes = [['--hw-orange-cta', '--hw-canvas', 3], ['--hw-orange-cta', '--hw-card', 1.5], ['--fill', '--hw-card', 1.5]];

for (const [tone, map] of [['night', night], ['light', light]]) {
  test(tone + ' tone: text and key shapes keep their contrast', () => {
    const misses = [...text, ...shapes]
      .map(([fg, bg, min]) => ({ fg, bg, min, value: ratio(resolve(map, fg), resolve(map, bg)) }))
      .filter(r => r.value < r.min).map(r => `${r.fg} on ${r.bg} = ${r.value.toFixed(2)} (needs ${r.min})`);
    assert.deepEqual(misses, []);
  });
  test(tone + ' tone: the selected tab and the orange + button stand out from the tab bar (3:1 for UI shapes)', () => {
    for (const chrome of ['--hw-chrome', '--hw-chrome-2'])
      for (const shape of ['--fill', '--hw-orange-cta']) assert.ok(ratio(resolve(map, shape), resolve(map, chrome)) >= 3, shape + ' on ' + chrome);
  });
}
test('night glass stays readable even where it covers the brightest art (the moon at its scene opacity)', () => {
  const moonArt = over('#F4E8CC94', raw(night, '--hw-canvas'));
  for (const glass of ['--hw-card', '--hw-card-hi', '--hw-card-low'])
    for (const [fg, min] of [['--hw-ink', 4.5], ['--hw-ink-blue', 4.5]])
      assert.ok(ratio(raw(night, fg), resolve(night, glass, moonArt)) >= min, fg + ' on ' + glass + ' over the moon');
});
test('solid app tokens match what the glass looks like, so other screens blend with the theme', () => {
  for (const map of [night, light])
    for (const [solid, glass] of [['--card', '--hw-card'], ['--card2', '--hw-card-hi']]) {
      const a = rgb(raw(map, solid)), b = rgb(resolve(map, glass));
      assert.ok(a.every((v, i) => Math.abs(v - b[i]) <= 6), solid + ' ' + raw(map, solid) + ' vs glass ' + toHex(b));
    }
});
test('the light tone redefines every palette colour, so nothing from night leaks into it', () => {
  const lightOwn = block(':root[data-theme="moonlight"][data-hw-tone="light"]');
  const palette = Object.keys(night).filter(name => name.startsWith('--hw-'));
  assert.deepEqual(palette.filter(name => !(name in lightOwn)), []);
});
test('orange (10%) is not the generic fill, so ordinary buttons stay blue', () => {
  for (const map of [night, light]) assert.notEqual(resolve(map, '--fill'), resolve(map, '--hw-orange-cta'));
  assert.doesNotMatch(css, /:is\(button\.btn,/, 'every .btn variant would turn orange');
});
test('status colours keep their meaning and never reuse the accent', () => {
  for (const map of [night, light]) {
    const accent = resolve(map, '--hw-orange');
    for (const status of ['--hw-good', '--hw-warn', '--hw-alert']) assert.notEqual(resolve(map, status), accent, status);
  }
});
test('every rule in the sample theme is scoped to it, so the Halloween theme cannot change', () => {
  const leaks = css.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/)
    .filter(line => /^[^\s@}]/.test(line) && line.includes('{'))
    .filter(line => !line.includes('[data-theme="moonlight"]') && !line.startsWith('.sw-moonlight'));
  assert.deepEqual(leaks.map(line => line.slice(0, 80)), []);
});
