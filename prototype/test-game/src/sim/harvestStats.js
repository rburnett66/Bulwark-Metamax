// harvestStats.js — the battle harvester's numbers, from the workbook rows (one source) [MM-story_mwc9pzyd_2l].
//
// sim/harvest.js drives its trucks with these, and the outpost's away closed form (data/outpost.js harvestRates)
// reads the SAME functions, so a live outpost visit and the away accrual cannot drift apart (One Battle UX S4).
// Pure: workbook data only, no sim state beyond the deterministic inputs passed in.
import { MAPDATA } from '../../content/maps/mapdata.js';
import { BONUS_NERFS } from '../data/tables.js';

/** The harvester's stats: { capacity, speed (cells / s), hp, yieldMult }. state (optional): harvesterLevel, bonuses. */
export function harvesterStats(state) {
  const f = (MAPDATA.factions && MAPDATA.factions[0]) || {};
  // HARVESTER UPGRADES (workbook, levels 1-5): multipliers injected at createSim via
  // state.harvesterLevel — part of the initial deterministic state, never mid-battle.
  const lvl = Math.max(1, Math.min(5, (state && state.harvesterLevel) || 1));
  const up = (MAPDATA.harvesterUpgrades || []).find((u) => u.Level === lvl) || {};
  // WAVE BONUSES: starting harvester speed −35% (pre-nerf); bonuses 8/9/10 add +20% speed/capacity/hp
  // to future spawns (the existing fleet is scaled in applyBonus). Persistent run mods live on state.bonuses.
  const nerf = BONUS_NERFS.harvesterSpeedMult;
  const b = (state && state.bonuses && state.bonuses.harv) || { speed: 0, capacity: 0, hp: 0 };
  return {
    capacity: Math.round((f.Harvester_Base_Capacity || 40) * (up.Capacity_Mult || 1) * (1 + b.capacity)),
    speed: (f.Harvester_Base_Speed || 3) * (up.Speed_Mult || 1) * nerf * (1 + b.speed),
    hp: Math.round((f.Harvester_Base_HP || 120) * (up.HP_Mult || 1) * (1 + b.hp)),
    yieldMult: f.Yield_Mult || 1,
  };
}

/** The Resources row a node of `type` and `role` reads (premium nodes the Premium tier, the rest Primary). */
export function resourceRow(type, role) {
  return (MAPDATA.resources || []).find((d) => d.Resource === type && (role === 'premium' ? d.Tier === 'Premium' : d.Tier === 'Primary')) || null;
}

/** Seconds to pull a whole node of `type` / `role` (Harvest_Sec_Per_Node; 8 when the row is missing). */
export function nodeHarvestSec(r) {
  const def = resourceRow(r.type, r.role);
  return (def && def.Harvest_Sec_Per_Node) || 8;
}
