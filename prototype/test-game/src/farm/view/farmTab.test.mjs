// [MM-story_mwabgs3l_f] The FARM tab's model and its actions through the outpost session, on the real Verdance map.
// S6 [MM-story_mwc9q1y6_2n]: the FARM tab is the shared battle rail's (farm/farmRail.js); places come from its ground rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave } from '../../save/save.js';
import { referenceOutpost, confirmOnline } from '../../outpost/model.js';
import { outpostMapFromForge } from '../../outpost/outpostMap.js';
import { createSession } from '../../outpost/view/session.js';
import { FARM, growSec, yieldOf } from '../../data/farm.js';
import { podCount } from '../pods.js';
import { acceptFarmContract, measureCropDelivered } from '../contract.js';
import { cellRule } from '../cells.js';
import { farmPanelModel, plantChoices, sellable, farmRailGlyph } from './farmUi.js';
import { farmRailIds, farmRailLocks, farmRefusal, farmThingAt, farmRailLabel } from '../farmRail.js';
import { getStructureDef } from '../../data/tables.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../../content/missions/missions.json', import.meta.url), 'utf8'));
const map = outpostMapFromForge(JSON.parse(readFileSync(new URL('../../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8')), 'ground');
const T0 = Date.UTC(2026, 10, 10, 10, 0, 0), MIN = 60_000;

/** A save with the Verdance outpost online, a Rig Mk II, the ship in orbit and F1 accepted (Farmhouse, Pod Crate). */
function farmSave() {
  const s = defaultSave();
  s.carry = { gold: 20_000, structures: [] }; s.goldBank = 20_000;
  s.capitalShips = { Verdance: { arrived: true } };
  s.planetMaps = { ...(s.planetMaps || {}), Verdance: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, { beaten: true }])) };   // Verdance finished: farming opens (owner 2026-11-12)
  let o = referenceOutpost('ground', { seed: 3, map, now: T0 });
  for (const b of Object.values(o.pads)) if (b.kind === 'rig' || b.kind === 'power') b.tier = 2;   // a Rig II draws 8: it needs Power Station II [MM-story_mwcp7u7b_3a]
  o = confirmOnline(o, map, T0).outpost;
  s.outposts = { ground: o }; s.outpostContracts = { ground: { step: 3, state: 'complete', since: T0 } };
  const r = acceptFarmContract(s, 'ground', { map, now: T0, cellOk: cellRule(map, o) });
  assert.ok(r.farmhouse, r.error);
  return s;
}
function memStore(s) { let cur = s; return { load: () => structuredClone(cur), update: (fn) => { const x = structuredClone(cur); fn(x); cur = x; return structuredClone(cur); } }; }
const noRaid = () => ({ result: 'held', defenses: [] });
/** The places a FARM item can take now (the shared placement's farm rule, farmRail.js), top-left cells, row by row. */
function farmSpots(o, ctx, id = 'FARM-traditional') {
  const def = getStructureDef(id), out = [];
  for (let y = 0; y + def.footprint.h <= map.height; y++) for (let x = 0; x + def.footprint.w <= map.width; x++) {
    if (farmRefusal(o, map, def, { x, y }, { now: ctx.now ?? T0, cellOk: ctx.cellOk }) === null) out.push({ cell: [x, y] });
  }
  return out;
}

test('the Farmhouse F1 grants stands on farm soil, off the mesa and the pads', () => {
  const s = farmSave(), o = s.outposts.ground, fh = Object.values(o.farm.buildings)[0];
  assert.equal(fh.kind, 'farmhouse');
  assert.equal(cellRule(map, o)({ x: fh.x, y: fh.y, w: fh.w, h: fh.h }), null, 'the map\'s rule accepts where it stands');
});

test('the FARM tab: plots, the Silo and Pump, the planet\'s crops; locks for what is not unlocked; places only on farm soil', () => {
  const s0 = farmSave(), o = s0.outposts.ground;
  const ids = farmRailIds(s0, 'ground');
  assert.deepEqual(ids.slice(0, 4), ['FARM-traditional', 'FARM-irrigated', 'FARM-silo', 'FARM-pump']);
  const crops = ids.filter((id) => id.startsWith('FARM-crop-'));
  assert.ok(crops.includes('FARM-crop-loam-grain') && crops.length >= 4, 'the planet\'s own crops');
  for (const id of ids) { assert.ok(getStructureDef(id), id); assert.ok(farmRailGlyph(id), `${id} has a rail picture`); }
  assert.equal(getStructureDef('FARM-traditional').cost[0], FARM.Prep_Gold);
  assert.equal(getStructureDef('FARM-silo').cost[0], 800);
  const locks = farmRailLocks(s0, { methods: ['traditional'] }, ids);
  assert.match(locks['FARM-irrigated'], /not unlocked/);
  assert.equal(locks['FARM-traditional'], undefined);
  assert.equal(locks['FARM-crop-loam-grain'], undefined, 'the Pod Crate\'s crop can be planted');
  assert.ok(Object.keys(locks).some((k) => k.startsWith('FARM-crop-') && /seed pods/.test(locks[k])), 'a crop without pods says why');
  const rule = cellRule(map, o), spots = farmSpots(o, { cellOk: rule });
  assert.ok(spots.length > 30, `${spots.length} places for a plot`);
  for (const t of spots.slice(0, 50)) assert.equal(rule({ x: t.cell[0], y: t.cell[1], w: 2, h: 2 }), null);
  // an outpost building is refused on the farm's ground; a crop needs a prepped plot
  const fh = Object.values(o.farm.buildings)[0];
  assert.match(farmRefusal(o, map, getStructureDef('OUT-power'), { x: fh.x, y: fh.y }), /farm building/);
  assert.match(farmRefusal(o, map, getStructureDef('FARM-crop-loam-grain'), { x: 0, y: 0 }), /prepped plot/);
});

test('the loop through the outpost session: place, prep, plant from the Pod Crate, harvest into the store, deliver, sell', () => {
  const s0 = farmSave(), store = memStore(s0);
  const ses = createSession({ store, planet: 'ground', map, catalog: CATALOG, raidHook: noRaid });
  const ctx0 = ses.ctx(T0);
  assert.deepEqual(ctx0.methods, ['traditional', 'irrigated'], 'F1 accepted: Irrigated is unlocked');
  const spot = farmSpots(ses.outpost(), ctx0)[0];
  let r = ses.act({ type: 'farmPlace', what: 'plot', id: 'traditional', cell: spot.cell }, T0);
  assert.ok(r.ok, r.error);
  const plotId = r.farm.placed;
  assert.equal(r.gold, 20_000 - FARM.Prep_Gold, 'the prep is paid');
  const t1 = T0 + FARM.Prep_Sec * 1000;
  r = ses.act({ type: 'plant', plot: plotId, pick: 'loam-grain' }, t1);
  assert.ok(r.ok, r.error);
  const planted = Math.min(FARM.Pod_Crate, FARM.Pods_Per_Plot), units = Math.floor(yieldOf('loam-grain', 'traditional', 1) * planted / FARM.Pods_Per_Plot);
  assert.equal(podCount(store.load(), 'loam-grain'), FARM.Pod_Crate - planted, 'one pod per plant spent (owner 2026-11-12)');
  assert.equal(r.farm.level, 1, 'no crop level bought yet: level 1');
  const t2 = t1 + growSec('loam-grain') * 1000 + MIN;
  const panel = farmPanelModel(ses.outpost(), map, { plot: plotId }, ses.ctx(t2));
  r = ses.act({ type: 'harvest', plot: plotId }, t2);
  assert.ok(r.ok, r.error);
  // which plot was harvested, how, at what level and cycle (the ember effect, farm/view/embers.js) [MM-story_mwabh2oc_j]
  assert.deepEqual(r.farm.plots, [{ plot: plotId, kind: 'crop', level: 1, cycle: 1 }]);
  const sv = store.load();
  assert.equal(sv.stores.farm.ground['loam-grain'], units, 'the crop is in the OUTPOST & FARM store (a plot as full as its pods)');
  assert.equal(sv.inventory['loam-grain'] || 0, 0, 'never in the battle inventory');
  assert.ok(podCount(sv, 'loam-grain') >= FARM.Pod_Crate - planted + 1, 'grain gives a pod back');
  r = ses.act({ type: 'deliver', crop: 'loam-grain' }, t2 + MIN);
  assert.ok(r.ok, r.error);
  assert.equal(measureCropDelivered(store.load(), 'loam-grain'), units);
  assert.equal(store.load().stores.farm.ground['loam-grain'] || 0, 0);
  assert.match(ses.act({ type: 'farmSell' }, t2 + 2 * MIN).error, /nothing to sell/);
  assert.ok(panel);
});

test('the panels: a prepped plot offers the pods held; a Fruited plot HARVEST; the Farmhouse HARVEST ALL, SELL and DELIVER', () => {
  const s = farmSave(), o = s.outposts.ground;
  const plot = { x: 0, y: 0, w: 2, h: 2, method: 'traditional' };
  const choices = plantChoices(o, map, plot, s.pods);
  assert.deepEqual(choices.map((c) => [c.crop, c.level, c.n]), [['loam-grain', 1, FARM.Pod_Crate]]);
  assert.deepEqual(plantChoices(o, map, plot, {}), [], 'no pods: nothing to plant');
  assert.deepEqual(plantChoices(o, map, plot, { 'loam-grain': 3 }).map((c) => c.n), [3], '1 pod = 1 plant: 3 pods plant 3');
  assert.deepEqual(plantChoices(o, map, plot, { 'loam-grain': 40 }).map((c) => c.n), [16], 'a plot takes 16 at most');
  const fhId = Object.keys(o.farm.buildings)[0];
  const fh = farmPanelModel(o, map, { farm: fhId }, { now: T0, held: { 'loam-grain': 30 }, heldTotal: 30, f1: { crop: 'loam-grain', deliver: 40 }, delivered: 16 });
  assert.equal(fh.title, 'Farmhouse');
  assert.deepEqual(fh.actions.map((a) => a.act), ['harvestAll', 'farmSell', 'deliver']);
  assert.match(fh.actions[2].label, /24\/24/);
  assert.equal(sellable({ 'loam-grain': 30, 'rootsong-seeds': 5 }).gold, 30, 'common sells at 1; rare is kept');
  const b = Object.values(o.farm.buildings)[0];
  assert.deepEqual(farmThingAt(o, b.x, b.y), { farm: fhId });
  assert.equal(farmThingAt(o, 0, 0), null);
});

test('a full store blocks HARVEST in the panel and the session; plants keep growing (owner rule 4)', () => {
  const s0 = farmSave();
  s0.stores.farm.ground = { 'loam-grain': 10_000 };
  const store = memStore(s0), ses = createSession({ store, planet: 'ground', map, catalog: CATALOG, raidHook: noRaid });
  const spot = farmSpots(ses.outpost(), ses.ctx(T0))[0];
  const plotId = ses.act({ type: 'farmPlace', what: 'plot', id: 'traditional', cell: spot.cell }, T0).farm.placed;
  const t1 = T0 + FARM.Prep_Sec * 1000;
  ses.act({ type: 'plant', plot: plotId, pick: 'loam-grain' }, t1);
  const t2 = t1 + growSec('loam-grain') * 1000 + MIN;
  const r = ses.act({ type: 'harvest', plot: plotId }, t2);
  assert.equal(r.ok, false);
  assert.match(r.error, /full/);
  const p = farmPanelModel(ses.live(t2).outpost, map, { plot: plotId }, { ...ses.ctx(t2), room: 0 });
  assert.equal(p.actions[0].enabled, false);
  assert.ok(p.warnings[0].text.includes('Silo full'));
});

// ── owner rule 9 (2026-11-10) [MM-story_mwai5f8t_1g]: crop levels from the tech tree; pods have no level ─────────────
test('PLANT grows at the crop\'s tech level; a plot keeps its level when the tree is upgraded later', () => {
  const s0 = farmSave();
  s0.pods = { ...s0.pods, 'loam-grain': 40 };   // two plots' worth (1 pod = 1 plant, 16 a plot)
  s0.tech.owned.crop_loam_grain_2 = true;
  const store = memStore(s0), ses = createSession({ store, planet: 'ground', map, catalog: CATALOG, raidHook: noRaid });
  assert.equal(ses.ctx(T0).levels['loam-grain'], 2, 'the session hands the FARM tab every crop\'s level');
  const targets = farmSpots(ses.outpost(), ses.ctx(T0));
  const a = ses.act({ type: 'farmPlace', what: 'plot', id: 'traditional', cell: targets[0].cell }, T0).farm.placed;
  const t1 = T0 + FARM.Prep_Sec * 1000;
  const p1 = ses.act({ type: 'plant', plot: a, pick: 'loam-grain' }, t1);
  assert.ok(p1.ok, p1.error);
  assert.equal(p1.farm.level, 2);
  assert.equal(ses.outpost().farm.plots[a].level, 2);
  store.update((sv) => { sv.tech.owned.crop_loam_grain_3 = true; sv.tech.owned.crop_loam_grain_4 = true; });   // upgraded on the tech tree
  const spot = farmSpots(ses.live(t1).outpost, ses.ctx(t1))[0];
  const b = ses.act({ type: 'farmPlace', what: 'plot', id: 'traditional', cell: spot.cell }, t1).farm.placed;
  const t2 = t1 + FARM.Prep_Sec * 1000;
  const panel = farmPanelModel(ses.live(t2).outpost, map, { plot: b }, ses.ctx(t2));
  const btn = panel.actions.find((x) => x.act === 'plant');
  assert.equal(btn.arg, 'loam-grain');
  assert.equal(btn.level, 4);
  assert.match(btn.label, /PLANT Loam Grain · L4 Epic · \d+ pods/);
  assert.equal(btn.colour, '#b25cff', 'the level\'s colour');
  assert.ok(ses.act({ type: 'plant', plot: b, pick: 'loam-grain' }, t2).ok);
  const o = ses.outpost();
  assert.equal(o.farm.plots[b].level, 4, 'new plantings grow at the new level');
  assert.equal(o.farm.plots[a].level, 2, 'the plot already growing keeps level 2');
  const shown = farmPanelModel(o, map, { plot: a }, ses.ctx(t2));
  assert.deepEqual(shown.stats.find((x) => x[0] === 'Level'), ['Level', '2 · Uncommon']);
  assert.equal(store.load().pods['loam-grain'], 40 - 2 * FARM.Pods_Per_Plot, 'a plain count, one per plant, 16 a full plot');
});

test('PLANT on a Traditional plot shows the level-5 cap and why', () => {
  const s = farmSave(), o = s.outposts.ground;
  const plot = { x: 0, y: 0, w: 2, h: 2, method: 'traditional' };
  const [ch] = plantChoices(o, map, plot, s.pods, { 'loam-grain': 5 });
  assert.deepEqual([ch.techLevel, ch.level, ch.capped, ch.why], [5, 4, true, 'level 5 needs irrigation']);
  assert.equal(ch.levelName, 'Epic');
  // the panel's PLANT button says the level the plot will grow at and why it is capped
  const s0 = farmSave();
  for (const L of [2, 3, 4, 5]) s0.tech.owned['crop_loam_grain_' + L] = true;
  const store = memStore(s0), ses = createSession({ store, planet: 'ground', map, catalog: CATALOG, raidHook: noRaid });
  const spot = farmSpots(ses.outpost(), ses.ctx(T0))[0];
  const id = ses.act({ type: 'farmPlace', what: 'plot', id: 'traditional', cell: spot.cell }, T0).farm.placed;
  const t1 = T0 + FARM.Prep_Sec * 1000;
  const panel = farmPanelModel(ses.live(t1).outpost, map, { plot: id }, ses.ctx(t1));
  const btn = panel.actions.find((x) => x.act === 'plant');
  assert.equal(btn.label, `PLANT Loam Grain · L4 Epic (L5 needs irrigation) · ${FARM.Pod_Crate} pods`);
  assert.equal(btn.why, 'Level 4: level 5 needs irrigation');
  assert.equal(panel.note, 'Level 4 — level 5 needs irrigation.');
  const r = ses.act({ type: 'plant', plot: id, pick: 'loam-grain' }, t1);
  assert.deepEqual([r.farm.level, r.farm.capped], [4, 'level 5 needs irrigation']);
});


// [MM-task_mwcztxf9_2] owner 2026-11-11: "on the rail for seed pods you should show the quantity"
test('a FARM-tab crop button shows the seed pods held (never chest progress); planting takes them off at once', () => {
  assert.deepEqual(farmRailLabel('FARM-crop-loam-grain', { 'loam-grain': 8 }), { text: '8 pods', title: 'Loam Grain: 8 seed pods held · a plot plants up to 16, one per pod' });
  assert.equal(farmRailLabel('FARM-crop-loam-grain', { 'loam-grain': 1 }).text, '1 pod');
  assert.equal(farmRailLabel('FARM-crop-loam-grain', {}).text, '0 pods');
  assert.equal(farmRailLabel('FARM-traditional', { 'loam-grain': 8 }), null, 'plots and buildings keep their gold price');
  assert.equal(farmRailLabel('OUT-power', {}), null);
  assert.doesNotMatch(farmRailLabel('FARM-crop-loam-grain', { 'loam-grain': 8 }).title, /chest|next|reward/i, 'no chest progress');
  // the label reads the save context's pods, which a planting changes (the session re-reads it after each action)
  const s0 = farmSave(), store = memStore(s0);
  const ses = createSession({ store, planet: 'ground', map, catalog: CATALOG, raidHook: noRaid });
  const before = farmRailLabel('FARM-crop-loam-grain', ses.ctx(T0).pods).text;
  const spot = farmSpots(ses.outpost(), ses.ctx(T0))[0];
  assert.ok(ses.act({ type: 'farmPlace', what: 'plot', id: 'traditional', cell: spot.cell }, T0).ok);
  const ready = T0 + (FARM.Prep_Sec + 1) * 1000;
  const id = Object.keys(ses.outpost().farm.plots).pop();
  assert.ok(ses.act({ type: 'plant', plot: id, pick: 'loam-grain' }, ready).ok);
  const after = farmRailLabel('FARM-crop-loam-grain', ses.ctx(ready).pods).text;
  assert.equal(+before.split(' ')[0] - Math.min(+before.split(' ')[0], FARM.Pods_Per_Plot), +after.split(' ')[0], `${before} → ${after}`);
});

test('the shared rail count hook is generic and optional: battles set none, so their price labels are untouched', () => {
  const hud = readFileSync(new URL('../../render/hud.js', import.meta.url), 'utf8');
  assert.match(hud, /const railLabel = hud\.callbacks && typeof hud\.callbacks\.railLabel === 'function' \? hud\.callbacks\.railLabel : null;/);
  assert.match(hud, /if \(railLabel\) \{/);
  const main = readFileSync(new URL('../../main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /railLabel/, 'the battle never sets it');
  assert.match(readFileSync(new URL('../../outpost/view/sessionView.js', import.meta.url), 'utf8'), /railLabel: \(id\) => farmRailLabel\(id, ctxNow\(\)\.pods\),/);
});
