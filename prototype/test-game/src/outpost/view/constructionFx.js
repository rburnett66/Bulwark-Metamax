/**
 * src/outpost/view/constructionFx.js — a building under construction at the outpost throws dust and welding sparks
 * (owner 2026-11-08: "buildings under construction need dust, and the welding sparks from random locations that cycle
 * every 4 seconds on the structure just like the repair effect in battle").
 *
 *   · DUST — DUST_MULT (4) times the battle's build dust (render3d/fx/buildFx.js) round the pad's footprint, easing
 *     off as the job nears done (each job is fed to it as a structure with lifecycle 'Building').
 *   · WELDING — the battle's repair sparks (render3d/fx/repairFx.js: blue-white, bounce, cool to orange, and the arc
 *     flicker) from a weld point on the structure; the point moves to a new random spot every WELD_CYCLE seconds.
 *
 *   · DAMAGE — a damaged defense throws RED sparks the same way (owner 2026-11-09: "when a structure is damage there
 *     should be red sparks, just like the blue construction sparks"): the welding emitter with the damage tint
 *     (SPARK_TINT.damage), from a point that moves every WELD_CYCLE seconds, faster the worse the damage
 *     (DAMAGE_RATE), and no dust. A wreck (0 HP) throws the most. Repaired, it stops.
 *
 * Pure apart from its seeded PRNG (never Math.random): it reads the outpost's building jobs and emits into the
 * renderer's world-impact particles (r.impacts.emit), as the battle's effects do.
 */
import { cellToWorld } from '../../render3d/camera.js';
import { createBuildFx } from '../../render3d/fx/buildFx.js';
import { REPAIR_FX, SPARK_TINT } from '../../render3d/fx/repairFx.js';
import { structureDef } from '../../data/outpost.js';

// the dust is DUST_MULT times the battle's build dust (owner 2026-11-08: "the construction dust should be 4x what you demoed")
export const DUST_MULT = 4;
export const WELD_CYCLE = 4;   // seconds a weld point holds before the welder moves on
export const WELD_HEIGHT = Object.freeze([0.3, 1.3]);   // world units up the structure
/** Damage sparks per second: from `light` (a scratch) to `heavy` (a wreck), scaled by the HP missing. */
export const DAMAGE_RATE = Object.freeze({ light: 4, heavy: 22 });
const DAMAGE_HEIGHT = Object.freeze([0.15, 0.7]);   // a defense is short: the sparks come off its body

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
  // the defense on the Upgrade Bay (owner 2026-11-10, tower parity) [MM-story_mwb8zcgz_25]: the battle's build dust and
  // welding sparks where it stands on the bay's pad (conduits.js defenseStructures: the pad's open right side)
  const u = o && o.upgrading;
  if (u && u.done > now) {
    const bayId = Object.keys(o.pads || {}).sort().find((id) => o.pads[id].kind === 'upgradeBay');
    const pad = bayId && map && map.pads ? map.pads.find((p) => p.id === bayId) : null;
    if (pad) {
      const span = Math.max(1, u.done - (u.since ?? (u.done - 60000)));
      out.push({ id: 'upgrade-' + u.id, pos: { x: pad.x + pad.w - 1, y: pad.y + Math.floor(pad.h / 2) }, footprint: { w: 1, h: 1 }, lifecycle: 'Building',
        progress: Math.max(0, Math.min(1, 1 - (u.done - now) / span)) });
    }
  }
  return out;
}

/** The outpost's damaged defenses: { id, pos, footprint 1 × 1, damage: 0…1 (the HP missing) }. */
export function damageSites(o) {
  const out = [];
  for (const d of (o && o.defenses) || []) {
    const def = structureDef(d.kind, d.tier), max = def && def.battle ? def.battle.hp : 0;
    if (!(max > 0) || !(d.hp < max) || !d.cell) continue;
    out.push({ id: 'dmg-' + d.id, pos: { x: d.cell[0], y: d.cell[1] }, footprint: { w: 1, h: 1 }, damage: Math.max(0, Math.min(1, 1 - d.hp / max)), wreck: !(d.hp > 0) });
  }
  return out;
}

/** Smoke puffs a second off a wrecked defense (0 HP). */
export const WRECK_SMOKE_RATE = 5;

export function createConstructionFx({ seed = 41 } = {}) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const lerp = (r) => r[0] + (r[1] - r[0]) * rnd();
  const dust = createBuildFx({ seed: seed + 7 });
  const welds = new Map();   // site id → { x, y, z, dx, dz, age, carry }

  /** A new weld point: somewhere on the structure's sides, facing out, at a random height. */
  function newWeld(s, height = WELD_HEIGHT) {
    const w = s.footprint.w, h = s.footprint.h;
    const cx = cellToWorld(s.pos.x + (w - 1) / 2), cz = cellToWorld(s.pos.y + (h - 1) / 2);
    const ang = rnd() * Math.PI * 2, rx = 0.32 * w, rz = 0.32 * h;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    return { x: cx + dx * rx, z: cz + dz * rz, y: lerp(height), dx, dz, age: 0, carry: 0 };
  }
  /** Sparks from a point (the welding emitter), `rate` a second, in `tint`. → sparks emitted */
  function sparkFrom(wd, d, rate, tint, emit, K) {
    let n = 0;
    wd.age += d;
    wd.carry += rate * d;
    while (wd.carry >= 1) {
      wd.carry -= 1; n++;
      const sp = lerp(REPAIR_FX.speed), side = (rnd() - 0.5) * 2.2;
      emit(K.SPARK, wd.x, wd.y, wd.z, (wd.dx - wd.dz * side * 0.6) * sp, lerp(REPAIR_FX.up), (wd.dz + wd.dx * side * 0.6) * sp,
        lerp(REPAIR_FX.life), REPAIR_FX.size * (0.8 + rnd() * 0.5), 0, tint);
    }
    if (rnd() < 0.5 * Math.min(1, rate / REPAIR_FX.rate)) emit(K.FLASH, wd.x, wd.y, wd.z, 0, 0, 0, 0.05, 0.12 + rnd() * 0.08, 0, tint);   // the flicker
    return n;
  }
  const hurts = new Map();   // damage site id → spark point

  return {
    /** Emit this frame's dust and sparks for `sites` (constructionSites). → { puffs, sparks } */
    step(dt, sites, emit, K, ring, tierKey = 'high') {
      if (!emit) return { puffs: 0, sparks: 0 };
      const d = Math.max(0, Math.min(0.1, dt || 0));
      const st = { structures: new Map(sites.map((s) => [s.id, s])) };
      let puffs = 0;
      for (let k = 0; k < DUST_MULT; k++) puffs += dust.step(d, st, null, emit, K, ring, tierKey);
      let sparks = 0;
      const live = new Set();
      for (const s of sites) {
        live.add(s.id);
        let wd = welds.get(s.id);
        if (!wd || wd.age >= WELD_CYCLE) { wd = newWeld(s); welds.set(s.id, wd); }
        sparks += sparkFrom(wd, d, REPAIR_FX.rate, SPARK_TINT.repair, emit, K);
      }
      for (const id of [...welds.keys()]) if (!live.has(id)) welds.delete(id);
      return { puffs, sparks };
    },
    /** Emit this frame's red sparks for `sites` (damageSites). → sparks emitted */
    stepDamage(dt, sites, emit, K) {
      if (!emit) return 0;
      const d = Math.max(0, Math.min(0.1, dt || 0));
      let sparks = 0;
      const live = new Set();
      for (const s of sites) {
        live.add(s.id);
        let wd = hurts.get(s.id);
        if (!wd || wd.age >= WELD_CYCLE) { wd = newWeld(s, DAMAGE_HEIGHT); hurts.set(s.id, wd); }
        sparks += sparkFrom(wd, d, DAMAGE_RATE.light + (DAMAGE_RATE.heavy - DAMAGE_RATE.light) * s.damage, SPARK_TINT.damage, emit, K);
        if (s.wreck) {   // a wreck smokes: a thin dark column off its middle [MM-story_mwb8zamf_23]
          wd.smoke = (wd.smoke || 0) + WRECK_SMOKE_RATE * d;
          while (wd.smoke >= 1) {
            wd.smoke -= 1;
            emit(K.SMOKE, wd.x + (rnd() - 0.5) * 0.25, wd.y * 0.6, wd.z + (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.12, 0.5 + rnd() * 0.4, (rnd() - 0.5) * 0.12, 2.6 + rnd() * 1.2, 0.18 + rnd() * 0.08, 1.2, 0.14);
          }
        }
      }
      for (const id of [...hurts.keys()]) if (!live.has(id)) hurts.delete(id);
      return sparks;
    },
    clear() { welds.clear(); hurts.clear(); },
  };
}
