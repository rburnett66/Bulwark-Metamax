// [MM-story_mwatmvpt_1k] owner rule 11: the Pod Reward Chest is how battle pods arrive — one pod per 100 units of an
// unlocked crop delivered, carried between maps, granted on a won map and held until opened.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unitsPerPod, chestsHeld, chestPodCount, deliver, takeChestPods, settleChest, openChest } from './chest.js';
import { unlockPods, podsUnlocked } from './unlock.js';
import { podCount } from './pods.js';
import { defaultSave, migrate } from '../save/save.js';
import { settleBattle, flowCtx } from '../save/missionFlow.js';
import { battleResult } from '../save/missions.js';
import { createBattleTally, finishTally } from '../save/battleTally.js';
import { chestStripHtml, chestCardHtml } from '../menu/podChest.js';

const open = (...ids) => { const s = defaultSave(); for (const id of ids) unlockPods(s, id); return s; };
const WIN = { planet: 'ground', mapId: 1, result: 'win', at: 1000 };

test('one pod per 100 delivered, every tier alike, from the workbook', () => {
  assert.equal(unitsPerPod(), 100);
});

test('a won map turns full hundreds into a chest; the rest carries; pods are not in the stock until it is opened', () => {
  const s = open('loam-grain', 'elder-bloom');
  const r = settleChest(s, { 'loam-grain': 250, 'elder-bloom': 100 }, WIN);
  assert.deepEqual(r.chest, { id: 'pc1', planet: 'ground', mapId: 1, at: 1000, pods: { 'loam-grain': 2, 'elder-bloom': 1 } });
  assert.deepEqual(s.podCarry, { 'loam-grain': 50 });
  assert.equal(podCount(s, 'loam-grain'), 0, 'the chest is the delivery mechanism: nothing yet');
  assert.equal(chestsHeld(s).length, 1);
  assert.equal(chestPodCount(r.chest), 3);
  const o = openChest(s, 'pc1');
  assert.deepEqual(o.draws, [{ crop: 'loam-grain', n: 2 }, { crop: 'elder-bloom', n: 1 }]);
  assert.equal(podCount(s, 'loam-grain'), 2);
  assert.equal(podCount(s, 'elder-bloom'), 1);
  assert.deepEqual(chestsHeld(s), []);
  assert.equal(openChest(s, 'pc1'), null, 'a chest opens once');
});

test('50 on one map and 50 on the next drop one pod (owner example)', () => {
  const s = open('heartwood-amber');
  assert.equal(settleChest(s, { 'heartwood-amber': 50 }, WIN).chest, null, 'no pods: no chest');
  assert.equal(s.podCarry['heartwood-amber'], 50);
  const r = settleChest(s, { 'heartwood-amber': 50 }, { ...WIN, mapId: 2 });
  assert.deepEqual(r.chest.pods, { 'heartwood-amber': 1 });
  assert.equal(s.podCarry['heartwood-amber'], undefined, 'an exact pod leaves no carry');
});

test('a lost map adds to the carry and grants no chest; the next win holds it all', () => {
  const s = open('loam-grain');
  assert.equal(settleChest(s, { 'loam-grain': 180 }, { ...WIN, result: 'loss' }).chest, null);
  assert.equal(s.podCarry['loam-grain'], 180);
  assert.deepEqual(settleChest(s, { 'loam-grain': 40 }, WIN).chest.pods, { 'loam-grain': 2 });
  assert.equal(s.podCarry['loam-grain'], 20);
});

test('counting starts at the unlock: on the crossing map only the units past 500 count', () => {
  const s = defaultSave();
  assert.deepEqual(deliver(s, { 'heartwood-amber': 300 }).counted, {});
  const r = settleChest(s, { 'heartwood-amber': 350 }, WIN);
  assert.deepEqual(r.unlocked, ['heartwood-amber']);
  assert.deepEqual(r.chest.pods, { 'heartwood-amber': 1 }, '650 delivered: 150 past the unlock, one pod');
  assert.equal(s.podCarry['heartwood-amber'], 50);
});

test('the chest ids count up and chests are held oldest first', () => {
  const s = open('loam-grain');
  settleChest(s, { 'loam-grain': 100 }, WIN);
  settleChest(s, { 'loam-grain': 300 }, { ...WIN, mapId: 2 });
  assert.deepEqual(chestsHeld(s).map((c) => [c.id, chestPodCount(c)]), [['pc1', 1], ['pc2', 3]]);
  openChest(s, 'pc2');
  assert.deepEqual(chestsHeld(s).map((c) => c.id), ['pc1']);
  settleChest(s, { 'loam-grain': 100 }, WIN);
  assert.deepEqual(chestsHeld(s).map((c) => c.id), ['pc1', 'pc3'], 'an id is never reused');
});

test('junk in is nothing out; the same delivery gives the same chest', () => {
  const s = open('loam-grain');
  assert.deepEqual(deliver(s, { 'loam-grain': -5, 'not-a-crop': 900 }).counted, {});
  assert.deepEqual(takeChestPods(s), {});
  const a = open('loam-grain'), b = open('loam-grain');
  settleChest(a, { 'loam-grain': 777 }, WIN); settleChest(b, { 'loam-grain': 777 }, WIN);
  assert.deepEqual(a, b);
});

test('settleBattle: the whole harvest (quota and surplus) feeds the chest; Helium-3 never makes Helium-4 pods', () => {
  const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
  const stars = Array.from({ length: 8 }, (_, i) => ({ wave: i + 1, stars: 1, flags: [true, false, false, false, false] }));
  const base = { mapId: 1, faction: 'x', totalWaves: 8, waveStars: stars,
    finalScore: { kills: 400, goldSpent: 3000, totalSeconds: 300 }, mapScore: { goldFromPrimary: 2000, goldFromPremium: 2000, questRed: 30, questGreen: 30 } };
  const tally = (o) => { const t = finishTally(createBattleTally()); t.harvested = { common: 0, uncommon: 0, rare: 0, epic: 0, ...o }; t.kept = { common: 0, uncommon: 0, rare: 0, epic: 0 }; return t; };
  const s = open('loam-grain', 'regolith'), ctx = flowCtx(s, { allOpen: true, now: 1 });
  const won = settleBattle(s, { ...battleResult({ ...base, planet: 'Verdance', result: 'win' }), tally: tally({ common: 230 }) }, CATALOG, ctx);
  assert.deepEqual(won.chest.pods, { 'loam-grain': 2 }, 'any star level: one star still wins a chest');
  assert.equal(podCount(s, 'loam-grain'), 0);
  const lumen = settleBattle(s, { ...battleResult({ ...base, planet: 'Lumen', result: 'win' }), tally: tally({ common: 100, uncommon: 5000 }) }, CATALOG, ctx);
  assert.deepEqual(lumen.chest.pods, { regolith: 1 });
  assert.equal(s.podCarry['helium-4'], undefined);
  const bare = settleBattle(s, { ...battleResult({ ...base, planet: 'Verdance', result: 'win' }), tally: undefined }, CATALOG, ctx);
  assert.equal(bare.chest, null);
});

test('a save from before chests loads with none held', () => {
  const s = defaultSave(); delete s.podChests; delete s.podChestSeq;
  const m = migrate(s);
  assert.deepEqual(m.podChests, []);
  assert.equal(m.podChestSeq, 0);
});

test('the SEED PODS strip shows the oldest chest and OPEN; the card names the crop and the pods', () => {
  const s = open('loam-grain');
  assert.equal(chestStripHtml(s), '');
  settleChest(s, { 'loam-grain': 300 }, WIN);
  settleChest(s, { 'loam-grain': 100 }, WIN);
  const html = chestStripHtml(s);
  assert.match(html, /Pod Reward Chests · 2/);
  assert.match(html, /Verdance · map 1 · 3 pods inside · 1 more waiting/);
  assert.match(html, /data-chest-open="pc1"/);
  const card = chestCardHtml({ crop: 'loam-grain', n: 3 });
  assert.match(card, /Loam Grain/);
  assert.match(card, /\+3 pods/);
  assert.match(chestCardHtml({ crop: 'loam-grain', n: 1 }), /\+1 pod</);
});
