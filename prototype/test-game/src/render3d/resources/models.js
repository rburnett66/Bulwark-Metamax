/**
 * src/render3d/resources/models.js — 3D models for every collectible resource. DATA, no three.js. [MM-story_mvbks25v_5]
 *
 * Every homeworld has four resources (data/planets.js, [MM-story_mvaf1d85_v]): COMMON (the field the player
 * harvests — primary role, blue ring), UNCOMMON (premium, yellow ring, worth 2×), RARE and EPIC (the quest crops
 * collected for the unknown associate — red and green rings). 9 planets × 4 tiers = 36 models.
 *
 * Same part schema as the unit models (box / cyl / ext / loft / ell, one material key per part) and built by the
 * same units/prims.js, but in CELL units: a node stands on one cell, so a model fits a 0.9 × 0.9 footprint and
 * stays under ~0.95 tall (taller than a crystal, shorter than a tower). Origin = cell centre on the ground.
 * Each model carries its own palette; keys starting `glow` are drawn unlit (they carry the read at battle zoom).
 *
 * Scatter inside a model uses a fixed per-model seed, so every node of a type looks the same and the
 * renderer adds a per-node yaw + small scale jitter (planResources).
 */
import { PLANETS } from '../../data/planets.js';

const D = Math.PI / 180;
export const TIERS = Object.freeze(['common', 'uncommon', 'rare', 'epic']);

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// n points spread around the centre (golden angle), radius rMax, jittered
function spread(n, rMax, R, r0 = 0) {
  return Array.from({ length: n }, (_, i) => { const a = i * 137.5 * D + R() * 0.6, r = r0 + (rMax - r0) * Math.sqrt((i + 0.5) / n); return [Math.cos(a) * r, Math.sin(a) * r, a]; });
}
const disc = (r, m, y = 0.015, h = 0.03, seg = 12) => ({ t: 'cyl', r: [r * 0.92, r], l: h, seg, p: [0, y, 0], m });
const mound = (r, h, m, y = 0) => ({ t: 'ell', s: [r, h, r * 0.92], seg: 10, half: true, p: [0, y, 0], m });
const rad = (a) => a / D;
// the part's local +Y axis after its r3 rotation (three Euler 'YZX': X first, then Z, then Y) — to put a tip on a tilted prism
function upOf([ax = 0, ay = 0, az = 0]) {
  let x = 0, y = Math.cos(ax * D), z = Math.sin(ax * D);
  [x, y] = [x * Math.cos(az * D) - y * Math.sin(az * D), x * Math.sin(az * D) + y * Math.cos(az * D)];
  [x, z] = [x * Math.cos(ay * D) + z * Math.sin(ay * D), -x * Math.sin(ay * D) + z * Math.cos(ay * D)];
  return [x, y, z];
}
const along = (p, r3, d) => { const u = upOf(r3); return [p[0] + u[0] * d, p[1] + u[1] * d, p[2] + u[2] * d]; };

const M = {};
function model(planet, tier, name, palette, parts) { M[`${planet}.${tier}`] = { key: `${planet}.${tier}`, planet, tier, name, palette, parts }; }

// ══ VERDANCE (Ground / Powder) — fields and old forest ═══════════════════════════════════════════════════
{
  const R = rng(11);
  model('ground', 'common', 'Loam Grain', { soil: '#6a5034', stalk: '#c8a848', grain: '#e8c860', band: '#8a5a2a' }, [
    mound(0.36, 0.06, 'soil'),
    ...spread(3, 0.2, R).flatMap(([x, z]) => [
      ...Array.from({ length: 7 }, (_, i) => { const a = i / 7 * Math.PI * 2, dx = Math.cos(a) * 0.035, dz = Math.sin(a) * 0.035, t = 7;
        return [{ t: 'cyl', r: 0.011, l: 0.5, seg: 4, p: [x + dx, 0.27, z + dz], r3: [dz * 200, 0, -dx * 200], m: 'stalk' },
          { t: 'ell', s: [0.028, 0.075, 0.028], seg: 6, p: [x + dx * 2.2, 0.55, z + dz * 2.2], r3: [dz * 300, 0, -dx * 300], m: 'grain' }]; }).flat(),
      { t: 'cyl', r: 0.055, l: 0.04, seg: 8, p: [x, 0.2, z], m: 'band' },
    ]),
  ]);
  const R2 = rng(12);
  model('ground', 'uncommon', 'Heartwood Amber', { wood: '#6b4426', woodTop: '#c09060', amber: '#e08a1e', glowA: '#ffb03a' }, [
    { t: 'cyl', r: [0.21, 0.25], l: 0.24, seg: 10, p: [0, 0.12, 0], m: 'wood' },
    { t: 'cyl', r: 0.205, l: 0.02, seg: 10, p: [0, 0.245, 0], m: 'woodTop' },
    ...[0, 72, 144, 216, 288].map((a) => ({ t: 'box', s: [0.12, 0.08, 0.06], p: [Math.cos(a * D) * 0.25, 0.04, Math.sin(a * D) * 0.25], r3: [0, -a, 0], m: 'wood' })),
    ...spread(4, 0.13, R2).map(([x, z], i) => ({ t: 'ell', s: [0.07 + i * 0.012, 0.09 + i * 0.015, 0.07], seg: 8, p: [x, 0.3 + i * 0.02, z], m: 'amber' })),
    { t: 'ell', s: [0.1, 0.14, 0.1], seg: 8, p: [0.02, 0.4, -0.02], m: 'glowA' },
  ]);
  const R3 = rng(13);
  model('ground', 'rare', 'Rootsong Seeds', { soil: '#4e3a26', root: '#7a5636', glowS: '#9aff7a' }, [
    mound(0.34, 0.13, 'soil'),
    ...[0, 70, 150, 220, 290].map((a, i) => ({ t: 'box', s: [0.42, 0.045, 0.05], p: [Math.cos(a * D) * 0.12, 0.13 + (i % 2) * 0.03, Math.sin(a * D) * 0.12], r3: [0, -a, 18 + (i % 3) * 8], m: 'root' })),
    ...spread(6, 0.24, R3, 0.06).map(([x, z]) => ({ t: 'ell', s: [0.04, 0.055, 0.04], seg: 6, p: [x, 0.14 + R3() * 0.06, z], m: 'glowS' })),
  ]);
  model('ground', 'epic', 'Elder Bloom', { stem: '#3a7a3a', leaf: '#4fa04a', petal: '#f6f0e4', petal2: '#f0d6a0', glowC: '#ffd84a' }, [
    { t: 'cyl', r: [0.02, 0.03], l: 0.55, seg: 6, p: [0, 0.27, 0], m: 'stem' },
    ...[0, 120, 240].map((a) => ({ t: 'ell', s: [0.16, 0.022, 0.06], seg: 8, p: [Math.cos(a * D) * 0.12, 0.13, -Math.sin(a * D) * 0.12], r3: [0, a, 22], m: 'leaf' })),
    ...Array.from({ length: 8 }, (_, i) => { const a = i * 45; return { t: 'ell', s: [0.15, 0.025, 0.065], seg: 8, p: [Math.cos(a * D) * 0.13, 0.6, -Math.sin(a * D) * 0.13], r3: [0, a, 28], m: i % 2 ? 'petal' : 'petal2' }; }),
    ...Array.from({ length: 5 }, (_, i) => { const a = i * 72 + 20; return { t: 'ell', s: [0.09, 0.02, 0.045], seg: 6, p: [Math.cos(a * D) * 0.06, 0.66, -Math.sin(a * D) * 0.06], r3: [0, a, 52], m: 'petal' }; }),
    { t: 'ell', s: [0.065, 0.06, 0.065], seg: 8, p: [0, 0.66, 0], m: 'glowC' },
  ]);
}

// ══ FLORAEL (Air) — blossom skies ═══════════════════════════════════════════════════════════════════════
{
  model('air', 'common', 'Petal Silk', { silk: '#f6c6dc', silk2: '#fff4f8', core: '#c890b0', petal: '#f0a0c8' }, [
    { t: 'cyl', ax: 'z', r: 0.085, l: 0.42, seg: 10, p: [0, 0.085, -0.08], r3: [0, 20, 0], m: 'silk' },
    { t: 'cyl', ax: 'z', r: 0.075, l: 0.38, seg: 10, p: [0.05, 0.085, 0.12], r3: [0, -15, 0], m: 'silk2' },
    { t: 'cyl', ax: 'z', r: 0.07, l: 0.36, seg: 10, p: [0.02, 0.24, 0.02], r3: [0, 60, 0], m: 'silk' },
    ...[[0, 20, -0.08], [0.05, -15, 0.12], [0.02, 60, 0.02]].map(([x, a, z], i) => ({ t: 'cyl', ax: 'z', r: 0.025, l: 0.46, seg: 6, p: [x, i === 2 ? 0.24 : 0.085, z], r3: [0, a, 0], m: 'core' })),
    { t: 'box', s: [0.36, 0.01, 0.12], p: [0.08, 0.17, -0.22], r3: [10, 30, -8], m: 'silk2' },
    ...[[-0.25, 0.15], [0.26, -0.1], [-0.1, 0.3], [0.3, 0.22]].map(([x, z], i) => ({ t: 'ell', s: [0.05, 0.012, 0.03], seg: 6, p: [x, 0.02, z], r3: [0, i * 50, 0], m: 'petal' })),
  ]);
  const comb = [];
  const hex = (q, r) => [0.135 * (q + r / 2), 0.117 * r];
  for (const [q, r, l] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [1, -1, 0], [-1, 1, 0], [0, 0, 1], [1, -1, 1], [0, 1, 1]]) {
    const [x, z] = hex(q, r), y = 0.07 + l * 0.12;
    comb.push({ t: 'cyl', r: 0.07, l: 0.14, seg: 6, p: [x, y, z], m: 'comb' }, { t: 'cyl', r: 0.05, l: 0.01, seg: 6, p: [x, y + 0.071, z], m: l ? 'glowH' : 'honey' });
  }
  model('air', 'uncommon', 'Skyhoney', { comb: '#e6b23a', honey: '#ffcc40', glowH: '#ffd860', drip: '#f0a020' }, [
    ...comb,
    { t: 'ell', s: [0.03, 0.06, 0.03], seg: 6, p: [0.25, 0.08, 0.02], m: 'drip' },
    { t: 'ell', s: [0.025, 0.05, 0.025], seg: 6, p: [-0.17, 0.05, 0.14], m: 'drip' },
  ]);
  const R4 = rng(23);
  model('air', 'rare', 'Dawnpollen', { stem: '#7ab86a', leaf: '#8ccc78', glowP: '#fff2a8', glowP2: '#ffe0f0' }, [
    disc(0.3, 'leaf'),
    ...spread(4, 0.2, R4).flatMap(([x, z], i) => { const h = 0.4 + i * 0.1; return [
      { t: 'cyl', r: 0.012, l: h, seg: 4, p: [x, h / 2, z], m: 'stem' },
      { t: 'ell', s: [0.085, 0.085, 0.085], seg: 10, p: [x, h + 0.05, z], m: i % 2 ? 'glowP2' : 'glowP' },
      { t: 'ell', s: [0.12, 0.02, 0.04], seg: 6, p: [x + 0.06, 0.05, z], r3: [0, i * 80, 18], m: 'leaf' },
    ]; }),
  ]);
  model('air', 'epic', 'Choir Lily', { stem: '#4a9a5a', leaf: '#5ab06a', petal: '#fbf6ff', throat: '#f0c8e8', glowL: '#ffe8ff' }, [
    ...[[0, 0, 0.62, 0], [0.14, 0.08, 0.5, 120], [-0.12, -0.1, 0.46, 240]].flatMap(([x, z, h, a]) => [
      { t: 'cyl', r: 0.016, l: h, seg: 5, p: [x, h / 2, z], m: 'stem' },
      { t: 'cyl', r: [0.11, 0.025], l: 0.2, seg: 8, p: [x + Math.cos(a * D) * 0.06, h + 0.04, z - Math.sin(a * D) * 0.06], r3: [0, a, -55], m: 'petal' },
      { t: 'cyl', r: [0.07, 0.02], l: 0.16, seg: 8, p: [x + Math.cos(a * D) * 0.055, h + 0.045, z - Math.sin(a * D) * 0.055], r3: [0, a, -55], m: 'throat' },
      { t: 'ell', s: [0.035, 0.035, 0.035], seg: 6, p: [x + Math.cos(a * D) * 0.12, h + 0.08, z - Math.sin(a * D) * 0.12], m: 'glowL' },
    ]),
    ...[30, 150, 270].map((a) => ({ t: 'ell', s: [0.2, 0.02, 0.05], seg: 8, p: [Math.cos(a * D) * 0.15, 0.08, -Math.sin(a * D) * 0.15], r3: [0, a, 30], m: 'leaf' })),
  ]);
}

// ══ OCHRE (High Tech) — white sun over desert ══════════════════════════════════════════════════════════
{
  const R5 = rng(31);
  model('hightech', 'common', 'Sunsalt', { sand: '#e2c48a', salt: '#f6f4ee', salt2: '#e8e2d4' }, [
    disc(0.38, 'sand', 0.01, 0.02),
    ...spread(7, 0.25, R5).map(([x, z, a], i) => { const s = 0.09 + R5() * 0.08; return { t: 'box', s: [s, s * 0.9, s], p: [x, s * 0.4 + (i === 0 ? 0.08 : 0), z], r3: [R5() * 30, rad(a), R5() * 25], m: i % 3 ? 'salt' : 'salt2' }; }),
  ]);
  const R6 = rng(32);
  model('hightech', 'uncommon', 'Dune Quartz', { sand: '#e2c48a', quartz: '#f2e6f0', quartz2: '#d8c8e8' }, [
    disc(0.3, 'sand', 0.01, 0.02),
    ...[[0, 0, 0.5, 0.075, 0, 0], [0.12, 0.06, 0.36, 0.06, 25, 0], [-0.1, 0.1, 0.32, 0.055, -20, 20], [0.02, -0.14, 0.38, 0.06, 15, -25], [-0.14, -0.06, 0.26, 0.05, -28, -10]].flatMap(([x, z, h, r, ax, az], i) => {
      const r3 = [ax, 0, az], c = along([x, 0.02, z], r3, h / 2);
      return [{ t: 'cyl', r, l: h, seg: 6, p: c, r3, m: i % 2 ? 'quartz2' : 'quartz' },
        { t: 'cyl', r: [0.005, r], l: r * 1.6, seg: 6, p: along(c, r3, h / 2 + r * 0.8), r3, m: 'quartz' }];
    }),
  ]);
  model('hightech', 'rare', 'Mirage Oil', { sand: '#d8b478', crust: '#8a6a4a', glowO: '#8a5ad8', glowO2: '#40d0c8' }, [
    disc(0.4, 'sand', 0.01, 0.02),
    { t: 'cyl', r: [0.32, 0.36], l: 0.05, seg: 14, p: [0, 0.025, 0], m: 'crust' },
    { t: 'ell', s: [0.3, 0.025, 0.26], seg: 14, p: [0, 0.05, 0], m: 'glowO' },
    { t: 'ell', s: [0.17, 0.028, 0.13], seg: 12, p: [0.05, 0.055, -0.03], r3: [0, 30, 0], m: 'glowO2' },
    ...[[0.1, 0.09, 0.05], [-0.12, 0.03, 0.035], [0.02, -0.13, 0.04]].map(([x, z, r]) => ({ t: 'ell', s: [r, r, r], seg: 8, p: [x, 0.06 + r * 0.6, z], m: 'glowO2' })),
  ]);
  model('hightech', 'epic', 'Solar Pearl', { sand: '#e2c48a', fulg: '#5a4a3a', fulg2: '#7a6a58', glowS: '#fff6d0', glowS2: '#ffd070' }, [
    mound(0.34, 0.1, 'sand'),
    ...[0, 72, 144, 216, 288].map((a, i) => ({ t: 'cyl', r: [0.012, 0.03], l: 0.4, seg: 5, p: [Math.cos(a * D) * 0.1, 0.24, -Math.sin(a * D) * 0.1], r3: [0, a, -22 - (i % 2) * 10], m: i % 2 ? 'fulg2' : 'fulg' })),
    { t: 'ell', s: [0.13, 0.13, 0.13], seg: 12, p: [0, 0.52, 0], m: 'glowS' },
    { t: 'cyl', r: 0.2, l: 0.012, seg: 16, p: [0, 0.52, 0], r3: [20, 0, 10], m: 'glowS2' },
  ]);
}

// ══ KESSRA (Artillery) — shelled wasteland ═════════════════════════════════════════════════════════════
{
  const R7 = rng(41);
  model('artillery', 'common', 'Slag Iron', { dust: '#9a7a5a', slag: '#3e3a38', slag2: '#55504a', rust: '#a8542a' }, [
    disc(0.36, 'dust', 0.01, 0.02),
    ...spread(6, 0.22, R7).map(([x, z, a], i) => { const s = 0.09 + R7() * 0.07; return { t: 'ell', s: [s * 1.3, s * 0.8, s], seg: 6, p: [x, s * 0.5, z], r3: [R7() * 30, rad(a), R7() * 30], m: i % 2 ? 'slag' : 'slag2' }; }),
    ...spread(5, 0.2, R7).map(([x, z]) => ({ t: 'ell', s: [0.04, 0.03, 0.035], seg: 5, p: [x, 0.11, z], m: 'rust' })),
  ]);
  model('artillery', 'uncommon', 'Mesa Copper', { rock: '#b08058', rock2: '#9a6a48', copper: '#e07a3a', verd: '#4ab89a' }, [
    { t: 'box', s: [0.42, 0.26, 0.34], p: [0, 0.13, 0], r3: [0, 18, 4], m: 'rock' },
    { t: 'box', s: [0.24, 0.18, 0.22], p: [0.06, 0.33, -0.02], r3: [6, -12, 0], m: 'rock2' },
    { t: 'box', s: [0.18, 0.12, 0.16], p: [-0.2, 0.06, 0.18], r3: [0, 40, 0], m: 'rock2' },
    ...[[0.0, 0.2, 0.175, 0, 20], [0.12, 0.12, 0.13, 0, -35], [-0.08, 0.36, 0.1, 0, 12], [0.2, 0.18, -0.05, 90, 25]].map(([x, y, z, ry, rz]) => ({ t: 'box', s: [0.22, 0.03, 0.02], p: [x, y, z], r3: [0, 18 + ry, rz], m: 'copper' })),
    ...[[0.18, 0.04, 0.2], [-0.24, 0.03, -0.12]].map(([x, y, z]) => ({ t: 'ell', s: [0.045, 0.04, 0.04], seg: 6, p: [x, y + 0.03, z], m: 'copper' })),
    { t: 'box', s: [0.08, 0.02, 0.06], p: [-0.05, 0.43, 0.04], m: 'verd' },
  ]);
  const R8 = rng(43);
  model('artillery', 'rare', 'Ghost Brass', { dust: '#9a7a5a', brass: '#d0a040', brass2: '#b8862e', dark: '#3a3028' }, [
    disc(0.36, 'dust', 0.01, 0.02),
    ...spread(9, 0.26, R8).map(([x, z, a], i) => ({ t: 'cyl', ax: 'x', r: 0.034, l: 0.19, seg: 8, p: [x, 0.04 + (i > 5 ? 0.06 : 0), z], r3: [0, rad(a) + R8() * 40, (i > 5 ? 15 : 0)], m: i % 2 ? 'brass' : 'brass2' })),
    ...[[0.04, 0.02], [-0.06, -0.04], [0.02, -0.1]].flatMap(([x, z]) => [
      { t: 'cyl', r: 0.034, l: 0.22, seg: 8, p: [x, 0.11 + 0.04, z], m: 'brass' },
      { t: 'cyl', r: 0.022, l: 0.012, seg: 8, p: [x, 0.27, z], m: 'dark' },
    ]),
  ]);
  model('artillery', 'epic', 'Dreadnought Core', { dust: '#9a7a5a', hull: '#5a5450', ring: '#2e2a28', glowR: '#ff4a2a', glowR2: '#ffb050' }, [
    mound(0.42, 0.1, 'dust'),
    { t: 'cyl', ax: 'z', r: 0.22, l: 0.5, seg: 10, p: [0, 0.12, 0], r3: [0, 25, 8], m: 'hull' },
    ...[-0.17, 0, 0.17].map((z) => ({ t: 'cyl', ax: 'z', r: 0.235, l: 0.035, seg: 10, p: [Math.sin(25 * D) * z, 0.12, Math.cos(25 * D) * z], r3: [0, 25, 8], m: 'ring' })),
    { t: 'box', s: [0.22, 0.12, 0.02], p: [0.02, 0.3, -0.02], r3: [0, 25, 8], m: 'glowR' },
    { t: 'cyl', r: 0.07, l: 0.06, seg: 8, p: [-0.04, 0.32, 0.1], m: 'ring' },
    { t: 'ell', s: [0.05, 0.05, 0.05], seg: 8, p: [-0.04, 0.37, 0.1], m: 'glowR2' },
    ...[[0.28, -0.1], [-0.26, 0.16]].map(([x, z]) => ({ t: 'box', s: [0.1, 0.05, 0.08], p: [x, 0.08, z], r3: [10, 30, 15], m: 'hull' })),
  ]);
}

// ══ RIME (Water) — frozen seas ═════════════════════════════════════════════════════════════════════════
{
  const R9 = rng(51);
  model('water', 'common', 'Brine Ice', { snow: '#e8f0f6', ice: '#a8d8f0', ice2: '#7ec0e6', salt: '#ffffff' }, [
    disc(0.36, 'snow', 0.01, 0.02),
    ...spread(5, 0.2, R9).map(([x, z, a], i) => { const w = 0.12 + R9() * 0.06, h = 0.1 + R9() * 0.14; return { t: 'box', s: [w, h, w * 0.85], p: [x, h / 2, z], r3: [R9() * 12, rad(a), R9() * 12], m: i % 2 ? 'ice' : 'ice2' }; }),
    ...spread(4, 0.24, R9).map(([x, z]) => ({ t: 'box', s: [0.05, 0.015, 0.05], p: [x, 0.03, z], m: 'salt' })),
  ]);
  model('water', 'uncommon', 'Frost Pearl', { snow: '#e8f0f6', shell: '#b8c8d8', shell2: '#d8e2ec', pearl: '#f8f4f0' }, [
    disc(0.32, 'snow', 0.01, 0.02),
    { t: 'ell', s: [0.24, 0.09, 0.2], seg: 12, half: true, p: [0, 0.11, 0], r3: [180, 0, 0], m: 'shell' },   // lower valve: a bowl
    { t: 'cyl', r: [0.23, 0.24], l: 0.03, seg: 12, p: [0, 0.115, 0], m: 'shell2' },
    // upper valve: a dome hinged at the back edge (z −0.2), tipped back 70° so its pearly inside faces forward
    { t: 'ell', s: [0.24, 0.07, 0.2], seg: 12, half: true, p: [0, 0.13 + 0.2 * Math.sin(70 * D), -0.2 + 0.2 * Math.cos(70 * D)], r3: [-70, 0, 0], m: 'shell2' },
    ...[-0.1, 0, 0.1].map((x) => ({ t: 'box', s: [0.018, 0.012, 0.2], p: [x, 0.13 + 0.1 * Math.sin(70 * D) + 0.02, -0.2 + 0.1 * Math.cos(70 * D) - 0.02], r3: [-70, 0, 0], m: 'shell', d: 1 })),
    { t: 'ell', s: [0.08, 0.08, 0.08], seg: 12, p: [0, 0.19, 0.03], m: 'pearl' },
  ]);
  model('water', 'rare', 'Glacier Breath', { snow: '#e8f0f6', ice: '#bfe4f6', ice2: '#8ecae8', glowI: '#c8f0ff' }, [
    mound(0.32, 0.08, 'snow'),
    ...[[0, 0, 0.62, 0.08, 0, 0], [0.12, 0.05, 0.45, 0.065, 18, -15], [-0.1, 0.08, 0.4, 0.06, 22, 20], [0.04, -0.13, 0.5, 0.065, -20, -8], [-0.12, -0.08, 0.32, 0.05, -15, 25]]
      .map(([x, z, h, r, ax, az], i) => ({ t: 'cyl', r: [0.006, r], l: h, seg: 6, p: [x, h / 2 + 0.03, z], r3: [ax, i * 25, az], m: i % 2 ? 'ice2' : 'ice' })),
    { t: 'ell', s: [0.1, 0.12, 0.1], seg: 10, p: [0, 0.16, 0], m: 'glowI' },
  ]);
  model('water', 'epic', 'Leviathan Scale', { snow: '#e8f0f6', ice: '#a8d8f0', scale: '#2a8a98', scale2: '#3ab0b8', glowS: '#5ff0e0' }, [
    mound(0.36, 0.08, 'snow'),
    { t: 'box', s: [0.3, 0.06, 0.24], p: [0.05, 0.05, 0], r3: [0, 20, 0], m: 'ice' },
    ...[[0, 0, 0.32, 0, -8], [0.13, 0.08, 0.24, 40, 14], [-0.12, -0.07, 0.22, -35, -16]].flatMap(([x, z, h, ay, az], i) => [
      { t: 'ell', s: [0.15, h, 0.035], seg: 10, p: [x, h * 0.75, z], r3: [0, ay, az], m: i ? 'scale2' : 'scale' },
      { t: 'ell', s: [0.12, h * 0.8, 0.04], seg: 10, p: [x, h * 0.78, z], r3: [0, ay, az], m: 'glowS' },
    ]),
  ]);
}

// ══ CINDER (Arcane / Energy) — living fire ══════════════════════════════════════════════════════════════
{
  model('arcane', 'common', 'Ash Basalt', { ash: '#4a4040', basalt: '#3a3434', top: '#5a5050', glowE: '#ff7a2a' }, [
    disc(0.38, 'ash', 0.01, 0.02),
    ...[[0, 0, 0.42], [0.13, 0, 0.3], [-0.13, 0, 0.34], [0.065, 0.113, 0.24], [-0.065, 0.113, 0.36], [0.065, -0.113, 0.2], [-0.065, -0.113, 0.28]].flatMap(([x, z, h]) => [
      { t: 'cyl', r: 0.07, l: h, seg: 6, p: [x, h / 2, z], m: 'basalt' },
      { t: 'cyl', r: 0.064, l: 0.012, seg: 6, p: [x, h + 0.006, z], m: 'top' },
    ]),
    { t: 'box', s: [0.02, 0.18, 0.012], p: [0.0, 0.2, 0.07], m: 'glowE' },
  ]);
  model('arcane', 'uncommon', 'Ember Obsidian', { ash: '#4a4040', obs: '#1c1a20', obs2: '#2a2630', glowE: '#ff8a2a' }, [
    disc(0.32, 'ash', 0.01, 0.02),
    ...[[0, 0, 0.5, 0.09, 0, 0], [0.12, 0.08, 0.36, 0.07, 22, -20], [-0.12, 0.06, 0.32, 0.07, 18, 22], [0.02, -0.14, 0.4, 0.07, -24, -6]].flatMap(([x, z, h, r, ax, az], i) => [
      { t: 'cyl', r: [0.006, r], l: h, seg: 4, p: [x, h / 2, z], r3: [ax, 45 + i * 20, az], m: i % 2 ? 'obs2' : 'obs' },
      { t: 'box', s: [0.012, h * 0.55, 0.012], p: [x + Math.sin(-az * D) * 0.01, h * 0.38, z], r3: [ax, 45 + i * 20, az], m: 'glowE' },
    ]),
  ]);
  model('arcane', 'rare', 'Phoenix Glass', { ash: '#4a4040', glass: '#e8502a', glass2: '#ff9a3a', glowF: '#ffd060' }, [
    disc(0.3, 'ash', 0.01, 0.02),
    ...Array.from({ length: 6 }, (_, i) => ({ t: 'cyl', r: [0.1 - i * 0.014, 0.115 - i * 0.014], l: 0.12, seg: 5, p: [Math.sin(i * 0.9) * 0.03, 0.06 + i * 0.105, Math.cos(i * 0.9) * 0.03], r3: [0, i * 28, Math.sin(i) * 8], m: i % 2 ? 'glass2' : 'glass' })),
    { t: 'ell', s: [0.05, 0.08, 0.05], seg: 8, p: [0, 0.72, 0], m: 'glowF' },
    { t: 'ell', s: [0.06, 0.2, 0.06], seg: 8, p: [0, 0.32, 0], m: 'glowF' },
  ]);
  model('arcane', 'epic', 'Heartflame', { ash: '#3a3232', rock: '#262222', glowF: '#ff6a1a', glowW: '#fff0a0', glowF2: '#ffa82a' }, [
    disc(0.36, 'ash', 0.01, 0.02),
    ...[0, 120, 240].map((a) => ({ t: 'box', s: [0.12, 0.34, 0.1], p: [Math.cos(a * D) * 0.17, 0.16, -Math.sin(a * D) * 0.17], r3: [0, a, 22], m: 'rock' })),
    { t: 'ell', s: [0.1, 0.16, 0.1], seg: 10, p: [0, 0.5, 0], m: 'glowF2' },
    { t: 'ell', s: [0.055, 0.09, 0.055], seg: 8, p: [0, 0.48, 0], m: 'glowW' },
    ...[0, 72, 144, 216, 288].map((a, i) => ({ t: 'cyl', r: [0.005, 0.035], l: 0.18 + (i % 2) * 0.06, seg: 5, p: [Math.cos(a * D) * 0.05, 0.62 + (i % 2) * 0.03, -Math.sin(a * D) * 0.05], r3: [0, a, -15], m: 'glowF' })),
  ]);
}

// ══ LUMEN (Space Tech) — airless moon ═══════════════════════════════════════════════════════════════════
{
  const RA = rng(71);
  model('space', 'common', 'Regolith', { dust: '#8a8e96', rock: '#9a9ea6', rock2: '#6e727a' }, [
    disc(0.36, 'dust', 0.01, 0.02),
    ...spread(10, 0.26, RA).map(([x, z, a], i) => { const s = 0.05 + RA() * 0.06; return { t: 'ell', s: [s * 1.2, s * 0.7, s], seg: 6, p: [x, s * 0.4 + (i < 3 ? 0.04 : 0), z], r3: [0, rad(a), RA() * 20], m: i % 3 ? 'rock' : 'rock2' }; }),
  ]);
  model('space', 'uncommon', 'Helium-3', { dust: '#8a8e96', frost: '#d8f4ff', frost2: '#b0e4f8', glowH: '#8af0ff' }, [
    disc(0.32, 'dust', 0.01, 0.02),
    ...[[0, 0, 0.36, 0.08], [0.13, 0.06, 0.24, 0.06], [-0.11, 0.1, 0.22, 0.06], [0.02, -0.13, 0.28, 0.06], [-0.13, -0.08, 0.18, 0.05]].flatMap(([x, z, h, r], i) => [
      { t: 'cyl', r: [0.005, r], l: h * 0.55, seg: 4, p: [x, h * 0.72, z], r3: [0, 45, 0], m: i % 2 ? 'frost2' : 'frost' },
      { t: 'cyl', r: [r, 0.005], l: h * 0.45, seg: 4, p: [x, h * 0.22, z], r3: [0, 45, 0], m: i % 2 ? 'frost2' : 'frost' },
    ]),
    { t: 'ell', s: [0.06, 0.06, 0.06], seg: 8, p: [0, 0.2, 0], m: 'glowH' },
  ]);
  model('space', 'rare', 'Starfall Iron', { dust: '#8a8e96', rim: '#6e727a', iron: '#4a4c52', iron2: '#7a7880', glowM: '#ff8a4a' }, [
    { t: 'cyl', r: [0.32, 0.4], l: 0.07, seg: 12, p: [0, 0.035, 0], m: 'rim' },
    { t: 'cyl', r: 0.3, l: 0.02, seg: 12, p: [0, 0.06, 0], m: 'dust' },
    { t: 'ell', s: [0.19, 0.15, 0.16], seg: 7, p: [0, 0.14, 0], r3: [15, 30, 10], m: 'iron' },
    { t: 'ell', s: [0.1, 0.08, 0.09], seg: 6, p: [0.1, 0.24, -0.04], r3: [0, 60, 25], m: 'iron2' },
    ...[[0.0, 0.19, 0.15, 30], [-0.12, 0.12, 0.08, -40]].map(([x, y, z, a]) => ({ t: 'box', s: [0.12, 0.012, 0.012], p: [x, y, z], r3: [0, a, 15], m: 'glowM' })),
  ]);
  model('space', 'epic', 'Void Lens', { dust: '#8a8e96', stone: '#5a5e68', lens: '#1c2240', glowV: '#b48aff', glowV2: '#e8dcff' }, [
    disc(0.3, 'dust', 0.01, 0.02),
    { t: 'cyl', r: [0.1, 0.16], l: 0.18, seg: 6, p: [0, 0.09, 0], m: 'stone' },
    { t: 'cyl', r: 0.21, l: 0.03, seg: 16, p: [0, 0.48, 0], r3: [70, 30, 0], m: 'lens' },
    { t: 'cyl', r: 0.23, l: 0.02, seg: 16, p: [0, 0.48, 0], r3: [70, 30, 0], m: 'glowV' },
    { t: 'cyl', r: 0.12, l: 0.035, seg: 12, p: [0, 0.48, 0], r3: [70, 30, 0], m: 'glowV2' },
    { t: 'ell', s: [0.03, 0.03, 0.03], seg: 6, p: [0, 0.22, 0], m: 'glowV' },
  ]);
}

// ══ XENTHE (Dark Energy) — fungal twilight ══════════════════════════════════════════════════════════════
{
  model('dark', 'common', 'Glowcap Spores', { moss: '#3a2a4e', stem: '#d8d0e8', glowM: '#2ef0c0', glowM2: '#4ad8ff' }, [
    disc(0.34, 'moss', 0.01, 0.02),
    ...[[0, 0, 0.36, 0.13], [0.15, 0.07, 0.24, 0.09], [-0.13, 0.1, 0.2, 0.08], [0.04, -0.15, 0.28, 0.1], [-0.15, -0.1, 0.14, 0.06]].flatMap(([x, z, h, r], i) => [
      { t: 'cyl', r: [0.022, 0.03], l: h, seg: 6, p: [x, h / 2, z], m: 'stem' },
      { t: 'ell', s: [r, r * 0.55, r], seg: 10, half: true, p: [x, h - 0.01, z], m: i % 2 ? 'glowM2' : 'glowM' },
    ]),
  ]);
  const RB = rng(83);
  model('dark', 'uncommon', 'Duskmoss Resin', { moss: '#3a2a4e', moss2: '#4e3a66', resin: '#7a2e9a', glowR: '#c84aff' }, [
    mound(0.34, 0.12, 'moss'),
    ...spread(5, 0.22, RB).map(([x, z]) => ({ t: 'ell', s: [0.08, 0.05, 0.08], seg: 6, p: [x, 0.08, z], m: 'moss2' })),
    ...spread(6, 0.2, RB, 0.03).map(([x, z], i) => ({ t: 'ell', s: [0.04, 0.06, 0.04], seg: 6, p: [x, 0.14 + (i % 2) * 0.03, z], m: i === 0 ? 'glowR' : 'resin' })),
  ]);
  model('dark', 'rare', 'Dreamspore', { moss: '#3a2a4e', stalk: '#5a4a6e', pod: '#7a5aa8', glowD: '#ff7ae8' }, [
    disc(0.3, 'moss', 0.01, 0.02),
    { t: 'cyl', r: [0.03, 0.05], l: 0.22, seg: 6, p: [0, 0.11, 0], m: 'stalk' },
    { t: 'ell', s: [0.13, 0.28, 0.13], seg: 10, p: [0, 0.48, 0], m: 'pod' },
    ...Array.from({ length: 8 }, (_, i) => { const a = i * 45 * D, y = 0.34 + (i % 3) * 0.1; const r = 0.13 * Math.sqrt(1 - Math.pow((y - 0.48) / 0.28, 2)); return { t: 'ell', s: [0.03, 0.03, 0.03], seg: 6, p: [Math.cos(a) * r, y, Math.sin(a) * r], m: 'glowD' }; }),
    { t: 'ell', s: [0.04, 0.05, 0.04], seg: 6, p: [0, 0.78, 0], m: 'glowD' },
  ]);
  model('dark', 'epic', 'Mycelial Heart', { moss: '#3a2a4e', myc: '#d8c8e0', myc2: '#a890c0', glowH: '#ff3ad8', glowH2: '#ffb0f0' }, [
    mound(0.34, 0.08, 'moss'),
    ...Array.from({ length: 7 }, (_, i) => { const a = i * 51; return { t: 'cyl', r: 0.025, l: 0.5, seg: 6, p: [Math.cos(a * D) * 0.08, 0.3, -Math.sin(a * D) * 0.08], r3: [0, a, 38 * (i % 2 ? 1 : -1)], m: i % 2 ? 'myc2' : 'myc' }; }),
    { t: 'ell', s: [0.13, 0.13, 0.13], seg: 10, p: [0, 0.3, 0], m: 'glowH' },
    { t: 'ell', s: [0.07, 0.07, 0.07], seg: 8, p: [0.04, 0.35, 0.03], m: 'glowH2' },
  ]);
}

// ══ VEXMIRE (Greenies / Chem) — toxic hive swamp ════════════════════════════════════════════════════════
{
  model('greenies', 'common', 'Mire Peat', { mud: '#3e3a26', peat: '#4a3a24', peat2: '#5a4a2e', wet: '#6a7a3a' }, [
    disc(0.36, 'mud', 0.01, 0.02),
    ...[[0, 0.05, 0, 0], [0.0, 0.05, 0.13, 0], [0.0, 0.05, -0.13, 0], [0.02, 0.14, 0.065, 90], [0.02, 0.14, -0.065, 90], [0.03, 0.23, 0, 0]].map(([x, y, z, a], i) => ({ t: 'box', s: [0.3, 0.09, 0.12], p: [x, y, z], r3: [0, a + (i % 2) * 6, 0], m: i % 2 ? 'peat2' : 'peat' })),
    { t: 'box', s: [0.24, 0.012, 0.2], p: [-0.2, 0.025, 0.15], r3: [0, 30, 0], m: 'wet' },
  ]);
  model('greenies', 'uncommon', 'Venom Sap', { mud: '#3e3a26', root: '#5a4a30', root2: '#6a5a3a', glowV: '#b8ff3a', glowV2: '#e0ff70' }, [
    disc(0.32, 'mud', 0.01, 0.02),
    ...[0, 90, 180, 270].map((a, i) => ({ t: 'box', s: [0.42, 0.06, 0.07], p: [Math.cos(a * D) * 0.09, 0.08 + i * 0.015, -Math.sin(a * D) * 0.09], r3: [0, a + 20, 14], m: i % 2 ? 'root2' : 'root' })),
    { t: 'cyl', r: [0.05, 0.08], l: 0.28, seg: 6, p: [0, 0.14, 0], m: 'root' },
    ...[[0.06, 0.3, 0.02, 0.06], [-0.07, 0.22, 0.05, 0.05], [0.09, 0.13, -0.1, 0.045], [-0.04, 0.1, -0.12, 0.05]].map(([x, y, z, r], i) => ({ t: 'ell', s: [r, r * 1.3, r], seg: 8, p: [x, y, z], m: i ? 'glowV' : 'glowV2' })),
  ]);
  model('greenies', 'rare', 'Hive Jelly', { mud: '#3e3a26', pod: '#6f8a3a', pod2: '#556b2c', glowJ: '#ffe84a' }, [
    disc(0.34, 'mud', 0.01, 0.02),
    ...[[0, 0, 0.32, 0.11], [0.15, 0.08, 0.22, 0.09], [-0.13, 0.1, 0.2, 0.085], [0.03, -0.16, 0.25, 0.09]].flatMap(([x, z, h, r], i) => [
      { t: 'cyl', r: [r * 0.85, r], l: h, seg: 6, p: [x, h / 2, z], m: i % 2 ? 'pod2' : 'pod' },
      { t: 'ell', s: [r * 0.8, r * 0.45, r * 0.8], seg: 8, half: true, p: [x, h, z], m: 'glowJ' },
    ]),
  ]);
  model('greenies', 'epic', 'Broodqueen Egg', { mud: '#3e3a26', twig: '#5a4a2e', twig2: '#7a6a3e', egg: '#c8d070', vein: '#6a8a2a', glowE: '#b8ff3a' }, [
    disc(0.36, 'mud', 0.01, 0.02),
    ...Array.from({ length: 12 }, (_, i) => { const a = i * 30; return { t: 'box', s: [0.32, 0.035, 0.035], p: [Math.cos(a * D) * 0.2, 0.06 + (i % 3) * 0.025, -Math.sin(a * D) * 0.2], r3: [0, a + 90 + (i % 2) * 20, (i % 2 ? 10 : -10)], m: i % 2 ? 'twig2' : 'twig' }; }),
    { t: 'ell', s: [0.16, 0.24, 0.16], seg: 12, p: [0, 0.3, 0], m: 'egg' },
    ...[0, 90, 180, 270].map((a) => ({ t: 'box', s: [0.012, 0.3, 0.012], p: [Math.cos(a * D) * 0.155, 0.3, -Math.sin(a * D) * 0.155], r3: [0, a, 0], m: 'vein' })),
    ...[[0.1, 0.38, 0.1], [-0.12, 0.28, 0.06], [0.04, 0.22, -0.15]].map(([x, y, z]) => ({ t: 'ell', s: [0.025, 0.025, 0.025], seg: 6, p: [x, y, z], m: 'glowE' })),
  ]);
}

/** Every resource model by `${planet}.${tier}`. */
export const RESOURCE_MODELS = M;
/** The model for a planet (faction key) and tier, or null. */
export function resourceModel(planet, tier) { return M[`${planet}.${tier}`] || null; }
/** Planets that have the full four. */
export const RESOURCE_PLANETS = Object.freeze(Object.keys(PLANETS));

/**
 * A sim resource node → its tier. role primary → common, premium → uncommon; quest crops split by their colour,
 * red → rare, green → epic (harvest.js assigns those colours). Anything else reads as common.
 */
export function tierOf(node) {
  if (!node) return 'common';
  if (node.role === 'premium' || node.color === 'yellow') return 'uncommon';
  if (node.role === 'quest' || node.color === 'red' || node.color === 'green') return node.color === 'green' ? 'epic' : 'rare';
  return 'common';
}

const hashStr = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };

/**
 * Plan the instances for the live resource nodes. Returns { byTier: { common: [...], ... }, rings: [...], sig }.
 * Each instance { x, z, ry, s, dim }: cell-centre position, a per-node yaw, a size that shrinks as the field
 * drains (quantized to quarters, so the shadow map re-renders rarely), and dim = 1 (fresh) or 0.45 (a regrowing
 * primary at zero, shown as a faint stub). Rings carry the role colour (blue / yellow / red / green) so the
 * economy read survives the new shapes. A node whose ring hasn't arrived, or that is consumed, is skipped.
 */
export function planResources(nodes, wave) {
  const byTier = { common: [], uncommon: [], rare: [], epic: [] }, rings = [], sig = [];
  for (const n of nodes || []) {
    if (n.wave != null && n.wave > wave) continue;
    const units = n.units || 0;
    const frac = units ? Math.max(0, (n.remaining != null ? n.remaining : units) / units) : 1;
    if (frac <= 0 && !n.respawns) continue;
    const q = frac <= 0 ? 0 : Math.ceil(frac * 4) / 4;
    const tier = tierOf(n), h = hashStr(String(n.id));
    sig.push(`${n.id}:${q}:${tier}`);
    const s = (q === 0 ? 0.4 : 0.6 + 0.4 * q) * (0.92 + (h % 17) / 100);
    byTier[tier].push({ x: n.x + 0.5, z: n.y + 0.5, ry: ((h >>> 5) % 360) * D, s, dim: q === 0 ? 0.45 : 1 });
    rings.push({ x: n.x + 0.5, z: n.y + 0.5, color: n.color || ({ common: 'blue', uncommon: 'yellow', rare: 'red', epic: 'green' })[tier], dim: q === 0 ? 0.5 : 1 });
  }
  return { byTier, rings, sig: sig.join('|') };
}
