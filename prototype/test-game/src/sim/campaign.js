// campaign.js — ring-campaign glue: turn a generated campaign map (mapgen.js) into a playable match.
//
// GDD §4.2: enemy pressure is a POINTS BUDGET per wave, split by lane — "the budget is the contract;
// the roster is not." This module fills each ring's budget with faction units deterministically, and
// exposes the current-ring helper the sim uses for spawn placement, build gating, and the ring reveal.
import { UNITS, factionsInRoster } from '../data/tables.js';
import { createRng } from './rng.js';

// One workbook budget point buys this much unit `power` (tables.js power ≈ 100 for a tier-1 unit).
// INVENTED (the GDD prices waves in abstract points): 4.0 makes map 1 wave 1 (100 pts) ≈ 4 troops and
// map 9 wave 8 (407 pts) ≈ a 16-unit assault. The single knob for overall campaign pressure.
export const POINTS_TO_POWER = 4.0;

function laneDomain(u) {
  if (u.domain === 'Flyer') return 'air';
  if (u.domain === 'Floater' || u.domain === 'Swimmer') return 'water';
  return 'ground';
}

/** The ring in effect for the CURRENT wave (wave 0 = pre-battle build phase = the wave-1 pocket). */
export function currentRing(map, waveNumber) {
  if (!map || !map.rings || !map.rings.length) return null;
  const w = Math.max(1, Math.min(waveNumber || 1, map.rings.length));
  return map.rings[w - 1];
}

/** Fill one lane's power budget with units of `faction`, deterministically. Greedy from the top with
 *  a seeded skip so waves vary: big anchors first, change fills the tail with cheap bodies. */
function fillLane(faction, lane, powerBudget, rng) {
  const pool = [];
  for (const id in UNITS) {
    const u = UNITS[id];
    if (u.faction === faction && laneDomain(u) === lane && (u.power || 0) > 0) pool.push({ id, power: u.power });
  }
  if (!pool.length) return [];
  pool.sort((a, b) => b.power - a.power);
  const picks = [];
  let left = powerBudget;
  let guard = 200;
  while (left >= pool[pool.length - 1].power && guard-- > 0) {
    const affordable = pool.filter((p) => p.power <= left);
    if (!affordable.length) break;
    // mostly take the biggest affordable; sometimes reach one step down for texture
    const idx = (affordable.length > 1 && rng() < 0.35) ? 1 : 0;
    const pick = affordable[idx];
    picks.push(pick.id);
    left -= pick.power;
  }
  return picks;
}

/**
 * Build the 8-wave enemy schedule for a campaign map — same shape the wave scheduler consumes
 * (initWaves/startNextWave: [{spawns:[{unitId,lane,delay,interval,count}], faction}]).
 * `onlyFaction` pins every wave to one faction (the HUD test picker); default rotates the roster
 * with a per-map offset so no two maps open with the same enemy (mirrors the side-focus offsetting).
 */
export function buildCampaignWaves(map, onlyFaction) {
  const roster = factionsInRoster();
  const waves = [];
  for (const ring of map.rings) {
    const rng = createRng(((map.mapId * 31 + ring.wave) ^ (map.seed || 0)) >>> 0).next;
    const faction = onlyFaction || roster[(map.mapId - 1 + ring.wave - 1) % roster.length];
    const spawns = [];
    const spent = (ids) => ids.reduce((s, id) => s + (UNITS[id].power || 0), 0);
    // fill the narrow lanes FIRST and roll their unspendable remainder into ground (filled last) —
    // per-lane leftovers otherwise strand real pressure (a lane's change can't buy its cheapest
    // unit, but ground can always spend it). The GDD budgets lanes on the MAP; the roster is the
    // designer's problem — ours is to never drop pressure on the floor.
    let groundPower = (ring.budget.ground || 0) * POINTS_TO_POWER;
    for (const lane of ['air', 'water']) {
      const pts = ring.budget[lane] || 0;
      if (pts <= 0 || (lane === 'water' && !map.hasWater)) { groundPower += pts * POINTS_TO_POWER; continue; }
      const budget = pts * POINTS_TO_POWER;
      const ids = fillLane(faction, lane, budget, rng);
      groundPower += budget - spent(ids);
      ids.forEach((unitId) => spawns.push({ unitId, lane: laneDomain(UNITS[unitId]), delay: 0, interval: 0, count: 1 }));
    }
    const groundIds = fillLane(faction, 'ground', groundPower, rng);
    groundIds.forEach((unitId) => spawns.push({ unitId, lane: 'ground', delay: 0, interval: 0, count: 1 }));
    // a faction may have NO ground roster at all (the Water faction fields floaters + flyers only) —
    // spend the remaining ground budget on the lanes it does field, water first when the map has any
    let leftover = groundPower - spent(groundIds);
    for (const lane of (map.hasWater ? ['water', 'air'] : ['air'])) {
      if (leftover < 60) break;
      const extra = fillLane(faction, lane, leftover, rng);
      leftover -= spent(extra);
      extra.forEach((unitId) => spawns.push({ unitId, lane: laneDomain(UNITS[unitId]), delay: 0, interval: 0, count: 1 }));
    }
    spawns.forEach((sp, i) => { sp.delay = 1 + i * 1.5; });   // stagger the whole wave; the spawn gate spaces the rest
    waves.push({ faction, spawns });
  }
  return waves;
}
