/**
 * palette — the model's colours, and good reductions of them.
 *
 * DOM-FREE, like carve.js and select.js. Takes typed arrays and plain numbers, returns palettes and
 * index maps, so every claim about "is this a good 8-colour palette" is provable in node.
 *
 * WHY THIS EXISTS. Colour was previously derived four separate times from four different inputs — the
 * grid, buildFaces, collectVox and the swatch strip each built their own quantiser — so the grid, the
 * 3D view and the shipped atlas could bin the same voxel differently. There is one palette here and
 * everyone reads it.
 *
 * THE REDUCTION. Median cut alone collapses a model that is 90% hull grey into a palette of nine greys
 * and throws away the one red stripe that carries the silhouette. So the reduction optimises TWO things:
 *   COVERAGE  — a colour that many voxels are near (population-weighted, so the hull is represented)
 *   VARIETY   — hue and lightness spread (so accents survive a cut to 4 colours)
 * The split is deliberate: the first half of the budget goes to coverage, the rest to the colours
 * furthest from what coverage already chose. At n=2 you get the dominant tone plus its strongest
 * contrast, never two adjacent greys.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;   // node (palette.test.mjs)
  else Object.assign(root, api);                                              // browser
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  const SIZES = [2, 4, 8, 16, 32, 48];

  // ── colour space ────────────────────────────────────────────────────────────────────────────────
  // Perceptual luminance (Rec. 709). Used for contrast, so "variety" means what the eye sees, not what
  // the RGB cube says: #00ff00 and #0000ff are far apart in RGB and miles apart in luminance too, but
  // #808080 and #7f8081 are far apart in neither.
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  function rgb2hsv(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, mx ? d / mx : 0, mx / 255];
  }

  /** squared distance, luminance-weighted so lightness differences count as much as hue */
  function dist2(a, b) {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    const dl = lum(a[0], a[1], a[2]) - lum(b[0], b[1], b[2]);
    return dr * dr + dg * dg + db * db + dl * dl;
  }

  // ── the model's actual colours ──────────────────────────────────────────────────────────────────
  /**
   * Every colour the model actually uses, with how many voxels use it, most-used first.
   * `filled(i)` decides which voxel indices count — pass the model's own test so empty space and
   * never-carved cells contribute nothing.
   */
  function extractPalette(vcol, count, filled) {
    const tally = new Map();
    for (let i = 0; i < count; i++) {
      if (filled && !filled(i)) continue;
      const r = vcol[i * 3], g = vcol[i * 3 + 1], b = vcol[i * 3 + 2];
      if (!r && !g && !b) continue;                       // unwritten — not a colour the artist chose
      const k = (r << 16) | (g << 8) | b;
      tally.set(k, (tally.get(k) || 0) + 1);
    }
    const out = [];
    for (const [k, n] of tally) out.push({ rgb: [(k >> 16) & 255, (k >> 8) & 255, k & 255], n });
    out.sort((a, b) => b.n - a.n || (a.rgb[0] - b.rgb[0]) || (a.rgb[1] - b.rgb[1]) || (a.rgb[2] - b.rgb[2]));
    return out;                                           // deterministic: ties broken by value
  }

  // ── reduction ───────────────────────────────────────────────────────────────────────────────────
  /** population-weighted median cut — the COVERAGE half of the budget */
  function medianCut(entries, want) {
    if (!entries.length || want < 1) return [];
    let boxes = [entries];
    while (boxes.length < want) {
      let bi = -1, bs = -1;
      for (let i = 0; i < boxes.length; i++) {
        const bx = boxes[i]; if (bx.length < 2) continue;
        let lo = [255, 255, 255], hi = [0, 0, 0], pop = 0;
        for (const e of bx) { pop += e.n; for (let c = 0; c < 3; c++) { if (e.rgb[c] < lo[c]) lo[c] = e.rgb[c]; if (e.rgb[c] > hi[c]) hi[c] = e.rgb[c]; } }
        const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
        const score = span * Math.log2(1 + pop);         // big AND busy boxes split first
        if (score > bs) { bs = score; bi = i; }
      }
      if (bi < 0) break;                                  // nothing splittable left
      const bx = boxes[bi];
      let lo = [255, 255, 255], hi = [0, 0, 0];
      for (const e of bx) for (let c = 0; c < 3; c++) { if (e.rgb[c] < lo[c]) lo[c] = e.rgb[c]; if (e.rgb[c] > hi[c]) hi[c] = e.rgb[c]; }
      let ch = 0; for (let c = 1; c < 3; c++) if (hi[c] - lo[c] > hi[ch] - lo[ch]) ch = c;
      const sorted = bx.slice().sort((a, b) => a.rgb[ch] - b.rgb[ch] || a.rgb[0] - b.rgb[0]);
      let half = 0; const total = sorted.reduce((s, e) => s + e.n, 0);
      let acc = 0, cutAt = 1;
      for (let i = 0; i < sorted.length - 1; i++) { acc += sorted[i].n; if (acc >= total / 2) { cutAt = i + 1; break; } }
      boxes.splice(bi, 1, sorted.slice(0, cutAt), sorted.slice(cutAt));
      half++;
    }
    return boxes.filter((b) => b.length).map((bx) => {
      let r = 0, g = 0, b = 0, n = 0;
      for (const e of bx) { r += e.rgb[0] * e.n; g += e.rgb[1] * e.n; b += e.rgb[2] * e.n; n += e.n; }
      return { rgb: [Math.round(r / n), Math.round(g / n), Math.round(b / n)], n };
    });
  }

  /**
   * A palette of exactly `want` colours (or fewer, if the model genuinely has fewer).
   * Half the budget to coverage, half to the colours furthest from what coverage picked — so a model
   * that is mostly hull grey still spends slots on its accents.
   */
  function reducePalette(entries, want) {
    if (!entries.length) return [];
    if (entries.length <= want) return entries.map((e) => e.rgb.slice());
    const nCover = Math.max(1, Math.ceil(want / 2));
    const chosen = medianCut(entries, nCover).map((e) => e.rgb.slice());
    // VARIETY: repeatedly take the entry furthest from everything already chosen, weighted by how many
    // voxels it represents so a single stray pixel cannot win a slot.
    while (chosen.length < want) {
      let best = null, bestScore = -1;
      for (const e of entries) {
        let near = Infinity;
        for (const c of chosen) { const d = dist2(e.rgb, c); if (d < near) near = d; }
        const score = near * Math.log2(1 + e.n);
        if (score > bestScore) { bestScore = score; best = e; }
      }
      if (!best || bestScore <= 0) break;                 // everything is already represented exactly
      chosen.push(best.rgb.slice());
      entries = entries.filter((e) => e !== best);
    }
    // stable, readable order: dark → light
    chosen.sort((a, b) => lum(a[0], a[1], a[2]) - lum(b[0], b[1], b[2]));
    return chosen;
  }

  /** nearest palette colour, luminance-weighted */
  function nearest(rgb, palette) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < palette.length; i++) { const d = dist2(rgb, palette[i]); if (d < bd) { bd = d; bi = i; } }
    return palette[bi];
  }

  /** how well a palette covers a model: mean and worst per-voxel error, and the spread it achieves */
  function paletteStats(entries, palette) {
    let tot = 0, err = 0, worst = 0;
    for (const e of entries) {
      const d = Math.sqrt(dist2(e.rgb, nearest(e.rgb, palette)));
      err += d * e.n; tot += e.n; if (d > worst) worst = d;
    }
    const L = palette.map((p) => lum(p[0], p[1], p[2]));
    const hues = palette.map((p) => rgb2hsv(p[0], p[1], p[2])[0]);
    return {
      meanErr: tot ? err / tot : 0,
      worstErr: worst,
      lumSpread: L.length ? Math.max(...L) - Math.min(...L) : 0,
      hueCount: new Set(hues.map((h) => Math.round(h / 30))).size,
      size: palette.length,
    };
  }

  /** every offered size, each with its palette and stats — what the modal shows */
  function paletteOptions(entries, sizes) {
    return (sizes || SIZES).map((n) => {
      const pal = reducePalette(entries, n);
      return { n, palette: pal, stats: paletteStats(entries, pal) };
    });
  }

  /** apply a palette to a colour buffer, in place. Returns how many voxels changed. */
  function applyPalette(vcol, count, filled, palette) {
    if (!palette || !palette.length) return 0;
    const cache = new Map();
    let changed = 0;
    for (let i = 0; i < count; i++) {
      if (filled && !filled(i)) continue;
      const o = i * 3, r = vcol[o], g = vcol[o + 1], b = vcol[o + 2];
      const k = (r << 16) | (g << 8) | b;
      let p = cache.get(k);
      if (!p) { p = nearest([r, g, b], palette); cache.set(k, p); }
      if (p[0] !== r || p[1] !== g || p[2] !== b) changed++;
      vcol[o] = p[0]; vcol[o + 1] = p[1]; vcol[o + 2] = p[2];
    }
    return changed;
  }

  return { SIZES, lum, rgb2hsv, dist2, extractPalette, medianCut, reducePalette, nearest, paletteStats, paletteOptions, applyPalette };
});
