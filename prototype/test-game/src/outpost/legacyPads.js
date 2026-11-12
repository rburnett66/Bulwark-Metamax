/**
 * src/outpost/legacyPads.js — the fixed build pads the outpost maps used to carry, kept ONLY to read old saves
 * (One Battle UX S2c.2 [MM-story_mwc9pmbn_2i], TECH_PLAN::One-Battle-UX.md §5.3–5.4).
 *
 * Before S2c.2 a building in a save was keyed by the map pad it stood on (o.pads.p1, a job's `pad: 'r1'`) and its
 * position was that pad's rectangle. The maps no longer author pads: every building now carries its own `at`
 * rectangle (model.buildingRect). A save written before then still names pads, so this table answers "where was pad
 * <id>" for it — nothing places on these, and no map reads them. Every Forge outpost map had the same pads (ground,
 * air, arcane, artillery, dark, greenies, hightech, space, water — all 64 × 32 with the hub at 30,14); a planet with no
 * Forge map ran on the draft layout's (outpost/draftLayout.js before S2c.2).
 *
 * siting.js migrateOutpostLayout turns a legacy save's pad buildings into free buildings at exactly these rectangles
 * (no surprise moves), then moves only what now breaks the hub clearance or the build spacing.
 */
const pad = (id, x, y, w, h) => Object.freeze({ id, x, y, w, h });

/** The pads of every Forge outpost map (content/maps/forge/*-outpost.json up to v2026.11.11-t). */
export const FORGE_PADS = Object.freeze([
  pad('hub', 30, 14, 3, 3), pad('p1', 34, 13, 2, 2), pad('r1', 30, 18, 2, 2), pad('s1', 34, 16, 2, 2),
  pad('r2', 37, 13, 2, 2), pad('b1', 29, 11, 2, 2), pad('b2', 32, 11, 2, 2), pad('x1', 35, 10, 2, 2),
  pad('r3', 16, 18, 2, 2), pad('p2', 16, 12, 2, 2),
]);
/** The draft layout's pads (outpost/draftLayout.js up to v2026.11.11-t). */
export const DRAFT_PADS = Object.freeze([
  pad('hub', 16, 9, 6, 6), pad('p1', 22, 9, 4, 4), pad('r1', 15, 16, 4, 4), pad('s1', 22, 15, 4, 4),
  pad('r2', 27, 4, 4, 4), pad('b1', 17, 3, 4, 4), pad('b2', 22, 3, 4, 4), pad('x1', 28, 12, 4, 4),
  pad('r3', 1, 14, 4, 4), pad('p2', 4, 18, 4, 4),
]);

/** The legacy pad table for an outpost map: the draft layout's for a draft map, else the Forge maps'. */
export const legacyPadsFor = (map) => (map && map.source === 'draft' ? DRAFT_PADS : FORGE_PADS);
/** Where legacy pad `id` was on `map`'s outpost: { id, x, y, w, h }, or null (not a legacy pad id). */
export function legacyPadRect(map, id) {
  const p = legacyPadsFor(map).find((q) => q.id === id);
  return p ? { id: p.id, x: p.x, y: p.y, w: p.w, h: p.h } : null;
}
