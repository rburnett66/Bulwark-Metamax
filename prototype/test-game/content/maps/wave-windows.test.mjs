// content/maps/wave-windows.test.mjs — attackSide must group spawns AWAY from the
// MAP's real base (owner: base lower-left → units from upper-right), not a fixed
// world-center. node --test.
import test from 'node:test';
import assert from 'node:assert/strict';

import { WAVE_WINDOWS, attackSide, BASE } from './wave-windows.js';

// A wide window covering most of the world, so both a west and an east base sit inside it.
const WIN = { wave: 1, w: 60, h: 28, x: 3, y: 3 };   // rect x[3-62] y[3-30]

test('center base → attack from the roomier axis end (unchanged default)', () => {
  const a = attackSide(WIN, BASE);
  assert.ok(['west', 'east', 'north', 'south', 'surround'].includes(a.side));
});

test('base on the WEST → enemies attack from the EAST (the far, roomy side)', () => {
  const a = attackSide(WIN, { x: 8, y: 16 });
  assert.equal(a.side, 'east');          // base hugs west → most room is east
  assert.deepEqual(a.dir, { x: -1, y: 0 });   // vector points from east edge toward the base
});

test('base on the EAST → enemies attack from the WEST', () => {
  const a = attackSide(WIN, { x: 58, y: 16 });
  assert.equal(a.side, 'west');
  assert.deepEqual(a.dir, { x: 1, y: 0 });
});

test('base lower-left → enemies come from the roomy side (east dominates in a 2:1 world)', () => {
  // owner's case: base lower-left. Horizontal room dominates a 64×32 world, so the far side is east;
  // the key property is that units are NOT grouped on the base's own (west/south) corner.
  const a = attackSide(WIN, { x: 8, y: 26 });
  assert.notEqual(a.side, 'west');   // never from the base's own side
  assert.notEqual(a.side, 'south');  // nor the base's own vertical end
});

test('the shipped default sequence still resolves a valid side for every wave', () => {
  for (const w of WAVE_WINDOWS) {
    const a = attackSide(w, BASE);
    assert.ok(['west', 'east', 'north', 'south', 'surround'].includes(a.side), 'wave ' + w.wave);
  }
});
