/**
 * src/render3d/structures/baseMounts.js — towers on the base's corner hard-points sit ON the landing craft
 * [MM-task_mvj0k7v3_k].
 *
 * The base is a 3 × 3 keep whose four corner cells are buildable tower slots (map.base.cornerSlots). In 3D the keep
 * is a landing craft whose hull stands 0.85–1.37 cells tall over those corners, so a tower drawn at ground level
 * was swallowed by it. Owner 2026-10-21: "when towers are placed on the corners of the base unit they need to be
 * above .. not inside the base". A corner tower is MOUNTED instead: lifted to the hull's top surface at that cell
 * (measured from the posed craft, so every faction's craft gets its own deck) and drawn at MOUNT_SCALE — the same
 * 75% "turret on the hull, not a full tower parked on it" rule the 2D renderer uses (render/renderer.js shipSlots).
 *
 * Pure: the caller hands in topAt(x, z) (world hull top under a point); nothing here touches three.js.
 */

export const MOUNT_SCALE = 0.75;
/** Sample offsets inside a cell (world units): the tower sits on the highest of them, so no part of it clips in. */
const SAMPLES = [[0, 0], [0.2, 0.2], [0.2, -0.2], [-0.2, 0.2], [-0.2, -0.2]];

/** Mount heights for the corner slots: Map 'x,y' → world y of the hull top at that cell (cells the hull misses are left out). */
export function planMounts(cornerSlots, topAt) {
  const out = new Map();
  for (const c of cornerSlots || []) {
    let top = 0;
    for (const [dx, dz] of SAMPLES) top = Math.max(top, topAt(c.x + 0.5 + dx, c.y + 0.5 + dz) || 0);
    if (top > 0.01) out.set(c.x + ',' + c.y, Math.round(top * 1000) / 1000);
  }
  return out;
}

/** The mount under a structure (by its cell), or null: { y, s } — lift and draw scale. */
export function mountOf(mounts, s) {
  if (!mounts || !s) return null;
  const c = s.cell || s.pos;
  if (!c) return null;
  const y = mounts.get(Math.floor(c.x) + ',' + Math.floor(c.y));
  return y == null ? null : { y, s: MOUNT_SCALE };
}
