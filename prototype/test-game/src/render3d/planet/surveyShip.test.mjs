// [MM-story_mvoi0e36_3] — the survey ship orbits a planet the player can campaign on; a locked planet's space is clean.
// Geometry uses the VENDORED three.js module (committed, so CI has it) — nothing here needs WebGL.
import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../../vendor/three.module.js';
import { SHIP, orbitFrame, scanLevel, makeSurveyShip } from './surveyShip.js';
import { planetOpen, techCtxFromSave, ALL_PLANETS_OPEN } from '../../menu/techSave.js';
import { PORTALS } from '../../data/techtree.js';
import { PLANETS } from '../../data/planets.js';

test('planetOpen: the home planet is always open; the others need their portal code', () => {
  const G = { allOpen: false };   // the real gate (the testing switch off)
  const fresh = techCtxFromSave({});
  const names = Object.values(PLANETS).map((p) => p.name);
  const open = names.filter((n) => planetOpen(fresh, n, G));
  assert.deepEqual(open, ['Verdance'], 'a new save campaigns on Verdance only');
  // every other homeworld has a portal code (so none is open by accident of a missing entry)
  for (const n of names) if (n !== 'Verdance') assert.ok(PORTALS.some(([k]) => k === n.toLowerCase()), n + ' has no portal code');
  const bought = techCtxFromSave({ tech: { owned: { portal_rime: true, portal_ochre: false } } });
  assert.ok(planetOpen(bought, 'Rime', G), 'owning the Rime code opens Rime');
  assert.ok(!planetOpen(bought, 'Ochre', G), 'a refunded (false) code stays shut');
  assert.ok(planetOpen(bought, 'Verdance', G));
  assert.ok(!planetOpen(null, 'Rime', G), 'no save context: only the home planet');
});

test('the testing switch opens every planet (owner 2026-10-25: all unlocked for testing today)', () => {
  const fresh = techCtxFromSave({});
  for (const p of Object.values(PLANETS)) assert.ok(planetOpen(fresh, p.name, { allOpen: true }), p.name);
  // the default follows the switch
  assert.equal(planetOpen(fresh, 'Rime'), ALL_PLANETS_OPEN);
});

test('the orbit circles the globe outside its halo, passing in front of the disc and behind it', () => {
  let front = 0, back = 0;
  for (let i = 0; i < 360; i++) {
    const f = orbitFrame((i / 360) * Math.PI * 2);
    const r = Math.hypot(...f.pos);
    assert.ok(Math.abs(r - SHIP.orbit) < 1e-9 && r > 1.16, 'radius ' + r);
    assert.ok(Math.abs(f.up[0] * f.vel[0] + f.up[1] * f.vel[1] + f.up[2] * f.vel[2]) < 1e-9, 'flies along the orbit');
    // in the menu's frame (camera at +z, half-height ~1.38 at fov 26 / z 6) the ship stays on screen
    assert.ok(Math.abs(f.pos[1]) < 1.3, 'y in frame');
    if (f.pos[2] > 0.3 && Math.hypot(f.pos[0], f.pos[1]) < 1) front++;
    if (f.pos[2] < -0.3 && Math.hypot(f.pos[0], f.pos[1]) < 1) back++;
  }
  assert.ok(front > 20 && back > 20, `crosses the disc both sides (front ${front}, back ${back})`);
});

test('the scan beam runs in bursts', () => {
  const on = [], P = SHIP.scanOn + SHIP.scanOff;
  for (let t = 0; t < P; t += 0.05) on.push(scanLevel(t));
  assert.ok(on.some((v) => v === 1) && on.some((v) => v === 0));
  assert.equal(scanLevel(SHIP.scanOn / 2), scanLevel(SHIP.scanOn / 2 + P), 'periodic');
  assert.ok(on.every((v) => v >= 0 && v <= 1));
});

test('makeSurveyShip builds without WebGL, flies belly-down, and disposes', () => {
  const s = makeSurveyShip(THREE);
  const meshes = []; s.root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  assert.ok(meshes.length > 20, 'hull, pods, fins, engines, dish, lights, beam, ring');
  const a0 = s.angle; s.update(1); assert.ok(s.angle > a0, 'moves along the orbit');
  // the hull's dorsal (+y) points away from the planet
  const ship = s.root.children.find((c) => c.isGroup);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(ship.quaternion), out = ship.position.clone().normalize();
  assert.ok(up.dot(out) > 0.999, 'belly to the planet');
  assert.ok(Math.abs(ship.position.length() - SHIP.orbit) < 1e-6);
  s.update(0.1); s.dispose();
});
