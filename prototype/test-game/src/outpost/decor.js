/**
 * src/outpost/decor.js — the base's clutter: water tanks, antennas, drums, sign posts, shelves, crate stacks and cargo
 * cubes scattered round the outpost [MM-story_mwfacx0h_c] (design: docs/16 Bulwark MM/design/Outpost-Decor-and-Cargo-Lift.md §3).
 *
 * Owner 2026-11-13: "As new structures and plots are added to the Outpost and Farm these should be randomly added to the
 * base. 2 decorations in a random location for each structure (plot) added. These should be small scaled items around
 * the base not just next to the new structure. They should not be big enough to block a lane, and large structure can be
 * placed in red non-buildable areas on the edge of the base."
 *
 * Decor is drawn only: never a sim structure, never in the nav grid, no gold. It lives in the save as
 *   o.decor    = [{ id, kind, x, y, rot, scale, for }]   x, y: the piece's centre in cells (world x, z)
 *   o.decorFor = [key]                                  every structure / plot that has had its 2 pieces
 * accrueDecor() is the one entry: idempotent, seeded (o.seed + the structure's key — no Math.random), so a save opened
 * twice, or an old save given its decor for the first time, comes out the same.
 */
import { positionCheck } from './siting.js';
import { createOutpost } from './model.js';
import { occupied } from '../farm/model.js';

/** The kinds (content/outposts/decor/decor.json; decorBudget.test.mjs keeps these lists equal to its classes). */
export const DECOR_SMALL = Object.freeze(['water_tank', 'antenna', 'chemical_drum', 'road_signs', 'supply_shelf']);
export const DECOR_LARGE = Object.freeze(['supplies', 'cargo_cube']);
export const DECOR = Object.freeze({ perStructure: 2, cap: 80, reach: 3, largeShare: 0.3 });

/** The keys of everything that earns decor: buildings (and construction jobs), defenses, farm plots and farm buildings. */
export function decorKeys(o) {
  const keys = new Set();
  for (const [id, b] of Object.entries(o.pads || {})) if (b && b.kind !== 'hub') keys.add('pad:' + id);
  for (const j of o.building || []) if (j && j.kind !== 'hub') keys.add('pad:' + j.pad);
  for (const d of o.defenses || []) keys.add('def:' + d.id);
  const f = o.farm || {};
  for (const id of Object.keys(f.plots || {})) keys.add('plot:' + id);
  for (const id of Object.keys(f.buildings || {})) keys.add('farm:' + id);
  return [...keys].sort();
}

function hashStr(s, seed = 2166136261) {
  let h = seed >>> 0;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
/** A small seeded stream (mulberry32). */
function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GROUND = new WeakMap();
/**
 * The map's ground for decor, from the build ghost's own rule (siting.positionCheck on an outpost with only its hub):
 * `green` the cells a 1-cell piece could be built on; `edge` the red rock / rim cells at the plateau's height that touch
 * green ground (the large pieces' place — never water, never the landing pad's clearance). Cached per map.
 */
export function decorGround(map) {
  const hit = map && typeof map === 'object' ? GROUND.get(map) : null;
  if (hit) return hit;
  const cols = map.width ?? map.cols, rows = map.height ?? map.rows;
  const check = positionCheck(createOutpost(map.planet || 'ground', { seed: 1, map, now: 0 }), map);
  const why = new Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) why[y * cols + x] = check('wall', { x, y });
  const hts = map.heights || null, hub = map.hub;
  const top = hts && hub ? hts[(hub.y + (hub.h >> 1)) * cols + hub.x + (hub.w >> 1)] : null;
  const level = (i) => !hts || hts[i] === top;
  const green = new Uint8Array(cols * rows), edge = new Uint8Array(cols * rows);
  for (let i = 0; i < why.length; i++) green[i] = why[i] == null && level(i) ? 1 : 0;
  const rocky = (r) => r === 'terrain' || /rock|tree/.test(r || '');
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (green[i] || !rocky(why[i]) || !level(i)) continue;
    const touch = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < cols && ny < rows && green[ny * cols + nx];
    });
    if (touch) edge[i] = 1;
  }
  const g = { cols, rows, green, edge };
  if (map && typeof map === 'object') GROUND.set(map, g);
  return g;
}

/** The cells the outpost's things stand on (farm/model occupied: the pad, deposits, buildings, defenses, plots). */
function takenCells(o, map) {
  const s = new Set();
  for (const r of occupied(o, map)) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) s.add(x + ',' + y);
  return s;
}

/** The base's area: the box round everything built, plus DECOR.reach cells. → { x0, y0, x1, y1 } (inclusive). */
function baseBox(o, map) {
  const rs = occupied(o, map).filter((r) => !/deposit|clearing/.test(r.what || ''));
  if (!rs.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rs) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w - 1); y1 = Math.max(y1, r.y + r.h - 1); }
  return { x0: x0 - DECOR.reach, y0: y0 - DECOR.reach, x1: x1 + DECOR.reach, y1: y1 + DECOR.reach };
}

/**
 * Give every new structure / plot on `o` its 2 decor pieces, and clear any piece something now stands on. Changes `o`
 * in place. → true when o.decor changed (the caller saves it), else false.
 */
export function accrueDecor(o, map) {
  if (!o || !map) return false;
  const had = Array.isArray(o.decor) ? o.decor : [];
  const done = new Set(Array.isArray(o.decorFor) ? o.decorFor : []);
  const keys = decorKeys(o), fresh = keys.filter((k) => !done.has(k));
  const taken = takenCells(o, map);
  const cellOf = (d) => Math.floor(d.x) + ',' + Math.floor(d.y);
  const kept = had.filter((d) => !taken.has(cellOf(d)));   // building over decor clears it (it was free)
  if (!fresh.length && kept.length === had.length && Array.isArray(o.decor)) return false;
  const out = kept.slice();
  if (fresh.length) {
    const g = decorGround(map), box = baseBox(o, map);
    const used = new Set(out.map(cellOf));
    const free = (pick) => {
      const list = [];
      if (!box) return list;
      for (let y = Math.max(0, box.y0); y <= Math.min(g.rows - 1, box.y1); y++) {
        for (let x = Math.max(0, box.x0); x <= Math.min(g.cols - 1, box.x1); x++) {
          const i = y * g.cols + x, k = x + ',' + y;
          if (pick[i] && !taken.has(k) && !used.has(k)) list.push({ x, y });
        }
      }
      return list;
    };
    let n = Math.max(0, ...out.map((d) => +String(d.id).slice(1) || 0));
    for (const key of fresh) {
      done.add(key);
      const rnd = rngOf(hashStr(key, (o.seed >>> 0) ^ 0x5bd1e995));
      let prev = null;
      for (let i = 0; i < DECOR.perStructure && out.length < DECOR.cap; i++) {
        let large = rnd() < DECOR.largeShare;
        let cells = large ? free(g.edge) : [];
        if (!cells.length) { large = false; cells = free(g.green); }
        if (!cells.length) break;
        const c = cells[Math.floor(rnd() * cells.length)];
        const pool = (large ? DECOR_LARGE : DECOR_SMALL).filter((k) => k !== prev);
        const kind = pool[Math.floor(rnd() * pool.length)];
        const j = large ? 0.08 : 0.3;   // a small piece sits anywhere in its cell; a large one near its middle
        const rot = large ? Math.floor(rnd() * 4) * Math.PI / 2 + (rnd() - 0.5) * 0.3 : rnd() * Math.PI * 2;
        out.push({
          id: 'z' + (++n), kind, for: key,
          x: +(c.x + 0.5 + (rnd() - 0.5) * 2 * j).toFixed(3), y: +(c.y + 0.5 + (rnd() - 0.5) * 2 * j).toFixed(3),
          rot: +rot.toFixed(3), scale: +(0.9 + rnd() * 0.2).toFixed(3),
        });
        used.add(c.x + ',' + c.y);
        prev = kind;
      }
    }
  }
  o.decor = out;
  o.decorFor = [...done].sort();
  return true;
}

/**
 * The cells a conduit runs over (its routes' points, conduits.js planConduits), so the scene leaves a piece under a
 * newer conduit undrawn. → Set of 'x,y'.
 */
export function conduitCells(routes) {
  const s = new Set();
  for (const c of routes || []) {
    const p = c.points || [];
    for (let i = 1; i < p.length; i++) {
      const [ax, az] = p[i - 1], [bx, bz] = p[i], steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) * 4));
      for (let k = 0; k <= steps; k++) s.add(Math.floor(ax + (bx - ax) * k / steps) + ',' + Math.floor(az + (bz - az) * k / steps));
    }
  }
  return s;
}
