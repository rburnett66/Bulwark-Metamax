// Owner 2026-11-12: "I have energy warnings on every building even with 2 generators" — a powered building shows no marker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visiblePowerIcons } from './outpostScene.js';

test('only unpowered or about-to-be-cut buildings get a power marker; powered ones show nothing', () => {
  const icons = [{ id: 'a', state: 'on' }, { id: 'b', state: 'off' }, { id: 'c', state: 'cut' }, { id: 'd', state: 'on' }];
  assert.deepEqual(visiblePowerIcons(icons).map((i) => i.id), ['b', 'c']);
  assert.deepEqual(visiblePowerIcons([{ id: 'a', state: 'on' }]), [], 'a fully powered base shows no markers');
  assert.deepEqual(visiblePowerIcons(null), []);
});
