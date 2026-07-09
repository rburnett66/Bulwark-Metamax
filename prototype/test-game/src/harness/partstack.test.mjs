/**
 * prototype/test-game/src/harness/partstack.test.mjs  [sh-m1.s3/s4 — the DoD scenario]
 *
 * The reconciled part-stack + camera as a deterministic, headless assertion (the shape the s7 gate runs):
 *   - the part-stack layout is base < weapon < head with pivots/transforms preserved,
 *   - the camera projects the bottom-mid as upright + full-size (no skew), and far/off-centre as smaller + skewed.
 */
import { partStackLayout } from './partstack.js';
import { project } from './camera.js';

const parts = {
  head: { pivot: { x: 4, y: 4 }, pos: { x: 0, y: -20 } },
  base: { pivot: { x: 8, y: 8 } },
  weapon: { pivot: { x: 2, y: 6 }, rotation: 1.2 },
};
const layout = partStackLayout(parts);
const map = { cols: 64, rows: 32, tile: 32 };
const nearMid = project(map, { x: 31.5, y: 31 });   // bottom-centre = nearest
const farLeft = project(map, { x: 4, y: 0 });        // top-left = far + off-centre

const base = layout.find((l) => l.name === 'base');
const weapon = layout.find((l) => l.name === 'weapon');

const checks = [
  ['z-order base < weapon < head', layout.map((l) => l.name).join(',') === 'base,weapon,head'],
  ['pivots + rotation preserved', base.pivot.x === 8 && weapon.rotation === 1.2],
  ['bottom-mid = upright + full size (no skew)', Math.abs(nearMid.skewX) < 0.02 && nearMid.scale > 0.95],
  ['far/off-centre = smaller + skewed', farLeft.scale < nearMid.scale && Math.abs(farLeft.skewX) > 0.02],
];

console.log('[sh-m1.s3/s4] part-stack + camera');
let ok = true;
for (const [name, pass] of checks) { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`); ok = ok && pass; }
console.log(ok ? 'SCENARIO PASS' : 'SCENARIO FAIL');
process.exit(ok ? 0 : 1);
