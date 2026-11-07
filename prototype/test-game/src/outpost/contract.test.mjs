// The outpost contract (tech plan docs/tech-plan/Outpost.md §5, story O3) [MM-story_mw5oe8km_k].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  outpostOffer, acceptOutpostContract, declineOutpostContract, outpostUnlocks, outpostCard, outpostQuestLine,
  outpostMissionId, measureRaidsHeld,
} from './contract.js';
import { confirmOnline, advance, sell } from './model.js';
import { DRAFT_LAYOUT as map } from './draftLayout.js';
import { defaultSave } from '../save/save.js';
import { syncMissions, settleOutpost, collect, gateMet, GATE_CONDITIONS } from '../save/missionFlow.js';
import { missionStatus, MEASURED_CONDITIONS } from '../save/missions.js';

const MIN = 60_000, HOUR = 60 * MIN;
const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const ctx = { level: () => 10, owns: () => false, planetOpen: () => true, now: T0 };

/** Contract 1 as tools/extract_missions.py writes it from the Outpost_Contracts row (its shape is pinned here). */
const OC1 = {
  id: 'OC-VER-1', questLine: 'QL-VER-O', step: 1, role: 'primary', variant: null, planet: 'Verdance', map: null,
  title: 'Iron for the Oath', type: 'outpost', giver: { name: 'Colonel Aldric Vane', faction: 'ground', align: 'PG' },
  grantedAt: "Halbrecht's Oath", collectAt: "Halbrecht's Oath", briefing: '', status: 'Draft', impact: { loyaltyPlanet: 20 },
  view: [], unlock: [{ cond: 'capital_ship_arrived', param: 'Verdance', text: "Halbrecht's Oath is in orbit" }], execute: [],
  complete: [
    { cond: 'outpost_online', param: 'ground', op: '≥', value: 1, text: 'Establish the outpost' },
    { cond: 'ore_sold', param: 'iron', op: '≥', value: 300, text: "Deliver 300 Iron to Halbrecht's Oath" },
    { cond: 'raids_held', param: 'ground', op: '≥', value: 1, text: 'Hold the outpost through a raid' },
  ],
  fail: [], rewards: [{ kind: 'gold', amount: 2000, label: 'Gold' }, { kind: 'xp', amount: 300, label: 'Commander XP' }],
};
const catalog = { missions: [OC1], resources: [], questLines: {}, techUnlocks: {} };
const arrived = () => { const s = defaultSave(); s.capitalShips = { Verdance: { arrived: true } }; return s; };

test('ids and quest line follow the extractor', () => {
  assert.equal(outpostQuestLine('ground'), 'QL-VER-O');
  assert.equal(outpostMissionId('ground', 1), 'OC-VER-1');
});

test('the offer appears with the ship and goes once the outpost exists', () => {
  const s = defaultSave();
  assert.equal(outpostOffer(s, 'ground'), null);
  s.capitalShips = { Verdance: { arrived: true } };
  assert.equal(outpostOffer(s, 'ground').title, 'Iron for the Oath');
  acceptOutpostContract(s, 'ground', { map, now: T0 });
  assert.equal(outpostOffer(s, 'ground'), null);
});

test('ACCEPT grants the kit on its pads, not yet online; accepting twice changes nothing', () => {
  const s = arrived();
  const o = acceptOutpostContract(s, 'ground', { map, now: T0 });
  assert.equal(o.online, false);
  assert.deepEqual(Object.values(o.pads).map((p) => p.kind).sort(), ['hub', 'power', 'rig', 'storage']);
  assert.equal(o.defenses.filter((d) => d.kind === 'cannon').length, 1);
  assert.equal(o.defenses.filter((d) => d.kind === 'mg').length, 1);
  assert.deepEqual(s.outpostContracts.ground, { step: 1, state: 'active', since: T0 });
  const again = acceptOutpostContract(s, 'ground', { map, now: T0 + HOUR });
  assert.equal(again, o);
  assert.equal(s.outpostContracts.ground.since, T0);
});

test('LATER keeps the offer, grants nothing', () => {
  const s = arrived();
  declineOutpostContract(s, 'ground', { now: T0 });
  assert.equal(s.outposts.ground, undefined);
  assert.equal(s.outpostContracts.ground.state, 'offered');
  assert.ok(outpostOffer(s, 'ground'));
});

test('the four outpost gates and three measures are known to the mission flow', () => {
  for (const c of ['outpost_online', 'ore_sold', 'raids_held', 'outpost_contract_step']) assert.ok(GATE_CONDITIONS.includes(c), c);
  for (const c of ['outpost_online', 'ore_sold', 'raids_held']) assert.ok(MEASURED_CONDITIONS.includes(c), c);
  const s = arrived();
  const g = (cond, param, value) => gateMet(s, { cond, param, value }, ctx);
  assert.equal(g('outpost_contract_step', 'ground', 1), false);
  acceptOutpostContract(s, 'ground', { map, now: T0 });
  assert.equal(g('outpost_contract_step', 'ground', 1), true);
  assert.equal(g('outpost_online', 'ground'), false);
  s.outposts.ground = confirmOnline(s.outposts.ground, map, T0).outpost;
  assert.equal(g('outpost_online', 'ground'), true);
  assert.equal(g('ore_sold', 'iron', 15), false);
  s.outposts.ground.sold = { iron: 15 };
  assert.equal(g('ore_sold', 'iron', 15), true);
  assert.equal(g('raids_held', 'ground', 1), false);
  s.outposts.ground.raids.log.push({ at: T0 + MIN, result: 'held' });
  assert.equal(g('raids_held', 'ground', 1), true);
  s.outposts.ground.raids.log.push({ at: T0 + 2 * MIN, result: 'breach' });
  assert.equal(measureRaidsHeld(s, 'ground'), 1);
  assert.equal(measureRaidsHeld(s, 'ground', T0 + 90_000), 0);
});

test('contract 1 end to end: logged with the ship, run at the outpost, collected aboard', () => {
  const s = arrived();
  assert.deepEqual(syncMissions(s, catalog, ctx).map((m) => m.id), ['OC-VER-1']);
  const m = () => s.missions.find((x) => x.id === 'OC-VER-1');
  acceptOutpostContract(s, 'ground', { map, now: T0 });
  s.outposts.ground = confirmOnline(s.outposts.ground, map, T0).outpost;
  settleOutpost(s, catalog, ctx);
  assert.equal(m().objectives[0].have, 1);
  // two hours: the scripted first raid (held) at +10 min, 360 iron mined; every load sold
  const held = () => ({ result: 'held', defenses: [] });
  s.outposts.ground = advance(s.outposts.ground, T0 + 2 * HOUR, { map, raid: held }).outpost;
  const sale = sell(s.outposts.ground, {});
  s.outposts.ground = sale.outpost;
  const out = settleOutpost(s, catalog, ctx);
  assert.ok(m().objectives[1].have >= 300, 'iron delivered');
  assert.ok(m().objectives[2].have >= 1, 'a raid held');
  assert.deepEqual(out.ready, ['OC-VER-1']);
  assert.equal(missionStatus(m(), s), 'ready');
  // the raid log keeps only the last raids: the count latches
  s.outposts.ground.raids.log = [];
  settleOutpost(s, catalog, ctx);
  assert.equal(m().objectives[2].have, 1);
  // collect: pays, and contract 2 becomes active with its unlocks
  const gold0 = (s.carry && s.carry.gold) || 0, xp0 = s.progress.xp || 0;
  assert.deepEqual(outpostUnlocks(s, 'ground').unlockedTiers, ['common']);
  assert.ok(collect(s, 'OC-VER-1', catalog, ctx));
  assert.equal(s.carry.gold, gold0 + 2000);
  assert.equal(s.progress.xp, xp0 + 300);
  assert.equal(s.loyalty['Ground / Powder'], 20);
  assert.equal(s.questSteps['QL-VER-O'], 1);
  assert.equal(s.outpostContracts.ground.step, 2);
  const u = outpostUnlocks(s, 'ground');
  assert.deepEqual(u.unlockedTiers, ['common', 'uncommon']);
  assert.ok(u.unlocks.has('deep_drilling_1'));
});

test('the contract card names the kit, the steps, the pay and the unlocks', () => {
  const c = outpostCard('ground', "Halbrecht's Oath");
  assert.match(c.kicker, /HALBRECHT'S OATH/);
  assert.match(c.task, /Iron for the Oath/);
  assert.match(c.terms, /Deliver <b>300 Iron<\/b>/);
  assert.match(c.terms, /Hold the outpost through a raid/);
  assert.match(c.terms, /2,000 gold/);
  assert.match(c.terms, /Aluminum<\/b> and Deep Drilling I/);
  assert.equal(c.declineLabel, 'LATER');
});

test('the generated catalogue carries Verdance contract 1 exactly as the flow above reads it', async () => {
  const { readFileSync } = await import('node:fs');
  const cat = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
  const m = cat.missions.find((x) => x.id === 'OC-VER-1');
  assert.ok(m, 'OC-VER-1 is generated once ground-outpost.json exists');
  assert.equal(m.type, 'outpost');
  assert.equal(m.questLine, 'QL-VER-O');
  assert.deepEqual(m.complete.map((c) => [c.cond, c.param, c.value]), OC1.complete.map((c) => [c.cond, c.param, c.value]));
  assert.deepEqual(m.unlock.map((c) => c.cond), ['capital_ship_arrived']);
  assert.deepEqual(m.rewards.map((r) => [r.kind, r.amount]), [['gold', 2000], ['xp', 300]]);
  assert.equal(m.impact.loyaltyPlanet, 20);
  for (const c of ['outpost_online', 'ore_sold', 'raids_held', 'outpost_contract_step']) assert.ok(cat.conditions[c], c);
  // only planets with an outpost map get contracts
  assert.deepEqual([...new Set(cat.missions.filter((x) => x.type === 'outpost').map((x) => x.planet))], ['Verdance']);
});
