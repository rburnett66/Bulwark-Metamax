/**
 * prototype/test-game/src/harness/readout.js  [state-harness sh-m1.s1]
 *
 * Deterministic, inspectable per-unit STATE READOUTS — the observable surface the render draws and the
 * verification SCENARIOS assert against. This is the "reach-to-surface" gate for the State Harness:
 *   base  <- health     (hp / maxHp)
 *   weapon<- aim         (angle toward the acquired target)
 *   head  <- awareness   (is it locked on a target)
 * Pure state, no rendering — derived only from the deterministic sim (hp, targetId, pos) so a scenario's
 * readout trace is reproducible and can be asserted headlessly.
 */

const BASE_TID = -1;   // BASE_TARGET_ID sentinel (sim/combat.js)

function targetPos(state, unit) {
  const tid = unit && unit.targetId;
  if (tid == null) return null;
  if (tid === BASE_TID) return (state.base && state.base.pos) ? { x: state.base.pos.x, y: state.base.pos.y } : null;
  const ent = (state.units && state.units.get(tid)) || (state.structures && state.structures.get(tid));
  return (ent && ent.pos) ? { x: ent.pos.x, y: ent.pos.y } : null;
}

/**
 * The full state readout for one unit at the current sim tick.
 *  - health:    0..1          (BASE layer)   — hp / maxHp
 *  - hasTarget: bool                          — is it tracking a target
 *  - awareness: 0..1          (HEAD layer)    — 0 scanning, 1 locked on a target
 *  - aimAngle:  radians|null  (WEAPON layer)  — angle toward the acquired target (null if none)
 */
export function unitReadout(state, unit) {
  if (!unit) return { health: 0, hasTarget: false, awareness: 0, aimAngle: null };
  const health = unit.maxHp > 0 ? Math.max(0, Math.min(1, unit.hp / unit.maxHp)) : 0;
  const tp = targetPos(state, unit);
  const hasTarget = !!tp;
  const aimAngle = hasTarget ? Math.atan2(tp.y - unit.pos.y, tp.x - unit.pos.x) : null;
  return { health, hasTarget, awareness: hasTarget ? 1 : 0, aimAngle };
}
