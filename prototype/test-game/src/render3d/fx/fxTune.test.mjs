// [MM-story_mvk63439_o] — the live FX tuning layer: defaults are today's look, saves are clamped and minimal, and the
// knobs actually reach the particles and the faction colours.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TUNE, defaultTune, mergeTune, diffTune, setTune, tunedFactionColor, RETICLE_DEFAULTS, hexToRgb, rgbToHex } from './fxTune.js';
import { FX_MIX, factionFxColor } from './factionFx.js';
import { createImpacts, K } from './impacts.js';

test('defaults are the shipped look; nothing saved → no diff', () => {
  const d = defaultTune();
  assert.deepEqual(d.mix, { ...FX_MIX });
  assert.deepEqual(d.reticle, { ...RETICLE_DEFAULTS });
  assert.deepEqual(diffTune(d), {});
  assert.deepEqual(diffTune(TUNE), {}, 'node has no saved tuning');
});

test('a save is clamped and only holds what changed', () => {
  const t = mergeTune({ impacts: { spark: { count: 99, size: 2 } }, mix: { fire: -1 }, reticle: { color: 'red', size: 1.5 }, faction: { DRK: '#00ff00', GND: 'nope' } });
  assert.equal(t.impacts.spark.count, 5); assert.equal(t.impacts.spark.size, 2); assert.equal(t.mix.fire, 0);
  assert.equal(t.reticle.color, RETICLE_DEFAULTS.color, 'a bad colour keeps the default'); assert.equal(t.reticle.size, 1.5);
  assert.deepEqual(t.faction, { DRK: '#00ff00' });
  assert.deepEqual(diffTune(t), { impacts: { spark: { count: 5, size: 2 } }, mix: { fire: 0 }, faction: { DRK: '#00ff00' }, reticle: { size: 1.5 } });
});

test('faction colour overrides win, and null means the classic look', () => {
  try {
    setTune({ faction: { DRK: '#ff0000', AIR: null } });
    assert.deepEqual(tunedFactionColor('DRK-Tanks'), [1, 0, 0]);
    assert.equal(tunedFactionColor('AIR-Planes'), null);
    assert.deepEqual(tunedFactionColor('GRN-Troops'), factionFxColor('GRN-Troops'), 'untouched factions keep theirs');
  } finally { setTune(defaultTune()); }
});

test('particle knobs reach the particles: double the sparks, double their size', () => {
  const run = () => { const m = createImpacts({ seed: 3 }); m.fxHit(5, 5, 1, 0); return m.particles.filter((p) => p.kind === K.SPARK); };
  const base = run();
  try {
    setTune({ impacts: { spark: { count: 2, size: 2 } } });
    const more = run();
    assert.equal(more.length, base.length * 2);
    assert.ok(Math.abs(more[0].size - base[0].size * 2) < 1e-9);
  } finally { setTune(defaultTune()); }
  assert.equal(run().length, base.length, 'back to the shipped count');
});

test('hex helpers round-trip', () => {
  assert.equal(rgbToHex(hexToRgb('#5fe0ff')), '#5fe0ff');
});
