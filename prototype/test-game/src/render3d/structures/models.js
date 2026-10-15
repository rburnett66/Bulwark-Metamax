/**
 * src/render3d/structures/models.js — the low-poly base, walls, towers and resource crystals (code design §8.3).
 * LPS [MM-story_mv87jzov_9]. Replaces markers.js's boxes when the low-poly world is active.
 *
 * PURE (no three.js): every model is built here as plain arrays — non-indexed triangles, one face normal and
 * ONE FLAT COLOUR PER TRIANGLE (±facet jitter from a seeded stream), wound outward — the same faceted look as
 * the low-poly ground and obstructions. structures/lowpoly.js only wraps the arrays in BufferGeometry and
 * instances them. The layout planners (planStructures / planCrystals) are pure too, so node --test pins the
 * height contract, footprints, wall joins, tower facing and lifecycle reads without a GPU.
 *
 * Height contract (tech plan §"World unit = 1 cell"): wall 0.6, tower 1.4, base 1.8 cells — every model is
 * fitted so its top is EXACTLY that, so placement reads the same as the boxes did. Footprints unchanged:
 * walls and towers stay inside their cell, the base inside its 3 × 3.
 *
 * Model space: origin = the footprint centre on the ground, x east, y up, z south (world axes). Towers aim
 * along local +x; the planner turns each one to face away from the base.
 *
 * Read-only on the sim: the planners read structure / resource-node records and never write to them. No
 * Date.now / Math.random — facet jitter and crystal clusters come from seeded hashes.
 */
import { rng } from '../obstructions/placement.js';
import { hexRGB } from '../ground/lowpoly.js';

export const HEIGHT = Object.freeze({ wall: 0.6, tower: 1.4, base: 1.8, bay: 0.5, crystal: 1 });

// ── facet builder ─────────────────────────────────────────────────────────────────────────────────────

/** A transform: scale, then rotate about Z, X, then Y (yaw last), then translate. Returns p → p'. */
export function xform({ s = [1, 1, 1], r = [0, 0, 0], t = [0, 0, 0] } = {}) {
  const [rx, ry, rz] = r;
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return ([x, y, z]) => {
    x *= s[0]; y *= s[1]; z *= s[2];
    let a = x * cz - y * sz, b = x * sz + y * cz; x = a; y = b;      // Z
    a = y * cx - z * sx; b = y * sx + z * cx; y = a; z = b;          // X
    a = x * cy + z * sy; b = -x * sy + z * cy; x = a; z = b;         // Y (right-handed: +x → -z for +ry)
    return [x + t[0], y + t[1], z + t[2]];
  };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Accumulates flat-coloured triangles. `tri(a, b, c, rgb, inside)` winds the triangle so its face normal
 * points AWAY from `inside` (every primitive here is convex, so its own centre is a valid inside point).
 */
export function createFacets(seed = 1, jitter = 0.08) {
  const pos = [], col = [];
  const R = rng(seed);
  return {
    tri(a, b, c, rgb, inside) {
      let n = cross(sub(b, a), sub(c, a));
      if (inside) {
        const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
        if (dot(n, sub(m, inside)) < 0) { const t = b; b = c; c = t; }
      }
      const k = 1 + (R() - 0.5) * jitter;
      for (const v of [a, b, c]) { pos.push(v[0], v[1], v[2]); col.push(rgb[0] * k, rgb[1] * k, rgb[2] * k); }
    },
    get triangles() { return pos.length / 9; },
    /** Finish: optional exact-height fit, then flat face normals. */
    arrays(fitTo) {
      const position = new Float32Array(pos), color = new Float32Array(col);
      if (fitTo) fitHeight(position, fitTo);
      return { position, normal: faceNormals(position), color, triangles: position.length / 9 };
    },
  };
}

/** Scale y so the model's top is exactly `h` (the ground stays at 0). */
export function fitHeight(position, h) {
  let top = -Infinity;
  for (let i = 1; i < position.length; i += 3) top = Math.max(top, position[i]);
  if (!(top > 0)) return;
  const k = h / top;
  for (let i = 1; i < position.length; i += 3) position[i] = position[i] === top ? h : position[i] * k;
}

/** One normal per triangle, copied to its three vertices (non-indexed → the faceted look). */
export function faceNormals(position) {
  const normal = new Float32Array(position.length);
  for (let i = 0; i < position.length; i += 9) {
    const a = [position[i], position[i + 1], position[i + 2]];
    const n = cross(sub([position[i + 3], position[i + 4], position[i + 5]], a), sub([position[i + 6], position[i + 7], position[i + 8]], a));
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    for (let v = 0; v < 3; v++) { normal[i + v * 3] = n[0] / l; normal[i + v * 3 + 1] = n[1] / l; normal[i + v * 3 + 2] = n[2] / l; }
  }
  return normal;
}

/**
 * A closed n-sided frustum (prism when rb = rt, pyramid when rt = 0) from y0 to y1, through transform T.
 * Colours: side, top cap, bottom cap. `phase` turns the ring (π/n puts a flat face square to the axes).
 */
export function prism(F, T, { n = 6, rb = 0.5, rt = rb, y0 = 0, y1 = 1, phase = 0, side, top = side, bottom = side }) {
  const ring = (r, y) => Array.from({ length: n }, (_, i) => { const a = phase + (i / n) * Math.PI * 2; return T([Math.cos(a) * r, y, Math.sin(a) * r]); });
  const B = ring(rb, y0), U = rt > 0 ? ring(rt, y1) : null, apex = T([0, y1, 0]);
  const inside = T([0, (y0 + y1) / 2, 0]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (U) { F.tri(B[i], B[j], U[j], side, inside); F.tri(B[i], U[j], U[i], side, inside); } else F.tri(B[i], B[j], apex, side, inside);
  }
  const cb = T([0, y0, 0]);
  for (let i = 0; i < n; i++) F.tri(cb, B[i], B[(i + 1) % n], bottom, inside);
  if (U) { const ct = T([0, y1, 0]); for (let i = 0; i < n; i++) F.tri(ct, U[i], U[(i + 1) % n], top, inside); }
}

/** An axis-aligned box w × h × d standing on y0, centred on (x, z), through transform T. */
export function box(F, T, { w, h, d, x = 0, y0 = 0, z = 0, side, top = side }) {
  const r = Math.SQRT1_2;
  prism(F, (p) => T([x + p[0] * w, p[1], z + p[2] * d]), { n: 4, rb: r, rt: r, y0, y1: y0 + h, phase: Math.PI / 4, side, top, bottom: side });
}

/** A crystal shard: an n-sided bipyramid, waist radius r at y = waist, tip at y = 1, foot at y = foot. */
export function bipyramid(F, T, { n = 6, r = 0.5, waist = 0.28, foot = -0.08, upper, lower }) {
  const ring = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return T([Math.cos(a) * r, waist, Math.sin(a) * r]); });
  const tip = T([0, 1, 0]), bot = T([0, foot, 0]), inside = T([0, waist, 0]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    F.tri(ring[i], ring[j], tip, upper, inside);
    F.tri(ring[i], ring[j], bot, lower, inside);
  }
}

// ── the models ────────────────────────────────────────────────────────────────────────────────────────

const ID = xform();
const pal = (struct) => Object.fromEntries(Object.entries(struct).map(([k, v]) => [k, hexRGB(v)]));
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

/** Crenellations: `perSide` merlons along each side of a square of half-size `half`, standing on y0. */
function merlonsSquare(F, T, half, y0, size, h, col, perSide = 2) {
  for (let s = 0; s < 4; s++) for (let k = 0; k < perSide; k++) {
    const along = perSide === 1 ? 0 : -half + size / 2 + k * ((2 * half - size) / (perSide - 1));
    const [x, z] = s === 0 ? [along, -half + size / 2] : s === 1 ? [half - size / 2, along] : s === 2 ? [-along, half - size / 2] : [-half + size / 2, -along];
    box(F, T, { w: size, h, d: size, x, z, y0, side: col });
  }
}

/** Crenellations around a ring of radius `r`. */
function merlonsRing(F, T, r, y0, n, size, h, col, phase = 0) {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    box(F, T, { w: size, h, d: size, x: Math.cos(a) * r, z: Math.sin(a) * r, y0, side: col });
  }
}

/** The base: 3 × 3 cells, keep top at exactly 1.8. A plinth, a curtain wall with merlons, four corner
 * turrets with roofs, a gate on the south face and the keep with its pyramid roof. */
export function buildBaseModel(struct) {
  const P = pal(struct);
  const F = createFacets(1802);
  prism(F, ID, { n: 8, rb: 1.46, rt: 1.38, y0: 0, y1: 0.22, phase: Math.PI / 8, side: P.stoneDark });
  box(F, ID, { w: 2.3, h: 0.6, d: 2.3, y0: 0.22, side: P.stone, top: mul(P.stoneDark, 1.05) });
  merlonsSquare(F, ID, 1.15, 0.82, 0.2, 0.16, P.stone, 4);
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]]) {
    const T = xform({ t: [x, 0, z] });
    prism(F, T, { n: 6, rb: 0.36, rt: 0.32, y0: 0, y1: 1.12, side: P.stone, top: P.stoneDark });
    prism(F, T, { n: 6, rb: 0.4, rt: 0, y0: 1.12, y1: 1.46, side: P.roof });
  }
  box(F, ID, { w: 0.46, h: 0.42, d: 0.1, z: 1.17, y0: 0.22, side: P.trim });                 // gate
  box(F, ID, { w: 1.12, h: 0.62, d: 1.12, y0: 0.82, side: mul(P.stone, 1.04), top: P.stoneDark });   // keep
  merlonsSquare(F, ID, 0.56, 1.44, 0.16, 0.12, mul(P.stone, 1.04), 3);
  prism(F, ID, { n: 4, rb: 0.62, rt: 0, y0: 1.44, y1: 1.8, phase: Math.PI / 4, side: P.roof });
  return F.arrays(HEIGHT.base);
}

/** A wall post: plinth, block, four corner merlons — top exactly 0.6, inside ±0.3 of the cell centre. */
export function buildWallPost(struct) {
  const P = pal(struct), F = createFacets(601);
  box(F, ID, { w: 0.58, h: 0.1, d: 0.58, side: P.stoneDark });
  box(F, ID, { w: 0.5, h: 0.4, d: 0.5, y0: 0.1, side: P.stone, top: P.stoneDark });
  merlonsSquare(F, ID, 0.25, 0.5, 0.14, 0.1, P.stone, 2);
  return F.arrays(HEIGHT.wall);
}

/** A wall arm: the curtain from a post out to the cell edge along +x (x 0.2 → 0.5), lower than the post. */
export function buildWallArm(struct) {
  const P = pal(struct), F = createFacets(602);
  box(F, ID, { w: 0.3, h: 0.08, d: 0.4, x: 0.35, side: P.stoneDark });
  box(F, ID, { w: 0.3, h: 0.34, d: 0.32, x: 0.35, y0: 0.08, side: P.stone, top: P.stoneDark });
  box(F, ID, { w: 0.12, h: 0.1, d: 0.12, x: 0.38, y0: 0.42, side: P.stone });
  return F.arrays(0.52);
}

/** Cannon tower (anti-ground): round stone tower, roof-coloured band, crenellated parapet, a metal turret
 * with a HORIZONTAL barrel along +x. Top exactly 1.4. */
export function buildCannonTower(struct) {
  const P = pal(struct), F = createFacets(1401);
  prism(F, ID, { n: 8, rb: 0.42, rt: 0.4, y0: 0, y1: 0.12, phase: Math.PI / 8, side: P.stoneDark });
  prism(F, ID, { n: 8, rb: 0.36, rt: 0.31, y0: 0.12, y1: 0.92, phase: Math.PI / 8, side: P.stone });
  prism(F, ID, { n: 8, rb: 0.345, rt: 0.335, y0: 0.5, y1: 0.6, phase: Math.PI / 8, side: P.roof });
  prism(F, ID, { n: 8, rb: 0.38, rt: 0.38, y0: 0.92, y1: 1.02, phase: Math.PI / 8, side: P.stoneDark });
  merlonsRing(F, ID, 0.32, 1.02, 8, 0.1, 0.1, P.stone, Math.PI / 8);
  prism(F, ID, { n: 6, rb: 0.2, rt: 0.15, y0: 1.02, y1: 1.24, side: P.metal });
  prism(F, ID, { n: 6, rb: 0.15, rt: 0, y0: 1.24, y1: 1.4, side: P.roof });
  prism(F, xform({ r: [0, 0, -Math.PI / 2], t: [0.08, 1.14, 0] }), { n: 6, rb: 0.055, rt: 0.045, y0: 0, y1: 0.42, side: mul(P.metal, 0.8) });
  return F.arrays(HEIGHT.tower);
}

/** Flak tower (anti-air): a square metal lattice on a stone foot, a trim-coloured platform and TWIN
 * barrels raked up toward +x. Top exactly 1.4. Reads apart from the cannon by shape (square, legs, guns
 * pointing up) and colour (metal + trim instead of stone + roof). */
export function buildFlakTower(struct) {
  const P = pal(struct), F = createFacets(1402);
  box(F, ID, { w: 0.66, h: 0.14, d: 0.66, side: P.stoneDark });
  for (const [x, z] of [[-0.24, -0.24], [0.24, -0.24], [0.24, 0.24], [-0.24, 0.24]]) {
    const lean = 0.09, T = xform({ r: [z > 0 ? -lean : lean, 0, x > 0 ? lean : -lean], t: [x, 0.14, z] });
    prism(F, T, { n: 4, rb: 0.055, rt: 0.045, y0: 0, y1: 0.74, phase: Math.PI / 4, side: P.metal });
  }
  prism(F, ID, { n: 4, rb: 0.24, rt: 0.17, y0: 0.14, y1: 0.86, phase: Math.PI / 4, side: P.trim });
  box(F, ID, { w: 0.6, h: 0.08, d: 0.6, y0: 0.86, side: P.trim, top: mul(P.trim, 1.1) });
  prism(F, ID, { n: 6, rb: 0.2, rt: 0.17, y0: 0.94, y1: 1.08, side: P.metal });
  for (const dz of [-0.07, 0.07]) {
    prism(F, xform({ r: [0, 0, -0.62], t: [0.02, 1.02, dz] }), { n: 5, rb: 0.04, rt: 0.032, y0: 0, y1: 0.42, side: mul(P.metal, 0.75) });
  }
  return F.arrays(HEIGHT.tower);
}

/** The harvester bay while it builds (it converts into a harvester): a wooden pad with crates. */
export function buildBay(struct) {
  const P = pal(struct), F = createFacets(501);
  box(F, ID, { w: 0.8, h: 0.08, d: 0.8, side: P.stoneDark });
  box(F, ID, { w: 0.34, h: 0.3, d: 0.34, x: -0.14, z: 0.1, y0: 0.08, side: P.wood });
  box(F, ID, { w: 0.26, h: 0.22, d: 0.26, x: 0.18, z: -0.12, y0: 0.08, side: mul(P.wood, 0.85) });
  box(F, ID, { w: 0.22, h: 0.12, d: 0.22, x: -0.14, z: 0.1, y0: 0.38, side: P.trim });
  return F.arrays(HEIGHT.bay);
}

/** Any other structure kind: the old 0.86 × 1 block, faceted, so nothing ever goes missing. */
export function buildFallback(struct) {
  const P = pal(struct), F = createFacets(101);
  box(F, ID, { w: 0.86, h: 1, d: 0.86, side: P.stone, top: P.stoneDark });
  return F.arrays(1);
}

/** One crystal shard, unit height, GREY facets (upper bright, lower darker) — the instance colour tints it. */
export function buildCrystalShard() {
  const F = createFacets(901, 0.24);
  bipyramid(F, ID, { n: 6, r: 0.5, waist: 0.3, foot: -0.1, upper: [1.28, 1.28, 1.28], lower: [0.7, 0.7, 0.74] });   // > 1: the lit facets glint
  return F.arrays();
}

/** Every structure model for a world's `struct` palette, keyed by instancing group. */
export function buildStructureModels(struct) {
  return {
    wallPost: buildWallPost(struct), wallArm: buildWallArm(struct),
    cannon: buildCannonTower(struct), flak: buildFlakTower(struct),
    bay: buildBay(struct), other: buildFallback(struct),
  };
}

// ── layout ────────────────────────────────────────────────────────────────────────────────────────────

/** Instancing group for a sim structure kind. */
export function groupOf(kind) {
  return kind === 'wall' ? 'wallPost' : kind === 'antiGround' ? 'cannon' : kind === 'antiAir' ? 'flak' : kind === 'harvestorBay' ? 'bay' : 'other';
}

/** Instance tint (multiplies the facet colours) + vertical scale for a lifecycle. Building rises in 4 steps
 * (so the static shadow map re-renders at most 4 times per build, never per frame). */
export function lifecycleLook(s) {
  const lc = s.lifecycle;
  if (lc === 'Building' || lc === 'Placing') {
    const step = Math.min(3, Math.floor(Math.max(0, s.progress || 0) * 4));
    return { key: 'B' + step, sy: 0.3 + 0.6 * (step / 3), tint: [0.78, 0.9, 1.22] };
  }
  if (lc === 'Upgrading') return { key: 'U', sy: 1, tint: [1.22, 1.12, 0.78] };
  if (lc === 'Selling') return { key: 'S', sy: 1, tint: [0.62, 0.62, 0.64] };
  const frac = s.maxHp > 0 ? s.hp / s.maxHp : 1;
  if (lc === 'Damaged' || frac < 1) {
    return frac < 0.4 ? { key: 'D2', sy: 1, tint: [0.62, 0.46, 0.42] } : { key: 'D1', sy: 1, tint: [0.84, 0.7, 0.64] };
  }
  return { key: 'C', sy: 1, tint: [1, 1, 1] };
}

const WALL_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // east, south, west, north

/** Yaw that turns local +x toward world direction (dx, dz) — see xform's Y rotation. */
export function yawToward(dx, dz) { return Math.atan2(-dz, dx); }

/**
 * Plan the instances for a list of sim structures. Returns { groups: { wallPost: [...], wallArm, cannon,
 * flak, bay, other }, sig } — each instance { x, z, ry, sx, sy, sz, tint }. `base` ({x, y} centre cell) aims
 * the towers outward. Destroyed structures are skipped. Walls join: an arm toward every orthogonal wall
 * neighbour, so a line of walls reads as one curtain.
 */
export function planStructures(list, base = null) {
  const groups = { wallPost: [], wallArm: [], cannon: [], flak: [], bay: [], other: [] };
  const live = list.filter((s) => s && s.lifecycle !== 'Destroyed');
  const walls = new Set();
  for (const s of live) if (s.kind === 'wall') walls.add(`${cellOf(s).x},${cellOf(s).y}`);
  const bx = base ? base.x + 0.5 : null, bz = base ? base.y + 0.5 : null;
  const sig = [];
  for (const s of live) {
    const c = cellOf(s), w = (s.footprint && s.footprint.w) || 1, h = (s.footprint && s.footprint.h) || 1;
    const x = c.x + w / 2, z = c.y + h / 2;
    const look = lifecycleLook(s), g = groupOf(s.kind);
    let ry = 0;
    if ((g === 'cannon' || g === 'flak') && bx !== null && (x !== bx || z !== bz)) ry = yawToward(x - bx, z - bz);
    groups[g].push({ x, z, ry, sx: w, sy: look.sy, sz: h, tint: look.tint });
    sig.push(`${s.id}:${s.kind}@${c.x},${c.y}:${look.key}`);
    if (g === 'wallPost') {
      for (const [dx, dz] of WALL_DIRS) {
        if (!walls.has(`${c.x + dx},${c.y + dz}`)) continue;
        groups.wallArm.push({ x, z, ry: yawToward(dx, dz), sx: 1, sy: look.sy, sz: 1, tint: look.tint });
      }
    }
  }
  return { groups, sig: sig.join('|') };
}

function cellOf(s) {
  const c = s.cell || s.pos;
  return { x: Math.floor(c.x), y: Math.floor(c.y) };
}

const hashStr = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };

/** Which wave's ring is revealed (harvest.js nodeRevealed / the Pixi renderer: a field arrives with its ring). */
export function revealedWave(state) {
  const cur = Math.max(1, (state && state.waves && state.waves.current) || 1);
  const rings = state && state.map && state.map.rings;
  return rings && rings.length ? Math.min(cur, rings.length) : Math.min(cur, 8);
}

/**
 * Plan the crystal shards for the live resource nodes. Returns { shards: [{ x, y, z, ry, rx, rz, w, h,
 * color }], sig }. A node shows 3–5 shards in its own colour (deterministic from its id), shrinking as the
 * field drains (quantized to quarters so the shadow map re-renders rarely); a regrowing primary at zero
 * shows as faint stubs; a consumed or crushed node, or one whose ring hasn't arrived, shows nothing.
 * `colours` = { blue, yellow, red, green } as [r, g, b].
 */
export function planCrystals(nodes, wave, colours) {
  const shards = [], sig = [];
  for (const n of nodes || []) {
    if (n.wave != null && n.wave > wave) continue;
    const units = n.units || 0;
    const frac = units ? Math.max(0, (n.remaining != null ? n.remaining : units) / units) : 1;
    if (frac <= 0 && !n.respawns) continue;
    const q = frac <= 0 ? 0 : Math.ceil(frac * 4) / 4;
    const base = colours[n.color] || colours.blue;
    const col = q === 0 ? mul(base, 0.45) : base;
    const size = q === 0 ? 0.3 : 0.55 + 0.45 * q;
    sig.push(`${n.id}:${q}:${n.color}`);
    const R = rng(hashStr(String(n.id)));
    const count = 3 + Math.floor(R() * 3);
    for (let k = 0; k < count; k++) {
      // the first shard stands tall in the middle; the rest splay OUTWARD around it (lean away from the centre)
      const a = R() * Math.PI * 2, d = k === 0 ? R() * 0.05 : 0.1 + R() * 0.14;
      const hh = (k === 0 ? 0.74 : 0.34 + R() * 0.28) * size;
      const lean = k === 0 ? R() * 0.15 : 0.3 + R() * 0.35;
      shards.push({
        x: n.x + 0.5 + Math.cos(a) * d, y: 0, z: n.y + 0.5 + Math.sin(a) * d,
        rx: 0, ry: yawToward(Math.cos(a), Math.sin(a)), rz: -lean,       // three's XYZ order: lean (Z) then turn (Y)
        w: (0.2 + R() * 0.1) * Math.max(0.6, size), h: hh, color: col.map((v) => v * (0.92 + R() * 0.16)),
      });
    }
  }
  return { shards, sig: sig.join('|') };
}
