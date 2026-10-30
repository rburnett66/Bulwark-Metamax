// campaign.js — ring-campaign glue: turn a generated campaign map (mapgen.js) into a playable match.
//
// GDD §4.2: enemy pressure is a POINTS BUDGET per wave, split by lane — "the budget is the contract;
// the roster is not." This module fills each ring's budget with faction units deterministically, and
// exposes the current-ring helper the sim uses for spawn placement, build gating, and the ring reveal.
import { UNITS, factionsInRoster, ABILITY_CARRIERS_PER_WAVE } from '../data/tables.js';
import { createRng } from './rng.js';

// One workbook budget point buys this much unit `power` (tables.js power ≈ 100 for a tier-1 unit).
// INVENTED (the GDD prices waves in abstract points): the single knob for overall campaign pressure.
// Owner, 2026-10-25 (advanced-mode wave re-pace [MM-story_mvnzz719_2]): waves felt too small — raised
// 4.0 → 6.0 (+50% bodies on every standard campaign map). Forge maps that author their own spawn points
// are unaffected: mapgen converts a point COUNT to budget with the inverse 100/POINTS_TO_POWER, so
// "N painted points ≈ N units" holds at any value of this knob.
export const POINTS_TO_POWER = 6.0;

// ── Advanced-mode wave pacing [MM-story_mvnzz719_2] ───────────────────────────────────────────────
// Owner rule (2026-10-25): special/advanced units must NOT appear IN VOLUME until wave 3 — the opening
// waves are a BASIC ground/sea war — then specials ramp in as a capped, growing share of the budget.
// BASIC  = Troops / Scout / Assault Tank (the light bread-and-butter bodies, any lane).
// SPECIAL = Artillery + Heavy Tank (siege) and Gunship + Fighter + Drone + Bomber (air) — the heavies
//           that fillLane's greedy "biggest power first" used to flood waves 1-2 with.
export const SPECIAL_GATE_WAVE = 3;                                   // first wave specials may enter in volume
export const SPECIAL_SHARE = Object.freeze({ start: 0.35, step: 0.10, max: 0.70 });   // of the lane budget
const BASIC_SHAPES = new Set(['Troops', 'Scout', 'Assault Tank']);
const isBasicUnit = (u) => BASIC_SHAPES.has(u && u.shape);
/** Fraction of a wave's budget specials may claim: 0 before the gate, then start + step·(w−gate), capped. */
export function specialShare(wave) {
  if ((wave || 0) < SPECIAL_GATE_WAVE) return 0;
  return Math.min(SPECIAL_SHARE.max, SPECIAL_SHARE.start + SPECIAL_SHARE.step * (wave - SPECIAL_GATE_WAVE));
}

function factionHasLane(faction, lane) {
  for (const id in UNITS) {
    const u = UNITS[id];
    if (u.faction === faction && laneDomain(u) === lane && (u.power || 0) > 0) return true;
  }
  return false;
}

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
 *  a seeded skip so waves vary: big anchors first, change fills the tail with cheap bodies.
 *  Specials are capped to specialShare(wave) of the budget (0 before the gate wave) so the opening
 *  waves are basic bodies; basics then spend the remainder down to ~one unit of the budget. A lane
 *  with no basic units (air) spends its whole budget on specials so no pressure is ever dropped. */
function fillLane(faction, lane, powerBudget, rng, wave) {
  const pool = [];
  for (const id in UNITS) {
    const u = UNITS[id];
    // Tier C is sparse-by-design — the bulk wave builder skips it (render-tiers spec §2/§5), same as
    // tables.js _buildWaves. A bigger air budget would otherwise let the greedy picker draft a Bomber.
    if (u.render_tier === 'C') continue;
    if (u.faction === faction && laneDomain(u) === lane && (u.power || 0) > 0) pool.push({ id, power: u.power, basic: isBasicUnit(u) });
  }
  if (!pool.length) return [];
  const basics = pool.filter((p) => p.basic);
  const specials = pool.filter((p) => !p.basic);
  const picks = [];
  // greedily spend `left` power on `cands` (biggest first, seeded one-step-down for texture)
  const take = (cands, left) => {
    if (!cands.length || left <= 0) return 0;
    const sorted = cands.slice().sort((a, b) => b.power - a.power);
    const cheapest = sorted[sorted.length - 1].power;
    let spent = 0, guard = 400;
    while (left - spent >= cheapest && guard-- > 0) {
      const affordable = sorted.filter((p) => p.power <= left - spent);
      if (!affordable.length) break;
      const idx = (affordable.length > 1 && rng() < 0.35) ? 1 : 0;
      picks.push(affordable[idx].id);
      spent += affordable[idx].power;
    }
    return spent;
  };
  // specials get a ramping share of the budget; a lane with no basics (air) lets specials take it all
  const specialCap = basics.length ? powerBudget * specialShare(wave) : powerBudget;
  const specialSpent = take(specials, Math.min(specialCap, powerBudget));
  take(basics.length ? basics : specials, powerBudget - specialSpent);
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
    // GROUND/SEA-WAR OPENING (owner 2026-07-15, generalised 2026-10-25 [MM-story_mvnzz719_2]): the air
    // axis is a SPECIAL lane — it does not open until the gate wave, for EVERY faction. Earlier this was
    // waves 1-2 AND only when the faction fielded ground, which let a no-ground faction (Water) field air
    // at wave 1. Now air stays shut before the gate whenever a basic non-air lane can absorb its budget
    // (ground, or water on a water map); only a faction with no ground and no water to spend into keeps
    // air open, so pressure is still never dropped. Siege specials are held by fillLane's share cap.
    const canAbsorbAir = factionHasLane(faction, 'ground') || (map.hasWater && factionHasLane(faction, 'water'));
    const airClosed = ring.wave < SPECIAL_GATE_WAVE && canAbsorbAir;
    // SPECIAL ABILITY CARRIERS [MM-story_mvn06wnv_7]: each wave is guaranteed its quota of the faction's ability
    // unit, paid out of that lane's budget (ground, the catch-all, absorbs any shortfall). Not before its lane
    // opens — and an AIR ability unit (a special) waits for the gate wave like the rest of the air axis.
    const carrierPower = { ground: 0, air: 0, water: 0 };
    const carrierIds = [];
    const carrierId = Object.keys(UNITS).find((id) => UNITS[id].faction === faction && UNITS[id].ability);
    if (carrierId) {
      const cl = laneDomain(UNITS[carrierId]);
      const laneOpen = cl === 'ground' || (cl === 'air' && ring.wave >= SPECIAL_GATE_WAVE) || (cl === 'water' && map.hasWater);
      const want = laneOpen ? (ABILITY_CARRIERS_PER_WAVE[ring.wave - 1] || 0) : 0;
      for (let i = 0; i < want; i++) { carrierIds.push(carrierId); carrierPower[cl] += UNITS[carrierId].power || 0; }
    }
    groundPower -= carrierPower.ground;
    for (const lane of ['air', 'water']) {
      const pts = ring.budget[lane] || 0;
      if (lane === 'air' && airClosed) { groundPower += pts * POINTS_TO_POWER; continue; }
      if (pts <= 0 || (lane === 'water' && !map.hasWater)) { groundPower += pts * POINTS_TO_POWER - carrierPower[lane]; continue; }
      const budget = pts * POINTS_TO_POWER - carrierPower[lane];
      const ids = fillLane(faction, lane, budget, rng, ring.wave);
      groundPower += budget - spent(ids);
      ids.forEach((unitId) => spawns.push({ unitId, lane: laneDomain(UNITS[unitId]), delay: 0, interval: 0, count: 1 }));
    }
    const groundIds = fillLane(faction, 'ground', groundPower, rng, ring.wave);
    groundIds.forEach((unitId) => spawns.push({ unitId, lane: 'ground', delay: 0, interval: 0, count: 1 }));
    // a faction may have NO ground roster at all (the Water faction fields floaters + flyers only) —
    // spend the remaining ground budget on the lanes it does field, water first when the map has any
    let leftover = groundPower - spent(groundIds);
    for (const lane of (map.hasWater ? ['water', 'air'] : ['air'])) {
      if (lane === 'air' && airClosed) continue;   // the opening stays a basic ground/sea war
      if (leftover < 60) break;
      const extra = fillLane(faction, lane, leftover, rng, ring.wave);
      leftover -= spent(extra);
      extra.forEach((unitId) => spawns.push({ unitId, lane: laneDomain(UNITS[unitId]), delay: 0, interval: 0, count: 1 }));
    }
    // carriers ride a third of the way into the wave, with escorts ahead and behind
    carrierIds.forEach((unitId, i) => spawns.splice(Math.floor(spawns.length / 3) + i, 0, { unitId, lane: laneDomain(UNITS[unitId]), delay: 0, interval: 0, count: 1 }));
    // stagger the whole wave; the spawn gate spaces the rest. BIG authored waves (owner 2026-07-16:
    // 30-45 troops) compress the stagger so the assault lands inside ~30s instead of dripping for minutes.
    const step = Math.min(1.5, 28 / Math.max(1, spawns.length));
    spawns.forEach((sp, i) => { sp.delay = 1 + i * step; });
    waves.push({ faction, spawns });
  }
  return waves;
}
