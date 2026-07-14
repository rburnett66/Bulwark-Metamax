import assert from 'node:assert';
import { generateTerrain, TERRAIN, TERRAIN_NAME, BLOCKING } from './terrainGen.js';

const cfg = {
  cols: 48, rows: 30, seed: 13,
  types: { dirt: { pct: 25, noise: 0.35 }, brush: { pct: 12, noise: 0.5 }, rocks: { pct: 8, noise: 0.6 }, trees: { pct: 15, noise: 0.4 }, cliff: { pct: 5, noise: 0.5 } },
  water: { mode: 'connected', pct: 10, noise: 0.3 },
};

// determinism
const a = generateTerrain(cfg), b = generateTerrain(cfg);
assert.strictEqual(a.terrain.length, cfg.cols * cfg.rows, 'terrain sized to grid');
for (let i = 0; i < a.terrain.length; i++) assert.strictEqual(a.terrain[i], b.terrain[i], 'deterministic terrain');

// blocking set matches the terrain
for (let i = 0; i < a.terrain.length; i++) assert.strictEqual(a.blocking[i], BLOCKING.has(a.terrain[i]) ? 1 : 0, 'blocking mirrors terrain');

// connected water = one 4-connected component
const wc = [];
for (let i = 0; i < a.terrain.length; i++) if (a.terrain[i] === TERRAIN.WATER) wc.push(i);
if (wc.length) {
  const seen = new Set([wc[0]]); const st = [wc[0]];
  while (st.length) { const c = st.pop(); const x = c % cfg.cols, y = (c / cfg.cols) | 0;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= cfg.cols || ny >= cfg.rows) continue;
      const ni = ny * cfg.cols + nx;
      if (a.terrain[ni] === TERRAIN.WATER && !seen.has(ni)) { seen.add(ni); st.push(ni); }
    } }
  assert.strictEqual(seen.size, wc.length, 'connected water is a single blob');
}

// coverage responds to pct: 0% dirt → no dirt
const noDirt = generateTerrain({ ...cfg, types: { ...cfg.types, dirt: { pct: 0, noise: 0.4 } } });
assert.ok(!noDirt.terrain.includes(TERRAIN.DIRT), '0% dirt yields no dirt cells');

// borders exist around blocking regions when features are present
let borders = 0;
for (const t of a.terrain) if (t === TERRAIN.TREE_BORDER || t === TERRAIN.ROCK_BORDER || t === TERRAIN.CLIFF_BORDER) borders++;
assert.ok(borders > 0, 'blocking regions produce border cells');

console.log('terrainGen.test OK — deterministic, blocking mirrors terrain, connected water is one blob, coverage + borders honored');
