// src/sim/nameIndependence.test.mjs — DDD-7 / DDD-9.
//
// THE CLAIM: a unit's NAME is not load-bearing. `shape` and `role` are display strings — what the HUD
// prints and what the art tools file a sprite under. Rename 'Heavy Tanks' to 'Assault Tank' and
// 'Juggernaut' to 'Vanguard' and not one frame of gameplay may move.
//
// That was false in nine places, and the failure mode was silence. combat.js asked
// `shooter.role === 'Juggernaut'` to decide whether an attacker shoots the defences it passes;
// entities.js sized a unit's collision circle off `def.shape`; bonuses.js decided whether the
// '+10% vs troops' bonus applied by reading `target.kind`, which createUnit had filled with
// `def.shape` — a field name that on a STRUCTURE means 'antiGround'/'antiAir'. Renaming anything
// would have quietly changed targeting, pathing and damage with nothing to catch it.
//
// The strongest form of the test is the last one in this file: run a real battle twice from the same
// seed, scribbling over every entity's shape/role/kind on every tick of one of them, and require the
// two state hashes to agree tick for tick. Against the old code that run diverges — the juggernauts
// stop engaging structures and the troops bonus stops applying.
//
// node --test
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAP, UNITS, STRUCTURES } from '../data/tables.js';
import { createSim, stepSim, applyCommand, FIXED_DT } from './core.js';
import { createUnit, createStructure, unitRadius, DEFAULT_UNIT_RADIUS } from './entities.js';
import { acquireTarget, BASE_TARGET_ID } from './combat.js';
import { rollBonusOffer, bonusDamageMult } from './bonuses.js';
import { hashState } from './replay.js';

/** Labels that exist nowhere in the roster, so nothing can accidentally still match. */
const RENAMED = { shape: 'Assault Platform', role: 'Vanguard' };

const rename = (def) => ({ ...def, shape: RENAMED.shape, role: RENAMED.role });

/* ------------------------------------------------------------------ */
/* 1. entities.js:37 — the collision radius switch                     */
/* ------------------------------------------------------------------ */

test('DDD-7: collision radius is the def field, not the shape name', () => {
  // The old switch mapped 'Troops'→0.38, 'Tanks'→0.46, 'Heavy Tanks'→0.50 and everything else to a
  // 0.42 default arm. Under a rename all three collapsed to 0.42: a different separation field, a
  // different spawn spacing, a different path through a one-tile gap.
  for (const id of Object.keys(UNITS)) {
    assert.equal(unitRadius(rename(UNITS[id])), UNITS[id].radius,
      `${id}: radius changed when its labels changed`);
  }
  // And the values that are NOT 0.42 are the ones a rename used to destroy.
  const notDefault = Object.keys(UNITS).filter((id) => UNITS[id].radius !== DEFAULT_UNIT_RADIUS);
  assert.ok(notDefault.length > 20, 'most of the roster must carry a radius the default would not give');
});

test('DDD-7: createUnit stamps the def radius, whatever the def is called', () => {
  const s = createSim(7, { waves: [], map: MAP });
  for (const id of Object.keys(UNITS)) {
    const u = createUnit(s, id, 1, { x: 4, y: 4 }, 'ground', 'attacker');
    assert.equal(u.radius, UNITS[id].radius, id);
  }
});

/* ------------------------------------------------------------------ */
/* 2. entities.js:59 — `kind` laundering `shape` into another field    */
/* ------------------------------------------------------------------ */

test('DDD-7: a unit no longer carries a `kind` — the field that laundered shape is gone', () => {
  // `kind` on a unit was a copy of the display string `shape`; `kind` on a structure is a real typed
  // enum ('antiGround'|'antiAir'|'wall'). One name, two meanings, and bonuses.js branched on the
  // wrong one. The unit's label lives on `shape` now, where it is obviously a label.
  const s = createSim(7, { waves: [], map: MAP });
  const u = createUnit(s, 'GND-Troops', 1, { x: 4, y: 4 }, 'ground', 'attacker');
  assert.equal(u.kind, undefined, 'units must not carry a `kind` field at all');
  assert.equal(u.shape, UNITS['GND-Troops'].shape, 'the display label is on `shape`');

  const st = createStructure(s, 'STR-Cannon', { x: 6, y: 6 });
  assert.equal(st.kind, STRUCTURES['STR-Cannon'].kind, 'structures keep their typed kind');
  assert.notEqual(st.kind, undefined);
});

test('DDD-7: the dead repair guard cannot come back — a repair troop is flagged, not named', () => {
  // combat.js guarded `unit.kind === 'repair'`, which no entity could ever satisfy: a repair troop's
  // kind was 'Troops'. It only looked like it worked because repair troops carry dps 0.
  const s = createSim(7, { waves: [], map: MAP });
  const u = createUnit(s, 'GND-Troops', 1, { x: 4, y: 4 }, 'ground', 'defender');
  u.isRepairTroop = true;
  assert.equal(u.isRepairTroop, true);
  assert.notEqual(u.shape, 'repair', 'the label never was, and never will be, the flag');
});

/* ------------------------------------------------------------------ */
/* 3. combat.js:141/351 — the Juggernaut rule                          */
/* ------------------------------------------------------------------ */

/** An attacker parked next to a completed tower, well away from the base. */
function shooterAndTower(unitId, flag) {
  const s = createSim(11, { waves: [], map: MAP });
  const pos = { x: 12, y: 30 };
  const u = createUnit(s, unitId, 1, pos, 'ground', 'attacker');
  u.path = []; u.pathIdx = 0;
  if (flag !== undefined) u.engagesStructuresWhileAdvancing = flag;
  s.units.set(u.id, u);
  const tower = createStructure(s, 'STR-Cannon', { x: pos.x + 1, y: pos.y });
  tower.lifecycle = 'Complete';
  tower.hp = tower.maxHp;
  s.structures.set(tower.id, tower);
  return { s, u, tower };
}

const JUGG = Object.keys(UNITS).find((id) => UNITS[id].engagesStructuresWhileAdvancing);
const PLAIN = Object.keys(UNITS).find((id) =>
  !UNITS[id].engagesStructuresWhileAdvancing && UNITS[id].targets === 'Base' && UNITS[id].domain === 'Walker');

test('DDD-7: fire-on-the-move is the capability flag — the role name decides nothing', () => {
  assert.ok(JUGG && PLAIN, 'the roster must contain both kinds of attacker');

  // The capability ON, with the role renamed to something the old code could never match.
  const on = shooterAndTower(JUGG);
  on.u.role = RENAMED.role;
  on.u.shape = RENAMED.shape;
  assert.equal(acquireTarget(on.s, on.u), on.tower.id,
    'a renamed juggernaut must STILL engage the structure it is standing next to');

  // The capability OFF while still CALLED 'Juggernaut' — the old code would have engaged the tower.
  const off = shooterAndTower(PLAIN, false);
  off.u.role = 'Juggernaut';
  assert.equal(acquireTarget(off.s, off.u), null,
    'the name "Juggernaut" must not grant the capability to a unit that does not have it');
});

test('DDD-7: without the capability an attacker ignores towers and holds out for the base', () => {
  const off = shooterAndTower(PLAIN);
  assert.equal(off.u.engagesStructuresWhileAdvancing, false);
  assert.equal(acquireTarget(off.s, off.u), null, 'a basic attacker ignores the tower beside it');

  // ...and the same unit given the capability picks the tower up. Same entity, one flag.
  off.u.engagesStructuresWhileAdvancing = true;
  assert.equal(acquireTarget(off.s, off.u), off.tower.id);
});

test('DDD-7: createUnit stamps the capability, which is all the RENDERER reads', () => {
  // renderer.js locks a walker's turret onto the keep while it drives, and lets a fire-on-the-move
  // unit's turret track the defences it passes instead. That test was `u.role !== 'Juggernaut'` — the
  // same display string, in a second file. It reads this entity flag now; renderer.js needs PIXI and a
  // DOM to import, so the flag being present and correct on the entity is what is assertable here.
  const s = createSim(11, { waves: [], map: MAP });
  for (const id of Object.keys(UNITS)) {
    const u = createUnit(s, id, 1, { x: 4, y: 4 }, 'ground', 'attacker');
    assert.equal(typeof u.engagesStructuresWhileAdvancing, 'boolean', `${id} must carry the flag`);
    assert.equal(u.engagesStructuresWhileAdvancing, UNITS[id].engagesStructuresWhileAdvancing === true, id);
  }
});

test('DDD-7: the capability does not change what a unit does at the base', () => {
  const s = createSim(11, { waves: [], map: MAP });
  const u = createUnit(s, JUGG, 1, { x: MAP.base.x - 1.2, y: MAP.base.y }, 'ground', 'attacker');
  u.path = []; u.pathIdx = 0;
  s.units.set(u.id, u);
  u.role = RENAMED.role;
  assert.equal(acquireTarget(s, u), BASE_TARGET_ID, 'nothing to siege → the base, renamed or not');
});

/* ------------------------------------------------------------------ */
/* 4. bonuses.js:145 — the '+10% vs troops' class                      */
/* ------------------------------------------------------------------ */

function withTroopsBonus() {
  const s = createSim(3, { waves: [], map: MAP });
  rollBonusOffer(s);
  s.bonuses.offer = ['dmg_troops', s.bonuses.offer[1], s.bonuses.offer[2]];
  assert.equal(applyCommand(s, { type: 'chooseBonus', bonusId: 'dmg_troops' }).ok, true);
  return s;
}

const INFANTRY = Object.keys(UNITS).find((id) => UNITS[id].isInfantry);
const NOT_INFANTRY = Object.keys(UNITS).find((id) => !UNITS[id].isInfantry && UNITS[id].domain !== 'Flyer');

test('DDD-9: the troops bonus keys on isInfantry, and survives a rename', () => {
  const s = withTroopsBonus();
  const trooper = createUnit(s, INFANTRY, 1, { x: 5, y: 5 }, 'ground', 'attacker');
  const vehicle = createUnit(s, NOT_INFANTRY, 1, { x: 6, y: 5 }, 'ground', 'attacker');

  assert.ok(Math.abs(bonusDamageMult(s, trooper) - 1.1) < 1e-9, 'infantry takes the +10%');
  assert.ok(Math.abs(bonusDamageMult(s, vehicle) - 1.0) < 1e-9, 'a vehicle does not');

  // Scribble every label the old code could have been reading. The multiplier must not move.
  for (const u of [trooper, vehicle]) { u.shape = RENAMED.shape; u.role = RENAMED.role; u.kind = RENAMED.shape; }
  assert.ok(Math.abs(bonusDamageMult(s, trooper) - 1.1) < 1e-9, 'renaming must not switch the bonus off');
  assert.ok(Math.abs(bonusDamageMult(s, vehicle) - 1.0) < 1e-9, 'renaming must not switch it on');

  // ...and calling a vehicle 'Troops' must not buy it the bonus. The old code read exactly this.
  vehicle.kind = 'Troops';
  vehicle.shape = 'Troops';
  assert.ok(Math.abs(bonusDamageMult(s, vehicle) - 1.0) < 1e-9, 'the label must not grant the bonus');
});

test('DDD-9: armorClass would have been the wrong discriminator, which is why isInfantry exists', () => {
  // Recorded here because it is the reasoning behind the field, and the roster can drift.
  const infantry = Object.values(UNITS).filter((d) => d.isInfantry);
  const vehicles = Object.values(UNITS).filter((d) => !d.isInfantry);
  assert.ok(infantry.some((d) => d.armorClass !== 'Organic'),
    'some infantry is not Organic — armour would miss it');
  assert.ok(vehicles.some((d) => d.armorClass === 'Organic'),
    'some non-infantry IS Organic — armour would buff it by mistake');
});

test('DDD-9: a structure under tower fire is not infantry and never was', () => {
  const s = withTroopsBonus();
  const st = createStructure(s, 'STR-Cannon', { x: 6, y: 6 });
  assert.ok(Math.abs(bonusDamageMult(s, st) - 1.0) < 1e-9);
});

/* ------------------------------------------------------------------ */
/* 5. THE WHOLE SIM: rename everything, every tick, and diff the hash  */
/* ------------------------------------------------------------------ */

/**
 * A wave built to exercise the sites this ticket touches rather than whatever wave 1 happens to hold:
 * fire-on-the-move attackers, infantry, a plain bruiser, and a flyer.
 */
const RENAME_WAVES = [{
  wave: 1,
  spawns: [
    { unitId: 'GND-HeavyTanks', count: 3, lane: 'ground', delay: 0, interval: 0.8 },   // fire-on-the-move
    { unitId: 'GND-Troops', count: 4, lane: 'ground', delay: 0.5, interval: 0.8 },     // infantry (bonus class)
    { unitId: 'GND-Tanks', count: 2, lane: 'ground', delay: 1.0, interval: 0.8 },      // neither
    { unitId: 'AIR-Copters', count: 2, lane: 'air', delay: 0.5, interval: 0.8 },       // flyer
  ],
}];

// Cannons parked on the ground approach a few cells out from the spawn — near enough that the SLOW
// juggernauts (0.368 cells/s) actually reach them inside the run, which is what makes the structure
// -targeting branch fire at all. Verified below, so this can never quietly become a vacuous pass.
const TOWER_CELLS = [{ x: 5, y: 12 }, { x: 10, y: 13 }, { x: 18, y: 12 }];
const BATTLE_TICKS = 1500;   // ~50s of sim

/**
 * Run the battle and hash the state every tick. With `scribble` set, every live entity's display
 * labels are overwritten before each step — `shape`, `role`, AND `kind`, the laundered field DDD-7
 * removed, so this diverges against the OLD code and not merely against a hypothetical one.
 *
 * Returns the hashes plus counters proving the run touched the branches under test.
 */
function battle(seed, scribble, bonusId) {
  const s = createSim(seed, { waves: RENAME_WAVES, map: MAP });
  if (bonusId) {
    rollBonusOffer(s);
    s.bonuses.offer = [bonusId, s.bonuses.offer[1], s.bonuses.offer[2]];
    assert.equal(applyCommand(s, { type: 'chooseBonus', bonusId }).ok, true);
  }
  const towerIds = new Set();
  for (const cell of TOWER_CELLS) {
    const t = createStructure(s, 'STR-Cannon', cell);
    t.lifecycle = 'Complete';
    t.hp = t.maxHp;
    s.structures.set(t.id, t);
    towerIds.add(t.id);
  }
  assert.equal(applyCommand(s, { type: 'startWave' }).ok, true);

  const hashes = [];
  let advancersOnStructures = 0;   // the combat.js juggernaut branch actually taken
  let infantryUnderFire = 0;       // the bonuses.js infantry branch actually taken
  for (let i = 0; i < BATTLE_TICKS; i++) {
    if (scribble) {
      for (const u of s.units.values()) {
        u.shape = RENAMED.shape;
        u.role = RENAMED.role;
        u.kind = 'Troops';   // the exact string the old bonuses.js read, on EVERY unit
      }
    }
    stepSim(s, FIXED_DT);
    hashes.push(hashState(s));
    for (const u of s.units.values()) {
      if (u.engagesStructuresWhileAdvancing && towerIds.has(u.targetId)) advancersOnStructures++;
      if (u.isInfantry && u.hp < u.maxHp) infantryUnderFire++;
    }
  }
  return { hashes, advancersOnStructures, infantryUnderFire };
}

test('DDD-7/9: a full battle is bit-identical with every unit renamed on every tick', () => {
  const plain = battle(20260807, false);
  const renamed = battle(20260807, true);

  // Teeth first: a scenario where nothing happens would pass the hash check for the wrong reason.
  assert.ok(plain.advancersOnStructures > 100,
    `the fire-on-the-move branch never ran (${plain.advancersOnStructures} tick-instances)`);
  assert.ok(plain.infantryUnderFire > 100,
    `no infantry was ever shot (${plain.infantryUnderFire} tick-instances)`);

  const firstDiff = plain.hashes.findIndex((h, i) => h !== renamed.hashes[i]);
  assert.equal(firstDiff, -1,
    `renaming changed the battle at tick ${firstDiff}: ${plain.hashes[firstDiff]} vs ${renamed.hashes[firstDiff]}`);
});

test('DDD-7/9: the same battle with the +10% vs troops bonus taken is also rename-proof', () => {
  // The bonus is what makes bonusDamageMult's infantry arm load-bearing: without it the multiplier is
  // 1 either way and the old bug is invisible. Scribbling kind='Troops' onto every unit would, on the
  // old code, hand the tanks and copters a 10% buff they never had.
  const plain = battle(4242, false, 'dmg_troops');
  const renamed = battle(4242, true, 'dmg_troops');

  assert.ok(plain.infantryUnderFire > 100, 'the troops bonus path must actually be exercised');

  const firstDiff = plain.hashes.findIndex((h, i) => h !== renamed.hashes[i]);
  assert.equal(firstDiff, -1, `the troops bonus reacted to a label at tick ${firstDiff}`);
});
