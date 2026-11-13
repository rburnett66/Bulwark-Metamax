// The outpost decor models and the cargo lift stay within their budget (owner 2026-11-13: "Please create a budget for
// these since they are decoration and do not have real impact on the game") [MM-story_mwfacvte_b].
// Design §2: docs/16 Bulwark MM/design/Outpost-Decor-and-Cargo-Lift.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const DIR = new URL('../../../content/outposts/decor/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('decor.json', DIR), 'utf8'));
const BUDGET = {
  small: { flat: 300, tex: 1200, flatKB: 40, texKB: 120 },
  large: { flat: 600, tex: 2000, flatKB: 40, texKB: 250 },
  lift: { flat: 1200, tex: 4000, flatKB: 40, texKB: 400 },
};

test('the eight models from the reference sheets, each with a flat and a textured LOD', () => {
  assert.deepEqual(Object.keys(manifest).sort(),
    ['antenna', 'cargo_cube', 'cargo_lift', 'chemical_drum', 'road_signs', 'supplies', 'supply_shelf', 'water_tank']);
  assert.equal(manifest.cargo_lift.class, 'lift');
  assert.deepEqual(['cargo_cube', 'supplies'].map((k) => manifest[k].class), ['large', 'large']);
  assert.ok(manifest.cargo_lift.nodes.includes('cube_a') && manifest.cargo_lift.nodes.includes('cube_b'), 'the lift shows 0, 1 or 2 cubes');
});

test('every LOD is within its class budget, and the files are what the manifest says', () => {
  let total = 0;
  for (const [slug, m] of Object.entries(manifest)) {
    const B = BUDGET[m.class];
    for (const lod of ['flat', 'tex']) {
      const L = m.lods[lod];
      assert.ok(L.tris <= B[lod], `${slug} ${lod}: ${L.tris} tris > ${B[lod]}`);
      const bytes = statSync(new URL(L.file, DIR)).size;
      assert.equal(bytes, L.bytes, `${slug} ${lod}: the published file`);
      assert.ok(bytes <= B[lod + 'KB'] * 1024, `${slug} ${lod}: ${bytes} B`);
      total += bytes;
    }
  }
  assert.ok(total <= 1.5 * 1024 * 1024, 'all decor downloads ≤ 1.5 MB: ' + total);
});

test('small decor never blocks a lane: it fits well inside a cell', () => {
  for (const [slug, m] of Object.entries(manifest)) {
    if (m.class !== 'small') continue;
    assert.ok(Math.max(...m.footprint) <= 0.35, `${slug} footprint ${m.footprint}`);
  }
});
