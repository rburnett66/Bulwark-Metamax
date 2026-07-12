/** save.test.mjs — per-unit assignment memory + faction save/load (sh-polish.author). Run: node src/harness/save.test.mjs */
import assert from 'node:assert';
class Node { constructor(){ this.children=[]; this.pivot={x:0,y:0,set(a,b){this.x=a;this.y=b;}}; this.scale={x:1,y:1,set(a,b){this.x=a;this.y=b;}}; this.skew={x:0,y:0}; }
  addChild(c){this.children.push(c);return c;} removeChild(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);} destroy(){} }
class Graphics extends Node { clear(){return this;} beginFill(){return this;} endFill(){return this;} drawRect(){return this;} drawRoundedRect(){return this;} drawCircle(){return this;} drawEllipse(){return this;} lineStyle(){return this;} moveTo(){return this;} lineTo(){return this;} }
class Container extends Node { sortChildren(){} }
globalThis.PIXI = { Application: class { constructor(){ this.stage=new Container(); this.view={style:{}}; this.ticker={add(){}}; } }, Container, Graphics, Sprite: class extends Node {} };
const { bootBench } = await import('./bench.js');
const { UNITS } = await import('../data/tables.js');

const bench = bootBench({ appendChild(){} });
// a fake sheet so assignments resolve to a texture with a width
bench.loadSheet({ textures: { fA: { width: 100 }, fB: { width: 80 }, fC: { width: 60 } }, frameNames: ['fA','fB','fC'] }, 'air.png');

// pick two Air units
const air = bench.unitsForFaction('Air').map(u => u.id);
const [u1, u2] = air;
bench.setUnit(u1); bench.assignLayer('base', 'fA'); bench.setLayerScale('base', 1.5); bench.setLayerOffsetX('base', 12);
bench.setUnit(u2); bench.assignLayer('weapon', 'fB');

// per-unit memory: switching back keeps u1's assignment, not u2's
bench.setUnit(u1);
assert.strictEqual(bench.assignments().base, 'fA', 'u1 remembers base=fA');
assert.strictEqual(bench.assignments().scale.base, 1.5, 'u1 remembers scale');
assert.strictEqual(bench.assignments().offsetX.base, 12, 'u1 remembers horizontal centering');
assert.strictEqual(bench.assignments().weapon, null, 'u1 has no weapon (that was u2)');
bench.setUnit(u2);
assert.strictEqual(bench.assignments().weapon, 'fB', 'u2 remembers weapon=fB');
assert.strictEqual(bench.assignments().base, null, 'u2 has no base');

// progress
assert.strictEqual(bench.authoredInFaction('Air'), 2, '2 Air units authored');
assert.strictEqual(bench.isAuthored(u1), true);
assert.strictEqual(bench.authoredInFaction('Water'), 0, 'no Water units authored');

// faction export contains both, with layers
const fac = bench.exportFaction('Air');
assert.strictEqual(Object.keys(fac.units).length, 2, 'faction export has 2 units');
assert.strictEqual(fac.units[u1].layers.base.frame, 'fA');
assert.strictEqual(fac.units[u1].layers.base.offsetX, 12, 'faction export carries centering');
assert.strictEqual(fac.units[u2].layers.weapon.frame, 'fB');
assert.strictEqual(fac.sheet, 'air.png', 'faction export records the sheet');

// import into a fresh bench restores it
const bench2 = bootBench({ appendChild(){} });
const n = bench2.importDefs(fac);
assert.strictEqual(n, 2, 'imported 2 units');
bench2.setUnit(u1);
assert.strictEqual(bench2.assignments().base, 'fA', 'import restored u1 base');
assert.strictEqual(bench2.assignments().scale.base, 1.5, 'import restored u1 scale');
assert.strictEqual(bench2.assignments().offsetX.base, 12, 'import restored u1 centering');
assert.strictEqual(bench2.authoredInFaction('Air'), 2, 'import restored progress');

console.log('save.test OK — per-unit memory + faction export/import + progress');
