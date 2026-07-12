/**
 * prototype/test-game/src/harness/partstack.test.mjs  [sh-m1.s3/s4 — the DoD scenario]
 *
 * The reconciled part-stack + camera as a deterministic, headless assertion (the shape the s7 gate runs):
 *   - the part-stack layout is base < weapon < head with pivots/transforms preserved,
 *   - the camera projects the bottom-mid as upright + full-size, and far as a SUBTLE size falloff — with NO
 *     skew/distortion; the pseudo-3D is a per-layer positional LEAN (layerLean) that grows with height and
 *     off-centre/depth, and is exactly zero at the bottom-centre.
 */
import { partStackLayout } from './partstack.js';
import { project, layerLean } from './camera.js';

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

// pseudo-3D lean of the HEAD layer (height 3) at each spot
const leanBottomMid = layerLean(map, { x: 31.5, y: 31 }, 3);
const leanTopMid = layerLean(map, { x: 31.5, y: 0 }, 3);
const leanBottomLeft = layerLean(map, { x: 4, y: 31 }, 3);
const leanHead = layerLean(map, { x: 4, y: 0 }, 3);
const leanWeapon = layerLean(map, { x: 4, y: 0 }, 2);

const checks = [
  ['z-order base < weapon < head', layout.map((l) => l.name).join(',') === 'base,weapon,head'],
  ['pivots + rotation preserved', base.pivot.x === 8 && weapon.rotation === 1.2],
  ['bottom-mid = upright + full size, NO skew ever', Math.abs(nearMid.skewX) < 1e-9 && nearMid.scale > 0.95],
  ['far = subtle size falloff, still NO skew', farLeft.scale < nearMid.scale && Math.abs(farLeft.skewX) < 1e-9],
  ['bottom-centre: layers perfectly aligned (zero lean)', Math.abs(leanBottomMid.dx) < 1e-9 && Math.abs(leanBottomMid.dy) < 1e-9],
  ['top-centre: upper layer leans UP (away), no sideways', leanTopMid.dy < 0 && Math.abs(leanTopMid.dx) < 1e-9],
  ['bottom-left: upper layer leans LEFT, no vertical', leanBottomLeft.dx < 0 && Math.abs(leanBottomLeft.dy) < 1e-9],
  ['head (h3) leans farther than weapon (h2)', Math.abs(leanHead.dx) > Math.abs(leanWeapon.dx)],
];

console.log('[sh-m1.s3/s4] part-stack + camera');
let ok = true;
for (const [name, pass] of checks) { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}`); ok = ok && pass; }
console.log(ok ? 'SCENARIO PASS' : 'SCENARIO FAIL');
process.exit(ok ? 0 : 1);
