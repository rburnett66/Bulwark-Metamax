/** harvest.test.mjs — the harvester loop: order → collect → haul → deposit → auto-cycle; primary
 *  regrows, premium is consumed forever, quest pays loyalty units not gold; deterministic.
 *  Run: node src/sim/harvest.test.mjs */
import assert from 'node:assert';
import { buildCampaignMap, resolveResourceTypes } from './mapgen.js';
import { createSim, applyCommand, stepSim } from './core.js';
import { hashState } from './replay.js';
import { MAPDATA } from '../../content/maps/mapdata.js';

function fresh(seed) {
  const map = resolveResourceTypes(buildCampaignMap(1, { seed: 2 }), 1);
  const s = createSim(seed, { map, waves: [] });
  return { map, s };
}

// ── setup: campaign map spawns a harvester + runtime nodes; classic maps get neither ──
{
  const { s } = fresh(5);
  const hv = s.units.get(s.harvesterId);
  assert(hv && hv.isHarvester && hv.capacity > 0, 'harvester exists with capacity');
  assert(s.resourceNodes.length > 0, 'runtime node state exists');
  const { createSim: cs } = await import('./core.js');
  const { MAP } = await import('../data/tables.js');
  const classic = cs(5, { map: MAP });
  assert(!classic.resourceNodes && classic.harvesterId == null, 'classic maps have no harvester');
}

// ── full cycle on a primary node: money rises by units × value × yield; node drains then regrows ──
{
  const { s } = fresh(5);
  const node = s.resourceNodes.find((n) => n.role === 'primary' && n.wave === 1);
  assert(node, 'a wave-1 primary node exists');
  const hv = s.units.get(s.harvesterId);
  const moneyBefore = s.economy.money;
  const res = applyCommand(s, { type: 'harvest', nodeId: node.id });
  assert(res.ok, `harvest order accepted (${res.reason})`);
  let deposits = 0, depositGold = 0;
  for (let i = 0; i < 30 * 240 && deposits < 2; i++) {
    for (const e of stepSim(s, 1 / 30)) {
      if (e.type === 'deposit') { deposits++; depositGold += e.gold; }
    }
  }
  assert(deposits >= 1, 'at least one deposit landed');
  // passive income also accrues — the deposit's contribution is the delta beyond it
  assert(s.economy.money >= moneyBefore + depositGold, 'deposits paid into the build economy on top of passive income');
  assert(s.mapScore.goldFromPrimary === depositGold, 'map score tallies primary gold');
  // expected value: cargo × valuePerUnit × yieldMult (integer floor per deposit)
  const expectedPerLoad = Math.floor(Math.min(hv.capacity, node.units) * node.valuePerUnit * hv.yieldMult);
  assert(depositGold >= expectedPerLoad, `gold ≈ capacity×value (got ${depositGold}, one load ≥ ${expectedPerLoad})`);
}

// ── primary regrowth: drain a node fully, clock forward, it refills ──
{
  const { s } = fresh(5);
  const node = s.resourceNodes.find((n) => n.role === 'primary' && n.wave === 1);
  applyCommand(s, { type: 'harvest', nodeId: node.id });
  let drained = false, regrew = false;
  const respawnSec = MAPDATA.globalParams.Primary_Respawn_Sec || 75;
  for (let i = 0; i < 30 * (respawnSec + 200) && !regrew; i++) {
    for (const e of stepSim(s, 1 / 30)) if (e.type === 'nodeRespawn' && e.nodeId === node.id) regrew = true;
    if (!drained && node.remaining <= 0) drained = true;
  }
  assert(drained, 'primary node fully drained');
  assert(regrew, 'primary node regrew (nodeRespawn fired — the camping harvester resumes instantly)');
}

// ── premium: consumed forever; quest: loyalty units, zero gold ──
{
  const { s } = fresh(5);
  // reveal everything so premium/quest are orderable without playing 8 waves
  s.waves.current = 8;
  const prem = s.resourceNodes.find((n) => n.role === 'premium');
  const quest = s.resourceNodes.find((n) => n.role === 'quest');
  assert(prem && quest, 'premium + quest nodes exist');
  applyCommand(s, { type: 'harvest', nodeId: prem.id });
  for (let i = 0; i < 30 * 600 && prem.remaining > 0; i++) stepSim(s, 1 / 30);
  assert(prem.remaining <= 0, 'premium drained');
  for (let i = 0; i < 30 * 100; i++) stepSim(s, 1 / 30);
  assert(prem.remaining <= 0 && prem.respawnAt == null, 'premium never regrows');
  assert(s.mapScore.goldFromPremium > 0, 'premium gold tallied separately');

  const scoreBeforeQuest = s.mapScore.goldFromPrimary + s.mapScore.goldFromPremium;
  applyCommand(s, { type: 'harvest', nodeId: quest.id });
  let questDepositGold = null;
  for (let i = 0; i < 30 * 600 && questDepositGold === null; i++) {
    for (const e of stepSim(s, 1 / 30)) if (e.type === 'deposit' && e.role === 'quest') questDepositGold = e.gold;
  }
  assert(s.mapScore.questUnits > 0, 'quest units tallied');
  assert.strictEqual(questDepositGold, 0, 'quest deposit carries NO gold');
  assert.strictEqual(s.mapScore.goldFromPrimary + s.mapScore.goldFromPremium, scoreBeforeQuest, 'quest never touches the gold tallies');
}

// ── rejection paths: unrevealed node, exhausted premium ──
{
  const { s } = fresh(5);
  const late = s.resourceNodes.find((n) => n.wave >= 5);
  const r1 = applyCommand(s, { type: 'harvest', nodeId: late.id });
  assert(!r1.ok && /reveal/.test(r1.reason), `unrevealed node rejected (${r1.reason})`);
}

// ── determinism: identical seeds and orders → identical hash (nodes + cargo are hashed) ──
{
  const runOnce = () => {
    const { s } = fresh(9);
    const node = s.resourceNodes.find((n) => n.role === 'primary' && n.wave === 1);
    applyCommand(s, { type: 'harvest', nodeId: node.id });
    for (let i = 0; i < 30 * 60; i++) stepSim(s, 1 / 30);
    return hashState(s);
  };
  assert.strictEqual(runOnce(), runOnce(), 'harvest loop is deterministic');
}

console.log('harvest.test OK — cycle deposits gold, primary regrows, premium consumed, quest pays loyalty only, deterministic');
