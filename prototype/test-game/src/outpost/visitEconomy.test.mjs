// Owner playtest 2026-11-12 [MM-task_mwd2qawq_3]: "the miner is not mining, the base is acting like it is under
// powered", "the harvester is not harvesting", "I can't farm", "the resource info on the outpost is wrong - generic".
// Each test below fails on the code before the fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { map, T0, MIN, freeSpot } from './view/fixtures.mjs';
import { createOutpost, referenceOutpost, advance, powerGrids, harvestPlan, surfaceFieldGroups } from './model.js';
import { OUTPOST } from '../data/outpost.js';
import { toLiveSim, fromLiveSim, stepLiveOutpost } from './liveSim.js';
import { stepSim, applyCommand, FIXED_DT } from '../sim/core.js';
import { harvesterHold } from '../sim/harvest.js';
import { panelModel, noPowerStatus } from './view/hudModel.js';
import { outpostSelectionExtras } from './view/sessionView.js';
import { outpostResourceCard, harvesterHoldText, depositCardId } from './view/resourceCard.js';
import { resourceInfoModel, resourceInfoRows, resourceInfoHtml } from '../render/resourceInfo.js';
import { farmGate } from '../farm/contract.js';

const QUIET = { map, params: { ...OUTPOST, Raid_Mean_Hours: 1e12 } };
const bayOf = (o, pad) => Object.values(o.storage[pad] || {}).reduce((a, b) => a + b, 0);
/** Run the live state `sec` sim seconds, with the session's own clock hook every 15 ticks (sessionView afterTick). */
function run(state, link, sec) {
  for (let i = 0; i < Math.round(sec / FIXED_DT); i++) {
    stepSim(state, FIXED_DT);
    if (state.tick % 15 === 0) stepLiveOutpost(state, link);
  }
}

// ── the miner ────────────────────────────────────────────────────────────────────────────────────────────────────
test('the rigs mine DURING a visit, on the sim clock (it used to stand still until the player left or acted)', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });   // offline: mining never waits to go online
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  run(state, link, 120);
  const v = fromLiveSim(state, link, T0 + 120_000).outpost;
  const rate = 3;   // Iron, Rig I shallow: 3 / min
  assert.ok(Math.abs(bayOf(v, 'r1') - 2 * rate) < 0.2, `two minutes of mining in the bay (${bayOf(v, 'r1')})`);
});

test('a visit mines exactly what the away closed form would — never twice (the visit stretch is marked live)', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const away = advance(o, T0 + 30 * MIN, QUIET).outpost;   // never visited
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  run(state, link, 10 * 60);
  const left = fromLiveSim(state, link, T0 + 10 * MIN).outpost;
  assert.deepEqual(left.liveHarvest, { from: T0, to: T0 + 10 * MIN });
  const back = advance(left, T0 + 30 * MIN, QUIET).outpost;
  assert.ok(Math.abs(bayOf(back, 'r1') - bayOf(away, 'r1')) < 0.2, `visit + away ${bayOf(back, 'r1')} = away ${bayOf(away, 'r1')}`);
});

test('a Mining Station placed during the visit mines into its own new bay once it is finished and powered', () => {
  const o = createOutpost('ground', { seed: 7, map, now: T0 });
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 50_000 });
  const dep = map.deposits.find((d) => d.tier === 'common');
  assert.ok(applyCommand(state, { type: 'place', structId: 'OUT-power', cell: freeSpot(o, 'power') }).ok);
  assert.ok(applyCommand(state, { type: 'place', structId: 'OUT-rig', cell: { x: dep.x, y: dep.y } }).ok);
  run(state, link, 4 * 60);   // both build in 2 min, then 2 min of mining
  const v = fromLiveSim(state, link, T0 + 4 * MIN).outpost;
  const rig = Object.keys(v.pads).find((id) => v.pads[id].kind === 'rig');
  assert.ok(rig && bayOf(v, rig) > 4, `the new rig's bay fills (${rig && bayOf(v, rig)})`);
});

test('a powered rig at an offline outpost reads as mining, not "stopped" / "waiting" (offline is not unpowered)', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const m = panelModel(o, map, { pad: 'r1' }, { now: T0 });
  assert.equal(m.status, 'Mining · outpost offline');
  assert.equal(m.stats.find(([k]) => k === 'Rate')[1], '3 / min');
});

test('two stations apart: a building its grid cannot feed says the other station is not linked (add a Pylon)', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  o.pads.r1.tier = 2;   // Rig Mk II draws 8: the first station's 10 is short
  o.pads.b1 = { kind: 'resourceBay', tier: 1, at: freeSpot(o, 'resourceBay') };
  o.pads.p2 = { kind: 'power', tier: 1, at: freeSpot(o, 'power', { near: { x: 55, y: 28 } }) };
  const { off, grids } = powerGrids(o, map);
  assert.equal(grids.length, 2, 'two grids: the stations are out of each other\'s reach');
  const short = Object.keys(off).find((id) => off[id] === 'supply');
  assert.ok(short, 'something on the first grid is short');
  assert.match(noPowerStatus(o, map, short, 'supply'), /not linked \(add a Pylon\)/);
  assert.equal(panelModel(o, map, { pad: short }, { now: T0 }).status, noPowerStatus(o, map, short, 'supply'));
});

test('a building placed this visit gets its status line in the battle panel (the save ids are read live, not the arrival map)', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 50_000 });
  assert.ok(applyCommand(state, { type: 'place', structId: 'OUT-resourceBay', cell: freeSpot(o, 'resourceBay') }).ok);
  run(state, link, 6 * 60);
  const s = [...state.structures.values()].find((x) => x.structId === 'OUT-resourceBay');
  const where = new Map(), v = fromLiveSim(state, link, T0 + 6 * MIN, where).outpost;
  assert.equal(outpostSelectionExtras(s, { ids: link.ids, outpost: v, map, now: T0 }), null, 'the arrival ids do not know it');
  const r = outpostSelectionExtras(s, { ids: where, outpost: v, map, now: T0 });
  assert.equal(r.lines.length, 1);
  const SV = readFileSync(new URL('./view/sessionView.js', import.meta.url), 'utf8');
  assert.match(SV, /const where = new Map\(\), v = fromLiveSim\(sim, live\.link, nowOf\(\), where\)\.outpost;\s*return outpostSelectionExtras\(s, \{ ids: where,/);
});

test('the hub offers GO ONLINE in its own panel while the outpost is offline (the OUTPOST panel steps aside)', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  const acted = [];
  const hub = [...state.structures.values()].find((x) => x.structId === 'OUT-hub') || null;
  // the hub is the base, not a structure: its panel is the selected hub pad when it is one
  const s = hub || { id: -1 };
  const ids = hub ? link.ids : new Map([[-1, { pad: 'hub' }]]);
  const r = outpostSelectionExtras(s, { ids, outpost: o, map, now: T0, act: (a) => acted.push(a) });
  const go = r.actions.find((a) => a.label === 'GO ONLINE');
  assert.ok(go && go.enabled, 'the reference outpost can go online');
  go.run();
  assert.deepEqual(acted, [{ type: 'online' }]);
});

// ── the harvester ────────────────────────────────────────────────────────────────────────────────────────────────
function withTruck() {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  o.pads.p1.tier = 2;
  o.pads.b1 = { kind: 'resourceBay', tier: 1, at: freeSpot(o, 'resourceBay') };
  o.harvesters = 1;
  return o;
}
test('a truck on its one-cell field strips it in one load, then WAITS for regrowth — and says so', () => {
  const o = withTruck();
  const [h] = harvestPlan(o, map);
  const f = surfaceFieldGroups(map).find((g) => g.id === h.fieldId);
  assert.equal(f.cells.length, 1, 'the Verdance outpost map\'s fields are single cells (A6: resources 54 → 15)');
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  const u = state.units.get(state.harvesterIds[0]);
  assert.equal(harvesterHold(state, u), null, 'on arrival the field is full: it drives out');
  run(state, link, 4 * 60);
  assert.equal(u.state, 'harvestIdle');
  const hold = harvesterHold(state, u);
  assert.equal(hold.why, 'regrowing');
  assert.ok(hold.inSec > 60 && hold.inSec < 10 * 60, `the next unit is minutes away (${hold.inSec} s)`);
  assert.match(harvesterHoldText(hold), /^Waiting: field regrowing · next unit in \d+:\d\d$/);
});

test('a parked truck (no power at the bay) and a full hopper say why; a battle truck says nothing', () => {
  const o = withTruck();
  const { state } = toLiveSim(o, { map, now: T0, gold: 0 });
  const u = state.units.get(state.harvesterIds[0]);
  u.parked = true;
  assert.equal(harvesterHoldText(harvesterHold(state, u)), 'Parked: the Resource Bay has no power');
  u.parked = false; state.harvestRoom = 0;
  assert.match(harvesterHoldText(harvesterHold(state, u)), /^Hopper full/);
  state.harvestRoom = null; u.fieldLock = false;
  assert.equal(harvesterHold(state, u), null, 'a free (battle) truck: no hold');
  const HUD = readFileSync(new URL('../render/hud.js', import.meta.url), 'utf8');
  assert.match(HUD, /xfn\(u, state\)/, 'the harvester panel asks the mode\'s selectionExtras hook');
});

// ── the resource card ────────────────────────────────────────────────────────────────────────────────────────────
test('the resource card at the outpost shows the field\'s own numbers, not a battle contract and gold a unit', () => {
  const o = withTruck();
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 0 });
  run(state, link, 4 * 60);
  const v = fromLiveSim(state, link, T0 + 4 * MIN).outpost;
  const id = `sf:${harvestPlan(o, map)[0].field.join(',')}`;
  const battle = resourceInfoModel(state, id, 'ground');
  const battleRows = resourceInfoRows(battle).map(([k]) => k);
  assert.ok(battleRows.includes('Contract'), 'the battle card talks of the Collective contract');
  const card = outpostResourceCard(id, state, battle, { outpost: v, map, planet: 'ground' });
  const rows = Object.fromEntries(resourceInfoRows(card));
  assert.equal(card.name, 'Loam Grain', 'the planet\'s name for the resource');
  assert.ok(!('Contract' in rows) && !('Value' in rows), 'no battle gold or quota');
  assert.match(rows.Field, /of 25 left · 1 cell/);
  assert.match(rows.Regrows, /\/ h · full in/);
  assert.match(rows.Harvesters, /^1 on it · Waiting: field regrowing/);
  assert.match(resourceInfoHtml(card), /Regrows/);
});

test('an unbuilt deposit opens the same card with its ore; the battle card is unchanged without the hook', () => {
  const o = createOutpost('ground', { seed: 7, map, now: T0 });
  const card = outpostResourceCard(depositCardId('uncommon'), { resourceNodes: [] }, null, { outpost: o, map, planet: 'ground', unlockedTiers: ['common'] });
  const rows = Object.fromEntries(resourceInfoRows(card));
  assert.match(rows.Ore, /Uncommon deposit/);
  assert.match(rows.Status, /Locked/);
  assert.match(rows['Mining Station'], /^none — build one on it/);
  const m = { revealed: true, left: 5, total: 10, cells: 1, valuePerUnit: 2, contract: null, harvesters: 0, respawns: false, revealWave: 1 };
  assert.deepEqual(resourceInfoRows(m).map(([k]) => k), ['Field', 'Value', 'Harvesters'], 'a battle card: its rows as before');
  const HUD = readFileSync(new URL('../render/hud.js', import.meta.url), 'utf8');
  assert.match(HUD, /hud\.callbacks && hud\.callbacks\.resourceInfo/);
});

// ── farming ──────────────────────────────────────────────────────────────────────────────────────────────────────
test('the outpost says what opens farming, step by step, until the farm is the player\'s', () => {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const s = { outposts: { ground: o }, capitalShips: {}, tech: { owned: {} }, questSteps: {} };
  assert.equal(farmGate(s, 'ground').step, 'tech');
  assert.match(farmGate(s, 'ground').text, /Mining Station Mk II · its tech comes with outpost contract 2/);
  s.questSteps['QL-VER-O'] = 2;
  assert.equal(farmGate(s, 'ground').step, 'buy');
  s.tech.owned.rig_mk2 = true;
  assert.equal(farmGate(s, 'ground').step, 'upgrade');
  o.building.push({ pad: 'r1', kind: 'rig', tier: 2, done: T0 + 1 });
  assert.equal(farmGate(s, 'ground').step, 'upgrading');
  o.building = []; o.pads.r1.tier = 2;
  assert.equal(farmGate(s, 'ground').step, 'ship');
  s.capitalShips.Verdance = { arrived: true };
  assert.equal(farmGate(s, 'ground').step, 'factor');
  s.farmContracts = { ground: { state: 'active' } };
  assert.equal(farmGate(s, 'ground'), null);
  const SV = readFileSync(new URL('./view/sessionView.js', import.meta.url), 'utf8');
  assert.match(SV, /farmLine\.textContent = gate \? gate\.text : ''/, 'the OUTPOST panel carries the line');
});
