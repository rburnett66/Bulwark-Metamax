// [MM-story_mw13ek87_1] Resources collected on the wave banner and the map result screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createResourceLedger, feedResources, closeWave, resourceNames, waveResourcesHtml, mapResourcesHtml } from './resourceSummary.js';

const CATALOG = JSON.parse(readFileSync(new URL('../../content/missions/missions.json', import.meta.url), 'utf8'));
const dep = (color, units, sold = units, gold = units * 4) => ({ type: 'deposit', color, units, sold, kept: units - sold, gold });

test('a wave closes with what it collected; the map total keeps running', () => {
  const led = createResourceLedger();
  feedResources(led, [dep('blue', 40), dep('yellow', 10), { type: 'kill' }]);
  const w1 = closeWave(led);
  assert.equal(w1.units.common, 40);
  assert.equal(w1.units.uncommon, 10);
  feedResources(led, [dep('blue', 40, 25, 100), dep('red', 6, 0, 0)]);
  const w2 = closeWave(led);
  assert.deepEqual(w2.units, { common: 40, uncommon: 0, rare: 6, epic: 0 });
  assert.deepEqual(led.total.units, { common: 80, uncommon: 10, rare: 6, epic: 0 });
  assert.deepEqual(led.total.kept, { common: 15, uncommon: 0, rare: 6, epic: 0 });
  assert.equal(led.total.gold, 160 + 40 + 100);
  assert.deepEqual(led.wave.units, { common: 0, uncommon: 0, rare: 0, epic: 0 }, 'the next wave starts at zero');
});

test('a deposit with no contract counts as all sold, none kept', () => {
  const led = createResourceLedger();
  feedResources(led, [{ type: 'deposit', color: 'blue', units: 30, gold: 120 }]);
  assert.equal(led.total.sold.common, 30);
  assert.equal(led.total.kept.common, 0);
});

test("the planet's own resource names label the tiers", () => {
  const n = resourceNames(CATALOG, 'Verdance');
  const want = CATALOG.resources.filter((r) => r.planet === 'Verdance');
  for (const r of want) assert.equal(n[r.tier], r.name);
  assert.equal(resourceNames(null, 'Verdance').common, 'Common', 'catalogue not loaded yet');
});

test('the wave line shows +this wave and the running total, only for tiers collected', () => {
  const led = createResourceLedger();
  assert.equal(waveResourcesHtml(led.wave, led.total), '', 'nothing yet: no line');
  feedResources(led, [dep('blue', 1200)]);
  const html = waveResourcesHtml(closeWave(led), led.total, { common: 'Amber <Grain>', uncommon: 'U', rare: 'R', epic: 'E' });
  assert.match(html, /\+1,200/);
  assert.match(html, /1,200 total/);
  assert.match(html, /Amber &lt;Grain&gt;/, 'names are escaped');
  assert.ok(!html.includes('#ffd76a'), 'tiers with nothing collected are left out');
});

test('the map panel lists collected, sold and kept per tier with a total row', () => {
  const led = createResourceLedger();
  feedResources(led, [dep('blue', 100, 60, 240), dep('green', 5, 5, 20)]);
  const html = mapResourcesHtml(led.total, undefined, { contract: true });
  assert.match(html, /RESOURCES COLLECTED/);
  assert.match(html, /<th>Sold<\/th><th>Kept<\/th>/);
  assert.match(html, /\+40/);
  assert.match(html, /<tr class="sum"><td>Total<\/td><td>105<\/td><td>65<\/td><td class="k">\+40<\/td>/);
  assert.match(html, /260 GOLD FROM HARVEST · KEPT GOES TO YOUR INVENTORY/);
  assert.ok(!mapResourcesHtml(led.total).includes('Sold'), 'no contract: just collected');
  assert.match(mapResourcesHtml(createResourceLedger().total), /Nothing was harvested/);
});
