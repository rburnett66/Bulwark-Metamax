// Proves selection + editing. VOL is the model; a delete is a write and undo is a snapshot restore.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { keyOf, makeSelection, rectToKeys, deleteKeys, addKeys, makeHistory, snapshot } = req('./select.js');
const { carve } = req('./carve.js');

const FOOT = 12, LAYERS = 8, N = FOOT * FOOT;
// the same axis maps the grid view uses
const AX = {
  top:   { cols: FOOT, rows: FOOT,   depth: LAYERS, toVox: (c, r, s) => [c, r, LAYERS - 1 - s] },
  side:  { cols: FOOT, rows: LAYERS, depth: FOOT,   toVox: (c, r, s) => [c, s, LAYERS - 1 - r] },
  front: { cols: FOOT, rows: LAYERS, depth: FOOT,   toVox: (c, r, s) => [FOOT - 1 - s, FOOT - 1 - c, LAYERS - 1 - r] },
};
const solid = () => { const v = new Uint8Array(LAYERS * N); v.fill(1); return v; };

test('the selection is ONE set: add, toggle, remove, and it never duplicates', () => {
  const sel = makeSelection();
  sel.add(5); sel.add(5); sel.add(9);
  assert.equal(sel.size, 2, 'adding twice must not duplicate');
  sel.toggle(9); assert.equal(sel.size, 1, 'toggle removes an existing key');
  sel.toggle(9); assert.equal(sel.size, 2, 'toggle re-adds');
  sel.addAll([1, 2, 3]); assert.equal(sel.size, 5);
  sel.removeAll([1, 2]); assert.equal(sel.size, 3);
  sel.clear(); assert.equal(sel.size, 0);
});

test('a rubber band selects exactly the covered voxels on a real layer', () => {
  const VOL = solid();
  const keys = rectToKeys(VOL, FOOT, LAYERS, AX.top, 3, 2, 2, 4, 5);   // layer 3 -> depth 2
  assert.equal(keys.length, 3 * 4, 'cols 2..4 x rows 2..5 = 12 cells');
  const z = LAYERS - 1 - 2;
  for (const k of keys) {
    const x = k % FOOT, y = ((k / FOOT) | 0) % FOOT, kz = (k / N) | 0;
    assert.equal(kz, z, 'every key must be on the selected layer');
    assert.ok(x >= 2 && x <= 4 && y >= 2 && y <= 5, 'key outside the band');
  }
});

test('layer 0 selects the SURFACE — the first filled voxel along depth', () => {
  const VOL = new Uint8Array(LAYERS * N);
  // one column, filled only at z = 3
  VOL[keyOf(5, 5, 3, FOOT)] = 1;
  const keys = rectToKeys(VOL, FOOT, LAYERS, AX.top, 0, 5, 5, 5, 5);
  assert.deepEqual(keys, [keyOf(5, 5, 3, FOOT)], 'surface pick must find the only filled voxel');
  // add one above it; the surface pick must now return the HIGHER one for a top-down facing
  VOL[keyOf(5, 5, 6, FOOT)] = 1;
  const keys2 = rectToKeys(VOL, FOOT, LAYERS, AX.top, 0, 5, 5, 5, 5);
  assert.deepEqual(keys2, [keyOf(5, 5, 6, FOOT)], 'surface must be the first hit from the camera');
});

test('a selection never contains empty space', () => {
  const VOL = new Uint8Array(LAYERS * N);          // completely empty
  assert.equal(rectToKeys(VOL, FOOT, LAYERS, AX.top, 0, 0, 0, 11, 11).length, 0);
  assert.equal(rectToKeys(VOL, FOOT, LAYERS, AX.top, 2, 0, 0, 11, 11).length, 0);
});

test('the band clamps to the grid and accepts corners in any order', () => {
  const VOL = solid();
  const a = rectToKeys(VOL, FOOT, LAYERS, AX.top, 1, -50, -50, 200, 200);
  assert.equal(a.length, FOOT * FOOT, 'clamped to the whole facing');
  const b = rectToKeys(VOL, FOOT, LAYERS, AX.top, 1, 6, 7, 2, 3);   // reversed drag
  const c = rectToKeys(VOL, FOOT, LAYERS, AX.top, 1, 2, 3, 6, 7);
  assert.deepEqual(b.sort(), c.sort(), 'dragging up-left must equal dragging down-right');
});

test('the SAME set works from any facing — one selection, many views', () => {
  const VOL = solid();
  const sel = makeSelection();
  sel.addAll(rectToKeys(VOL, FOOT, LAYERS, AX.top, 1, 0, 0, 1, 1));
  const n1 = sel.size;
  sel.addAll(rectToKeys(VOL, FOOT, LAYERS, AX.side, 1, 0, 0, 1, 1));
  assert.ok(sel.size > n1, 'a second facing contributes to the same set');
  // re-adding the same band changes nothing — it is a set, not a list
  const n2 = sel.size;
  sel.addAll(rectToKeys(VOL, FOOT, LAYERS, AX.side, 1, 0, 0, 1, 1));
  assert.equal(sel.size, n2);
});

test('DELETE writes VOL[k]=0 and ESC restores exactly', () => {
  const VOL = solid();
  const full = VOL.reduce((a, b) => a + b, 0);
  const keys = rectToKeys(VOL, FOOT, LAYERS, AX.top, 2, 1, 1, 3, 3);
  const { before, removed } = deleteKeys(VOL, keys);
  assert.equal(removed, keys.length);
  assert.equal(VOL.reduce((a, b) => a + b, 0), full - keys.length);
  for (const k of keys) assert.equal(VOL[k], 0);
  VOL.set(before);
  assert.equal(VOL.reduce((a, b) => a + b, 0), full, 'restore must be exact');
});

test('ADD writes VOL[k]=1 and colours the same index', () => {
  const VOL = new Uint8Array(LAYERS * N), vcol = new Uint8Array(LAYERS * N * 3);
  const k = keyOf(4, 4, 4, FOOT);
  const { added } = addKeys(VOL, vcol, [k], [10, 20, 30]);
  assert.equal(added, 1);
  assert.equal(VOL[k], 1);
  assert.deepEqual([vcol[k * 3], vcol[k * 3 + 1], vcol[k * 3 + 2]], [10, 20, 30]);
  const { added: again } = addKeys(VOL, vcol, [k], [1, 2, 3]);
  assert.equal(again, 0, 'adding an existing voxel adds nothing');
});

test('history undoes and redoes a delete, to the exact array', () => {
  const VOL = solid(), hist = makeHistory(5);
  const keys = rectToKeys(VOL, FOOT, LAYERS, AX.top, 1, 0, 0, 5, 5);
  const start = snapshot(VOL);
  const { before } = deleteKeys(VOL, keys); hist.push(before);
  assert.notDeepEqual(Array.from(VOL), Array.from(start));
  assert.ok(hist.undo(VOL));
  assert.deepEqual(Array.from(VOL), Array.from(start), 'undo must restore exactly');
  assert.ok(hist.redo(VOL));
  assert.equal(VOL.reduce((a, b) => a + b, 0), start.reduce((a, b) => a + b, 0) - keys.length);
  assert.ok(!hist.redo(VOL), 'nothing further to redo');
});

test('history is bounded and drops the oldest', () => {
  const VOL = solid(), hist = makeHistory(3);
  for (let i = 0; i < 6; i++) { const { before } = deleteKeys(VOL, [keyOf(i, 0, 0, FOOT)]); hist.push(before); }
  assert.equal(hist.depth(), 3, 'stack must respect its limit');
});

test('a delete on a real carve removes only what was selected', () => {
  const px = (w, h) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { d[i * 4 + 3] = 255; } return { width: w, height: h, data: d }; };
  const r = carve({ foot: 16, layers: 16, slices: { top: px(64, 64), side: px(64, 64), front: px(64, 64) } });
  const total = r.VOL.reduce((a, b) => a + b, 0);
  const ax = { cols: 16, rows: 16, depth: 16, toVox: (c, rr, s) => [c, rr, 15 - s] };
  const keys = rectToKeys(r.VOL, 16, 16, ax, 0, 0, 0, 15, 15);      // the whole top surface
  assert.equal(keys.length, 16 * 16, 'a solid cube has one surface voxel per column');
  deleteKeys(r.VOL, keys);
  assert.equal(r.VOL.reduce((a, b) => a + b, 0), total - 16 * 16, 'exactly one layer removed');
});
