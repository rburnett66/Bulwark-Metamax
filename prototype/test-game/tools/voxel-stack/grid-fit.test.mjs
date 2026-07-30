// grid-fit.test.mjs — proves the carve-grid invariant that stops the "clamp / chop" regressions:
// the EFFECTIVE grid is never smaller than the geometry (except at the hard 128 ceiling). node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { CEIL, RES_STEPS, snapRes, effFoot, effLayers } = createRequire(import.meta.url)('./grid-fit.js');

test('snapRes returns the smallest preset ≥ v (ceiling when none fits)', () => {
  assert.equal(snapRes(1), 32);
  assert.equal(snapRes(32), 32);
  assert.equal(snapRes(33), 48);
  assert.equal(snapRes(62), 64);
  assert.equal(snapRes(128), 128);
  assert.equal(snapRes(200), 128);          // over ceiling → ceiling (the only place a clamp can happen)
});

test('INVARIANT: effFoot(stored, ext) ≥ ext for every ext ≤ CEIL — the grid can never be smaller than the geometry', () => {
  for (let stored of RES_STEPS) for (let ext = 0; ext <= CEIL; ext++) {
    const f = effFoot(stored, ext);
    assert.ok(f >= ext, `effFoot(${stored},${ext}) = ${f} < ${ext} — would CLAMP`);
    assert.ok(f >= stored, `effFoot must never shrink below the requested Resolution`);
    assert.ok(RES_STEPS.includes(f), `effFoot must land on a Resolution preset (got ${f})`);
  }
});

test('effFoot: a Resolution drop below the geometry is overridden (no chop) — the Cube/res-drop bug', () => {
  // owner's exact case: unit length 62, then Resolution/Cube set foot to 32.
  assert.equal(effFoot(32, 62), 64);        // stays big enough for the length instead of clamping to 32
  assert.equal(effFoot(128, 62), 128);      // a bigger requested foot is kept as-is
});

test('INVARIANT: effLayers(stored, ext) ≥ ext for every ext ≤ CEIL', () => {
  for (let stored of [4, 12, 16, 32, 64, 128]) for (let ext = 0; ext <= CEIL; ext++) {
    const l = effLayers(stored, ext);
    assert.ok(l >= ext, `effLayers(${stored},${ext}) = ${l} < ${ext} — would CLAMP`);
    assert.ok(l <= CEIL, `effLayers must not exceed the ceiling`);
  }
});

test('the ONLY clamp is the hard ceiling — flagged, never silent', () => {
  assert.equal(effFoot(64, 200), CEIL);     // 200 > 128 → 128 (updateDims shows red, geomSpans warns)
  assert.equal(effLayers(64, 300), CEIL);
});
