/**
 * src/terrain/outpostPads.js — the outpost map layer of a Terrain Forge map: the mesa, the landing pad, the ore
 * deposits, and the checks the Forge shows while authoring [MM-story_mw5oeatc_l].
 *
 * Tech plan docs/tech-plan/Outpost.md §6.6 · design docs/16 Bulwark MM/design/Outpost-Design.md §4.5, §9.
 *
 * An outpost map is an ordinary Forge map (terrain, blocking, decor, resources, spawns) with these top-level fields:
 *   hub:         { x, y, w, h }                       the landing pad (the contract's Outpost Hub), on the battle base
 *   deposits:    [{ tier, x, y }]                     one per tier; a deposit is 2 × 2 cells from (x, y) — a Mining Rig
 *                                                     stands with its top-left on the deposit's (placementRules.js)
 *   clearings:   [{ x, y, w, h }]                     a remote site's cleared yard (terrain only; no building spot)
 *   kitDefenses: [{ kind, cell: [x, y] }]              where the reference kit's defenses start
 *   mesa:        { cx, cy, rx, ry, ramps: [{ x, y, w, h }] }   the raised build mesa (a rounded rectangle)
 *   heights:     [0 | 1 | 2 per cell]                  0 lowland, 1 ramp, 2 mesa top (and its cliff rim)
 * NO BUILD PADS (One Battle UX S2c.2 [MM-story_mwc9pmbn_2i]; owner playtest 2026-11-11: "I thought fixed pads were
 * being removed"): every building is placed freely on the shared battle placement, by its rules (the 1-cell build
 * spacing, the landing pad's HUB_CLEARANCE, the rig on a deposit). Conduits are derived from the grid at runtime
 * (outpost/view/conduits.js), never authored.
 * The mesa itself is stamped into `terrain` (stone top, cliff rim, dirt ramps), so the terrain bake and the battle
 * renderer draw it like any other map; `heights` is the same shape as numbers, for framing and the outpost views.
 * Raid lanes are the map's ground `spawns`; the defense ring is buildable cells (defenseRing() below).
 *
 * Pure and deterministic: no DOM, no clock, no Math.random. Cells are battle cells.
 */
import { TERRAIN, BLOCKING } from './terrainGen.js';
import { structureDef, HUB_CLEARANCE } from '../data/outpost.js';
export { HUB_CLEARANCE };   // the Forge draws the landing pad's clearance ring
import { spacingConflict } from '../sim/structures.js';

export const DEPOSIT_TIERS = Object.freeze(['common', 'uncommon', 'rare']);
export const HEIGHT = Object.freeze({ LOW: 0, RAMP: 1, TOP: 2 });
/**
 * Building sizes in cells (owner 2026-11-08: "the outpost scale is very large compared to the size of the map .. reduce
 * the structures and placement grid by 50%"): the hub 3 × 3 (the battle base's footprint), every other building 2 × 2.
 * The building models are authored for the earlier 6 × 6 hub and 4 × 4 buildings (MODEL_PAD_SIZE); padModelScale
 * scales them.
 */
export const PAD_SIZE = Object.freeze({ hub: 3, pad: 2 });
export const MODEL_PAD_SIZE = Object.freeze({ hub: 6, pad: 4 });
/** The scale a building model draws at on rectangle p: its size over the size the model was made for. */
export const padModelScale = (p) => (p && p.w ? p.w / (p.role === 'hub' ? MODEL_PAD_SIZE.hub : MODEL_PAD_SIZE.pad) : 1);

/** Power Station I's reach in cells (Outpost_Structures, design §4.5: 10). */
export const defaultPowerReach = () => (structureDef('power', 1) || {}).reach || 10;

const dims = (map) => ({ cols: map.cols ?? map.width, rows: map.rows ?? map.height });
const inRectXY = (p, x, y) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h;
/** A deposit's 2 × 2 rectangle. */
export const depositRect = (d) => ({ x: d.x, y: d.y, w: 2, h: 2 });
/** The fixed rectangles of a layout: the landing pad and the deposits (what defenses and fields keep off). */
export const fixedRects = (map) => [...(map.hub ? [map.hub] : []), ...(map.deposits || []).map(depositRect)];
/** Is the cell on the landing pad or a deposit? */
export const onFixed = (map, x, y) => fixedRects(map).some((r) => inRectXY(r, x, y));

// ── the mesa ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Is the cell inside the mesa's rounded rectangle (a superellipse of exponent 4)? */
export function inMesa(mesa, x, y) {
  if (!mesa) return false;
  const dx = (x + 0.5 - mesa.cx) / mesa.rx, dy = (y + 0.5 - mesa.cy) / mesa.ry;
  return dx ** 4 + dy ** 4 <= 1;
}
const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Stamp the outpost onto a generated Forge grid g = { cols, rows, terrain, blocking } (after generateTerrain and
 * placeBase): the mesa top becomes flat open stone (rock-border: walkable, buildable, drawn as the stone plateau of the
 * concept art and baked a band above grass) at height 2, ringed by a cliff rim; ramps cut the rim;
 * each ground lane is worn into a 2-cell cart track from its spawn to the nearest ramp's foot; each authored clearing
 * and each deposit off the mesa (the remote site) gets a flat dirt yard. Sets g.heights, g.clear (cells decor and resources must leave open) and g.lanes (the raid lanes'
 * cart tracks and ramp feet, which the farm-cell layer keeps off: src/terrain/farmCells.js). Mutates g; returns it.
 * layout: { mesa, deposits, clearings, spawns, kitDefenses }.
 */
export function stampOutpost(g, layout) {
  const { cols, rows } = g, n = cols * rows, mesa = layout.mesa;
  const heights = new Uint8Array(n), clear = new Uint8Array(n), lanes = new Uint8Array(n);
  const ok = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const set = (x, y, t) => { const i = y * cols + x; g.terrain[i] = t; g.blocking[i] = BLOCKING.has(t) ? 1 : 0; };
  const ramps = (mesa && mesa.ramps) || [];
  const isRamp = (x, y) => ramps.some((r) => inRect(r, x, y));
  if (mesa) {
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (!inMesa(mesa, x, y)) continue;
      const i = y * cols + x;
      const rim = N4.some(([dx, dy]) => !ok(x + dx, y + dy) || !inMesa(mesa, x + dx, y + dy));
      if (rim && isRamp(x, y)) { set(x, y, TERRAIN.DIRT); heights[i] = HEIGHT.RAMP; clear[i] = 1; }
      else if (rim) { set(x, y, TERRAIN.CLIFF); heights[i] = HEIGHT.TOP; }
      else { set(x, y, TERRAIN.ROCK_BORDER); heights[i] = HEIGHT.TOP; clear[i] = 1; }
    }
    // the foot of each ramp: the lowland cells of its rect, kept open
    for (const r of ramps) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (ok(x, y) && !inMesa(mesa, x, y)) { set(x, y, TERRAIN.DIRT); clear[y * cols + x] = 1; lanes[y * cols + x] = 1; }
    }
  }
  // raid lanes: an L-shaped 2-cell cart track from each ground spawn to its nearest ramp foot
  const feet = ramps.map((r) => {
    const cells = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (ok(x, y) && !inMesa(mesa, x, y)) cells.push([x, y]);
    return cells;
  }).filter((c) => c.length);
  for (const s of (layout.spawns || []).filter((q) => (q.lane || 'ground') === 'ground')) {
    let best = null;
    for (const cells of feet) for (const c of cells) {
      const d = Math.abs(c[0] - s.x) + Math.abs(c[1] - s.y);
      if (!best || d < best.d) best = { d, c };
    }
    if (!best) continue;
    const path = lanePath(s, best.c, (x, y) => mesa && inMesa(mesa, x, y));
    for (const [x, y] of path) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const px = x + ox, py = y + oy;
      if (!ok(px, py) || (mesa && inMesa(mesa, px, py))) continue;
      set(px, py, TERRAIN.DIRT); clear[py * cols + px] = 1; lanes[py * cols + px] = 1;
    }
  }
  // the remote site: a flat dirt yard the size of a building's model footprint (MODEL_PAD_SIZE: the half-scale building
  // sits in its middle), with a 1-cell margin of grass, round each clearing and each deposit off the mesa
  const offMesa = (r) => !mesa || !inMesa(mesa, r.x, r.y);
  for (const p of [...(layout.clearings || []), ...(layout.deposits || []).map(depositRect).filter(offMesa)]) {
    const gw = Math.max(0, Math.floor((MODEL_PAD_SIZE.pad - p.w) / 2)), gh = Math.max(0, Math.floor((MODEL_PAD_SIZE.pad - p.h) / 2));
    const yard = { x: p.x - gw, y: p.y - gh, w: p.w + 2 * gw, h: p.h + 2 * gh };
    for (let y = yard.y - 1; y <= yard.y + yard.h; y++) for (let x = yard.x - 1; x <= yard.x + yard.w; x++) {
      if (!ok(x, y) || (mesa && inMesa(mesa, x, y))) continue;
      set(x, y, inRect(yard, x, y) ? TERRAIN.DIRT : (g.blocking[y * cols + x] ? TERRAIN.GRASS : g.terrain[y * cols + x]));
      clear[y * cols + x] = 1;
    }
  }
  for (const d of layout.kitDefenses || []) if (ok(d.cell[0], d.cell[1])) clear[d.cell[1] * cols + d.cell[0]] = 1;
  g.heights = heights; g.clear = clear; g.lanes = lanes;
  return g;
}

/** An L-shaped path of cells from spawn s to cell t; picks the bend that stays off the mesa (`blocked`). */
export function lanePath(s, t, blocked = () => false) {
  const leg = (a, b, horizontalFirst) => {
    const out = [];
    let x = a.x, y = a.y;
    out.push([x, y]);
    const stepX = () => { while (x !== b[0]) { x += Math.sign(b[0] - x); out.push([x, y]); } };
    const stepY = () => { while (y !== b[1]) { y += Math.sign(b[1] - y); out.push([x, y]); } };
    if (horizontalFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
    return out;
  };
  const h = leg(s, t, true), v = leg(s, t, false);
  const hits = (p) => p.filter(([x, y]) => blocked(x, y) || blocked(x + 1, y) || blocked(x, y + 1)).length;
  return hits(v) < hits(h) ? v : h;
}

// ── the defense ring and the framing ─────────────────────────────────────────────────────────────────────────────
/** Is a cell buildable for a defense: in bounds, open ground (not blocking, not water), not on the landing pad or a deposit? */
export function buildable(map, x, y) {
  const { cols, rows } = dims(map);
  if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
  if (onFixed(map, x, y)) return false;
  const i = y * cols + x;
  if (map.terrain && (map.terrain[i] === TERRAIN.WATER || BLOCKING.has(map.terrain[i]))) return false;
  if (map.blocking && map.blocking[i]) return false;
  return true;
}

/**
 * The defense ring (design §9): buildable cells on the mesa top within 2 cells of its edge, and buildable cells
 * within 2 cells of the remote site (a clearing, or a deposit off the mesa). Needs `heights`; → [[x, y]].
 */
export function defenseRing(map) {
  const { cols, rows } = dims(map), H = map.heights;
  if (!H) return [];
  const out = [], top = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && H[y * cols + x] === HEIGHT.TOP;
  const remote = [...(map.clearings || []), ...(map.deposits || []).map(depositRect).filter((r) => H[r.y * cols + r.x] !== HEIGHT.TOP)];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!buildable(map, x, y)) continue;
    let ring = false;
    if (top(x, y)) {
      for (let dy = -2; dy <= 2 && !ring; dy++) for (let dx = -2; dx <= 2; dx++) if (!top(x + dx, y + dy) && H[(y + dy) * cols + (x + dx)] !== HEIGHT.RAMP) { ring = true; break; }
    } else if (H[y * cols + x] === HEIGHT.LOW) {
      ring = remote.some((p) => x >= p.x - 2 && x < p.x + p.w + 2 && y >= p.y - 2 && y < p.y + p.h + 2);
    }
    if (ring) out.push([x, y]);
  }
  return out;
}

/** The cells to frame so the mesa fills the view: its bounding box (heights > 0) plus `margin`; → { x, y, w, h }. */
export function mesaFrame(map, margin = 1) {
  const { cols, rows } = dims(map);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  if (map.heights) for (let i = 0; i < map.heights.length; i++) if (map.heights[i] > 0) grow(i % cols, (i / cols) | 0);
  if (x0 === Infinity) for (const p of fixedRects(map)) { grow(p.x, p.y); grow(p.x + p.w - 1, p.y + p.h - 1); }
  if (x0 === Infinity) return { x: 0, y: 0, w: cols, h: rows };
  x0 = Math.max(0, x0 - margin); y0 = Math.max(0, y0 - margin);
  x1 = Math.min(cols - 1, x1 + margin); y1 = Math.min(rows - 1, y1 + margin);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ── validation ───────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Every problem with an outpost map's layer, as readable strings; [] when it is valid. The checks (tech plan §6.6,
 * S2c.2):
 *  - the landing pad: present, sized, in bounds, under the map's base (when the map has one: the battle sim's raids
 *    march on the base); on open, flat mesa-top ground (when the map carries terrain);
 *  - deposits: exactly one per tier, each 2 × 2 in bounds on open, flat ground; the common and uncommon on the mesa top,
 *    the rare one off it (the remote site); a rig on any of them clear of the landing pad by HUB_CLEARANCE (the shared
 *    spacing rule) and never on the landing pad;
 *  - no build pads and no authored conduits (the S2c.2 format);
 *  - kit defenses: on buildable cells, off the landing pad and the deposits, clear of the landing pad by HUB_CLEARANCE;
 *  - raid lanes (when spawns are given): at least two ground spawns, each walking to the landing pad.
 * (That the starting kit fits by the shared placement rules is outpost/siting.js referenceKit's job; the outpost
 * tests run it on every shipped map.)
 */
export function validateOutpostLayout(map, { clearance = HUB_CLEARANCE } = {}) {
  const P = [], { cols, rows } = dims(map), deps = map.deposits || [], hub = map.hub || null;
  if (map.pads) P.push('the map still authors build pads (S2c.2: buildings are placed freely; keep only the landing pad `hub`)');
  if (map.conduits) P.push('the map still authors conduits (they are derived from the grid at runtime)');
  const offMap = (r) => r.x < 0 || r.y < 0 || r.x + r.w > cols || r.y + r.h > rows;
  if (!hub) P.push('no landing pad (`hub`)');
  else {
    if (!(hub.w > 0 && hub.h > 0)) P.push('the landing pad has no size');
    if (offMap(hub)) P.push('the landing pad is off the map');
    const bp = map.base && map.base.pos;   // the battle base (raids march on it): world-mode maps pin it at (31, 15)
    if (bp && !inRectXY(hub, bp.x, bp.y)) P.push(`the base (${bp.x}, ${bp.y}) is not on the landing pad`);
  }

  // the ground under a rectangle: blocked cells, and the heights it spans
  const blockedAt = (i) => (map.terrain && (BLOCKING.has(map.terrain[i]) || map.terrain[i] === TERRAIN.WATER)) || (map.blocking && map.blocking[i]);
  const ground = (r) => {
    let bad = 0; const hs = new Set();
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const i = y * cols + x;
      if (blockedAt(i)) bad++;
      if (map.heights) hs.add(map.heights[i]);
    }
    return { bad, flat: hs.size <= 1, top: hs.size === 1 && hs.has(HEIGHT.TOP) };
  };
  const hasGround = !!(map.terrain || map.blocking || map.heights);
  if (hub && hasGround) {
    const g = ground(hub);
    if (g.bad) P.push(`the landing pad sits on ${g.bad} blocked cell${g.bad > 1 ? 's' : ''}`);
    if (!g.flat) P.push('the landing pad is not flat (it spans the mesa edge or a ramp)');
    if (map.heights && map.mesa && !g.top) P.push('the landing pad is not on the mesa top');
  }

  // deposits
  for (const t of DEPOSIT_TIERS) {
    const n = deps.filter((d) => d.tier === t).length;
    if (n !== 1) P.push(`${n} ${t} deposits (needs exactly one)`);
  }
  const rigDef = { spacing: 1, footprint: { w: 2, h: 2 } };
  const landingPad = hub ? [{ structId: 'hub', pos: { x: hub.x, y: hub.y }, footprint: { w: hub.w, h: hub.h } }] : [];
  const clearOfHub = (def, cell) => !hub || !spacingConflict(landingPad, def, cell, () => ({ spacing: clearance }));
  for (const d of deps) {
    if (!DEPOSIT_TIERS.includes(d.tier)) { P.push(`deposit with unknown tier "${d.tier}"`); continue; }
    const r = depositRect(d);
    if (offMap(r)) { P.push(`the ${d.tier} deposit is off the map`); continue; }
    if (hasGround) {
      const g = ground(r);
      if (g.bad) P.push(`the ${d.tier} deposit (${d.x}, ${d.y}) sits on ${g.bad} blocked cell${g.bad > 1 ? 's' : ''}`);
      if (!g.flat) P.push(`the ${d.tier} deposit (${d.x}, ${d.y}) is not flat`);
      if (map.heights && map.mesa) {
        if (d.tier !== 'rare' && !g.top) P.push(`the ${d.tier} deposit (${d.x}, ${d.y}) is not on the mesa top`);
        if (d.tier === 'rare' && g.top) P.push(`the rare deposit (${d.x}, ${d.y}) is on the mesa (it must be remote)`);
      }
    }
    if (!clearOfHub(rigDef, d)) P.push(`a rig on the ${d.tier} deposit (${d.x}, ${d.y}) would be within ${clearance} cells of the landing pad`);
  }

  // kit defenses
  for (const k of map.kitDefenses || []) {
    const [x, y] = k.cell || [];
    if (onFixed(map, x, y)) P.push(`kit ${k.kind} at (${x}, ${y}) is on the landing pad or a deposit`);
    else if (!buildable(map, x, y)) P.push(`kit ${k.kind} at (${x}, ${y}) is not on buildable ground`);
    if (!structureDef(k.kind, 1)) P.push(`kit defense of unknown kind "${k.kind}"`);
    if (!clearOfHub({ spacing: 0, footprint: { w: 1, h: 1 } }, { x, y })) P.push(`kit ${k.kind} at (${x}, ${y}) is within ${clearance} cells of the landing pad`);
  }

  // raid lanes: each ground spawn walks to the landing pad
  if (map.spawns) {
    const lanes = map.spawns.filter((s) => (s.lane || 'ground') === 'ground');
    if (lanes.length < 2) P.push(`${lanes.length} raid lane${lanes.length === 1 ? '' : 's'} (needs two ground spawns)`);
    if ((map.terrain || map.blocking) && hub) {
      const pass = (x, y) => inRectXY(hub, x, y) || !blockedAt(y * cols + x);
      const d = new Int32Array(cols * rows).fill(-1), q = [];
      for (let y = hub.y; y < hub.y + hub.h; y++) for (let x = hub.x; x < hub.x + hub.w; x++) { d[y * cols + x] = 0; q.push(y * cols + x); }
      for (let h = 0; h < q.length; h++) {
        const x = q[h] % cols, y = (q[h] / cols) | 0;
        for (const [dx, dy] of N4) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const j = ny * cols + nx;
          if (d[j] < 0 && pass(nx, ny)) { d[j] = d[q[h]] + 1; q.push(j); }
        }
      }
      for (const s of lanes) if (!(s.x >= 0 && s.y >= 0 && s.x < cols && s.y < rows) || d[s.y * cols + s.x] < 0) P.push(`raid lane from (${s.x}, ${s.y}) cannot walk to the landing pad`);
    }
  }
  return P;
}
