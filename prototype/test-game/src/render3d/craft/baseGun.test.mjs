// [MM-story_mvedy2wj_a] the base super-cannon's roof gun pitches to the shell's launch slope; the shell leaves its tip.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { LANDING_CRAFT } from './models.js';
import { createCraft3D } from './craft3d.js';
import { baseLaunchPitch, baseApex, BASE_STYLES } from '../fx/cannonFx.js';

const D = Math.PI / 180;

test('the cannon crafts carry a barrel group with a trunnion, a muzzle and limits', () => {
  for (const k of ['lc_neutral', 'lc_space']) {
    const d = LANDING_CRAFT[k];
    assert.ok(d.parts.some((p) => p.g === 'barrel'), `${k}: barrel parts`);
    assert.ok(Array.isArray(d.pivots.barrel) && Array.isArray(d.muzzle) && d.barrel.max > d.barrel.min, `${k}: rig`);
    assert.ok(d.muzzle[0] > d.pivots.barrel[0], `${k}: muzzle ahead of the trunnion`);
  }
});

test('launch pitch: the slope of the shell\'s own arc at the muzzle', () => {
  const m = { x: 0, y: 1.2, z: 0 }, S = BASE_STYLES.shell;
  const p = baseLaunchPitch(m, 6, 0, S), apex = baseApex(6, S);
  // numeric slope of the flight y = fy(1 − u) + apex·4u(1 − u) at u → 0 (cannonFx.step)
  const u = 1e-4, y1 = m.y * (1 - u) + apex * 4 * u * (1 - u), slope = (y1 - m.y) / (6 * u);
  assert.ok(Math.abs(Math.atan(slope) - p) < 1e-3, `${(p / D).toFixed(1)}°`);
  assert.ok(baseLaunchPitch(m, 2, 0, S) > 0 && baseLaunchPitch(m, 12, 0, S) > baseLaunchPitch(m, 3, 0, S) - 0.3, 'sane');
});

test('craft: elevate slews the gun toward the pitch, clamped, and muzzleWorld rises with it', () => {
  const scene = new THREE.Scene(), c = createCraft3D(THREE, scene, 'lc_neutral');
  c.place({ x: 10, y: 10 });
  c.aim(0, 1);
  const flat = c.muzzleWorld();
  for (let i = 0; i < 120; i++) c.elevate(30 * D, 1 / 30);
  assert.ok(Math.abs(c.pitch - 30 * D) < 1e-6, `pitched (${(c.pitch / D).toFixed(1)}°)`);
  const up = c.muzzleWorld();
  assert.ok(up.y > flat.y + 0.1, `muzzle rises (${flat.y.toFixed(2)} → ${up.y.toFixed(2)})`);
  for (let i = 0; i < 200; i++) c.elevate(89 * D, 1 / 30);
  assert.ok(c.pitch <= LANDING_CRAFT.lc_neutral.barrel.max * D + 1e-9, 'clamped');
  for (let i = 0; i < 200; i++) c.elevate(null, 1 / 30);
  assert.ok(Math.abs(c.pitch) < 1e-9, 'idle: level');
  c.dispose();
});
