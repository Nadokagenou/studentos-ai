import test from 'node:test';
import assert from 'node:assert/strict';
import { newItems, toEmbed, toMessages } from './news-discord.mjs';

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
