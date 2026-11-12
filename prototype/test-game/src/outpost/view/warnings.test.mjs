// The building warnings (warnings.js) [MM-story_mw6k9xec_5]: what the outpost's panels and markers say about a building.
// (The old build menu's placement state machine was deleted with the farm view in S6 [MM-story_mwc9q1y6_2n]: the farm
// places on the battle rail too.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../model.js';
import { referenceOutpost, confirmOnline } from '../model.js';
import { buildingWarnings, markerOf, warningLines } from './warnings.js';
import { map, T0 } from './fixtures.mjs';

/** The reference outpost (the former contract kit: hub, power, rig, storage, kit defenses). */
const kit = () => referenceOutpost('ground', { seed: 7, map, now: T0 });

test('warnings: no power stops a building; an unpowered storage tower shuts its door; full bays say so', () => {
  const o = confirmOnline(kit(), map, T0).outpost;
  assert.deepEqual(buildingWarnings(o, map), {}, 'the kit runs clean');
  // a building out of every station's reach
  o.pads.r3 = { kind: 'rig', tier: 1, deposit: 'rare' }; o.storage.r3 = {};
  const w = buildingWarnings(o, map);
  assert.deepEqual(w.r3, ['no_power']);
  // the station gone: the storage tower is dark and its door shut
  const dark = structuredClone(o); delete dark.pads.p1;
  const d = buildingWarnings(dark, map);
  assert.ok(d.s1.includes('no_power') && d.s1.includes('door_closed'));
  assert.equal(markerOf(d.s1), 'no_power');
  assert.deepEqual(warningLines(d.s1), ['No power: the door is shut, no new ore comes in']);
  // a full bay
  const full = structuredClone(o); delete full.pads.r3;
  const r1 = Object.keys(full.pads).find((id) => full.pads[id].kind === 'rig');
  full.storage[r1] = { iron: model.bayCapacity(full, r1) };
  const f = buildingWarnings(full, map);
  assert.deepEqual(f[r1], ['storage_full']);
  assert.ok(f.s1.includes('storage_full'), 'the storage tower is full when every bay is');
  assert.equal(markerOf(f[r1]), 'storage_full');
  // the model's own warnings() wins when it exists (story O16)
  assert.deepEqual(buildingWarnings(o, map, { warnings: () => ({ hub: ['no_power'], x: [] }) }), { hub: ['no_power'] });
});
