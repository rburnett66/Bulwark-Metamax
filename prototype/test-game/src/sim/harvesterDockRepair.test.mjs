// Owner 2026-11-12 [MM-story_mwel9hhv_b]: "when harvesters return to base to offload resources they get some repairs".
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignMap, resolveResourceTypes } from './mapgen.js';
import { createSim, applyCommand, stepSim } from './core.js';
import { dockRepair } from './harvest.js';
import { HARVESTER_DOCK_REPAIR_FRAC } from '../data/tables.js';

const fresh = () => { const map = resolveResourceTypes(buildCampaignMap(1, { seed: 2 }), 1); const s = createSim(5, { map, waves: [] }); s.waves.current = 8; return s; };

test('a damaged truck that unloads comes back out repaired by a quarter of its max HP', () => {
  assert.equal(HARVESTER_DOCK_REPAIR_FRAC, 0.25);
  const s = fresh();
  const hv = s.units.get(s.harvesterId);
  const node = s.resourceNodes.filter((n) => n.role === 'primary').sort((a, b) => b.units - a.units)[0];
  assert.ok(applyCommand(s, { type: 'harvest', nodeId: node.id }).ok);
  hv.hp = Math.round(hv.maxHp * 0.4);
  let deposit = null, repair = null, hpAtDeposit = null;
  for (let i = 0; i < 30 * 240 && !repair; i++) for (const e of stepSim(s, 1 / 30)) {
    if (e.type === 'deposit' && !deposit) deposit = e;
    if (e.type === 'harvesterRepair') { repair = e; hpAtDeposit = e.hp - e.amount; }
  }
  assert.ok(deposit && repair, 'the unload landed and repaired the truck');
  assert.equal(repair.id, hv.id);
  assert.ok(Math.abs(repair.amount - hv.maxHp * 0.25) < 1e-9);
  assert.ok(Math.abs(hpAtDeposit - Math.round(hv.maxHp * 0.4)) < 1e-9, 'no repair on the drive home, only at the unload');
});

test('the repair never passes max HP, and a full-health truck gets none', () => {
  const s = fresh(); const hv = s.units.get(s.harvesterId);
  hv.hp = hv.maxHp - 1;
  assert.equal(dockRepair(s, hv), 1);
  assert.equal(hv.hp, hv.maxHp);
  assert.equal(dockRepair(s, hv), 0, 'full: nothing');
  hv.hp = 0;
  assert.equal(dockRepair(s, hv), 0, 'a dead truck is not repaired');
});
