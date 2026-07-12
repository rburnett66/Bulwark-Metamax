/** unitart-scale.test.mjs — bench ↔ battle-map scale parity: the game must render authored
 *  part-stacks at the SAME per-layer proportions and offsets the State Harness authors against.
 *  Run: node src/render/unitart-scale.test.mjs */
import assert from 'node:assert';
class Node { constructor(){ this.children=[]; this.anchor={x:0,y:0,set(a,b){this.x=a;this.y=(b==null?a:b);}}; this.scale={x:1,y:1,set(a,b){this.x=a;this.y=b;}}; }
  addChild(c){this.children.push(c);return c;} destroy(){} }
class Container extends Node { constructor(){ super(); this.sortableChildren=false; } sortChildren(){} }
class Sprite extends Node { constructor(tex){ super(); this.texture=tex; this.width=tex.width; } }
globalThis.PIXI = { Container, Sprite };

const { buildUnitSprite } = await import('./unitArt.js');
const { LAYER_FIT, dimsFor, UNIT_VIS_SCALE } = await import('../harness/parts.js');

const TEXW = 512;   // gallery frames are typically 512px — every layer uses the same source width here
const art = {
  defs: { 'ART-Tanks': { sheet: 's.png', shape: 'Tanks', rotation: 90, layers: {
    base:   { frame: 'b', scale: 1,   offset: 0 },
    weapon: { frame: 'w', scale: 1,   offset: -20, offsetX: 10 },
    head:   { frame: 'h', scale: 0.5, offset: 8 },
  } } },
  sheets: { 's.png': { frames: { b: { width: TEXW }, w: { width: TEXW }, h: { width: TEXW } } } },
};

const tile = 32, radius = 0.3;
const stack = buildUnitSprite(art, 'ART-Tanks', tile, radius);
assert.ok(stack, 'stack built');
const [base, weapon, head] = stack.children;

// base layer = footprint diameter × the BENCH's presence ratio (art 46 wide over a Tanks chassis of 30),
// so a unit reads at the same relative size on the battle map as in the authoring tool
const presence = (LAYER_FIT.base / dimsFor({ shape: 'Tanks' }).w) * UNIT_VIS_SCALE;
assert.ok(Math.abs(presence - (46 / 30) * UNIT_VIS_SCALE) < 1e-9, 'Tanks presence = bench ratio × global magnification');
const targetW = tile * 2 * radius * presence;
assert.ok(Math.abs(base.scale.x * TEXW - targetW) < 1e-9, 'base width == footprint × presence');

// per-layer proportions match the bench's LAYER_FIT ratios (weapon ~65%, head ~39% × authored 0.5)
assert.ok(Math.abs(weapon.scale.x / base.scale.x - LAYER_FIT.weapon / LAYER_FIT.base) < 1e-9,
  'weapon/base ratio == bench LAYER_FIT ratio');
assert.ok(Math.abs(head.scale.x / base.scale.x - 0.5 * LAYER_FIT.head / LAYER_FIT.base) < 1e-9,
  'head/base ratio == bench ratio × authored scale');

// authored height offsets scale with the SAME stack scale as widths (bench: one uniform stack scale)
const stackScale = targetW / LAYER_FIT.base;
assert.ok(Math.abs(weapon.__baseY - (-20 * stackScale)) < 1e-9, 'weapon offset in bench units × stackScale');
assert.ok(Math.abs(head.__baseY - (8 * stackScale)) < 1e-9, 'head offset in bench units × stackScale');

// authored rotation still lands on every layer
assert.ok(Math.abs(base.rotation - Math.PI / 2) < 1e-9, 'authored facing applied');

// horizontal centering = ANCHOR shift (rotates with facing): anchorX = 0.5 - offsetX/(LAYER_FIT × scale)
assert.ok(Math.abs(base.anchor.x - 0.5) < 1e-9, 'no centering → anchor stays 0.5');
assert.ok(Math.abs(weapon.anchor.x - (0.5 - 10 / LAYER_FIT.weapon)) < 1e-9, 'weapon centering shifts the anchor');

console.log('unitart-scale.test OK — battle-map render matches the bench authoring scale exactly');
