/** abilityFx.test.mjs — the special-ability visual effects model and view [MM-story_mvn06y2l_8].
 *  Owner 2026-10-24: "We need very cool visual effects." Run: node --test src/render3d/fx/abilityFx.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { createAbilityFx, createAbilityFxView, SHELL, DECAL } from './abilityFx.js';

function state(extra = {}) {
  return Object.assign({ tick: 0, _abilityDt: 1 / 30, units: new Map(), structures: new Map(), enemyMines: [], puddles: [] }, extra);
}
const unit = (id, o) => Object.assign({ id, hp: 100, side: 'attacker', pos: { x: 5, y: 5 }, altitude: 0 }, o);
const frames = (fx, st, n, events = []) => { let out; for (let i = 0; i < n; i++) out = fx.update(st, i === 0 ? events : [], 1 / 30); return out; };

test('carrier auras: Shield Tank dome + ring, Shield Drone bubble, Stealth field', () => {
  const st = state();
  st.units.set(1, unit(1, { ability: 'shieldTank' }));
  st.units.set(2, unit(2, { ability: 'shieldDrone', shieldPool: 300, altitude: 1, pos: { x: 9, y: 9 } }));
  st.units.set(3, unit(3, { ability: 'stealth', pos: { x: 14, y: 4 } }));
  const o = createAbilityFx().update(st, [], 1 / 30);
  assert.ok(o.shells.some((s) => s.mode === SHELL.HEX && Math.abs(s.x - 5.5) < 1e-9 && s.r === 2.5));
  assert.ok(o.decals.some((d) => d.mode === DECAL.HEXRING));
  assert.ok(o.shells.some((s) => s.mode === SHELL.BUBBLE && Math.abs(s.x - 9.5) < 1e-9), 'the bubble sits where the sim protects');
  assert.ok(o.decals.some((d) => d.mode === DECAL.CLOAK && Math.abs(d.x - 14.5) < 1e-9));
});

test('a spent Shield Drone draws no bubble; its pop shatters', () => {
  const st = state();
  st.units.set(2, unit(2, { ability: 'shieldDrone', shieldPool: 0 }));
  const fx = createAbilityFx();
  const o = fx.update(st, [{ type: 'ability', kind: 'shieldPop', pos: { x: 5, y: 5 } }], 1 / 30);
  assert.ok(!o.shells.some((s) => s.mode === SHELL.BUBBLE && s.col[2] === 1 && s.alpha > 0.9 && s.extra === 0));
  assert.ok(fx.particles >= 40, 'shards fly');
});

test('Freeze Missile: a streak in flight, a frost nova on impact, frost crusts on the towers it caught until the freeze ends', () => {
  const st = state();
  st.structures.set(10, { id: 10, hp: 100, pos: { x: 6, y: 6 } });
  st.structures.set(11, { id: 11, hp: 100, pos: { x: 15, y: 15 } });
  const fx = createAbilityFx();
  let o = fx.update(st, [{ type: 'ability', kind: 'freezeLaunch', from: { x: 0, y: 0 }, to: { x: 6, y: 6 }, flight: 0.6 }], 1 / 30);
  assert.ok(o.sprites.length >= 2, 'the missile head glows');
  o = frames(fx, st, 30);
  st.tick = 18;
  o = fx.update(st, [{ type: 'ability', kind: 'freezeHit', pos: { x: 6, y: 6 }, radius: 2, until: 120 }], 1 / 30);
  assert.ok(o.decals.some((d) => d.mode === DECAL.NOVA));
  const crusts = o.shells.filter((s) => s.mode === SHELL.FROST);
  assert.equal(crusts.length, 1, 'only the tower inside the radius');
  st.tick = 121;
  o = fx.update(st, [], 1 / 30);
  assert.equal(o.shells.filter((s) => s.mode === SHELL.FROST).length, 0, 'thawed');
});

test('Stun Drones: a dart, then an electric crackle on the target until the stun ends', () => {
  const st = state();
  st.structures.set(10, { id: 10, hp: 100, pos: { x: 6, y: 6 } });
  const fx = createAbilityFx();
  fx.update(st, [{ type: 'ability', kind: 'stunDrone', from: { x: 1, y: 1 }, to: { x: 6, y: 6 }, flight: 0.5, targetId: 10 }], 1 / 30);
  st.tick = 15;
  let o = fx.update(st, [{ type: 'ability', kind: 'towerStunned', targetId: 10, until: 105 }], 1 / 30);
  assert.ok(o.shells.some((s) => s.mode === SHELL.ELECTRIC));
  st.tick = 106;
  o = fx.update(st, [], 1 / 30);
  assert.ok(!o.shells.some((s) => s.mode === SHELL.ELECTRIC));
});

test('mines, puddles and a raise: mine decals, a puddle, a sigil then a soul column', () => {
  const st = state({ enemyMines: [{ id: 1, pos: { x: 3, y: 3 }, armAt: 0 }], puddles: [{ pos: { x: 8, y: 8 }, radius: 1.5, until: 100 }] });
  const fx = createAbilityFx();
  let o = fx.update(st, [{ type: 'ability', kind: 'raiseStart', pos: { x: 12, y: 12 }, tick: 0 }], 1 / 30);
  assert.ok(o.decals.some((d) => d.mode === DECAL.MINE));
  assert.ok(o.decals.some((d) => d.mode === DECAL.PUDDLE && d.r === 1.5));
  assert.ok(o.decals.some((d) => d.mode === DECAL.SIGIL));
  o = fx.update(st, [{ type: 'ability', kind: 'raised', pos: { x: 12, y: 12 }, entityId: 77 }], 1 / 30);
  assert.ok(!o.decals.some((d) => d.mode === DECAL.SIGIL), 'the sigil gives way to the column');
  assert.ok(o.shells.some((s) => s.mode === SHELL.COLUMN));
});

test('unit looks: mirrors are holograms, cloaked units are ghosts, a risen unit glows; a dying mirror shatters', () => {
  const st = state();
  st.units.set(1, unit(1, { isMirror: true, expiresAt: 200 }));
  st.units.set(2, unit(2, { cloaked: true }));
  st.units.set(3, unit(3, {}));
  const fx = createAbilityFx();
  let o = fx.update(st, [{ type: 'ability', kind: 'raised', pos: { x: 5, y: 5 }, entityId: 3 }], 1 / 30);
  assert.equal(o.unitFx.get(1).kind, 'mirror');
  assert.equal(o.unitFx.get(2).kind, 'cloak');
  assert.equal(o.unitFx.get(3).kind, 'raised');
  const before = fx.particles;
  st.units.delete(1);
  fx.update(st, [{ type: 'kill', entityId: 1, pos: { x: 5, y: 5 } }], 1 / 30);
  assert.ok(fx.particles > before + 15, 'mirror glass flies');
  o = frames(fx, st, 60);
  assert.ok(!o.unitFx.has(3), 'the rising glow fades');
});

test('particles are capped and age out', () => {
  const st = state();
  const fx = createAbilityFx();
  for (let i = 0; i < 100; i++) fx.update(st, [{ type: 'ability', kind: 'mineBlast', pos: { x: 5, y: 5 }, radius: 1 }], 1 / 30);
  assert.ok(fx.particles <= 2400);
  frames(fx, st, 120);
  assert.equal(fx.particles, 0, 'every particle ages out');
});

test('the view draws the model in three instanced meshes', () => {
  const scene = new THREE.Scene();
  const view = createAbilityFxView(THREE, scene);
  const st = state();
  st.units.set(1, unit(1, { ability: 'shieldTank' }));
  const fx = createAbilityFx();
  fx.update(st, [{ type: 'ability', kind: 'mineBlast', pos: { x: 5, y: 5 }, radius: 1 }], 1 / 30);
  const n = view.sync(fx.out);
  assert.ok(n.shells >= 1 && n.decals >= 1 && n.sprites > 10);
  assert.equal(scene.children.filter((m) => m.visible).length, 3);
  view.dispose();
  assert.equal(scene.children.length, 0);
});
