/**
 * src/data/outpostStructures.js — the outpost's buildings and defenses as SIM structure defs
 * [MM-task_mwcdvixz_2r] (S2.1 of One Battle UX, TECH_PLAN::One-Battle-UX.md §4–§5).
 *
 * Owner 2026-11-11: one pattern, one implementation — the outpost places, builds, upgrades and sells through the
 * battle's own structure code (sim/structures.js). For that the sim needs defs for the outpost's kinds. They are
 * DERIVED here, never retyped: every number comes from the workbook's Outpost_Structures rows (MAPDATA.outpostStructures,
 * the same rows data/outpost.js reads) and, for a defense, from the battle tower it already names (Battle_Struct).
 *
 *   id            'OUT-<kind>', e.g. 'OUT-power', 'OUT-mg'
 *   cost          running total per tier of the rows' Cost (so the battle's upgrade charge = that tier's row price);
 *                 price = the rows' Cost per tier. A defense keeps its battle stats at the outpost's prices.
 *   buildTime     tier 1's Build_Sec;  upgradeTime  tier 2's Build_Sec (0 when there is none)
 *   hp / dps      a defense: its battle tower's; a building: not a combat target (`targetable: false`), hp = the
 *                 rows' HP where the workbook gives one (the Pylon), else 1
 *   footprint     the hub 3×3, the Pylon 1×1, every other building 2×2 (the size of its pad on every outpost map);
 *                 a defense 1×1
 *   spacing       1 for buildings (a harvester-wide lane, owner 2026-11-11), 0 for defenses (they pack like towers)
 *   power         { draw, supply, reach } per tier, for the grid (S2b): a node is a kind with reach (a Power Station
 *                 supplies, a Pylon only links); the coverage overlay draws `reach` as the `power` class
 *
 * These live OUTSIDE tables.STRUCTURES on purpose: the battle's build rail lists STRUCTURES, and the outpost's kinds
 * must not appear in a battle. getStructureDef (tables.js) resolves both. Pure: no imports, so tables.js can call it.
 */

/** The outpost kinds that are buildings (pad kinds today) — everything else with a Battle_Struct is a defense. */
export const OUTPOST_BUILDING_KINDS = Object.freeze(['hub', 'power', 'pylon', 'rig', 'storage', 'resourceBay', 'upgradeBay', 'habitat']);
/** The kinds that are energy-grid NODES (outpost/model.js powerGrids): a Power Station supplies, a Pylon only links. */
export const POWER_NODE_KINDS = Object.freeze(['power', 'pylon']);
const FOOTPRINT = Object.freeze({ hub: Object.freeze({ w: 3, h: 3 }), pylon: Object.freeze({ w: 1, h: 1 }) });
const BUILDING_FOOTPRINT = Object.freeze({ w: 2, h: 2 });
const UNIT_FOOTPRINT = Object.freeze({ w: 1, h: 1 });
const num = (v) => (typeof v === 'number' ? v : 0);

/**
 * What the player calls each outpost kind — ONE table for every outpost surface (the battle rail, the selection panel,
 * the away report, the old outpost HUD) [MM-subtask_mwciiylh_31]; it used to be written twice (hudModel.js, awayReport.js).
 * The Harvester Bay is the Resource Bay (owner 2026-11-07); the turret tower is the Cannon Tower.
 */
export const OUTPOST_KIND_NAME = Object.freeze({
  hub: 'Outpost Hub', power: 'Power Station', pylon: 'Pylon', rig: 'Mining Station', storage: 'Storage Tower',
  harvesterBay: 'Resource Bay', resourceBay: 'Resource Bay', upgradeBay: 'Upgrade Bay', habitat: 'Habitat', cannon: 'Cannon Tower', mg: 'Machine Gun', wall: 'Wall',
});

/**
 * The short names a build rail shows (owner 2026-11-11: "Building names can be shortened"): the full names overlap on a
 * phone-width rail. ONE table for every rail — the shared battle rail (render/hud.js reads a def's `label`) and the old
 * outpost view's narrow rail (outpost/view/hud.js) — so a rename happens once. Farm kinds included for the farm rail.
 */
export const RAIL_SHORT_NAME = Object.freeze({
  power: 'POWER', pylon: 'PYLON', rig: 'MINING', storage: 'STORAGE', resourceBay: 'RES. BAY', harvesterBay: 'RES. BAY',
  upgradeBay: 'UPGRADE', habitat: 'HABITAT', cannon: 'CANNON',
  traditional: 'PLOT', irrigated: 'IRRIGATED', silo: 'SILO', pump: 'PUMP',
});

/** The sim structure id for an outpost kind ('power' → 'OUT-power'). */
export const outpostStructId = (kind) => 'OUT-' + kind;

/**
 * rows: MAPDATA.outpostStructures. battle: tables.STRUCTURES (for a defense's Battle_Struct).
 * → frozen { [id]: def } for every outpost building and defense kind the rows define.
 */
export function buildOutpostStructures(rows, battle) {
  const byKind = new Map();
  for (const r of rows || []) {
    if (!r || !r.Kind || r.Kind === 'harvester') continue;   // the harvester is a unit the Resource Bay buys, not a structure
    if (!byKind.has(r.Kind)) byKind.set(r.Kind, []);
    byKind.get(r.Kind).push(r);
  }
  const out = {};
  for (const [kind, list] of byKind) {
    const tiers = list.slice().sort((a, b) => a.Tier - b.Tier);
    // cost[t] = what the structure has cost IN TOTAL at tier t+1. The battle charges an upgrade as cost[t] − cost[t−1] and
    // refunds a share of everything invested (sim/structures.js startUpgrade, economy.getSellValue); with running totals
    // that is exactly the outpost's rule — each tier's row Cost per upgrade, refunds on the sum (model.js investedIn).
    let total = 0;
    const cost = Object.freeze(tiers.map((r) => (total += num(r.Cost))));
    const price = Object.freeze(tiers.map((r) => num(r.Cost)));
    const power = Object.freeze(tiers.map((r) => Object.freeze({ draw: num(r.Power_Draw), supply: num(r.Power_Supply), reach: num(r.Power_Reach) })));
    const buildTime = num(tiers[0].Build_Sec), upgradeTime = tiers[1] ? num(tiers[1].Build_Sec) : 0;
    const tower = tiers[0].Battle_Struct ? battle[tiers[0].Battle_Struct] : null;
    if (tiers[0].Battle_Struct && !tower) throw new Error(`outpostStructures: ${kind} names unknown battle structure ${tiers[0].Battle_Struct}`);
    const common = { outpostKind: kind, cost, price, buildTime, upgradeTime, power, model: tiers[0].Model || null, unlock: tiers[0].Unlock || '' };
    if (tower) {
      // a defense: the battle tower, at the outpost's prices and times (owner 2026-11-10 "tower parity")
      // only the tiers the outpost defines (its Wall has 2, the battle's 3): the sim reads the tier count from hp.length
      const n = tiers.length;
      out[outpostStructId(kind)] = Object.freeze({ ...tower, ...common, battleStruct: tiers[0].Battle_Struct,
        hp: Object.freeze(tower.hp.slice(0, n)), dps: Object.freeze(tower.dps.slice(0, n)),
        footprint: tower.footprint || UNIT_FOOTPRINT, spacing: 0 });
    } else {
      out[outpostStructId(kind)] = Object.freeze({
        ...common,
        name: OUTPOST_KIND_NAME[kind] || kind, label: RAIL_SHORT_NAME[kind], kind: 'building',
        armorClass: 'Structure', damageType: 'Kinetic', canTargetDomains: Object.freeze([]),
        hp: Object.freeze(tiers.map((r) => num(r.HP) || 1)), dps: Object.freeze(tiers.map(() => 0)), range: 0,
        targetable: false,                       // raiders breach a building by reaching it; they never shoot it
        sellTime: 0,
        footprint: FOOTPRINT[kind] || BUILDING_FOOTPRINT,
        spacing: 1,
      });
    }
  }
  return Object.freeze(out);
}
