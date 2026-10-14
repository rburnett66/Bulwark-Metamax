/**
 * src/render3d/obstructions/placement.js — WHERE the 3D obstructions go (plan v2.2.2 §4; code design §4.8;
 * T4 [MM-story_mv77hsxk_6]). Pure data: no three.js, no DOM.
 *
 * Built only from the map the SIM uses (`blockedCells` from bakedBlocking, the forge terrain codes and the
 * level's authored `decor[]`), never the raw forge mask (T0 audit §4). Terrain codes (terrainGen.js):
 *   5 cliff / 9 cliff-border, blocked → a PLATEAU: a pile of faceted boulders, up to three courses
 *   3 rocks, blocked                 → a large boulder (+ a pebble)
 *   8 rock-border (walkable)         → occasional small stones (cosmetic; units walk over them)
 *   4 trees, blocked                 → trees: the level's authored decor[] first, then fill
 *
 * INVARIANT — no invisible walls: every blocked cell with one of those codes gets at least one solid piece,
 * so a unit is never stopped by empty ground. (Water, code 6, is its own layer: story W.)
 *
 * Deterministic: a seeded mulberry32 stream (no Math.random), so the same map always builds the same world.
 * Records are in WORLD units (x east, y up, z south; cell centre = index + 0.5).
 */

export const CODE = Object.freeze({ ROCKS: 3, TREES: 4, CLIFF: 5, ROCK_BORDER: 8, CLIFF_BORDER: 9 });
const PLATEAU = new Set([CODE.CLIFF, CODE.CLIFF_BORDER]);

/** mulberry32 — the same generator the prototype used, so the look matches what the owner approved. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Plan every obstruction for a map. Returns
 *   { rocks: [{ shape, x, y, z, sx, sy, sz, rx, ry, rz, tone }], trees: [{ kind, x, z, s, ry, … }],
 *     cover: Set<cellIndex> }   — `cover` = blocked cells that received a solid piece (for the invariant).
 * `shape`: 'blob' | 'small'; `tone`: 'plateau' | 'plateau2' | 'plateau3' | 'rock' | 'pebble'.
 * Tree kinds: 'round' (trunk, two branches, canopy) | 'pine' (2–3 stacked cones).
 */
export function planObstructions(map, { seed = 1234 } = {}) {
  const { cols, rows } = map;
  const terrain = map.terrain || [];
  const blocked = new Set((map.blockedCells || []).map((c) => c.y * cols + c.x));
  const R = rng(seed);
  const rocks = [], trees = [], cover = new Set();
  const tilt = () => [(R() - 0.5) * 0.5, R() * Math.PI * 2, (R() - 0.5) * 0.5];
  const rock = (shape, tone, x, y, z, sx, sy, sz) => { const [rx, ry, rz] = tilt(); rocks.push({ shape, tone, x, y, z, sx, sy, sz, rx, ry, rz, variant: (R() * 6) | 0 }); };

  const isPlateau = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows
    && PLATEAU.has(terrain[y * cols + x]) && blocked.has(y * cols + x);

  // PLATEAUS — first course always (the invariant), upper courses where the plateau is thick.
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!isPlateau(x, y)) continue;
    const inner = isPlateau(x - 1, y) + isPlateau(x + 1, y) + isPlateau(x, y - 1) + isPlateau(x, y + 1);
    const s = 0.62 + R() * 0.22;
    rock('blob', 'plateau', x + 0.5 + (R() - 0.5) * 0.3, s * 0.55, y + 0.5 + (R() - 0.5) * 0.3, s, s * (0.8 + R() * 0.3), s);
    cover.add(y * cols + x);
    if (inner >= 2 && R() < 0.75) {
      const s2 = 0.5 + R() * 0.25;
      rock('blob', 'plateau2', x + 0.5 + (R() - 0.5) * 0.4, 0.95 + R() * 0.35, y + 0.5 + (R() - 0.5) * 0.4, s2, s2 * 0.9, s2);
    }
    if (inner >= 4 && R() < 0.45) {
      const s3 = 0.42 + R() * 0.2;
      rock('blob', 'plateau3', x + 0.5, 1.55 + R() * 0.3, y + 0.5, s3, s3, s3);
    }
  }

  // ROCK cells → a boulder (+ pebble); ROCK-BORDER → occasional small stones.
  for (let i = 0; i < cols * rows; i++) {
    const t = terrain[i], x = i % cols, y = (i / cols) | 0;
    if (t === CODE.ROCKS && blocked.has(i)) {
      const s = 0.42 + R() * 0.2;
      rock('blob', 'rock', x + 0.5, s * 0.5, y + 0.5, s * 1.1, s * 0.85, s);
      cover.add(i);
      if (R() < 0.6) { const s2 = 0.22 + R() * 0.12; rock('small', 'pebble', x + 0.15 + R() * 0.7, s2 * 0.4, y + 0.15 + R() * 0.7, s2, s2 * 0.8, s2); }
    } else if (t === CODE.ROCK_BORDER && R() < 0.3) {
      const s2 = 0.1 + R() * 0.1;
      rock('small', 'pebble', x + 0.2 + R() * 0.6, s2 * 0.4, y + 0.2 + R() * 0.6, s2, s2 * 0.75, s2);
    }
  }

  // TREES — the level's authored groves first (authoritative positions), then every blocked tree cell
  // that is still bare gets one (prototype filled 70%; 100% here keeps the no-invisible-walls invariant).
  const tree = (x, z, s) => {
    if (R() < 0.55) {
      trees.push({ kind: 'round', x, z, s, h: (0.75 + R() * 0.35) * s, rc: (0.42 + R() * 0.16) * s, ry: R() * Math.PI * 2,
        canopy: (R() * 5) | 0, rare: R() < 0.08, variant: (R() * 2) | 0 });
    } else {
      trees.push({ kind: 'pine', x, z, s, n: 2 + (R() < 0.5 ? 1 : 0), H: (1.2 + R() * 0.6) * s, ry: R() * Math.PI * 2, tone: (R() * 4) | 0 });
    }
  };
  const used = new Set();
  for (const d of map.decor || []) {
    tree(d.x + 0.5 + (d.dx || 0), d.y + 0.5 + (d.dy || 0), (d.s || 1) * 1.05);
    const i = d.y * cols + d.x;
    used.add(i);
    if (blocked.has(i)) cover.add(i);
  }
  for (let i = 0; i < cols * rows; i++) {
    if (terrain[i] !== CODE.TREES || !blocked.has(i) || used.has(i)) continue;
    tree((i % cols) + 0.2 + R() * 0.6, ((i / cols) | 0) + 0.2 + R() * 0.6, 0.85 + R() * 0.3);
    cover.add(i);
  }
  return { rocks, trees, cover };
}

/** Blocked cells (of the obstruction codes) that got NO solid piece — must be empty (the invariant). */
export function invisibleWalls(map, plan) {
  const { cols } = map;
  const out = [];
  for (const c of map.blockedCells || []) {
    const i = c.y * cols + c.x, t = (map.terrain || [])[i];
    if ((t === CODE.ROCKS || t === CODE.TREES || PLATEAU.has(t)) && !plan.cover.has(i)) out.push(c);
  }
  return out;
}
