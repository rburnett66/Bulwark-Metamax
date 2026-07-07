import { TABLES } from '../data/tables.js';
import { mulberry32 } from './rng.js';
import { SimCore } from './core.js';

// ---------------------------------------------------------------------------
// Balance-sim harness.
//
// Runs automated headless battles on the fixed board using the SAME SimCore
// code path as live game combat.  For each unit in the vertical-slice roster
// it measures damage actually dealt per second of engagement across many
// seeded battles, derives price = averaged DPS * Cost_per_power_gold /
// DPS_per_point (so price tracks the data-table power budget), and reports
// how prices stabilize as more seeded battles accumulate.
// ---------------------------------------------------------------------------

const DEFAULT_BATTLES = 100;
const MAX_TICKS_PER_BATTLE = 60 * 60 * 4; // 4 sim-minutes at 60hz safety cap

function assumptions() {
  return (TABLES && TABLES.assumptions) || {};
}

function goldPerPower() {
  const a = assumptions();
  return a.Cost_per_power_gold != null ? a.Cost_per_power_gold : 3;
}

function dpsPerPoint() {
  const a = assumptions();
  return a.DPS_per_point != null ? a.DPS_per_point : 1.5;
}

function rosterUnits() {
  const units = (TABLES && TABLES.units) || [];
  // Vertical slice: Ground/Powder faction roster.
  return units.filter(function (u) {
    return !u.faction || /ground/i.test(String(u.faction));
  });
}

// ---------------------------------------------------------------------------
// Scripted AI: deterministic automated player used for every harness battle.
// Places one anti-ground tower, one anti-air tower and a wall when affordable,
// then starts waves as soon as they are available.  All decisions flow through
// core.step(input) commands — the exact command surface the live game uses.
// ---------------------------------------------------------------------------
function makeScriptedPlayer(rng) {
  let placedGround = false;
  let placedAir = false;
  let placedWall = false;
  let upgraded = false;
  let waveRequestedTick = -1;

  return function decide(core, tick) {
    const state = core.getState();
    const commands = [];
    const money = state.economy ? state.economy.money : (state.money || 0);
    const slots = (state.grid && state.grid.slots) || state.slots || [];

    function freeSlot() {
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (!s.occupied && !s.structureId) return s;
      }
      return null;
    }

    function structDef(matcher) {
      const defs = (TABLES && TABLES.structures) || [];
      for (let i = 0; i < defs.length; i++) {
        if (matcher(defs[i])) return defs[i];
      }
      return null;
    }

    if (!placedGround) {
      const def = structDef(function (d) {
        return /anti[-_ ]?ground/i.test(d.id || d.name || '');
      });
      const slot = freeSlot();
      if (def && slot && money >= (def.costT1 || def.cost || 0)) {
        commands.push({ type: 'place', structureId: def.id, slot: slot.id != null ? slot.id : slot.index, x: slot.x, y: slot.y });
        placedGround = true;
      }
    } else if (!placedAir) {
      const def = structDef(function (d) {
        return /anti[-_ ]?air/i.test(d.id || d.name || '');
      });
      const slot = freeSlot();
      if (def && slot && money >= (def.costT1 || def.cost || 0)) {
        commands.push({ type: 'place', structureId: def.id, slot: slot.id != null ? slot.id : slot.index, x: slot.x, y: slot.y });
        placedAir = true;
      }
    } else if (!placedWall && rng() < 0.6) {
      const def = structDef(function (d) {
        return /wall|moat/i.test(d.id || d.name || '');
      });
      const slot = freeSlot();
      if (def && slot && money >= (def.costT1 || def.cost || 0)) {
        commands.push({ type: 'place', structureId: def.id, slot: slot.id != null ? slot.id : slot.index, x: slot.x, y: slot.y });
        placedWall = true;
      }
    } else if (!upgraded) {
      const structures = (state.structures || []).filter(function (s) {
        return s.state === 'Complete' && (s.tier || 1) === 1;
      });
      if (structures.length > 0 && money >= (structures[0].upgradeCost || 0)) {
        commands.push({ type: 'upgrade', id: structures[0].id });
        upgraded = true;
      }
    }

    // Keep the battle moving: start the next wave whenever one is pending.
    const wave = state.wave || state.waves || {};
    const waveActive = wave.active || wave.inProgress;
    const done = state.result || state.status === 'won' || state.status === 'lost';
    if (!waveActive && !done && tick > waveRequestedTick + 30) {
      commands.push({ type: 'startWave' });
      waveRequestedTick = tick;
    }
    return commands;
  };
}

// ---------------------------------------------------------------------------
// Single automated battle: returns per-unit-id damage totals + alive seconds.
// ---------------------------------------------------------------------------
function runBattle(seed) {
  const core = new SimCore(seed);
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const decide = makeScriptedPlayer(rng);

  // Per unit kind: total damage dealt, total seconds of active combat life.
  const stats = {};
  function statFor(kind) {
    if (!stats[kind]) stats[kind] = { damage: 0, seconds: 0, spawns: 0, kills: 0 };
    return stats[kind];
  }

  const dt = core.dt || 1 / 60;
  let ticks = 0;
  let finished = false;
  let result = 'timeout';

  while (!finished && ticks < MAX_TICKS_PER_BATTLE) {
    const commands = decide(core, ticks);
    const out = core.step(commands.length ? { commands: commands } : { commands: [] });
    const state = core.getState();
    const events = (out && out.events) || state.events || [];

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev) continue;
      if (ev.type === 'damage' && ev.sourceKind) {
        statFor(ev.sourceKind).damage += ev.amount || 0;
      } else if (ev.type === 'spawn' && ev.kind) {
        statFor(ev.kind).spawns += 1;
      } else if (ev.type === 'kill' && ev.sourceKind) {
        statFor(ev.sourceKind).kills += 1;
      }
    }

    // Accumulate alive-seconds for every live attacker unit.
    const units = state.units || state.attackers || [];
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!u || u.hp <= 0) continue;
      const kind = u.kind || u.unitId || u.type;
      if (kind) statFor(kind).seconds += dt;
    }

    if (state.result === 'win' || state.result === 'lose' ||
        state.status === 'won' || state.status === 'lost' ||
        (state.base && state.base.hp <= 0)) {
      result = state.result || state.status || 'lose';
      finished = true;
    }
    ticks++;
  }

  return {
    seed: seed,
    ticks: ticks,
    result: result,
    stats: stats,
    hash: typeof core.getHash === 'function' ? core.getHash() : (typeof core.hash === 'function' ? core.hash() : null),
  };
}

// ---------------------------------------------------------------------------
// Price derivation: measured average DPS across battles -> gold price.
// Falls back to table DPS when a unit never appears in a battle (keeps the
// report complete for the full roster).
// ---------------------------------------------------------------------------
function derivePrices(perUnitAccum) {
  const gpp = goldPerPower();
  const dpp = dpsPerPoint();
  const prices = {};
  const roster = rosterUnits();
  for (let i = 0; i < roster.length; i++) {
    const u = roster[i];
    const id = u.id || u.unitId;
    const acc = perUnitAccum[id];
    let avgDps;
    if (acc && acc.seconds > 0.5) {
      avgDps = acc.damage / acc.seconds;
    } else {
      avgDps = u.dpsT1 != null ? u.dpsT1 : (u.dps || 0);
    }
    // price = DPS expressed in power points * gold-per-power
    const dpsPoints = avgDps / dpp;
    prices[id] = {
      avgDps: avgDps,
      price: Math.round(dpsPoints * gpp),
      tablePrice: u.costT1 != null ? u.costT1 : u.cost,
    };
  }
  return prices;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function runHarness(options) {
  const opts = options || {};
  const battles = opts.battles != null ? opts.battles : DEFAULT_BATTLES;
  const baseSeed = opts.seed != null ? opts.seed : 0xB0155A17;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;

  const perUnit = {}; // id -> { damage, seconds }
  const priceHistory = []; // snapshots of derived prices over time
  const battleResults = [];
  const checkpoints = [];

  const seedRng = mulberry32(baseSeed >>> 0);

  for (let b = 0; b < battles; b++) {
    const seed = Math.floor(seedRng() * 0xffffffff) >>> 0;
    const res = runBattle(seed);
    battleResults.push({ seed: res.seed, ticks: res.ticks, result: res.result, hash: res.hash });

    const stats = res.stats;
    for (const kind in stats) {
      if (!Object.prototype.hasOwnProperty.call(stats, kind)) continue;
      if (!perUnit[kind]) perUnit[kind] = { damage: 0, seconds: 0 };
      perUnit[kind].damage += stats[kind].damage;
      perUnit[kind].seconds += stats[kind].seconds;
    }

    // Snapshot derived prices every 10 battles to observe stabilization.
    if ((b + 1) % 10 === 0 || b === battles - 1) {
      const snap = derivePrices(perUnit);
      priceHistory.push({ battle: b + 1, prices: snap });
      checkpoints.push(b + 1);
      if (onProgress) onProgress({ completed: b + 1, total: battles, prices: snap });
    }
  }

  const finalPrices = derivePrices(perUnit);
  const stabilization = computeStabilization(priceHistory, finalPrices);

  return {
    battles: battles,
    baseSeed: baseSeed >>> 0,
    results: battleResults,
    prices: finalPrices,
    priceHistory: priceHistory,
    stabilization: stabilization,
    report: formatReport(battles, finalPrices, stabilization, battleResults),
  };
}

// Max relative drift of any unit's price between consecutive checkpoints;
// prices are "stable" once drift falls under 2%.
function computeStabilization(history, finalPrices) {
  const drifts = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].prices;
    const cur = history[i].prices;
    let maxDrift = 0;
    for (const id in cur) {
      if (!Object.prototype.hasOwnProperty.call(cur, id)) continue;
      const p0 = prev[id] ? prev[id].price : 0;
      const p1 = cur[id].price;
      if (p1 > 0) {
        const d = Math.abs(p1 - p0) / p1;
        if (d > maxDrift) maxDrift = d;
      }
    }
    drifts.push({ battle: history[i].battle, maxDrift: maxDrift });
  }
  let stabilizedAt = null;
  for (let i = 0; i < drifts.length; i++) {
    if (drifts[i].maxDrift < 0.02) {
      stabilizedAt = drifts[i].battle;
      break;
    }
  }
  return { drifts: drifts, stabilizedAt: stabilizedAt, threshold: 0.02 };
}

function pad(str, n) {
  str = String(str);
  while (str.length < n) str += ' ';
  return str;
}

function formatReport(battles, prices, stabilization, results) {
  const lines = [];
  lines.push('=== BULWARK BALANCE HARNESS ===');
  lines.push('Battles run: ' + battles + ' (headless, same combat core as live game)');
  let wins = 0;
  let losses = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i].result;
    if (r === 'win' || r === 'won') wins++;
    else losses++;
  }
  lines.push('Outcomes: ' + wins + ' defender wins / ' + losses + ' losses-or-timeouts');
  lines.push('');
  lines.push(pad('UNIT', 18) + pad('AVG DPS', 10) + pad('SIM PRICE', 11) + pad('TABLE PRICE', 12) + 'DELTA');
  for (const id in prices) {
    if (!Object.prototype.hasOwnProperty.call(prices, id)) continue;
    const p = prices[id];
    const table = p.tablePrice != null ? p.tablePrice : 0;
    const delta = table > 0 ? Math.round(((p.price - table) / table) * 100) + '%' : 'n/a';
    lines.push(
      pad(id, 18) +
      pad(p.avgDps.toFixed(1), 10) +
      pad(p.price, 11) +
      pad(table, 12) +
      delta
    );
  }
  lines.push('');
  if (stabilization.stabilizedAt != null) {
    lines.push('Prices stabilized (<2% max drift) at battle ' + stabilization.stabilizedAt + '.');
  } else {
    lines.push('Prices did not fully stabilize under 2% drift within ' + battles + ' battles.');
  }
  for (let i = 0; i < stabilization.drifts.length; i++) {
    const d = stabilization.drifts[i];
    lines.push('  after ' + pad(d.battle, 4) + ' battles: max price drift ' + (d.maxDrift * 100).toFixed(2) + '%');
  }
  return lines.join('\n');
}

// Determinism spot-check: run the same seed twice and compare state hashes.
export function verifyHarnessDeterminism(seed) {
  const s = seed != null ? seed : 12345;
  const a = runBattle(s >>> 0);
  const b = runBattle(s >>> 0);
  const identical = a.hash != null && a.hash === b.hash && a.ticks === b.ticks;
  return { seed: s >>> 0, identical: identical, hashA: a.hash, hashB: b.hash, ticksA: a.ticks, ticksB: b.ticks };
}

export default { runHarness, verifyHarnessDeterminism };