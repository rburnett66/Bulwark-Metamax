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
 *   o.decorV   = DECOR.version                          the layout rules the pieces were placed by
 * A stacked cargo cube also carries z: its lift in cells (it shares the cell of the cube under it).
 *
 * Owner 2026-11-15 [MM-task_mwitpds3_22]: "the small items like racks signs and antenna should be near the structures. The
 * cargo boxes would look good on the perimeter maybe even stacked." So (layout version 2) a small piece stands in the ring
 * of cells round the structure it came with, turned to face it; a large one stands on the red rim, mostly beside the rim's
 * other cargo so they line the perimeter, and a cargo cube may sit on top of a lone one. A save laid out by an older
 * version is laid out again once, from the same seeds.
 *
 * accrueDecor() is the one entry: idempotent, seeded (o.seed + the structure's key — no Math.random), so a save opened
 * twice, or an old save given its decor for the first time, comes out the same.
 */
import { positionCheck } from './siting.js';
import { createOutpost, buildingRect } from './model.js';
import { occupied } from '../farm/model.js';

/** The kinds (content/outposts/decor/decor.json; decorBudget.test.mjs keeps these lists equal to its classes). */
export const DECOR_SMALL = Object.freeze(['water_tank', 'antenna', 'chemical_drum', 'road_signs', 'supply_shelf']);
export const DECOR_LARGE = Object.freeze(['supplies', 'cargo_cube']);
export const DECOR = Object.freeze({ perStructure: 2, cap: 80, reach: 3, largeShare: 0.3, version: 2, stackShare: 0.45, rowShare: 0.7 });
/** The cargo cube's height in cells (decor.json; decor.test.mjs keeps them equal): a stacked cube sits this × the lower one's scale up. */
export const CARGO_H = 0.588;

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

/** The cells a structure / plot key (decorKeys) stands on. → { x, y, w, h } or null. */
function rectOf(o, map, key) {
  const at = key.indexOf(':'), kind = key.slice(0, at), id = key.slice(at + 1);
  if (kind === 'pad') return buildingRect(o, map, id);
  if (kind === 'def') { const d = (o.defenses || []).find((x) => x.id === id); return d ? { x: d.cell[0], y: d.cell[1], w: 1, h: 1 } : null; }
  const f = o.farm || {}, r = kind === 'plot' ? (f.plots || {})[id] : kind === 'farm' ? (f.buildings || {})[id] : null;
  return r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
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
  const relay = o.decorV !== DECOR.version;   // laid out by an older version: lay it all out again, once
  const had = Array.isArray(o.decor) && !relay ? o.decor : [];
  const done = new Set(Array.isArray(o.decorFor) && !relay ? o.decorFor : []);
  const keys = decorKeys(o), fresh = keys.filter((k) => !done.has(k));
  const taken = takenCells(o, map);
  const cellOf = (d) => Math.floor(d.x) + ',' + Math.floor(d.y);
  const kept = had.filter((d) => !taken.has(cellOf(d)));   // building over decor clears it (it was free)
  if (!relay && !fresh.length && kept.length === had.length && Array.isArray(o.decor)) return false;
  const out = kept.slice();
  if (fresh.length) {
    const g = decorGround(map), box = baseBox(o, map);
    const used = new Set(out.map(cellOf));
    const ok = (pick, x, y) => x >= 0 && y >= 0 && x < g.cols && y < g.rows && pick[y * g.cols + x] === 1 && !taken.has(x + ',' + y) && !used.has(x + ',' + y);
    const free = (pick) => {
      const list = [];
      if (!box) return list;
      for (let y = Math.max(0, box.y0); y <= Math.min(g.rows - 1, box.y1); y++) {
        for (let x = Math.max(0, box.x0); x <= Math.min(g.cols - 1, box.x1); x++) if (ok(pick, x, y)) list.push({ x, y });
      }
      return list;
    };
    // the free buildable cells in the ring d cells out from a structure's rect
    const ring = (r, d) => {
      const list = [];
      for (let y = r.y - d; y < r.y + r.h + d; y++) for (let x = r.x - d; x < r.x + r.w + d; x++) {
        const onRing = x === r.x - d || x === r.x + r.w + d - 1 || y === r.y - d || y === r.y + r.h + d - 1;
        if (onRing && ok(g.green, x, y)) list.push({ x, y });
      }
      return list;
    };
    // rim cells beside the cargo already on the rim, so the cargo lines the perimeter
    const besideCargo = () => {
      const list = [], seen = new Set();
      for (const d of out) {
        if (!DECOR_LARGE.includes(d.kind)) continue;
        const cx = Math.floor(d.x), cy = Math.floor(d.y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = (cx + dx) + ',' + (cy + dy);
          if (!seen.has(k) && ok(g.edge, cx + dx, cy + dy)) { seen.add(k); list.push({ x: cx + dx, y: cy + dy }); }
        }
      }
      return list;
    };
    let n = Math.max(0, ...out.map((d) => +String(d.id).slice(1) || 0));
    for (const key of fresh) {
      done.add(key);
      const rnd = rngOf(hashStr(key, (o.seed >>> 0) ^ 0x5bd1e995));
      const home = rectOf(o, map, key);
      let prev = null;
      for (let i = 0; i < DECOR.perStructure && out.length < DECOR.cap; i++) {
        let large = rnd() < DECOR.largeShare;
        if (large && rnd() < DECOR.stackShare) {   // a cargo cube on top of a lone one on the rim
          const lone = out.filter((d) => d.kind === 'cargo_cube' && !d.z && !out.some((e) => e.z && e.x === d.x && e.y === d.y));
          if (lone.length) {
            const b = lone[Math.floor(rnd() * lone.length)];
            out.push({ id: 'z' + (++n), kind: 'cargo_cube', for: key, x: b.x, y: b.y, rot: +(b.rot + (rnd() - 0.5) * 0.5).toFixed(3),
              scale: +(b.scale * (0.9 + rnd() * 0.08)).toFixed(3), z: +(CARGO_H * b.scale).toFixed(3) });
            prev = 'cargo_cube';
            continue;
          }
        }
        let cells = [];
        if (large) { const row = rnd() < DECOR.rowShare ? besideCargo() : []; cells = row.length ? row : free(g.edge); }
        if (!cells.length) {
          large = false;
          for (let d = 1; d <= 2 && home && !cells.length; d++) cells = ring(home, d);   // beside its own structure
          if (!cells.length) cells = free(g.green);
        }
        if (!cells.length) break;
        const c = cells[Math.floor(rnd() * cells.length)];
        const pool = (large ? DECOR_LARGE : DECOR_SMALL).filter((k) => k !== prev);
        const kind = pool[Math.floor(rnd() * pool.length)];
        const j = large ? 0.08 : 0.2;   // a small piece sits about its cell; a large one near its middle
        let rot;
        if (large) rot = Math.floor(rnd() * 4) * Math.PI / 2 + (rnd() - 0.5) * 0.3;
        else if (home) {   // turned to face its structure (the models' fronts are +Z), a little off square
          rot = Math.atan2(home.x + home.w / 2 - (c.x + 0.5), home.y + home.h / 2 - (c.y + 0.5)) + (rnd() - 0.5) * 0.6;
        } else rot = rnd() * Math.PI * 2;
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
  o.decorV = DECOR.version;
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
