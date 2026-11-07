// [MM-story_mw1azvh8_d] The battle log behind the Play page's HISTORY, and the history modal's markup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { battleEntry, logBattle, battlesOn, planetRecord, LOG_CAP } from './battleLog.js';
import { defaultSave, migrate } from './save.js';
import { historyModel, historyHtml, whenText } from '../menu/battleHistory.js';
import { PLANETS } from '../data/planets.js';

const entry = (over = {}) => battleEntry({ at: 1000, planet: 'Verdance', faction: 'Ground / Powder', mapId: 2, mapName: 'Hold', result: 'win',
  finalScore: { score: 5000, kills: 40, minutes: 9, seconds: 5 }, waveStars: [5, 4, 3, 4, 4, 3, 4, 5].map((stars) => ({ stars })), totalWaves: 8,
  rewards: { gold: { earned: 700 }, xp: { earned: 120 } }, harvested: { common: 900, rare: 6 }, kept: { rare: 6 }, contract: true,
  favour: { title: 'Fair Shares', outcome: 'FULFILLED', giver: 'x' }, ...over });

test('an entry is compact and complete', () => {
  const e = entry();
  assert.equal(e.result, 'win');
  assert.equal(e.seconds, 545);
  assert.equal(e.avg, 4);
  assert.deepEqual(e.stars, [5, 4, 3, 4, 4, 3, 4, 5]);
  assert.equal(e.gold, 700);
  assert.deepEqual(e.harvested, { common: 900, uncommon: 0, rare: 6, epic: 0 });
  assert.deepEqual(e.favour, { title: 'Fair Shares', outcome: 'FULFILLED' });
  assert.ok(JSON.stringify(e).length < 500, 'about 0.3 KB');
  const lost = entry({ result: 'lose', waveStars: [{ stars: 2 }, { stars: 1 }], rewards: null });
  assert.equal(lost.waves, 2);
  assert.equal(lost.avg, 0.4, 'a defeat averages over all 8 waves');
  assert.equal(lost.gold, 0);
});

test('the log keeps the newest first and drops the oldest past the cap', () => {
  const s = defaultSave();
  assert.deepEqual(s.battleLog, []);
  for (let i = 0; i < LOG_CAP + 5; i++) logBattle(s, entry({ at: i }));
  assert.equal(s.battleLog.length, LOG_CAP);
  assert.equal(s.battleLog[0].at, LOG_CAP + 4);
  const old = migrate({ v: 1 });
  assert.deepEqual(old.battleLog, [], 'older saves gain an empty log');
});

test('a planet record reads its own battles and its per-map bests', () => {
  const s = defaultSave();
  logBattle(s, entry({ planet: 'Florael' }));
  logBattle(s, entry({ result: 'lose' }));
  logBattle(s, entry({ finalScore: { score: 9000, kills: 10 } }));
  s.planetMaps.Verdance = { 2: { beaten: true, bestAvg: 4, runs: 2 } };
  assert.equal(battlesOn(s, 'Verdance').length, 2);
  const r = planetRecord(s, 'Verdance');
  assert.equal(r.battles, 2);
  assert.equal(r.winRate, 50);
  assert.equal(r.bestScore, 9000);
  assert.equal(r.maps.length, 9);
  assert.deepEqual(r.maps[1], { id: 2, beaten: true, bestAvg: 4, runs: 2 });
  assert.equal(r.maps[0].bestAvg, null);
});

test('the modal lists the battles with their resources, and says so when there are none', () => {
  const s = defaultSave();
  logBattle(s, entry({ at: Date.now() - 2 * 3600e3 }));
  logBattle(s, entry({ at: Date.now(), result: 'lose', mapId: 3 }));
  const html = historyHtml(historyModel(s, PLANETS.ground, { faction: 'Ground / Powder' }));
  assert.match(html, /BATTLE HISTORY/);
  assert.equal((html.match(/class="bh-card /g) || []).length, 2);
  assert.ok(html.indexOf('data-map="3"') < html.indexOf('data-map="2"'), 'newest first');
  assert.match(html, /loam-grain\.webp/);
  assert.match(html, /\+6 kept/);
  assert.match(html, /Favour kept · Fair Shares/);
  assert.match(html, /2 h ago/);
  assert.equal((html.match(/data-mapf=/g) || []).length, 9);
  const empty = historyHtml(historyModel(defaultSave(), PLANETS.water));
  assert.match(empty, /No battles on Rime yet/);
});

test('a card gets REPLAY only when its battle still has a stored replay (O8)', () => {
  const s = defaultSave();
  const t1 = Date.now() - 3600e3, t2 = Date.now();
  logBattle(s, entry({ at: t1 }));
  logBattle(s, entry({ at: t2, mapId: 3 }));
  const m = historyModel(s, PLANETS.ground, { faction: 'Ground / Powder' });
  assert.equal((historyHtml(m).match(/data-replay=/g) || []).length, 0);
  m.replays = new Set([t2]);
  const html = historyHtml(m);
  assert.equal((html.match(/data-replay=/g) || []).length, 1);
  assert.match(html, new RegExp('data-replay="' + t2 + '"'));
});

test('when reads in plain words', () => {
  const now = 10 * 86400e3;
  assert.equal(whenText(now - 10e3, now), 'just now');
  assert.equal(whenText(now - 5 * 60e3, now), '5 min ago');
  assert.equal(whenText(now - 3 * 3600e3, now), '3 h ago');
  assert.equal(whenText(now - 30 * 3600e3, now), 'yesterday');
  assert.equal(whenText(now - 4 * 86400e3, now), '4 days ago');
});

test('main.js logs played battles only, and the Play page has the HISTORY button', () => {
  const MAIN = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  assert.match(MAIN, /if \(mode === 'play' && currentMapId\) \{[\s\S]*?logBattle\(sv, battleEntry\(/);
  const MENU = readFileSync(new URL('../menu/menu.js', import.meta.url), 'utf8');
  assert.match(MENU, /class="bwm-hist" data-history/);
  assert.match(MENU, /openBattleHistory\(root, P,/);
});
