// The outpost layer of a Forge map: the validator, derived conduits, the stamp and the phone framing
// (tech plan docs/tech-plan/Outpost.md §6.6, §6.1) [MM-story_mw5oeatc_l].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateOutpostLayout, deriveConduits, stampOutpost, defenseRing, mesaFrame, buildable, nextPadId, inMesa, HEIGHT,
} from './outpostPads.js';
import { generateTerrain, TERRAIN } from './terrainGen.js';
import { DRAFT_LAYOUT } from '../outpost/draftLayout.js';

const GROUND = JSON.parse(readFileSync(new URL('../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8'));
const draft = () => JSON.parse(JSON.stringify(DRAFT_LAYOUT));
const has = (problems, re) => problems.some((p) => re.test(p));

test('the draft layout passes, and its hand-written conduits are exactly the ones derived from reach', () => {
  assert.deepEqual(validateOutpostLayout(DRAFT_LAYOUT), []);
  assert.deepEqual(deriveConduits(DRAFT_LAYOUT), DRAFT_LAYOUT.conduits);
});

test('the shipped Verdance outpost map passes every check', () => {
  assert.deepEqual(validateOutpostLayout(GROUND), []);
  assert.equal(GROUND.cols, 64); assert.equal(GROUND.rows, 32);   // the large maps' size (owner 2026-11-07)
  assert.equal(GROUND.worldMode, true);
  assert.ok(GROUND.pads.filter((p) => !p.remote).length >= 7, '7+ pads on the mesa');
  assert.deepEqual(GROUND.deposits.map((d) => d.tier).sort(), ['common', 'rare', 'uncommon']);
  assert.equal(GROUND.spawns.filter((s) => s.lane === 'ground').length, 2, 'two raid lanes');
});

test('overlapping pads and a pad on blocked or uneven ground are reported', () => {
  const m = draft();
  Object.assign(m.pads.find((p) => p.id === 's1'), { x: 20, y: 12 });   // onto the hub
  assert.ok(has(validateOutpostLayout(m), /pads hub and s1 overlap/));

  const g = JSON.parse(JSON.stringify(GROUND));
  const r1 = g.pads.find((p) => p.id === 'r1');
  g.terrain[r1.y * g.cols + r1.x] = TERRAIN.TREES;
  assert.ok(has(validateOutpostLayout(g), /pad r1 sits on 1 blocked cell/));
  const x1 = g.pads.find((p) => p.id === 'x1');
  x1.x += 3;                                  // over the cliff rim
  assert.ok(has(validateOutpostLayout(g), /pad x1 (sits on|is not flat)/));
});

test('a pad cut off from the hub by the conduits, or a remote pad with no station link, is reported', () => {
  const m = draft();
  m.conduits = m.conduits.filter(([a, b]) => !(a === 'p1' && b === 'b2'));
  assert.ok(has(validateOutpostLayout(m), /pad b2 is not reachable from the hub/));
  const n = draft();
  n.conduits = n.conduits.filter(([, b]) => b !== 'r3');
  assert.ok(has(validateOutpostLayout(n), /remote pad r3 is not linked to a power pad/));
  const o = draft();
  o.conduits.push(['hub', 'r1']);
  assert.ok(has(validateOutpostLayout(o), /conduit hub–r1 has no power pad/));
});

test('deposits: exactly one per tier, each on a rig pad', () => {
  const m = draft();
  m.deposits.push({ tier: 'common', x: 28, y: 13, pad: 'x1' });
  const p = validateOutpostLayout(m);
  assert.ok(has(p, /2 common deposits/));
  assert.ok(has(p, /on x1, a spare pad/));
  const n = draft();
  n.deposits = n.deposits.filter((d) => d.tier !== 'uncommon');
  assert.ok(has(validateOutpostLayout(n), /0 uncommon deposits/));
});

test('the rare deposit must be remote: outside the first station, with a station of its own in reach', () => {
  const m = draft();
  Object.assign(m.pads.find((p) => p.id === 'r3'), { x: 27, y: 16 });   // onto the mesa, inside p1's reach
  assert.ok(has(validateOutpostLayout(m), /rare deposit's pad r3 is inside the first station's reach/));
  const n = draft();
  Object.assign(n.pads.find((p) => p.id === 'p2'), { x: 30, y: 19 });   // the remote station moved far away
  const p = validateOutpostLayout(n);
  assert.ok(has(p, /r3 has no power pad of its own within reach/));
});

test('mesa pads outside the first station, and powered kit defenses outside it, are reported', () => {
  const m = draft();
  Object.assign(m.pads.find((p) => p.id === 'b1'), { x: 6, y: 3 });
  assert.ok(has(validateOutpostLayout(m), /pad b1 is outside the first station's reach/));
  const n = draft();
  n.kitDefenses[0].cell = [2, 2];
  assert.ok(has(validateOutpostLayout(n), /kit cannon at \(2, 2\) is outside the first station's reach/));
  n.kitDefenses[1].cell = [17, 10];
  assert.ok(has(validateOutpostLayout(n), /kit mg at \(17, 10\) is on a pad/));
});

test('raid lanes: two ground spawns, each walking to the hub between the buildings', () => {
  const g = JSON.parse(JSON.stringify(GROUND));
  g.spawns = g.spawns.slice(0, 1);
  assert.ok(has(validateOutpostLayout(g), /1 raid lane \(needs two/));
  const h = JSON.parse(JSON.stringify(GROUND));
  for (const r of h.mesa.ramps) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) h.blocking[y * h.cols + x] = 1;
  assert.ok(has(validateOutpostLayout(h), /raid lane from \(0, 6\) cannot walk to the hub/));
});

test('the battle base must sit on the hub (the raids march on it)', () => {
  const g = JSON.parse(JSON.stringify(GROUND));
  g.base.pos = { x: 10, y: 10 };
  assert.ok(has(validateOutpostLayout(g), /the base \(10, 10\) is not on the hub pad/));
});

test('the stamp: a flat stone top, a cliff rim cut by ramps, cart tracks and clearings; deterministic', () => {
  const layout = { mesa: GROUND.mesa, pads: GROUND.pads, spawns: GROUND.spawns, kitDefenses: GROUND.kitDefenses };
  const W = GROUND.cols, H = GROUND.rows;
  const run = () => stampOutpost(generateTerrain({ cols: W, rows: H, seed: GROUND.seed, types: GROUND.types, water: GROUND.water }), layout);
  const a = run(), b = run();
  assert.deepEqual(a.terrain, b.terrain); assert.deepEqual(a.heights, b.heights);
  let rim = 0, ramp = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!inMesa(GROUND.mesa, x, y)) { assert.equal(a.heights[i], HEIGHT.LOW); continue; }
    if (a.heights[i] === HEIGHT.RAMP) { ramp++; assert.equal(a.blocking[i], 0); }
    else if (a.terrain[i] === TERRAIN.CLIFF) { rim++; assert.equal(a.blocking[i], 1); }
    else assert.equal(a.terrain[i], TERRAIN.ROCK_BORDER, 'the stone top: walkable, buildable, baked above the grass');
  }
  assert.ok(rim > 40, `a cliff rim (${rim})`);
  assert.equal(ramp, 4, 'two 2-cell ramps');
  for (const s of GROUND.spawns) assert.equal(a.blocking[s.y * W + s.x], 0, 'lanes start on open ground');
});

test('the defense ring rings the mesa top and the remote site, on buildable cells off the pads', () => {
  const ring = defenseRing(GROUND);
  assert.ok(ring.length > 60, `${ring.length} ring cells`);
  for (const [x, y] of ring) assert.ok(buildable(GROUND, x, y));
  const onMesa = ring.filter(([x, y]) => GROUND.heights[y * GROUND.cols + x] === HEIGHT.TOP).length;
  assert.ok(onMesa > 40 && ring.length - onMesa > 10, 'around the mesa and around the remote site');
  for (const d of GROUND.kitDefenses) assert.ok(buildable(GROUND, ...d.cell), `${d.kind} on buildable ground`);
});

test('the mesa frames on a 390 × 844 portrait phone (tech plan §6.1), not the whole 64 × 32 map', () => {
  const f = mesaFrame(GROUND);
  const px = 390 / f.w;                          // the frame's width fills the phone's width
  assert.ok(px >= 16, `${px.toFixed(1)} px per cell — a 4 × 4 pad is at least 64 px, a tap target`);
  assert.ok(f.h * px <= 844 * 0.6, `the mesa takes ${Math.round(f.h * px)} of 844 px, leaving room for the HUD`);
  for (const p of GROUND.pads.filter((q) => !q.remote)) assert.ok(p.x >= f.x && p.y >= f.y && p.x + p.w <= f.x + f.w && p.y + p.h <= f.y + f.h, `${p.id} in frame`);
});

test('pad ids follow the roles (hub, p1, r1, s1, b1, x1)', () => {
  assert.equal(nextPadId({ pads: [] }, 'hub'), 'hub');
  assert.equal(nextPadId(DRAFT_LAYOUT, 'rig'), 'r4');
  assert.equal(nextPadId(DRAFT_LAYOUT, 'storage'), 's2');
});
