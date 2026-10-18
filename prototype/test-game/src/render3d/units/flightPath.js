/**
 * src/render3d/units/flightPath.js — attacking planes fly ATTACK RUNS instead of parking in the air.
 * [MM-story_mvee9r08_e] — docs/tech-plan/3D-Combat-Polish.md §8 (decision D3: render-only).
 *
 * Owner 2026-10-18: "attacking planes should not stop, they should do attack runs then circle back and attack again.
 * Drones and copters can hover." The sim holds an attacking flyer at its weapon range and deals continuous damage;
 * this module only changes where the PLANE IS DRAWN while it attacks. Each strafing unit (data flag
 * `attackPattern: 'strafe'` in data/tables.js) flies a racetrack centred on its target:
 *   · an INBOUND run along a line through the target (the only part of the loop where its shots are drawn),
 *   · an overfly past the target,
 *   · a climbing, banked 180° turn,
 *   · a return leg offset to one side, and another banked turn back onto the inbound line.
 * The run starts exactly where the sim holds the plane (it is already on the line toward its target), so it never
 * jumps; heading, height and bank ease in. Everything that points at the
 * plane — AA missiles, tower turrets, health bars, wrecks — reads the drawn position from `poses` (keyed by id).
 *
 * Pure: no three.js; time comes from the render clock; per-unit phase from the id (no Math.random). Copters and
 * drones have no flag and hover as before.
 */
import { cellToWorld } from '../camera.js';
import { HOVER_HEIGHT } from './unitViews.js';
import { getUnitDef } from '../../data/tables.js';
import { BASE_TARGET_ID } from '../../sim/combat.js';

export const FLIGHT_RUN = Object.freeze({
  halfLength: 3.2,   // cells: half the straight leg (the run starts this far before the target and ends this far past it)
  radius: 1.5,       // cells: turn radius (the return leg is 2× this to the side)
  speedK: 1.7,       // drawn speed = sim speed × this (min 2.2 cells/s): a strafing pass is fast
  minSpeed: 2.2,
  climb: 0.55,       // extra height at the top of a turn
  dive: 0.18,        // the run dips this much below cruise
  bank: 0.6,         // rad of roll through a turn
  blend: 1.0,        // s for heading, height and bank to ease into the loop
  fireLead: 0.15,    // shots stop this share of the leg before passing over the target
});

/** Racetrack geometry: total length and the four segments' lengths. */
function track(L, rho) {
  const straight = 2 * L, turn = Math.PI * rho;
  return { straight, turn, total: 2 * straight + 2 * turn };
}

/**
 * The pose at arc length s on a racetrack centred on the target T = (tx, tz), inbound direction (fx, fz) (unit,
 * pointing the way the plane flies on the run), side (nx, nz) = the return leg's side.
 * → { x, z, heading, bank, inbound, turnK } — heading = atan2(dz, dx) of travel (the views' convention).
 */
export function loopPose(tx, tz, fx, fz, s, L = FLIGHT_RUN.halfLength, rho = FLIGHT_RUN.radius) {
  const nx = -fz, nz = fx;   // the side of the return leg (left of the run)
  const k = track(L, rho);
  let u = ((s % k.total) + k.total) % k.total;
  // 1 · the inbound run: from T − f·L to T + f·L along the line through the target
  if (u < k.straight) {
    const a = -L + u;
    return { x: tx + fx * a, z: tz + fz * a, heading: Math.atan2(fz, fx), bank: 0, inbound: a < -FLIGHT_RUN.fireLead * 2 * L, turnK: 0, run: (a + L) / (2 * L) };   // shots on the approach, not the overfly
  }
  u -= k.straight;
  // 2 · the far turn: a half circle from the run's end to the return leg (turning toward the side)
  if (u < k.turn) {
    const th = u / rho;                       // 0 → π
    const cx = tx + fx * L + nx * rho, cz = tz + fz * L + nz * rho;
    const x = cx - nx * rho * Math.cos(th) + fx * rho * Math.sin(th);
    const z = cz - nz * rho * Math.cos(th) + fz * rho * Math.sin(th);
    const dx = nx * Math.sin(th) + fx * Math.cos(th), dz = nz * Math.sin(th) + fz * Math.cos(th);
    return { x, z, heading: Math.atan2(dz, dx), bank: FLIGHT_RUN.bank, inbound: false, turnK: Math.sin(th), run: 1 };
  }
  u -= k.turn;
  // 3 · the return leg: back past the target, offset 2ρ to the side
  if (u < k.straight) {
    const a = L - u;
    return { x: tx + fx * a + nx * 2 * rho, z: tz + fz * a + nz * 2 * rho, heading: Math.atan2(-fz, -fx), bank: 0, inbound: false, turnK: 0, run: 0 };
  }
  u -= k.straight;
  // 4 · the near turn: back onto the inbound line
  const th = u / rho;
  const cx = tx - fx * L + nx * rho, cz = tz - fz * L + nz * rho;
  const x = cx + nx * rho * Math.cos(th) - fx * rho * Math.sin(th);
  const z = cz + nz * rho * Math.cos(th) - fz * rho * Math.sin(th);
  const dx = -nx * Math.sin(th) - fx * Math.cos(th), dz = -nz * Math.sin(th) - fz * Math.cos(th);
  return { x, z, heading: Math.atan2(dz, dx), bank: FLIGHT_RUN.bank, inbound: false, turnK: Math.sin(th), run: 0 };
}

const angLerp = (a, b, t) => { const d = ((b - a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI; return a + d * t; };

/**
 * createFlightPaths({ lookup }) → { poses, update(state, map, views, dt), clear() }
 *   poses — Map id → { x, y, z, heading, bank, inbound } for every plane flying a run this frame (world units)
 *   update — rewrites matching views in place (position, height, heading, bank) and refreshes `poses`.
 */
export function createFlightPaths({ lookup = getUnitDef } = {}) {
  const poses = new Map();
  const mem = new Map();   // id → { t: seconds in the attack, phase: arc offset, f: inbound dir, T: target }
  const strafes = new Map();   // unitId → bool (cached def lookup)
  let clock = 0;
  const isStrafer = (unitId) => {
    if (!strafes.has(unitId)) { let d = null; try { d = lookup(unitId); } catch (e) { d = null; } strafes.set(unitId, !!(d && d.attackPattern === 'strafe')); }
    return strafes.get(unitId);
  };
  function targetWorld(state, map, u) {
    const tid = u.targetId;
    if (tid === BASE_TARGET_ID) { const b = (state.base && state.base.pos) || (map && map.base); return b ? { x: cellToWorld(b.x), z: cellToWorld(b.y) } : null; }
    const t = (state.units && state.units.get(tid)) || (state.structures && state.structures.get(tid));
    if (!t || !t.pos) return null;
    const fp = t.footprint || {};
    return { x: cellToWorld(t.pos.x + ((fp.w || 1) - 1) / 2), z: cellToWorld(t.pos.y + ((fp.h || 1) - 1) / 2) };
  }
  return {
    poses,
    update(state, map, views, dt) {
      const step = Math.max(0, Math.min(0.1, dt || 0));
      clock += step;
      poses.clear();
      if (!state || !state.units || !views) return poses;
      const live = new Set();
      for (const v of views) {
        const u = state.units.get(v.id);
        if (!u || u.hp <= 0 || !(u.altitude > 0 || u.domain === 'Flyer') || !isStrafer(u.unitId)) continue;
        if (u.state !== 'attacking' || u.targetId === null || u.targetId === undefined) continue;
        const T = targetWorld(state, map, u);
        if (!T) continue;
        live.add(v.id);
        let m = mem.get(v.id);
        if (!m || m.tid !== u.targetId) {
          // the run comes in from where the plane is now: inbound direction = from the plane toward the target
          let fx = T.x - v.x, fz = T.z - v.z; const d = Math.hypot(fx, fz) || 1; fx /= d; fz /= d;
          const L = FLIGHT_RUN.halfLength;
          // the plane is already on the inbound line (f points from it to the target): start the run exactly where it
          // is — arc length L − d, negative when it holds farther out than the run's start (the first run is longer)
          m = { t: 0, tid: u.targetId, fx, fz, s0: Math.min(2 * L, L - d), from: { x: v.x, z: v.z, heading: v.heading } };
          mem.set(v.id, m);
        }
        m.t += step;
        const def = (() => { try { return lookup(u.unitId); } catch (e) { return null; } })();
        const speed = Math.max(FLIGHT_RUN.minSpeed, ((def && def.speed) || 1.5) * FLIGHT_RUN.speedK);
        const sArc = m.s0 + m.t * speed, L = FLIGHT_RUN.halfLength;
        const p = sArc >= 0 ? loopPose(T.x, T.z, m.fx, m.fz, sArc)
          : { x: T.x + m.fx * (sArc - L), z: T.z + m.fz * (sArc - L), heading: Math.atan2(m.fz, m.fx), bank: 0, inbound: true, turnK: 0 };   // the long first run-in
        // position follows the loop from the first frame (it starts at the plane); heading, height and bank ease in
        const b = Math.min(1, m.t / FLIGHT_RUN.blend), e = b * b * (3 - 2 * b);
        const y = HOVER_HEIGHT + FLIGHT_RUN.climb * p.turnK - (p.inbound ? FLIGHT_RUN.dive : 0);
        v.x = p.x;
        v.z = p.z;
        v.y = HOVER_HEIGHT + (y - HOVER_HEIGHT) * e;
        v.heading = angLerp(m.from.heading, p.heading, e);
        v.aim = v.heading;
        v.bank = p.bank * e;
        poses.set(v.id, { x: v.x, y: v.y, z: v.z, heading: v.heading, bank: v.bank, inbound: p.inbound && e > 0.99 });
      }
      for (const id of [...mem.keys()]) if (!live.has(id)) mem.delete(id);
      return poses;
    },
    clear() { poses.clear(); mem.clear(); },
  };
}
