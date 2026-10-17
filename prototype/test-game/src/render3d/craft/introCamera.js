/**
 * src/render3d/craft/introCamera.js — the camera move that frames a landing. [MM-story_mvbqui1g_m]
 *
 * The battle camera starts far out (it frames the field), where a landing reads as a speck. While the craft lands
 * the view is framed on the base instead: a slow push-in from INTRO.far to INTRO.near cells, the look point leaning
 * toward the craft while it is still out on its approach, then — from the hatches opening to the end of the
 * deploy — an ease back out to wherever the player's camera is. Pure: (pose, player camera, base) → camera state.
 */
import { phaseStart, TOTAL } from './landing.js';
import { CRAFT_SCALE } from './models.js';

export const INTRO = Object.freeze({ far: 17, near: 11, lean: 0.45 });

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

/**
 * pose: landing.js pose (needs t, x, z); cam: the player's { tx, tz, dist, yaw }; base: { x, y } centre cell.
 * Returns a camera state { tx, tz, dist, yaw } for cameraPose().
 */
export function introCamera(pose, cam, base) {
  if (!pose || !base) return cam;
  const t = pose.t || 0, td = phaseStart('touchdown'), h = phaseStart('hatches');
  const bx = base.x + 0.5, bz = base.y + 0.5;
  const lean = INTRO.lean * (1 - smooth(t / (td * 0.8)));                       // look toward the craft early, settle on the spot
  const ix = bx + (pose.x || 0) * CRAFT_SCALE * lean, iz = bz + (pose.z || 0) * CRAFT_SCALE * lean;
  const idist = INTRO.far + (INTRO.near - INTRO.far) * smooth(t / td);          // slow push-in to touchdown
  const b = smooth((t - h) / (TOTAL - h));                                       // hand back to the player's camera
  return {
    tx: ix + (cam.tx - ix) * b,
    tz: iz + (cam.tz - iz) * b,
    dist: idist + (cam.dist - idist) * b,
    yaw: cam.yaw,
  };
}
