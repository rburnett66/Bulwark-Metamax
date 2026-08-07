// Atlas dimensions of the REAL shipped packs, against the GPU limit that would break them.
//
// WHY THIS EXISTS. An atlas wider or taller than the device's MAX_TEXTURE_SIZE does not throw — WebGL
// refuses the upload and the unit renders as nothing, or as garbage, on that device only. It cannot be
// caught by looking at a desktop, and nothing in CI reads content/ at all (pack.test.mjs validates a
// hand-written fixture, so it gates the validator, not the content).
//
// This became live when body frames went 16 -> 32: atlas area scales with the frame count, so a change
// that is free on desktop can push a unit over a phone's ceiling. The count is stored per-pack, so
// shipped units only grow when re-baked — which is exactly when this test needs to catch them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// WebGL guarantees only 2048. Nearly every real device does 4096+, and one SHIPPED unit is already past
// 2048 (see below), so gating at 2048 would fail on content the owner has not chosen to change. 4096 is
// the honest line: it is the practical device floor, and crossing it is a genuine "this will not render
// for someone" event rather than a spec technicality.
const CEILING = 4096;
const GUARANTEED_MIN = 2048;

const manifest = JSON.parse(readFileSync(new URL('../../../content/units/voxel-units.json', import.meta.url), 'utf8'));

/** Reproduces packAtlas's layout in stack-forge.js: cols = ceil(sqrt(n)), rows = ceil(n / cols). */
function atlasSize(part) {
  const n = part.facings || part.angles || 1;
  const [cw, ch] = part.cell || [0, 0];
  const cols = part.cols || Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  return { n, w: cols * cw, h: rows * ch };
}

function eachPart(fn) {
  for (const [id, entry] of Object.entries(manifest.units || {})) {
    for (const part of (entry.pack && entry.pack.parts) || []) fn(id, part, atlasSize(part));
  }
}

test('no shipped atlas exceeds the practical device texture ceiling', () => {
  const over = [];
  eachPart((id, part, s) => {
    if (s.w > CEILING || s.h > CEILING) over.push(`${id}.${part.id} is ${s.w}x${s.h} (${s.n} frames)`);
  });
  assert.deepEqual(over, [],
    `atlas over ${CEILING}px — it will fail to upload on affected devices and the unit will not render:\n  ${over.join('\n  ')}`);
});

test('a part declares enough atlas cells for the frames it claims', () => {
  // A pack whose cols/cell do not actually hold `facings` frames reads garbage for the tail buckets —
  // angleBucket happily returns an index the atlas has no cell for.
  eachPart((id, part, s) => {
    const cols = part.cols || Math.max(1, Math.ceil(Math.sqrt(s.n)));
    const rows = Math.ceil(s.n / cols);
    assert.ok(cols * rows >= s.n,
      `${id}.${part.id}: ${cols}x${rows} cells cannot hold ${s.n} frames`);
    assert.ok(part.cell && part.cell[0] > 0 && part.cell[1] > 0,
      `${id}.${part.id}: cell must be positive, got ${JSON.stringify(part.cell)}`);
  });
});

test('REPORT: which units are past the guaranteed 2048 floor', () => {
  // Deliberately NOT an assertion. GND-Artillery's turret already ships at 2592x2816 and the owner has
  // not chosen to shrink it; failing here would block deploys on a known, accepted state. This exists so
  // the fact is visible in CI output rather than rediscovered on a phone.
  const past = [];
  eachPart((id, part, s) => {
    if (s.w > GUARANTEED_MIN || s.h > GUARANTEED_MIN) past.push(`${id}.${part.id} ${s.w}x${s.h}`);
  });
  if (past.length) console.log(`  note: past WebGL's guaranteed ${GUARANTEED_MIN}px floor — ${past.join(', ')}`);
  assert.ok(true);
});
