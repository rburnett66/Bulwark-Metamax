/**
 * src/render3d/units/lod.js — the far-zoom variant of a part-list model (code design §4.11 lodDef).
 *
 * At battle zoom a unit is ~30–60 px tall, where tread cleats, lenses, antennas and panel greebles are
 * sub-pixel. The LOD drops parts flagged as detail (`d`), parts whose MIDDLE extent is under 0.12 model units
 * (glow parts under 0.05 — they carry the read), and caps cylinders at 6 sides. Shadows always use the LOD:
 * a shadow only needs the silhouette.
 *
 * Pure: works on the part list, no three.js. [MM-story_mv77hv5d_7]
 */

export const LOD_MIN_PART = 0.12;
export const LOD_MIN_GLOW_PART = 0.05;
export const LOD_MAX_CYL_SEG = 6;
/** Camera distance (world units) beyond which the LOD draws instead of full detail. */
export const LOD_DISTANCE = 22;

const isGlow = (p) => /^glow|amber/.test(p.m || '');
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
    .filter((p) => !p.d && partSize(p) >= (isGlow(p) ? LOD_MIN_GLOW_PART : LOD_MIN_PART))
    .map((p) => (p.t === 'cyl' ? { ...p, seg: Math.min(p.seg || 8, LOD_MAX_CYL_SEG) } : p));
  return { ...def, parts };
}
