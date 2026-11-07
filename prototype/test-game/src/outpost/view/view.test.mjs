// The outpost view's pure parts (story O6) [MM-story_mw5oeer7_n]: HUD model and formatting, layout and framing,
// the SELL timeline from sell()'s per-load entries, the scene plans (conduits, buildings, deposits, defenses) and the
// battle board the renderer draws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hudModel, sellButton, panelModel, defenseOptions, emptyPads, fmtGold, fmtUnits, fmtRate, fmtClock } from './hudModel.js';
import { layoutFor, framedCamera, frameRect, padsRect, focusCamera, VIEW_YAW } from './layout.js';
import { sellTimeline, SELL, MAX_POPS, popColour } from './sellTimeline.js';
import { conduitRoute, planConduits, planBuildings, planDeposits, defenseStructures, TINT } from './conduits.js';
import { outpostBattleMap, bakedSlugOf, lowlandResources } from './outpostBoard.js';
import { referenceOutpost, confirmOnline, advance, sell, place } from '../model.js';
import { groundToNdc, clearBox } from '../../render3d/camera.js';
import { map, T0, MIN, HOUR } from './fixtures.mjs';

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
  assert.deepEqual([off.power.draw, off.power.supply], [9, 10], 'the kit draws 9 of the first station\'s 10 (design §4.5)');
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

test('an empty pad lists what it can take; a locked deposit says so; defenses and empty pads for BUILD', () => {
  const o = online();
  const rare = map.deposits.find((d) => d.tier === 'rare').pad;
  const p = panelModel(o, map, { pad: rare }, { gold: 10_000, unlockedTiers: ['common'] });
  assert.equal(p.empty, true);
  assert.match(p.status, /Locked/);
  assert.equal(p.build[0].kind, 'rig');
  assert.equal(p.build[0].enabled, false);
  const bay = map.pads.find((x) => x.role === 'bay');
  const b = panelModel(o, map, { pad: bay.id }, { gold: 3000, unlockedTiers: ['common'] });
  assert.deepEqual(b.build.map((x) => [x.kind, x.enabled]), [['resourceBay', true], ['upgradeBay', false], ['habitat', true]]);   // the Harvester Bay is the Resource Bay (O16)
  assert.deepEqual(defenseOptions({ gold: 1000 }).map((d) => [d.kind, d.enabled]), [['mg', true], ['cannon', false], ['wall', true]]);
  const empty = emptyPads(o, map);
  assert.equal(empty.length, map.pads.length - 4);
  assert.ok(empty.every((x, i) => i === 0 || !empty[i - 1].remote || x.remote), 'mesa pads first');
  const d = panelModel(o, map, { defense: o.defenses[0].id }, { gold: 0 });
  assert.equal(d.status, 'Ready');
  assert.equal(d.repair, null);
});

// ── layout and framing ─────────────────────────────────────────────────────────────────────────────────────────
test('layouts: phone portrait, phone landscape, desktop', () => {
  assert.equal(layoutFor(390, 844).mode, 'portrait');
  assert.equal(layoutFor(844, 390).mode, 'landscape');
  assert.equal(layoutFor(1280, 800).mode, 'desktop');
  assert.equal(layoutFor(800, 1280).mode, 'portrait');
  assert.ok(layoutFor(844, 390).insets.right > 0, 'landscape keeps the action column clear');
});

test('the mesa frames inside the clear part of the screen in every layout (tech plan §6.1, §6.6)', () => {
  for (const [w, h] of [[390, 844], [844, 390], [1280, 800], [1920, 1080]]) {
    const L = layoutFor(w, h), cam = framedCamera(map, w, h), box = clearBox(w, h, L.insets), R = cam.rect;
    if (L.mode !== 'portrait') assert.deepEqual(R, frameRect(map), `${w}×${h} frames the whole mesa`);
    else assert.ok([padsRect(map, 1), padsRect(map, 0)].some((x) => JSON.stringify(x) === JSON.stringify(R)), 'portrait frames the mesa\'s buildings (the pitch is fixed, the distance capped)');
    assert.equal(cam.yaw, VIEW_YAW);
    for (const [x, z] of [[R.x0, R.z0], [R.x1, R.z0], [R.x0, R.z1], [R.x1, R.z1]]) {
      const p = groundToNdc(cam, w / h, x, z);
      assert.ok(p && p.x >= box.x0 - 1e-6 && p.x <= box.x1 + 1e-6 && p.y >= box.y0 - 1e-6 && p.y <= box.y1 + 1e-6, `${w}×${h}: corner ${x},${z} on screen`);
    }
  }
  // portrait: the mesa fills the width (design: the mesa must frame on a 390 × 844 phone)
  const cam = framedCamera(map, 390, 844), R = cam.rect;
  const a = groundToNdc(cam, 390 / 844, R.x0, (R.z0 + R.z1) / 2), b = groundToNdc(cam, 390 / 844, R.x1, (R.z0 + R.z1) / 2);
  assert.ok(b.x - a.x > 1.3, 'the buildings span most of a portrait phone\'s width');
  const hub = map.pads.find((p) => p.role === 'hub');
  const f = focusCamera(hub, VIEW_YAW, layoutFor(390, 844));
  assert.ok(f.dist < cam.dist, 'tapping a building moves in');
});

// ── the SELL timeline ──────────────────────────────────────────────────────────────────────────────────────────
test('the SELL timeline follows the §6.5 table, from sell()\'s per-load entries', () => {
  const o = advance(online(), T0 + 20 * MIN, quiet).outpost;
  const s = sell(o, {});
  assert.equal(s.loads.length, 4);
  const tl = sellTimeline(s.loads, { goldFrom: 1000 });
  const at = (type) => tl.beats.find((b) => b.type === type).t;
  assert.equal(at('drain'), 0); assert.equal(at('crates'), 0);
  assert.equal(at('engines'), 0.6); assert.equal(at('lift'), 0.6); assert.equal(at('shake'), 0.6);
  assert.equal(at('splatter'), 0.8);
  assert.equal(at('arc'), SELL.arc[0]);
  assert.deepEqual(tl.pops.map((p) => +p.t.toFixed(2)), [0.9, 1.02, 1.14, 1.26], 'one "$N" per load, staggered 0.12 s');
  assert.deepEqual(tl.pops.map((p) => p.gold), s.loads.map((l) => l.gold));
  assert.equal(tl.pops[0].colour, '#8a4b32', 'in the ore colour');
  assert.equal(tl.total, s.gold);
  assert.equal(tl.countAt(0), 1000);
  assert.equal(tl.countAt(1.4), 1000);
  assert.equal(tl.countAt(tl.duration), 1000 + s.gold);
  let prev = 0;
  for (let t = 0; t <= tl.duration; t += 0.05) { const g = tl.countAt(t); assert.ok(g >= prev); prev = g; }
  assert.equal(tl.shuttleAt(0.5).on, false);
  assert.ok(tl.shuttleAt(1.0).lift > 0 && tl.shuttleAt(1.0).arc === 0);
  assert.ok(tl.shuttleAt(2.5).arc > 0.3 && tl.shuttleAt(3.0).arc === 1);
  assert.equal(tl.drainAt(0), 1);
  assert.equal(tl.drainAt(SELL.drainFor), 0);
});

test('reduced motion keeps the pops and the count-up only; a big sale shares pops but pays every load', () => {
  const loads = Array.from({ length: 30 }, (_, i) => ({ pad: 'r1', item: i % 2 ? 'iron' : 'iron_deep', units: 15, gold: 60 + i }));
  const tl = sellTimeline(loads, { reduced: true });
  assert.deepEqual([...new Set(tl.beats.map((b) => b.type))].sort(), ['count', 'pop']);
  assert.equal(tl.shuttleAt(1.5).on, false);
  assert.ok(tl.pops.length <= MAX_POPS);
  assert.equal(tl.pops.reduce((a, p) => a + p.gold, 0), loads.reduce((a, l) => a + l.gold, 0));
  assert.equal(tl.pops.reduce((a, p) => a + p.loads, 0), 30);
  assert.ok(tl.pops[tl.pops.length - 1].t < SELL.arc[1], 'the stagger ends while the shuttle is still in view');
});

test('pop colours: a dark ore is lifted bright, keeping its hue', () => {
  const c = popColour('#8a4b32');
  const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  assert.ok(r > 200 && r > g && g > b, `${c} is a light rust`);
  assert.equal(popColour('nope'), '#ffd76a');
});

// ── the scene plans ────────────────────────────────────────────────────────────────────────────────────────────
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
  const rare = map.deposits.find((d) => d.tier === 'rare').pad;
  assert.ok(!on.some((c) => c.to === rare), 'no conduit to an empty pad');
});

test('building states: a build rises in four steps with a cool tint; rigs work only when running and not full', () => {
  let o = online();
  const bay = map.pads.find((p) => p.role === 'bay').id;
  o = place(o, { pad: bay, kind: 'harvesterBay' }, { map, now: T0, gold: 1e9, unlockedTiers: ['common'] }).outpost;
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
  const hub = map.pads.find((p) => p.role === 'hub');
  assert.ok(b.base.x >= hub.x && b.base.x < hub.x + hub.w && b.base.y >= hub.y && b.base.y < hub.y + hub.h);
  assert.equal(bakedSlugOf(map), 'ground-outpost');
  const res = lowlandResources(map);
  assert.ok(res.every((r) => !(map.heights[r.y * map.width + r.x] > 0)), 'no resource field on the mesa');
});
