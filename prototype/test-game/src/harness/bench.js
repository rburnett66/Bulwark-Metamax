/**
 * prototype/test-game/src/harness/bench.js  [state-harness sh-m1.s3/s4/s5]
 *
 * The interactive State Harness BENCH: pick a FACTION -> pick a UNIT -> see its part-stack rendered under the
 * pseudo-3D camera and DRIVE it through its states (scan / acquire / attack-aim / damage / heal / death). The
 * unit + its state are REAL sim entities (createUnit) read through readout.js; buildPartStack renders it;
 * drive.applyReadout wires the readout -> part transforms; camera.project places it (move it to see depth/skew).
 * No art pipeline — the whole bench boots from the game's Pixi global + the unit data.
 */
import { buildPartStack } from './partstack.js';
import { project, shadowFor } from './camera.js';
import { unitReadout } from './readout.js';
import { unitParts } from './parts.js';
import { applyReadout } from './drive.js';
import { UNITS, WAVES, MAP } from '../data/tables.js';
import { createSim } from '../sim/core.js';
import { createUnit } from '../sim/entities.js';

// A small, near-square bench "arena" so the camera gives a useful depth/scale range (unlike the full 64x32 map).
const BENCH_MAP = { cols: 7, rows: 7, tile: 60 };
const BASE_SCALE = 2.2;         // scale the small part-stack up so it reads clearly on the bench
const TARGET_ID = 990001;       // sentinel id for the bench's movable practice target

// ── Faction / unit selection (data-driven from UNITS) ────────────────────────────────────────────────
export function factions() {
  const out = [];
  for (const id in UNITS) { const f = UNITS[id].faction; if (f && !out.includes(f)) out.push(f); }
  return out.sort();
}

export function unitsForFaction(faction) {
  const out = [];
  for (const id in UNITS) if (UNITS[id].faction === faction) out.push({ id, label: unitLabel(id) });
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function unitLabel(id) {
  const d = UNITS[id];
  if (!d) return id;
  return `${d.role || id} — ${d.shape || d.domain || ''}`.trim();
}

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

  const b = { unitId: null, cell: { x: 3, y: 5 }, stack: null, sim: null, unit: null,
              targetOn: false, targetDeg: -90 };

  function rebuildSim() {
    b.sim = createSim(1, { waves: WAVES, map: MAP });
    if (!b.sim.units) b.sim.units = new Map();
    if (!b.sim.structures) b.sim.structures = new Map();
    b.unit = createUnit(b.sim, b.unitId, 1, { x: b.cell.x, y: b.cell.y }, 'ground', 'attacker');
    if (b.unit && b.unit.id != null) b.sim.units.set(b.unit.id, b.unit);
    applyTarget();
  }
  function applyTarget() {
    if (!b.unit || !b.sim) return;
    if (b.targetOn) {
      const rad = b.targetDeg * Math.PI / 180;
      b.sim.structures.set(TARGET_ID, { id: TARGET_ID, pos: { x: b.cell.x + Math.cos(rad) * 3, y: b.cell.y + Math.sin(rad) * 3 } });
      b.unit.targetId = TARGET_ID;
    } else {
      b.sim.structures.delete(TARGET_ID);
      b.unit.targetId = null;
    }
  }
  function rebuildStack() {
    if (b.stack) { app.stage.removeChild(b.stack); if (b.stack.destroy) b.stack.destroy({ children: true }); }
    b.stack = buildPartStack(unitParts(UNITS[b.unitId]));
    app.stage.addChild(b.stack);
  }

  app.ticker.add(() => {
    if (!b.stack || !b.unit) return;
    const r = unitReadout(b.sim, b.unit);
    applyReadout(b.stack, r);
    const p = project(BENCH_MAP, b.cell);
    b.stack.x = p.x; b.stack.y = p.y;
    if (b.stack.scale && b.stack.scale.set) b.stack.scale.set(BASE_SCALE * p.scale, BASE_SCALE * p.scale);
    if (b.stack.skew) b.stack.skew.x = p.skewX;
    drawShadow(shadow, shadowFor(BENCH_MAP, b.cell, r.aimAngle), r.health);
  });

  return {
    factions, unitsForFaction,
    setUnit(id) { b.unitId = id; rebuildSim(); rebuildStack(); },
    acquire(on) { b.targetOn = !!on; applyTarget(); },
    moveTarget(deg) { b.targetDeg = deg; applyTarget(); },
    damage(frac) { if (b.unit) b.unit.hp = Math.max(0, b.unit.hp - b.unit.maxHp * (frac || 0.25)); },
    heal(frac) { if (b.unit) b.unit.hp = Math.min(b.unit.maxHp, b.unit.hp + b.unit.maxHp * (frac || 0.25)); },
    kill() { if (b.unit) b.unit.hp = 0; },
    reset() { b.targetOn = false; b.targetDeg = -90; rebuildSim(); },
    moveUnit(dx, dy) {
      b.cell.x = clamp(b.cell.x + dx, 0, BENCH_MAP.cols - 1);
      b.cell.y = clamp(b.cell.y + dy, 0, BENCH_MAP.rows - 1);
      if (b.unit) b.unit.pos = { x: b.cell.x, y: b.cell.y };
      applyTarget();
    },
    readout() { return (b.unit && b.sim) ? unitReadout(b.sim, b.unit) : null; },
    unitDef() { return UNITS[b.unitId] || null; },
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
