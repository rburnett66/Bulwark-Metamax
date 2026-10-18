/**
 * src/render3d/craft/models.js — the ten LANDING CRAFT as part lists (owner-approved 2026-10-16). DATA + the kit
 * that builds them; no three.js. Built by units/prims.js createPrims(THREE) — see craft3d.js. [MM-story_mvbk1hf3_1]
 *
 * A landing craft is the player's 3 × 3 BASE: it flies in, lands on the base cells, drops its two hatch ramps
 * and the harvesters drive out (landing.js). Same part schema as the unit models (box / cyl / ext / loft / ell,
 * one material key per part, `mir` mirrors in Z, `d: 1` = detail the far LOD drops). Axes: X forward (nose),
 * Y up, Z right; ground at Y = 0; 4 model units = 1 cell, so a craft fills X, Z in [-6, 6]. Authored pose =
 * LANDED: gear down, doors closed — anything that ignores the animated groups still draws a parked craft.
 *
 * Layout (the owner's 3 × 3 sheet, nose = +X):
 *   front row  x  2..6  : defense pod · cockpit · defense pod
 *   middle row x -2..2  : resource hatch · main hull + top weapon · resource hatch
 *   rear row   x -6..-2 : pod + engine · rear cargo / engine block · pod + engine
 *
 * Groups: base · weapon (yaws, roof centre) · head (sensor, rides on the weapon) · gear (translates +Y to stow)
 * · doorR / doorL (rotate about X at the sill hinge into ramps). Palette is PER CRAFT (def.palette).
 * Design: docs/16 Bulwark MM/design/Landing-Craft-and-Resources-Design.md.
 */

const D = Math.PI / 180;
const M = {};

// ── section and point helpers ─────────────────────────────────────────────────────────────────────────
// chamfered rectangle, 8 pts, in (u, v) — for loft ax 'x' that is (z, y)
const crect = (cu, hw, y0, y1, ct = 0.3, cb = 0.3) => [[cu - hw, y0 + cb], [cu - hw + cb, y0], [cu + hw - cb, y0], [cu + hw, y0 + cb],
  [cu + hw, y1 - ct], [cu + hw - ct, y1], [cu - hw + ct, y1], [cu - hw, y1 - ct]];
// peaked (arched) section, 8 pts
const arch = (cu, hw, y0, y1, pk, c = 0.3) => [[cu - hw, y0 + c], [cu - hw + c, y0], [cu + hw - c, y0], [cu + hw, y0 + c],
  [cu + hw, y1], [cu + hw * 0.22, y1 + pk], [cu - hw * 0.22, y1 + pk], [cu - hw, y1]];
// ellipse, n pts, centred (cu, cv)
const esec = (cu, hw, cv, hh, n = 12, sq = 1) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
  return [cu + hw * Math.sign(c) * Math.pow(Math.abs(c), sq), cv + hh * Math.sign(s) * Math.pow(Math.abs(s), sq)];
});
// octagon in plan, 8 pts in (x, z) — for loft ax 'y'
const octP = (cx, cz, hx, hz, c) => [[cx + hx, cz - hz + c], [cx + hx, cz + hz - c], [cx + hx - c, cz + hz], [cx - hx + c, cz + hz],
  [cx - hx, cz + hz - c], [cx - hx, cz - hz + c], [cx - hx + c, cz - hz], [cx + hx - c, cz - hz]];
const ngon = (cx, cz, r, n, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 * D + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
// rotate (x, y) about Z by deg
const rz = ([x, y], deg) => { const c = Math.cos(deg * D), s = Math.sin(deg * D); return [x * c - y * s, x * s + y * c]; };
const add2 = ([a, b], [c, d]) => [a + c, b + d];
// tag a list of parts with a group (and optionally mirror)
const G = (g, ps) => ps.map((p) => Object.assign({}, p, { g }));
// a box from point a to point b
const strut = (a, b, w, h, m, extra = {}) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const yaw = -Math.atan2(dz, dx) / D, pitch = Math.atan2(dy, Math.hypot(dx, dz)) / D;
  return Object.assign({ t: 'box', s: [L, h, w], p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r3: [0, yaw, pitch], m }, extra);
};
// n boxes around a ring (a hoop that reads from every side — an open cylinder would lose its back half)
const hoop = (cx, cy, cz, r, n, thick, h, m, extra = {}) => Array.from({ length: n }, (_, i) => {
  const a = (i + 0.5) / n * 360, len = 2 * r * Math.tan(Math.PI / n) * 1.02;
  return Object.assign({ t: 'box', s: [thick, h, len], p: [cx + Math.cos(a * D) * r, cy, cz - Math.sin(a * D) * r], r3: [0, a, 0], m }, extra);
});

// ── shared kit ────────────────────────────────────────────────────────────────────────────────────────
// Landing leg under a pod (group gear). Leg top hides inside the pod; pad sits on Y = 0.
function gearLeg(cx, cz, o = {}) {
  const top = o.top || 1.45, pad = o.pad || 0.55, splay = o.splay || 0;
  const px = cx + Math.sign(cx) * splay, pz = cz + splay;
  return G('gear', [
    strut([cx, top, cz], [px, 0.75, pz], 0.34, 0.34, o.sleeve || 'dark', { mir: true }),
    strut([px, 0.85, pz], [px, 0.12, pz], 0.2, 0.2, 'metal', { mir: true }),
    { t: 'cyl', r: [pad * 0.8, pad], l: 0.14, seg: 8, p: [px, 0.07, pz], m: o.padM || 'dark', mir: true },
    { t: 'box', s: [pad * 0.9, 0.05, 0.12], p: [px, 0.155, pz], m: 'stripe', mir: true, d: 1 },
    strut([px, 0.5, pz], [cx - Math.sign(cx) * 0.7, top - 0.1, cz - 0.7], 0.1, 0.1, 'metal', { mir: true, d: 1 }),
  ]);
}
// VTOL lift jet on a pod belly (glows; the viewer brightens it in flight)
const liftJet = (cx, cz, y, r = 0.55) => [
  { t: 'cyl', r: r * 1.18, l: 0.12, seg: 10, p: [cx, y - 0.02, cz], m: 'dark', mir: true },
  { t: 'cyl', r, l: 0.04, seg: 10, p: [cx, y - 0.1, cz], m: 'glowE', mir: true },
];
// rear engine bell: mounting face at x, bell runs toward -X
const nozzle = (x, y, z, r, len, o = {}) => [
  { t: 'cyl', ax: 'x', r: [r * 1.1, r * 1.1], l: 0.16, seg: o.seg || 10, p: [x - 0.08, y, z], m: o.collar || 'dark', mir: o.mir },
  { t: 'cyl', ax: 'x', r: [r * 0.82, r], l: len, seg: o.seg || 10, p: [x - 0.16 - len / 2, y, z], m: o.m || 'metal', mir: o.mir },
  { t: 'cyl', ax: 'x', r: r * 0.74, l: 0.04, seg: o.seg || 10, p: [x - 0.16 - len + 0.08, y, z], m: 'glowE', mir: o.mir },
];
// The resource hatches: dark recess + frame on the module's outer face (base), and a door panel per side
// (groups doorR / doorL) hinged at the sill. Opening is sized for SYS-Harvester (≈ 3 wide, 2.7 tall).
function hatches(o = {}) {
  const w = o.w || 3.3, h = o.h || 3.0, y0 = o.y0 || 1.0, zf = o.zf || 6.0, fr = o.frame || 'hull2', pnl = o.panel || 'hull2';
  const out = [];
  for (const s of [1, -1]) {
    const g = s > 0 ? 'doorR' : 'doorL', zc = s * (zf + 0.075);
    out.push({ t: 'box', s: [w, h, 0.1], p: [0, y0 + h / 2, s * (zf - 0.03)], m: 'black' });
    out.push({ t: 'box', s: [w + 0.56, 0.26, 0.24], p: [0, y0 + h + 0.13, s * zf], m: fr });
    out.push({ t: 'box', s: [w + 0.56, 0.12, 0.24], p: [0, y0 - 0.06, s * zf], m: fr });
    for (const x of [1, -1]) out.push({ t: 'box', s: [0.28, h + 0.3, 0.24], p: [x * (w / 2 + 0.14), y0 + h / 2 + 0.05, s * zf], m: fr });
    out.push({ t: 'box', s: [w + 0.3, 0.05, 0.05], p: [0, y0 + h + 0.27, s * (zf + 0.1)], m: 'glow' });
    // door
    const dz = s * (zf + 0.075), D2 = [
      { t: 'box', s: [w - 0.05, h - 0.04, 0.13], p: [0, y0 + h / 2, dz], m: pnl },
      { t: 'box', s: [w - 0.6, h - 0.9, 0.04], p: [0, y0 + h / 2 + 0.1, s * (zf + 0.155)], m: o.inset || 'stripe' },
      ...[-0.85, 0, 0.85].map((x) => ({ t: 'box', s: [0.28, 1.25, 0.03], p: [x, y0 + h / 2 + 0.1, s * (zf + 0.18)], r3: [0, 0, -38], m: o.bars || 'dark' })),
      { t: 'box', s: [w - 0.4, 0.07, 0.04], p: [0, y0 + 0.28, s * (zf + 0.16)], m: 'glow' },
      { t: 'box', s: [0.7, 0.24, 0.04], p: [0, y0 + h - 0.22, s * (zf + 0.16)], m: o.plate || 'accent' },
      ...[-1, 1].map((x) => ({ t: 'box', s: [0.22, 0.14, 0.2], p: [x * (w / 2 - 0.35), y0 + 0.08, zc], m: 'dark', d: 1 })),   // hinge knuckles
    ];
    out.push(...G(g, D2));
  }
  return { parts: out, pivots: { doorR: [0, y0, zf + 0.075], doorL: [0, y0, -(zf + 0.075)] }, open: Math.round(180 - Math.acos((y0 - 0.06) / h) / D * 1) };
}

// ── weapons (group weapon; pivot [0, Y, 0] on the hull roof) ──────────────────────────────────────────
const bearing = (Y, r = 1.3) => [{ t: 'cyl', r: r + 0.08, l: 0.14, seg: 16, p: [0, Y - 0.07, 0], m: 'dark' }];

function wCannon(Y, o = {}) {
  const len = o.len || 3.3, bz = o.twin ? [0.3, -0.3] : [0], by = Y + 0.62, x0 = 1.25;
  const ps = [
    { t: 'cyl', r: 1.22, l: 0.18, seg: 16, p: [0, Y + 0.09, 0], m: 'dark' },
    { t: 'loft', ax: 'y', secs: [[Y + 0.18, octP(-0.15, 0, 1.25, 1.0, 0.42)], [Y + 0.78, octP(-0.15, 0, 1.2, 0.95, 0.4)], [Y + 1.08, octP(-0.3, 0, 0.92, 0.72, 0.3)]], m: o.hull || 'hull' },
    { t: 'loft', ax: 'y', secs: [[Y + 0.38, octP(-0.15, 0, 1.235, 0.985, 0.42)], [Y + 0.5, octP(-0.15, 0, 1.235, 0.985, 0.42)]], m: 'accent' },
    { t: 'box', s: [0.5, 0.64, o.twin ? 1.2 : 0.9], p: [1.05, by, 0], m: 'hull2' },
    { t: 'box', s: [0.72, 0.5, 1.4], p: [-1.4, Y + 0.56, 0], m: 'hull2' },
    { t: 'box', s: [0.04, 0.06, 1.2], p: [-1.77, Y + 0.6, 0], m: 'glow' },
    ...[0, 1, 2].map((i) => ({ t: 'box', s: [0.04, 0.05, 1.1], p: [-1.77, Y + 0.42 - i * 0.08 + 0.3, 0], m: 'dark', d: 1 })),
    { t: 'box', s: [0.5, 0.06, 0.4], p: [-0.5, Y + 1.1, -0.3], m: 'hull2', d: 1 },
  ];
  // the gun itself pitches about the mantlet (group `barrel`) to the base cannon's launch slope [MM-story_mvedy2wj_a]
  const bs = [];
  if (o.rail) {
    bs.push({ t: 'box', s: [len, 0.12, 0.14], p: [x0 + len / 2, by + 0.2, 0], m: 'hull2' });
    bs.push({ t: 'box', s: [len, 0.12, 0.14], p: [x0 + len / 2, by - 0.2, 0], m: 'hull2' });
    bs.push({ t: 'box', s: [len * 0.96, 0.06, 0.07], p: [x0 + len / 2, by, 0], m: 'glow' });
    for (let i = 0; i < 5; i++) bs.push({ t: 'box', s: [0.14, 0.62, 0.36], p: [x0 + 0.35 + i * (len - 0.6) / 4, by, 0], m: i % 2 ? 'accent' : 'dark' });
    bs.push({ t: 'box', s: [0.1, 0.56, 0.3], p: [x0 + len, by, 0], m: 'dark' });
  } else for (const z of bz) {
    bs.push({ t: 'cyl', ax: 'x', r: [0.11, 0.13], l: len, seg: 10, p: [x0 + len / 2, by, z], m: 'metal' });
    bs.push({ t: 'cyl', ax: 'x', r: 0.19, l: 0.95, seg: 10, p: [x0 + 0.65, by, z], m: 'hull2' });
    bs.push({ t: 'cyl', ax: 'x', r: 0.2, l: 0.06, seg: 10, p: [x0 + 1.15, by, z], m: 'accent' });
    bs.push({ t: 'cyl', ax: 'x', r: 0.18, l: 0.38, seg: 10, p: [x0 + len - 0.12, by, z], m: 'dark' });
    bs.push({ t: 'box', s: [0.06, 0.12, 0.42], p: [x0 + len - 0.1, by, z], m: 'black', d: 1 });
  }
  return { parts: [...G('weapon', ps), ...G('barrel', bs)], head: [-0.85, Y + 1.08, 0.42], barrel: [x0 - 0.2, by, 0], muzzle: [x0 + len + 0.02, by, 0], recoil: o.rail ? 0 : len * 0.18 };
}

function wGatling(Y, o = {}) {
  const z = 0.62, by = Y + 0.78;
  const ps = [
    { t: 'cyl', r: 1.1, l: 0.18, seg: 16, p: [0, Y + 0.09, 0], m: 'dark' },
    { t: 'loft', ax: 'y', secs: [[Y + 0.18, octP(-0.3, 0, 0.95, 0.85, 0.32)], [Y + 0.8, octP(-0.3, 0, 0.9, 0.8, 0.3)], [Y + 1.1, octP(-0.4, 0, 0.7, 0.62, 0.24)]], m: 'hull' },
    { t: 'loft', ax: 'y', secs: [[Y + 0.4, octP(-0.3, 0, 0.965, 0.865, 0.32)], [Y + 0.52, octP(-0.3, 0, 0.965, 0.865, 0.32)]], m: 'accent' },
    // gun shield, raked back
    { t: 'ext', ax: 'z', poly: [[0.62, Y + 0.25], [0.86, Y + 0.25], [0.66, Y + 1.5], [0.42, Y + 1.5]], d: [-1.25, 1.25], m: 'hull2' },
    { t: 'box', s: [0.28, 0.08, 2.54], p: [0.54, Y + 1.53, 0], m: 'accent' },
    { t: 'box', s: [0.08, 0.16, 0.5], p: [0.82, Y + 1.15, 0], m: 'glass' },
    // ammo drums
    { t: 'cyl', ax: 'z', r: 0.36, l: 0.32, seg: 12, p: [-0.4, Y + 0.72, 1.12], m: 'accent', mir: true },
    { t: 'cyl', ax: 'z', r: 0.2, l: 0.36, seg: 8, p: [-0.4, Y + 0.72, 1.12], m: 'dark', mir: true },
    // twin rotary guns
    { t: 'cyl', ax: 'x', r: 0.24, l: 0.6, seg: 10, p: [1.1, by, z], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: 0.2, l: 0.08, seg: 10, p: [2.0, by, z], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: 0.19, l: 0.06, seg: 10, p: [2.75, by, z], m: 'metal', mir: true },
    ...Array.from({ length: 6 }, (_, k) => { const a = k * 60 * D; return { t: 'cyl', ax: 'x', r: 0.045, l: 1.55, seg: 6, p: [2.12, by + Math.sin(a) * 0.12, z + Math.cos(a) * 0.12], m: 'metal', mir: true }; }),
    { t: 'cyl', ax: 'x', r: 0.05, l: 0.05, seg: 6, p: [2.9, by, z], m: 'glowR', mir: true, d: 1 },
  ];
  return { parts: G('weapon', ps), head: [-0.7, Y + 1.1, 0] };
}

function wMortar(Y, o = {}) {
  const tilt = o.tilt || 32, dir = [Math.sin(tilt * D), Math.cos(tilt * D)], L = o.len || 1.9, r = o.r || 0.27;
  const ps = [
    { t: 'cyl', r: 1.2, l: 0.18, seg: 16, p: [0, Y + 0.09, 0], m: 'dark' },
    { t: 'loft', ax: 'y', secs: [[Y + 0.18, octP(-0.2, 0, 1.2, 1.05, 0.4)], [Y + 0.62, octP(-0.2, 0, 1.12, 1.0, 0.38)]], m: 'hull' },
    { t: 'loft', ax: 'y', secs: [[Y + 0.3, octP(-0.2, 0, 1.215, 1.065, 0.4)], [Y + 0.42, octP(-0.2, 0, 1.215, 1.065, 0.4)]], m: 'accent' },
    { t: 'ext', ax: 'z', poly: [[-0.95, Y + 0.6], [0.55, Y + 0.6], [0.45, Y + 1.25], [-0.2, Y + 1.85], [-0.75, Y + 1.85]], d: [0.86, 0.98], m: 'hull2', mir: true },
    { t: 'cyl', ax: 'z', r: 0.16, l: 0.18, seg: 8, p: [-0.15, Y + 1.0, 1.04], m: 'metal', mir: true },
    { t: 'box', s: [0.9, 0.42, 0.5], p: [-1.0, Y + 0.84, 0.75], m: 'hull2', mir: true, d: 1 },
  ];
  for (const [bx, bz] of [[-0.1, 0.33], [-0.62, 0.33]]) {
    const B = [bx, Y + 0.65], C = add2(B, [dir[0] * L / 2, dir[1] * L / 2]), Mz = add2(B, [dir[0] * L, dir[1] * L]);
    ps.push({ t: 'cyl', r: [r * 0.95, r], l: L, seg: 10, p: [C[0], C[1], bz], r3: [0, 0, -tilt], m: o.tube || 'dark', mir: true });
    ps.push({ t: 'cyl', r: r + 0.06, l: 0.14, seg: 10, p: [Mz[0] - dir[0] * 0.07, Mz[1] - dir[1] * 0.07, bz], r3: [0, 0, -tilt], m: 'accent', mir: true });
    ps.push({ t: 'cyl', r: r * 0.75, l: 0.02, seg: 10, p: [Mz[0] + dir[0] * 0.005, Mz[1] + dir[1] * 0.005, bz], r3: [0, 0, -tilt], m: o.mouth || 'black', mir: true });
    ps.push({ t: 'cyl', r: r + 0.05, l: 0.12, seg: 10, p: [B[0] + dir[0] * 0.5, B[1] + dir[1] * 0.5, bz], r3: [0, 0, -tilt], m: 'hull2', mir: true });
  }
  return { parts: G('weapon', ps), head: [-1.05, Y + 0.62, 0] };
}

function wAA(Y, o = {}) {
  const ang = 28, C = [0.05, Y + 1.25], R = (v) => add2(C, rz(v, ang));
  const ps = [
    { t: 'cyl', r: 1.0, l: 0.18, seg: 16, p: [0, Y + 0.09, 0], m: 'dark' },
    { t: 'cyl', r: [0.55, 0.85], l: 0.5, seg: 12, p: [0, Y + 0.43, 0], m: 'hull' },
    { t: 'cyl', r: 0.88, l: 0.08, seg: 12, p: [0, Y + 0.3, 0], m: 'accent' },
    { t: 'box', s: [0.7, 0.55, 1.0], p: [0, Y + 0.9, 0], m: 'hull2' },
    { t: 'cyl', ax: 'z', r: 0.3, l: 2.25, seg: 10, p: [0, Y + 1.12, 0], m: 'dark' },
  ];
  for (const z of [0.85]) {
    ps.push({ t: 'box', s: [1.9, 1.0, 0.82], p: [C[0], C[1], z], r3: [0, 0, ang], m: o.pod || 'hull', mir: true });
    ps.push({ t: 'box', s: [1.92, 0.1, 0.86], p: [...R([0, 0.2]), z], r3: [0, 0, ang], m: 'accent', mir: true });
    for (const dy of [-0.23, 0.23]) for (const dz of [-0.19, 0.19]) {
      const F = R([0.96, dy]), N = R([1.06, dy]);
      ps.push({ t: 'cyl', ax: 'x', r: 0.15, l: 0.04, seg: 10, p: [F[0], F[1], z + dz], r3: [0, 0, ang], m: 'black', mir: true });
      ps.push({ t: 'cyl', ax: 'x', r: [0.015, 0.12], l: 0.26, seg: 8, p: [N[0], N[1], z + dz], r3: [0, 0, ang], m: o.nose || 'accent', mir: true });
    }
    const Bk = R([-0.97, 0]);
    ps.push({ t: 'box', s: [0.04, 0.7, 0.6], p: [Bk[0], Bk[1], z], r3: [0, 0, ang], m: 'dark', mir: true, d: 1 });
  }
  return { parts: G('weapon', ps), head: [-0.75, Y + 0.72, 0] };
}

function wRockets(Y, o = {}) {
  const ang = o.ang || 15, C = [0.15, Y + 1.1], R = (v) => add2(C, rz(v, ang)), rr = o.rr || 0.13, rows = o.rows || [-0.17, 0.2], cols = o.cols || [0.42, 0];
  const ps = [
    { t: 'cyl', r: 1.05, l: 0.18, seg: 16, p: [0, Y + 0.09, 0], m: 'dark' },
    { t: 'loft', ax: 'y', secs: [[Y + 0.18, octP(-0.25, 0, 1.0, 0.95, 0.35)], [Y + 0.62, octP(-0.25, 0, 0.92, 0.88, 0.32)]], m: 'hull' },
    { t: 'loft', ax: 'y', secs: [[Y + 0.3, octP(-0.25, 0, 1.015, 0.965, 0.35)], [Y + 0.4, octP(-0.25, 0, 1.015, 0.965, 0.35)]], m: 'accent' },
    { t: 'box', s: [2.5, 0.9, 0.08], p: [...R([0, 0]), 0.78], r3: [0, 0, ang], m: 'hull2', mir: true },
    { t: 'box', s: [2.5, 0.08, 1.6], p: [...R([0, -0.47]), 0], r3: [0, 0, ang], m: 'hull2' },
    { t: 'box', s: [0.1, 0.9, 1.6], p: [...R([-1.2, 0]), 0], r3: [0, 0, ang], m: 'dark' },
    { t: 'box', s: [0.7, 0.4, 0.3], p: [-0.6, Y + 0.75, 0], m: 'hull2' },
  ];
  for (const dy of rows) for (const dz of cols) {
    const mir = dz !== 0, Bd = R([-0.08, dy]), Ns = R([1.18, dy]), Tl = R([-1.05, dy]);
    ps.push({ t: 'cyl', ax: 'x', r: rr, l: 2.0, seg: 8, p: [Bd[0], Bd[1], dz], r3: [0, 0, ang], m: o.body || 'hull2', mir });
    ps.push({ t: 'cyl', ax: 'x', r: [0.01, rr], l: 0.5, seg: 8, p: [Ns[0], Ns[1], dz], r3: [0, 0, ang], m: o.nose || 'accent', mir });
    ps.push({ t: 'box', s: [0.25, rr * 3.2, 0.03], p: [Tl[0], Tl[1], dz], r3: [0, 0, ang], m: 'dark', mir, d: 1 });
  }
  return { parts: G('weapon', ps), head: [-0.95, Y + 0.62, 0] };
}

function wShield(Y, o = {}) {
  const ps = [{ t: 'cyl', r: 1.15, l: 0.18, seg: 16, p: [0, Y + 0.09, 0], m: 'dark' }];
  let head;
  if (o.style === 'halo') {
    ps.push(
      { t: 'loft', ax: 'y', secs: [[Y + 0.18, ngon(0, 0, 1.05, 8, 22.5)], [Y + 0.7, ngon(0, 0, 0.82, 8, 22.5)], [Y + 2.0, ngon(0, 0, 0.42, 8, 22.5)], [Y + 3.5, ngon(0, 0, 0.06, 8, 22.5)]], m: 'hull' },
      { t: 'loft', ax: 'y', secs: [[Y + 0.62, ngon(0, 0, 0.88, 8, 22.5)], [Y + 0.78, ngon(0, 0, 0.84, 8, 22.5)]], m: 'accent' },
      { t: 'loft', ax: 'y', secs: [[Y + 1.86, ngon(0, 0, 0.47, 8, 22.5)], [Y + 1.98, ngon(0, 0, 0.45, 8, 22.5)]], m: 'accent' },
      ...[0, 90, 180, 270].map((a) => ({ t: 'ext', ax: 'z', poly: [[0.3, Y + 0.2], [1.1, Y + 0.2], [0.55, Y + 1.5], [0.32, Y + 1.5]], d: [-0.07, 0.07], r3: [0, a, 0], m: 'hull2' })),
      ...[45, 135, 225, 315].map((a) => ({ t: 'box', s: [0.04, 0.5, 0.18], p: [Math.cos(a * D) * 0.62, Y + 1.2, -Math.sin(a * D) * 0.62], r3: [0, a, 0], m: 'glow' })),
    );
    // head: two counter-rotating halos + the flame orb (spins)
    head = [0, Y + 2.3, 0];
    ps.push(...G('head', [
      ...hoop(0, Y + 2.3, 0, 1.25, 16, 0.08, 0.12, 'accent'),
      ...hoop(0, Y + 2.75, 0, 0.85, 12, 0.07, 0.1, 'accent'),
      ...[0, 120, 240].map((a) => ({ t: 'box', s: [1.2, 0.04, 0.04], p: [Math.cos(a * D) * 0.68, Y + 2.3, -Math.sin(a * D) * 0.68], r3: [0, a, 0], m: 'accent' })),
      { t: 'ell', s: [0.3, 0.42, 0.3], seg: 10, p: [0, Y + 3.7, 0], m: 'glow' },
      { t: 'ell', s: [0.17, 0.26, 0.17], seg: 8, p: [0, Y + 4.25, 0], m: 'glow' },
    ]));
  } else {
    ps.push(
      { t: 'cyl', r: [0.75, 1.0], l: 0.55, seg: 12, p: [0, Y + 0.45, 0], m: 'hull2' },
      { t: 'cyl', r: 1.02, l: 0.06, seg: 12, p: [0, Y + 0.5, 0], m: 'accent' },
      { t: 'cyl', r: [0.22, 0.38], l: 1.9, seg: 8, p: [0, Y + 1.65, 0], m: 'hull' },
      ...[0, 1, 2, 3].map((i) => ({ t: 'cyl', r: 0.33 - i * 0.03, l: 0.05, seg: 8, p: [0, Y + 1.05 + i * 0.36, 0], m: 'glow' })),
      ...[30, 150, 270].flatMap((a) => {
        const c = Math.cos(a * D), s = -Math.sin(a * D);
        return [
          { t: 'box', s: [0.18, 1.6, 0.18], p: [c * 0.75, Y + 1.25, s * 0.75], r3: [0, a, -24], m: 'hull' },
          { t: 'box', s: [0.12, 0.4, 0.12], p: [c * 1.06, Y + 2.0, s * 1.06], r3: [0, a, -24], m: 'accent' },
          { t: 'ell', s: [0.14, 0.14, 0.14], seg: 8, p: [c * 1.12, Y + 2.25, s * 1.12], m: 'glow' },
        ];
      }),
      { t: 'ell', s: [0.42, 0.42, 0.42], seg: 12, p: [0, Y + 2.85, 0], m: 'glow' },
      { t: 'cyl', r: 0.3, l: 0.1, seg: 10, p: [0, Y + 2.55, 0], m: 'accent' },
    );
    head = [0, Y + 2.85, 0];
    ps.push(...G('head', [
      ...hoop(0, Y + 2.85, 0, 0.72, 12, 0.06, 0.08, 'accent'),
      ...[0, 180].map((a) => ({ t: 'box', s: [0.3, 0.05, 0.05], p: [Math.cos(a * D) * 0.55, Y + 2.85, 0], m: 'accent' })),
    ]));
  }
  return { parts: [...G('weapon', ps.filter((p) => p.g !== 'head')), ...ps.filter((p) => p.g === 'head')], head, spin: true };
}

// ── heads (group head; pivot = foot of the mast) ──────────────────────────────────────────────────────
function hDish([x, y, z], r = 0.36, mast = 0.32, tilt = 24) {
  const top = y + mast, c = Math.cos(tilt * D), s = Math.sin(tilt * D);
  return G('head', [
    { t: 'cyl', r: 0.09, l: 0.06, seg: 8, p: [x, y + 0.03, z], m: 'dark' },
    { t: 'cyl', r: 0.04, l: mast, seg: 6, p: [x, y + mast / 2, z], m: 'metal' },
    { t: 'box', s: [0.1, 0.08, 0.2], p: [x, top, z], m: 'dark' },
    { t: 'cyl', ax: 'x', r: [r, r * 0.3], l: r * 0.42, seg: 12, p: [x + 0.08, top + 0.05, z], r3: [0, 0, tilt], m: 'hull2' },
    { t: 'cyl', ax: 'x', r: r * 0.86, l: 0.015, seg: 12, p: [x + 0.08 + r * 0.21 * c, top + 0.05 + r * 0.21 * s, z], r3: [0, 0, tilt], m: 'dark' },
    { t: 'cyl', ax: 'x', r: 0.02, l: r * 0.9, seg: 5, p: [x + 0.08 + r * 0.55 * c, top + 0.05 + r * 0.55 * s, z], r3: [0, 0, tilt], m: 'metal', d: 1 },
    { t: 'cyl', ax: 'x', r: 0.04, l: 0.04, seg: 8, p: [x + 0.08 + r * c, top + 0.05 + r * s, z], r3: [0, 0, tilt], m: 'glow' },
    { t: 'box', s: [0.12, 0.1, 0.12], p: [x - 0.12, top - 0.02, z], m: 'hull' },
  ]);
}
function hBar([x, y, z], w = 0.8, mast = 0.24) {
  const top = y + mast;
  return G('head', [
    { t: 'cyl', r: 0.08, l: 0.05, seg: 8, p: [x, y + 0.025, z], m: 'dark' },
    { t: 'cyl', r: 0.035, l: mast, seg: 6, p: [x, y + mast / 2, z], m: 'metal' },
    { t: 'box', s: [0.09, 0.16, w], p: [x, top + 0.06, z], r3: [0, 0, -12], m: 'hull2' },
    { t: 'box', s: [0.012, 0.09, w * 0.9], p: [x + 0.05, top + 0.07, z], r3: [0, 0, -12], m: 'glow' },
  ]);
}
function hOptic([x, y, z], mast = 0.34) {
  return G('head', [
    { t: 'cyl', r: 0.06, l: mast, seg: 6, p: [x, y + mast / 2, z], m: 'dark' },
    { t: 'box', s: [0.42, 0.26, 0.28], p: [x + 0.02, y + mast + 0.1, z], m: 'hull2' },
    { t: 'box', s: [0.04, 0.2, 0.24], p: [x + 0.24, y + mast + 0.1, z], m: 'black' },
    { t: 'cyl', ax: 'x', r: 0.06, l: 0.03, seg: 8, p: [x + 0.26, y + mast + 0.13, z - 0.05], m: 'glowR' },
    { t: 'cyl', ax: 'x', r: 0.035, l: 0.03, seg: 8, p: [x + 0.26, y + mast + 0.07, z + 0.06], m: 'glow' },
  ]);
}
function hEye([x, y, z], mast = 0.6) {
  return G('head', [
    { t: 'cyl', r: [0.04, 0.09], l: mast, seg: 6, p: [x, y + mast / 2, z], m: 'hull2' },
    { t: 'ell', s: [0.24, 0.24, 0.24], seg: 10, p: [x, y + mast + 0.12, z], m: 'dark' },
    { t: 'ell', s: [0.12, 0.15, 0.15], seg: 10, p: [x + 0.15, y + mast + 0.12, z], m: 'glow' },
    ...[-1, 1].map((k) => ({ t: 'box', s: [0.05, 0.4, 0.05], p: [x - 0.05, y + mast + 0.34, z + k * 0.12], r3: [k * 20, 0, 18], m: 'hull2' })),
  ]);
}
function hSpore([x, y, z], mast = 0.45) {
  return G('head', [
    { t: 'cyl', r: [0.05, 0.1], l: mast, seg: 6, p: [x, y + mast / 2, z], m: 'hull2' },
    { t: 'ell', s: [0.3, 0.26, 0.3], seg: 10, p: [x, y + mast + 0.16, z], m: 'accent' },
    ...[0, 120, 240].map((a) => ({ t: 'ell', s: [0.12, 0.09, 0.12], seg: 8, p: [x + Math.cos(a * D) * 0.28, y + mast + 0.1, z - Math.sin(a * D) * 0.28], m: 'glow' })),
    { t: 'ell', s: [0.1, 0.12, 0.1], seg: 8, p: [x, y + mast + 0.4, z], m: 'glow' },
  ]);
}

// Uniformly scale parts about point O (sizes, radii, lengths, profiles, sections and positions).
// Geometry is built as R·g + p, so g scales about the world origin and p' = k·p + (1 − k)·O.
function scaleParts(ps, k, O) {
  const v = (a) => a * k, pt = (q) => q.map(v);
  return ps.map((q) => {
    const o = Object.assign({}, q), P = q.p || [0, 0, 0];
    o.p = P.map((c, i) => k * c + (1 - k) * O[i]);
    if (q.s) o.s = q.s.map(v);
    if (q.r != null) o.r = Array.isArray(q.r) ? q.r.map(v) : q.r * k;
    if (q.l != null) o.l = q.l * k;
    if (q.poly) o.poly = q.poly.map(pt);
    if (q.holes) o.holes = q.holes.map((h) => h.map(pt));
    if (q.secs) o.secs = q.secs.map(([at, pts]) => [at * k, pts.map(pt)]);
    if (Array.isArray(q.d)) o.d = q.d.map(v);
    return o;
  });
}
const scalePt = (h, k, O) => h.map((c, i) => O[i] + (c - O[i]) * k);

// ── assembly ──────────────────────────────────────────────────────────────────────────────────────────
const SHARED_PAL = { dark: '#3e434a', black: '#16181c', metal: '#7b828a', glass: '#1c2533', glowR: '#ff5a3a' };
function craft(key, o) {
  const H = o.hatch, k = o.wScale || 1.35, O = [0, o.roofY, 0];
  const W = Object.assign({}, o.weapon, { parts: scaleParts(o.weapon.parts, k, O), head: scalePt(o.weapon.head, k, O) });
  const bar = o.weapon.barrel ? { barrel: scalePt(o.weapon.barrel, k, O) } : {};
  const parts = [...o.parts, ...H.parts, ...W.parts, ...scaleParts(o.headParts || [], k, O)];
  const def = {
    key, name: o.name, faction: o.faction, factionName: o.factionName, weaponType: o.weaponType, blurb: o.blurb,
    footprint: [3, 3], unit: o.unit,
    palette: Object.assign({}, SHARED_PAL, o.palette),
    parts,
    pivots: Object.assign({ weapon: [0, o.roofY, 0], head: o.headPivot || W.head, gear: [0, 0, 0] }, bar, H.pivots),
    // a pitching gun: its muzzle (model point, level) and limits [MM-story_mvedy2wj_a]
    ...(o.weapon.barrel ? { muzzle: scalePt(o.weapon.muzzle, k, O), barrel: { min: 0, max: 60, rate: 1.2 }, recoil: (o.weapon.recoil || 0) * k } : {}),   // recoil: the shell gun only, not the railgun [MM-story_mvee15ja_b]
    head: o.headMode || { mode: 'sweep' },
    anim: { gear: { axis: 'y', retract: 1.15 }, doorR: { axis: 'x', open: H.open }, doorL: { axis: 'x', open: -H.open },
      hover: 9, approach: o.approach || 'side' },
    lift: o.lift || [], exhaust: o.exhaust || [],
    views: { side: 'right', top: 'up' },
  };
  M[key] = def;
}

// corner-pod builders (author the +Z pod; mir adds the -Z one)
function podOct(cx, cz, o = {}) {
  const h = o.h || 1.7, hz = o.hz || h, c = o.c || 0.55, y0 = o.y0 || 1.35, y1 = o.y1 || 3.3, tp = o.top || 0.72, m = o.m || 'hull';
  const ps = [
    { t: 'loft', ax: 'y', secs: [[y0 - 0.2, octP(cx, cz, h * 0.82, hz * 0.82, c * 0.8)], [y0 + 0.25, octP(cx, cz, h, hz, c)], [y1, octP(cx, cz, h, hz, c)], [y1 + (o.cap || 0.45), octP(cx, cz, h * tp, hz * tp, c * tp)]], m, mir: true },
  ];
  if (o.band !== false) ps.push({ t: 'loft', ax: 'y', secs: [[o.bandY || y0 + 1.0, octP(cx, cz, h + 0.04, hz + 0.04, c)], [(o.bandY || y0 + 1.0) + (o.bandH || 0.26), octP(cx, cz, h + 0.04, hz + 0.04, c)]], m: o.band || 'accent', mir: true });
  return ps;
}
// side hatch module (x -2..2, z 2..6)
function modBox(o = {}) {
  const z = o.z || 4, hw = o.hw || 2, y0 = o.y0 || 1.0, y1 = o.y1 || 4.15, ct = o.ct || 0.55, m = o.m || 'hull2', x0 = o.x0 || -1.98, x1 = o.x1 || 1.98;
  return [{ t: 'loft', ax: 'x', secs: [[x0, crect(z, hw * 0.94, y0 + 0.08, y1 - 0.12, ct * 0.9, 0.22)], [x0 + 0.22, crect(z, hw, y0, y1, ct, 0.25)], [x1 - 0.22, crect(z, hw, y0, y1, ct, 0.25)], [x1, crect(z, hw * 0.94, y0 + 0.08, y1 - 0.12, ct * 0.9, 0.22)]], m, mir: true }];
}
const rivets = (x0, x1, y, z, n, m = 'dark') => Array.from({ length: n }, (_, i) => ({ t: 'cyl', ax: 'z', r: 0.045, l: 0.04, seg: 6, p: [x0 + (x1 - x0) * i / (n - 1), y, z], m, mir: true, d: 1 }));

// ══════════════════════════════════════════════════════════════════════════════════════════════════════
// 0 · NEUTRAL — BS-7 "Pathfinder" (SYS, the beginner craft). White ceramic, orange + black diagonal livery,
//     corner pods, rear blue engine cluster, single cannon. The owner's reference sheet, closest to literal.
{
  const roof = 4.4;
  const parts = [
    { t: 'loft', ax: 'x', secs: [[-5.3, crect(0, 2.15, 1.05, 4.15, 0.6, 0.35)], [-4.9, crect(0, 2.3, 1.0, 4.4, 0.75, 0.4)], [2.2, crect(0, 2.3, 1.0, 4.4, 0.8, 0.4)], [4.6, crect(0, 2.05, 1.0, 3.35, 0.9, 0.4)], [5.9, crect(0, 1.45, 1.2, 2.05, 0.4, 0.3)]], m: 'hull' },
    // canopy
    { t: 'box', s: [2.25, 0.06, 1.7], p: [3.42, 3.92, 0], r3: [0, 0, -22.6], m: 'glass' },
    { t: 'box', s: [1.2, 0.06, 0.5], p: [3.6, 3.62, 1.35], r3: [-40, 0, -22.6], m: 'glass', mir: true },
    { t: 'box', s: [2.3, 0.08, 0.08], p: [3.42, 3.97, 0], r3: [0, 0, -22.6], m: 'dark' },
    { t: 'box', s: [0.08, 0.6, 2.4], p: [5.86, 1.62, 0], m: 'dark' },
    ...[-0.6, 0, 0.6].map((z) => ({ t: 'box', s: [0.04, 0.12, 0.4], p: [5.9, 1.62, z], m: 'glowB' })),
    { t: 'box', s: [0.4, 0.3, 0.06], p: [4.2, 2.3, 2.06], m: 'black', mir: true },
    // roof: bearing deck, livery stripes, vents
    ...bearing(roof),
    ...[-3.6, -2.7].map((x) => ({ t: 'box', s: [0.42, 0.04, 3.2], p: [x, roof + 0.01, 0], r3: [0, 32, 0], m: x < -3 ? 'stripe' : 'accent' })),
    ...[2.8].map((x) => ({ t: 'box', s: [0.45, 0.04, 2.6], p: [x - 1.4, roof + 0.01, 0], r3: [0, -32, 0], m: 'accent' })),
    { t: 'box', s: [1.1, 0.06, 0.8], p: [-4.3, roof + 0.02, 1.0], m: 'dark', mir: true, d: 1 },
    // rear engine block + three main engines
    { t: 'box', s: [0.3, 2.3, 3.6], p: [-5.35, 2.6, 0], m: 'hull2' },
    ...nozzle(-5.5, 2.0, 0, 0.55, 0.45), ...nozzle(-5.5, 3.2, 0.95, 0.45, 0.4, { mir: true }),
    // side modules + door hatches
    ...modBox({ m: 'hull' }),
    { t: 'box', s: [3.96, 0.16, 0.2], p: [0, 4.0, 5.98], m: 'accent', mir: true },
    // corner pods: front defense pods with twin guns; rear pods carry engines
    ...podOct(4.0, 4.0, { h: 1.7, band: 'accent' }), ...podOct(-3.8, 4.0, { h: 1.5, band: 'stripe' }),
    ...[0.25, -0.25].map((dz) => ({ t: 'cyl', ax: 'x', r: 0.09, l: 0.9, seg: 8, p: [6.0, 2.55, 4.0 + dz], m: 'dark', mir: true })),
    { t: 'box', s: [0.2, 0.5, 1.0], p: [5.75, 2.55, 4.0], m: 'hull2', mir: true },
    { t: 'box', s: [0.04, 0.08, 0.6], p: [5.72, 3.0, 4.0], m: 'glow', mir: true },
    { t: 'box', s: [0.35, 1.5, 0.03], p: [4.0, 2.4, 5.71], r3: [0, 0, -32], m: 'stripe', mir: true },
    { t: 'box', s: [0.35, 1.5, 0.03], p: [4.55, 2.4, 5.71], r3: [0, 0, -32], m: 'accent', mir: true },
    ...nozzle(-5.3, 2.4, 4.0, 0.5, 0.55, { mir: true }),
    { t: 'cyl', r: 0.4, l: 0.08, seg: 8, p: [-3.8, 3.78, 4.0], m: 'dark', mir: true, d: 1 },
    ...liftJet(4.0, 4.0, 1.15), ...liftJet(-3.8, 4.0, 1.15, 0.5),
    ...gearLeg(4.0, 4.0), ...gearLeg(-3.8, 4.0),
    { t: 'box', s: [0.8, 0.6, 0.04], p: [-0.2, 3.65, 2.31], m: 'dark', mir: true, d: 1 },
  ];
  const W = wCannon(roof);
  craft('lc_neutral', {
    name: 'BS-7 Pathfinder', faction: 'system', factionName: 'Neutral (System)', unit: 'SYS-LandingCraft', weaponType: 'cannon',
    blurb: 'The starter craft. Ceramic-white merchant hauler with the Bulwark orange-and-black livery and a single all-round cannon.',
    palette: { hull: '#dadde0', hull2: '#b8bec5', panel: '#c8cdd2', accent: '#ef7d22', stripe: '#1f2226', trim: '#ef7d22', glow: '#46f2ff', glowB: '#4aa8ff', glowE: '#5ab4ff' },
    roofY: roof, parts, weapon: W, headParts: hDish(W.head), headMode: { mode: 'spin', speed: 1.6 },
    hatch: hatches({ panel: 'hull2', inset: 'accent', bars: 'stripe', plate: 'stripe' }),
  });
}

// 1 · GROUND / POWDER — "Ironhoard" casemate. Olive drab slab armour, brass trim, oxblood banners, riveted
//     bunker cupolas at the corners, exhaust stacks; twin anti-troop rotary guns behind a raked shield.
{
  const roof = 4.1;
  const parts = [
    { t: 'loft', ax: 'x', secs: [[-5.4, crect(0, 2.2, 1.05, 3.9, 0.2, 0.3)], [-5.1, crect(0, 2.35, 1.0, 4.1, 0.25, 0.35)], [1.7, crect(0, 2.35, 1.0, 4.1, 0.25, 0.35)], [4.5, crect(0, 2.25, 1.0, 2.7, 0.3, 0.35)], [5.95, crect(0, 1.9, 1.1, 1.75, 0.15, 0.3)]], m: 'hull' },
    // glacis vision slits + armoured visor
    { t: 'box', s: [0.16, 0.12, 2.2], p: [2.55, 3.62, 0], r3: [0, 0, -28], m: 'glass' },
    { t: 'box', s: [0.5, 0.06, 2.6], p: [2.35, 3.86, 0], r3: [0, 0, -28], m: 'accent' },
    { t: 'box', s: [0.06, 0.5, 3.2], p: [5.94, 1.45, 0], m: 'dark' },
    ...[-0.9, 0.9].map((z) => ({ t: 'cyl', ax: 'x', r: 0.13, l: 0.1, seg: 8, p: [5.98, 1.75, z], m: 'amber' })),
    // crest plate on the glacis
    { t: 'ext', ax: 'z', poly: [[3.55, 3.15], [3.95, 2.95], [3.95, 2.75], [3.55, 2.95]], d: [-0.5, 0.5], m: 'accent' },
    { t: 'box', s: [0.06, 0.32, 0.12], p: [3.8, 3.0, 0], r3: [0, 0, -28], m: 'trim' },
    // roof: bearing, hatches, stowage, rivet lines
    ...bearing(roof),
    { t: 'box', s: [1.0, 0.1, 1.0], p: [-3.6, roof + 0.05, 0], m: 'hull2' },
    { t: 'cyl', r: 0.32, l: 0.12, seg: 8, p: [-3.6, roof + 0.16, 0], m: 'dark' },
    { t: 'box', s: [1.4, 0.3, 0.5], p: [-4.4, roof + 0.15, 1.5], m: 'panel', mir: true },
    ...rivets(-5.0, 1.6, 3.95, 2.36, 14),
    ...rivets(-5.0, 1.6, 1.25, 2.36, 14),
    // rear deck: exhaust stacks + engine grille
    ...[1.0].flatMap((z) => [
      { t: 'cyl', r: 0.24, l: 1.2, seg: 8, p: [-5.0, roof + 0.4, z], m: 'dark', mir: true },
      { t: 'cyl', r: 0.27, l: 0.12, seg: 8, p: [-5.0, roof + 1.0, z], m: 'accent', mir: true },
      { t: 'cyl', r: 0.17, l: 0.03, seg: 8, p: [-5.0, roof + 1.06, z], m: 'amber', mir: true },
    ]),
    { t: 'box', s: [0.12, 2.0, 2.6], p: [-5.46, 2.5, 0], m: 'dark' },
    ...[0, 1, 2, 3, 4].map((i) => ({ t: 'box', s: [0.05, 0.06, 2.4], p: [-5.53, 1.8 + i * 0.32, 0], m: 'black', d: 1 })),
    ...nozzle(-5.52, 1.55, 0.8, 0.38, 0.4, { mir: true }),
    // side casemates (hatch modules) with riveted skirts
    ...modBox({ m: 'hull', ct: 0.2, y1: 4.05 }),
    { t: 'box', s: [3.96, 0.3, 0.12], p: [0, 3.92, 6.02], m: 'panel', mir: true },
    ...rivets(-1.8, 1.8, 3.92, 6.09, 10),
    // bunker cupola pods (front) and engine pods (rear)
    ...podOct(4.0, 4.0, { h: 1.75, c: 0.35, y1: 3.0, cap: 0.25, top: 0.88, band: 'accent', bandH: 0.14, bandY: 2.7 }),
    { t: 'cyl', r: 0.85, l: 0.5, seg: 8, p: [4.0, 3.5, 4.0], m: 'hull2', mir: true },
    { t: 'cyl', r: [0.6, 0.85], l: 0.2, seg: 8, p: [4.0, 3.85, 4.0], m: 'hull', mir: true },
    ...[0, 45, -45, 90].map((a) => ({ t: 'box', s: [0.06, 0.08, 0.32], p: [4.0 + Math.cos(a * D) * 0.86, 3.52, 4.0 - Math.sin(a * D) * 0.86], r3: [0, a, 0], m: 'black', mir: true })),
    ...[0.3, -0.3].map((dz) => ({ t: 'cyl', ax: 'x', r: 0.08, l: 0.7, seg: 6, p: [6.05, 2.2, 4.0 + dz], m: 'dark', mir: true })),
    { t: 'box', s: [0.12, 0.45, 1.0], p: [5.78, 2.2, 4.0], m: 'accent', mir: true },
    ...podOct(-3.8, 4.0, { h: 1.55, c: 0.3, y1: 3.0, cap: 0.3, top: 0.8, band: 'accent', bandH: 0.14, bandY: 2.7 }),
    ...nozzle(-5.35, 2.15, 4.0, 0.48, 0.5, { mir: true, collar: 'accent' }),
    // banners at the rear corners
    { t: 'cyl', r: 0.04, l: 2.4, seg: 6, p: [-4.9, 4.4, 5.0], m: 'metal', mir: true },
    { t: 'cyl', r: 0.08, l: 0.1, seg: 6, p: [-4.9, 5.62, 5.0], m: 'accent', mir: true },
    { t: 'box', s: [0.9, 0.62, 0.03], p: [-5.38, 5.15, 5.0], m: 'trim', mir: true },
    { t: 'box', s: [0.9, 0.1, 0.035], p: [-5.38, 5.15, 5.0], m: 'accent', mir: true },
    ...liftJet(4.0, 4.0, 1.15), ...liftJet(-3.8, 4.0, 1.15, 0.5),
    ...gearLeg(4.0, 4.0, { pad: 0.6, padM: 'hull2' }), ...gearLeg(-3.8, 4.0, { pad: 0.6, padM: 'hull2' }),
  ];
  const W = wGatling(roof);
  craft('lc_ground', {
    name: 'Ironhoard Casemate', faction: 'ground', factionName: 'Ground / Powder', unit: 'GND-LandingCraft', weaponType: 'anti-troop gun',
    blurb: 'Old-empire armour: a riveted olive casemate, bunker cupolas, brass trim and the oxblood banner. Twin rotary guns hose down infantry.',
    palette: { hull: '#66704a', hull2: '#525b3b', panel: '#7a8458', accent: '#b8862e', stripe: '#d8cfae', trim: '#7e2219', glow: '#ffbf5a', glowE: '#ffa040', amber: '#ffb340' },
    roofY: roof, parts, weapon: W, headParts: hOptic(W.head), headMode: { mode: 'sweep' },
    hatch: hatches({ panel: 'hull2', inset: 'panel', bars: 'trim', plate: 'accent' }),
  });
}

// 2 · AIR — "Skylark" carrier. Ace-pilot white with sky-blue and racing red, a long bubble canopy, streamlined
//     nacelle pods with swept fins and tail fins, VTOL fans; an anti-aircraft missile battery on top.
{
  const roof = 4.2;
  const nac = (cx, len, r, y) => ({ t: 'loft', ax: 'x', secs: [
    [cx - len / 2, esec(4.0, r * 0.55, y, r * 0.5)], [cx - len / 2 + 0.5, esec(4.0, r, y, r * 0.92)], [cx + len / 2 - 1.0, esec(4.0, r, y, r * 0.92)], [cx + len / 2, esec(4.0, r * 0.35, y - 0.1, r * 0.3)]], m: 'hull', mir: true });
  const parts = [
    { t: 'loft', ax: 'x', secs: [[-5.4, esec(0, 1.7, 2.6, 1.3, 12, 0.7)], [-4.8, esec(0, 2.25, 2.7, 1.65, 12, 0.6)], [1.8, esec(0, 2.3, 2.75, 1.7, 12, 0.6)], [4.4, esec(0, 1.9, 2.4, 1.3, 12, 0.7)], [5.95, esec(0, 0.6, 1.9, 0.45, 12, 0.9)]], m: 'hull' },
    // long canopy
    { t: 'loft', ax: 'x', secs: [[0.6, esec(0, 0.65, 4.2, 0.35, 12)], [1.6, esec(0, 0.95, 4.2, 0.62, 12)], [3.4, esec(0, 0.85, 3.85, 0.55, 12)], [4.7, esec(0, 0.3, 3.4, 0.2, 12)]], m: 'glass' },
    { t: 'box', s: [3.4, 0.06, 0.08], p: [2.6, 4.62, 0], r3: [0, 0, -9], m: 'dark' },
    // racing stripes + red nose chevron
    { t: 'box', s: [7.0, 0.04, 0.32], p: [-1.5, 4.42, 1.05], r3: [8, 0, 0], m: 'accent', mir: true },
    { t: 'box', s: [1.2, 0.05, 0.25], p: [5.3, 2.55, 0.55], r3: [0, 32, -38], m: 'stripe', mir: true },
    { t: 'box', s: [0.06, 0.12, 0.9], p: [5.8, 1.75, 0], m: 'glow' },
    ...bearing(roof),
    { t: 'box', s: [3.0, 0.25, 4.2], p: [-0.3, roof - 0.1, 0], m: 'hull2' },
    // tail: twin canted fins
    { t: 'ext', ax: 'z', poly: [[-5.3, 0], [-3.4, 0], [-4.7, 1.7], [-5.5, 1.7]], d: [-0.07, 0.07], p: [0, 4.15, 0.45], r3: [14, 0, 0], m: 'hull', mir: true },
    { t: 'box', s: [0.85, 0.42, 0.17], p: [-5.06, 4.15 + 1.4 * Math.cos(14 * D), 0.45 + 1.4 * Math.sin(14 * D)], r3: [14, 0, 0], m: 'stripe', mir: true },
    // main engines
    ...nozzle(-5.4, 2.4, 0.75, 0.62, 0.5, { mir: true }),
    // side modules: smoothed hangar bays
    ...modBox({ m: 'hull', ct: 0.9, y1: 4.0 }),
    { t: 'box', s: [3.6, 0.1, 0.05], p: [0, 4.0, 5.9], m: 'accent', mir: true },
    // front nacelles (defense pods) + rear engine nacelles
    nac(4.0, 3.9, 1.35, 2.5), nac(-3.6, 4.2, 1.3, 2.5),
    { t: 'cyl', ax: 'x', r: 0.62, l: 0.12, seg: 12, p: [5.6, 2.45, 4.0], m: 'dark', mir: true },
    { t: 'cyl', ax: 'x', r: 0.1, l: 0.8, seg: 8, p: [6.0, 2.45, 4.0], m: 'metal', mir: true },
    { t: 'loft', ax: 'x', secs: [[3.4, esec(4.0, 1.37, 2.5, 1.26)], [3.65, esec(4.0, 1.37, 2.5, 1.26)]], m: 'accent', mir: true },
    { t: 'loft', ax: 'x', secs: [[-2.9, esec(4.0, 1.32, 2.5, 1.22)], [-2.65, esec(4.0, 1.32, 2.5, 1.22)]], m: 'stripe', mir: true },
    ...nozzle(-5.7, 2.45, 4.0, 0.62, 0.3, { mir: true }),
    // swept wing fins + tail fins on the nacelles
    { t: 'ext', ax: 'y', poly: [[4.6, 5.25], [5.3, 5.3], [3.9, 6.0], [3.4, 6.0]], d: [2.45, 2.55], m: 'hull2', mir: true },
    { t: 'box', s: [0.6, 0.11, 0.25], p: [3.65, 2.5, 5.88], m: 'accent', mir: true },
    { t: 'ext', ax: 'z', poly: [[-4.2, 3.6], [-3.0, 3.6], [-4.1, 4.85], [-4.8, 4.85]], d: [3.95, 4.05], m: 'hull', mir: true },
    { t: 'box', s: [0.75, 0.25, 0.12], p: [-4.45, 4.7, 4.0], m: 'stripe', mir: true },
    ...liftJet(4.0, 4.0, 1.25), ...liftJet(-3.6, 4.0, 1.25),
    ...gearLeg(4.0, 4.0, { top: 1.6 }), ...gearLeg(-3.6, 4.0, { top: 1.6 }),
  ];
  const W = wAA(roof);
  craft('lc_air', {
    name: 'Skylark Carrier', faction: 'air', factionName: 'Air', unit: 'AIR-LandingCraft', weaponType: 'anti-aircraft missiles',
    blurb: 'Ace-squadron carrier: white and sky blue with racing red, nacelle pods with swept fins. A twin-pod SAM battery owns the sky above it.',
    palette: { hull: '#eef2f6', hull2: '#cbd5df', panel: '#dfe6ee', accent: '#2f7fe0', stripe: '#e0383e', trim: '#e0383e', glow: '#7fe8ff', glowE: '#6fc8ff' },
    roofY: roof, parts, weapon: W, headParts: hBar(W.head, 0.9), headMode: { mode: 'spin', speed: 2.6 },
    hatch: hatches({ panel: 'hull2', inset: 'panel', bars: 'accent', plate: 'stripe' }),
  });
}

// 3 · HIGH TECH — "Sterling Vault". Graphite monolith wedge, gold trim, white light-lines, hexagonal pods;
//     a three-prong shield projector (the shield bubble is an effect, not geometry).
{
  const roof = 4.5;
  const hexP = (cx, cz, r) => ngon(cx, cz, r, 6, 0);
  const pod = (cx, r, y0, y1) => [
    { t: 'loft', ax: 'y', secs: [[y0 - 0.25, hexP(cx, 4.0, r * 0.8)], [y0 + 0.2, hexP(cx, 4.0, r)], [y1, hexP(cx, 4.0, r)], [y1 + 0.5, hexP(cx, 4.0, r * 0.55)]], m: 'hull', mir: true },
    { t: 'loft', ax: 'y', secs: [[y1 - 0.12, hexP(cx, 4.0, r + 0.03)], [y1, hexP(cx, 4.0, r + 0.03)]], m: 'accent', mir: true },
    { t: 'loft', ax: 'y', secs: [[y0 + 0.75, hexP(cx, 4.0, r + 0.02)], [y0 + 0.8, hexP(cx, 4.0, r + 0.02)]], m: 'glow', mir: true },
  ];
  const parts = [
    { t: 'loft', ax: 'x', secs: [[-5.4, crect(0, 2.2, 1.05, 4.3, 1.0, 0.3)], [-5.0, crect(0, 2.35, 1.0, 4.5, 1.1, 0.35)], [0.4, crect(0, 2.35, 1.0, 4.5, 1.1, 0.35)], [5.95, crect(0, 1.5, 1.0, 1.55, 0.3, 0.3)]], m: 'hull' },
    // glass ribbon along the wedge + gold spine
    { t: 'box', s: [4.0, 0.05, 1.6], p: [3.0, 3.06, 0], r3: [0, 0, -30.6], m: 'glass' },
    { t: 'box', s: [5.8, 0.06, 0.12], p: [2.6, 3.3, 0], r3: [0, 0, -30.6], m: 'accent' },
    { t: 'box', s: [5.2, 0.04, 0.05], p: [2.9, 2.55, 1.48], r3: [0, 0, -30.6], m: 'glow', mir: true },
    { t: 'box', s: [0.05, 0.05, 2.8], p: [5.96, 1.3, 0], m: 'glow' },
    // corporate mark: gold diamond on each flank
    { t: 'box', s: [0.55, 0.55, 0.04], p: [-3.3, 2.9, 2.36], r3: [0, 0, 45], m: 'accent', mir: true },
    { t: 'box', s: [0.32, 0.32, 0.05], p: [-3.3, 2.9, 2.37], r3: [0, 0, 45], m: 'stripe', mir: true },
    ...bearing(roof, 1.25),
    { t: 'box', s: [4.6, 0.04, 0.06], p: [-2.6, roof + 0.01, 1.2], m: 'glow', mir: true },
    // rear: flush engine slots
    { t: 'box', s: [0.25, 2.2, 3.8], p: [-5.45, 2.6, 0], m: 'hull2' },
    ...[1.7, 2.6, 3.5].map((y) => ({ t: 'box', s: [0.06, 0.3, 3.2], p: [-5.6, y, 0], m: 'glowE' })),
    ...modBox({ m: 'hull2', ct: 1.0, y1: 4.25 }),
    { t: 'box', s: [3.9, 0.05, 0.05], p: [0, 4.25, 5.6], m: 'accent', mir: true },
    ...pod(4.0, 1.85, 1.35, 3.3), ...pod(-3.8, 1.7, 1.35, 3.1),
    { t: 'box', s: [0.12, 0.6, 1.2], p: [5.62, 2.4, 4.0], m: 'black', mir: true },
    { t: 'box', s: [0.06, 0.06, 1.0], p: [5.7, 2.4, 4.0], m: 'glow', mir: true },
    ...nozzle(-5.2, 2.3, 4.0, 0.45, 0.6, { mir: true, m: 'accent', seg: 6 }),
    ...liftJet(4.0, 4.0, 1.12), ...liftJet(-3.8, 4.0, 1.12, 0.5),
    ...gearLeg(4.0, 4.0, { pad: 0.5 }), ...gearLeg(-3.8, 4.0, { pad: 0.5 }),
  ];
  const W = wShield(roof);
  craft('lc_hightech', {
    name: 'Sterling Vault', faction: 'hightech', factionName: 'High Tech', unit: 'HTC-LandingCraft', weaponType: 'shield',
    blurb: 'A graphite monolith in mega-corp gold. No guns on the roof — a three-prong projector throws a shield dome over the drop zone.',
    palette: { hull: '#2d3138', hull2: '#3c424b', panel: '#4a515b', accent: '#d9b25a', stripe: '#f2f2f2', trim: '#d9b25a', glow: '#fff1c4', glowE: '#ffe08a' },
    roofY: roof, parts, weapon: W, headParts: [], headMode: { mode: 'spin', speed: 1.2 },
    hatch: hatches({ panel: 'hull2', inset: 'panel', bars: 'accent', plate: 'stripe' }),
  });
}

// 4 · ARTILLERY — "Siegeworks" emplacement. Desert khaki, olive and black-yellow hazard; heavy angular plates,
//     sandbag-bulged roof, outrigger stabilizer legs, ammo crates; a four-tube mortar battery.
{
  const roof = 3.9;
  const parts = [
    { t: 'loft', ax: 'x', secs: [[-5.4, crect(0, 2.2, 1.05, 3.7, 0.4, 0.3)], [-5.0, crect(0, 2.35, 1.0, 3.9, 0.45, 0.35)], [2.4, crect(0, 2.35, 1.0, 3.9, 0.45, 0.35)], [4.2, crect(0, 2.3, 1.0, 3.1, 0.4, 0.35)], [5.9, crect(0, 2.0, 1.1, 2.3, 0.3, 0.3)]], m: 'hull' },
    { t: 'box', s: [1.4, 0.08, 2.4], p: [3.3, 3.53, 0], r3: [0, 0, -24], m: 'hull2' },
    { t: 'box', s: [0.12, 0.22, 2.0], p: [3.15, 3.5, 0], r3: [0, 0, -24], m: 'glass' },
    { t: 'box', s: [0.08, 0.7, 3.6], p: [5.9, 1.7, 0], m: 'stripe' },
    ...[-1.2, -0.4, 0.4, 1.2].map((z) => ({ t: 'box', s: [0.09, 0.7, 0.22], p: [5.92, 1.7, z], r3: [38, 0, 0], m: 'black' })),
    // sandbag bulges + crates on the roof
    ...[[-4.4, 1.2], [-3.4, 1.4], [2.1, 1.3], [2.0, -1.5], [-4.2, -1.3]].map(([x, z]) => ({ t: 'ell', s: [0.55, 0.22, 0.38], seg: 8, p: [x, roof + 0.05, z], m: 'panel', d: 1 })),
    { t: 'box', s: [0.8, 0.45, 0.6], p: [-4.4, roof + 0.22, 0], m: 'trim' },
    { t: 'box', s: [0.82, 0.06, 0.62], p: [-4.4, roof + 0.3, 0], m: 'accent' },
    ...bearing(roof),
    { t: 'box', s: [0.2, 2.2, 3.2], p: [-5.45, 2.4, 0], m: 'hull2' },
    ...nozzle(-5.55, 1.7, 0.85, 0.42, 0.35, { mir: true }),
    // side modules + hazard skirts
    ...modBox({ m: 'hull', ct: 0.4, y1: 3.95 }),
    ...[-1.5, -0.5, 0.5, 1.5].map((x) => ({ t: 'box', s: [0.3, 0.14, 0.04], p: [x, 3.86, 6.02], r3: [0, 0, 38], m: 'black', mir: true })),
    { t: 'box', s: [3.96, 0.14, 0.03], p: [0, 3.86, 6.01], m: 'stripe', mir: true },
    // corner pods: squat heavy blocks; rear ones carry engines
    ...podOct(4.0, 4.0, { h: 1.8, c: 0.45, y1: 2.9, cap: 0.35, top: 0.78, band: 'stripe', bandY: 2.4, bandH: 0.22 }),
    ...podOct(-3.8, 4.0, { h: 1.6, c: 0.45, y1: 2.9, cap: 0.35, top: 0.78, band: 'stripe', bandY: 2.4, bandH: 0.22 }),
    ...[-0.35, 0, 0.35].map((dz) => ({ t: 'box', s: [0.08, 0.24, 0.22], p: [5.82, 2.52, 4.0 + dz], r3: [38, 0, 0], m: 'black', mir: true })),
    { t: 'box', s: [0.2, 0.25, 1.2], p: [5.8, 1.85, 4.0], m: 'hull2', mir: true },
    { t: 'cyl', ax: 'x', r: 0.1, l: 0.04, seg: 8, p: [5.92, 1.85, 4.4], m: 'glowR', mir: true },
    ...nozzle(-5.4, 2.0, 4.0, 0.45, 0.45, { mir: true }),
    // ammo crates on the pods
    { t: 'box', s: [0.9, 0.42, 0.6], p: [4.0, 3.45, 4.2], m: 'trim', mir: true },
    { t: 'box', s: [0.92, 0.05, 0.62], p: [4.0, 3.55, 4.2], m: 'accent', mir: true },
    { t: 'box', s: [0.7, 0.36, 0.5], p: [-3.8, 3.42, 3.9], m: 'trim', mir: true },
    ...liftJet(4.0, 4.0, 1.12), ...liftJet(-3.8, 4.0, 1.12, 0.5),
    // stabilizer outriggers (splayed gear) — the gun-platform look
    ...gearLeg(4.0, 4.0, { pad: 0.7, splay: 0.6, padM: 'stripe' }), ...gearLeg(-3.8, 4.0, { pad: 0.7, splay: 0.6, padM: 'stripe' }),
  ];
  const W = wMortar(roof);
  craft('lc_artillery', {
    name: 'Siegeworks Emplacement', faction: 'artillery', factionName: 'Artillery', unit: 'ART-LandingCraft', weaponType: 'mortar',
    blurb: 'A landing gun-pit: khaki armour, hazard skirts, splayed stabilizer legs and a four-tube mortar battery lobbing over the walls.',
    palette: { hull: '#b39a6c', hull2: '#9a8257', panel: '#c8b080', accent: '#4b5636', stripe: '#e8c02a', trim: '#5c6640', glow: '#ffb35a', glowE: '#ff8a3a' },
    roofY: roof, parts, weapon: W, headParts: hBar(W.head, 0.8), headMode: { mode: 'sweep' },
    hatch: hatches({ panel: 'hull2', inset: 'stripe', bars: 'black', plate: 'accent' }),
  });
}

// 5 · WATER — "Tideborn Ark" (v3: one hull + steampunk bridge, portholes, brass fittings). Sea-tribe teal with coral and pearl. A single nautilus-shell hull
//     covers the whole 3 × 3: flat flanks for the hatches, the shell swelling to a ridge, pearl growth ribs across
//     the back, a keel and dorsal fin. The corner defense pods are now blisters grown out of the shell.
{
  const roof = 4.75;
  // shell cross-section (17 pts): flat bottom, vertical flank to ys, superelliptic shoulder up to the ridge yt
  const shellSec = (hw, y0, ys, yt, cb = 0.45, k = 5, sq = 0.7) => {
    const P = [[-hw + cb, y0], [hw - cb, y0], [hw, y0 + cb], [hw, ys]];
    const arc = (i) => { const a = i / (k + 1) * Math.PI / 2; return [hw * Math.pow(Math.cos(a), sq), ys + (yt - ys) * Math.pow(Math.sin(a), sq)]; };
    for (let i = 1; i <= k; i++) P.push(arc(i));
    P.push([0, yt]);
    for (let i = k; i >= 1; i--) { const [u, v] = arc(i); P.push([-u, v]); }
    P.push([-hw, ys], [-hw, y0 + cb]);
    return P;
  };
  // hull stations along X: [x, half-width, bottom, flank top, ridge]
  const ST = [[-5.97, 4.3, 1.25, 2.5, 3.4], [-5.55, 5.45, 1.05, 3.35, 4.2], [-4.4, 5.95, 1.0, 4.05, 4.55], [-2.3, 6.0, 1.0, 4.3, 4.62],
    [2.3, 6.0, 1.0, 4.3, 4.62], [4.3, 5.8, 1.0, 3.65, 4.4], [5.4, 4.85, 1.05, 2.85, 3.65], [5.97, 3.1, 1.25, 2.1, 2.7]];
  const at = (x) => { let i = 0; while (i < ST.length - 2 && x > ST[i + 1][0]) i++; const A = ST[i], B = ST[i + 1], t = (x - A[0]) / (B[0] - A[0]); return A.map((v, j) => v + (B[j] - v) * t); };
  const rib = (x, w = 0.16, grow = 0.05) => { const a = at(x - w / 2), b = at(x + w / 2);
    return { t: 'loft', ax: 'x', secs: [[x - w / 2, shellSec(a[1] + grow, a[2] - 0.02, a[3], a[4] + grow)], [x + w / 2, shellSec(b[1] + grow, b[2] - 0.02, b[3], b[4] + grow)]], m: 'stripe' }; };
  // wheelhouse stations: [x, half-width, centre y, half-height] — its lower half is buried in the shell
  const WH = [[2.5, 0.9, 4.5, 0.55], [2.95, 1.3, 4.72, 0.95], [4.3, 1.26, 4.62, 0.9], [5.05, 0.86, 4.28, 0.62], [5.2, 0.45, 4.1, 0.34]];
  const whAt = (x) => { let i = 0; while (i < WH.length - 2 && x > WH[i + 1][0]) i++; const A = WH[i], B = WH[i + 1], t = (x - A[0]) / (B[0] - A[0]); return A.map((v, j) => v + (B[j] - v) * t); };
  const whBand = (x, w = 0.07) => { const [, hw, cy, hh] = whAt(x), [, hw2, cy2, hh2] = whAt(x + w);
    return { t: 'loft', ax: 'x', secs: [[x, esec(0, hw + 0.06, cy, hh + 0.06, 14, 0.85)], [x + w, esec(0, hw2 + 0.06, cy2, hh2 + 0.06, 14, 0.85)]], m: 'brass' }; };
  // pipe along the +Z flank through [x, y] points, standing just off the hull; ring of boxes in the YZ plane
  const pipe = (pts, w) => [
    ...pts.slice(1).map((q, i) => strut([pts[i][0], pts[i][1], at(pts[i][0])[1] + 0.12], [q[0], q[1], at(q[0])[1] + 0.12], w, w, 'brass', { mir: true })),
    ...pts.map(([x, y]) => ({ t: 'cyl', ax: 'x', r: w * 0.95, l: 0.12, seg: 8, p: [x, y, at(x)[1] + 0.12], m: 'dark', mir: true, d: 1 })),
  ];
  const ringX = (x, cy, cz, r, n = 14) => Array.from({ length: n }, (_, i) => { const a = (i + 0.5) / n * 360;
    return { t: 'box', s: [0.32, 0.09, 2 * r * Math.tan(Math.PI / n) * 1.04], p: [x, cy + Math.cos(a * D) * r, cz + Math.sin(a * D) * r], r3: [a, 0, 0], m: 'brass', mir: true }; });
  const parts = [
    { t: 'loft', ax: 'x', secs: ST.map(([x, hw, y0, ys, yt]) => [x, shellSec(hw, y0, ys, yt)]), m: 'hull' },
    // pearl growth ribs, closer together toward the bow and stern like a shell's growth lines
    ...[-5.2, -4.3, -3.4, -2.42, 2.42, 3.35, 4.2, 4.95].map((x) => rib(x)),
    // keel + belly plate
    { t: 'ext', ax: 'z', poly: [[-5.3, 1.05], [5.0, 1.05], [5.95, 1.6], [5.0, 0.85], [-4.6, 0.85]], d: [-0.16, 0.16], m: 'accent' },
    { t: 'box', s: [9.0, 0.06, 6.0], p: [-0.3, 0.98, 0], m: 'hull2' },
    // ── STEAMPUNK BRIDGE: brass-ribbed wheelhouse with a glass bathysphere nose (the cockpit) ──
    { t: 'loft', ax: 'x', secs: WH.map(([x, hw, cy, hh]) => [x, esec(0, hw, cy, hh, 14, 0.85)]), m: 'hull2' },
    { t: 'loft', ax: 'x', secs: [3.95, 4.3, 4.7, 5.0, 5.13].map((x) => { const [, hw, cy, hh] = whAt(x); return [x, esec(0, hw + 0.025, cy, hh + 0.025, 14, 0.85)]; }), m: 'glass' },
    ...[3.95, 4.35, 4.72, 5.02].map((x) => whBand(x)),
    { t: 'box', s: [1.3, 0.05, 0.1], p: [4.45, 5.42, 0], r3: [0, 0, -20], m: 'brass' },
    { t: 'box', s: [1.0, 0.05, 0.1], p: [4.45, 5.08, 1.02], r3: [-45, 0, -20], m: 'brass', mir: true, d: 1 },
    { t: 'box', s: [1.2, 0.08, 2.0], p: [3.25, 5.64, 0], m: 'brass' },
    ...Array.from({ length: 7 }, (_, i) => ({ t: 'cyl', ax: 'z', r: 0.04, l: 0.03, seg: 6, p: [2.95 + i * 0.13, 4.62, 1.34], m: 'brass', mir: true, d: 1 })),
    // searchlight + periscope on the wheelhouse roof
    { t: 'cyl', r: 0.12, l: 0.3, seg: 8, p: [3.0, 5.8, 0.55], m: 'brass' },
    { t: 'cyl', ax: 'x', r: [0.22, 0.17], l: 0.36, seg: 10, p: [3.1, 6.07, 0.55], m: 'brass' },
    { t: 'cyl', ax: 'x', r: 0.16, l: 0.03, seg: 10, p: [3.29, 6.07, 0.55], m: 'amber' },
    { t: 'cyl', r: 0.05, l: 0.75, seg: 6, p: [3.0, 6.0, -0.5], m: 'metal' },
    { t: 'box', s: [0.26, 0.12, 0.12], p: [3.08, 6.39, -0.5], m: 'brass' },
    // bow observation window: brass-rimmed porthole with spokes and bolts (Nautilus salon)
    { t: 'cyl', ax: 'x', r: 0.66, l: 0.12, seg: 16, p: [5.9, 2.15, 0], r3: [0, 0, -14], m: 'brass' },
    { t: 'cyl', ax: 'x', r: 0.54, l: 0.04, seg: 16, p: [5.97, 2.15, 0], r3: [0, 0, -14], m: 'amber' },
    ...[0, 30, 60, 90, 120, 150].map((a) => ({ t: 'box', s: [0.04, 1.08, 0.05], p: [5.99, 2.15, 0], r3: [a, 0, -14], m: 'brass' })),
    { t: 'cyl', ax: 'x', r: 0.13, l: 0.06, seg: 10, p: [6.0, 2.15, 0], r3: [0, 0, -14], m: 'brass' },
    ...Array.from({ length: 12 }, (_, i) => { const a = i * 30 * D; return { t: 'cyl', ax: 'x', r: 0.035, l: 0.04, seg: 6, p: [5.97, 2.15 + Math.cos(a) * 0.6, Math.sin(a) * 0.6], m: 'dark', d: 1 }; }),
    // portholes along the flanks (amber, lit from inside)
    ...[-4.7, -3.95, -3.2, 2.95, 3.7].flatMap((x) => { const z = at(x)[1]; return [
      { t: 'cyl', ax: 'z', r: 0.3, l: 0.08, seg: 12, p: [x, 3.05, z + 0.02], m: 'brass', mir: true },
      { t: 'cyl', ax: 'z', r: 0.21, l: 0.06, seg: 12, p: [x, 3.05, z + 0.05], m: 'amber', mir: true },
      { t: 'box', s: [0.02, 0.42, 0.05], p: [x, 3.05, z + 0.07], m: 'brass', mir: true, d: 1 },
    ]; }),
    // brass steam pipes along both flanks, with joints
    ...pipe([[-5.35, 3.8], [-4.5, 3.8], [-2.55, 3.8]], 0.12), ...pipe([[2.55, 3.55], [4.1, 3.5], [5.05, 2.95]], 0.12),
    ...pipe([[-2.55, 3.8], [-2.55, 1.55]], 0.11), ...pipe([[2.55, 3.55], [2.55, 1.55]], 0.11),
    // rivet rows along the waterline
    ...[[-5.1, -2.6], [2.6, 5.0]].flatMap(([a, b]) => Array.from({ length: 12 }, (_, i) => { const x = a + (b - a) * i / 11; return { t: 'cyl', ax: 'z', r: 0.045, l: 0.04, seg: 6, p: [x, 1.6, at(x)[1] + 0.01], m: 'brass', mir: true, d: 1 }; })),
    // pressure gauges either side of each hatch
    ...[-2.22, 2.22].flatMap((x) => [
      { t: 'cyl', ax: 'z', r: 0.2, l: 0.05, seg: 12, p: [x, 3.35, 6.03], m: 'brass', mir: true },
      { t: 'cyl', ax: 'z', r: 0.16, l: 0.03, seg: 12, p: [x, 3.35, 6.06], m: 'stripe', mir: true },
      { t: 'box', s: [0.025, 0.14, 0.02], p: [x + 0.03, 3.39, 6.08], r3: [0, 0, -35], m: 'dark', mir: true, d: 1 },
    ]),
    // ventilator cowls behind the launcher
    ...[[-3.0, 1.75]].flatMap(([x, z]) => [
      { t: 'cyl', r: 0.15, l: 0.85, seg: 8, p: [x, 4.85, z], m: 'brass', mir: true },
      { t: 'cyl', ax: 'x', r: [0.34, 0.22], l: 0.42, seg: 10, p: [x + 0.12, 5.38, z], r3: [0, 0, 12], m: 'brass', mir: true },
      { t: 'cyl', ax: 'x', r: 0.27, l: 0.02, seg: 10, p: [x + 0.34, 5.43, z], r3: [0, 0, 12], m: 'black', mir: true },
    ]),
    // stern drive shrouds: brass rings and vanes around the centre engines
    ...ringX(-5.98, 2.35, 0.85, 0.66), ...[0, 90].map((a) => ({ t: 'box', s: [0.06, 1.3, 0.05], p: [-5.98, 2.35, 0.85], r3: [a, 0, 0], m: 'brass', mir: true })),
    // dorsal fin with pearl rays
    { t: 'ext', ax: 'z', poly: [[-5.55, 3.9], [-2.6, 4.45], [-3.9, 6.15], [-5.0, 5.85]], d: [-0.09, 0.09], m: 'accent' },
    ...[-4.75, -4.25, -3.75].map((x, i) => ({ t: 'box', s: [0.06, 1.35 - i * 0.22, 0.2], p: [x, 4.95 - i * 0.02, 0], r3: [0, 0, 24], m: 'stripe', d: 1 })),
    // swept stern fins
    { t: 'ext', ax: 'y', poly: [[-4.1, 5.0], [-3.1, 5.25], [-5.0, 6.15], [-5.8, 6.05]], d: [2.25, 2.37], m: 'accent', mir: true },
    // roof: shell plinth for the launcher
    { t: 'cyl', r: [1.45, 1.7], l: 0.42, seg: 12, p: [0, roof - 0.21, 0], m: 'hull2' },
    { t: 'cyl', r: 1.72, l: 0.1, seg: 12, p: [0, roof - 0.38, 0], m: 'accent' },
    ...bearing(roof),
    // coral spines along the shoulders, over the hatches
    ...[-1.3, 0, 1.3].map((x, i) => ({ t: 'cyl', r: [0.02, 0.17], l: 0.8 + (i === 1 ? 0.35 : 0), seg: 6, p: [x, 4.75, 5.15], r3: [-28, 0, i === 1 ? 0 : -x * 14], m: 'accent', mir: true })),
    // bioluminescent spots along the flanks
    ...[-5.0, -3.8, 3.8, 4.8].map((x) => ({ t: 'ell', s: [0.14, 0.14, 0.06], seg: 8, p: [x, 2.6, at(x)[1] + 0.01], m: 'glow', mir: true, d: 1 })),
    // front defense blisters grown from the shell: harpoon guns, coral crown
    { t: 'ell', s: [1.05, 0.62, 1.05], seg: 12, p: [4.1, 4.05, 4.0], m: 'hull2', mir: true },
    { t: 'cyl', r: 1.07, l: 0.1, seg: 12, p: [4.1, 4.05, 4.0], m: 'accent', mir: true },
    ...[0.24, -0.24].map((dz) => ({ t: 'cyl', ax: 'x', r: 0.085, l: 1.3, seg: 8, p: [5.05, 4.2, 4.0 + dz], m: 'dark', mir: true })),
    ...[0.24, -0.24].map((dz) => ({ t: 'cyl', ax: 'x', r: [0.02, 0.1], l: 0.3, seg: 6, p: [5.85, 4.2, 4.0 + dz], m: 'stripe', mir: true })),
    ...[[4.1, 4.75, 4.0, 0, 0], [3.6, 4.55, 4.55, -25, 15], [4.6, 4.55, 4.55, -25, -15]].map(([x, y, z, a, b]) => ({ t: 'cyl', r: [0.02, 0.15], l: 0.75, seg: 6, p: [x, y, z], r3: [a, 0, b], m: 'accent', mir: true })),
    // rear blisters over the stern engines
    { t: 'ell', s: [0.85, 0.5, 0.85], seg: 12, p: [-4.0, 3.95, 4.0], m: 'hull2', mir: true },
    { t: 'cyl', r: [0.02, 0.14], l: 0.7, seg: 6, p: [-4.0, 4.5, 4.0], m: 'accent', mir: true },
    // engines: two in the stern centre, one under each rear blister
    ...nozzle(-5.75, 2.35, 0.85, 0.5, 0.35, { mir: true, collar: 'accent' }),
    ...nozzle(-5.45, 2.2, 4.0, 0.42, 0.4, { mir: true, collar: 'accent' }),
    ...liftJet(4.0, 4.0, 1.02), ...liftJet(-3.8, 4.0, 1.02, 0.5),
    ...gearLeg(4.0, 4.0, { top: 1.3, padM: 'accent' }), ...gearLeg(-3.8, 4.0, { top: 1.3, padM: 'accent' }),
  ];
  const W = wRockets(roof, { body: 'stripe', nose: 'accent' });
  craft('lc_water', {
    name: 'Tideborn Ark', faction: 'water', factionName: 'Water', unit: 'WTR-LandingCraft', weaponType: 'rocket launcher',
    blurb: 'A sea-tribe ark grown as one nautilus shell and fitted out in brass: ribbed wheelhouse with a glass bathysphere nose, a bow salon window, amber portholes, steam pipes and vent cowls. Harpoon rockets ride an open rack.',
    palette: { hull: '#2f7d86', hull2: '#25646c', panel: '#3a909a', accent: '#e07a52', stripe: '#efe4c8', trim: '#e07a52', brass: '#e2b24c', glass: '#2c6170', glow: '#5ff0e0', glowE: '#5ae8ff', amber: '#ffbf5a' },
    roofY: roof, parts, weapon: W, headParts: hDish(W.head, 0.32, 0.3), headMode: { mode: 'sweep' },
    hatch: hatches({ panel: 'hull2', inset: 'panel', bars: 'brass', plate: 'brass', frame: 'brass' }),
  });
}

// 6 · ARCANE / ENERGY — "Sanctum of the Flame" (v2, one cathedral). Ivory and gold with crimson. A single
//     cruciform basilica on one undercroft: the nave runs bow to stern, the transept crosses the middle row and
//     its gable ends ARE the resource portals, aisles with a crimson hipped roof wrap all round, corner turrets
//     and flying buttresses are bonded into the walls; the halo spire rises from the crossing tower.
{
  const roof = 5.1;
  const turret = (cx, cz, r, top, sp) => [
    { t: 'loft', ax: 'y', secs: [[2.0, ngon(cx, cz, r, 8, 22.5)], [top, ngon(cx, cz, r, 8, 22.5)], [top + 0.12, ngon(cx, cz, r * 1.12, 8, 22.5)], [top + 0.26, ngon(cx, cz, r * 0.78, 8, 22.5)], [top + sp, ngon(cx, cz, 0.04, 8, 22.5)]], m: 'hull', mir: true },
    { t: 'loft', ax: 'y', secs: [[top, ngon(cx, cz, r + 0.04, 8, 22.5)], [top + 0.12, ngon(cx, cz, r * 1.16, 8, 22.5)]], m: 'accent', mir: true },
    ...[0, 90].map((a) => ({ t: 'ext', ax: 'z', poly: [[-0.17, 2.55], [0.17, 2.55], [0.17, 3.15], [0, 3.38], [-0.17, 3.15]], d: [-0.03, 0.03],
      p: [cx + Math.cos(a * D) * r * 0.93, 0, cz + Math.sin(a * D) * r * 0.93], r3: [0, 90 - a, 0], m: 'glow', mir: true })),
    { t: 'ell', s: [0.11, 0.11, 0.11], seg: 8, p: [cx, top + sp + 0.07, cz], m: 'glow', mir: true },
  ];
  // a lancet window: x-facing (on an X wall) or z-facing (on a Z wall)
  const lancetZ = (x, z, w = 0.2) => ({ t: 'ext', ax: 'z', poly: [[x - w, 2.3], [x + w, 2.3], [x + w, 2.75], [x, 2.98], [x - w, 2.75]], d: [z, z + 0.03], m: 'glow', mir: true });
  const lancetX = (x, z, w = 0.2) => ({ t: 'ext', ax: 'x', poly: [[z - w, 2.3], [z + w, 2.3], [z + w, 2.75], [z, 2.98], [z - w, 2.75]], d: x > 0 ? [x, x + 0.03] : [x - 0.03, x], m: 'glow', mir: true });
  const flyer = (x) => [
    { t: 'box', s: [0.38, 1.85, 0.38], p: [x, 2.95, 5.5], m: 'hull2', mir: true },
    { t: 'cyl', r: [0.02, 0.2], l: 0.65, seg: 8, p: [x, 4.2, 5.5], m: 'accent', mir: true },
    strut([x, 3.7, 5.4], [x, 4.15, 2.3], 0.16, 0.24, 'hull2', { mir: true }),
  ];
  const roofPlane = (cx, cy, cz, len, wid, rx, rz, m = 'stripe') => ({ t: 'box', s: [len, 0.07, wid], p: [cx, cy, cz], r3: [rx, 0, rz], m });
  const parts = [
    // undercroft: one plinth under the whole craft, chamfered corners, gold cornice
    { t: 'loft', ax: 'y', secs: [[0.95, octP(0, 0, 5.75, 5.75, 1.7)], [1.15, octP(0, 0, 5.95, 5.95, 1.76)], [1.9, octP(0, 0, 5.95, 5.95, 1.76)], [2.08, octP(0, 0, 5.7, 5.7, 1.68)]], m: 'hull2' },
    { t: 'loft', ax: 'y', secs: [[1.84, octP(0, 0, 6.0, 6.0, 1.78)], [1.96, octP(0, 0, 6.0, 6.0, 1.78)]], m: 'accent' },
    ...[-4.4, -3.0, -1.6, 1.6, 3.0, 4.4].map((x) => ({ t: 'box', s: [0.5, 0.42, 0.04], p: [x, 1.45, 5.96], m: 'dark', mir: true, d: 1 })),
    // aisle walls all round + crimson hipped aisle roof
    { t: 'loft', ax: 'y', secs: [[2.0, octP(0, 0, 5.6, 5.6, 1.65)], [3.05, octP(0, 0, 5.6, 5.6, 1.65)]], m: 'hull' },
    { t: 'loft', ax: 'y', secs: [[3.0, octP(0, 0, 5.78, 5.78, 1.72)], [3.1, octP(0, 0, 5.78, 5.78, 1.72)], [3.9, octP(0, 0, 3.4, 3.4, 0.95)]], m: 'stripe' },
    { t: 'loft', ax: 'y', secs: [[2.98, octP(0, 0, 5.8, 5.8, 1.73)], [3.06, octP(0, 0, 5.8, 5.8, 1.73)]], m: 'accent' },
    // nave, bow to stern, with a proper west front at the bow
    { t: 'loft', ax: 'x', secs: [[-5.55, arch(0, 2.3, 1.0, 4.1, 0.9)], [5.45, arch(0, 2.3, 1.0, 4.1, 0.9)], [5.78, arch(0, 2.1, 1.0, 3.95, 0.82)]], m: 'hull' },
    roofPlane(-0.05, 4.6, 1.38, 11.0, 2.06, 26.6, 0), roofPlane(-0.05, 4.6, -1.38, 11.0, 2.06, -26.6, 0),
    { t: 'box', s: [11.2, 0.1, 0.22], p: [0, 5.04, 0], m: 'accent' },
    // transept across the middle row; its gables at Z = ±6 carry the resource portals
    { t: 'loft', ax: 'z', secs: [[-6.0, arch(0, 2.0, 1.0, 4.3, 0.75)], [6.0, arch(0, 2.0, 1.0, 4.3, 0.75)]], m: 'hull' },
    roofPlane(1.23, 4.72, 0, 1.78, 12.08, 0, -25.7), roofPlane(-1.23, 4.72, 0, 1.78, 12.08, 0, 25.7),
    ...[1, -1].map((s) => ({ t: 'box', s: [1.9, 0.1, 0.14], p: [s * 1.2, 4.72, 6.03], r3: [0, 0, -s * 25.7], m: 'accent', mir: true })),
    { t: 'cyl', r: [0.02, 0.16], l: 0.6, seg: 8, p: [0, 5.35, 6.0], m: 'accent', mir: true },
    { t: 'ell', s: [0.36, 0.36, 0.05], seg: 12, p: [0, 4.62, 6.02], m: 'glow', mir: true },
    // west front: rose window, gold tracery, lancet "cockpit" glass, flanking pinnacles
    { t: 'cyl', ax: 'x', r: 0.72, l: 0.08, seg: 14, p: [5.8, 3.35, 0], m: 'accent' },
    { t: 'cyl', ax: 'x', r: 0.6, l: 0.06, seg: 14, p: [5.83, 3.35, 0], m: 'glow' },
    ...[0, 45, 90, 135].map((a) => ({ t: 'box', s: [0.03, 1.2, 0.07], p: [5.87, 3.35, 0], r3: [a, 0, 0], m: 'accent', d: 1 })),
    { t: 'ext', ax: 'x', poly: [[-0.55, 1.4], [0.55, 1.4], [0.55, 2.15], [0, 2.5], [-0.55, 2.15]], d: [5.78, 5.83], m: 'glass' },
    { t: 'ext', ax: 'x', poly: [[-0.68, 1.3], [0.68, 1.3], [0.68, 2.2], [0, 2.62], [-0.68, 2.2]], d: [5.77, 5.8], m: 'accent' },
    ...[1].map((z) => ({ t: 'box', s: [0.32, 3.4, 0.32], p: [5.72, 2.75, z * 2.25], m: 'hull2', mir: true })),
    { t: 'cyl', r: [0.02, 0.22], l: 1.0, seg: 8, p: [5.72, 4.95, 2.25], m: 'accent', mir: true },
    // crossing tower (the weapon's plinth) with lancets and a gold band
    { t: 'loft', ax: 'y', secs: [[4.3, ngon(0, 0, 1.6, 8, 22.5)], [roof - 0.12, ngon(0, 0, 1.5, 8, 22.5)], [roof, ngon(0, 0, 1.42, 8, 22.5)]], m: 'hull2' },
    { t: 'loft', ax: 'y', secs: [[roof - 0.24, ngon(0, 0, 1.54, 8, 22.5)], [roof - 0.12, ngon(0, 0, 1.53, 8, 22.5)]], m: 'accent' },
    ...[45, 135, 225, 315].map((a) => ({ t: 'box', s: [0.04, 0.42, 0.2], p: [Math.cos(a * D) * 1.53, 4.72, -Math.sin(a * D) * 1.53], r3: [0, a, 0], m: 'glow' })),
    ...bearing(roof, 1.15),
    // corner turrets bonded into the aisle walls
    ...turret(4.25, 4.25, 0.85, 3.85, 1.65), ...turret(-4.1, 4.1, 0.8, 3.7, 1.35),
    // flying buttresses from the aisle wall to the nave, and lancet windows between them
    ...flyer(-3.0), ...flyer(3.0),
    ...[-4.3, -2.35, 2.35, 3.65].map((x) => lancetZ(x, 5.6)),
    ...[3.0].flatMap((z) => [lancetX(5.6, z), lancetX(-5.6, z)]),
    // stern: censer engines set in the apse wall
    ...nozzle(-5.55, 2.55, 3.05, 0.4, 0.4, { mir: true, collar: 'accent', m: 'accent' }),
    ...nozzle(-5.5, 2.0, 0.85, 0.45, 0.45, { mir: true, collar: 'accent', m: 'accent' }),
    { t: 'ell', s: [0.42, 0.42, 0.05], seg: 12, p: [-5.57, 3.35, 0], m: 'glow' },
    ...liftJet(4.0, 4.0, 0.98, 0.5), ...liftJet(-3.8, 4.0, 0.98, 0.45),
    ...gearLeg(4.0, 4.0, { top: 1.3, padM: 'accent' }), ...gearLeg(-3.8, 4.0, { top: 1.3, padM: 'accent' }),
  ];
  const W = wShield(roof, { style: 'halo' });
  craft('lc_arcane', {
    name: 'Sanctum of the Flame', faction: 'arcane', factionName: 'Arcane / Energy', unit: 'ARC-LandingCraft', weaponType: 'shield',
    blurb: 'A flying basilica in ivory and gold: one cruciform cathedral whose transept gables open as the resource portals, crimson aisle roofs, bonded turrets and buttresses, and a halo spire over the crossing.',
    palette: { hull: '#ece4d2', hull2: '#d6cab0', panel: '#e2d8c2', accent: '#c9a040', stripe: '#8e1d27', trim: '#8e1d27', glow: '#ffb84a', glowE: '#ffcf6a' },
    roofY: roof, parts, weapon: W, headParts: [], headMode: { mode: 'spin', speed: 0.9 },
    hatch: hatches({ panel: 'hull2', inset: 'stripe', bars: 'accent', plate: 'accent' }),
  });
}

// 7 · SPACE TECH — "Lumen Survey Lander". Federation white, navy and cyan; a smooth capsule with ring bands,
//     drum pods, sensor masts and a big survey dish; a twin-rail railgun.
{
  const roof = 4.35;
  const drum = (cx, r, y0, y1) => [
    { t: 'cyl', r: [r * 0.82, r], l: 0.35, seg: 14, p: [cx, y0 + 0.17, 4.0], m: 'hull2', mir: true },
    { t: 'cyl', r, l: y1 - y0 - 0.35, seg: 14, p: [cx, (y0 + 0.35 + y1) / 2, 4.0], m: 'hull', mir: true },
    { t: 'cyl', r: [r * 0.55, r], l: 0.4, seg: 14, p: [cx, y1 + 0.2, 4.0], m: 'hull', mir: true },
    { t: 'cyl', r: r + 0.04, l: 0.16, seg: 14, p: [cx, y0 + 1.1, 4.0], m: 'accent', mir: true },
    { t: 'cyl', r: r + 0.045, l: 0.05, seg: 14, p: [cx, y0 + 1.3, 4.0], m: 'glow', mir: true },
  ];
  const parts = [
    { t: 'loft', ax: 'x', secs: [[-5.4, esec(0, 1.8, 2.7, 1.45, 12, 0.6)], [-4.9, esec(0, 2.3, 2.7, 1.68, 12, 0.5)], [2.0, esec(0, 2.3, 2.7, 1.68, 12, 0.5)], [4.7, esec(0, 1.8, 2.4, 1.3, 12, 0.6)], [5.95, esec(0, 0.9, 2.0, 0.6, 12, 0.8)]], m: 'hull' },
    // wraparound visor
    { t: 'loft', ax: 'x', secs: [[3.2, esec(0, 2.08, 2.75, 1.42, 12, 0.55)], [4.0, esec(0, 1.92, 2.6, 1.32, 12, 0.6)]], m: 'glass' },
    // ring bands
    ...[-3.6, -0.2].map((x) => ({ t: 'loft', ax: 'x', secs: [[x, esec(0, 2.36, 2.7, 1.74, 12, 0.5)], [x + 0.3, esec(0, 2.36, 2.7, 1.74, 12, 0.5)]], m: 'accent' })),
    ...[-3.45, -0.05].map((x) => ({ t: 'loft', ax: 'x', secs: [[x - 0.03, esec(0, 2.38, 2.7, 1.76, 12, 0.5)], [x + 0.03, esec(0, 2.38, 2.7, 1.76, 12, 0.5)]], m: 'glow' })),
    { t: 'box', s: [0.05, 0.08, 1.2], p: [5.93, 2.0, 0], m: 'glow' },
    // hull number panel
    { t: 'box', s: [1.0, 0.5, 0.04], p: [2.6, 2.2, 2.3], m: 'accent', mir: true },
    { t: 'box', s: [0.7, 0.08, 0.05], p: [2.6, 2.2, 2.31], m: 'stripe', mir: true },
    ...bearing(roof),
    // sensor masts
    { t: 'cyl', r: 0.05, l: 1.6, seg: 6, p: [-4.4, roof + 0.4, 1.1], m: 'metal', mir: true },
    { t: 'ell', s: [0.12, 0.12, 0.12], seg: 8, p: [-4.4, roof + 1.22, 1.1], m: 'glowR', mir: true },
    { t: 'box', s: [0.6, 0.04, 0.04], p: [-4.4, roof + 0.95, 1.1], m: 'metal', mir: true },
    // ion engines
    ...nozzle(-5.4, 2.7, 0, 0.7, 0.5, { seg: 14 }), ...nozzle(-5.2, 1.7, 1.15, 0.38, 0.4, { mir: true, seg: 12 }),
    ...modBox({ m: 'hull2', ct: 0.9, y1: 4.1 }),
    { t: 'box', s: [3.96, 0.08, 0.05], p: [0, 4.15, 5.65], m: 'accent', mir: true },
    ...drum(4.0, 1.65, 1.2, 3.2), ...drum(-3.8, 1.5, 1.2, 3.0),
    { t: 'box', s: [0.25, 0.4, 0.8], p: [5.62, 2.3, 4.0], m: 'accent', mir: true },
    { t: 'cyl', ax: 'x', r: 0.13, l: 0.05, seg: 10, p: [5.76, 2.3, 4.0], m: 'glow', mir: true },
    { t: 'cyl', ax: 'x', r: 0.06, l: 0.9, seg: 6, p: [6.0, 2.75, 4.0], m: 'metal', mir: true },
    ...nozzle(-5.25, 2.1, 4.0, 0.48, 0.5, { mir: true, seg: 12 }),
    { t: 'cyl', r: 0.05, l: 1.0, seg: 6, p: [-3.8, 3.7, 4.4], m: 'metal', mir: true },
    { t: 'box', s: [0.6, 0.02, 0.35], p: [-3.8, 4.15, 4.4], m: 'glass', mir: true, d: 1 },
    ...liftJet(4.0, 4.0, 1.12), ...liftJet(-3.8, 4.0, 1.12, 0.5),
    ...gearLeg(4.0, 4.0, { top: 1.4, padM: 'hull2' }), ...gearLeg(-3.8, 4.0, { top: 1.4, padM: 'hull2' }),
  ];
  const W = wCannon(roof, { rail: true, len: 3.5 });
  craft('lc_space', {
    name: 'Lumen Survey Lander', faction: 'space', factionName: 'Space Tech', unit: 'SPC-LandingCraft', weaponType: 'cannon (railgun)',
    blurb: 'A federation survey lander in white and navy with cyan ring-lights. A coil railgun on the roof and the biggest survey dish in the fleet.',
    palette: { hull: '#e8ebf0', hull2: '#c5ccd6', panel: '#d6dce4', accent: '#26407a', stripe: '#f6f8fa', trim: '#26407a', glow: '#46f2ff', glowE: '#4ad8ff' },
    roofY: roof, parts, weapon: W, headParts: hDish(W.head, 0.5, 0.42, 30), headMode: { mode: 'sweep' },
    hatch: hatches({ panel: 'hull2', inset: 'accent', bars: 'stripe', plate: 'accent' }),
  });
}

// 8 · DARK ENERGY — "Hollow Choir". Obsidian and violet with magenta glow; jagged plates, spiked pods and ridge,
//     a watching eye for a head; the mortar lobs corruption (glowing mouths).
{
  const roof = 4.2;
  const spike = (x, y, z, l, a, b, mir = true) => ({ t: 'cyl', r: [0.015, 0.16], l, seg: 5, p: [x, y, z], r3: [a, 0, b], m: 'hull2', mir });
  const parts = [
    { t: 'loft', ax: 'x', secs: [[-5.5, arch(0, 1.9, 1.1, 3.5, 0.5, 0.5)], [-4.9, arch(0, 2.35, 1.0, 3.75, 0.45, 0.5)], [2.0, arch(0, 2.35, 1.0, 3.75, 0.45, 0.5)], [4.5, arch(0, 1.8, 1.0, 2.8, 0.35, 0.5)], [5.95, arch(0, 0.6, 1.3, 1.7, 0.15, 0.2)]], m: 'hull' },
    // slit visor + glowing seams
    { t: 'box', s: [1.5, 0.06, 1.8], p: [3.6, 3.32, 0], r3: [0, 0, -22], m: 'glow' },
    { t: 'box', s: [1.6, 0.08, 2.4], p: [3.55, 3.38, 0], r3: [0, 0, -22], m: 'hull2' },
    { t: 'box', s: [1.5, 0.05, 0.6], p: [3.62, 3.39, 0], r3: [0, 0, -22], m: 'glow' },
    ...[-3.8, -2.2, -0.6, 1.0].map((x) => ({ t: 'box', s: [0.05, 2.0, 0.04], p: [x, 2.3, 2.36], r3: [0, 0, 16], m: 'glow', mir: true, d: 1 })),
    // ridge spikes
    ...[-4.6, -3.4, -2.3, 2.2].map((x, i) => spike(x, 4.45, 0.0, 0.9 + (i % 2) * 0.3, 0, 22, false)),
    ...bearing(roof),
    { t: 'box', s: [3.0, 0.3, 3.4], p: [0, roof - 0.15, 0], m: 'hull2' },
    ...nozzle(-5.45, 2.3, 0.8, 0.5, 0.4, { mir: true, seg: 6 }),
    ...modBox({ m: 'hull2', ct: 0.7, y1: 4.0 }),
    ...[-1.4, 0, 1.4].map((x, i) => spike(x, 4.25, 4.6, 0.8 + (i === 1 ? 0.4 : 0), -18, i === 1 ? 0 : (x > 0 ? -20 : 20))),
    // spiked corner pods
    ...podOct(4.0, 4.0, { h: 1.7, c: 0.75, y1: 3.0, cap: 0.6, top: 0.4, band: 'glow', bandH: 0.06, bandY: 2.4 }),
    ...podOct(-3.8, 4.0, { h: 1.55, c: 0.7, y1: 2.9, cap: 0.55, top: 0.4, band: 'glow', bandH: 0.06, bandY: 2.3 }),
    spike(4.0, 3.95, 4.0, 1.2, 0, 0), spike(5.3, 2.8, 5.3, 1.0, -40, -40), spike(5.5, 2.4, 2.7, 0.8, 30, -45),
    spike(-3.8, 3.8, 4.0, 1.0, 0, 0), spike(-5.0, 2.7, 5.2, 0.9, -40, 40),
    { t: 'ell', s: [0.22, 0.3, 0.3], seg: 10, p: [5.65, 2.1, 4.0], m: 'glow', mir: true },
    ...nozzle(-5.25, 2.1, 4.0, 0.46, 0.5, { mir: true, seg: 6 }),
    ...liftJet(4.0, 4.0, 1.12), ...liftJet(-3.8, 4.0, 1.12, 0.5),
    ...gearLeg(4.0, 4.0, { splay: 0.25 }), ...gearLeg(-3.8, 4.0, { splay: 0.25 }),
  ];
  const W = wMortar(roof, { mouth: 'glow', tube: 'hull2', r: 0.29 });
  craft('lc_dark', {
    name: 'Hollow Choir', faction: 'dark', factionName: 'Dark Energy', unit: 'DRK-LandingCraft', weaponType: 'mortar',
    blurb: 'Obsidian and violet, seamed with magenta light and crowned in spikes. A watching eye turns on its stalk; the mortars lob corruption.',
    palette: { hull: '#2a2230', hull2: '#3b2d46', panel: '#4a3858', accent: '#7a2e8a', stripe: '#c84ad8', trim: '#7a2e8a', glow: '#ff4ad8', glowE: '#c84aff' },
    roofY: roof, parts, weapon: W, headParts: hEye(W.head), headMode: { mode: 'sweep' },
    hatch: hatches({ panel: 'hull2', inset: 'panel', bars: 'stripe', plate: 'stripe' }),
  });
}

// 9 · GREENIES (CHEM) — "Brood Hive". Swamp green and toxic yellow; an organic segmented hull, hex hive pods
//     with domes, glowing chem tanks; a spore-pod rocket rack.
{
  const roof = 4.1;
  const hive = (cx, r, y1) => [
    { t: 'cyl', r: [r, r * 0.85], l: y1 - 1.1, seg: 6, p: [cx, (1.1 + y1) / 2, 4.0], m: 'hull', mir: true },
    { t: 'ell', s: [r * 0.95, 0.8, r * 0.95], seg: 10, half: true, p: [cx, y1, 4.0], m: 'hull2', mir: true },
    ...[-60, 0, 60].map((a) => ({ t: 'ext', ax: 'z', poly: [[-0.3, 1.9], [0.3, 1.9], [0.3, 2.6], [-0.3, 2.6]], d: [-0.02, 0.02], p: [cx + Math.cos(a * D) * r * 0.84, 0, 4.0 - Math.sin(a * D) * r * 0.84], r3: [0, a + 90, 0], m: 'glow', mir: true })),
    { t: 'cyl', r: r + 0.04, l: 0.14, seg: 6, p: [cx, 2.9, 4.0], m: 'accent', mir: true },
  ];
  const tank = (x, y, z, l) => [
    { t: 'cyl', ax: 'x', r: 0.42, l, seg: 10, p: [x, y, z], m: 'glow', mir: true },
    ...[-1, 0, 1].map((k) => ({ t: 'cyl', ax: 'x', r: 0.46, l: 0.12, seg: 10, p: [x + k * l * 0.42, y, z], m: 'dark', mir: true })),
  ];
  const parts = [
    // segmented organic hull (lofted, with bulging segments)
    { t: 'loft', ax: 'x', secs: [[-5.5, esec(0, 1.6, 2.5, 1.2, 12, 0.85)], [-4.6, esec(0, 2.3, 2.6, 1.6, 12, 0.75)], [-3.2, esec(0, 2.05, 2.55, 1.45, 12, 0.8)], [-1.6, esec(0, 2.35, 2.6, 1.62, 12, 0.75)], [0.2, esec(0, 2.05, 2.55, 1.45, 12, 0.8)], [2.0, esec(0, 2.35, 2.6, 1.6, 12, 0.75)], [4.6, esec(0, 1.7, 2.3, 1.2, 12, 0.8)], [5.95, esec(0, 0.8, 2.0, 0.55, 12)]], m: 'hull' },
    // compound eye cluster at the bow
    ...[[4.7, 2.75, 0.55], [4.7, 2.75, -0.55], [5.15, 2.35, 0.95], [5.15, 2.35, -0.95], [5.3, 2.6, 0]].map(([x, y, z]) => ({ t: 'ell', s: [0.3, 0.3, 0.3], seg: 8, p: [x, y, z], m: 'glow' })),
    { t: 'ell', s: [0.9, 0.5, 1.4], seg: 10, p: [4.8, 2.6, 0], m: 'hull2' },
    // chem tanks along the back
    ...tank(-3.4, 4.1, 1.15, 2.0),
    ...[-4.6, -2.0].map((x) => ({ t: 'box', s: [0.15, 0.35, 2.6], p: [x, 4.05, 0], m: 'stripe' })),
    ...bearing(roof),
    { t: 'cyl', r: [1.25, 1.45], l: 0.3, seg: 6, p: [0, roof - 0.15, 0], m: 'hull2' },
    ...nozzle(-5.4, 2.3, 0.75, 0.48, 0.4, { mir: true, seg: 6 }),
    ...modBox({ m: 'hull2', ct: 0.9, y1: 4.0 }),
    ...[[-1.2, 4.1], [0.2, 4.2], [1.4, 4.05]].map(([x, y]) => ({ t: 'ell', s: [0.42, 0.28, 0.42], seg: 8, p: [x, y, 4.0], m: 'accent', mir: true, d: 1 })),
    ...hive(4.0, 1.8, 3.0), ...hive(-3.8, 1.6, 2.8),
    { t: 'ell', s: [0.25, 0.25, 0.25], seg: 8, p: [5.6, 2.2, 4.0], m: 'glow', mir: true },
    ...tank(-3.8, 3.75, 4.0, 1.2),
    ...nozzle(-5.2, 2.0, 4.0, 0.46, 0.5, { mir: true, seg: 6 }),
    ...liftJet(4.0, 4.0, 1.12), ...liftJet(-3.8, 4.0, 1.12, 0.5),
    ...gearLeg(4.0, 4.0, { padM: 'accent' }), ...gearLeg(-3.8, 4.0, { padM: 'accent' }),
  ];
  const W = wRockets(roof, { body: 'hull2', nose: 'glow', rr: 0.17, rows: [-0.1, 0.24], cols: [0.4, 0] });
  craft('lc_greenies', {
    name: 'Brood Hive', faction: 'greenies', factionName: 'Greenies (Chem)', unit: 'GRN-LandingCraft', weaponType: 'rocket launcher',
    blurb: 'The collective lands a hive: a segmented swamp-green hull, hex brood pods, glowing chem tanks. Spore rockets burst into choking clouds.',
    palette: { hull: '#6f8a3a', hull2: '#556b2c', panel: '#7f9c48', accent: '#d8d040', stripe: '#2e2c1e', trim: '#d8d040', glow: '#b8ff3a', glowE: '#9aff5a' },
    roofY: roof, parts, weapon: W, headParts: hSpore(W.head), headMode: { mode: 'spin', speed: 1.4 },
    hatch: hatches({ panel: 'hull2', inset: 'accent', bars: 'stripe', plate: 'accent' }),
  });
}

/** Every craft by key, display order (neutral first, then the registry's faction order). */
export const LANDING_CRAFT = M;
export const LANDING_CRAFT_ORDER = Object.freeze(['lc_neutral', 'lc_ground', 'lc_air', 'lc_hightech', 'lc_artillery', 'lc_water', 'lc_arcane', 'lc_space', 'lc_dark', 'lc_greenies']);
/** Faction registry key (data/factions.js) → craft key. 'system' and anything unknown fly the neutral craft. */
export const FACTION_CRAFT = Object.freeze({ system: 'lc_neutral', ground: 'lc_ground', air: 'lc_air', hightech: 'lc_hightech', artillery: 'lc_artillery',
  water: 'lc_water', arcane: 'lc_arcane', space: 'lc_space', dark: 'lc_dark', greenies: 'lc_greenies' });
/** Craft for a faction key, a craft key, or nothing (→ neutral). */
export function craftFor(key) {
  if (key && M[key]) return M[key];
  return M[FACTION_CRAFT[key] || 'lc_neutral'];
}
/** 4 model units = 1 cell. */
export const CRAFT_SCALE = 0.25;
