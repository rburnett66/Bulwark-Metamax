/**
 * src/render3d/craft/landingFx.js — the ground effect of a landing: thruster wash billowing out as smoke, and
 * small debris kicked away from under the lift jets. A pure particle MODEL (no three.js) — craft3d.js draws it.
 * [MM-story_mvbks05m_4]
 *
 * Each frame the binder hands step() the lift jets as EMITTERS: where each jet's wash meets the ground (x, z in the
 * craft's local model units, ground at y = 0) and a strength 0..1 = thrust × ground effect (1 at the ground,
 * fading to 0 by GROUND_EFFECT units up). The wash spreads radially away from the jet:
 *   SMOKE   — soft puffs that start low and tight, roll outward fast, slow under drag, rise a little, grow and fade.
 *   DEBRIS  — small chunks thrown outward and up on ballistic arcs; they bounce once, skid and fade on the ground.
 * Presentation only, seeded so a level replays the same billow.
 */

export const GROUND_EFFECT = 13;       // model units: the wash reaches the ground from this height down
export const CAPS = Object.freeze({ smoke: 520, debris: 110 });
const SMOKE_RATE = 46, DEBRIS_RATE = 14;   // per second, per jet, at full strength
const GRAV = 26, DRAG = 1.6, TURB = 9;

// smooth value noise in 3D (deterministic, 0..1) — turbulence for the billow, gusts for the emitters
function hash3(x, y, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
/** Two octaves, centred on 0 (≈ −0.5..0.5). */
export const turb = (x, y, z) => noise3(x, y, z) * 0.65 + noise3(x * 2.3 + 17, y * 2.3, z * 2.3) * 0.35 - 0.5;

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Ground-effect strength for a jet at height h (model units above the ground) with thrust 0..1. */
export function washStrength(thrust, h) {
  if (!(thrust > 0) || h >= GROUND_EFFECT) return 0;
  const g = 1 - Math.max(0, h) / GROUND_EFFECT;
  return Math.max(0, Math.min(1, thrust)) * g * g;
}

/**
 * createLandingFx({ seed, scale }) → { smoke, debris, step(dt, emitters), clear() }.
 * scale (0..1] thins both systems (the Low tier). smoke / debris are live arrays the binder reads:
 *   smoke  { x, y, z, size, alpha, age, life, seed, rot, glow (jet-lit 0..1), white (vapour 0..1) }   debris { x, y, z, rx, ry, rz, size, dims, alpha, shade, tint }
 * Everything carries noise: emitters gust, puffs ride a turbulence field, grow and fade unevenly and have lumpy
 * rotating outlines; debris is mostly grit with the odd clod, irregular in shape, buffeted, bouncing 1–2 times,
 * and throws a small dust puff where a larger piece lands.
 * emitters: [{ x, z, strength, cx, cz }] — cx, cz = the craft centre, so the wash also pushes away from the hull.
 */
export function createLandingFx(opts = {}) {
  const R = rng(opts.seed || 7), scale = Math.max(0.1, Math.min(1, opts.scale || 1));
  const capS = Math.round(CAPS.smoke * scale), capD = Math.round(CAPS.debris * scale);
  const smoke = [], debris = [];
  const acc = new Map();   // emitter index → fractional spawns carried between frames
  let clock = 0;

  function spawnSmoke(e, slow) {
    if (smoke.length >= capS) return;
    const a = R() * Math.PI * 2;
    // push away from the jet, biased away from the hull centre so the billow rolls out past the footprint
    let ox = Math.cos(a), oz = Math.sin(a);
    const hx = e.x - (e.cx || 0), hz = e.z - (e.cz || 0), hl = Math.hypot(hx, hz) || 1;
    ox = ox * 0.6 + (hx / hl) * 0.4; oz = oz * 0.6 + (hz / hl) * 0.4;
    const ol = Math.hypot(ox, oz) || 1, sp = (slow ? 1.5 + R() * 2 : 7 + R() * 9) * (0.55 + 0.45 * e.strength);
    const big = slow ? 0.45 : 1;
    smoke.push({ x: e.x + ox / ol * 0.4, y: 0.15 + R() * 0.25, z: e.z + oz / ol * 0.4, vx: ox / ol * sp, vy: 0.4 + R() * 1.2, vz: oz / ol * sp,
      size: (1.0 + R() * 0.8) * big, grow: (2.4 + R() * 2.2) * big, alpha: 0, peak: (0.36 + 0.3 * e.strength) * (0.75 + R() * 0.4), age: 0,
      life: (1.6 + R() * 1.6) * (slow ? 0.7 : 1), shade: 0.82 + R() * 0.3, seed: R(), rot: R() * Math.PI * 2, spin: (R() - 0.5) * 1.6,
      heat: slow ? 0 : e.strength, white: 0, lift: 1 });
  }
  /** A free puff: the set-piece kinds (shockwave, contrail, hatch vent, cooling wisp, ramp dust) all go through here. */
  function puff(o) {
    if (smoke.length >= capS) return;
    smoke.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, size: o.size, grow: o.grow, alpha: 0, peak: o.peak, age: 0,
      life: o.life, shade: o.shade != null ? o.shade : 0.85 + R() * 0.25, seed: R(), rot: R() * Math.PI * 2, spin: (R() - 0.5) * (o.spin || 1.6),
      heat: o.heat || 0, white: o.white || 0, lift: o.lift != null ? o.lift : 1 });
  }
  function spawnDebris(e) {
    if (debris.length >= capD) return;
    // grit, mostly: size skews small with the odd clod; launch speed and angle vary, so the spray is ragged
    const a = R() * Math.PI * 2, sp = 4 + R() * 11, up = 2 + R() * R() * 9;
    const size = 0.05 + Math.pow(R(), 2.2) * 0.34;
    debris.push({ x: e.x + Math.cos(a) * (0.3 + R() * 0.6), y: 0.05, z: e.z + Math.sin(a) * (0.3 + R() * 0.6),
      vx: Math.cos(a) * sp / (0.6 + size * 3), vy: up * (0.6 + 0.4 * e.strength), vz: Math.sin(a) * sp / (0.6 + size * 3),
      rx: R() * 6, ry: R() * 6, rz: R() * 6, sx: (R() - 0.5) * 22, sy: (R() - 0.5) * 22, sz: (R() - 0.5) * 22,
      size, dims: [0.6 + R() * 0.8, 0.4 + R() * 0.7, 0.6 + R() * 0.8], alpha: 1, bounces: 0, maxBounce: R() < 0.35 ? 2 : 1,
      rest: 0, age: 0, shade: R(), tint: 0.82 + R() * 0.3, e });
  }

  return {
    smoke, debris,
    get caps() { return { smoke: capS, debris: capD }; },
    step(dt, emitters) {
      dt = Math.max(0, Math.min(0.1, dt || 0));
      clock += dt;
      (emitters || []).forEach((e, i) => {
        if (!(e.strength > 0)) return;
        const c = (acc.get(i) || { s: 0, d: 0 });
        // gusts: each jet's output breathes on its own noise, so the billow pulses instead of streaming evenly
        const gust = 0.45 + 1.1 * noise3(clock * 2.6, i * 7.3, 0.5), burst = Math.max(0, turb(clock * 4.1, i * 3.1, 9.7) * 2 + 0.2);
        c.s += SMOKE_RATE * e.strength * scale * dt * gust;
        c.d += DEBRIS_RATE * Math.max(0, e.strength - 0.35) / 0.65 * scale * dt * burst * 2.2;   // debris comes in kicks, not a stream
        while (c.s >= 1) { spawnSmoke(e); c.s -= 1; }
        while (c.d >= 1) { spawnDebris(e); c.d -= 1; }
        acc.set(i, c);
      });
      for (let i = smoke.length - 1; i >= 0; i--) {
        const p = smoke[i];
        p.age += dt;
        if (p.age >= p.life) { smoke.splice(i, 1); continue; }
        const drag = Math.exp(-DRAG * dt);
        // turbulence: a slowly-moving noise field pushes each puff, more as it slows (eddies take over the wash)
        const q = 0.22, n = 0.5 + Math.min(1, p.age * 1.4);
        p.vx = p.vx * drag + turb(p.x * q, p.z * q, clock * 0.7 + p.seed * 9) * TURB * n * dt;
        p.vz = p.vz * drag + turb(p.z * q + 31, p.x * q, clock * 0.7 + p.seed * 5) * TURB * n * dt;
        p.vy = p.vy * drag + (0.35 + turb(p.x * q, clock * 0.9, p.z * q) * 1.4) * dt * p.lift;   // warm wash lifts, unevenly
        p.x += p.vx * dt; p.y = Math.max(0.05, p.y + p.vy * dt); p.z += p.vz * dt;
        p.glow = p.heat * Math.max(0, 1 - p.age / 0.5);   // lit by the jet as it leaves it
        p.rot += p.spin * dt;
        p.size += p.grow * dt * (1 - p.age / p.life * 0.6) * (0.75 + noise3(p.seed * 50, clock * 1.7, 3) * 0.5);
        const k = p.age / p.life;
        p.alpha = p.peak * Math.min(1, k / 0.12) * (1 - k) * (1 - k) * (0.85 + 0.3 * noise3(p.seed * 40, clock * 3, 1));
      }
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.age += dt;
        if (d.y > 0 || d.vy > 0) {
          d.vy -= GRAV * dt;
          // a little air buffeting from the wash on the way up
          d.vx += turb(d.x * 0.4, d.z * 0.4, clock + d.shade * 7) * 6 * dt; d.vz += turb(d.z * 0.4 + 5, d.x * 0.4, clock + d.shade * 3) * 6 * dt;
          d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
          d.rx += d.sx * dt; d.ry += d.sy * dt; d.rz += d.sz * dt;
          if (d.y <= 0) {
            d.y = 0;
            if (d.bounces < d.maxBounce && d.vy < -2) {
              const rest = 0.18 + (d.shade * 0.31);
              d.vy = -d.vy * rest; d.vx *= 0.45 + d.shade * 0.25; d.vz *= 0.45 + d.tint * 0.2; d.sx *= 0.5; d.sy *= 0.5; d.sz *= 0.5;
              if (d.bounces === 0 && d.size > 0.12 && smoke.length < capS) spawnSmoke({ x: d.x, z: d.z, strength: 0.4, cx: d.e.x, cz: d.e.z }, true);   // a puff where it lands
              d.bounces++;
            } else { d.vy = 0; }
          }
        } else {
          // skidding to rest, then fading out where it lies
          const f = Math.exp(-6 * dt); d.vx *= f; d.vz *= f; d.x += d.vx * dt; d.z += d.vz * dt;
          d.rest += dt;
          d.alpha = Math.max(0, 1 - Math.max(0, d.rest - 0.9 - d.shade * 0.8) / 0.9);
          if (d.alpha <= 0) { debris.splice(i, 1); continue; }
        }
      }
    },
    /**
     * Touchdown SHOCKWAVE: the last of the jets' air slams out from under the hull — a fast, low, dense ring of
     * dust around (x, z), plus a scatter of debris. power 0..1.
     */
    burst(x, z, power = 1) {
      const n = Math.round(70 * scale * power);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (R() - 0.5) * 0.25, r0 = 4 + R() * 2.5, sp = (14 + R() * 12) * power;
        puff({ x: x + Math.cos(a) * r0, y: 0.2 + R() * 0.4, z: z + Math.sin(a) * r0, vx: Math.cos(a) * sp, vy: 0.3 + R() * 1.2, vz: Math.sin(a) * sp,
          size: 1.2 + R() * 1.0, grow: 3.2 + R() * 2.6, peak: 0.5 + R() * 0.2, life: 1.4 + R() * 1.4, heat: 0.25 * R() });
      }
      const m = Math.round(26 * scale * power);
      for (let i = 0; i < m; i++) { const a = R() * Math.PI * 2; spawnDebris({ x: x + Math.cos(a) * 4.5, z: z + Math.sin(a) * 4.5, strength: 1, cx: x, cz: z }); }
    },
    /** CONTRAIL from a rear nozzle in flight (x, y, z) blowing back along (dx, dy, dz): thin pale vapour. */
    trail(x, y, z, dx, dy, dz, k = 1) {
      puff({ x: x + (R() - 0.5) * 0.3, y: y + (R() - 0.5) * 0.3, z: z + (R() - 0.5) * 0.3, vx: dx * (5 + R() * 3), vy: dy * 4 + 0.3, vz: dz * (5 + R() * 3),
        size: 0.55 + R() * 0.3, grow: 2.6 + R() * 1.2, peak: 0.34 * k, life: 1.0 + R() * 0.6, white: 0.85, heat: 0.6, lift: 0 });
    },
    /** HATCH VENT: pressurised hold air bursting from a door seam at (x, y, z), pushing out along (nx, nz). */
    vent(x, y, z, nx, nz) {
      const sp = 3 + R() * 4;
      puff({ x, y, z, vx: nx * sp + (R() - 0.5), vy: 1.5 + R() * 2.5, vz: nz * sp + (R() - 0.5), size: 0.5 + R() * 0.4, grow: 2.2 + R() * 1.2,
        peak: 0.5 + R() * 0.2, life: 0.9 + R() * 0.7, white: 1, lift: 0.4, spin: 3 });
    },
    /** COOLING WISP: steam curling up off a hot nozzle after the engines cut. k = heat 0..1. */
    wisp(x, y, z, k = 1) {
      puff({ x: x + (R() - 0.5) * 0.5, y, z: z + (R() - 0.5) * 0.5, vx: (R() - 0.5) * 0.6, vy: 1.2 + R() * 1.0, vz: (R() - 0.5) * 0.6,
        size: 0.3 + R() * 0.3, grow: 1.1 + R() * 0.6, peak: 0.28 * k, life: 1.4 + R() * 1.0, white: 0.9, lift: 0.6 });
    },
    /** RAMP DUST: the ramp's lip slapping the ground at (x, z), spreading along the ramp foot. */
    slap(x, z, nx, nz) {
      for (let i = 0; i < Math.max(2, Math.round(6 * scale)); i++) {
        const a = Math.atan2(nz, nx) + (R() - 0.5) * 2.2, sp = 2 + R() * 3;
        puff({ x: x + (R() - 0.5) * 0.8, y: 0.15, z: z + (R() - 0.5) * 0.8, vx: Math.cos(a) * sp, vy: 0.3 + R() * 0.6, vz: Math.sin(a) * sp,
          size: 0.5 + R() * 0.4, grow: 1.8 + R() * 1.2, peak: 0.42 + R() * 0.15, life: 1.0 + R() * 0.8 });
      }
    },
    clear() { smoke.length = 0; debris.length = 0; acc.clear(); },
  };
}
