// The outpost layer of a Forge map: the validator, the stamp and the phone framing (tech plan
// docs/tech-plan/Outpost.md §6.6, §6.1) [MM-story_mw5oeatc_l]. S2c.2 [MM-story_mwc9pmbn_2i]: no build pads — the layer
// fixes only the landing pad (`hub`) and the deposits; buildings are placed freely by the shared placement rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateOutpostLayout, stampOutpost, defenseRing, mesaFrame, buildable, inMesa, HEIGHT } from './outpostPads.js';
import { generateTerrain, TERRAIN } from './terrainGen.js';
import { DRAFT_LAYOUT } from '../outpost/draftLayout.js';
import { HUB_CLEARANCE } from '../data/outpost.js';

const GROUND = JSON.parse(readFileSync(new URL('../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8'));
const draft = () => JSON.parse(JSON.stringify(DRAFT_LAYOUT));
const ground = () => JSON.parse(JSON.stringify(GROUND));
const has = (problems, re) => problems.some((p) => re.test(p));

test('the draft layout and the shipped Verdance outpost map pass every check', () => {
  assert.deepEqual(validateOutpostLayout(DRAFT_LAYOUT), []);
  assert.deepEqual(validateOutpostLayout(GROUND), []);
  assert.equal(GROUND.cols, 64); assert.equal(GROUND.rows, 32);   // the large maps' size (owner 2026-11-07)
  assert.equal(GROUND.worldMode, true);
  assert.deepEqual(GROUND.hub, { x: 30, y: 14, w: 3, h: 3 }, 'the landing pad on the base');
  assert.deepEqual(GROUND.deposits.map((d) => d.tier).sort(), ['common', 'rare', 'uncommon']);
  assert.equal(GROUND.spawns.filter((s) => s.lane === 'ground').length, 2, 'two raid lanes');
});

test('S2c.2: a map that still authors build pads or conduits is reported', () => {
  const g = ground();
  g.pads = [{ id: 'p1', x: 34, y: 13, w: 2, h: 2, role: 'power' }];
  g.conduits = [['p1', 'hub']];
  const p = validateOutpostLayout(g);
  assert.ok(has(p, /still authors build pads/));
  assert.ok(has(p, /still authors conduits/));
});

test('the landing pad: present, on open flat mesa ground, under the battle base', () => {
  const g = ground(); delete g.hub;
  assert.ok(has(validateOutpostLayout(g), /no landing pad/));
  const h = ground();
  h.terrain[h.hub.y * h.cols + h.hub.x] = TERRAIN.TREES;
  assert.ok(has(validateOutpostLayout(h), /landing pad sits on 1 blocked cell/));
  const b = ground();
  b.base.pos = { x: 10, y: 10 };
  assert.ok(has(validateOutpostLayout(b), /the base \(10, 10\) is not on the landing pad/));
});

test('deposits: one per tier, on open flat ground, common and uncommon on the mesa, rare remote, a rig on each clear of the landing pad', () => {
  const m = draft();
  m.deposits.push({ tier: 'common', x: 28, y: 13 });
  assert.ok(has(validateOutpostLayout(m), /2 common deposits/));
  const n = draft();
  n.deposits = n.deposits.filter((d) => d.tier !== 'uncommon');
  assert.ok(has(validateOutpostLayout(n), /0 uncommon deposits/));
  // the owner's playtest (2026-11-11): a mining station one cell below the landing pad is too close
  const g = ground();
  g.deposits.find((d) => d.tier === 'common').y = g.hub.y + g.hub.h + 1;
  assert.ok(has(validateOutpostLayout(g), new RegExp(`rig on the common deposit .* within ${HUB_CLEARANCE} cells of the landing pad`)));
  const r = ground();
  Object.assign(r.deposits.find((d) => d.tier === 'rare'), { x: 36, y: 18 });   // onto the mesa
  assert.ok(has(validateOutpostLayout(r), /rare deposit .* is on the mesa/));
  const t = ground();
  const d = t.deposits.find((q) => q.tier === 'uncommon');
  t.terrain[d.y * t.cols + d.x] = TERRAIN.TREES;
  assert.ok(has(validateOutpostLayout(t), /uncommon deposit .* sits on 1 blocked cell/));
});

test('kit defenses: on buildable ground, off the landing pad and the deposits, clear of the landing pad', () => {
  const n = draft();
  n.kitDefenses[1].cell = [DRAFT_LAYOUT.hub.x, DRAFT_LAYOUT.hub.y];
  assert.ok(has(validateOutpostLayout(n), /kit mg at .* is on the landing pad or a deposit/));
  const m = draft();
  m.kitDefenses[0].cell = [DRAFT_LAYOUT.hub.x - 1, DRAFT_LAYOUT.hub.y];
  assert.ok(has(validateOutpostLayout(m), new RegExp(`kit cannon at .* within ${HUB_CLEARANCE} cells of the landing pad`)));
});

test('raid lanes: two ground spawns, each walking to the landing pad', () => {
  const g = ground();
  g.spawns = g.spawns.slice(0, 1);
  assert.ok(has(validateOutpostLayout(g), /1 raid lane \(needs two/));
  const h = ground();
  for (const r of h.mesa.ramps) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) h.blocking[y * h.cols + x] = 1;
  assert.ok(has(validateOutpostLayout(h), /raid lane from \(0, 6\) cannot walk to the landing pad/));
});

test('the stamp: a flat stone top, a cliff rim cut by ramps, cart tracks and clearings; deterministic', () => {
  const layout = { mesa: GROUND.mesa, deposits: GROUND.deposits, clearings: GROUND.clearings, spawns: GROUND.spawns, kitDefenses: GROUND.kitDefenses };
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
  // the remote site: its deposit and the clearing are open dirt yards
  for (const r of [GROUND.deposits.find((d) => d.tier === 'rare'), ...GROUND.clearings]) assert.equal(a.clear[r.y * W + r.x], 1, `yard at (${r.x}, ${r.y})`);
});

test('the defense ring rings the mesa top and the remote site, on buildable cells off the landing pad and deposits', () => {
  const ring = defenseRing(GROUND);
  assert.ok(ring.length > 60, `${ring.length} ring cells`);
  for (const [x, y] of ring) assert.ok(buildable(GROUND, x, y));
  const onMesa = ring.filter(([x, y]) => GROUND.heights[y * GROUND.cols + x] === HEIGHT.TOP).length;
  assert.ok(onMesa > 40 && ring.length - onMesa > 10, 'around the mesa and around the remote site');
  for (const d of GROUND.kitDefenses) assert.ok(buildable(GROUND, ...d.cell), `${d.kind} on buildable ground`);
  assert.equal(buildable(GROUND, GROUND.hub.x, GROUND.hub.y), false, 'not on the landing pad');
});

test('the mesa frames on a 390 × 844 portrait phone (tech plan §6.1), not the whole 64 × 32 map', () => {
  const f = mesaFrame(GROUND);
  const px = 390 / f.w;                          // the frame's width fills the phone's width
  assert.ok(px >= 16, `${px.toFixed(1)} px per cell — a 2 × 2 building is at least 32 px`);
  assert.ok(f.h * px <= 844 * 0.6, `the mesa takes ${Math.round(f.h * px)} of 844 px, leaving room for the HUD`);
  const p = GROUND.hub;
  assert.ok(p.x >= f.x && p.y >= f.y && p.x + p.w <= f.x + f.w && p.y + p.h <= f.y + f.h, 'the landing pad in frame');
});
