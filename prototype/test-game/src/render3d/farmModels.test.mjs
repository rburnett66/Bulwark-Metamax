// The farm's models in the game [MM-task_mwagi1nr_1e] (Farming-Design §4.4–§4.5, §6). The Farmhouse, Silo and Pump
// are outpost buildings (tools/blender/outposts/publish.py → content/outposts/outposts.json); the plant GLBs are the
// FARM tab's (tools/blender/farming/publish.py → content/farm/farm-models.json). Both are committed data: a code-only
// deploy would draw nothing (CLAUDE.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { modelSlug } from './outposts/outpostModels.js';

const OUT = fileURLToPath(new URL('../../content/outposts/', import.meta.url));
const FARM = fileURLToPath(new URL('../../content/farm/', import.meta.url));
const outposts = JSON.parse(readFileSync(OUT + 'outposts.json', 'utf8'));
const farm = JSON.parse(readFileSync(FARM + 'farm-models.json', 'utf8'));

function glbJson(path) {
  const b = readFileSync(path);
  assert.equal(b.toString('ascii', 0, 4), 'glTF', `${path} is a GLB`);
  return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
}

// Model units: the pad buildings are modelled 4 units to a 2 × 2 pad and drawn at padModelScale (half scale), so a
// 2 × 2-cell building spans about 4 units and the 1 × 1 Pump about 2. Budgets sit with the pad buildings' (≤ 8–9k).
const BUILDINGS = {
  farmhouse: { cells: 2, lod0: 7000 },
  silo: { cells: 2, lod0: 7000 },
  pump: { cells: 1, lod0: 5000 },
};

test('the Farmhouse, Silo and Pump are published as outpost buildings with three LODs on disk', () => {
  for (const [slug, b] of Object.entries(BUILDINGS)) {
    const m = outposts[slug];
    assert.ok(m, `${slug} in outposts.json`);
    assert.equal(m.kind, slug, `${slug} records its kind`);
    assert.equal(m.lods.length, 3, `${slug} has three LODs`);
    for (const l of m.lods) {
      assert.ok(existsSync(OUT + l.file), `${l.file} exists`);
      assert.equal(statSync(OUT + l.file).size, l.bytes, `${l.file} matches its manifest size`);
    }
    assert.ok(m.lods[0].tris >= m.lods[1].tris && m.lods[1].tris >= m.lods[2].tris, `${slug} LODs shrink`);
    assert.ok(m.lods[0].tris <= b.lod0, `${slug} LOD0 ${m.lods[0].tris} ≤ ${b.lod0}`);
  }
});

test('footprints: Farmhouse and Silo fill a 2 × 2 pad, the Pump 1 × 1 (2 model units to a cell)', () => {
  for (const [slug, b] of Object.entries(BUILDINGS)) {
    const [w, d] = outposts[slug].footprint, span = b.cells * 2;
    for (const v of [w, d]) assert.ok(v <= span + 0.05 && v >= span * 0.85, `${slug} footprint ${w} × ${d} fits ${b.cells} × ${b.cells} cells`);
  }
});

test('modelSlug maps the farm kinds to their files', () => {
  for (const slug of Object.keys(BUILDINGS)) assert.equal(modelSlug(slug, 1), slug);
});

test('the farm buildings use the outpost material slots and drive each clip on its own pivot node', () => {
  for (const slug of Object.keys(BUILDINGS)) {
    const j = glbJson(OUT + outposts[slug].lods[0].file);
    const names = new Set(j.materials.map((x) => x.name));
    for (const n of ['ship_body_v2', 'outpost_trim', 'ship_glow']) assert.ok(names.has(n), `${slug} has ${n}`);
    assert.equal(names.size, 3, `${slug} adds no material of its own (flat colours ride the vertex colour)`);
    for (const a of j.animations || []) {
      for (const c of a.channels) {
        const node = j.nodes[c.target.node];
        assert.equal(node.extras?.node, a.name, `${slug} clip ${a.name} drives node ${a.name}`);
        assert.equal(node.extras?.pivot, true, `${slug} ${a.name} is a pivot node`);
      }
    }
  }
  assert.ok('rotor' in outposts.farmhouse.clips && 'vent' in outposts.silo.clips && 'wheel' in outposts.pump.clips);
  assert.ok(outposts.farmhouse.nodes.includes('inlay') && outposts.farmhouse.nodes.includes('bench'), 'the level inlay and pod bench are nodes');
  assert.ok(outposts.silo.nodes.includes('gauge'), 'the Silo fill gauge is a node');
});

test('the plant GLBs are published with every growth state as a node, small and texture-free', () => {
  assert.deepEqual(farm.states, ['planted', 'sprout', 'plant', 'fruited', 'dead', 'harvested']);
  for (const slug of ['plant_grain', 'plant_leafy']) {
    const m = farm.models[slug];
    assert.ok(m, `${slug} in farm-models.json`);
    assert.ok(existsSync(FARM + m.file), `${m.file} exists`);
    assert.equal(statSync(FARM + m.file).size, m.bytes, `${m.file} matches its manifest size`);
    assert.ok(m.bytes <= 250 * 1024, `${slug} ${m.bytes} bytes ≤ 250 KB`);
    assert.ok(m.tris <= 4000, `${slug} ${m.tris} tris (drawn 16 to a plot)`);
    const j = glbJson(FARM + m.file);
    assert.equal((j.images || []).length, 0, `${slug} carries no texture`);
    const nodeNames = new Set(j.nodes.map((n) => n.extras?.node).filter(Boolean));
    for (const s of farm.states) {
      assert.ok(m.nodes[s], `${slug} lists state ${s}`);
      assert.ok(nodeNames.has(m.nodes[s].node), `${slug} GLB has node ${m.nodes[s].node}`);
      assert.ok(m.nodes[s].tris > 0, `${slug} ${s} has geometry`);
    }
  }
});
