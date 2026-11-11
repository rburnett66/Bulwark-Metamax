// The #282 follow-ups (owner answers, 2026-11-11) [MM-subtask_mwco9m19_39]: power icons (and the building an armed
// placement would cut), dark conduits on a station-less pylon chain, Power_Priority as a workbook column, and conduits
// routed along the open lanes with the battle's own walker search.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planConduits, conduitRoute, laneRoute, laneGrid, ghostPower, powerCuts, planPowerIcons, withCuts } from './conduits.js';
import { powerGrids, unlitChains, referenceOutpost } from '../model.js';
import { structureDef, POWER_PRIORITY, POWER_PRIORITY_LAST, powerPriority } from '../../data/outpost.js';
import { MAPDATA } from '../../../content/maps/mapdata.js';
import { map as groundMap, T0 } from './fixtures.mjs';

const free = { pads: [], deposits: [], conduits: [] };   // no cells: routes fall back to one bend
const at = (kind, x, y, w = 2, h = 2, tier = 1) => ({ kind, tier, at: { x, y, w, h } });
const P1 = structureDef('power', 1), PY = structureDef('pylon', 1), RIG = structureDef('rig', 1);

// ── 3. a pylon chain with no station: dark conduits, powerGrids untouched ───────────────────────────────────────────
test('a station-less pylon chain is listed by unlitChains and drawn as unlit links; powerGrids is unchanged', () => {
  const base = { t: 0, online: true, defenses: [], building: [], pads: { s: at('power', 0, 0), r: at('rig', 3, 0) } };
  const o = { ...base, pads: { ...base.pads, ya: at('pylon', 100, 0, 1, 1), yb: at('pylon', 100 + PY.reach, 0, 1, 1), rr: at('rig', 101, 1) } };
  assert.deepEqual(unlitChains(o, free), [{ nodes: ['ya', 'yb'] }]);
  assert.deepEqual(unlitChains(base, free), [], 'every node on a live grid: no chain');
  const g = powerGrids(o, free);
  assert.deepEqual(g.grids.map((x) => x.nodes), [['s']], 'the chain is still no grid');
  assert.equal(g.off.rr, 'reach', 'a consumer by the dark chain still has no power in reach');
  const plan = planConduits(o, free);
  const chain = plan.filter((c) => c.unlit);
  assert.deepEqual(chain.map((c) => [c.kind, c.from, c.to, c.powered]), [['link', 'ya', 'yb', false]]);
  assert.ok(!plan.some((c) => c.to === 'rr'), 'no branch from a dark chain');
  assert.deepEqual(plan.filter((c) => !c.unlit), planConduits(base, free), 'the live grid plans as before');
  assert.deepEqual(planConduits(structuredClone(o), free), plan, 'deterministic');
  // a station joins the chain → it lights: no unlit links left
  const lit = { ...o, pads: { ...o.pads, s2: at('power', 100 + PY.reach * 2 - 1, 0) } };
  assert.ok(!planConduits(lit, free).some((c) => c.unlit));
});

// ── 1. power icons, and the building an armed placement would cut ─────────────────────────────────────────────────
test('power icons: on / off per building and powered defense; none on nodes, walls, the Habitat or a build site', () => {
  const o = { t: 0, online: true, building: [{ pad: 'job', kind: 'storage', tier: 1, at: { x: 0, y: -3, w: 2, h: 2 }, done: 1e12 }],
    pads: { s: at('power', 0, 0), y: at('pylon', 4, 0, 1, 1), r: at('rig', 3, 3), far: at('rig', 200, 200), hab: at('habitat', 0, 6) },
    defenses: [{ id: 'g1', kind: 'mg', tier: 1, cell: [2, 2], hp: 1 }, { id: 'w1', kind: 'wall', tier: 1, cell: [5, 5], hp: 1 },
      { id: 'g2', kind: 'mg', tier: 1, cell: [300, 0], hp: 1 }] };
  const icons = planPowerIcons(o, free);
  assert.deepEqual(icons.map((i) => [i.id, i.state, i.defense]), [['far', 'off', false], ['r', 'on', false], ['g1', 'on', true], ['g2', 'off', true]]);
  assert.deepEqual(icons.find((i) => i.id === 'r').at, [4, 4], 'over the building\'s centre');
  assert.deepEqual(planPowerIcons(o, free, { grids: powerGrids(o, free) }), icons, 'a grid answer to hand gives the same');
});

test('the building an armed placement would cut: powerCuts from powerGrids with and without it, shown as "cut"', () => {
  // a station filled to the last unit (the hub, then rigs): the core (storage) is served first, so a storage tower
  // placed now is powered by cutting a rig
  const HUB = structureDef('hub', 1), ST = structureDef('storage', 1);
  const n = Math.floor((P1.supply - HUB.draw) / RIG.draw);
  assert.equal(HUB.draw + n * RIG.draw, P1.supply, 'fixture: the station is exactly full');
  assert.ok(ST.draw > 0 && ST.draw <= RIG.draw);
  const pads = { s: at('power', 0, 0), hub: at('hub', 0, 6, 3, 3) };
  for (let i = 0; i < n; i++) pads['r' + i] = at('rig', 3 * i, 3);
  const o = { t: 0, online: true, defenses: [], building: [], pads };
  const before = powerGrids(o, free);
  assert.equal(before.powered.size, n + 1);
  const gp = ghostPower(o, free, 'storage', { x: 0, y: -3, w: 2, h: 2 });
  assert.equal(gp.reason, 'supply', 'grid short');
  const extra = { ...o, pads: { ...pads, ghost: at('storage', 0, -3) } };
  assert.deepEqual(gp.cuts, powerCuts(before, powerGrids(extra, free)), 'ghostPower reads powerCuts');
  assert.equal(gp.cuts.length, 1, 'the storage tower outranks one rig');
  assert.equal(gp.cuts[0], 'r' + (n - 1), 'the last rig by id loses (priority, then id)');
  const icons = planPowerIcons(o, free, { cuts: gp.cuts });
  assert.equal(icons.find((i) => i.id === gp.cuts[0]).state, 'cut');
  assert.ok(icons.filter((i) => i.id !== gp.cuts[0]).every((i) => i.state === 'on'));
  assert.deepEqual(withCuts(planPowerIcons(o, free), gp.cuts), icons, 'withCuts marks the same without a grid run');
  assert.equal(withCuts(icons, []), icons);
  // a placement with room cuts nothing
  assert.deepEqual(ghostPower({ ...o, pads: { s: pads.s } }, free, 'rig', { x: 3, y: 0, w: 2, h: 2 }).cuts, []);
  assert.deepEqual(powerCuts(before, before), []);
});

// ── 4. Power_Priority is a workbook column ────────────────────────────────────────────────────────────────────────
test('power priority comes from the workbook (Outpost_Structures + Farm_Buildings Power_Priority): same order as before', () => {
  assert.deepEqual({ ...POWER_PRIORITY }, { hub: 0, storage: 1, rig: 2, mg: 3, cannon: 3, resourceBay: 4, upgradeBay: 5, habitat: 6, farmhouse: 7, silo: 7, pump: 8 },
    'the values the constant had');
  assert.equal(POWER_PRIORITY_LAST, 9);
  assert.equal(powerPriority('pylon'), POWER_PRIORITY_LAST, 'a blank cell serves last');
  const rows = MAPDATA.outpostStructures.filter((r) => r.Kind === 'rig');
  assert.ok(rows.length >= 2 && rows.every((r) => r.Power_Priority === 2), 'every tier row carries it');
  assert.equal(MAPDATA.farmBuildings.find((r) => r.Kind === 'pump').Power_Priority, 8);
});

// ── 5. conduits follow the open lanes ─────────────────────────────────────────────────────────────────────────────
/** A small map with cells: a blocked wall across x = 6, open only at y = 9. */
function laneMap() {
  const width = 14, height = 12, blocking = new Array(width * height).fill(0);
  for (let y = 0; y < height; y++) if (y !== 9) blocking[y * width + 6] = 1;
  return { pads: [], deposits: [], conduits: [], width, height, blocking };
}
const onCell = (m, p) => ({ x: Math.floor(p[0]), y: Math.floor(p[1]) });
test('a conduit routes through the gap in a wall (the walker search), deterministic, and falls back to one bend', () => {
  const m = laneMap();
  const o = { t: 0, online: true, defenses: [], building: [], pads: { s: at('power', 1, 1), r: at('rig', 10, 1) } };
  const plan = planConduits(o, m);
  const br = plan.find((c) => c.to === 'r');
  assert.ok(br, 'the rig is in reach');
  // where the line crosses the wall's column it is in the open cell (6, 9)
  const crossings = [];
  for (let i = 1; i < br.points.length; i++) {
    const [a, b] = [br.points[i - 1], br.points[i]];
    if ((a[0] - 6.5) * (b[0] - 6.5) <= 0 && a[0] !== b[0]) crossings.push(a[1] + (b[1] - a[1]) * (6.5 - a[0]) / (b[0] - a[0]));
  }
  assert.equal(crossings.length, 1);
  assert.ok(crossings[0] >= 9 && crossings[0] <= 10, `through the one open cell (crosses at y ${crossings[0]})`);
  // every interior point stands on an open cell outside both footprints
  for (const p of br.points.slice(1, -1)) {
    const c = onCell(m, p);
    assert.equal(m.blocking[c.y * m.width + c.x], 0, `open cell ${c.x},${c.y}`);
  }
  assert.ok(br.length > conduitRoute(o.pads.s.at, o.pads.r.at).length, 'longer than the straight bend it replaces');
  assert.deepEqual(planConduits(structuredClone(o), m), plan, 'deterministic');
  // the wall closed: no lane → the one-bend route
  const shut = { ...m, blocking: m.blocking.map((v, i) => (i === 9 * m.width + 6 ? 1 : v)) };
  assert.deepEqual(planConduits(o, shut).find((c) => c.to === 'r').points, conduitRoute(o.pads.s.at, o.pads.r.at).points);
  // no cells on the map → one bend, as before
  assert.deepEqual(planConduits(o, free).find((c) => c.to === 'r').points, conduitRoute(o.pads.s.at, o.pads.r.at).points);
});

test('routes go around other buildings and defenses; the lane grid is memoised per layout', () => {
  const m = { ...laneMap(), blocking: new Array(14 * 12).fill(0) };
  const o = { t: 0, online: true, building: [], defenses: [], pads: { s: at('power', 0, 4), r: at('rig', 8, 4), mid: at('storage', 4, 3, 2, 4) } };
  const lanes = laneGrid(o, m);
  assert.equal(laneGrid(structuredClone(o), m), lanes, 'same layout → the same grid');
  const r = laneRoute(lanes, o.pads.s.at, o.pads.r.at);
  const inMid = (p) => p[0] > 4 && p[0] < 6 && p[1] > 3 && p[1] < 7;
  assert.ok(!r.points.some(inMid), 'no point inside the storage tower between them');
  const walled = { ...o, defenses: [{ id: 'w', kind: 'wall', tier: 1, cell: [4, 2], hp: 1 }] };
  assert.notEqual(laneGrid(walled, m), lanes, 'a new defense is a new layout');
  // the ghost's preview runs on the lanes of the outpost WITH the ghost
  const gp = ghostPower({ ...o, pads: { s: o.pads.s, mid: o.pads.mid } }, m, 'rig', { x: 8, y: 4, w: 2, h: 2 });
  assert.deepEqual(gp.route.points, laneRoute(laneGrid({ ...o }, m), o.pads.s.at, o.pads.r.at).points);
});

test('on the real Verdance outpost every conduit point between the ends stands on an open cell no building covers', () => {
  const o = referenceOutpost('ground', { seed: 7, map: groundMap, now: T0 });
  const plan = planConduits(o, groundMap);
  assert.ok(plan.length >= 3);
  const rects = Object.keys(o.pads).map((id) => groundMap.pads.find((p) => p.id === id) || o.pads[id].at).filter(Boolean);
  for (const c of plan) {
    for (const p of c.points.slice(1, -1)) {
      const cell = onCell(groundMap, p);
      assert.equal(groundMap.blocking[cell.y * groundMap.width + cell.x], 0, `${c.from}>${c.to} on open ground`);
      assert.ok(!rects.some((r) => cell.x >= r.x && cell.x < r.x + r.w && cell.y >= r.y && cell.y < r.y + r.h), `${c.from}>${c.to} clear of buildings`);
    }
  }
});
