// Away raids pay the battle bounty [MM-story_mwcfruz3_2x] (owner 2026-11-11: "Players collect gold on outpost kills
// just like battle"). A raid fought while the player is away (raid.js runRaid through advance's hook) measures the gold
// its kills paid with the battle's own grantKillIncome; the away catch-up (view/session.js open / openChunked) banks it
// into the player's gold and the away report shows it. The raid's outcome is unchanged (raid.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenceOutpost, powerGrids, raidOutcome } from './model.js';
import { runRaid } from './raid.js';
import { grantKillIncome } from '../sim/economy.js';
import { createSession } from './view/session.js';
import { raidHookFor } from './view/raidSeam.js';
import { awayReportModel } from './view/awayReport.js';
import { acceptOutpostContract } from './contract.js';
import { defaultSave, bankOf } from '../save/save.js';
import { map, memoryStore, T0, MIN, HOUR } from './view/fixtures.mjs';

const kit = (seed = 11) => referenceOutpost('ground', { seed, map, now: T0 });
const raidOf = (o, extra = {}) => ({ window: 3, at: T0, powered: powerGrids(o, map).powered, ...extra });
const UNITS3 = ['GND-Troops', 'GND-Troops', 'GND-Tanks'];

/** The battle bounty for a list of killed unit ids: grantKillIncome on a throwaway economy, one call per kill. */
function battleBounty(unitIds) {
  const st = { economy: { money: 0, totalEarned: 0, kills: 0 }, tick: 0, events: [] };
  let n = 0;
  for (const unitId of unitIds) n += grantKillIncome(st, { unitId, id: 0, pos: { x: 0, y: 0 } });
  return Math.round(n * 100) / 100;
}

function fresh(gold = 10_000) {
  const s = defaultSave();
  s.capitalShips = { Verdance: { arrived: true } };
  s.carry = { gold, structures: [] }; s.goldBank = gold;
  acceptOutpostContract(s, 'ground', { map, now: T0, seedSalt: 'test' });
  s.outposts.ground = referenceOutpost('ground', { seed: s.outposts.ground.seed, map, now: T0 });
  return s;
}

test('an away raid whose defenses kill raiders reports the battle bounty for exactly those kills', () => {
  const o = kit(222);
  const out = runRaid(o, raidOf(o, { window: 41 }), { map, units: UNITS3 });
  const killed = out.events.filter((e) => e.type === 'kill' && UNITS3.includes(e.unitId) && !e.detonated).map((e) => e.unitId);
  assert.ok(killed.length > 0, 'the kit\'s defenses kill raiders');
  assert.ok(out.bounty > 0);
  assert.equal(out.bounty, battleBounty(killed), 'the sum of grantKillIncome over the kills');
  // the model carries it on the raid entry; a raid with no bounty adds no field (old logs unchanged)
  assert.equal(raidOutcome(o, { ...out, at: T0 }).entry.bounty, out.bounty);
  assert.equal('bounty' in raidOutcome(o, { result: 'held', defenses: [], at: T0 }).entry, false);
});

test('a raid with no kills earns no bounty', () => {
  const o = { ...kit(222), defenses: [] };   // nothing to shoot back
  const out = runRaid(o, raidOf(o, { window: 41 }), { map, units: UNITS3 });
  assert.equal(out.events.filter((e) => e.type === 'kill' && UNITS3.includes(e.unitId)).length, 0);
  assert.equal(out.bounty, 0);
});

test('the away catch-up banks each raid\'s bounty into the player\'s gold, and the away report shows it', () => {
  const store = memoryStore(fresh(1000));
  const hook = (o) => ({ result: 'held', defenses: o.defenses.map((d) => ({ id: d.id, hp: d.hp })), bounty: 37.5 });
  const v = createSession({ store, planet: 'ground', map, catalog: null, raidHook: hook });
  v.act({ type: 'online' }, T0);
  const before = bankOf(store.load());
  const r = v.open(T0 + 30 * MIN);   // the scripted first raid at +10 min
  assert.equal(r.report.raids.length, 1);
  assert.equal(bankOf(store.load()) - before, 37.5, 'banked once');
  assert.equal(store.load().goldBank, bankOf(store.load()));
  assert.equal(r.away.bounty, 37);
  assert.equal(r.away.raids[0].bounty, 37);
  // re-opening fights nothing new and banks nothing again
  v.open(T0 + 31 * MIN);
  assert.equal(bankOf(store.load()) - before, 37.5);
});

test('a raid that killed nothing banks 0', () => {
  const store = memoryStore(fresh(1000));
  const hook = (o) => ({ result: 'breach', defenses: o.defenses.map((d) => ({ id: d.id, hp: d.hp })), bounty: 0 });
  const v = createSession({ store, planet: 'ground', map, catalog: null, raidHook: hook });
  v.act({ type: 'online' }, T0);
  const before = bankOf(store.load());
  const r = v.open(T0 + 30 * MIN);
  assert.equal(r.report.raids.length, 1);
  assert.equal(bankOf(store.load()), before);
  assert.equal(r.away.bounty, 0);
});

test('with the real raid hook, the chunked catch-up banks the sum of the raids\' bounties, as the one-shot open does', async () => {
  const run = async (chunked) => {
    const store = memoryStore(fresh(1000));
    const v = createSession({ store, planet: 'ground', map, catalog: null, raidHook: raidHookFor(map, 1) });
    v.act({ type: 'online' }, T0);
    const before = bankOf(store.load());
    const r = chunked ? await v.openChunked(T0 + 8 * HOUR) : v.open(T0 + 8 * HOUR);
    return { r, gained: bankOf(store.load()) - before };
  };
  const one = await run(false), chunk = await run(true);
  const sum = one.r.report.raids.reduce((a, x) => a + (x.bounty || 0), 0);
  assert.ok(one.r.report.raids.length >= 1);
  assert.ok(sum > 0, 'the defenses killed raiders while the player was away');
  assert.ok(Math.abs(one.gained - sum) < 1e-9, 'every raid\'s bounty banked');
  assert.ok(Math.abs(chunk.gained - one.gained) < 1e-9, 'chunked equals one-shot');
  assert.deepEqual(awayReportModel(chunk.r.report, 'ground', map).bounty, one.r.away.bounty);
});
