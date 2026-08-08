/**
 * src/render/unitFx.js — what a unit's COMBAT FX look like, read off the unit def.
 *
 * DDD-9. Three render sites used to answer this by matching the DISPLAY string `def.shape` against
 * hardcoded name sets:
 *
 *   renderer.js  RANGED_SHAPES = {Tanks, Heavy Tanks, Artillery, Planes, Copters, Missiles}
 *                gated whether a unit DREW SHOTS AT ALL — rename a shape and 9 units go silent,
 *                with no error and nothing in the sim to notice
 *   renderer.js  shape === 'Tanks' || 'Heavy Tanks' || 'Artillery'   (shell vs tracer)
 *   renderer.js  the same triple again, for wreck flames
 *   gallery.js   a fourth copy of the shell/tracer triple, so the tool could disagree with the game
 *
 * The unit def now declares both properties outright (`projectileFx`, `burnsWhenDamaged` — see the
 * capability block in data/tables.js). These two readers are the ONLY place either is interpreted, so
 * the gallery and the battle map cannot drift apart again, and both are pure so they are testable
 * without PIXI or a DOM.
 */

/** The three projectile looks the renderer knows how to draw. */
export const SHOT_KINDS = Object.freeze(['shell', 'tracer', 'flak']);

/**
 * What this unit's weapon draws in flight, or null for a weapon that draws nothing (infantry small
 * arms, trucks, the heavy bomber's payload).
 *
 * This is a property of the WEAPON. It replaced two gates at once: the RANGED_SHAPES membership test
 * and a `range > 1.6` floor standing in for "too short-ranged to bother drawing". The floor is gone —
 * every unit that drew shots has range >= 2.85, so no unit's behaviour moves, and one explicit field
 * now decides rather than a name set and a magic number that could contradict each other.
 *
 * @param {object} def unit def from tables.UNITS
 * @returns {'shell'|'tracer'|'flak'|null}
 */
export function shotFxFor(def) {
  const k = def && def.projectileFx;
  return (typeof k === 'string' && SHOT_KINDS.indexOf(k) !== -1) ? k : null;
}

/** Does this unit draw shots at all? */
export function drawsProjectiles(def) {
  return shotFxFor(def) !== null;
}

/**
 * Does a damaged unit of this type burn (flames + smoke below half hp)?
 *
 * A CHASSIS property, kept separate from shotFxFor on purpose even though today's roster happens to
 * agree with it: armour burns, a weapon fires, and one is not the other. Flyers throw sparks instead
 * — that branch is keyed on `domain`, which is typed movement data, not a display name.
 *
 * @param {object} def unit def from tables.UNITS
 * @returns {boolean}
 */
export function showsWreckFire(def) {
  return !!(def && def.burnsWhenDamaged === true);
}

// Expose on the global namespace for the no-bundler build.
if (typeof window !== 'undefined') {
  window.Bulwark = window.Bulwark || {};
  window.Bulwark.render = window.Bulwark.render || {};
  window.Bulwark.render.unitFx = { SHOT_KINDS, shotFxFor, drawsProjectiles, showsWreckFire };
}
