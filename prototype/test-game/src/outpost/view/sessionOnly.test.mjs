// S2.4d [MM-story_mwc9pkcd_2g] — the outpost IS the battle session (TECH_PLAN::One-Battle-UX.md §4); S6
// [MM-story_mwc9q1y6_2n] [MM-story_mwcgbd9q_2y] — so is the farm: one OUTPOST entry on the planet menu, one view, the farm a
// tab of the battle rail. The old farm view (outpostView.js) and everything only it used are gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
const gone = (f) => existsSync(new URL(f, import.meta.url)) === false;

test('the menu opens the session view directly: one OUTPOST entry, no FARM button', () => {
  const menu = src('../../menu/menu.js');
  assert.match(menu, /import\('\.\.\/outpost\/view\/sessionView\.js'\)/, 'the OUTPOST button opens sessionView.js');
  assert.match(menu, /V\.openOutpostSessionView\(\{ planet, tab,/);
  assert.doesNotMatch(menu, /mkBtn\('FARM'/, 'no FARM button on the planet menu');
  assert.doesNotMatch(menu, /bwm-pair/, 'OUTPOST no longer shares a row with FARM');
  assert.match(menu, /farm: ' \+ farm\.hint/, 'the farm\'s status rides on the OUTPOST button\'s line');
});

test('the old farm view and the files only it used are deleted', () => {
  for (const f of ['./outpostView.js', './hud.js', './layout.js', './buildMenu.js', './sellTimeline.js', './statusReport.js', './visitProbe.js', './harvestDrive.js']) {
    assert.ok(gone(f), `${f} is deleted`);
  }
});

test('a deep link to the farm opens the outpost on its FARM tab; with no farm there is one catalogue and no toggle', () => {
  const s = src('./sessionView.js');
  assert.match(s, /if \(farmed && opts\.tab === 'farm'\) catalogue\.setTab\('farm'\);/);
  assert.match(s, /createCatalogue\(farmed\s*\? \[\{ id: 'build', label: 'BUILD', ids: outpostCatalogueIds\(\) \}, \{ id: 'farm', label: 'FARM', ids: farmIds \}\]\s*: outpostCatalogueIds\(\)\)/);
});

test('farm items go through the battle placement, then the save session (no second rules engine)', () => {
  const s = src('./sessionView.js');
  assert.match(s, /if \(cmd && cmd\.type === 'place' && isFarmStructId\(cmd\.structId\)\) return placeFarmItem\(cmd\);/);
  assert.match(s, /const chk = validatePlacement\(sim, cmd\.structId, cmd\.cell\);/, 'the sim\'s own check first');
  assert.match(s, /actOnSave\(\{ type: 'farmPlace', what: def\.farmItem, id: def\.farmId,/, 'then the save session\'s farmPlace');
  assert.match(s, /farmGroundRule\(/, 'the farm\'s ground rule rides in the sim\'s placementRules');
  assert.match(s, /createFarmLayer\(r\.THREE, r, /, 'the farm picture on the session\'s own 3D view');
});

test('the session view takes its host away when it fails to open (never a dead end over the menu)', () => {
  const s = src('./sessionView.js');
  assert.match(s, /if \(opening\.host\) opening\.host\.remove\(\);/);
});
