// Unit models built from primitives. X forward, Y up, Z right; hull ≈ 4 units long; ground at Y = 0.
(function (root) {
  const { track } = root.Prims;
  const sec = (P, sx, sz, dx = 0, dz = 0) => P.map(([x, z]) => [x * sx + dx, z * sz + dz]);
  const M = {};

  // ── TANK "Twin-barrel MBT" ────────────────────────────────────────────────────────────────────────────
  {
    const TUR = [[-1.62, -0.85], [-1.2, -1.05], [0.15, -1.15], [0.75, -0.68], [0.95, -0.45], [0.95, 0.45], [0.75, 0.68], [0.15, 1.15], [-1.2, 1.05], [-1.62, 0.85]];
    const TUR_TOP = TUR.map(([x, z]) => [x < 0.2 ? x : 0.2 + (x - 0.2) * 0.4, z * 0.8]);
    const parts = [
      ...track({ x0: -1.95, x1: 1.85, h: 0.64, z: 1.12, w: 0.52, wheels: 6, wr: 0.2 }),
      // hull centre + side skirts (side profiles extruded across Z)
      { t: 'ext', ax: 'z', poly: [[-1.95, 0.35], [-1.95, 1.22], [1.3, 1.22], [2.0, 0.78], [1.85, 0.6], [1.4, 0.35]], d: [-0.86, 0.86], m: 'hull' },
      // side skirts: lofted along X so the upper outer edge is chamfered and the nose tapers
      { t: 'loft', ax: 'x', secs: [
        [-1.98, [[0.86, 0.5], [1.46, 0.5], [1.46, 1.0], [1.28, 1.22], [0.86, 1.22]]],
        [1.42, [[0.86, 0.5], [1.46, 0.5], [1.46, 1.0], [1.28, 1.22], [0.86, 1.22]]],
        [1.94, [[0.86, 0.78], [1.42, 0.78], [1.42, 0.88], [1.3, 0.94], [0.86, 0.94]]]], m: 'hull', mir: true },
      // front glacis V + lower plate
      { t: 'ext', ax: 'z', poly: [[1.5, 1.1], [1.9, 0.83], [1.96, 0.78], [1.62, 1.05]], d: [-0.3, 0.3], m: 'dark' },
      { t: 'box', s: [0.05, 0.3, 0.9], p: [1.62, 0.5, 0], m: 'hull2' },
      { t: 'box', s: [0.04, 0.09, 0.26], p: [1.86, 0.72, 0.46], r3: [0, 0, 0], m: 'dark', mir: true },
      { t: 'box', s: [0.04, 0.05, 0.36], p: [1.71, 0.92, 0], m: 'dark' },
      { t: 'cyl', ax: 'x', r: 0.09, l: 0.06, seg: 10, p: [1.84, 0.58, 0.5], m: 'dark', mir: true },
      { t: 'box', s: [0.04, 0.045, 0.34], p: [1.93, 0.86, 1.18], m: 'glow', mir: true },
      { t: 'box', s: [0.04, 0.035, 0.18], p: [1.75, 0.98, 0.62], m: 'glow', mir: true },
      // hull side greebles + glow strips
      { t: 'box', s: [0.55, 0.03, 0.02], p: [0.55, 0.72, 1.465], m: 'glow', mir: true },
      { t: 'box', s: [0.7, 0.03, 0.02], p: [-0.5, 0.98, 1.465], m: 'glow', mir: true },
      { t: 'box', s: [0.25, 0.12, 0.03], p: [-1.2, 0.92, 1.47], m: 'dark', mir: true },
      { t: 'box', s: [0.3, 0.09, 0.03], p: [-0.2, 1.08, 1.47], m: 'dark', mir: true },
      { t: 'box', s: [0.18, 0.1, 0.03], p: [1.1, 0.98, 1.47], m: 'dark', mir: true },
      // rear plate
      { t: 'box', s: [0.05, 0.42, 0.62], p: [-1.97, 0.86, 0], m: 'hull2' },
      { t: 'box', s: [0.04, 0.16, 0.36], p: [-2.0, 0.98, 1.16], m: 'dark', mir: true },
      { t: 'cyl', ax: 'x', r: 0.07, l: 0.05, seg: 10, p: [-1.99, 0.52, 0.5], m: 'glow', mir: true },
      { t: 'box', s: [0.5, 0.025, 0.5], p: [-1.65, 1.23, 0], m: 'dark' },
      // turret (lofted hex body, three horizontal sections)
      { t: 'cyl', ax: 'y', r: 0.85, l: 0.1, seg: 12, p: [-0.35, 1.26, 0], m: 'dark', g: 'turret' },
      { t: 'loft', ax: 'y', secs: [[1.28, sec(TUR, 0.95, 0.82, -0.03)], [1.52, TUR], [1.86, TUR_TOP]], m: 'hull', g: 'turret' },
      { t: 'box', s: [0.36, 0.06, 0.3], p: [-0.55, 1.88, 0], m: 'hull2', g: 'turret' },
      { t: 'box', s: [0.24, 0.05, 0.2], p: [-1.25, 1.88, 0], m: 'dark', g: 'turret' },
      { t: 'box', s: [0.65, 0.03, 0.02], p: [0.1, 1.56, 1.155], m: 'glow', g: 'turret', mir: true },
      { t: 'box', s: [0.3, 0.12, 0.03], p: [-0.9, 1.6, 1.07], m: 'dark', g: 'turret', mir: true },
      { t: 'box', s: [0.5, 0.17, 0.03], p: [0.47, 1.58, 0.93], r3: [0, 38, 0], m: 'dark', g: 'turret', mir: true },
      { t: 'box', s: [0.03, 0.14, 0.32], p: [-1.63, 1.58, 0.55], m: 'dark', g: 'turret', mir: true },
      // twin guns: hex mantlets with glowing rings, barrels with muzzle sleeves
      { t: 'cyl', ax: 'x', r: 0.21, l: 0.32, seg: 6, p: [0.98, 1.47, 0.34], m: 'hull2', g: 'turret', mir: true },
      { t: 'cyl', ax: 'x', r: 0.14, l: 0.03, seg: 12, p: [1.15, 1.47, 0.34], m: 'glow', g: 'turret', mir: true },
      { t: 'cyl', ax: 'x', r: 0.07, l: 0.78, seg: 8, p: [1.52, 1.47, 0.34], m: 'metal', g: 'turret', mir: true },
      { t: 'cyl', ax: 'x', r: 0.095, l: 0.34, seg: 8, p: [1.73, 1.47, 0.34], m: 'dark', g: 'turret', mir: true },
      { t: 'cyl', ax: 'x', r: 0.055, l: 0.02, seg: 10, p: [1.905, 1.47, 0.34], m: 'glow', g: 'turret', mir: true },
      // sensor pods with three lenses, small guns, antennas
      { t: 'cyl', ax: 'y', r: 0.08, l: 0.14, seg: 8, p: [-0.95, 1.9, 0.56], m: 'dark', g: 'turret', mir: true },
      { t: 'box', s: [0.42, 0.24, 0.4], p: [-0.95, 2.06, 0.56], m: 'hull', g: 'turret', mir: true },
      { t: 'box', s: [0.03, 0.16, 0.34], p: [-0.73, 2.06, 0.56], m: 'dark', g: 'turret', mir: true },
      ...[-0.11, 0, 0.11].map((dz) => ({ t: 'cyl', ax: 'x', r: 0.045, l: 0.03, seg: 10, p: [-0.71, 2.06, 0.56 + dz], m: 'glow', g: 'turret', mir: true })),
      { t: 'cyl', ax: 'x', r: 0.035, l: 0.42, seg: 6, p: [-0.5, 2.0, 0.78], m: 'dark', g: 'turret', mir: true },
      { t: 'cyl', ax: 'y', r: 0.012, l: 0.32, seg: 4, p: [-1.05, 2.34, 0.64], m: 'dark', g: 'turret', mir: true },
    ];
    M.tank = { name: 'Twin-barrel MBT', ref: 'tank', parts, pivots: { turret: [-0.35, 1.22, 0] },
      views: { side: 'right', top: 'down' } };
  }


  // segment helper: a box from a to b (x,y,z), width w (z-ish), height h
  const seg = (a, b, w, h, m, extra = {}) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
    const yaw = -Math.atan2(dz, dx) * 180 / Math.PI, pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
    return Object.assign({ t: 'box', s: [L + w * 0.3, h, w], p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r3: [0, yaw, pitch], m }, extra);
  };
  const oct = (yb, ym, ys, yt, wb, wm, ws, wt) => [[-wb, yb], [wb, yb], [wm, ym], [ws, ys], [wt, yt], [-wt, yt], [-ws, ys], [-wm, ym]];

  // ── BUGGY "SR-07 scout" ──────────────────────────────────────────────────────────────────────────────
  {
    const pod = (cx) => ({ t: 'ext', ax: 'z', poly: [[cx - 0.5, 0.6], [cx - 0.36, 0.9], [cx + 0.36, 0.9], [cx + 0.52, 0.62], [cx + 0.38, 0.46], [cx - 0.38, 0.46]], d: [0.92, 1.4], m: 'hull2', mir: true });
    const wheel = (x) => [
      { t: 'cyl', ax: 'z', r: 0.31, l: 0.4, seg: 12, p: [x, 0.31, 1.16], m: 'black', mir: true },
      { t: 'cyl', ax: 'z', r: 0.15, l: 0.42, seg: 8, p: [x, 0.31, 1.16], m: 'metal', mir: true },
      seg([x, 0.36, 0.45], [x, 0.4, 0.98], 0.07, 0.06, 'dark', { mir: true }),
      seg([x - 0.15, 0.55, 0.5], [x, 0.36, 0.98], 0.06, 0.06, 'dark', { mir: true }),
    ];
    const parts = [
      { t: 'loft', ax: 'x', secs: [
        [-1.97, oct(0.52, 0.8, 1.1, 1.27, 0.48, 0.85, 0.95, 0.5)],
        [-1.63, oct(0.43, 0.85, 1.3, 1.69, 0.52, 0.95, 1.15, 0.62)],
        [0.28, oct(0.43, 0.8, 1.32, 1.69, 0.52, 0.95, 1.18, 0.62)],
        [1.2, oct(0.48, 0.78, 1.2, 1.45, 0.52, 0.9, 1.1, 0.58)],
        [1.885, oct(0.7, 0.85, 1.1, 1.24, 0.48, 0.72, 0.82, 0.48)],
        [2.0, oct(0.85, 0.92, 1.0, 1.08, 0.42, 0.56, 0.58, 0.38)]], m: 'hull' },
      // windshield on the front roof slope, door seam, side vents
      { t: 'box', s: [1.0, 0.03, 0.82], p: [1.02, 1.505, 0], r3: [0, 0, -15.7], m: 'glass' },
      { t: 'box', s: [0.05, 0.62, 0.03], p: [-0.32, 1.0, 1.185], r3: [0, 0, 8], m: 'dark', mir: true },
      { t: 'box', s: [0.45, 0.05, 0.03], p: [0.6, 0.95, 1.135], m: 'dark', mir: true },
      pod(-1.4), pod(1.12), ...wheel(-1.4), ...wheel(1.13),
      // front face: dark grille, sensor lenses, light bar
      { t: 'box', s: [0.05, 0.26, 1.05], p: [1.93, 0.96, 0], m: 'dark' },
      { t: 'cyl', ax: 'x', r: 0.1, l: 0.05, seg: 10, p: [1.96, 0.98, 0], m: 'black' },
      { t: 'cyl', ax: 'x', r: 0.055, l: 0.02, seg: 10, p: [1.99, 0.98, 0], m: 'glow' },
      ...[0.22, 0.42].map((z) => ({ t: 'cyl', ax: 'x', r: 0.045, l: 0.03, seg: 8, p: [1.96, 1.02, z], m: 'glow', mir: true })),
      { t: 'cyl', ax: 'x', r: 0.04, l: 0.03, seg: 8, p: [1.96, 0.9, 0.3], m: 'amber' },
      { t: 'box', s: [0.03, 0.035, 0.26], p: [1.85, 0.76, 0], m: 'glow' },
      // rear vents
      { t: 'box', s: [0.04, 0.32, 0.34], p: [-1.95, 0.96, 0.42], m: 'dark', mir: true },
      { t: 'box', s: [0.04, 0.12, 0.3], p: [-1.95, 0.68, 0], m: 'dark' },
      // turret: ring, head with side lobes, big lens, glowing energy barrel
      { t: 'cyl', ax: 'y', r: 0.26, l: 0.16, seg: 10, p: [-0.85, 1.76, 0], m: 'dark', g: 'turret' },
      { t: 'box', s: [0.52, 0.24, 0.5], p: [-0.82, 1.95, 0], m: 'hull', g: 'turret' },
      { t: 'cyl', ax: 'z', r: 0.15, l: 0.16, seg: 8, p: [-0.84, 1.95, 0.32], m: 'hull2', g: 'turret', mir: true },
      { t: 'box', s: [0.2, 0.1, 0.2], p: [-0.88, 2.11, 0], m: 'dark', g: 'turret' },
      { t: 'cyl', ax: 'x', r: 0.12, l: 0.06, seg: 12, p: [-0.54, 1.97, 0], m: 'black', g: 'turret' },
      { t: 'cyl', ax: 'x', r: 0.06, l: 0.02, seg: 10, p: [-0.505, 1.97, 0], m: 'glowB', g: 'turret' },
      { t: 'cyl', ax: 'x', r: 0.05, l: 0.2, seg: 8, p: [-0.42, 1.9, 0], m: 'metal', g: 'turret' },
      { t: 'cyl', ax: 'x', r: 0.04, l: 0.34, seg: 8, p: [-0.15, 1.9, 0], m: 'glow', g: 'turret' },
      { t: 'cyl', ax: 'x', r: 0.055, l: 0.1, seg: 8, p: [0.06, 1.9, 0], m: 'metal', g: 'turret' },
    ];
    M.buggy = { name: 'SR-07 scout', ref: 'buggy', parts, pivots: { turret: [-0.85, 1.69, 0] }, views: { side: 'right', top: 'down' } };
  }

  // ── BEETLE "Stag tracker" ─────────────────────────────────────────────────────────────────────────────
  {
    const ely = (yb, w, h) => [[0.08, yb], [w, yb], [w * 1.02, yb + 0.35 * h], [w * 0.82, yb + 0.8 * h], [w * 0.42, yb + h], [0.08, yb + 0.94 * h]];
    const claw = (pts, w0, w1) => pts.slice(0, -1).map((a, i) => seg(a, pts[i + 1], w0 + (w1 - w0) * i / (pts.length - 2), (w0 + (w1 - w0) * i / (pts.length - 2)) * 0.8, 'hull', { mir: true }));
    const parts = [
      ...track({ x0: -1.7, x1: 0.78, h: 0.58, z: 0.97, w: 0.56, wheels: 6, wr: 0.15, glowHub: true }),
      { t: 'box', s: [2.4, 0.45, 1.3], p: [-0.45, 0.78, 0], m: 'dark' },
      { t: 'box', s: [1.9, 0.5, 0.2], p: [-0.65, 1.42, 0], m: 'dark' },
      ...[-1.5, -1.0, -0.5].map((x) => ({ t: 'cyl', ax: 'z', r: 0.05, l: 1.6, seg: 6, p: [x, 0.98, 0], m: 'metal' })),
      // elytra (one half lofted, mirrored), pronotum, head
      { t: 'loft', ax: 'x', secs: [
        [-2.0, ely(1.3, 0.22, 0.1)], [-1.7, ely(1.15, 0.72, 0.5)], [-1.45, ely(1.1, 0.95, 0.65)], [-1.1, ely(1.07, 1.12, 0.8)],
        [-0.3, ely(1.06, 1.22, 0.87)], [0.35, ely(1.1, 1.16, 0.72)], [0.75, ely(1.14, 1.0, 0.52)], [0.95, ely(1.18, 0.8, 0.36)], [1.1, ely(1.22, 0.45, 0.2)]], m: 'hull', mir: true },
      { t: 'box', s: [2.0, 0.3, 0.8], p: [-0.3, 1.1, 0], m: 'dark' },
      ...[-1.3, -0.7, -0.1].map((x) => ({ t: 'cyl', ax: 'x', r: 0.06, l: 0.5, seg: 6, p: [x, 1.0, 0.62], m: 'metal', mir: true })),
      { t: 'loft', ax: 'x', secs: [
        [0.55, oct(0.85, 1.0, 1.22, 1.42, 0.35, 0.62, 0.66, 0.4)],
        [0.95, oct(0.82, 1.0, 1.22, 1.42, 0.32, 0.6, 0.64, 0.38)],
        [1.28, oct(0.78, 0.9, 1.04, 1.16, 0.25, 0.42, 0.45, 0.25)]], m: 'hull2' },
      { t: 'loft', ax: 'x', secs: [
        [1.25, oct(0.62, 0.72, 0.86, 0.98, 0.18, 0.3, 0.32, 0.18)],
        [1.55, oct(0.6, 0.68, 0.78, 0.86, 0.12, 0.2, 0.22, 0.12)]], m: 'dark' },
      { t: 'box', s: [0.08, 0.06, 0.06], p: [1.5, 0.82, 0.16], m: 'glow', mir: true },
      // mandibles: arcs of tapering segments, with inner teeth
      ...claw([[1.3, 0.72, 0.32], [1.5, 0.68, 0.62], [1.72, 0.6, 0.88], [1.95, 0.52, 0.86], [2.12, 0.45, 0.6], [2.18, 0.4, 0.32]], 0.17, 0.05),
      seg([1.9, 0.53, 0.82], [1.95, 0.52, 0.6], 0.05, 0.05, 'hull2', { mir: true }),
      seg([1.62, 0.64, 0.75], [1.72, 0.62, 0.55], 0.05, 0.05, 'hull2', { mir: true }),
      // side cannons: arm, housing, twin glowing rails, hex muzzle
      { t: 'cyl', ax: 'z', r: 0.07, l: 0.75, seg: 8, p: [0.1, 1.0, 0.98], m: 'dark', mir: true },
      { t: 'box', s: [0.6, 0.28, 0.3], p: [-0.2, 1.0, 1.38], m: 'hull', mir: true },
      { t: 'cyl', ax: 'x', r: 0.045, l: 0.95, seg: 8, p: [0.57, 1.06, 1.38], m: 'glow', mir: true },
      { t: 'cyl', ax: 'x', r: 0.045, l: 0.95, seg: 8, p: [0.57, 0.94, 1.38], m: 'glow', mir: true },
      { t: 'box', s: [0.95, 0.04, 0.12], p: [0.57, 1.0, 1.38], m: 'dark', mir: true },
      { t: 'cyl', ax: 'x', r: 0.2, l: 0.2, seg: 6, p: [1.12, 1.0, 1.38], m: 'dark', mir: true },
      { t: 'cyl', ax: 'x', r: 0.1, l: 0.02, seg: 10, p: [1.23, 1.0, 1.38], m: 'glow', mir: true },
    ];
    M.beetle = { name: 'Stag tracker', ref: 'beetle', parts, pivots: {}, views: { side: 'left', top: 'right' } };
  }

  // ── JET "FS-217 striker" ──────────────────────────────────────────────────────────────────────────────
  {
    const fus = (yb, yt, w) => { const h = yt - yb, ym = yb + 0.45 * h; return [[0, yb], [w * 0.7, yb + 0.15 * h], [w, ym], [w * 0.6, yt - 0.1 * h], [0, yt], [-w * 0.6, yt - 0.1 * h], [-w, ym], [-w * 0.7, yb + 0.15 * h]]; };
    const can = (yb, yt, w) => [[-w, yb], [w, yb], [w * 0.7, yb + 0.7 * (yt - yb)], [0, yt], [-w * 0.7, yb + 0.7 * (yt - yb)]];
    const parts = [
      { t: 'loft', ax: 'x', secs: [
        [2.0, fus(0.52, 0.56, 0.02)], [1.6, fus(0.38, 0.72, 0.16)], [1.2, fus(0.3, 0.8, 0.25)], [0.8, fus(0.22, 0.82, 0.38)],
        [0.3, fus(0.2, 0.8, 0.6)], [-0.4, fus(0.18, 0.78, 0.8)], [-1.1, fus(0.18, 0.76, 0.76)], [-1.6, fus(0.22, 0.72, 0.64)], [-1.85, fus(0.26, 0.66, 0.56)]], m: 'hull' },
      { t: 'loft', ax: 'x', secs: [[1.42, can(0.76, 0.8, 0.04)], [1.1, can(0.77, 0.93, 0.16)], [0.7, can(0.79, 0.98, 0.18)], [0.35, can(0.78, 0.87, 0.12)], [0.2, can(0.77, 0.8, 0.05)]], m: 'glass' },
      // wings, chines, tailplanes (top-view polygons extruded in Y)
      { t: 'ext', ax: 'y', poly: [[-0.16, 0.6], [-1.01, 2.19], [-1.43, 2.19], [-1.54, 0.7]], d: [0.46, 0.52], m: 'hull', mir: true },
      { t: 'ext', ax: 'y', poly: [[1.25, 0.2], [-0.1, 0.62], [-0.5, 0.55], [0.4, 0.3]], d: [0.47, 0.52], m: 'hull2', mir: true },
      { t: 'ext', ax: 'y', poly: [[-1.45, 0.45], [-1.95, 1.0], [-2.12, 1.0], [-2.02, 0.42]], d: [0.47, 0.51], m: 'hull2', mir: true },
      { t: 'box', s: [0.5, 0.02, 0.03], p: [-1.15, 0.5, 2.0], r3: [0, -64, 0], m: 'glow', mir: true },
      // canted fins (built at the root, rotated outward 22°)
      { t: 'ext', ax: 'z', poly: [[-0.95, 0], [-1.42, 0.78], [-1.68, 0.78], [-1.88, 0]], d: [-0.025, 0.025], p: [0, 0.72, 0.48], r3: [26, 0, 0], m: 'hull2', mir: true },
      // intakes
      // caret intakes: a lofted duct per side whose raked lip (per-point offsets) blends back into the engine;
      // the opening is an inset dark plate on the same rake, framed by a bezel
      { t: 'loft', ax: 'x', secs: [
        [1.0, [[0.37, 0.65, 0], [0.71, 0.65, -0.06], [0.83, 0.53, -0.1], [0.83, 0.21, -0.14], [0.29, 0.21, -0.06]]],
        [0.5, [[0.3, 0.68], [0.72, 0.68], [0.84, 0.56], [0.84, 0.2], [0.26, 0.2]]],
        [-0.3, [[0.28, 0.7], [0.7, 0.69], [0.8, 0.58], [0.78, 0.22], [0.24, 0.2]]],
        [-1.0, [[0.24, 0.62], [0.48, 0.62], [0.56, 0.54], [0.56, 0.26], [0.24, 0.24]]]], m: 'hull2', mir: true },
      { t: 'loft', ax: 'x', secs: [
        [1.006, [[0.42, 0.6, 0], [0.69, 0.6, -0.055], [0.77, 0.51, -0.09], [0.77, 0.26, -0.13], [0.34, 0.26, -0.057]]],
        [0.8, [[0.42, 0.6, 0], [0.69, 0.6, -0.055], [0.77, 0.51, -0.09], [0.77, 0.26, -0.13], [0.34, 0.26, -0.057]]]], m: 'black', mir: true },
      { t: 'box', s: [0.04, 0.1, 0.03], p: [0.86, 0.42, 0.85], m: 'glow', mir: true },
      { t: 'box', s: [0.02, 0.03, 0.12], p: [1.02, 0.66, 0.5], m: 'dark', mir: true },
      // engines + nozzles
      { t: 'cyl', ax: 'x', r: 0.21, l: 0.9, seg: 10, p: [-1.45, 0.44, 0.36], m: 'dark', mir: true },
      { t: 'cyl', ax: 'x', r: [0.2, 0.24], l: 0.18, seg: 12, p: [-1.98, 0.44, 0.36], m: 'dark', mir: true },
      { t: 'cyl', ax: 'x', r: 0.16, l: 0.02, seg: 12, p: [-2.08, 0.44, 0.36], m: 'glowB', mir: true },
      // weapon pods under the wings, glowing fronts, pylons
      { t: 'cyl', ax: 'x', r: 0.13, l: 0.8, seg: 8, p: [-0.5, 0.24, 1.32], m: 'dark', mir: true },
      { t: 'cyl', ax: 'x', r: 0.07, l: 0.02, seg: 10, p: [-0.09, 0.24, 1.32], m: 'glowB', mir: true },
      { t: 'box', s: [0.4, 0.2, 0.04], p: [-0.55, 0.38, 1.32], m: 'dark', mir: true },
      ...[0, 90].map((a) => ({ t: 'box', s: [0.3, 0.04, 0.38], p: [-0.75, 0.24, 1.32], r3: [a, 0, 0], m: 'dark', mir: true })),
      // details
      { t: 'box', s: [0.3, 0.025, 0.02], p: [0.9, 0.55, 0.3], m: 'glow', mir: true },
      { t: 'box', s: [0.2, 0.03, 0.02], p: [-0.2, 0.62, 0.62], m: 'glow', mir: true },
    ];
    M.jet = { name: 'FS-217 striker', ref: 'jet', parts, pivots: {}, hover: 1.4, views: { side: 'left', top: 'up' } };
  }

  root.UNIT_MODELS = M;
})(typeof window !== 'undefined' ? window : globalThis);
