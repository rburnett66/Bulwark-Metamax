/**
 * prototype/test-game/src/harness/drive.test.mjs  [sh-m1.s3 — render-drive wiring]
 *
 * Proves the render DRIVE maps a readout onto the part-stack transforms (the thing that makes the bench actually
 * respond): aim rotates the weapon, health scales/fades the base, awareness grows the head, death fades the
 * stack. Uses a plain mock stack (no Pixi) so it's the deterministic covering scenario the s7 gate runs for s3.
 */
import { applyReadout } from './drive.js';

function part() {
  return { rotation: 0, alpha: 1, tint: 0xffffff, scale: { x: 1, y: 1, set(a, b) { this.x = a; this.y = b; } } };
}
function stack() { return { alpha: 1, rotation: 0, parts: { base: part(), weapon: part(), head: part() } }; }

const s = stack();

// 1) locked on target, full health → weapon aims, head grows/brightens, base near full, stack upright
applyReadout(s, { health: 1, hasTarget: true, awareness: 1, aimAngle: 0.8 });
const c1 = [
  ['weapon rotation follows aimAngle', Math.abs(s.parts.weapon.rotation - 0.8) < 1e-9],
  ['head grows when aware', s.parts.head.scale.x > 1 && s.parts.head.alpha === 1],
  ['base ~full at full health', s.parts.base.scale.x > 0.98 && s.parts.base.alpha > 0.98],
  ['stack upright + opaque when alive', s.alpha === 1 && s.rotation === 0],
];

// 2) damaged, no target → weapon rests, base shrinks/fades, head dims
applyReadout(s, { health: 0.2, hasTarget: false, awareness: 0, aimAngle: null });
const c2 = [
  ['weapon returns to rest when idle', s.parts.weapon.rotation === 0],
  ['base shrinks as health drops', s.parts.base.scale.x < 0.85 && s.parts.base.alpha < 0.7],
  ['head dims when unaware', s.parts.head.scale.x === 1 && s.parts.head.alpha < 1],
];

// 3) destroyed → stack fades and lists over
applyReadout(s, { health: 0, hasTarget: false, awareness: 0, aimAngle: null });
const c3 = [
  ['stack fades on death', s.alpha < 1],
  ['stack lists over on death', s.rotation !== 0],
];

console.log('[sh-m1.s3] render-drive: readout -> part-stack transforms');
let ok = true;
for (const [n, p] of [...c1, ...c2, ...c3]) { console.log(`  ${p ? 'PASS' : 'FAIL'}  ${n}`); ok = ok && p; }
console.log(ok ? 'SCENARIO PASS' : 'SCENARIO FAIL');
process.exit(ok ? 0 : 1);
