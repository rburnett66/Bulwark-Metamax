/** abilities.test.mjs — one special ability per faction [MM-story_mvn06wnv_7]. Owner 2026-10-24: "I want to create a
 *  special ability unit for each faction … no faction get more than one ability." Spec:
 *  docs/16 Bulwark MM/design/Special-Abilities-Design.md. Run: node --test src/sim/abilities.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, UNITS, MAP, factionsInRoster } from '../data/tables.js';
import { createSim, stepSim, FIXED_DT } from './core.js';
import { createUnit } from './entities.js';
import { placeCompletedStructure } from './balanceSim.js';
import { unitDisrupted, towerStunned } from './abilities.js';

const SLOT = MAP.slots[6];
const sec = (s) => Math.round(s / FIXED_DT);

function arena() {
  const st = createSim(11, { waves: [], map: MAP });
  if (st.base) st.base.cannon = null;
  return st;
}
/** a parked unit: no movement, no fire, lots of hp unless told otherwise; keeps its ability */
function park(st, unitId, x, y, opts = {}) {
  const def = UNITS[unitId];
  const lane = def.domain === 'Flyer' ? 'air' : (def.domain === 'Walker' ? 'ground' : 'water');
  const u = createUnit(st, unitId, opts.tier || 1, { x, y }, lane, opts.side || 'attacker');
  st.units.set(u.id, u);
  u.speed = 0; u.dps = 0; u.path = []; u.targetsBase = false; u.detonate = null;
  if (opts.hp !== undefined) u.hp = u.maxHp = opts.hp; else u.hp = u.maxHp = 1e6;
  if (opts.noAbility) u.ability = null;
  return u;
}
function run(st, ticks, onEvent) {
  for (let t = 0; t < ticks; t++) for (const e of stepSim(st, FIXED_DT)) if (onEvent) onEvent(e, st);
}
function damageTo(st, targetId, ticks, fromId) {
  let sum = 0;
  run(st, ticks, (e) => { if (e.type === 'damage' && e.targetId === targetId && (fromId === undefined || e.sourceId === fromId)) sum += e.amount; });
  return sum;
}

test('nine abilities, one per faction, each on exactly one unit the faction already fields', () => {
  const ids = Object.keys(ABILITIES);
  assert.equal(ids.length, 9);
  const roster = factionsInRoster();
  assert.equal(roster.length, 9);
  const byFaction = new Map();
  for (const [unitId, u] of Object.entries(UNITS)) {
    if (!u.ability) continue;
    assert.ok(ABILITIES[u.ability], `${unitId} names a real ability`);
    assert.equal(ABILITIES[u.ability].faction, u.faction, `${unitId}'s ability belongs to its faction`);
    assert.equal(ABILITIES[u.ability].carrier, unitId, `${u.ability} names its carrier`);
    assert.ok(!byFaction.has(u.faction), `${u.faction} has only one ability`);
    byFaction.set(u.faction, u.ability);
  }
  for (const f of roster) assert.ok(byFaction.has(f), `${f} has an ability`);
  assert.equal(new Set(byFaction.values()).size, 9, 'no ability is shared');
  for (const id of ids) assert.ok(typeof ABILITIES[id].name === 'string' && ABILITIES[id].blurb.length > 10, `${id} has a name and blurb`);
});

test('carriers spawn with the ability; other units do not', () => {
  const st = arena();
  assert.equal(park(st, 'GND-Tanks', 1, 1).ability, 'shieldTank');
  assert.equal(park(st, 'GND-Troops', 1, 2).ability, null);
});

test('Shield Tank: ground units near the tank take 30% less damage', () => {
  const hitOn = (withTank) => {
    const st = arena();
    placeCompletedStructure(st, 'STR-Cannon', SLOT);
    const troop = park(st, 'GND-Troops', SLOT.x + 2, SLOT.y);
    if (withTank) park(st, 'GND-Tanks', SLOT.x + 3.5, SLOT.y);   // farther from the cannon, so it shoots the troop
    return damageTo(st, troop.id, sec(1));
  };
  const plain = hitOn(false), shielded = hitOn(true);
  assert.ok(plain > 0);
  assert.ok(Math.abs(shielded / plain - ABILITIES.shieldTank.damageMult) < 0.01, `ratio ${shielded / plain}`);
});

test('Freeze Missile: one missile per fighter freezes the towers near the impact for 3 s', () => {
  const st = arena();
  const a = placeCompletedStructure(st, 'STR-Cannon', SLOT);
  const b = placeCompletedStructure(st, 'STR-Cannon', { x: SLOT.x + 1, y: SLOT.y });
  const far = placeCompletedStructure(st, 'STR-Cannon', { x: SLOT.x - 3, y: SLOT.y });
  park(st, 'AIR-Planes', SLOT.x + 4, SLOT.y + 3);
  park(st, 'GND-Troops', SLOT.x, SLOT.y + 2);   // something for every cannon to shoot
  let launches = 0, hitAt = null;
  run(st, sec(1), (e) => { if (e.kind === 'freezeLaunch') launches++; if (e.kind === 'freezeHit' && hitAt === null) hitAt = st.tick; });
  assert.equal(launches, 1);
  assert.ok(hitAt !== null, 'the missile landed');
  assert.ok(towerStunned(st, a) && towerStunned(st, b), 'both towers at the impact are frozen');
  assert.ok(!towerStunned(st, far), 'the tower 3+ cells away is not');
  const fired = new Set();
  run(st, sec(2.5), (e) => { if (e.type === 'damage') fired.add(e.sourceId); });
  assert.ok(!fired.has(a.id) && !fired.has(b.id), 'frozen towers hold fire');
  assert.ok(fired.has(far.id), 'the far tower keeps shooting');
  run(st, sec(1));
  assert.ok(!towerStunned(st, a), 'the freeze wears off');
  run(st, sec(15), (e) => { if (e.kind === 'freezeLaunch') launches++; });
  assert.equal(launches, 1, 'one missile per fighter life');
});

test('Shield Drone: blocks missile-tower damage until its shield is spent; cannons ignore it', () => {
  const st = arena();
  const rk = placeCompletedStructure(st, 'STR-Rockets', SLOT);
  const troop = park(st, 'HTC-Troops', SLOT.x + 3, SLOT.y);
  const drone = park(st, 'HTC-Missiles', SLOT.x + 3, SLOT.y + 1.5);
  let pop = false, beforePop = 0, afterPop = 0;
  run(st, sec(15), (e) => {
    if (e.kind === 'shieldPop') pop = true;
    if (e.type === 'damage' && e.targetId === troop.id && e.sourceId === rk.id) { if (pop) afterPop += e.amount; else beforePop += e.amount; }
  });
  assert.ok(pop, 'the shield ran dry and popped');
  assert.equal(drone.shieldPool, 0);
  assert.ok(beforePop < 1e-6, `no rocket damage got through the bubble (${beforePop})`);
  assert.ok(afterPop > 0, 'rockets land again once it pops');

  const st2 = arena();
  const cn = placeCompletedStructure(st2, 'STR-Cannon', SLOT);
  const t2 = park(st2, 'HTC-Troops', SLOT.x + 2, SLOT.y);
  park(st2, 'HTC-Missiles', SLOT.x + 2, SLOT.y + 1.5);
  assert.ok(damageTo(st2, t2.id, sec(1), cn.id) > 0, 'a cannon is not a missile tower');
});

test('Mine Layer: plants up to three mines on resource fields; an armed mine blows up a harvester-class unit', () => {
  const st = arena();
  const x0 = SLOT.x + 8, y0 = SLOT.y + 8;
  st.resourceNodes = [0, 1, 2, 3].map((i) => ({ id: 'n' + i, fieldId: 'f', x: x0 + i * 1.6, y: y0, remaining: 10, units: 10 }));
  const truck = park(st, 'ART-Trucks', x0 + 2.4, y0 + 1);
  let placed = 0;
  run(st, sec(10), (e) => { if (e.kind === 'minePlaced') placed++; });
  assert.equal(placed, ABILITIES.mineLayer.maxMines, 'three mines, then it is out');
  assert.equal(st.enemyMines.length, 3);
  const m = st.enemyMines[0];
  const victim = park(st, 'GND-Trucks', m.pos.x, m.pos.y, { side: 'defender', hp: 1000, noAbility: true });
  let blasts = 0;
  run(st, 2, (e) => { if (e.kind === 'mineBlast') blasts++; });
  assert.equal(blasts, 1);
  const expected = ABILITIES.mineLayer.burst * 1.7;   // Concussion vs Machinery
  assert.ok(Math.abs((1000 - victim.hp) - expected) < 1, `burst ${1000 - victim.hp} ≈ ${expected}`);
  assert.equal(st.enemyMines.length, 2, 'the mine is spent');
  assert.ok(truck.hp > 0);
});

test('Water Blobs: a puddle pins defender units in place for its duration', () => {
  const st = arena();
  const p = { x: SLOT.x + 9, y: SLOT.y + 9 };
  const unit = park(st, 'GND-Troops', p.x + 3, p.y, { side: 'defender', noAbility: true });
  park(st, 'WTR-Missiles', p.x, p.y);
  let landed = null;
  run(st, sec(1.2), (e) => { if (e.kind === 'puddle' && landed === null) landed = st.tick; });
  assert.ok(landed !== null, 'the blob landed');
  assert.equal(st.puddles.length, 1);
  assert.ok(unitDisrupted(st, unit), 'the defender in the puddle is stuck');
  // move it out of the puddle: the next tick frees it
  unit.pos.x += 5; run(st, 2);
  assert.ok(!unitDisrupted(st, unit), 'out of the puddle, free again');
});

test('Mirror Units: decoys copy a strong unit, deal nothing, draw tower fire, pay no bounty and fade', () => {
  const st = arena();
  const cn = placeCompletedStructure(st, 'STR-Cannon', SLOT);
  const truck = park(st, 'ARC-Trucks', SLOT.x + 6, SLOT.y, { hp: 250 });
  const tank = park(st, 'ARC-Tanks', SLOT.x + 3.4, SLOT.y, { hp: 400 });
  tank.maxHp = 400;
  let mirror = null;
  run(st, 2, (e) => { if (e.kind === 'mirrorCast' && !mirror) mirror = st.units.get(e.mirrorId); });
  assert.ok(mirror, 'a mirror was cast');
  assert.equal(mirror.unitId, 'ARC-Tanks', 'it copies the strongest unit nearby');
  assert.ok(mirror.isMirror && mirror.noBounty && mirror.dps === 0);
  assert.ok(Math.abs(mirror.maxHp - 400 * ABILITIES.mirrorUnits.hpFrac) < 1e-6);
  // move the mirror inside cannon range but FARTHER than the real tank: the cannon still shoots the mirror
  mirror.speed = 0; mirror.path = []; mirror.pos = { x: SLOT.x + 3.9, y: SLOT.y };
  const killsBefore = st.economy.kills || 0;
  let shotMirror = false, mirrorDied = false;
  run(st, sec(3), (e) => {
    if (e.type === 'damage' && e.sourceId === cn.id && e.targetId === mirror.id) shotMirror = true;
    if (e.type === 'kill' && e.entityId === mirror.id) { mirrorDied = true; assert.equal(e.income, 0, 'no bounty for a mirror'); }
  });
  assert.ok(shotMirror, 'the tower prefers the decoy');
  assert.ok(mirrorDied);
  assert.equal(st.economy.kills || 0, killsBefore, 'a mirror is not a kill');
  // fades on its own; never more than two at once
  const st2 = arena();
  park(st2, 'ARC-Trucks', SLOT.x + 9, SLOT.y + 9);
  let maxLive = 0, faded = 0;
  run(st2, sec(30), (e, s) => {
    if (e.kind === 'mirrorFade') faded++;
    let n = 0; for (const u of s.units.values()) if (u.isMirror && u.hp > 0) n++;
    maxLive = Math.max(maxLive, n);
  });
  assert.ok(faded >= 2, 'mirrors fade after their life');
  assert.ok(maxLive <= ABILITIES.mirrorUnits.maxLive);
  assert.ok(truck.hp > 0);
});

test('Stealth: tier-1 towers cannot see cloaked units; an upgraded tower can; units outside the field are visible', () => {
  const setup = (tier) => {
    const st = arena();
    const cn = placeCompletedStructure(st, 'STR-Cannon', SLOT);
    cn.tier = tier;
    const troop = park(st, 'SPC-Troops', SLOT.x + 2, SLOT.y);
    park(st, 'SPC-Trucks', SLOT.x + 3.5, SLOT.y);
    return { st, cn, troop };
  };
  const t1 = setup(1);
  assert.equal(damageTo(t1.st, t1.troop.id, sec(1), t1.cn.id), 0, 'tier 1 cannot see it');
  const t2 = setup(2);
  assert.ok(damageTo(t2.st, t2.troop.id, sec(1), t2.cn.id) > 0, 'tier 2 sees through the cloak');
  const st = arena();
  const cn = placeCompletedStructure(st, 'STR-Cannon', SLOT);
  const exposed = park(st, 'SPC-Troops', SLOT.x + 2, SLOT.y);
  park(st, 'SPC-Trucks', SLOT.x + 9, SLOT.y + 9);
  assert.ok(damageTo(st, exposed.id, sec(1), cn.id) > 0, 'out of the field, visible');
});

test('Resurrected: a unit that dies near the scout rises 1.5 s later at half health, no bounty, three times', () => {
  const st = arena();
  placeCompletedStructure(st, 'STR-Cannon', SLOT);
  const scout = park(st, 'DRK-Trucks', SLOT.x + 6, SLOT.y);
  const victim = park(st, 'DRK-Troops', SLOT.x + 3.5, SLOT.y, { hp: 20 });
  let raisedEvents = 0, kills = 0;
  const raised = [];
  run(st, sec(20), (e, s) => {
    if (e.kind === 'raised') { raisedEvents++; const u = s.units.get(e.entityId); u._hpFracAtRaise = u.hp / u.maxHp; raised.push(u); u.speed = 0; u.path = []; u.dps = 0; u.targetsBase = false; }
    if (e.type === 'kill' && e.side === 'attacker') kills++;
  });
  assert.ok(raised.length >= 1, 'it rose');
  const r = raised[0];
  assert.equal(r.unitId, 'DRK-Troops');
  assert.ok(r.raised && r.noBounty);
  // the 'raised' event drains after the same tick's combat, so the cannon may already have nicked it
  assert.ok(r._hpFracAtRaise <= ABILITIES.resurrect.hpFrac + 1e-9 && r._hpFracAtRaise > ABILITIES.resurrect.hpFrac - 0.1, `rises at half health (${r._hpFracAtRaise})`);
  assert.equal(raisedEvents, 1, 'a raised unit is never raised again');
  assert.ok(victim.hp <= 0);
  assert.ok(scout.hp > 0);
  // cap: three raises per scout
  const st2 = arena();
  placeCompletedStructure(st2, 'STR-Cannon', SLOT);
  const s2 = park(st2, 'DRK-Trucks', SLOT.x + 6, SLOT.y);
  for (let i = 0; i < 5; i++) park(st2, 'DRK-Troops', SLOT.x + 3.5, SLOT.y + i * 0.1, { hp: 15 });
  let n = 0;
  run(st2, sec(30), (e, s) => { if (e.kind === 'raised') { n++; const u = s.units.get(e.entityId); u.speed = 0; u.path = []; u.dps = 0; u.targetsBase = false; } });
  assert.equal(n, ABILITIES.resurrect.maxRaises);
  assert.equal(s2.abilityUses, 3);
});

test('Resurrected: the raise is cancelled if the scout dies first', () => {
  const st = arena();
  const scout = park(st, 'DRK-Trucks', SLOT.x + 9, SLOT.y + 9);
  const victim = park(st, 'DRK-Troops', SLOT.x + 9.5, SLOT.y + 9);
  victim.hp = 0;   // dies this tick next to the scout
  let cancelled = false, raised = false;
  run(st, 2);
  scout.hp = 0;
  run(st, sec(2), (e) => { if (e.kind === 'raiseCancelled') cancelled = true; if (e.kind === 'raised') raised = true; });
  assert.ok(cancelled && !raised);
});

test('Stun Drones: one tower knocked out at a time, for 3 s each', () => {
  const st = arena();
  const a = placeCompletedStructure(st, 'STR-Cannon', SLOT);
  const b = placeCompletedStructure(st, 'STR-Cannon', { x: SLOT.x - 2, y: SLOT.y });
  park(st, 'GRN-Trucks', SLOT.x + 3, SLOT.y + 2);
  let maxAtOnce = 0, stunnedTicks = 0, drones = 0;
  for (let t = 0; t < sec(20); t++) {
    for (const e of stepSim(st, FIXED_DT)) if (e.kind === 'stunDrone') drones++;
    const n = (towerStunned(st, a) ? 1 : 0) + (towerStunned(st, b) ? 1 : 0);
    maxAtOnce = Math.max(maxAtOnce, n);
    if (n) stunnedTicks++;
  }
  assert.equal(maxAtOnce, 1, 'never two towers at once');
  assert.ok(drones >= 4, `${drones} drones in 20 s`);
  const cycle = ABILITIES.stunDrones.flight + ABILITIES.stunDrones.stun + ABILITIES.stunDrones.cooldown;
  assert.ok(Math.abs(stunnedTicks * FIXED_DT / 20 - ABILITIES.stunDrones.stun / cycle) < 0.1, `about 3 s of every 4.5 s (got ${(stunnedTicks * FIXED_DT).toFixed(2)} s of 20, ${drones} drones)`);
});

test('abilities are deterministic: the same setup gives the same event stream', () => {
  const once = () => {
    const st = arena();
    placeCompletedStructure(st, 'STR-Cannon', SLOT);
    placeCompletedStructure(st, 'STR-Rockets', { x: SLOT.x - 2, y: SLOT.y });
    st.resourceNodes = [{ id: 'n', fieldId: 'f', x: SLOT.x + 4, y: SLOT.y + 4, remaining: 5, units: 5 }];
    for (const id of ['GND-Tanks', 'HTC-Missiles', 'ART-Trucks', 'ARC-Trucks', 'SPC-Trucks', 'DRK-Trucks', 'GRN-Trucks', 'AIR-Planes', 'WTR-Missiles']) {
      park(st, id, SLOT.x + 3, SLOT.y + 2, { hp: 300 });
    }
    for (let i = 0; i < 4; i++) park(st, 'DRK-Troops', SLOT.x + 2 + i * 0.3, SLOT.y + 1, { hp: 40 });
    const out = [];
    run(st, sec(12), (e) => out.push(JSON.stringify(e)));
    return out;
  };
  const a = once(), b = once();
  assert.ok(a.length > 50);
  assert.deepEqual(a, b);
});

test('campaign waves carry their quota of the faction ability unit from wave 2', async () => {
  const { buildCampaignMap } = await import('./mapgen.js');
  const { buildCampaignWaves } = await import('./campaign.js');
  const { ABILITY_CARRIERS_PER_WAVE } = await import('../data/tables.js');
  for (const f of factionsInRoster()) {
    const carrier = Object.keys(UNITS).find((id) => UNITS[id].faction === f && UNITS[id].ability);
    const air = UNITS[carrier].domain === 'Flyer';
    for (const mapId of [1, 5]) {
      const waves = buildCampaignWaves(buildCampaignMap(mapId), f);
      waves.forEach((w, i) => {
        const n = w.spawns.filter((s) => s.unitId === carrier).length;
        const want = (air && i < 2 && f !== 'Water') ? 0 : ABILITY_CARRIERS_PER_WAVE[i];
        assert.ok(n >= want, `${f} map ${mapId} wave ${i + 1}: ${n} carriers, want ≥ ${want}`);
      });
    }
  }
});
