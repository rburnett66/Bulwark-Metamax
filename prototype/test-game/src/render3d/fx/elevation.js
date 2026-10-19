/**
 * src/render3d/fx/elevation.js — the launch angle of a shot, so barrels tilt to the trajectory they fire.
 * [MM-story_mvedxq1v_5] — docs/tech-plan/3D-Combat-Polish.md §3.1.
 *
 * Owner 2026-10-18: "barrel that can go up and down based on fire trajectory". ONE function gives both the flight path
 * (combatFxModel.js) and the barrel pitch (system towers, units, the base cannon), so they can never disagree:
 *   · straight shots (tank guns, flak, tracers): pitch = atan2(dy, horizontal distance) — small; down on high ground,
 *     up at aircraft;
 *   · lobbed shots (cannon tower shells, rockets, the base super-cannon): y = lerp(fy, ty, u) + apex·4u(1−u), so the
 *     launch slope is (dy + 4·apex) / horizontal distance — far targets get a high lob, near ones a flat one.
 * Pure; no three.js.
 */

/** Apex height (world units) of a lobbed shot over horizontal distance d, per kind. Straight kinds: 0. */
// apex = base + perCell·d + perCell2·d². The cannon's is QUADRATIC so its launch slope (dy + 4·apex)/d GROWS with range:
// nearly flat at 1–2 cells, ~30° at its 4.5-cell reach — the barrel visibly rises for far targets. (A linear apex
// with a constant term would do the opposite: the slope 4·base/d falls with range.)
export const LOB = Object.freeze({
  shell: Object.freeze({ base: 0, perCell: 0, perCell2: 0.035 }),     // the cannon tower: under the base cannon's lob
  // rocket salvos: apex ≈ a fifth of the distance, so the launch slope stays ~40–45° at every range and the rack never
  // stands near-vertical (a vertical rack turning about its own axis reads as not rotating) [MM-task_mvejw9k0_m]
  rocket: Object.freeze({ base: 0.25, perCell: 0.2, perCell2: 0 }),
});

export function apexFor(kind, d) {
  const l = LOB[kind];
  if (!l) return 0;
  const x = Math.max(0, d);
  return l.base + l.perCell * x + l.perCell2 * x * x;
}

/** Launch pitch (radians, + = up) from `from` to `to` ({x,y,z}) for a flight with apex `apex` (0 = straight). */
export function pitchFor(from, to, apex = 0) {
  const h = Math.hypot(to.x - from.x, to.z - from.z);
  const dy = to.y - from.y;
  if (h < 1e-6) return dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
  return Math.atan2(dy + 4 * apex, h);
}

/** Position on a lobbed flight at fraction u (0..1). */
export function lobPoint(from, to, apex, u) {
  return {
    x: from.x + (to.x - from.x) * u,
    y: from.y + (to.y - from.y) * u + apex * 4 * u * (1 - u),
    z: from.z + (to.z - from.z) * u,
  };
}
