// [MM-story_mw12m2df_2] The Collective contract: a load pays gold until its tier's quota is met; the surplus pays no
// gold and is kept, and only what is kept reaches the inventory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildCampaignMap, resolveResourceTypes } from './mapgen.js';
import { createSim, applyCommand, stepSim } from './core.js';
import { initContract } from './harvest.js';
import { createLog, serializeLog, deserializeLog, replayOpts, hashState } from './replay.js';
import { contractFor, contractReward, CONTRACT_TIERS } from '../data/collectiveContract.js';
import { PLANETS } from '../data/planets.js';
import { createBattleTally, tallyEvents, finishTally } from '../save/battleTally.js';
import { bankHarvest } from '../save/inventory.js';
import { defaultSave } from '../save/save.js';
import { contractReadout } from '../render/hud.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));

/** A campaign board with the whole ring revealed and one order on the richest common field. */
function board(contract) {
  const map = resolveResourceTypes(buildCampaignMap(1, { seed: 2 }), 1);
  const s = createSim(5, { map, waves: [], contract });
  s.waves.current = 8;
  const field = s.resourceNodes.filter((n) => n.color === 'blue').sort((a, b) => b.units - a.units)[0];
  assert.ok(applyCommand(s, { type: 'harvest', nodeId: field.id }).ok);
  return s;
}
function deposits(s, n) {
  const out = [];
  for (let i = 0; i < 30 * 600 && out.length < n; i++) for (const e of stepSim(s, 1 / 30)) if (e.type === 'deposit') out.push(e);
  return out;
}

test('no contract: every load pays, and everything delivered is kept (the classic board and the harness)', () => {
  assert.equal(initContract(null), null);
  const s = board(null);
  const [d] = deposits(s, 1);
  assert.ok(d.gold > 0);
  assert.equal(d.sold, d.units);
  assert.equal(d.kept, 0);
  assert.equal(d.contract, false);
});

test('a load pays until the quota is met; the part above it pays nothing and is kept', () => {
  const s = board({ common: 30, uncommon: 0, rare: 0, epic: 0 });
  const [a, b] = deposits(s, 2);
  assert.ok(a.units > 30, 'one load is bigger than this quota');
  assert.equal(a.sold, 30);
  assert.equal(a.kept, a.units - 30);
  assert.ok(a.gold > 0 && a.gold < a.units * 4, 'paid for the 30 sold units only');
  assert.equal(b.sold, 0, 'the quota is full');
  assert.equal(b.gold, 0, 'so the next load pays no gold');
  assert.equal(b.kept, b.units);
  assert.deepEqual(s.contract.sold, { common: 30, uncommon: 0, rare: 0, epic: 0 });
  assert.equal(s.contract.kept.common, a.kept + b.kept);
  assert.equal(s.mapScore.goldFromPrimary, a.gold, 'map score counts gold actually paid');
});

test('the contract travels in the replay log: the replay rebuilds the same quota and the same economy', () => {
  const quota = { common: 30, uncommon: 0, rare: 0, epic: 0 };
  const map = resolveResourceTypes(buildCampaignMap(1, { seed: 2 }), 1);
  const init = { map, waves: [], contract: quota, mapId: 1 };
  const back = deserializeLog(serializeLog(createLog(5, init)));
  assert.deepEqual(back.init.contract, quota);
  const opts = replayOpts(back.init, { map, waves: [] });
  const a = createSim(5, init), b = createSim(5, opts);
  for (const s of [a, b]) {
    s.waves.current = 8;
    const field = s.resourceNodes.filter((n) => n.color === 'blue').sort((x, y) => y.units - x.units)[0];
    applyCommand(s, { type: 'harvest', nodeId: field.id });
    for (let i = 0; i < 30 * 120; i++) stepSim(s, 1 / 30);
  }
  assert.deepEqual(b.contract, a.contract);
  assert.equal(hashState(b), hashState(a));
});

test('only the kept surplus reaches the inventory', () => {
  const t = createBattleTally();
  tallyEvents(t, [
    { type: 'deposit', color: 'blue', units: 40, sold: 40, kept: 0 },
    { type: 'deposit', color: 'blue', units: 40, sold: 25, kept: 15 },
    { type: 'deposit', color: 'red', units: 6, sold: 0, kept: 6 },
  ]);
  const tally = finishTally(t);
  assert.deepEqual(tally.harvested, { common: 80, uncommon: 0, rare: 6, epic: 0 }, 'harvested counts everything');
  assert.deepEqual(tally.kept, { common: 15, uncommon: 0, rare: 6, epic: 0 });
  const s = defaultSave();
  const got = bankHarvest(s, { planet: 'Verdance', tally }, CATALOG);
  assert.deepEqual(Object.values(got).sort((x, y) => x - y), [6, 15]);
});

test('every planet × map has a contract, common and uncommon only, and gold-based missions can be met within it', () => {
  const REG = createRequire(import.meta.url)('../data/factions.js');
  assert.deepEqual(CONTRACT_TIERS, ['common', 'uncommon']);
  let n = 0;
  for (const f of REG.COMBAT_FACTIONS) for (let id = 1; id <= 9; id++) {
    const q = contractFor(f.key, id);
    assert.ok(q, `${f.key} map ${id}`);
    assert.deepEqual(Object.keys(q), ['common', 'uncommon'], 'no rare or epic quota');
    for (const k of CONTRACT_TIERS) assert.ok(Number.isInteger(q[k]) && q[k] > 0, `${f.key} map ${id} ${k}`);
    assert.deepEqual(contractFor(PLANETS[f.key].name, id), q, 'by planet name too');
    const r = contractReward(f.key, id);
    assert.equal(r.standing, id <= 3 ? 10 : id <= 6 ? 15 : 20, 'standing 10 / 15 / 20 by map band');
    n++;
  }
  assert.equal(n, 81);
  assert.equal(contractFor('collective', 1), null, 'the Collective has no planet');
  assert.equal(contractFor('ground', 10), null);
  const GOLD = { harvest_common_gold: 'common', harvest_uncommon_gold: 'uncommon' };
  for (const m of CATALOG.missions) for (const c of m.complete) if (GOLD[c.cond]) {
    // the cheapest unit pays 4 gold (mapgen's default value); the quota must be able to pay the requirement
    assert.ok(contractFor(m.planet, m.map)[GOLD[c.cond]] * 4 >= c.value, `${m.id}: ${c.value} gold needs a bigger ${GOLD[c.cond]} quota on ${m.planet}`);
  }
});

test('the uncommon quota is never more than the live board holds', async () => {
  // balance report 2026-11-05: counted on the raw forge board, 56 of 81 uncommon quotas could never fill
  const { buildTerrainMap } = await import('./mapgen.js');
  const { PLANET_OF_SLUG } = await import('../../../../tools/economy/contract_quota.mjs');
  const dir = new URL('../../content/maps/forge/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => /-map-\d\.json$/.test(x))) {
    const [, slug, id] = f.match(/^(.*)-map-(\d)\.json$/);
    const map = resolveResourceTypes(buildTerrainMap(JSON.parse(readFileSync(new URL(f, dir), 'utf8')), +id, { seed: 0, bakeTune: {} }), 1);
    const s = createSim(7, { map, waves: [] });
    const held = s.resourceNodes.filter((n) => n.color === 'yellow').reduce((a, n) => a + n.units, 0);
    assert.ok(contractFor(PLANET_OF_SLUG[slug], +id).uncommon <= held, `${f}: uncommon quota above the ${held} the board holds`);
  }
});

test('the HUD reads sold / quota until a tier is full, then what is kept', () => {
  const html = contractReadout({ quota: { common: 500, uncommon: 170, rare: 10, epic: 0 }, sold: { common: 500, uncommon: 20, rare: 0, epic: 0 }, kept: { common: 45, uncommon: 0, rare: 0, epic: 3 } });
  assert.match(html, /✓ \+45/);
  assert.match(html, /20\/170/);
  assert.match(html, /0\/10/);
  assert.match(html, /● \+3</, 'a tier the Collective does not buy shows only what is kept');
  assert.doesNotMatch(html, /✓ \+3/);
});

// [MM-story_mw4a1o3p_m] The Collective buys common and uncommon only; a mixed load is credited per tier.

/** A truck docked with a hand-built load, one tick from finishing its unload. */
function dockedWith(contract, mix) {
  const s = board(contract);
  const u = s.units.get(s.harvesterIds[0]);
  u.cargoMix = {};
  let cargo = 0, value = 0;
  for (const [color, units] of Object.entries(mix)) {
    const vpu = { blue: 1, yellow: 2, red: 4, green: 8 }[color];
    u.cargoMix[color] = { units, value: units * vpu, role: color === 'blue' ? 'primary' : color === 'yellow' ? 'premium' : 'quest' };
    cargo += units; value += units * vpu; u.cargoColor = color;
  }
  u.cargo = cargo; u.cargoValue = value; u.yieldMult = 1;
  u.state = 'harvestUnload'; u.unloadTicks = 1;
  return { s, u };
}
const depositsNow = (s) => stepSim(s, 1 / 30).filter((e) => e.type === 'deposit');

test('a mixed load is credited per tier: its common units sell as common, its rare units as rare', () => {
  const { s, u } = dockedWith({ common: 1000, uncommon: 100 }, { blue: 30, red: 10 });
  const money0 = s.economy.money, q0 = s.mapScore.questUnits;
  const ds = depositsNow(s);
  assert.deepEqual(ds.map((d) => d.color), ['blue', 'red'], 'one deposit per colour, blue first');
  const [b, r] = ds;
  assert.deepEqual([b.units, b.sold, b.kept, b.gold], [30, 30, 0, 30], 'the common part sells under the common quota');
  assert.deepEqual([r.units, r.sold, r.kept, r.gold], [10, 0, 10, 0], 'the rare part is kept, unpaid');
  assert.equal(s.economy.money - money0, 30);
  assert.equal(s.mapScore.questUnits - q0, 10, 'only the rare units count toward the quest');
  assert.deepEqual([s.contract.sold.common, s.contract.kept.rare], [30, 10]);
  assert.equal(u.cargo, 0);
  assert.deepEqual(u.cargoMix, {});
});

test('the Collective buys no rare or epic: with a contract they are always kept and pay no gold', () => {
  const c = initContract({ common: 100, uncommon: 50 });
  assert.deepEqual(c.quota, { common: 100, uncommon: 50, rare: 0, epic: 0 });
  const { s } = dockedWith({ common: 100, uncommon: 50 }, { green: 12 });
  const [d] = depositsNow(s);
  assert.deepEqual([d.color, d.units, d.sold, d.kept, d.gold], ['green', 12, 0, 12, 0]);
});

test('a single-colour load credits exactly as before (one event, floor of the whole load)', () => {
  const { s } = dockedWith(null, { yellow: 20.6 });
  const ds = depositsNow(s);
  assert.equal(ds.length, 1);
  assert.deepEqual([ds[0].color, ds[0].units, ds[0].gold, ds[0].role], ['yellow', 20, 41, 'premium']);
});
