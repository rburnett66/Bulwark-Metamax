// Outpost model content (MM-story_mw5oect7_m): the manifest and GLBs the outpost screen loads are committed data,
// so a code-only deploy would render nothing (CLAUDE.md). Guards the contract tools/blender/outposts/publish.py writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../content/outposts/', import.meta.url));
const manifest = JSON.parse(readFileSync(DIR + 'outposts.json', 'utf8'));

function glbJson(file) {
  const b = readFileSync(DIR + file);
  assert.equal(b.toString('ascii', 0, 4), 'glTF', `${file} is a GLB`);
  return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
}

test('every Verdance contract-1 building and rig is published', () => {
  for (const slug of ['hub', 'shuttle', 'power', 'storage', 'rig_auger', 'rig_laser', 'rig_brine']) {
    assert.ok(manifest[slug], `${slug} in outposts.json`);
  }
});

test('each model ships three LOD files that exist, each lighter than the last', () => {
  for (const [slug, m] of Object.entries(manifest)) {
    assert.equal(m.lods.length, 3, slug);
    for (const l of m.lods) assert.ok(existsSync(DIR + l.file), `${l.file} exists`);
    assert.ok(m.lods[0].tris >= m.lods[1].tris && m.lods[1].tris >= m.lods[2].tris, `${slug} LODs shrink`);
  }
});

test('LOD0 stays within the tech plan budgets (§6.2)', () => {
  const budget = { hub: 12000, shuttle: 3000, power: 8000, power_ii: 9000, storage: 9000 };
  for (const [slug, m] of Object.entries(manifest)) {
    const cap = budget[slug] ?? (slug.startsWith('rig_') ? 8000 : 10000);
    assert.ok(m.lods[0].tris <= cap, `${slug} LOD0 ${m.lods[0].tris} ≤ ${cap}`);
  }
});

test('the rigs carry looping work clips, each on a pivot node the game can find by its node extra', () => {
  for (const slug of ['rig_auger', 'rig_laser', 'rig_brine']) {
    const j = glbJson(manifest[slug].lods[0].file);
    assert.ok((j.animations || []).length > 0, `${slug} has clips`);
    for (const a of j.animations) {
      for (const c of a.channels) {
        const node = j.nodes[c.target.node];
        assert.equal(node.extras?.node, a.name, `${slug} clip ${a.name} drives node ${a.name}`);
        assert.equal(node.extras?.pivot, true, `${slug} ${a.name} is a pivot node`);
      }
    }
  }
});

test('trim and glow use the named material slots the game swaps at load', () => {
  for (const [slug, m] of Object.entries(manifest)) {
    const names = new Set(glbJson(m.lods[0].file).materials.map((x) => x.name));
    assert.ok(names.has('ship_glow'), `${slug} has ship_glow`);
    assert.ok(names.has('outpost_trim'), `${slug} has outpost_trim`);
  }
});
