/**
 * carve — the Stack Forge carve core. Slices in, a solid voxel volume out.
 *
 * DOM-FREE ON PURPOSE. Everything here takes plain pixel buffers ({ width, height, data } RGBA) and
 * returns plain typed arrays, so the whole carve is provable in node (carve.test.mjs). The browser side
 * hands it `ctx.getImageData(...)`; nothing in here knows what a canvas is.
 *
 * THE RULES (owner's, verbatim in intent):
 *   1. The ORIGINAL slices decide where there is geometry and where there is transparency.
 *   2. Alpha is BINARY — opaque or clear. Never a ramp, never averaged, never feathered.
 *   3. The slices are stretched over the SIDES OF A BOX; each covers its whole face.
 *   4. Their COLLISIONS carve the block: clear the volume, fill it solid, then cut with each slice.
 *   5. The result should be MOSTLY SOLID.
 *   6. A small shape drawn centred in the slices carves a small shape centred in the grid.
 *
 * Loaded as a CLASSIC script in the browser (defines globals) AND importable in node for the test.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node (carve.test.mjs)
  else Object.assign(root, api);                                               // browser
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const INK_A = 40;                       // THE one alpha threshold. Nothing in the carve may use another.
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /**
   * sliceMask — map a whole slice onto a w×h box face.
   * COVERAGE, not sampling: each face cell counts how much of the source area it covers is opaque and
   * takes the majority. A single centre sample would drop features thinner than a cell; "any opaque"
   * would fatten the silhouette; majority does neither. No canvas rescale, so no interpolation and no
   * invented in-between alpha — the mask is strictly {0,1}.
   * `elev` flips rows so image-down becomes z-up.
   * Returns { m: Uint8Array(w*h), c: Uint8Array(w*h*3), w, h }.
   */
  function sliceMask(img, w, h, elev) {
    w = Math.max(1, w | 0); h = Math.max(1, h | 0);
    const sw = Math.max(1, img.width), sh = Math.max(1, img.height), sd = img.data;
    const m = new Uint8Array(w * h), c = new Uint8Array(w * h * 3);
    for (let r = 0; r < h; r++) {
      const y0 = Math.min(sh - 1, (r * sh / h) | 0);
      const y1 = Math.max(y0 + 1, Math.min(sh, Math.ceil((r + 1) * sh / h)));
      for (let a = 0; a < w; a++) {
        const x0 = Math.min(sw - 1, (a * sw / w) | 0);
        const x1 = Math.max(x0 + 1, Math.min(sw, Math.ceil((a + 1) * sw / w)));
        let opaque = 0, total = 0, R = 0, G = 0, B = 0;
        for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
          const p = (sy * sw + sx) * 4; total++;
          if (sd[p + 3] > INK_A) { opaque++; R += sd[p]; G += sd[p + 1]; B += sd[p + 2]; }
        }
        if (opaque * 2 < total) continue;                       // majority clear → no geo
        const i = (elev ? (h - 1 - r) : r) * w + a;
        m[i] = 1; c[i * 3] = R / opaque; c[i * 3 + 1] = G / opaque; c[i * 3 + 2] = B / opaque;
      }
    }
    return { m, c, w, h };
  }

  /** The source block: the whole grid. Slices stretch over its faces; nothing is fitted to art aspect. */
  const fullBox = (foot, layers) => ({ ox: 0, oy: 0, bw: foot, bh: foot, z0: 0, Hv: layers });

  /**
   * carve — clear, fill solid, cut. `slices` is { top, side, front } of pixel buffers (any may be null);
   * `cuts` says which of them participate, so the tool can carve top, then top+side, then top+side+front.
   * A slice that is absent, or whose cut is off, removes nothing on its axis — it cannot add material,
   * so the block simply stays solid there.
   *
   * Returns { VOL, vcol, foot, layers, box, masks, counts } where VOL[z*foot*foot + y*foot + x] is 1|0.
   * VOL IS THE MODEL. Editing writes into it directly — there is no overlay layer.
   */
  function carve(opts) {
    const foot = Math.max(1, opts.foot | 0), layers = Math.max(1, opts.layers | 0);
    const box = opts.box || fullBox(foot, layers);
    const { ox, oy, z0 } = box;
    const bw = Math.max(1, box.bw | 0), bh = Math.max(1, box.bh | 0), Hv = Math.max(1, box.Hv | 0);
    const cuts = Object.assign({ top: true, side: true, front: true }, opts.cuts || {});
    const S = opts.slices || {};
    const N = foot * foot;

    const topG   = S.top   ? sliceMask(S.top,   bw, bh, false) : null;   // (x,y)
    const sideG  = S.side  ? sliceMask(S.side,  bw, Hv, true)  : null;   // (x,z)
    const frontG = S.front ? sliceMask(S.front, bh, Hv, true)  : null;   // (y,z)

    const VOL = new Uint8Array(layers * N);                              // 1. CLEAR
    const counts = { fill: 0, afterTop: 0, afterSide: 0, afterFront: 0 };
    for (let z = z0; z < z0 + Hv; z++) for (let y = oy; y < oy + bh; y++)
      for (let x = ox; x < ox + bw; x++) { VOL[z * N + y * foot + x] = 1; counts.fill++; }   // 2. FILL SOLID

    const cut = (g, idx) => {                                            // 3. CUT — only ever removes
      if (!g) return;
      for (let z = z0; z < z0 + Hv; z++) for (let y = oy; y < oy + bh; y++) for (let x = ox; x < ox + bw; x++) {
        const k = z * N + y * foot + x;
        if (VOL[k] && !g.m[idx(x, y, z)]) VOL[k] = 0;
      }
    };
    const live = () => { let n = 0; for (let i = 0; i < VOL.length; i++) if (VOL[i]) n++; return n; };
    if (cuts.top)   cut(topG,   (x, y)     => (y - oy) * bw + (x - ox));
    counts.afterTop = live();
    if (cuts.side)  cut(sideG,  (x, _y, z) => (z - z0) * bw + (x - ox));
    counts.afterSide = live();
    if (cuts.front) cut(frontG, (_x, y, z) => (z - z0) * bh + (y - oy));
    counts.afterFront = live();

    // COLOUR: the top slice colours each column; a voxel with no top ink keeps 0 and the renderer's
    // wall-colour pass fills it from the elevation that depicts its face.
    const vcol = new Uint8Array(layers * N * 3);
    if (topG) for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i = y * bw + x; if (!topG.m[i]) continue;
      const R = topG.c[i * 3], G = topG.c[i * 3 + 1], B = topG.c[i * 3 + 2];
      for (let z = 0; z < layers; z++) {
        const k = z * N + (oy + y) * foot + (ox + x);
        if (!VOL[k]) continue;
        vcol[k * 3] = R; vcol[k * 3 + 1] = G; vcol[k * 3 + 2] = B;
      }
    }
    return { VOL, vcol, foot, layers, box, masks: { top: topG, side: sideG, front: frontG }, counts };
  }

  /** bounding box of the filled voxels, or null when empty */
  function bounds(VOL, foot, layers) {
    const N = foot * foot;
    let x0 = foot, x1 = -1, y0 = foot, y1 = -1, z0 = layers, z1 = -1;
    for (let z = 0; z < layers; z++) for (let y = 0; y < foot; y++) for (let x = 0; x < foot; x++) {
      if (!VOL[z * N + y * foot + x]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    return x1 < 0 ? null : { x0, x1, y0, y1, z0, z1, w: x1 - x0 + 1, d: y1 - y0 + 1, h: z1 - z0 + 1 };
  }

  /** an empty voxel fully enclosed by filled neighbours — a real hole, not a concavity */
  function interiorHoles(VOL, foot, layers) {
    const N = foot * foot, at = (x, y, z) =>
      x >= 0 && y >= 0 && z >= 0 && x < foot && y < foot && z < layers && !!VOL[z * N + y * foot + x];
    let n = 0;
    for (let z = 1; z < layers - 1; z++) for (let y = 1; y < foot - 1; y++) for (let x = 1; x < foot - 1; x++)
      if (!at(x, y, z) && at(x + 1, y, z) && at(x - 1, y, z) && at(x, y + 1, z)
          && at(x, y - 1, z) && at(x, y, z + 1) && at(x, y, z - 1)) n++;
    return n;
  }

  // sliceMaskCore is the SAME function under a name a host page cannot shadow: stack-forge.js declares
  // its own top-level `function sliceMask`, and a hoisted declaration overwrites the global this module
  // assigns. The alias is what that page delegates to.
  return { INK_A, clamp, sliceMask, sliceMaskCore: sliceMask, fullBox, carve, bounds, interiorHoles };
});
