// What is left of the old outpost build menu: its placement state machine (the FARM view arms, aims and confirms its
// pieces with it until S6) and the building warnings [MM-story_mw6k9xec_5]. The outpost's own build list was deleted
// with the map pads (S2c.2 [MM-story_mwc9pmbn_2i]): the outpost builds on the battle rail (sessionView.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../model.js';
import { referenceOutpost, confirmOnline } from '../model.js';
import { placementStep, aimValid, IDLE, sameTarget } from './buildMenu.js';
import { buildingWarnings, markerOf, warningLines } from './warnings.js';
import { map, T0 } from './fixtures.mjs';

/** The reference outpost (the former contract kit: hub, power, rig, storage, kit defenses). */
const kit = () => referenceOutpost('ground', { seed: 7, map, now: T0 });
/** A building item and a defense item, as a list would hand them to the reducer, with their valid targets. */
const power = { id: 'power', kind: 'power', place: 'pad', enabled: true }, wall = { id: 'wall', kind: 'wall', place: 'cell', enabled: true };
const PADS = [{ pad: 'f1' }, { pad: 'f2' }];
const CELLS = [[3, 3], [4, 3], [5, 3], [6, 3]].map((c) => ({ cell: c }));
const buildMenu = () => [{ ...power, targets: PADS }, { ...wall, targets: CELLS }];
const item = (menu, id) => menu.find((m) => m.id === id);

test('placement (mouse): pick arms, the ghost follows, a click on a lit pad builds, a building returns to the list', () => {
  const m = buildMenu(), power = item(m, 'power'), T = power.targets;
  let { state, effect } = placementStep(IDLE, { type: 'pick', item: power }, T);
  assert.equal(state.phase, 'armed'); assert.equal(effect, null);
  ({ state } = placementStep(state, { type: 'hover', target: { pad: 'hub' } }, T));
  assert.equal(state.phase, 'aimed'); assert.equal(aimValid(state, T), false, 'the hub pad: the ghost is red');
  ({ state, effect } = placementStep(state, { type: 'tap', target: { pad: 'hub' } }, T));
  assert.equal(effect.type, 'invalid'); assert.equal(state.phase, 'aimed', 'still armed');
  ({ state } = placementStep(state, { type: 'hover', target: T[0] }, T));
  assert.equal(aimValid(state, T), true);
  ({ state, effect } = placementStep(state, { type: 'tap', target: T[0] }, T));
  assert.deepEqual(effect, { type: 'place', item: power, target: T[0] });
  assert.equal(placementStep(state, { type: 'placed' }, T).state.phase, 'idle');
  // picking the armed item again disarms (the battle palette's toggle); cancel too
  const armed = placementStep(IDLE, { type: 'pick', item: power }, T).state;
  assert.equal(placementStep(armed, { type: 'pick', item: power }, T).state.phase, 'idle');
  assert.equal(placementStep(armed, { type: 'cancel' }, T).state.phase, 'idle');
});

test('placement (touch): the first tap aims (ghost + CONFIRM), a second tap or CONFIRM builds; walls stay armed', () => {
  const m = buildMenu(), wall = item(m, 'wall'), T = wall.targets;
  let { state } = placementStep(IDLE, { type: 'pick', item: wall }, T);
  assert.equal(placementStep(state, { type: 'hover', target: T[0], touch: true }, T).state.phase, 'armed', 'a finger does not hover');
  let effect;
  ({ state, effect } = placementStep(state, { type: 'tap', target: T[0], touch: true }, T));
  assert.equal(effect, null); assert.equal(state.phase, 'aimed');
  ({ state, effect } = placementStep(state, { type: 'tap', target: T[3], touch: true }, T));
  assert.equal(effect, null, 'tapping another lit cell moves the aim'); assert.ok(sameTarget(state.target, T[3]));
  ({ state, effect } = placementStep(state, { type: 'confirm' }, T));
  assert.deepEqual(effect, { type: 'place', item: wall, target: T[3] });
  ({ state, effect } = placementStep(state, { type: 'tap', target: T[3], touch: true }, T));
  assert.equal(effect.type, 'place', 'the second tap on the same spot builds');
  ({ state } = placementStep(state, { type: 'placed' }, T));
  assert.equal(state.phase, 'armed', 'a defense stays armed for the next one'); assert.equal(state.item.id, 'wall');
  assert.equal(placementStep(IDLE, { type: 'confirm' }, T).effect, null);
  // a locked or unaffordable item does not arm; it says why
  const poor = { ...wall, enabled: false, poor: true, why: 'Costs 400 gold' };
  const r = placementStep(IDLE, { type: 'pick', item: poor }, T);
  assert.equal(r.state.phase, 'idle'); assert.equal(r.effect.type, 'locked');
});

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
