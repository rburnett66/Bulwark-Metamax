// Proves the Stack Forge placement math. Every case here corresponds to a bug that actually shipped because
// the math was checked by eye instead of measured.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const {
  sliceBase, sliceRect, xfFromRect, dragHandle, autoSpans, axisMaps, GEOAX, geoRange,
} = createRequire(import.meta.url)('./slice-geom.js');

const ID = { sx: 1, sy: 1, ox: 0, oy: 0 };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── 1. Placement: centred, per the owner's design ────────────────────────────────────────────────
test('a slice is centred on the face at scale 1', () => {
  for (const [kw, kh] of [[200, 100], [100, 200], [64, 64], [7, 3]]) {
    const r = sliceRect(kw, kh, 64, 64, ID);
    assert.ok(near(r.px + r.pw / 2, 32), `x centre ${kw}x${kh}`);
    assert.ok(near(r.py + r.ph / 2, 32), `y centre ${kw}x${kh}`);
    assert.ok(r.pw <= 64 + 1e-9 && r.ph <= 64 + 1e-9, 'contain-fit stays inside the face');
    assert.ok(near(Math.max(r.pw / kw, r.ph / kh), sliceBase(kw, kh, 64, 64)), 'aspect preserved');
  }
});

// ── 2. Handles: every drag round-trips and pins the opposite edge ────────────────────────────────
test('handle drags round-trip through imgXf and pin the opposite edge', () => {
  const kw = 200, kh = 90, boxW = 64, boxH = 64;
  const r0 = sliceRect(kw, kh, boxW, boxH, ID);
  for (const [mode, u, v] of [['R', 80, 0], ['L', -16, 0], ['B', 0, 60], ['T', 0, 4],
                              ['BR', 80, 60], ['TL', -16, 4], ['TR', 80, 4], ['BL', -16, 60]]) {
    const want = dragHandle(mode, r0, u, v);
    const got = sliceRect(kw, kh, boxW, boxH, xfFromRect(kw, kh, boxW, boxH, want));
    for (const k of ['px', 'py', 'pw', 'ph']) assert.ok(near(got[k], want[k], 1e-6), `${mode} ${k}`);
    if (mode.includes('R')) assert.ok(near(got.px, r0.px, 1e-6), `${mode}: left edge must stay pinned`);
    if (mode.includes('L')) assert.ok(near(got.px + got.pw, r0.px + r0.pw, 1e-6), `${mode}: right edge pinned`);
    if (mode.includes('B')) assert.ok(near(got.py, r0.py, 1e-6), `${mode}: top edge pinned`);
    if (mode.includes('T')) assert.ok(near(got.py + got.ph, r0.py + r0.ph, 1e-6), `${mode}: bottom edge pinned`);
  }
});

test('an edge handle moves ONLY its own axis', () => {
  const kw = 200, kh = 90, B = 64, r0 = sliceRect(kw, kh, B, B, ID);
  const horiz = sliceRect(kw, kh, B, B, xfFromRect(kw, kh, B, B, dragHandle('R', r0, 80, 0)));
  assert.ok(near(horiz.py, r0.py) && near(horiz.ph, r0.ph), 'dragging R must not change the vertical');
  const vert = sliceRect(kw, kh, B, B, xfFromRect(kw, kh, B, B, dragHandle('B', r0, 0, 60)));
  assert.ok(near(vert.px, r0.px) && near(vert.pw, r0.pw), 'dragging B must not change the horizontal');
});

// ── 3. The source block is a cube that fits the grid ─────────────────────────────────────────────
test('autoSpans is a cube of side = Layers, inside the grid', () => {
  for (const [foot, layers] of [[64, 16], [64, 64], [64, 96], [32, 64], [96, 96], [16, 4]]) {
    const sp = autoSpans(foot, layers, 0);
    const X = sp.spanX.hi - sp.spanX.lo, Y = sp.spanY.hi - sp.spanY.lo, Z = sp.spanZ.hi - sp.spanZ.lo;
    assert.equal(X, Y, `cube X==Y at ${foot}/${layers}`);
    assert.equal(X, Z, `cube X==Z at ${foot}/${layers}`);
    assert.equal(X, Math.min(foot, layers), 'cube side = min(foot, layers)');
    assert.ok(sp.spanX.lo >= 0 && sp.spanX.hi <= foot, 'X inside grid');
    assert.ok(sp.spanY.lo >= 0 && sp.spanY.hi <= foot, 'Y inside grid');
    assert.ok(sp.spanZ.lo >= 0 && sp.spanZ.hi <= layers, 'Z inside grid');
  }
});

// This is the "my model is a speck" failure: the cube is Layers-sized, so with the shipped defaults
// (Resolution 64, Base layers 16) it fills 1/64th of the grid. Documented so the ratio can't drift silently.
test('cube-vs-grid occupancy is measured, not assumed', () => {
  const occ = (foot, layers) => Math.pow(Math.min(foot, layers), 3) / (foot * foot * layers);
  // measured, not estimated: 16³ = 4096 of 64·64·16 = 65536 → 1/16 of the volume, and 16/64 = a QUARTER of
  // the grid's width. That is the "my model is a speck" default.
  assert.ok(near(occ(64, 16), 1 / 16), `defaults occupy ${occ(64, 16)} of the grid volume`);
  assert.ok(near(Math.min(64, 16) / 64, 0.25), 'and only a quarter of its width');
  assert.equal(occ(64, 64), 1, 'Layers == Resolution fills the grid');
});

// ── 4. Axis maps must be bijections, or the grid view aliases cells ──────────────────────────────
test('top/side/front/back map every cell to exactly one voxel', () => {
  const foot = 12, layers = 7, AX = axisMaps(foot, layers);
  for (const name of ['top', 'side', 'front', 'back']) {
    const ax = AX[name], seen = new Set();
    for (let s = 0; s < ax.depth; s++) for (let r = 0; r < ax.rows; r++) for (let c = 0; c < ax.cols; c++) {
      const [x, y, z] = ax.toVox(c, r, s);
      assert.ok(x >= 0 && x < foot && y >= 0 && y < foot && z >= 0 && z < layers, `${name} in range`);
      const k = `${x},${y},${z}`;
      assert.ok(!seen.has(k), `${name}: voxel ${k} reached twice — cells alias`);
      seen.add(k);
    }
    assert.equal(seen.size, foot * foot * layers, `${name} must reach every voxel`);
  }
});

// ── 5. The Geometry overlay must agree with the axis maps (this one shipped broken) ──────────────
test('GEOAX draws the box where the voxels actually are', () => {
  const foot = 12, layers = 7, AX = axisMaps(foot, layers);
  const spans = { spanX: { lo: 3, hi: 9 }, spanY: { lo: 2, hi: 5 }, spanZ: { lo: 0, hi: 4 } };
  const inSpan = ([x, y, z]) => x >= spans.spanX.lo && x < spans.spanX.hi && y >= spans.spanY.lo
    && y < spans.spanY.hi && z >= spans.spanZ.lo && z < spans.spanZ.hi;
  for (const name of ['top', 'side', 'front', 'back']) {
    const ax = AX[name], cols = [], rows = [];
    for (let s = 0; s < ax.depth; s++) for (let r = 0; r < ax.rows; r++) for (let c = 0; c < ax.cols; c++)
      if (inSpan(ax.toVox(c, r, s))) { cols.push(c); rows.push(r); }
    const observed = { col: { lo: Math.min(...cols), hi: Math.max(...cols) + 1 },
                       row: { lo: Math.min(...rows), hi: Math.max(...rows) + 1 } };
    for (const which of ['col', 'row']) {
      const drawn = geoRange(GEOAX[name][which], spans, foot, layers);
      assert.deepEqual(drawn, observed[which], `${name} ${which}: box drawn at [${drawn.lo},${drawn.hi}) but voxels are at [${observed[which].lo},${observed[which].hi})`);
    }
  }
});

// ── 6. Grounding: the carved model must end up standing on z=0 ───────────────────────────────────
test('groundVoxels drops a floating model onto the ground and preserves it', () => {
  const { groundVoxels } = createRequire(import.meta.url)('./slice-geom.js');
  const foot = 4, layers = 8, N = foot * foot;
  const fill = new Uint8Array(layers * N), vcol = new Uint8Array(layers * N * 3);
  // a 2-layer slab floating at z=3..4, each layer a distinct colour so we can prove colours move with it
  for (const [z, col] of [[3, 11], [4, 22]]) for (let i = 0; i < N; i++) {
    fill[z * N + i] = 1; vcol[(z * N + i) * 3] = col;
  }
  const dropped = groundVoxels(fill, vcol, foot, layers);
  assert.equal(dropped, 3, 'must report the drop distance');
  const occupied = [];
  for (let z = 0; z < layers; z++) { let any = false; for (let i = 0; i < N; i++) if (fill[z * N + i]) any = true; if (any) occupied.push(z); }
  assert.deepEqual(occupied, [0, 1], 'slab now sits at z=0..1');
  assert.equal(vcol[0 * N * 3], 11, 'z=0 keeps the lower layer colour');
  assert.equal(vcol[1 * N * 3], 22, 'z=1 keeps the upper layer colour');
  let count = 0; for (let i = 0; i < fill.length; i++) if (fill[i]) count++;
  assert.equal(count, 2 * N, 'no voxels gained or lost');
});

test('groundVoxels is a no-op when already grounded, and safe when empty', () => {
  const { groundVoxels } = createRequire(import.meta.url)('./slice-geom.js');
  const foot = 3, layers = 4, N = foot * foot;
  const grounded = new Uint8Array(layers * N); grounded[0] = 1;
  assert.equal(groundVoxels(grounded, null, foot, layers), 0, 'already grounded → 0');
  assert.equal(grounded[0], 1, 'and untouched');
  assert.equal(groundVoxels(new Uint8Array(layers * N), null, foot, layers), 0, 'empty → 0, no throw');
});
