// The outpost build menu and its placement state machine, and the building warnings [MM-story_mw6k9xec_5].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../model.js';
import { createOutpost, referenceOutpost, confirmOnline, place, buyHarvester } from '../model.js';
import { harvesterDef } from '../../data/outpost.js';
import { structureDef } from '../../data/outpost.js';
import { defenseRing } from '../../terrain/outpostPads.js';
import {
  MENU, buildMenu, validTargets, guideStep, harvesterInfo, placementStep, aimValid, IDLE, kindOf, bayKind, whyText,
  hasResourceBay, sameTarget,
} from './buildMenu.js';
import { buildingWarnings, markerOf, warningLines } from './warnings.js';
import { map, T0 } from './fixtures.mjs';

/** The reference outpost (the former contract kit: hub, power, rig, storage, kit defenses). */
const kit = () => referenceOutpost('ground', { seed: 7, map, now: T0 });
/** The contract's start (story O16): the hub only. */
const hubOnly = () => createOutpost('ground', { seed: 7, map, now: T0 });
const ctx = (gold, extra = {}) => ({ gold, unlockedTiers: ['common'], unlocks: new Set(), now: T0, ...extra });
const item = (menu, id) => menu.find((m) => m.id === id);

test('the list, in the owner\'s order: buildings, the harvester, then wall, machine gun, cannon tower', () => {
  assert.deepEqual(MENU.map((m) => m.id), ['power', 'rig', 'storage', 'resourceBay', 'upgradeBay', 'habitat', 'harvester', 'wall', 'mg', 'cannon']);   // the Habitat joins with O15
  assert.deepEqual(MENU.map((m) => m.label).slice(-3), ['WALL', 'MACHINE GUN', 'CANNON TOWER']);
  assert.equal(item(MENU, 'rig').label, 'MINING STATION');
  assert.equal(kindOf('resourceBay'), bayKind());
  assert.ok(['resourceBay', 'harvesterBay'].includes(bayKind()));
});

test('prices come from the data, the hotkeys are 1–9 then 0, and an unaffordable item is greyed with its price', () => {
  const m = buildMenu(hubOnly(), map, ctx(5000));
  for (const x of m.filter((i) => i.place !== 'buy')) assert.equal(x.cost, structureDef(x.kind, 1).cost, x.id);
  assert.deepEqual(m.map((x) => x.key), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
  const poor = buildMenu(hubOnly(), map, ctx(500));
  const power = item(poor, 'power');
  assert.equal(power.poor, structureDef('power', 1).cost > 500);
  if (power.poor) { assert.equal(power.enabled, false); assert.match(power.why, /Costs/); }
  assert.equal(item(poor, 'wall').poor, structureDef('wall', 1).cost > 500);
});

test('valid targets: buildings on the pads their role takes, rigs only on unlocked deposits, defenses on the ring', () => {
  const o = hubOnly();
  const power = validTargets(o, map, 'power', ctx(0)).targets.map((t) => t.pad);
  assert.ok(power.length && power.every((id) => ['power', 'spare'].includes(map.pads.find((p) => p.id === id).role)), String(power));
  const rig = validTargets(o, map, 'rig', ctx(0)).targets.map((t) => t.pad);
  assert.deepEqual(rig, map.deposits.filter((d) => d.tier === 'common').map((d) => d.pad), 'only the common deposit is open');
  const more = validTargets(o, map, 'rig', ctx(0, { unlockedTiers: ['common', 'uncommon'] })).targets.map((t) => t.pad);
  assert.equal(more.length, 2);
  const storage = validTargets(o, map, 'storage', ctx(0)).targets.map((t) => t.pad);
  assert.ok(storage.every((id) => map.pads.find((p) => p.id === id).role === 'storage'));
  const bay = validTargets(o, map, 'resourceBay', ctx(0)).targets.map((t) => t.pad);
  assert.ok(bay.length && bay.every((id) => ['bay', 'spare'].includes(map.pads.find((p) => p.id === id).role)));
  const wall = validTargets(o, map, 'wall', ctx(0)).targets;
  assert.equal(wall.length, defenseRing(map).length, 'every ring cell is free on a hub-only outpost');
  // a built pad and a taken cell leave the list
  const k = kit();
  assert.ok(!validTargets(k, map, 'power', ctx(0)).targets.some((t) => t.pad === 'p1'));
  const taken = k.defenses[0].cell;
  assert.ok(!validTargets(k, map, 'mg', ctx(0)).targets.some((t) => sameTarget(t, { cell: taken })));
  // and every target is one the model accepts
  for (const id of ['power', 'rig', 'storage', 'resourceBay', 'upgradeBay', 'wall']) {
    for (const t of validTargets(o, map, id, ctx(0)).targets.slice(0, 5)) assert.ok(!place(o, { ...t, kind: kindOf(id) }, { ...ctx(1e9), map }).error, `${id} ${JSON.stringify(t)}`);
  }
});

test('locked items say why: no free deposit, the harvester before a Resource Bay, a tech the upgrade needs', () => {
  const o = kit();
  o.pads.r2 = { kind: 'rig', tier: 1, deposit: 'uncommon' };   // fill the open deposits
  const m = buildMenu(o, map, ctx(1e6, { unlockedTiers: ['common', 'uncommon'] }));
  assert.equal(item(m, 'rig').locked, true);
  assert.equal(item(m, 'rig').why, 'No free deposit');
  const h = item(m, 'harvester');
  assert.equal(h.locked, true);
  assert.equal(h.why, 'Build a Resource Bay first');
  assert.equal(h.enabled, false);
  assert.equal(whyText('mg is not unlocked (tech:power_grid_2)', 'mg', o), 'Needs Power Grid 2');
  assert.match(whyText('the rare ore is not unlocked', 'rig', o), /not unlocked yet/);
});

test('the harvester: locked until a Resource Bay stands; with buyHarvester it is bought from the list, capped n/max', () => {
  const o = kit();
  o.pads.b1 = { kind: bayKind(), tier: 1 };
  assert.equal(hasResourceBay(o), true);
  const legacy = kit(); legacy.pads.b1 = { kind: 'harvesterBay', tier: 1 };
  assert.equal(hasResourceBay(legacy), true, 'a bay built under the old name counts');
  // without the O16 API it stays locked (wired when present)
  const fake = { ...model, buyHarvester: undefined };
  assert.equal(item(buildMenu(o, map, ctx(1e6), fake), 'harvester').locked, true);
  // with it: priced from the data, n/cap, bought straight from the list (model.buyHarvester through the session)
  const H = harvesterDef();
  o.harvesters = 0;
  const h = item(buildMenu(o, map, ctx(1e6)), 'harvester');
  assert.deepEqual([h.locked, h.enabled, h.cost, h.count, h.max], [false, true, H.cost, 0, H.cap]);
  assert.deepEqual(placementStep(IDLE, { type: 'pick', item: h }).effect, { type: 'buy', item: h });
  assert.equal(item(buildMenu(o, map, ctx(H.cost - 1)), 'harvester').poor, true, 'short of gold: greyed, price red');
  let cur = o;
  for (let i = 0; i < H.cap; i++) cur = buyHarvester(cur, { gold: 1e9 }).outpost;
  const full = item(buildMenu(cur, map, ctx(1e6)), 'harvester');
  assert.equal(full.locked, true);
  assert.match(full.why, new RegExp(`\\(${H.cap}/${H.cap}\\)`));
  assert.equal(item(buildMenu(hubOnly(), map, ctx(1e6)), 'harvester').why, 'Build a Resource Bay first');
  assert.deepEqual(harvesterInfo({ harvesters: 3 }, { }).count, 3);
});

test('first-run guidance: Power Station, then Mining Station, then Storage, until the outpost is online', () => {
  const o = hubOnly();
  assert.equal(guideStep(o), 'power');
  o.building.push({ pad: 'p1', kind: 'power', tier: 1, done: T0 + 1 });
  assert.equal(guideStep(o), 'rig');
  o.pads.r1 = { kind: 'rig', tier: 1, deposit: 'common' };
  assert.equal(guideStep(o), 'storage');
  o.pads.s1 = { kind: 'storage', tier: 1 };
  assert.equal(guideStep(o), null);
  assert.equal(guideStep(confirmOnline(kit(), map, T0).outpost), null, 'online: no guidance');
  assert.equal(buildMenu(hubOnly(), map, ctx(1e6)).filter((x) => x.guide).map((x) => x.id).join(), 'power');
});

test('placement (mouse): pick arms, the ghost follows, a click on a lit pad builds, a building returns to the list', () => {
  const m = buildMenu(hubOnly(), map, ctx(1e6)), power = item(m, 'power'), T = power.targets;
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
  const m = buildMenu(hubOnly(), map, ctx(1e6)), wall = item(m, 'wall'), T = wall.targets;
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
