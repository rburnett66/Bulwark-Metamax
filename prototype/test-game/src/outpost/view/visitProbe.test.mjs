// Visit probes: raiders the player sees attack during a visit (owner 2026-11-09). visitProbe.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { referenceOutpost, powerGrids } from '../model.js';
import { outpostMapFromForge } from '../outpostMap.js';
import { probeDelay, probeUnits, startProbe, probeWear, applyProbeWear, probeDefenseHp, PROBE_FIRST_S, PROBE_GAP_S } from './visitProbe.js';
import '../../data/factions.js';

const map = outpostMapFromForge(JSON.parse(fs.readFileSync(new URL('../../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8')), 'ground');
const T0 = Date.UTC(2026, 10, 1);
const kit = (seed = 11) => referenceOutpost('ground', { seed, map, now: T0 });
const run = (o, n) => { const p = startProbe(o, n, { map, powered: [...powerGrids(o, map).powered] }); p.finish(); return p; };

test('probes come 45–75 s into a visit, then every 100–180 s, the same for the same seed', () => {
  for (const seed of [1, 11, 999]) {
    const d0 = probeDelay(seed, 0);
    assert.ok(d0 >= PROBE_FIRST_S[0] && d0 <= PROBE_FIRST_S[1], `first ${d0}`);
    for (let n = 1; n < 6; n++) { const d = probeDelay(seed, n); assert.ok(d >= PROBE_GAP_S[0] && d <= PROBE_GAP_S[1], `gap ${d}`); }
    assert.equal(probeDelay(seed, 3), probeDelay(seed, 3));
  }
});

test('a probe is the planet\'s light tank and a trooper, a second tank every other time', () => {
  assert.deepEqual(probeUnits('ground', 0), ['GND-Tanks', 'GND-Troops']);
  assert.deepEqual(probeUnits('ground', 1), ['GND-Tanks', 'GND-Troops', 'GND-Tanks']);
  for (const p of ['air', 'water', 'dark', 'greenies']) assert.ok(probeUnits(p, 0).some((u) => /-Tanks$/.test(u)), p);
});

test('a probe runs on the battle sim to an end, the same every time, and only wears the defenses', () => {
  const o = kit();
  const a = run(o, 0), b = run(o, 0);
  assert.ok(a.done);
  assert.deepEqual(probeDefenseHp(a), probeDefenseHp(b), 'deterministic');
  const wear = probeWear(o, a);
  for (const w of wear) assert.ok(w.hp < o.defenses.find((d) => d.id === w.id).hp, `${w.id} lowered`);
  const after = applyProbeWear(o, wear);
  assert.deepEqual(after.pads, o.pads, 'buildings untouched');
  assert.deepEqual(after.hopper, o.hopper, 'no ore taken');
  assert.deepEqual(after.raids, o.raids, 'not one of the outpost\'s raids');
});

test('wear is the damage dealt, taken off the defense as it stands (a repair made meanwhile still counts)', () => {
  const o = kit();
  const fake = { startHp: new Map([[o.defenses[0].id, 100]]), defenseIds: new Map([[1, o.defenses[0].id]]), state: { structures: new Map([[1, { hp: 70 }]]) } };
  const repaired = { ...o, defenses: o.defenses.map((d, i) => (i ? d : { ...d, hp: 120 })) };
  assert.deepEqual(probeWear(repaired, fake), [{ id: o.defenses[0].id, hp: 90 }]);
  assert.deepEqual(applyProbeWear(repaired, [{ id: o.defenses[0].id, hp: -5 }]).defenses[0].hp, 0);
});
