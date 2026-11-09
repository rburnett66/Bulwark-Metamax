// The outpost kit shares one texture per material slot across every GLB and LOD (outpostModels.js shareTextures;
// owner 2026-11-09 iPhone error report: 236 MB of duplicate panel maps). That is only right while every file maps the
// same image bytes into the same (material, slot): this test reads the GLBs and holds them to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../../content/outposts/', import.meta.url));

function readGlb(file) {
  const b = readFileSync(DIR + file);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
  const bin = 20 + jsonLen + 8;
  const imageHash = (i) => {
    const bv = json.bufferViews[json.images[i].bufferView];
    const off = bin + (bv.byteOffset || 0);
    return createHash('sha1').update(b.subarray(off, off + bv.byteLength)).digest('hex');
  };
  return { json, imageHash };
}

test('every outpost GLB maps the same image into the same material slot (so the kit may share them)', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.glb'));
  assert.ok(files.length > 0);
  const bySlot = new Map();
  for (const f of files) {
    const { json, imageHash } = readGlb(f);
    for (const m of json.materials || []) {
      const pbr = m.pbrMetallicRoughness || {};
      const slots = { map: pbr.baseColorTexture, metalRough: pbr.metallicRoughnessTexture, normal: m.normalTexture, ao: m.occlusionTexture, emissive: m.emissiveTexture };
      for (const [slot, ref] of Object.entries(slots)) {
        if (!ref) continue;
        assert.ok(m.name, `${f}: a textured material needs a name (the kit keys shared textures by it)`);
        const h = imageHash(json.textures[ref.index].source), key = `${m.name}|${slot}`;
        if (!bySlot.has(key)) bySlot.set(key, { h, f });
        else assert.equal(h, bySlot.get(key).h, `${f}: ${key} maps a different image from ${bySlot.get(key).f}`);
      }
    }
  }
});
