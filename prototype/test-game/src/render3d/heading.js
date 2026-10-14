/**
 * src/render3d/heading.js — per-entity heading for the 3D view, derived from motion between frames.
 *
 * The sim state carries positions, not a facing the renderer can use, so the view remembers each unit's
 * last position and turns it toward where it moved. A unit standing still keeps its last heading (no
 * snapping to 0). Entities that vanish are forgotten on sweep(). This is presentation state only — it is
 * never written back to the sim.
 *
 * Convention (plan v2.2 §6.3): heading = atan2(dz, dx) in cell space; model forward is +X.
 * Pure: no three.js.
 */

const MIN_STEP = 1e-4;   // cells; smaller moves are jitter, not a direction

export function createHeadingTracker() {
  const last = new Map();   // id -> { x, y, heading }
  return {
    /** Update with this frame's position; returns the heading to draw (radians). */
    update(id, x, y, initial = 0) {
      const prev = last.get(id);
      if (!prev) { last.set(id, { x, y, heading: initial }); return initial; }
      const dx = x - prev.x, dy = y - prev.y;
      if (dx * dx + dy * dy > MIN_STEP * MIN_STEP) prev.heading = Math.atan2(dy, dx);
      prev.x = x; prev.y = y;
      return prev.heading;
    },
    /** Forget every id not in `liveIds` (a Set). */
    sweep(liveIds) {
      for (const id of last.keys()) if (!liveIds.has(id)) last.delete(id);
    },
    get size() { return last.size; },
  };
}
