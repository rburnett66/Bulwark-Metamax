/**
 * src/render3d/obstructions/heightField.js — how tall the world is under each cell, so aircraft fly OVER it.
 * [MM-story_mvegnpxf_i] — docs/tech-plan/3D-Combat-Polish.md §8.
 *
 * Owner 2026-10-18: "check plane elevation against the height of the plateaus, rocks, trees". Measured on Powder map 1:
 * flyers were drawn at HOVER_HEIGHT 1.1 (attack runs dipped to 0.92) while stacked plateau rocks reach 2.37 and trees
 * 2.11, so aircraft flew through them. This module bins the built obstruction geometry into a per-cell top height
 * (world units, 1 cell = 1 unit), and airClearance() gives the lowest safe flying height over a point: the tallest top
 * in the 3×3 cells around it plus AIR_CLEARANCE.
 *
 * Pure apart from reading geometry arrays; no clocks, no randomness.
 */
export const AIR_CLEARANCE = 0.45;   // world units above the tallest obstruction nearby

/** meshes: objects with geometry.attributes.position (world-space vertices). → { cols, rows, top: Float32Array, max } */
export function buildHeightField(meshes, cols, rows) {
  const top = new Float32Array(Math.max(1, cols * rows));
  let max = 0;
  for (const m of meshes) {
    const a = m && m.geometry && m.geometry.attributes && m.geometry.attributes.position && m.geometry.attributes.position.array;
    if (!a) continue;
    for (let i = 0; i < a.length; i += 3) {
      const cx = Math.floor(a[i]), cz = Math.floor(a[i + 2]), y = a[i + 1];
      if (cx < 0 || cz < 0 || cx >= cols || cz >= rows) continue;
      const k = cz * cols + cx;
      if (y > top[k]) { top[k] = y; if (y > max) max = y; }
    }
  }
  return { cols, rows, top, max };
}

/** The lowest safe flying height over world point (x, z): the tallest top in the 3×3 cells around it + clearance. */
export function airClearance(field, x, z, clear = AIR_CLEARANCE) {
  if (!field) return 0;
  const cx = Math.floor(x), cz = Math.floor(z);
  let h = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const ix = cx + dx, iz = cz + dz;
    if (ix < 0 || iz < 0 || ix >= field.cols || iz >= field.rows) continue;
    const t = field.top[iz * field.cols + ix];
    if (t > h) h = t;
  }
  return h > 0 ? h + clear : 0;
}

/**
 * MINIMUM FLIGHT LEVEL [MM-task_mvesj7tg_b] — owner 2026-10-18: "The planes are still flying too low .. the fly through
 * things .. there needs to be a minimum flight level". The per-cell clearance above only sees obstruction VERTICES, so
 * the middle of a big plateau reads as empty ground, and it knows nothing of the base craft or the towers. The floor
 * is one height for the whole map: the tallest obstruction, the base craft and any extra tops, plus FLIGHT_FLOOR.margin,
 * never below FLIGHT_FLOOR.min. No flyer — cruising, hovering or on an attack run — is drawn below it.
 */
export const FLIGHT_FLOOR = Object.freeze({ min: 1.6, margin: 0.55, max: 4.5 });
export function flightFloor(field, extraTops = [], F = FLIGHT_FLOOR) {
  let top = field && field.max > 0 ? field.max : 0;
  for (const t of extraTops) if (t > top) top = t;
  return Math.min(F.max, Math.max(F.min, top > 0 ? top + F.margin : F.min));
}

/** Aim height of a drawn ground unit (= combatFxModel AIM.ground). */
export const GROUND_AIM_Y = 0.3;
export const AIR_LIFT = Object.freeze({ up: 2.4, down: 0.9 });   // world units / s the drawn altitude may climb / sink

/**
 * createAirLift() → { drawn, update(state, views, field, poses, dt), clear() }
 * Every flyer's drawn height becomes max(its cruise height, airClearance) — eased (climbs faster than it sinks) so
 * it rises over a ridge and settles after. `drawn` (Map id → { x, y, z, strafe, inbound }) is where each flyer is
 * DRAWN: aim, turrets and shot origins read it. `poses` = the attack-run poses (units/flightPath.js).
 */
export function createAirLift() {
  const drawn = new Map();
  const ys = new Map();   // id → eased drawn height
  return {
    drawn,
    update(state, views, field, poses, dt, floor = 0) {   // floor: the map's minimum flight level (flightFloor)
      const step = Math.max(0, Math.min(0.1, dt || 0));
      drawn.clear();
      if (!state || !state.units || !views) return drawn;
      const live = new Set();
      for (const v of views) {
        const u = state.units.get(v.id);
        if (!u) continue;
        if (!(u.altitude > 0 || u.domain === 'Flyer')) {   // a ground unit: where it is DRAWN (it drives — heading.js), so aim + shots track it [MM-story_mvekcu8r_n]
          drawn.set(v.id, { x: v.x, y: GROUND_AIM_Y, z: v.z, strafe: false, inbound: false, ground: true });
          continue;
        }
        live.add(v.id);
        const want = Math.max(v.y || 0, floor, airClearance(field, v.x, v.z));
        let y = ys.has(v.id) ? ys.get(v.id) : want;
        y += Math.max(-AIR_LIFT.down * step, Math.min(AIR_LIFT.up * step, want - y));
        // never below the obstruction even mid-ease: a ridge the plane is already over wins outright
        y = Math.max(y, floor, airClearance(field, v.x, v.z));   // never below the floor, even mid-ease
        ys.set(v.id, y);
        v.y = y;
        const p = poses && poses.get(v.id);
        if (p) p.y = y;
        drawn.set(v.id, { x: v.x, y, z: v.z, strafe: !!p, inbound: p ? p.inbound : false });
      }
      for (const id of [...ys.keys()]) if (!live.has(id)) ys.delete(id);
      return drawn;
    },
    clear() { drawn.clear(); ys.clear(); },
  };
}
