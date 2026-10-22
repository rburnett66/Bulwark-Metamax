/**
 * src/render3d/killCamView.js — where the Kill Camera looks [MM-task_mvjng96y_b] (story [MM-story_mvjng4fq_9]).
 *
 * Owner 2026-10-22: "a Kill Camera that focused of the point in the middle between the base and the unit that killed
 * the base", then [MM-task_mvjprwua_c]: "using the same tilt orient the camera behind the base facing the attacking
 * unit then arc to the right keeping the unit and base in view so that in the last 2 seconds the camera is facing
 * towards the base".
 *
 * The target stays pinned on the midpoint; the tilt is the game's (CAMERA.pitchDeg). The yaw does the work:
 *   - start: the camera sits BEHIND THE BASE (on the far side from the killer), looking over it at the killer;
 *   - arc:   it swings half way round TO ITS RIGHT (yaw + π), easing in and out;
 *   - end:   it arrives BEHIND THE KILLER, looking at the base, KILL_VIEW.faceBase seconds before the base falls, and
 *            holds there through the final shots, the blast and the burn.
 * The distance is fitted once for the whole arc (the widest any yaw on it needs) so both stay framed below the
 * FINAL ATTACK header the whole way, with a slight push-in as it comes round. Pure: no three.js.
 */
import { CAMERA, fitCameraToRect, clearBox, cellToWorld } from './camera.js';

export const KILL_VIEW = Object.freeze({
  margin: 3,          // cells of ground round the base and the killer (the base's own size, its blast, the shots)
  headerFrac: 0.16,   // the top of the screen the header covers
  arc: Math.PI,       // how far round it swings (to its right): behind the base → behind the killer
  faceBase: 2,        // seconds before the base falls that the camera is already facing it (the owner's "last 2 s")
  pushFrom: 1.06,     // distance × this at the start of the arc …
  pushTo: 0.92,       // … easing to × this at its end
  samples: 9,         // yaws on the arc the framing is checked at
});

const smooth = (u) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };

/** World points of the base and the killer (the killer defaults to the base). */
function ends(base, killer) {
  const bx = cellToWorld(base.x), bz = cellToWorld(base.y);
  return { bx, bz, kx: killer ? cellToWorld(killer.x) : bx, kz: killer ? cellToWorld(killer.y) : bz };
}

/**
 * The yaw that puts the camera behind the base looking at the killer. The camera sits at target + (sin yaw, cos yaw)
 * (camera.js cameraPose), so that direction must point from the killer to the base. yaw0 when there is no killer.
 */
export function startYaw(base, killer, yaw0 = 0) {
  const { bx, bz, kx, kz } = ends(base, killer);
  const dx = bx - kx, dz = bz - kz;
  return Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dx, dz) : yaw0;
}

/** The framing distance for the whole arc: the widest a square holding the base and the killer needs at any yaw on it. */
export function killCamFit({ base, killer, w = 16, h = 9, yaw0 = 0 }) {
  const { bx, bz, kx, kz } = ends(base, killer);
  const fx = (bx + kx) / 2, fz = (bz + kz) / 2;
  const half = Math.hypot(kx - bx, kz - bz) / 2 + KILL_VIEW.margin;   // round the arc the pair points every way
  const rect = { x0: fx - half, z0: fz - half, x1: fx + half, z1: fz + half }, box = clearBox(w, h, { top: h * KILL_VIEW.headerFrac });
  const y0 = startYaw(base, killer, yaw0);
  let d = 0;
  for (let i = 0; i < KILL_VIEW.samples; i++) {
    const yaw = y0 + KILL_VIEW.arc * (i / (KILL_VIEW.samples - 1));
    d = Math.max(d, fitCameraToRect({ tx: fx, tz: fz, dist: CAMERA.startDist, yaw }, rect, w / h, box).dist);
  }
  return d;
}

/**
 * killCamPose({ base, killer, t, replay, w, h, yaw0, fit }) → camera { tx, tz, dist, yaw }. base / killer in CELLS
 * (sim coordinates, killer may be null); t = seconds since the Kill Camera started; replay = seconds of replay before
 * the base falls (the arc ends KILL_VIEW.faceBase before that); w × h = the viewport; yaw0 = the battle camera's yaw
 * (used only when there's no killer to face); fit = killCamFit(...) for these inputs (computed when not given).
 */
export function killCamPose({ base, killer, t = 0, replay = 10, w = 16, h = 9, yaw0 = 0, fit = null }) {
  const { bx, bz, kx, kz } = ends(base, killer);
  const arcEnd = Math.max(0.5, replay - KILL_VIEW.faceBase);
  const e = smooth(t / arcEnd);
  const d0 = fit != null ? fit : killCamFit({ base, killer, w, h, yaw0 });
  const dist = Math.max(CAMERA.minDist, Math.min(CAMERA.maxDist, d0 * (KILL_VIEW.pushFrom + (KILL_VIEW.pushTo - KILL_VIEW.pushFrom) * e)));
  return { tx: (bx + kx) / 2, tz: (bz + kz) / 2, dist, yaw: startYaw(base, killer, yaw0) + KILL_VIEW.arc * e };
}
