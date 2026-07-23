/**
 * src/sim/mines.js — MINE DRONE (Land-Mine-Design rev 2, epics M1-M3).
 *
 * The 'STR-Mine' purchase (the old Moat build slot) launches a deploy DRONE from
 * the base; it flies straight to the target cell (drones fly — terrain never gates
 * the route), buries itself, and becomes an ARMED mine (red flashing dot). The
 * first enemy GROUND unit within the trigger radius detonates it: one burst —
 * sized to eliminate any tank in the roster — through the real applyDamage to
 * every ground attacker inside the (small) blast radius. Single use. Air units
 * never trigger mines and never take mine damage.
 *
 * Mines are NOT structures: they live in state.mines, so they never block the
 * nav grid, never occupy build cells beyond placement, and can't be targeted.
 * Deterministic — no randomness; trigger scan runs in ascending entity-id order
 * (Map insertion order), the same convention as acquireTarget.
 */

import { getStructureDef } from '../data/tables.js';
import { applyDamage } from './combat.js';
import { spend } from './economy.js';
import { nextEntityId } from './entities.js';
import { emitEvent } from './core.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Live mines (flying couriers + armed dots) — the cap counts both. */
export function liveMineCount(state) {
  let n = 0;
  if (state.mines) for (const m of state.mines.values()) if (m.state === 'flying' || m.state === 'armed') n++;
  return n;
}

/**
 * Deploy: spend gold, launch the courier. Validation (terrain/occupancy/cost/cap)
 * has already passed via validatePlacement's 'mine' branch — this re-checks only
 * what can race (cap, gold) so a stale command can't overshoot.
 */
export function deployMine(state, structId, cell) {
  const def = getStructureDef(structId);
  if (!state.mines) state.mines = new Map();
  if (liveMineCount(state) >= (def.cap || 8)) return { ok: false, reason: 'max mines (' + (def.cap || 8) + ')' };
  if (!spend(state, def.cost[0], 'build:' + structId)) return { ok: false, reason: 'cost' };
  const base = state.base ? state.base.pos : { x: 0, y: 0 };
  const m = {
    id: nextEntityId(state),
    structId: structId,
    state: 'flying',                                  // 'flying' -> 'armed' -> (detonated: removed)
    pos: { x: base.x, y: base.y },
    target: { x: cell.x, y: cell.y },
    speed: def.droneSpeed || 6,
  };
  state.mines.set(m.id, m);
  emitEvent(state, { type: 'mineDeploy', tick: state.tick, mineId: m.id, from: { x: base.x, y: base.y }, to: { x: cell.x, y: cell.y } });
  return { ok: true, reason: '' };
}

/**
 * One mine tick: advance couriers, arm on arrival, detonate armed mines on
 * ground contact. Kills are left at hp 0 for core's death cleanup (standard
 * 'kill' event + bounty income on the same tick — stepMines runs before it).
 */
export function stepMines(state, dt) {
  if (!state.mines || !state.mines.size) return;
  const spent = [];
  for (const m of state.mines.values()) {
    if (m.state === 'flying') {
      const dx = m.target.x - m.pos.x, dy = m.target.y - m.pos.y;
      const d = Math.hypot(dx, dy);
      const step = m.speed * dt;
      if (d <= step || d < 1e-6) {
        m.pos.x = m.target.x; m.pos.y = m.target.y;
        m.state = 'armed';
        emitEvent(state, { type: 'mineArmed', tick: state.tick, mineId: m.id, pos: { x: m.pos.x, y: m.pos.y } });
      } else {
        m.pos.x += (dx / d) * step;
        m.pos.y += (dy / d) * step;
      }
      continue;
    }
    // armed: first ground attacker in the trigger radius sets it off (asc id = map order)
    let def;
    try { def = getStructureDef(m.structId); } catch (e) { spent.push(m.id); continue; }
    let tripped = false;
    for (const u of state.units.values()) {
      if (u.side !== 'attacker' || u.hp <= 0 || u.domain === 'Flyer') continue;   // air immune (design rule)
      if (dist(u.pos, m.pos) > (def.triggerRadius || 0.45)) continue;
      tripped = true;
      break;
    }
    if (!tripped) continue;
    // BOOM: one burst (dps[0] raw, dt=1) through the real effectiveness matrix to every
    // ground attacker inside the blast radius — then the mine is spent (single use).
    for (const u of state.units.values()) {
      if (u.side !== 'attacker' || u.hp <= 0 || u.domain === 'Flyer') continue;
      if (dist(u.pos, m.pos) > (def.blastRadius || 0.5)) continue;
      applyDamage(state, null, u, def.dps[0], def.damageType, 1);
    }
    emitEvent(state, { type: 'mineExplode', tick: state.tick, mineId: m.id, pos: { x: m.pos.x, y: m.pos.y }, radius: def.blastRadius || 0.5 });
    spent.push(m.id);
  }
  for (let i = 0; i < spent.length; i++) state.mines.delete(spent[i]);
}
