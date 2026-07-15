// Node test for the voxel unit-pack contract + runtime selection. No PIXI, no browser.
import { validatePack, partById } from './pack.js';
import { angleBucket, mountScreen, altLift } from './select.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; } else { fail++; console.log(`  FAIL ${name} ${extra}`); } };

// golden Abrams pack (tech plan §4)
const abrams = {
  id: 'abrams', class: 'ground', footprint: [64, 64, 16],
  camera: { azimuth: 45, elevation: 30 }, layerSpacing: 2,
  parts: [
    { id: 'body', kind: 'directional', facings: 8, atlas: 'abrams.body.png', cell: [64, 64], pivot: [32, 44], zeroFacing: '+x' },
    { id: 'turret', kind: 'stack', angles: 64, atlas: 'abrams.turret.png', cell: [64, 64], pivot: [32, 44], mount: [0, 0, 9] },
  ],
  shadow: { kind: 'ellipse', rx: 33, ry: 14, alt: 0 }, stats: { speed: 90, turnRate: 3, turretRate: 4 },
};

const v = validatePack(abrams);
ok('valid Abrams pack', v.ok, JSON.stringify(v.errors));
ok('partById turret', partById(abrams, 'turret')?.kind === 'stack');

// broken packs must be caught
ok('missing camera caught', !validatePack({ ...abrams, camera: null }).ok);
ok('bad class caught', !validatePack({ ...abrams, class: 'boat' }).ok);
ok('stack without angles caught', !validatePack({ ...abrams, parts: [{ id: 't', kind: 'stack', atlas: 'a', cell: [1, 1], pivot: [0, 0] }] }).ok);
ok('empty parts caught', !validatePack({ ...abrams, parts: [] }).ok);

// angle buckets match the prototype's bucketOf (bucket-0 = +X, STEP = 2π/n)
ok('bucket 0 -> 0', angleBucket(0, 64) === 0);
ok('bucket 2π -> 0', angleBucket(Math.PI * 2, 64) === 0);
ok('bucket π/2 -> 16/64', angleBucket(Math.PI / 2, 64) === 16);
ok('bucket π -> 32/64', angleBucket(Math.PI, 64) === 32);
ok('bucket -π/2 wraps -> 48/64', angleBucket(-Math.PI / 2, 64) === 48);
ok('directional 8: π/4 -> 1', angleBucket(Math.PI / 4, 8) === 1);

// mount + alt
const ms = mountScreen([0, 0, 9], 2);
ok('mount [0,0,9] @ sp2 lifts 18px up', ms.x === 0 && ms.y === -18, JSON.stringify(ms));
ok('ground alt = 0', altLift({ alt: 0 }) === 0);
ok('air alt = 30', altLift({ alt: 30 }) === 30);

console.log(`\nvoxel pack/select: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

// ── stack camera math ──
import { elevationToSP, spToElevation, layerScreenY, stackRise } from './stack.js';
let p2 = 0, f2 = 0; const ok2 = (n, c) => { if (c) p2++; else { f2++; console.log(`  FAIL ${n}`); } };
ok2('top-down (90°) → SP 0', elevationToSP(90, 6) === 0);
ok2('side-on (0°) → SP max', elevationToSP(0, 6) === 6);
ok2('elevation monotonic (30>60 in SP)', elevationToSP(30, 6) > elevationToSP(60, 6));
ok2('sp↔elevation round-trips at ends', spToElevation(0, 6) === 90 && spToElevation(6, 6) === 0);
ok2('layer 0 at baseY', layerScreenY(0, 100, 2) === 100);
ok2('layer 5 rises 10px @ sp2', layerScreenY(5, 100, 2) === 90);
ok2('16-layer rise @ sp2 = 30', stackRise(16, 2) === 30);
console.log(`voxel stack math: ${p2} passed, ${f2} failed`);
if (f2) process.exit(1);
