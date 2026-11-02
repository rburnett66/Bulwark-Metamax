// [MM-story_mvyqol3w_d] Mission records, status, battle-end progress, claim; the battle tally; the `tech` save fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave, migrate } from './save.js';
import { logMission, missionStatus, progress, applyBattle, bankBattle, battleResult, claim, abandon, dismiss, markMissionSeen,
  setTracked, trackedMission, badge, inScope, MEASURED_CONDITIONS } from './missions.js';
import { addLoyalty, rivalOf } from './contracts.js';
import { createBattleTally, tallyEvents, noteHarvesters, noteTroopDeployed, finishTally, mergeTally, emptyStats } from './battleTally.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const def = (id) => CATALOG.missions.find((m) => m.id === id);
const NOW = 1000;
const opt = { now: NOW };
const flags = (...on) => [0, 1, 2, 3, 4].map((i) => on.includes(i));
const battle = (over = {}) => battleResult({ mapId: 1, planet: 'Verdance', faction: 'Ground / Powder', result: 'win',
  finalScore: { kills: 50, goldSpent: 900, totalSeconds: 600 }, mapScore: { goldFromPrimary: 100, goldFromPremium: 40, questRed: 2, questGreen: 1 },
  waveStars: Array.from({ length: 8 }, (_, i) => ({ wave: i + 1, stars: 3, flags: flags(0, 1, 2) })), totalWaves: 8, ...over });

test('defaultSave no longer declares tech twice; loyalty tiers live apart from the Tech Tree', () => {
  const src = readFileSync(new URL('./save.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('export function defaultSave'), src.indexOf('const TECH_KEYS'));
  assert.equal((body.match(/^\s*tech:/gm) || []).length, 1, 'one tech field');
  const s = defaultSave();
  assert.deepEqual(s.tech, { owned: {}, paid: {}, unlocked: {} });
  addLoyalty(s, 'Air', 300);
  assert.equal(s.factionTiers.Air, 2, 'the tier reached at 260 loyalty');
  assert.deepEqual(Object.keys(s.tech).sort(), ['owned', 'paid', 'unlocked'], 'nothing written into tech');
});

test('an old save has its faction tiers moved out of tech, and gains the new fields', () => {
  const s = migrate({ v: 1, tech: { owned: { mk2: true }, paid: { mk2: 600 }, Air: 2, 'Ground / Powder': 1 }, progress: { xp: 50 } });
  assert.deepEqual(s.factionTiers, { Air: 2, 'Ground / Powder': 1 });
  assert.deepEqual(s.tech, { owned: { mk2: true }, paid: { mk2: 600 }, unlocked: {} });
  assert.deepEqual(s.missions, []);
  assert.equal(s.progress.battles, 0);
  assert.equal(s.progress.xp, 50);
  assert.deepEqual(s.stats, emptyStats());
});

test('every Complete condition the content uses can be measured, and every catalogue Complete condition too', () => {
  for (const m of CATALOG.missions) for (const c of m.complete) assert.ok(MEASURED_CONDITIONS.includes(c.cond), m.id + ' ' + c.cond);
  for (const [k, c] of Object.entries(CATALOG.conditions)) if (c.stages.includes('Complete')) assert.ok(MEASURED_CONDITIONS.includes(k), k);
});

test('logging at assignment writes the whole record, once', () => {
  const s = defaultSave();
  s.progress.battles = 4;
  const m = logMission(s, def('P-VER-01'), opt);
  assert.equal(m.title, 'Landfall at Verdance');
  assert.equal(m.giver.name, 'Quartermaster Ines Roth');
  assert.equal(m.giver.align, 'N');
  assert.equal(m.giver.faction, 'ground');
  assert.equal(m.type, 'campaign');
  assert.equal(m.assignedBattle, 4);
  assert.equal(m.assignedAt, NOW);
  assert.equal(m.objectives.length, 2);
  assert.deepEqual([m.objectives[0].have, m.objectives[0].need], [0, 1]);
  assert.equal(m.objectives[1].bonus, true);
  assert.ok(m.rewards.some((r) => r.kind === 'tech_unlock'));
  assert.equal(m.end, null);
  assert.equal(logMission(s, def('P-VER-01'), opt), null, 'never twice');
  assert.equal(s.missions.length, 1);
});

test('a save survives JSON: records persist across sessions', () => {
  const s = defaultSave();
  logMission(s, def('P-VER-01'), opt);
  bankBattle(s, battle(), opt);
  const back = migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(missionStatus(back.missions[0], back), 'ready');
  assert.equal(back.progress.battles, 1);
});

test('status: new, active, ready, failed, done', () => {
  const s = defaultSave();
  const m = logMission(s, def('P-VER-02'), opt);
  assert.equal(missionStatus(m, s), 'new');
  markMissionSeen(s, m.id);
  assert.equal(missionStatus(m, s), 'active');
  for (const o of m.objectives) o.have = o.need;
  assert.equal(missionStatus(m, s), 'ready');
  claim(s, m.id, CATALOG, opt);
  assert.equal(missionStatus(m, s), 'done');
  const f = logMission(s, def('S-VER-01-L'), opt);
  abandon(s, f.id, opt);
  assert.equal(missionStatus(f, s), 'failed');
});

test('status: at risk at the edge of the alignment band, and when a limit is reached', () => {
  const s = defaultSave();
  const light = logMission(s, def('S-VER-01-L'), opt);
  s.alignment = 0;
  assert.equal(missionStatus(light, s), 'risk', 'one evil choice from leaving the Light band');
  s.alignment = 3;
  assert.equal(missionStatus(light, s), 'new');
  const lim = logMission(s, { ...def('P-VER-02'), id: 'L', complete: [{ cond: 'win_map', value: 2, op: '=', text: 'w' }, { cond: 'walls_lost_max', value: 2, op: '≤', text: 'l' }] }, opt);
  lim.objectives[1].have = 2;
  assert.equal(missionStatus(lim, s), 'risk');
});

test('progress counts required objectives only: limits and bonuses are excluded', () => {
  const s = defaultSave();
  const m = logMission(s, def('P-VER-01'), opt);
  assert.deepEqual([progress(m).have, progress(m).need], [0, 1]);
  m.objectives[1].have = 3;
  assert.equal(progress(m).have, 0, 'the 3-star bonus does not fill the bar');
  m.objectives[0].have = 1;
  assert.equal(progress(m).done, true);
});

test('applyBattle: every objective kind moves from a battle, and only in scope', () => {
  const s = defaultSave();
  const cases = {
    win_map: [1, 1], harvest_common_gold: [100, 500], harvest_uncommon_gold: [40, 500], haul_rare: [2, 9], haul_epic: [1, 9], kills_total: [50, 999],
    gold_spent: [900, 5000], waves_no_base_damage: [8, 9], waves_no_harvester_lost: [8, 9], waves_quota_met: [8, 9], waves_premium_claimed: [0, 9], waves_under_par: [0, 9],
    five_star_waves: [0, 9], finish_under: [1, 1], planet_map_stars: [3, 5],
  };
  const m = logMission(s, { ...def('P-VER-01'), complete: Object.keys(cases).map((c) => ({ cond: c, op: c === 'win_map' ? '=' : '≥', value: c === 'win_map' ? 1 : c === 'finish_under' ? 30 : cases[c][1], text: c })) }, opt);
  const off = applyBattle(s, battle({ planet: 'Florael' }), opt);
  assert.deepEqual(off.progressed, [], 'another planet does not count');
  assert.deepEqual(applyBattle(s, battle({ mapId: 2 }), opt).progressed, [], 'another map does not count');
  applyBattle(s, battle(), opt);
  for (const o of m.objectives) assert.equal(o.have, cases[o.cond][0], o.cond);
});

test('hauls add up over battles; one-battle objectives keep the best', () => {
  const s = defaultSave();
  const m = logMission(s, { ...def('P-VER-01'), complete: [{ cond: 'kills_total', value: 500, text: 'k' }, { cond: 'gold_spent', value: 5000, text: 'g' }] }, opt);
  applyBattle(s, battle(), opt);
  applyBattle(s, battle({ finalScore: { kills: 30, goldSpent: 100, totalSeconds: 60 } }), opt);
  assert.equal(m.objectives[0].have, 80);
  assert.equal(m.objectives[1].have, 900);
});

test('a condition nothing can measure fails loudly instead of never moving', () => {
  const s = defaultSave();
  assert.throws(() => logMission(s, { ...def('P-VER-01'), complete: [{ cond: 'not_a_condition', value: 1, text: 'x' }] }, opt), /not_a_condition/);
  const m = logMission(s, def('P-VER-01'), opt);
  m.execute.push({ cond: 'on_the_moon' });
  assert.throws(() => inScope(m, battle()), /on_the_moon/);
});

test('fail conditions: lose_battle and walls_lost_max end the mission with the penalty', () => {
  const s = defaultSave();
  const a = logMission(s, { ...def('S-VER-01-L'), id: 'A', fail: [{ cond: 'lose_battle', text: 'lost' }] }, opt);
  const out = applyBattle(s, battle({ result: 'lose' }), opt);
  assert.deepEqual(out.failed, ['A']);
  assert.equal(a.end, 'failed');
  assert.equal(s.loyalty['Ground / Powder'], -45);
  const t = createBattleTally(); tallyEvents(t, [{ type: 'destroyed', entityId: 1, structId: 'wall' }, { type: 'destroyed', entityId: 2, structId: 'wall' }]);
  const b = logMission(s, { ...def('S-VER-01-L'), id: 'B', fail: [{ cond: 'walls_lost_max', value: 1, text: 'breached' }] }, opt);
  applyBattle(s, battle({ tally: finishTally(t) }), opt);
  assert.equal(b.end, 'failed');
  assert.equal(b.endReason, 'breached');
});

test('claim banks every reward kind once, through the pending-rewards ledger', () => {
  const s = defaultSave();
  s.carry = { gold: 100, structures: [] };
  const m = logMission(s, def('P-VER-01'), opt);
  assert.equal(claim(s, m.id, CATALOG, opt), null, 'not Ready yet');
  applyBattle(s, battle(), opt);
  const led = claim(s, m.id, CATALOG, opt);
  assert.equal(led.kind, 'mission');
  assert.deepEqual(led.gold, { earned: 300, from: 100, to: 400 });
  assert.deepEqual(led.xp, { earned: 140, from: 0, to: 140 });
  assert.equal(s.carry.gold, 400);
  assert.equal(s.goldBank, 400);
  assert.equal(s.progress.xp, 140);
  assert.equal(s.inventory['loam-grain'], 5);
  assert.equal(s.tech.unlocked.cannon2, true);
  assert.equal(s.loyalty['Ground / Powder'], 12);
  assert.equal(s.pendingRewards.gold.earned, 300);
  assert.equal(claim(s, m.id, CATALOG, opt), null, 'banks once');
  assert.equal(s.carry.gold, 400);
});

test('secondary impact: loyalty with the planet, a loss with its rival, an alignment shift', () => {
  const s = defaultSave();
  const m = logMission(s, def('S-VER-01-L'), opt);
  for (const o of m.objectives) o.have = o.need;
  claim(s, m.id, CATALOG, opt);
  assert.equal(s.loyalty['Ground / Powder'], 35);
  assert.equal(s.loyalty[rivalOf('Ground / Powder')], -17);
  assert.equal(s.alignment, 1);
});

test('abandon applies the decline rules; primaries cannot be abandoned; a failed mission can be removed', () => {
  const s = defaultSave();
  const p = logMission(s, def('P-VER-01'), opt);
  assert.equal(abandon(s, p.id, opt), false);
  const m = logMission(s, def('S-VER-01-L'), opt);
  assert.equal(dismiss(s, m.id), false, 'only a failed mission');
  assert.equal(abandon(s, m.id, opt), true);
  assert.equal(s.loyalty['Ground / Powder'], -30);
  assert.equal(s.loyalty[rivalOf('Ground / Powder')], 15);
  assert.equal(m.endReason, 'Abandoned by the commander.');
  assert.equal(dismiss(s, m.id), true);
  assert.equal(s.missions.length, 1);
});

test('one tracked mission at most; the badge counts Ready, New and active', () => {
  const s = defaultSave();
  s.alignment = 5;
  const a = logMission(s, def('P-VER-01'), opt), b = logMission(s, def('P-VER-02'), opt), c = logMission(s, def('P-FLO-01'), opt);
  setTracked(s, a.id); setTracked(s, b.id);
  assert.equal(trackedMission(s).id, b.id);
  setTracked(s, b.id);
  assert.equal(trackedMission(s), null);
  for (const o of a.objectives) o.have = o.need;
  markMissionSeen(s, c.id);
  assert.deepEqual(badge(s), { ready: 1, fresh: 1, active: 2 });
});

test('the battle tally counts the event stream and adds to the lifetime totals', () => {
  const t = createBattleTally();
  noteHarvesters(t, [7]);
  const events = [
    { type: 'kill', entityId: 1, unitId: 'GND-Troops', side: 'attacker' },
    { type: 'kill', entityId: 2, unitId: 'GND-Troops', side: 'attacker' },
    { type: 'kill', entityId: 7, unitId: 'GND-Trucks', side: 'defender' },
    { type: 'kill', entityId: 8, unitId: 'GND-Troops', side: 'defender' },
    { type: 'build', id: 10, structId: 'cannon', phase: 'complete' },
    { type: 'build', id: 10, structId: 'cannon', phase: 'upgradeComplete', tier: 2 },
    { type: 'destroyed', entityId: 11, structId: 'wall' },
    { type: 'build', id: 11, structId: 'wall', phase: 'destroyed' },
    { type: 'damage', targetKind: 'base', amount: 12.6 },
    { type: 'damage', targetKind: 'unit', amount: 99 },
    { type: 'deposit', units: 9, color: 'yellow' },
  ];
  tallyEvents(t, events);
  noteTroopDeployed(t);
  const f = finishTally(t);
  assert.equal(f.kills.total, 2);
  assert.deepEqual(f.kills.byUnit, { 'GND-Troops': 2 });
  assert.deepEqual(f.kills.byFaction, { 'Ground / Powder': 2 });
  assert.deepEqual(f.kills.byDomain, { Walker: 2 });
  assert.equal(f.harvestersLost, 1, 'a harvester, and not the troop');
  assert.deepEqual(f.structures, { built: { cannon: 1 }, upgraded: { cannon: 1 }, lost: { wall: 1 } }, 'one wall, counted once');
  assert.equal(f.baseDamage, 13);
  assert.equal(f.troopsDeployed, 1);
  assert.equal(f.harvested.uncommon, 9);
  assert.equal(JSON.parse(JSON.stringify(f)).kills.total, 2, 'saveable');
  const stats = mergeTally(mergeTally(emptyStats(), f, true), f, false);
  assert.equal(stats.battles, 2);
  assert.equal(stats.wins, 1);
  assert.equal(stats.kills.byDomain.Walker, 4);
  assert.equal(stats.structures.lost.wall, 2);
  assert.equal(stats.baseDamage, 26);
});

test('a kill of a unit no table knows is recorded, not swallowed', () => {
  const t = createBattleTally();
  tallyEvents(t, [{ type: 'kill', entityId: 1, unitId: 'NOPE', side: 'attacker' }]);
  assert.deepEqual(t.unknownUnits, { NOPE: 1 });
});

test('bankBattle moves the battle counter and the lifetime stats; the sim is not imported by the record code', () => {
  const s = defaultSave();
  const t = createBattleTally();
  tallyEvents(t, [{ type: 'kill', entityId: 1, unitId: 'GND-Troops', side: 'attacker' }]);
  bankBattle(s, battle({ tally: finishTally(t) }), opt);
  assert.equal(s.progress.battles, 1);
  assert.equal(s.stats.kills.total, 1);
  for (const f of ['./missions.js', './battleTally.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/from '\.\.\/sim\//.test(src), f + ' must not import the sim');
  }
});

test('main.js banks at battle end, played battles only, and tallies outside the tick', () => {
  const MAIN = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  assert.ok(/tallyEvents\(battleTally, evs\)/.test(MAIN), 'fed from the drained events');
  const end = MAIN.slice(MAIN.indexOf('recordResult(currentMapId'));
  assert.ok(/if \(mode === 'play' && currentMapId\)[\s\S]{0,900}(settleBattle|bankBattle)/.test(end), 'banked once, in the played-battle branch');
  const core = readFileSync(new URL('../sim/core.js', import.meta.url), 'utf8');
  assert.ok(!/mission/i.test(core), 'the sim knows nothing about missions');
});
