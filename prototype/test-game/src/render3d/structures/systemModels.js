/**
 * src/render3d/structures/systemModels.js — the SYSTEM faction's base defenses as part-list models (the player's own
 * towers and walls). [MM-story_mvbr0qfb_o]
 *
 * Built from the owner's System sheet (2026-10-15, one 3/4 view per unit) in the unit-model prototype
 * (tools/unit-models/next on branch feat/unit-art-refs, R10 [MM-story_mva2fuua_k]); the part data below is that
 * prototype's, verbatim. Same schema as units/models.js (box / cyl / ext / loft / ell, one material key per part,
 * `mir` mirrors Z, `d: 1` detail). Groups: no `g` = the base (prims names it 'body'), 'weapon' yaws to aim, 'head'
 * rides on the weapon and sweeps / spins. A tower stands on one cell = 4 model units (footprint ≈ 3–3.4).
 *
 *   sys_cannon → SYS-Cannon (antiGround)   sys_flak → SYS-Flak (antiAir)   sys_wall → SYS-Wall
 *   sys_harvester → SYS-Harvester          sys_rockets → STR-Rockets   sys_missile → STR-Missile   sys_mg → no roster id yet
 */
import { track } from '../units/prims.js';

/** Gunmetal + red-orange — the sheet's palette (the prototype viewer's values). */
export const SYSTEM_COLORS = Object.freeze({
  gun: 0x50555c, gun2: 0x646a72, gunD: 0x34383d, accent: 0xd0462c, hazard: 0xe2a224, chrome: 0xc4c8ce, bone: 0xe8e3d8,
  brass: 0xb8862e, dark: 0x4a4f56, black: 0x22252a, metal: 0x7b828a, glass: 0x1c2533, hull: 0xc4c8cd, hull2: 0xa6acb3,
  panel: 0xadb3ba, track: 0x2e3135, glow: 0x46f2ff, glowB: 0x4aa8ff, glowR: 0xff5a3a, amber: 0xffb340,
});

const M = {};
  // ══ SYSTEM FACTION — the player's own base defenses (owner sheet 2026-10-15, one 3/4 view each).
  // Palette keys: gun / gun2 / gunD (gunmetal), accent (red-orange), hazard, chrome, bone, brass, glowR (crystal).
  // Hidden sides are inferred by symmetry. A tower stands on one cell (4 model units); footprint ≈ 3–3.4.
  const D = Math.PI / 180;
  // scale a group of parts about a point (sizes, lengths, radii and offsets)
  const scaleAbout = (o, k, ps) => ps.map((q) => Object.assign({}, q, { p: q.p.map((v, i) => o[i] + (v - o[i]) * k), s: q.s && q.s.map((v) => v * k), l: q.l && q.l * k, r: q.r == null ? q.r : Array.isArray(q.r) ? q.r.map((v) => v * k) : q.r * k }));
  const along = (P, a, d) => [P[0] + Math.cos(a * D) * d, P[1] + Math.sin(a * D) * d, P[2]];   // a point d along an elevated axis

  // ── SYS-Cannon (v2, contemporary): armoured octagonal plinth (base) · slewing turret with trunnion yokes, cradle and
  //    long barrel with thermal sleeve and slotted muzzle brake (weapon, yaws as one piece; barrel held at a fixed EL)
  //    · targeting optic (head, sweeps). Uses only the engine's three layers: base / turret / head.
  {
    const oct = (s, c) => [[s, -s + c], [s, s - c], [s - c, s], [-s + c, s], [-s, s - c], [-s, -s + c], [-s + c, -s], [s - c, -s]];
    const T = [0, 1.1, 0];                 // weapon (yaw) pivot = top of the bearing
    const P = [0.1, 1.95, 0];              // trunnion axis (barrel elevation is applied about this)
    const bx = (d) => [P[0] + d, P[1], 0];
    const ringBolts = (y, r, n) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return { t: 'cyl', ax: 'y', r: 0.035, l: 0.04, seg: 6, p: [Math.cos(a) * r, y, Math.sin(a) * r], m: 'chrome', d: 1 }; });
    const TURB = [[-1.0, -0.6], [0.45, -0.72], [0.78, -0.45], [0.78, 0.45], [0.45, 0.72], [-1.0, 0.6], [-1.18, 0.38], [-1.18, -0.38]];
    const parts = [
      // ── BASE: footing, chamfered plinth, hazard band, vents, hatch, bearing ring
      { t: 'loft', ax: 'y', secs: [[0, oct(1.62, 0.45)], [0.12, oct(1.62, 0.45)]], m: 'gunD' },
      { t: 'loft', ax: 'y', secs: [[0.12, oct(1.52, 0.42)], [0.42, oct(1.52, 0.42)], [0.9, oct(1.12, 0.32)], [1.0, oct(1.05, 0.3)]], m: 'gun' },
      { t: 'loft', ax: 'y', secs: [[0.4, oct(1.535, 0.425)], [0.5, oct(1.47, 0.41)]], m: 'hazard' },
      ...[0, 1, 2, 3].flatMap((k) => {
        const a = k * 90, c = Math.cos(a * D), s = Math.sin(a * D), rot = -a;
        return [
          ...[0, 1, 2].map((i) => ({ t: 'box', s: [0.03, 0.05, 0.6], p: [c * 1.53, 0.2 + i * 0.07, s * 1.53], r3: [0, rot, 0], m: 'dark', d: 1 })),
          { t: 'box', s: [0.4, 0.02, 0.5], p: [c * 1.33, 0.67, s * 1.33], r3: [0, rot, 40], m: 'gunD', d: 1 },
        ];
      }),
      { t: 'box', s: [0.04, 0.22, 0.34], p: [1.54, 0.26, 0.75], m: 'gunD' },
      { t: 'box', s: [0.05, 0.03, 0.08], p: [1.56, 0.33, 0.75], m: 'glow' },
      { t: 'cyl', ax: 'y', r: 0.98, l: 0.1, seg: 16, p: [0, 1.05, 0], m: 'gunD' },
      ...ringBolts(1.1, 0.9, 16),
      // ── WEAPON (yaws): turntable, faceted housing with rear bustle, trunnion yokes, panels, vents
      { t: 'cyl', ax: 'y', r: 0.92, l: 0.16, seg: 16, p: [0, 1.18, 0], m: 'gun2', g: 'weapon' },
      { t: 'loft', ax: 'y', secs: [[1.26, TURB], [1.62, TURB.map(([x, z]) => [x * 0.92, z * 0.9])], [1.72, TURB.map(([x, z]) => [x * 0.84, z * 0.8])]], m: 'gun', g: 'weapon' },
      { t: 'ext', ax: 'z', poly: [[-0.55, 1.6], [0.6, 1.6], [0.66, 2.02], [0.4, 2.32], [-0.18, 2.32], [-0.55, 1.98]], d: [0.42, 0.64], m: 'gun', g: 'weapon', mir: true },
      { t: 'ext', ax: 'z', poly: [[-0.35, 1.72], [0.4, 1.72], [0.44, 2.0], [0.28, 2.18], [-0.1, 2.18], [-0.35, 1.95]], d: [0.64, 0.67], m: 'gunD', g: 'weapon', mir: true },
      { t: 'cyl', ax: 'z', r: 0.2, l: 0.1, seg: 12, p: [P[0], P[1], 0.71], m: 'accent', g: 'weapon', mir: true },
      { t: 'cyl', ax: 'z', r: 0.1, l: 0.12, seg: 8, p: [P[0], P[1], 0.73], m: 'chrome', g: 'weapon', mir: true },
      { t: 'cyl', ax: 'y', r: 0.93, l: 0.04, seg: 16, p: [0, 1.25, 0], m: 'accent', g: 'weapon' },
      ...[0, 1, 2, 3].map((i) => ({ t: 'box', s: [0.03, 0.05, 0.62], p: [-1.19, 1.34 + i * 0.07, 0], m: 'dark', g: 'weapon', d: 1 })),
      { t: 'box', s: [0.5, 0.04, 0.5], p: [-0.65, 1.72, 0], m: 'gunD', g: 'weapon' },
      { t: 'box', s: [0.3, 0.12, 0.2], p: [-0.82, 1.79, 0.22], m: 'gun2', g: 'weapon' },
      { t: 'box', s: [0.06, 0.04, 0.12], p: [-0.66, 1.84, 0.22], m: 'glowR', g: 'weapon' },
      // ── BARREL (part of the turret, set at EL about the trunnion axis): cradle, breech, recoil cylinders, barrel, sleeves, evacuator, brake
      { t: 'box', s: [0.95, 0.5, 0.78], p: bx(0.05), m: 'gunD', g: 'weapon', el: 1 },
      { t: 'box', s: [0.55, 0.44, 0.56], p: bx(-0.62), m: 'gun', g: 'weapon', el: 1 },
      { t: 'box', s: [0.08, 0.3, 0.4], p: bx(-0.92), m: 'gunD', g: 'weapon', el: 1 },
      { t: 'cyl', ax: 'x', r: 0.3, l: 0.25, seg: 12, p: bx(0.62), m: 'gun', g: 'weapon', el: 1 },
      ...[1, -1].map((s) => ({ t: 'cyl', ax: 'x', r: 0.065, l: 0.95, seg: 8, p: [P[0] + 0.85, P[1] + 0.29, 0.2 * s], m: 'chrome', g: 'weapon', el: 1 })),
      ...[1, -1].map((s) => ({ t: 'cyl', ax: 'x', r: 0.085, l: 0.45, seg: 8, p: [P[0] + 0.45, P[1] + 0.29, 0.2 * s], m: 'gunD', g: 'weapon', el: 1 })),
      { t: 'cyl', ax: 'x', r: [0.17, 0.19], l: 2.6, seg: 12, p: bx(2.0), m: 'gunD', g: 'weapon', el: 1 },
      ...[0.95, 1.5].map((d) => ({ t: 'cyl', ax: 'x', r: 0.215, l: 0.48, seg: 12, p: bx(d), m: 'gun2', g: 'weapon', el: 1 })),
      ...[0.68, 1.22, 1.78].map((d) => ({ t: 'cyl', ax: 'x', r: 0.225, l: 0.06, seg: 12, p: bx(d), m: 'accent', g: 'weapon', el: 1 })),
      { t: 'cyl', ax: 'x', r: 0.27, l: 0.4, seg: 12, p: bx(2.3), m: 'gun', g: 'weapon', el: 1 },
      { t: 'cyl', ax: 'x', r: 0.2, l: 0.12, seg: 12, p: bx(3.25), m: 'gunD', g: 'weapon', el: 1 },
      { t: 'box', s: [0.38, 0.3, 0.46], p: bx(3.5), m: 'gunD', g: 'weapon', el: 1 },
      ...[0, 1].map((i) => ({ t: 'box', s: [0.07, 0.2, 0.48], p: bx(3.42 + i * 0.14), m: 'black', g: 'weapon', el: 1 })),
      { t: 'cyl', ax: 'x', r: 0.12, l: 0.02, seg: 10, p: bx(3.7), m: 'black', g: 'weapon', el: 1 },
      // ── HEAD: targeting optic on a mast at the rear-left of the housing (sweeps)
      { t: 'cyl', ax: 'y', r: 0.05, l: 0.3, seg: 6, p: [-0.85, 1.87, -0.3], m: 'dark', g: 'head' },
      { t: 'box', s: [0.34, 0.22, 0.22], p: [-0.82, 2.12, -0.3], m: 'gun2', g: 'head' },
      { t: 'box', s: [0.04, 0.16, 0.18], p: [-0.64, 2.12, -0.3], m: 'black', g: 'head' },
      { t: 'cyl', ax: 'x', r: 0.05, l: 0.03, seg: 8, p: [-0.615, 2.14, -0.34], m: 'glowR', g: 'head' },
      { t: 'cyl', ax: 'x', r: 0.03, l: 0.03, seg: 8, p: [-0.615, 2.08, -0.26], m: 'glow', g: 'head' },
    ];
    const EL = 8;                          // barrel elevation the parts are AUTHORED at, degrees; the `barrel` group pitches from here
    for (const q of parts) if (q.el) {
      const dx = q.p[0] - P[0], dy = q.p[1] - P[1], c = Math.cos(EL * D), sn = Math.sin(EL * D);
      q.p = [P[0] + dx * c - dy * sn, P[1] + dx * sn + dy * c, q.p[2]]; q.r3 = [0, 0, EL]; delete q.el; q.g = 'barrel';
    }
    M.sys_cannon = { name: 'Cannon tower', unit: 'SYS-Cannon', ref: 'sys_cannon', parts,
      pivots: { weapon: T, head: [-0.85, 1.72, -0.3], barrel: P },
      // the barrel pitches about the trunnion to the shell's launch slope (render3d/fx/elevation.js) [MM-story_mvedxxo7_7]
      barrel: { authored: EL, rest: EL, min: -5, max: 45, rate: 1.6, aim: 'shell' },
      recoil: 0.65,   // model units the barrel slides back on each shell (≈18% of it) — cannons only [MM-story_mvee15ja_b]
      // firing point: the muzzle-brake face at the end of the barrel (authored at EL); `brake` = the brake's side ports
      muzzles: [{ p: along(P, EL, 3.72), d: [Math.cos(EL * D), Math.sin(EL * D), 0], back: 1.4, brake: 0.22 }],
      head: { mode: 'sweep' },
      views: { side: 'right', top: 'up' } };
  }

  // ── SYS-Flak: splayed four-leg stand, twin-barrel gun housing, radar head (comb array + target screen)
  {
    const parts = [
      ...[-0.62, 0.62].flatMap((x) => [
        { t: 'box', s: [0.3, 0.95, 0.3], p: [x, 0.5, 0.6], r3: [-12, 0, x > 0 ? 12 : -12], m: 'gun', mir: true },
        { t: 'box', s: [0.42, 0.08, 0.42], p: [x * 1.2, 0.04, 0.74], m: 'gunD', mir: true },
      ]),
      { t: 'box', s: [1.3, 0.45, 1.0], p: [0, 0.98, 0], m: 'gun' },
      { t: 'box', s: [1.32, 0.06, 0.04], p: [0, 0.98, 0.51], m: 'accent', mir: true },
      { t: 'cyl', ax: 'y', r: 0.46, l: 0.12, seg: 12, p: [0, 1.26, 0], m: 'dark' },
      // WEAPON
      { t: 'box', s: [1.5, 0.6, 0.86], p: [0.05, 1.62, 0], m: 'gun', g: 'weapon' },
      { t: 'box', s: [0.55, 0.48, 0.74], p: [-0.82, 1.58, 0], m: 'gun2', g: 'weapon' },
      ...[-0.35, 0.05, 0.45].map((x) => ({ t: 'box', s: [0.08, 0.62, 0.9], p: [x, 1.62, 0], m: 'gunD', g: 'weapon' })),
      { t: 'box', s: [0.9, 0.05, 0.02], p: [0.1, 1.8, 0.44], m: 'accent', g: 'weapon', mir: true },
      ...[-0.17, 0.17].flatMap((z) => [
        { t: 'cyl', ax: 'x', r: 0.15, l: 0.5, seg: 10, p: [1.02, 1.66, z], m: 'brass', g: 'barrel' },
        { t: 'cyl', ax: 'x', r: 0.085, l: 1.4, seg: 8, p: [1.85, 1.66, z], m: 'dark', g: 'barrel' },
        { t: 'cyl', ax: 'x', r: 0.12, l: 0.16, seg: 8, p: [2.5, 1.66, z], m: 'gunD', g: 'barrel' },
        { t: 'cyl', ax: 'x', r: 0.06, l: 0.02, seg: 8, p: [2.59, 1.66, z], m: 'amber', g: 'barrel' },
      ]),
      // HEAD: mast, cross arm, comb array (left) and target screen (right) — sweeps; scaled ×1.6 about the mast foot to match the sheet
      ...scaleAbout([-0.3, 1.92, 0], 1.6, [
      { t: 'cyl', ax: 'y', r: 0.07, l: 0.4, seg: 8, p: [-0.3, 2.12, 0], m: 'dark', g: 'head' },
      { t: 'box', s: [0.1, 0.08, 1.25], p: [-0.3, 2.34, 0], m: 'gun', g: 'head' },
      { t: 'box', s: [0.06, 0.09, 0.78], p: [-0.3, 2.86, -0.52], m: 'bone', g: 'head' },
      ...Array.from({ length: 9 }, (_, i) => ({ t: 'box', s: [0.04, 0.42, 0.035], p: [-0.3, 2.62, -0.86 + i * 0.085], m: 'bone', g: 'head' })),
      { t: 'cyl', ax: 'y', r: 0.025, l: 0.5, seg: 5, p: [-0.3, 2.6, -0.52], m: 'dark', g: 'head' },
      { t: 'box', s: [0.07, 0.72, 0.68], p: [-0.3, 2.74, 0.42], m: 'bone', g: 'head' },
      { t: 'box', s: [0.02, 0.07, 0.5], p: [-0.26, 2.76, 0.42], m: 'black', g: 'head' },
      { t: 'box', s: [0.02, 0.36, 0.07], p: [-0.26, 2.74, 0.42], m: 'black', g: 'head' },
      { t: 'box', s: [0.02, 0.05, 0.22], p: [-0.26, 2.6, 0.42], m: 'black', g: 'head' },
      { t: 'cyl', ax: 'y', r: 0.025, l: 0.3, seg: 5, p: [-0.3, 2.45, 0.42], m: 'dark', g: 'head' },
      ]),
    ];
    // radar panels face sideways (like the sheet): turn the head 90° about its mast — swap X/Z extents and offsets
    for (let i = 0; i < parts.length; i++) { const q = parts[i]; if (q.g !== 'head') continue;
      const o = [-0.3, 0, 0]; parts[i] = Object.assign({}, q, { p: [o[0] + (q.p[2] - o[2]), q.p[1], o[2] + (q.p[0] - o[0])], s: q.s && [q.s[2], q.s[1], q.s[0]] }); }
    for (const q of parts) if (q.g || q.p[1] > 0.8) q.p = [q.p[0], q.p[1] - 0.3, q.p[2]];
    for (const q of parts) if (!q.g && q.s && q.s[1] === 0.95) { q.s = [0.36, 0.72, 0.36]; q.p = [q.p[0], 0.38, q.p[2]]; q.r3 = [-18, 0, q.p[0] > 0 ? 18 : -18]; }
    M.sys_flak = { name: 'Anti-air (flak) tower', unit: 'SYS-Flak', ref: 'sys_flak', parts, pivots: { weapon: [0, 1.0, 0], head: [-0.3, 1.62, 0], barrel: [0.8, 1.36, 0] }, head: { mode: 'sweep' },
      // twin barrels pitch straight at the target — up at aircraft [MM-story_mvedxxo7_7]
      barrel: { authored: 0, rest: 10, min: -5, max: 75, rate: 2.2, aim: 'straight' },
      // the twin barrels' amber tips (after the −0.3 drop above); they fire alternately
      muzzles: [0.17, -0.17].map((z) => ({ p: [2.61, 1.36, z], d: [1, 0, 0], back: 1.1 })),
      views: { side: 'right', top: 'up' } };
  }

  // ── SYS-Wall: armour panels between buttressed posts, plate seams, hazard stripes (one cell wide, runs along Z)
  {
    const stripes = (x, y, z, w) => [
      { t: 'box', s: [0.02, 0.15, w], p: [x, y, z], m: 'black' },
      ...[-1, 0, 1].map((k) => ({ t: 'box', s: [0.025, 0.06, 0.16], p: [x + 0.003, y, z + k * w * 0.3], r3: [45, 0, 0], m: 'hazard' })),
    ];
    const parts = [
      ...[-1.2, 0, 1.2].flatMap((z) => [
        { t: 'box', s: [0.5, 2.3, 1.12], p: [0, 1.2, z], m: 'gun2' },
        ...[0.75, 1.55].map((y) => ({ t: 'box', s: [0.53, 0.07, 1.0], p: [0, y, z], m: 'gun' })),
      ]),
      ...[-1.8, -0.6, 0.6, 1.8].flatMap((z) => [
        { t: 'box', s: [0.74, 2.6, 0.28], p: [0, 1.3, z], m: 'gunD' },
        { t: 'box', s: [1.15, 0.32, 0.42], p: [0, 0.16, z], m: 'gunD' },
        { t: 'box', s: [0.8, 0.07, 0.34], p: [0, 2.63, z], m: 'gun2' },
        ...[0.6, 1.3, 2.0].map((y) => ({ t: 'cyl', ax: 'x', r: 0.035, l: 0.78, seg: 6, p: [0, y, z], m: 'metal' })),
      ]),
      ...stripes(0.26, 2.2, -1.2, 0.5), ...stripes(0.26, 2.2, 1.2, 0.5), ...stripes(0.26, 0.4, 0, 0.6),
      ...stripes(-0.26, 2.2, -1.2, 0.5), ...stripes(-0.26, 2.2, 1.2, 0.5),
    ];
    M.sys_wall = { name: 'Wall', unit: 'SYS-Wall', ref: 'sys_wall', parts, pivots: {}, views: { side: 'right', top: 'up' } };
  }

  // ── SYS-Harvester: wide tracked miner, white body, empty cargo hopper, spinning chrome drill (head, spins on X)
  {
    const W = 1.15;                                     // body half-width (was 0.8)
    const BODY = [[-1.95, 0.84], [-1.95, 1.8], [-1.5, 2.08], [0.7, 2.08], [1.12, 1.66], [1.12, 0.84]];
    const rivet = (x, y, z, ax = 'z') => ({ t: 'cyl', ax, r: 0.035, l: 0.03, seg: 6, p: [x, y, z], m: 'chrome', d: 1 });
    const ringBolts = (x, r, n) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return { t: 'cyl', ax: 'x', r: 0.045, l: 0.05, seg: 6, p: [x, 1.3 + Math.cos(a) * r, Math.sin(a) * r], m: 'chrome', d: 1 }; });
    const parts = [
      ...track({ x0: -1.95, x1: 1.4, h: 0.82, z: 1.42, w: 0.66, wheels: 5, wr: 0.3, rr: 0.41 }),
      // chassis frame + sloped track fenders with hazard nose
      { t: 'box', s: [3.25, 0.26, 2.2], p: [-0.28, 0.74, 0], m: 'gun' },
      { t: 'ext', ax: 'z', poly: [[-2.02, 0.84], [-2.02, 0.96], [1.2, 0.96], [1.5, 0.78], [1.42, 0.72], [1.15, 0.86], [-1.92, 0.86]], d: [1.08, 1.78], m: 'gun2', mir: true },
      { t: 'box', s: [0.3, 0.025, 0.7], p: [1.32, 0.88, 1.43], r3: [0, 0, -31], m: 'hazard', mir: true },
      ...[0, 1, 2].map((i) => ({ t: 'box', s: [0.06, 0.03, 0.7], p: [1.24 + i * 0.09, 0.84 + 0.06 - i * 0.055, 1.43], r3: [0, 0, -31], m: 'black', mir: true, d: 1 })),
      // body shell + roof plate + belt line
      { t: 'ext', ax: 'z', poly: BODY, d: [-W, W], m: 'bone' },
      { t: 'box', s: [2.2, 0.05, 2 * W + 0.04], p: [-0.4, 2.1, 0], m: 'gun2' },
      { t: 'box', s: [3.1, 0.08, 0.05], p: [-0.42, 0.9, W], m: 'gunD', mir: true },
      { t: 'box', s: [1.75, 0.08, 0.03], p: [-0.35, 1.58, W + 0.01], m: 'accent', mir: true },
      { t: 'box', s: [1.75, 0.025, 0.035], p: [-0.35, 1.5, W + 0.01], m: 'accent', mir: true },
      // panel seams + rivets along the sides
      ...[-1.25, -0.35, 0.55].map((x) => ({ t: 'box', s: [0.025, 1.0, 0.02], p: [x, 1.42, W + 0.005], m: 'gunD', mir: true, d: 1 })),
      ...[-1.75, -1.35, -0.95, -0.55, -0.15, 0.25, 0.65, 0.95].flatMap((x) => [rivet(x, 1.0, W + 0.01), rivet(x, 1.9, W + 0.01)]).map((p) => ({ ...p, mir: true })),
      // cab: side window, door, grab handle; rear vents + ladder + tail lights
      { t: 'box', s: [0.55, 0.24, 0.03], p: [-1.5, 1.76, W + 0.01], m: 'glass', mir: true },
      { t: 'box', s: [0.6, 0.3, 0.02], p: [-1.5, 1.76, W + 0.005], m: 'gunD', mir: true },
      { t: 'box', s: [0.02, 0.62, 0.02], p: [-1.15, 1.32, W + 0.01], m: 'gunD', mir: true, d: 1 },
      { t: 'cyl', ax: 'x', r: 0.025, l: 0.4, seg: 6, p: [-1.5, 1.42, W + 0.07], m: 'chrome', mir: true },
      ...[0, 1, 2, 3].map((i) => ({ t: 'box', s: [0.03, 0.06, 1.2], p: [-1.97, 1.15 + i * 0.13, 0], m: 'gunD' })),
      ...[0, 1, 2, 3, 4].map((i) => ({ t: 'box', s: [0.04, 0.03, 0.3], p: [-2.02, 0.98 + i * 0.2, -0.82], m: 'chrome', d: 1 })),
      { t: 'box', s: [0.04, 0.95, 0.03], p: [-2.02, 1.38, -0.98], m: 'chrome' },
      { t: 'box', s: [0.04, 0.95, 0.03], p: [-2.02, 1.38, -0.66], m: 'chrome' },
      { t: 'box', s: [0.04, 0.12, 0.22], p: [-1.97, 1.0, 0.85], m: 'glowR' },
      // roof kit: bent exhaust stack, intake, amber beacon, cab light bar
      { t: 'cyl', ax: 'y', r: 0.09, l: 0.55, seg: 8, p: [-1.62, 2.3, -0.82], m: 'dark' },
      { t: 'cyl', ax: 'x', r: 0.09, l: 0.38, seg: 8, p: [-1.45, 2.6, -0.82], r3: [0, 0, -25], m: 'dark' },
      { t: 'cyl', ax: 'x', r: 0.11, l: 0.06, seg: 8, p: [-1.27, 2.68, -0.82], r3: [0, 0, -25], m: 'gunD' },
      { t: 'box', s: [0.32, 0.2, 0.4], p: [-1.65, 2.2, 0.75], m: 'gun2' },
      ...[0, 1, 2].map((i) => ({ t: 'box', s: [0.02, 0.12, 0.34], p: [-1.5, 2.2, 0.75 + (i - 1) * 0.0], r3: [0, 0, 0], m: 'gunD', d: 1 })).slice(0, 1),
      { t: 'cyl', ax: 'y', r: 0.08, l: 0.04, seg: 10, p: [-1.65, 2.12, 0], m: 'gunD' },
      { t: 'cyl', ax: 'y', r: 0.06, l: 0.12, seg: 10, p: [-1.65, 2.2, 0], m: 'amber' },
      ...[-0.5, -0.17, 0.17, 0.5].map((z) => ({ t: 'box', s: [0.06, 0.07, 0.18], p: [0.92, 1.9, z], r3: [0, 0, -45], m: 'glow' })),
      // hopper: flared walls, rim, corner posts, bolts; empty bed the game fills with gems (see def.cargo)
      { t: 'box', s: [1.95, 0.05, 2 * W - 0.2], p: [-0.35, 2.13, 0], m: 'gunD' },
      { t: 'box', s: [1.95, 0.42, 0.07], p: [-0.35, 2.33, W - 0.07], r3: [-10, 0, 0], m: 'gun', mir: true },
      { t: 'box', s: [0.07, 0.42, 2 * W - 0.1], p: [-1.32, 2.33, 0], r3: [0, 0, -8], m: 'gun' },
      { t: 'box', s: [0.07, 0.42, 2 * W - 0.1], p: [0.62, 2.33, 0], r3: [0, 0, 8], m: 'gun' },
      { t: 'box', s: [2.1, 0.05, 0.12], p: [-0.35, 2.55, W - 0.03], m: 'accent', mir: true },
      { t: 'box', s: [0.12, 0.05, 2 * W + 0.1], p: [-1.36, 2.55, 0], m: 'accent' },
      { t: 'box', s: [0.12, 0.05, 2 * W + 0.1], p: [0.66, 2.55, 0], m: 'accent' },
      ...[[-1.33, 1], [0.63, 1]].map(([x]) => ({ t: 'box', s: [0.12, 0.48, 0.12], p: [x, 2.32, W - 0.05], m: 'gunD', mir: true })),
      ...[-1.0, -0.65, -0.3, 0.05, 0.4].map((x) => ({ ...rivet(x, 2.42, W + 0.0), mir: true })),
      // drill: bolted collar (base), hydraulic rams from the body, then the spinning bit (head)
      { t: 'cyl', ax: 'x', r: 0.88, l: 0.24, seg: 16, p: [1.24, 1.3, 0], m: 'gun2' },
      { t: 'cyl', ax: 'x', r: 0.72, l: 0.12, seg: 16, p: [1.42, 1.3, 0], m: 'gunD' },
      { t: 'cyl', ax: 'x', r: 0.92, l: 0.06, seg: 16, p: [1.1, 1.3, 0], m: 'hazard' },
      ...ringBolts(1.37, 0.8, 12),
      ...[1, -1].flatMap((s) => [
        { t: 'cyl', ax: 'x', r: 0.08, l: 0.5, seg: 8, p: [0.95, 1.95, 0.6 * s], r3: [0, 0, -28], m: 'gunD' },
        { t: 'cyl', ax: 'x', r: 0.05, l: 0.35, seg: 8, p: [1.25, 1.78, 0.6 * s], r3: [0, 0, -28], m: 'chrome' },
      ]),
      { t: 'cyl', ax: 'x', r: [0.04, 0.6], l: 1.25, seg: 12, p: [2.07, 1.3, 0], m: 'chrome', g: 'head' },
      ...[0, 1, 2, 3].map((i) => ({ t: 'cyl', ax: 'x', r: 0.66 - i * 0.13, l: 0.08, seg: 12, p: [1.57 + i * 0.27, 1.3, 0], r3: [0, 9, 0], m: 'chrome', g: 'head' })),
      ...[0, 1, 2].map((i) => ({ t: 'box', s: [0.9, 0.05, 0.05], p: [1.95, 1.3, 0], r3: [i * 60, 0, 0], m: 'gunD', g: 'head' })),
    ];
    M.sys_harvester = { name: 'Resource miner', unit: 'SYS-Harvester', ref: 'sys_harvester', parts, pivots: { head: [1.47, 1.3, 0] }, head: { mode: 'spin', speed: 7, axis: 'x' },
      // cargo bed the game fills with gems: floor top centre + inner size (model units, base space)
      cargo: { at: [-0.35, 2.155, 0], size: [1.85, 0.38, 2 * W - 0.3] },
      views: { side: 'right', top: 'up' } };
  }

  // ── SYS-MG: stepped pedestal, machine gun with perforated cooling jacket, ammo box and hanging belt
  {
    const parts = [
      { t: 'box', s: [2.9, 0.14, 2.9], p: [0, 0.07, 0], m: 'gunD' },
      { t: 'box', s: [2.3, 0.22, 2.3], p: [0, 0.25, 0], m: 'gun' },
      { t: 'loft', ax: 'y', secs: [[0.36, [[-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85]]], [1.25, [[-0.55, -0.55], [0.55, -0.55], [0.55, 0.55], [-0.55, 0.55]]]], m: 'gun' },
      { t: 'box', s: [0.7, 0.05, 0.03], p: [0, 0.8, 0.72], r3: [-18, 0, 0], m: 'accent', mir: true },
      { t: 'cyl', ax: 'y', r: 0.5, l: 0.1, seg: 12, p: [0, 1.3, 0], m: 'dark' },
      ...[[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]].map(([x, z]) => ({ t: 'cyl', ax: 'y', r: 0.06, l: 0.04, seg: 6, p: [x, 0.16, z], m: 'metal' })),
      // WEAPON
      { t: 'box', s: [0.6, 0.35, 0.5], p: [0, 1.5, 0], m: 'gunD', g: 'weapon' },
      { t: 'box', s: [1.25, 0.46, 0.5], p: [-0.05, 1.78, 0], m: 'gun', g: 'weapon' },
      { t: 'box', s: [0.32, 0.3, 0.34], p: [-0.85, 1.72, 0], m: 'gunD', g: 'weapon' },
      { t: 'box', s: [0.06, 0.2, 0.06], p: [-1.0, 1.55, 0.12], m: 'dark', g: 'weapon', mir: true },
      { t: 'cyl', ax: 'x', r: 0.21, l: 1.35, seg: 12, p: [1.2, 1.82, 0], m: 'gunD', g: 'weapon' },
      ...Array.from({ length: 6 }, (_, i) => [0.7 + i * 0.2]).flatMap(([x]) => [1.89, 1.75].map((y) => ({ t: 'box', s: [0.07, 0.06, 0.02], p: [x, y, 0.205], m: 'black', g: 'weapon', mir: true }))),
      ...Array.from({ length: 6 }, (_, i) => ({ t: 'box', s: [0.07, 0.02, 0.07], p: [0.7 + i * 0.2, 2.03, 0], m: 'black', g: 'weapon' })),
      { t: 'cyl', ax: 'x', r: 0.075, l: 0.7, seg: 8, p: [2.2, 1.82, 0], m: 'dark', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: 0.12, l: 0.22, seg: 10, p: [2.55, 1.82, 0], m: 'gunD', g: 'weapon' },
      { t: 'box', s: [0.38, 0.36, 0.3], p: [0.05, 1.62, -0.42], m: 'gun2', g: 'weapon' },
      ...Array.from({ length: 9 }, (_, i) => ({ t: 'box', s: [0.12, 0.05, 0.1], p: [0.1 + i * 0.02, 1.42 - i * 0.1, -0.52 - i * 0.02], r3: [0, 0, -8], m: 'brass', g: 'weapon' })),
    ];
    for (let i = 0; i < parts.length; i++) if (parts[i].g === 'weapon') parts[i] = scaleAbout([0, 1.35, 0], 1.3, [parts[i]])[0];
    M.sys_mg = { name: 'Machine-gun turret', unit: 'SYS-MG', ref: 'sys_mg', parts, pivots: { weapon: [0, 1.35, 0] }, views: { side: 'right', top: 'up' } };
  }

  // ── SYS-Rockets: domed pedestal on a cross foot, cradle with a 2×2 rack of rockets (white bodies, red noses)
  {
    const C0 = [0.0, 1.62, 0], A = 28, u = [Math.cos(A * D), Math.sin(A * D)], n = [-Math.sin(A * D), Math.cos(A * D)];
    const rocket = (h, z) => {
      const c = [C0[0] + n[0] * h, C0[1] + n[1] * h, z], at = (d) => [c[0] + u[0] * d, c[1] + u[1] * d, z];
      return [
        { t: 'cyl', ax: 'x', r: 0.2, l: 2.8, seg: 12, p: c, r3: [0, 0, A], m: 'bone', g: 'barrel' },
        { t: 'cyl', ax: 'x', r: [0.02, 0.2], l: 0.66, seg: 12, p: at(1.73), r3: [0, 0, A], m: 'accent', g: 'barrel' },
        { t: 'cyl', ax: 'x', r: 0.205, l: 0.07, seg: 12, p: at(0.5), r3: [0, 0, A], m: 'gun2', g: 'barrel' },
        { t: 'box', s: [0.42, 0.025, 0.6], p: at(-1.22), r3: [0, 0, A], m: 'bone', g: 'barrel' },
        { t: 'box', s: [0.42, 0.025, 0.6], p: at(-1.22), r3: [90, 0, A], m: 'bone', g: 'barrel' },
        { t: 'cyl', ax: 'x', r: [0.15, 0.12], l: 0.14, seg: 8, p: at(-1.45), r3: [0, 0, A], m: 'dark', g: 'barrel' },
      ];
    };
    const parts = [
      { t: 'box', s: [2.7, 0.08, 0.42], p: [0, 0.04, 0], m: 'gunD' },
      { t: 'box', s: [0.42, 0.08, 2.7], p: [0, 0.04, 0], m: 'gunD' },
      ...[[1.25, 0], [-1.25, 0], [0, 1.25], [0, -1.25]].map(([x, z]) => ({ t: 'box', s: [0.3, 0.14, 0.3], p: [x, 0.08, z], m: 'gun' })),
      { t: 'ell', s: [0.9, 0.78, 0.9], half: true, seg: 14, p: [0, 0.08, 0], m: 'gun' },
      { t: 'cyl', ax: 'y', r: 0.92, l: 0.1, seg: 16, p: [0, 0.12, 0], m: 'gun2' },
      { t: 'box', s: [0.5, 0.04, 0.03], p: [0.55, 0.45, 0.55], r3: [0, -45, 30], m: 'accent' },
      { t: 'cyl', ax: 'y', r: 0.32, l: 0.3, seg: 10, p: [0, 0.95, 0], m: 'dark' },
      // WEAPON: yoke + cradle + rockets
      { t: 'box', s: [0.45, 0.55, 0.08], p: [0, 1.25, 0.34], m: 'gun', g: 'weapon', mir: true },
      { t: 'cyl', ax: 'z', r: 0.12, l: 0.8, seg: 8, p: [0, 1.4, 0], m: 'dark', g: 'weapon' },
      { t: 'box', s: [2.0, 0.12, 0.95], p: [C0[0] - n[0] * 0.02, C0[1] - n[1] * 0.02, 0], r3: [0, 0, A], m: 'gunD', g: 'barrel' },
      ...rocket(0.26, -0.24), ...rocket(0.26, 0.24), ...rocket(0.68, -0.24), ...rocket(0.68, 0.24),
    ];
    // firing points: each rocket's nose, rippled corner to corner; `back` reaches the nozzle (for the launch plume)
    const nose = (h, z) => ({ p: [C0[0] + n[0] * h + u[0] * 2.06, C0[1] + n[1] * h + u[1] * 2.06, z], d: [u[0], u[1], 0], back: 3.52 });
    M.sys_rockets = { name: 'Rocket launcher', unit: 'SYS-Rockets', ref: 'sys_rockets', parts, pivots: { weapon: [0, 1.25, 0], barrel: [0, 1.4, 0] }, views: { side: 'right', top: 'up' },
      // the rack tilts about its axle to the salvo's launch slope (authored at A) [MM-story_mvedxxo7_7]
      barrel: { authored: A, rest: A, min: 10, max: 50, rate: 1.2, aim: 'rocket' },   // ≤ 50° so its yaw reads [MM-task_mvejw9k0_m]
      muzzles: [nose(0.68, -0.24), nose(0.26, 0.24), nose(0.68, 0.24), nose(0.26, -0.24)] };
  }

  // ── SYS-Missile (Missile Tower, anti-air) [MM-story_mvbyf8gq_10]: armoured drum on a cross foot, a yawing launcher
  //    with two 2×2 missile pods (white bodies, red tips) either side of a search radar that sweeps.
  {
    const pod = (z) => [
      { t: 'box', s: [1.15, 0.62, 0.62], p: [0.15, 1.72, z], r3: [0, 0, 18], m: 'gun', g: 'barrel' },
      { t: 'box', s: [0.06, 0.66, 0.66], p: [0.72, 1.9, z], r3: [0, 0, 18], m: 'gunD', g: 'barrel' },
      ...[[-0.15, -0.15], [-0.15, 0.15], [0.15, -0.15], [0.15, 0.15]].flatMap(([dy, dz]) => [
        { t: 'cyl', ax: 'x', r: 0.1, l: 0.12, seg: 10, p: [0.78, 1.92 + dy, z + dz], r3: [0, 0, 18], m: 'bone', g: 'barrel' },
        { t: 'cyl', ax: 'x', r: [0.015, 0.1], l: 0.2, seg: 10, p: [0.92, 1.97 + dy, z + dz], r3: [0, 0, 18], m: 'accent', g: 'barrel' },
      ]),
      { t: 'box', s: [1.0, 0.04, 0.02], p: [0.1, 1.6, z + (z > 0 ? 0.32 : -0.32)], r3: [0, 0, 18], m: 'accent', g: 'barrel' },
    ];
    const parts = [
      { t: 'box', s: [2.6, 0.08, 0.42], p: [0, 0.04, 0], m: 'gunD' },
      { t: 'box', s: [0.42, 0.08, 2.6], p: [0, 0.04, 0], m: 'gunD' },
      { t: 'cyl', ax: 'y', r: 0.95, l: 0.9, seg: 12, p: [0, 0.5, 0], m: 'gun' },
      { t: 'cyl', ax: 'y', r: 1.0, l: 0.1, seg: 12, p: [0, 0.6, 0], m: 'hazard' },
      { t: 'cyl', ax: 'y', r: 0.8, l: 0.12, seg: 12, p: [0, 1.0, 0], m: 'gunD' },
      // WEAPON: turntable, yoke, two pods
      { t: 'cyl', ax: 'y', r: 0.72, l: 0.18, seg: 12, p: [0, 1.15, 0], m: 'gun2', g: 'weapon' },
      { t: 'box', s: [0.55, 0.6, 0.18], p: [-0.05, 1.5, 0.48], m: 'gun', g: 'weapon', mir: true },
      ...pod(0.82), ...pod(-0.82),
      // HEAD: search radar between the pods (sweeps)
      { t: 'cyl', ax: 'y', r: 0.06, l: 0.5, seg: 8, p: [-0.3, 1.5, 0], m: 'dark', g: 'head' },
      { t: 'box', s: [0.08, 0.5, 0.7], p: [-0.3, 1.95, 0], m: 'bone', g: 'head' },
      ...Array.from({ length: 6 }, (_, i) => ({ t: 'box', s: [0.02, 0.42, 0.03], p: [-0.25, 1.95, -0.28 + i * 0.11], m: 'gunD', g: 'head' })),
    ];
    // firing points: the eight tube mouths (red tips), alternating pods; `back` reaches the pod's rear face
    const c18 = Math.cos(18 * D), s18 = Math.sin(18 * D);
    const tube = (z, dy, dz) => ({ p: [0.92 + 0.1 * c18, 1.97 + dy + 0.1 * s18, z + dz], d: [c18, s18, 0], back: 1.25 });
    const order = [[0.15, -0.15], [0.15, 0.15], [-0.15, -0.15], [-0.15, 0.15]];
    M.sys_missile = { name: 'Missile tower', unit: 'SYS-Missile', ref: 'sys_missile', parts, pivots: { weapon: [0, 1.1, 0], head: [-0.3, 1.3, 0], barrel: [0, 1.6, 0] }, head: { mode: 'sweep' },
      // the pods tilt toward the target, never below a launch rail's climb (authored at 18°) [MM-story_mvedxxo7_7]
      barrel: { authored: 18, rest: 18, min: 12, max: 60, rate: 1.4, aim: 'missile' },
      muzzles: order.flatMap(([dy, dz]) => [tube(0.82, dy, dz), tube(-0.82, dy, -dz)]) };
  }

export const SYSTEM_MODELS = M;
/** Model unit → cell, per model: towers read a little larger than their 1-cell slot's units; a wall segment spans its cell. */
export const SYSTEM_SCALE = Object.freeze({ sys_cannon: 0.3, sys_flak: 0.32, sys_wall: 0.26, sys_harvester: 0.25, sys_mg: 0.3, sys_rockets: 0.3, sys_missile: 0.3 });
