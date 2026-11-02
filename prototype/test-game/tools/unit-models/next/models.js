// Unit models built from primitives. X forward, Y up, Z right; hull ≈ 4 units long; ground at Y = 0.
(function (root) {
  const { track } = root.Prims;
  const sec = (P, sx, sz, dx = 0, dz = 0) => P.map(([x, z]) => [x * sx + dx, z * sz + dz]);
  const M = {};
  // ── HEAD kits: sensor heads that ride on the weapon and scan (all parts in group 'head'; pivot = mast foot)
  function radarDish({ x, y, z, mast = 0.2, r = 0.26, tilt = 22 }) {
    const top = y + mast;
    return [
      { t: 'cyl', ax: 'y', r: 0.07, l: 0.05, seg: 8, p: [x, y + 0.025, z], m: 'dark', g: 'head' },              // turntable
      { t: 'cyl', ax: 'y', r: 0.03, l: mast, seg: 6, p: [x, y + mast / 2, z], m: 'metal', g: 'head' },            // mast
      { t: 'box', s: [0.08, 0.06, 0.16], p: [x, top, z], m: 'dark', g: 'head' },                                   // yoke
      { t: 'cyl', ax: 'x', r: [r, r * 0.3], l: r * 0.42, seg: 12, p: [x + 0.06, top + 0.04, z], r3: [0, 0, tilt], m: 'hull2', g: 'head' },   // dish
      { t: 'cyl', ax: 'x', r: r * 0.86, l: 0.012, seg: 12, p: [x + 0.06 + r * 0.21 * Math.cos(tilt * Math.PI / 180), top + 0.04 + r * 0.21 * Math.sin(tilt * Math.PI / 180), z], r3: [0, 0, tilt], m: 'dark', g: 'head' },   // dish face
      { t: 'cyl', ax: 'x', r: 0.016, l: r * 0.9, seg: 5, p: [x + 0.06 + r * 0.55 * Math.cos(tilt * Math.PI / 180), top + 0.04 + r * 0.55 * Math.sin(tilt * Math.PI / 180), z], r3: [0, 0, tilt], m: 'metal', g: 'head' },   // feed arm
      { t: 'cyl', ax: 'x', r: 0.03, l: 0.03, seg: 8, p: [x + 0.06 + r * 1.0 * Math.cos(tilt * Math.PI / 180), top + 0.04 + r * 1.0 * Math.sin(tilt * Math.PI / 180), z], r3: [0, 0, tilt], m: 'glow', g: 'head' },  // feed horn
      { t: 'box', s: [0.1, 0.08, 0.1], p: [x - 0.1, top - 0.02, z], m: 'hull', g: 'head' },                          // counterweight
    ];
  }
  function barRadar({ x, y, z, mast = 0.16, w = 0.56 }) {
    const top = y + mast;
    return [
      { t: 'cyl', ax: 'y', r: 0.06, l: 0.04, seg: 8, p: [x, y + 0.02, z], m: 'dark', g: 'head' },
      { t: 'cyl', ax: 'y', r: 0.025, l: mast, seg: 6, p: [x, y + mast / 2, z], m: 'metal', g: 'head' },
      { t: 'box', s: [0.07, 0.11, w], p: [x, top + 0.04, z], r3: [0, 0, -12], m: 'hull2', g: 'head' },              // antenna bar, tipped up
      { t: 'box', s: [0.01, 0.06, w * 0.9], p: [x + 0.04, top + 0.05, z], r3: [0, 0, -12], m: 'glowB', g: 'head' },  // emitter strip
    ];
  }

  // ── HEAVY TANK "King Tiger" (GND-HeavyTanks) — from the repo's tiger-*.png ortho set (side, top, front, rear; base and turret split).
  // Side view: hull 620 px = 4.7 units → 0.0076 u/px; deck 1.21, turret roof 1.82, fender line 0.61; gun tip 4.9.
  {
    const TUR = [[-1.42, -0.6], [-1.2, -0.68], [-0.3, -0.75], [0.72, -0.6], [0.98, -0.38], [0.98, 0.38], [0.72, 0.6], [-0.3, 0.75], [-1.2, 0.68], [-1.42, 0.6]];
    const TUR_TOP = TUR.map(([x, z]) => [x > 0.35 ? 0.35 + (x - 0.35) * 0.55 : x, z * 0.84]);
    const HS = (x, zb, zt, yb, yt) => [x, [[-zb, yb], [zb, yb], [zt, yt], [-zt, yt]]];
    const parts = [
      ...track({ x0: -2.22, x1: 2.2, h: 0.64, z: 0.97, w: 0.52, wheels: 9, wr: 0.27, rr: 0.32 }),
      // lower hull between the tracks
      { t: 'ext', ax: 'z', poly: [[-2.2, 0.32], [-2.28, 0.62], [2.32, 0.62], [2.12, 0.32]], d: [-0.72, 0.72], m: 'hull2' },
      // upper hull: lofted along X — sloped sides, flat deck, long glacis down to the nose
      { t: 'loft', ax: 'x', secs: [HS(-2.34, 1.2, 1.04, 0.6, 1.17), HS(-2.24, 1.24, 1.1, 0.6, 1.21), HS(1.58, 1.24, 1.1, 0.6, 1.21), HS(2.36, 1.2, 1.12, 0.6, 0.68)], m: 'hull' },
      // fenders front + rear
      { t: 'box', s: [0.32, 0.03, 0.5], p: [2.28, 0.64, 0.98], r3: [0, 0, -18], m: 'hull2', mir: true },
      // deck: engine grilles, twin fans, hatches, tools
      { t: 'box', s: [0.75, 0.025, 0.38], p: [-1.55, 1.215, 0], m: 'dark' },
      { t: 'cyl', ax: 'y', r: 0.21, l: 0.03, seg: 12, p: [-1.7, 1.215, 0.62], m: 'dark', mir: true },
      { t: 'cyl', ax: 'y', r: 0.12, l: 0.035, seg: 10, p: [-1.7, 1.22, 0.62], m: 'black', mir: true },
      { t: 'cyl', ax: 'y', r: 0.16, l: 0.04, seg: 10, p: [1.2, 1.2, 0.52], r3: [0, 0, -18], m: 'hull2', mir: true },
      { t: 'box', s: [1.6, 0.03, 0.05], p: [-0.2, 1.17, 1.12], m: 'metal', mir: true },
      { t: 'box', s: [0.05, 0.08, 0.2], p: [2.3, 0.73, 0.82], m: 'dark', mir: true },                             // tow lugs
      { t: 'cyl', ax: 'x', r: 0.05, l: 0.06, seg: 8, p: [2.03, 0.98, -0.78], r3: [0, 0, -40], m: 'glowB' },        // headlight
      { t: 'cyl', ax: 'x', r: 0.04, l: 0.04, seg: 8, p: [2.07, 0.96, 0.32], r3: [0, 0, -40], m: 'dark' },         // hull MG
      // rear plate: exhaust stacks + stowage box
      { t: 'cyl', ax: 'y', r: 0.07, l: 0.32, seg: 8, p: [-2.37, 0.98, 0.36], m: 'dark', mir: true },
      { t: 'cyl', ax: 'y', r: 0.05, l: 0.04, seg: 8, p: [-2.37, 1.15, 0.36], m: 'amber', mir: true },
      { t: 'box', s: [0.12, 0.2, 0.34], p: [-2.38, 0.78, -0.72], m: 'hull2' },
      // ── WEAPON: long hexagonal turret, bell mantlet, 8.8 cm gun with muzzle brake
      { t: 'loft', ax: 'y', secs: [[1.21, TUR], [1.82, TUR_TOP]], m: 'hull', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: [0.17, 0.28], l: 0.4, seg: 12, p: [1.14, 1.48, 0], m: 'hull2', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: 0.115, l: 0.55, seg: 10, p: [1.6, 1.48, 0], m: 'hull', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: 0.075, l: 3.0, seg: 8, p: [3.3, 1.48, 0], m: 'metal', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: 0.115, l: 0.3, seg: 10, p: [4.74, 1.48, 0], m: 'dark', g: 'weapon' },
      { t: 'box', s: [0.12, 0.05, 0.25], p: [4.74, 1.48, 0], m: 'black', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: 0.05, l: 0.02, seg: 8, p: [4.9, 1.48, 0], m: 'glow', g: 'weapon' },
      // cupola + loader hatch + periscope
      { t: 'cyl', ax: 'y', r: 0.21, l: 0.13, seg: 12, p: [-0.62, 1.88, -0.36], m: 'hull2', g: 'weapon' },
      { t: 'cyl', ax: 'y', r: 0.16, l: 0.04, seg: 12, p: [-0.62, 1.96, -0.36], m: 'dark', g: 'weapon' },
      { t: 'cyl', ax: 'y', r: 0.15, l: 0.04, seg: 10, p: [-0.2, 1.83, 0.3], m: 'hull2', g: 'weapon' },
      { t: 'box', s: [0.1, 0.06, 0.06], p: [0.3, 1.84, -0.18], m: 'dark', g: 'weapon' },
      // spare track links hung on the turret sides (the reference's signature detail)
      ...[-0.75, -0.42, 0.25].map((x) => ({ t: 'box', s: [0.28, 0.17, 0.04], p: [x, 1.5, 0.705 - (x > 0 ? 0.04 : 0)], r3: [0, x > 0 ? -12 : 0, -10], m: 'track', g: 'weapon', mir: true })),
      { t: 'box', s: [0.04, 0.08, 0.5], p: [-1.43, 1.52, 0], m: 'dark', g: 'weapon' },                          // rear hatch
    ];
    parts.push(...radarDish({ x: -1.1, y: 1.82, z: 0.32, mast: 0.22, r: 0.27 }));
    M.tiger = { name: 'King Tiger heavy tank', unit: 'GND-HeavyTanks', ref: 'tiger', parts, pivots: { weapon: [-0.17, 1.21, 0], head: [-1.1, 1.82, 0.32] }, head: { mode: 'sweep' },
      views: { side: 'right', top: 'left' } };
  }

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
      { t: 'cyl', ax: 'y', r: 0.85, l: 0.1, seg: 12, p: [-0.35, 1.26, 0], m: 'dark', g: 'weapon' },
      { t: 'loft', ax: 'y', secs: [[1.28, sec(TUR, 0.95, 0.82, -0.03)], [1.52, TUR], [1.86, TUR_TOP]], m: 'hull', g: 'weapon' },
      { t: 'box', s: [0.36, 0.06, 0.3], p: [-0.55, 1.88, 0], m: 'hull2', g: 'weapon' },
      { t: 'box', s: [0.24, 0.05, 0.2], p: [-1.25, 1.88, 0], m: 'dark', g: 'weapon' },
      { t: 'box', s: [0.65, 0.03, 0.02], p: [0.1, 1.56, 1.155], m: 'glow', g: 'weapon', mir: true },
      { t: 'box', s: [0.3, 0.12, 0.03], p: [-0.9, 1.6, 1.07], m: 'dark', g: 'weapon', mir: true },
      { t: 'box', s: [0.5, 0.17, 0.03], p: [0.47, 1.58, 0.93], r3: [0, 38, 0], m: 'dark', g: 'weapon', mir: true },
      { t: 'box', s: [0.03, 0.14, 0.32], p: [-1.63, 1.58, 0.55], m: 'dark', g: 'weapon', mir: true },
      // twin guns: hex mantlets with glowing rings, barrels with muzzle sleeves
      { t: 'cyl', ax: 'x', r: 0.21, l: 0.32, seg: 6, p: [0.98, 1.47, 0.34], m: 'hull2', g: 'weapon', mir: true },
      { t: 'cyl', ax: 'x', r: 0.14, l: 0.03, seg: 12, p: [1.15, 1.47, 0.34], m: 'glow', g: 'weapon', mir: true },
      { t: 'cyl', ax: 'x', r: 0.07, l: 0.78, seg: 8, p: [1.52, 1.47, 0.34], m: 'metal', g: 'weapon', mir: true },
      { t: 'cyl', ax: 'x', r: 0.095, l: 0.34, seg: 8, p: [1.73, 1.47, 0.34], m: 'dark', g: 'weapon', mir: true },
      { t: 'cyl', ax: 'x', r: 0.055, l: 0.02, seg: 10, p: [1.905, 1.47, 0.34], m: 'glow', g: 'weapon', mir: true },
      // sensor pods with three lenses, small guns, antennas
      { t: 'cyl', ax: 'y', r: 0.08, l: 0.14, seg: 8, p: [-0.95, 1.9, 0.56], m: 'dark', g: 'weapon', mir: true },
      { t: 'box', s: [0.42, 0.24, 0.4], p: [-0.95, 2.06, 0.56], m: 'hull', g: 'weapon', mir: true },
      { t: 'box', s: [0.03, 0.16, 0.34], p: [-0.73, 2.06, 0.56], m: 'dark', g: 'weapon', mir: true },
      ...[-0.11, 0, 0.11].map((dz) => ({ t: 'cyl', ax: 'x', r: 0.045, l: 0.03, seg: 10, p: [-0.71, 2.06, 0.56 + dz], m: 'glow', g: 'weapon', mir: true })),
      { t: 'cyl', ax: 'x', r: 0.035, l: 0.42, seg: 6, p: [-0.5, 2.0, 0.78], m: 'dark', g: 'weapon', mir: true },
      { t: 'cyl', ax: 'y', r: 0.012, l: 0.32, seg: 4, p: [-1.05, 2.34, 0.64], m: 'dark', g: 'weapon', mir: true },
    ];
    parts.push(...radarDish({ x: -1.32, y: 1.9, z: 0, mast: 0.2, r: 0.26 }));
    M.tank = { name: 'Twin-barrel MBT', unit: 'GND-Tanks', ref: 'tank', parts, pivots: { weapon: [-0.35, 1.22, 0], head: [-1.32, 1.9, 0] }, head: { mode: 'sweep' },
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
      { t: 'cyl', ax: 'y', r: 0.26, l: 0.16, seg: 10, p: [-0.85, 1.76, 0], m: 'dark', g: 'weapon' },
      { t: 'box', s: [0.52, 0.24, 0.5], p: [-0.82, 1.95, 0], m: 'hull', g: 'weapon' },
      { t: 'cyl', ax: 'z', r: 0.15, l: 0.16, seg: 8, p: [-0.84, 1.95, 0.32], m: 'hull2', g: 'weapon', mir: true },
      { t: 'box', s: [0.2, 0.1, 0.2], p: [-0.88, 2.11, 0], m: 'dark', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: 0.12, l: 0.06, seg: 12, p: [-0.54, 1.97, 0], m: 'black', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: 0.06, l: 0.02, seg: 10, p: [-0.505, 1.97, 0], m: 'glowB', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: 0.05, l: 0.2, seg: 8, p: [-0.42, 1.9, 0], m: 'metal', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: 0.04, l: 0.34, seg: 8, p: [-0.15, 1.9, 0], m: 'glow', g: 'weapon' },
      { t: 'cyl', ax: 'x', r: 0.055, l: 0.1, seg: 8, p: [0.06, 1.9, 0], m: 'metal', g: 'weapon' },
    ];
    // ── detail pass 2026-10-15 (from sheet_buggy: panel seams, emblems, sensor array, tyre tread, shocks, rear louvres)
    const SIDE = (y) => 0.95 + (y - 0.85) / 0.45 * 0.23;          // mid-band side wall z at height y
    const tread = (x) => Array.from({ length: 12 }, (_, i) => {
      const a = i / 12 * Math.PI * 2;
      return { t: 'box', s: [0.09, 0.06, 0.42], p: [x + Math.cos(a) * 0.31, 0.31 + Math.sin(a) * 0.31, 1.16], r3: [0, 0, a * 180 / Math.PI], m: 'black', mir: true, d: 1 };
    });
    const lugs = (x) => Array.from({ length: 5 }, (_, i) => {
      const a = i / 5 * Math.PI * 2;
      return { t: 'cyl', ax: 'z', r: 0.022, l: 0.44, seg: 6, p: [x + Math.cos(a) * 0.09, 0.31 + Math.sin(a) * 0.09, 1.16], m: 'dark', mir: true, d: 1 };
    });
    const chevron = (x) => [-1, 1].map((s) => ({ t: 'box', s: [0.2, 0.012, 0.06], p: [x + 0.04, 1.5, 0.9 + s * 0.06], r3: [-35, s * 35, 0], m: 'dark', mir: true, d: 1 }));
    parts.push(
      // roof + side panel seams
      ...[-1.2, -0.3, 0.55].map((x) => ({ t: 'box', s: [0.025, 0.012, 1.16], p: [x, 1.695, 0], m: 'dark', d: 1 })),
      ...[-1.05, 0.15, 0.95].map((x) => ({ t: 'box', s: [0.025, 0.5, 0.02], p: [x, 1.075, SIDE(1.075) + 0.012], r3: [27, 0, 0], m: 'dark', mir: true, d: 1 })),
      { t: 'box', s: [2.6, 0.02, 0.02], p: [-0.35, 1.2, SIDE(1.2) + 0.012], r3: [27, 0, 0], m: 'dark', mir: true, d: 1 },
      ...chevron(-0.2), ...chevron(-0.05),
      // windshield frame: centre post + side rails
      ...[0, 0.41, -0.41].map((z) => ({ t: 'box', s: [1.0, 0.035, z ? 0.05 : 0.04], p: [1.02, 1.52, z], r3: [0, 0, -15.7], m: 'dark' })),
      // front sensor array: six ringed lenses, amber marker, headlights, bumper block
      ...[0.18, 0.32, 0.46].flatMap((z) => [
        { t: 'cyl', ax: 'x', r: 0.055, l: 0.04, seg: 10, p: [1.97, 0.97, z], m: 'black', mir: true },
        { t: 'cyl', ax: 'x', r: 0.032, l: 0.02, seg: 8, p: [1.995, 0.97, z], m: z === 0.46 ? 'amber' : 'glowB', mir: true },
      ]),
      { t: 'box', s: [0.05, 0.05, 0.26], p: [1.88, 1.1, 0.42], m: 'glow', mir: true },
      { t: 'box', s: [0.2, 0.22, 0.5], p: [1.86, 0.58, 0], m: 'dark' },
      { t: 'box', s: [0.02, 0.03, 0.2], p: [1.97, 0.62, 0], m: 'glowB' },
      // wheels: knobbly tread, lug nuts; shock absorbers to the body
      ...tread(-1.4), ...tread(1.13), ...lugs(-1.4), ...lugs(1.13),
      ...[-1.4, 1.13].flatMap((x) => [
        seg([x + (x < 0 ? 0.25 : -0.25), 0.88, 0.75], [x, 0.45, 0.98], 0.06, 0.06, 'metal', { mir: true }),
        seg([x + (x < 0 ? 0.2 : -0.2), 0.78, 0.8], [x + (x < 0 ? 0.08 : -0.08), 0.56, 0.93], 0.1, 0.1, 'black', { mir: true }),
      ]),
      // wheel pods: seam + marker light on the outer face
      ...[-1.4, 1.12].flatMap((x) => [
        { t: 'box', s: [0.02, 0.4, 0.015], p: [x, 0.68, 1.405], m: 'dark', mir: true, d: 1 },
        { t: 'box', s: [0.14, 0.04, 0.02], p: [x + (x < 0 ? -0.3 : 0.3), 0.78, 1.405], m: x < 0 ? 'glowR' : 'amber', mir: true },
      ]),
      // rear: louvres over the vents, centre hatch with plate, tail lights
      ...[0, 1, 2, 3].map((i) => ({ t: 'box', s: [0.06, 0.025, 0.36], p: [-1.97, 0.84 + i * 0.08, 0.42], m: 'dark', mir: true })),
      { t: 'box', s: [0.05, 0.34, 0.36], p: [-1.96, 0.98, 0], m: 'hull2' },
      { t: 'box', s: [0.02, 0.08, 0.18], p: [-1.99, 1.02, 0], m: 'dark' },
      { t: 'box', s: [0.03, 0.06, 0.16], p: [-1.95, 1.12, 0.72], m: 'glowR', mir: true },
      // roof: louvres behind the turret, whip antenna
      ...[0, 1, 2, 3].map((i) => ({ t: 'box', s: [0.06, 0.03, 0.6], p: [-1.5 + i * 0.1, 1.705, 0], m: 'dark' })),
      { t: 'cyl', ax: 'y', r: 0.04, l: 0.06, seg: 6, p: [-1.72, 1.72, -0.5], m: 'dark' },
      { t: 'cyl', ax: 'y', r: 0.012, l: 0.7, seg: 4, p: [-1.72, 2.07, -0.5], m: 'metal' },
      { t: 'cyl', ax: 'y', r: 0.025, l: 0.04, seg: 6, p: [-1.72, 2.43, -0.5], m: 'glowR' },
      // turret: barrel cooling rings + muzzle, side seams
      ...[-0.27, -0.15, -0.03].map((x) => ({ t: 'cyl', ax: 'x', r: 0.058, l: 0.03, seg: 8, p: [x, 1.9, 0], m: 'metal', g: 'weapon' })),
      { t: 'cyl', ax: 'x', r: 0.07, l: 0.06, seg: 8, p: [0.14, 1.9, 0], m: 'dark', g: 'weapon' },
      { t: 'box', s: [0.02, 0.2, 0.505], p: [-0.95, 1.95, 0], m: 'dark', g: 'weapon', d: 1 },
    );
    parts.push(...barRadar({ x: -0.98, y: 2.16, z: 0, mast: 0.16, w: 0.56 }));
    M.buggy = { name: 'SR-07 scout', unit: 'GND-Trucks', ref: 'buggy', parts, pivots: { weapon: [-0.85, 1.69, 0], head: [-0.98, 2.16, 0] }, head: { mode: 'spin', speed: 2.4 }, views: { side: 'right', top: 'down' } };
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
    M.beetle = { name: 'Stag tracker', unit: 'GRN-Tanks', ref: 'beetle', parts, pivots: {}, views: { side: 'left', top: 'right' } };
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
    M.jet = { name: 'FS-217 striker', unit: 'GND-Planes', ref: 'jet', parts, pivots: {}, hover: 1.4, views: { side: 'left', top: 'up' } };
  }


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
    const EL = 8;                          // barrel elevation, degrees (fixed: the turret layer only yaws)
    for (const q of parts) if (q.el) {
      const dx = q.p[0] - P[0], dy = q.p[1] - P[1], c = Math.cos(EL * D), sn = Math.sin(EL * D);
      q.p = [P[0] + dx * c - dy * sn, P[1] + dx * sn + dy * c, q.p[2]]; q.r3 = [0, 0, EL]; delete q.el;
    }
    M.sys_cannon = { name: 'Cannon tower', unit: 'SYS-Cannon', ref: 'sys_cannon', parts,
      pivots: { weapon: T, head: [-0.85, 1.72, -0.3] },
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
        { t: 'cyl', ax: 'x', r: 0.15, l: 0.5, seg: 10, p: [1.02, 1.66, z], m: 'brass', g: 'weapon' },
        { t: 'cyl', ax: 'x', r: 0.085, l: 1.4, seg: 8, p: [1.85, 1.66, z], m: 'dark', g: 'weapon' },
        { t: 'cyl', ax: 'x', r: 0.12, l: 0.16, seg: 8, p: [2.5, 1.66, z], m: 'gunD', g: 'weapon' },
        { t: 'cyl', ax: 'x', r: 0.06, l: 0.02, seg: 8, p: [2.59, 1.66, z], m: 'amber', g: 'weapon' },
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
    M.sys_flak = { name: 'Anti-air (flak) tower', unit: 'SYS-Flak', ref: 'sys_flak', parts, pivots: { weapon: [0, 1.0, 0], head: [-0.3, 1.62, 0] }, head: { mode: 'sweep' },
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
        { t: 'cyl', ax: 'x', r: 0.2, l: 2.8, seg: 12, p: c, r3: [0, 0, A], m: 'bone', g: 'weapon' },
        { t: 'cyl', ax: 'x', r: [0.02, 0.2], l: 0.66, seg: 12, p: at(1.73), r3: [0, 0, A], m: 'accent', g: 'weapon' },
        { t: 'cyl', ax: 'x', r: 0.205, l: 0.07, seg: 12, p: at(0.5), r3: [0, 0, A], m: 'gun2', g: 'weapon' },
        { t: 'box', s: [0.42, 0.025, 0.6], p: at(-1.22), r3: [0, 0, A], m: 'bone', g: 'weapon' },
        { t: 'box', s: [0.42, 0.025, 0.6], p: at(-1.22), r3: [90, 0, A], m: 'bone', g: 'weapon' },
        { t: 'cyl', ax: 'x', r: [0.15, 0.12], l: 0.14, seg: 8, p: at(-1.45), r3: [0, 0, A], m: 'dark', g: 'weapon' },
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
      { t: 'box', s: [2.0, 0.12, 0.95], p: [C0[0] - n[0] * 0.02, C0[1] - n[1] * 0.02, 0], r3: [0, 0, A], m: 'gunD', g: 'weapon' },
      ...rocket(0.26, -0.24), ...rocket(0.26, 0.24), ...rocket(0.68, -0.24), ...rocket(0.68, 0.24),
    ];
    M.sys_rockets = { name: 'Rocket launcher', unit: 'SYS-Rockets', ref: 'sys_rockets', parts, pivots: { weapon: [0, 1.25, 0] }, views: { side: 'right', top: 'up' } };
  }
  root.UNIT_MODELS = M;
})(typeof window !== 'undefined' ? window : globalThis);
