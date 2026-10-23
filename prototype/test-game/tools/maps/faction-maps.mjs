/**
 * tools/maps/faction-maps.mjs — the planet recipes and fairness guardrails the faction map 1s are authored to
 * [MM-story_mvjw67lo_f]. Spec: docs/16 Bulwark MM/design/Faction-Terrain-Design.md §1 (guardrails), §2.3 (recipes).
 *
 * Authoring (owner 2026-10-22: "redesign all maps for level 1 other than powder"):
 *   1. node tools/maps/faction-maps.mjs [slug]   — search seeds 1..400 for each recipe, print the best that pass;
 *   2. python tools/maps/forge-export.py jobs.json out.json — the REAL Terrain Forge (terrain.html, headless) renders
 *      each recipe + seed and exports exactly what "Export slot file" writes (decor groves, resources, spawns);
 *   3. write content/maps/forge/<slug>-map-1.json, then bake: node tools/terrain3d-proto/bake3d.mjs <slug>-map-1.
 * faction-maps.test.mjs keeps every shipped map honest against the same checks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') + '/';
const imp = (p) => import(pathToFileURL(R + p).href);
const { generateTerrain, placeBase, generateEdgeSpawns, TERRAIN } = await imp('src/terrain/terrainGen.js');
const { buildTerrainMap } = await imp('src/sim/mapgen.js');
const { buildNavGrid } = await imp('src/sim/pathfinding.js');
const POWDER = JSON.parse(fs.readFileSync(R + 'content/maps/forge/powder-map-1.json', 'utf8'));
const t = (pct, noise) => ({ pct, noise: noise / 100 });
/** Forge recipes, Faction-Terrain-Design §2.3 (types pct / noise 0–100 → 0–1; water mode · pct · noise). */
export const RECIPES = {
  'air':           { planet: 'Florael', types: { dirt: t(8, 30),  brush: t(22, 55), rocks: t(6, 55),  trees: t(16, 45), cliff: t(2, 50) }, water: { mode: 'patches', pct: 8,  noise: 0.35 } },
  'high-tech':     { planet: 'Ochre',   types: { dirt: t(40, 25), brush: t(10, 60), rocks: t(9, 60),  trees: t(6, 65),  cliff: t(9, 40) }, water: { mode: 'patches', pct: 3,  noise: 0.20 } },
  'artillery':     { planet: 'Kessra',  types: { dirt: t(35, 30), brush: t(6, 70),  rocks: t(8, 55),  trees: t(3, 75),  cliff: t(17, 30) }, water: { mode: 'patches', pct: 2, noise: 0.20 } },
  'water':         { planet: 'Rime',    types: { dirt: t(18, 30), brush: t(8, 50),  rocks: t(6, 60),  trees: t(12, 40), cliff: t(6, 45) }, water: { mode: 'patches', pct: 16, noise: 0.55 }, ponds: true },
  'arcane-energy': { planet: 'Cinder',  types: { dirt: t(20, 30), brush: t(6, 60),  rocks: t(9, 55),  trees: t(8, 55),  cliff: t(9, 40) }, water: { mode: 'patches', pct: 10, noise: 0.45 } },
  'space-tech':    { planet: 'Lumen',   types: { dirt: t(30, 40), brush: t(4, 70),  rocks: t(12, 55), trees: t(6, 65),  cliff: t(7, 50) }, water: { mode: 'patches', pct: 7,  noise: 0.30 } },
  'dark-energy':   { planet: 'Xenthe',  types: { dirt: t(12, 40), brush: t(20, 55), rocks: t(7, 60),  trees: t(30, 30), cliff: t(3, 50) }, water: { mode: 'patches', pct: 9,  noise: 0.35 } },
  'greenies':      { planet: 'Vexmire', types: { dirt: t(14, 45), brush: t(18, 55), rocks: t(5, 60),  trees: t(14, 40), cliff: t(2, 50) }, water: { mode: 'patches', pct: 17, noise: 0.45 } },
};

/**
 * Powder's map 1 stays the hand-kept Forge-default map (owner); its maps 2–9 [MM-story_mvkcdc27_t] use Verdance's
 * §2.3 recipe. PLANET_RECIPES = every faction slug → its planet recipe, for the maps 2–9 batch.
 */
export const VERDANCE = { planet: 'Verdance', types: { dirt: t(22, 30), brush: t(14, 45), rocks: t(5, 60), trees: t(24, 30), cliff: t(3, 50) }, water: { mode: 'patches', pct: 10, noise: 0.45 } };
export const PLANET_RECIPES = { powder: VERDANCE, ...RECIPES };
/** The campaign slots that ship a forge map per faction: map 1 (owner 2026-10-22) and maps 2–9 (same day, same size,
 *  same graduated wave windows — "use the same large map with graduated play areas"). */
export const MAP_SLOTS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);

/** Build the forge object exactly as terrain.html render()/exportObj() would (minus decor, which the browser adds). */
export function forgeFor(slug, seed) {
  const rc = PLANET_RECIPES[slug];
  const g = generateTerrain({ cols: 64, rows: 32, seed, types: rc.types, water: rc.water });
  const base = placeBase(g, POWDER.base.gap, { x: 31, y: 15 });
  const tn = POWDER.spawnTuning, spawnsByWave = {};
  for (const w of POWDER.waveWindows) {
    const rect = { x0: w.x - 1, y0: w.y - 1, x1: w.x - 1 + w.w - 1, y1: w.y - 1 + w.h - 1 };
    spawnsByWave[w.wave] = generateEdgeSpawns(g, { rect, side: w.attack, ground: tn.ground, air: tn.air, water: tn.water, spread: tn.spread, bias: tn.bias, spacing: tn.spacing });
  }
  return { ...POWDER, seed, types: rc.types, water: rc.water, base: { pos: base.pos, gap: base.gap }, spawnsByWave, spawns: spawnsByWave[1], resources: [], decor: [],
    terrain: Array.from(g.terrain), blocking: Array.from(g.blocking) };
}

function bfs(cols, rows, pass, starts) {
  const d = new Int32Array(cols * rows).fill(-1), q = [];
  for (const s of starts) { const i = s.y * cols + s.x; if (d[i] < 0) { d[i] = 0; q.push(i); } }
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % cols, y = (i / cols) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx; if (d[j] < 0 && pass(j)) { d[j] = d[i] + 1; q.push(j); } } }
  return d;
}

/** Guardrail metrics on the map the GAME builds from the forge object. */
export function evaluate(forge, mapId = 1) {
  const map = buildTerrainMap(forge, mapId, { seed: 0, bakeTune: {} });
  const { cols, rows } = map, N = cols * rows;
  const nav = buildNavGrid(map, []);
  const water = new Uint8Array(N); for (const c of map.waterCells) water[c.y * cols + c.x] = 1;
  const ground = (i) => nav.passable[i] === 1;
  const swim = (i) => nav.passable[i] === 1 || water[i] === 1;
  const ring = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) ring.push({ x: map.base.x + dx, y: map.base.y + dy });
  const dG = bfs(cols, rows, ground, ring), dW = bfs(cols, rows, swim, ring);
  let imp = 0; for (let i = 0; i < N; i++) if (!nav.passable[i]) imp++;
  const groundSp = [], seen = new Set();
  for (const [w, list] of Object.entries(forge.spawnsByWave)) for (const s of list) if (s.lane === 'ground') { const k = s.x + ',' + s.y; if (!seen.has(k)) { seen.add(k); groundSp.push({ ...s, w: +w }); } }
  let unreachable = 0, gain = 0, ratios = [];
  for (const s of groundSp) { const i = s.y * cols + s.x; if (dG[i] < 0) { unreachable++; continue; }
    const r = dW[i] / dG[i]; ratios.push(r); if (r < 0.9) gain++; }
  // second route: block the shortest ground route (outside the base ring) from each wave-1/2 spawn group, re-check
  let secondRoute = true;
  for (const wv of [1, 2]) {
    const sp = groundSp.find((s) => s.w === wv && dG[s.y * cols + s.x] > 0); if (!sp) { secondRoute = false; continue; }
    const cut = new Uint8Array(N); let i = sp.y * cols + sp.x;
    while (dG[i] > 3) { cut[i] = 1; const x = i % cols, y = (i / cols) | 0; let nxt = -1;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const j = ny * cols + nx; if (dG[j] === dG[i] - 1) { nxt = j; break; } }
      if (nxt < 0) break; i = nxt; }
    cut[sp.y * cols + sp.x] = 0;
    const d2 = bfs(cols, rows, (j) => ground(j) && !cut[j], ring);
    if (d2[sp.y * cols + sp.x] < 0) secondRoute = false;
  }
  // ponds: 4-connected water bodies
  const comp = new Int32Array(N).fill(-1), sizes = [];
  for (let i = 0; i < N; i++) if (water[i] && comp[i] < 0) { const q = [i]; comp[i] = sizes.length; let n = 0;
    for (let h = 0; h < q.length; h++) { const k = q[h], x = k % cols, y = (k / cols) | 0; n++;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const j = ny * cols + nx; if (water[j] && comp[j] < 0) { comp[j] = sizes.length; q.push(j); } } }
    sizes.push(n); }
  // reachable fraction of open ground (no sealed pockets bigger than a few cells)
  let open = 0, reach = 0; for (let i = 0; i < N; i++) if (ground(i)) { open++; if (dG[i] >= 0) reach++; }
  const mean = (a) => a.length ? a.reduce((p, q) => p + q, 0) / a.length : 1;
  return { map, impPct: 100 * imp / N, waterPct: 100 * map.waterCells.length / N, unreachable, spawns: groundSp.length, secondRoute,
    shortcutMean: mean(ratios), shortcutGain: groundSp.length ? gain / groundSp.length : 0, ponds: sizes.filter((n) => n >= 4).length, largestPond: Math.max(0, ...sizes),
    openReach: open ? reach / open : 1 };
}

export function passes(slug, e) {
  const fails = [];
  if (e.impPct < 12 || e.impPct > 24) fails.push(`impassable ${e.impPct.toFixed(1)}%`);
  if (e.unreachable) fails.push(`${e.unreachable} ground spawns cut off`);
  if (!e.secondRoute) fails.push('single route');
  if (e.openReach < 0.97) fails.push(`sealed pockets ${(100 * (1 - e.openReach)).toFixed(1)}%`);
  if (PLANET_RECIPES[slug] && PLANET_RECIPES[slug].ponds && !(e.shortcutGain >= 0.5 && e.shortcutMean <= 0.88)) fails.push(`pond shortcut weak (gain ${(100 * e.shortcutGain).toFixed(0)}%, mean ${e.shortcutMean.toFixed(2)})`);
  return fails;
}

if (process.argv[1] && process.argv[1].endsWith('faction-maps.mjs')) {
  const only = process.argv[2];
  for (const slug of Object.keys(RECIPES)) {
    if (only && slug !== only) continue;
    const ok = [];
    for (let seed = 1; seed <= 400 && ok.length < 400; seed++) {
      const e = evaluate(forgeFor(slug, seed));
      if (!passes(slug, e).length) ok.push({ seed, e });
    }
    // score: prefer impassable near the recipe's measured target, strong pond shortcut on Rime, well-connected open ground
    const target = { 'air': 12.9, 'high-tech': 12.6, 'artillery': 19.4, 'water': 23.8, 'arcane-energy': 19.7, 'space-tech': 14.3, 'dark-energy': 20.6, 'greenies': 20.5 }[slug];
    ok.sort((a, b) => score(b.e) - score(a.e));
    function score(e) { return -Math.abs(e.impPct - Math.min(23, Math.max(13, target))) + (RECIPES[slug].ponds ? 10 * e.shortcutGain - 10 * e.shortcutMean : 0) + 5 * e.openReach; }
    const top = ok.slice(0, 3).map(({ seed, e }) => `seed ${seed}: imp ${e.impPct.toFixed(1)}% water ${e.waterPct.toFixed(1)}% ponds ${e.ponds} (max ${e.largestPond}) shortcut ${(100 * e.shortcutGain).toFixed(0)}%/${e.shortcutMean.toFixed(2)} reach ${(100 * e.openReach).toFixed(1)}%`);
    console.log(slug.padEnd(14), RECIPES[slug].planet.padEnd(8), 'passing', ok.length + '/400', '\n   ' + top.join('\n   '));
  }
}
