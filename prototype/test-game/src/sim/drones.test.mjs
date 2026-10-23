// [MM-story_mvk7mn6z_q] — Missile Flyers are Drones: kamikaze drones dive at the base and explode once (no bounty),
// gun drones strafe from close range — and every anti-air tower out-ranges both, so nothing hovers out of reach.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../data/factions.js';
import { UNITS, STRUCTURES, DRONE, EFFECTIVENESS } from '../data/tables.js';
import { buildTerrainMap, resolveResourceTypes } from './mapgen.js';
import { createSim, stepSim, applyCommand, FIXED_DT } from './core.js';
import { createUnit } from './entities.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DRONES = Object.entries(UNITS).filter(([id]) => id.endsWith('-Missiles'));
const KAMIKAZE = new Set(['ART', 'ARC', 'DRK', 'GRN']);

function arena() {
  const map = buildTerrainMap(JSON.parse(fs.readFileSync(path.join(GAME, 'content/maps/forge/powder-map-1.json'), 'utf8')), 1, { seed: 0, bakeTune: {} });
  resolveResourceTypes(map, 1);
  map.waveWindows = []; map.rings = [];
  return createSim(1, { map, waves: [], carry: null, faction: 'Ground / Powder', mapId: 1 });
}
function spawn(sim, id, dx = -8) {
  const b = sim.base.pos, u = createUnit(sim, id, 1, { x: b.x + dx, y: b.y }, 'air', 'attacker');
  sim.units.set(u.id, u); return u;
}
function run(sim, secs, onEv) { for (let t = 0; t < secs / FIXED_DT; t++) for (const e of stepSim(sim, FIXED_DT)) onEv && onEv(e); }

test('all nine Missile Flyers are Drones: four kamikaze, five gun drones; every anti-air tower out-ranges them', () => {
  assert.equal(DRONES.length, 9);
  const aa = Object.values(STRUCTURES).filter((d) => (d.canTargetDomains || []).includes('Flyer')).map((d) => d.range);
  assert.ok(aa.length >= 3);
  for (const [id, u] of DRONES) {
    assert.equal(u.shape, 'Drone', id); assert.equal(u.domain, 'Flyer');
    const kami = KAMIKAZE.has(id.split('-')[0]);
    assert.equal(!!u.detonate, kami, `${id} kamikaze?`);
    assert.equal(u.role, kami ? 'Kamikaze Drone' : 'MG Drone');
    for (const r of aa) assert.ok(u.range < r, `${id} range ${u.range} < tower ${r}`);
    assert.ok(u.speed > 2, `${id} is fast`);
    if (kami) { assert.equal(u.projectileFx, null); assert.ok(u.detonate.burst[0] > 300 && u.detonate.burst.length === 3); }
    else assert.equal(u.projectileFx, 'tracer');
  }
  assert.equal(DRONE.kamikaze.damageType, 'Concussion');
});

test('a kamikaze drone flies in, explodes ONCE on the base and is gone — no bounty for a drone that blew itself up', () => {
  const sim = arena(), u = spawn(sim, 'DRK-Missiles');
  const hp0 = sim.base.hp, money0 = sim.economy.money, evs = [];
  run(sim, 12, (e) => evs.push(e));
  const det = evs.filter((e) => e.type === 'detonate');
  assert.equal(det.length, 1, 'one explosion');
  assert.ok(!sim.units.has(u.id), 'the drone is gone');
  const hits = evs.filter((e) => e.type === 'damage' && e.targetKind === 'base' && e.sourceId === u.id);
  const burst = UNITS['DRK-Missiles'].detonate.burst[0] * EFFECTIVENESS.Concussion.Structure;
  assert.equal(hits.length, 1, 'one hit on the base, no continuous fire');
  assert.ok(Math.abs(hits[0].amount - burst) < 1e-6, `base took ${hits[0].amount} (burst ${burst})`);
  assert.ok(sim.base.hp < hp0);
  const kill = evs.find((e) => e.type === 'kill' && e.entityId === u.id);
  assert.ok(kill && kill.detonated && kill.income === 0, 'kill event: detonated, no income');
  assert.ok(sim.economy.money <= money0 + 1e-9);
  // Dark Energy's own weapon (Poison) can't hurt structures — the explosion can
  assert.equal(EFFECTIVENESS[UNITS['DRK-Missiles'].damageType].Structure, 0);
});

test('shot down before it gets there, a kamikaze drone pays its bounty and never explodes', () => {
  const sim = arena();
  sim.economy.money = 1e6;
  const b = sim.base.pos;
  for (const c of [{ x: b.x - 3, y: b.y - 1 }, { x: b.x - 3, y: b.y + 1 }, { x: b.x - 4, y: b.y }]) applyCommand(sim, { type: 'place', structId: 'STR-Flak', cell: c });
  run(sim, 4);   // towers finish building
  const u = spawn(sim, 'GRN-Missiles', -12), evs = [];
  run(sim, 10, (e) => evs.push(e));
  const kill = evs.find((e) => e.type === 'kill' && e.entityId === u.id);
  assert.ok(kill, 'it died');
  assert.equal(evs.filter((e) => e.type === 'detonate').length, 0, 'it never reached the base');
  assert.ok(kill.income > 0 && !kill.detonated, 'shot down → bounty');
});

test('a gun drone strafes the base from close range and keeps firing', () => {
  const sim = arena(), u = spawn(sim, 'GND-Missiles');
  const hp0 = sim.base.hp; let firstHitAt = null;
  run(sim, 15, (e) => { if (e.type === 'damage' && e.targetKind === 'base' && firstHitAt === null) firstHitAt = Math.hypot(u.pos.x - sim.base.pos.x, u.pos.y - sim.base.pos.y); });
  assert.ok(sim.units.has(u.id) && u.hp > 0, 'still flying');
  assert.ok(hp0 - sim.base.hp > 200, `base took ${(hp0 - sim.base.hp).toFixed(0)}`);
  assert.ok(firstHitAt !== null && firstHitAt <= DRONE.gun.range + 2, `fired from ${firstHitAt && firstHitAt.toFixed(1)} cells`);
});
