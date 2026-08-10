/**
 * reproject-all.test.mjs — structural guards on "Re-project ALL".
 *
 * The sweep itself needs a canvas, a carved model and a live gridGeom, so it cannot run headlessly.
 * What CAN be checked without a browser are the two properties that make it correct rather than
 * merely working, and both are easy to regress by accident:
 *
 *   1. ONE undo entry for the whole sweep. reprojectSurface pushes its own history; if the sweep stops
 *      passing noUndo, or someone drops the guard inside reprojectSurface, Ctrl+Z starts undoing a
 *      quarter of the operation — worse than not having the button.
 *   2. SIDE RUNS LAST. Edge voxels are the first hit from more than one direction and hold one colour,
 *      so the final facing wins them. Side is the biggest readable surface on these units; reorder this
 *      and the flanks get flattened with roof colour, which looks like a rendering bug, not an ordering
 *      one — that is exactly the kind of regression a test should catch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, 'stack-forge.js'), 'utf8');
const HTML = readFileSync(join(HERE, 'stack-forge.html'), 'utf8');

function fn(name) {
  const start = SRC.indexOf(`function ${name}(`);
  assert.ok(start > -1, `${name} not found — renamed?`);
  let depth = 0, i = SRC.indexOf('{', start);
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return SRC.slice(start, i);
}

test('the sweep pushes exactly one undo entry', () => {
  const body = fn('reprojectAllFacings');
  const pushes = body.match(/pushVol\w*\(/g) || [];
  assert.equal(pushes.length, 1, `expected 1 history push for the whole sweep, found ${pushes.length}`);
});

test('the sweep drives reprojectSurface with noUndo, so it cannot push per facing', () => {
  const body = fn('reprojectAllFacings');
  assert.match(body, /reprojectSurface\(\{[^}]*noUndo:\s*true/, 'sweep must pass noUndo');
  assert.match(body, /reprojectSurface\(\{[^}]*quiet:\s*true/, 'a facing with no art is a skip, not an alert');
});

test('every pushVol inside reprojectSurface is guarded by noUndo', () => {
  const body = fn('reprojectSurface');
  for (const line of body.split('\n')) {
    if (!/pushVol\w*\(/.test(line)) continue;
    assert.match(line, /if \(!noUndo\)/, `unguarded history push would break the single-undo sweep:\n  ${line.trim()}`);
  }
});

test('SIDE runs last so the flanks win contested edge voxels', () => {
  const body = fn('reprojectAllFacings');
  const m = body.match(/ORDER\s*=\s*\[([^\]]+)\]/);
  assert.ok(m, 'ORDER not found');
  const order = m[1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
  assert.deepEqual(order, ['top', 'front', 'back', 'side']);
  assert.equal(order[order.length - 1], 'side', 'side must be last — it wins the largest readable surface');
  assert.ok(!order.includes('angle'), '¾ Angle owns no face and must never be swept');
});

test('the artist is returned to the facing they were on', () => {
  const body = fn('reprojectAllFacings');
  assert.match(body, /prevView\s*=\s*gridView/, 'must capture the incoming facing');
  assert.match(body, /gridView\s*=\s*prevView/, 'must restore it');
  assert.match(body, /gridViewSeg/, 'the segmented control must be put back in sync too');
});

test('reprojectSurface still behaves as before when called bare', () => {
  const body = fn('reprojectSurface');
  assert.match(body, /opts\s*=\s*opts\s*\|\|\s*\{\}/, 'opts must be optional');
  assert.match(body, /if \(!opts\.quiet\) alert\(m\)/, 'bare calls must still alert');
});

test('the button exists and is wired', () => {
  assert.match(HTML, /id="gridReprojAll"/, 'no Re-project ALL button in the markup');
  assert.match(SRC, /\$\('gridReprojAll'\)\.onclick/, 'button is not wired to the sweep');
});
