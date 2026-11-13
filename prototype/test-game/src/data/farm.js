/**
 * src/data/farm.js — farming's data: crops, methods, crop levels (and their tech chains), farm buildings, contracts and tuning
 * [MM-story_mwabgax7_9].
 *
 * Values: the map-data workbook's Farm_Params, Crops, Farm_Methods, Pod_Levels, Farm_Buildings and Farm_Contracts
 * sheets (written by tools/economy/write_farm_sheets.py, extracted by tools/extract_mapdata.py) → MAPDATA.farm*.
 * Design: docs/16 Bulwark MM/design/Farming-Design.md §4–§9 · Tech plan: docs/tech-plan/Farming.md §3.1–§3.2.
 * Pure data; no DOM, no clock. Every number is a proposed default until the owner rules on it (Farming-Design D14).
 *
 * Words: a crop LEVEL is 1–5 (Common … Legendary): researched per crop in the tech tree and kept by each plot it was
 * planted on (owner rule 9, 2026-11-10; seed pods have no level). A crop TIER is the resource's battle tier (common …
 * epic, how hard it is to grow). They share names on purpose and never mix (Farming-Design §8.2, D4).
 * Crop_Levels (the tech tree's crop chains) → MAPDATA.cropLevels → CROP_LEVEL_NODES.
 */
import { MAPDATA } from '../../content/maps/mapdata.js';

const num = (v) => (typeof v === 'number' ? v : 0);
const words = (v) => String(v || '').split(/\s+/).filter(Boolean);

/** The tuning (Farm_Params), by name: Prep_Gold, Prep_Sec, Sprout_At, Plant_At, Fruited_Window, … */
export const FARM = Object.freeze({ ...(MAPDATA.farmParams || {}) });

/** The 36 crops, in planet order then tier order. id = the resource's catalogue id (the name's slug). */
export const CROPS = Object.freeze((MAPDATA.crops || []).map((r) => Object.freeze({
  id: r.Resource_Id, name: r.Crop, planet: r.Planet, planetKey: r.Planet_Key, tier: r.Tier, category: r.Category,
  growsAs: r.Grows_As, best: Object.freeze(words(r.Best_Method)), growHours: num(r.Grow_Hours), yield: num(r.Yield),
  fruitedHours: num(r.Fruited_Hours), podReturn: num(r.Pod_Return),
  newMaterial: r.Material === 'new',   // a farm-only material (Helium-4), not a battle resource (owner rules 1, 5)
})));
/** The crops that are new materials, made only by farming (Helium-4). */
export const NEW_MATERIALS = Object.freeze(CROPS.filter((c) => c.newMaterial));
const CROP_BY_ID = new Map(CROPS.map((c) => [c.id, c]));

/** A crop by its resource id ('loam-grain'), or null. */
export const cropOf = (id) => CROP_BY_ID.get(id) || null;
/** A planet's four crops, common to epic tier. Takes the planet's name ('Verdance') or key ('ground'). */
export const cropsOf = (planet) => CROPS.filter((c) => c.planet === planet || c.planetKey === planet);

/** The farming methods this build ships (Phase A: traditional, irrigated). */
export const METHODS = Object.freeze((MAPDATA.farmMethods || []).map((r) => Object.freeze({
  id: r.Method, name: r.Name, family: r.Family, w: num(r.Foot_W), h: num(r.Foot_H), where: r.Where,
  speed: num(r.Speed_Mult), yieldMult: num(r.Yield_Mult), power: num(r.Power), prepMult: num(r.Prep_Mult),
  pods: num(r.Pods_Per), waterReach: num(r.Water_Reach), taughtBy: r.Taught_By,
  level5Needs: r.Level5_Needs || 'never',   // owner rule 9: what lets this method grow level 5 ('water' | 'never')
})));
/** A method by id, or null. */
export const methodOf = (id) => METHODS.find((m) => m.id === id) || null;

/**
 * The five CROP levels, 1 (Common) … 5 (Legendary) — a plot's level (owner rule 9, 2026-11-10). The names keep "pod"
 * for history (the workbook's Pod_Levels sheet); seed pods themselves have no level: a crop's level comes from the tech
 * tree (src/farm/levels.js cropLevel) and a plot keeps the level it was planted at.
 */
export const POD_LEVELS = Object.freeze((MAPDATA.podLevels || []).map((r) => Object.freeze({
  level: r.Level, name: r.Name, colour: r.Colour, value: num(r.Value_Mult), yieldBonus: num(r.Yield_Bonus),
  embers: Object.freeze({ count: num(r.Ember_Count), life: num(r.Ember_Life_Sec), rise: num(r.Ember_Rise) }),
})));
/** The same table under its current name. */
export const CROP_LEVELS = POD_LEVELS;
export const MAX_POD_LEVEL = POD_LEVELS.length;
/** A crop level (1–5) or null for anything else. */
export const podLevel = (n) => POD_LEVELS.find((l) => l.level === n) || null;

/**
 * Battle-map crops always count as level 3 (owner, 2026-11-10): where a farm crop's level is set against a battle
 * map's resource (yield, value, labels), the map's is Rare. Its Value_Mult is 1, the battle price (checked by the
 * workbook extractor).
 */
export const MAP_CROP_LEVEL = 3;

/**
 * The tech tree's crop level nodes (owner rule 9): per crop a chain II … V in the OUTPOST & FARM tree's SEED PODS
 * division, from the workbook's Crop_Levels sheet. Level 1 is the base and has no node. unlock: the farming contract
 * and the state it must reach on the crop's planet ({ contract: 'F1', state: 'accepted' | 'complete' }) — rule D7, a
 * contract unlocks and gold buys. Prices and the III–V gates are proposed (D14).
 */
export const CROP_LEVEL_NODES = Object.freeze((MAPDATA.cropLevels || []).map((r) => {
  const [contract, state] = String(r.Unlock || '').split(':');
  return Object.freeze({ id: r.Node, crop: r.Crop_Id, planetKey: r.Planet_Key, level: r.Level, name: r.Name, price: num(r.Price),
    unlock: Object.freeze({ contract, state }), proposed: r.Status === 'proposed' });
}));
/** A crop's chain, level 2 up: [node…] (empty for a crop with no chain yet). */
export const cropLevelChain = (cropId) => CROP_LEVEL_NODES.filter((n) => n.crop === cropId).sort((a, b) => a.level - b.level);

/** The farm buildings this build ships (farmhouse, silo, pump). */
export const FARM_BUILDINGS = Object.freeze((MAPDATA.farmBuildings || []).map((r) => Object.freeze({
  kind: r.Kind, name: r.Name, w: num(r.Foot_W), h: num(r.Foot_H), cost: num(r.Cost), buildSec: num(r.Build_Sec),
  draw: num(r.Power_Draw), waterReach: num(r.Water_Reach), unlock: r.Unlock || '',
})));
/** A farm building by kind, or null. */
export const farmBuildingOf = (kind) => FARM_BUILDINGS.find((b) => b.kind === kind) || null;

/** The farming contracts this build ships (Phase A: Verdance F1). */
export const FARM_CONTRACTS = Object.freeze((MAPDATA.farmContracts || []).map((r) => Object.freeze({
  planetKey: r.Planet_Key, code: r.Contract, title: r.Title, crop: r.Crop_Id, plantPlots: num(r.Plant_Plots),
  deliver: num(r.Deliver), methodsAtOnce: num(r.Methods_At_Once), gold: num(r.Gold), loyalty: num(r.Loyalty),
  xp: num(r.XP), podCrate: num(r.Pod_Crate),
  grants: Object.freeze(words(r.Grants)), unlocks: Object.freeze(words(r.Unlocks)),
})));
/** A planet's farming contract ('ground', 'F1'), or null. */
export const farmContractOf = (planetKey, code) => FARM_CONTRACTS.find((c) => c.planetKey === planetKey && c.code === code) || null;

const crop = (c) => (typeof c === 'string' ? cropOf(c) : c);
const method = (m) => (typeof m === 'string' ? methodOf(m) : m);

/** Seconds a crop takes from planting to Fruited with a method (the method's speed divides the crop's time). */
export function growSec(c, m = 'traditional') {
  c = crop(c); m = method(m);
  if (!c || !m) throw new Error(`farm: unknown crop or method (${c && c.id}, ${m && m.id})`);
  return (c.growHours * 3600) / m.speed;
}

/** Seconds a Fruited plant waits to be harvested before it dies (Fruited_Window × its own grow time, D2). */
export const fruitedSec = (c, m = 'traditional') => growSec(c, m) * num(FARM.Fruited_Window);

/** The stage a plant is in `t` seconds after planting: 'planted' | 'sprout' | 'plant' | 'fruited' | 'dead' (§5.1). */
export function stageAt(c, m, t) {
  const g = growSec(c, m);
  if (t < g * FARM.Sprout_At) return 'planted';
  if (t < g * FARM.Plant_At) return 'sprout';
  if (t < g) return 'plant';
  return t < g + fruitedSec(c, m) ? 'fruited' : 'dead';
}

/**
 * Units one plot yields at Fruited: the crop's Traditional yield × the method's yield × (1 + the level's bonus),
 * rounded down, at least 1. A trampled plot's share (Trample_Fruited_Yield) is the model's to apply (A11).
 */
export function yieldOf(c, m, level) {
  c = crop(c); m = method(m);
  const L = podLevel(level);
  if (!c || !m || !L) throw new Error(`farm: unknown crop, method or pod level (${c && c.id}, ${m && m.id}, ${level})`);
  return Math.max(1, Math.floor(c.yield * m.yieldMult * (1 + L.yieldBonus)));
}

/**
 * The level a plot actually grows a crop at (owner rule 9): the crop's tech-tree level, except that level 5 always
 * needs a trick or machinery. A method's level5Needs says which: 'water' — level 5 on a plot with water in reach (an
 * Irrigated plot by a water cell or a powered Pump); 'never' — a plain plot grows a level-5 crop at level 4.
 * Fertilizer and hydroponics join as more methods / equipment later. → { level, capped, why }
 */
export function growLevel(techLevel, m, { water = false } = {}) {
  m = method(m);
  const L = Math.max(1, Math.min(MAX_POD_LEVEL, Math.floor(techLevel) || 1));
  if (L < MAX_POD_LEVEL || !m) return { level: L, capped: false, why: null };
  if (m.level5Needs === 'water' && water) return { level: L, capped: false, why: null };
  const why = m.level5Needs === 'water' ? 'level 5 needs water: a water cell or a powered Pump in reach' : 'level 5 needs irrigation';
  return { level: L - 1, capped: true, why };
}

/** Pods a Fruited harvest hands back (§9.1): grain 20 %, vegetables 10 %, at least 1 for grain. A plain count. */
export function podsBack(c, planted) {
  c = crop(c);
  const n = Math.floor(planted * c.podReturn);
  return c.category === 'Grain' ? Math.max(1, n) : n;
}

/**
 * Gold to place a plot (Plot_Gold) — the farm's one gold charge (owner 2026-11-13 [MM-story_mwf605xu_2]: "DONT CHARGE FOR
 * PLANTING .. the user paid for the seeds by fighting for resources. Charge for dropping the plot, do not charge for
 * prep. Seeds plant once."). Prep is free (Prep_Gold 0) and planting takes only the pods it plants.
 */
export const plotCost = () => ({ gold: num(FARM.Plot_Gold) });

/** Gold to prep one plot of a method (Prep_Gold × the method's Prep_Mult), and the seconds it takes. */
export const prepCost = (m = 'traditional') => ({ gold: FARM.Prep_Gold * method(m).prepMult, sec: FARM.Prep_Sec * method(m).prepMult });
