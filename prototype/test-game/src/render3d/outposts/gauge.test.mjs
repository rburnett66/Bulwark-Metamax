// The capacity gauge on the Storage Tower's outside (owner 2026-11-12: "the storage facility should have a capacity
// level indicator on the outside") [MM-task_mwd3zlwd_6]: the pure level / colour bands, the meshes the kit builds (a bar
// scaled and recoloured, never rebuilt), and which models carry one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import { gaugeLevel, buildGauge, GAUGE, GAUGE_MOUNTS, createOutpostKit } from './outpostModels.js';

test('gauge bands: green below 80 %, amber from 80 %, red when full', () => {
  assert.deepEqual(gaugeLevel(0, 1440), { frac: 0, band: 'ok', color: GAUGE.colors.ok });
  assert.equal(gaugeLevel(60, 1440).band, 'ok');
  assert.ok(Math.abs(gaugeLevel(60, 1440).frac - 60 / 1440) < 1e-12);
  assert.equal(gaugeLevel(1151, 1440).band, 'ok');
  assert.equal(gaugeLevel(1152, 1440).band, 'near');   // exactly 80 %
  assert.equal(gaugeLevel(1439, 1440).band, 'near');
  assert.deepEqual(gaugeLevel(1440, 1440), { frac: 1, band: 'full', color: GAUGE.colors.full });
  assert.equal(gaugeLevel(1440 - 1e-7, 1440).band, 'full');   // the rigs' own full tolerance
  assert.equal(gaugeLevel(5000, 1440).frac, 1);
  assert.equal(gaugeLevel(0.9, 1).band, 'near');
});

test('gauge level: no capacity or nonsense reads empty, never NaN', () => {
  for (const [s, c] of [[10, 0], [0, 0], [-5, 100], [NaN, 100], [10, NaN], [undefined, undefined]]) {
    const lv = gaugeLevel(s, c);
    assert.equal(lv.frac, 0, `${s}/${c}`);
    assert.equal(lv.band, 'ok');
  }
});

test('the colours read as green, amber, red', () => {
  const [g, a, r] = [GAUGE.colors.ok, GAUGE.colors.near, GAUGE.colors.full];
  assert.ok(g[1] > g[0] * 3 && g[1] > g[2] * 2, 'green');
  assert.ok(a[0] > a[1] && a[1] > a[2] * 4, 'amber');
  assert.ok(r[0] > r[1] * 5 && r[0] > r[2] * 5, 'red');
});

test('buildGauge: set() scales and recolours the bar in place (no rebuild), dims unpowered but stays readable', () => {
  const g = buildGauge(THREE, GAUGE_MOUNTS.storage);
  const meshes = []; g.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const geos = meshes.map((m) => m.geometry);
  g.set(0.4);
  assert.ok(Math.abs(g.bar.scale.y - 0.4) < 1e-9);
  assert.equal(g.bar.visible, true);
  assert.equal(g.level.band, 'ok');
  assert.deepEqual(g.bar.material.color.toArray().map((v) => +v.toFixed(4)), GAUGE.colors.ok.map((v) => +v.toFixed(4)));
  g.set(0.9);
  assert.ok(Math.abs(g.bar.scale.y - 0.9) < 1e-9);
  assert.equal(g.level.band, 'near');
  g.set(1, 0.05);   // full, unpowered
  assert.equal(g.level.band, 'full');
  assert.equal(g.level.glow, GAUGE.minGlow);
  assert.ok(Math.abs(g.bar.material.color.r - GAUGE.colors.full[0] * GAUGE.minGlow) < 1e-6);
  g.set(0);
  assert.equal(g.bar.visible, false);
  const after = []; g.group.traverse((o) => { if (o.isMesh) after.push(o.geometry); });
  assert.deepEqual(after, geos, 'the same geometries: nothing rebuilt');
  // the bar is unlit (the ship_glow language); the housing is a lit hull material the sun shades
  assert.equal(g.bar.material.type, 'MeshBasicMaterial');
  assert.equal(g.bar.material.toneMapped, false);
  assert.ok(meshes.some((m) => m.material.type === 'MeshStandardMaterial' && m.castShadow));
  g.dispose();
});

test('the gauge stands on the model\'s front face, inside its footprint', () => {
  for (const [slug, m] of Object.entries(GAUGE_MOUNTS)) {
    assert.ok(m.y1 > m.y0 && m.w > 0.15, slug);
    assert.ok(m.z > 0.5, `${slug}: on the front (+Z, the face the default camera sees)`);
    assert.ok(Math.abs(m.x) + m.w / 2 < 2, `${slug}: within the 4-unit model`);
  }
});

// a model kit over a stand-in GLTFLoader: every slug in the manifest gets a one-mesh scene
async function fakeKit(slugs) {
  const manifest = Object.fromEntries(slugs.map((s) => [s, { kind: s, lods: [0, 1, 2].map((l) => ({ file: `${s}_lod${l}.glb` })) }]));
  const prev = globalThis.fetch;
  globalThis.fetch = async () => ({ json: async () => manifest });
  class GLTFLoader {
    load(url, ok) {
      const scene = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      mesh.material.name = 'ship_body_v2';
      scene.add(mesh);
      ok({ scene, animations: [] });
    }
  }
  try { return await createOutpostKit(THREE, { base: './', GLTFLoader }); } finally { globalThis.fetch = prev; }
}

test('the kit gives the Storage Tower and the Resource Bay a gauge, and no other model', async () => {
  const kit = await fakeKit(['storage', 'resourceBay', 'hub', 'power', 'rig_auger', 'shuttle']);
  for (const slug of ['storage', 'resourceBay', 'hub', 'power', 'rig_auger', 'shuttle']) {
    const inst = await kit.make(slug);
    const has = slug === 'storage' || slug === 'resourceBay';
    assert.equal(!!inst.gauge, has, slug);
    const lv = inst.setGauge(0.5);
    if (!has) { assert.equal(lv, null, slug); continue; }
    assert.equal(lv.band, 'ok');
    assert.ok(inst.object.children.includes(inst.gauge.group), `${slug}: the gauge rides the model's holder, outside the LOD`);
    // the look keeps it: building rises with the model, unpowered dims it but keeps the level
    inst.setLook({ rise: 0.5, glow: 0.05 });
    assert.equal(inst.gauge.group.scale.y, 0.5);
    assert.ok(Math.abs(inst.gauge.bar.scale.y - 0.5) < 1e-9);
    assert.equal(inst.gauge.level.glow, GAUGE.minGlow);
    inst.setGauge(0.95);
    assert.equal(inst.gauge.level.band, 'near');
    inst.dispose();
  }
});
