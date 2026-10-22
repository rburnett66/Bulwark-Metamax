/**
 * src/render3d/killCamView.js — where the Kill Camera looks [MM-task_mvjng96y_b] (story [MM-story_mvjng4fq_9]).
 *
 * Owner 2026-10-22: "a Kill Camera that focused of the point in the middle between the base and the unit that killed
 * the base". The target is pinned on that midpoint; the distance is the closest at which a square round the midpoint
 * holding both the base and the killer (plus a margin for the blast) fits the screen below the FINAL ATTACK header.
 * Over the whole sequence the camera pushes in slightly and drifts round a little, so the shot isn't static.
 * Pure: no three.js.
 */
import { CAMERA, fitCameraToRect, clearBox, cellToWorld } from './camera.js';

export const KILL_VIEW = Object.freeze({
  margin: 3,          // cells of ground round the base and the killer (the base's own size, its blast, the shots)
  headerFrac: 0.16,   // the top of the screen the header covers
  pushFrom: 1.08,     // distance × this at the start …
  pushTo: 0.9,        // … easing to × this at the end
  orbit: 0.28,        // radians the camera drifts round the target over the sequence
});

/** The framing distance for the whole sequence: the widest the square needs at any yaw it drifts through. */
export function killCamFit({ base, killer, w = 16, h = 9, yaw0 = 0 }) {
  const bx = cellToWorld(base.x), bz = cellToWorld(base.y);
  const kx = killer ? cellToWorld(killer.x) : bx, kz = killer ? cellToWorld(killer.y) : bz;
  const fx = (bx + kx) / 2, fz = (bz + kz) / 2;
  const half = Math.max(Math.abs(kx - bx), Math.abs(kz - bz)) / 2 + KILL_VIEW.margin;
  const rect = { x0: fx - half, z0: fz - half, x1: fx + half, z1: fz + half }, box = clearBox(w, h, { top: h * KILL_VIEW.headerFrac });
  let d = 0;
  for (const f of [0, 0.5, 1]) d = Math.max(d, fitCameraToRect({ tx: fx, tz: fz, dist: CAMERA.startDist, yaw: yaw0 + KILL_VIEW.orbit * f }, rect, w / h, box).dist);
  return d;
}

/**
 * killCamPose({ base, killer, t, total, w, h, yaw0, fit }) → camera { tx, tz, dist, yaw }. base / killer in CELLS (sim
 * coordinates, killer may be null); t = seconds into the sequence of `total`; w × h = the viewport; yaw0 = the yaw it
 * starts from (the battle camera's); fit = killCamFit(...) for these inputs (computed when not given).
 */
export function killCamPose({ base, killer, t = 0, total = 15, w = 16, h = 9, yaw0 = 0, fit = null }) {
  const bx = cellToWorld(base.x), bz = cellToWorld(base.y);
  const kx = killer ? cellToWorld(killer.x) : bx, kz = killer ? cellToWorld(killer.y) : bz;
  const u = Math.max(0, Math.min(1, total > 0 ? t / total : 1)), e = u * u * (3 - 2 * u);
  const d0 = fit != null ? fit : killCamFit({ base, killer, w, h, yaw0 });
  const dist = Math.max(CAMERA.minDist, Math.min(CAMERA.maxDist, d0 * (KILL_VIEW.pushFrom + (KILL_VIEW.pushTo - KILL_VIEW.pushFrom) * e)));
  return { tx: (bx + kx) / 2, tz: (bz + kz) / 2, dist, yaw: yaw0 + KILL_VIEW.orbit * e };
}
