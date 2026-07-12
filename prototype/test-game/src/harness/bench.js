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
import { project, shadowFor, layerLean, LAYER_HEIGHT } from './camera.js';
import { unitReadout } from './readout.js';
import { unitParts, LAYER_FIT } from './parts.js';
import { applyReadout } from './drive.js';
import { UNITS, WAVES, MAP } from '../data/tables.js';
import { createSim } from '../sim/core.js';
import { createUnit } from '../sim/entities.js';

// A small, near-square bench "arena" so the camera gives a useful depth/scale range (unlike the full 64x32 map).
const BENCH_MAP = { cols: 7, rows: 7, tile: 60 };
const BASE_SCALE = 4.4;         // scale the small part-stack up so it reads clearly on the bench (~2x the old size)
const TARGET_ID = 990001;       // sentinel id for the bench's movable practice target
// Per-layer sprite normalisation widths now live in parts.js (LAYER_FIT) — shared with the game's
// unitArt.js so the bench preview and the battle map render authored art at IDENTICAL proportions.
const LAYERS = ['base', 'weapon', 'head'];

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
  // DEFINITIVE FORWARD reference: a fixed UP arrow the author rotates each unit's FRONT to align with. "Up = the
  // unit's forward" is the single canonical orientation the GAME relies on (it then turns each unit to face its
  // movement heading). Draw it OVER the unit so it's always visible.
  const forwardGizmo = new PIXI.Graphics();
  let forwardLabel = null;
  try {
    forwardLabel = new PIXI.Text('▲ FORWARD  (aim the unit’s front here)',
      { fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', fill: 0x45e6d0, stroke: 0x06201c, strokeThickness: 3 });
    forwardLabel.anchor.set(0.5, 1);
  } catch (e) { forwardLabel = null; }
  app.stage.sortableChildren = true;
  forwardGizmo.zIndex = 900; app.stage.addChild(forwardGizmo);
  if (forwardLabel) { forwardLabel.zIndex = 900; app.stage.addChild(forwardLabel); }

  const b = { unitId: null, cell: { x: 3, y: 5 }, stack: null, sim: null, unit: null,
              targetOn: false, targetDeg: -90,
              sheet: null, sheetName: '',                    // ACTIVE atlas { textures, frameNames } + its file name
              sheets: {},                                    // every loaded atlas by name — units can span sheets
              byUnit: {} };                                  // PER-UNIT: id -> { base, weapon, head, scale:{...} }

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
    const parts = unitParts(UNITS[b.unitId]);
    const c = cur();
    // Overlay any assigned sheet frame onto its layer as a real sprite: CENTRE pivot (so it sits centred and
    // rotation/scale pivot around the middle) + a per-unit vertical OFFSET (the adjustable height between
    // layers). An unassigned layer keeps its procedural draw, so ANY unit still renders.
    for (const name of LAYERS) {
      const tex = texFor(name);
      if (tex && parts[name]) {
        parts[name] = { sprite: tex, pivot: { x: tex.width / 2, y: tex.height / 2 }, pos: { x: 0, y: (c && c.offset[name]) || 0 } };
      }
    }
    b.stack = buildPartStack(parts);
    // Normalise each chosen sprite to its layer footprint via __fitScale (drive.js multiplies state scale by it).
    for (const name of LAYERS) {
      const tex = texFor(name), part = b.stack.parts[name];
      if (tex && part) part.__fitScale = (LAYER_FIT[name] / Math.max(1, tex.width)) * ((c && c.scale[name]) || 1);
    }
    app.stage.addChild(b.stack);
  }
  // A blank per-unit record: chosen frame per layer (null=procedural) + per-layer size + vertical offset.
  // `sheet` pins the record to the atlas its frames came from, so loading another sheet can't re-point them.
  function newRec() { return { base: null, weapon: null, head: null, scale: { base: 1, weapon: 1, head: 1 }, offset: { base: 0, weapon: 0, head: 0 }, rotation: 0, sheet: null }; }
  // The current unit's assignment record (created on first touch).
  function cur() {
    if (!b.unitId) return null;
    if (!b.byUnit[b.unitId]) b.byUnit[b.unitId] = newRec();
    return b.byUnit[b.unitId];
  }
  function texFor(name) {
    const c = cur(), f = c && c[name];
    if (!f) return null;
    const sheet = (c.sheet && b.sheets[c.sheet]) || b.sheet;   // the unit's own sheet wins over the active one
    return (sheet && sheet.textures[f]) || null;
  }
  function unitDefFor(id) {                                  // PORTABLE def for one unit, or null if unauthored
    const c = b.byUnit[id];
    if (!c || !(c.base || c.weapon || c.head)) return null;
    const d = UNITS[id] || {}, layers = {};
    for (const name of LAYERS) layers[name] = c[name] ? { frame: c[name], scale: c.scale[name] || 1, offset: c.offset[name] || 0 } : null;
    return { unit: id, faction: d.faction || null, shape: d.shape || null, role: d.role || null, rotation: c.rotation || 0, sheet: c.sheet || b.sheetName || null, layers };
  }

  let scanPhase = 0;   // advances each frame to sweep the head while it's scanning for a target
  app.ticker.add(() => {
    if (!b.stack || !b.unit) return;
    const r = unitReadout(b.sim, b.unit);
    applyReadout(b.stack, r);
    // Sensor + turret behaviour:
    //   HEAD  — constantly SCANS (sweeps) while searching, then SNAPS to the target once acquired (locked).
    //   WEAPON— the TURRET turns to AIM at the acquired target; rests (0) when there's none.
    //   BASE  — the body does NOT aim-rotate.
    // Up-facing art convention → point-at-target is aimAngle + 90°.
    const c = cur(), dead = r.health <= 0;
    const parts = b.stack.parts || {};
    const rot = (c && c.rotation ? c.rotation : 0) * Math.PI / 180;   // AUTHORED facing (degrees→rad)

    // Position + a SUBTLE depth size-falloff. The stack itself is screen-aligned (no whole-stack rotation, no
    // skew) — facing is per-layer and the pseudo-3D is a per-layer positional LEAN, so no layer ever distorts.
    const p = project(BENCH_MAP, b.cell);
    b.stack.x = p.x; b.stack.y = p.y;
    // FORWARD reference arrow follows the unit: rotate the unit's FRONT to align UP with this arrow.
    {
      const cx = p.x, cy = p.y, len = BENCH_MAP.tile * 2.0;
      forwardGizmo.clear();
      forwardGizmo.lineStyle(3, 0x45e6d0, 0.95);
      forwardGizmo.moveTo(cx, cy); forwardGizmo.lineTo(cx, cy - len);
      forwardGizmo.moveTo(cx, cy - len); forwardGizmo.lineTo(cx - 7, cy - len + 12);
      forwardGizmo.moveTo(cx, cy - len); forwardGizmo.lineTo(cx + 7, cy - len + 12);
      forwardGizmo.lineStyle(0);
      if (forwardLabel) { forwardLabel.x = cx; forwardLabel.y = cy - len - 4; }
    }
    const S = BASE_SCALE * p.scale;
    if (b.stack.scale && b.stack.scale.set) b.stack.scale.set(S, S);
    if (b.stack.skew) b.stack.skew.x = 0;
    b.stack.rotation = dead ? 0.5 : 0;   // death lists the whole unit over; otherwise screen-aligned

    if (!dead) {
      const aim = r.aimAngle, locked = aim != null;
      scanPhase += 0.045;
      // FACING — per-LAYER sprite rotation (screen-space, since the stack isn't rotated):
      //   base faces the authored orientation; the turret aims at a locked target (else rests facing front);
      //   the head scans around front, then snaps to a locked target.
      if (parts.base) parts.base.rotation = rot;
      if (parts.weapon) parts.weapon.rotation = locked ? (aim + Math.PI / 2) : rot;
      if (parts.head) parts.head.rotation = locked ? (aim + Math.PI / 2) : (rot + Math.sin(scanPhase) * 0.9);
    }

    // CAMERA LEAN — per-layer parallax. Screen-pixel lean ÷ stack scale (layers live in the scaled stack).
    // Base y keeps its authored height nudge; ground/shadow (height 0) never leans. No distortion.
    for (const name of LAYERS) {
      const part = parts[name]; if (!part) continue;
      const lean = layerLean(BENCH_MAP, b.cell, LAYER_HEIGHT[name] || 0);
      const authoredY = (c && c.offset && c.offset[name]) || 0;
      part.x = lean.dx / S;
      part.y = authoredY + lean.dy / S;
    }
    // assigned sprites keep TRUE colours (health/awareness tint is for the vector primitives only)
    for (const nm of LAYERS) { const part = parts[nm]; if (part && c && c[nm]) part.tint = 0xffffff; }
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

    // ── sprite sheet → part-stack layers, PER UNIT (sh-polish.sheets + .author) ──
    loadSheet(sheet, name) {
      b.sheet = sheet || null; b.sheetName = name || '';
      if (sheet && name) b.sheets[name] = sheet;
      if (b.unitId) rebuildStack();   // assignments already referencing this sheet light up immediately
    },
    sheetName() { return b.sheetName; },
    hasSheet(name) { return !!b.sheets[name]; },
    frameNames() { return (b.sheet && b.sheet.frameNames) || []; },
    layers() { return LAYERS.slice(); },
    // Assignments are stored against the CURRENT unit, so each unit in a faction keeps its own sprites.
    assignLayer(name, frame) { const c = cur(); if (c && LAYERS.includes(name)) { c[name] = frame || null; if (frame) c.sheet = b.sheetName || c.sheet; rebuildStack(); } },
    clearLayer(name) { this.assignLayer(name, null); },
    setLayerScale(name, s) { const c = cur(); if (c && LAYERS.includes(name)) { c.scale[name] = Number(s) || 1; rebuildStack(); } },
    // Per-unit VERTICAL offset — the adjustable height between layers.
    setLayerOffset(name, dy) { const c = cur(); if (c && LAYERS.includes(name)) { c.offset[name] = Number(dy) || 0; rebuildStack(); } },
    // Per-unit ROTATION (degrees) — orient the art so it faces the right way; applied in the harness AND baked
    // into the saved def so the game renders the unit at this orientation. (No rebuild — the ticker reads it.)
    setRotation(deg) { const c = cur(); if (c) c.rotation = Number(deg) || 0; },
    // "Rotate ALL the assets" — set the same rotation on EVERY unit that has art (a whole sheet drawn the same
    // way is fixed in one go).
    rotateAllUnits(deg) { const d = Number(deg) || 0; for (const id in b.byUnit) if (this.isAuthored(id)) b.byUnit[id].rotation = d; },
    // The current unit's assignment (for syncing the UI when the unit changes).
    assignments() { const c = cur(); return c ? { base: c.base, weapon: c.weapon, head: c.head, scale: { ...c.scale }, offset: { ...c.offset }, rotation: c.rotation || 0, sheet: c.sheet || null } : null; },

    // ── authoring progress ──
    isAuthored(id) { const c = b.byUnit[id]; return !!(c && (c.base || c.weapon || c.head)); },
    authoredInFaction(faction) { let n = 0; for (const id in UNITS) if (UNITS[id].faction === faction && this.isAuthored(id)) n++; return n; },

    // ── save / load (sh-polish.author) ──
    exportUnitDef() { return unitDefFor(b.unitId); },
    // Every authored unit in a faction, as ONE portable file the engine registry can load.
    exportFaction(faction) {
      const units = {};
      let sheet = null;   // the sheet the faction's authored units actually reference (not just the active one)
      for (const id in UNITS) {
        if (UNITS[id].faction !== faction) continue;
        const def = unitDefFor(id);
        if (!def) continue;
        units[id] = { shape: def.shape, role: def.role, rotation: def.rotation || 0, layers: def.layers };
        if (!sheet) sheet = b.byUnit[id].sheet;
      }
      return { faction, sheet: sheet || b.sheetName || null, units };
    },
    // Restore assignments from a saved faction file { units:{ id:{layers} } } or a single unit def { unit, layers }.
    importDefs(data) {
      const load = (id, u) => {
        if (!id || !u) return 0;
        const c = b.byUnit[id] || (b.byUnit[id] = newRec());
        const layers = u.layers || u;   // tolerate {layers, rotation} OR a bare layers object
        for (const name of LAYERS) {
          const L = layers[name];
          c[name] = (L && L.frame) || null;
          if (L && typeof L.scale === 'number') c.scale[name] = L.scale;
          if (L && typeof L.offset === 'number') c.offset[name] = L.offset;
        }
        if (typeof u.rotation === 'number') c.rotation = u.rotation;
        // pin the record to the file's sheet so its frames resolve even when another sheet is active
        if (data && data.sheet) c.sheet = data.sheet;
        return 1;
      };
      let n = 0;
      if (data && data.units) for (const id in data.units) n += load(id, data.units[id]);
      else if (data && data.unit) n += load(data.unit, data);
      if (b.unitId) rebuildStack();
      return n;
    },
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
