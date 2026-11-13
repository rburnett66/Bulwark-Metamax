/**
 * src/render3d/fx/structureFx.js — welding sparks on every structure being built or upgraded, and red sparks + grey
 * smoke off every damaged one. [MM-story_mwcrfnyf_3c]
 *
 * One pattern for battle and outpost (owner playtest 2026-11-11: "building is supposed to present the blue sparks
 * from random locations, red sparks when damaged with grey smoke"). It reads the structures in the SimState the
 * renderer draws — a battle's, or the outpost's live state (outpost/liveSim.js) — never a view's own list:
 *   · WELDING — lifecycle 'Building' / 'Upgrading': the repair welder's blue sparks (repairFx.js emitWeldSpark,
 *     SPARK_TINT.repair, REPAIR_FX.rate) and its arc flicker, from a weld point on the structure's side at a random
 *     height; the point moves to a new random spot every WELD_CYCLE seconds. The dust is buildFx.js.
 *   · DAMAGE — hp < maxHp on a standing structure ('Complete' / 'Damaged' / 'Active', or an outpost 'Wrecked' at
 *     0 HP): the same welder with the damage tint (SPARK_TINT.damage) at DAMAGE_RATE scaled by the HP missing, from
 *     a point that also moves every WELD_CYCLE seconds, plus grey smoke rising off it (muzzleSmoke.js's emitter
 *     pointed up, DAMAGE_SMOKE). A wreck throws the most. Repaired → it stops. While a repair is on its way or at
 *     work (s.repairPending) the structure shows only the repair FX (repairFx.js).
 * Counts scale with the quality tier as the build dust does (buildFx.js BUILD_TIER: Low ≈ a quarter of High).
 *
 * Read-only on the sim; its own seeded PRNG (never Math.random); render-only. Pure: no three.js — it emits into the
 * world-impact particles (fx/impacts.js).
 */
import { cellToWorld } from '../camera.js';
import { REPAIR_FX, SPARK_TINT, emitWeldSpark } from './repairFx.js';
import { BUILD_TIER, fxStructures } from './buildFx.js';
import { emitMuzzleSmoke } from './muzzleSmoke.js';

export const WELD_CYCLE = 4;   // seconds a weld (or damage) point holds before it moves on
/** World units up the structure the point sits at: a 1×1 tower / wall, and anything bigger. */
export const WELD_HEIGHT = Object.freeze({ small: Object.freeze([0.2, 0.85]), large: Object.freeze([0.3, 1.3]) });
/** Damage sparks a second (High tier): from `light` (a scratch) to `heavy` (a wreck), scaled by the HP missing. */
export const DAMAGE_RATE = Object.freeze({ light: 4, heavy: 22 });
/** Grey smoke off a damaged structure: puffs a second from a scratch to a wreck, and the puff (muzzleSmoke's shape). */
export const DAMAGE_SMOKE = Object.freeze({
  rate: Object.freeze({ light: 2, heavy: 10 }),
  count: 1, size: 0.13, speed: Object.freeze([0.35, 0.65]), drag: 0.5, spread: 0.14, rise: 0.05,
  life: Object.freeze([2.6, 3.8]), grow: 1.8, shade: 0.4,   // mid grey, ~1 world unit wide at the top (impactsView: smoke at 0.55 alpha)
});
/**
 * SELLING (owner 2026-11-13 [MM-story_mwf950rz_7]: "when we sell a tower then should be four red sparklers at the same
 * time as the workers tear down the structure"): four red sparklers at once, one at each corner of the structure, for
 * the whole teardown — the welder's spray (emitWeldSpark) in the damage tint, each at the build weld's rate.
 */
export const SELL_SPARKLERS = 4;
const WELDING = new Set(['Building', 'Upgrading']);
const STANDING = new Set(['Complete', 'Damaged', 'Active', 'Wrecked']);

/** The HP missing, 0…1, of a structure that should throw damage FX — or 0 (healthy, building, selling, repairing). */
export function damageOf(s) {
  if (!s || !STANDING.has(s.lifecycle) || s.repairPending || !(s.maxHp > 0)) return 0;
  if (!(s.hp < s.maxHp)) return 0;
  return Math.max(0, Math.min(1, 1 - Math.max(0, s.hp) / s.maxHp));
}

export function createStructureFx({ seed = 41 } = {}) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const jit = () => rnd() - 0.5;
  const points = new Map();   // structure id → { x, y, z, dx, dz, age, carry, smoke, mode }

  /** A new point on the structure's side, facing out, at a random height. */
  function newPoint(s, mode) {
    const fp = s.footprint || {}, w = fp.w || 1, h = fp.h || 1;
    const cx = cellToWorld(s.pos.x + (w - 1) / 2), cz = cellToWorld(s.pos.y + (h - 1) / 2);
    const ang = rnd() * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang);
    const hy = Math.max(w, h) > 1 ? WELD_HEIGHT.large : WELD_HEIGHT.small;
    return { x: cx + dx * 0.32 * w, z: cz + dz * 0.32 * h, y: hy[0] + (hy[1] - hy[0]) * rnd(), dx, dz, age: 0, carry: 0, smoke: 0, mode };
  }
  /** Sparkler i of a structure being sold: at corner i (45°, 135°, …), a little jitter, a random height. */
  function sellPoint(s, i) {
    const fp = s.footprint || {}, w = fp.w || 1, h = fp.h || 1;
    const cx = cellToWorld(s.pos.x + (w - 1) / 2), cz = cellToWorld(s.pos.y + (h - 1) / 2);
    const ang = Math.PI / 4 + i * (Math.PI / 2) + jit() * 0.4, dx = Math.cos(ang), dz = Math.sin(ang);
    const hy = Math.max(w, h) > 1 ? WELD_HEIGHT.large : WELD_HEIGHT.small;
    return { x: cx + dx * 0.4 * w, z: cz + dz * 0.4 * h, y: hy[0] + (hy[1] - hy[0]) * rnd(), dx, dz, age: 0, carry: rnd(), smoke: 0, mode: 'sell' };
  }
  /** `rate` sparks a second in `tint` off point p, and the arc flicker. → sparks emitted */
  function spray(p, d, rate, tint, emit, K) {
    let n = 0;
    p.carry += rate * d;
    while (p.carry >= 1) { p.carry -= 1; n++; emitWeldSpark(emit, K, p, rnd, { tint, y: p.y }); }
    if (rate > 0 && rnd() < 0.5 * Math.min(1, rate / REPAIR_FX.rate)) emit(K.FLASH, p.x, p.y, p.z, 0, 0, 0, 0.05, 0.12 + rnd() * 0.08, 0, tint);
    return n;
  }

  return {
    /**
     * Emit this frame's welding and damage FX for `state.structures`. emit = impacts.emit, K = impacts' kinds,
     * tierKey = 'high' | 'standard' | 'low'. → { weld, damage, smoke, sell, sparklers } emitted / lit this frame.
     */
    step(dt, state, emit, K, tierKey = 'high') {
      const out = { weld: 0, damage: 0, smoke: 0, sell: 0, sparklers: 0 };
      if (!state || !state.structures || !emit) return out;
      const q = BUILD_TIER[tierKey] ?? 1;
      const d = Math.max(0, Math.min(0.1, dt || 0));
      const live = new Set();
      for (const s of fxStructures(state)) {
        if (!s || !s.pos) continue;
        if (s.lifecycle === 'Selling') {   // the teardown: four red sparklers at once
          for (let i = 0; i < SELL_SPARKLERS; i++) {
            const key = s.id + ':sell' + i;
            live.add(key);
            let p = points.get(key);
            if (p) p.age += d;
            if (!p || p.age >= WELD_CYCLE) { p = sellPoint(s, i); points.set(key, p); }
            out.sell += spray(p, d, REPAIR_FX.rate * q, SPARK_TINT.damage, emit, K);
            out.sparklers++;
          }
          continue;
        }
        const welding = WELDING.has(s.lifecycle), dmg = welding ? 0 : damageOf(s);
        if (!welding && !(dmg > 0)) continue;
        const mode = welding ? 'weld' : 'damage';
        live.add(s.id);
        let p = points.get(s.id);
        if (p) p.age += d;
        if (!p || p.mode !== mode || p.age >= WELD_CYCLE) { p = newPoint(s, mode); points.set(s.id, p); }
        if (welding) { out.weld += spray(p, d, REPAIR_FX.rate * q, SPARK_TINT.repair, emit, K); continue; }
        out.damage += spray(p, d, (DAMAGE_RATE.light + (DAMAGE_RATE.heavy - DAMAGE_RATE.light) * dmg) * q, SPARK_TINT.damage, emit, K);
        // grey smoke rising off the hurt point (muzzleSmoke's emitter, barrel pointed up; it puffs in pairs)
        p.smoke += (DAMAGE_SMOKE.rate.light + (DAMAGE_SMOKE.rate.heavy - DAMAGE_SMOKE.rate.light) * dmg) * q * d / 2;
        while (p.smoke >= 1) {
          p.smoke -= 1;
          out.smoke += emitMuzzleSmoke(emit, K.SMOKE, { x: p.x, y: p.y * 0.8, z: p.z, dx: 0, dy: 1, dz: 0 }, 1, jit, DAMAGE_SMOKE);
        }
      }
      for (const id of [...points.keys()]) if (!live.has(id)) points.delete(id);
      return out;
    },
    clear() { points.clear(); },
  };
}
