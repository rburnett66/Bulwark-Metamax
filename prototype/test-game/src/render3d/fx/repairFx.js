/**
 * src/render3d/fx/repairFx.js — a structure being repaired throws welding sparks. [MM-task_mvcrs0q1_14]
 *
 * Owner 2026-10-17: "repairs should spawn little blue sparks that bounce on the ground and color shift to orange".
 * While a repair troop is at work (sim: unit.isRepairTroop, state 'repairing', repairTargetId) the weld point — on the
 * structure's face toward the troop — sprays small sparks: they leave blue-white hot, arc out, bounce on the ground a
 * couple of times and cool to orange before they die (impacts.js SPARK with the REPAIR tint; impactsView colours it).
 * A short blue flicker sits on the weld point, and the finished repair (the sim's `build` event, phase 'repaired')
 * ends with one bright shower.
 *
 * Read-only on the sim; its own seeded PRNG (never Math.random). Pure: no three.js — it emits into the world-impact
 * particles (fx/impacts.js).
 */
import { cellToWorld } from '../camera.js';

export const REPAIR_FX = Object.freeze({
  rate: 26,          // sparks / s per working troop
  speed: [1.2, 2.8], // cells / s out of the weld
  up: [1.2, 2.6],    // initial lift
  life: [0.7, 1.15], // s — long enough for two bounces and the cool to orange
  size: 0.02,
  weldY: [0.25, 0.6],
  finish: 34,        // sparks in the completion shower
});

export function createRepairFx({ seed = 11 } = {}) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const lerp = (r) => r[0] + (r[1] - r[0]) * rnd();
  const acc = new Map();   // troop id → fractional spark carry

  /** The weld point: the structure's edge toward the troop, and the outward direction. */
  function weld(state, u) {
    const s = state.structures && state.structures.get(u.repairTargetId);
    if (!s || !s.pos || !u.pos) return null;
    const fp = s.footprint || {};
    const sx = cellToWorld(s.pos.x + ((fp.w || 1) - 1) / 2), sz = cellToWorld(s.pos.y + ((fp.h || 1) - 1) / 2);
    const ux = cellToWorld(u.pos.x), uz = cellToWorld(u.pos.y);
    let dx = ux - sx, dz = uz - sz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const r = 0.4 * Math.max(fp.w || 1, fp.h || 1);
    return { x: sx + dx * r, z: sz + dz * r, dx, dz };
  }

  function spark(emit, K, w, k = 1) {
    const sp = lerp(REPAIR_FX.speed) * k, side = (rnd() - 0.5) * 2.2;
    const vx = (w.dx + -w.dz * side * 0.6) * sp, vz = (w.dz + w.dx * side * 0.6) * sp;
    emit(K.SPARK, w.x, lerp(REPAIR_FX.weldY), w.z, vx, lerp(REPAIR_FX.up) * k, vz, lerp(REPAIR_FX.life), REPAIR_FX.size * (0.8 + rnd() * 0.5), 0, SPARK_TINT.repair);
  }

  return {
    /** Emit this frame's repair sparks. emit = impacts.emit, K = impacts' kinds. Returns sparks emitted. */
    step(dt, state, events, emit, K) {
      if (!state || !emit) return 0;
      let n = 0;
      const live = new Set();
      if (state.units) for (const u of state.units.values()) {
        if (!u.isRepairTroop || u.state !== 'repairing' || u.hp <= 0) continue;
        live.add(u.id);
        const w = weld(state, u);
        if (!w) continue;
        let c = (acc.get(u.id) || 0) + REPAIR_FX.rate * Math.max(0, Math.min(0.1, dt || 0));
        while (c >= 1) { c -= 1; spark(emit, K, w); n++; }
        acc.set(u.id, c);
        if (rnd() < 0.5) emit(K.FLASH, w.x, 0.42, w.z, 0, 0, 0, 0.05, 0.12 + rnd() * 0.08, 0, SPARK_TINT.repair);   // the arc flicker
      }
      for (const id of [...acc.keys()]) if (!live.has(id)) acc.delete(id);
      if (events) for (const ev of events) {
        if (ev.type !== 'build' || ev.phase !== 'repaired' || !state.structures) continue;
        const s = state.structures.get(ev.id);
        if (!s || !s.pos) continue;
        const fp = s.footprint || {};
        const cx = cellToWorld(s.pos.x + ((fp.w || 1) - 1) / 2), cz = cellToWorld(s.pos.y + ((fp.h || 1) - 1) / 2);
        for (let i = 0; i < REPAIR_FX.finish; i++) {
          const ang = rnd() * Math.PI * 2;
          spark(emit, K, { x: cx + Math.cos(ang) * 0.3, z: cz + Math.sin(ang) * 0.3, dx: Math.cos(ang), dz: Math.sin(ang) }, 1.25); n++;
        }
        emit(K.FLASH, cx, 0.6, cz, 0, 0, 0, 0.14, 0.7, 0, SPARK_TINT.repair);
      }
      return n;
    },
    clear() { acc.clear(); },
  };
}

/** impacts particle `shade` values the view reads as a tint for SPARK / FLASH (0 = the default hot white-orange). */
export const SPARK_TINT = Object.freeze({ repair: 1 });
