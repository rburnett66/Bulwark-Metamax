// src/killcam/killCam.test.mjs — the Kill Camera replays the real end of the battle [MM-task_mvjng7sh_a]. node --test.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCampaignMap, resolveResourceTypes } from '../sim/mapgen.js';
import { buildCampaignWaves } from '../sim/campaign.js';
import { createSim, stepSim, applyCommand, FIXED_DT } from '../sim/core.js';
import { hashState } from '../sim/replay.js';
import { KILLCAM, snapshotSim, createKillCamRecorder, createKillCamPlayer, killCamFocus } from './killCam.js';

const SIM = { stepSim, applyCommand, FIXED_DT };

/** A live battle the base loses (a weak base, waves started back to back), recorded as main.js does. */
function liveDefeat(seed = 5) {
  const map = buildCampaignMap(1, { seed: 0 });
  resolveResourceTypes(map, 1);
  const sim = createSim(seed, { map, waves: buildCampaignWaves(map, null), carry: null });
  sim.base.hp = sim.base.maxHp = 150;
  const rec = createKillCamRecorder({ fixedDt: FIXED_DT });
  const submit = (cmd) => { const r = applyCommand(sim, cmd); if (r.ok) rec.command(sim.tick, cmd); return r; };
  rec.after(sim, null);
  let killEv = null;
  const mapBefore = JSON.stringify(map);
  for (let t = 0; t < 40000 && !sim.result; t++) {
    if (sim.bonuses && sim.bonuses.offer && sim.bonuses.offer.length) submit({ type: 'chooseBonus', bonusId: sim.bonuses.offer[0] });
    if (!sim.waves.active) submit({ type: 'startWave' });
    const evs = stepSim(sim, FIXED_DT);
    for (const e of evs) if (e.type === 'damage' && e.targetKind === 'base' && e.killed) killEv = e;
    rec.after(sim, evs);
  }
  return { sim, rec, killEv, mapBefore, map };
}

test('a snapshot steps exactly like the original (rng carried, board shared)', () => {
  const map = buildCampaignMap(2, { seed: 0 });
  resolveResourceTypes(map, 1);
  const a = createSim(77, { map, waves: buildCampaignWaves(map, null), carry: null });
  applyCommand(a, { type: 'startWave' });
  for (let t = 0; t < 600; t++) stepSim(a, FIXED_DT);
  const b = snapshotSim(a);
  assert.notEqual(b.units, a.units); assert.equal(b.map, a.map);
  for (let t = 0; t < 900; t++) { stepSim(a, FIXED_DT); stepSim(b, FIXED_DT); }
  assert.equal(hashState(b), hashState(a));
});

test('the live battle is recorded: a killer, and snapshots covering the last window', () => {
  const { sim, rec, killEv } = liveDefeat();
  assert.equal(sim.result, 'lose');
  assert.ok(killEv && killEv.sourceId != null, 'the killing blow names its attacker');
  assert.equal(rec.killerId, killEv.sourceId);
  const span = sim.tick - rec.snapshots[0];
  assert.ok(span >= Math.round(KILLCAM.window / FIXED_DT), `snapshots reach back ${span} ticks`);
  assert.ok(span <= Math.round((KILLCAM.keep + KILLCAM.snapEvery) / FIXED_DT) + 1, 'and no further than kept');
});

test('the replay re-runs the last 10 s and the base falls on the same tick, to the same killer, in the same state', () => {
  const { sim, rec, killEv, mapBefore, map } = liveDefeat();
  const plan = rec.plan(sim);
  assert.ok(plan);
  const back = (plan.endTick - plan.start.tick) * FIXED_DT;
  assert.ok(back >= KILLCAM.window && back < KILLCAM.window + KILLCAM.snapEvery + 1e-9, `rewinds ${back.toFixed(2)} s`);
  assert.equal(plan.killerId, killEv.sourceId);
  assert.deepEqual(plan.base, { x: map.base.x, y: map.base.y });

  const p = createKillCamPlayer(plan, SIM);
  let fell = null, sawKill = false, firedByKiller = 0;
  for (let i = 0; i < 5000 && p.phase === 'replay'; i++) {
    const f = p.step(1 / 60);
    for (const e of f.events) {
      if (e.type === 'damage' && e.targetKind === 'base' && e.killed) sawKill = e.sourceId === plan.killerId;
      if (e.type === 'damage' && e.sourceId === plan.killerId) firedByKiller++;
    }
    if (f.justFell) fell = p.sim.tick;
  }
  assert.equal(fell, sim.tick, 'falls on the live tick');
  assert.ok(sawKill, 'the same unit lands the killing blow');
  assert.ok(firedByKiller >= 1, 'the killer is seen firing');
  assert.equal(hashState(p.sim), hashState(sim), 'and ends in the live final state');
  assert.equal(JSON.stringify(map), mapBefore, 'the shared board is never written');
});

test('after the fall the base burns for 5 s, then the kill cam is done; skip ends it at once', () => {
  const { sim, rec } = liveDefeat();
  const plan = rec.plan(sim);
  const p = createKillCamPlayer(plan, SIM);
  let t = 0, burnStart = null;
  while (p.phase !== 'done' && t < 60) {
    const f = p.step(0.05); t += 0.05;
    if (f.phase === 'burn' && burnStart === null) burnStart = t;
  }
  assert.ok(burnStart !== null && Math.abs(t - burnStart - KILLCAM.burn) < 0.11, `burned ${(t - burnStart).toFixed(2)} s`);
  assert.ok(t >= KILLCAM.window - 0.1, 'replay played in real time');
  const q = createKillCamPlayer(rec.plan(sim), SIM);
  q.step(0.1); q.skip();
  assert.equal(q.phase, 'done');
});

test('plan() is null unless the battle was lost; plans are independent copies', () => {
  const { sim, rec } = liveDefeat();
  const a = rec.plan(sim), b = rec.plan(sim);
  assert.notEqual(a.start, b.start);
  createKillCamPlayer(a, SIM).step(3);
  assert.equal(hashState(b.start), hashState(rec.plan(sim).start), 'playing one plan leaves the others untouched');
  const won = { ...sim, result: 'win' };
  assert.equal(rec.plan(won), null);
  const empty = createKillCamRecorder({ fixedDt: FIXED_DT });
  assert.equal(empty.plan(sim), null);
});

test('the camera looks halfway between the base and the killer', () => {
  assert.deepEqual(killCamFocus({ x: 10, y: 20 }, { x: 16, y: 12 }), { x: 13, y: 16 });
  assert.deepEqual(killCamFocus({ x: 10, y: 20 }, null), { x: 10, y: 20 });
  assert.equal(killCamFocus(null, { x: 1, y: 1 }), null);
});
