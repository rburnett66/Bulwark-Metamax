// The Resource Bay's harvesters, the Upgrade Bay and the Outpost tech (story O10 [MM-story_mw5oem5o_r]) and the
// Habitat's gun cap (story O15 [MM-story_mw6ipqj0_3]), on the real Verdance outpost map. Design
// docs/16 Bulwark MM/design/Outpost-Design.md §6, §6.1, §7; tech plan docs/tech-plan/Outpost.md "As built (O10)", "(O15)".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  referenceOutpost, confirmOnline, advance, place, upgrade, powerGrids, harvestPlan, hopperCap, hopperUnits, emptyHopper,
  surfaceFields, gunCount, gunCap, habitatTier, defenseUpgradeRefusal, upgradeDefense, harvesterCap, buyHarvester,
  raidWarning, nextRaidAt, migrateOutpost, createOutpost, setDeep, surfaceFieldGroups, fieldStock, steadyHarvest, upgradeBayShows,
  takenRects,
} from './model.js';
import { wellDefended } from './raid.js';
import { OUTPOST, structureDef, harvestRates, harvesterRate, surfaceStock, OUTPOST_TECH_IDS } from '../data/outpost.js';
import { MAPDATA } from '../../content/maps/mapdata.js';
import { HARVESTER_UNLOAD_TIME, BONUS_NERFS } from '../data/tables.js';
import { bankOutpostHarvest } from '../save/inventory.js';
import { defaultSave } from '../save/save.js';
import { acceptOutpostContract } from './contract.js';
import { createSession } from './view/session.js';
import { panelModel, hudModel } from './view/hudModel.js';
import { awayReportModel } from './view/awayReport.js';
import { map, memoryStore, T0, MIN, HOUR } from './view/fixtures.mjs';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const QUIET = { ...OUTPOST, Raid_Mean_Hours: 1e12 };
const ctx = (extra = {}) => ({ map, params: QUIET, ...extra });
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);

/** The reference outpost, online, Power Station II (room for the bays), a Resource Bay on b1 with two harvesters. */
function withBay({ harvesters = 2, power2 = true } = {}) {
  let o = referenceOutpost('ground', { seed: 5, map, now: T0 });
  o = confirmOnline(o, map, T0).outpost;
  o.firstRaidAt = null;
  if (power2) o.pads.p1.tier = 2;
  o.pads.b1 = { kind: 'resourceBay', tier: 1 };
  o.harvesters = harvesters;
  return o;
}

// ── O10: harvesters, in closed form ───────────────────────────────────────────────────────────────────────────────
test('harvesters gather the map\'s common and uncommon surface fields at the battle harvest rate', () => {
  const fields = surfaceFields(map);
  assert.ok(fields.some((f) => f.tier === 'common') && fields.some((f) => f.tier === 'uncommon'));
  assert.ok(fields.every((f) => !(map.heights[f.y * map.width + f.x] > 0)), 'off the mesa');
  const plan = harvestPlan(withBay(), map, QUIET);
  assert.deepEqual(plan.map((h) => h.tier), ['common', 'uncommon'], 'harvesters alternate the two tiers');
  // the battle's own numbers, recomputed from the workbook rows harvest.js reads
  const f = MAPDATA.factions[0], flowers = MAPDATA.resources.find((r) => r.Resource === 'Flowers' && r.Tier === 'Primary');
  const speed = f.Harvester_Base_Speed * BONUS_NERFS.harvesterSpeedMult, cap = f.Harvester_Base_Capacity;
  const h = plan[0], trip = (2 * h.dist * OUTPOST.Harvest_Route_Mult) / speed + cap / (flowers.Units_Per_Node / flowers.Harvest_Sec_Per_Node) + HARVESTER_UNLOAD_TIME;
  close(h.rate * 1000, cap / trip);
  close(harvesterRate('common', h.dist), cap / trip);
  assert.ok(harvestRates().pull.common > harvestRates().pull.uncommon, 'premium fields pull slower, as in battle');
});

// owner 2026-11-07: "Full battle rate but the spawn rate of surface resources on outpost land is 5% of the premium land
// surveyed for the tower defense mode" — a field is a finite stock (a battle field's), regrowing at 5 % of the battle rate
const BIG = { ...QUIET, Hopper_Hours: 1e6, Away_Cap_Hours: 1e6 };   // a hopper that never fills, to see the fields alone
const fieldOf = (o, h) => surfaceFieldGroups(map).find((f) => f.id === h.fieldId);

test('a field\'s stock and regrowth: a battle field\'s units, regrowing at Surface_Respawn_Mult of the battle rate', () => {
  assert.equal(OUTPOST.Surface_Respawn_Mult, 0.05);
  const st = surfaceStock(), flowers = MAPDATA.resources.find((r) => r.Resource === 'Flowers' && r.Tier === 'Primary');
  assert.equal(st.common.units, flowers.Units_Per_Node);
  close(st.common.regrow, 0.05 * flowers.Units_Per_Node / MAPDATA.globalParams.Primary_Respawn_Sec);
  const groups = surfaceFieldGroups(map);
  assert.equal(groups.reduce((a, f) => a + f.cells.length, 0), surfaceFields(map).length, 'every cell in one field');
  for (const f of groups) { close(f.cap, st[f.tier].units * f.cells.length); close(f.regrow * 1000, st[f.tier].regrow * f.cells.length); }
});

test('harvesters take a field\'s stock at the battle rate, then only what regrows', () => {
  const o = withBay(), [h] = harvestPlan(o, map, BIG), f = fieldOf(o, h);
  assert.ok(h.rate > f.regrow * 100, 'the battle rate far outruns the regrowth');
  const td = f.cap / (h.rate - f.regrow);   // the field runs dry
  const a = advance(o, T0 + td / 2, ctx({ params: BIG })).outpost;
  close(a.hopper.common, h.rate * td / 2);
  close(fieldStock(a, map, BIG)[f.id], f.cap - (h.rate - f.regrow) * td / 2);
  const later = advance(o, T0 + 5 * HOUR, ctx({ params: BIG })).outpost;
  close(later.hopper.common, f.cap + f.regrow * 5 * HOUR, 1e-9);   // the stock, then 5 h of regrowth
  close(fieldStock(later, map, BIG)[f.id], 0);
  const st = steadyHarvest(o, map, BIG);
  close(st.byTier.common, f.regrow);
});

test('the fields and the hopper are split-invariant: one advance equals 600 one-minute advances, a 72 h gap too', () => {
  for (const params of [QUIET, BIG]) {
    const one = advance(withBay(), T0 + 10 * HOUR, ctx({ params })).outpost;
    let o = withBay();
    for (let i = 1; i <= 600; i++) o = advance(o, T0 + i * MIN, ctx({ params })).outpost;
    close(o.hopper.common, one.hopper.common, 1e-9);
    close(o.hopper.uncommon, one.hopper.uncommon, 1e-9);
    const s1 = fieldStock(one, map, params), s2 = fieldStock(o, map, params);
    for (const id of Object.keys(s1)) close(s2[id], s1[id], 1e-9);
  }
  // 72 h away, in one call and in 3-hour windows (as the view's chunked open): the hopper full, the fields regrown
  const gap = advance(withBay(), T0 + 72 * HOUR, ctx()).outpost;
  let w = withBay();
  for (let t = 3; t <= 72; t += 3) w = advance(w, T0 + t * HOUR, ctx()).outpost;
  close(hopperUnits(gap), hopperCap(gap, map, QUIET));
  close(hopperUnits(w), hopperUnits(gap), 1e-9);
  assert.deepEqual(gap.fields, {}, 'every field is back to its full stock (a full field is not stored)');
  const tenDays = advance(withBay(), T0 + 240 * HOUR, ctx());
  assert.equal(tenDays.report.to, T0 + 72 * HOUR, 'the away cap still holds');
});

test('a field regrows to its full stock and no further when nobody harvests it', () => {
  const o = withBay({ harvesters: 0 }), f = surfaceFieldGroups(map).find((x) => x.tier === 'common');
  o.fields = { [f.id]: 0 };
  const half = f.cap / 2 / f.regrow;
  close(fieldStock(advance(o, T0 + half, ctx()).outpost, map)[f.id], f.cap / 2);
  const full = advance(o, T0 + 3 * (f.cap / f.regrow), ctx()).outpost;
  assert.equal(fieldStock(full, map)[f.id], f.cap);
  assert.equal(full.fields[f.id], undefined);
});

test('the hopper holds Hopper_Hours of the steady take (at least the worked fields\' stock), then the harvesters stop', () => {
  const o = withBay(), st = steadyHarvest(o, map, QUIET), cap = hopperCap(o, map, QUIET);
  const stock = harvestPlan(o, map, QUIET).reduce((a, h) => a + fieldOf(o, h).cap, 0);
  close(cap, Math.max(st.total * OUTPOST.Hopper_Hours * HOUR, stock));
  const r = advance(o, T0 + 10 * HOUR, ctx());
  close(hopperUnits(r.outpost), cap);
  assert.ok(r.report.hopperFull > T0 && r.report.hopperFull < T0 + 10 * HOUR);
  const later = advance(r.outpost, T0 + 20 * HOUR, ctx());
  close(hopperUnits(later.outpost), cap);
  assert.deepEqual(later.report.harvested, {}, 'a full hopper gathers nothing');
});

test('no Resource Bay, no harvesters, or no power: nothing is gathered (no electricity, no operation)', () => {
  assert.deepEqual(advance(withBay({ harvesters: 0 }), T0 + HOUR, ctx()).outpost.hopper, {});
  const noBay = withBay(); delete noBay.pads.b1;
  assert.deepEqual(advance(noBay, T0 + HOUR, ctx()).outpost.hopper, {});
  // Power Station I: 10 supply. The reference set + bay drew 11 while the guns drew 1 each; defenses need no power since
  // owner 2026-11-11 [MM-task_mwcutmnk_3h] (7 + 2 = 9 fits), so the hub's 2 and a Rig Mk II's 8 fill the station here
  const dark = withBay({ power2: false });
  delete dark.pads.s1; dark.pads.r1 = { ...dark.pads.r1, tier: 2 };
  assert.equal(powerGrids(dark, map).off.b1, 'supply');
  assert.deepEqual(advance(dark, T0 + HOUR, ctx()).outpost.hopper, {});
  assert.ok(hopperCap(dark, map, QUIET) > 0, 'the hopper keeps its size; only the gathering stops');
});

test('emptying the hopper banks whole units to the inventory through inventory.js, the fractions stay', () => {
  const o = advance(withBay(), T0 + HOUR + 17_123, ctx()).outpost;
  const before = { ...o.hopper };
  const e = emptyHopper(o);
  assert.equal(e.units.common, Math.floor(before.common));
  assert.equal(e.units.uncommon, Math.floor(before.uncommon));
  assert.ok(e.outpost.hopper.common < 1 && e.outpost.hopper.uncommon < 1);
  assert.deepEqual(o.hopper, before, 'pure: the outpost passed in is unchanged');
  const s = defaultSave();
  const banked = bankOutpostHarvest(s, e.units, CATALOG, 'Verdance');
  const common = CATALOG.resources.find((r) => r.planet === 'Verdance' && r.tier === 'common');
  const uncommon = CATALOG.resources.find((r) => r.planet === 'Verdance' && r.tier === 'uncommon');
  assert.deepEqual(banked, { [common.id]: e.units.common, [uncommon.id]: e.units.uncommon });
  assert.equal(s.inventory[common.id], e.units.common);
  assert.equal(s.inventoryNew[uncommon.id], e.units.uncommon, 'the inventory chip shows it as new');
});

test('opening the outpost (session.open) banks the hopper into the save\'s inventory and reports it', () => {
  const s = defaultSave();
  s.capitalShips = { Verdance: { arrived: true } };
  s.carry = { gold: 10_000, structures: [] };
  acceptOutpostContract(s, 'ground', { map, now: T0, seedSalt: 'bays' });
  s.outposts.ground = withBay();
  const store = memoryStore(s);
  const v = createSession({ store, planet: 'ground', map, catalog: CATALOG, raidHook: null, flowOpts: { allOpen: true } });
  const r = v.open(T0 + 2 * HOUR);
  const saved = store.load(), common = CATALOG.resources.find((x) => x.planet === 'Verdance' && x.tier === 'common');
  assert.ok(saved.inventory[common.id] >= 25, 'the common field\'s stock and its regrowth');
  assert.equal(r.banked[common.id], saved.inventory[common.id]);
  assert.ok(hopperUnits(saved.outposts.ground) < 2, 'the hopper is empty but for fractions');
  assert.ok(r.away.harvested.some((x) => x.name === common.name && x.banked === saved.inventory[common.id]), 'the away report lists it');
  // without the mission catalogue the hopper waits (nothing is lost)
  const store2 = memoryStore(s);
  const r2 = createSession({ store: store2, planet: 'ground', map, catalog: null, raidHook: null }).open(T0 + 2 * HOUR);
  assert.deepEqual(r2.banked, {});
  assert.ok(hopperUnits(store2.load().outposts.ground) >= 25);
});

test('the away report and the HUD show the harvest and the hopper; the bay panel the fields\' regrowth', () => {
  const r = advance(withBay(), T0 + 6 * MIN, ctx());
  const m = awayReportModel({ ...r.report, banked: {} }, 'ground', map, CATALOG);
  assert.ok(m.show && m.harvested.length === 2);
  const h = hudModel(r.outpost, map, { gold: 0 });
  assert.ok(h.hopper && h.hopper.units > 0 && h.hopper.frac > 0 && h.hopper.frac < 1);
  const p = panelModel(r.outpost, map, { pad: 'b1' }, { gold: 0 });
  assert.ok(p.stats.some(([k]) => k === 'Harvesters') && p.stats.some(([k]) => k === 'Hopper'));
  assert.deepEqual(p.stats.find(([k]) => k === 'Fields regrowing'), ['Fields regrowing', `${+(steadyHarvest(r.outpost, map).total * HOUR).toFixed(1)} / h`]);
});

test('harvester cap: 1, raised to 2 (the most) by Dock 3 only through a finished Upgrade Bay (owner 2026-11-09)', () => {
  const o = withBay({ harvesters: 1 });
  assert.deepEqual([OUTPOST.Harvester_Cap, OUTPOST.Harvester_Max], [1, 2], 'outpost land is sparse next to a survey location');
  assert.equal(harvesterCap(o, {}), 1);
  const docks = { techOwned: new Set(['dock3', 'dock4']) };
  assert.equal(harvesterCap(o, docks), 1, 'no Upgrade Bay: the tree\'s docks do not reach the outpost');
  o.pads.b2 = { kind: 'upgradeBay', tier: 1 };
  assert.equal(harvesterCap(o, { techOwned: new Set(['dock3']) }), 2);
  assert.equal(harvesterCap(o, docks), 2, 'Dock 4 adds nothing past the cap of 2');
  assert.match(buyHarvester(o, { gold: 1e9 }).error, /holds 1/);
  const b = buyHarvester(o, { gold: 1e9, ...docks });
  assert.equal(b.outpost.harvesters, 2);
  assert.equal(harvestPlan(b.outpost, map).length, 2);
  assert.match(buyHarvester(b.outpost, { gold: 1e9, ...docks }).error, /holds 2/);
});

test('migration gives an old outpost an empty hopper; a new outpost starts with one', () => {
  assert.deepEqual(createOutpost('ground', { seed: 1, map, now: T0 }).hopper, {});
  const old = withBay(); delete old.hopper;
  assert.deepEqual(migrateOutpost(old).hopper, {});
});

/** Run the clock past the defense on the Upgrade Bay (no raids). */
function finishOnBay(o) {
  const quiet = { map, raid: () => ({ result: 'held', defenses: [] }) };
  const x = structuredClone(o); x.online = false;
  const out = advance(x, x.upgrading.done + 1, quiet).outpost;
  out.online = o.online;
  return out;
}

// ── O10: the Upgrade Bay ─────────────────────────────────────────────────────────────────────────────────────────
test('defenses go past tier I only with a finished, powered Upgrade Bay, up to the tier owned in the tech tree', () => {
  const o = withBay();
  const mg = o.defenses.find((d) => d.kind === 'mg'), wall = o.defenses.find((d) => d.kind === 'wall');
  const owned = { map, techOwned: new Set(['mg2', 'cannon2']), unlocks: new Set() };
  assert.equal(defenseUpgradeRefusal(o, mg.id, owned), 'build the Upgrade Bay first');
  o.building.push({ pad: 'b2', kind: 'upgradeBay', tier: 1, done: T0 + HOUR });
  assert.equal(defenseUpgradeRefusal(o, mg.id, owned), 'build the Upgrade Bay first', 'under construction does not count');
  o.building = []; o.pads.b2 = { kind: 'upgradeBay', tier: 1 };
  assert.match(defenseUpgradeRefusal(o, mg.id, { map, techOwned: new Set(), unlocks: new Set() }), /Machine Gun T2 in the Tech Tree/);
  assert.equal(defenseUpgradeRefusal(o, mg.id, owned), null);
  // wear stays: an MG at 100 / 240 goes to tier II with the tier's extra HP added
  o.defenses.find((d) => d.id === mg.id).hp = 100;
  const sent = upgradeDefense(o, mg.id, { ...owned, gold: 1e9, now: T0 });
  assert.equal(sent.outpost.defenses.find((d) => d.id === mg.id).tier, 1, 'timed: still tier I while on the bay');
  const up = { ...sent, outpost: finishOnBay(sent.outpost) };
  const d2 = up.outpost.defenses.find((d) => d.id === mg.id);
  assert.equal(d2.tier, 2);
  assert.equal(up.cost, structureDef('mg', 2).cost);
  assert.equal(d2.hp, 100 + structureDef('mg', 2).battle.hp - structureDef('mg', 1).battle.hp);
  assert.match(defenseUpgradeRefusal(up.outpost, mg.id, owned), /Machine Gun T3/, 'tier III needs mg3 owned');
  assert.equal(defenseUpgradeRefusal(up.outpost, mg.id, { ...owned, techOwned: new Set(['mg2', 'mg3']) }), null);
  // walls: tier II is the Outpost node Reinforced Walls, still installed at the bay
  assert.match(defenseUpgradeRefusal(o, wall.id, owned), /Reinforced Walls/);
  assert.equal(defenseUpgradeRefusal(o, wall.id, { ...owned, unlocks: new Set(['reinforced_walls']) }), null);
  const wOut = finishOnBay(upgradeDefense(o, wall.id, { ...owned, unlocks: new Set(['reinforced_walls']), now: T0 }).outpost);
  const w = wOut.defenses.find((d) => d.id === wall.id);
  assert.equal(structureDef('wall', w.tier).battle.hp, 960, 'design §7: walls to tier II (960 HP)');
  assert.match(defenseUpgradeRefusal(wOut, wall.id, owned), /top tier/);
  // gold, wrecks, and a bay without power
  assert.match(defenseUpgradeRefusal(o, mg.id, { ...owned, gold: 10 }), /costs/);
  const wreck = structuredClone(o); wreck.defenses.find((d) => d.id === mg.id).hp = 0;
  assert.match(defenseUpgradeRefusal(wreck, mg.id, owned), /wreck/);
  const dark = structuredClone(o); delete dark.pads.p1;   // no station: nothing has power
  assert.ok(powerGrids(dark, map).off.b2);
  assert.match(defenseUpgradeRefusal(dark, mg.id, owned), /no power/);
  assert.ok(upgradeDefense(o, mg.id, { ...owned, gold: 10 }).error);
});

test('Outpost tech the player owns applies; a contract alone does not grant it (it makes the node buyable)', () => {
  const o = withBay();
  assert.ok(setDeep(o, 'r1', true, { unlocks: new Set() }).error);
  assert.ok(!setDeep(o, 'r1', true, { unlocks: new Set(['deep_drilling_1']) }).error);
  assert.match(upgrade(o, 's1', { gold: 1e9, now: T0, unlocks: new Set() }).error, /supply_depot/);
  assert.ok(!upgrade(o, 's1', { gold: 1e9, now: T0, unlocks: new Set(['supply_depot']) }).error);
  // the session builds the model's ctx from the save: contract-unlocked but not bought → not in `unlocks`
  const s = defaultSave();
  s.capitalShips = { Verdance: { arrived: true } };
  acceptOutpostContract(s, 'ground', { map, now: T0, seedSalt: 'tech' });
  s.questSteps = { 'QL-VER-O': 1 };
  const v = createSession({ store: memoryStore(s), planet: 'ground', map, catalog: null, raidHook: null });
  const c0 = v.ctx(T0);
  assert.ok(c0.contractUnlocks.has('deep_drilling_1') && !c0.unlocks.has('deep_drilling_1'));
  assert.ok(c0.techOwned.has('mg1') && c0.techOwned.has('cannon1'), 'the starting kit');
  s.tech.owned = { deep_drilling_1: true, cargo_shuttle_2: true, mg2: true };
  const c1 = createSession({ store: memoryStore(s), planet: 'ground', map, catalog: null, raidHook: null }).ctx(T0);
  assert.ok(c1.unlocks.has('deep_drilling_1') && c1.techOwned.has('mg2'));
  assert.equal(c1.shuttleTier, 2, 'Cargo Shuttle II: +10 % on every sale');
  assert.deepEqual([...OUTPOST_TECH_IDS].sort(), ['cargo_shuttle_2', 'deep_drilling_1', 'power_grid_2', 'reinforced_walls', 'rig_mk2', 'sensor_spire', 'supply_depot']);
});

test('the Sensor Spire shows a raid inbound 10 minutes ahead, only when owned', () => {
  let o = referenceOutpost('ground', { seed: 5, map, now: T0 });
  o = confirmOnline(o, map, T0).outpost;   // the scripted first raid: First_Raid_Sec after online
  const at = o.firstRaidAt;
  assert.equal(nextRaidAt(o, T0), at);
  assert.equal(raidWarning(o, at - 5 * MIN, { unlocks: new Set(['sensor_spire']) }), 5 * MIN);
  assert.equal(raidWarning(o, at - 5 * MIN, { unlocks: new Set() }), null);
  assert.equal(raidWarning(o, at - 30 * MIN, { unlocks: new Set(['sensor_spire']) }), null, 'too far off');
  // a scheduled raid: the same draw advance() resolves
  o.firstRaidAt = null;
  const next = nextRaidAt(o, T0 + HOUR);
  assert.ok(next > T0 + HOUR);
  const fought = [];
  advance(o, next + MIN, { map, raid: (x, r) => { fought.push(r.at); return { result: 'held', defenses: [] }; } });
  assert.equal(fought[0], next, 'the warning names the raid that comes');
});

// ── O15: the Habitat and the gun cap ─────────────────────────────────────────────────────────────────────────────
test('the hub crews 4 guns (walls do not count); place() refuses a fifth with a clear message (owner 2026-11-09)', () => {
  const o = withBay();
  assert.equal(gunCount(o), 2, 'the reference set: a Cannon and a Machine Gun (+ six walls)');
  assert.equal(gunCap(o), OUTPOST.Gun_Cap);
  assert.equal(OUTPOST.Gun_Cap, 4);
  const cells = freeCells(o, 4);
  let a = place(o, { cell: cells[0], kind: 'mg' }, { map, gold: 1e9, now: T0 });
  assert.ok(!a.error, a.error);
  a = place(a.outpost, { cell: cells[1], kind: 'cannon' }, { map, gold: 1e9, now: T0 });
  assert.ok(!a.error, a.error);
  assert.equal(gunCount(a.outpost), 4);
  const b = place(a.outpost, { cell: cells[2], kind: 'cannon' }, { map, gold: 1e9, now: T0 });
  assert.equal(b.error, 'the hub crews 4 guns: build a Habitat for more');
  assert.equal(place(a.outpost, { cell: cells[2], kind: 'mg' }, { map, gold: 1e9, now: T0 }).error, b.error);
  assert.ok(!place(a.outpost, { cell: cells[2], kind: 'wall' }, { map, gold: 1e9, now: T0 }).error, 'walls are not guns');
});

test('Habitat I / II raise the gun cap by 4 / 8 (owner 2026-11-09): one Habitat, on a free pad, bought and built, then upgraded', () => {
  let o = withBay();
  const h1 = structureDef('habitat', 1), h2 = structureDef('habitat', 2);
  assert.deepEqual([h1.cost, h1.buildSec, h2.cost, h2.buildSec, h1.draw], [3000, 600, 5000, 900, 0]);
  assert.equal(OUTPOST.Habitat_Guns_Per_Tier, 4);
  const r = place(o, { pad: 'x1', kind: 'habitat' }, { map, gold: 1e9, now: T0 });
  assert.equal(r.cost, 3000);
  o = r.outpost;
  assert.equal(gunCap(o), 4, 'under construction it crews nobody yet');
  assert.match(place(o, { pad: 'b2', kind: 'habitat' }, { map, gold: 1e9, now: T0 }).error, /has its Habitat/);
  o = advance(o, T0 + 10 * MIN, ctx()).outpost;
  assert.equal(habitatTier(o), 1);
  assert.equal(gunCap(o), 8);
  for (const c of freeCells(o, 6)) { const p = place(o, { cell: c, kind: 'mg' }, { map, gold: 1e9, now: T0 }); if (p.outpost) o = p.outpost; }
  assert.equal(gunCount(o), 8);
  assert.equal(place(o, { cell: freeCells(o, 1)[0], kind: 'mg' }, { map, gold: 1e9, now: T0 }).error, 'the Habitat crews 8 guns: upgrade it to Habitat II for more');
  const u = upgrade(o, 'x1', { map, gold: 1e9, now: T0 + 10 * MIN });
  assert.equal(u.cost, 5000);
  o = advance(u.outpost, T0 + 26 * MIN, ctx()).outpost;
  assert.equal(gunCap(o), 12);
  for (const c of freeCells(o, 4)) { const p = place(o, { cell: c, kind: 'cannon' }, { map, gold: 1e9, now: T0 }); if (p.outpost) o = p.outpost; }
  assert.equal(gunCount(o), 12);
  assert.equal(place(o, { cell: freeCells(o, 1)[0], kind: 'mg' }, { map, gold: 1e9, now: T0 }).error, 'the outpost crews at most 12 guns');
  assert.equal(powerGrids(o, map).off.x1, undefined, 'the Habitat draws no power, so the cap never moves with the grid');
});

test('the raid measurement\'s "well defended" set (starter + 1 Machine Gun) fits the hub\'s 4 guns', () => {
  const o = wellDefended(referenceOutpost('ground', { seed: 1, map, now: T0 }), map);
  assert.equal(gunCount(o), 3);
  assert.ok(gunCount(o) <= gunCap(o));
});

test('the Tech Tree on the real save: an Outpost node is locked until a contract step unlocks it, then bought for its price', async () => {
  const { techCtxFromSave, outpostTechUnlocked, createGameTechAdapter } = await import('../menu/techSave.js');
  const { TECH_BY_ID, techStatus } = await import('../data/techtree.js');
  const s = defaultSave();
  s.carry = { gold: 50_000, structures: [] };
  s.capitalShips = { Verdance: { arrived: true } };
  acceptOutpostContract(s, 'ground', { map, now: T0, seedSalt: 'tree' });
  const on = () => techCtxFromSave(s, undefined, { missionGate: true });
  assert.equal(techStatus(TECH_BY_ID.deep_drilling_1, on()), 'locked', 'contract 1 not collected yet');
  s.questSteps = { 'QL-VER-O': 1 };
  assert.deepEqual([...outpostTechUnlocked(s)].sort(), ['deep_drilling_1', 'power_grid_2', 'reinforced_walls', 'supply_depot']);
  assert.equal(techStatus(TECH_BY_ID.deep_drilling_1, on()), 'ready');
  assert.equal(techStatus(TECH_BY_ID.rig_mk2, on()), 'locked', 'contract 2');
  const save = { loadSave: () => s, buyTech: (id, price) => { s.carry.gold -= price; s.tech.owned[id] = true; s.tech.paid[id] = price; return true; }, refundTech: () => {} };
  assert.equal(createGameTechAdapter({ save, ctxOpts: { missionGate: true } }).buy('deep_drilling_1'), true);
  assert.equal(s.carry.gold, 50_000 - TECH_BY_ID.deep_drilling_1.price);
  assert.equal(CATALOG.techUnlocks.deep_drilling_1.by, 'OC-VER-1', 'the Missions workbook names the contract');
  assert.equal(CATALOG.techUnlocks.deep_drilling_1.price, TECH_BY_ID.deep_drilling_1.price);
});

function freeCells(o, n) {
  const used = new Set(o.defenses.map((d) => d.cell.join(',')));
  const out = [];
  for (let y = 0; y < map.height && out.length < n; y++) {
    for (let x = 0; x < map.width && out.length < n; x++) {
      const onPad = takenRects(o, map).some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
      if (!onPad && !used.has(`${x},${y}`) && map.heights[y * map.width + x] > 0) { out.push([x, y]); used.add(`${x},${y}`); }
    }
  }
  return out;
}

test('defense upgrades are timed: the unit sits on the Upgrade Bay, misses raids, and the bay keeps showing it', () => {
  const o = withBay(); o.pads.b2 = { kind: 'upgradeBay', tier: 1 };
  const owned = { map, techOwned: new Set(['mg2', 'cannon2']), unlocks: new Set(), gold: 1e9, now: T0 };
  const mg = o.defenses.find((d) => d.kind === 'mg'), cannon = o.defenses.find((d) => d.kind === 'cannon');
  assert.equal(upgradeBayShows(o), null, 'an idle bay that has upgraded nothing shows nothing');
  const sent = upgradeDefense(o, mg.id, owned);
  assert.equal(sent.done, T0 + structureDef('mg', 2).buildSec * 1000);
  assert.deepEqual({ ...upgradeBayShows(sent.outpost), since: undefined }, { id: mg.id, kind: 'mg', tier: 2, done: sent.done, since: undefined, working: true });
  assert.match(upgradeDefense(sent.outpost, cannon.id, owned).error, /busy with the Machine Gun/);
  assert.match(upgradeDefense(sent.outpost, mg.id, owned).error, /already on the Upgrade Bay/);
  // a raid while it is on the bay: the hook never sees it
  let seen = null;
  const hook = (out) => { seen = out.defenses.map((d) => d.id); return { result: 'held', defenses: [] }; };
  const x = structuredClone(sent.outpost); x.online = true; x.firstRaidAt = T0 + 30_000;
  const mid = advance(x, T0 + 60_000, { map, raid: hook }).outpost;
  assert.ok(seen && !seen.includes(mg.id), 'the unit on the bay does not fight');
  assert.ok(mid.upgrading, 'still on the bay');
  const after = advance(mid, sent.done + 1, { map, raid: () => ({ result: 'held', defenses: [] }) });
  assert.equal(after.outpost.upgrading, null);
  assert.equal(after.outpost.defenses.find((d) => d.id === mg.id).tier, 2);
  assert.deepEqual(after.report.built.at(-1), { defense: mg.id, kind: 'mg', tier: 2, at: sent.done });
  assert.deepEqual(upgradeBayShows(after.outpost), { kind: 'mg', tier: 2, id: mg.id, working: false });
});

test('selling a structure: half of what was invested, the hub never, a rig only once its bay is sold', async () => {
  const { sellStructure, sellStructureQuote } = await import('./model.js');
  const o = withBay(); o.pads.b2 = { kind: 'upgradeBay', tier: 1 };
  assert.match(sellStructureQuote(o, { pad: 'hub' }).error, /hub is the outpost/);
  assert.equal(sellStructureQuote(o, { pad: 'b2' }).refund, Math.floor(structureDef('upgradeBay', 1).cost * 0.5));
  const mg = o.defenses.find((d) => d.kind === 'mg'); mg.tier = 2;
  assert.equal(sellStructureQuote(o, { defense: mg.id }).refund, Math.floor((structureDef('mg', 1).cost + structureDef('mg', 2).cost) * 0.5));
  const sold = sellStructure(o, { defense: mg.id });
  assert.ok(!sold.outpost.defenses.some((d) => d.id === mg.id));
  o.storage.r1 = { [Object.keys(o.storage.r1 || {})[0] || 'iron']: 5 };
  assert.match(sellStructureQuote(o, { pad: 'r1' }).error, /sell the ore/);
  o.upgrading = { id: 'x', kind: 'mg', tier: 2, done: T0 + 1 };
  assert.match(sellStructureQuote(o, { pad: 'b2' }).error, /working/);
});
