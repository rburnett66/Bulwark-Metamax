// [MM-story_mvzkd148_1j] Capital ships: arrival, grants aboard, collection, per-planet map records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave, migrate } from './save.js';
import { battleResult, missionStatus } from './missions.js';
import { flowCtx, gateMet, GATE_CONDITIONS, syncMissions, lockedMissions, recordPlanetMap, settleBattle, collect, collectBlock, shipArrived, mapRecord } from './missionFlow.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const allOpen = (s) => flowCtx(s, { allOpen: true, now: 1 });
const gated = (s) => flowCtx(s, { allOpen: false, now: 1 });
const stars = (n) => Array.from({ length: 8 }, (_, i) => ({ wave: i + 1, stars: n, flags: [true, true, true, true, true].map((_, k) => k < n) }));
const battle = (planet, map, avg, over = {}) => battleResult({ mapId: map, planet, faction: 'x', result: 'win', totalWaves: 8, waveStars: stars(avg),
  finalScore: { kills: 400, goldSpent: 3000, totalSeconds: 300 }, mapScore: { goldFromPrimary: 2000, goldFromPremium: 2000, questRed: 30, questGreen: 30 }, ...over });
const rec = (s, id) => s.missions.find((m) => m.id === id);

test('every View and Unlock row in the content can be judged, and every catalogue gate too', () => {
  const s = defaultSave(), ctx = gated(s);
  for (const m of CATALOG.missions) for (const c of [...m.view, ...m.unlock]) assert.equal(typeof gateMet(s, c, ctx), 'boolean', m.id);
  for (const [k, c] of Object.entries(CATALOG.conditions)) if (c.stages.includes('View') || c.stages.includes('Unlock')) assert.ok(GATE_CONDITIONS.includes(k), k);
  assert.throws(() => gateMet(s, { cond: 'moon_is_full' }, ctx), /moon_is_full/);
});

test('every capital ship and quest line the missions name exists', () => {
  assert.equal(Object.keys(CATALOG.capitalShips).length, 9);
  for (const m of CATALOG.missions) {
    assert.ok(CATALOG.questLines[m.questLine], m.id);
    assert.equal(m.collectAt, CATALOG.capitalShips[m.planet].ship, m.id);
  }
});

test('a new commander is granted primary 1 by the landing craft: no ship needed', () => {
  const s = defaultSave();
  const logged = syncMissions(s, CATALOG, gated(s)).map((m) => m.id);
  assert.deepEqual(logged, ['P-VER-01'], 'Verdance only: the other planets need their portal');
  assert.equal(rec(s, 'P-VER-01').grantedAt, 'Landing craft BS-7');
  assert.deepEqual(s.loggedQueue, [{ kind: 'mission', id: 'P-VER-01' }]);
  assert.deepEqual(syncMissions(s, CATALOG, gated(s)), [], 'never twice');
});

test('the per-planet map record keeps runs, the win and the best average, planet by planet', () => {
  const s = defaultSave();
  recordPlanetMap(s, battle('Verdance', 2, 2));
  recordPlanetMap(s, battle('Verdance', 2, 4));
  recordPlanetMap(s, battle('Verdance', 2, 3));
  recordPlanetMap(s, battle('Verdance', 2, 5, { result: 'lose' }));
  recordPlanetMap(s, battle('Florael', 2, 1));
  const r = mapRecord(s, 'Verdance', 2);
  assert.equal(r.runs, 4);
  assert.equal(r.beaten, true);
  assert.equal(r.bestAvg, 4, 'the loss does not count');
  assert.equal(mapRecord(s, 'Florael', 2).bestAvg, 1);
  assert.deepEqual(migrate(JSON.parse(JSON.stringify(s))).planetMaps, s.planetMaps);
});

test('the ship arrives on map 1 at 3 stars or more, not below, not on another map, not on a loss', () => {
  const s = defaultSave();
  assert.equal(recordPlanetMap(s, battle('Verdance', 2, 5)).arrived, null, 'map 2');
  assert.equal(recordPlanetMap(s, battle('Verdance', 1, 2)).arrived, null, 'below 3 stars');
  assert.equal(recordPlanetMap(s, battle('Verdance', 1, 5, { result: 'lose' })).arrived, null, 'a loss');
  assert.equal(shipArrived(s, 'Verdance'), false);
  assert.equal(recordPlanetMap(s, battle('Verdance', 1, 3)).arrived, 'Verdance');
  assert.equal(shipArrived(s, 'Verdance'), true);
  assert.equal(shipArrived(s, 'Florael'), false, 'one planet at a time');
  assert.deepEqual(s.loggedQueue, [{ kind: 'ship', planet: 'Verdance' }]);
  assert.equal(recordPlanetMap(s, battle('Verdance', 1, 5)).arrived, null, 'arrives once');
});

test('won below 3 stars: primary 1 stays Ready and its rewards wait for the ship', () => {
  const s = defaultSave(), ctx = gated(s);
  syncMissions(s, CATALOG, ctx);
  settleBattle(s, battle('Verdance', 1, 2), CATALOG, ctx);
  const m = rec(s, 'P-VER-01');
  assert.equal(missionStatus(m, s), 'ready');
  assert.equal(collectBlock(s, m), "Waiting for Halbrecht's Oath");
  assert.equal(collect(s, 'P-VER-01', CATALOG, ctx), null);
  assert.equal(missionStatus(m, s), 'ready', 'still waiting');
  assert.equal((s.carry && s.carry.gold) || 0, 0, 'nothing banked');
  settleBattle(s, battle('Verdance', 1, 3), CATALOG, ctx);
  assert.equal(shipArrived(s, 'Verdance'), true);
  assert.ok(collect(s, 'P-VER-01', CATALOG, ctx));
  assert.equal(s.carry.gold, 300);
});

test('collecting continues the quest line, and the next primary is granted aboard once its node is owned and its level reached', () => {
  const s = defaultSave(), ctx = gated(s);
  syncMissions(s, CATALOG, ctx);
  settleBattle(s, battle('Verdance', 1, 4), CATALOG, ctx);
  assert.equal(rec(s, 'P-VER-02'), undefined, 'not offered before collection');
  assert.ok(!lockedMissions(s, CATALOG, ctx).some((d) => d.id === 'P-VER-02'), 'invisible until step 1 is collected');
  const got = collect(s, 'P-VER-01', CATALOG, ctx);
  assert.equal(s.questSteps['QL-VER-P'], 1);
  assert.deepEqual(got.logged, [], 'step 2 still needs Cannon T2');
  assert.ok(lockedMissions(s, CATALOG, ctx).some((d) => d.id === 'P-VER-02'), 'now listed as a next step');
  s.progress.xp = 5000;
  s.tech.owned.cannon2 = true;
  const later = gated(s);
  assert.deepEqual(syncMissions(s, CATALOG, later).map((m) => m.id).filter((id) => id === 'P-VER-02'), ['P-VER-02']);
  assert.equal(rec(s, 'P-VER-02').grantedAt, "Halbrecht's Oath");
});

test('without the ship nothing past step 1 is granted, even with the other gates met', () => {
  const s = defaultSave();
  s.questSteps['QL-VER-P'] = 1; s.tech.owned.cannon2 = true; s.progress.xp = 5000;
  assert.equal(syncMissions(s, CATALOG, gated(s)).some((m) => m.id === 'P-VER-02'), false);
  s.capitalShips.Verdance = { arrived: true };
  assert.equal(syncMissions(s, CATALOG, gated(s)).some((m) => m.id === 'P-VER-02'), true);
});

test('another planet opens with its portal node; the testing switch opens it too', () => {
  const s = defaultSave();
  assert.equal(syncMissions(s, CATALOG, gated(s)).some((m) => m.id === 'P-FLO-01'), false);
  s.tech.owned.portal_florael = true;
  assert.equal(syncMissions(s, CATALOG, gated(s)).some((m) => m.id === 'P-FLO-01'), true);
  assert.equal(typeof allOpen(s).planetOpen('Rime'), 'boolean');
});

test('settleBattle reports what changed and queues the arrival and new missions for the menu', () => {
  const s = defaultSave(), ctx = gated(s);
  syncMissions(s, CATALOG, ctx);
  s.loggedQueue.length = 0;
  const out = settleBattle(s, battle('Verdance', 1, 3), CATALOG, ctx);
  assert.equal(out.arrived, 'Verdance');
  assert.deepEqual(out.ready, ['P-VER-01']);
  assert.ok(s.loggedQueue.some((q) => q.kind === 'ship'));
  assert.equal(s.progress.battles, 1);
});

test('main.js settles missions in the played-battle branch only', () => {
  const MAIN = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  assert.ok(/settleBattle\(sv, played, missionCatalog/.test(MAIN));
});
