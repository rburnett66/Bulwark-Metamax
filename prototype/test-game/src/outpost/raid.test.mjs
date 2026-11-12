// Outpost raids on the battle sim (tech plan docs/tech-plan/Outpost.md §4.2–§4.4; design Outpost-Design §5.2–§5.3)
// [MM-story_mw5oegk1_o]. The §4.4 items O2 deferred to O7: measured raid sizes and the hold counts, raid determinism
// headless vs live, raid composition, the scripted first raid through advance with the real hook, a breach's loss;
// and the owner's 2026-11-07 decisions: raid-only weaker raiders, and a breacher for planets whose troops cannot hurt walls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { referenceOutpost, confirmOnline, advance, powerGrids } from './model.js';
import { outpostMapFromForge } from './outpostMap.js';
import { DRAFT_LAYOUT } from './draftLayout.js';
import {
  runRaid, createRaid, makeRaidHook, raidUnits, raidSize, raidSeed, wellDefended, stepOutpost, holdsBeforeBreach,
  MEASURE_SEEDS, RAID_DT, RAID_RANGE_CAP, FIRST_RAID_SIZE, breacherDue,
} from './raid.js';
import { raidFor, allStructures, OUTPOST, structureDef } from '../data/outpost.js';
import { UNITS, EFFECTIVENESS } from '../data/tables.js';
import '../data/factions.js';

const REG = globalThis.BulwarkFactions;
const PLANETS = ['ground', 'air', 'hightech', 'artillery', 'water', 'arcane', 'space', 'dark', 'greenies'];
const OUTPOST_STRUCTS = new Set(['STR-MG', 'STR-Cannon', 'STR-Wall']);
const map = outpostMapFromForge(JSON.parse(fs.readFileSync(new URL('../../content/maps/forge/ground-outpost.json', import.meta.url), 'utf8')), 'ground');
const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const kit = (seed = 11) => referenceOutpost('ground', { seed, map, now: T0 });
const raidOf = (o, extra = {}) => ({ window: 3, at: T0, powered: powerGrids(o, map).powered, ...extra });

const hurtsWalls = (id) => ((EFFECTIVENESS[UNITS[id].damageType] || {}).Structure || 0) > 0;

test('every planet has a measured raid: tier I lightGround units of its own faction, a size per contract step', () => {
  for (const p of PLANETS) {
    const prefix = REG.find(p).prefix;
    for (const step of [1, 2, 3]) {
      const r = raidFor(p, step);
      assert.ok(r && r.size >= 1, `${p} step ${step} has a size`);
      assert.equal(raidSize(p, step), r.size);
      assert.ok(r.hpMult > 0 && r.hpMult <= 1 && r.dmgMult > 0 && r.dmgMult <= 1, `${p}: raid-only multipliers in (0, 1]`);
      const units = raidUnits(p, step);
      assert.equal(units.length, r.size + (r.breacher ? 1 : 0));
      for (const id of units.slice(0, r.size)) {
        assert.ok(UNITS[id], `${id} is a unit`);
        assert.equal(UNITS[id].lightGround, true, `${id} is light ground (owner: troops and low-end tanks only)`);
        assert.ok(id.startsWith(`${prefix}-`), `${id} is ${p}'s own faction (dissidents)`);
      }
      // the breacher exception (owner 2026-11-07): only where the troops cannot hurt walls; own faction, ground, hurts walls
      const troops = r.units[0];
      if (hurtsWalls(troops)) assert.equal(r.breacher, null, `${p}: its troops hurt walls, no breacher`);
      else {
        assert.ok(r.breacher, `${p}: its troops cannot hurt walls, so its raids carry a breacher`);
        assert.ok(r.breacher.startsWith(`${prefix}-`) && UNITS[r.breacher].domain === 'Walker' && hurtsWalls(r.breacher), r.breacher);
        assert.equal(units.at(-1), r.breacher, 'one breacher, after the others');
      }
    }
  }
  assert.equal(raidFor('ground', 1).size >= 2, true, 'weaker raiders make raids above one troop possible (owner 2026-11-07)');
});

test('a raid spawns only tier I lightGround raiders and fights only with STR-MG, STR-Cannon and STR-Wall', () => {
  for (const s of allStructures().filter((x) => x.battleStruct)) assert.ok(OUTPOST_STRUCTS.has(s.battleStruct), `${s.kind} → ${s.battleStruct}`);
  const o = kit();
  const raid = createRaid(o, raidOf(o), { map, units: ['GND-Troops', 'GND-Troops', 'GND-Tanks'] });
  const seen = new Map();
  while (!raid.done) {
    raid.tick();
    for (const u of raid.state.units.values()) if (u.side === 'attacker') seen.set(u.id, u);
  }
  assert.equal(seen.size, 3);
  const { hpMult, dmgMult } = raidFor('ground', 1);
  for (const u of seen.values()) {
    assert.equal(u.tier, 1, `${u.unitId} spawns at tier I`);
    assert.equal(u.lightGround, true);
    assert.ok(Math.abs(u.maxHp - UNITS[u.unitId].hp[0] * hpMult) < 1e-9, 'raid-only HP multiplier');
    assert.ok(Math.abs(u.dps - UNITS[u.unitId].dps[0] * dmgMult) < 1e-9, 'raid-only damage multiplier');
    assert.ok(u.range <= RAID_RANGE_CAP, 'no long range at outposts');
  }
  assert.equal(UNITS['GND-Troops'].hp[0], 220, 'the battle game is unchanged');
  for (const s of raid.state.structures.values()) assert.ok(OUTPOST_STRUCTS.has(s.structId), s.structId);
});

test('a raid is identical run once, run twice, or stepped live and finished headless mid-way', () => {
  const o = kit(222);
  const r = raidOf(o, { window: 41 });
  const opts = { map, units: ['GND-Troops', 'GND-Troops', 'GND-Tanks'] };
  const a = runRaid(o, r, opts), b = runRaid(o, r, opts);
  assert.deepEqual(b, a, 'headless twice');
  // live: uneven frame times for a while (the view's requestAnimationFrame), then the view closes
  const live = createRaid(o, r, opts);
  const frames = [0.016, 0.033, 0.021, 0.05, 0.009, 0.1, 0.017];
  let t = 0;
  for (let i = 0; t < a.ticks * RAID_DT * 0.5; i++) { const dt = frames[i % frames.length]; live.step(dt); t += dt; }
  assert.equal(live.done, false, 'still running when the view closes');
  assert.ok(live.state.tick > 0);
  assert.deepEqual(live.finish(), a, 'finished headless: the same result');
  assert.ok(['held', 'breach'].includes(a.result));
  assert.equal(a.defenses.length, o.defenses.length);
  // the same outpost and window give the same seed; another window another seed
  assert.equal(raidSeed(o.seed, r), raidSeed(o.seed, { ...r }));
  assert.notEqual(raidSeed(o.seed, r), raidSeed(o.seed, { ...r, window: 42 }));
});

// was '... an unpowered gun stays inert' (a gun not in raid.powered never fired); defenses need no power since owner
// 2026-11-11 ("Defense towers do not need power") [MM-task_mwcutmnk_3h], so every standing gun fights, grid or not
test('defenses start from their saved HP; a wreck is not placed; a gun fires with no power at all', () => {
  const o = kit();
  o.defenses[0].hp = 123;                     // the cannon, worn
  o.defenses[2].hp = 0;                       // a wall, wrecked
  const raid = createRaid(o, raidOf(o, { powered: new Set() }), { map, units: ['GND-Troops'] });
  const byDef = new Map([...raid.defenseIds].map(([sid, did]) => [did, raid.state.structures.get(sid)]));
  assert.equal(byDef.get(o.defenses[0].id).hp, 123);
  assert.equal(byDef.has(o.defenses[2].id), false, 'the wreck is not on the board');
  for (const s of byDef.values()) {
    assert.equal(s.unpowered, undefined, 'no defense is inert for power');
    assert.ok(!(s.stunnedUntil > 0), 'nor stunned');
  }
  const res = raid.finish();
  assert.equal(res.defenses.find((d) => d.id === o.defenses[2].id).hp, 0, 'a wreck stays a wreck');
});

test('with the measured raids the starter set holds 4–6 raids before a breach and the well defended set 7–9, at every contract step (Verdance, design §5.2)', () => {
  for (const step of [1, 2, 3]) {   // owner 2026-11-07: the same two sets at every step; later raids are smaller
    const k = MEASURE_SEEDS.map((seed) => holdsBeforeBreach(stepOutpost('ground', step, { map, seed }), { map, step }));
    const w = MEASURE_SEEDS.map((seed) => holdsBeforeBreach(wellDefended(stepOutpost('ground', step, { map, seed }), map), { map, step }));
    assert.ok(median(k) >= 4 && median(k) <= 6, `step ${step}: starter holds ${median(k)} (seeds: ${k.join(' ')})`);
    assert.ok(median(w) >= 7 && median(w) <= 9, `step ${step}: well defended holds ${median(w)} (seeds: ${w.join(' ')})`);
  }
  assert.equal(wellDefended(kit(), map).defenses.filter((d) => d.kind === 'mg').length, 2, 'well defended = the starter set plus one Machine Gun');
});

test('the breacher comes every Breacher_Every-th raid window, the same away and live (owner 2026-11-07)', () => {
  const breachers = PLANETS.map((p) => raidFor(p, 1)).filter((r) => r.breacher);
  assert.ok(breachers.length >= 2, 'Xenthe and Vexmire carry a breacher');
  for (const r of breachers) {
    assert.equal(r.breacherEvery, 2, `${r.planet}: every other raid`);
    for (const w of [0, 1, 2, 3, 40, 41]) {
      const units = raidUnits(r.planet, 1, w);
      assert.equal(units.includes(r.breacher), w % 2 === 0, `${r.planet} window ${w}`);
    }
    // through createRaid: the raid's own window decides, so a live raid and the away hook bring the same raiders
    const pmap = outpostMapFromForge(JSON.parse(fs.readFileSync(new URL(`../../content/maps/forge/${r.planet}-outpost.json`, import.meta.url), 'utf8')), r.planet);
    const o = referenceOutpost(r.planet, { seed: 5, map: pmap, now: T0 });
    for (const w of [6, 7]) {
      const raid = createRaid(o, { window: w, at: T0, powered: powerGrids(o, pmap).powered }, { map: pmap, step: 1 });
      assert.equal(raid.units.includes(r.breacher), w % 2 === 0);
    }
  }
  for (const p of PLANETS) if (!raidFor(p, 1).breacher) assert.ok(raidUnits(p, 1, 0).every((u) => UNITS[u].lightGround));
  assert.equal(breacherDue(null, 2), false, 'the scripted first raid has no window: never a breacher');
});

test('the scripted first raid is a probe the setup plus one Machine Gun and two walls holds (owner 2026-11-07)', () => {
  const seeds = [11, 222, 3333, 44444, 555555];
  const run = (defs, seed) => {
    const o = referenceOutpost('ground', { seed, map, now: T0 });
    o.defenses = defs.map(([kind, cell], i) => ({ id: `d${i + 1}`, kind, tier: 1, cell, hp: structureDef(kind, 1).battle.hp }));
    const raid = createRaid(o, { at: T0, first: true, powered: powerGrids(o, map).powered }, { map, step: 1 });
    assert.equal(raid.units.length, FIRST_RAID_SIZE, 'a probe, no breacher');
    return raid.finish().result;
  };
  const setups = [
    [['mg', [42, 20]], ['wall', [38, 22]], ['wall', [39, 22]]],      // MG and walls on the south ramp
    [['mg', [42, 20]], ['wall', [26, 14]], ['wall', [26, 15]]],      // MG south-east, walls on the west ramp
    [['mg', [27, 13]], ['wall', [26, 14]], ['wall', [26, 15]]],      // MG and walls on the west ramp
  ];
  for (const set of setups) for (const seed of seeds) assert.equal(run(set, seed), 'held', `${JSON.stringify(set)} seed ${seed}`);
  for (const seed of seeds) assert.equal(run([], seed), 'breach', 'with no defenses the probe walks in');
});

test('on every planet\'s own outpost map the scripted first raid is held by the setup plus one Machine Gun and two walls (O11)', () => {
  for (const p of PLANETS.filter((q) => q !== 'ground')) {
    const pmap = outpostMapFromForge(JSON.parse(fs.readFileSync(new URL(`../../content/maps/forge/${p}-outpost.json`, import.meta.url), 'utf8')), p);
    const run = (defs, seed) => {
      const o = referenceOutpost(p, { seed, map: pmap, now: T0 });
      o.defenses = defs.map(([kind, cell], i) => ({ id: `d${i + 1}`, kind, tier: 1, cell, hp: structureDef(kind, 1).battle.hp }));
      return createRaid(o, { at: T0, first: true, powered: powerGrids(o, pmap).powered }, { map: pmap, step: 1 }).finish().result;
    };
    for (const set of [[['mg', [42, 20]], ['wall', [38, 22]], ['wall', [39, 22]]], [['mg', [27, 13]], ['wall', [26, 14]], ['wall', [26, 15]]]]) {
      for (const seed of [11, 222, 3333]) assert.equal(run(set, seed), 'held', `${p}: ${JSON.stringify(set)} seed ${seed}`);
    }
    assert.equal(run([], 11), 'breach', `${p}: with no defenses the probe walks in`);
  }
});

test('the scripted first raid runs headless through advance with the real hook', () => {
  let o = confirmOnline(kit(5), map, T0).outpost;
  let calls = 0;
  const hook = makeRaidHook({ map, step: 1 });
  const counting = (out, raid) => { calls++; assert.equal(raid.first, true); assert.ok(raid.powered instanceof Set); return hook(out, raid); };
  const { outpost, report } = advance(o, o.firstRaidAt, { map, raid: counting });
  assert.equal(calls, 1);
  assert.equal(report.raids.length, 1);
  assert.ok(['held', 'breach'].includes(report.raids[0].result));
  // the same raid through runRaid directly gives the same outcome
  const direct = runRaid(o, { at: o.firstRaidAt, first: true, powered: powerGrids(o, map).powered }, { map, step: 1 });
  assert.equal(report.raids[0].result, direct.result);
  for (const d of direct.defenses) assert.equal(outpost.defenses.find((x) => x.id === d.id).hp, d.hp);
});

test('a breach through advance loses 25 % of the ore in storage and changes no building', () => {
  let o = confirmOnline(kit(5), map, T0).outpost;
  o.defenses = o.defenses.map((d) => ({ ...d, hp: 0 }));     // every defense a wreck: the raid walks in
  const rig = Object.keys(o.pads).find((id) => o.pads[id].kind === 'rig');
  o.storage[rig] = { iron: 400 };
  const { outpost, report } = advance(o, o.firstRaidAt, { map, raid: makeRaidHook({ map, step: 1 }) });
  const e = report.raids[0];
  assert.equal(e.result, 'breach');
  const after = outpost.storage[rig].iron;
  assert.ok(Math.abs(e.lost.iron - (after + e.lost.iron) * OUTPOST.Breach_Storage_Loss) < 1e-9, `lost ${e.lost.iron} of ${after + e.lost.iron}`);
  assert.deepEqual(outpost.pads, o.pads, 'no building goes down');
});

test('a raid on the draft layout (no terrain) still runs: open board, default lanes', () => {
  const draft = { ...JSON.parse(JSON.stringify(DRAFT_LAYOUT)), planet: 'ground' };
  const o = referenceOutpost('ground', { seed: 3, map: draft, now: T0 });
  const r = runRaid(o, { window: 1, powered: powerGrids(o, draft).powered }, { map: draft, units: ['GND-Troops'] });
  assert.ok(['held', 'breach'].includes(r.result));
});
