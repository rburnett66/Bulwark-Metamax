/**
 * src/render3d/fx/baseBlast.js — the player's base explodes and burns, closing the Kill Camera [MM-task_mvjng96y_b].
 *
 * Owner 2026-10-22: "… then show the base explode and burn for 5 seconds." A scripted sequence over the base, built
 * from the impacts system (fx/impacts.js):
 *   0 s      the main blast — a ground boom (flash, shock ring, scorch, shake) and a fireball on the hull;
 *   0.2–1.3  a chain of secondary blasts round the hull;
 *   ~2–4 s   two cook-offs;
 *   0–5 s    fires burning ON the hull (the hull is tall — ground-level flames would hide under it), with thick
 *            smoke and embers, plus a ground fire round its feet; everything dies down by BLAST.life.
 * `char` ramps 0 → 1 over the first blasts so the view can scorch the hull (craft.setChar).
 * Pure: no three.js; deterministic (own seeded rng — render-side, never the sim's).
 */
import { K } from './impacts.js';

export const BLAST = Object.freeze({
  life: 5,          // seconds of burning (the owner's 5 s)
  spread: 1.2,      // cells from the base centre the blasts and fires reach
  main: 1.6,        // main blast size (impacts.boom k)
  charTime: 1.3,    // seconds for the hull to scorch
  fireRate: 46,     // flame particles / s per hull fire at k = 1
  smokeRate: 12,    // smoke puffs / s per hull fire at k = 1
});

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The scripted events: [{ at, kind: 'boom'|'ground'|'fire', dx, dz, k, flash?, r?, secs? }] for one blast. */
export function blastScript(seed = 1) {
  const rnd = rng(seed);
  const S = BLAST.spread, out = [];
  out.push({ at: 0, kind: 'boom', dx: 0, dz: 0, k: BLAST.main, flash: true });
  out.push({ at: 0.05, kind: 'ground', dx: 0, dz: 0, r: S * 1.25, secs: BLAST.life - 0.05 });
  const ring = [[1, 1], [-1, 1], [-1, -1], [1, -1], [0, 1.2], [0, -1.2]];
  ring.forEach(([x, z], i) => out.push({ at: 0.2 + i * 0.18 + rnd() * 0.08, kind: 'boom', dx: x * S * 0.7, dz: z * S * 0.7, k: 0.9 + rnd() * 0.4, flash: i < 2 }));
  out.push({ at: 2.1 + rnd() * 0.4, kind: 'boom', dx: (rnd() - 0.5) * S, dz: (rnd() - 0.5) * S, k: 0.8 });
  out.push({ at: 3.3 + rnd() * 0.5, kind: 'boom', dx: (rnd() - 0.5) * S, dz: (rnd() - 0.5) * S, k: 0.7 });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + rnd() * 0.5, rr = i === 0 ? 0 : S * (0.3 + rnd() * 0.45), at = 0.05 + rnd() * 1.0;
    out.push({ at, kind: 'fire', dx: Math.cos(ang) * rr, dz: Math.sin(ang) * rr, k: 0.7 + rnd() * 0.5, secs: BLAST.life - at });
  }
  return out.sort((p, q) => p.at - q.at);
}

/**
 * createBaseBlast({ x, z, seed, topAt }) → { step(dt, fx), t, char, done }. x, z = the base centre in WORLD units;
 * topAt(x, z) = the hull's top height there (craft.topAt; 0 = flat ground). fx = the impacts system (boom, groundFire,
 * emit). step fires the scripted events whose time has come and feeds the hull fires.
 */
export function createBaseBlast({ x, z, seed = 1, topAt = null }) {
  const script = blastScript(seed);
  const rnd = rng(seed ^ 0x9e3779b9);
  const fires = [];   // { x, z, y, k, t, life }
  const top = (px, pz) => { const h = topAt ? topAt(px, pz) : 0; return Number.isFinite(h) && h > 0 ? h : 0; };
  let t = 0, i = 0;
  function hullBall(px, pz, k, emit) {   // a fireball ON the hull (the ground boom is mostly hidden under it)
    const y = top(px, pz) + 0.1;
    for (let c = Math.round(16 * k); c > 0; c--) emit(K.FIRE, px + (rnd() - 0.5) * 0.4, y + rnd() * 0.3, pz + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 2.4, 0.8 + rnd() * 2.2, (rnd() - 0.5) * 2.4, 0.4 + rnd() * 0.45, (0.22 + rnd() * 0.22) * k, 0.6);
    for (let c = Math.round(18 * k); c > 0; c--) { const a = rnd() * 6.283, sp = 2 + rnd() * 4; emit(K.SPARK, px, y + 0.2, pz, Math.cos(a) * sp, 1.5 + rnd() * 4, Math.sin(a) * sp, 0.6 + rnd() * 0.8, 0.02 + rnd() * 0.015); }
    for (let c = Math.round(6 * k); c > 0; c--) emit(K.SMOKE, px + (rnd() - 0.5) * 0.4, y + 0.3, pz + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.6, 0.6 + rnd() * 0.6, (rnd() - 0.5) * 0.6, 2.2 + rnd() * 1.2, 0.28 + rnd() * 0.12, 1.1, 0.18);
  }
  function stepFires(dt, emit) {
    for (let j = fires.length - 1; j >= 0; j--) {
      const f = fires[j];
      f.t += dt;
      if (f.t >= f.life) { fires.splice(j, 1); continue; }
      const k = f.k * Math.min(1, 3 * (1 - f.t / f.life), 0.4 + f.t * 3);   // flares up, dies down over the last third
      for (let c = Math.floor(BLAST.fireRate * k * dt + rnd()); c > 0; c--) emit(K.FIRE, f.x + (rnd() - 0.5) * 0.3 * k, f.y + rnd() * 0.12, f.z + (rnd() - 0.5) * 0.3 * k, (rnd() - 0.5) * 0.3, 0.7 + rnd() * 0.8, (rnd() - 0.5) * 0.3, 0.4 + rnd() * 0.3, (0.14 + rnd() * 0.12) * Math.max(0.7, k), -0.15);
      for (let c = Math.floor(BLAST.smokeRate * k * dt + rnd()); c > 0; c--) emit(K.SMOKE, f.x + (rnd() - 0.5) * 0.2, f.y + 0.35, f.z + (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.15, 0.6 + rnd() * 0.5, (rnd() - 0.5) * 0.15, 3 + rnd() * 1.5, 0.2 + rnd() * 0.1, 1.2, 0.14);
      if (rnd() < dt * 4 * k) emit(K.EMBER, f.x, f.y + 0.25, f.z, (rnd() - 0.5) * 0.8, 1.2 + rnd(), (rnd() - 0.5) * 0.8, 1 + rnd() * 0.8, 0.014);
    }
  }
  return {
    get t() { return t; },
    get char() { return Math.min(1, t / BLAST.charTime); },
    get done() { return t >= BLAST.life; },
    get fires() { return fires.length; },
    step(dt, fx) {
      const d = Math.max(0, Math.min(0.1, dt || 0));
      t += d;
      let n = 0;
      while (i < script.length && script[i].at <= t) {
        const e = script[i++], px = x + e.dx, pz = z + e.dz;
        n++;
        if (e.kind === 'boom') { fx.boom(px, pz, e.k, !!e.flash); hullBall(px, pz, e.k, fx.emit); }
        else if (e.kind === 'ground') fx.groundFire(px, pz, e.r, e.secs);
        else fires.push({ x: px, z: pz, y: top(px, pz), k: e.k, t: 0, life: e.secs });
      }
      stepFires(d, fx.emit);
      return n;
    },
  };
}
