/** mapgen.test.mjs — the campaign map generator honors the GDD's hard rules and the engine's MAP
 *  contract, deterministically, for all 9 maps. Run: node src/sim/mapgen.test.mjs */
import assert from 'node:assert';
import { buildCampaignMap, resolveResourceTypes, rolesFor, applyOverrides } from './mapgen.js';
import { MAPDATA } from '../../content/maps/mapdata.js';
import { createSim, stepSim, applyCommand } from './core.js';
import { hashState } from './replay.js';

const TYPES = ['Flowers', 'Crystals', 'Minerals'];

// determinism: same (mapId, seed) → byte-identical map
for (const id of [1, 5, 9]) {
  assert.strictEqual(JSON.stringify(buildCampaignMap(id, { seed: 3 })), JSON.stringify(buildCampaignMap(id, { seed: 3 })),
    `map ${id} deterministic`);
}

for (const def of MAPDATA.maps) {
  const id = def.Map_ID;
  const map = buildCampaignMap(id, { seed: 1 });

  // engine contract completeness (what createSim/buildNavGrid/renderer/waves read)
  for (const f of ['cols', 'rows', 'tile', 'spawnGround', 'spawnWater', 'spawnAir', 'waterCells',
                   'waterLane', 'groundLane', 'slots', 'buildableCells', 'base', 'rings', 'resources']) {
    assert(map[f] !== undefined, `map ${id}: contract field ${f}`);
  }
  assert.strictEqual(map.cols, def.Full_W, `map ${id} cols`);
  assert.strictEqual(map.rows, def.Full_H, `map ${id} rows`);
  assert(map.base.cells.length === 5 && map.base.cornerSlots.length === 4, `map ${id} base plus-shape`);
  assert(map.buildableCells.length >= 45, `map ${id} enough buildable ground (${map.buildableCells.length})`);

  // GDD §3.2: 8 rings; every wave opens a REAL ring (area strictly grows, at least one axis by ≥2);
  // wave 8 = full map, no remainder
  assert.strictEqual(map.rings.length, 8, `map ${id} has 8 rings`);
  for (let i = 1; i < 8; i++) {
    const a = map.rings[i - 1].rect, b = map.rings[i].rect;
    assert(b.w * b.h > a.w * a.h, `map ${id} wave ${i + 1}: ring adds real area`);
    assert(b.w >= a.w + 2 || b.h >= a.h + 2, `map ${id} wave ${i + 1}: an axis grows >=2 tiles`);
    assert(b.w >= a.w && b.h >= a.h, `map ${id} wave ${i + 1}: rings never shrink`);
  }
  const last = map.rings[7].rect;
  assert(last.w === def.Full_W && last.h === def.Full_H, `map ${id} wave 8 reveals the full map`);

  // GDD §4: spawns sit outside the current playable edge; side focus is a single side per wave
  for (const ring of map.rings) {
    const g = ring.spawns.ground, r = ring.rect;
    const outside = g.x < r.x0 || g.x > r.x1 || g.y < r.y0 || g.y > r.y1;
    // once the ring touches the board edge on the focus axis there is no "outside" left — the spawn
    // clamps to the border (wave 8 is always like this: full map)
    const atEdge = { L: r.x0 < 2, R: r.x1 > map.cols - 3, T: r.y0 < 2, B: r.y1 > map.rows - 3 }[ring.sideFocus];
    assert(outside || atEdge, `map ${id} wave ${ring.wave}: ground spawn outside the ring (or ring at board edge)`);
    assert(['L', 'R', 'T', 'B'].includes(ring.sideFocus), `map ${id} wave ${ring.wave}: side focus`);
    assert(ring.budget.ground + ring.budget.air + ring.budget.water > 0, `map ${id} wave ${ring.wave}: budget`);
  }

  // GDD §5: resources exist for every role the wave table calls for; radial gradient monotone by role
  const byRole = { primary: [], premium: [], quest: [] };
  for (const r of map.resources) byRole[r.role].push(r);
  assert(byRole.primary.length > 0 && byRole.premium.length > 0, `map ${id}: primary+premium placed`);
  assert(byRole.quest.every((q) => q.wave >= 5), `map ${id}: quest nodes only waves 5-8`);
  assert(byRole.quest.every((q) => q.valuePerUnit === 0), `map ${id}: quest pays no gold`);
  const avg = (a) => a.reduce((s, r) => s + r.grade, 0) / Math.max(1, a.length);
  if (byRole.premium.length && byRole.primary.length) {
    assert(avg(byRole.premium) > avg(byRole.primary), `map ${id}: premium sits farther out than primary (gradient)`);
  }
  // no resource on water or base
  const water = new Set(map.waterCells.map((c) => `${c.x},${c.y}`));
  for (const r of map.resources) {
    assert(!water.has(`${r.x},${r.y}`), `map ${id}: resource ${r.id} not on water`);
    assert(!(Math.abs(r.x - map.base.x) <= 1 && Math.abs(r.y - map.base.y) <= 1), `map ${id}: resource off the base`);
  }

  // water maps carry a lane; dry maps don't
  assert.strictEqual(map.waterCells.length > 0, !!def.Has_Water, `map ${id} water presence matches sheet`);

  // the sim actually accepts the map (createSim + a short run stays deterministic)
  const s1 = createSim(11, { map });
  applyCommand(s1, { type: 'startWave' });
  for (let i = 0; i < 90; i++) stepSim(s1, 1 / 30);
  const s2 = createSim(11, { map: buildCampaignMap(id, { seed: 1 }) });
  applyCommand(s2, { type: 'startWave' });
  for (let i = 0; i < 90; i++) stepSim(s2, 1 / 30);
  assert.strictEqual(hashState(s1), hashState(s2), `map ${id}: sim runs deterministically on the generated map`);
}

// GDD §5.2: all 81 pairings resolve to three DISTINCT types; swap never re-collides
let swapped = 0;
for (let m = 1; m <= 9; m++) {
  for (let f = 1; f <= 9; f++) {
    const r = rolesFor(m, f);
    assert(new Set([r.primary, r.premium, r.quest]).size === 3, `map ${m} faction ${f}: three distinct roles`);
    for (const t of [r.primary, r.premium, r.quest]) assert(TYPES.includes(t), `map ${m} faction ${f}: real type ${t}`);
    if (r.swapped) swapped++;
  }
}
assert.strictEqual(swapped, 27, `27 pairings swap (3 factions share each type), got ${swapped}`);

// resolveResourceTypes stamps real types onto premium/quest nodes
const m5 = resolveResourceTypes(buildCampaignMap(5, { seed: 2 }), 2);
for (const r of m5.resources) assert(TYPES.includes(r.type), `resolved node type ${r.type}`);

// overrides: move water, move a resource, move a spawn — applied and stable
const m1 = buildCampaignMap(1, { seed: 4 });
const res0 = m1.resources[0];
const origX = res0.x;
applyOverrides(m1, {
  waterAdd: [{ x: 1, y: 1 }],
  resourceMove: [{ id: res0.id, x: origX + 1, y: res0.y }],
  spawnMove: [{ wave: 1, lane: 'ground', x: 2, y: 2 }],
});
assert(m1.waterCells.some((c) => c.x === 1 && c.y === 1), 'override water added');
assert(m1.resources[0].x === origX + 1, 'override resource moved');
assert(m1.spawnGround.x === 2 && m1.rings[0].spawns.ground.x === 2, 'override spawn moved');

console.log(`mapgen.test OK — 9 maps: contract complete, rings grow, gradient holds, 81 pairings valid (27 swapped), sim-compatible, overrides apply`);
