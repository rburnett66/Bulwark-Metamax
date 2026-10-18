// T3.3 [MM-task_mv9s9mza_2] — combat effects in the 3D view: which shots fire, how they fly at height, the flashes
// they and the sim's events leave, that the model never touches the sim, and that the view fills one instanced draw.
import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../../vendor/three.module.js';
import { createCombatFx, RECIPES, STRUCT_RECIPES, SHOT_LOOK, FLASH, MUZZLE, AIM, FLIGHT } from './combatFxModel.js';
import { STRUCTURES } from '../../data/tables.js';
import { createCombatFxView } from './combatFx.js';
import { glowPixels, glowAlpha, GLOW_SIZE } from './glowTexture.js';
import { HOVER_HEIGHT } from '../units/unitViews.js';
import { BASE_TARGET_ID } from '../../sim/combat.js';

const MAP = { cols: 32, rows: 32, base: { x: 16, y: 16 } };
const DEFS = { tank: { projectileFx: 'shell' }, rifle: { projectileFx: null }, jet: { projectileFx: 'tracer' } };
const getDef = (id) => DEFS[id];

function world({ time = 0, units = [], structures = [] } = {}) {
  return {
    time,
    units: new Map(units.map((u) => [u.id, { hp: 10, maxHp: 10, side: 'attacker', domain: 'Ground', ...u }])),
    structures: new Map(structures.map((s) => [s.id, { lifecycle: 'Complete', footprint: { w: 1, h: 1 }, ...s }])),
    base: { pos: { x: 16, y: 16 } },
  };
}
const tower = (o) => ({ id: 100, structId: 'STR-Tower', kind: 'antiGround', pos: { x: 4, y: 4 }, targetId: 1, ...o });
const tank = (o) => ({ id: 1, unitId: 'tank', pos: { x: 10, y: 4 }, targetId: null, ...o });

/** Run the model over `secs` of sim time in `step`-second frames. */
function run(fx, st, secs, step = 1 / 60, events = []) {
  const n = Math.round(secs / step);
  for (let i = 0; i < n; i++) {
    fx.update(st, MAP, i === 0 ? events : [], step, { getDef });
    st.time += step;
  }
}

test('an anti-ground tower fires its burst from its barrel tip at the target', () => {
  const fx = createCombatFx();
  const st = world({ units: [tank()], structures: [tower()] });
  fx.update(st, MAP, [], 1 / 60, { getDef });
  assert.equal(fx.shots.length, 1, 'first round leaves at once');
  const s = fx.shots[0];
  assert.equal(s.y, MUZZLE.antiGround);
  assert.ok(s.x > 4.5 + MUZZLE.barrel - 1e-9 - 0.01, 'leaves the barrel tip, toward the target');
  assert.equal(s.color, RECIPES.antiGround.color);
  assert.ok(s.dx > 0.99, 'flies east toward the tank');
  run(fx, st, 0.25);
  // the whole burst launched; the first may already have landed
  assert.ok(fx.launched === RECIPES.antiGround.burst, `burst of ${RECIPES.antiGround.burst}`);
  for (const r of fx.shots) assert.ok(Math.abs(r.tz - 4.5) <= 0.16 + 1e-9 && Math.abs(r.tx - 10.5) <= 0.16 + 1e-9, 'jitter within the spread');
});

test('shots fly at recipe speed and arrive as a hit flash at the target height', () => {
  const fx = createCombatFx();
  const st = world({ units: [tank()], structures: [tower()] });
  fx.update(st, MAP, [], 0, { getDef });
  const s = fx.shots[0];
  const x0 = s.x;
  fx.update(st, MAP, [], 0.1, { getDef });
  assert.ok(Math.abs((s.x - x0) - RECIPES.antiGround.speed * 0.1 * s.dx) < 1e-9);
  st.units.get(1).targetId = null;
  st.structures.get(100).targetId = null;   // stop firing; let the rounds land
  const hits = [];
  for (let i = 0; i < 60; i++) {
    fx.update(st, MAP, [], 1 / 60, { getDef });
    for (const f of fx.flashes) if (f.color === FLASH.hit.color && f.age <= 1 / 60 + 1e-9) hits.push({ ...f });
  }
  assert.equal(fx.shots.length, 0);
  assert.ok(hits.length >= 1);
  assert.ok(hits.every((f) => f.y === AIM.ground));
});

test('anti-air fires homing missiles that climb off the rail, chase a moving flyer and airburst on it', () => {
  const fx = createCombatFx();
  const jet = { id: 7, unitId: 'jet', domain: 'Flyer', altitude: 1, hp: 50, pos: { x: 6, y: 4 } };
  const st = world({ units: [jet], structures: [tower({ kind: 'antiAir', targetId: 7 })] });
  const trails = [];
  const opts = { getDef, trail: (k) => trails.push(k) };
  fx.update(st, MAP, [], 0, opts);
  const s = fx.shots[0];
  assert.equal(s.kind, 'missile');
  assert.ok(s.vy > 0, 'climbing off the rail');
  st.structures.get(100).targetId = null;
  let burst = null;
  for (let i = 0; i < 120 && !burst; i++) {
    jet.pos.y += 0.03;                                       // the target is moving
    fx.update(st, MAP, [], 1 / 60, opts);
    burst = fx.flashes.find((f) => f.color === FLASH.airburst.color) || null;
  }
  assert.ok(burst, 'it catches the target');
  // proximity fuse [MM-task_mvd2ln2i_h]: the burst is BESIDE the plane, within fuse range — not on its centre
  const miss = Math.hypot(burst.x - (jet.pos.x + 0.5), burst.y - HOVER_HEIGHT, burst.z - (jet.pos.y + 0.5));
  assert.ok(miss < FLIGHT.fuse + 0.45, `bursts near the moving target (${miss.toFixed(2)} cells off)`);
  assert.ok(trails.filter((k) => k === 'missile').length > 5, 'a smoke trail');
});

test('a rocket tower lobs a salvo; each rocket lands with a small ground explosion', () => {
  const fx = createCombatFx();
  const booms = [];
  const st = world({ units: [tank()], structures: [tower({ structId: 'STR-Rockets' })] });
  const opts = { getDef, boom: (x, z, k) => booms.push({ x, z, k }), trail: () => {} };
  let peak = 0;
  for (let i = 0; i < 120; i++) { st.time = (st.time || 0) + 1 / 60; fx.update(st, MAP, [], 1 / 60, opts); for (const r of fx.shots) if (r.kind === 'rocket') peak = Math.max(peak, r.y); }
  assert.ok(peak > 1, `arcs (${peak.toFixed(2)})`);
  assert.ok(booms.length >= 2, `salvo lands (${booms.length})`);
  for (const b of booms) assert.ok(Math.abs(b.x - 10.5) < 0.6, 'around the target');
});

test('cadence: no second volley before the shooter is ready', () => {
  const fx = createCombatFx();
  const st = world({ units: [tank({ targetId: 2 }), tank({ id: 2, side: 'defender', pos: { x: 14, y: 4 } })] });
  run(fx, st, 1);
  // cadence 0.6 s ± 15 % (0.51–0.69 s) → exactly 2 rounds in the first second
  assert.equal(fx.launched, 2);
  run(fx, st, 2);
  assert.ok(fx.launched >= 5 && fx.launched <= 6, `launched ${fx.launched} in 3 s`);
});

test('cannon tower: cadence + burst come from tables.js — 2-round volleys every ~1.5 s [MM-story_mvedxogl_4]', () => {
  assert.equal(STRUCT_RECIPES['STR-Cannon'].cadence, STRUCTURES['STR-Cannon'].cadence);
  assert.equal(STRUCT_RECIPES['STR-Cannon'].burst, STRUCTURES['STR-Cannon'].burst);
  assert.equal(STRUCTURES['STR-Cannon'].cadence, 1.5);
  assert.equal(STRUCTURES['STR-Cannon'].burst, 2);
  const fx = createCombatFx();
  const st = world({ units: [tank({ targetId: 0, pos: { x: 8, y: 4 } })], structures: [tower({ structId: 'STR-Cannon' })] });
  run(fx, st, 4.2);
  // volleys at ~0, ~1.5, ~3.0 s (±15 %) of 2 rounds → 6 (5–7 allowing a burst straddling the window)
  assert.ok(fx.launched >= 4 && fx.launched <= 7, `launched ${fx.launched} in 4.2 s (was ~20 at 0.55 s × 3)`);
});

test('who fires: armed units only, never harvesters, never at a dead or missing target', () => {
  const fx = createCombatFx();
  const st = world({ units: [
    tank({ id: 1, targetId: 9 }),                                         // 9 is not on the board
    tank({ id: 2, unitId: 'rifle', targetId: 3 }),                        // small arms draw nothing
    tank({ id: 3, isHarvester: true, targetId: 4 }),
    tank({ id: 4, targetId: 5 }), tank({ id: 5, hp: 0, pos: { x: 12, y: 8 } }),   // target already dead
  ] });
  fx.update(st, MAP, [], 1 / 60, { getDef });
  assert.equal(fx.shots.length, 0);
  st.units.get(4).targetId = BASE_TARGET_ID;
  fx.update(st, MAP, [], 1 / 60, { getDef });
  assert.equal(fx.shots.length, 1);
  assert.equal(fx.shots[0].color, RECIPES.unit.attacker);
  assert.equal(fx.shots[0].ty, AIM.base);
});

test('authored projFx overrides the look; projScale shrinks it', () => {
  const fx = createCombatFx();
  const st = world({ units: [tank({ targetId: BASE_TARGET_ID })] });
  const projFx = { tank: { kind: 'tracer', color: 0x123456, speed: 30, burst: 1, size: 2, streakLen: 3 } };
  fx.update(st, MAP, [], 0, { getDef, projFx, projScale: 0.5 });
  const s = fx.shots[0];
  assert.equal(s.kind, 'tracer');
  assert.equal(s.color, 0x123456);
  assert.equal(s.speed, 30);
  assert.ok(Math.abs(s.size - SHOT_LOOK.tracer.size * 2 * 0.5) < 1e-12);
  assert.ok(Math.abs(s.len - SHOT_LOOK.tracer.len * 3 * 0.5) < 1e-12);
});

test('events leave flashes: kill (sized by the unit), destroyed, mine, deposit; cannon blast lands after its flight', () => {
  const fx = createCombatFx();
  const st = world();
  fx.update(st, MAP, [
    { type: 'kill', pos: { x: 3, y: 3 }, radius: 0.56 },
    { type: 'destroyed', pos: { x: 5, y: 5 } },
    { type: 'mineExplode', pos: { x: 6, y: 6 } },
    { type: 'deposit', color: 'blue' },
    { type: 'damage', pos: { x: 1, y: 1 } },   // retired — no flash
    { type: 'cannonShot', from: { x: 16, y: 16 }, to: { x: 20, y: 16 }, dur: 0.5, radius: 2.5 },
  ], 0, { getDef });
  const by = (c) => fx.flashes.filter((f) => f.color === c);
  const kill = fx.flashes.find((f) => f.x === 3.5);
  assert.ok(Math.abs(kill.size - FLASH.kill.size * 2) < 1e-12);
  assert.equal(fx.flashes.find((f) => f.x === 5.5).size, FLASH.destroyed.size);
  assert.equal(by(0x58a6ff).length, 1, 'deposit in its crystal colour, at the base');
  assert.equal(by(FLASH.cannonMuzzle.color).length, 1);
  assert.equal(fx.flashes.length, 5);
  assert.ok(!fx.flashes.some((f) => f.x === 20.5), 'no blast before the shell lands');
  for (let i = 0; i < 31; i++) fx.update(st, MAP, [], 1 / 60, { getDef });
  assert.ok(fx.flashes.some((f) => f.x === 20.5 && f.color === FLASH.cannonBlast.color));
});

test('flashes bloom and fade, then free', () => {
  const fx = createCombatFx();
  const st = world();
  fx.update(st, MAP, [{ type: 'kill', pos: { x: 3, y: 3 } }], 0, { getDef });
  const f = fx.flashes[0];
  fx.update(st, MAP, [], FLASH.kill.ttl / 2, { getDef });
  assert.ok(f.size > f.size0 && f.alpha < 1 && f.alpha > 0);
  for (let i = 0; i < 3; i++) fx.update(st, MAP, [], FLASH.kill.ttl / 2, { getDef });
  assert.equal(fx.flashes.length, 0);
});

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    if (o instanceof Map) { for (const v of o.values()) deepFreeze(v); o.set = o.delete = o.clear = () => { throw new Error('sim Map written'); }; }
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

test('read-only: a frozen sim state and frozen events go through untouched', () => {
  const fx = createCombatFx();
  const st = world({ units: [tank({ targetId: BASE_TARGET_ID })], structures: [tower()] });
  const before = JSON.stringify({ u: [...st.units.values()], s: [...st.structures.values()] });
  const evs = deepFreeze([{ type: 'kill', pos: { x: 3, y: 3 } }, { type: 'cannonShot', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }]);
  deepFreeze(st.units); deepFreeze(st.structures);
  for (let i = 0; i < 90; i++) fx.update(st, MAP, i ? [] : evs, 1 / 60, { getDef });
  assert.equal(JSON.stringify({ u: [...st.units.values()], s: [...st.structures.values()] }), before);
});

test('deterministic: the same frames give the same effects (no Math.random)', () => {
  const snap = () => {
    const fx = createCombatFx({ seed: 7 });
    const st = world({ units: [tank({ targetId: BASE_TARGET_ID })], structures: [tower()] });
    run(fx, st, 1.3);
    return JSON.stringify([fx.shots, fx.flashes]);
  };
  const realRandom = Math.random;
  Math.random = () => { throw new Error('Math.random used'); };
  try { assert.equal(snap(), snap()); } finally { Math.random = realRandom; }
});

test('effect caps hold, and a restart (sim clock back) clears everything', () => {
  const fx = createCombatFx({ caps: { maxShots: 3, maxFlashes: 4 } });
  const st = world({ structures: [tower({ targetId: BASE_TARGET_ID }), tower({ id: 101, targetId: BASE_TARGET_ID, pos: { x: 2, y: 2 } })] });
  const evs = Array.from({ length: 20 }, (_, i) => ({ type: 'kill', pos: { x: i, y: 0 } }));
  fx.update(st, MAP, evs, 0, { getDef });
  run(fx, st, 0.3);
  assert.ok(fx.shots.length <= 3 && fx.flashes.length <= 4);
  fx.setCaps({ maxFlashes: 0 });
  st.time = 0;
  fx.update(st, MAP, evs, 0, { getDef });
  assert.equal(fx.flashes.length, 0);
  assert.equal(fx.shots.length, 2, 'cleared, then both towers fire again');
});

test('pooled: steady-state flight reuses records', () => {
  const fx = createCombatFx();
  const st = world({ units: [tank({ targetId: BASE_TARGET_ID })] });
  run(fx, st, 3);
  const seen = new Set();
  run(fx, st, 0.01);
  for (const s of fx.shots) seen.add(s);
  const before = seen.size;
  for (let i = 0; i < 300; i++) { fx.update(st, MAP, [], 1 / 60, { getDef }); for (const s of fx.shots) seen.add(s); st.time += 1 / 60; }
  assert.ok(seen.size <= before + 2, `allocated ${seen.size - before} new shot records over 5 s`);
});

test('the glow texture: bright centre, empty rim, symmetric', () => {
  const px = glowPixels(GLOW_SIZE);
  assert.equal(px.length, GLOW_SIZE * GLOW_SIZE * 4);
  const a = (x, y) => px[(y * GLOW_SIZE + x) * 4 + 3];
  assert.ok(a(32, 32) > 230);
  assert.equal(a(0, 0), 0);
  assert.ok(a(0, 32) < 5, 'edge texel ~0 so a clamped lookup fades out');
  assert.equal(a(10, 20), a(GLOW_SIZE - 1 - 10, 20));
  assert.equal(glowAlpha(1), 0);
  assert.ok(Math.abs(glowAlpha(0.4) - 0.4) < 1e-12);
});

test('the view: ONE instanced mesh, additive, no depth write; sync fills shots then flashes', () => {
  const scene = new THREE.Scene();
  const view = createCombatFxView(THREE, scene, 8);
  assert.equal(scene.children.length, 1);
  assert.equal(view.mesh.material.blending, THREE.AdditiveBlending);
  assert.equal(view.mesh.material.depthWrite, false);
  const model = {
    shots: [{ x: 1, y: 2, z: 3, dx: 1, dy: 0, dz: 0, size: 0.2, len: 0.5, color: 0xff0000 }],
    flashes: [{ x: 4, y: 5, z: 6, size: 1, color: 0x00ff00, alpha: 0.5 }],
  };
  assert.equal(view.sync(model), 2);
  const g = view.mesh.geometry;
  assert.equal(g.instanceCount, 2);
  assert.deepEqual([...g.getAttribute('iPos').array.slice(0, 6)], [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...g.getAttribute('iSize').array.slice(0, 4)].map((v) => +v.toFixed(3)), [0.2, 0.5, 1, 0]);
  assert.deepEqual([...g.getAttribute('iColor').array.slice(4, 8)], [0, 1, 0, 0.5]);
  // over capacity: clipped, never overflows the buffers
  model.flashes = Array.from({ length: 20 }, () => model.flashes[0]);
  assert.equal(view.sync(model), 8);
  model.shots = []; model.flashes = [];
  assert.equal(view.sync(model), 0);
  assert.equal(view.mesh.visible, false);
  view.dispose();
  assert.equal(scene.children.length, 0);
});

test('AA missiles never orbit: a fast crossing plane is caught (or the fuse fires) inside maxT [MM-task_mvd2ln2i_h]', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const fx = createCombatFx({ seed });
    const jet = { id: 7, unitId: 'jet', domain: 'Flyer', altitude: 1, hp: 50, pos: { x: 7, y: 1 } };
    const st = world({ units: [jet], structures: [tower({ kind: 'antiAir', targetId: 7 })] });
    fx.update(st, MAP, [], 0, { getDef, trail: () => {} });
    st.structures.get(100).targetId = null;
    const born = fx.launched;
    let t = 0;
    while (fx.shots.some((q) => q.kind === 'missile') && t < 4) {
      jet.pos.y += 4 / 60; jet.pos.x += 1.5 / 60;   // crossing fast
      fx.update(st, MAP, [], 1 / 60, { getDef, trail: () => {} }); t += 1 / 60;
    }
    assert.ok(born >= 1 && t <= FLIGHT.maxT + 0.3, `seed ${seed}: missile alive ${t.toFixed(2)} s`);
  }
});
