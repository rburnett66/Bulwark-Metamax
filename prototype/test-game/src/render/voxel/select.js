/**
 * src/render/voxel/select.js — runtime frame selection for voxel unit packs (pure, no PIXI).
 *
 * MUST match the Stack Forge bake convention EXACTLY (docs §data-contract):
 *   bucket-0 = facing +X (east); STEP = 2π / n; nearest bucket, wrapped into [0, n).
 * Any offset/flip is fixed at bake time, so the runtime just rounds the heading to a bucket. Used for
 * both `stack` parts (angles buckets → smooth) and `directional` parts (facings buckets → snap).
 */

/** Nearest angle/facing bucket for a heading in radians, over n buckets. bucket-0 = +X. */
export function angleBucket(headingRad, n) {
  if (!(n > 0)) return 0;
  const step = (Math.PI * 2) / n;
  return (((Math.round(headingRad / step) % n) + n) % n);
}

/**
 * Screen offset (px) for a mounted part: mount = [dx, dy, dz] where dx,dy are footprint px and dz is
 * layers. In the baked iso stack a layer rises up-screen by layerSpacing, so dz lifts the part by
 * dz*layerSpacing (negative y = up). Returns { x, y }.
 */
export function mountScreen(mount, layerSpacing) {
  const [dx = 0, dy = 0, dz = 0] = mount || [];
  return { x: dx, y: dy - dz * (layerSpacing || 0) };
}

/** Up-screen lift (px) for a flying part: shadow stays on the ground, body rises by `alt`. */
export function altLift(shadow) {
  return shadow && shadow.alt > 0 ? shadow.alt : 0;
}
