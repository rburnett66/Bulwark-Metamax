// [MM-story_mw15hyvl_2] The final results screen: model and markup (the timeline is reviewed on tools/results/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { resultsModel, resultsHtml, RESULTS_CSS } from './resultsScreen.js';

const z = () => ({ common: 0, uncommon: 0, rare: 0, epic: 0 });
const base = { result: 'win', finalScore: { score: 36358, kills: 83, minutes: 10, seconds: 7, goldRemaining: 500 },
  waveStars: [4, 3, 5, 2].map((stars) => ({ stars })) };

test('the model reads the battle: verdict, time, stars, average', () => {
  const m = resultsModel({ ...base, planet: 'Verdance', mapId: 3 });
  assert.equal(m.win, true);
  assert.equal(m.time, '10:07');
  assert.deepEqual(m.stars, [4, 3, 5, 2]);
  assert.equal(m.avg, 3.5);
  assert.equal(m.rewards, null);
  assert.equal(m.resources, null);
});

test('rewards: gold only on a win, rank-up restarts the bar', () => {
  const win = resultsModel({ ...base, rewards: { result: 'win', gold: { earned: 900, to: 5000 }, stars: { from: 10, to: 12 }, xp: { from: 0, to: 5000, earned: 5000 } } });
  assert.equal(win.rewards.gold, 900);
  assert.equal(win.rewards.starsNew, 2);
  assert.equal(win.rewards.rankUp, true);
  assert.equal(win.rewards.xpFrom, 0);
  const lose = resultsModel({ ...base, result: 'lose', rewards: { result: 'lose', gold: { earned: 900, to: 5000 }, stars: { from: 10, to: 10 }, xp: { from: 0, to: 10, earned: 10 } } });
  assert.equal(lose.rewards.gold, 0);
  assert.equal(lose.nextMap, null, 'no next map after a defeat');
});

test('resources: tiers collected only, bars scaled to the largest, kept summed', () => {
  const total = { units: { ...z(), common: 200, rare: 50 }, sold: { ...z(), common: 200, rare: 10 }, kept: { ...z(), rare: 40 }, gold: 800 };
  const m = resultsModel({ ...base, resources: { total, names: { common: 'Loam Grain', rare: 'Rootsong <Seeds>' }, contract: true } });
  assert.deepEqual(m.resources.rows.map((r) => r.tier), ['common', 'rare']);
  assert.equal(m.resources.rows[0].soldPct, 100);
  assert.equal(m.resources.rows[1].keptPct, 20);
  assert.equal(m.resources.kept, 40);
  const html = resultsHtml(m);
  assert.match(html, /Rootsong &lt;Seeds&gt;/, 'names are escaped');
  assert.match(html, /KEPT \+40/);
  assert.match(html, /\+40<\/b> TO YOUR INVENTORY/);
});

test('the markup: verdict, one panel per section, actions in the right order', () => {
  const html = resultsHtml(resultsModel({ ...base, nextMap: { id: 4, name: 'Ridge', size: '32x18' }, planet: 'Verdance', mapId: 3 }));
  assert.match(html, /class="rs-word">VICTORY</);
  assert.match(html, /Verdance · Map 3/);
  assert.equal((html.match(/class="rs-wave[ "]/g) || []).length, 4);
  const acts = [...html.matchAll(/data-act="(\w+)"/g)].map((x) => x[1]);
  assert.deepEqual(acts, ['next', 'restart', 'menu']);
  assert.match(html, /class="rs-btn primary" data-act="next"/);
  const lose = resultsHtml(resultsModel({ ...base, result: 'lose' }));
  assert.match(lose, /DEFEAT/);
  assert.match(lose, /class="rs-btn primary" data-act="restart">Retry/, 'after a defeat Retry is the main action');
});

test('the CSS hides the battle HUD while the report is up, and honours reduced motion', () => {
  assert.match(RESULTS_CSS, /\.bw-hud\.bw-results-open > \*:not\(\.bw-result\) \{ visibility:hidden/);
  assert.match(RESULTS_CSS, /prefers-reduced-motion: reduce/);
  assert.match(RESULTS_CSS, /safe-area-inset-bottom/, 'the actions clear a phone home bar');
});
