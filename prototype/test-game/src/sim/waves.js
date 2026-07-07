function makeWaves(config, world) {
  const tables = config.data.tables;
  const waveData = tables.waves || {};
  const schedule = waveData.schedule || defaultSchedule();

  return {
    schedule,
    totalWaves: waveData.totalWaves || schedule.length,
  };
}

function defaultSchedule() {
  // Fallback schedule referencing Ground/Powder faction units.
  return [
    { wave: 1, spawns: [
      { unit: 'GND-Troops', count: 4, interval: 1.2, lane: 'ground' },
    ]},
    { wave: 2, spawns: [
      { unit: 'GND-Troops', count: 5, interval: 1.0, lane: 'ground' },
      { unit: 'GND-Trucks', count: 2, interval: 2.0, lane: 'ground' },
    ]},
    { wave: 3, spawns: [
      { unit: 'GND-Tanks', count: 3, interval: 2.0, lane: 'ground' },
      { unit: 'GND-Copters', count: 2, interval: 2.5, lane: 'air' },
    ]},
    { wave: 4, spawns: [
      { unit: 'GND-Troops', count: 6, interval: 0.9, lane: 'ground' },
      { unit: 'GND-Artillery', count: 2, interval: 3.0, lane: 'ground' },
      { unit: 'GND-Planes', count: 2, interval: 2.5, lane: 'air' },
    ]},
    { wave: 5, spawns: [
      { unit: 'GND-HeavyTanks', count: 3, interval: 2.5, lane: 'ground' },
      { unit: 'GND-Missiles', count: 3, interval: 2.0, lane: 'air' },
      { unit: 'GND-Copters', count: 2, interval: 3.0, lane: 'air' },
    ]},
  ];
}

/**
 * Waves subsystem — deterministic wave lifecycle.
 * State model (lives inside world.waves):
 *   phase: 'idle' | 'spawning' | 'active' | 'won' | 'lost'
 *   current: current wave number (0 = none started)
 *   totalWaves: N to survive
 *   queue: pending spawn events for the active wave [{unit, lane, at}]
 *   spawnCursor: index into queue
 *   timer: accumulated wave-local time (seconds)
 *   spawnedCount / this-wave counters
 */

export function initWaveState(config) {
  const tables = config.data.tables;
  const waveData = tables.waves || {};
  const schedule = waveData.schedule || defaultSchedule();
  const totalWaves = waveData.totalWaves || schedule.length;
  return {
    phase: 'idle',
    current: 0,
    totalWaves,
    schedule,
    queue: [],
    spawnCursor: 0,
    timer: 0,
    spawnedThisWave: 0,
    result: null, // 'win' | 'lose' | null
  };
}

/**
 * Begin the next wave. Called by the startWave command reducer.
 * Returns list of events (for battle log).
 */
export function startWave(world) {
  const ws = world.waves;
  const events = [];
  if (ws.phase === 'won' || ws.phase === 'lost') return events;
  if (ws.phase === 'spawning' || ws.phase === 'active') return events;
  if (ws.current >= ws.totalWaves) return events;

  const idx = ws.current; // 0-based into schedule for the wave about to start
  const entry = ws.schedule[idx];
  ws.current += 1;
  ws.phase = 'spawning';
  ws.timer = 0;
  ws.spawnCursor = 0;
  ws.spawnedThisWave = 0;

  const queue = [];
  if (entry && entry.spawns) {
    for (const s of entry.spawns) {
      const count = s.count || 1;
      const interval = s.interval != null ? s.interval : 1.0;
      const startAt = s.delay || 0;
      for (let i = 0; i < count; i++) {
        queue.push({
          unit: s.unit,
          lane: s.lane || 'ground',
          at: startAt + i * interval,
        });
      }
    }
  }
  // Deterministic ordering: sort by spawn time, then by unit id.
  queue.sort((a, b) => (a.at - b.at) || (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0));
  ws.queue = queue;

  events.push({ type: 'waveStart', wave: ws.current });
  return events;
}

/**
 * Advance wave logic by dt seconds.
 * spawnFn(unitId, lane) → spawns an attacker entity in the world.
 * Returns array of events.
 */
export function stepWaves(world, dt, spawnFn) {
  const ws = world.waves;
  const events = [];

  if (ws.phase === 'won' || ws.phase === 'lost') return events;

  // Lose check: base HP depleted (checked every tick regardless of phase).
  if (baseDead(world)) {
    ws.phase = 'lost';
    ws.result = 'lose';
    events.push({ type: 'gameOver', result: 'lose' });
    return events;
  }

  if (ws.phase === 'spawning') {
    ws.timer += dt;
    while (ws.spawnCursor < ws.queue.length && ws.queue[ws.spawnCursor].at <= ws.timer) {
      const ev = ws.queue[ws.spawnCursor];
      ws.spawnCursor += 1;
      ws.spawnedThisWave += 1;
      if (typeof spawnFn === 'function') {
        spawnFn(ev.unit, ev.lane);
      }
      events.push({ type: 'spawn', unit: ev.unit, lane: ev.lane, wave: ws.current });
    }
    if (ws.spawnCursor >= ws.queue.length) {
      ws.phase = 'active';
      events.push({ type: 'waveSpawnComplete', wave: ws.current });
    }
  } else if (ws.phase === 'active') {
    // Wave is over when all attackers are cleared from the world.
    if (attackersRemaining(world) === 0) {
      events.push({ type: 'waveClear', wave: ws.current });
      if (ws.current >= ws.totalWaves) {
        ws.phase = 'won';
        ws.result = 'win';
        events.push({ type: 'gameOver', result: 'win' });
      } else {
        ws.phase = 'idle';
      }
    }
  }

  return events;
}

function baseDead(world) {
  const base = world.base;
  if (!base) return false;
  return base.hp <= 0;
}

function attackersRemaining(world) {
  let n = 0;
  const ents = world.entities || [];
  for (const e of ents) {
    if (e && e.side === 'attacker' && e.alive !== false && e.hp > 0) n++;
  }
  return n;
}

/** Convenience queries for HUD */
export function waveLabel(world) {
  const ws = world.waves;
  return `${ws.current}/${ws.totalWaves}`;
}

export function isGameOver(world) {
  const ws = world.waves;
  return ws.phase === 'won' || ws.phase === 'lost';
}

export function canStartWave(world) {
  const ws = world.waves;
  return (ws.phase === 'idle') && ws.current < ws.totalWaves;
}

export default {
  initWaveState,
  startWave,
  stepWaves,
  waveLabel,
  isGameOver,
  canStartWave,
  makeWaves,
};