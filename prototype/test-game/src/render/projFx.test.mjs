// src/render/projFx.test.mjs — the authored-FX table must survive bad data and
// round-trip colors: the game reads whatever the gallery saved. node --test.
import test from 'node:test';
import assert from 'node:assert/strict';

import { fxColorToInt, fxColorToHex, normalizeFxEntry, mergeProjFx, serializeFxEntry } from './projFx.js';

test('colors round-trip between hex strings and ints', () => {
  assert.equal(fxColorToInt('#ff9a70'), 0xff9a70);
  assert.equal(fxColorToInt('FF9A70'), 0xff9a70);
  assert.equal(fxColorToInt(0x9fd4ff), 0x9fd4ff);
  assert.equal(fxColorToInt('not-a-color'), null);
  assert.equal(fxColorToHex(0x00ff00), '#00ff00');
  assert.equal(fxColorToInt(fxColorToHex(0x123456)), 0x123456);
});

test('normalize drops bad fields but keeps good ones', () => {
  const n = normalizeFxEntry({ kind: 'laser', color: '#ffd080', speed: 999, cadence: 0.55, burst: 4.4 });
  assert.deepEqual(n, { color: 0xffd080, cadence: 0.55, burst: 4 });   // bad kind + speed dropped, burst rounded
  assert.equal(normalizeFxEntry({ kind: 'nope', speed: -1 }), null);
  assert.equal(normalizeFxEntry(null), null);
  assert.deepEqual(normalizeFxEntry({ kind: 'flak' }), { kind: 'flak' });
});

test('merge: local wins field-wise over shipped, garbage tolerated', () => {
  const shipped = { 'GND-Tanks': { kind: 'shell', color: '#ffd080', speed: 15 }, 'BAD': 'nope' };
  const local = { 'GND-Tanks': { color: '#00ff00' }, 'AIR-Copters': { kind: 'tracer' } };
  const m = mergeProjFx(shipped, local);
  assert.deepEqual(m['GND-Tanks'], { kind: 'shell', color: 0x00ff00, speed: 15 });
  assert.deepEqual(m['AIR-Copters'], { kind: 'tracer' });
  assert.equal(m.BAD, undefined);
  assert.deepEqual(mergeProjFx(null, null), {});
});

test('serialize emits JSON-friendly entries (hex color)', () => {
  const s = serializeFxEntry({ kind: 'shell', color: 0xff9a70, speed: 15, size: 1, cadence: 0.6, burst: 1 });
  assert.deepEqual(s, { kind: 'shell', color: '#ff9a70', speed: 15, size: 1, cadence: 0.6, burst: 1 });
});
