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

/**
 * Touch placement: the build slot sits UP AND LEFT of the fingertip so the finger never covers it (owner
 * 2026-10-18, "virtual joystick"). A fixed screen offset (CSS px) — the same at every zoom — clamped inside the
 * view so the slot stays reachable near the top / left edge. [MM-story_mvee80a0_d]
 */
export const TOUCH_OFFSET = Object.freeze({ x: -56, y: -72, edge: 12 });
export function touchSlotPoint(px, py, w, h, o = TOUCH_OFFSET) {
  const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return { x: cl(px + o.x, o.edge, Math.max(o.edge, w - o.edge)), y: cl(py + o.y, o.edge, Math.max(o.edge, h - o.edge)) };
}

/**
 * Pre-match framing [MM-task_mveuiw7u_e] [MM-task_mvewfno7_g] — owner 2026-10-18: "the map camera is not properly
 * positioned before the match .. probably needs to be calculated for every aspect ratio", then "We are only tuning game
 * play for landscape screens, but mobile and pc monitors can have different aspect ratios (16:9, 23x9)".
 *
 * The play area is framed inside the part of the screen the HUD leaves clear (the top bar, the build tray), centred in
 * that region on both axes, at the closest distance that shows all of it — for any landscape aspect.
 *
 * FIT: how much of that clear region (as a fraction of its half-extents) the play area may fill.
 */
export const FIT = Object.freeze({ x: 0.94, y: 0.9 });

/** World point on the ground → NDC (x right, y up, -1..1) for `cam` at `aspect`; null when behind the camera. */
export function groundToNdc(cam, aspect, x, z) {
  const { o, f, r, u, th } = cameraBasis(cam);
  const vx = x - o.x, vy = -o.y, vz = z - o.z;
  const depth = vx * f.x + vy * f.y + vz * f.z;
  if (!(depth > 1e-6)) return null;
  return { x: (vx * r.x + vz * r.z) / depth / (th * aspect), y: (vx * u.x + vy * u.y + vz * u.z) / depth / th };
}

/**
 * The clear region as an NDC box { x0, x1, y0, y1 } (y up), shrunk by FIT about its centre. `insets` are CSS px the
 * HUD covers on each side ({ top, left, right, bottom }, any missing = 0) of a w × h viewport.
 */
export function clearBox(w, h, insets = {}, fit = FIT) {
  const L = Math.max(0, insets.left || 0), R = Math.max(0, insets.right || 0);
  const T = Math.max(0, insets.top || 0), B = Math.max(0, insets.bottom || 0);
  let x0 = (L / w) * 2 - 1, x1 = 1 - (R / w) * 2, y0 = (B / h) * 2 - 1, y1 = 1 - (T / h) * 2;
  if (!(x1 - x0 > 0.2)) { x0 = -1; x1 = 1; }                 // a HUD that leaves nothing clear is ignored, not obeyed
  if (!(y1 - y0 > 0.2)) { y0 = -1; y1 = 1; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = ((x1 - x0) / 2) * fit.x, hy = ((y1 - y0) / 2) * fit.y;
  return { x0: cx - hx, x1: cx + hx, y0: cy - hy, y1: cy + hy };
}

/**
 * Frame a ground rectangle { x0, z0, x1, z1 } (world units) at viewport `aspect` (w / h) inside `box` (NDC, from
 * clearBox; default the whole view shrunk by FIT): the closest distance (minDist..maxDist) at which all four corners
 * land in the box, with the target slid so the rectangle is centred in it — along the view for top/bottom (perspective
 * makes the near edge bigger, so the rectangle's centre is not the balanced target) and across it for left/right.
 * Keeps the current yaw. Mutates and returns `cam`. Pure — no three.js.
 */
export function fitCameraToRect(cam, rect, aspect, box = null) {
  if (!rect || !(aspect > 0)) return cam;
  const B = box || { x0: -FIT.x, x1: FIT.x, y0: -FIT.y, y1: FIT.y };
  const bcx = (B.x0 + B.x1) / 2, bcy = (B.y0 + B.y1) / 2;
  const cx = (rect.x0 + rect.x1) / 2, cz = (rect.z0 + rect.z1) / 2;
  const corners = [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x0, rect.z1], [rect.x1, rect.z1]];
  const bx = Math.sin(cam.yaw), bz = Math.cos(cam.yaw);    // ground direction from the target back toward the camera
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);   // screen-right on the ground
  const span = Math.hypot(rect.x1 - rect.x0, rect.z1 - rect.z0) + 1;
  const camAt = (dist, s, t) => ({ tx: cx + bx * s + rx * t, tz: cz + bz * s + rz * t, dist, yaw: cam.yaw });
  const extent = (c) => {
    let top = -Infinity, bot = Infinity, lft = Infinity, rgt = -Infinity;
    for (const [x, z] of corners) {
      const p = groundToNdc(c, aspect, x, z);
      if (!p) return null;
      top = Math.max(top, p.y); bot = Math.min(bot, p.y); lft = Math.min(lft, p.x); rgt = Math.max(rgt, p.x);
    }
    return { top, bot, lft, rgt };
  };
  const bisect = (f) => {                                    // f(m) > 0 → answer is below m
    let lo = -span, hi = span;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
    return (lo + hi) / 2;
  };
  const centre = (dist) => {                                 // two passes: the axes barely interact
    let s = 0, t = 0;
    for (let k = 0; k < 2; k++) {
      s = bisect((m) => { const e = extent(camAt(dist, m, t)); return e ? (e.top + e.bot) / 2 - bcy : 1; });
      t = bisect((m) => { const e = extent(camAt(dist, s, m)); return e ? bcx - (e.lft + e.rgt) / 2 : 1; });
    }
    return { s, t };
  };
  const fits = (dist) => {
    const { s, t } = centre(dist), e = extent(camAt(dist, s, t));
    return !!e && e.top <= B.y1 + 1e-9 && e.bot >= B.y0 - 1e-9 && e.lft >= B.x0 - 1e-9 && e.rgt <= B.x1 + 1e-9;
  };
  let lo = CAMERA.minDist, hi = CAMERA.maxDist;
  if (fits(lo)) hi = lo;
  else for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
  const { s, t } = centre(hi), c = camAt(hi, s, t);
  cam.dist = c.dist; cam.tx = c.tx; cam.tz = c.tz;
  return cam;
}
