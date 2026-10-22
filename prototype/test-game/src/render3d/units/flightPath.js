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
  grace: 1.5,        // s a run keeps flying after the sim drops 'attacking' (it often picks it straight back up)
  settle: 0.05,      // cells: an exiting plane is home once this close to where the sim holds it
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
  const mem = new Map();   // id → { t: seconds in the attack, s0: arc offset, f: inbound dir, T: target, idle: s since the sim let go }
  const drawn = new Map(); // id → the pose drawn last frame (a new run or the way home starts from it, never from the sim)
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
      const speedOf = (u) => { let d = null; try { d = lookup(u.unitId); } catch (e) { d = null; } return Math.max(FLIGHT_RUN.minSpeed, ((d && d.speed) || 1.5) * FLIGHT_RUN.speedK); };
      const put = (v, pose) => { v.x = pose.x; v.z = pose.z; v.y = pose.y; v.heading = pose.heading; v.aim = pose.heading; v.bank = pose.bank;
        drawn.set(v.id, { x: pose.x, z: pose.z, y: pose.y, heading: pose.heading, bank: pose.bank }); };
      for (const v of views) {
        const u = state.units.get(v.id);
        if (!u || u.hp <= 0 || !(u.altitude > 0 || u.domain === 'Flyer') || !isStrafer(u.unitId)) continue;
        const attacking = u.state === 'attacking' && u.targetId !== null && u.targetId !== undefined;
        const T = attacking ? targetWorld(state, map, u) : null;
        let m = mem.get(v.id);
        const speed = speedOf(u);
        if (T) {
          live.add(v.id);
          if (m && m.tid !== u.targetId) m = null;   // a new target: a new run …
          if (!m) {
            // … flown in from where the plane is DRAWN (mid-loop, or easing home), not where the sim holds it — the run's
            // inbound line passes through that point, so it never jumps [MM-task_mvk3fn61_l]
            const at = drawn.get(v.id) || { x: v.x, z: v.z, heading: v.heading, y: v.y, bank: 0 };
            let fx = T.x - at.x, fz = T.z - at.z; const d = Math.hypot(fx, fz) || 1; fx /= d; fz /= d;
            const L = FLIGHT_RUN.halfLength;
            m = { t: 0, tid: u.targetId, fx, fz, s0: Math.min(2 * L, L - d), from: { heading: at.heading, y: at.y != null ? at.y : HOVER_HEIGHT, bank: at.bank || 0 }, T };
            mem.set(v.id, m);
          }
          m.T = T; m.idle = 0;
        } else if (m && m.idle + step <= FLIGHT_RUN.grace) {
          // the sim let go of 'attacking' (a re-target, a blip): keep flying the same loop round the last target for a moment
          live.add(v.id);
          m.idle += step;
        } else {
          // the attack is over: ease home to where the sim holds the plane, at the plane's own speed
          mem.delete(v.id);
          const at = drawn.get(v.id);
          if (!at) continue;
          const dx = v.x - at.x, dz = v.z - at.z, d = Math.hypot(dx, dz);
          if (d <= FLIGHT_RUN.settle) { drawn.delete(v.id); continue; }
          const k = Math.min(1, (speed * step) / d);
          const heading = d > 0.2 ? angLerp(at.heading, Math.atan2(dz, dx), Math.min(1, step * 4)) : at.heading;
          live.add(v.id);
          put(v, { x: at.x + dx * k, z: at.z + dz * k, y: at.y + (v.y - at.y) * Math.min(1, step * 2), heading, bank: at.bank * Math.max(0, 1 - step * 3) });
          poses.set(v.id, { x: v.x, y: v.y, z: v.z, heading: v.heading, bank: v.bank, inbound: false });
          continue;
        }
        m.t += step;
        const Tm = m.T, sArc = m.s0 + m.t * speed, L = FLIGHT_RUN.halfLength;
        const p = sArc >= 0 ? loopPose(Tm.x, Tm.z, m.fx, m.fz, sArc)
          : { x: Tm.x + m.fx * (sArc - L), z: Tm.z + m.fz * (sArc - L), heading: Math.atan2(m.fz, m.fx), bank: 0, inbound: true, turnK: 0 };   // the long first run-in
        // position follows the loop from the first frame (it starts at the plane); heading, height and bank ease in
        const b = Math.min(1, m.t / FLIGHT_RUN.blend), e = b * b * (3 - 2 * b);
        const y = HOVER_HEIGHT + FLIGHT_RUN.climb * p.turnK - (p.inbound ? FLIGHT_RUN.dive : 0);
        put(v, { x: p.x, z: p.z, y: m.from.y + (y - m.from.y) * e, heading: angLerp(m.from.heading, p.heading, e), bank: m.from.bank + (p.bank - m.from.bank) * e });
        poses.set(v.id, { x: v.x, y: v.y, z: v.z, heading: v.heading, bank: v.bank, inbound: p.inbound && e > 0.99 && T != null });
      }
      for (const id of [...mem.keys()]) if (!live.has(id)) mem.delete(id);
      for (const id of [...drawn.keys()]) if (!live.has(id)) drawn.delete(id);
      return poses;
    },
    clear() { poses.clear(); mem.clear(); drawn.clear(); },
  };
}
