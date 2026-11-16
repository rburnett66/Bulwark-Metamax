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

// Owner 2026-11-15 "Go ahead" [MM-task_mwim8md7_20]: High/Standard decode each hull map once per kit, not once per GLB.
test('the shared-texture plugin decodes each distinct embedded image once, for every GLB the kit reads', async () => {
  const { sharedTexturePlugin, imageKey } = await import('./outpostModels.js');
  const cache = new Map();
  let decodes = 0;
  const fakeParser = (images, samplers = [{ magFilter: 9729 }]) => ({
    json: { images: images.map((_, i) => ({ bufferView: i, mimeType: 'image/png' })), textures: images.map((_, i) => ({ source: i, sampler: 0 })), samplers },
    textureLoader: {},
    getDependency: (type, i) => Promise.resolve(images[i].buffer),
    loadTextureImage: (i) => Promise.resolve({ decoded: ++decodes, i }),
  });
  const plug = sharedTexturePlugin(cache);
  const a = new Uint8Array([1, 2, 3, 4]), b = new Uint8Array([9, 9, 9]);
  const p1 = plug(fakeParser([a, b])), p2 = plug(fakeParser([new Uint8Array(a), new Uint8Array(b)]));
  const t1 = await Promise.all([p1.loadTexture(0), p1.loadTexture(1)]), t2 = await Promise.all([p2.loadTexture(0), p2.loadTexture(1)]);
  assert.equal(decodes, 2, 'two distinct images: two decodes, not four');
  assert.equal(t1[0], t2[0]); assert.equal(t1[1], t2[1]); assert.notEqual(t1[0], t1[1]);
  await plug(fakeParser([a], [{ magFilter: 9728 }])).loadTexture(0);
  assert.equal(decodes, 3, 'another sampler is another texture');
  assert.equal(plug({ json: { images: [{ uri: 'x.png' }], textures: [{ source: 0 }] } }).loadTexture(0), null, 'a URI image falls through to the loader');
  assert.notEqual(imageKey(a, 'image/png'), imageKey(new Uint8Array([1, 2, 3, 5]), 'image/png'));

  // the shipped GLBs: their embedded images come to a handful of distinct decodes for the whole outpost
  const keys = new Set();
  let images = 0;
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.glb'))) {
    const buf = readFileSync(DIR + f), jl = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8')), bin = 20 + jl + 8;
    for (const im of json.images || []) {
      const bv = json.bufferViews[im.bufferView], off = bin + (bv.byteOffset || 0);
      keys.add(imageKey(buf.subarray(off, off + bv.byteLength), im.mimeType)); images++;
    }
  }
  assert.ok(images > 100 && keys.size <= 3, `${images} embedded images decode as ${keys.size}`);
});

test('the kit shares textures on High/Standard and decodes none when lean', () => {
  const src = readFileSync(new URL('./outpostModels.js', import.meta.url), 'utf8');
  assert.match(src, /if \(lean\) loader\.register\([^\n]*bulwark_lean_no_textures[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*else loader\.register\(sharedTexturePlugin\(new Map\(\)\)\);/);
});
