/**
 * data/galaxy.js — the galaxy the nine homeworlds sit in [MM-story_mvftq5q8_l].
 *
 * Owner 2026-10-19: "I want to add a 3D galaxy view that shows the solar systems and location for each of the 9
 * planets. On the main menu the player can zoom out to the galaxy view, but the default view is always the planet
 * view for the current campaign."
 *
 * Pure data + maths, no three.js (node-tested by galaxy.test.mjs); the menu's live 3D (menu/menuStage.js) draws it.
 *   GALAXY            — size, arm count, star count, palette
 *   SYSTEMS           — each homeworld's solar system: where it sits (polar, galaxy units), its star's colour
 *   systemPos(key)    — the planet's position [x, y, z] (the system's star sits SUN_DIR × orbit from it)
 *   galaxyStars(n)    — the star field: a two-armed log spiral + a core bulge, seeded → { pos, col, size }
 *   galaxyCamera(f, focus, frame) — the one camera fly between the PLANET pose (f = 0: the planet framed exactly like
 *                       the menu's live globe) and the GALAXY pose (f = 1: a high, tilted overview), eased
 */
import { PLANETS } from './planets.js';

export const GALAXY = Object.freeze({
  radius: 100,          // galaxy units to the rim of the arms
  arms: 2,
  stars: 6000,
  twist: 2.6,           // radians the arms wind over the radius
  thickness: 3.2,       // disc half-thickness at the core (thins outward)
  planetR: 0.6,         // a homeworld sphere's radius
  orbit: 2.2,           // planet → its star
  seed: 90210,
  core: [255, 226, 170], arm: [150, 185, 255], dust: [255, 150, 120],
});

/** Each homeworld's system: polar position (r galaxy units, a degrees) and a height off the disc. Spread along both
 *  arms, inner to outer, so the nine read as a journey outward. Keys = data/planets.js keys. */
export const SYSTEMS = Object.freeze({
  ground:    { r: 22, a: 18,  y: 0.6 },
  air:       { r: 30, a: 128, y: -0.8 },
  hightech:  { r: 38, a: 214, y: 0.9 },
  artillery: { r: 45, a: 312, y: -0.5 },
  water:     { r: 53, a: 64,  y: 1.1 },
  arcane:    { r: 60, a: 170, y: -1.0 },
  space:     { r: 68, a: 262, y: 0.7 },
  dark:      { r: 76, a: 352, y: -0.9 },
  greenies:  { r: 84, a: 98,  y: 0.5 },
});

/** The planet's position in the galaxy. */
export function systemPos(key) {
  const s = SYSTEMS[key];
  if (!s) return [0, 0, 0];
  const a = (s.a * Math.PI) / 180;
  return [Math.cos(a) * s.r, s.y, Math.sin(a) * s.r];
}

/** The keys that have a system AND a planet (the menu draws these). */
export const SYSTEM_KEYS = Object.freeze(Object.keys(SYSTEMS).filter((k) => PLANETS[k]));

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/** The star field → { pos: Float32Array(n·3), col: Float32Array(n·3) 0..1, size: Float32Array(n) }. Deterministic. */
export function galaxyStars(n = GALAXY.stars, G = GALAXY) {
  const r = rng(G.seed), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  const mix = (a, b, t) => a.map((v, i) => (v + (b[i] - v) * t) / 255);
  for (let i = 0; i < n; i++) {
    let x, y, z, c, sz;
    if (i < n * 0.22) {                                   // the core bulge
      const rr = Math.abs(gauss(r)) * G.radius * 0.13, th = r() * Math.PI * 2;
      x = Math.cos(th) * rr; z = Math.sin(th) * rr; y = gauss(r) * G.thickness * 1.6 * Math.exp(-rr / 18);
      c = mix(G.core, [255, 245, 225], r() * 0.6); sz = 1 + r() * 1.4;
    } else {                                              // the arms
      const t = Math.pow(r(), 0.75), rr = 6 + t * G.radius, arm = Math.floor(r() * G.arms);
      const th = arm * (Math.PI * 2 / G.arms) + t * G.twist * Math.PI + gauss(r) * (0.16 + 0.1 * (1 - t));
      x = Math.cos(th) * rr + gauss(r) * 2.2; z = Math.sin(th) * rr + gauss(r) * 2.2;
      y = gauss(r) * G.thickness * (1 - 0.6 * t);
      const dusty = r() < 0.08;
      c = dusty ? mix(G.dust, [255, 200, 170], r() * 0.5) : mix(G.arm, G.core, Math.max(0, 0.55 - t) * r());
      sz = 0.7 + r() * (dusty ? 1.6 : 1.1);
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; size[i] = sz;
  }
  return { pos, col, size };
}

/** smootherstep — the fly eases in and out */
export const ease = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * x * (x * (x * 6 - 15) + 10); };

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const CAM = Object.freeze({
  fov: 26,                                 // same lens as the menu's globe camera, so f = 0 matches the live globe
  planetDir: norm([0, 0.06, 1]),           // looking at the planet from the front (the globe camera's view)
  galaxyDir: norm([0.12, 0.78, 1]),        // a high, tilted overview
  galaxyDist: 335,
  globeDist: 6,                            // the globe camera: radius 1 at distance 6
});

/**
 * The camera at fly position f (0 planet … 1 galaxy). focus = the target planet's position; heightRatio = the galaxy
 * view's height ÷ the planet box's height (so at f = 0 the planet is exactly the size the live globe was).
 * → { pos, look, dist, e } (e = eased f)
 */
export function galaxyCamera(f, focus, heightRatio = 1, G = GALAXY, C = CAM) {
  const e = ease(f);
  const d0 = G.planetR * C.globeDist * Math.max(1, heightRatio), d1 = C.galaxyDist;
  const dist = Math.exp(Math.log(d0) + (Math.log(d1) - Math.log(d0)) * e);
  // the look point leaves the planet for the galaxy's centre over the first part of the fly
  const k = ease(Math.min(1, f * 1.35));
  const look = [focus[0] * (1 - k), focus[1] * (1 - k), focus[2] * (1 - k)];
  const dir = norm([0, 1, 2].map((i) => C.planetDir[i] + (C.galaxyDir[i] - C.planetDir[i]) * e));
  return { pos: [look[0] + dir[0] * dist, look[1] + dir[1] * dist, look[2] + dir[2] * dist], look, dist, e };
}
