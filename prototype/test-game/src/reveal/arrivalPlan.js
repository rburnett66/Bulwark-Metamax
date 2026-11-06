/**
 * src/reveal/arrivalPlan.js — a capital ship's first-sight arrival, as a pure function of time [MM-story_mw56ve9g_6].
 *
 * Design: docs/16 Bulwark MM/design/Capital-Ship-Arrival-Design.md §3 (beats 0–6, 22 s) and §6 (owner 2026-11-06: the
 * ship then holds a stationary orbit in the UPPER LEFT of the screen). Tech plan: docs/tech-plan/Content-Reveal.md
 * §5.2–5.3. Camera grammar from the design: the shared shots.js recipes, cuts between beats 1→2, 2→3, 3→4, one long
 * ease-out pull back into the orbit shot. Then, on a first visit, F1: the slow pan to the ship's flank (the opening's
 * flank framing), which the board wipe follows.
 *
 * Ship space (glTF): +X bow, +Y up, +Z starboard. The ship holds still; the camera does the travelling (an approach is
 * the camera closing on the ship), so any ship's bounding box works. No three.js, no clock, no Math.random.
 */
import { shot, lensFov } from '../render3d/ships/shots.js';

export const ARRIVAL_BEATS = Object.freeze([
  { id: 'contact', start: 0, end: 1.5 },
  { id: 'arrive', start: 1.5, end: 3.5 },
  { id: 'approach', start: 3.5, end: 8 },
  { id: 'pass', start: 8, end: 10.5 },
  { id: 'brake', start: 10.5, end: 14 },
  { id: 'orbit', start: 14, end: 18 },
  { id: 'title', start: 18, end: 22 },
  { id: 'flank', start: 22, end: 28 },
]);
export const FIRST_SIGHT_S = 22;      // the arrival proper (beats 0–6); the title card writes introSeen
export const FLANK_S = 28;            // + F1, the pan to the flank (first visit only)

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const obj = (a) => (Array.isArray(a) ? { x: a[0], y: a[1], z: a[2] } : a);

export function beatOf(t) {
  for (const b of ARRIVAL_BEATS) if (t < b.end) return b;
  return ARRIVAL_BEATS[ARRIVAL_BEATS.length - 1];
}

/**
 * The arrival at time t.
 * → { beat, camera:{position,target,fov}, engine (0.35 idle … 2 story burn), flash 0..1 (the arrival flash),
 *     tugs, plate 0..1 (the ship name plate), title 0..1 (the title card), letterbox 0..1, commit (title card shown) }
 */
export function arrivalAt(t, { box, aspect = 16 / 9, reduced = false } = {}) {
  const B = { min: obj(box.min), max: obj(box.max) };
  const L = B.max.x - B.min.x, H = B.max.y - B.min.y;
  const c = [(B.min.x + B.max.x) / 2, (B.min.y + B.max.y) / 2, (B.min.z + B.max.z) / 2];
  const b = beatOf(t);
  const T = reduced ? (b.end - 0.001) : t;      // reduced motion: each beat is a still at its settled pose
  let cam, engine = 2;
  if (T < 8) {
    // contact → arrival → approach: the camera ahead of the bow, low, the ship closing from far away (a point of light
    // beyond the limb at first) until it fills the frame; the 85 mm stern recipe turned to face the bow
    const s = shot('stern', 0, { box: B, aspect, still: true });
    const far = 1 - smooth(1.5, 8, T);                              // 1: far away … 0: filling the frame
    const d = L * (2.4 + 34 * far * far);
    const dir = [Math.cos(14 * Math.PI / 180), -Math.sin(7 * Math.PI / 180), Math.sin(16 * Math.PI / 180)];
    cam = { position: [B.max.x + dir[0] * d, c[1] + dir[1] * d, c[2] + dir[2] * d], target: [c[0] + L * 0.1, c[1], c[2]], fov: s.fov };
  } else if (T < 10.5) {
    cam = shot('bow', (T - 8) * 2.2, { box: B, aspect });           // the pass: the ship slides overhead, bow first
  } else if (T < 14) {
    cam = shot('flyby', T - 10.5, { box: B, aspect });             // the braking burn, along the hull
    engine = 2 - 1.2 * smooth(10.5, 14, T);
  } else {
    // the pull back into the orbit shot (the design's one long move), then the held orbit and the title card
    const o = shot('orbit', T - 14, { box: B, aspect });
    const f = shot('flyby', 3.5, { box: B, aspect });
    const k = smooth(14, 17, T);
    cam = { position: lerp3(f.position, o.position, k), target: lerp3(f.target, o.target, k), fov: f.fov + (o.fov - f.fov) * k };
    engine = 0.8 - 0.45 * smooth(14, 18, T);
    if (T >= 22) {
      // F1 — the pan to the flank: abeam the starboard side, level, the ship spanning 85 % of the frame (the opening's
      // flank framing), slowly, so the board wipe can follow
      const fov = lensFov(105, aspect), hfov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
      const frameW = aspect >= 1 ? L / 0.85 : L * 0.5;
      const dist = frameW / (2 * Math.tan(hfov / 2));
      const flank = { position: [c[0], c[1] + H * 0.02, B.max.z + dist], target: [c[0], c[1], c[2]], fov };
      const kf = smooth(22, 27, T);
      cam = { position: lerp3(cam.position, flank.position, kf), target: lerp3(cam.target, flank.target, kf), fov: cam.fov + (flank.fov - cam.fov) * kf };
    }
  }
  const flash = T >= 1.5 && T < 3.5 ? Math.exp(-(((T - 2.0) / 0.35) ** 2)) : 0;
  return {
    beat: b.id, camera: cam, engine,
    flash: reduced ? 0 : flash,
    tugs: T >= 15,
    plate: smooth(11.2, 12.2, T) * (1 - smooth(17, 18, T)),
    title: smooth(18, 18.8, T) * (1 - smooth(21.2, 22, T)),
    letterbox: smooth(0, 1.2, T) * (1 - smooth(21, 22, T)),
    fade: reduced ? 1 : smooth(0.2, 1.2, t),
    commit: t >= 18,
  };
}
