// palette.js — proving the reduction before any of it is wired to a modal.
//
// This file exists because palette.js makes STRONG, checkable claims in its own header, and a palette
// tool whose claims are false is worse than none: it silently eats the one colour that carried the
// silhouette and the artist finds out at bake time.
//
// The claims under test, quoted from palette.js:
//   "Median cut alone collapses a model that is 90% hull grey into a palette of nine greys and throws
//    away the one red stripe that carries the silhouette."
//   "At n=2 you get the dominant tone plus its strongest contrast, never two adjacent greys."
//   "A palette of exactly `want` colours (or fewer, if the model genuinely has fewer)."
// Each is asserted below against the shipped functions, not against a reimplementation.
//
// The suite is mutation-checked: each behaviour was removed from palette.js and the suite confirmed to
// fail on it. 10 of 11 mutations are caught. The one that is NOT: medianCut's box-selection score
// (`span * log2(1+pop)` -> `span`), which changes WHICH box splits first. Pinning it needs a frozen
// golden palette, and a golden that nobody can reason about is a change-detector, not a test — it would
// fail on every legitimate tuning and teach the next person to update it without thinking. Left
// deliberately unpinned. If you retune median cut, the coverage claims here are your safety net, not
// that line.
//
// FOUND BY THIS SUITE: the population weight could NOT stop a stray voxel from taking a palette slot,
// though palette.js claimed it could. See the rarity-floor test and the fix it forced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const P = createRequire(import.meta.url)('./palette.js');

/** build a vcol buffer from [rgb, repeat] pairs — the shape the model actually hands over */
function model(pairs) {
  const n = pairs.reduce((s, [, k]) => s + k, 0);
  const vcol = new Uint8Array(n * 3);
  let i = 0;
  for (const [rgb, k] of pairs) for (let j = 0; j < k; j++, i++) {
    vcol[i * 3] = rgb[0]; vcol[i * 3 + 1] = rgb[1]; vcol[i * 3 + 2] = rgb[2];
  }
  return { vcol, count: n };
}

const HULL = [120, 124, 130];          // the 90% grey
const RED = [200, 30, 30];             // the stripe that carries the silhouette

test('extractPalette counts what the model uses, most-used first', () => {
  const { vcol, count } = model([[HULL, 90], [RED, 10]]);
  const e = P.extractPalette(vcol, count, null);
  assert.equal(e.length, 2);
  assert.deepEqual(e[0].rgb, HULL);
  assert.equal(e[0].n, 90);
  assert.equal(e[1].n, 10);
});

test('extractPalette skips unfilled voxels and never-written colour', () => {
  const { vcol, count } = model([[HULL, 4], [[0, 0, 0], 4], [RED, 4]]);
  // black is "unwritten", not a colour the artist chose — and filled() excludes the last two reds
  const e = P.extractPalette(vcol, count, (i) => i < 10);
  assert.equal(e.length, 2, 'black must not become a palette entry');
  assert.equal(e.find((x) => x.rgb[0] === 200).n, 2, 'filled() must gate the tally');
});

test('extractPalette is deterministic — ties broken by value, not insertion order', () => {
  const a = P.extractPalette(model([[[10, 0, 0], 5], [[9, 0, 0], 5]]).vcol, 10, null);
  const b = P.extractPalette(model([[[9, 0, 0], 5], [[10, 0, 0], 5]]).vcol, 10, null);
  assert.deepEqual(a.map((e) => e.rgb), b.map((e) => e.rgb));
});

// ── the headline claim ────────────────────────────────────────────────────────────────────────────
test('THE CLAIM: a 90%-grey model keeps its red stripe even at n=2', () => {
  // nine greys the eye can barely separate, plus one red that carries the silhouette.
  const greys = [];
  for (let i = 0; i < 9; i++) greys.push([[112 + i * 3, 116 + i * 3, 122 + i * 3], 10]);
  const { vcol, count } = model([...greys, [RED, 10]]);
  const entries = P.extractPalette(vcol, count, null);
  assert.equal(entries.length, 10);

  const pal2 = P.reducePalette(entries, 2);
  assert.equal(pal2.length, 2);
  const keptRed = pal2.some((c) => c[0] > 150 && c[1] < 90 && c[2] < 90);
  assert.ok(keptRed, `n=2 dropped the accent — got ${JSON.stringify(pal2)}`);

  // and the other slot must be the hull, not a second red
  const keptGrey = pal2.some((c) => Math.abs(c[0] - c[1]) < 30 && Math.abs(c[1] - c[2]) < 30);
  assert.ok(keptGrey, `n=2 lost the dominant tone — got ${JSON.stringify(pal2)}`);
});

test('THE CLAIM: n=2 is never two adjacent greys', () => {
  const greys = [];
  for (let i = 0; i < 9; i++) greys.push([[112 + i * 3, 116 + i * 3, 122 + i * 3], 10]);
  const pal = P.reducePalette(P.extractPalette(model([...greys, [RED, 10]]).vcol, 100, null), 2);
  const [a, b] = pal;
  const sep = Math.sqrt(P.dist2(a, b));
  assert.ok(sep > 60, `the two chosen colours are barely distinguishable (sep ${sep.toFixed(1)})`);
});

test('a purely grey model is allowed to return greys — the claim is about accents, not about hue', () => {
  const greys = [];
  for (let i = 0; i < 9; i++) greys.push([[40 + i * 22, 40 + i * 22, 40 + i * 22], 10]);
  const pal = P.reducePalette(P.extractPalette(model(greys).vcol, 90, null), 2);
  assert.equal(pal.length, 2);
  // with nothing but greys, the right answer is the darkest and lightest, not a hallucinated hue
  assert.ok(P.lum(...pal[1]) - P.lum(...pal[0]) > 80, 'should spend n=2 on lightness range');
});

test('THE CLAIM: a single stray pixel cannot win a palette slot from a real accent', () => {
  // palette.js: "weighted by how many voxels it represents so a single stray pixel cannot win a slot".
  // This is the anti-aliasing case — one rogue voxel of a wild colour must not cost the artist a slot
  // that the blue accent needs. Unweighted variety picks the stray every time, because it is furthest.
  // This exact config is a MEASURED reproduction, not an invented one. Two things had to be true for
  // the bug to show, and both are easy to get wrong when writing the test:
  //   - MORE distinct colours than the budget, or reducePalette rightly short-circuits and returns them
  //     all verbatim (an exact palette has zero error, so a stray in it costs nothing).
  //   - few enough hull shades that the stray is still the furthest candidate on the second variety
  //     pick. Pad the model with more shades and the distances rebalance, the stray loses on its own,
  //     and the test passes whether or not the floor exists — proving nothing.
  // With the floor removed, this returns [[30,60,200],[201,30,32],[255,0,255],[108,115,140]] — the
  // 1-voxel stray holding a quarter of the budget. With it, that slot goes to a real hull shade.
  const STRAY = [255, 0, 255];
  const BLUE = [30, 60, 200];
  const { vcol, count } = model([
    [[116, 120, 126], 250], [[124, 128, 134], 250], [RED, 100], [BLUE, 80], [STRAY, 1],
  ]);
  const entries = P.extractPalette(vcol, count, null);
  assert.equal(entries.length, 5, 'test setup: must exceed the budget of 4, but only just');
  const pal = P.reducePalette(entries, 4);

  const near = (c, t) => Math.sqrt(P.dist2(c, t));
  assert.ok(!pal.some((c) => near(c, STRAY) < 60),
    `a 1-voxel stray took a slot — ${JSON.stringify(pal)}`);
  assert.ok(pal.some((c) => near(c, BLUE) < 90),
    `the real accent lost its slot — ${JSON.stringify(pal)}`);
});

test('THE CLAIM: between comparably distant candidates, the better-represented one wins', () => {
  // The rarity floor is a gate; this is the weight that still shapes the choice above it. Measured
  // divergence: with `near * log2(1+n)` the 40-voxel [136,17,85] takes the slot; with bare `near` the
  // 20-voxel [221,17,119] does. Both are magenta-ish and comparably far from what coverage picked, so
  // population is the only thing separating them — and the artist wants the one they actually painted
  // more of. Found by randomised differential (729 of 1600 random models diverge), then minimised.
  const { vcol, count } = model([
    [[17, 238, 0], 140], [[221, 17, 119], 20], [[136, 17, 85], 40],
    [[102, 204, 204], 160], [[85, 204, 136], 100],
  ]);
  const pal = P.reducePalette(P.extractPalette(vcol, count, null), 3);
  assert.ok(pal.some((c) => c.join() === '136,17,85'),
    `the better-represented candidate lost — ${JSON.stringify(pal)}`);
  assert.ok(!pal.some((c) => c.join() === '221,17,119'),
    `the rarer candidate took the slot — ${JSON.stringify(pal)}`);
});

test('a model of ONLY rare colours still fills its palette — the floor must not starve the budget', () => {
  // The floor is share-based, so a model where every colour is rare (100 distinct shades, one voxel
  // each) puts EVERY entry below it. Without the fallback the variety pass has nothing to draw from and
  // reducePalette returns short: asked for 2, delivers 1. A palette tool that silently hands back fewer
  // colours than requested is worse than one that ignores the floor.
  const pairs = [];
  for (let i = 0; i < 100; i++) pairs.push([[(i * 7) % 256, (i * 53) % 256, (i * 97) % 256], 1]);
  const { vcol, count } = model(pairs);
  const entries = P.extractPalette(vcol, count, null);
  assert.ok(entries.length > 48, 'test setup: need more colours than the largest budget');
  for (const n of P.SIZES) {
    assert.equal(P.reducePalette(entries, n).length, n, `all-rare model returned short at n=${n}`);
  }
});

test('THE CLAIM: distance is luminance-weighted, so lightness counts as much as hue', () => {
  // palette.js: dist2 is "luminance-weighted so lightness differences count as much as hue".
  // Both probes sit the same euclidean distance from black in raw RGB. Green is far brighter, so a
  // luminance-aware metric must rank it as the more distant of the two. Drop the term and they tie.
  const black = [0, 0, 0];
  const dRed = P.dist2(black, [100, 0, 0]);
  const dGreen = P.dist2(black, [0, 100, 0]);
  assert.ok(dGreen > dRed * 1.2,
    `equal RGB distance must not mean equal perceptual distance (red ${dRed}, green ${dGreen})`);
});

// ── budget ────────────────────────────────────────────────────────────────────────────────────────
test('reducePalette returns EXACTLY the requested size when the model has enough colours', () => {
  const pairs = [];
  for (let i = 0; i < 60; i++) pairs.push([[(i * 37) % 256, (i * 91) % 256, (i * 53) % 256], 60 - i]);
  const entries = P.extractPalette(model(pairs).vcol, pairs.reduce((s, [, k]) => s + k, 0), null);
  for (const n of P.SIZES) {
    const pal = P.reducePalette(entries, n);
    assert.equal(pal.length, n, `asked for ${n}, got ${pal.length}`);
  }
});

test('reducePalette never invents colours the model does not have', () => {
  const { vcol, count } = model([[HULL, 5], [RED, 5]]);
  const entries = P.extractPalette(vcol, count, null);
  const pal = P.reducePalette(entries, 8);              // asked for more than exist
  assert.equal(pal.length, 2, 'must return fewer, not pad');
  assert.ok(pal.every((c) => entries.some((e) => e.rgb.every((v, i) => v === c[i]))));
});

test('reducePalette is deterministic across runs', () => {
  const pairs = [];
  for (let i = 0; i < 40; i++) pairs.push([[(i * 61) % 256, (i * 17) % 256, (i * 113) % 256], 40 - i]);
  const { vcol, count } = model(pairs);
  const e1 = P.extractPalette(vcol, count, null);
  const e2 = P.extractPalette(vcol, count, null);
  assert.deepEqual(P.reducePalette(e1, 8), P.reducePalette(e2, 8));
});

test('reducePalette is sorted dark to light — the strip must not reshuffle between sizes', () => {
  const pairs = [];
  for (let i = 0; i < 40; i++) pairs.push([[(i * 61) % 256, (i * 17) % 256, (i * 113) % 256], 40 - i]);
  const pal = P.reducePalette(P.extractPalette(model(pairs).vcol, 820, null), 16);
  for (let i = 1; i < pal.length; i++) {
    assert.ok(P.lum(...pal[i]) >= P.lum(...pal[i - 1]), 'palette must be ordered by luminance');
  }
});

test('a bigger budget never makes the fit worse', () => {
  const pairs = [];
  for (let i = 0; i < 80; i++) pairs.push([[(i * 37) % 256, (i * 91) % 256, (i * 53) % 256], 80 - i]);
  const entries = P.extractPalette(model(pairs).vcol, pairs.reduce((s, [, k]) => s + k, 0), null);
  const opts = P.paletteOptions(entries, P.SIZES);
  for (let i = 1; i < opts.length; i++) {
    // a heuristic reduction may tie, but must not regress materially as the budget grows
    assert.ok(opts[i].stats.meanErr <= opts[i - 1].stats.meanErr + 1e-6,
      `${opts[i - 1].n}->${opts[i].n} raised mean error ${opts[i - 1].stats.meanErr.toFixed(2)} -> ${opts[i].stats.meanErr.toFixed(2)}`);
  }
});

// ── apply ─────────────────────────────────────────────────────────────────────────────────────────
test('applyPalette maps every filled voxel INTO the palette and reports the change count', () => {
  const { vcol, count } = model([[HULL, 9], [RED, 1]]);
  const pal = P.reducePalette(P.extractPalette(vcol, count, null), 2);
  const changed = P.applyPalette(vcol, count, null, pal);
  assert.ok(changed >= 0 && changed <= count);
  for (let i = 0; i < count; i++) {
    const c = [vcol[i * 3], vcol[i * 3 + 1], vcol[i * 3 + 2]];
    assert.ok(pal.some((p) => p.every((v, j) => v === c[j])), `voxel ${i} left outside the palette`);
  }
});

test('applyPalette is idempotent — a second pass changes nothing', () => {
  const pairs = [];
  for (let i = 0; i < 30; i++) pairs.push([[(i * 37) % 256, (i * 91) % 256, (i * 53) % 256], 30 - i]);
  const { vcol, count } = model(pairs);
  const pal = P.reducePalette(P.extractPalette(vcol, count, null), 8);
  P.applyPalette(vcol, count, null, pal);
  assert.equal(P.applyPalette(vcol, count, null, pal), 0, 'reapplying the same palette must be a no-op');
});

test('applyPalette leaves UNFILLED voxels untouched — geometry is not colour is not the mask', () => {
  const { vcol, count } = model([[HULL, 5], [RED, 5]]);
  const before = vcol.slice();
  const pal = [[0, 0, 255]];
  P.applyPalette(vcol, count, (i) => i < 5, pal);
  for (let i = 5; i < count; i++) {
    assert.equal(vcol[i * 3], before[i * 3], `unfilled voxel ${i} was repainted`);
  }
});

test('applyPalette on an empty palette is a no-op, not a wipe', () => {
  const { vcol, count } = model([[HULL, 4]]);
  const before = vcol.slice();
  assert.equal(P.applyPalette(vcol, count, null, []), 0);
  assert.deepEqual(vcol, before, 'an empty palette must never blank the model');
});

test('nearest always returns a member of the palette', () => {
  const pal = [[0, 0, 0], [255, 255, 255], [200, 30, 30]];
  for (const probe of [[1, 1, 1], [250, 250, 250], [190, 40, 35], [128, 128, 128]]) {
    assert.ok(pal.includes(P.nearest(probe, pal)));
  }
});

test('paletteStats reports the spread the modal shows, and is zero-error on an exact palette', () => {
  const { vcol, count } = model([[HULL, 5], [RED, 5]]);
  const entries = P.extractPalette(vcol, count, null);
  const s = P.paletteStats(entries, entries.map((e) => e.rgb));
  assert.equal(s.meanErr, 0);
  assert.equal(s.worstErr, 0);
  assert.equal(s.size, 2);
  assert.ok(s.lumSpread > 0);
});

test('paletteOptions offers every advertised size', () => {
  const pairs = [];
  for (let i = 0; i < 60; i++) pairs.push([[(i * 37) % 256, (i * 91) % 256, (i * 53) % 256], 60 - i]);
  const opts = P.paletteOptions(P.extractPalette(model(pairs).vcol, 1830, null));
  assert.deepEqual(opts.map((o) => o.n), P.SIZES);
  assert.deepEqual(opts.map((o) => o.palette.length), P.SIZES);
});

test('an empty model degrades quietly instead of throwing', () => {
  assert.deepEqual(P.extractPalette(new Uint8Array(0), 0, null), []);
  assert.deepEqual(P.reducePalette([], 8), []);
  assert.deepEqual(P.spreadPalette([], 8), []);
  assert.deepEqual(P.bestPalette([], 8), []);
  assert.deepEqual(P.medianCut([], 4), []);
  assert.equal(P.paletteStats([], []).meanErr, 0);
  assert.equal(P.paletteRms([], []), 0);
});

// ── luminance spread, and the real-art failure that forced it ─────────────────────────────────────
// THE BUG THIS SECTION EXISTS FOR. reducePalette's header claimed "at n=2 you get the dominant tone plus
// its strongest contrast, never two adjacent greys", the claim tests above passed, and the claim was
// still FALSE on real art — because every fixture above has clean, separable colour clusters, which is
// precisely the condition that makes coverage+variety work. A continuous-tone photo carve has none.
// Reproduced synthetically here so it runs without loading a 550 KB content file; the numbers in
// palette.js's spreadPalette comment are from the shipped SPA-U3 body itself.

/** a photo-carve-shaped model: a continuous neutral ramp, most of its mass bunched in the mid-highs */
function tonalRamp() {
  const pairs = [];
  for (let v = 24; v <= 207; v += 3) {
    // population curve peaks around 160 and thins toward the shadows — a lit hull photographed, not a
    // flat-shaded sprite. This is what defeats the variety pass: the dark end exists but is never popular.
    const w = Math.max(1, Math.round(300 * Math.exp(-((v - 160) ** 2) / (2 * 28 * 28))));
    pairs.push([[v, v + 1, v + 3], w]);
  }
  return P.extractPalette(model(pairs).vcol, pairs.reduce((s, [, k]) => s + k, 0), null);
}

const lumsOf = (pal) => pal.map((c) => P.lum(...c));
const rangeOf = (entries) => {
  const ls = entries.map((e) => P.lum(...e.rgb));
  const lo = Math.min(...ls), hi = Math.max(...ls);
  return { lo, hi, avail: hi - lo };
};

test('THE BUG: coverage+variety abandons the dark half of a continuous-tone model', () => {
  // Not a claim about spreadPalette — a claim about what reducePalette DOES here, so that if someone
  // ever fixes reducePalette this test tells them the reason for spreadPalette has changed.
  // Measured on the shipped SPA-U3 body: reducePalette n=2 returns nothing darker than luminance 168
  // against a model floor of 24. This fixture reproduces that shape: darkest slot in the TOP HALF.
  const entries = tonalRamp(), { lo, avail } = rangeOf(entries);
  const darkest = Math.min(...lumsOf(P.reducePalette(entries, 2)));
  assert.ok(darkest > lo + avail * 0.5,
    `reducePalette n=2 now reaches down to ${darkest.toFixed(0)} (floor ${lo.toFixed(0)}) — spreadPalette may no longer be needed`);
});

test('spreadPalette reaches the tones coverage+variety cannot', () => {
  const entries = tonalRamp(), { lo, avail } = rangeOf(entries);
  // The small sizes are where the bug bites, and the fix must be visible there specifically.
  for (const n of [2, 4]) {
    const dSpread = Math.min(...lumsOf(P.spreadPalette(entries, n)));
    const dCover = Math.min(...lumsOf(P.reducePalette(entries, n)));
    assert.ok(dSpread < dCover - avail * 0.15,
      `n=${n}: spread's darkest is ${dSpread.toFixed(0)}, coverage's is ${dCover.toFixed(0)} — no material gain`);
    assert.ok(dSpread < lo + avail * 0.5, `n=${n}: spread's darkest ${dSpread.toFixed(0)} is still in the top half`);
  }
});

test('spreadPalette spends its whole budget across the range, at every size', () => {
  // The ceiling is arithmetic, not aspiration: `want` band MEANS over a uniform model can span at most
  // (want-1)/want of the range, because each mean sits inside its own band. Asserting "covers 100%"
  // would be asserting something impossible; this asserts it gets most of the way to what IS possible.
  const entries = tonalRamp(), { avail } = rangeOf(entries);
  for (const n of P.SIZES) {
    const pal = P.spreadPalette(entries, n);
    const got = lumsOf(pal), span = Math.max(...got) - Math.min(...got);
    const ideal = avail * (n - 1) / n;
    assert.ok(span > ideal * 0.6, `n=${n}: spread ${span.toFixed(0)} of a possible ${ideal.toFixed(0)}`);
  }
});

test('spreadPalette returns EXACTLY the requested size when the model has the colours', () => {
  const entries = tonalRamp();
  for (const n of P.SIZES) assert.equal(P.spreadPalette(entries, n).length, n, `n=${n}`);
});

test('spreadPalette never invents a colour outside the model\'s gamut', () => {
  const entries = tonalRamp();
  const ls = entries.map((e) => P.lum(...e.rgb));
  const lo = Math.min(...ls) - 1, hi = Math.max(...ls) + 1;
  for (const c of P.spreadPalette(entries, 8)) {
    const l = P.lum(...c);
    assert.ok(l >= lo && l <= hi, `${JSON.stringify(c)} sits outside the model's own luminance range`);
  }
});

test('THE RULE: bestPalette takes whichever reduction actually fits the model better', () => {
  // The whole point of bestPalette is that it needs no model classification. Prove it BOTH ways on the
  // two models that pull in opposite directions.
  const tonal = tonalRamp();
  assert.ok(P.paletteRms(tonal, P.bestPalette(tonal, 2)) < P.paletteRms(tonal, P.reducePalette(tonal, 2)),
    'on a continuous-tone model bestPalette must beat coverage alone — that is the case spreadPalette exists for');
  // and the symptom, not just the score: the dark end comes back
  assert.ok(Math.min(...lumsOf(P.bestPalette(tonal, 2))) < Math.min(...lumsOf(P.reducePalette(tonal, 2))),
    'bestPalette n=2 must reach darker than coverage alone');

  // …and the hue model where equal-luminance banding would merge two distinct hues into one band.
  const hues = P.extractPalette(model([
    [[17, 238, 0], 140], [[221, 17, 119], 20], [[136, 17, 85], 40], [[102, 204, 204], 160], [[85, 204, 136], 100],
  ]).vcol, 460, null);
  const pick = P.bestPalette(hues, 3);
  assert.ok(P.paletteRms(hues, pick) <= P.paletteRms(hues, P.spreadPalette(hues, 3)),
    'on a hue-separated model bestPalette must decline the spread');
  assert.ok(pick.some((c) => c.join() === '136,17,85'),
    `bestPalette broke the population-tie claim reducePalette is pinned on — ${JSON.stringify(pick)}`);
});

test('bestPalette is never worse than either reduction alone, at any size', () => {
  for (const entries of [tonalRamp(), P.extractPalette(model([
    [[116, 120, 126], 250], [[124, 128, 134], 250], [RED, 100], [[30, 60, 200], 80], [[255, 0, 255], 1],
  ]).vcol, 681, null)]) {
    for (const n of P.SIZES) {
      const b = P.paletteRms(entries, P.bestPalette(entries, n));
      assert.ok(b <= P.paletteRms(entries, P.reducePalette(entries, n)) + 1e-9, `n=${n}: worse than reducePalette`);
      assert.ok(b <= P.paletteRms(entries, P.spreadPalette(entries, n)) + 1e-9, `n=${n}: worse than spreadPalette`);
    }
  }
});

test('paletteOptions reports which reduction won, and what the model had to offer', () => {
  const opts = P.paletteOptions(tonalRamp());
  for (const o of opts) {
    assert.ok(o.via === 'spread' || o.via === 'coverage', `unknown via ${o.via}`);
    assert.ok(o.rms >= 0 && Number.isFinite(o.rms));
    assert.ok(o.lumAvail > 100, 'lumAvail must be the MODEL\'s range, not the palette\'s');
    assert.ok(o.stats.lumSpread <= o.lumAvail + 1e-6, 'a palette cannot spread wider than the model it came from');
  }
  assert.equal(opts[0].via, 'spread', 'a continuous-tone model at n=2 must be answered by the spread');
});

// ── the shadow trap ───────────────────────────────────────────────────────────────────────────────
test('the *Core aliases exist, because bare globals can be shadowed by the tool', () => {
  // stack-forge.js is a classic script that declares its OWN top-level `function medianCut` and
  // `function rgb2hsv`. Those hoist over globalThis and silently replace palette.js's versions. The
  // tool must call the *Core names; this asserts they are there to call.
  for (const k of ['extractPalette', 'reducePalette', 'spreadPalette', 'bestPalette', 'paletteRms',
    'paletteOptions', 'paletteStats', 'applyPalette', 'nearest', 'medianCut', 'rgb2hsv', 'lum', 'dist2']) {
    assert.equal(typeof P[k + 'Core'], 'function', `missing alias ${k}Core`);
    assert.equal(P[k + 'Core'], P[k], `${k}Core must BE ${k}, not a copy that can drift`);
  }
  assert.deepEqual(P.PALETTE_SIZES, P.SIZES);
});
