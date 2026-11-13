// Owner 2026-11-12 [MM-story_mwefibdv_i]: "mining station t1 shows out of reach of power, but it is sitting right next to
// a valid pylon" / "pylon says online". A Pylon draws nothing, so the grid never marked it off: it read Online even when
// no Power Station linked it, and the building beside it said only "out of reach of a station".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { map, T0 } from './fixtures.mjs';
import { referenceOutpost, buildingRect, powerGrids } from '../model.js';
import { noPowerStatus, unlinkedPylonStatus } from './hudModel.js';

function base() {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const st = buildingRect(o, map, Object.keys(o.pads).find((id) => o.pads[id].kind === 'power'));
  return { o, st };
}
// a cell far from every station: the corner of the map furthest from the station
function far(st) {
  const x = st.x < map.width / 2 ? map.width - 6 : 3, y = st.y < map.height / 2 ? map.height - 6 : 3;
  return { x, y };
}

test('a Pylon no Power Station links says so; one linked says nothing', () => {
  const { o, st } = base();
  const f = far(st);
  o.pads.y1 = { kind: 'pylon', tier: 1, at: { x: f.x, y: f.y, w: 1, h: 1 } };
  assert.match(unlinkedPylonStatus(o, map, 'y1'), /^Not linked: no Power Station/);
  o.pads.y2 = { kind: 'pylon', tier: 1, at: { x: st.x + st.w + 1, y: st.y, w: 1, h: 1 } };
  assert.equal(unlinkedPylonStatus(o, map, 'y2'), null, 'beside a station: linked');
});

test('a building beside an unlinked Pylon: "the Pylon here is not linked", not "out of reach"', () => {
  const { o, st } = base();
  const f = far(st);
  o.pads.y1 = { kind: 'pylon', tier: 1, at: { x: f.x, y: f.y, w: 1, h: 1 } };
  o.pads.s9 = { kind: 'storage', tier: 1, at: { x: f.x + 2, y: f.y, w: 2, h: 2 } };
  assert.equal(powerGrids(o, map).off.s9, 'reach');
  assert.equal(noPowerStatus(o, map, 's9', 'reach'), 'No power: the Pylon here is not linked to a Power Station');
  delete o.pads.y1;
  assert.equal(noPowerStatus(o, map, 's9', 'reach'), 'No power: out of reach of a station');
});
