/**
 * src/render3d/units/shadow.js — the shadow proxy of a part-list model ("shadow columns") [MM-story_mvibvqd2_7].
 *
 * Planar unit shadows used to project the whole LOD mesh: every triangle of a model's far-zoom variant, hidden
 * interior faces and greebles included, about half of all unit triangles on screen. A shadow at 34% black seen from
 * the battle camera only needs the silhouette, so each model now casts a PROXY of a few simple primitives:
 *
 *   - `def.shadow` — authored by hand: an array replaces the whole proxy; an object `{ group: [parts] }` replaces
 *     just those groups (e.g. one box for an organ-pipe bank) and the rest stay derived, or
 *   - derived here: the model's biggest parts by ground footprint, each reduced to its cheapest honest form —
 *     boxes stay boxes, cylinders drop to ≤ 6 sides (4 for thin rods), ellipsoids become boxes, extrusions keep
 *     a ≤ 8-point outline (holes ≤ 8), lofts keep three sections of ≤ 6 points.
 *
 * Each group keeps its own proxy so the turret, gun and landing legs still swing their shadow; spinning rotors
 * (`spin*`) cast none (a blur of blades would read as a solid disc) and nor do glow parts (flames, lenses, tips).
 * Every group is held to a triangle budget; SHADOW_MAX_TRIS caps a whole model (shadow.test.mjs).
 *
 * Pure: works on the part list, no three.js.
 */

/** A whole model's shadow proxy never exceeds this many triangles (all groups, mirrored parts counted twice). */
export const SHADOW_MAX_TRIS = 560;   // the four-jack artillery is the dearest (536)
/** Triangle budget per group, by group-name prefix. */
export const SHADOW_GROUP_BUDGET = Object.freeze({ body: 300, turret: 90, barrel: 90, deploy: 30 });
const budgetFor = (g) => SHADOW_GROUP_BUDGET[Object.keys(SHADOW_GROUP_BUDGET).find((k) => g.startsWith(k)) || 'body'];

import { SUN } from '../../render/sun.js';

const isGlow = (p) => /^glow|amber/.test(p.m || '');
const isSpin = (g) => /^spin/.test(g || '');
const D2R = Math.PI / 180;

// ── geometry helpers (pure) ────────────────────────────────────────────────────────────────────────────────────
function rotYZX(v, r3) {   // three.js Euler order 'YZX' (matrix Ry·Rz·Rx): X first, then Z, then Y
  if (!r3) return v;
  const [ax, ay, az] = r3.map((a) => (a || 0) * D2R);
  let [x, y, z] = v;
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  return [x, y, z];
}
const bbox2 = (pts) => pts.reduce((b, [u, v]) => [Math.min(b[0], u), Math.min(b[1], v), Math.max(b[2], u), Math.max(b[3], v)], [Infinity, Infinity, -Infinity, -Infinity]);

/** A part's local bounding box (before r3 / p) as [min, max]. */
function localBox(p) {
  if (p.t === 'box') return [p.s.map((v) => -v / 2), p.s.map((v) => v / 2)];
  if (p.t === 'ell') return [p.s.map((v) => -v), p.s.slice()];
  if (p.t === 'cyl') {
    const r = Array.isArray(p.r) ? Math.max(...p.r) : p.r, h = p.l / 2;
    const e = p.ax === 'x' ? [h, r, r] : p.ax === 'z' ? [r, r, h] : [r, h, r];
    return [e.map((v) => -v), e];
  }
  if (p.t === 'ext') {
    const [u0, v0, u1, v1] = bbox2(p.poly), [d0, d1] = p.d;
    if (p.ax === 'x') return [[d0, v0, u0], [d1, v1, u1]];          // poly (z, y)
    if (p.ax === 'y') return [[u0, d0, v0], [u1, d1, v1]];          // poly (x, z)
    return [[u0, v0, d0], [u1, v1, d1]];                            // poly (x, y)
  }
  if (p.t === 'loft') {
    const ats = p.secs.map(([a]) => a), all = p.secs.flatMap(([, pts]) => pts);
    const [u0, v0, u1, v1] = bbox2(all), a0 = Math.min(...ats), a1 = Math.max(...ats);
    if ((p.ax || 'x') === 'x') return [[a0, v0, u0], [a1, v1, u1]];  // (u, v) = (z, y)
    if (p.ax === 'y') return [[u0, a0, v0], [u1, a1, v1]];           // (x, z)
    return [[u0, v0, a0], [u1, v1, a1]];                             // (x, y)
  }
  return [[0, 0, 0], [0, 0, 0]];
}
/** A part's model-space bounding box [min, max] (its local box turned by r3, moved by p; the +z side if mirrored). */
export function partBox(p) {
  const [lo, hi] = localBox(p), mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], o = p.p || [0, 0, 0];
  for (let i = 0; i < 8; i++) {
    const c = rotYZX([i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]], p.r3);
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], c[k] + o[k]); mx[k] = Math.max(mx[k], c[k] + o[k]); }
  }
  return [mn, mx];
}
/** World-space extents [sx, sy, sz] of a part. */
export const partExtent = (p) => { const [mn, mx] = partBox(p); return mx.map((v, k) => v - mn[k]); };
/** True if box a lies inside box b (b grown by `slack` on every side): its shadow adds nothing. */
const inside = (a, b, slack = 0.04) => a[0].every((v, k) => v >= b[0][k] - slack) && a[1].every((v, k) => v <= b[1][k] + slack);
/** How much shadow a part throws: its ground footprint plus its side stretched along the ground by the slanted sun
 *  (a spire or a raised pipe bank throws a long shadow from a small footprint). */
const SUN_STRETCH = 1 / Math.tan(SUN.elevationDeg * D2R);
export const shadowScore = (p) => { const [sx, sy, sz] = partExtent(p); return sx * sz + Math.max(sx, sz) * sy * SUN_STRETCH; };

// polygon reduction: convex hull for solid outlines, then drop the least-area vertex until ≤ n
function hull(pts) {
  const P = pts.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function simplify(pts, n) {
  const P = pts.slice();
  const area = (i) => { const a = P[(i + P.length - 1) % P.length], b = P[i], c = P[(i + 1) % P.length];
    return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); };
  while (P.length > n) { let k = 0, best = Infinity; for (let i = 0; i < P.length; i++) { const A = area(i); if (A < best) { best = A; k = i; } } P.splice(k, 1); }
  return P;
}
const resample = (pts, n) => (pts.length <= n ? pts : Array.from({ length: n }, (_, i) => pts[Math.floor(i * pts.length / n)]));

/** The cheapest honest form of one part, and its triangle count (one side; mirrored parts cast twice). */
export function proxyPart(p) {
  const keep = { p: p.p, r3: p.r3, mir: p.mir, g: p.g, m: 'dark' };
  if (p.t === 'box') return { part: { ...keep, t: 'box', s: p.s }, tris: 12 };
  if (p.t === 'ell') return { part: { ...keep, t: 'ell', s: p.s, seg: 6 }, tris: 36 };
  if (p.t === 'cyl') {
    const r = Array.isArray(p.r) ? Math.max(...p.r) : p.r, seg = Math.min(p.seg || 8, r < 0.08 ? 4 : 6);
    return { part: { ...keep, t: 'cyl', ax: p.ax, r: p.r, l: p.l, seg }, tris: seg * 4 };
  }
  if (p.t === 'ext') {
    // a big ring (halo, thruster ring) keeps its hole: both edges resampled evenly to 8 points so they stay
    // concentric; a track loop and a small ring cast solid; anything else casts its convex outline, ≤ 8 points
    // small rings (wheel rims, little halos) cast solid — a disc reads as a wheel at 34% black and costs half
    const [ru0, rv0, ru1, rv1] = bbox2(p.poly), big = Math.max(ru1 - ru0, rv1 - rv0) >= 1.8;
    const ringed = p.holes && p.holes.length && p.m !== 'track' && big;
    const poly = ringed ? resample(p.poly, 8) : simplify(hull(p.poly), 8);
    const holes = ringed ? p.holes.slice(0, 1).map((h) => resample(h, 8)) : [];
    const n = poly.length + holes.reduce((a, h) => a + h.length, 0);
    return { part: { ...keep, t: 'ext', ax: p.ax, poly, ...(holes.length ? { holes } : {}), d: p.d }, tris: n * 2 + (n + 2 * holes.length) * 2 };
  }
  if (p.t === 'loft') {
    const S = p.secs, pick = S.length <= 5 ? S : [0, 0.25, 0.5, 0.75, 1].map((f) => S[Math.round(f * (S.length - 1))]);
    const n = Math.min(6, S[0][1].length), secs = pick.map(([a, pts]) => [a, resample(pts, n)]);
    return { part: { ...keep, t: 'loft', ax: p.ax, secs }, tris: (secs.length - 1) * n * 2 + 2 * (n - 2) };
  }
  return { part: null, tris: 0 };
}

/** The model's shadow proxy: `{ ...def, parts }` (def.shadow if authored, else derived). */
export function shadowDef(def) {
  if (Array.isArray(def.shadow)) return { ...def, parts: def.shadow };
  const authored = def.shadow || {};
  const byGroup = {};
  for (const p of def.parts) {
    const g = p.g || 'body';
    if (isSpin(g) || isGlow(p) || authored[g]) continue;
    (byGroup[g] = byGroup[g] || []).push(p);
  }
  const parts = [];
  for (const [g, list] of Object.entries(byGroup)) {
    const ranked = list.map((p) => ({ p, s: shadowScore(p) * (p.mir ? 2 : 1) })).sort((a, b) => b.s - a.s);
    let budget = budgetFor(g) + (g === 'body' && def.hover ? 80 : 0), took = 0;   // a flyer's body is all wing
    const boxes = [];
    for (const { p, s } of ranked) {
      if (took && s < 0.015) break;                    // nothing left that throws a visible shadow
      const box = partBox(p);
      if (boxes.some((b) => inside(box, b))) continue;  // inside a part already casting (a track's filler, a hub in its rim)
      const { part, tris } = proxyPart(p);
      if (!part) continue;
      const cost = tris * (p.mir ? 2 : 1);
      if (took && cost > budget) continue;              // too dear for what is left; a cheaper part may still fit
      parts.push(part); boxes.push(box); budget -= cost; took++;
      if (budget <= 0) break;
    }
  }
  for (const [g, list] of Object.entries(authored)) for (const p of list) parts.push({ ...p, g: g === 'body' ? undefined : g });
  return { ...def, parts };
}
