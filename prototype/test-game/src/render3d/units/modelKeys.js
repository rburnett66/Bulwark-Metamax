/**
 * src/render3d/units/modelKeys.js — which 3D model draws which sim unit (plan v2.2.1 §6.3). DATA.
 *
 * The roster is 9 factions × 8 classes plus system units; five models exist (tank, buggy, beetle, jet, tiger). The
 * mapping keys on the unit's `artClass` (tables.js) and says, per class, which model stands in, at what scale,
 * and whether that is the class's OWN model (`exact`) or a stand-in (`exact: false`). Stand-ins are visible
 * placeholders until the Stack Forge model pipeline (UMP, [MM-story_mv87jypv_8]) authors the rest — they are
 * listed by modelKeys.test.mjs, never silent, and nothing is ever drawn as nothing.
 *
 * Pure: no three.js. [MM-story_mv77hv5d_7]
 */

export const MODEL_KEYS = Object.freeze(['tank', 'buggy', 'beetle', 'jet', 'tiger']);

/** artClass → { model, scale, exact }. scale multiplies UNIT_SCALE (1 = a hull ≈ 1.08 cells). */
export const ART_CLASS_MODELS = Object.freeze({
  tank:        { model: 'tank',   scale: 1.0,  exact: true },
  plane:       { model: 'jet',    scale: 1.0,  exact: true },
  heavyTank:   { model: 'tiger',  scale: 1.0,  exact: true },   // King Tiger [MM-story_mvbqugeo_l]
  artillery:   { model: 'tank',   scale: 0.95, exact: false },
  truck:       { model: 'buggy',  scale: 1.0,  exact: false },
  infantry:    { model: 'beetle', scale: 0.55, exact: false },
  copter:      { model: 'jet',    scale: 0.8,  exact: false },
  missile:     { model: 'jet',    scale: 0.6,  exact: false },
  heavyBomber: { model: 'jet',    scale: 1.4,  exact: false },
});

/** Units the sim spawns that are not combat classes (artKey/unitId → entry). */
export const UNIT_ID_MODELS = Object.freeze({
  'SYS-Harvester': { model: 'buggy', scale: 0.9, exact: false },
});

/** World scale for 4 model units of hull → ≈ 1.08 cells (code design §4.11). */
export const UNIT_SCALE = 0.27;

/**
 * Resolve the model for a unit definition. Returns { model, scale, exact, via } — `via` says which rule
 * matched ('unitId' | 'artClass' | 'domain'), so a test can list everything that fell through to the
 * domain default. Never returns null for a unit: an unknown class still gets a visible model.
 */
export function resolveUnitModel(unitId, def) {
  if (UNIT_ID_MODELS[unitId]) return { ...UNIT_ID_MODELS[unitId], via: 'unitId' };
  const ac = def && def.artClass;
  if (ac && ART_CLASS_MODELS[ac]) return { ...ART_CLASS_MODELS[ac], via: 'artClass' };
  const flyer = def && def.domain === 'Flyer';
  return { model: flyer ? 'jet' : 'tank', scale: 1, exact: false, via: 'domain' };
}
