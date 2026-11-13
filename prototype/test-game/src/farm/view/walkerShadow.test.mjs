// Owner 2026-11-12 [MM-story_mweijotw_1]: "characters walking around do not cast shadows". Walkers cast the battle
// units' live planar shadow (models3d.shadowMaterial), not the static, render-on-change shadow map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shadowMaterial } from '../../render3d/units/models3d.js';

class ShaderMaterial { constructor(o) { Object.assign(this, o); } }
const THREE = { ShaderMaterial, Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } } };
const sun = { x: 0.3, y: 0.8, z: 0.2 };

test('the battle shadow material keeps its instanced form; the crew form drops instanceMatrix and sits on the plate', () => {
  const unit = shadowMaterial(THREE, sun, 0.34);
  assert.match(unit.vertexShader, /instanceMatrix/);
  assert.match(unit.vertexShader, /w\.y = 0\.0300;/);
  const crew = shadowMaterial(THREE, sun, 0.34, { instanced: false, groundY: 0.07 });
  assert.doesNotMatch(crew.vertexShader, /instanceMatrix/);
  assert.match(crew.vertexShader, /w\.y = 0\.0700;/);
  assert.equal(crew.uniforms.alpha.value, 0.34, 'the same darkness as a battle unit');
});

test('walkers no longer cast into the static shadow map, and their live shadow obeys the quality tier', () => {
  const src = readFileSync(new URL('./avatar.js', import.meta.url), 'utf8');
  assert.match(src, /m\.castShadow = false/);
  assert.match(src, /shadowMaterial\(THREE, r\.lights\.dir, 0\.34, \{ instanced: false/);
  assert.match(src, /liveShadows === false/);
});
