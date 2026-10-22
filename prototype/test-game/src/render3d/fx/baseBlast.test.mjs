// src/render3d/fx/baseBlast.test.mjs — the base explodes and burns for 5 s [MM-task_mvjng96y_b]. node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BLAST, blastScript, createBaseBlast } from './baseBlast.js';
import { K } from './impacts.js';

function fakeFx() {
  const log = { booms: [], ground: [], emits: [] };
  return { log, boom: (x, z, k, flash) => log.booms.push({ x, z, k, flash }), groundFire: (x, z, r, secs) => log.ground.push({ x, z, r, secs }),
    emit: (kind, x, y, z) => log.emits.push({ kind, x, y, z }) };
}
function run(blast, fx, secs, dt = 1 / 60) { const out = []; for (let t = 0; t < secs; t += dt) out.push({ t, emits: (blast.step(dt, fx), fx.log.emits.length) }); return out; }

test('the script: one big blast first, a chain round the hull, cook-offs, fires that all end at 5 s', () => {
  const s = blastScript(7);
  assert.equal(s[0].kind, 'boom'); assert.equal(s[0].at, 0); assert.equal(s[0].k, BLAST.main); assert.ok(s[0].flash);
  const booms = s.filter((e) => e.kind === 'boom');
  assert.ok(booms.length >= 8, `${booms.length} blasts`);
  assert.ok(booms.some((e) => e.at > 2), 'cook-offs later on');
  for (const e of s) if (e.secs) assert.ok(Math.abs(e.at + e.secs - BLAST.life) < 1e-9, 'every fire burns out at 5 s');
  for (const e of s) assert.ok(Math.hypot(e.dx, e.dz) <= BLAST.spread * 1.3, 'stays on the base');
  assert.deepEqual(blastScript(7), s, 'deterministic');
});

test('it explodes, burns ON the hull for 5 s, then goes quiet', () => {
  const fx = fakeFx();
  const b = createBaseBlast({ x: 20.5, z: 30.5, seed: 3, topAt: () => 1.4 });
  b.step(0, fx);
  assert.equal(fx.log.booms.length, 1, 'main blast at once'); assert.equal(fx.log.booms[0].x, 20.5);
  run(b, fx, 1.5);
  assert.ok(fx.log.booms.length >= 7); assert.equal(fx.log.ground.length, 1);
  const fire = fx.log.emits.filter((e) => e.kind === K.FIRE);
  assert.ok(fire.length > 100, `${fire.length} flames`);
  assert.ok(fire.filter((e) => e.y >= 1.4).length / fire.length > 0.9, 'the flames sit on the hull, not under it');
  assert.ok(fx.log.emits.some((e) => e.kind === K.SMOKE) && fx.log.emits.some((e) => e.kind === K.EMBER));
  assert.ok(b.char === 1 && !b.done);
  const mid = fx.log.emits.length; run(b, fx, 1);
  assert.ok(fx.log.emits.length > mid, 'still burning at 2.5 s');
  run(b, fx, BLAST.life - 2.5 + 0.05);
  assert.ok(b.done); assert.equal(b.fires, 0, 'burnt out at 5 s');
  const after = fx.log.emits.length; run(b, fx, 1);
  assert.equal(fx.log.emits.length, after, 'nothing more after');
});

test('without a hull (flat base) the fires burn on the ground', () => {
  const fx = fakeFx();
  const b = createBaseBlast({ x: 5, z: 5, seed: 1 });
  run(b, fx, 1);
  assert.ok(fx.log.emits.filter((e) => e.kind === K.FIRE).every((e) => e.y < 1));
  assert.ok(b.char > 0.7 && b.char <= 1);
});
