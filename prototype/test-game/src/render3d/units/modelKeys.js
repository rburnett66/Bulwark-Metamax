/**
 * src/render3d/units/modelKeys.js — which 3D model draws which sim unit (plan v2.2.1 §6.3). DATA.
 *
 * The roster is 9 factions × 8 classes plus system units; eight models exist (tank, buggy, beetle, jet, tiger, copter, drone, miner). The
 * mapping keys on the unit's `artClass` (tables.js) and says, per class, which model stands in, at what scale,
 * and whether that is the class's OWN model (`exact`) or a stand-in (`exact: false`). Stand-ins are visible
 * placeholders until the Stack Forge model pipeline (UMP, [MM-story_mv87jypv_8]) authors the rest — they are
 * listed by modelKeys.test.mjs, never silent, and nothing is ever drawn as nothing.
 *
 * Pure: no three.js. [MM-story_mv77hv5d_7]
 */

export const MODEL_KEYS = Object.freeze(['tank', 'buggy', 'beetle', 'jet', 'tiger', 'copter', 'drone', 'miner']);

/** artClass → { model, scale, exact }. scale multiplies UNIT_SCALE (1 = a hull ≈ 1.08 cells). */
export const ART_CLASS_MODELS = Object.freeze({
  tank:        { model: 'tank',   scale: 1.0,  exact: true },
  plane:       { model: 'jet',    scale: 1.0,  exact: true },
  heavyTank:   { model: 'tiger',  scale: 1.0,  exact: true },   // King Tiger [MM-story_mvbqugeo_l]
  artillery:   { model: 'tank',   scale: 0.95, exact: false },
  truck:       { model: 'buggy',  scale: 1.0,  exact: false },
  infantry:    { model: 'beetle', scale: 0.55, exact: false },
  copter:      { model: 'copter', scale: 0.85, exact: true },    // RAH-66X attack copter [MM-story_mvehe3sy_j]
  missile:     { model: 'drone',  scale: 0.55, exact: true },    // MX-4 recon drone (the Missiles class) [MM-story_mvehe3sy_j]
  heavyBomber: { model: 'jet',    scale: 1.4,  exact: false },
});

/** Units the sim spawns that are not combat classes (artKey/unitId → entry). */
export const UNIT_ID_MODELS = Object.freeze({
  'SYS-Harvester': { model: 'miner', scale: 0.95, exact: true },   // the System resource miner (was the buggy stand-in) [MM-story_mvg3xsca_1x]
});

/** The id a live sim unit resolves its model by: its artKey when that names a model here (harvesters are spawned as
 *  GND-Trucks with artKey SYS-Harvester), else its unitId. [MM-story_mvg3xsca_1x] */
export const modelIdOf = (u) => (u && u.artKey && UNIT_ID_MODELS[u.artKey] ? u.artKey : u && u.unitId);

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
