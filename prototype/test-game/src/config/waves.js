resa=[]

I'll create the waves config file based on the model requirements: survive N waves = win, using Ground/Powder faction units (walker, floater/swimmer, flyer).

```javascript
// src/config/waves.js
```

Let me write the complete file:

Looking at the vertical slice, the attacker faction is Ground/Powder with 3 units spanning behavior (walker/ground, a floater/swimmer type, flyer). Based on the roster, the natural picks for the "3 units spanning behavior" are a walker (GND-Troops), a flyer (GND-Copters), and something for the water lane. Since Ground/Powder has no native water unit, the vertical slice designates one unit to travel the water lane as a "floater" for the domain-coverage test.

```javascript
/**
 * src/config/waves.js
 * Wave spawn schedule / composition data (data-driven).
 *
 * The wave system (src/sim/waves.js) reads this table. Each wave is an ordered
 * list of spawn groups. A group names a unitId (from config.data.tables.units),
 * a count, a spawn interval (seconds between individual spawns), a lead-in
 * delay (seconds before the group begins spawning after the wave starts), and
 * a domain override the sim uses to route the unit onto the correct lane
 * (ground / water / air). Ground/Powder is the tutorial attacker faction; it
 * has no native water unit, so the vertical slice designates GND-Trucks to run
 * the water lane as the "floater/swimmer" domain-coverage entry.
 *
 * Survive WIN_WAVES completed waves = win. Base HP -> 0 = lose.
 *
 * NOTE: no balance is hardcoded here — HP/DPS/cost come from the units table.
 * Only spawn scheduling (counts, timing, which lane) lives in this file.
 */

// Total number of waves the player must survive to win.
export const WIN_WAVES = 5;

// Seconds of build/prep time granted before the first wave may auto-start.
// (The player can also start a wave early via the wave controls.)
export const PREP_TIME = 20;

// Seconds of grace between the last unit of a wave dying/arriving and the
// next wave being allowed to auto-start.
export const INTERWAVE_TIME = 12;

// Domain tags the sim/movement layer understands.
// 'ground'  -> walker: uses ground lane, blocked by water/walls/moats
// 'water'   -> floater/swimmer: uses water lane
// 'air'     -> flyer: ignores ground terrain and walls, has altitude
export const DOMAINS = { GROUND: 'ground', WATER: 'water', AIR: 'air' };

/**
 * Each wave: { id, name, reward, groups: [ { unitId, count, interval, delay, domain, tier } ] }
 *  - unitId : key into config.data.tables.units
 *  - count  : how many of this unit to spawn
 *  - interval: seconds between successive spawns within the group
 *  - delay  : seconds after wave-start before this group begins
 *  - domain : lane routing override (ground/water/air)
 *  - tier   : stat tier to spawn at (1..3), reads HP/DPS T{tier} from units table
 *  - reward : bonus gold granted to the player for completing the wave
 */
export const WAVES = [
  {
    id: 1,
    name: 'Wave 1 — Probe',
    reward: 40,
    groups: [
      { unitId: 'GND-Troops', count: 4, interval: 1.4, delay: 0.0, domain: DOMAINS.GROUND, tier: 1 },
    ],
  },
  {
    id: 2,
    name: 'Wave 2 — Ground Push',
    reward: 55,
    groups: [
      { unitId: 'GND-Troops', count: 6, interval: 1.1, delay: 0.0, domain: DOMAINS.GROUND, tier: 1 },
      { unitId: 'GND-Trucks', count: 2, interval: 3.0, delay: 4.0, domain: DOMAINS.WATER, tier: 1 },
    ],
  },
  {
    id: 3,
    name: 'Wave 3 — Combined Arms',
    reward: 70,
    groups: [
      { unitId: 'GND-Troops', count: 6, interval: 1.0, delay: 0.0, domain: DOMAINS.GROUND, tier: 1 },
      { unitId: 'GND-Tanks',  count: 2, interval: 4.0, delay: 3.0, domain: DOMAINS.GROUND, tier: 1 },
      { unitId: 'GND-Copters', count: 2, interval: 3.5, delay: 6.0, domain: DOMAINS.AIR, tier: 1 },
    ],
  },
  {
    id: 4,
    name: 'Wave 4 — Air & Siege',
    reward: 90,
    groups: [
      { unitId: 'GND-Copters',   count: 3, interval: 2.5, delay: 0.0, domain: DOMAINS.AIR, tier: 1 },
      { unitId: 'GND-Trucks',    count: 3, interval: 2.2, delay: 2.0, domain: DOMAINS.WATER, tier: 1 },
      { unitId: 'GND-Artillery', count: 2, interval: 5.0, delay: 5.0, domain: DOMAINS.GROUND, tier: 1 },
      { unitId: 'GND-Troops',    count: 5, interval: 1.0, delay: 3.0, domain: DOMAINS.GROUND, tier: 1 },
    ],
  },
  {
    id: 5,
    name: 'Wave 5 — Final Assault',
    reward: 150,
    groups: [
      { unitId: 'GND-Tanks',      count: 3, interval: 3.0, delay: 0.0, domain: DOMAINS.GROUND, tier: 2 },
      { unitId: 'GND-HeavyTanks', count: 1, interval: 1.0, delay: 2.0, domain: DOMAINS.GROUND, tier: 2 },
      { unitId: 'GND-Copters',    count: 4, interval: 2.0, delay: 1.0, domain: DOMAINS.AIR, tier: 2 },
      { unitId: 'GND-Trucks',     count: 4, interval: 2.0, delay: 3.0, domain: DOMAINS.WATER, tier: 1 },
      { unitId: 'GND-Troops',     count: 8, interval: 0.8, delay: 4.0, domain: DOMAINS.GROUND, tier: 1 },
    ],
  },
];

/**
 * Flatten a wave into a deterministic ordered timeline of spawn events.
 * Returns array of { t, unitId, domain, tier, waveId } sorted by time then
 * by a stable tiebreak (group order, then index) so replays match exactly.
 */
export function buildTimeline(wave) {
  const events = [];
  wave.groups.forEach((g, gi) => {
    for (let i = 0; i < g.count; i++) {
      events.push({
        t: g.delay + i * g.interval,
        unitId: g.unitId,
        domain: g.domain,
        tier: g.tier || 1,
        waveId: wave.id,
        _gi: gi,
        _i: i,
      });
    }
  });
  events.sort((a, b) => {
    if (a.t !== b.t) return a.t - b.t;
    if (a._gi !== b._gi) return a._gi - b._gi;
    return a._i - b._i;
  });
  return events;
}

/** Total number of individual units in a wave (used by HUD / progress). */
export function waveUnitCount(wave) {
  return wave.groups.reduce((sum, g) => sum + g.count, 0);
}

/** Look up a wave by 1-based ordinal index; null if out of range. */
export function getWave(index) {
  return WAVES[index] || null;
}

export default {
  WIN_WAVES,
  PREP_TIME,
  INTERWAVE_TIME,
  DOMAINS,
  WAVES,
  buildTimeline,
  waveUnitCount,
  getWave,
};