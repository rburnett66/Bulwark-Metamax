// [MM-story_mvee9r08_e] attack runs: strafing planes fly a continuous racetrack over their target (render-only);
// copters and drones keep hovering; shots are drawn only on the inbound run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightPaths, loopPose, FLIGHT_RUN } from './flightPath.js';
import { HOVER_HEIGHT } from './unitViews.js';
import { BASE_TARGET_ID } from '../../sim/combat.js';
import { UNITS } from '../../data/tables.js';

const DEFS = { plane: { attackPattern: 'strafe', speed: 1.84 }, copter: { speed: 1.84 }, drone: { speed: 0.74 } };
const lookup = (id) => DEFS[id];
const world = (...units) => ({ base: { pos: { x: 20, y: 12 } }, units: new Map(units.map((u) => [u.id, u])), structures: new Map() });
const flyer = (o) => ({ id: 1, unitId: 'plane', hp: 10, altitude: 1, domain: 'Flyer', state: 'attacking', targetId: BASE_TARGET_ID, pos: { x: 14, y: 12 }, ...o });
const viewOf = (u) => ({ id: u.id, model: 'jet', scale: 1, x: u.pos.x + 0.5, y: HOVER_HEIGHT, z: u.pos.y + 0.5, heading: 0, aim: 0 });

function fly(units, secs, dt = 1 / 30) {
  const fp = createFlightPaths({ lookup });
  const st = world(...units);
  const frames = [];
  for (let t = 0; t < secs; t += dt) {
    const views = units.map(viewOf);
    fp.update(st, null, views, dt);
    frames.push({ views, poses: new Map(fp.poses) });
  }
  return frames;
}

test('the data: every faction plane and the heavy bomber strafe; copters and missile drones do not', () => {
  for (const [id, d] of Object.entries(UNITS)) {
    if (d.artClass === 'plane' || d.artClass === 'heavyBomber') assert.equal(d.attackPattern, 'strafe', id);
    if (d.artClass === 'copter' || d.artClass === 'missile') assert.equal(d.attackPattern, undefined, id);
  }
});

test('an attacking plane is never stationary — it keeps flying the loop', () => {
  const frames = fly([flyer()], 12);
  let still = 0;
  for (let i = 40; i < frames.length; i++) {
    const a = frames[i - 1].views[0], b = frames[i].views[0];
    if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-3) still++;
  }
  assert.equal(still, 0);
});

test('the loop is continuous (no jumps, incl. the blend-in) and stays near the target', () => {
  const frames = fly([flyer()], 15);
  const T = { x: 20.5, z: 12.5 }, R = FLIGHT_RUN.halfLength + 2 * FLIGHT_RUN.radius + 0.5;
  const maxStep = (Math.max(FLIGHT_RUN.minSpeed, 1.84 * FLIGHT_RUN.speedK) / 30) * 1.6;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1].views[0], b = frames[i].views[0];
    assert.ok(Math.hypot(b.x - a.x, b.z - a.z) <= maxStep + 0.02, `jump at frame ${i}`);
    if (i > 40) assert.ok(Math.hypot(b.x - T.x, b.z - T.z) <= R, 'bounded around the target');
  }
});

test('it overflies the target, banks into the turns and climbs over them', () => {
  const frames = fly([flyer()], 15).slice(40);
  const T = { x: 20.5, z: 12.5 };
  assert.ok(frames.some((f) => Math.hypot(f.views[0].x - T.x, f.views[0].z - T.z) < 0.3), 'passes over the target');
  assert.ok(frames.some((f) => f.views[0].bank > 0.5), 'banks');
  assert.ok(frames.some((f) => f.views[0].y > HOVER_HEIGHT + 0.4), 'climbs in the turn');
});

test('shots only on the inbound run: inbound is on the approach, never in the turns or the overfly', () => {
  const L = FLIGHT_RUN.halfLength, rho = FLIGHT_RUN.radius;
  const total = 4 * L + 2 * Math.PI * rho;
  let inbound = 0;
  for (let s = 0; s < total; s += 0.05) {
    const p = loopPose(0, 0, 1, 0, s);
    if (p.inbound) { inbound++; assert.ok(p.x < 0, 'approaching the target (before it)'); assert.equal(p.bank, 0); }
  }
  assert.ok(inbound > 0 && inbound * 0.05 < total * 0.3, 'a short firing window per lap');
});

test('copters and drones hover where the sim holds them; non-attacking planes fly their sim path', () => {
  const cop = flyer({ id: 2, unitId: 'copter' }), dr = flyer({ id: 3, unitId: 'drone' }), moving = flyer({ id: 4, state: 'moving' });
  const frames = fly([cop, dr, moving], 3);
  const last = frames[frames.length - 1];
  for (const [i, u] of [[0, cop], [1, dr], [2, moving]]) {
    assert.equal(last.views[i].x, u.pos.x + 0.5); assert.equal(last.views[i].z, u.pos.y + 0.5);
    assert.equal(last.poses.has(u.id), false);
  }
});

test('AA and tower aim follow the DRAWN plane; a strafing plane fires only on its inbound run', async () => {
  const { aimPoint, createCombatFx } = await import('../fx/combatFxModel.js');
  const drawn = new Map([[1, { x: 9.25, y: 1.4, z: 3.5, inbound: false }]]);
  const st = world(flyer());
  assert.deepEqual(aimPoint(st, null, 1, drawn), { x: 9.25, y: 1.4, z: 3.5 }, 'AA homes on where the plane is drawn');
  assert.deepEqual(aimPoint(st, null, 1), { x: 14.5, y: HOVER_HEIGHT, z: 12.5 }, 'without a run: the sim position');
  const shoot = (inbound) => {
    const fx = createCombatFx();
    const s = world(flyer({ targetId: BASE_TARGET_ID }));
    s.time = 0;
    const flight = new Map([[1, { x: 16, y: 1.0, z: 12.5, strafe: true, inbound }]]);
    for (let i = 0; i < 60; i++) { fx.update(s, { cols: 40, rows: 24, base: { x: 20, y: 12 } }, [], 1 / 60, { getDef: () => ({ projectileFx: 'tracer' }), flight }); s.time += 1 / 60; }
    return fx.launched;
  };
  assert.equal(shoot(false), 0, 'turning / overflying: no shots');
  assert.ok(shoot(true) > 0, 'inbound: firing');
});

// [MM-task_mvk3fn61_l] owner 2026-10-22: "when some planes do attack passes they pop location instead of circling".
// A run that is interrupted (the sim drops 'attacking' for a moment, or the plane switches target) must never jump.
function flyScripted(script, secs, dt = 1 / 30) {
  const fp = createFlightPaths({ lookup });
  const u = flyer({ id: 5 }), other = { id: 9, unitId: 'x', hp: 50, pos: { x: 26, y: 6 } };
  const st = world(u, other);
  let maxJump = 0, prev = null;
  for (let t = 0; t < secs; t += dt) {
    script(u, t);
    const v = viewOf(u);
    fp.update(st, null, [v], dt);
    if (prev) maxJump = Math.max(maxJump, Math.hypot(v.x - prev.x, v.z - prev.z));
    prev = { x: v.x, z: v.z };
  }
  return maxJump;
}
const MAX_STEP = (Math.max(FLIGHT_RUN.minSpeed, 1.84 * FLIGHT_RUN.speedK) / 30) * 1.6 + 0.02;

test('no pop when the sim drops "attacking" for a moment mid-run and picks it back up', () => {
  const j = flyScripted((u, t) => { u.state = (t > 4 && t < 4.4) || (t > 7 && t < 7.1) ? 'moving' : 'attacking'; }, 10);
  assert.ok(j <= MAX_STEP, `max frame jump ${j.toFixed(3)} cells`);
});

test('no pop when the plane switches target mid-run', () => {
  const j = flyScripted((u, t) => { u.targetId = t < 5 ? BASE_TARGET_ID : 9; }, 10);
  assert.ok(j <= MAX_STEP, `max frame jump ${j.toFixed(3)} cells`);
});

test('no pop when the attack ends for good: the plane eases back to where the sim holds it', () => {
  const j = flyScripted((u, t) => { u.state = t < 5 ? 'attacking' : 'moving'; }, 8);
  assert.ok(j <= MAX_STEP, `max frame jump ${j.toFixed(3)} cells`);
});
