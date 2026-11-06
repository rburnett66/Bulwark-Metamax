/**
 * src/opening/timeline.js — the Collective opening as a pure function of time [MM-story_mw47lhgr_4].
 *
 * Owner 2026-11-05: "the introduction to the game will include presentation of the red giant, the fly by of the
 * collective ship .. the camera path to the ships side .. then the presentation of the collectives room modules view".
 * Design: Collective-Opening-Design §2 (beat sheet). Tech plan: docs/tech-plan/Collective-Opening.md §3.1 — every beat
 * value comes from openingAt(t), so tests scrub it headlessly and the review page's scrub bar is the same function.
 *
 * Built so far: beats 0–3 (cold open, the red giant, the fly-by, the swing to the flank). Beat 4 (the hull opens into
 * the room view) waits on the room view (Interiors I1); until then the timeline holds the flank shot from 40 s.
 *
 * World (glTF / ship space): +X bow, +Y up, +Z starboard; one unit = 25 m. Lengths below are in units of the ship's
 * length L, from its bounding box, so any ship works. The ship flies bow-first along +X past Vesper, which hangs far
 * off its port side; the camera sits on the starboard side, so the star is behind the ship and the flank shot shows
 * the bow on the right of the frame (the room view's orientation: stern left).
 * No three.js, no clock, no Math.random: positions are plain arrays and depend on t alone.
 */
import { lensFov } from '../render3d/ships/shots.js';

/** The beat sheet (seconds). `end: null` = player-paced. Beats past 3 are placeholders the later stories fill. */
export const BEATS = Object.freeze([
  { id: 'cold', start: 0, end: 3, caption: 'THE LONG LEDGER · VESPER' },
  { id: 'star', start: 3, end: 14 },
  { id: 'flyby', start: 14, end: 30 },
  { id: 'flank', start: 30, end: 40 },
  { id: 'open', start: 40, end: 46 },
  { id: 'life', start: 46, end: 56 },
  { id: 'patron', start: 56, end: 60 },
  { id: 'bar', start: 60, end: 63 },
  { id: 'talk', start: 63, end: null },
]);
export const BUILT_UNTIL = 40;   // seconds of the timeline this story draws; later beats hold the flank shot

/** Where a first-run skip lands (design §2: from beat 3 straight to the highlighted bar). */
export const SKIP = Object.freeze({ from: 'flank', to: 'bar' });

/** The opening's fixed numbers, in ship lengths L. */
export const OPEN = Object.freeze({
  shipSpeed: 0.12,               // L/s along +X ("big things move slowly": ≤ 1/8 frame width per second at the fly-by lens)
  star: { x: -4, y: 2, z: -46, radius: 16 },
  camFlyby: [0, -0.06, 6],       // the long-lens camera the ship passes in front of (starboard side)
  lensStar: 135, lensFlyby: 135, lensFlank: 105,
  flankFill: 0.85,               // the ship spans 85 % of the frame width at the flank (landscape)
  portraitFill: 0.5,             // phone portrait: half the ship (the bar's side) fills the width
  fadeIn: [2.2, 3.4],            // the cold open's black lifts over these seconds
});

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** The beat at time t → { beat, index, k (0..1 through it) }. */
export function beatAt(t) {
  let i = BEATS.length - 1;
  for (let j = 0; j < BEATS.length; j++) if (t < (BEATS[j].end == null ? Infinity : BEATS[j].end)) { i = j; break; }
  const b = BEATS[i];
  const k = b.end == null ? 0 : clamp01((t - b.start) / (b.end - b.start));
  return { beat: b.id, index: i, k };
}

/** Where a skip at time t goes: the bar beat's start from the flank on; null before (nothing to skip yet). */
export function skipTarget(t) {
  const from = BEATS.find((b) => b.id === SKIP.from), to = BEATS.find((b) => b.id === SKIP.to);
  return t >= from.start && t < to.start ? to.start : null;
}

/**
 * The opening at time t (seconds).
 *   box     — the ship's bounding box { min:[x,y,z], max:[x,y,z] } (or {x,y,z} objects), in ship space
 *   aspect  — viewport width ÷ height
 *   reduced — prefers-reduced-motion: the camera holds one pose per beat and beats cross-fade instead of moving
 * → { beat, index, k, ship:{x}, camera:{position, target, fov}, star:{position, radius, intensity},
 *     engine, tugs, fade (0 black … 1 clear), caption:{text, alpha}, built }
 */
export function openingAt(t, { box, aspect = 16 / 9, reduced = false } = {}) {
  const lo = vec(box.min), hi = vec(box.max);
  const L = hi[0] - lo[0], H = hi[1] - lo[1];
  const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const tt = Math.max(0, Math.min(t, BUILT_UNTIL));
  const B = beatAt(tt);
  const T = reduced ? heldTime(tt) : tt;               // reduced motion: every beat is a still at its settled pose

  // the ship: bow-first along +X, its centre crossing x = 0 as the flank beat starts
  const flank0 = BEATS[3].start;
  const shipX = OPEN.shipSpeed * L * (T - flank0);
  const shipC = [c[0] + shipX, c[1], c[2]];

  const S = OPEN.star;
  const star = [c[0] + S.x * L, c[1] + S.y * L, c[2] + S.z * L], starR = S.radius * L;
  // beat 1 looks at the star's right limb (prominences and the dark edge in frame), drifting very slowly; the ship then
  // enters from the left, out of frame until the aim swings to it
  const limb = [star[0] + starR * 0.86, star[1] + starR * 0.18, star[2] + starR * 0.3];
  const camF = [c[0] + OPEN.camFlyby[0] * L, c[1] + OPEN.camFlyby[1] * L, c[2] + OPEN.camFlyby[2] * L];

  // the flank: camera abeam the ship on the starboard side, level, far enough that the ship fills the frame
  const fovFlank = lensFov(OPEN.lensFlank, aspect);
  const hfov = 2 * Math.atan(Math.tan((fovFlank * Math.PI) / 360) * aspect);
  const frameW = aspect >= 1 ? L / OPEN.flankFill : L * OPEN.portraitFill;
  const dFlank = frameW / (2 * Math.tan(hfov / 2));
  const portraitShift = aspect >= 1 ? 0 : L * 0.2;    // portrait frames the bar's side (aft of centre)
  const flankCam = [shipC[0] - portraitShift, c[1] + H * 0.02, hi[2] + dFlank];
  const flankTarget = [shipC[0] - portraitShift, c[1], c[2]];

  let pos, target, fov;
  if (B.index <= 1) {                                  // cold open + the red giant
    const drift = smooth(BEATS[1].start, BEATS[1].end, T);
    pos = camF;
    target = [limb[0] - starR * 0.06 * drift, limb[1] - starR * 0.02 * drift, limb[2]];
    fov = lensFov(OPEN.lensStar, aspect);
  } else if (B.index === 2) {                          // the fly-by: the aim leaves the limb and picks up the ship
    const k = smooth(BEATS[2].start, BEATS[2].start + 9, T);
    const lead = [shipC[0] + L * 0.25, shipC[1] + H * 0.1, shipC[2]];
    pos = camF;
    target = lerp3(limb, lead, k);
    fov = lensFov(OPEN.lensFlyby, aspect);
  } else {                                             // the swing to the flank: match speed, close in, level out
    const k = smooth(BEATS[3].start, BEATS[3].end - 1.5, T);
    const lead = [shipC[0] + L * 0.25 * (1 - k), shipC[1] + H * 0.1 * (1 - k), shipC[2]];
    const follow = [camF[0] + shipX * smooth(BEATS[3].start, BEATS[3].start + 4, T), camF[1], camF[2]];
    pos = lerp3(follow, flankCam, k);
    target = lerp3(lead, flankTarget, k);
    fov = lerp(lensFov(OPEN.lensFlyby, aspect), fovFlank, k);
  }

  // light, engines, tugs, fades
  const starIn = smooth(OPEN.fadeIn[0], OPEN.fadeIn[1] + 2, tt);
  let fade = smooth(OPEN.fadeIn[0], OPEN.fadeIn[1], tt);
  if (reduced) fade *= crossFade(tt);
  const capA = B.beat === 'cold' ? smooth(0.3, 1.0, tt) * (1 - smooth(2.4, 3.0, tt))
    : B.beat === 'star' ? 1 - smooth(BEATS[1].start, BEATS[1].start + 1.2, tt) : 0;
  return {
    beat: B.beat, index: B.index, k: B.k, built: t <= BUILT_UNTIL,
    ship: { x: shipX, visible: B.index >= 2 },
    camera: { position: pos, target, fov },
    star: { position: star, radius: starR, intensity: 0.15 + 0.85 * starIn },
    engine: B.index >= 2 ? 1 : 0.35,
    tugs: B.index >= 2,
    fade,
    caption: { text: BEATS[0].caption, alpha: capA },
  };
}

/** Reduced motion: the time each beat is drawn at (its settled end pose). */
function heldTime(t) {
  const B = BEATS[beatAt(t).index];
  return B.end == null ? t : Math.min(B.end, BUILT_UNTIL) - 0.001;
}

/** Reduced motion: a 0.5 s dip through black at every beat boundary instead of a camera move. */
function crossFade(t) {
  let a = 1;
  for (const b of BEATS) if (b.start > 0) a = Math.min(a, clamp01(Math.abs(t - b.start) / 0.25));
  return a;
}

function vec(v) { return Array.isArray(v) ? v : [v.x, v.y, v.z]; }
