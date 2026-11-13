// The SELL sequence on the session view [MM-story_mwefm2or_j] (owner 2026-11-12: "on the updated outpost when I sell
// resources I dont see the dollar values or the deliver ship take off"): the sell action starts the timeline, the scene
// plays the shuttle and the "$N" pops, the HUD's gold counts up rather than jumping, and a battle is unaffected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSaleDriver, SALE_GRACE } from './saleDriver.js';
import { SELL } from './sellTimeline.js';
import { createSession } from './session.js';
import { acceptOutpostContract } from '../contract.js';
import { referenceOutpost } from '../model.js';
import { defaultSave } from '../../save/save.js';
import { map, catalog, memoryStore, T0, MIN } from './fixtures.mjs';

const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

function fresh(gold = 1000) {
  const s = defaultSave();
  s.capitalShips = { Verdance: { arrived: true } };
  s.carry = { gold, structures: [] }; s.goldBank = gold;
  acceptOutpostContract(s, 'ground', { map, now: T0, seedSalt: 'test' });
  s.outposts.ground = referenceOutpost('ground', { seed: s.outposts.ground.seed, map, now: T0 });
  return s;
}
/** A real sale from the save session: 60 iron = 4 loads. */
function aSale() {
  const store = memoryStore(fresh(1000));
  const v = createSession({ store, planet: 'ground', map, catalog, raidHook: null, flowOpts: { allOpen: true } });
  v.act({ type: 'online' }, T0);
  const before = store.load().outposts.ground;
  return { res: v.act({ type: 'sell' }, T0 + 20 * MIN), before };
}
/** A scene double: records playSale, reports a sale step like outpostScene's (gold from the timeline). */
function fakeScene({ fail = false } = {}) {
  const sc = { played: [], saling: false, cancelled: 0 };
  sc.playSale = (tl, o) => { sc.played.push({ tl, o }); sc.saling = true; return fail ? Promise.reject(new Error('no shuttle GLB')) : Promise.resolve(1); };
  sc.cancelSale = () => { sc.cancelled++; sc.saling = false; };
  return sc;
}

test('the sell action starts the timeline: the scene plays it, one "$N" per load, from the gold before the sale', () => {
  const { res, before } = aSale();
  assert.equal(res.ok, true); assert.equal(res.loads.length, 4);
  const scene = fakeScene(), d = createSaleDriver({});
  const tl = d.start(res, { goldFrom: 1000, before, scene });
  assert.ok(tl, 'a timeline');
  assert.equal(d.active, true);
  assert.equal(scene.played.length, 1, 'the scene plays the sale (shuttle, crates, splatter, pops)');
  assert.equal(scene.played[0].tl, tl);
  assert.equal(scene.played[0].o, before, 'on the outpost before the sale');
  assert.equal(tl.pops.length, 4);
  assert.deepEqual(tl.pops.map((p) => p.gold), res.loads.map((l) => l.gold));
  assert.equal(tl.goldTo, 1000 + res.earned);
  assert.ok(tl.beats.some((b) => b.type === 'lift'), 'the shuttle lifts off');
});

test('the HUD gold counts up across the arc (not a jump), then is the bank; the lift shakes the camera', () => {
  const { res, before } = aSale();
  const d = createSaleDriver({});
  const tl = d.start(res, { goldFrom: 1000, before, scene: null });
  const bank = 1000 + res.earned;
  assert.equal(d.shown(bank), 1000, 'the bank is credited, the HUD still shows the gold before');
  const seen = [];
  let shook = false;
  for (let t = 0; t < tl.duration + 0.1; t += 1 / 60) {
    // the scene's step reports the shake beat on the lift, as outpostScene's stepSale does
    const out = Math.abs(t - SELL.shake) < 1 / 120 ? { shake: { amp: 0.2, until: t + SELL.shakeFor, t0: t } } : null;
    d.step(1 / 60, out);
    const j = d.offset();
    if (j.x || j.z) shook = true;
    seen.push(d.shown(bank));
  }
  assert.ok(shook, 'the camera shakes on the lift');
  assert.ok(seen.some((g) => g > 1000 && g < bank), 'in-between values: it counts up');
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], 'never down');
  assert.equal(d.active, false, 'the sale ends with its timeline');
  assert.equal(d.shown(bank), bank);
});

test('a shuttle that fails to load leaves the pops and count-up playing; the failure is a crumb; a watchdog ends a stall', async () => {
  const { res, before } = aSale();
  const crumbs = [], scene = fakeScene({ fail: true });
  const d = createSaleDriver({ crumb: (m) => crumbs.push(m) });
  const tl = d.start(res, { goldFrom: 1000, before, scene });
  await new Promise((ok) => setTimeout(ok, 0));
  assert.ok(crumbs.some((m) => /sale shuttle failed · no shuttle GLB/.test(m)), crumbs.join(' | '));
  assert.equal(d.active, true, 'the sale plays on');
  d.step(1.5, { sale: { done: false, gold: tl.countAt(1.5) } });
  assert.equal(d.shown(0), tl.countAt(1.5));
  d.step(tl.duration + SALE_GRACE, { sale: { done: false, gold: tl.goldTo } });   // the scene never says done
  assert.equal(d.active, false, 'the watchdog ended it');
  assert.equal(scene.cancelled, 1, 'and put the scene back');
});

test('nothing to play: a refused sale starts no timeline; a reduced-motion sale keeps the pops and count-up', () => {
  const d = createSaleDriver({ reduced: true });
  assert.equal(d.start({ ok: false, error: 'no full load yet' }, {}), null);
  assert.equal(d.active, false);
  const { res } = aSale();
  const tl = d.start(res, { goldFrom: 0 });
  assert.deepEqual([...new Set(tl.beats.map((b) => b.type))].sort(), ['count', 'pop']);
});

test('the session view wires it: sell through actOnSave starts the sale, the frame hook steps it, the HUD reads it', () => {
  const s = src('./sessionView.js');
  assert.match(s, /const saleRun = createSaleDriver\(\{ reduced, crumb \}\);/);
  assert.match(s, /if \(action\.type === 'sell'\) saleRun\.start\(res, \{ goldFrom, before: back\.outpost, scene \}\);/);
  assert.match(s, /sceneOut = scene\.update\(dt, view\);/);
  assert.match(s, /saleRun\.step\(dt, sceneOut\);/);
  assert.match(s, /goldShown: \(bank\) => saleRun\.shown\(bank\),/);
  // the card's S SELL and a building's SELL RESOURCES both go through actOnSave
  assert.match(s, /const cardAct = \(action\) => \{ const r = actOnSave\(action\);/);
  assert.match(s, /act: \(action\) => \{\s*const r = actOnSave\(action\);/);
});

test('the scene plays it on the battle\'s own gold popups, with the shuttle off the hub; battles opt out of the count-up', () => {
  const sc = src('./outpostScene.js');
  assert.match(sc, /function playSale\(tl, o\)/);
  assert.match(sc, /kit\.make\('shuttle'\)/, 'the shuttle GLB through the model kit');
  assert.match(sc, /createEngineFx\(THREE, holder/, 'engine FX');
  assert.match(sc, /r\.gold\.feed\(\[\{ type: 'deposit', gold: b\.gold/, 'the "$N" pops are the battle gold popups (one engine)');
  assert.match(sc, /p\.color = popColour\(b\.colour\)/, 'in the ore colour');
  const hud = src('../../render/hud.js');
  assert.match(hud, /const shownOf = hud\.callbacks && hud\.callbacks\.goldShown;/);
  assert.match(hud, /const shown = shownOf \? shownOf\(bank\) : bank;/, 'no hook (a battle): the bank, as before');
});
