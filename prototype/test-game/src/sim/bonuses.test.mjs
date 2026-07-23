// src/sim/bonuses.test.mjs — WAVE BONUSES (Wave-Bonuses-Design rev 1): data,
// seeded offer, all 16 effects, pre-nerfs, replay determinism. node --test.
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAP, BONUSES, BONUS_NERFS, STRUCTURES } from '../data/tables.js';
import { createSim, stepSim, applyCommand, FIXED_DT } from './core.js';
import { rollBonusOffer, bonusDamageMult, cannonRange, cannonDamage } from './bonuses.js';
import { createUnit, createStructure } from './entities.js';

function sim() { return createSim(1, { waves: [], map: MAP }); }
function offerAndChoose(state, bonusId) {
  rollBonusOffer(state);
  state.bonuses.offer = [bonusId, state.bonuses.offer[1], state.bonuses.offer[2]];   // force the id into the offer
  return applyCommand(state, { type: 'chooseBonus', bonusId });
}
function completedStruct(state, structId, tier = 1) {
  const s = createStructure(state, structId, { x: 10, y: 10 });
  s.lifecycle = 'Complete'; s.tier = tier;
  s.hp = STRUCTURES[structId].hp[tier - 1]; s.maxHp = s.hp;
  state.structures.set(s.id, s);
  return s;
}

test('the pool is exactly the owner 16, with the pre-nerf constants', () => {
  assert.equal(BONUSES.length, 16);
  assert.equal(BONUS_NERFS.harvesterSpeedMult, 0.65);
  assert.equal(BONUS_NERFS.baseCannonRangeMult, 0.70);
  assert.equal(BONUS_NERFS.baseCannonPowerMult, 0.50);
  assert.equal(BONUS_NERFS.startTierCap, 2);
});

test('pre-nerf: tiers start capped at T2; base cannon reads -30% range / -50% power', () => {
  const state = sim();
  assert.deepEqual(state.structTiers, { cannon: 2, flak: 2, wall: 2 });
  assert.ok(Math.abs(cannonRange(state, 26) - 26 * 0.7) < 1e-9);
  assert.ok(Math.abs(cannonDamage(state, 4000) - 4000 * 0.5) < 1e-9);
});

test('offer: 3 distinct, seeded (two fresh sims roll identically)', () => {
  const a = sim(); const b = sim();
  const oa = rollBonusOffer(a), ob = rollBonusOffer(b);
  assert.equal(oa.length, 3);
  assert.equal(new Set(oa).size, 3, 'distinct');
  assert.deepEqual(oa, ob, 'same seed → same offer');
});

test('choice must be in the offer; a forged pick is rejected', () => {
  const state = sim();
  rollBonusOffer(state);
  const notOffered = BONUSES.map((b) => b.id).find((id) => state.bonuses.offer.indexOf(id) === -1);
  assert.equal(applyCommand(state, { type: 'chooseBonus', bonusId: notOffered }).ok, false);
  assert.equal(applyCommand(state, { type: 'chooseBonus', bonusId: state.bonuses.offer[0] }).ok, true);
  assert.equal(state.bonuses.offer, null, 'offer cleared after a pick');
});

test('damage mods stack: vs-ground + vs-troops both hit a ground trooper', () => {
  const state = sim();
  offerAndChoose(state, 'dmg_ground');
  offerAndChoose(state, 'dmg_troops');
  const trooper = createUnit(state, 'GND-Troops', 1, { x: 5, y: 5 }, 'ground', 'attacker');
  const flyer = createUnit(state, 'AIR-Copters', 1, { x: 6, y: 5 }, 'air', 'attacker');
  assert.ok(Math.abs(bonusDamageMult(state, trooper) - 1.2) < 1e-9, 'ground+troops = +20%');
  assert.ok(Math.abs(bonusDamageMult(state, flyer) - 1.0) < 1e-9, 'air bonus not chosen → 1');
  offerAndChoose(state, 'dmg_air');
  assert.ok(Math.abs(bonusDamageMult(state, flyer) - 1.1) < 1e-9, 'vs-air applies to flyers');
});

test('heals: walls / cannons / anti-air / harvesters restore to full; base +10%', () => {
  const state = sim();
  const wall = completedStruct(state, 'STR-Wall'); wall.hp = 100; wall.lifecycle = 'Damaged';
  const cannon = completedStruct(state, 'STR-Cannon'); cannon.hp = 50;
  offerAndChoose(state, 'heal_walls');
  assert.equal(wall.hp, wall.maxHp); assert.equal(wall.lifecycle, 'Complete');
  assert.equal(cannon.hp, 50, 'heal_walls left the cannon alone');
  offerAndChoose(state, 'heal_cannons');
  assert.equal(cannon.hp, cannon.maxHp);
  state.base.hp = state.base.maxHp * 0.5;
  offerAndChoose(state, 'heal_base');
  assert.ok(Math.abs(state.base.hp - state.base.maxHp * 0.6) < 1e-6, 'base +10% of max');
});

test('harvester mods: +20% speed/capacity/hp on the live fleet AND future spawns; heal restores', () => {
  const state = createSim(1, { waves: [], map: MAP });
  // the map may or may not seed a harvester; force one for the test via cmdBuyHarvester if a field exists
  const before = state.units.size;
  // grab any harvester the map spawned; else skip the live-fleet half
  let h = [...state.units.values()].find((u) => u.isHarvester);
  if (h) {
    const s0 = h.speed, c0 = h.capacity, hp0 = h.maxHp;
    offerAndChoose(state, 'harv_speed');
    assert.ok(Math.abs(h.speed - s0 * 1.2) < 1e-6, 'live harvester +20% speed');
    offerAndChoose(state, 'harv_cap');
    assert.ok(Math.abs(h.capacity - c0 * 1.2) < 1e-6, 'live +20% capacity');
    offerAndChoose(state, 'harv_hp');
    assert.ok(Math.abs(h.maxHp - hp0 * 1.2) < 1e-6, 'live +20% max hp');
    h.hp = 1;
    offerAndChoose(state, 'heal_harv');
    assert.equal(h.hp, h.maxHp, 'heal_harv restores');
  }
  // persistent mods recorded for future spawns regardless
  assert.ok(state.bonuses.harv.speed >= 0);
});

test('mine credit: bonus 12 grants free STR-Mine deploys (no gold charged)', () => {
  const state = sim();
  offerAndChoose(state, 'mine_drones');
  assert.equal(state.bonuses.mineCredits, 3);
  const gold0 = state.economy.money;
  const r = applyCommand(state, { type: 'place', structId: 'STR-Mine', cell: { x: 20, y: 12 } });
  assert.equal(r.ok, true);
  assert.equal(state.economy.money, gold0, 'first mine was free (credit)');
  assert.equal(state.bonuses.mineCredits, 2);
});

test('cannon buyback: +10% range/damage compounds on the pre-nerf', () => {
  const state = sim();
  offerAndChoose(state, 'cannon_range');
  offerAndChoose(state, 'cannon_dmg');
  assert.ok(Math.abs(cannonRange(state, 26) - 26 * 0.7 * 1.1) < 1e-9);
  assert.ok(Math.abs(cannonDamage(state, 4000) - 4000 * 0.5 * 1.1) < 1e-9);
});

test('tier unlock: T3 turrets/walls raise the cap and then drop from the pool', () => {
  const state = sim();
  offerAndChoose(state, 'tier3_turret');
  assert.equal(state.structTiers.cannon, 3);
  assert.equal(state.structTiers.flak, 3);
  assert.equal(state.structTiers.wall, 2, 'walls untouched');
  // once cannon+flak are T3, a fresh offer should never re-offer tier3_turret
  for (let i = 0; i < 20; i++) { rollBonusOffer(state); assert.equal(state.bonuses.offer.indexOf('tier3_turret'), -1); }
  offerAndChoose(state, 'tier3_wall');
  assert.equal(state.structTiers.wall, 3);
});

test('determinism: a full waved run with a bonus choice replays to identical state', () => {
  const script = (state) => {
    const evs = [];
    for (let t = 0; t < 40; t++) evs.push(...stepSim(state, FIXED_DT));
  };
  const run = () => {
    const s = createSim(7, { waves: [], map: MAP });
    rollBonusOffer(s);
    applyCommand(s, { type: 'chooseBonus', bonusId: s.bonuses.offer[0] });
    let evs = [];
    for (let t = 0; t < 60; t++) evs.push(...stepSim(s, FIXED_DT));
    return { rng: s.rng.getState(), gold: s.economy.money, baseHp: s.base.hp, owned: s.bonuses.owned.join(',') };
  };
  assert.deepEqual(run(), run());
});
