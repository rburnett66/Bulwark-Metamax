import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeReplay, replayFor, latestReplay, replayKeys, replayBytes, KEEP, REPLAYS_KEY, LEGACY_KEY } from './replays.js';
import { createLog, recordCommand, serializeLog } from '../sim/replay.js';

function mem(quota = Infinity) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (String(v).length > quota) throw new Error('QuotaExceeded'); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
    m,
  };
}

test('stores per battle, newest first, keyed by the history entry at', () => {
  const s = mem();
  storeReplay(s, 100, 'A'); storeReplay(s, 200, 'B');
  assert.equal(replayFor(s, 100), 'A');
  assert.equal(replayFor(s, 200), 'B');
  assert.equal(replayFor(s, 300), null);
  assert.equal(latestReplay(s), 'B');
  assert.deepEqual(replayKeys(s), [200, 100]);
});

test('keeps the last 20', () => {
  const s = mem();
  for (let i = 1; i <= 25; i++) storeReplay(s, i, 'L' + i);
  assert.equal(replayKeys(s).length, KEEP);
  assert.equal(replayFor(s, 5), null);
  assert.equal(replayFor(s, 6), 'L6');
  assert.equal(latestReplay(s), 'L25');
});

test('migrates the single last replay and removes the old key', () => {
  const s = mem();
  s.setItem(LEGACY_KEY, 'OLD');
  assert.equal(latestReplay(s), 'OLD');
  storeReplay(s, 50, 'NEW');
  assert.deepEqual(replayKeys(s), [50, 0]);
  assert.equal(s.getItem(LEGACY_KEY), null);
});

test('a full storage drops the oldest instead of failing', () => {
  const s = mem(200);
  for (let i = 1; i <= 10; i++) storeReplay(s, i, 'x'.repeat(40));
  const keys = replayKeys(s);
  assert.ok(keys.length >= 1 && keys.length < 10);
  assert.equal(keys[0], 10);
});

test('corrupt or missing storage is harmless', () => {
  const s = mem();
  s.setItem(REPLAYS_KEY, '{nope');
  assert.equal(latestReplay(s), null);
  assert.equal(storeReplay(null, 1, 'A'), 0);
  assert.equal(replayFor(null, 1), null);
  assert.equal(replayBytes(s) > 0, true);
});

test('stored compact, and a byte budget drops the oldest (a 100-command replay is ~15 KB)', () => {
  const l = createLog(1, { mapId: 5, faction: 'Ground / Powder', carry: { gold: 400 } });
  for (let i = 0; i < 100; i++) recordCommand(l, i * 40, { type: 'placeStructure', kind: 'cannon', x: 12 + (i % 20), y: 8 + (i % 10) });
  const pretty = serializeLog(l);
  const s = mem();
  storeReplay(s, 1, pretty);
  assert.ok(replayFor(s, 1).length < pretty.length * 0.6);
  assert.deepEqual(JSON.parse(replayFor(s, 1)), JSON.parse(pretty));
  assert.ok(replayBytes(s) < 20 * 1024);
  for (let i = 2; i <= 20; i++) storeReplay(s, i, pretty);
  assert.equal(replayKeys(s).length, 20);
  assert.ok(replayBytes(s) < 1024 * 1024);
  const t = mem();
  for (let i = 1; i <= 20; i++) storeReplay(t, i, pretty, { budget: 100 * 1024 });
  assert.ok(replayKeys(t).length < 20 && replayKeys(t)[0] === 20);
});
