// [MM-story_mvzkd148_1j] Capital ships: arrival, grants aboard, collection, per-planet map records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSave, migrate } from './save.js';
import { battleResult, missionStatus, abandon, dismiss } from './missions.js';
import { reviewAlignment, resolvedSecondary, favourMessage, flowCtx, gateMet, GATE_CONDITIONS, syncMissions, lockedMissions, recordPlanetMap, settleBattle, collect, collectBlock, shipArrived, mapRecord, SHIP_MAP, COLLECTIVE_SHIP } from './missionFlow.js';

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
  assert.equal(CATALOG.collective.ship, COLLECTIVE_SHIP, 'the code names the Collective ship the workbook names');
  for (const m of CATALOG.missions) {
    assert.ok(CATALOG.questLines[m.questLine], m.id);
    // outpost contracts (O3) are granted and collected aboard the planet's own ship, whatever the map
    if (m.type === 'outpost' || m.type === 'farm') {
      assert.equal(m.collectAt, CATALOG.capitalShips[m.planet].ship, m.id);
      assert.ok(m.unlock.some((c) => c.cond === 'capital_ship_arrived'), m.id);
      continue;
    }
    // [MM-story_mw12m06h_1] maps 1-3 are served by the Collective ship; the planet's own ship takes over from map 4
    assert.equal(m.collectAt, m.map <= SHIP_MAP ? COLLECTIVE_SHIP : CATALOG.capitalShips[m.planet].ship, m.id);
    assert.equal(m.unlock.some((c) => c.cond === 'capital_ship_arrived'), m.map > SHIP_MAP, m.id + ': needs the planet ship only from map 4');
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

test('the ship arrives on map 3 at 3 stars or more, not below, not on another map, not on a loss', () => {
  const s = defaultSave();
  assert.equal(SHIP_MAP, 3);
  assert.equal(recordPlanetMap(s, battle('Verdance', 1, 5)).arrived, null, 'map 1');
  assert.equal(recordPlanetMap(s, battle('Verdance', 2, 5)).arrived, null, 'map 2');
  assert.equal(recordPlanetMap(s, battle('Verdance', 3, 2)).arrived, null, 'below 3 stars');
  assert.equal(recordPlanetMap(s, battle('Verdance', 3, 5, { result: 'lose' })).arrived, null, 'a loss');
  assert.equal(shipArrived(s, 'Verdance'), false);
  assert.equal(recordPlanetMap(s, battle('Verdance', 3, 3)).arrived, 'Verdance');
  assert.equal(shipArrived(s, 'Verdance'), true);
  assert.equal(shipArrived(s, 'Florael'), false, 'one planet at a time');
  assert.deepEqual(s.loggedQueue, [{ kind: 'ship', planet: 'Verdance' }]);
  assert.equal(recordPlanetMap(s, battle('Verdance', 3, 5)).arrived, null, 'arrives once');
});

test('maps 1-3 are collected aboard the Collective ship, with no planet ship in orbit', () => {
  const s = defaultSave(), ctx = gated(s);
  syncMissions(s, CATALOG, ctx);
  settleBattle(s, battle('Verdance', 1, 2), CATALOG, ctx);
  const m = rec(s, 'P-VER-01');
  assert.equal(missionStatus(m, s), 'ready');
  assert.equal(m.collectAt, COLLECTIVE_SHIP);
  assert.equal(shipArrived(s, 'Verdance'), false);
  assert.equal(collectBlock(s, m), null, 'the Collective ship is always here');
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
  assert.equal(rec(s, 'P-VER-02').grantedAt, COLLECTIVE_SHIP);
});

test('without the planet ship nothing past map 3 is granted, even with the other gates met', () => {
  const s = defaultSave();
  s.questSteps['QL-VER-P'] = 3; s.progress.xp = 1e6;
  for (const n of Object.keys(CATALOG.techUnlocks)) s.tech.owned[n] = true;
  assert.equal(syncMissions(s, CATALOG, gated(s)).some((m) => m.id === 'P-VER-04'), false);
  s.capitalShips.Verdance = { arrived: true };
  assert.equal(syncMissions(s, CATALOG, gated(s)).some((m) => m.id === 'P-VER-04'), true);
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
  assert.equal(out.arrived, null, 'map 1 brings no ship');
  assert.deepEqual(out.ready, ['P-VER-01']);
  assert.equal(s.progress.battles, 1);
  assert.equal(settleBattle(s, battle('Verdance', 3, 3), CATALOG, ctx).arrived, 'Verdance');
  assert.ok(s.loggedQueue.some((q) => q.kind === 'ship'));
});

test('main.js settles missions in the played-battle branch only', () => {
  const MAIN = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  assert.ok(/settleBattle\(sv, played, missionCatalog/.test(MAIN));
});

// ── MLG-9: primary / secondary flow + quest lines [MM-story_mvzkd2t8_1k] ───────────────────────────────────────
const withShip = (alignment = 0) => {
  const s = defaultSave();
  s.alignment = alignment;
  s.capitalShips.Verdance = { arrived: true };
  s.planetMaps.Verdance = { 1: { beaten: true, bestAvg: 3, runs: 1, improved: false } };
  return s;
};
const ctxOf = gated;
const ids = (list) => list.map((m) => m.id);

test('the content is one primary per planet x map and a Light and a Shadow secondary for each', () => {
  const m = CATALOG.missions.filter((x) => x.type !== 'outpost' && x.type !== 'farm');   // the outpost and farming contracts are their own lines
  assert.equal(m.filter((x) => x.role === 'primary').length, 81);
  assert.equal(m.filter((x) => x.variant === 'light').length, 81);
  assert.equal(m.filter((x) => x.variant === 'shadow').length, 81);
  for (const P of Object.keys(CATALOG.capitalShips)) for (let k = 1; k <= 9; k++) {
    const here = m.filter((x) => x.planet === P && x.map === k);
    assert.deepEqual(here.map((x) => String(x.variant)).sort(), ['light', 'null', 'shadow'], P + ' ' + k);
  }
});

test('a replay that beats the best result offers the secondary; matching it does not', () => {
  const s = withShip(), ctx = ctxOf(s);
  recordPlanetMap(s, battle('Verdance', 1, 3));
  assert.ok(!ids(syncMissions(s, CATALOG, ctx)).includes('S-VER-01-L'), 'equal is not better');
  assert.ok(lockedMissions(s, CATALOG, ctx).some((d) => d.id === 'S-VER-01-L'), 'listed as locked meanwhile');
  recordPlanetMap(s, battle('Verdance', 1, 4));
  assert.equal(mapRecord(s, 'Verdance', 1).improved, true);
  const got = ids(syncMissions(s, CATALOG, ctx));
  assert.ok(got.includes('S-VER-01-L'));
  assert.ok(!got.includes('S-VER-01-S'), 'one version only');
});

test('alignment history picks the version; the other stays hidden', () => {
  const s = withShip(-1), ctx = ctxOf(s);
  s.planetMaps.Verdance[1].improved = true;
  assert.ok(!lockedMissions(s, CATALOG, ctx).some((d) => d.id === 'S-VER-01-L'), 'Light is out of band: invisible');
  const got = ids(syncMissions(s, CATALOG, ctx));
  assert.ok(got.includes('S-VER-01-S'));
  assert.ok(!got.includes('S-VER-01-L'));
});

test('one attempt: the next battle on that map decides it, and another map does not', () => {
  const s = withShip(2), ctx = ctxOf(s);
  s.planetMaps.Verdance[1].improved = true;
  syncMissions(s, CATALOG, ctx);
  const m = rec(s, 'S-VER-01-L');
  settleBattle(s, battle('Verdance', 2, 5), CATALOG, ctx);
  assert.equal(m.end, null, 'another map is not the attempt');
  const out = settleBattle(s, battle('Verdance', 1, 1, { result: 'lose' }), CATALOG, ctx);
  assert.deepEqual(out.failed, ['S-VER-01-L']);
  assert.equal(m.end, 'failed');
  assert.equal(s.loyalty['Ground / Powder'], -45, 'the broken-promise penalty');
  assert.equal(mapRecord(s, 'Verdance', 1).improved, false, 'the attempt is spent');
  const f = resolvedSecondary(s, out);
  assert.equal(f.outcome, 'BROKEN');
  assert.match(favourMessage(f), /FAVOUR BROKEN.*-45/);
});

test('a kept favour goes Ready and pays its faction impact when collected', () => {
  const s = withShip(2), ctx = ctxOf(s);
  s.planetMaps.Verdance[1].improved = true;
  syncMissions(s, CATALOG, ctx);
  const out = settleBattle(s, battle('Verdance', 1, 5), CATALOG, ctx);
  assert.ok(out.ready.includes('S-VER-01-L'));
  assert.equal(resolvedSecondary(s, out).outcome, 'FULFILLED');
  collect(s, 'S-VER-01-L', CATALOG, ctx);
  assert.equal(s.questSteps['QL-VER-S'], 1);
  assert.equal(s.loyalty['Ground / Powder'], 35);
  assert.equal(s.alignment, 3, 'a zealot giver shifts alignment');
});

test('a failed step is offered again only by a further replay that beats the best', () => {
  const s = withShip(2), ctx = ctxOf(s);
  s.planetMaps.Verdance[1].improved = true;
  syncMissions(s, CATALOG, ctx);
  settleBattle(s, battle('Verdance', 1, 2, { result: 'lose' }), CATALOG, ctx);
  assert.equal(rec(s, 'S-VER-01-L').end, 'failed');
  settleBattle(s, battle('Verdance', 1, 3), CATALOG, ctx);
  assert.equal(rec(s, 'S-VER-01-L').end, 'failed', 'equal to the best: no second chance');
  settleBattle(s, battle('Verdance', 1, 5), CATALOG, ctx);
  assert.equal(rec(s, 'S-VER-01-L').end, null, 'a new best: offered again');
  assert.equal(s.missions.filter((m) => m.id === 'S-VER-01-L').length, 1);
});

test('abandoning spends the attempt too; removing it from the log does not re-offer it', () => {
  const s = withShip(2), ctx = ctxOf(s);
  s.planetMaps.Verdance[1].improved = true;
  syncMissions(s, CATALOG, ctx);
  abandon(s, 'S-VER-01-L', { now: 1 });
  dismiss(s, 'S-VER-01-L');
  assert.ok(!ids(syncMissions(s, CATALOG, ctx)).includes('S-VER-01-L'));
});

test('leaving the band withdraws the favour, and the other version takes its place', () => {
  const s = withShip(0), ctx = ctxOf(s);
  s.planetMaps.Verdance[1].improved = true;
  syncMissions(s, CATALOG, ctx);
  assert.equal(missionStatus(rec(s, 'S-VER-01-L'), s), 'risk');
  s.alignment = -1;
  const got = ids(syncMissions(s, CATALOG, ctx));
  assert.equal(rec(s, 'S-VER-01-L').end, 'failed');
  assert.match(rec(s, 'S-VER-01-L').endReason, /Withdrawn.*Light/);
  assert.ok(got.includes('S-VER-01-S'), 'the Shadow version of the same step');
  assert.deepEqual(reviewAlignment(s, ctx), [], 'withdrawn once');
});

test('either version moves the favours line, and a collected step never offers its other version', () => {
  const s = withShip(2), ctx = ctxOf(s);
  s.planetMaps.Verdance[1].improved = true;
  syncMissions(s, CATALOG, ctx);
  settleBattle(s, battle('Verdance', 1, 5), CATALOG, ctx);
  collect(s, 'S-VER-01-L', CATALOG, ctx);
  s.alignment = -2;
  s.planetMaps.Verdance[1].improved = true;
  assert.ok(!ids(syncMissions(s, CATALOG, ctx)).includes('S-VER-01-S'), 'step 1 is done');
  assert.ok(!lockedMissions(s, CATALOG, ctx).some((d) => d.id === 'S-VER-01-S'));
  assert.ok(lockedMissions(s, CATALOG, ctx).some((d) => d.id === 'S-VER-02-S'), 'the Shadow path carries on at step 2');
});

test('gates by level and tech node hold a primary back until both are met', () => {
  const s = withShip(0);
  s.questSteps['QL-VER-P'] = 1;
  const locked = () => lockedMissions(s, CATALOG, ctxOf(s)).some((d) => d.id === 'P-VER-02');
  assert.equal(locked(), true);
  s.progress.xp = 100000;
  assert.equal(locked(), true, 'level met, node not owned');
  s.progress.xp = 0; s.tech.owned.cannon2 = true;
  assert.equal(locked(), true, 'node owned, level not met');
  s.progress.xp = 100000;
  assert.equal(locked(), false);
  assert.ok(ids(syncMissions(s, CATALOG, ctxOf(s))).includes('P-VER-02'));
});

test('a whole planet campaign plays through: nine primaries, each opening the next', () => {
  const s = defaultSave(); s.progress.xp = 100000;
  for (let k = 1; k <= 9; k++) {
    syncMissions(s, CATALOG, ctxOf(s));
    const id = 'P-VER-0' + k;
    assert.ok(rec(s, id), id + ' logged');
    settleBattle(s, battle('Verdance', k, 5), CATALOG, ctxOf(s));
    assert.equal(missionStatus(rec(s, id), s), 'ready', id);
    assert.ok(collect(s, id, CATALOG, ctxOf(s)), id + ' collected');
    for (const r of rec(s, id).rewards) if (r.kind === 'tech_unlock') { assert.equal(s.tech.unlocked[r.target], true); s.tech.owned[r.target] = true; }
  }
  assert.equal(s.questSteps['QL-VER-P'], 9);
});
