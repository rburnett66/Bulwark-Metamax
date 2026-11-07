// The outpost contract (tech plan docs/tech-plan/Outpost.md §5, story O3) [MM-story_mw5oe8km_k].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  outpostOffer, acceptOutpostContract, declineOutpostContract, outpostUnlocks, outpostCard, outpostQuestLine,
  outpostMissionId, measureRaidsHeld,
} from './contract.js';
import { readFileSync } from 'node:fs';
import { confirmOnline, advance, sell, place, onlineProblems, defaultPads } from './model.js';
import { makeRaidHook } from './raid.js';
import { outpostMapFromForge } from './outpostMap.js';
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

/** The player buys the first setup on the default pads with their gold (owner 2026-11-07) and waits for the builds.
 *  Spends s.carry.gold through the model's prices. → the outpost, advanced past the builds. */
function buySetup(s, key, m, now, extra = []) {
  let o = s.outposts[key];
  const pads = defaultPads(m);
  const buys = [{ pad: pads.power, kind: 'power' }, { pad: pads.rig, kind: 'rig' }, { pad: pads.storage, kind: 'storage' }, ...extra];
  for (const what of buys) {
    const r = place(o, what, { map: m, now, gold: s.carry.gold, unlockedTiers: ['common'] });
    assert.ok(!r.error, `${what.kind}: ${r.error}`);
    o = r.outpost;
    s.carry.gold -= r.cost;
  }
  return (s.outposts[key] = advance(o, now + 2 * MIN, { map: m }).outpost);
}
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

test('ACCEPT grants only the hub (owner 2026-11-07), not yet online; accepting twice changes nothing', () => {
  const s = arrived();
  const o = acceptOutpostContract(s, 'ground', { map, now: T0 });
  assert.equal(o.online, false);
  assert.deepEqual(Object.values(o.pads).map((p) => p.kind), ['hub']);
  assert.deepEqual(o.defenses, [], 'the map\'s kitDefenses are not granted');
  assert.equal(o.harvesters, 0);
  assert.ok(onlineProblems(o, map).includes('no power station'));
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
  assert.ok(confirmOnline(s.outposts.ground, map, T0).error, 'the base alone cannot go online');
  s.carry = { gold: 1500, structures: [] };
  buySetup(s, 'ground', map, T0);
  s.outposts.ground = confirmOnline(s.outposts.ground, map, T0 + 2 * MIN).outpost;
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

test('contract 1 end to end on the Verdance map: the player buys the setup and defenses, holds the real scripted raid', () => {
  const vmap = outpostMapFromForge(JSON.parse(readFileSync(new URL('../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8')));
  const s = arrived();
  s.carry = { gold: 4500, structures: [] };   // the setup (1,500) and the map's starter MG + walls (600 + 6 x 400)
  assert.deepEqual(syncMissions(s, catalog, ctx).map((m) => m.id), ['OC-VER-1']);
  const m = () => s.missions.find((x) => x.id === 'OC-VER-1');
  acceptOutpostContract(s, 'ground', { map: vmap, now: T0 });
  s.outposts.ground.seed = 1;   // a fixed raid seed, so the scripted raid's lane is known
  const defenses = vmap.kitDefenses.filter((d) => d.kind !== 'cannon').map((d) => ({ kind: d.kind, cell: d.cell }));
  buySetup(s, 'ground', vmap, T0, defenses);
  assert.equal(s.carry.gold, 0, 'every gold piece spent through the model');
  const on = T0 + 2 * MIN;
  s.outposts.ground = confirmOnline(s.outposts.ground, vmap, on).outpost;
  settleOutpost(s, catalog, ctx);
  assert.equal(m().objectives[0].have, 1);
  // two hours: the scripted first raid at +10 min, run on the battle sim (O7's hook), held; 360 iron mined; sold
  s.outposts.ground = advance(s.outposts.ground, on + 2 * HOUR, { map: vmap, raid: makeRaidHook({ map: vmap, step: 1 }) }).outpost;
  assert.equal(s.outposts.ground.raids.log[0].result, 'held');
  assert.ok(Math.abs(s.outposts.ground.storage.r1.iron - 360) < 1e-6);
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

test('the contract card: the base is granted, the player builds the rest; the steps, the pay and the unlocks', () => {
  const c = outpostCard('ground', "Halbrecht's Oath");
  assert.match(c.kicker, /HALBRECHT'S OATH/);
  assert.match(c.task, /Iron for the Oath/);
  assert.match(c.task, /grants you an outpost base/);
  assert.match(c.task, /power station, a mining station on the iron and a storage tower with your own gold/);
  assert.match(c.task, /defenses are yours to buy/);
  assert.doesNotMatch(c.task, /cannon|machine gun|wall ring/i);
  assert.match(c.terms, /power, a mining station on the iron and storage, all powered/);
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
  // only planets with an outpost map get contracts — since O11 all nine have one, three contracts each
  const { existsSync } = await import('node:fs');
  const { PLANETS } = await import('../data/planets.js');
  const outposts = cat.missions.filter((x) => x.type === 'outpost');
  const withMap = Object.entries(PLANETS).filter(([k]) => existsSync(new URL(`../../content/maps/forge/${k}-outpost.json`, import.meta.url)));
  assert.equal(withMap.length, 9, 'every planet ships an outpost map');
  assert.deepEqual([...new Set(outposts.map((x) => x.planet))].sort(), withMap.map(([, p]) => p.name).sort());
  for (const [k, p] of withMap) {
    const own = outposts.filter((x) => x.planet === p.name);
    assert.deepEqual(own.map((x) => x.step).sort(), [1, 2, 3], p.name);
    assert.ok(own.every((x) => x.outpost.planetKey === k), p.name);
  }
});

test("every captain has the outpost scene's four beats, naming their planet's common ore (O11 drafts)", async () => {
  const R = JSON.parse(readFileSync(new URL('../../content/reveals/reveals.json', import.meta.url), 'utf8'));
  const { PLANETS } = await import('../data/planets.js');
  const { oreOf } = await import('../data/ores.js');
  for (const k of Object.keys(PLANETS)) {
    const lines = R.factionShip.outpost[k];
    assert.ok(Array.isArray(lines), k);
    assert.deepEqual(lines.map((l) => l.beat), ['greet', 'turn', 'offer', 'warning'], k);
    assert.equal(lines[1].intent, 'question', k);
    const offer = lines[2].line.toLowerCase();
    // the contract grants only the base: the player builds power, the mining station on the common ore and storage
    assert.ok(offer.includes(`mining station on the ${oreOf(k, 'common').name.toLowerCase()}`), `${k}: ${offer}`);
    for (const w of ['power', 'storage tower', 'your own gold']) assert.ok(offer.includes(w), `${k}: ${w}`);
    assert.ok(lines.every((l) => l.line && l.line.length < 260), k);
  }
});
