// The outpost view's pure parts (story O6) [MM-story_mw5oeer7_n]: HUD model and formatting, the scene plans (conduits,
// buildings, deposits, defenses) and the battle board the renderer draws. (The old view's layout / framing and SELL
// timeline went with it in S6.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hudModel, sellButton, panelModel, defenseOptions, fmtGold, fmtUnits, fmtRate, fmtClock } from './hudModel.js';
import { conduitRoute, planConduits, planBuildings, planDeposits, defenseStructures, TINT } from './conduits.js';
import { outpostBattleMap, bakedSlugOf, lowlandResources } from './outpostBoard.js';
import { referenceOutpost, confirmOnline, advance, sell, place } from '../model.js';
import { groundToNdc, clearBox } from '../../render3d/camera.js';
import { map, T0, MIN, HOUR, freeSpot } from './fixtures.mjs';

const kit = () => referenceOutpost('ground', { seed: 7, map, now: T0 });
const online = () => confirmOnline(kit(), map, T0).outpost;
const quiet = { map, raid: null };
const rigPad = (o) => Object.keys(o.pads).find((id) => o.pads[id].kind === 'rig');

// ── formatting ─────────────────────────────────────────────────────────────────────────────────────────────────
test('formatting: gold, whole units floored, rates, clocks', () => {
  assert.equal(fmtGold(950), '950');
  assert.equal(fmtGold(12_400), '12,400');
  assert.equal(fmtGold(1_250_000), '1.25M');
  assert.equal(fmtGold(12_000_000), '12M');
  assert.equal(fmtUnits(14.999999), '14');
  assert.equal(fmtUnits(15 - 1e-12), '15');
  assert.equal(fmtRate(3), '3 / min');
  assert.equal(fmtRate(0.75), '0.75 / min');
  assert.equal(fmtClock(299.2), '5:00');
  assert.equal(fmtClock(3723), '1:02:03');
});

// ── the HUD ────────────────────────────────────────────────────────────────────────────────────────────────────
test('the HUD model: the kit offline, then running — ores, storage fill, power, shield, loads', () => {
  const off = hudModel(kit(), map, { gold: 500 });
  assert.equal(off.online, false);
  assert.deepEqual(off.problems, []);
  assert.deepEqual(sellButton(off), { label: 'SELL', sub: 'outpost offline', enabled: false });
  // 9 of 10 while the guns drew 1 each; defenses need no power since owner 2026-11-11 [MM-task_mwcutmnk_3h]
  assert.deepEqual([off.power.draw, off.power.supply], [7, 10], 'the kit draws 7 of the first station\'s 10: its buildings only (design §4.5)');
  const o = advance(online(), T0 + HOUR, quiet).outpost;
  const h = hudModel(o, map, { gold: 500 });
  assert.deepEqual(h.ores.map((x) => [x.id, Math.round(x.units)]), [['iron', 180]]);
  assert.equal(h.loads, 12);
  assert.deepEqual(sellButton(h), { label: 'SELL', sub: '12 loads', enabled: true });
  assert.ok(Math.abs(h.storage.frac - 0.25) < 1e-9, 'one hour of a 4-hour bay');
  assert.equal(h.shield.frac, 1);
  assert.equal(h.shield.worn, false);
  o.defenses[0].hp /= 2;
  const w = hudModel(o, map, { gold: 0 });
  assert.equal(w.shield.worn, true);
  assert.ok(w.repairCost > 0);
});

test('the rig panel: ore, rate, bay; the deep switch locked until Deep Drilling I; upgrade needs Rig Mk II', () => {
  const o = advance(online(), T0 + HOUR, quiet).outpost, pad = rigPad(o);
  const p = panelModel(o, map, { pad }, { now: T0 + HOUR, gold: 50_000, unlocks: new Set() });
  assert.match(p.title, /Auger Drill I/);
  assert.equal(p.status, 'Online');
  assert.deepEqual(p.stats.find(([k]) => k === 'Rate'), ['Rate', '3 / min']);
  assert.equal(p.deep.enabled, false);
  assert.match(p.deep.note, /Deep Drilling I/);
  assert.equal(p.upgrade.enabled, false);
  assert.match(p.upgrade.why, /rig mk2/);
  const q = panelModel(o, map, { pad }, { now: T0 + HOUR, gold: 50_000, unlocks: new Set(['deep_drilling_1', 'rig_mk2']) });
  assert.equal(q.deep.enabled, true);
  assert.equal(q.upgrade.enabled, true);
  assert.match(q.upgrade.label, /UPGRADE TO II · 8,000/);
});

test('S2c.2: no empty pads to build on — a panel is for a building or a defense; the defense prices for BUILD', () => {
  const o = online();
  assert.equal(panelModel(o, map, { pad: 'nothing-here' }, { gold: 10_000 }), null, 'no building there: no panel');
  const r = panelModel(o, map, { pad: rigPad(o) }, { gold: 10_000, unlockedTiers: ['common'] });
  assert.ok(r && !r.empty && r.kind === 'rig');
  assert.deepEqual(defenseOptions({ gold: 1000 }).map((d) => [d.kind, d.enabled]), [['mg', true], ['cannon', false], ['wall', true]]);
  const d = panelModel(o, map, { defense: o.defenses[0].id }, { gold: 0 });
  assert.equal(d.status, 'Ready');
  assert.equal(d.repair, null);
});

// ── layout and framing ─────────────────────────────────────────────────────────────────────────────────────────
test('conduit routes leave the station\'s edge and arrive at the building\'s edge', () => {
  const a = { x: 0, y: 0, w: 4, h: 4 }, b = { x: 10, y: 6, w: 4, h: 4 };
  const r = conduitRoute(a, b);
  assert.deepEqual(r.points[0], [4, 2]);
  assert.deepEqual(r.points[r.points.length - 1], [12, 6]);
  assert.equal(r.points.length, 3, 'one right-angle bend');
  assert.equal(r.length, 8 + 4);
  const straight = conduitRoute(a, { x: 8, y: 0, w: 4, h: 4 });
  assert.deepEqual(straight.points, [[4, 2], [8, 2]]);
});

test('conduits: only to built pads, from a station, lit only when the outpost runs and the building is powered', () => {
  const off = planConduits(kit(), map);
  assert.ok(off.length >= 3);
  assert.ok(off.every((c) => kit().pads[c.from].kind === 'power'));
  assert.ok(off.every((c) => !c.powered), 'dark until online');
  const on = planConduits(online(), map);
  assert.ok(on.every((c) => c.powered));
  assert.ok(on.every((c) => c.to && (online().pads[c.to] || online().building.some((j) => j.pad === c.to))), 'conduits only to buildings');
});

test('building states: a build rises in four steps with a cool tint; rigs work only when running and not full', () => {
  let o = online();
  const bay = 'f1';
  o = place(o, { pad: bay, kind: 'harvesterBay', at: freeSpot(o, 'resourceBay') }, { map, now: T0, gold: 1e9, unlockedTiers: ['common'] }).outpost;
  const b0 = planBuildings(o, map, T0).find((b) => b.pad === bay);
  assert.equal(b0.building, true);
  assert.deepEqual(b0.tint, TINT.building);
  assert.equal(b0.rise, 0.3);
  const b1 = planBuildings(o, map, T0 + 299_000).find((b) => b.pad === bay);
  assert.ok(Math.abs(b1.rise - 0.9) < 1e-9);
  const rig = planBuildings(o, map, T0).find((b) => b.kind === 'rig');
  assert.equal(rig.working, true);
  assert.equal(rig.rigHead, 'auger');
  assert.equal(planBuildings(kit(), map, T0).find((b) => b.kind === 'rig').working, false, 'offline: idle, lights dim');
  const full = advance(online(), T0 + 5 * HOUR, quiet).outpost;
  assert.equal(planBuildings(full, map, full.t).find((b) => b.kind === 'rig').working, false, 'a full bay stops its rig');
  assert.equal(planBuildings(full, map, full.t).find((b) => b.kind === 'storage').fill, 1);
});

test('deposits: one per tier in its ore colour, locked until unlocked, marked mined under a rig', () => {
  const d = planDeposits(online(), map, ['common']);
  assert.deepEqual(d.map((x) => x.tier).sort(), ['common', 'rare', 'uncommon']);
  assert.deepEqual(d.filter((x) => x.locked).map((x) => x.tier).sort(), ['rare', 'uncommon']);
  assert.equal(d.find((x) => x.tier === 'common').mined, true);
  assert.equal(d.find((x) => x.tier === 'common').colour, '#8a4b32');
});

test('defenses become the battle renderer\'s System structures (STR-MG, Cannon, Wall), worn when hurt', () => {
  const o = online();
  o.defenses[0].hp = 10;
  const s = defenseStructures(o);
  assert.equal(s.length, o.defenses.length);
  const byKind = Object.fromEntries(o.defenses.map((d, i) => [d.kind, s[i]]));
  assert.equal(byKind.mg.structId, 'STR-MG');
  assert.equal(byKind.cannon.structId, 'STR-Cannon');
  assert.equal(byKind.wall.kind, 'wall');
  assert.equal(s[0].lifecycle, 'Damaged');
});

// ── the battle board ───────────────────────────────────────────────────────────────────────────────────────────
test('the outpost map becomes a battle board (no waves, no fog) with its base on the hub, and keeps its size', () => {
  const b = outpostBattleMap(map);
  assert.equal(b.cols, map.width);
  assert.equal(b.rows, map.height);
  assert.deepEqual(b.waveWindows, []);
  assert.equal(b.openPlay, false);
  const hub = map.hub;
  assert.ok(b.base.x >= hub.x && b.base.x < hub.x + hub.w && b.base.y >= hub.y && b.base.y < hub.y + hub.h);
  assert.equal(bakedSlugOf(map), 'ground-outpost');
  const res = lowlandResources(map);
  assert.ok(res.every((r) => !(map.heights[r.y * map.width + r.x] > 0)), 'no resource field on the mesa');
});
