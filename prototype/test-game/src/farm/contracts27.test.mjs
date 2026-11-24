// [MM-story_mwu3uc19_1v] The 27 farming contracts (F1-F3 x 9 planets, Distribution §5) as content: all in the workbook and
// the catalogue, only the Live ones (Verdance F1) in the game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAPDATA } from '../../content/maps/mapdata.js';
import { FARM_CONTRACTS, farmContractOf, cropOf } from '../data/farm.js';
import { PLANETS } from '../data/planets.js';
import { GATE_CONDITIONS } from '../save/missionFlow.js';
import { MEASURED_CONDITIONS } from '../save/missions.js';
import { measureFarmPlanted } from './contract.js';
import { cropLevel } from './levels.js';
import { defaultSave } from '../save/save.js';

const J = (p) => JSON.parse(readFileSync(new URL('../../' + p, import.meta.url), 'utf8'));
const CATALOG = J('content/missions/missions.json');
const REVEALS = J('content/reveals/reveals.json');
const KEYS = Object.keys(PLANETS).filter((k) => MAPDATA.farmContracts.some((r) => r.Planet_Key === k));

test('the sheet holds all 27: F1, F2 and F3 on each of the nine planets', () => {
  assert.equal(MAPDATA.farmContracts.length, 27);
  assert.equal(KEYS.length, 9);
  for (const k of KEYS) {
    assert.deepEqual(MAPDATA.farmContracts.filter((r) => r.Planet_Key === k).map((r) => r.Contract).sort(), ['F1', 'F2', 'F3'], k);
  }
});

test('each contract grows its own planet\'s crop: F1 the common tier, F2 the rare, F3 the epic (Distribution §5.1)', () => {
  const tier = { F1: 'common', F2: 'rare', F3: 'epic' };
  for (const r of MAPDATA.farmContracts) {
    const crop = MAPDATA.crops.find((c) => c.Resource_Id === r.Crop_Id);
    assert.ok(crop, r.Crop_Id);
    assert.equal(crop.Planet_Key, r.Planet_Key, `${r.Planet_Key} ${r.Contract}`);
    assert.equal(crop.Tier, tier[r.Contract], `${r.Planet_Key} ${r.Contract}`);
  }
});

test('the game plays only the live contracts: Verdance F1', () => {
  assert.deepEqual(FARM_CONTRACTS.map((c) => c.planetKey + ' ' + c.code), ['ground F1']);
  assert.equal(farmContractOf('air', 'F1'), null, 'Florael F1 is planned, so no Factor offers it');
  assert.equal(farmContractOf('ground', 'F2'), null);
  const farm = CATALOG.missions.filter((m) => m.type === 'farm').map((m) => m.id);
  assert.deepEqual(farm, ['FC-VER-1'], 'the Mission Log sees one farming contract');
});

test('the other 26 are planned: in the catalogue beside the missions, never among them', () => {
  const planned = CATALOG.plannedMissions;
  assert.equal(planned.length, 26);
  assert.ok(planned.every((m) => m.status === 'Planned' && m.type === 'farm'));
  const ids = new Set([...CATALOG.missions, ...planned].map((m) => m.id));
  assert.equal(ids.size, CATALOG.missions.length + planned.length, 'no id twice');
  for (const k of KEYS) for (const n of [1, 2, 3]) {
    const id = 'FC-' + PLANETS[k].name.slice(0, 3).toUpperCase() + '-' + n;
    assert.ok(ids.has(id), id);
  }
});

test('F2 and F3 follow the step before and a loyalty rank, and ask for a method, a crop level and a delivery', () => {
  for (const m of CATALOG.plannedMissions.filter((x) => x.step > 1)) {
    assert.deepEqual(m.view.map((c) => [c.cond, c.param, c.value]), [['quest_step_collected', m.questLine, m.step - 1]], m.id);
    const loy = m.unlock.find((c) => c.cond === 'loyalty');
    assert.equal(loy.value, m.step === 2 ? 25 : 50, m.id);
    assert.deepEqual(m.complete.map((c) => c.cond), ['farm_plots_planted', 'crop_level', 'crop_delivered'], m.id);
    assert.equal(m.complete[1].value, m.step === 2 ? 2 : 4, `${m.id}: Uncommon for F2, Epic for F3`);
    assert.ok(cropOf(m.complete[2].param), m.id);
  }
});

test('every condition a farming contract uses is one the game can read, live or planned', () => {
  for (const m of [...CATALOG.missions, ...CATALOG.plannedMissions].filter((x) => x.type === 'farm')) {
    for (const c of [...m.view, ...m.unlock]) assert.ok(GATE_CONDITIONS.includes(c.cond), `${m.id} ${c.cond}`);
    for (const c of m.complete) assert.ok(MEASURED_CONDITIONS.includes(c.cond), `${m.id} ${c.cond}`);
    for (const c of [...m.view, ...m.unlock, ...m.complete]) assert.ok(CATALOG.conditions[c.cond], `${m.id}: ${c.cond} is in the catalogue`);
  }
});

test('the plot count reads the method named (Traditional unless one is)', () => {
  const s = defaultSave();
  s.outposts = { space: { farm: { plots: { a: { method: 'vertical', cycle: 1 }, b: { method: 'traditional', cycle: 1 }, c: { method: 'vertical', cycle: 0 } } } } };
  assert.equal(measureFarmPlanted(s, 'space'), 1);
  assert.equal(measureFarmPlanted(s, 'space', 'vertical'), 1);
  assert.equal(measureFarmPlanted(s, 'space', 'orchard'), 0);
});

test('crop_level reads the crop\'s level by mastery', () => {
  const s = defaultSave();
  assert.equal(cropLevel(s, 'dawnpollen'), 1);
});

test('every Factor has the five line sets drafted (gate, offer, accept, later, farm)', () => {
  for (const k of KEYS) for (const st of ['gate', 'offer', 'accept', 'later', 'farm']) {
    const ls = REVEALS.factionShip.farm[k] && REVEALS.factionShip.farm[k][st];
    assert.ok(Array.isArray(ls) && ls.length && ls.every((l) => l.line && l.intent), `${k} ${st}`);
  }
});
