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

export const MODEL_KEYS = Object.freeze(['tank', 'buggy', 'beetle', 'jet', 'tiger', 'copter', 'drone', 'miner',
  // the AIR faction's own models (air/*.js) [MM-story_mvh8woji_1]
  'air_troops', 'air_scout', 'air_tank', 'air_artillery', 'air_heavy', 'air_gunship', 'air_fighter', 'air_missile', 'air_bomber',
  // the ARTILLERY (Siege) faction's own models (siege/*.js) [MM-story_mvhb6qd2_2]
  'siege_troops', 'siege_scout', 'siege_tank', 'siege_artillery', 'siege_heavy', 'siege_gunship', 'siege_fighter', 'siege_missile',
  // the ARCANE / ENERGY faction's own models (arcane/*.js) [MM-story_mvhnbx8n_4]
  'arcane_troops', 'arcane_scout', 'arcane_tank', 'arcane_artillery', 'arcane_heavy', 'arcane_gunship', 'arcane_fighter', 'arcane_missile',
  // the SPACE TECH faction's own models (space/*.js) [MM-story_mvho2d6s_5]
  'space_troops', 'space_scout', 'space_tank', 'space_artillery', 'space_heavy', 'space_gunship', 'space_fighter', 'space_missile',
  // the DARK ENERGY faction's own models (dark/*.js) [MM-story_mvifm4xj_1]
  'dark_troops', 'dark_scout', 'dark_tank', 'dark_artillery', 'dark_heavy', 'dark_gunship', 'dark_fighter', 'dark_missile']);

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
  // AIR faction: its own models from the owner's concept renders [MM-story_mvh8woji_1]. Scales follow the class sizes above.
  'AIR-Troops':      { model: 'air_troops',    scale: 0.55, exact: true },
  'AIR-Trucks':      { model: 'air_scout',     scale: 0.8,  exact: true },
  'AIR-Tanks':       { model: 'air_tank',      scale: 1.0,  exact: true },
  'AIR-Artillery':   { model: 'air_artillery', scale: 0.95, exact: true },
  'AIR-HeavyTanks':  { model: 'air_heavy',     scale: 1.15, exact: true },
  'AIR-Copters':     { model: 'air_gunship',   scale: 0.85, exact: true },
  'AIR-Planes':      { model: 'air_fighter',   scale: 1.0,  exact: true },
  'AIR-Missiles':    { model: 'air_missile',   scale: 0.55, exact: true },
  'AIR-HeavyBomber': { model: 'air_bomber',    scale: 1.6,  exact: true },
  // ARTILLERY (Siege) faction: its own models from the owner's concept renders [MM-story_mvhb6qd2_2]
  'ART-Troops':      { model: 'siege_troops',    scale: 0.6,  exact: true },
  'ART-Trucks':      { model: 'siege_scout',     scale: 0.8,  exact: true },
  'ART-Tanks':       { model: 'siege_tank',      scale: 1.0,  exact: true },
  'ART-Artillery':   { model: 'siege_artillery', scale: 1.0,  exact: true },
  'ART-HeavyTanks':  { model: 'siege_heavy',     scale: 1.15, exact: true },
  'ART-Copters':     { model: 'siege_gunship',   scale: 0.85, exact: true },
  'ART-Planes':      { model: 'siege_fighter',   scale: 1.0,  exact: true },
  'ART-Missiles':    { model: 'siege_missile',   scale: 0.55, exact: true },
  // ARCANE / ENERGY: the owner's concepts (arcane/*.js) [MM-story_mvhnbx8n_4]
  'ARC-Troops':      { model: 'arcane_troops',   scale: 0.6,  exact: true },
  'ARC-Trucks':      { model: 'arcane_scout',    scale: 0.8,  exact: true },
  'ARC-Tanks':       { model: 'arcane_tank',     scale: 1.0,  exact: true },
  'ARC-Artillery':   { model: 'arcane_artillery', scale: 1.0, exact: true },
  'ARC-HeavyTanks':  { model: 'arcane_heavy',    scale: 1.15, exact: true },
  'ARC-Copters':     { model: 'arcane_gunship',  scale: 0.85, exact: true },
  'ARC-Planes':      { model: 'arcane_fighter',  scale: 1.0,  exact: true },
  'ARC-Missiles':    { model: 'arcane_missile',  scale: 0.55, exact: true },
  // SPACE TECH: the owner's concepts (space/*.js) [MM-story_mvho2d6s_5]
  'SPC-Troops':      { model: 'space_troops',    scale: 0.6,  exact: true },
  'SPC-Trucks':      { model: 'space_scout',     scale: 0.8,  exact: true },
  'SPC-Tanks':       { model: 'space_tank',      scale: 1.0,  exact: true },
  'SPC-Artillery':   { model: 'space_artillery', scale: 1.0,  exact: true },
  'SPC-HeavyTanks':  { model: 'space_heavy',     scale: 1.15, exact: true },
  'SPC-Copters':     { model: 'space_gunship',   scale: 0.85, exact: true },
  'SPC-Planes':      { model: 'space_fighter',   scale: 1.0,  exact: true },
  'SPC-Missiles':    { model: 'space_missile',   scale: 0.55, exact: true },
  // DARK ENERGY: the owner's concepts (dark/*.js) [MM-story_mvifm4xj_1]
  'DRK-Troops':      { model: 'dark_troops',     scale: 0.6,  exact: true },
  'DRK-Trucks':      { model: 'dark_scout',      scale: 0.8,  exact: true },
  'DRK-Tanks':       { model: 'dark_tank',       scale: 1.0,  exact: true },
  'DRK-Artillery':   { model: 'dark_artillery',  scale: 1.0,  exact: true },
  'DRK-HeavyTanks':  { model: 'dark_heavy',      scale: 1.15, exact: true },
  'DRK-Copters':     { model: 'dark_gunship',    scale: 0.85, exact: true },
  'DRK-Planes':      { model: 'dark_fighter',    scale: 1.0,  exact: true },
  'DRK-Missiles':    { model: 'dark_missile',    scale: 0.55, exact: true },
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
