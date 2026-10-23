/**
 * src/fxlab/arena.js — the Effects Lab's battlefield helpers [MM-story_mvk63439_o]. Pure: no DOM, no three.js.
 *
 * The Lab runs the REAL sim and the REAL 3D renderer on a faction's own map 1 (its planet's ground, props and
 * palette), so every effect looks exactly as it does in battle. These helpers choose where things go:
 *   arenaMap()      — the map with the wave fog windows removed (the whole board stays in view)
 *   factionUnits()  — every unit a faction fields, in roster order
 *   spawnCells()    — walkable cells ~dist from the base, toward the map's ground spawn, spread side by side
 *   towerCells()    — buildable cells round the base for the chosen towers
 */

export const FACTION_MAP = Object.freeze({ ground: 'powder', air: 'air', hightech: 'high-tech', artillery: 'artillery', water: 'water',
  arcane: 'arcane-energy', space: 'space-tech', dark: 'dark-energy', greenies: 'greenies' });

export const SHAPE_ORDER = Object.freeze(['Troops', 'Scout', 'Assault Tank', 'Heavy Tank', 'Artillery', 'Gunship', 'Fighter', 'Missile Flyer', 'Bomber']);

/** The map without its wave windows or rings: no fog, nothing hidden as a contact, nothing gated. */
export function arenaMap(map) {
  return { ...map, waveWindows: [], rings: [], openPlay: true };
}

/** units: tables.js UNITS; → [{ id, shape, domain, … }] for the faction named `name`, roster order. */
export function factionUnits(units, name) {
  return Object.entries(units).filter(([, u]) => u.faction === name)
    .map(([id, u]) => ({ id, shape: u.shape, domain: u.domain, armor: u.armorClass, light: !!u.lightGround }))
    .sort((a, b) => SHAPE_ORDER.indexOf(a.shape) - SHAPE_ORDER.indexOf(b.shape));
}

function blockedSet(map) {
  const s = new Set((map.blockedCells || []).map((c) => c.y * map.cols + c.x));
  for (const c of map.waterCells || []) s.add(c.y * map.cols + c.x);
  return s;
}

/**
 * n cells at about `dist` from the base, on the side the ground spawn is (else west), side by side across the line
 * of approach. Walkers only get dry, unblocked cells; flyers and swimmers take any on-map cell.
 */
export function spawnCells(map, n, { dist = 9, flyer = false } = {}) {
  const b = map.base, sp = map.spawnGround || { x: 0, y: b.y };
  let dx = sp.x - b.x, dy = sp.y - b.y;
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const px = -dy, py = dx, bad = flyer ? new Set() : blockedSet(map), out = [], used = new Set();
  const ok = (x, y) => x >= 0 && y >= 0 && x < map.cols && y < map.rows && !bad.has(y * map.cols + x) && !used.has(y * map.cols + x);
  for (let k = 0; k < n; k++) {
    const side = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.9;
    const cx = b.x + dx * dist + px * side, cy = b.y + dy * dist + py * side;
    let best = null;
    for (let r = 0; r <= 6 && !best; r++) for (let oy = -r; oy <= r && !best; oy++) for (let ox = -r; ox <= r; ox++) {
      const x = Math.round(cx) + ox, y = Math.round(cy) + oy;
      if (ok(x, y)) { best = { x, y }; break; }
    }
    if (best) { used.add(best.y * map.cols + best.x); out.push(best); }
  }
  return out;
}

/** Buildable cells round the base, nearest first (ring 2, then 3, …), facing the spawn side first. */
export function towerCells(map, { r0 = 2, r1 = 5 } = {}) {
  const b = map.base, sp = map.spawnGround || { x: 0, y: b.y };
  const can = new Set((map.buildableCells || []).map((c) => c.y * map.cols + c.x));
  const out = [];
  for (let r = r0; r <= r1; r++) {
    const ring = [];
    for (let y = b.y - r; y <= b.y + r; y++) for (let x = b.x - r; x <= b.x + r; x++) {
      if (Math.max(Math.abs(x - b.x), Math.abs(y - b.y)) !== r || !can.has(y * map.cols + x)) continue;
      ring.push({ x, y, d: Math.hypot(x - sp.x, y - sp.y) });
    }
    ring.sort((p, q) => p.d - q.d || p.y - q.y || p.x - q.x);
    for (const c of ring) out.push({ x: c.x, y: c.y });
  }
  return out;
}
