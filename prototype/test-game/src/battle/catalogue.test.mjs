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
  assert.match(src('./session.js'), /createHud\(mountEl, \{[^}]*\.\.\.callbacks, catalogue \}\)/, 'the session hands its catalogue to the HUD');
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

test('one look for a locked item: the padlock and its styles live in the shared palette (the only rail since S6)', () => {
  const palette = src('../render/buildPalette.js');
  assert.match(palette, /export const LOCK_SVG/);
  assert.match(palette, /\.bw-buildbtn\.bw-locked \{/);
});

// ── TABS [MM-story_mwcgbd9q_2y]: a mode may hand several catalogues (the outpost's BUILD | FARM); battles hand one ──────
test('one id list is one tab: shown() is the list, no toggle (every battle rail as before)', () => {
  const cat = createCatalogue();
  assert.equal(cat.tabs.length, 1);
  assert.deepEqual([...cat.shown()], [...battleCatalogueIds()]);
  assert.deepEqual([...cat.ids], [...battleCatalogueIds()]);
  assert.equal(cat.setTab('farm'), false, 'no other tab to show');
});

test('several tabs: ids are all of them in order, shown() the visible one, setTab switches and tells its listeners', () => {
  const cat = createCatalogue([{ id: 'build', label: 'Build', ids: ['OUT-power', 'OUT-mg'] }, { id: 'farm', label: 'FARM', ids: ['FARM-traditional', 'FARM-silo'] }],
    { 'FARM-silo': 'Costs 800 gold' });
  assert.deepEqual([...cat.ids], ['OUT-power', 'OUT-mg', 'FARM-traditional', 'FARM-silo']);
  assert.deepEqual(cat.tabs.map((t) => t.label), ['BUILD', 'FARM']);
  assert.equal(cat.tab, 'build');
  assert.deepEqual([...cat.shown()], ['OUT-power', 'OUT-mg']);
  const heard = [];
  cat.onTab((id) => heard.push(id));
  assert.equal(cat.setTab('farm'), true);
  assert.deepEqual([...cat.shown()], ['FARM-traditional', 'FARM-silo']);
  assert.deepEqual(heard, ['farm']);
  assert.equal(cat.setTab('farm'), false, 'already there');
  assert.equal(cat.setTab('nope'), false);
  assert.equal(cat.tabOf('OUT-mg'), 'build');
  assert.equal(cat.isLocked('FARM-silo'), 'Costs 800 gold', 'locks cover every tab');
});

test('the number keys follow the visible tab (input.js reads catalogue.shown())', async () => {
  const listeners = {};
  globalThis.window = globalThis.window || { addEventListener: (t, fn) => { listeners[t] = fn; }, removeEventListener() {} };
  const { createInput, createUiState, destroyInput } = await import('../input/input.js');
  const canvas = { addEventListener() {}, removeEventListener() {} };
  const cat = createCatalogue([{ id: 'build', label: 'BUILD', ids: ['OUT-power', 'OUT-mg'] }, { id: 'farm', label: 'FARM', ids: ['FARM-traditional', 'FARM-silo'] }]);
  const ui = createUiState();
  const sim = createSim(7, {});
  const h = createInput(canvas, null, () => sim, () => ({ ok: true }), ui, { catalogue: cat });
  const key = (k) => listeners.keydown({ key: k, preventDefault() {}, target: null });
  key('2');
  assert.equal(ui.buildSelection, 'OUT-mg', 'key 2 on BUILD');
  cat.setTab('farm');
  key('1');
  assert.equal(ui.buildSelection, 'FARM-traditional', 'key 1 on FARM');
  key('3');
  assert.equal(ui.buildSelection, 'FARM-traditional', 'no third FARM item: nothing changes');
  destroyInput(h);
});

test('the battle rail with one catalogue keeps its BUILD title; tabs only appear for a mode with several', () => {
  const hud = src('../render/hud.js');
  assert.match(hud, /if \(tabs\.length > 1\) \{[\s\S]*?\} else palette\.appendChild\(el\(doc, 'div', 'bw-title', 'BUILD'\)\);/);
  assert.match(hud, /const key = keyOf\(structId, i\);/);
  assert.match(hud, /if \(tabs\.length < 2\) return i \+ 1;/, 'one tab: the badges are 1, 2, 3 … as before');
});
