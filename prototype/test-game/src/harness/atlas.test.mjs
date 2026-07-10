/**
 * atlas.test.mjs — parseAtlasFrames slices the MetaMax/Pixi atlas.json into frame rects.
 * Run: node src/harness/atlas.test.mjs
 */
import assert from 'node:assert';
import { parseAtlasFrames } from './atlas.js';

// A minimal Pixi/TexturePacker-hash sheet (the shape MetaMax pack_atlas emits).
const sheet = {
  frames: {
    'base.png':   { frame: { x: 0,  y: 0,  w: 40, h: 30 } },
    'weapon.png': { frame: { x: 42, y: 0,  w: 20, h: 8  } },
    'head.png':   { frame: { x: 0,  y: 32, w: 12, h: 12 } },
    'bad':        { note: 'no frame' },   // ignored — no .frame
  },
  meta: { size: { w: 64, h: 64 } },
};

const f = parseAtlasFrames(sheet);
assert.strictEqual(Object.keys(f).length, 3, 'exactly 3 valid frames (bad one dropped)');
assert.deepStrictEqual(f['base.png'], { x: 0, y: 0, w: 40, h: 30 });
assert.strictEqual(f['weapon.png'].x, 42);
assert.strictEqual(f['head.png'].y, 32);

// Tolerant of junk.
assert.deepStrictEqual(parseAtlasFrames(null), {});
assert.deepStrictEqual(parseAtlasFrames({}), {});
assert.deepStrictEqual(parseAtlasFrames({ frames: {} }), {});

console.log('atlas.test OK — parseAtlasFrames slices frames + tolerates junk');
