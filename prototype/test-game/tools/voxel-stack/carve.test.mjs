// Proves the carve core. Every case here is a defect that actually shipped in the old tool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { INK_A, sliceMask, carve, bounds, interiorHoles } = createRequire(import.meta.url)('./carve.js');

// ── pixel-buffer helpers (RGBA, alpha 255 = ink, 0 = clear) ──────────────────────────────────────
function buf(w, h, inside) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    if (!inside(x, y)) continue;
    data[p] = 90; data[p + 1] = 100; data[p + 2] = 115; data[p + 3] = 255;
  }
  return { width: w, height: h, data };
}
const full   = (w, h) => buf(w, h, () => true);
const square = (w, h, frac) => buf(w, h, (x, y) => {
  const a = (1 - frac) / 2, b = (1 + frac) / 2;
  return x >= w * a && x < w * b && y >= h * a && y < h * b;
});
const circle = (w, h, r) => buf(w, h, (x, y) => {
  const u = x / w - 0.5, v = y / h - 0.5; return u * u + v * v < r * r;
});

// ── 1. alpha is BINARY ──────────────────────────────────────────────────────────────────────────
test('the mask is strictly 0 or 1, and one threshold decides it', () => {
  const img = buf(64, 64, () => true);
  for (let i = 0; i < 64 * 64; i++) img.data[i * 4 + 3] = 30;      // below INK_A everywhere
  const g = sliceMask(img, 16, 16, false);
  assert.equal(g.m.reduce((a, b) => a + b, 0), 0, 'alpha 30 must read as clear');
  for (let i = 0; i < 64 * 64; i++) img.data[i * 4 + 3] = 41;      // just above
  const g2 = sliceMask(img, 16, 16, false);
  assert.equal(g2.m.reduce((a, b) => a + b, 0), 256, 'alpha 41 must read as ink');
  assert.ok(g2.m.every((v) => v === 0 || v === 1), 'mask values must be binary');
  assert.equal(INK_A, 40);
});

// ── 2. position and size survive — the bug that made every drawing carve the same block ──────────
test('a small centred shape carves a small centred solid, proportional to how it was drawn', () => {
  const foot = 32, layers = 32;
  for (const [frac, want] of [[1.0, 32], [0.5, 16], [0.25, 8], [0.125, 4]]) {
    const s = () => square(400, 400, frac);
    const r = carve({ foot, layers, slices: { top: s(), side: s(), front: s() } });
    const b = bounds(r.VOL, foot, layers);
    assert.equal(b.w, want, `${frac}: width ${b.w} != ${want}`);
    assert.equal(b.d, want, `${frac}: depth ${b.d} != ${want}`);
    assert.equal(b.h, want, `${frac}: height ${b.h} != ${want}`);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2;
    for (const [n, v] of [['x', cx], ['y', cy], ['z', cz]])
      assert.ok(Math.abs(v - (foot - 1) / 2) <= 0.5, `${frac}: not centred on ${n} (${v})`);
  }
});

// ── 3. the canonical cube: exact, solid, closed ─────────────────────────────────────────────────
test('three full slices carve a solid cube filling the grid', () => {
  const foot = 28, layers = 28;
  const r = carve({ foot, layers, slices: { top: full(200, 200), side: full(200, 200), front: full(200, 200) } });
  const n = r.VOL.reduce((a, b) => a + b, 0);
  assert.equal(n, foot * foot * layers, 'must be 100% solid');
  assert.equal(interiorHoles(r.VOL, foot, layers), 0);
  const b = bounds(r.VOL, foot, layers);
  assert.deepEqual([b.w, b.d, b.h], [foot, foot, layers]);
});

// ── 4. the sphere: a tricylinder, solid, no holes ───────────────────────────────────────────────
test('three circular slices carve a solid tricylinder with no interior holes', () => {
  const foot = 32, layers = 32;
  const c = () => circle(256, 256, 0.45);
  const r = carve({ foot, layers, slices: { top: c(), side: c(), front: c() } });
  const n = r.VOL.reduce((a, b) => a + b, 0);
  const b = bounds(r.VOL, foot, layers);
  const solidity = n / (b.w * b.d * b.h);
  assert.ok(solidity > 0.55 && solidity < 0.75, `tricylinder solidity ${solidity.toFixed(3)} out of range`);
  assert.equal(interiorHoles(r.VOL, foot, layers), 0, 'a visual hull cannot contain interior holes');
});

// ── 5. mostly solid, and no geometry outside any slice ──────────────────────────────────────────
test('the carve is mostly solid and never exceeds a slice', () => {
  const foot = 32, layers = 32;
  const hull = (kind) => buf(400, 400, (x, y) => {
    const u = x / 400, v = y / 400;
    if (kind === 'top') return u > 0.10 && u < 0.90 && v > 0.22 && v < 0.78;
    return (u > 0.08 && u < 0.92 && v > 0.45 && v < 0.88) || (u > 0.35 && u < 0.65 && v > 0.22 && v < 0.45);
  });
  const r = carve({ foot, layers, slices: { top: hull('top'), side: hull('side'), front: hull('front') } });
  const b = bounds(r.VOL, foot, layers), n = r.VOL.reduce((a, x) => a + x, 0);
  assert.ok(n / (b.w * b.d * b.h) > 0.6, 'result should be mostly solid');
  assert.equal(interiorHoles(r.VOL, foot, layers), 0);
  // back-project: every filled voxel must be inside every mask that cut
  const N = foot * foot, M = r.masks, { ox, oy, z0 } = r.box, bw = r.box.bw, bh = r.box.bh;
  for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
    if (!r.VOL[z * N + y * foot + x]) continue;
    assert.ok(M.top.m[(y - oy) * bw + (x - ox)], 'voxel outside the TOP slice');
    assert.ok(M.side.m[(z - z0) * bw + (x - ox)], 'voxel outside the SIDE slice');
    assert.ok(M.front.m[(z - z0) * bh + (y - oy)], 'voxel outside the FRONT slice');
  }
});

// ── 6. cuts are cumulative and only ever remove ─────────────────────────────────────────────────
test('each cut only removes; top then top+side then top+side+front is monotonic', () => {
  const foot = 24, layers = 24;
  const s = () => square(256, 256, 0.6);
  const mk = (cuts) => carve({ foot, layers, cuts, slices: { top: s(), side: s(), front: s() } });
  const a = mk({ top: true, side: false, front: false }).VOL.reduce((p, q) => p + q, 0);
  const b = mk({ top: true, side: true, front: false }).VOL.reduce((p, q) => p + q, 0);
  const c = mk({ top: true, side: true, front: true }).VOL.reduce((p, q) => p + q, 0);
  const solid = foot * foot * layers;
  assert.ok(solid >= a && a >= b && b >= c, `not monotonic: solid ${solid} >= ${a} >= ${b} >= ${c}`);
  assert.ok(c > 0, 'the full carve must not be empty');
});

// ── 7. a missing slice cuts nothing on its axis (it cannot add material) ────────────────────────
test('a missing slice leaves its axis solid rather than unbounded or empty', () => {
  const foot = 20, layers = 20;
  const s = square(256, 256, 0.5);
  const withTopOnly = carve({ foot, layers, slices: { top: s } });
  const b = bounds(withTopOnly.VOL, foot, layers);
  assert.equal(b.h, layers, 'no side/front → full height extrusion');
  assert.equal(b.w, 10); assert.equal(b.d, 10);
  assert.equal(interiorHoles(withTopOnly.VOL, foot, layers), 0);
});

// ── 8. VOL is the model — editing it is a plain write, and bounds/holes follow ───────────────────
test('VOL is directly editable: clearing a voxel removes it, restoring puts it back', () => {
  const foot = 16, layers = 16;
  const f = () => full(64, 64);
  const r = carve({ foot, layers, slices: { top: f(), side: f(), front: f() } });
  const N = foot * foot, k = 8 * N + 8 * foot + 8;
  const before = r.VOL.slice();
  assert.equal(r.VOL[k], 1);
  r.VOL[k] = 0;                                            // delete
  assert.equal(r.VOL.reduce((a, b) => a + b, 0), foot * foot * layers - 1);
  assert.equal(interiorHoles(r.VOL, foot, layers), 1, 'the hole we just made should be detectable');
  r.VOL.set(before);                                       // undo = restore the snapshot
  assert.deepEqual(Array.from(r.VOL), Array.from(before));
  assert.equal(interiorHoles(r.VOL, foot, layers), 0);
});
