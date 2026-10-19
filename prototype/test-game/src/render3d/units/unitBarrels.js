/**
 * src/render3d/units/unitBarrels.js — unit gun barrels that pitch to the shot, and the firing points at their tips.
 * [MM-story_mvedy16u_9] — docs/tech-plan/3D-Combat-Polish.md §3.2 (CP-5).
 *
 * Owner 2026-10-18: "rebuild all towers, tanks, and base defenses to have barrel that can go up and down based on fire
 * trajectory". The tank, buggy and King Tiger carry their gun parts in a `barrel` group about a trunnion pivot
 * (models.js `pivots.barrel`, limits in `barrel`), and declare `muzzles` (model space, authored at pitch 0). Each frame
 * the barrel slews toward the launch slope of a straight shot (elevation.js pitchFor, apex 0) from its tip to the
 * target, clamped to the model's limits, and eases back level when idle. Shots then leave the modelled tip
 * (combatFxModel opts.unitMuzzle) instead of the cell centre.
 *
 * Render-only: frame time drives it, never the sim tick. Pure apart from its per-unit pitch map.
 */
import { UNIT_MODELS } from './models.js';
import { UNIT_SCALE } from './modelKeys.js';
import { pitchFor } from '../fx/elevation.js';
import { aimPoint } from '../fx/combatFxModel.js';
import { createRecoil, bodyKick } from '../fx/recoil.js';

const DEG = Math.PI / 180;

/**
 * World firing point i of a unit view { model, scale, x, y, z, heading, aim } at barrel pitch `pitch` (radians), or
 * null for a model without muzzles. Same shape as the System towers' muzzlePoint (system3d.js).
 */
export function unitMuzzle(view, i = 0, pitch = 0) {
  const def = view && UNIT_MODELS[view.model], list = def && def.muzzles;
  if (!list || !list.length) return null;
  const m = list[((i % list.length) + list.length) % list.length];
  const k = UNIT_SCALE * (view.scale || 1);
  const pt = (def.pivots && def.pivots.turret) || [0, 0, 0], pb = (def.pivots && def.pivots.barrel) || pt;
  const ce = Math.cos(pitch), se = Math.sin(pitch);
  // tilt about the trunnion (model Rz) …
  const px = m.p[0] - pb[0], py = m.p[1] - pb[1];
  const p = [pb[0] + px * ce - py * se, pb[1] + px * se + py * ce, m.p[2]];
  const d0 = m.d || [1, 0, 0], d = [d0[0] * ce - d0[1] * se, d0[0] * se + d0[1] * ce, d0[2]];
  // … then the hull (Ry(−heading)) carries the turret pivot and the turret (Ry(−aim) overall) carries the rest
  const h = view.heading || 0, a = view.aim == null ? h : view.aim;
  const ry = (v, t) => { const c = Math.cos(-t), s = Math.sin(-t); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
  const P = ry(pt, h), Q = ry([p[0] - pt[0], p[1] - pt[1], p[2] - pt[2]], a), D = ry(d, a);
  const dl = Math.hypot(D[0], D[1], D[2]) || 1;
  const x = view.x + (P[0] + Q[0]) * k, y = (view.y || 0) + (P[1] + Q[1]) * k, z = view.z + (P[2] + Q[2]) * k;
  const dx = D[0] / dl, dy = D[1] / dl, dz = D[2] / dl, back = (m.back || 0) * k;
  const bar = def.barrel || { min: -8, max: 25 };
  return { x, y, z, dx, dy, dz, bx: x - dx * back, by: y - dy * back, bz: z - dz * back, brake: 0, n: list.length,
    gx: view.x, gz: view.z, gr: 0.22, pmin: bar.min * DEG, pmax: bar.max * DEG, aim: 'straight' };
}

/** The pitch a unit barrel wants for target `to` from firing point m: a straight shot, clamped. */
export function unitPitchFor(bar, m, to) {
  return Math.max(bar.min * DEG, Math.min(bar.max * DEG, pitchFor(m, to, 0)));
}

/**
 * createUnitBarrels() → { update(views, state, map, drawn, dt), muzzle(id, n), pitch(id), kick(id, n) }
 *   update sets view.pitch on every view whose model has a barrel; muzzle(id, n) is the n-th firing point of that unit
 *   as last drawn (combatFxModel opts.unitMuzzle).
 */
export function createUnitBarrels() {
  const pitch = new Map(), byId = new Map(), recoil = createRecoil();
  return {
    update(views, state, map, drawn, dt) {
      const dts = Math.min(0.1, Math.max(0, dt || 0));
      recoil.step(dt);
      byId.clear();
      const seen = new Set();
      for (const v of views || []) {
        const def = UNIT_MODELS[v.model], bar = def && def.barrel;
        if (!bar) continue;
        byId.set(v.id, v); seen.add(v.id);
        const u = state && state.units && state.units.get(v.id);
        const to = u && u.targetId != null ? aimPoint(state, map, u.targetId, drawn) : null;
        const pc = pitch.has(v.id) ? pitch.get(v.id) : bar.rest * DEG;
        const m = to && unitMuzzle(v, 0, pc);
        const want = m ? unitPitchFor(bar, m, to) : bar.rest * DEG;
        const ps = bar.rate * dts * (m ? 1 : 0.5);
        const p = pc + Math.max(-ps, Math.min(ps, want - pc));
        pitch.set(v.id, p); v.pitch = p;
        if (def.recoil) {   // main guns slide back after a shot: { group: model units } [MM-story_mvee15ja_b]
          let r = null;
          for (const mz of def.muzzles || []) { const g = mz.g || 'barrel', o = recoil.offset(v.id, g, def.recoil); if (o) (r = r || {})[g] = o; }
          v.recoil = r;
          // and the whole tank rocks back — shove, front up, drop, slide back [MM-task_mvfpbbtp_1]
          const f = bodyKick(recoil.since(v.id, 'body'));
          v.kick = f.back || f.lift ? f : null;
        }
      }
      for (const id of [...pitch.keys()]) if (!seen.has(id)) pitch.delete(id);
    },
    muzzle(id, n = 0) { const v = byId.get(id); return v ? unitMuzzle(v, n, pitch.get(id) || 0) : null; },
    pitch(id) { return pitch.has(id) ? pitch.get(id) : null; },
    /** True for a unit whose main gun recoils (tank, King Tiger): it fires single heavy rounds [MM-task_mvfpbbtp_1]. */
    heavy(id) { const v = byId.get(id), def = v && UNIT_MODELS[v.model]; return !!(def && def.recoil); },
    /** A round left firing point n of unit `id`: that gun kicks back (models with `recoil` only). */
    kick(id, n = 0) {
      const v = byId.get(id), def = v && UNIT_MODELS[v.model];
      if (!def || !def.recoil || !def.muzzles) return;
      const mz = def.muzzles[((n % def.muzzles.length) + def.muzzles.length) % def.muzzles.length];
      recoil.kick(id, mz.g || 'barrel');
      recoil.kick(id, 'body');
    },
  };
}
