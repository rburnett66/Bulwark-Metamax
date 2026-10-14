// Primitive model builder: a unit is a list of simple parts (box, cylinder, extruded profile, loft, ellipsoid),
// each with a material key. Parts are merged per material into a few meshes (body + turret group), flat-shaded.
// Axes: X forward (nose), Y up, Z right. 1 model unit ≈ 1/4 of the hull length (models are ~4 units long).
(function (root) {
  const D2R = Math.PI / 180;

  function flat(g) {                       // non-indexed + per-face normals → faceted look
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position') n.deleteAttribute(k);
    n.computeVertexNormals();
    return n;
  }
  function flipWinding(g) {
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals(); return g;
  }
  // polygon → THREE.Shape (ensures CCW)
  function shapeOf(poly) {
    let a = 0; for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; a += x1 * y2 - x2 * y1; }
    const P = a < 0 ? poly.slice().reverse() : poly;
    const sh = new THREE.Shape(); sh.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) sh.lineTo(P[i][0], P[i][1]);
    return sh;
  }
  function holeOf(poly) {
    let a = 0; for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; a += x1 * y2 - x2 * y1; }
    const P = a > 0 ? poly.slice().reverse() : poly;
    const h = new THREE.Path(); h.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) h.lineTo(P[i][0], P[i][1]);
    return h;
  }
  // Extrude: polygon in the two axes other than `ax`, extruded over d=[a,b] along ax.
  //   ax 'z': poly (x,y)   ax 'y': poly (x,z)   ax 'x': poly (z,y)
  function extrude(pt) {
    const ax = pt.ax || 'z', [d0, d1] = pt.d;
    let poly = pt.poly, holes = pt.holes || [];
    if (ax === 'x') { poly = poly.map(([z, y]) => [-z, y]); holes = holes.map((h) => h.map(([z, y]) => [-z, y])); }
    const sh = shapeOf(poly); for (const h of holes) sh.holes.push(holeOf(h));
    const g = new THREE.ExtrudeGeometry(sh, { depth: d1 - d0, bevelEnabled: false, curveSegments: 1 });
    if (ax === 'z') g.translate(0, 0, d0);
    else if (ax === 'y') { g.rotateX(Math.PI / 2); g.translate(0, d1, 0); }       // (x, zz, e) → (x, -e, zz)
    else { g.rotateY(Math.PI / 2); g.translate(d0, 0, 0); }                          // (-z, y, e) → (e, y, z)
    return flat(g);
  }
  // Loft: closed cross-sections along an axis, all with the same point count. secs: [[at, [[u,v]...]], ...]
  //   ax 'x': (u,v) = (z,y)   ax 'y': (u,v) = (x,z)   ax 'z': (u,v) = (x,y)
  function loft(pt) {
    const ax = pt.ax || 'x', S = pt.secs, n = S[0][1].length, pos = [];
    // a section point may carry a third value: an offset along the loft axis (raked lips, swept edges)
    const P = (at0, [u, v, o = 0]) => { const at = at0 + o; return ax === 'x' ? [at, v, u] : ax === 'y' ? [u, at, v] : [u, v, at]; };
    const rings = S.map(([at, pts]) => pts.map((q) => P(at, q)));
    const cen = rings.map((r) => r.reduce((a, b) => [a[0] + b[0] / n, a[1] + b[1] / n, a[2] + b[2] / n], [0, 0, 0]));
    const tri = (a, b, c, ref) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const ox = a[0] - ref[0], oy = a[1] - ref[1], oz = a[2] - ref[2];
      if (nx * nx + ny * ny + nz * nz < 1e-14) return;
      if (nx * ox + ny * oy + nz * oz < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c);
    };
    for (let i = 0; i < rings.length - 1; i++) {
      const A = rings[i], Bb = rings[i + 1], ref = [(cen[i][0] + cen[i + 1][0]) / 2, (cen[i][1] + cen[i + 1][1]) / 2, (cen[i][2] + cen[i + 1][2]) / 2];
      for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; tri(A[k], A[k2], Bb[k2], ref); tri(A[k], Bb[k2], Bb[k], ref); }
    }
    if (pt.caps !== false) for (const [ri, dir] of [[0, -1], [rings.length - 1, 1]]) {
      const pts2 = S[ri][1].map(([u, v]) => new THREE.Vector2(u, v));
      const f = THREE.ShapeUtils.triangulateShape(pts2, []), R = rings[ri];
      // caps face away from the neighbouring section (works whichever way the sections run along the axis)
      const nb = cen[ri === 0 ? 1 : rings.length - 2], c = [2 * cen[ri][0] - nb[0], 2 * cen[ri][1] - nb[1], 2 * cen[ri][2] - nb[2]];
      const c2 = [cen[ri][0] * 2 - c[0], cen[ri][1] * 2 - c[1], cen[ri][2] * 2 - c[2]];   // = the neighbour side
      for (const [a, b, d] of f) tri(R[a], R[b], R[d], c2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  }
  function cyl(pt) {
    const r = Array.isArray(pt.r) ? pt.r : [pt.r, pt.r];
    const g = new THREE.CylinderGeometry(r[0], r[1], pt.l, pt.seg || 8, 1, !!pt.open, pt.rot0 ? pt.rot0 * D2R : (pt.seg === 6 ? 0 : Math.PI / (pt.seg || 8)));
    // default axis Y; r[0] is the +end
    if (pt.ax === 'x') g.rotateZ(-Math.PI / 2); else if (pt.ax === 'z') g.rotateX(Math.PI / 2);
    return flat(g);
  }
  function ell(pt) {
    const seg = pt.seg || 10;
    const g = new THREE.SphereGeometry(1, seg, Math.max(3, seg >> 1), pt.phi ? pt.phi[0] * D2R : 0, pt.phi ? pt.phi[1] * D2R : Math.PI * 2,
      0, pt.half ? Math.PI / 2 : Math.PI);
    g.scale(pt.s[0], pt.s[1], pt.s[2]);
    return flat(g);
  }
  function geomOf(pt) {
    switch (pt.t) {
      case 'box': return flat(new THREE.BoxGeometry(pt.s[0], pt.s[1], pt.s[2]));
      case 'cyl': return cyl(pt);
      case 'ext': return extrude(pt);
      case 'loft': return loft(pt);
      case 'ell': return ell(pt);
      default: throw new Error('unknown part ' + pt.t);
    }
  }
  // Build: returns { group, parts: {groupName: Object3D}, stats }
  function buildModel(def, mats) {
    const buckets = {};        // group → material → [arrays]
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let tris = 0;
    const add = (pt, mirror) => {
      let g = geomOf(pt);
      const r = pt.r3 || [0, 0, 0]; e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'YZX'); q.setFromEuler(e);
      const p = pt.p || [0, 0, 0];
      m4.compose(new THREE.Vector3(p[0], p[1], p[2]), q, new THREE.Vector3(1, 1, 1)); g.applyMatrix4(m4);
      if (mirror) { g.scale(1, 1, -1); flipWinding(g); }
      const grp = pt.g || 'body', mk = pt.m || 'hull';
      ((buckets[grp] = buckets[grp] || {})[mk] = buckets[grp][mk] || []).push(g.attributes.position.array, g.attributes.normal.array);
      tris += g.attributes.position.count / 3;
    };
    for (const pt of def.parts) { add(pt, false); if (pt.mir) add(pt, true); }
    const root = new THREE.Group(), groups = {};
    for (const [gname, byMat] of Object.entries(buckets)) {
      const G = new THREE.Group(); G.name = gname;
      const piv = (def.pivots && def.pivots[gname]) || [0, 0, 0];
      G.position.set(piv[0], piv[1], piv[2]);
      for (const [mk, arrs] of Object.entries(byMat)) {
        let len = 0; for (let i = 0; i < arrs.length; i += 2) len += arrs[i].length;
        const P = new Float32Array(len), N = new Float32Array(len); let o = 0;
        for (let i = 0; i < arrs.length; i += 2) { P.set(arrs[i], o); N.set(arrs[i + 1], o); o += arrs[i].length; }
        for (let i = 0; i < len; i += 3) { P[i] -= piv[0]; P[i + 1] -= piv[1]; P[i + 2] -= piv[2]; }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
        const mesh = new THREE.Mesh(geo, mats(mk)); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.mat = mk; G.add(mesh);
      }
      root.add(G); groups[gname] = G;
    }
    return { group: root, groups, tris };
  }

  // ── Helpers to author parts ─────────────────────────────────────────────────────────────────────────
  // Track loop (side profile with a hole), road wheels, optional glowing hubs.
  function track(o) {
    const { x0, x1, h, z, w, t = 0.09, rr = h * 0.5, wheels = 6, wr = h * 0.33, wy = wr + 0.02, hub = 'metal', glowHub = false } = o;
    const arc = (cx, cy, r, a0, a1, n) => { const out = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * D2R; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; };
    const outer = [...arc(x1 - rr, rr, rr, -90, 90, 4), ...arc(x0 + rr, rr, rr, 90, 270, 4)];
    const inner = [...arc(x1 - rr, rr, rr - t, -90, 90, 4), ...arc(x0 + rr, rr, rr - t, 90, 270, 4)];
    const parts = [{ t: 'ext', ax: 'z', poly: outer, holes: [inner], d: [z - w / 2, z + w / 2], m: 'track', mir: o.mir !== false }];
    // inner filler (dark) so the loop doesn't read hollow
    parts.push({ t: 'ext', ax: 'z', poly: inner, d: [z - w / 2 + 0.06, z + w / 2 - 0.06], m: 'black', mir: o.mir !== false });
    const span = (x1 - x0) - 2 * rr + 2 * wr * 0.9;
    for (let i = 0; i < wheels; i++) {
      const x = x0 + rr - wr * 0.9 + (wheels === 1 ? 0 : span * i / (wheels - 1)) + (o.wheelShift || 0);
      parts.push({ t: 'cyl', ax: 'z', r: wr, l: w + 0.04, seg: 10, p: [x, wy, z], m: 'dark', mir: o.mir !== false });
      parts.push({ t: 'cyl', ax: 'z', r: wr * 0.45, l: w + 0.08, seg: 8, p: [x, wy, z], m: glowHub ? 'glow' : hub, mir: o.mir !== false, d: glowHub ? 0 : 1 });
    }
    // sprocket + idler
    parts.push({ t: 'cyl', ax: 'z', r: rr - t * 1.1, l: w + 0.03, seg: 12, p: [x0 + rr, rr, z], m: 'dark', mir: o.mir !== false });
    parts.push({ t: 'cyl', ax: 'z', r: rr - t * 1.6, l: w + 0.03, seg: 10, p: [x1 - rr, rr, z], m: 'dark', mir: o.mir !== false });
    // tread cleats on the bottom run
    const nC = Math.round((x1 - x0) / 0.16);
    for (let i = 0; i < nC; i++) parts.push({ t: 'box', s: [0.05, 0.03, w + 0.02], p: [x0 + rr * 0.6 + (x1 - x0 - rr * 1.2) * i / (nC - 1), 0.015, z], m: 'black', mir: o.mir !== false, d: 1 });   // d: detail — dropped by LOD
    return parts;
  }
  root.Prims = { buildModel, track, geomOf };
})(typeof window !== 'undefined' ? window : globalThis);
