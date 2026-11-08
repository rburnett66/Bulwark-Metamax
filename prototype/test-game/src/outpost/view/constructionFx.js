/**
 * src/outpost/view/constructionFx.js — a building under construction at the outpost throws dust and welding sparks
 * (owner 2026-11-08: "buildings under construction need dust, and the welding sparks from random locations that cycle
 * every 4 seconds on the structure just like the repair effect in battle").
 *
 *   · DUST — the battle's build dust (render3d/fx/buildFx.js) round the pad's footprint, easing off as the job nears
 *     done (each job is fed to it as a structure with lifecycle 'Building').
 *   · WELDING — the battle's repair sparks (render3d/fx/repairFx.js: blue-white, bounce, cool to orange, and the arc
 *     flicker) from a weld point on the structure; the point moves to a new random spot every WELD_CYCLE seconds.
 *
 * Pure apart from its seeded PRNG (never Math.random): it reads the outpost's building jobs and emits into the
 * renderer's world-impact particles (r.impacts.emit), as the battle's effects do.
 */
import { cellToWorld } from '../../render3d/camera.js';
import { createBuildFx } from '../../render3d/fx/buildFx.js';
import { REPAIR_FX, SPARK_TINT } from '../../render3d/fx/repairFx.js';
import { structureDef } from '../../data/outpost.js';

export const WELD_CYCLE = 4;   // seconds a weld point holds before the welder moves on
export const WELD_HEIGHT = Object.freeze([0.3, 1.3]);   // world units up the structure

/** The outpost's jobs as battle-style structures: { id, pos, footprint, lifecycle: 'Building', progress }. */
export function constructionSites(o, map, now) {
  const out = [];
  for (const job of (o && o.building) || []) {
    const pad = map && map.pads && map.pads.find((p) => p.id === job.pad);
    if (!pad || !(job.done > now)) continue;
    const sec = ((structureDef(job.kind, job.tier) || {}).buildSec || 60) * 1000;
    out.push({ id: 'site-' + job.pad, pos: { x: pad.x, y: pad.y }, footprint: { w: pad.w, h: pad.h }, lifecycle: 'Building',
      progress: Math.max(0, Math.min(1, 1 - (job.done - now) / sec)) });
  }
  return out;
}

export function createConstructionFx({ seed = 41 } = {}) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const lerp = (r) => r[0] + (r[1] - r[0]) * rnd();
  const dust = createBuildFx({ seed: seed + 7 });
  const welds = new Map();   // site id → { x, y, z, dx, dz, age, carry }

  /** A new weld point: somewhere on the structure's sides, facing out, at a random height. */
  function newWeld(s) {
    const w = s.footprint.w, h = s.footprint.h;
    const cx = cellToWorld(s.pos.x + (w - 1) / 2), cz = cellToWorld(s.pos.y + (h - 1) / 2);
    const ang = rnd() * Math.PI * 2, rx = 0.32 * w, rz = 0.32 * h;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    return { x: cx + dx * rx, z: cz + dz * rz, y: lerp(WELD_HEIGHT), dx, dz, age: 0, carry: 0 };
  }

  return {
    /** Emit this frame's dust and sparks for `sites` (constructionSites). → { puffs, sparks } */
    step(dt, sites, emit, K, ring, tierKey = 'high') {
      if (!emit) return { puffs: 0, sparks: 0 };
      const d = Math.max(0, Math.min(0.1, dt || 0));
      const puffs = dust.step(d, { structures: new Map(sites.map((s) => [s.id, s])) }, null, emit, K, ring, tierKey);
      let sparks = 0;
      const live = new Set();
      for (const s of sites) {
        live.add(s.id);
        let wd = welds.get(s.id);
        if (!wd || wd.age >= WELD_CYCLE) { wd = newWeld(s); welds.set(s.id, wd); }
        wd.age += d;
        wd.carry += REPAIR_FX.rate * d;
        while (wd.carry >= 1) {
          wd.carry -= 1; sparks++;
          const sp = lerp(REPAIR_FX.speed), side = (rnd() - 0.5) * 2.2;
          emit(K.SPARK, wd.x, wd.y, wd.z, (wd.dx - wd.dz * side * 0.6) * sp, lerp(REPAIR_FX.up), (wd.dz + wd.dx * side * 0.6) * sp,
            lerp(REPAIR_FX.life), REPAIR_FX.size * (0.8 + rnd() * 0.5), 0, SPARK_TINT.repair);
        }
        if (rnd() < 0.5) emit(K.FLASH, wd.x, wd.y, wd.z, 0, 0, 0, 0.05, 0.12 + rnd() * 0.08, 0, SPARK_TINT.repair);   // the arc flicker
      }
      for (const id of [...welds.keys()]) if (!live.has(id)) welds.delete(id);
      return { puffs, sparks };
    },
    clear() { welds.clear(); },
  };
}
