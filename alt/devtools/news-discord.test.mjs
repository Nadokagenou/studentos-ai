import test from 'node:test';
import assert from 'node:assert/strict';
import { newItems, toEmbed, toMessages, intro, pick } from './news-discord.mjs';

const it = (id, extra = {}) => ({ id, date: '2026-10-15', kind: 'feature', release: '1C57', title: 'T ' + id, body: 'B', evidence: [{ quote: 'x' }], ...extra });

test('sends only ids that were not in the old file', () => {
  const got = newItems({ items: [it('a')] }, { items: [it('a'), it('b')] });
  assert.deepEqual(got.map(x => x.id), ['b']);
});

test('no old file means first run — sends nothing instead of replaying history', () => {
  assert.deepEqual(newItems(null, { items: [it('a')] }), []);
});

test('notice whose until has passed is skipped', () => {
  const now = Date.parse('2026-10-20T00:00:00Z');
  const got = newItems({ items: [] }, { items: [it('old', { kind: 'notice', until: '2026-10-18T23:00:00+07:00' }), it('new')] }, now);
  assert.deepEqual(got.map(x => x.id), ['new']);
});

test('embed carries title, body, points and in-app kind name, never evidence', () => {
  const e = toEmbed(it('a', { points: ['p1', 'p2'] }));
  assert.equal(e.title, 'T a');
  assert.equal(e.description, 'B\n\n• p1\n• p2');
  assert.equal(e.footer.text, 'ฟีเจอร์ใหม่ · รุ่น 1C57');
  assert.ok(!JSON.stringify(e).includes('evidence'));
  assert.equal(toEmbed(it('n', { kind: 'notice' })).footer.text, 'ประกาศสำคัญ · จากทีม StudentOS');
});

test('splits into messages of at most 10 embeds', () => {
  const msgs = toMessages(Array.from({ length: 23 }, (_, i) => it('x' + i)));
  assert.deepEqual(msgs.map(m => m.embeds.length), [10, 10, 3]);
});

test('promo becomes the headline and the original title leads the body', () => {
  const e = toEmbed(it('a', { promo: 'ลองแล้วจะติดใจ' }));
  assert.equal(e.title, 'ลองแล้วจะติดใจ');
  assert.equal(e.description, '**T a**\n\nB');
});

test('image points at the pushed commit so it exists before the site redeploys', () => {
  const e = toEmbed(it('a', { image: 'img/a.png' }), { GITHUB_REPOSITORY: 'o/r', GITHUB_SHA: 'abc123' });
  assert.equal(e.image.url, 'https://raw.githubusercontent.com/o/r/abc123/alt/news/img/a.png');
  assert.equal(toEmbed(it('b'), {}).image, undefined);
});

test('first message invites testers to try and report back', () => {
  const m = toMessages([it('a')], {});
  assert.equal(m[0].content, intro(1));
  assert.match(m[0].content, /บอกในห้องนี้/);
});

test('manual resend takes several ids or a whole release', () => {
  const doc = { items: [it('a'), it('b', { release: '1C60' }), it('c', { release: '1C60' })] };
  assert.deepEqual(pick(doc, 'a, c').map(x => x.id), ['a', 'c']);
  assert.deepEqual(pick(doc, '1c60').map(x => x.id), ['b', 'c']);
  assert.deepEqual(pick(doc, 'nope'), []);
});
