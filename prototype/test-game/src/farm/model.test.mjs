// [MM-story_mwabgeyj_a] The farm model: a layer on the outpost (owner rule 7), growing inside the outpost's advance().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { referenceOutpost, advance, powerGrids, buildingRect } from '../outpost/model.js';
import { DRAFT_LAYOUT as map } from '../outpost/draftLayout.js';
import { FARM, yieldOf, growSec } from '../data/farm.js';
import { TERRAIN } from '../terrain/terrainGen.js';
import { getStructureDef } from '../data/tables.js';
import {
  ensureFarm, occupied, plotState, placePlot, prep, plant, harvest, harvestAll, placeFarmBuilding, storeCapacity,
  outputPerHour, farmStatus, farmReportLines, walkwayHit, plantLevel, plotPlants, plotYield,
} from './model.js';
import * as MODEL from './model.js';

const T0 = Date.UTC(2026, 10, 10, 8, 0, 0), MIN = 60_000, H = 3_600_000;
const base = () => referenceOutpost('ground', { seed: 7, map, now: T0 });
// free 2 × 2 spots on the draft layout, away from pads and defenses
function freeSpots(o, n, w = 2, h = 2) {
  const taken = occupied(o, map), out = [];
  for (let y = 0; y + h <= map.height && out.length < n; y += h) {
    for (let x = 0; x + w <= map.width && out.length < n; x += w) {
      const r = { x, y, w, h }, g = { x: x - 1, y: y - 1, w: w + 2, h: h + 2 };   // the 1-cell walkway between farm things
      const farmThing = (t) => !t.what || /^(plot|farmhouse|silo|pump) /.test(t.what);
      const hit = (q, t) => q.x < t.x + t.w && t.x < q.x + q.w && q.y < t.y + t.h && t.y < q.y + q.h;
      if (!taken.some((t) => hit(farmThing(t) ? g : r, t))) { out.push(r); taken.push(r); }
    }
  }
  return out;
}
const go = (o, t) => advance(o, t, { map }).outpost;
/**
 * The reference grid one short of a Pump: the kit drew 9 of its station's 10 while its guns drew 1 each; defenses need
 * no power since owner 2026-11-11 [MM-task_mwcutmnk_3h], so the kit draws 7 and a Resource Bay (2, served before a
 * Pump) in the station's reach takes it to 9 — the Pump's 2 no longer fits. → a copy of `o`.
 */
function shortGrid(o) {
  const fp = getStructureDef('OUT-resourceBay').footprint;
  const at = nearPower(o, fp.w, fp.h);
  return { ...o, pads: { ...o.pads, b9: { kind: 'resourceBay', tier: 1, at: { x: at.x, y: at.y, w: fp.w, h: fp.h } } } };
}
/** A free spot within the reference outpost's Power Station reach (so a farm building on it is powered). */
function nearPower(o, w, h, near = null) {
  const pw = buildingRect(o, map, Object.keys(o.pads).find((id) => o.pads[id].kind === 'power'));
  const c = [pw.x + pw.w / 2, pw.y + pw.h / 2];
  return freeSpots(o, 400, w, h).filter((r) => Math.hypot(r.x + w / 2 - c[0], r.y + h / 2 - c[1]) <= 8)
    .sort((a, b) => (near ? Math.hypot(a.x - near.x, a.y - near.y) - Math.hypot(b.x - near.x, b.y - near.y) : 0))[0];
}
/** Is a 1 × 1 spot within the kit station's power reach (the station stands where outpost/siting.js puts it)? */
function inStationReach(o, c) {
  const pw = buildingRect(o, map, Object.keys(o.pads).find((k) => o.pads[k].kind === 'power'));
  return Math.hypot(c.x + 0.5 - (pw.x + pw.w / 2), c.y + 0.5 - (pw.y + pw.h / 2)) <= 9;
}
/** A plot placed and prepped, the outpost advanced to planting time. → { o, id } */
function prepped(method = 'traditional') {
  let o = base();
  const s = method === 'irrigated' ? nearPower(o, 2, 2) : freeSpots(o, 1)[0];
  const r = placePlot(o, { ...s, method }, { map, now: T0, methods: ['traditional', 'irrigated'] });
  o = go(r.outpost, T0 + FARM.Prep_Sec * 1000);
  return { o, id: r.plot };
}
/** A plot placed, prepped and planted with Loam Grain at tech level `level`, the outpost advanced to planting time. */
function planted(level = 1, method = 'traditional') {
  const { o } = prepped(method);
  const r = plant(o, Object.keys(o.farm.plots)[0], { crop: 'loam-grain', level }, { now: o.t, podsHeld: 16, map });
  return { o: r.outpost, id: Object.keys(r.outpost.farm.plots)[0], t: o.t, r };
}

test('the farm lives inside the outpost record and has no clock of its own (owner rule 7)', () => {
  const o = base();
  assert.equal(o.farm, undefined, 'an outpost without farming has no farm');
  const f = ensureFarm(structuredClone(o));
  assert.deepEqual(Object.keys(f).sort(), ['buildings', 'next', 'plots'], 'no t, no seed, no raids: the outpost has those');
  const src = readFileSync(new URL('./model.js', import.meta.url), 'utf8') + readFileSync(new URL('./grow.js', import.meta.url), 'utf8');
  assert.ok(!/Date\.now|Math\.random/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), 'no wall clock or unseeded random in the farm model');
});

test('a plot: prep, plant, the four stages, Fruited, then Dead at the end of its window', () => {
  const { o, id, t } = planted(1);
  const g = growSec('loam-grain') * 1000;
  assert.equal(plotState(o, o.farm.plots[id]), 'planted');
  const at = (k) => { const x = go(o, t + k * g); return plotState(x, x.farm.plots[id]); };
  assert.deepEqual([0.05, 0.2, 0.5, 0.99, 1.01, 1.99, 2.01].map(at), ['planted', 'sprout', 'plant', 'plant', 'fruited', 'fruited', 'dead']);
});

test('advancing once over 72 hours equals advancing in steps (one clock: the outpost\'s)', () => {
  const { o, t } = planted(2);
  const once = go(o, t + 72 * H);
  let stepped = o;
  for (let k = 1; k <= 72 * 4; k++) stepped = go(stepped, t + k * 15 * MIN);
  const a = Object.values(once.farm.plots)[0], b = Object.values(stepped.farm.plots)[0];
  assert.equal(a.progress, b.progress);
  assert.ok(Math.abs(a.ripeAt - b.ripeAt) < 1, `ripeAt ${a.ripeAt} vs ${b.ripeAt}`);
  assert.equal(plotState(once, a), plotState(stepped, b));
});

test('harvest at Fruited: the crop and its units by level, grain pods back, the plot left to prep again', () => {
  const { o, id, t } = planted(3);
  const ripe = go(o, t + growSec('loam-grain') * 1000 + MIN);
  const r = harvest(ripe, id, { map, held: 0 });
  assert.equal(r.kind, 'crop');
  assert.equal(r.crop, 'loam-grain');
  assert.equal(r.units, yieldOf('loam-grain', 'traditional', 3));
  assert.equal(r.level, 3, 'the plot\'s level, for the harvest effect');
  assert.ok(r.pods.some((p) => p.crop === 'loam-grain' && p.n >= 1), 'grain gives some pods back');
  assert.ok(r.pods.every((p) => !('level' in p) && !p.lucky), 'pods come back as a plain count: no level, no lucky roll (owner rule 9)');
  assert.equal(plotState(r.outpost, r.outpost.farm.plots[id]), 'harvested');
  assert.equal(plotState(ripe, ripe.farm.plots[id]), 'fruited', 'the outpost passed in is unchanged');
  const again = prep(r.outpost, id, { now: r.outpost.t, gold: 0 });
  assert.ok(again.outpost && again.cost === 0, 'prepping again is free (owner 2026-11-13)');
});

// Owner 2026-11-13 [MM-story_mwf605xu_2]: "DONT CHARGE FOR PLANTING .. the user paid for the seeds by fighting for
// resources. Charge for dropping the plot, do not charge for prep. Seeds plant once."
test('the plot is the farm’s one gold charge: placing costs Plot_Gold, prep and planting cost no gold', () => {
  assert.equal(FARM.Plot_Gold, 100);
  assert.equal(FARM.Prep_Gold, 0);
  const o = base(), s = freeSpots(o, 1)[0];
  assert.match(placePlot(o, s, { map, now: T0, gold: FARM.Plot_Gold - 1 }).error, /costs 100 gold/);
  const r = placePlot(o, s, { map, now: T0, gold: FARM.Plot_Gold });
  assert.equal(r.cost, FARM.Plot_Gold);
  assert.ok(r.outpost.farm.plots[r.plot].prepDone > T0, 'the first prep still takes its time');
  const ready = go(r.outpost, T0 + FARM.Prep_Sec * 1000);
  const pl = plant(ready, r.plot, { crop: 'loam-grain', level: 1 }, { now: ready.t, podsHeld: 7, map, gold: 0 });
  assert.ok(pl.outpost, 'planting with no gold');
  assert.ok(!pl.cost, 'planting charges no gold');
  assert.equal(pl.outpost.farm.plots[r.plot].plants, 7, 'each pod plants once: 7 pods, 7 plants');
});

test('Dead gives the same pods back (crop, count) and needs no Silo room', () => {
  const { o, id, t } = planted(4);
  const dead = go(o, t + 3 * growSec('loam-grain') * 1000);
  assert.equal(plotState(dead, dead.farm.plots[id]), 'dead');
  const r = harvest(dead, id, { map, held: 1e9 });
  assert.equal(r.kind, 'pods');
  assert.deepEqual(r.pods, [{ crop: 'loam-grain', n: 16 }], 'every pod planted comes back');
  assert.equal(r.level, 4);
  assert.equal(r.units, 0);
});

test('a full Silo blocks HARVEST; the plant keeps growing and dies at the end of its window (owner, 2026-11-10)', () => {
  const { o, id, t } = planted(1);
  const ripe = go(o, t + growSec('loam-grain') * 1000 + MIN);
  const cap = storeCapacity(ripe, map);
  const r = harvest(ripe, id, { map, held: cap });
  assert.equal(r.error, 'the Silo is full');
  assert.ok(r.full);
  assert.ok(farmStatus(ripe, map, { held: cap }).siloFull);
  const later = go(ripe, t + 3 * growSec('loam-grain') * 1000);
  assert.equal(plotState(later, later.farm.plots[id]), 'dead', 'growth was never stopped');
  assert.equal(harvest(later, id, { map, held: cap }).kind, 'pods', 'the pods still come back');
});

test('the Silo: a finished, powered Silo holds Silo_Hours of output; without one the Farmhouse holds Farmhouse_Store_Hours', () => {
  let { o, t } = planted(1);
  const out = outputPerHour(o);
  assert.equal(out, 16 / 2, 'one Loam Grain plot: 16 units over 2 hours');
  assert.equal(storeCapacity(o, map), Math.max(Math.ceil(FARM.Farmhouse_Store_Hours * out), 16));
  const s = nearPower(o, 2, 2);
  const b = placeFarmBuilding(o, { kind: 'silo', ...s }, { map, now: t, gold: 1e9 });
  assert.equal(b.cost, 800);
  o = go(b.outpost, t + 10 * MIN);
  const g = powerGrids(o, map);
  assert.ok(g.powered.has(b.id), 'the Silo is a consumer on the outpost\'s own grid');
  assert.equal(storeCapacity(o, map), Math.ceil(FARM.Silo_Hours * out));
  // owner 2026-11-13 [MM-story_mwf8bjo0_4]: "I built a second silo, and it filled immediately" / "silo capacity should be
  // doubled" — a second powered Silo holds as much again
  const s2 = nearPower(o, 2, 2);
  const b2 = placeFarmBuilding(o, { kind: 'silo', ...s2 }, { map, now: o.t, gold: 1e9 });
  assert.ok(b2.outpost, String(b2.error));
  const building = b2.outpost;
  assert.equal(storeCapacity(building, map), Math.ceil(FARM.Silo_Hours * out), 'not until it is finished');
  o = go(building, o.t + 10 * MIN);
  assert.ok(powerGrids(o, map).powered.has(b2.id), 'the second Silo is powered');
  assert.equal(storeCapacity(o, map), Math.ceil(2 * FARM.Silo_Hours * out), 'two Silos hold twice one');
});

test('Irrigated grows 1.5× with water in reach: a powered Pump or a natural water cell; without water it grows as Traditional', () => {
  const { o, id, t } = planted(1, 'irrigated');
  const g = growSec('loam-grain') * 1000;
  const dry = go(o, t + g / 1.5 + MIN);
  assert.equal(plotState(dry, dry.farm.plots[id]), 'plant', 'no water: Traditional speed');
  const plot = o.farm.plots[id];
  const pumpAt = freeSpots(o, 600, 1, 1).find((c) => Math.hypot(c.x + 0.5 - (plot.x + 1), c.y + 0.5 - (plot.y + 1)) <= 3 && inStationReach(o, c));
  const p = placeFarmBuilding(o, { kind: 'pump', ...pumpAt }, { map, now: t - 2 * MIN, gold: 1e9 });
  // the reference outpost's Power Station I nearly drawn (shortGrid: 9 of 10): the Pump is last in priority, so it is off
  p.outpost = shortGrid(p.outpost);
  const short = go(p.outpost, t + g / 1.5 + MIN);
  assert.equal(powerGrids(short, map).off[p.id], 'supply');
  assert.equal(plotState(short, short.farm.plots[id]), 'plant', 'an unpowered Pump gives no water');
  const grid2 = structuredClone(p.outpost);
  for (const b of Object.values(grid2.pads)) if (b.kind === 'power') b.tier = 2;
  const wet = go(grid2, t + g / 1.5 + MIN);
  assert.equal(plotState(wet, wet.farm.plots[id]), 'fruited', 'a powered Pump in reach');
  // natural water: a map with a water cell beside the plot
  const terrain = new Array(map.width * map.height).fill(TERRAIN.GRASS);
  terrain[(plot.y + 2) * map.width + plot.x] = TERRAIN.WATER;
  const lake = advance(o, t + g / 1.5 + MIN, { map: { ...map, terrain } }).outpost;
  assert.equal(plotState(lake, lake.farm.plots[id]), 'fruited', 'natural water in reach');
});

test('placing: refusals for taken ground, locked methods, gold, and the map rule passed in', () => {
  const o = base();
  const pad = map.hub;
  assert.match(placePlot(o, { x: pad.x, y: pad.y }, { map, now: T0 }).error, /taken/);
  const [s] = freeSpots(o, 1);
  assert.match(placePlot(o, { ...s, method: 'irrigated' }, { map, now: T0 }).error, /not unlocked/);
  assert.match(placePlot(o, s, { map, now: T0, gold: 50 }).error, /costs 100 gold/);
  assert.equal(placePlot(o, s, { map, now: T0, cellOk: () => 'not soil' }).error, 'not soil');
  const ok = placePlot(o, s, { map, now: T0, gold: 100 });
  assert.equal(ok.cost, 100);
  assert.match(placePlot(ok.outpost, s, { map, now: T0 }).error, /plot p1/);
  assert.match(placeFarmBuilding(o, { kind: 'farmhouse', ...s }, { map, now: T0 }).error, /farming contract/);
  const fh = placeFarmBuilding(o, { kind: 'farmhouse', ...s }, { map, now: T0, grant: true });
  assert.equal(fh.cost, 0);
  const [s2] = freeSpots(fh.outpost, 1);
  assert.match(placeFarmBuilding(fh.outpost, { kind: 'farmhouse', ...s2 }, { map, now: T0, grant: true }).error, /has its Farmhouse/);
});

test('plant needs a prepped plot and a pod: one pod per plant, up to 16 (owner 2026-11-12: 7 pods → 7 plants)', () => {
  let o = base();
  const [s] = freeSpots(o, 1);
  const r = placePlot(o, s, { map, now: T0 });
  assert.match(plant(r.outpost, r.plot, { crop: 'loam-grain', level: 1 }, { now: T0, podsHeld: 16 }).error, /not prepped/);
  o = go(r.outpost, T0 + FARM.Prep_Sec * 1000);
  assert.match(plant(o, r.plot, { crop: 'loam-grain', level: 1 }, { now: o.t, podsHeld: 0 }).error, /needs a seed pod/);
  const seven = plant(o, r.plot, { crop: 'loam-grain', level: 1 }, { now: o.t, podsHeld: 7 });
  assert.deepEqual(seven.spend, { crop: 'loam-grain', n: 7 }, 'only the 7 held are spent');
  const q = seven.outpost.farm.plots[r.plot];
  assert.equal(plotPlants(q), 7, '7 plants');
  assert.equal(plotYield(q), yieldOf('loam-grain', 'traditional', q.level) * 7 / 16, 'a 7/16-full plot yields 7/16');
  assert.deepEqual(plant(o, r.plot, { crop: 'loam-grain', level: 1 }, { now: o.t, podsHeld: 40 }).spend, { crop: 'loam-grain', n: 16 }, 'a full plot takes 16');
  assert.equal(plotPlants({ method: 'traditional' }), 16, 'a plot planted before this (no plants count) is full');
});

test('HARVEST ALL takes every Fruited and Dead plot and lists what the Silo had no room for', () => {
  let o = base();
  const spots = freeSpots(o, 3);
  for (const s of spots) o = placePlot(o, s, { map, now: T0 }).outpost;
  o = go(o, T0 + FARM.Prep_Sec * 1000);
  for (const id of Object.keys(o.farm.plots)) o = plant(o, id, { crop: 'loam-grain', level: 1 }, { now: o.t, podsHeld: 16 }).outpost;
  o = go(o, o.t + growSec('loam-grain') * 1000 + MIN);
  const cap = storeCapacity(o, map);
  const r = harvestAll(o, { map, held: cap - 20 });
  assert.equal(r.results.length, 1, 'one plot of 16 fits in the room left');
  assert.equal(r.blocked.length, 2);
  assert.equal(harvestAll(o, { map, held: 0 }).results.length, Math.min(3, Math.floor(cap / 16)));
});

test('the away report names what ripened and died; the lucky roll is gone (owner rule 9)', () => {
  const { o, t } = planted(1);
  const { report } = advance(o, t + 3 * growSec('loam-grain') * 1000, { map });
  assert.deepEqual(farmReportLines(report), ['1 plot fruited', '1 plant died']);
  assert.equal(MODEL.luckyRoll, undefined);
});

// ── owner rule 9 (2026-11-10) [MM-story_mwai5f8t_1g]: a plot grows at its crop's tech level and keeps it ─────────────
test('a plot stores the level it was planted at; the next planting reads the level the tech tree has then', () => {
  const { r, o, id } = planted(2);
  assert.equal(r.level, 2);
  assert.equal(o.farm.plots[id].level, 2);
  const later = go(o, o.t + 3 * growSec('loam-grain') * 1000);
  assert.equal(later.farm.plots[id].level, 2, 'growing does not touch the level');
  const h = harvest(later, id, { map, held: 0 });
  assert.equal(h.outpost.farm.plots[id].level, null, 'harvested: the plot holds no crop and no level');
  const again = go(prep(h.outpost, id, { now: h.outpost.t, gold: 1e9 }).outpost, h.outpost.t + FARM.Prep_Sec * 1000 + MIN);
  assert.equal(plant(again, id, { crop: 'loam-grain', level: 4 }, { now: again.t, podsHeld: 16, map }).outpost.farm.plots[id].level, 4,
    'upgraded since: the new planting grows at 4');
  assert.match(plant(again, id, { crop: 'loam-grain', level: 6 }, { now: again.t, podsHeld: 16, map }).error, /crop level/);
});

test('level 5 needs a trick: a Traditional plot grows a level-5 crop at 4; an Irrigated plot reaches 5 only with water', () => {
  const trad = planted(5);
  assert.deepEqual([trad.r.level, trad.r.capped, trad.r.why], [4, true, 'level 5 needs irrigation']);
  assert.equal(trad.o.farm.plots[trad.id].level, 4);
  assert.equal(yieldOf('loam-grain', 'traditional', trad.o.farm.plots[trad.id].level), yieldOf('loam-grain', 'traditional', 4));

  const dry = planted(5, 'irrigated');
  assert.equal(dry.r.level, 4, 'an Irrigated plot with no water in reach');
  assert.match(dry.r.why, /level 5 needs water/);

  // natural water: a water cell beside the plot
  const { o, id } = prepped('irrigated');
  const plot = o.farm.plots[id];
  const terrain = new Array(map.width * map.height).fill(TERRAIN.GRASS);
  terrain[(plot.y + 2) * map.width + plot.x] = TERRAIN.WATER;
  const lake = { ...map, terrain };
  assert.deepEqual(plantLevel(o, lake, plot, 5), { level: 5, capped: false, why: null });
  const wet = plant(o, id, { crop: 'loam-grain', level: 5 }, { now: o.t, podsHeld: 16, map: lake });
  assert.deepEqual([wet.level, wet.capped], [5, false]);
  assert.equal(wet.outpost.farm.plots[id].level, 5);
  assert.equal(plantLevel(o, map, plot, 5).level, 4, 'the same plot on the dry map');
  assert.equal(plantLevel(o, lake, plot, 3).level, 3, 'below 5 the method never matters');

  // a finished, powered Pump in reach is water too
  const pumpAt = freeSpots(o, 600, 1, 1).find((c) => Math.hypot(c.x + 0.5 - (plot.x + 1), c.y + 0.5 - (plot.y + 1)) <= 3 && inStationReach(o, c));
  const p = placeFarmBuilding(o, { kind: 'pump', ...pumpAt }, { map, now: o.t - 2 * MIN, gold: 1e9 });
  p.outpost = shortGrid(p.outpost);                        // the Pump off on Power Station I (see shortGrid)
  const grid2 = structuredClone(p.outpost);
  for (const b of Object.values(grid2.pads)) if (b.kind === 'power') b.tier = 2;
  const pumped = go(grid2, o.t + 2 * MIN);
  assert.equal(plantLevel(pumped, map, pumped.farm.plots[id], 5).level, 5, 'a powered Pump in reach');
  assert.equal(plantLevel(go(p.outpost, o.t + 2 * MIN), map, plot, 5).level, 4, 'an unpowered Pump gives no water');
});

test('walkways: a plot keeps one clear cell from every other farm thing (owner 2026-11-10, room for the agrobots)', () => {
  let o = base();
  const [sp] = freeSpots(o, 1);
  o = placePlot(o, sp, { map, now: T0 }).outpost;
  const id = Object.keys(o.farm.plots)[0];
  assert.deepEqual(walkwayHit(o, { x: sp.x + 2, y: sp.y, w: 2, h: 2 }), { what: 'plot ' + id });       // edge to edge
  assert.deepEqual(walkwayHit(o, { x: sp.x + 2, y: sp.y + 2, w: 2, h: 2 }), { what: 'plot ' + id });   // corner to corner
  assert.equal(walkwayHit(o, { x: sp.x + 3, y: sp.y, w: 2, h: 2 }), null);                             // one cell between
  assert.equal(walkwayHit(o, { x: sp.x + 2, y: sp.y, w: 2, h: 2 }, 0), null);                          // the gap is data
  // placing touching it is refused (by the walkway, unless that ground is taken or off the map anyway)
  for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
    const r = placePlot(o, { x: sp.x + dx, y: sp.y + dy }, { map, now: T0 });
    assert.match(r.error || '', /walkway|taken|off the map/, `touching at ${dx},${dy}`);
  }
});
