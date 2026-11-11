// One build catalogue for the rail and the number keys [MM-task_mwcdvlf8_2t] (TECH_PLAN::One-Battle-UX.md S2.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STRUCTURES } from '../data/tables.js';
import { createCatalogue, battleCatalogueIds, lockRule } from './catalogue.js';
import { createSim, applyCommand } from '../sim/core.js';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the campaign catalogue is the build list the battle had: every STRUCTURES entry but the harvester bay, in order', () => {
  assert.deepEqual([...battleCatalogueIds()], Object.keys(STRUCTURES).filter((id) => STRUCTURES[id].kind !== 'harvestorBay'));
  assert.deepEqual([...createCatalogue().ids], [...battleCatalogueIds()]);
});

test('the HUD rail and the number keys both read the catalogue, neither keeps its own list', () => {
  const hud = src('../render/hud.js'), input = src('../input/input.js');
  for (const [name, code] of [['render/hud.js', hud], ['input/input.js', input]]) {
    assert.doesNotMatch(code, /Object\.keys\(STRUCTURES\)/, `${name} lists the catalogue, not STRUCTURES`);
    assert.match(code, /createCatalogue/, `${name} falls back to the campaign catalogue`);
  }
  assert.match(src('./session.js'), /createHud\(mountEl, \{ \.\.\.callbacks, catalogue \}\)/, 'the session hands its catalogue to the HUD');
  assert.match(src('./session.js'), /catalogue \}\)/, 'and to the input');
});

test('a lock is a reason: shown by the rail and refused by the sim', () => {
  const cat = createCatalogue(['OUT-power', 'OUT-mg'], { 'OUT-mg': 'Needs the contract' });
  assert.equal(cat.isLocked('OUT-mg'), 'Needs the contract');
  assert.equal(cat.isLocked('OUT-power'), null);
  const s = createSim(7, {});
  s.economy.money = 1e6;
  s.placementRules = [lockRule(cat)];
  assert.equal(applyCommand(s, { type: 'place', structId: 'OUT-mg', cell: { x: 20, y: 6 } }).reason, 'Needs the contract');
  cat.setLocks({});                                   // the contract step lands: unlocked in place
  assert.equal(applyCommand(s, { type: 'place', structId: 'OUT-mg', cell: { x: 20, y: 6 } }).ok, true);
});

test('one look for a locked item: the padlock and its styles live in the shared palette, not in the outpost rail', () => {
  const palette = src('../render/buildPalette.js'), outpostHud = src('../outpost/view/hud.js');
  assert.match(palette, /export const LOCK_SVG/);
  assert.match(palette, /\.bw-buildbtn\.bw-locked \{/);
  assert.doesNotMatch(outpostHud, /const LOCK_SVG/, 'the outpost rail imports the padlock');
  assert.doesNotMatch(outpostHud, /\.bw-buildbtn\.bw-locked \{ opacity/, 'and its look');
});
