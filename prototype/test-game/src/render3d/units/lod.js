/**
 * src/render3d/units/lod.js — the far-zoom variant of a part-list model (code design §4.11 lodDef).
 *
 * At battle zoom a unit is ~30–60 px tall, where tread cleats, lenses, antennas and panel greebles are
 * sub-pixel. The LOD drops parts flagged as detail (`d: 1`), boxes and cylinders whose MIDDLE extent is under
 * 0.12 model units (glow parts under 0.05 — they carry the read), and caps cylinders at 6 sides. Shadows do NOT
 * use the LOD any more: each model casts a much cheaper shadow proxy (shadow.js) [MM-story_mvibvqd2_7].
 *
 * NEVER DROPS SILHOUETTE PARTS. In the part schema `d` means two things: the detail flag (`d: 1`) and an
 * extrusion's depth range (`d: [from, to]`). Testing `!p.d` read every extrusion's range as "detail" and the
 * far-zoom models lost their hulls, tracks, wheel pods and wings ([MM-story_mv8iu7l4_d]; inherited from the
 * prototype). The flag is now `d === 1` exactly, and extruded / lofted parts are always kept.
 *
 * Pure: works on the part list, no three.js. [MM-story_mv77hv5d_7]
 */

export const LOD_MIN_PART = 0.12;
export const LOD_MIN_GLOW_PART = 0.05;
export const LOD_MAX_CYL_SEG = 6;
/** Camera distance (world units) beyond which the LOD draws instead of full detail. */
export const LOD_DISTANCE = 22;

const isGlow = (p) => /^glow|amber/.test(p.m || '');
/** The detail flag — `d: 1` only. An extrusion's `d: [from, to]` is its depth, not a flag. */
export const isDetail = (p) => p.d === 1 || p.d === true;
/** Parts that make the silhouette: never dropped by the LOD. */
export const isSilhouette = (p) => p.t === 'ext' || p.t === 'loft' || p.t === 'ell';
const mid = (a) => a.slice().sort((x, y) => x - y)[1];

/** The middle of a part's three extents; non-box/cyl parts count as large (always kept). */
export function partSize(p) {
  if (p.t === 'box') return mid(p.s);
  if (p.t === 'cyl') {
    const r = Array.isArray(p.r) ? Math.max(...p.r) : p.r;
    return mid([r * 2, r * 2, p.l]);
  }
  return Infinity;
}

export function lodDef(def) {
  const parts = def.parts
    .filter((p) => isSilhouette(p) || (!isDetail(p) && partSize(p) >= (isGlow(p) ? LOD_MIN_GLOW_PART : LOD_MIN_PART)))
    .map((p) => (p.t === 'cyl' ? { ...p, seg: Math.min(p.seg || 8, LOD_MAX_CYL_SEG) } : p));
  return { ...def, parts };
}
