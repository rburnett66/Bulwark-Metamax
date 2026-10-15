/**
 * src/render3d/camera.js — the battle camera for the three.js view (plan v2.2 §6.1, code design §4.1/§4.20).
 *
 * PURE MATHS: no three.js import, so node --test can cover it (CI has neither three.js nor WebGL). The
 * facade (index.js) copies the pose onto a THREE.PerspectiveCamera each frame.
 *
 * World: X = column (east), Z = row (south), Y = up; 1 world unit = 1 cell; play surface = plane Y = 0.
 * A sim position (cells) maps to world (x + 0.5, z + 0.5) — the same cell-centre convention as Pixi's
 * cellToLocal. The camera looks at a ground target from `dist` away, pitched down PITCH, turned by `yaw`
 * (0 = looking north). During the battle yaw stays 0 (pan + zoom only); outside it the view turns freely —
 * stepYaw / twistBy below hold that rule [MM-task_mv9s9o5d_3].
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
  // rotate the screen-space move by yaw (0 in battle; free outside it)
  const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  cam.tx += gx * c + gz * s;
  cam.tz += -gx * s + gz * c;
  return cam;
}

/** Yaw wrapped into (-π, π]. */
export function wrapYaw(a) {
  const t = 2 * Math.PI;
  a = ((a % t) + t) % t;
  return a > Math.PI ? a - t : a;
}

/** Yaw ease rate when a wave starts (1/s): ~95 % of the way back in 0.5 s. */
export const YAW_EASE = 6;
/** …and never slower than this (rad/s), so it reaches exactly 0. */
export const YAW_MIN_SPEED = 0.6;

/**
 * Battle camera rules (plan §6.1, user rule 18): during the battle the camera pans and zooms but never
 * rotates — a twist is refused, and a yaw left over from the build phase eases back to 0 (the short way
 * round). Outside the battle, twists turn freely. Mutates and returns `cam`.
 */
export function stepYaw(cam, inBattle, dt) {
  if (!inBattle || cam.yaw === 0) return cam;
  const t = Math.max(0, dt || 0);
  const y = wrapYaw(cam.yaw);
  // exponential ease, with a floor speed so the tail lands in finite time instead of creeping
  const step = Math.max(Math.abs(y) * (1 - Math.exp(-YAW_EASE * t)), YAW_MIN_SPEED * t);
  cam.yaw = Math.abs(y) <= step ? 0 : y - Math.sign(y) * step;
  return cam;
}

/** Turn the camera by `d` radians — only outside the battle. Returns true when it turned. */
export function twistBy(cam, d, inBattle) {
  if (inBattle || !Number.isFinite(d) || d === 0) return false;
  cam.yaw = wrapYaw(cam.yaw + d);
  return true;
}

/** Right-drag: radians of yaw per screen pixel (a full drag across a 1280 px view ≈ 1 turn). */
export const YAW_PER_PX = (2 * Math.PI) / 1280;

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

/**
 * The camera ray through normalised device coords (ndcX, ndcY in -1..1, +Y up) — the same ray
 * THREE.Raycaster.setFromCamera builds for a PerspectiveCamera that lookAt()s cameraPose(cam) with up = +Y.
 */
function cameraBasis(cam) {
  const { position: o, target: t } = cameraPose(cam);
  let fx = t.x - o.x, fy = t.y - o.y, fz = t.z - o.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  // right = forward × up(0,1,0); camUp = right × forward
  let rx = -fz, rz = fx;
  const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  return {
    o, f: { x: fx, y: fy, z: fz }, r: { x: rx, y: 0, z: rz },
    u: { x: -rz * fy, y: rz * fx - rx * fz, z: rx * fy },
    th: Math.tan((CAMERA.fovDeg * RAD) / 2),
  };
}

export function pickRay(cam, aspect, ndcX, ndcY) {
  const { o, f, r, u, th } = cameraBasis(cam);
  const sx = ndcX * th * aspect, sy = ndcY * th;
  return { origin: o, dir: { x: f.x + r.x * sx + u.x * sy, y: f.y + u.y * sy, z: f.z + r.z * sx + u.z * sy } };
}

/**
 * Viewport pixel (px, py from the top-left of a w × h view) → the sim cell under it, or null when the ray
 * misses the ground or lands off the map. `lift` (cells) moves the pick that far up-screen — touch builds
 * aim 1.4 cells above the finger so the ghost isn't hidden under it (plan §6.9).
 */
export function screenToGroundCell(cam, w, h, px, py, cols, rows, lift = 0) {
  if (!(w > 0 && h > 0)) return null;
  const { origin, dir } = pickRay(cam, w / h, (px / w) * 2 - 1, 1 - (py / h) * 2);
  const g = rayToGround(origin, dir);
  if (!g) return null;
  const x = g.x - Math.sin(cam.yaw) * lift, z = g.z - Math.cos(cam.yaw) * lift;   // up-screen on the ground
  const c = worldToCell(x, z);
  if (c.x < 0 || c.y < 0 || c.x >= cols || c.y >= rows) return null;
  return c;
}

/** Sim cell centre → viewport pixel (inverse of screenToGroundCell for a point on the ground). */
export function groundCellToScreen(cam, w, h, cell) {
  const { o, f, r, u, th } = cameraBasis(cam);
  const vx = cellToWorld(cell.x) - o.x, vy = -o.y, vz = cellToWorld(cell.y) - o.z;
  const depth = vx * f.x + vy * f.y + vz * f.z;
  if (!(depth > 1e-6)) return null;   // behind the camera
  const ndcX = (vx * r.x + vz * r.z) / depth / (th * (w / h));
  const ndcY = (vx * u.x + vy * u.y + vz * u.z) / depth / th;
  return { x: (ndcX + 1) * 0.5 * w, y: (1 - ndcY) * 0.5 * h };
}
