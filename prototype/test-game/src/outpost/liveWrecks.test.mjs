// Outpost wrecks in the live state [MM-story_mwcrfnyf_3c]: a defense a visit raid destroys becomes a WRECK in the save
// (0 HP) the tick it dies — never lost between two reads — and every wreck (from before the visit or new) is an inert
// 'Wrecked' structure the renderer draws and smokes, with no say in the fight. A battle never opts in (sim unchanged).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { map, T0 } from './view/fixtures.mjs';
import { referenceOutpost } from './model.js';
import { toLiveSim, fromLiveSim } from './liveSim.js';
import { createVisitRaids } from './visitRaids.js';
import { stepSim, applyCommand, createSim, FIXED_DT } from '../sim/core.js';
import { createStructureFx } from '../render3d/fx/structureFx.js';
import { K } from '../render3d/fx/impacts.js';
import { SPARK_TINT } from '../render3d/fx/repairFx.js';

/** A visit raid against an online outpost whose guns are down to a few HP: runs until the first defense dies. The walls
 *  are wrecks already, so the mild probe (Probe_Strength [MM-task_mwcutmnk_3h]) reaches a gun instead of chipping a wall. */
function raidKillsADefense(seed = 7) {
  const o = referenceOutpost('ground', { seed, map, now: T0 });
  o.online = true;
  for (const d of o.defenses) d.hp = d.kind === 'wall' ? 0 : 3;
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 1000 });
  const raids = createVisitRaids(state, { planet: 'ground', seed: o.seed });
  let dead = null;
  for (let i = 0; i < Math.round(900 / FIXED_DT) && !dead; i++) {
    const ev = stepSim(state, FIXED_DT);
    raids.step();
    for (const e of ev || []) if (e.type === 'build' && e.phase === 'destroyed') dead = e;
  }
  return { o, state, link, dead };
}

test('a defense a visit raid destroys is a wreck in the save at 0 HP — read the very tick it died, and later', () => {
  const { o, state, link, dead } = raidKillsADefense();
  assert.ok(dead, 'the raid destroyed a defense');
  const s = state.structures.get(dead.id);
  assert.ok(s, 'still in the live state after its destroy tick (the sim kept it)');
  assert.equal(s.lifecycle, 'Wrecked');
  assert.equal(s.hp, 0);
  const id = link.ids.get(dead.id).defense;
  const now = fromLiveSim(state, link, T0 + Math.round(state.time * 1000)).outpost;
  assert.equal(now.defenses.find((d) => d.id === id).hp, 0, 'the save has it as a wreck at once');
  for (let i = 0; i < Math.round(5 / FIXED_DT); i++) stepSim(state, FIXED_DT);
  const later = fromLiveSim(state, link, T0 + Math.round(state.time * 1000)).outpost;
  const w = later.defenses.find((d) => d.id === id);
  assert.ok(w && w.hp === 0, 'and still a wreck seconds later, never vanished');
  assert.equal(later.defenses.length, o.defenses.length, 'no defense lost');
});

test('the same raid on the same seed wrecks the same defense on the same tick (deterministic)', () => {
  const a = raidKillsADefense(7), b = raidKillsADefense(7);
  assert.deepEqual([a.dead.id, a.dead.tick], [b.dead.id, b.dead.tick]);
});

/** An outpost with one gun wrecked before the visit. */
function withWreck() {
  const o = referenceOutpost('ground', { seed: 7, map, now: T0 });
  const gun = o.defenses.find((d) => d.kind === 'cannon' || d.kind === 'mg');
  gun.hp = 0;
  const { state, link } = toLiveSim(o, { map, now: T0, gold: 100000 });
  const s = [...state.structures.values()].find((x) => link.ids.get(x.id) && link.ids.get(x.id).defense === gun.id);
  return { o, gun, state, link, s };
}

test('a wreck from before the visit is a Wrecked structure at 0 HP, and the save round-trips unchanged', () => {
  const { o, gun, state, link, s } = withWreck();
  assert.ok(s && s.lifecycle === 'Wrecked' && s.hp === 0);
  assert.deepEqual(JSON.parse(JSON.stringify(fromLiveSim(state, link, T0).outpost.defenses)), JSON.parse(JSON.stringify(o.defenses)));
  assert.equal(fromLiveSim(state, link, T0).outpost.defenses.find((d) => d.id === gun.id).hp, 0);
});

test('a wreck has no say in the fight: walked past, never targeted, never fires, cannot be sold / upgraded in the sim (a repair bot rebuilds it: repairBot.test.mjs)', () => {
  const { state, s } = withWreck();
  const cols = state.navGrid.cols;
  assert.equal(state.navGrid.passable[s.pos.y * cols + s.pos.x], 1, 'its cell is open to walkers');
  for (const type of ['sell', 'upgrade']) assert.equal(applyCommand(state, { type, id: s.id }).ok, false, type);
  assert.equal(s.dps > 0 && s.lifecycle !== 'Wrecked', false);
});

test('raiders walk past a wreck: after a raid wrecks a gun, nothing targets or damages it and it never fires again', () => {
  const { state, dead } = raidKillsADefense();
  const hits = [];
  for (let i = 0; i < Math.round(60 / FIXED_DT); i++) {
    for (const e of stepSim(state, FIXED_DT) || []) if (e.sourceId === dead.id || e.targetId === dead.id) hits.push(e.type);
  }
  for (const u of state.units.values()) assert.notEqual(u.targetId, dead.id, 'no unit targets the wreck');
  assert.deepEqual(hits, [], 'no shots from or at the wreck');
  assert.equal(state.structures.get(dead.id).lifecycle, 'Wrecked');
});

test('the shared structure FX smokes and sparks a wreck in the live state (render3d/fx/structureFx.js)', () => {
  const { state } = withWreck();
  const fx = createStructureFx({ seed: 2 });
  let red = 0, smoke = 0;
  for (let i = 0; i < 30; i++) fx.step(1 / 30, state, (kind, x, y, z, vx, vy, vz, life, size, grow, shade) => {
    if (kind === K.SPARK && shade === SPARK_TINT.damage) red++; if (kind === K.SMOKE) smoke++;
  }, K);
  assert.ok(red > 0 && smoke > 0, `${red} red sparks, ${smoke} smoke`);
});

test('a battle never opts in: a destroyed battle structure is removed as before', () => {
  const state = createSim(7, {});
  assert.equal(state.keepWreck, undefined);
  let r = { ok: false };
  for (let d = 3; d < 12 && !r.ok; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d], [d, d]]) {
    if (r.ok) break;
    r = applyCommand(state, { type: 'place', structId: 'STR-Wall', cell: { x: state.map.base.x + dx, y: state.map.base.y + dy } });
  }
  assert.ok(r.ok, 'a wall was placed');
  const s = [...state.structures.values()].pop();
  s.hp = 0; s.lifecycle = 'Destroyed';
  stepSim(state, FIXED_DT);
  assert.equal(state.structures.has(s.id), false);
});
