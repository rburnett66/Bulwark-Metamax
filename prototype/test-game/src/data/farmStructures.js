/**
 * src/data/farmStructures.js — the farm's rail items as SIM structure defs, for the shared placement
 * [MM-story_mwcgbd9q_2y] [MM-story_mwc9q1y6_2n] (S6 of One Battle UX, TECH_PLAN::One-Battle-UX.md §4).
 *
 * Owner 2026-11-11: "outpost and farm are the same view, but the difference is the Purchase window on the left for
 * outpost equipment, or farm equipment and crops". The outpost's battle rail gets a FARM tab (battle/catalogue.js tabs);
 * its items are armed, ghosted and validated by the battle's own placement (input/input.js → sim/structures.js
 * validatePlacement), so they need defs getStructureDef resolves — like the outpost's 'OUT-<kind>' defs. They are
 * DERIVED from the farm's data (data/farm.js: the workbook's Farm_Methods, Farm_Buildings and Crops rows), never retyped:
 *
 *   'FARM-<method>'    a plot (Traditional, Irrigated): its method's w × h, priced at its first prep (Farming-Design §5.1)
 *   'FARM-<building>'  a farm building the player buys (Silo, Pump): its w × h and cost. The Farmhouse is the farming
 *                      contract's grant (farm/contract.js), so it has no rail item.
 *   'FARM-crop-<id>'   a crop: armed, then tapped onto a prepped plot to plant it (1 × 1 aim, no gold: it costs pods)
 *
 * A farm def is `nonBlocking` (plots never block paths, Farming-Design §10; the sim's seal-off check skips it) and the
 * sim never builds it: the outpost session hands the placement to the save session's farm actions (farmPlace, plant)
 * — the farm keeps its rules in one place (farm/model.js). Kept OUT of tables.STRUCTURES so no battle lists them.
 */
import { METHODS, FARM_BUILDINGS, CROPS, prepCost } from './farm.js';
import { RAIL_SHORT_NAME } from './outpostStructures.js';

export const FARM_PREFIX = 'FARM-';
/** The structure id of a farm rail item: a method or a farm building kind ('silo' → 'FARM-silo'), a crop ('FARM-crop-<id>'). */
export const farmStructId = (id) => FARM_PREFIX + id;
export const cropStructId = (cropId) => FARM_PREFIX + 'crop-' + cropId;
/** Is this a farm rail item? */
export const isFarmStructId = (id) => typeof id === 'string' && id.startsWith(FARM_PREFIX);

/** The farm buildings the rail sells (the Farmhouse is granted, never bought). */
export const FARM_RAIL_BUILDINGS = Object.freeze(FARM_BUILDINGS.filter((b) => b.kind !== 'farmhouse').map((b) => b.kind));

/** A crop's rail name: its name, or its first word when the full name would not fit a rail button. */
export const cropRailName = (c) => { const n = String(c.name || c.id).toUpperCase(); return n.length > 10 ? n.split(/\s+/)[0] : n; };

const UNIT = Object.freeze({ w: 1, h: 1 });
function farmDef(extra) {
  return Object.freeze({
    kind: 'farm', armorClass: 'Structure', damageType: 'Kinetic', canTargetDomains: Object.freeze([]),
    hp: Object.freeze([1]), dps: Object.freeze([0]), range: 0, targetable: false, buildTime: 0, upgradeTime: 0, sellTime: 0,
    spacing: 0, nonBlocking: true, ...extra,
  });
}

/** → frozen { [id]: def } for every plot method, bought farm building and crop. */
export function buildFarmStructures(methods = METHODS, buildings = FARM_BUILDINGS, crops = CROPS) {
  const out = {};
  for (const m of methods) {
    out[farmStructId(m.id)] = farmDef({ farmItem: 'plot', farmId: m.id, name: m.name, label: RAIL_SHORT_NAME[m.id] || m.name.toUpperCase(),
      cost: Object.freeze([prepCost(m.id).gold]), footprint: Object.freeze({ w: m.w, h: m.h }) });
  }
  for (const b of buildings) {
    if (b.kind === 'farmhouse') continue;
    out[farmStructId(b.kind)] = farmDef({ farmItem: 'building', farmId: b.kind, name: b.name, label: RAIL_SHORT_NAME[b.kind] || b.name.toUpperCase(),
      cost: Object.freeze([b.cost]), footprint: Object.freeze({ w: b.w, h: b.h }) });
  }
  for (const c of crops) {
    out[cropStructId(c.id)] = farmDef({ farmItem: 'crop', farmId: c.id, crop: c.id, name: c.name, label: cropRailName(c),
      cost: Object.freeze([0]), footprint: UNIT });
  }
  return Object.freeze(out);
}
