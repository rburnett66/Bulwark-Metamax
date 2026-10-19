// [MM-story_mvftq4h6_k] the Survey's campaign drop-down: unlocked maps, the highest preselected, locked ones disabled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPDATA } from '../../content/maps/mapdata.js';
import { campaignOptions, defaultCampaign } from './campaignPick.js';

test('defaults to the highest unlocked campaign, clamped to 1..9', () => {
  assert.equal(defaultCampaign({ unlockedThrough: 1 }), 1);
  assert.equal(defaultCampaign({ unlockedThrough: 4 }), 4);
  assert.equal(defaultCampaign({ unlockedThrough: 12 }), 9);
  assert.equal(defaultCampaign({}), 1);
  assert.equal(defaultCampaign(null), 1);
});

test('one option per campaign map; only the unlocked ones are choosable', () => {
  const save = { unlockedThrough: 3, maps: { 1: { beaten: true, avg: 3.4, bestScore: 900 }, 2: { avg: 2.1 } } };
  const o = campaignOptions(save, MAPDATA.maps);
  assert.equal(o.length, MAPDATA.maps.length);
  assert.deepEqual(o.filter((x) => !x.locked).map((x) => x.id), [1, 2, 3]);
  assert.ok(o[0].beaten && o[0].label.includes('✓') && o[0].detail.includes('★ 3.4') && o[0].detail.includes('best 900'));
  assert.ok(o[3].locked && o[3].label.includes('🔒') && o[3].detail.startsWith('Locked'));
  assert.ok(o[2].detail.includes(MAPDATA.maps[2].Full_W + ' × ' + MAPDATA.maps[2].Full_H), 'size in the detail line');
  assert.ok(o.every((x) => x.label.startsWith('Campaign ' + x.id)));
});
