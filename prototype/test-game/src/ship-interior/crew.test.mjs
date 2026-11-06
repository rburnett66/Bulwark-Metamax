// Crew figures for the capital ship [MM-story_mw47lcvv_3]: the prototype's rig, helmets and poses, plus legs, sit,
// sit-drink, work and flash; seeded, so the room view repeats. Ship-Crew-Characters.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as THREE from '../../vendor/three.module.js';
import { createCrewKit, cfgFor, drivePose, walkSwing, rng, LOOKS, POSE, GESTURES, FLAG_POSE, SEAT_DROP } from './crew.js';

const REG = createRequire(import.meta.url)('../data/factions.js');

test('every combat faction and the Collective has a look and a distinct helmet', () => {
  const keys = [...REG.COMBAT_FACTIONS.map((f) => f.key), 'collective'];
  for (const k of keys) assert.ok(LOOKS[k], `look for ${k}`);
  assert.equal(new Set(keys.map((k) => LOOKS[k].helmet)).size, keys.length, 'one helmet style per faction');
  assert.equal(cfgFor('collective', { captain: true }).helmet, 'captain');
});

test('a figure builds with hip pivots and every helmet; flash lights only its own vest', () => {
  const kit = createCrewKit(THREE);
  const figs = Object.keys(LOOKS).map((k) => kit.makeChar(cfgFor(k)));
  for (const g of figs) for (const p of ['lArm', 'rArm', 'lLeg', 'rLeg', 'head', 'body']) assert.ok(g.userData[p], p);
  figs[0].userData.setFlash(1);
  assert.ok(figs[0].userData.vestM.emissiveIntensity > 1);
  assert.equal(figs[1].userData.vestM.emissiveIntensity, 0, 'vest materials are per figure');
  kit.dispose();
});

test('sitting folds the legs and drops the body; walking swings legs; reduced motion holds still', () => {
  const kit = createCrewKit(THREE);
  const g = kit.makeChar(cfgFor('collective'));
  const ud = g.userData, cur = { rax: 0, raz: 0, lax: 0, laz: 0, hx: 0, bx: 0, leg: 0, yaw: 0 };
  let r;
  for (let i = 0; i < 120; i++) r = drivePose(ud, cur, 'sit-drink', 0.5, 1 / 30, i / 30, 0);
  assert.ok(ud.lLeg.rotation.x < -1.3, 'legs fold forward');
  assert.ok(Math.abs(r.drop - SEAT_DROP) < 0.02, 'the body lowers onto the stool');
  assert.equal(r.seated, true);
  walkSwing(ud, cur, Math.PI / 2);
  assert.ok(Math.abs(ud.lLeg.rotation.x - ud.rLeg.rotation.x) > 0.5, 'legs counter-swing');
  const a = { ...cur }, b = { ...cur };
  drivePose(ud, a, 'talk', 0, 1 / 30, 1.0, 0, true); const x1 = ud.rArm.rotation.x;
  drivePose(ud, b, 'talk', 0, 1 / 30, 2.7, 0, true); const x2 = ud.rArm.rotation.x;
  assert.ok(Math.abs(x1 - x2) < 1e-9, 'reduced motion: no time-driven gesture');
  for (const s of [...GESTURES, ...Object.values(FLAG_POSE), 'work', 'sit']) assert.ok(POSE[s], s);
  kit.dispose();
});

test('the seeded generator repeats', () => {
  const a = rng(42), b = rng(42), c = rng(43);
  const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, Array.from({ length: 5 }, c));
  assert.ok(sa.every((v) => v >= 0 && v < 1));
});
