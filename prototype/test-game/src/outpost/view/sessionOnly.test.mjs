// S2.4d [MM-story_mwc9pkcd_2g] — the outpost IS the battle session (TECH_PLAN::One-Battle-UX.md §4).
// The menu's OUTPOST button opens outpostView.js openOutpostView; for every player (no URL flag) the OUTPOST tab must go
// to sessionView.js, and the farm view's OUTPOST tab must hand over to it rather than draw a second outpost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

test('openOutpostView sends the OUTPOST tab to the session view, with no flag', () => {
  const v = src('./outpostView.js');
  assert.match(v, /export async function openOutpostView\(opts = \{\}\) \{\s*\/\/[^\n]*\n\s*if \(opts\.tab !== 'farm'\) return openOutpostSessionView\(opts\);/,
    'the first thing openOutpostView does is open the session view for anything but the farm');
  assert.doesNotMatch(v, /sessionViewWanted|get\('outpost'\)/, 'no URL flag decides it');
  assert.doesNotMatch(src('./sessionView.js'), /sessionViewWanted/, 'the flag reader is gone');
});

test('the farm view is farm-only: its OUTPOST tab hands over to the session view', () => {
  const v = src('./outpostView.js');
  assert.match(v, /const tab = 'farm';/);
  assert.match(v, /if \(t === 'outpost'\) \{ handoff = 'outpost'; close\(\); \}/);
  assert.match(v, /current = await openOutpostSessionView\(\{ \.\.\.opts, tab: 'outpost' \}\);/);
  assert.doesNotMatch(v, /\bbuildMenu\(o, map/, 'the outpost build list is the battle rail, not the farm view');
  assert.doesNotMatch(v, /onlineChecks|harvestDrive/, 'no GO ONLINE card or harvester trip of the old outpost view');
});

test('the old view\'s harvester trip is deleted (the session runs the battle\'s harvesters, liveSim.js)', () => {
  assert.equal(existsSync(new URL('./harvestDrive.js', import.meta.url)), false);
});

test('the session view takes its host away when it fails to open (never a dead end over the menu)', () => {
  const s = src('./sessionView.js');
  assert.match(s, /if \(opening\.host\) opening\.host\.remove\(\);/);
});
