/**
 * prototype/test-game/src/harness/bench.js  [state-harness sh-m1.s3/s4/s5]
 *
 * The interactive State Harness BENCH: pick a FACTION -> pick a UNIT -> see its part-stack rendered under the
 * pseudo-3D camera and DRIVE it through its states (scan / acquire / attack-aim / damage / heal / death). The
 * faction + unit roster is the DESIGN roster (roster.js, generated from the balance xlsx) — all 9 factions, not
 * just the tutorial faction the game's tables.js implements. State is read through the real readout.js;
 * buildPartStack renders the layers; drive.applyReadout wires readout -> part transforms; camera.project places it.
 */
import { buildPartStack } from './partstack.js';
import { project, shadowFor } from './camera.js';
import { unitReadout } from './readout.js';
import { unitParts } from './parts.js';
import { applyReadout } from './drive.js';
import { factionNames, unitsOf, ROSTER } from './roster.js';

// A small, near-square bench "arena" so the camera gives a useful depth/scale range (unlike the full 64x32 map).
const BENCH_MAP = { cols: 7, rows: 7, tile: 60 };
const BASE_SCALE = 2.2;         // scale the small part-stack up so it reads clearly on the bench
const TARGET_ID = 990001;       // sentinel id for the bench's movable practice target

// ── Faction / unit selection (design-driven from roster.js) ──────────────────────────────────────────
export function factions() { return factionNames(); }
export function unitsForFaction(faction) { return unitsOf(faction); }

// ── The bench ────────────────────────────────────────────────────────────────────────────────────────
export function bootBench(mountEl) {
  const boardW = BENCH_MAP.cols * BENCH_MAP.tile, boardH = BENCH_MAP.rows * BENCH_MAP.tile;
  const app = new PIXI.Application({ width: boardW, height: boardH, backgroundColor: 0x0c1014, antialias: true });
  const canvas = app.view || app.canvas;
  canvas.style.display = 'block';
  canvas.style.maxWidth = '100%';
  canvas.style.height = 'auto';
  mountEl.appendChild(canvas);

  const grid = new PIXI.Graphics(); drawGrid(grid); app.stage.addChild(grid);
  const shadow = new PIXI.Graphics(); app.stage.addChild(shadow);   // under the unit

  const b = { unitId: null, cell: { x: 3, y: 5 }, stack: null, state: null, unit: null,
              targetOn: false, targetDeg: -90 };

  // Minimal state + unit built from the DESIGN roster (readout.js only needs hp/maxHp/targetId/pos + a state with
  // base/units/structures). This decouples the bench from tables.js so ALL 72 design units are inspectable.
  function rebuildUnit() {
    const def = ROSTER[b.unitId];
    const maxHp = (def && def.hp && def.hp[0]) || 100;
    b.state = { base: { pos: { x: b.cell.x, y: b.cell.y + 3 } }, units: new Map(), structures: new Map() };
    b.unit = { id: 1, hp: maxHp, maxHp, pos: { x: b.cell.x, y: b.cell.y }, targetId: null };
    applyTarget();
  }
  function applyTarget() {
    if (!b.unit || !b.state) return;
    if (b.targetOn) {
      const rad = b.targetDeg * Math.PI / 180;
      b.state.structures.set(TARGET_ID, { id: TARGET_ID, pos: { x: b.cell.x + Math.cos(rad) * 3, y: b.cell.y + Math.sin(rad) * 3 } });
      b.unit.targetId = TARGET_ID;
    } else {
      b.state.structures.delete(TARGET_ID);
      b.unit.targetId = null;
    }
  }
  function rebuildStack() {
    if (b.stack) { app.stage.removeChild(b.stack); if (b.stack.destroy) b.stack.destroy({ children: true }); }
    b.stack = buildPartStack(unitParts(ROSTER[b.unitId]));
    app.stage.addChild(b.stack);
  }

  app.ticker.add(() => {
    if (!b.stack || !b.unit) return;
    const r = unitReadout(b.state, b.unit);
    applyReadout(b.stack, r);
    const p = project(BENCH_MAP, b.cell);
    b.stack.x = p.x; b.stack.y = p.y;
    if (b.stack.scale && b.stack.scale.set) b.stack.scale.set(BASE_SCALE * p.scale, BASE_SCALE * p.scale);
    if (b.stack.skew) b.stack.skew.x = p.skewX;
    drawShadow(shadow, shadowFor(BENCH_MAP, b.cell, r.aimAngle), r.health);
  });

  return {
    factions, unitsForFaction,
    setUnit(id) { b.unitId = id; rebuildUnit(); rebuildStack(); },
    acquire(on) { b.targetOn = !!on; applyTarget(); },
    moveTarget(deg) { b.targetDeg = deg; applyTarget(); },
    damage(frac) { if (b.unit) b.unit.hp = Math.max(0, b.unit.hp - b.unit.maxHp * (frac || 0.25)); },
    heal(frac) { if (b.unit) b.unit.hp = Math.min(b.unit.maxHp, b.unit.hp + b.unit.maxHp * (frac || 0.25)); },
    kill() { if (b.unit) b.unit.hp = 0; },
    reset() { b.targetOn = false; b.targetDeg = -90; rebuildUnit(); },
    moveUnit(dx, dy) {
      b.cell.x = clamp(b.cell.x + dx, 0, BENCH_MAP.cols - 1);
      b.cell.y = clamp(b.cell.y + dy, 0, BENCH_MAP.rows - 1);
      if (b.unit) b.unit.pos = { x: b.cell.x, y: b.cell.y };
      applyTarget();
    },
    readout() { return (b.unit && b.state) ? unitReadout(b.state, b.unit) : null; },
    unitDef() { return ROSTER[b.unitId] || null; },
  };
}

function drawGrid(g) {
  g.clear(); g.lineStyle(1, 0x1a2028, 0.9);
  for (let x = 0; x <= BENCH_MAP.cols; x++) { g.moveTo(x * BENCH_MAP.tile, 0); g.lineTo(x * BENCH_MAP.tile, BENCH_MAP.rows * BENCH_MAP.tile); }
  for (let y = 0; y <= BENCH_MAP.rows; y++) { g.moveTo(0, y * BENCH_MAP.tile); g.lineTo(BENCH_MAP.cols * BENCH_MAP.tile, y * BENCH_MAP.tile); }
}

function drawShadow(g, sh, health) {
  g.clear();
  g.beginFill(0x000000, 0.3 * (0.4 + 0.6 * Math.max(0, health)));
  g.drawEllipse(0, 0, 20 * sh.scaleX, 10 * sh.scaleY); g.endFill();
  g.x = sh.x; g.y = sh.y; g.rotation = sh.rotation;
}

function clamp(v, a, z) { return Math.max(a, Math.min(z, v)); }
