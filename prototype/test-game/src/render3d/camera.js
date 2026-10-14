/**
 * src/render3d/camera.js — the battle camera for the three.js view (plan v2.2 §6.1, code design §4.1/§4.20).
 *
 * PURE MATHS: no three.js import, so node --test can cover it (CI has neither three.js nor WebGL). The
 * facade (index.js) copies the pose onto a THREE.PerspectiveCamera each frame.
 *
 * World: X = column (east), Z = row (south), Y = up; 1 world unit = 1 cell; play surface = plane Y = 0.
 * A sim position (cells) maps to world (x + 0.5, z + 0.5) — the same cell-centre convention as Pixi's
 * cellToLocal. The camera looks at a ground target from `dist` away, pitched down PITCH, turned by `yaw`
 * (0 = looking north). During the battle yaw stays 0: the skeleton exposes pan and zoom only.
 */

export const CAMERA = Object.freeze({
  pitchDeg: 37,    // = the GND-Tanks bake elevation; free to tune now that units are 3D (plan v2.2 §6.1)
  fovDeg: 30,
  near: 0.5,
  far: 600,
  minDist: 10,
  maxDist: 95,
  startDist: 46,
  margin: 2,       // how far past the map edge the target may pan, in cells
});

const RAD = Math.PI / 180;

/** Sim cell coordinate → world coordinate (cell centre). */
export const cellToWorld = (c) => c + 0.5;

/** World point on the ground → the cell it falls in. */
export function worldToCell(x, z) {
  return { x: Math.floor(x), y: Math.floor(z) };
}

/** Initial camera: centred on the base (or the map centre when the map has none). */
export function createCameraState(map) {
  const b = map && map.base;
  return {
    tx: b ? cellToWorld(b.x) : (map.cols || 0) / 2,
    tz: b ? cellToWorld(b.y) : (map.rows || 0) / 2,
    dist: CAMERA.startDist,
    yaw: 0,
  };
}

/** Keep the target near the map and the distance inside its limits. Mutates and returns `cam`. */
export function clampCamera(cam, cols, rows) {
  cam.dist = Math.max(CAMERA.minDist, Math.min(CAMERA.maxDist, cam.dist));
  cam.tx = Math.max(-CAMERA.margin, Math.min(cols + CAMERA.margin, cam.tx));
  cam.tz = Math.max(-CAMERA.margin, Math.min(rows + CAMERA.margin, cam.tz));
  return cam;
}

/** Camera position + look-at target for the current state. */
export function cameraPose(cam) {
  const p = CAMERA.pitchDeg * RAD;
  const c = Math.cos(p) * cam.dist;
  return {
    position: { x: cam.tx + Math.sin(cam.yaw) * c, y: Math.sin(p) * cam.dist, z: cam.tz + Math.cos(cam.yaw) * c },
    target: { x: cam.tx, y: 0, z: cam.tz },
  };
}

/**
 * Drag by (dx, dy) screen pixels → move the ground target so the ground under the pointer follows it.
 * World units per pixel at the target = visible height at distance / viewport height. Screen-vertical
 * motion covers more ground than horizontal by 1 / sin(pitch) (the ground is foreshortened).
 */
export function panByPixels(cam, dx, dy, viewportH) {
  if (!(viewportH > 0)) return cam;
  const perPx = (2 * cam.dist * Math.tan((CAMERA.fovDeg * RAD) / 2)) / viewportH;
  const gx = -dx * perPx;
  const gz = (-dy * perPx) / Math.sin(CAMERA.pitchDeg * RAD);
  // rotate the screen-space move by yaw (0 in battle, kept for the out-of-battle orbit later)
  const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  cam.tx += gx * c + gz * s;
  cam.tz += -gx * s + gz * c;
  return cam;
}

/** Zoom by a factor (> 1 = out). */
export function zoomBy(cam, factor) {
  if (factor > 0 && Number.isFinite(factor)) cam.dist *= factor;
  return cam;
}

/** Intersect a ray with the ground plane Y = 0. Returns {x, z} or null when the ray misses it. */
export function rayToGround(origin, dir) {
  if (!(dir.y < -1e-9)) return null;          // parallel to or pointing away from the ground
  const t = -origin.y / dir.y;
  return { x: origin.x + dir.x * t, z: origin.z + dir.z * t };
}
