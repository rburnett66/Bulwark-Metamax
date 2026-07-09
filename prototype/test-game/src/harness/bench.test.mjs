/**
 * prototype/test-game/src/harness/bench.test.mjs  [sh-m1.s5 — bench boot + faction/unit selection + drive]
 *
 * Boots the WHOLE bench headlessly under a minimal PIXI mock + fake mount, then exercises the UX the harness
 * exposes: enumerate factions, pick a unit, and drive it through its states (acquire -> aim, damage -> health
 * drops, destroy -> 0, reset -> restored). Proves the real pipeline is wired end to end (createSim + createUnit
 * + buildPartStack + readout + one render frame) — the covering scenario the s7 gate runs for s5 (and s2's
 * droppable unit parts, since every faction's units must build a stack).
 */
class Node {
  constructor() {
    this.children = []; this.x = 0; this.y = 0; this.rotation = 0; this.alpha = 1; this.zIndex = 0; this.tint = 0xffffff;
    this.pivot = { x: 0, y: 0, set(a, b) { this.x = a; this.y = b; } };
    this.scale = { x: 1, y: 1, set(a, b) { this.x = a; this.y = b; } };
    this.skew = { x: 0, y: 0 };
  }
  addChild(c) { this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
  destroy() {}
}
class Graphics extends Node {
  clear() { return this; } beginFill() { return this; } endFill() { return this; }
  drawRect() { return this; } drawRoundedRect() { return this; } drawCircle() { return this; }
  drawEllipse() { return this; } lineStyle() { return this; } moveTo() { return this; } lineTo() { return this; }
}
class Container extends Node { sortChildren() { this.children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)); } }
let tickFn = null;
class Application {
  constructor() { this.stage = new Container(); this.view = { style: {} }; this.ticker = { add: (fn) => { tickFn = fn; } }; }
}
globalThis.PIXI = { Application, Container, Graphics, Sprite: class extends Node { constructor() { super(); } } };

const { bootBench } = await import('./bench.js');

const checks = [];
const bench = bootBench({ appendChild() {} });

const facs = bench.factions();
checks.push(['factions() enumerates factions', Array.isArray(facs) && facs.length > 0]);

const units = bench.unitsForFaction(facs[0]);
checks.push(['unitsForFaction lists units + labels', units.length > 0 && !!units[0].label]);

bench.setUnit(units[0].id);
let r = bench.readout();
checks.push(['picked unit starts full-health, scanning', !!r && r.health > 0.99 && !r.hasTarget && r.awareness === 0]);

bench.acquire(true);
r = bench.readout();
checks.push(['acquire -> locked on target, weapon has an aim', r.hasTarget && r.awareness === 1 && r.aimAngle != null]);

bench.damage(0.5);
r = bench.readout();
checks.push(['damage -> health drops', r.health < 0.55 && r.health > 0]);

let threw = false;
try { if (tickFn) tickFn(); } catch (e) { threw = true; }
checks.push(['one render frame drives without throwing', tickFn !== null && !threw]);

bench.kill();
checks.push(['destroy -> health 0', bench.readout().health === 0]);

bench.reset();
r = bench.readout();
checks.push(['reset -> restored + target cleared', r.health > 0.99 && !r.hasTarget]);

// every faction's every unit must build a valid part-stack (droppable — sh-m1.s2)
let allBuild = true;
for (const f of facs) for (const u of bench.unitsForFaction(f)) {
  try { bench.setUnit(u.id); if (!bench.readout()) allBuild = false; } catch { allBuild = false; }
}
checks.push(['every faction/unit is droppable (builds a stack)', allBuild]);

console.log('[sh-m1.s5] bench boot + faction/unit selection + state drive');
let ok = true;
for (const [n, p] of checks) { console.log(`  ${p ? 'PASS' : 'FAIL'}  ${n}`); ok = ok && p; }
console.log(ok ? 'SCENARIO PASS' : 'SCENARIO FAIL');
process.exit(ok ? 0 : 1);
