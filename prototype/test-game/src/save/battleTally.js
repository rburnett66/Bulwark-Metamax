/**
 * src/save/battleTally.js — what one battle did, counted from the sim's event stream [MM-story_mvyqol3w_d].
 *
 * The sim emits these events and nothing counted them (Mission-Log tech plan §1.1, tier C). main.js feeds each
 * drained batch in here, OUTSIDE the tick path: this reads events and never touches the sim, so replay determinism is
 * unaffected. The finished tally is banked into the save's lifetime `stats` at battle end only.
 */
import { getUnitDef } from '../data/tables.js';

/** The harvest colour economy: blue common, yellow uncommon, red rare, green epic (data/planets.js RESOURCE_TIERS). */
export const COLOR_TIER = Object.freeze({ blue: 'common', yellow: 'uncommon', red: 'rare', green: 'epic' });

export function emptyStats() {
  return {
    battles: 0, wins: 0,
    kills: { total: 0, byUnit: {}, byFaction: {}, byDomain: {} },
    structures: { built: {}, upgraded: {}, lost: {} },
    baseDamage: 0, troopsDeployed: 0, harvestersLost: 0,
    harvested: { common: 0, uncommon: 0, rare: 0, epic: 0 },
  };
}

const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

export function createBattleTally() {
  // kept: the units above the Collective contract's quota — the only harvest the inventory banks [MM-story_mw12m2df_2]
  return { ...emptyStats(), kept: { common: 0, uncommon: 0, rare: 0, epic: 0 }, unknownUnits: {}, harvesterIds: new Set(), lostIds: new Set() };
}

/** The sim drops a dead harvester from its list, so the ids are remembered here from tick to tick. */
export function noteHarvesters(t, ids) { for (const id of ids || []) t.harvesterIds.add(id); }

export function noteTroopDeployed(t) { t.troopsDeployed += 1; }

export function tallyEvents(t, events, unitDef = getUnitDef) {
  for (const e of events || []) {
    if (e.type === 'kill') {
      if (e.side === 'attacker') {
        t.kills.total += 1;
        bump(t.kills.byUnit, e.unitId);
        let def = null;
        try { def = unitDef(e.unitId); } catch (err) { bump(t.unknownUnits, e.unitId); }   // reported by finishTally
        if (def) { bump(t.kills.byFaction, def.faction); bump(t.kills.byDomain, def.domain); }
      } else if (t.harvesterIds.has(e.entityId)) {
        t.harvestersLost += 1;
      }
    } else if (e.type === 'build') {
      if (e.phase === 'complete') bump(t.structures.built, e.structId);
      else if (e.phase === 'upgradeComplete') bump(t.structures.upgraded, e.structId);
      else if (e.phase === 'destroyed' && !t.lostIds.has(e.id)) { t.lostIds.add(e.id); bump(t.structures.lost, e.structId); }
    } else if (e.type === 'destroyed') {
      if (!t.lostIds.has(e.entityId)) { t.lostIds.add(e.entityId); bump(t.structures.lost, e.structId); }
    } else if (e.type === 'damage') {
      if (e.targetKind === 'base') t.baseDamage += e.amount || 0;
    } else if (e.type === 'deposit') {
      const tier = COLOR_TIER[e.color];
      if (tier) {
        t.harvested[tier] += e.units || 0;
        if (t.kept) t.kept[tier] += e.kept != null ? e.kept : (e.units || 0);   // no contract: everything is kept
      }
    }
  }
  return t;
}

/** The plain, saveable tally. A kill of a unit no table knows is a data defect: it stays in `unknownUnits` and warns. */
export function finishTally(t) {
  if (Object.keys(t.unknownUnits).length && typeof console !== 'undefined') console.warn('[tally] kills of unknown units', t.unknownUnits);
  const { harvesterIds, lostIds, ...plain } = t;
  plain.baseDamage = Math.round(plain.baseDamage);
  return plain;
}

/** Add one finished tally to the lifetime stats. */
export function mergeTally(stats, tally, won) {
  stats.battles += 1;
  if (won) stats.wins += 1;
  stats.kills.total += tally.kills.total;
  for (const k of ['byUnit', 'byFaction', 'byDomain']) for (const [id, n] of Object.entries(tally.kills[k])) bump(stats.kills[k], id, n);
  for (const k of ['built', 'upgraded', 'lost']) for (const [id, n] of Object.entries(tally.structures[k])) bump(stats.structures[k], id, n);
  stats.baseDamage += tally.baseDamage;
  stats.troopsDeployed += tally.troopsDeployed;
  stats.harvestersLost += tally.harvestersLost;
  for (const [tier, n] of Object.entries(tally.harvested)) stats.harvested[tier] += n;
  return stats;
}
