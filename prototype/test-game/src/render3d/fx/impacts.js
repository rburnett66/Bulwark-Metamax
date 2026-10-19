/**
 * src/render3d/fx/impacts.js — world-impact effects: what the 3D view's sparks, fire, smoke, scorch marks,
 * chunks and burning wrecks ARE, frame by frame (plan v2.2 §6.10; code design §4.11b) [MM-story_mv87jvnb_5].
 *
 * Owner 2026-10-13: "particle effects that look like impact the world. Like sparks that bounce off the tank and
 * hit the ground. Or tanks the explode their turrets off and burn."
 *
 * Driven by the sim's EXISTING events (plan §0.4.6) — no sim change:
 *   damage {tick, sourceId, targetId, targetKind, killed, pos}  → fxHit (sparks ricochet off the armour) or, for
 *                                                                  sourceless AOE (base cannon, mines), fxGround
 *   kill {tick, entityId, unitId, radius, pos}                   → fxExplode: boom + burning hull wreck + the
 *                                                                  turret blown off; a flyer falls, then booms
 *   destroyed {tick, entityId, pos} / mineExplode {pos}          → a boom with no wreck
 * The round's TRAVEL DIRECTION comes from the source's position (live in `state`, else the renderer's last-frame
 * view of it — a source that died the same tick); the dead unit's model, HEADING and turret AIM come from the
 * last-frame view cache (the unit is already gone from `state` when its kill event arrives).
 *
 * The sim applies damage every tick (dps·dt), so hits are throttled per (source, target) to one every
 * HIT_GAP_TICKS. Every event is consumed ONCE by type + tick + id: an event list seen twice (a dropped or
 * repeated frame) never double-fires.
 *
 * Layered BESIDE combatFxModel.js: that model already draws the hit / kill / destroyed / mine flashes, so these
 * recipes add no flash of their own for those events — only the falling flyer's ground impact (which the sim
 * never reports) flashes here.
 *
 * READ-ONLY on the sim. Private seeded PRNG (never Math.random), so the same frames give the same effects.
 * Pure: no three.js, no DOM (impactsView.js draws it). World: X = column, Z = row, Y = up, cell centre = c + 0.5.
 */
import { cellToWorld } from '../camera.js';
import { HOVER_HEIGHT } from '../units/unitViews.js';
import { UNIT_SCALE } from '../units/modelKeys.js';
import { UNIT_MODELS } from '../units/models.js';
import { AIM } from './combatFxModel.js';

/** Particle kinds. Additive batch: SPARK, FIRE, FLASH, EMBER. Alpha (smoke) batch: SMOKE, DUST. */
export const K = Object.freeze({ SPARK: 0, FIRE: 1, FLASH: 2, EMBER: 3, SMOKE: 4, DUST: 5 });
export const isAdditive = (kind) => kind <= K.EMBER;
/** Decal kinds: SCORCH (dark batch), RING and POOL (additive batch). */
export const D = Object.freeze({ SCORCH: 0, RING: 1, POOL: 2 });

export const PHYS = Object.freeze({ G: 11, wind: Object.freeze({ x: 0.35, z: -0.18 }), sparkBounce: 0.38 });
/** Wreck life after its fire is out: stands charred SINK_DELAY s, then sinks over SINK_TIME s and is removed. */
export const SINK_DELAY = 3, SINK_TIME = 3, SINK_DEPTH = 0.35;
/** One spark burst per (source, target) at most this often — the sim deals damage every tick. 9 ticks = 0.3 s. */
export const HIT_GAP_TICKS = 9;
const FALL_SPEED = 2.2;            // cells/s forward momentum of a dying flyer
const MAX_FALL_TIME = 6;           // s — a falling piece that never lands is put down
const SEEN_PRUNE_TICKS = 300;

/**
 * Plan §6.10 BATCHES: the full budget (High / Standard). `density` scales every recipe's particle counts and
 * burn rates; `wreckLights` gives burning wrecks their flickering light pool.
 */
export const DEFAULT_IMPACT_CAPS = Object.freeze({
  additive: 4000, smoke: 1500, scorch: 300, glow: 300, chunks: 400, wrecks: 120, density: 1, wreckLights: true,
});
/**
 * Low tier (plan §7.1 "fewer effects"; Q15) — OWNER TO CONFIRM. Agent-proposed: ~a tenth of the particle
 * budget, ~0.4× sparks / fire / smoke per event, no wreck light pools, fewer wrecks per model+part (oldest
 * evicted first). Wrecks, the turret blow-off and scorch marks all stay — they are the read.
 */
export const LOW_IMPACT_CAPS = Object.freeze({
  additive: 400, smoke: 150, scorch: 40, glow: 24, chunks: 40, wrecks: 12, density: 0.4, wreckLights: false,
});

/** mulberry32 — the effects' own seeded stream. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Per-model facts the recipes need: the turret pivot (model units) or null, and whether the model hovers. */
export function modelInfo(model) {
  const def = UNIT_MODELS[model];
  const p = def && def.pivots && def.pivots.turret;
  return { turretPivot: p ? { x: p[0], y: p[1], z: p[2] } : null, hover: !!(def && def.hover) };
}

/**
 * createImpacts({ seed, caps }) →
 *   particles — [{ kind, x, y, z, vx, vy, vz, t, life, size, grow, shade, dusty, fl }]
 *   scorches  — [{ kind: D.SCORCH, x, z, r, rot, seed, t, life, col, a }]   (dark)
 *   glows     — [{ kind: D.RING | D.POOL, x, z, r, r1, rot, seed, t, life, col, a }]   (additive)
 *   chunks    — [{ x, y, z, rx, ry, rz, s, t, life, sink }]
 *   wrecks    — [{ seq, model, group, scale, x, y, z, yaw, pitch, roll, t, burn, falling, rest, sink, fl, phase }]
 *   shake     — camera shake amplitude (world units)
 *   update(state, map, events, dt, views, opts)  — opts.resolve(unitId) → { model, scale } for unseen units
 */
export function createImpacts({ seed = 1, caps = DEFAULT_IMPACT_CAPS } = {}) {
  let rand = prng(seed);
  const rnd = (a, b) => a + rand() * (b - a);
  const limits = { ...DEFAULT_IMPACT_CAPS, ...caps };
  const particles = [], scorches = [], glows = [], chunks = [], wrecks = [], spots = [];
  const freeP = [];
  let nAdd = 0, nSmoke = 0;
  let shake = 0;
  let lastTime = -Infinity;
  let wreckSeq = 0;
  const seen = new Map();       // event key → tick (consume-once)
  const hitClock = new Map();   // "source>target" → tick of the last spark burst
  let prev = new Map(), cur = new Map();   // last-frame view cache: id → { model, scale, x, y, z, heading, aim }
  const stats = { hits: 0, grounds: 0, kills: 0, booms: 0, consumed: 0, skipped: 0 };

  const n = (base) => Math.max(0, Math.round(base * limits.density));

  function emit(kind, x, y, z, vx, vy, vz, life, size, grow = 0, shade = 0, dusty = 0, drag = 0) {
    if (isAdditive(kind)) { if (nAdd >= limits.additive) return; nAdd++; }
    else { if (nSmoke >= limits.smoke) return; nSmoke++; }
    const p = freeP.pop() || {};
    p.kind = kind; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.t = 0; p.life = life; p.size = size; p.grow = grow; p.shade = shade; p.dusty = dusty; p.drag = drag; p.bounces = 0; p.fl = 1;
    particles.push(p);
  }

  function decal(kind, x, z, r, life, col, a, grow) {
    const list = kind === D.SCORCH ? scorches : glows;
    const cap = kind === D.SCORCH ? limits.scorch : limits.glow;
    if (cap <= 0) return;
    while (list.length >= cap) list.shift();           // ring buffer: the oldest mark goes
    list.push({ kind, x, z, r, r1: grow || r, rot: rand() * 6.283, seed: rand() * 10, t: 0, life, col, a });
  }

  function addWreck(w) {
    if (limits.wrecks <= 0) return null;
    let same = 0;
    for (const o of wrecks) if (o.model === w.model && o.group === w.group) same++;
    // past the instance cap: evict the OLDEST of the same model + part (wrecks are kept in birth order)
    for (let i = 0; i < wrecks.length && same >= limits.wrecks; i++) {
      if (wrecks[i].model === w.model && wrecks[i].group === w.group) { wrecks.splice(i, 1); i--; same--; }
    }
    w.seq = ++wreckSeq; w.t = 0; w.sink = 0; w.fl = 1; w.bounces = 0; w.phase = w.falling ? 'falling' : 'burning';
    wrecks.push(w);
    return w;
  }

  /** A round hitting armour. (dirx, dirz) = the way the round was travelling. Sparks ricochet off the plate. */
  function fxHit(x, z, dirx, dirz, y = 0.24, count = n(14)) {
    stats.hits++;
    const l = Math.hypot(dirx, dirz) || 1; dirx /= l; dirz /= l;
    const ix = x - dirx * 0.14, iz = z - dirz * 0.14;
    for (let i = 0; i < count; i++) {
      const side = rand() < 0.3;                                     // 30% skate sideways…
      const a = side ? (rand() < 0.5 ? 1 : -1) * rnd(0.9, 1.6) : rnd(-0.8, 0.8);   // …70% back off the plate
      const bx = -dirx * Math.cos(a) + dirz * Math.sin(a), bz = -dirz * Math.cos(a) - dirx * Math.sin(a);
      const sp = rnd(2.2, 5.2);
      emit(K.SPARK, ix, y, iz, bx * sp, rnd(0.8, 3.2), bz * sp, rnd(0.5, 1.1), rnd(0.018, 0.03));
    }
    for (let i = 0; i < 2; i++) emit(K.SMOKE, ix, y, iz, rnd(-0.2, 0.2), rnd(0.3, 0.6), rnd(-0.2, 0.2), rnd(0.6, 1.0), 0.12, 0.35, 0.55);
  }

  /** A round or blast landing on the ground: dirt kicked up, a few sparks, a dusty puff, a small scorch. */
  function fxGround(x, z) {
    stats.grounds++;
    for (let i = 0, c = n(6); i < c; i++) emit(K.DUST, x, 0.05, z, rnd(-0.8, 0.8), rnd(1.2, 2.6), rnd(-0.8, 0.8), rnd(0.5, 0.8), rnd(0.03, 0.05));
    for (let i = 0, c = n(4); i < c; i++) emit(K.SPARK, x, 0.05, z, rnd(-2, 2), rnd(1, 2.5), rnd(-2, 2), rnd(0.3, 0.6), 0.018);
    emit(K.SMOKE, x, 0.08, z, 0, 0.35, 0, 0.9, 0.15, 0.45, 0.7, 1);
    decal(D.SCORCH, x, z, rnd(0.18, 0.28), 6, [0.08, 0.06, 0.05], 0.55);
  }

  /** An explosion on the ground: fireball, sparks, smoke, chunks, scorch (22 s), shock ring, light pool, shake. */
  function boom(x, z, k, flash = false) {
    stats.booms++;
    if (flash) emit(K.FLASH, x, 0.35, z, 0, 0, 0, 0.22, 1.5 * k);
    for (let i = 0, c = n(14 * k); i < c; i++) emit(K.FIRE, x + rnd(-0.15, 0.15), rnd(0.1, 0.4), z + rnd(-0.15, 0.15), rnd(-1.4, 1.4), rnd(0.6, 2.6), rnd(-1.4, 1.4), rnd(0.35, 0.75), rnd(0.18, 0.38) * k, 0.6);
    for (let i = 0, c = n(28 * k); i < c; i++) { const a = rand() * 6.283, sp = rnd(2, 6); emit(K.SPARK, x, 0.3, z, Math.cos(a) * sp, rnd(1.5, 5), Math.sin(a) * sp, rnd(0.6, 1.4), rnd(0.02, 0.035)); }
    for (let i = 0, c = n(8 * k); i < c; i++) emit(K.SMOKE, x + rnd(-0.2, 0.2), rnd(0.2, 0.5), z + rnd(-0.2, 0.2), rnd(-0.4, 0.4), rnd(0.5, 1.1), rnd(-0.4, 0.4), rnd(1.8, 3.0), rnd(0.2, 0.35), 1.1, 0.28);
    for (let i = 0, c = n(6 * k); i < c && chunks.length < limits.chunks; i++) {
      const a = rand() * 6.283, sp = rnd(1.2, 3.6);
      chunks.push({ x, y: 0.25, z, vx: Math.cos(a) * sp, vy: rnd(2.5, 5.5), vz: Math.sin(a) * sp, rx: 0, ry: 0, rz: 0,
        wx: rnd(-12, 12), wy: rnd(-12, 12), wz: rnd(-12, 12), s: rnd(0.025, 0.055), t: 0, life: rnd(2, 3.5), rest: false, sink: 0 });
    }
    decal(D.SCORCH, x, z, rnd(0.8, 1.05) * Math.min(1.4, k), 22, [0.05, 0.04, 0.035], 0.82);
    decal(D.RING, x, z, 0.1, 0.45, [1.0, 0.75, 0.45], 0.9, 2.2 * k);
    decal(D.POOL, x, z, 1.6 * k, 0.6, [1.0, 0.55, 0.2], 0.9);
    shake = Math.min(0.25, shake + 0.12 * k);
  }

  /**
   * A unit destroyed. v = its last-frame view { model, scale, x, y, z, heading, aim }. Ground: boom, the hull
   * stays as a burning wreck, the turret is blown off. Flyer: falls with its momentum, booms where it lands.
   */
  function fxExplode(v) {
    stats.kills++;
    const info = modelInfo(v.model);
    const s = UNIT_SCALE * (v.scale || 1);
    const k = Math.max(0.6, Math.min(1.5, v.scale || 1));
    if ((v.y || 0) > 0.05) {                       // a flyer: no boom in the air — it falls first
      const h = v.heading || 0, y = v.y;
      addWreck({ model: v.model, group: 'body', scale: s, k, x: v.x, y, z: v.z, yaw: -h, pitch: 0, roll: 0,
        vx: Math.cos(h) * FALL_SPEED, vy: 0.4, vz: Math.sin(h) * FALL_SPEED,
        wx: rnd(-2.5, 2.5), wy: rnd(-0.6, 0.6), wz: rnd(-1.5, -0.6), burn: 0, falling: true, rest: false });
      for (let i = 0, c = n(10); i < c; i++) emit(K.FIRE, v.x, y, v.z, rnd(-1, 1), rnd(-0.2, 1), rnd(-1, 1), rnd(0.3, 0.5), rnd(0.15, 0.3));
      return;
    }
    boom(v.x, v.z, k);
    addWreck({ model: v.model, group: 'body', scale: s, k, x: v.x, y: 0, z: v.z, yaw: -(v.heading || 0),
      pitch: rnd(-0.06, 0.06), roll: rnd(-0.08, 0.08), vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0,
      burn: rnd(7, 10), falling: false, rest: true });
    const p = info.turretPivot;
    if (p) {                                         // the turret: blown up and sideways off its pivot, spinning
      const h = v.heading || 0, c = Math.cos(h), sn = Math.sin(h);
      const ha = rand() * 6.283, hs = rnd(0.6, 1.6);
      addWreck({ model: v.model, group: 'turret', scale: s, k, x: v.x + (p.x * c - p.z * sn) * s, y: p.y * s, z: v.z + (p.x * sn + p.z * c) * s,
        yaw: -(v.aim ?? h), pitch: 0, roll: 0, vx: Math.cos(ha) * hs, vy: rnd(4.2, 6.0), vz: Math.sin(ha) * hs,
        wx: rnd(-7, 7), wy: rnd(-5, 5), wz: rnd(-7, 7), burn: rnd(5, 8), falling: true, rest: false });
    }
  }

  /** Continuous emitters of one burning wreck: flames, a smoke column on the wind, the odd ember. */
  function fxBurn(w, k, dt) {
    const x = w.x, z = w.z, y = w.group === 'turret' ? 0.12 : 0.22;
    for (let c = Math.floor(26 * k * limits.density * dt + rand()); c > 0; c--) emit(K.FIRE, x + rnd(-0.12, 0.12) * k, y + rnd(0.02, 0.15), z + rnd(-0.12, 0.12) * k, rnd(-0.15, 0.15), rnd(0.6, 1.3), rnd(-0.15, 0.15), rnd(0.35, 0.6), rnd(0.1, 0.2) * Math.max(0.6, k), -0.15);
    for (let c = Math.floor(7 * k * limits.density * dt + rand()); c > 0; c--) emit(K.SMOKE, x + rnd(-0.1, 0.1), y + 0.25, z + rnd(-0.1, 0.1), rnd(-0.1, 0.1), rnd(0.5, 0.9), rnd(-0.1, 0.1), rnd(2.4, 3.6), rnd(0.15, 0.22), 0.9, 0.22);
    if (rand() < dt * 3 * k * limits.density) emit(K.EMBER, x, y + 0.2, z, rnd(-0.4, 0.4), rnd(1.2, 2.2), rnd(-0.4, 0.4), rnd(1.0, 1.8), 0.012);
  }

  function stepParticles(dt) {
    const G = PHYS.G, W = PHYS.wind;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) {
        if (isAdditive(p.kind)) nAdd--; else nSmoke--;
        particles[i] = particles[particles.length - 1]; particles.pop(); freeP.push(p);
        continue;
      }
      if (p.kind === K.SPARK || p.kind === K.DUST) {
        p.vy -= G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.01) {                              // bounce: lose most of the energy, skid
          p.y = 0.01; p.vy = -p.vy * (p.kind === K.DUST ? 0.1 : PHYS.sparkBounce); p.vx *= 0.55; p.vz *= 0.55; p.bounces++;
          if (p.bounces > 2 || p.vy < 0.3) { p.vy = 0; if (p.kind === K.DUST) p.t = p.life; }
        }
      } else if (p.kind === K.EMBER) {
        p.vy -= 0.4 * dt; p.x += (p.vx + W.x) * dt; p.y += p.vy * dt; p.z += (p.vz + W.z) * dt;
        p.fl = 0.7 + 0.6 * rand();
      } else if (p.kind === K.FIRE) {
        p.vx *= 1 - 2.5 * dt; p.vz *= 1 - 2.5 * dt; p.vy += 0.6 * dt;
        p.x += (p.vx + W.x * 0.3) * dt; p.y += p.vy * dt; p.z += (p.vz + W.z * 0.3) * dt;
        p.fl = 0.85 + 0.3 * rand();
      } else if (p.kind === K.SMOKE) {
        if (p.drag) { const q = Math.max(0, 1 - p.drag * dt); p.vx *= q; p.vy *= q; p.vz *= q; }   // a muzzle blast: fast out, stops dead
        p.vx += (W.x - p.vx) * dt * 0.6; p.vz += (W.z - p.vz) * dt * 0.6; p.vy *= 1 - 0.3 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      }
    }
  }

  function stepChunks(dt) {
    const G = PHYS.G;
    for (let i = chunks.length - 1; i >= 0; i--) {
      const c = chunks[i];
      c.t += dt;
      if (c.t >= c.life) { chunks[i] = chunks[chunks.length - 1]; chunks.pop(); continue; }
      c.sink = Math.max(0, c.t - (c.life - 0.8)) / 0.8;
      if (c.rest) continue;
      c.vy -= G * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.rx += c.wx * dt; c.ry += c.wy * dt; c.rz += c.wz * dt;
      if (c.y < c.s * 0.5) {
        c.y = c.s * 0.5; c.vy = -c.vy * 0.3; c.vx *= 0.5; c.vz *= 0.5; c.wx *= 0.5; c.wy *= 0.5; c.wz *= 0.5;
        if (Math.abs(c.vy) < 0.4) { c.rest = true; c.rx = Math.round(c.rx / 1.5708) * 1.5708; c.rz = Math.round(c.rz / 1.5708) * 1.5708; }
      }
    }
  }

  function settle(w) {
    w.falling = false; w.rest = true; w.y = 0; w.t = 0;
  }

  function stepWrecks(dt) {
    const G = PHYS.G;
    for (let i = 0; i < wrecks.length; i++) {
      const w = wrecks[i];
      w.t += dt;
      if (w.falling) {
        w.vy -= G * dt * (w.group === 'body' ? 0.55 : 1); w.x += w.vx * dt; w.y += w.vy * dt; w.z += w.vz * dt;
        w.yaw += w.wy * dt; w.pitch += w.wz * dt; w.roll += w.wx * dt;
        if (w.group === 'body') {                       // a falling flyer trails fire and smoke
          if (rand() < dt * 40 * limits.density) emit(K.FIRE, w.x, w.y, w.z, rnd(-0.2, 0.2), 0.3, rnd(-0.2, 0.2), 0.4, rnd(0.12, 0.22));
          if (rand() < dt * 18 * limits.density) emit(K.SMOKE, w.x, w.y, w.z, 0, 0.2, 0, 2.2, 0.15, 0.8, 0.2);
        } else if (rand() < dt * 20 * limits.density) emit(K.SMOKE, w.x, w.y, w.z, 0, 0.1, 0, 1.4, 0.08, 0.5, 0.25);
        if (w.y <= 0.02 || w.t > MAX_FALL_TIME) {
          if (w.group === 'body') {                     // the flyer hits the ground: explodes, then burns as a wreck
            settle(w); w.pitch = rnd(-0.25, -0.1); w.roll = rnd(-0.4, 0.4); w.burn = rnd(7, 10);
            boom(w.x, w.z, 1.2 * (w.k || 1), true);
          } else {                                      // the turret bounces (at most twice), then settles and burns
            w.y = 0.02; w.vy = -w.vy * 0.28; w.vx *= 0.5; w.vz *= 0.5; w.wx *= 0.4; w.wy *= 0.4; w.wz *= 0.4; w.bounces++;
            for (let j = 0, c = n(6); j < c; j++) emit(K.DUST, w.x, 0.05, w.z, rnd(-1, 1), rnd(0.8, 1.8), rnd(-1, 1), 0.6, 0.04);
            for (let j = 0, c = n(6); j < c; j++) emit(K.SPARK, w.x, 0.05, w.z, rnd(-2.5, 2.5), rnd(0.8, 2.5), rnd(-2.5, 2.5), 0.5, 0.02);
            if (w.bounces >= 2 || Math.abs(w.vy) < 0.6 || w.t > MAX_FALL_TIME) {
              settle(w); w.pitch = rnd(-0.3, 0.3); w.roll = rand() < 0.35 ? 1.5708 * (rand() < 0.5 ? -1 : 1) : rnd(-0.3, 0.3);
              decal(D.SCORCH, w.x, w.z, rnd(0.3, 0.45), 14, [0.05, 0.04, 0.035], 0.7);
            }
          }
        }
      } else if (w.t < w.burn) {
        const k = (w.group === 'turret' ? 0.55 : 1) * Math.min(1, (w.burn - w.t) / 2.5) * (w.k || 1);
        fxBurn(w, k, dt);
        w.fl = 0.9 + 0.15 * rand();
      }
      w.sink = w.rest ? Math.min(1, Math.max(0, w.t - w.burn - SINK_DELAY) / SINK_TIME) : 0;
      w.phase = w.falling ? 'falling' : w.t < w.burn ? 'burning' : w.sink > 0 ? 'sinking' : 'charred';
    }
    for (let i = wrecks.length - 1; i >= 0; i--) {
      const w = wrecks[i];
      if (!w.falling && w.t >= w.burn + SINK_DELAY + SINK_TIME) wrecks.splice(i, 1);   // burnt out and sunk: gone
    }
  }

  function stepDecals(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      d.t += dt;
      if (d.t >= d.life) list.splice(i, 1);
    }
  }

  /**
   * A patch of ground left burning (the base cannon's AOE fires): flames + a smoke column for `secs`, dying down
   * over the last third. [MM-task_mvbvpyer_x]
   */
  function burn(x, z, k = 0.5, secs = 4) {
    if (spots.length >= 64) spots.shift();
    spots.push({ x, z, k, t: 0, life: secs, group: 'body' });
  }
  function stepSpots(dt) {
    for (let i = spots.length - 1; i >= 0; i--) {
      const s = spots[i];
      s.t += dt;
      if (s.t >= s.life) { spots.splice(i, 1); continue; }
      const fade = Math.min(1, 3 * (1 - s.t / s.life));
      fxBurn(s, s.k * fade, dt);
    }
  }
  /**
   * A UNIT set burning (rocket salvo hit): flames + smoke ride its drawn position for `secs`, the last third dying
   * down; a re-hit refreshes it. Ends early when the unit dies or leaves. [MM-story_mvehp5rq_k]
   */
  const burningUnits = new Map();   // unit id → { t, life, k }
  function ignite(id, secs = 4, k = 0.45) {
    const b = burningUnits.get(id);
    if (b) { b.t = 0; b.life = Math.max(b.life, secs); return; }
    if (burningUnits.size >= 64) burningUnits.delete(burningUnits.keys().next().value);
    burningUnits.set(id, { t: 0, life: secs, k });
  }
  const tmpBurn = { x: 0, z: 0, group: 'body' };
  function stepBurningUnits(state, dt) {
    for (const [id, b] of burningUnits) {
      b.t += dt;
      const u = state && state.units && state.units.get(id);
      if (b.t >= b.life || !u || !(u.hp > 0)) { burningUnits.delete(id); continue; }
      const v = cur.get(id);
      if (!v) continue;                                    // not drawn this frame (hidden contact): no flames
      tmpBurn.x = v.x; tmpBurn.z = v.z;
      fxBurn(tmpBurn, b.k * Math.min(1, 3 * (1 - b.t / b.life)), dt);
    }
  }
  function step(dt) {
    if (dt <= 0) return;
    stepSpots(dt);
    stepParticles(dt);
    stepChunks(dt);
    stepWrecks(dt);
    stepDecals(scorches, dt);
    stepDecals(glows, dt);
    shake = Math.max(0, shake - dt * 0.6);
  }

  // ── events ──────────────────────────────────────────────────────────────────────────────────────────
  /** Last-known world position of an entity: live in `state`, else the renderer's last-frame view. */
  function sourcePos(state, id) {
    if (id === null || id === undefined || id < 0) return null;
    const u = state.units && state.units.get(id);
    if (u && u.pos) return { x: cellToWorld(u.pos.x), z: cellToWorld(u.pos.y) };
    const s = state.structures && state.structures.get(id);
    if (s && s.pos) {
      const fp = s.footprint || {};
      return { x: cellToWorld(s.pos.x + ((fp.w || 1) - 1) / 2), z: cellToWorld(s.pos.y + ((fp.h || 1) - 1) / 2) };
    }
    const v = prev.get(id) || cur.get(id);
    return v ? { x: v.x, z: v.z } : null;
  }

  function firstTime(key, tick) {
    if (seen.has(key)) { stats.skipped++; return false; }
    seen.set(key, tick);
    stats.consumed++;
    return true;
  }

  function prune(tick) {
    if (seen.size > 4096) for (const [k, t] of seen) if (t < tick - SEEN_PRUNE_TICKS) seen.delete(k);
    if (hitClock.size > 4096) for (const [k, t] of hitClock) if (t < tick - SEEN_PRUNE_TICKS) hitClock.delete(k);
  }

  function onDamage(ev, state, tick) {
    if (!firstTime('d:' + tick + ':' + ev.sourceId + '>' + ev.targetId, tick)) return;
    if (ev.killed && ev.targetKind === 'unit') return;          // the kill event carries this one
    const pair = ev.sourceId + '>' + ev.targetId;
    const last = hitClock.get(pair);
    if (last !== undefined && tick - last < HIT_GAP_TICKS && tick >= last) return;
    hitClock.set(pair, tick);
    const x = cellToWorld(ev.pos.x), z = cellToWorld(ev.pos.y);
    const src = sourcePos(state, ev.sourceId);
    if (!src) { fxGround(x, z); return; }                        // sourceless AOE (base cannon, mines): the ground takes it
    let y = AIM.ground * 0.8;
    if (ev.targetKind === 'structure') y = AIM.structure;
    else if (ev.targetKind === 'base') y = AIM.base;
    else {
      const t = state.units && state.units.get(ev.targetId);
      const v = cur.get(ev.targetId) || prev.get(ev.targetId);
      const hover = (t && (t.altitude > 0 || t.domain === 'Flyer')) || (v && v.y > 0.05);
      if (hover) y = HOVER_HEIGHT + 0.24;
    }
    fxHit(x, z, x - src.x, z - src.z, y);
  }

  function onKill(ev, tick, opts) {
    if (!firstTime('k:' + tick + ':' + ev.entityId, tick)) return;
    let v = prev.get(ev.entityId) || cur.get(ev.entityId);
    if (!v) {                                    // never drawn (spawned and died between frames): face +X, on the ground
      let r = null;
      try { r = opts.resolve ? opts.resolve(ev.unitId) : null; } catch (e) { r = null; }
      const model = (r && r.model) || 'tank';
      v = { model, scale: (r && r.scale) || 1, x: cellToWorld(ev.pos.x), z: cellToWorld(ev.pos.y),
        y: modelInfo(model).hover ? HOVER_HEIGHT : 0, heading: 0, aim: 0 };
    } else {
      v = { ...v, x: cellToWorld(ev.pos.x), z: cellToWorld(ev.pos.y) };   // the sim's death position wins
    }
    fxExplode(v);
  }

  function onEvent(ev, state, tick, opts) {
    if (!ev || !ev.type) return;
    const t = typeof ev.tick === 'number' ? ev.tick : tick;
    switch (ev.type) {
      case 'damage': if (ev.pos) onDamage(ev, state, t); break;
      case 'kill': if (ev.pos) onKill(ev, t, opts); break;
      case 'destroyed':
        if (ev.pos && firstTime('x:' + t + ':' + ev.entityId, t)) boom(cellToWorld(ev.pos.x), cellToWorld(ev.pos.y), 1.3);
        break;
      case 'mineExplode': {
        const p = ev.pos || ev.cell;
        if (p && firstTime('m:' + t + ':' + (ev.mineId ?? ev.id ?? (p.x + ',' + p.y)), t)) boom(cellToWorld(p.x), cellToWorld(p.y), 0.6);
        break;
      }
      default: break;
    }
  }

  function clear() {
    for (const p of particles) freeP.push(p);
    particles.length = 0; nAdd = 0; nSmoke = 0;
    scorches.length = 0; glows.length = 0; chunks.length = 0; wrecks.length = 0; spots.length = 0;
    seen.clear(); hitClock.clear(); prev.clear(); cur.clear(); burningUnits.clear();
    shake = 0;
  }

  return {
    particles, scorches, glows, chunks, wrecks, stats,
    get shake() { return shake; },
    get caps() { return { ...limits }; },
    /** Change the budget (quality tiers, e.g. setCaps(LOW_IMPACT_CAPS)). Live effects finish their life. */
    setCaps(c) { for (const k of Object.keys(DEFAULT_IMPACT_CAPS)) if (c && c[k] !== undefined) limits[k] = c[k]; },
    /** Live particle counts per batch. */
    get counts() { return { additive: nAdd, smoke: nSmoke }; },
    /**
     * Advance one rendered frame. `views` = this frame's buildUnitViews() list — kept as the last-frame cache
     * for the NEXT frame's kill events (heading, aim, model). dt = real seconds since the last frame.
     */
    update(state, map, events, dt, views, opts = {}) {
      if (!state) return;
      const now = state.time || 0;
      if (now < lastTime) clear();               // restart / map change: the sim clock went back
      lastTime = now;
      step(Math.min(0.1, Math.max(0, dt || 0)));
      const tick = state.tick || 0;
      if (views) {                               // this frame's views; the previous frame's stay readable as `prev`
        const t = prev; prev = cur; cur = t; cur.clear();
        for (const v of views) cur.set(v.id, v);
      }
      stepBurningUnits(state, Math.min(0.1, Math.max(0, dt || 0)));
      if (events) for (const ev of events) onEvent(ev, state, tick, opts);
      prune(tick);
    },
    clear,
    // recipes, exposed for tests and debugging
    fxHit, fxGround, fxExplode, boom, burn, ignite,
    /** A fake light flash: a warm additive glow on the ground (fx/flashLights.js) [MM-story_mvehp8ca_l]. col = [r, g, b] 0..1. */
    glowAt(x, z, r, life, col, a) { decal(D.POOL, x, z, r, life, col, a); },
    /** Units burning now (ids), for tests. */
    get burningUnits() { return [...burningUnits.keys()]; },
    /** Raw emitter for other FX modules (the cannon shell's trail): emit(kind, x, y, z, vx, vy, vz, life, size, grow, shade, dusty, drag). */
    emit,
    /** An expanding ground ring (additive decal): radius r → r1 over life, colour [r,g,b], peak alpha a. The cannon's
     *  firing shockwave [MM-task_mvd1yej4_g]. */
    ring(x, z, r, r1, life, col, a) { decal(D.RING, x, z, r, life, col, a, r1); },
  };
}
