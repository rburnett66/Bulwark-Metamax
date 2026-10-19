// [MM-story_mveehs1r_f] hidden contacts: enemies outside the play area are identical red reticles — no model, bar,
// dust or muzzle fx — and cross back in by fading the reticle while the model grows in. Plus the minimap.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { createContacts, createContactsView, CONTACT } from './contacts.js';
import { planBars } from './healthBars.js';
import { createCombatFx } from '../fx/combatFxModel.js';
import { minimapDotColor } from '../../render/hud.js';

const RECT = { x0: 10, y0: 4, x1: 30, y1: 20 };
const unit = (o) => ({ id: 1, side: 'attacker', hp: 10, maxHp: 10, pos: { x: 15, y: 10 }, domain: 'Ground', ...o });
const world = (...units) => ({ time: 0, units: new Map(units.map((u) => [u.id, u])), structures: new Map(), base: { pos: { x: 20, y: 12 } } });
const viewOf = (u) => ({ id: u.id, model: u.domain === 'Flyer' ? 'jet' : 'tank', scale: 1, x: u.pos.x + 0.5, y: u.domain === 'Flyer' ? 1.1 : 0, z: u.pos.y + 0.5, heading: 0, aim: 0 });

test('an enemy outside the play area is a reticle with no model; inside it is drawn normally', () => {
  const c = createContacts();
  const out = unit({ id: 1, pos: { x: 3, y: 10 } }), inn = unit({ id: 2, pos: { x: 15, y: 10 } });
  const st = world(out, inn);
  const r = c.update(st, [viewOf(out), viewOf(inn)], RECT, 1 / 60);
  assert.deepEqual([...r.hidden], [1]);
  assert.deepEqual(r.views.map((v) => v.id), [2]);
  assert.equal(r.reticles.length, 1);
  assert.equal(r.reticles[0].x, 3.5); assert.equal(r.reticles[0].z, 10.5);
  assert.equal(r.reticles[0].alpha, 1);
});

test('flyer and walker reticles are identical: no altitude, size or type leaks', () => {
  const c = createContacts();
  const tank = unit({ id: 1, pos: { x: 2, y: 2 } }), jet = unit({ id: 2, pos: { x: 2, y: 2 }, domain: 'Flyer', altitude: 1 });
  const r = c.update(world(tank, jet), [viewOf(tank), viewOf(jet)], RECT, 1 / 60);
  const [a, b] = r.reticles;
  assert.equal(a.x, b.x); assert.equal(a.z, b.z); assert.equal(a.alpha, b.alpha);
  assert.deepEqual(Object.keys(a).sort(), ['alpha', 'id', 'phase', 'x', 'z']);
  assert.equal(r.views.length, 0);
});

test('player units are never hidden; no fog window hides nothing', () => {
  const c = createContacts();
  const mine = unit({ id: 3, side: 'defender', pos: { x: 1, y: 1 } }), foe = unit({ id: 4, pos: { x: 1, y: 1 } });
  const st = world(mine, foe);
  let r = c.update(st, [viewOf(mine), viewOf(foe)], RECT, 1 / 60);
  assert.deepEqual(r.views.map((v) => v.id), [3]);
  const c2 = createContacts();
  r = c2.update(st, [viewOf(mine), viewOf(foe)], null, 1 / 60);
  assert.equal(r.hidden.size, 0); assert.equal(r.reticles.length, 0); assert.equal(r.views.length, 2);
});

test('crossing into the play area: the reticle fades out while the model grows in', () => {
  const c = createContacts();
  const u = unit({ id: 5, pos: { x: 8, y: 10 } });
  const st = world(u);
  c.update(st, [viewOf(u)], RECT, 1 / 60);
  u.pos = { x: 11, y: 10 };   // now inside
  let r = c.update(st, [viewOf(u)], RECT, 0.05);
  assert.equal(r.hidden.size, 0);
  assert.equal(r.views.length, 1);
  assert.ok(r.views[0].scale < 1 && r.views[0].scale >= CONTACT.minScale, `growing in (${r.views[0].scale})`);
  assert.ok(r.reticles[0].alpha < 1 && r.reticles[0].alpha > 0, 'reticle fading');
  for (let t = 0; t < 0.4; t += 0.05) r = c.update(st, [viewOf(u)], RECT, 0.05);
  assert.equal(r.views[0].scale, 1);
  assert.equal(r.reticles.length, 0);
});

test('hidden contacts get no health bar and fire no drawn shots', () => {
  const c = createContacts();
  const u = unit({ id: 6, pos: { x: 2, y: 10 }, hp: 4, targetId: 99, unitId: 'tank' });
  const st = world(u);
  const r = c.update(st, [viewOf(u)], RECT, 1 / 60);
  const mem = new Map();
  planBars(st, [viewOf(u)], mem, 0.016);   // first sight at full hp …
  u.hp = 2;
  assert.ok(planBars(st, [viewOf(u)], mem, 0.2).length > 0, 'a hit unit normally shows a bar');
  assert.equal(planBars(st, r.views, new Map(), 0.2).length, 0, 'hidden: no bar');
  st.units.set(99, unit({ id: 99, side: 'defender', pos: { x: 3, y: 10 } }));
  const fx = createCombatFx(), opts = { getDef: () => ({ projectileFx: 'shell' }), hidden: r.hidden };
  for (let i = 0; i < 60; i++) { fx.update(st, { cols: 40, rows: 24 }, [], 1 / 60, opts); st.time += 1 / 60; }
  assert.equal(fx.launched, 0);
  const fx2 = createCombatFx();
  for (let i = 0; i < 60; i++) { fx2.update(st, { cols: 40, rows: 24 }, [], 1 / 60, { getDef: opts.getDef }); st.time += 1 / 60; }
  assert.ok(fx2.launched > 0, 'the same unit, not hidden, does fire');
});

test('the view: one instanced draw over the fog, hidden when empty', () => {
  const scene = new THREE.Scene();
  const v = createContactsView(THREE, scene);
  assert.equal(scene.children.length, 1);
  assert.equal(v.mesh.renderOrder, 9, 'over the fog (8), under the placement ghost (10)');
  assert.equal(v.mesh.material.depthTest, false);
  assert.equal(v.mesh.material.side, THREE.DoubleSide, 'the flat quad is seen from above: both faces (a FrontSide quad was culled — caught headless)');
  assert.equal(v.sync([], 0), 0); assert.equal(v.mesh.visible, false);
  assert.equal(v.sync([{ id: 1, x: 2, z: 3, alpha: 1, phase: 0 }, { id: 2, x: 4, z: 5, alpha: 0.5, phase: 1 }], 1.2), 2);
  assert.equal(v.mesh.geometry.instanceCount, 2); assert.equal(v.mesh.visible, true);
  v.dispose(); assert.equal(scene.children.length, 0);
});

test('minimap: flyers white inside the play area, every contact red outside it', () => {
  const jet = { domain: 'Flyer', pos: { x: 15, y: 10 } }, tank = { domain: 'Ground', pos: { x: 15, y: 10 } };
  assert.equal(minimapDotColor(jet, RECT), '#ffffff');
  assert.equal(minimapDotColor(tank, RECT), '#ff4040');
  assert.equal(minimapDotColor({ ...jet, pos: { x: 2, y: 2 } }, RECT), '#ff4040', 'outside: type hidden');
  assert.equal(minimapDotColor(jet, null), '#ffffff', 'no fog window: as before');
});

test('a plane is judged where it is DRAWN: out over the clouds → a reticle there; its sim cell inside does not save it [MM-task_mvfnb9jd_e]', async () => {
  const { createContacts } = await import('./contacts.js');
  const c = createContacts();
  const rect = { x0: 10, y0: 10, x1: 20, y1: 20 };
  const st = { units: new Map([[1, { id: 1, side: 'attacker', hp: 5, pos: { x: 15, y: 15 } }], [2, { id: 2, side: 'attacker', hp: 5, pos: { x: 15, y: 15 } }]]) };
  const views = [{ id: 1, x: 15.5, y: 3, z: 15.5 }, { id: 2, x: 15.5, y: 0, z: 15.5 }];
  const drawn = new Map([[1, { x: 15.5, y: 3, z: 5.5 }], [2, { x: 15.5, y: 0.3, z: 5.5, ground: true }]]);   // plane 1 flies out north; 2 is a ground unit
  const out = c.update(st, views, rect, 0.016, drawn);
  assert.ok(out.hidden.has(1), 'the plane over the clouds is a contact');
  assert.ok(!out.hidden.has(2), 'a ground unit is still judged by its cell');
  const r1 = out.reticles.find((r) => r.id === 1);
  assert.ok(r1 && Math.abs(r1.z - 5.5) < 1e-9, 'its reticle is where it flies');
  assert.equal(out.views.find((v) => v.id === 1), undefined, 'no model');
});
