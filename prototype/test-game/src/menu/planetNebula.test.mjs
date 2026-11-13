// Owner 2026-11-12 [MM-story_mwem2l4j_4]: "the background of each planet should also get its own subtle nebula".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planetNebula, NEBULA_ALPHA } from './planetNebula.js';
import { PLANETS } from '../data/planets.js';

test('every planet has its own nebula: three soft clouds in its colours, all different, stable per planet', () => {
  const keys = Object.keys(PLANETS);
  assert.equal(keys.length, 9);
  const all = keys.map(planetNebula);
  assert.equal(new Set(all).size, 9, 'no two planets share a sky');
  for (const [i, k] of keys.entries()) {
    assert.equal(all[i], planetNebula(k), 'the same planet always looks the same');
    assert.equal((all[i].match(/radial-gradient\(/g) || []).length, 3);
  }
  assert.equal(planetNebula('nowhere'), 'none');
});

test('subtle: no cloud is more than NEBULA_ALPHA opaque', () => {
  assert.ok(NEBULA_ALPHA <= 0.5, "a tint, not a wash");
  for (const k of Object.keys(PLANETS)) for (const a of planetNebula(k).match(/rgba\([^)]*\)/g)) assert.ok(+a.split(',')[3].replace(')', '') <= NEBULA_ALPHA + 1e-9, a);
});

test('the menu paints it under the stars on the planet screens, from the planet on screen', () => {
  const src = readFileSync(new URL('./menu.js', import.meta.url), 'utf8');
  assert.match(src, /\.bwm-root\.space \{ background:\s*var\(--nebula, none\),/);
  assert.match(src, /root\.style\.setProperty\('--nebula', planetNebula\(screen === 'survey' \? \(surveyKey \|\| targetKey\(\)\) : targetKey\(\)\)\)/);
});
