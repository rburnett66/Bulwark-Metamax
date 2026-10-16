// ── Foliage sets: rock styles, tree families, ground cover. All low-poly, flat-coloured, merged. ─────────
// ctx = { R, place, C, V, LP, BIO, rocks, trees, cover, glow (Merge, unlit), BLOBS, SMALL, G (shared geometry) }
function foliageGeo() {
  return {
    trunk: new THREE.CylinderGeometry(0.05, 0.07, 1, 5), taper: new THREE.CylinderGeometry(0.012, 0.07, 1, 5), col6: new THREE.CylinderGeometry(1, 1, 1, 6),
    cone6: new THREE.ConeGeometry(1, 1, 6), cone4: new THREE.ConeGeometry(1, 1, 4), blade: new THREE.ConeGeometry(1, 1, 3, 1, true),
    oct: new THREE.OctahedronGeometry(1, 0), ico0: blob(0, 310, 0.18), icoG: [blob(0, 300, 0.15), blob(1, 301, 0.12)], hull: blob(1, 302, 0.1),
    slab: [blob(0, 320, 0.22), blob(0, 321, 0.22), blob(0, 322, 0.22)], shard: [blob(0, 330, 0.5), blob(0, 331, 0.5)],
  };
}
const pickW = (R, w) => { let t = 0; for (const k in w) t += w[k]; let r = R() * t; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return Object.keys(w)[0]; };
const pick = (R, a) => a[(R() * a.length) | 0];
// orient a Y-axis primitive along a direction: returns a Matrix4 for a part of length L, width w, centred on its span
function along(V, x, y, z, dir, L, w) {
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  return new THREE.Matrix4().compose(V(x + dir.x * L / 2, y + dir.y * L / 2, z + dir.z * L / 2), q, V(w, L, w));
}
const SNOW = '#f4f8fc';
// upright placement (no random tilt) for parts that other parts attach to
const U = (V, x, y, z, sx, sy, sz, ry = 0) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(sx, sy, sz));

// ── rocks ────────────────────────────────────────────────────────────────────────────────────────────────
// course: 0 base, 1 second, 2 third (only on interior plateau cells); kind: 'plateau' | 'rock' | 'stone'
function rockAt(ctx, x, z, course, kind) {
  const { R, place, C, V, LP, BIO, rocks, glow, BLOBS, SMALL, G } = ctx, st = BIO.rock, col = () => C(pick(R, LP.rock));
  const snowCap = (y, s) => { if (BIO.snow) rocks.add(G.ico0, place(x, y, z, s * 0.75, s * 0.22, s * 0.75), C(SNOW), 0.04); };
  if (kind === 'stone') { const s = 0.1 + R() * 0.1; rocks.add(SMALL[(R() * 3) | 0], place(x, s * 0.4, z, s, s * 0.75, s), C(LP.pebble), 0.08); return; }
  const big = kind === 'plateau', k = big ? 1 : 0.65;
  if (st === 'slab') {                        // layered mesa: flat slabs, strata alternate light/dark
    const s = (0.62 + R() * 0.2) * k, y = course * 0.4 + 0.18;
    rocks.add(pick(R, G.slab), U(V, x + (R() - 0.5) * 0.2, y * k, z + (R() - 0.5) * 0.2, s * 0.85, s * 0.34, s * 0.85, R() * 6.28), C(LP.rock[course % 2 ? 0 : 3]).multiplyScalar(0.95 + course * 0.05), 0.05);
    if (!big && R() < 0.5) rocks.add(SMALL[(R() * 3) | 0], place(x + R() * 0.5 - 0.25, 0.05, z + R() * 0.5 - 0.25, 0.14, 0.08, 0.14), C(LP.pebble), 0.08);
  } else if (st === 'column') {               // basalt: clustered hexagonal prisms with flat tops
    const n = big ? 3 + ((R() * 2) | 0) : 2, top = big ? [0.7, 1.25, 1.8][course] : 0.45;
    for (let i = 0; i < n; i++) { const r = 0.12 + R() * 0.08, h = top * (0.7 + R() * 0.45);
      rocks.add(G.col6, U(V, x + (R() - 0.5) * 0.55, h / 2, z + (R() - 0.5) * 0.55, r, h, r, R() * 1.05), col(), 0.06); }
  } else if (st === 'hoodoo') {               // sandstone: stacked, narrowing blobs with a wider cap
    const stack = big ? 2 + course : 1 + (R() < 0.5 ? 1 : 0), s0 = (0.4 + R() * 0.15) * k; let y = 0;
    for (let i = 0; i < stack; i++) { const s = s0 * (1 - i * 0.18); rocks.add(pick(R, BLOBS), U(V, x, y + s * 0.42, z, s, s * 0.85, s, R() * 6.28), C(LP.rock[i % 4]), 0.05); y += s * 0.78; }
    rocks.add(pick(R, G.slab), U(V, x, y + 0.06, z, s0 * 0.95, s0 * 0.28, s0 * 0.95, R() * 6.28), C(LP.rock[3]).multiplyScalar(1.05), 0.05);
  } else if (st === 'ice' || st === 'shard') { // sharp tilted shards (ice: pale and snow-capped)
    const n = big ? 2 : 1;
    for (let i = 0; i < n; i++) { const s = (0.32 + R() * 0.18) * k, h = s * (1.6 + R() * 1.2) * (1 + course * 0.35);
      const m = place(x + (R() - 0.5) * 0.4, h * 0.42, z + (R() - 0.5) * 0.4, s, h, s * 0.8); rocks.add(pick(R, G.shard), m, col(), 0.07); }
    if (big) { const s = 0.5 + R() * 0.2; rocks.add(pick(R, BLOBS), place(x, s * 0.4, z, s, s * 0.7, s), col(), 0.06); snowCap(s * 0.72, s); }
  } else if (st === 'crystal') {              // boulder + rising crystal cluster, glowing tips
    const s = (0.45 + R() * 0.2) * k; rocks.add(pick(R, BLOBS), place(x, s * 0.42, z, s, s * 0.8, s), col(), 0.06);
    if (big || R() < 0.5) crystals(ctx, x, z, big ? 0.8 + course * 0.45 : 0.6);
  } else {                                    // round: the original faceted boulders
    const s = big ? 0.62 + R() * 0.22 - course * 0.12 : 0.42 + R() * 0.2, y = big ? [s * 0.55, 0.95 + R() * 0.35, 1.55 + R() * 0.3][course] : s * 0.5;
    rocks.add(pick(R, BLOBS), place(x + (R() - 0.5) * 0.3, y, z + (R() - 0.5) * 0.3, s * (big ? 1 : 1.1), s * (big ? 0.85 + R() * 0.25 : 0.85), s), big ? C(pick(R, LP.rock)).multiplyScalar(1 + course * 0.05) : C(LP.rockB), 0.06);
    if (!big && R() < 0.6) { const s2 = 0.22 + R() * 0.12; rocks.add(SMALL[(R() * 3) | 0], place(x + R() * 0.5 - 0.25, s2 * 0.4, z + R() * 0.5 - 0.25, s2, s2 * 0.8, s2), C(LP.pebble), 0.08); }
    snowCap(y + s * 0.62, s);
  }
}
function crystals(ctx, x, z, H) {
  const { R, C, V, BIO, rocks, glow, G } = ctx, n = 3 + ((R() * 3) | 0), cols = BIO.crystal || ['#c8e8ff'];
  for (let i = 0; i < n; i++) {
    const a = R() * 6.28, tilt = 0.1 + R() * 0.45, dir = V(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a)), L = H * (0.5 + R() * 0.6), w = 0.06 + R() * 0.06;
    const ox = x + Math.cos(a) * 0.08, oz = z + Math.sin(a) * 0.08, cc = C(pick(R, cols));
    rocks.add(G.oct, along(V, ox, -0.05, oz, dir, L, w), cc, 0.1);
    if (BIO.crystalGlow) glow.add(G.oct, along(V, ox + dir.x * L * 0.62, -0.05 + dir.y * L * 0.62, oz + dir.z * L * 0.62, dir, L * 0.36, w * 0.55), cc.clone().lerp(C('#ffffff'), 0.35), 0.05);
  }
}

// ── trees ────────────────────────────────────────────────────────────────────────────────────────────────
function treeAt(ctx, x, z, s, fam) {
  const { R, place, C, V, LP, BIO, trees, glow, G } = ctx;
  fam = fam || pickW(R, BIO.trees);
  const ry = R() * 6.28;
  const dead = () => C(pick(R, LP.deadwood || [LP.trunk]));
  if (fam === 'round') {
    const h = (0.75 + R() * 0.35) * s, rc = (0.42 + R() * 0.16) * s;
    trees.add(G.trunk, place(x, h * 0.5, z, s, h, s, ry), C(LP.trunk), 0.05);
    for (const d of [-1, 1]) trees.add(G.trunk, new THREE.Matrix4().compose(V(x + d * 0.12 * s * Math.cos(ry), h * 0.78, z - d * 0.12 * s * Math.sin(ry)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, d * 0.6)), V(s * 0.8, h * 0.45, s * 0.8)), C(LP.trunk), 0.05);
    trees.add(pick(R, G.icoG), place(x, h + rc * 0.75, z, rc, rc * 0.95, rc), C(R() < 0.08 ? LP.rare : pick(R, LP.canopy)), 0.1);
  } else if (fam === 'broad') {               // green canopy tree: thick trunk, a crown of 3–5 overlapping blobs
    const h = (0.8 + R() * 0.35) * s, n = 3 + ((R() * 3) | 0), base = C(pick(R, LP.broad || LP.canopy));
    trees.add(G.trunk, U(V, x, h * 0.5, z, s * 1.5, h, s * 1.5, ry), C(LP.trunk), 0.05);
    trees.add(pick(R, G.icoG), place(x, h + 0.22 * s, z, 0.46 * s, 0.4 * s, 0.46 * s), base.clone().multiplyScalar(0.85), 0.1);
    for (let i = 0; i < n; i++) { const a = ry + i * 6.28 / n, r = (0.26 + R() * 0.12) * s;
      trees.add(pick(R, G.icoG), place(x + Math.cos(a) * 0.26 * s, h + (0.12 + R() * 0.3) * s, z + Math.sin(a) * 0.26 * s, r, r * 0.9, r), base.clone().multiplyScalar(0.92 + R() * 0.2), 0.1); }
    if (BIO.bloom && R() < 0.25) for (let i = 0; i < 4; i++) { const a = R() * 6.28; trees.add(G.ico0, place(x + Math.cos(a) * 0.4 * s, h + (0.3 + R() * 0.25) * s, z + Math.sin(a) * 0.4 * s, 0.05 * s, 0.05 * s, 0.05 * s), C(LP.rare), 0.05); }
  } else if (fam === 'pine') {
    const n = 2 + (R() < 0.5 ? 1 : 0), H = (1.2 + R() * 0.6) * s, col = C(pick(R, LP.pine));
    trees.add(G.trunk, place(x, 0.15 * s, z, s, 0.3 * s, s, ry), C(LP.trunk), 0.05);
    for (let k = 0; k < n; k++) { const w = (0.42 - k * 0.1) * s, hh = H * (0.55 - k * 0.08), y0 = 0.25 * s + k * H * 0.26;
      trees.add(G.cone6, new THREE.Matrix4().compose(V(x, y0 + hh / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry + k, 0)), V(w, hh, w)), col.clone().multiplyScalar(1 + k * 0.08), 0.12);
      if (BIO.snow) trees.add(G.cone6, new THREE.Matrix4().compose(V(x, y0 + hh * 0.72, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry + k, 0)), V(w * 0.62, hh * 0.46, w * 0.62)), C(SNOW), 0.04); }
  } else if (fam === 'bloom') {               // flowering bush: leafy mound studded with blossoms
    const n = 2 + ((R() * 2) | 0), leaf = C(LP.bush || pick(R, LP.pine)), cols = BIO.bloom || ['#ffffff'], out = BIO.bloomGlow ? glow : trees;
    for (let i = 0; i < n; i++) { const a = R() * 6.28, r = (0.17 + R() * 0.1) * s, bx = x + Math.cos(a) * 0.12 * s, bz = z + Math.sin(a) * 0.12 * s;
      trees.add(G.ico0, place(bx, r * 0.72, bz, r, r * 0.85, r), leaf.clone().multiplyScalar(0.9 + R() * 0.2), 0.12);
      for (let f = 0; f < 3; f++) { const fa = R() * 6.28, fe = 0.25 + R() * 1.1, fr = 0.045 + R() * 0.03;
        out.add(G.oct, place(bx + Math.cos(fa) * Math.cos(fe) * r, r * 0.72 + Math.sin(fe) * r * 0.85, bz + Math.sin(fa) * Math.cos(fe) * r, fr * s, fr * s, fr * s), C(pick(R, cols)), 0.06); } }
  } else if (fam === 'spike') {               // barren spike tree: tapered trunk, thorn branches angled up
    const h = (1.0 + R() * 0.6) * s, col = dead(), n = 5 + ((R() * 4) | 0);
    trees.add(G.taper, U(V, x, h / 2, z, s * 1.5, h, s * 1.5, ry), col, 0.06);
    for (let i = 0; i < n; i++) { const yy = h * (0.25 + R() * 0.65), a = R() * 6.28, el = 0.3 + R() * 0.6, L = (0.3 + R() * 0.4) * s * (1.2 - yy / h * 0.5);
      const dir = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      trees.add(G.cone4, along(V, x, yy, z, dir, L, 0.055 * s), col.clone().multiplyScalar(0.9 + R() * 0.2), 0.06);
      if (BIO.emberTips && R() < 0.35) glow.add(G.oct, place(x + dir.x * L, yy + dir.y * L, z + dir.z * L, 0.03 * s, 0.03 * s, 0.03 * s), C(pick(R, BIO.emberTips)), 0.05); }
  } else if (fam === 'snag') {                // dead snag: short broken trunk, leaning, two stubs
    const h = (0.45 + R() * 0.45) * s, col = dead(), lean = (R() - 0.5) * 0.5;
    const m = new THREE.Matrix4().compose(V(x, h / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, ry, -lean * 0.6)), V(s * 1.6, h, s * 1.6));
    trees.add(G.trunk, m, col, 0.06);
    for (let i = 0; i < 2; i++) { const a = R() * 6.28, dir = V(Math.cos(a), 0.6 + R() * 0.6, Math.sin(a)); trees.add(G.taper, along(V, x, h * (0.45 + R() * 0.35), z, dir, (0.14 + R() * 0.16) * s, 0.9 * s), col, 0.06); }
  } else if (fam === 'cactus') {              // saguaro: ribbed column, 0–2 arms, sometimes a flower
    const h = (0.6 + R() * 0.55) * s, r = 0.085 * s, col = C(pick(R, LP.cactus || LP.pine));
    trees.add(G.col6, U(V, x, h / 2, z, r, h, r, ry), col, 0.06); trees.add(G.ico0, U(V, x, h, z, r, r * 0.8, r), col, 0.06);
    const arms = (R() * 3) | 0;
    for (let i = 0; i < arms; i++) { const a = ry + i * Math.PI, ya = h * (0.35 + R() * 0.25), L = 0.17 * s, up = (0.2 + R() * 0.2) * s, ax = x + Math.cos(a) * L, az = z + Math.sin(a) * L;
      trees.add(G.col6, along(V, x, ya, z, V(Math.cos(a), 0, Math.sin(a)), L, r * 0.7), col, 0.06);
      trees.add(G.col6, U(V, ax, ya + up / 2, az, r * 0.7, up, r * 0.7), col, 0.06); trees.add(G.ico0, U(V, ax, ya + up, az, r * 0.7, r * 0.55, r * 0.7), col, 0.06); }
    if (BIO.bloom && R() < 0.3) trees.add(G.ico0, U(V, x, h + r * 0.7, z, r * 0.6, r * 0.5, r * 0.6), C(pick(R, BIO.bloom)), 0.05);
  } else if (fam === 'acacia') {              // flat-top: forked thin trunk, wide flat crown
    const h = (0.85 + R() * 0.35) * s, rc = (0.45 + R() * 0.15) * s, barren = BIO.lush < 0.2;
    for (const d of [-1, 1]) { const dir = V(d * 0.35 * Math.cos(ry), 1, -d * 0.35 * Math.sin(ry)); trees.add(G.taper, along(V, x, 0, z, dir, h, 0.9 * s), C(barren ? pick(R, LP.deadwood) : LP.trunk), 0.05); }
    if (!barren) trees.add(pick(R, G.icoG), U(V, x, h + 0.04 * s, z, rc * 1.5, rc * 0.32, rc * 1.5, ry), C(pick(R, LP.canopy)), 0.1);
    else for (let i = 0; i < 4; i++) { const a = R() * 6.28; trees.add(G.cone4, along(V, x, h * 0.9, z, V(Math.cos(a), 0.25, Math.sin(a)), rc * 0.9, 0.03 * s), C(pick(R, LP.deadwood)), 0.06); }
  } else if (fam === 'mushroom') {            // giant fungus: pale stalk, broad cap, dark gills, glowing spots
    const h = (0.6 + R() * 0.8) * s, rc = (0.3 + R() * 0.25) * s, lean = (R() - 0.5) * 0.3, cap = C(pick(R, LP.canopy));
    trees.add(G.col6, new THREE.Matrix4().compose(V(x, h / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, 0, lean)), V(0.07 * s, h, 0.07 * s)), C(LP.trunk), 0.05);
    const cx = x + Math.sin(lean) * h * 0.5, cz = z - Math.sin(lean) * h * 0.5;
    trees.add(G.hull, U(V, cx, h - 0.02 * s, cz, rc * 0.85, rc * 0.14, rc * 0.85), cap.clone().multiplyScalar(0.45), 0.05);
    trees.add(G.hull, U(V, cx, h + rc * 0.1, cz, rc, rc * 0.42, rc), cap, 0.08);
    const cols = BIO.glow || ['#ffffff'];
    for (let i = 0; i < 4 + ((R() * 4) | 0); i++) { const a = R() * 6.28, rr = R() * 0.75; glow.add(G.oct, place(cx + Math.cos(a) * rc * rr, h + rc * 0.1 + rc * 0.42 * Math.sqrt(1 - rr * rr) * 0.95, cz + Math.sin(a) * rc * rr, 0.035 * s, 0.02 * s, 0.035 * s), C(pick(R, cols)), 0.05); }
  } else if (fam === 'crystal') {
    crystals(ctx, x, z, (0.9 + R() * 0.7) * s);
  } else if (fam === 'pod') {                 // spore pods: swollen bulbs on short stalks, glowing toxic spots
    const n = 1 + ((R() * 3) | 0), cols = LP.pod || LP.canopy, tox = BIO.toxic || BIO.glow || ['#d8ff3a'];
    for (let i = 0; i < n; i++) { const a = R() * 6.28, d = i ? 0.18 * s : 0, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, hs = (0.15 + R() * 0.3) * s, r = (0.16 + R() * 0.16) * s;
      trees.add(G.col6, U(V, px, hs / 2, pz, 0.045 * s, hs, 0.045 * s), C(LP.trunk), 0.05);
      trees.add(G.hull, U(V, px, hs + r * 1.05, pz, r, r * 1.35, r, R() * 6.28), C(pick(R, cols)), 0.1);
      for (let k = 0; k < 3 + ((R() * 3) | 0); k++) { const fa = R() * 6.28, fe = (R() - 0.3) * 1.2; glow.add(G.oct, place(px + Math.cos(fa) * Math.cos(fe) * r * 1.02, hs + r * 1.05 + Math.sin(fe) * r * 1.35, pz + Math.sin(fa) * Math.cos(fe) * r * 1.02, 0.03 * s, 0.03 * s, 0.03 * s), C(pick(R, tox)), 0.05); } }
  } else if (fam === 'hive') {                // hive mound: lumpy tapering stack with glowing openings
    const tiers = 3 + ((R() * 2) | 0), s0 = (0.32 + R() * 0.12) * s, cols = LP.hive || LP.rock; let y = 0;
    for (let i = 0; i < tiers; i++) { const r = s0 * (1 - i * 0.2); trees.add(G.hull, U(V, x + (R() - 0.5) * 0.05, y + r * 0.45, z + (R() - 0.5) * 0.05, r, r * 0.8, r, R() * 6.28), C(pick(R, cols)), 0.08);
      for (let k = 0; k < 2; k++) { const a = R() * 6.28; glow.add(G.oct, U(V, x + Math.cos(a) * r * 0.92, y + r * 0.45, z + Math.sin(a) * r * 0.92, 0.04 * s, 0.03 * s, 0.04 * s), C(pick(R, BIO.glow || ['#d8ff3a'])), 0.05); }
      y += r * 0.62; }
  } else if (fam === 'spire') {               // needle spire: tall faceted rock blade on a boulder foot
    const h = (1.1 + R() * 1.3) * s, w = (0.1 + R() * 0.06) * s, tilt = (R() - 0.5) * 0.25, col = C(pick(R, LP.spire || LP.rock));
    trees.add(G.oct, new THREE.Matrix4().compose(V(x, h * 0.5, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, R() * 6.28, -tilt)), V(w, h * 0.5, w * 0.8)), col, 0.08);
    trees.add(pick(R, G.icoG), place(x, 0.08 * s, z, 0.22 * s, 0.16 * s, 0.22 * s), col.clone().multiplyScalar(0.9), 0.06);
  }
}

// ── ground cover (walkable cells; decoration only) ──────────────────────────────────────────────────────
function coverAt(ctx, x, z, kind, baseCol) {
  const { R, place, C, V, LP, BIO, cover, glow, G, SMALL } = ctx;
  if (kind === 'grass') {
    for (let b = 0; b < 3; b++) { const h = 0.16 + R() * 0.14, a = R() * 6.28;
      cover.add(G.blade, new THREE.Matrix4().compose(V(x + Math.cos(a) * 0.04, h / 2, z + Math.sin(a) * 0.04), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.cos(a) * 0.35, a, Math.sin(a) * 0.35)), V(0.025, h, 0.025)), baseCol.clone().lerp(C(LP.tuft), 0.35).multiplyScalar(0.95 + R() * 0.3), 0.05); }
  } else if (kind === 'flower') {
    const cols = BIO.bloom || ['#ffffff'], out = BIO.bloomGlow ? glow : cover;
    for (let b = 0; b < 3; b++) { const h = 0.1 + R() * 0.1, a = R() * 6.28, fx = x + Math.cos(a) * 0.07, fz = z + Math.sin(a) * 0.07;
      cover.add(G.blade, U(V, fx, h / 2, fz, 0.01, h, 0.01), baseCol.clone().multiplyScalar(0.8), 0.05);
      out.add(G.oct, U(V, fx, h, fz, 0.035, 0.03, 0.035), C(pick(R, cols)), 0.08); }
  } else if (kind === 'scrub') {              // dry twigs splayed from one point
    const col = C(LP.twig || LP.trunk);
    for (let b = 0; b < 5; b++) { const a = R() * 6.28, el = 0.6 + R() * 0.6; cover.add(G.blade, along(V, x, 0, z, V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)), 0.12 + R() * 0.14, 0.012), col.clone().multiplyScalar(0.85 + R() * 0.3), 0.05); }
  } else if (kind === 'pebble') {
    for (let b = 0; b < 2; b++) { const s = 0.04 + R() * 0.06; cover.add(pick(R, SMALL), place(x + (R() - 0.5) * 0.3, s * 0.3, z + (R() - 0.5) * 0.3, s, s * 0.7, s), C(LP.pebble).multiplyScalar(0.85 + R() * 0.25), 0.08); }
  } else if (kind === 'shard') {
    const s = 0.05 + R() * 0.05; cover.add(G.oct, place(x, s * 0.8, z, s * 0.6, s * 1.8, s * 0.6), C(pick(R, BIO.crystal || [LP.pebble])), 0.08);
  } else if (kind === 'bubble') {             // toxic pustules: glowing blisters on the ground
    for (let b = 0; b < 3; b++) { const s = 0.025 + R() * 0.03; glow.add(G.ico0, U(V, x + (R() - 0.5) * 0.3, s * 0.3, z + (R() - 0.5) * 0.3, s, s * 0.6, s), C(pick(R, BIO.toxic || BIO.glow || ['#d8ff3a'])), 0.08); }
  } else if (kind === 'crater') {             // small impact crater: dark floor + raised rim of stones
    const r = 0.22 + R() * 0.2;
    cover.add(G.col6, U(V, x, 0.004, z, r, 0.008, r, R() * 6.28), baseCol.clone().multiplyScalar(0.62), 0.04);
    for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28 + R() * 0.3, sr = 0.05 + R() * 0.04; cover.add(pick(R, SMALL), place(x + Math.cos(a) * r, sr * 0.25, z + Math.sin(a) * r, sr * 1.3, sr * 0.6, sr), baseCol.clone().multiplyScalar(1.12), 0.06); }
  } else if (kind === 'sprout') {             // glowing alien sprouts: dark stem, lit bulb
    for (let b = 0; b < 2; b++) { const h = 0.14 + R() * 0.18, a = R() * 6.28, sx = x + Math.cos(a) * 0.06, sz = z + Math.sin(a) * 0.06;
      cover.add(G.blade, U(V, sx, h / 2, sz, 0.014, h, 0.014), baseCol.clone().multiplyScalar(0.6), 0.05);
      glow.add(G.oct, U(V, sx, h, sz, 0.03, 0.04, 0.03), C(pick(R, BIO.glow || ['#ffffff'])), 0.06); }
  }
}
