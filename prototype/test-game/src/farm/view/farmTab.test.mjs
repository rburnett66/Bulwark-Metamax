// [MM-story_mwabgs3l_f] The FARM tab's model and its actions through the outpost session, on the real Verdance map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave } from '../../save/save.js';
import { referenceOutpost, confirmOnline } from '../../outpost/model.js';
import { outpostMapFromForge } from '../../outpost/outpostMap.js';
import { createSession } from '../../outpost/view/session.js';
import { FARM, growSec } from '../../data/farm.js';
import { podCount } from '../pods.js';
import { acceptFarmContract, measureCropDelivered } from '../contract.js';
import { cellRule } from '../cells.js';
import { FARM_MENU, farmMenu, farmAt, farmPanelModel, plantChoices, sellable } from './farmUi.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../../content/missions/missions.json', import.meta.url), 'utf8'));
const map = outpostMapFromForge(JSON.parse(readFileSync(new URL('../../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8')), 'ground');
const T0 = Date.UTC(2026, 10, 10, 10, 0, 0), MIN = 60_000;

/** A save with the Verdance outpost online, a Rig Mk II, the ship in orbit and F1 accepted (Farmhouse, Pod Crate). */
function farmSave() {
  const s = defaultSave();
  s.carry = { gold: 20_000, structures: [] }; s.goldBank = 20_000;
  s.capitalShips = { Verdance: { arrived: true } };
  let o = referenceOutpost('ground', { seed: 3, map, now: T0 });
  for (const b of Object.values(o.pads)) if (b.kind === 'rig') b.tier = 2;
  o = confirmOnline(o, map, T0).outpost;
  s.outposts = { ground: o }; s.outpostContracts = { ground: { step: 3, state: 'complete', since: T0 } };
  const r = acceptFarmContract(s, 'ground', { map, now: T0, cellOk: cellRule(map, o) });
  assert.ok(r.farmhouse, r.error);
  return s;
}
function memStore(s) { let cur = s; return { load: () => structuredClone(cur), update: (fn) => { const x = structuredClone(cur); fn(x); cur = x; return structuredClone(cur); } }; }
const noRaid = () => ({ result: 'held', defenses: [] });

test('the Farmhouse F1 grants stands on farm soil, off the mesa and the pads', () => {
  const s = farmSave(), o = s.outposts.ground, fh = Object.values(o.farm.buildings)[0];
  assert.equal(fh.kind, 'farmhouse');
  assert.equal(cellRule(map, o)({ x: fh.x, y: fh.y, w: fh.w, h: fh.h }), null, 'the map\'s rule accepts where it stands');
});

test('the FARM build list: plots and buildings, locked until unlocked, targets only on farm soil', () => {
  const s = farmSave(), o = s.outposts.ground;
  const items = farmMenu(o, map, { gold: 20_000, now: T0, methods: ['traditional'], cellOk: cellRule(map, o) });
  assert.deepEqual(items.map((i) => i.id), FARM_MENU.map((m) => m.id));
  const trad = items.find((i) => i.id === 'traditional'), irr = items.find((i) => i.id === 'irrigated');
  assert.ok(trad.enabled && trad.targets.length > 30, `${trad.targets.length} places for a plot`);
  assert.equal(trad.cost, FARM.Prep_Gold);
  assert.ok(irr.locked && /not unlocked/.test(irr.why));
  const rule = cellRule(map, o);
  for (const t of trad.targets.slice(0, 50)) assert.equal(rule({ x: t.cell[0], y: t.cell[1], w: 2, h: 2 }), null);
  const poor = farmMenu(o, map, { gold: 50, now: T0, methods: ['traditional'], cellOk: rule });
  assert.match(poor.find((i) => i.id === 'silo').why, /Costs 800 gold/);
});

test('the loop through the outpost session: place, prep, plant from the Pod Crate, harvest into the store, deliver, sell', () => {
  const s0 = farmSave(), store = memStore(s0);
  const ses = createSession({ store, planet: 'ground', map, catalog: CATALOG, raidHook: noRaid });
  const ctx0 = ses.ctx(T0);
  assert.deepEqual(ctx0.methods, ['traditional', 'irrigated'], 'F1 accepted: Irrigated is unlocked');
  const spot = farmMenu(ses.outpost(), map, ctx0).find((i) => i.id === 'traditional').targets[0];
  let r = ses.act({ type: 'farmPlace', what: 'plot', id: 'traditional', cell: spot.cell }, T0);
  assert.ok(r.ok, r.error);
  const plotId = r.farm.placed;
  assert.equal(r.gold, 20_000 - FARM.Prep_Gold, 'the prep is paid');
  const t1 = T0 + FARM.Prep_Sec * 1000;
  r = ses.act({ type: 'plant', plot: plotId, pick: 'loam-grain:1' }, t1);
  assert.ok(r.ok, r.error);
  assert.equal(podCount(store.load(), 'loam-grain', 1), FARM.Pod_Crate - 4, 'four pods spent');
  const t2 = t1 + growSec('loam-grain') * 1000 + MIN;
  const panel = farmPanelModel(ses.outpost(), map, { plot: plotId }, ses.ctx(t2));
  r = ses.act({ type: 'harvest', plot: plotId }, t2);
  assert.ok(r.ok, r.error);
  const sv = store.load();
  assert.equal(sv.stores.farm.ground['loam-grain'], 16, 'the crop is in the OUTPOST & FARM store');
  assert.equal(sv.inventory['loam-grain'] || 0, 0, 'never in the battle inventory');
  assert.ok(podCount(sv, 'loam-grain', 1) >= FARM.Pod_Crate - 4 + 1, 'grain gives a pod back');
  r = ses.act({ type: 'deliver', crop: 'loam-grain' }, t2 + MIN);
  assert.ok(r.ok, r.error);
  assert.equal(measureCropDelivered(store.load(), 'loam-grain'), 16);
  assert.equal(store.load().stores.farm.ground['loam-grain'] || 0, 0);
  assert.match(ses.act({ type: 'farmSell' }, t2 + 2 * MIN).error, /nothing to sell/);
  assert.ok(panel);
});

test('the panels: a prepped plot offers the pods held; a Fruited plot HARVEST; the Farmhouse HARVEST ALL, SELL and DELIVER', () => {
  const s = farmSave(), o = s.outposts.ground;
  const choices = plantChoices({ method: 'traditional' }, s.pods);
  assert.deepEqual(choices.map((c) => [c.crop, c.level]), [['loam-grain', 1]]);
  assert.deepEqual(plantChoices({ method: 'traditional' }, { 'loam-grain': { 1: 3 } }), [], 'one pod per row: four needed');
  const fhId = Object.keys(o.farm.buildings)[0];
  const fh = farmPanelModel(o, map, { farm: fhId }, { now: T0, held: { 'loam-grain': 30 }, heldTotal: 30, f1: { crop: 'loam-grain', deliver: 40 }, delivered: 16 });
  assert.equal(fh.title, 'Farmhouse');
  assert.deepEqual(fh.actions.map((a) => a.act), ['harvestAll', 'farmSell', 'deliver']);
  assert.match(fh.actions[2].label, /24\/24/);
  assert.equal(sellable({ 'loam-grain': 30, 'rootsong-seeds': 5 }).gold, 30, 'common sells at 1; rare is kept');
  const b = Object.values(o.farm.buildings)[0];
  assert.deepEqual(farmAt(o, b.x, b.y), { farm: fhId });
  assert.equal(farmAt(o, 0, 0), null);
});

test('a full store blocks HARVEST in the panel and the session; plants keep growing (owner rule 4)', () => {
  const s0 = farmSave();
  s0.stores.farm.ground = { 'loam-grain': 10_000 };
  const store = memStore(s0), ses = createSession({ store, planet: 'ground', map, catalog: CATALOG, raidHook: noRaid });
  const spot = farmMenu(ses.outpost(), map, ses.ctx(T0)).find((i) => i.id === 'traditional').targets[0];
  const plotId = ses.act({ type: 'farmPlace', what: 'plot', id: 'traditional', cell: spot.cell }, T0).farm.placed;
  const t1 = T0 + FARM.Prep_Sec * 1000;
  ses.act({ type: 'plant', plot: plotId, pick: 'loam-grain:1' }, t1);
  const t2 = t1 + growSec('loam-grain') * 1000 + MIN;
  const r = ses.act({ type: 'harvest', plot: plotId }, t2);
  assert.equal(r.ok, false);
  assert.match(r.error, /full/);
  const p = farmPanelModel(ses.live(t2).outpost, map, { plot: plotId }, { ...ses.ctx(t2), room: 0 });
  assert.equal(p.actions[0].enabled, false);
  assert.ok(p.warnings[0].text.includes('Silo full'));
});
