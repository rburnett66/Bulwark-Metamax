// LC [MM-epic_mvbkrvnz_2] — landing craft models, the landing sequence, and the craft binder.
// Geometry uses the VENDORED three.js module (committed, so CI has it) — BufferGeometry needs no WebGL.
import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../../../vendor/three.module.js';
import '../../data/factions.js';
import { LANDING_CRAFT, LANDING_CRAFT_ORDER, FACTION_CRAFT, craftFor, CRAFT_SCALE } from './models.js';
import { PHASES, TOTAL, EVENTS, phaseAt, landingPose, landedPose, createLanding, rampOf, harvesterOnRamp } from './landing.js';
import { mergeCraftGroups, jetsOf, createCraft3D } from './craft3d.js';
import { isGlowKey, UMETAL } from '../units/metal.js';

const REG = globalThis.BulwarkFactions;

test('ten crafts: neutral + one per registry faction, every faction resolves to its own craft', () => {
  assert.equal(LANDING_CRAFT_ORDER.length, 10);
  assert.deepEqual(Object.keys(LANDING_CRAFT).sort(), [...LANDING_CRAFT_ORDER].sort());
  for (const f of REG.FACTIONS) assert.ok(FACTION_CRAFT[f.key], `faction ${f.key} has a craft`);
  const crafts = new Set(REG.FACTIONS.map((f) => craftFor(f.key).key));
  assert.equal(crafts.size, 9, 'nine distinct faction crafts');
  assert.equal(craftFor('system').key, 'lc_neutral');
  assert.equal(craftFor(null).key, 'lc_neutral');
  assert.equal(craftFor('nonsense').key, 'lc_neutral');
  assert.equal(craftFor('lc_water').key, 'lc_water', 'a craft key works too');
  assert.equal(CRAFT_SCALE, 0.25, '4 model units = 1 cell');
});

test('every craft: palette covers its keys, livery keys have metal, the six groups and pivots exist', () => {
  for (const k of LANDING_CRAFT_ORDER) {
    const d = LANDING_CRAFT[k];
    for (const p of d.parts) {
      assert.ok(d.palette[p.m] || isGlowKey(p.m), `${k}: material ${p.m} has a colour`);
      if (!isGlowKey(p.m)) assert.ok(UMETAL[p.m], `${k}: material ${p.m} has metal/roughness`);
    }
    const groups = new Set(d.parts.map((p) => p.g || 'body'));
    for (const g of ['body', 'weapon', 'gear', 'doorR', 'doorL']) assert.ok(groups.has(g), `${k}: group ${g}`);
    for (const g of ['weapon', 'gear', 'doorR', 'doorL']) assert.ok(Array.isArray(d.pivots[g]), `${k}: pivot ${g}`);
    assert.equal(d.footprint.join('x'), '3x3');
    assert.ok(/cannon|anti-troop|missiles|shield|mortar|rocket/.test(d.weaponType), `${k}: weapon type ${d.weaponType}`);
  }
});

test('the six requested weapon types are all used', () => {
  const types = new Set(LANDING_CRAFT_ORDER.map((k) => LANDING_CRAFT[k].weaponType.split(' ')[0]));
  for (const w of ['cannon', 'anti-troop', 'anti-aircraft', 'shield', 'mortar', 'rocket']) assert.ok(types.has(w), `weapon ${w}`);
});

test('geometry: every craft builds, stays in its 3 × 3 footprint, and is a modest single-instance cost', () => {
  for (const k of LANDING_CRAFT_ORDER) {
    const def = LANDING_CRAFT[k];
    const g = mergeCraftGroups(THREE, def);
    let tris = 0;
    const box = new THREE.Box3();
    for (const [name, P] of Object.entries(g)) {
      tris += P.tris;
      for (const geo of [P.lit, P.engine]) {
        if (!geo) continue;
        geo.computeBoundingBox();
        const b = geo.boundingBox.clone().translate(new THREE.Vector3(...P.pivot));
        box.union(b);
      }
      if (name === 'body') assert.ok(P.lit, `${k}: body has lit geometry`);
    }
    assert.ok(box.min.x >= -6.5 && box.max.x <= 6.6 && box.min.z >= -6.3 && box.max.z <= 6.3, `${k}: inside the footprint (${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}, ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)})`);
    assert.ok(box.min.y >= -0.01, `${k}: nothing below the ground`);
    assert.ok(tris > 2000 && tris < 14000, `${k}: ${tris} triangles`);
    assert.ok(jetsOf(def).some((j) => j.dir === 'down') && jetsOf(def).some((j) => j.dir === 'back'), `${k}: has lift jets and rear nozzles`);
  }
});

test('timeline: phases in order, events fire once each in order whatever the step size', () => {
  assert.deepEqual(PHASES.map((p) => p.key), ['approach', 'descent', 'touchdown', 'hatches', 'deploy']);
  assert.ok(Math.abs(TOTAL - PHASES.reduce((a, p) => a + p.dur, 0)) < 1e-9);
  for (const steps of [[0.016], [0.1, 0.033], [5, 5, 5], [TOTAL + 1]]) {
    const L = createLanding(), seen = [];
    let i = 0;
    while (!L.done && i < 5000) seen.push(...L.step(steps[i++ % steps.length]));
    assert.deepEqual(seen.map((e) => e.type), EVENTS.map((e) => e.type), `steps ${steps}`);
    assert.deepEqual(L.step(1), [], 'nothing after done');
  }
  const L = createLanding();
  L.step(1);
  assert.deepEqual(L.skip().map((e) => e.type), ['gearDown', 'touchdown', 'hatchesOpen', 'deployStart', 'done']);
  assert.equal(phaseAt(TOTAL + 1).key, 'done');
});

test('pose: flies in high and far, gear stows then comes down before touchdown, doors only after landing', () => {
  const a = landingPose(0);
  assert.ok(a.y > 20 && Math.hypot(a.x, a.z) > 60, 'starts high and far out');
  assert.equal(a.gear, 0, 'gear stowed on approach');
  let lastY = Infinity, lastGear = 0;
  for (let t = 0; t <= TOTAL + 0.5; t += 0.05) {
    const P = landingPose(t);
    if (t > 0.5 && t < 7.4) assert.ok(P.y <= lastY + 1e-6, `never climbs (t=${t.toFixed(2)})`);
    lastY = P.y;
    if (P.phase === 'descent' || P.phase === 'touchdown') { assert.ok(P.gear >= lastGear - 1e-9, 'gear only comes down'); lastGear = P.gear; }
    if (P.phase !== 'hatches' && P.phase !== 'deploy' && P.phase !== 'done') assert.equal(P.doors, 0, `doors shut while flying (${P.phase})`);
    if (P.phase === 'touchdown') assert.equal(P.gear, 1, 'gear fully down at touchdown');
    if (P.phase === 'deploy') assert.ok(P.harv >= 0 && P.harv <= 1);
  }
  const end = landedPose();
  assert.deepEqual([end.x, end.y, end.z, end.yaw, end.gear, end.doors, end.harv], [0, 0, 0, 0, 1, 1, 1], 'parked: on the spot, nose east, gear down, ramps down');
});

test('pose: any approach bearing still lands nose-east on the spot', () => {
  for (const from of [0, 90, 135, 180, 270]) {
    const s = landingPose(0, { fromDeg: from });
    const dir = Math.atan2(-s.z, s.x) * 180 / Math.PI;
    assert.ok(Math.abs(((dir - from) % 360 + 540) % 360 - 180) < 1e-6, `starts on bearing ${from}`);
    const e = landingPose(TOTAL, { fromDeg: from });
    assert.ok(Math.abs(e.x) < 1e-9 && Math.abs(e.z) < 1e-9 && Math.abs(((e.yaw % 360) + 360) % 360) < 1e-6, `from ${from}: lands on the spot, nose east (yaw ${e.yaw})`);
  }
});

test('ramp: the open door rests on the ground and the harvester path runs inside → sill → ramp → ground', () => {
  for (const k of LANDING_CRAFT_ORDER) {
    const def = LANDING_CRAFT[k], R = rampOf(def);
    const tipY = R.sill - R.len * Math.sin(R.angleDeg * Math.PI / 180);
    assert.ok(Math.abs(tipY) < 0.12, `${k}: ramp tip at ground (${tipY.toFixed(3)})`);
    assert.ok(R.angleDeg > 10 && R.angleDeg < 25, `${k}: a drivable ramp (${R.angleDeg}°)`);
    const a = harvesterOnRamp(def, 0), m = harvesterOnRamp(def, 0.5), e = harvesterOnRamp(def, 1);
    assert.equal(a.y, R.sill, 'starts on the hold floor');
    assert.ok(a.z < R.hinge && e.z > R.foot, 'inside the hull → past the ramp foot');
    assert.equal(e.y, 0, 'ends on the ground');
    assert.ok(m.y <= R.sill && m.y >= 0);
    // a docked harvester is 2 cells (8 units) from the base centre — the ramp foot is right there
    assert.ok(Math.abs(R.foot - 8) < 1.2, `${k}: ramp foot ${R.foot.toFixed(2)} lands near the dock`);
  }
});

test('binder: builds into a scene, poses gear/doors/attitude, maps ramp points to world cells', () => {
  const scene = new THREE.Scene();
  for (const k of ['system', 'water', 'arcane']) {
    const c = createCraft3D(THREE, scene, k);
    c.place({ x: 10, y: 6 });
    assert.deepEqual([c.root.position.x, c.root.position.z], [10.5, 6.5], 'stands on the base cell centre');
    c.apply(landingPose(0));
    assert.ok(c.model.position.y > 20, 'airborne at t=0');
    assert.ok(c.groups.gear.position.y > 1, 'gear stowed');
    c.apply(landedPose());
    assert.equal(c.groups.gear.position.y, 0, 'gear down');
    assert.ok(Math.abs(c.groups.doorR.rotation.x - c.def.anim.doorR.open * Math.PI / 180) < 1e-9 && c.groups.doorL.rotation.x < 0, 'ramps open outward');
    const w = c.toWorld({ x: 0, y: 0, z: rampOf(c.def).foot });
    assert.ok(Math.abs(w.x - 10.5) < 1e-6 && Math.abs(w.z - (6.5 + rampOf(c.def).foot * CRAFT_SCALE)) < 1e-6, '+Z hatch ramp foot is south of the base');
    assert.ok(c.groups.head && c.groups.head.parent === c.groups.weapon, 'the head rides on the weapon');
    for (let i = 0; i < 30; i++) c.aim(Math.PI / 2, 0.1); assert.ok(Math.abs(c.groups.weapon.rotation.y - Math.PI / 2) < 0.05, 'weapon turns to the aim');
    c.setCastShadow(true); assert.equal(c.castShadow, true);
    c.dispose();
  }
  assert.equal(scene.children.length, 0, 'dispose removes everything');
});

test('hand-off: harvesters stay aboard, drive down their hatch ramp, and end exactly on their sim position', async () => {
  const { landingHarvesters } = await import('../index.js');
  const { createLanding: mk, TOTAL: T } = await import('./landing.js');
  const scene = new THREE.Scene();
  const craft = createCraft3D(THREE, scene, 'water');
  const base = { x: 20, y: 12 };
  craft.place(base);
  const r = { craft, landing: mk(), map: { base } };
  const north = { id: 7, isHarvester: true, homePos: { x: 20, y: 10 }, pos: { x: 20, y: 10 } };
  const tank = { id: 8, pos: { x: 3, y: 3 } };
  const state = { units: new Map([[7, north], [8, tank]]) };
  const views = [{ id: 7, x: 20.5, y: 0, z: 10.5, heading: 0, aim: 0 }, { id: 8, x: 3.5, y: 0, z: 3.5, heading: 0, aim: 0 }];
  // before the hatches open: the harvester is aboard (not drawn); other units untouched
  r.landing.step(5); craft.apply(r.landing.pose());
  let out = landingHarvesters(r, state, views);
  assert.deepEqual(out.map((v) => v.id), [8]);
  // mid-deploy on the ramp: north of the base centre (−Z hatch), facing north, above the ground
  r.landing.step(T - 5 - 3.2); craft.apply(r.landing.pose());
  out = landingHarvesters(r, state, views);
  const h = out.find((v) => v.id === 7);
  assert.ok(h, 'drawn once deploying');
  assert.ok(h.z < base.y + 0.5 - 1.0 && Math.abs(h.x - (base.x + 0.5)) < 1e-6, `on the north ramp (z ${h.z.toFixed(2)})`);
  assert.ok(Math.abs(Math.sin(h.heading) + 1) < 1e-6, 'facing out of the hatch (north)');
  // at the end: exactly where the sim has it, and the override hands back
  r.landing.step(10); craft.apply(r.landing.pose());
  out = landingHarvesters(r, state, views);
  assert.equal(out, views, 'after the landing the sim views pass straight through');
  craft.dispose();
});
