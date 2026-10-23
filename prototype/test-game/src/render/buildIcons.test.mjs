// [MM-story_mvg3xsca_1x] BUILD menu icons: every buildable item has a named picture of its own model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUILD_ICONS, buildIcon, buildIconUrl } from './buildIcons.js';
import { STRUCTURES } from '../data/tables.js';
import { SYSTEM_MODELS } from '../render3d/structures/systemModels.js';

test('every structure on the BUILD rail, and the harvester, has an icon with the owner\'s name for it', () => {
  for (const id of Object.keys(STRUCTURES).filter((k) => STRUCTURES[k].kind !== 'harvestorBay')) assert.ok(buildIcon(id), id + ' has an icon');
  assert.ok(buildIcon('harvester'));
  assert.deepEqual(BUILD_ICONS.map((i) => i.label), ['CANNON', 'FLAK GUN', 'WALL', 'LAND MINE', 'ROCKETS', 'ANTI-AIR', 'MACHINE GUN', 'HARVESTER']);
  assert.equal(new Set(BUILD_ICONS.map((i) => i.id)).size, BUILD_ICONS.length);
});

test('each icon is drawn from a real model (the mine has a stylized one) and its baked picture is committed', () => {
  for (const i of BUILD_ICONS) {
    assert.ok(i.model === 'mine' || SYSTEM_MODELS[i.model], i.id + ': model ' + i.model);
    const png = fs.readFileSync(new URL('../../' + buildIconUrl(i), import.meta.url));
    assert.equal(png.toString('ascii', 1, 4), 'PNG', i.id + '.png is a PNG');
    assert.ok(png.readUInt32BE(16) >= 96 && png.length > 3000, i.id + '.png is a real picture, not a blank');
  }
  assert.notEqual(buildIcon('STR-Rockets').model, buildIcon('STR-Cannon').model, 'rockets no longer reuse the cannon picture');
  assert.notEqual(buildIcon('STR-Missile').model, buildIcon('STR-Flak').model, 'anti-air no longer reuses the flak picture');
});
