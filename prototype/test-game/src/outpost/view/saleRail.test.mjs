// The outpost BUILD rail never stays locked after SELL, and sits where the battle's palette sits (owner 2026-11-10:
// "the structure panel on the left never appeared … It should never disappear"; "the exact same placement in outpost
// that I have in map defense") [MM-story_mwbh4iao_2a].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUD_CSS, RAIL_TOP } from './hud.js';
import { PALETTE_CSS } from '../../render/buildPalette.js';

const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

test('the outpost rail takes the battle palette\'s spot: left 6 px, top 56 px, no notch inset', () => {
  const battle = PALETTE_CSS.match(/\.bw-palette \{[^}]*\}/)[0];
  assert.match(battle, /left:6px/);
  assert.equal(Number(battle.match(/top:(\d+)px/)[1]), RAIL_TOP);
  const rail = HUD_CSS.match(/\.op \.bw-palette\.op-rail \{[^}]*\}/)[0];
  assert.match(rail, /left:6px;/);
  assert.doesNotMatch(rail, /safe-area/);
  assert.match(rail, new RegExp(`--rail-top, ${RAIL_TOP}px`));
});

test('the sale clock and its watchdog run first in the frame, before anything that could throw', () => {
  const view = src('./outpostView.js');
  const frame = view.slice(view.indexOf('function frame(t)'));
  const watchdog = frame.indexOf("finishSale('watchdog')"), firstWork = frame.indexOf('autoFit()');
  assert.ok(watchdog > 0 && watchdog < firstWork, 'the watchdog must come before autoFit()');
  assert.match(view, /export const SALE_GRACE = \d/);
  // the old one-shot finish (only on the done frame) is gone: every end goes through finishSale, which unlocks
  assert.doesNotMatch(view, /out\.sale\.done\) \{ saleRun = null/);
  const finish = view.slice(view.indexOf('function finishSale('), view.indexOf('function close()'));
  assert.match(finish, /hud\.setBusy\(false\)/);
  assert.match(finish, /refreshHud\(true\)/);
});

test('a sale frame that throws ends the sale in the scene instead of throwing every frame', () => {
  const scene = src('./outpostScene.js');
  assert.match(scene, /try \{ out\.sale = stepSale\(dt, out\); \} catch \(e\) \{[^}]*endSale\(\)/);
  assert.match(scene, /cancelSale: endSale/);
});
