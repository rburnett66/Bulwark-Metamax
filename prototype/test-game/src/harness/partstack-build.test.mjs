/**
 * prototype/test-game/src/harness/partstack-build.test.mjs  [sh-m1.s3 — the render builder]
 *
 * partstack.test.mjs proves the LAYOUT logic; this proves the RENDER builder actually wires it: run
 * buildPartStack under a minimal PIXI mock (headless) and assert it produces a container with base/weapon/head
 * children in z-order, named parts exposed, and pivots/rotation applied to the sprites. The covering scenario the
 * s7 gate runs for the sh-m1.s3 render side. (Full in-game wiring — a unit's parts driving this — is gated on s2.)
 */
import { buildPartStack } from './partstack.js';

class Node {
  constructor() {
    this.x = 0; this.y = 0; this.rotation = 0; this.zIndex = 0;
    this.pivot = { x: 0, y: 0, set(a, b) { this.x = a; this.y = b; } };
    this.scale = { x: 1, y: 1, set(a, b) { this.x = a; this.y = b; } };
  }
}
globalThis.PIXI = {
  Container: class extends Node {
    constructor() { super(); this.children = []; this.sortableChildren = false; }
    addChild(c) { this.children.push(c); }
    sortChildren() { this.children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)); }
  },
  Graphics: class extends Node {},
  Sprite: class extends Node { constructor(_tex) { super(); } },
};

const c = buildPartStack({
  base: { pivot: { x: 8, y: 8 } },
  weapon: { pivot: { x: 2, y: 6 }, rotation: 1.2 },
  head: { pivot: { x: 4, y: 4 } },
});
const zs = c.children.map((ch) => ch.zIndex);

const checks = [
  ['builds a container with 3 part children', c.children.length === 3],
  ['exposes named parts (base/weapon/head)', !!(c.parts && c.parts.base && c.parts.weapon && c.parts.head)],
  ['children z-order ascending (base<weapon<head)', zs[0] === 0 && zs[1] === 1 && zs[2] === 2],
  ['pivots + rotation applied to sprites', c.parts.base.pivot.x === 8 && c.parts.weapon.rotation === 1.2],
];

console.log('[sh-m1.s3] part-stack render builder (PIXI-mocked)');
let ok = true;
for (const [n, p] of checks) { console.log(`  ${p ? 'PASS' : 'FAIL'}  ${n}`); ok = ok && p; }
console.log(ok ? 'SCENARIO PASS' : 'SCENARIO FAIL');
process.exit(ok ? 0 : 1);
