/**
 * src/terrain/outpostPads.js — the outpost map layer of a Terrain Forge map: the mesa, its pads, deposits and
 * conduits, and the checks the Forge shows while authoring [MM-story_mw5oeatc_l].
 *
 * Tech plan docs/tech-plan/Outpost.md §6.6 · design docs/16 Bulwark MM/design/Outpost-Design.md §4.5, §9.
 *
 * An outpost map is an ordinary Forge map (terrain, blocking, decor, resources, spawns) with these top-level fields:
 *   pads:        [{ id, x, y, w, h, role, remote }]   role: hub | power | rig | storage | bay | spare
 *   deposits:    [{ tier, x, y, pad }]                 one per tier; a deposit is 2 × 2 cells from (x, y), on its rig pad
 *   conduits:    [[padA, padB], …]                     the pad graph the conduits are drawn along (§6.3)
 *   kitDefenses: [{ kind, cell: [x, y] }]              where the contract kit's defenses start
 *   mesa:        { cx, cy, rx, ry, ramps: [{ x, y, w, h }] }   the raised build mesa (a rounded rectangle)
 *   heights:     [0 | 1 | 2 per cell]                  0 lowland, 1 ramp, 2 mesa top (and its cliff rim)
 * The mesa itself is stamped into `terrain` (stone top, cliff rim, dirt ramps), so the terrain bake and the battle
 * renderer draw it like any other map; `heights` is the same shape as numbers, for framing and the outpost views.
 * Raid lanes are the map's ground `spawns`; the defense ring is buildable cells (defenseRing() below).
 *
 * Pure and deterministic: no DOM, no clock, no Math.random. Cells are battle cells; a pad's centre is
 * (x + w/2, y + h/2), the point the outpost model measures power reach from (src/outpost/model.js).
 */
import { TERRAIN, BLOCKING } from './terrainGen.js';
import { structureDef } from '../data/outpost.js';

export const PAD_ROLES = Object.freeze(['hub', 'power', 'rig', 'storage', 'bay', 'spare']);
export const DEPOSIT_TIERS = Object.freeze(['common', 'uncommon', 'rare']);
/** Pad id prefix per role (hub, p1, r1, s1, b1, x1 — the ids the draft layout and the model's tests use). */
export const PAD_PREFIX = Object.freeze({ hub: 'hub', power: 'p', rig: 'r', storage: 's', bay: 'b', spare: 'x' });
export const HEIGHT = Object.freeze({ LOW: 0, RAMP: 1, TOP: 2 });
/**
 * Pad sizes in cells (owner 2026-11-08: "the outpost scale is very large compared to the size of the map .. reduce the
 * structures and placement grid by 50%"): the hub 3 × 3 (the battle base's footprint), every other pad 2 × 2. The
 * building models are authored for the earlier 6 × 6 hub and 4 × 4 pads (MODEL_PAD_SIZE); padModelScale scales them.
 */
export const PAD_SIZE = Object.freeze({ hub: 3, pad: 2 });
export const MODEL_PAD_SIZE = Object.freeze({ hub: 6, pad: 4 });
/** A role's pad size in cells. */
export const padSizeFor = (role) => (role === 'hub' ? PAD_SIZE.hub : PAD_SIZE.pad);
/** The scale a building model (and its pad dressing) draws at on pad p: its size over the size the model was made for. */
export const padModelScale = (p) => (p && p.w ? p.w / (p.role === 'hub' ? MODEL_PAD_SIZE.hub : MODEL_PAD_SIZE.pad) : 1);

/** Power Station I's reach in cells (Outpost_Structures, design §4.5: 10). */
export const defaultPowerReach = () => (structureDef('power', 1) || {}).reach || 10;

const centre = (p) => [p.x + p.w / 2, p.y + p.h / 2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dims = (map) => ({ cols: map.cols ?? map.width, rows: map.rows ?? map.height });
const inPad = (p, x, y) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h;

/** The pad covering cell (x, y), or null. */
export const padAt = (map, x, y) => (map.pads || []).find((p) => inPad(p, x, y)) || null;
/** The first station: the first power pad on the mesa (the one the contract kit builds on). */
export const firstStation = (map) => (map.pads || []).find((p) => p.role === 'power' && !p.remote) || null;
/** The next free id for a role: hub, then p1, p2 … */
export function nextPadId(map, role) {
  const pre = PAD_PREFIX[role] || 'x', ids = new Set((map.pads || []).map((p) => p.id));
  if (role === 'hub' && !ids.has('hub')) return 'hub';
  for (let i = 1; ; i++) if (!ids.has(pre + i)) return pre + i;
}

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
 * each ground lane is worn into a 2-cell cart track from its spawn to the nearest ramp's foot; remote pads get a
 * flat clearing. Sets g.heights, g.clear (cells decor and resources must leave open) and g.lanes (the raid lanes'
 * cart tracks and ramp feet, which the farm-cell layer keeps off: src/terrain/farmCells.js). Mutates g; returns it.
 * layout: { mesa, pads, spawns, kitDefenses }.
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
  // remote pads: a flat dirt yard the size of the building's model footprint (MODEL_PAD_SIZE: the half-scale pad sits
  // in its middle), with a 1-cell margin of grass
  for (const p of (layout.pads || []).filter((q) => q.remote)) {
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

// ── conduits ─────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Conduits derived from reach (the Forge's default, tech plan §6.3): every other pad links to its nearest power pad
 * within reach, and power pads within reach of each other link (one grid). Pad order is kept, so the draft layout's
 * hand-written conduits come out the same.
 */
export function deriveConduits(map, { powerReach = defaultPowerReach() } = {}) {
  const pads = map.pads || [], stations = pads.filter((p) => p.role === 'power'), out = [];
  for (const p of pads) {
    if (p.role === 'power') continue;
    let best = null;
    for (const s of stations) {
      const d = dist(centre(s), centre(p));
      if (d <= powerReach && (!best || d < best.d)) best = { d, s };
    }
    if (best) out.push([best.s.id, p.id]);
  }
  for (let i = 0; i < stations.length; i++) for (let j = i + 1; j < stations.length; j++) {
    if (dist(centre(stations[i]), centre(stations[j])) <= powerReach) out.push([stations[i].id, stations[j].id]);
  }
  return out;
}

// ── the defense ring and the framing ─────────────────────────────────────────────────────────────────────────────
/** Is a cell buildable for a defense: in bounds, open ground (not blocking, not water), not on a pad? */
export function buildable(map, x, y) {
  const { cols, rows } = dims(map);
  if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
  if (padAt(map, x, y)) return false;
  const i = y * cols + x;
  if (map.terrain && (map.terrain[i] === TERRAIN.WATER || BLOCKING.has(map.terrain[i]))) return false;
  if (map.blocking && map.blocking[i]) return false;
  return true;
}

/**
 * The defense ring (design §9): buildable cells on the mesa top within 2 cells of its edge, and buildable cells
 * within 2 cells of a remote pad. Needs `heights`; → [[x, y]].
 */
export function defenseRing(map) {
  const { cols, rows } = dims(map), H = map.heights;
  if (!H) return [];
  const out = [], top = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && H[y * cols + x] === HEIGHT.TOP;
  const remote = (map.pads || []).filter((p) => p.remote);
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
  if (x0 === Infinity) for (const p of (map.pads || []).filter((q) => !q.remote)) { grow(p.x, p.y); grow(p.x + p.w - 1, p.y + p.h - 1); }
  if (x0 === Infinity) return { x: 0, y: 0, w: cols, h: rows };
  x0 = Math.max(0, x0 - margin); y0 = Math.max(0, y0 - margin);
  x1 = Math.min(cols - 1, x1 + margin); y1 = Math.min(rows - 1, y1 + margin);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ── validation ───────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Every problem with an outpost map's layer, as readable strings; [] when it is valid. The checks (tech plan §6.6):
 *  - pads: known role, unique id, in bounds, no overlap; exactly one hub, on the mesa, under the map's base (when the
 *    map has one: the battle sim's raids march on the base); a first power station;
 *  - ground (when the map carries terrain): every pad on open, flat ground, and a mesa pad on the mesa top;
 *  - reach: every mesa pad's centre within the first station's reach;
 *  - conduits: known pads, each with a power pad at one end, within reach; every mesa pad reaches the hub through
 *    the conduit graph, every remote pad reaches a power pad;
 *  - deposits: exactly one per tier, each on (inside) a rig pad; the rare one's pad outside the first station's
 *    reach, with a power pad of its own within reach;
 *  - kit defenses: on buildable cells off the pads; the powered ones within the first station's reach;
 *  - raid lanes (when spawns are given): at least two ground spawns, each walking to the hub between the buildings.
 * opts: { powerReach } (default Power Station I's reach).
 */
export function validateOutpostLayout(map, { powerReach = defaultPowerReach() } = {}) {
  const P = [], { cols, rows } = dims(map), pads = map.pads || [], byId = new Map();
  const deps = map.deposits || [], conduits = map.conduits || [];
  for (const p of pads) {
    if (byId.has(p.id)) P.push(`pad id ${p.id} is used twice`);
    byId.set(p.id, p);
    if (!PAD_ROLES.includes(p.role)) P.push(`pad ${p.id} has an unknown role "${p.role}"`);
    if (!(p.w > 0 && p.h > 0)) P.push(`pad ${p.id} has no size`);
    if (p.x < 0 || p.y < 0 || p.x + p.w > cols || p.y + p.h > rows) P.push(`pad ${p.id} is off the map`);
  }
  for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) {
    const a = pads[i], b = pads[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) P.push(`pads ${a.id} and ${b.id} overlap`);
  }
  const hubs = pads.filter((p) => p.role === 'hub');
  if (hubs.length !== 1) P.push(`${hubs.length} hub pads (needs exactly one)`);
  if (hubs.some((p) => p.remote)) P.push('the hub is marked remote');
  const bp = map.base && map.base.pos;   // the battle base (raids march on it): world-mode maps pin it at (31, 15)
  if (bp && hubs.length === 1 && !inPad(hubs[0], bp.x, bp.y)) P.push(`the base (${bp.x}, ${bp.y}) is not on the hub pad`);
  const st = firstStation(map);
  if (!st) P.push('no power pad on the mesa (the first station)');

  // ground under the pads
  const blockedAt = (i) => (map.terrain && (BLOCKING.has(map.terrain[i]) || map.terrain[i] === TERRAIN.WATER)) || (map.blocking && map.blocking[i]);
  if (map.terrain || map.blocking || map.heights) {
    for (const p of pads) {
      let bad = 0; const hs = new Set();
      for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const i = y * cols + x;
        if (blockedAt(i)) bad++;
        if (map.heights) hs.add(map.heights[i]);
      }
      if (bad) P.push(`pad ${p.id} sits on ${bad} blocked cell${bad > 1 ? 's' : ''} (needs open, buildable ground)`);
      if (hs.size > 1) P.push(`pad ${p.id} is not flat (it spans the mesa edge or a ramp)`);
      if (map.heights && map.mesa && !p.remote && !(hs.size === 1 && hs.has(HEIGHT.TOP))) P.push(`pad ${p.id} is not on the mesa top`);
    }
  }

  // reach of the first station
  const reach = (a, b) => dist(centre(a), centre(b)) <= powerReach + 1e-9;
  if (st) for (const p of pads) if (!p.remote && !reach(st, p)) P.push(`pad ${p.id} is outside the first station's reach (${dist(centre(st), centre(p)).toFixed(1)} > ${powerReach})`);

  // conduits and the pad graph
  const adj = new Map(pads.map((p) => [p.id, []]));
  for (const c of conduits) {
    const [a, b] = c || [];
    if (!byId.has(a) || !byId.has(b)) { P.push(`conduit ${a}–${b} names a missing pad`); continue; }
    if (a === b) { P.push(`conduit ${a}–${b} links a pad to itself`); continue; }
    if (byId.get(a).role !== 'power' && byId.get(b).role !== 'power') P.push(`conduit ${a}–${b} has no power pad at either end`);
    if (!reach(byId.get(a), byId.get(b))) P.push(`conduit ${a}–${b} is longer than a station's reach`);
    adj.get(a).push(b); adj.get(b).push(a);
  }
  const reachable = (from) => {
    const seen = new Set([from]), q = [from];
    while (q.length) for (const nb of adj.get(q.shift()) || []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
    return seen;
  };
  if (hubs.length === 1) {
    const fromHub = reachable(hubs[0].id);
    for (const p of pads) {
      if (p.remote) {
        const comp = reachable(p.id);
        if (![...comp].some((id) => byId.get(id).role === 'power')) P.push(`remote pad ${p.id} is not linked to a power pad by a conduit`);
      } else if (!fromHub.has(p.id)) P.push(`pad ${p.id} is not reachable from the hub through the conduits`);
    }
  }

  // deposits
  for (const t of DEPOSIT_TIERS) {
    const n = deps.filter((d) => d.tier === t).length;
    if (n !== 1) P.push(`${n} ${t} deposits (needs exactly one)`);
  }
  for (const d of deps) {
    if (!DEPOSIT_TIERS.includes(d.tier)) { P.push(`deposit with unknown tier "${d.tier}"`); continue; }
    const p = byId.get(d.pad);
    if (!p) { P.push(`the ${d.tier} deposit names a missing pad ${d.pad}`); continue; }
    if (p.role !== 'rig') P.push(`the ${d.tier} deposit is on ${p.id}, a ${p.role} pad (needs a rig pad)`);
    if (!inPad(p, d.x, d.y)) P.push(`the ${d.tier} deposit (${d.x}, ${d.y}) is not on its pad ${p.id}`);
    if (d.tier !== 'rare' && st && !reach(st, p)) P.push(`the ${d.tier} deposit's pad ${p.id} is outside the first station's reach`);
  }
  const rare = deps.find((d) => d.tier === 'rare'), rp = rare && byId.get(rare.pad);
  if (rp && st) {
    if (reach(st, rp)) P.push(`the rare deposit's pad ${rp.id} is inside the first station's reach (it must be remote)`);
    if (!pads.some((q) => q.role === 'power' && q !== st && reach(q, rp))) P.push(`the rare deposit's pad ${rp.id} has no power pad of its own within reach`);
  }

  // kit defenses
  for (const d of map.kitDefenses || []) {
    const [x, y] = d.cell || [];
    if (padAt(map, x, y)) P.push(`kit ${d.kind} at (${x}, ${y}) is on a pad`);
    else if (!buildable(map, x, y)) P.push(`kit ${d.kind} at (${x}, ${y}) is not on buildable ground`);
    const def = structureDef(d.kind, 1);
    if (!def) P.push(`kit defense of unknown kind "${d.kind}"`);
    else if (def.draw > 0 && st && dist(centre(st), [x + 0.5, y + 0.5]) > powerReach) P.push(`kit ${d.kind} at (${x}, ${y}) is outside the first station's reach`);
  }

  // raid lanes: each ground spawn walks to the hub, around every other pad
  if (map.spawns) {
    const lanes = map.spawns.filter((s) => (s.lane || 'ground') === 'ground');
    if (lanes.length < 2) P.push(`${lanes.length} raid lane${lanes.length === 1 ? '' : 's'} (needs two ground spawns)`);
    if ((map.terrain || map.blocking) && hubs.length === 1) {
      const hub = hubs[0];
      const pass = (x, y) => {
        const i = y * cols + x, p = padAt(map, x, y);
        if (p) return p === hub;
        return !blockedAt(i);
      };
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
      for (const s of lanes) if (!(s.x >= 0 && s.y >= 0 && s.x < cols && s.y < rows) || d[s.y * cols + s.x] < 0) P.push(`raid lane from (${s.x}, ${s.y}) cannot walk to the hub`);
    }
  }
  return P;
}
