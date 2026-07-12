/** sheets.test.mjs — multi-sheet memory: units stay pinned to the sheet their frames came from, so loading
 *  another faction's sheet (e.g. the harness auto-load) can't re-point or blank earlier assignments.
 *  Run: node src/harness/sheets.test.mjs */
import assert from 'node:assert';
class Node { constructor(){ this.children=[]; this.pivot={x:0,y:0,set(a,b){this.x=a;this.y=b;}}; this.scale={x:1,y:1,set(a,b){this.x=a;this.y=b;}}; this.skew={x:0,y:0}; }
  addChild(c){this.children.push(c);return c;} removeChild(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);} destroy(){} }
class Graphics extends Node { clear(){return this;} beginFill(){return this;} endFill(){return this;} drawRect(){return this;} drawRoundedRect(){return this;} drawCircle(){return this;} drawEllipse(){return this;} lineStyle(){return this;} moveTo(){return this;} lineTo(){return this;} }
class Container extends Node { sortChildren(){} }
globalThis.PIXI = { Application: class { constructor(){ this.stage=new Container(); this.view={style:{}}; this.ticker={add(){}}; } }, Container, Graphics, Sprite: class extends Node {} };
const { bootBench } = await import('./bench.js');

const sheetA = { textures: { fA: { width: 100 } }, frameNames: ['fA'] };
const sheetB = { textures: { gB: { width: 80 } }, frameNames: ['gB'] };

const bench = bootBench({ appendChild(){} });
const [u1, u2] = bench.unitsForFaction('Air').map((u) => u.id);

// author u1 under sheet A
bench.loadSheet(sheetA, 'a.png');
assert.strictEqual(bench.hasSheet('a.png'), true, 'a.png registered');
assert.strictEqual(bench.hasSheet('b.png'), false, 'b.png not loaded yet');
bench.setUnit(u1); bench.assignLayer('base', 'fA');
assert.strictEqual(bench.assignments().sheet, 'a.png', 'u1 pinned to the sheet it was authored under');

// loading sheet B (as the auto-load for another faction would) must not re-point u1
bench.loadSheet(sheetB, 'b.png');
bench.setUnit(u2); bench.assignLayer('base', 'gB');
assert.strictEqual(bench.assignments().sheet, 'b.png', 'u2 pinned to b.png');
bench.setUnit(u1);
assert.strictEqual(bench.assignments().sheet, 'a.png', 'u1 still pinned to a.png while b.png is active');

// exports record the units' own sheet, not whichever sheet happens to be active
const def = bench.exportUnitDef();
assert.strictEqual(def.sheet, 'a.png', 'single-unit export records the unit sheet');

// a faction file's sheet is stamped onto every imported unit
const bench2 = bootBench({ appendChild(){} });
const n = bench2.importDefs({ faction: 'Air', sheet: 'a.png', units: { [u1]: { layers: { base: { frame: 'fA', scale: 1, offset: 0 } } } } });
assert.strictEqual(n, 1, 'imported 1 unit');
bench2.setUnit(u1);
assert.strictEqual(bench2.assignments().sheet, 'a.png', 'import pinned the unit to the file sheet');
assert.strictEqual(bench2.assignments().base, 'fA', 'import restored the frame');

console.log('sheets.test OK — per-unit sheet pinning across loads, exports, and imports');
