// The outpost's buildings and defenses as sim structure defs [MM-task_mwcdvixz_2r] (TECH_PLAN::One-Battle-UX.md S2.1).
// They run through the battle's own place / build / upgrade / sell path, with the outpost's own numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURES, OUTPOST_STRUCTURES, getStructureDef, ASSUMPTIONS } from './tables.js';
import { OUTPOST_BUILDING_KINDS, outpostStructId } from './outpostStructures.js';
import { structureDef, maxTier, DEFENSE_KINDS } from './outpost.js';
import { createSim, applyCommand, stepSim, FIXED_DT } from '../sim/core.js';
import { spacingConflict } from '../sim/structures.js';
import { outpostPlacementRules } from '../outpost/placementRules.js';
import { gunCapFor } from '../outpost/model.js';
import { MAPDATA } from '../../content/maps/mapdata.js';

const rowOf = (kind) => MAPDATA.outpostStructures.find((r) => r.Kind === kind && r.Tier === 1);

const KINDS = [...OUTPOST_BUILDING_KINDS, ...DEFENSE_KINDS];

test('every outpost kind has a sim def, derived from the same workbook rows the outpost reads', () => {
  for (const kind of KINDS) {
    const def = getStructureDef(outpostStructId(kind));
    assert.equal(def.outpostKind, kind);
    assert.equal(def.hp.length, maxTier(kind), `${kind}: one tier per row`);
    let total = 0;
    for (let t = 1; t <= maxTier(kind); t++) {
      const row = structureDef(kind, t);
      total += row.cost;
      assert.equal(def.price[t - 1], row.cost, `${kind} T${t} price is the row's Cost`);
      assert.equal(def.cost[t - 1], total, `${kind} T${t} cost is the running total`);
    }
    assert.equal(def.buildTime, structureDef(kind, 1).buildSec, `${kind} builds over the row's Build_Sec`);
  }
});

test('buildings keep a one-cell lane and are not combat targets; defenses are their battle towers at outpost prices', () => {
  for (const kind of OUTPOST_BUILDING_KINDS) {
    const def = getStructureDef(outpostStructId(kind));
    assert.equal(def.spacing, 1, kind);
    assert.equal(def.targetable, false, kind);
    assert.deepEqual({ ...def.footprint }, kind === 'hub' ? { w: 3, h: 3 } : kind === 'pylon' ? { w: 1, h: 1 } : { w: 2, h: 2 }, kind);
  }
  for (const kind of DEFENSE_KINDS) {
    const def = getStructureDef(outpostStructId(kind)), tower = STRUCTURES[structureDef(kind, 1).battleStruct];
    assert.equal(def.spacing, 0, kind);
    assert.deepEqual([...def.hp], tower.hp.slice(0, maxTier(kind)), `${kind} has its tower's HP`);
    assert.equal(def.range, tower.range, `${kind} has its tower's range`);
  }
});

test('the battle catalogue is untouched: no outpost kind is in STRUCTURES (the battle build rail lists STRUCTURES)', () => {
  assert.ok(Object.keys(OUTPOST_STRUCTURES).length >= KINDS.length);
  for (const id of Object.keys(OUTPOST_STRUCTURES)) assert.ok(!(id in STRUCTURES), id);
  assert.ok(Object.keys(STRUCTURES).every((id) => !id.startsWith('OUT-')));
});

// a live sim on the classic board, rich enough to buy anything
const richSim = () => { const s = createSim(7, {}); s.economy.money = 1e6; s.economy.incomePerSec = 0; return s; };   // no passive income: money moves only by what we buy and sell
const run = (s, sec) => { for (let i = 0; i < Math.ceil(sec / FIXED_DT) + 2; i++) stepSim(s, FIXED_DT); };
const only = (s) => [...s.structures.values()][0];

test('a Power Station goes through the battle path: place, build over its Build_Sec, upgrade at its row price, sell', () => {
  const s = richSim();
  const before = s.economy.money;
  const res = applyCommand(s, { type: 'place', structId: 'OUT-power', cell: { x: 20, y: 6 } });
  assert.equal(res.ok, true, res.reason);
  const p = only(s);
  assert.equal(before - s.economy.money, structureDef('power', 1).cost, 'paid the tier-1 row price');
  run(s, Math.max(1, getStructureDef('OUT-power').buildTime));
  assert.equal(p.lifecycle, 'Complete');
  const mid = s.economy.money;
  assert.equal(applyCommand(s, { type: 'upgrade', id: p.id }).ok, true);
  assert.equal(mid - s.economy.money, structureDef('power', 2).cost, 'the upgrade costs the tier-2 row price');
  run(s, Math.max(1, getStructureDef('OUT-power').upgradeTime));
  assert.equal(p.tier, 2);
  assert.equal(applyCommand(s, { type: 'upgrade', id: p.id }).ok, false, 'no tier 3 in the data');
  const pre = s.economy.money;
  assert.equal(applyCommand(s, { type: 'sell', id: p.id }).ok, true);
  run(s, 1);
  const frac = ASSUMPTIONS.sellRefundFrac ?? 0.5;
  assert.equal(s.economy.money - pre, Math.floor((structureDef('power', 1).cost + structureDef('power', 2).cost) * frac),
    'refund = the battle share of everything invested (the outpost rule)');
});

test('two outpost buildings are refused side by side and accepted with a one-cell lane', () => {
  const s = richSim();
  assert.equal(applyCommand(s, { type: 'place', structId: 'OUT-storage', cell: { x: 20, y: 6 } }).ok, true);
  assert.equal(applyCommand(s, { type: 'place', structId: 'OUT-power', cell: { x: 22, y: 6 } }).reason, 'spacing');
  assert.equal(applyCommand(s, { type: 'place', structId: 'OUT-power', cell: { x: 23, y: 6 } }).ok, true);
  assert.equal(spacingConflict([...s.structures.values()], getStructureDef('OUT-mg'), { x: 25, y: 6 }), true, 'a gun keeps the lane too');
});

test('outpost rules run inside the shared placement: a rig needs a deposit, guns stop at the crew cap', () => {
  const s = richSim();
  s.placementRules = outpostPlacementRules({ deposits: [{ tier: 'common', x: 30, y: 6, pad: 'r1' }] }, getStructureDef);
  assert.equal(applyCommand(s, { type: 'place', structId: 'OUT-rig', cell: { x: 26, y: 6 } }).reason, 'needs a deposit');
  assert.equal(applyCommand(s, { type: 'place', structId: 'OUT-rig', cell: { x: 30, y: 6 } }).ok, true);
  const cap = gunCapFor(0);
  let placed = 0;
  for (let x = 8; placed < cap; x += 2) if (applyCommand(s, { type: 'place', structId: 'OUT-mg', cell: { x, y: 12 } }).ok) placed++;
  const refused = applyCommand(s, { type: 'place', structId: 'OUT-mg', cell: { x: 8, y: 16 } });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /crews \d+ guns/);
  assert.equal(applyCommand(s, { type: 'place', structId: 'OUT-wall', cell: { x: 8, y: 16 } }).ok, true, 'walls are not guns');
});

test('a battle with no mode rules places exactly as before', () => {
  const s = richSim();
  assert.equal(s.placementRules, undefined);
  assert.equal(applyCommand(s, { type: 'place', structId: 'STR-Cannon', cell: { x: 20, y: 6 } }).ok, true);
  assert.equal(applyCommand(s, { type: 'place', structId: 'STR-Cannon', cell: { x: 21, y: 6 } }).ok, true, 'towers still touch');
});

test('one name table for every outpost surface: sim defs, the old HUD and the away report read OUTPOST_KIND_NAME', async () => {
  const { OUTPOST_KIND_NAME } = await import('./outpostStructures.js');
  for (const kind of OUTPOST_BUILDING_KINDS) assert.equal(getStructureDef(outpostStructId(kind)).name, OUTPOST_KIND_NAME[kind], kind);
  const { readFileSync } = await import('node:fs');
  for (const f of ['../outpost/view/hudModel.js', '../outpost/view/awayReport.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /KIND_NAME = (Object\.freeze\()?\{/, `${f} keeps no copy of the names`);
  }
});

test('the outpost session view offers every buildable outpost kind on the battle rail, the hub excepted', async () => {
  const { outpostCatalogueIds } = await import('../outpost/view/sessionView.js');
  const ids = outpostCatalogueIds();
  assert.ok(!ids.includes('OUT-hub'), 'the hub is the base, never built');
  for (const kind of [...OUTPOST_BUILDING_KINDS.filter((k) => k !== 'hub'), ...DEFENSE_KINDS]) assert.ok(ids.includes(outpostStructId(kind)), kind);
  for (const id of ids) assert.ok(getStructureDef(id), id);
});

// One Battle UX S2b [MM-story_mwc9plas_2h]: the Pylon — 1×1, one tier, reach only; cost, reach and HP are workbook rows.
test('the Pylon is a one-tier 1×1 grid node with reach only, every number from its Outpost_Structures row', async () => {
  const { POWER_NODE_KINDS } = await import('./outpostStructures.js');
  const row = rowOf('pylon'), def = getStructureDef('OUT-pylon');
  assert.ok(POWER_NODE_KINDS.includes('pylon') && POWER_NODE_KINDS.includes('power'));
  assert.equal(def.name, 'Pylon');
  assert.equal(maxTier('pylon'), 1, 'one tier: no upgrade');
  assert.deepEqual({ ...def.footprint }, { w: 1, h: 1 });
  assert.equal(def.spacing, 1);
  assert.deepEqual([...def.cost], [row.Cost]);
  assert.deepEqual([...def.hp], [row.HP], 'HP is the row');
  assert.deepEqual({ ...def.power[0] }, { draw: 0, supply: 0, reach: row.Power_Reach }, 'no draw, no supply, reach from the row');
  assert.ok(row.Power_Reach > 0 && row.Cost > 0 && row.HP > 0);
  assert.deepEqual([...getStructureDef('OUT-power').hp], [1, 1], 'a building with no HP in its rows keeps hp 1');
  const { outpostCatalogueIds } = await import('../outpost/view/sessionView.js');
  assert.ok(outpostCatalogueIds().includes('OUT-pylon'), 'on the outpost build rail');
  const s = richSim();
  assert.equal(applyCommand(s, { type: 'place', structId: 'OUT-pylon', cell: { x: 20, y: 6 } }).ok, true);
  assert.equal(applyCommand(s, { type: 'place', structId: 'OUT-pylon', cell: { x: 21, y: 6 } }).reason, 'spacing', 'keeps the one-cell lane');
  run(s, def.buildTime + 1);
  const p = only(s);
  assert.equal(p.lifecycle, 'Complete');
  assert.equal(applyCommand(s, { type: 'upgrade', id: p.id }).ok, false, 'no tier 2');
});
