// The end-of-wave report card (owner 2026-11-07): every star condition shows earned or missed with its number, and a
// damage report follows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { waveReportModel, waveReportHtml } from './waveReport.js';
import { buildCampaignMap, resolveResourceTypes } from '../sim/mapgen.js';
import { createSim, stepSim } from '../sim/core.js';
import { buildCampaignWaves } from '../sim/campaign.js';
import { startNextWave } from '../sim/waves.js';

const SC = {
  wave: 2, stars: 3, flags: [true, false, true, false, true],
  detail: { core: { start: 1000, end: 1000, max: 1000 }, harvesters: { start: 2, alive: 1 },
    primary: { gathered: 42, total: 60, need: 36 }, premium: { cleared: 1, total: 2 }, time: { sec: 31.4, par: 40 }, gold: 385 },
};

test('the model gives each of the five stars its own row, with the number behind it', () => {
  const m = waveReportModel(SC, { kills: 12, structuresLost: 1, resources: { wave: { units: { common: 42, uncommon: 10, rare: 0, epic: 0 } }, names: { common: 'Loam Grain' } } });
  assert.equal(m.wave, 2);
  assert.equal(m.stars, 3);
  assert.deepEqual(m.rows.map((r) => r.ok), [true, false, true, false, true]);
  assert.deepEqual(m.rows.map((r) => r.value), ['NO DAMAGE', '1 LOST', '42 / 36', '1 / 2 FIELDS', '31.4s / 40.0s']);
  assert.deepEqual(m.stats.map((d) => d.value), ['12', '1', '100%', '+385']);
  assert.deepEqual(m.resources.map((r) => [r.name, r.units]), [['Loam Grain', 42], ['uncommon', 10]]);
});

test('the report uses the results screen pattern: plate, star rows, damage report, resources, one CONTINUE', () => {
  const html = waveReportHtml(waveReportModel(SC, { kills: 12 }));
  assert.match(html, /class="rs-word">WAVE 2</);
  assert.match(html, /TAP TO SKIP/);
  assert.equal((html.match(/class="rs-cond/g) || []).length, 5);
  assert.equal((html.match(/class="rs-cond ok"/g) || []).length, 3);
  assert.match(html, /DAMAGE REPORT/);
  assert.match(html, /Nothing was harvested this wave/);
  assert.equal((html.match(/data-act=/g) || []).length, 1);
  assert.match(html, /data-act="continue"/);
});

test('the sim sends the numbers with the stars when a wave clears', () => {
  const map = resolveResourceTypes(buildCampaignMap(1, { seed: 2 }), 1);
  const s = createSim(3, { map, waves: buildCampaignWaves(map) });
  startNextWave(s);
  let ev = null;
  for (let i = 0; i < 30 * 400 && !ev; i++) for (const e of stepSim(s, 1 / 30)) if (e.type === 'waveStars') ev = e;
  assert.ok(ev, 'wave 1 cleared');
  const d = ev.detail;
  assert.ok(d.core && d.core.max > 0);
  assert.ok(d.harvesters && d.harvesters.start >= 1);
  assert.ok(d.time.sec > 0 && d.time.par > 0);
  assert.equal(ev.flags[4], d.time.sec <= d.time.par + 0.05);
  if (d.primary) assert.equal(ev.flags[2], d.primary.gathered >= d.primary.total * 0.6 - 1e-6);
  assert.equal(waveReportModel(ev).rows.length, 5);
});
