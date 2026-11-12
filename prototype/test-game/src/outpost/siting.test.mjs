// S2c.2 "pads removed" [MM-story_mwc9pmbn_2i] (TECH_PLAN::One-Battle-UX.md §5.3–5.4). Owner playtest 2026-11-11: "the
// mining station is too close to the landing pad .. I thought fixed pads were being removed".
//  - the landing pad's clearance is a data dial (data/outpost.js HUB_CLEARANCE, 2) enforced by the SHARED placement
//    (placementRules.js hubClearance → sim/structures.js spacingConflict), for buildings and defenses alike;
//  - the reference kit is placed by those rules (siting.js referenceKit), on every shipped map;
//  - old saves migrate: pad buildings keep their pad's rectangle unless that breaks a rule, then move to the nearest
//    legal cell (siting.js migrateOutpostLayout); wrecks, timers, storage and the hopper are kept;
//  - nothing reads map.pads / map.conduits any more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { map, T0, memoryStore, catalog } from './view/fixtures.mjs';
import { referenceOutpost, buildingRect, confirmOnline, onlineProblems, powerGrids, createOutpost } from './model.js';
import { outpostMapFromForge } from './outpostMap.js';
import { referenceKit, migrateOutpostLayout, positionCheck, LAYOUT_VERSION } from './siting.js';
import { hubClearance } from './placementRules.js';
import { toLiveSim } from './liveSim.js';
import { validatePlacement } from '../sim/structures.js';
import { HUB_CLEARANCE } from '../data/outpost.js';
import { createSession } from './view/session.js';
import { defaultSave } from '../save/save.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));   // prototype/test-game/
const FORGE_DIR = join(ROOT, 'content/maps/forge');
const MAPS = readdirSync(FORGE_DIR).filter((f) => f.endsWith('-outpost.json'))
  .map((f) => outpostMapFromForge(JSON.parse(readFileSync(join(FORGE_DIR, f), 'utf8')), f.replace('-outpost.json', '')));
/** Free cells between two rectangles (Chebyshev; the build-spacing measure). */
const gap = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
const CLEAR_MSG = new RegExp(`keep ${HUB_CLEARANCE} cells clear of the landing pad`);

test('the hub clearance is a data dial (2 cells) on the shared placement, for buildings and defenses alike', () => {
  assert.equal(HUB_CLEARANCE, 2);
  const { state } = toLiveSim(referenceOutpost('ground', { seed: 7, map, now: T0 }), { map, now: T0, gold: 1e9 });
  assert.ok(state.placementRules.length >= 3, 'the outpost rules ride on validatePlacement');
  const hub = map.hub;
  // a 2 × 2 building one cell above the landing pad is refused by the clearance; two cells above is not (by it)
  assert.match(validatePlacement(state, 'OUT-power', { x: hub.x, y: hub.y - 3 }).reason, CLEAR_MSG);
  assert.doesNotMatch(String(validatePlacement(state, 'OUT-power', { x: hub.x, y: hub.y - 4 }).reason), CLEAR_MSG);
  // a defense (spacing 0 between towers) keeps the clearance too
  assert.match(validatePlacement(state, 'OUT-mg', { x: hub.x - 1, y: hub.y + 1 }).reason, CLEAR_MSG);
  assert.doesNotMatch(String(validatePlacement(state, 'OUT-mg', { x: hub.x - 3, y: hub.y + 1 }).reason), CLEAR_MSG);
  // the rule itself, with the dial turned: 1 cell is the build spacing again
  const r1 = hubClearance(map, 1);
  assert.equal(r1(state, { spacing: 1, footprint: { w: 2, h: 2 } }, { x: hub.x, y: hub.y - 3 }), null);
});

test('the reference kit stands by the shared rules on every shipped map: rig on its deposit, clear of the landing pad, spaced', () => {
  for (const m of MAPS) {
    const o = referenceOutpost(m.planet, { seed: 3, map: m, now: T0 });
    const ids = ['p1', 'r1', 's1'];
    const dep = m.deposits.find((d) => d.tier === 'common');
    assert.deepEqual([o.pads.r1.at.x, o.pads.r1.at.y], [dep.x, dep.y], `${m.id}: the rig on the common deposit`);
    for (const id of ids) {
      const r = buildingRect(o, m, id);
      assert.ok(gap(r, m.hub) >= HUB_CLEARANCE, `${m.id}: ${id} keeps ${HUB_CLEARANCE} cells from the landing pad (gap ${gap(r, m.hub)})`);
      for (const other of ids) if (other !== id) assert.ok(gap(r, buildingRect(o, m, other)) >= 1, `${m.id}: ${id}–${other} spaced`);
      // and the shared rule agrees, piece by piece, against everything else
      const without = { ...o, pads: Object.fromEntries(Object.entries(o.pads).filter(([k]) => k !== id)) };
      assert.equal(positionCheck(without, m)(o.pads[id].kind, r), null, `${m.id}: ${id} is legal where it stands`);
    }
    for (const d of o.defenses) assert.ok(gap({ x: d.cell[0], y: d.cell[1], w: 1, h: 1 }, m.hub) >= HUB_CLEARANCE, `${m.id}: kit ${d.kind}`);
    assert.deepEqual(onlineProblems(o, m), [], `${m.id}: the kit can go online`);
    assert.equal(powerGrids(o, m).grids[0].draw, 9, `${m.id}: the kit draws 9 of its station's 10, guns included`);
  }
  // the ground map's kit, as the owner will see it: rig south of the landing pad, station beside it, storage east
  const k = referenceKit(map);
  assert.deepEqual(Object.fromEntries(Object.entries(k.pads).map(([id, b]) => [id, [b.at.x, b.at.y]])), { p1: [33, 19], r1: [30, 19], s1: [35, 15] });
  assert.deepEqual(k.moved, [], 'every kit defense stands where the map authors it');
});

/** A save written before S2c.2: buildings keyed by the old map pads (no `at`), with a wreck, timers, storage and hopper. */
function oldSave() {
  return {
    planet: 'ground', seed: 99, online: true, t: T0, firstRaidAt: null,
    pads: {
      hub: { kind: 'hub', tier: 1 }, p1: { kind: 'power', tier: 2 }, r1: { kind: 'rig', tier: 1, deposit: 'common', deep: false },
      s1: { kind: 'storage', tier: 1 }, b1: { kind: 'resourceBay', tier: 1 }, x1: { kind: 'habitat', tier: 1 },
    },
    building: [{ pad: 'b2', kind: 'upgradeBay', tier: 1, done: T0 + 60_000 }, { pad: 's1', kind: 'storage', tier: 2, done: T0 + 30_000 }],
    defenses: [
      { id: 'd1', kind: 'cannon', tier: 1, cell: [27, 13], hp: 400 },
      { id: 'd2', kind: 'mg', tier: 1, cell: [42, 20], hp: 0 },                                       // a wreck
      { id: 'd3', kind: 'wall', tier: 1, cell: [33, 13], hp: 300, repair: { at: T0 - 1000, arrive: T0 + 4000, done: T0 + 9000 } },
    ],
    storage: { r1: { iron: 123 } }, harvesters: 1, hopper: { common: 5.5 }, fields: {}, raids: { window: 3, log: [] }, sold: { iron: 10 },
  };
}

test('migration: pad buildings become free buildings at their pad\'s rect; only rule-breakers move, to the nearest legal cell', () => {
  const before = oldSave();
  const { outpost: o, moved, stuck } = migrateOutpostLayout(before, map);
  assert.deepEqual(stuck, []);
  assert.equal(o.layout, LAYOUT_VERSION);
  // legal where it stood: kept exactly (no surprise moves)
  assert.deepEqual(o.pads.x1.at, { x: 35, y: 10, w: 2, h: 2 }, 'the Habitat on old pad x1 keeps its spot');
  assert.deepEqual(o.defenses.find((d) => d.id === 'd1').cell, [27, 13]);
  assert.deepEqual(o.defenses.find((d) => d.id === 'd2').cell, [42, 20], 'the wreck stays');
  // against the landing pad (1 cell) or off the moved deposit: moved, in the search order (buildings by id, then defenses)
  assert.deepEqual(moved.map((m) => m.id), ['b1', 'b2', 'p1', 'r1', 's1', 'd3']);
  assert.deepEqual([o.pads.r1.at.x, o.pads.r1.at.y], [30, 19], 'the rig moves onto its (moved) deposit');
  // every building and defense is legal where it ends, against everything else
  for (const id of Object.keys(o.pads).filter((k) => o.pads[k].kind !== 'hub')) {
    const without = { ...o, pads: Object.fromEntries(Object.entries(o.pads).filter(([k]) => k !== id)), building: o.building.filter((j) => j.pad !== id) };
    assert.equal(positionCheck(without, map)(o.pads[id].kind, o.pads[id].at), null, `${id} legal at ${JSON.stringify(o.pads[id].at)}`);
    assert.ok(gap(o.pads[id].at, map.hub) >= HUB_CLEARANCE, `${id} clear of the landing pad`);
  }
  const job = o.building.find((j) => j.pad === 'b2');
  const withoutB2 = { ...o, building: o.building.filter((j) => j.pad !== 'b2') };
  assert.equal(positionCheck(withoutB2, map)('upgradeBay', job.at), null, 'the job under construction moved to a legal spot');
  assert.deepEqual(o.building.find((j) => j.pad === 's1').at, o.pads.s1.at, 'an upgrade job follows its building');
  const d3 = o.defenses.find((d) => d.id === 'd3');
  assert.ok(gap({ x: d3.cell[0], y: d3.cell[1], w: 1, h: 1 }, map.hub) >= HUB_CLEARANCE, 'the wall moved out of the clearance');
  // everything else is the save as it was
  assert.deepEqual(d3.repair, before.defenses[2].repair, 'its repair drone timer kept');
  assert.equal(o.defenses.find((d) => d.id === 'd2').hp, 0, 'the wreck is still a wreck');
  assert.deepEqual(o.building.map((j) => [j.pad, j.kind, j.tier, j.done]), before.building.map((j) => [j.pad, j.kind, j.tier, j.done]));
  for (const k of ['storage', 'hopper', 'harvesters', 'raids', 'sold', 'online', 't', 'seed']) assert.deepEqual(o[k], before[k], k);
  for (const id of Object.keys(before.pads)) assert.deepEqual({ ...o.pads[id], at: undefined }, { ...before.pads[id], at: undefined }, `${id}: kind, tier and deposit kept`);
  // deterministic and idempotent
  assert.deepEqual(migrateOutpostLayout(oldSave(), map).outpost, o);
  assert.equal(migrateOutpostLayout(o, map).outpost, o, 'a migrated save is left alone');
  assert.deepEqual(before, oldSave(), 'the save passed in is not changed');
});

test('migration: the reference outpost (already on the rules) does not move; a pre-S2c.2 copy of it only gains its rects', () => {
  const ref = referenceOutpost('ground', { seed: 7, map, now: T0 });
  assert.equal(ref.layout, LAYOUT_VERSION, 'a new outpost is sited by the rules from the start');
  const unstamped = { ...structuredClone(ref) }; delete unstamped.layout;
  const r = migrateOutpostLayout(unstamped, map);
  assert.deepEqual(r.moved, []);
  assert.deepEqual(r.outpost.pads, ref.pads);
  assert.deepEqual(r.outpost.defenses, ref.defenses);
  assert.equal(createOutpost('ground', { seed: 1, map, now: T0 }).layout, LAYOUT_VERSION);
});

test('migration runs once when the outpost is opened (the save session), before the catch-up', () => {
  const s = defaultSave();
  s.outposts = { ground: oldSave() };
  s.carry = { gold: 1000, structures: [] };
  const store = memoryStore(s);
  const v = createSession({ store, planet: 'ground', map, catalog, raidHook: null });
  const opened = v.open(T0 + 1000);
  assert.deepEqual(opened.migrated.moved.map((m) => m.id), ['b1', 'b2', 'p1', 'r1', 's1', 'd3']);
  const o = store.load().outposts.ground;
  assert.equal(o.layout, LAYOUT_VERSION);
  assert.ok(Object.keys(o.pads).filter((k) => o.pads[k].kind !== 'hub').every((k) => o.pads[k].at), 'every building has its own rect');
  assert.deepEqual(v.open(T0 + 2000).migrated, { moved: [], stuck: [] }, 'the second visit has nothing to migrate');
});

test('nothing reads map.pads or map.conduits any more (the maps carry neither)', () => {
  const SRC = join(ROOT, 'src');
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) files.push(p); } };
  walk(SRC);
  // constructionFx.js: the farm view's build dust, which lane K moves into the shared render3d FX (it guards a missing
  // map.pads and draws nothing there); outpostPads.js: the validator that REPORTS a map still carrying pads/conduits
  const ALLOW = new Set(['outpost/view/constructionFx.js', 'terrain/outpostPads.js']);
  const bad = [];
  for (const f of files) {
    const rel = relative(SRC, f).split('\\').join('/');
    if (ALLOW.has(rel)) continue;
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
    if (/\b(map|om|m)\.(pads|conduits)\b/.test(code)) bad.push(rel);
  }
  assert.deepEqual(bad, []);
  for (const m of MAPS) { assert.equal(m.pads, undefined, m.id); assert.equal(m.conduits, undefined, m.id); assert.ok(m.hub, m.id); }
});
