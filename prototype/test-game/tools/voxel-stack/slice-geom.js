/**
 * slice-geom — the SINGLE SOURCE OF TRUTH for Stack Forge slice placement + view↔voxel mapping.
 *
 * Why this file exists: the carve's placement math kept being "fixed" by eye and reverted. Three real bugs
 * shipped because nothing measured it — GEOAX's front/back flips were swapped (the Geometry box was drawn at
 * the opposite end of the grid from its voxels), the source block silently became a Layers-sized cube far
 * smaller than the grid, and slice scale-up was a no-op on whichever axis the contain-fit had already pinned.
 * Every one of those is pure arithmetic and provable in node. So the arithmetic lives HERE, DOM-free, and
 * slice-geom.test.mjs proves it — the rest of stack-forge.js is browser/PIXI-bound and can't be unit-tested.
 *
 * Loaded as a CLASSIC script in the browser (defines globals) AND importable in node for the test.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node (slice-geom.test.mjs)
  else Object.assign(root, api);                                               // browser: window.sliceRect, …
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // The contain-fit scale a slice is measured against: sx/sy of 1 means exactly this. Handles convert a
  // dragged pixel size back through it, so the sliders and the handles stay ONE number.
  const sliceBase = (kw, kh, boxW, boxH) => Math.min(boxW / (kw || 1), boxH / (kh || 1));

  // Where a slice lands on a boxW×boxH face. Owner's design: "the slice should be presented in the middle of
  // the face" — every slice, top and elevations alike, is CENTRED at the contain-fit and the artist moves it
  // from there with the on-slice handles. sx/sy scale about the centre; ox/oy slide as a fraction of the box.
  function sliceRect(kw, kh, boxW, boxH, xf) {
    const base = sliceBase(kw, kh, boxW, boxH), sx = (xf && xf.sx) || 1, sy = (xf && xf.sy) || 1;
    const pw = (kw || 1) * base * sx, ph = (kh || 1) * base * sy;
    return { px: (boxW - pw) / 2 + ((xf && xf.ox) || 0) * boxW, py: (boxH - ph) / 2 + ((xf && xf.oy) || 0) * boxH, pw, ph };
  }

  // Inverse of sliceRect: a dragged pixel rect → the imgXf that reproduces it EXACTLY. This is what makes an
  // edge/corner handle a stretch rather than a re-centre — the pinned edge must not move.
  function xfFromRect(kw, kh, boxW, boxH, r) {
    const base = sliceBase(kw, kh, boxW, boxH);
    return { sx: r.pw / ((kw || 1) * base), sy: r.ph / ((kh || 1) * base),
      ox: (r.px - (boxW - r.pw) / 2) / boxW, oy: (r.py - (boxH - r.ph) / 2) / boxH };
  }

  // Drag one handle. mode ∈ L,R,T,B,TL,TR,BL,BR. The opposite edge/corner stays pinned. (u,v) = pointer in
  // box-cell units. Returns the new rect; feed it through xfFromRect to get the imgXf.
  function dragHandle(mode, r0, u, v) {
    let px = r0.px, py = r0.py, pw = r0.pw, ph = r0.ph;
    if (mode.includes('L')) { const right = r0.px + r0.pw; px = Math.min(u, right - 0.5); pw = right - px; }
    if (mode.includes('R')) { pw = Math.max(0.5, u - r0.px); }
    if (mode.includes('T')) { const bot = r0.py + r0.ph; py = Math.min(v, bot - 0.5); ph = bot - py; }
    if (mode.includes('B')) { ph = Math.max(0.5, v - r0.py); }
    return { px, py, pw, ph };
  }

  // The SOURCE BLOCK. Owner: "if the carve were made to a solid block the block would never need to be bigger
  // in any dimension than the longest side .. use the base layers and turret layers to define a starting cube."
  // A space carve only REMOVES, so the block is a cube of side = that part's Layers, and the views carve it.
  // `reach` keeps a forward margin so a procedural barrel still has room to protrude.
  function autoSpans(foot, layers, reach) {
    const L = Math.max(1, Math.min(foot, layers | 0));
    const ox = clamp(Math.floor((foot - L - (reach || 0)) / 2), 0, foot - L), oy = Math.floor((foot - L) / 2);
    return { spanX: { lo: ox, hi: ox + L }, spanY: { lo: oy, hi: oy + L }, spanZ: { lo: 0, hi: L }, Hraw: L };
  }

  // Grid-view axis maps: (col,row,slice) → voxel. Each must be a BIJECTION over the grid, or cells alias and
  // the view shows repeated/wrong data. `angle` is the decor-only diagonal raycast and covers only the wedge
  // a (1,1) ray can reach — it is deliberately NOT onto.
  const axisMaps = (foot, layers) => ({
    top:   { cols: foot, rows: foot,   depth: layers, axis: 'z', onto: true,  toVox: (c, r, s) => [c, r, layers - 1 - s] },
    side:  { cols: foot, rows: layers, depth: foot,   axis: 'y', onto: true,  toVox: (c, r, s) => [c, s, layers - 1 - r] },
    front: { cols: foot, rows: layers, depth: foot,   axis: 'x', onto: true,  toVox: (c, r, s) => [foot - 1 - s, foot - 1 - c, layers - 1 - r] },
    back:  { cols: foot, rows: layers, depth: foot,   axis: 'x', onto: true,  toVox: (c, r, s) => [s, c, layers - 1 - r] },
    angle: { cols: foot, rows: layers, depth: foot,   axis: 'diag', onto: false,
      toVox: (c, r, s) => { const h = c - (foot >> 1), xs = Math.min(foot - 1, foot - 1 + h), x = xs - s; return [x, x - h, layers - 1 - r]; } },
  });

  // Geometry-overlay axes: which world axis each screen axis shows, and whether it runs backwards. These MUST
  // agree with axisMaps' toVox or the box is drawn away from the voxels it describes — front/back shipped
  // swapped exactly that way. slice-geom.test.mjs cross-checks the two tables against each other.
  const GEOAX = {
    top:   { col: { axis: 'x', flip: false }, row: { axis: 'y', flip: false } },
    side:  { col: { axis: 'x', flip: false }, row: { axis: 'z', flip: true } },
    front: { col: { axis: 'y', flip: true },  row: { axis: 'z', flip: true } },
    back:  { col: { axis: 'y', flip: false }, row: { axis: 'z', flip: true } },
  };
  const spanKey = { x: 'spanX', y: 'spanY', z: 'spanZ' };
  // where a span lands in screen cells for a given overlay axis
  const geoRange = (info, spans, foot, layers) => {
    const s = spans[spanKey[info.axis]], cap = info.axis === 'z' ? layers : foot;
    return info.flip ? { lo: cap - s.hi, hi: cap - s.lo } : { lo: s.lo, hi: s.hi };
  };

  // GROUND THE MODEL. Slices are CENTRED on the face by design, so a profile shorter than the cube carves a
  // model that hangs in mid-air — measured: wide side art (200×60) floats 22 voxels up inside a 64 cube.
  // Authoring placement is deliberately left alone; this is a post-carve TRANSLATE of the finished voxels so
  // the lowest one sits at z=0, because units stand on terrain. Returns how far it dropped (0 = already down).
  // fill: Uint8Array(layers*foot*foot), vcol: Uint8Array(layers*foot*foot*3) moved in lockstep.
  function groundVoxels(fill, vcol, foot, layers) {
    const N = foot * foot;
    let z0 = -1;
    for (let z = 0; z < layers && z0 < 0; z++) for (let i = 0; i < N; i++) if (fill[z * N + i]) { z0 = z; break; }
    if (z0 <= 0) return 0;                                   // empty, or already on the ground
    for (let z = z0; z < layers; z++) {
      const src = z * N, dst = (z - z0) * N;
      fill.copyWithin(dst, src, src + N);
      if (vcol) vcol.copyWithin(dst * 3, src * 3, (src + N) * 3);
    }
    fill.fill(0, (layers - z0) * N);                         // clear the vacated top slices
    if (vcol) vcol.fill(0, (layers - z0) * N * 3);
    return z0;
  }

  // NOTE: `clamp` is deliberately NOT exported — stack-forge.js has its own top-level const of that name and a
  // global property would just sit shadowed. Keep it internal so there is only ever one visible definition.
  return { sliceBase, sliceRect, xfFromRect, dragHandle, autoSpans, axisMaps, GEOAX, spanKey, geoRange, groundVoxels };
});
