// [MM-story_mwb8zcgz_25] owner 2026-11-10 (tower parity): the defense on the Upgrade Bay looks like the battle's upgrading
// tower — the warm Upgrading tint, with build dust and welding sparks — until its new tier is installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defenseStructures } from './conduits.js';
import { createBuildFx } from '../../render3d/fx/buildFx.js';
import { createStructureFx } from '../../render3d/fx/structureFx.js';
import { K, } from '../../render3d/fx/impacts.js';
import { SPARK_TINT } from '../../render3d/fx/repairFx.js';
import { lifecycleLook } from '../../render3d/structures/models.js';

const T = 1_000_000;
const map = { pads: [{ id: 'p7', x: 10, y: 4, w: 4, h: 4 }] };
// the bay stands at its own spot (S2c.2: model.buildingRect reads `at`); constructionFx.js still reads map.pads (lane K moves it)
const outpost = (upgrading) => ({ pads: { p7: { kind: 'upgradeBay', tier: 1, at: { x: 10, y: 4, w: 4, h: 4 } } }, building: [],
  defenses: [{ id: 'd1', kind: 'cannon', tier: 1, cell: [5, 5], hp: 400 }], upgrading });

test('the defense on the bay is the battle\'s Upgrading tower (the warm tint)', () => {
  const s = defenseStructures(outpost({ id: 'd1', kind: 'cannon', tier: 2, since: T, done: T + 60000 }), map).find((x) => x.outpostId === 'd1');
  assert.equal(s.lifecycle, 'Upgrading');
  assert.equal(lifecycleLook(s).key, 'U');
});

test('the bay throws the shared build dust and welding sparks while the upgrade runs, and stops when it is done [MM-story_mwcrfnyf_3c]', () => {
  const o = outpost({ id: 'd1', kind: 'cannon', tier: 2, since: T, done: T + 60000 });
  const run = (u) => {
    const st = { structures: new Map(defenseStructures(outpost(u), map).map((s) => [s.id, s])) };
    const dust = createBuildFx({ seed: 2 }), weld = createStructureFx({ seed: 2 });
    let puffs = 0, blue = 0;
    for (let i = 0; i < 30; i++) {
      puffs += dust.step(1 / 30, st, null, () => {}, K);
      weld.step(1 / 30, st, (kind, x, y, z, vx, vy, vz, life, size, grow, shade) => { if (kind === K.SPARK && shade === SPARK_TINT.repair) blue++; }, K);
    }
    return { puffs, blue };
  };
  const site = defenseStructures(o, map).find((x) => x.onBay);
  assert.deepEqual(site.pos, { x: 13.5, y: 6.5 });
  const busy = run(o.upgrading), idle = run(null);
  assert.ok(busy.puffs > 0 && busy.blue > 0, JSON.stringify(busy));
  assert.deepEqual(idle, { puffs: 0, blue: 0 });
});
