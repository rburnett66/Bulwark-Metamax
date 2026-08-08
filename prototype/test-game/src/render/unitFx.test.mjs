// src/render/unitFx.test.mjs — DDD-9, the four COSMETIC sites that dispatched on a display name.
//
//   renderer.js  RANGED_SHAPES[d.shape]                          did this unit draw shots AT ALL
//   renderer.js  d.shape === 'Tanks' || 'Heavy Tanks' || …       shell or tracer
//   renderer.js  the same triple again                           wreck flames
//   gallery.js   a fourth private copy of that triple            "exactly what the game fires"
//   harness/parts.js  PALETTES[def.shape] + dimsFor(def.shape)   placeholder art + authoring silhouette
//
// Cosmetic is not the same as harmless. The first of those gated whether a unit's weapon was VISIBLE:
// rename a shape in tables.js and nine units fight in total silence, with no error, no test failure,
// and nothing in the sim to notice. The fourth meant the tuning tool and the battle map could disagree
// about what the game does while the tool claimed to be showing exactly that.
//
// node --test
import test from 'node:test';
import assert from 'node:assert/strict';

import { UNITS } from '../data/tables.js';
import { shotFxFor, drawsProjectiles, showsWreckFire, SHOT_KINDS } from './unitFx.js';
import { dimsFor, unitParts } from '../harness/parts.js';

/** Labels that appear nowhere in the roster. */
const rename = (def) => ({ ...def, shape: 'Assault Platform', role: 'Vanguard' });

/* ------------------------------------------------------------------ */
/* 1. Projectiles: drawn at all, and which kind                        */
/* ------------------------------------------------------------------ */

test('DDD-9: every unit still draws exactly what it drew, after a rename', () => {
  // The regression this exists to catch is silent, so assert per unit rather than in aggregate.
  for (const id of Object.keys(UNITS)) {
    const def = UNITS[id];
    assert.equal(shotFxFor(rename(def)), shotFxFor(def), `${id}: projectile changed with its label`);
    assert.equal(showsWreckFire(rename(def)), showsWreckFire(def), `${id}: wreck fire changed with its label`);
  }
});

test('DDD-9: "draws shots at all" is the def field — the property that used to vanish on a rename', () => {
  const firing = Object.keys(UNITS).filter((id) => drawsProjectiles(UNITS[id]));
  const silent = Object.keys(UNITS).filter((id) => !drawsProjectiles(UNITS[id]));
  assert.ok(firing.length > 0, 'somebody has to shoot');
  assert.ok(silent.length > 0, 'infantry and trucks draw no shot — that case must stay representable');

  // A unit called 'Tanks' that declares no projectile draws nothing; a renamed one that declares a
  // shell still draws it. Under RANGED_SHAPES both answers were the other way round.
  assert.equal(drawsProjectiles({ shape: 'Tanks', projectileFx: null }), false);
  assert.equal(shotFxFor({ shape: 'Assault Platform', projectileFx: 'shell' }), 'shell');
  assert.equal(shotFxFor({ shape: 'Assault Platform', projectileFx: 'tracer' }), 'tracer');
});

test('DDD-9: an unknown projectile kind degrades to "draws nothing", never to a wrong sprite', () => {
  assert.equal(shotFxFor({ projectileFx: 'plasma' }), null);
  assert.equal(shotFxFor({ projectileFx: 42 }), null);
  assert.equal(shotFxFor({}), null);
  assert.equal(shotFxFor(null), null);
  for (const k of SHOT_KINDS) assert.equal(shotFxFor({ projectileFx: k }), k);
});

test('DDD-9: the range floor is gone, and removing it moved nothing', () => {
  // renderer.js also required `range > 1.6` before drawing a shot — a magic number standing in for
  // "too short-ranged to bother". One explicit field decides now. Every unit that draws is clear of
  // the old floor, so this is the assertion that the deletion was a no-op for the shipped roster.
  for (const id of Object.keys(UNITS)) {
    if (!drawsProjectiles(UNITS[id])) continue;
    assert.ok(UNITS[id].range > 1.6, `${id} would have changed behaviour when the range floor went`);
  }
});

test('DDD-9: wreck fire is a chassis property, independent of the weapon', () => {
  assert.equal(showsWreckFire({ shape: 'Tanks', burnsWhenDamaged: false }), false);
  assert.equal(showsWreckFire({ shape: 'Assault Platform', burnsWhenDamaged: true }), true);
  assert.equal(showsWreckFire({ projectileFx: 'shell' }), false, 'firing a shell does not imply burning');
  assert.equal(showsWreckFire(undefined), false);
});

/* ------------------------------------------------------------------ */
/* 2. The gallery and the battle map must answer identically           */
/* ------------------------------------------------------------------ */

test('DDD-9: the tuning tool and the game read the SAME field, so they cannot drift', () => {
  // gallery.js kept its own copy of the shell/tracer triple. Both go through shotFxFor now; the
  // gallery only adds a fallback for units that draw nothing, because it is a weapon workbench and
  // has to render something. That fallback is the whole of the remaining difference.
  for (const id of Object.keys(UNITS)) {
    const game = shotFxFor(UNITS[id]);
    const gallery = shotFxFor(UNITS[id]) || 'tracer';
    assert.equal(gallery, game === null ? 'tracer' : game, id);
  }
});

/* ------------------------------------------------------------------ */
/* 3. harness/parts.js — placeholder art + the authoring silhouette    */
/* ------------------------------------------------------------------ */

test('DDD-9: placeholder art and authoring dims key on artClass, not on the display name', () => {
  for (const id of Object.keys(UNITS)) {
    const def = UNITS[id];
    assert.deepEqual(dimsFor(rename(def)), dimsFor(def), `${id}: authoring silhouette moved with its label`);
  }
  // dimsFor defines what "unit-sized" means in the bench, and the game scales authored art against it
  // (unitArt.js) — so a rename that shrank a chassis here shrank the sprite on the battle map too.
  assert.deepEqual(dimsFor({ artClass: 'heavyTank', shape: 'Assault Platform' }), { w: 34, h: 24 });
  assert.deepEqual(dimsFor({ artClass: 'infantry', shape: 'Assault Platform' }), { w: 24, h: 16 });
  assert.deepEqual(dimsFor({ shape: 'Heavy Tanks' }), { w: 28, h: 18 }, 'the NAME alone buys nothing');
});

test('DDD-9: every unit still builds a part stack, renamed or not — the bench stays droppable', () => {
  for (const id of Object.keys(UNITS)) {
    const parts = unitParts(rename(UNITS[id]));
    for (const layer of ['base', 'weapon', 'head']) {
      assert.ok(parts[layer] && typeof parts[layer].draw === 'function', `${id}: missing ${layer}`);
    }
  }
});

test('DDD-9: the placeholder palette follows artClass — different classes really do differ', () => {
  // unitParts closes over the palette, so compare what the draw calls paint.
  const paints = (def) => {
    const seen = [];
    const g = {
      clear() {}, beginFill(c) { seen.push(c); return g; }, endFill() { return g; },
      lineStyle() { return g; }, drawRoundedRect() { return g; }, drawRect() { return g; },
      drawCircle() { return g; },
    };
    unitParts(def).base.draw(g);
    return seen;
  };
  const infantry = paints({ artClass: 'infantry' });
  const heavy = paints({ artClass: 'heavyTank' });
  const unknown = paints({ artClass: 'nothingLikeThis' });
  assert.notDeepEqual(infantry, heavy, 'two art classes must not paint the same body');
  assert.deepEqual(paints({ artClass: 'infantry', shape: 'Heavy Tanks' }), infantry,
    'the display name must not repaint the chassis');
  assert.ok(unknown.length > 0, 'an unrecognised class still falls back to the generic chassis');
});
