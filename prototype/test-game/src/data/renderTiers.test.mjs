// node --test src/data/renderTiers.test.mjs — CI gate for the Voxel Rendering Tiers contract (spec §5/§7).
// Fails the build if any unit type lacks an explicit render_tier, or if any Tier C type's wave data
// could put more than MAX_LIVE_3D instances on screen at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, SYSTEM_UNITS, WAVES, makeWaves } from './tables.js';
import { validateRenderTiers, maxSimultaneous, MAX_LIVE_3D, RENDER_TIERS } from './renderTiers.js';

const FACTIONS = [...new Set(Object.values(UNITS).map((u) => u.faction))];
const ALL_WAVE_SETS = [WAVES, ...FACTIONS.map((f) => makeWaves(f))];

test('every unit type sets render_tier explicitly', () => {
  for (const id in UNITS) {
    assert.ok(RENDER_TIERS.has(UNITS[id].render_tier),
      `unit "${id}" must set render_tier to one of A|B|C (got ${JSON.stringify(UNITS[id].render_tier)})`);
  }
});

// SYSTEM_UNITS WAS OUTSIDE THIS GATE. getUnitDef resolves `UNITS[id] || SYSTEM_UNITS[id]` (tables.js:1109),
// so these 13 are real, spawnable unit defs — the harvester among them — and renderer.js reads render_tier
// off whatever getUnitDef returns. The gate imported UNITS only, covering 73 of 91 defs, so a SYS-* unit
// shipped without a tier failed nothing here while the runtime silently defaulted it to Tier A.
// All 13 already carry a valid tier, so this closes the hole at zero cost — it is a gate that was missing,
// not a break being fixed.
test('every SYSTEM unit sets render_tier explicitly', () => {
  for (const id in SYSTEM_UNITS) {
    assert.ok(RENDER_TIERS.has(SYSTEM_UNITS[id].render_tier),
      `system unit "${id}" must set render_tier to one of A|B|C (got ${JSON.stringify(SYSTEM_UNITS[id].render_tier)})`);
  }
});

// STRUCTURES (5 defs) are DELIBERATELY not gated here, and this note exists so the omission reads as a
// decision rather than the same oversight repeating. All five have render_tier: undefined today. They do
// not spawn from wave data, so MAX_LIVE_3D — the thing this gate protects — cannot be exceeded by them.
// If structures ever render as live 3D, they need tiers and this test needs a sibling. Owner's call;
// tracked in the FFF audit epic.

test('tier contract validates over the real unit table + every wave set', () => {
  const v = validateRenderTiers(UNITS, ALL_WAVE_SETS);
  assert.deepEqual(v.errors, []);
  assert.ok(v.ok);
});

test('Tier C types never appear in generated bulk waves', () => {
  for (const waves of ALL_WAVE_SETS) {
    for (const w of waves) for (const s of w.spawns) {
      assert.notEqual(UNITS[s.unitId].render_tier, 'C',
        `Tier C unit "${s.unitId}" appears in bulk wave ${w.wave} (${w.faction})`);
    }
  }
});

test('the heavy bomber is Tier C and inside the cap', () => {
  assert.equal(UNITS['AIR-HeavyBomber'].render_tier, 'C');
  for (const waves of ALL_WAVE_SETS) {
    assert.ok(maxSimultaneous('AIR-HeavyBomber', waves) <= MAX_LIVE_3D);
  }
});

test('validation FAILS a Tier C type whose waves exceed the cap', () => {
  const units = { Boss: { render_tier: 'C' } };
  const waves = [{ wave: 1, spawns: [{ unitId: 'Boss', count: MAX_LIVE_3D + 1 }] }];
  const v = validateRenderTiers(units, [waves]);
  assert.equal(v.ok, false);
  assert.match(v.errors[0], /MAX_LIVE_3D/);
});

test('validation FAILS a unit with no explicit tier', () => {
  const v = validateRenderTiers({ Untagged: { domain: 'Walker' } }, []);
  assert.equal(v.ok, false);
  assert.match(v.errors[0], /render_tier/);
});
