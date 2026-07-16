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
  s.waves.current = 8;   // ring seeding (2026-07-15): reveal the whole board — this block tests the
                         // ECONOMY math, not the reveal; a ring-spanning field would short the load
  // pick the RICHEST primary cell so one truckload fills (crop-clear near base 2026-07-16 removed
  // the small near-base fields; a single sparse cell would under-fill the load)
  const node = s.resourceNodes.filter((n) => n.role === 'primary')
    .sort((a, b) => b.units - a.units)[0];
  assert(node, 'a primary node exists');
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
  // expected value: cargo × valuePerUnit × yieldMult; per-TICK flooring accumulates a small
  // shortfall across the pull, so allow a couple of gold of rounding slack
  const expectedPerLoad = Math.floor(Math.min(hv.capacity, node.units) * node.valuePerUnit * hv.yieldMult);
  assert(depositGold >= expectedPerLoad - 3, `gold ≈ capacity×value (got ${depositGold}, one load ≈ ${expectedPerLoad})`);
}

// ── FIELDS: one order works the whole connected patch; a DRAINED field AUTO-CONTINUES onto the
//    nearest field of the SAME resource (owner 2026-07-17); with none left → deliver, rest HOME ──
{
  const { s } = fresh(5);
  s.waves.current = 8;   // reveal the board — this block tests field DRAIN mechanics, not ring gating
  const hv = s.units.get(s.harvesterId);
  // primaries are placed as 1-2 cell fields — find a 2-cell one (open play: any wave is workable)
  const byField = {};
  for (const n of s.resourceNodes.filter((n) => n.role === 'primary')) {
    (byField[n.fieldId] = byField[n.fieldId] || []).push(n);
  }
  // the SMALLEST multi-cell field WHOSE RESOURCE HAS ANOTHER FIELD to hop to: a big merged patch
  // never reads all-empty at one instant, so the clean drain→hop cycle needs a small one
  const fieldsAll = Object.values(byField);
  const typeCount = {};
  for (const f of fieldsAll) typeCount[f[0].type] = (typeCount[f[0].type] || 0) + 1;
  const field = fieldsAll.filter((f) => f.length >= 2 && typeCount[f[0].type] >= 2)
    .sort((a, b) => a.length - b.length)[0];
  assert(field, 'a multi-cell primary field with a same-resource sibling exists on the map');
  const fid = field[0].fieldId;
  applyCommand(s, { type: 'harvest', nodeId: field[0].id });
  // the whole FIELD drains from a single order; the harvester then hops to the nearest field of
  // the same resource and keeps working — the job continues, no re-order needed
  let allDrained = false, hopped = false;
  for (let i = 0; i < 30 * 600 && !hopped; i++) {
    stepSim(s, 1 / 30);
    if (!allDrained && field.every((n) => n.remaining <= 0)) allDrained = true;
    if (allDrained && hv.fieldId && hv.fieldId !== fid) hopped = true;
  }
  assert(allDrained, 'one order drained every cell of the field');
  assert(hopped, 'drained field → auto-continued onto the nearest same-resource field');
  const hopField = s.resourceNodes.find((n) => n.fieldId === hv.fieldId);
  assert(hopField && hopField.type === field[0].type && hopField.color === field[0].color,
    'the hop stays on the SAME resource (type + crystal colour)');
  // with every OTHER same-resource field stripped (regrowth off), a drained field ends the job:
  // deliver, dock, WAIT — idle is only for "nothing of this resource left anywhere"
  for (const n of s.resourceNodes) {
    n.respawns = false; n.respawnAt = null;
    if (n.role === 'primary' && n.fieldId !== hv.fieldId) n.remaining = 0;
  }
  let restedHome = false;
  for (let i = 0; i < 30 * 600 && !restedHome; i++) {
    stepSim(s, 1 / 30);
    if (hv.state === 'harvestIdle'
        && Math.hypot(hv.pos.x - hv.homePos.x, hv.pos.y - hv.homePos.y) < 0.5) restedHome = true;
  }
  assert(restedHome, 'no same-resource field left → delivered and rested at the dock');
  assert(hv.fieldId == null, 'the job is over — assignment cleared');
  // a fresh explicit order redeploys the docked truck
  const target = s.resourceNodes.find((n) => n.fieldId === fid);
  target.remaining = target.units;   // hand-regrow one cell so there is something to order onto
  const again = applyCommand(s, { type: 'harvest', nodeId: target.id, harvesterId: hv.id });
  assert(again.ok && hv.state === 'harvestGo', 'explicit order (harvesterId) redeploys the docked truck');
}

// ── premium: consumed forever; quest: loyalty units, zero gold ──
{
  const { s } = fresh(5);
  // reveal everything so premium/quest are orderable without playing 8 waves
  s.waves.current = 8;
  const prem = s.resourceNodes.find((n) => n.role === 'premium');
  const quest = s.resourceNodes.find((n) => n.role === 'quest');
  assert(prem && quest, 'premium + quest nodes exist');
  // strip EVERY other node so the drain has nothing to auto-continue OR auto-gather onto — this
  // block tests one-shot depletion + release; the hop and idle auto-gather are covered elsewhere
  for (const n of s.resourceNodes) { if (n.fieldId !== prem.fieldId) n.remaining = 0; n.respawns = false; n.respawnAt = null; }
  applyCommand(s, { type: 'harvest', nodeId: prem.id });
  const premField = s.resourceNodes.filter((n) => n.fieldId === prem.fieldId);
  for (let i = 0; i < 30 * 900 && premField.some((n) => n.remaining > 0); i++) stepSim(s, 1 / 30);
  assert(premField.every((n) => n.remaining <= 0), 'premium field drained');
  const hv = s.units.get(s.harvesterId);
  for (let i = 0; i < 30 * 100; i++) stepSim(s, 1 / 30);
  assert(prem.remaining <= 0 && prem.respawnAt == null, 'premium never regrows');
  assert(s.mapScore.goldFromPremium > 0, 'premium gold tallied separately');
  // once a one-shot field is stripped, the job is OVER: assignment cleared, resting at home
  assert(hv.fieldId == null && hv.state === 'harvestIdle', 'harvester released from the stripped premium field');
  assert(Math.hypot(hv.pos.x - hv.homePos.x, hv.pos.y - hv.homePos.y) < 0.5, 'harvester rests at base until redeployed');

  // revive the quest field (stripped above to isolate the release test) for the quest-economy phase
  for (const n of s.resourceNodes) if (n.fieldId === quest.fieldId) n.remaining = n.units;
  applyCommand(s, { type: 'harvest', nodeId: quest.id });
  let questDeposit = null;
  for (let i = 0; i < 30 * 600 && questDeposit === null; i++) {
    for (const e of stepSim(s, 1 / 30)) if (e.type === 'deposit' && e.role === 'quest') questDeposit = e;
  }
  // owner color economy: red/green count as HEADER quest objectives AND still pay gold
  assert(questDeposit && questDeposit.gold > 0, 'quest haul pays gold too');
  assert(s.mapScore.questUnits > 0, 'quest units tallied');
  assert(s.mapScore.questRed + s.mapScore.questGreen === s.mapScore.questUnits, 'quest split by crystal color');
  assert(['red', 'green'].includes(questDeposit.color), 'quest deposit carries its crystal color');
}

// ── RING SEEDING (owner, 2026-07-15): resources arrive WITH their wave — a late-ring node is NOT
//    harvestable at wave 1 even in open play; advancing the wave reveals it. Push into the map. ──
{
  const { s } = fresh(5);
  const late = s.resourceNodes.find((n) => n.wave >= 5);
  const r1 = applyCommand(s, { type: 'harvest', nodeId: late.id });
  assert(!r1.ok && /reveal/.test(r1.reason), `late-ring node rejected at wave 1 (${r1.reason})`);
  s.waves.current = late.wave;   // its ring has opened
  const r2 = applyCommand(s, { type: 'harvest', nodeId: late.id });
  assert(r2.ok, `same node orderable once its wave arrives (${r2.reason || 'ok'})`);
  const early = s.resourceNodes.find((n) => n.wave === 1);
  assert(early.remaining === early.units, 'wave-1 fields carried untouched across the waves');
}

// ── HARVESTOR bay: 500g buys a new harvester (recovery after death / second field) ──
{
  const { s } = fresh(5);
  s.economy.money = 5000;
  const first = s.units.get(s.harvesterId);
  first.hp = 0;                                    // the harvester dies
  for (let i = 0; i < 5; i++) stepSim(s, 1 / 30);  // cleanup runs
  const dead = applyCommand(s, { type: 'harvest', nodeId: s.resourceNodes[0].id });
  assert(!dead.ok && /Harvestor/.test(dead.reason), `no fleet -> helpful rejection (${dead.reason})`);
  // buy a replacement via the build palette
  const pocket = s.map.rings[0].rect;
  const moneyBefore = s.economy.money;
  const placed = applyCommand(s, { type: 'place', structId: 'STR-Harvestor', cell: { x: pocket.x0 + 2, y: pocket.y0 + 2 } });
  assert(placed.ok, `Harvestor bay placed (${placed.reason})`);
  assert(s.economy.money <= moneyBefore - 500, 'bay cost 500 gold');
  let built = null;
  for (let i = 0; i < 30 * 20 && !built; i++) {
    for (const e of stepSim(s, 1 / 30)) if (e.type === 'harvesterBuilt') built = e;
  }
  assert(built, 'bay converted into a new harvester');
  assert(s.harvesterIds.length === 1 && s.units.get(s.harvesterIds[0]).isHarvester, 'fleet has the new harvester');
  assert(![...s.structures.values()].some((x) => x.structId === 'STR-Harvestor'), 'bay structure freed the cell');
  const again = applyCommand(s, { type: 'harvest', nodeId: s.resourceNodes.find((n) => n.remaining > 0).id });
  assert(again.ok, 'harvesting works again with the bought harvester');
  // classic map: the bay is rejected (no resources to harvest)
  const { MAP } = await import('../data/tables.js');
  const classic = createSim(5, { map: MAP });
  classic.economy.money = 5000;
  const rc = applyCommand(classic, { type: 'place', structId: 'STR-Harvestor', cell: { x: 10, y: 10 } });
  assert(!rc.ok && /resources/.test(rc.reason), `classic map rejects the bay (${rc.reason})`);
}

// ── FIELD = CONNECTIVITY: any two touching same-role cells share a fieldId (abutting generator
//    clusters merge — the "harvester stopped after 2 cells of a big field" bug) ──
{
  const { s } = fresh(5);
  const byCell = new Map(s.resourceNodes.map((n) => [`${n.x},${n.y}`, n]));
  for (const n of s.resourceNodes) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nb = byCell.get(`${n.x + dx},${n.y + dy}`);
        if (nb && nb.role === n.role) {
          assert.strictEqual(nb.fieldId, n.fieldId,
            `touching same-role cells share a field (${n.id}@${n.x},${n.y} vs ${nb.id}@${nb.x},${nb.y})`);
        }
      }
    }
  }
}

// ── CRUSH RULE: building on a resource destroys it forever — even a regrowing primary ──
{
  const { s } = fresh(5);
  s.economy.money = 100000;
  const node = s.resourceNodes.find((n) => n.role === 'primary' && n.respawns);
  const placed = applyCommand(s, { type: 'place', structId: 'STR-Wall', cell: { x: node.x, y: node.y } });
  assert(placed.ok, `structure placed on the crystal (${placed.reason})`);
  assert(node.remaining === 0 && node.respawns === false, 'crystal destroyed on placement');
  for (let i = 0; i < 30 * 200; i++) stepSim(s, 1 / 30);
  assert(node.remaining === 0 && node.respawnAt == null, 'crushed crystal never grows back');
  const order = applyCommand(s, { type: 'harvest', nodeId: node.id });
  if (!order.ok) assert(/exhaust/.test(order.reason), `crushed single-cell field rejects orders (${order.reason})`);
}

// ── DOCKS + CAP: harvesters spawn at the 4 base docks (top/bottom/left/right) in order; cap 4 ──
{
  const { s } = fresh(5);
  s.economy.money = 100000;
  const { dockCells } = await import('./harvest.js');
  const docks = dockCells(s.map);
  const first = s.units.get(s.harvesterId);
  assert.deepStrictEqual({ x: first.homePos.x, y: first.homePos.y }, docks[0], 'starting harvester docks at position 1');
  // buy up to the cap: 3 more bays convert; each takes the next open dock
  const pocket = s.map.rings[0].rect;
  const spots = [{ x: pocket.x0 + 1, y: pocket.y0 + 1 }, { x: pocket.x0 + 3, y: pocket.y0 + 1 }, { x: pocket.x1 - 1, y: pocket.y1 - 1 }];
  for (const c of spots) {
    const r = applyCommand(s, { type: 'place', structId: 'STR-Harvestor', cell: c });
    assert(r.ok, `bay placed at ${c.x},${c.y} (${r.reason})`);
  }
  for (let i = 0; i < 30 * 30 && s.harvesterIds.length < 4; i++) stepSim(s, 1 / 30);
  assert.strictEqual(s.harvesterIds.length, 4, 'fleet reached the cap of 4');
  const homes = s.harvesterIds.map((id) => { const u = s.units.get(id); return `${u.homePos.x},${u.homePos.y}`; });
  assert.strictEqual(new Set(homes).size, 4, 'each harvester has its own dock');
  const fifth = applyCommand(s, { type: 'place', structId: 'STR-Harvestor', cell: { x: pocket.x0 + 5, y: pocket.y0 + 1 } });
  assert(!fifth.ok && /cap/.test(fifth.reason), `fifth bay rejected at the cap (${fifth.reason})`);
}

// ── NO FRIENDLY FIRE: the base super-cannon's blast never hurts a harvester in the radius ──
{
  const { s } = fresh(5);
  const hv = s.units.get(s.harvesterId);
  const c = s.base.cannon;
  c.aimPos = { x: hv.pos.x, y: hv.pos.y };   // shell lands ON the docked harvester
  c.phase = 'flight'; c.timer = 0;
  const hpBefore = hv.hp;
  stepSim(s, 1 / 30);                        // impact resolves this tick
  assert.strictEqual(hv.hp, hpBefore, 'harvester untouched by the base cannon blast');
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

console.log('harvest.test OK — docks+cap, explicit orders, all colors pay gold, red/green quest counters, wait-for-orders, deterministic');

// ── RESERVATION + IDLE AUTO-GATHER (story-mrmwiikd60b + owner rule 2026-07-16) ──
{
  const { s } = fresh(5);
  s.waves.current = 8;   // reveal the board
  // IDLE AUTO-GATHER: the starting truck dispatches itself with NO order given
  const hv = s.units.get(s.harvesterId);
  for (let i = 0; i < 30 * 10 && hv.state === 'harvestIdle'; i++) stepSim(s, 1 / 30);
  assert(hv.state !== 'harvestIdle' && hv.harvestNodeId, 'idle truck auto-dispatches to the closest resource');
  // RESERVATION: a second truck must never claim the cell the first is working
  const res = applyCommand(s, { type: 'buyHarvester' });
  assert(res.ok, 'second harvester purchased');
  const hv2 = [...s.units.values()].find((u) => u.isHarvester && u.id !== hv.id);
  let overlap = false;
  for (let i = 0; i < 30 * 120 && !overlap; i++) {
    stepSim(s, 1 / 30);
    const bothWorking = ['harvestGo', 'harvestPull'].includes(hv.state) && ['harvestGo', 'harvestPull'].includes(hv2.state);
    if (bothWorking && hv.harvestNodeId && hv.harvestNodeId === hv2.harvestNodeId) overlap = true;
  }
  assert(!overlap, 'two working trucks never claim the same node (reservation holds)');
}
