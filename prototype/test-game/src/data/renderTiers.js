/**
 * src/data/renderTiers.js — the Voxel Rendering Tiers contract (pure, no PIXI, Node-testable).
 * Spec: docs/Bulwark-Voxel-Rendering-Tiers.md.
 *
 * Tier A = baked + batched (the default). Tier B = baked + screen-space sprite tilt (stays in the
 * batch). Tier C = live 3D voxel model — one draw call per instance, so it must NEVER scale with
 * unit count. MAX_LIVE_3D is the hard ceiling that keeps that true; spawn logic clamps/queues on it
 * and data validation fails any Tier C type whose wave data could exceed it.
 */

export const MAX_LIVE_3D = 4;                 // spec §5 — hard on-screen cap for Tier C instances
export const RENDER_TIERS = new Set(['A', 'B', 'C']);

/** A unit type's tier; missing/invalid values are NOT defaulted here — validation flags them. */
export function tierOf(unitDef) {
  return unitDef ? unitDef.render_tier : undefined;
}

/**
 * Worst-case simultaneous count of a unit type implied by the wave data: within one wave every
 * spawn entry of that type can be alive at once (kill rate is not guaranteed), so the bound is the
 * per-wave sum of counts, maximised over waves. Conservative by design.
 */
export function maxSimultaneous(unitId, waves) {
  let worst = 0;
  for (const w of waves || []) {
    let inWave = 0;
    for (const s of w.spawns || []) if (s.unitId === unitId) inWave += (s.count | 0);
    if (inWave > worst) worst = inWave;
  }
  return worst;
}

/**
 * Validate the tier contract over the unit table + every wave set supplied (spec §5, §7):
 *  - every unit type carries an explicit render_tier in {A, B, C};
 *  - no Tier C type's worst-case simultaneous count exceeds MAX_LIVE_3D in ANY wave set.
 * `waveSets` is an array of wave arrays (main WAVES plus each single-faction set).
 * Returns { ok, errors }. Callers decide whether to throw (CI) or demote-and-log (runtime).
 */
export function validateRenderTiers(units, waveSets) {
  const errors = [];
  for (const id in units) {
    const tier = tierOf(units[id]);
    if (!RENDER_TIERS.has(tier)) {
      errors.push(`unit "${id}" has no explicit render_tier (A|B|C) — got ${JSON.stringify(tier)}`);
      continue;
    }
    if (tier !== 'C') continue;
    for (const waves of waveSets || []) {
      const worst = maxSimultaneous(id, waves);
      if (worst > MAX_LIVE_3D) {
        errors.push(`Tier C unit "${id}" can reach ${worst} simultaneous instances in wave data — cap is MAX_LIVE_3D=${MAX_LIVE_3D}. ` +
          'Demote it to Tier B or reduce its spawn counts.');
        break;
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
