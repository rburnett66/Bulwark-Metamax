// shots.js — cinematic camera recipes for presenting a capital ship.  [MM-story_mw01uvuu_4]
//
//   const cam = shot('orbit', t, { box, aspect });   // → { position, target, fov } (vertical fov, degrees)
//   camera.fov = cam.fov; camera.position.copy(cam.position); camera.lookAt(cam.target);
//
// Rules (docs/16 Bulwark MM/design/Capital-Ship-Scale-Research.md, presentation section):
// - Lenses read as huge at the two ends — a long lens from far away (85–135 mm: compressed, "aerial
//   photographer") or a wide lens almost touching the hull (24 mm: converging lines). Never the 35–50 mm
//   middle from above, which reads as a model on a table.
// - Big things move slowly: no hull feature crosses more than ~1/8 of the frame per second; orbits ≤ 1.2°/s.
// - Camera low, looking up. Infinite focus (no depth of field). Subtle directional "operator" drift, never shake.
// - Lenses are given as full-frame focal lengths and converted for the current aspect, so a phone held upright
//   keeps the same horizontal coverage instead of collapsing to a ~18° sliver.
// Ships are glTF Y-up: +X bow, +Y up, +Z starboard. All motion is deterministic in t (seconds into the shot).

const D = Math.PI / 180;
const LAND = 16 / 9;

// horizontal-coverage-preserving vertical FOV for a full-frame focal length (36 × 20.25 mm at 16:9)
export function lensFov(mm, aspect) {
  const vLand = 2 * Math.atan(20.25 / 2 / mm);
  if (aspect >= LAND) return vLand / D;
  const h = 2 * Math.atan(Math.tan(vLand / 2) * LAND);           // keep the 16:9 horizontal coverage
  return Math.min(60, 2 * Math.atan(Math.tan(h / 2) / aspect) / D);
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// slow, directional "camera operator" drift: two incommensurate sines per axis, ±0.1°
const drift = (t, s) => (Math.sin(t * 0.31 + s) * 0.6 + Math.sin(t * 0.17 + s * 2.3) * 0.4) * 0.1 * D;

export const SHOTS = {
  // establishing orbit: 135 mm from ~4 L, slow orbit, looking up, ship on the lower-right third
  orbit: { mm: 135, seconds: 18 },
  // hull flyby: 35 mm trucking along the hull 0.18 L off it, a little below the mid-plane
  flyby: { mm: 35, seconds: 10 },
  // stern engines: 85 mm from 2.2 L astern, low and a little off axis, slow push-in
  stern: { mm: 85, seconds: 8 },
  // bow reveal: 24 mm under the keel line looking back and up; the ship slides overhead, bow first
  bow: { mm: 24, seconds: 12 },
};
export const SHOT_ORDER = ['orbit', 'flyby', 'stern', 'bow'];

export function shot(name, t, { box, aspect = LAND, still = false }) {
  const s = SHOTS[name] || SHOTS.orbit;
  const lo = box.min, hi = box.max;
  const L = hi.x - lo.x, H = hi.y - lo.y, W = hi.z - lo.z;
  const cx = (lo.x + hi.x) / 2, cy = (lo.y + hi.y) / 2, cz = (lo.z + hi.z) / 2;
  const fov = lensFov(s.mm, aspect);
  const hfov = 2 * Math.atan(Math.tan(fov * D / 2) * aspect);
  const tt = still ? 0 : t;
  let p, g;                                                       // position, look-at target
  if (name === 'flyby') {
    const x = lo.x + L * (0.15 + 0.04 * tt);                      // 0.04 L/s toward the bow
    p = [x, cy - H * 0.2, hi.z + L * 0.18];
    g = [x + L * 0.4, cy + H * 0.1, cz + W * 0.2];                // look forward along the hull
  } else if (name === 'stern') {
    const d = L * 2.2 * (1 - 0.015 * tt);                         // push in 1.5 % of distance per second
    p = [lo.x - d * Math.cos(12 * D), cy - d * Math.sin(8 * D), cz + d * Math.sin(12 * D)];
    g = [lo.x + L * 0.12, cy, cz];
  } else if (name === 'bow') {
    const x = hi.x + L * 0.35 - L * 0.05 * tt;                    // the ship "moves" 0.05 L/s past the camera
    p = [x, lo.y - L * 0.08, cz + L * 0.22];
    const tilt = (24 - 0.6 * tt) * D;                             // look back and up; ease down as the bow passes
    g = [x - L * 0.4 * Math.cos(tilt), p[1] + L * 0.4 * Math.sin(tilt), cz];
  } else {                                                        // orbit
    const f = 0.6;                                                // ship spans 60 % of frame width
    const d = Math.max(L / (f * 2 * Math.tan(hfov / 2)), H / (0.7 * 2 * Math.tan(fov * D / 2)));   // fit length AND height
    const yaw = (-30 - 1.2 * tt) * D;
    const pitch = (-6 - 3 * Math.sin(tt * 0.06)) * D;             // camera below, looking up
    p = [cx + Math.cos(pitch) * Math.cos(yaw) * d, cy + Math.sin(pitch) * d, cz - Math.cos(pitch) * Math.sin(yaw) * d];
    g = [cx, cy + H * 0.05, cz];
  }
  // operator drift on the aim point (not on position, so the ship never jitters against the stars)
  const dist = Math.hypot(g[0] - p[0], g[1] - p[1], g[2] - p[2]);
  if (!still) { g[1] += Math.tan(drift(t, 1.7)) * dist; g[2] += Math.tan(drift(t, 4.1)) * dist; }
  const fade = smooth(0, 0.6, t) * (1 - smooth(s.seconds - 0.6, s.seconds, t));   // for a dip-to-black cut
  return { position: p, target: g, fov, fade, seconds: s.seconds, mm: s.mm };
}
