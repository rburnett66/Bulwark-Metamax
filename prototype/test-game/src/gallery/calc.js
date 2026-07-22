/**
 * src/gallery/calc.js — SHOOTING GALLERY ballistics, computed on the REAL combat path.
 *
 * Read-only sandbox: every number comes from running the shipping code
 * (combat.applyDamage / canHitDomain, the entities.js factories, tables.js data)
 * against throwaway dummies. Nothing here writes back to tables.js — retunes
 * leave as a paste-able diff (retuneDiff) applied by hand as a deliberate step.
 *
 * Headless-safe (no DOM, no Pixi): calc.test.mjs runs this under node --test.
 */

import { UNITS, STRUCTURES, DAMAGE_TYPES, ASSUMPTIONS } from '../data/tables.js';
import { applyDamage, canHitDomain } from '../sim/combat.js';
import { createUnit, createStructure } from '../sim/entities.js';
import { FIXED_DT } from '../sim/core.js';

/** Minimal SimState — just what applyDamage/emitEvent touch on a dummy. */
export function makeState() {
  return { tick: 0, events: [], units: new Map(), structures: new Map() };
}

const clampTier = (tier) => Math.min(3, Math.max(1, tier | 0));

/* -------------------------------------------------------------------------- */
/*  Targets — built by the real entity factories where one exists             */
/* -------------------------------------------------------------------------- */

/** Target dummy from the REAL unit factory (table hp/armor/domain at tier). */
export function makeUnitTarget(unitId, tier) {
  return createUnit(makeState(), unitId, clampTier(tier), { x: 0, y: 0 }, 'ground', 'attacker');
}

/** Target dummy from the REAL structure factory, completed + tiered up. */
export function makeStructureTarget(structId, tier) {
  const s = createStructure(makeState(), structId, { x: 0, y: 0 });
  const t = clampTier(tier);
  const def = STRUCTURES[structId];
  s.tier = t;
  s.hp = def.hp[t - 1];
  s.maxHp = s.hp;
  s.lifecycle = 'Complete';
  return s;
}

/** Bare armor-class dummy — "what does this damage type do to Machinery?". */
export function makeArmorTarget(armorClass, hp = 300, domain = 'Walker') {
  return { id: 9001, unitId: 'DUMMY', hp, maxHp: hp, armorClass, domain, pos: { x: 0, y: 0 } };
}

/* -------------------------------------------------------------------------- */
/*  Shooters — a unit row or a tower row normalised to one weapon record      */
/* -------------------------------------------------------------------------- */

/** Weapon record for a unit at tier; `edits` overlays live-tuned fields. */
export function unitShooter(unitId, tier, edits = {}) {
  const def = UNITS[unitId];
  const t = clampTier(tier);
  return Object.assign({
    unitId, tier: t, shape: def.shape, range: def.range,
    dps: def.dps[t - 1], damageType: def.damageType,
    aoeRadius: def.aoeRadius || 0, canTarget: def.canTarget,
  }, edits);
}

/** Weapon record for a tower at tier (canTargetDomains → canTarget category). */
export function towerShooter(structId, tier, edits = {}) {
  const def = STRUCTURES[structId];
  const t = clampTier(tier);
  const doms = def.canTargetDomains || [];
  const ground = doms.some((d) => d === 'Walker' || d === 'Floater' || d === 'Ground' || d === 'Both');
  const air = doms.some((d) => d === 'Flyer' || d === 'Air' || d === 'Both');
  return Object.assign({
    structId, tier: t, shape: def.kind, range: def.range,
    dps: def.dps[t - 1], damageType: def.damageType,
    aoeRadius: 0, canTarget: (ground && air) ? 'Both' : (air ? 'Air' : 'Ground'),
  }, edits);
}

/* -------------------------------------------------------------------------- */
/*  Legality + measurement                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Can this weapon legally hit this target? Units use the weapon-domain rule
 * (combat.canHitDomain). Structures/base have no domain — any ground-capable
 * weapon reaches them, an anti-air-only weapon never does (flak vs a wall).
 */
export function legalHit(shooter, target) {
  if (target.structId !== undefined || target.domain === undefined) {
    return shooter.canTarget !== 'Air';
  }
  return canHitDomain(shooter.canTarget, target.domain);
}

/**
 * Fire the real applyDamage at the target: one probe tick for the effectiveness
 * multiplier + effective DPS, then a full FIXED_DT loop for time-to-kill.
 * Returns { legal, mult, effDps, ttk, status } — ttk is Infinity when the
 * target can never die (multiplier 0, e.g. Poison vs Structure) or the hit is
 * domain-illegal.
 */
export function measure(shooter, target, maxSeconds = 600) {
  const status = (DAMAGE_TYPES[shooter.damageType] || {}).status || null;
  const legal = legalHit(shooter, target);
  if (!legal || !shooter.dps || shooter.dps <= 0) {
    return { legal, mult: 0, effDps: 0, ttk: Infinity, status };
  }
  const state = makeState();
  // Probe on a clone so the TTK loop below starts from full HP.
  const probe = { ...target, pos: { ...target.pos } };
  const r = applyDamage(state, null, probe, shooter.dps, shooter.damageType, FIXED_DT);
  const mult = r.dealt / (shooter.dps * FIXED_DT);
  const victim = { ...target, pos: { ...target.pos } };
  const maxTicks = Math.ceil(maxSeconds / FIXED_DT);
  let ticks = 0;
  while (victim.hp > 0 && ticks < maxTicks) {
    applyDamage(state, null, victim, shooter.dps, shooter.damageType, FIXED_DT);
    ticks++;
  }
  return { legal, mult, effDps: shooter.dps * mult, ttk: victim.hp <= 0 ? ticks * FIXED_DT : Infinity, status };
}

/**
 * Splash coverage: how many packed neighbours a hit also damages. Same-type
 * dummies stand on a hex-ish grid at `spacing` tiles around the primary; the
 * count uses the identical radius + domain rule as stepCombat's splash loop.
 */
export function splashHits(shooter, target, spacing = 0.8) {
  const R = shooter.aoeRadius || 0;
  if (R <= 0 || spacing <= 0) return 0;
  const domain = target.domain || 'Walker';
  if (!canHitDomain(shooter.canTarget, domain)) return 0;
  const r2 = R * R;
  let count = 0;
  for (let gy = -8; gy <= 8; gy++) {
    for (let gx = -8; gx <= 8; gx++) {
      if (gx === 0 && gy === 0) continue; // the primary target itself
      const x = (gx + (gy % 2 ? 0.5 : 0)) * spacing;
      const y = gy * spacing * 0.866;
      if (x * x + y * y <= r2) count++;
    }
  }
  return count;
}

/* -------------------------------------------------------------------------- */
/*  Retune diff — the ONLY output channel for balance edits                   */
/* -------------------------------------------------------------------------- */

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Paste-able tables.js fragment for the edited fields. A dps edit takes the
 * tuned T1 value and re-derives T2/T3 with the workbook upgrade multipliers.
 * Returns '' when nothing differs from the table baseline.
 */
export function retuneDiff(unitId, edits = {}) {
  const def = UNITS[unitId];
  if (!def) return '';
  const lines = [];
  if (edits.dps !== undefined && edits.dps !== def.dps[0]) {
    const t2 = round3(edits.dps * ASSUMPTIONS.upgradeDpsX.t2);
    const t3 = round3(edits.dps * ASSUMPTIONS.upgradeDpsX.t3);
    lines.push(`    dps: [${edits.dps}, ${t2}, ${t3}],   // was [${def.dps.join(', ')}]`);
  }
  if (edits.damageType !== undefined && edits.damageType !== def.damageType) {
    lines.push(`    damageType: '${edits.damageType}',   // was '${def.damageType}'`);
  }
  if (edits.aoeRadius !== undefined && edits.aoeRadius !== (def.aoeRadius || 0)) {
    lines.push(`    aoeRadius: ${edits.aoeRadius},   // was ${def.aoeRadius || 0}`);
  }
  if (!lines.length) return '';
  return `  '${unitId}': {   // SHOOTING GALLERY retune — merge into UNITS['${unitId}']\n${lines.join('\n')}\n  }`;
}
