# Terrain: detail and complexity (as built)

**Status:** reference, describes the code on `main` as of 2026-10-21 (after PR #112). **Ticket:** [MM-task_mvj5n3g1_4]
**Owner ask (2026-10-21):** "Is terrain forge still capable of making maps? Create a design document describing the current detail and complexity of the terrain."

This is a snapshot of what the battlefield ground *is* today: the data behind it, how it is generated, how it is drawn, what it costs and where it falls short. It is not a plan. Paths are relative to `prototype/test-game/` unless they start with `docs/`. Figures marked *measured* came from running the game's own modules on `content/maps/forge/powder-map-1.json`.

---

## 1. Summary

| | |
|---|---|
| Battlefield grid | 64 × 32 cells (2,048) on every forge map; generated campaign maps 28×20 → 68×36 |
| Terrain types | 10 codes, 5 of them impassable (rocks, trees, cliff, cliff border, water) |
| Authored maps | **1** (`powder-map-1`); the other 8 faction map-1 files are copies of it |
| Ground mesh | flat, faceted, 0.5-cell jittered triangles: **16,384 tris** (High/Standard), **4,096** (Low) |
| Grass tufts | **1,083 tufts / 9,747 tris** (High/Standard), none on Low |
| Rocks + trees | **213 rocks + 83 trees = 22,456 tris**, two merged meshes, no LOD |
| Whole terrain, High | **≈ 48.6k triangles**, ~6 draw calls (ground, tufts, apron, rocks, trees, fog) |
| Height | none: the ground is a flat plane at Y 0; plateaus/cliffs are stacked boulders on it |
| Water | ground-triangle colour bands only (no mesh, no shader, no animation) |
| Textures | 4 generated 256² detail maps (grass + sand albedo/normal) and a 128² cloud noise; one 320×160 road mask per baked map |
| Lighting | one fixed sun (azimuth 135°, elevation 45°) + hemisphere; hard shadows rendered once |

**Terrain Forge still makes maps.** Verified headless on 2026-10-21 (§2). The loop works end to end. Its one weak link is the offline 3D bake that gives a map its worn roads.

---

## 2. Terrain Forge: can it still make maps?

**Yes.** `terrain.html` was driven headless, with the same clicks an author makes: new seed, *Generate resources*, *Generate spawns: all 8 waves*, *Save map to slot* (Space Tech · map 2).

| Step | Result |
|---|---|
| Tool loads | no console or page errors |
| Generate | 64×32 map, 5 terrain types + water patches, 81 resources, spawns for all 8 waves, 40 decor trees |
| Save to slot | written to `localStorage['bulwark:maps']`; same 19 fields as the committed `powder-map-1.json` (`_version 2`) |
| Game build (`buildTerrainMap`) | 165 water cells, 133 obstruction cells, 126 resource nodes, 8 rings |
| Pathing | every wave's ground spawn has a route to the base |
| Play | 3 waves ran; units spawned, marched and engaged exactly as on `powder-map-1` |
| 3D bake (`tools/terrain3d-proto/bake3d.mjs`) | produced `level.json`, `road_mask.png`, `routes.json`, ground tiles; `checkLevelAgainstMap` → **ok** |

**How a map reaches the game** (`src/main.js:400-438`): the game looks for the **enemy faction's** slot for the map number, in order:
1. the localStorage slot (the authoring hot loop: Save in the Forge, then Play, same origin);
2. the committed `content/maps/forge/<faction>-map-<n>.json` (the ship path);
3. **temporary playtest mirror:** Powder's map for that number (`TEMP_MIRROR_FACTION = 'Powder'`);
4. the old workbook generator (`buildCampaignMap`, §5).

**Gaps in the loop:**
- **Roads need an offline bake per map.** The 3D view loads `content/maps/baked/<slug>/` for the worn-road mask (`render3d/index.js:377-406`). Only `powder-map-1` has one. A map played from a fresh slot shows a "no baked level" banner and has no roads. To fix that: export the slot file, commit it to `content/maps/forge/`, run `node prototype/test-game/tools/terrain3d-proto/bake3d.mjs <faction>-map-<n>`, and commit `content/maps/baked/<slug>/`.
- **The bake needs dev dependencies.** `bake3d.mjs` imports `@napi-rs/canvas`. It is declared in the root `package.json` but must be installed with `npm install` first.
- **A local bake tune can disagree with the committed bake.** A tune in `localStorage tf.bake.v1` changes the sim's blocking. The game detects the mismatch and says so on screen (`render3d/level.js`), rather than drawing a wrong ground silently.

---

## 3. Pipeline

```
 Terrain Forge (terrain.html)            content/maps/forge/<faction>-map-<n>.json
   generateTerrain · placeBase  ──Save──▶ localStorage slot  ──Export slot──▶ (committed)
   generateResources · spawns                                         │
                                                                       ▼
                            sim/mapgen.js buildTerrainMap(forge, mapId, { bakeTune })
                     waterCells · blockedCells (bakedBlocking) · base + cornerSlots · resources · rings
                                     │                                         │
                    sim (pathing, placement, waves)            render3d (the default view)
                                                     ground mesh · tufts · rocks/trees · apron
                                                     fog · lights/shadow · path lines · tracks
                                                                    ▲
             tools/terrain3d-proto/bake3d.mjs (offline) ──▶ content/maps/baked/<slug>/road_mask.png
```

The sim and the 3D view both build from the **sim's** map object, so what units path around is what is drawn. The baked level only contributes the road mask (and, under `?ground=baked`, the old texture ground).

---

## 4. Data model

### 4.1 Terrain codes (`src/terrain/terrainGen.js:14-19`)

| Code | Name | Blocks movement & building | Share on powder-map-1 | How it is drawn in 3D |
|---|---|---|---|---|
| 0 | GRASS | no | 46% | ground colour + grass detail + tufts |
| 1 | DIRT | no | 14% | ground colour + sand detail |
| 2 | BRUSH | no | 7% | ground colour + 1–2 tufts |
| 3 | ROCKS | **yes** | <1% | boulder (+ pebble 60%) |
| 4 | TREES | **yes** | 4% | tree (decor position first, then fill), 55% round / 45% pine |
| 5 | CLIFF | **yes** | 1% | plateau of stacked boulders, 2–3 courses |
| 6 | WATER | **yes** | 8% | colour bands (shore → foam → light → deep) |
| 7 | TREE_BORDER | no | 11% | coloured as brush, tufts; no trees |
| 8 | ROCK_BORDER | no | 6% | small stone 30% |
| 9 | CLIFF_BORDER | **yes** | 4% | plateau boulders |

### 4.2 Forge map file (`_version 2`)

`cols`, `rows`, `seed`, `types` (pct + noise per type), `water` (mode, pct, noise), `palettes` (2D tile-sheet names), `base` (`pos`, `gap`), `worldMode`, `world`, `worldBase`, `waveWindows[8]`, `spawnTuning`, `spawnsByWave{1..8}`, `spawns`, `resources[]`, `decor[]` (tree positions with `dx/dy/s`), `terrain[cols·rows]`, `blocking[cols·rows]`.

A forge file has **no** rings, play area or safe border, and no world palette key. The planet's palette comes from the faction (§6.1). `forge.world` is the `{w, h}` size object, so as a palette key it reads as null.

### 4.3 What the sim builds from it (`src/sim/mapgen.js:382-579`)

- **Blocking.** Taken from `bakedBlocking`, which re-samples the terrain under the same domain warp the 2D "digicam" bake draws (`terrainBake.js:325-341`). The game always passes a bake tune, so this path is always used. *Measured:* it differs from the authored mask by 1 cell on powder-map-1; the majority vote cancels nearly all of the warp.
- **Water and obstructions.** Code 6 becomes `waterCells` (162); every other blocking code becomes `blockedCells` (182). Pathing, tower placement (PR #110) and troop orders all read these two lists.
- **Base.** A 3×3 keep centred on `base.pos`. The 5-cell plus is the body; the 4 corners are buildable `cornerSlots`, where towers mount on the landing craft (PR #111). `BASE_HP 3000`.
- **Resources.** Authored nodes are bound to a wave window and nudged off occupied cells (search radius 6). 8 starter nodes ring the base gap, then workbook per-wave quotas are backfilled. *Measured:* 112 nodes.
- **Rings.** 8, every one the full map rect (forge maps are open-play); spawn budgets come from the painted spawn points.

---

## 5. Generation

### 5.1 Procedural terrain (`terrainGen.js:72-130`)

- **Noise:** bilinear value noise with smoothstep, 3-octave fBm; base scale `0.04 + noise·0.22`, lacunarity 2.03.
- **Coverage:** each type takes exactly its `pct` of cells via a percentile threshold.
- **Layer order:** dirt, brush (seed+23), rocks (+37), trees (+53), cliff (+71), water (+97). Later layers overwrite earlier ones. Water `connected` mode keeps only the largest blob.
- **Borders:** an 8-neighbour perimeter pass turns the edge cells of trees / rocks / cliff into codes 7 / 8 / 9.
- **Base and resources:** `placeBase` forces the base gap to grass. `generateResources` places at density 0.05, with roles split by distance from the base (< 0.45, < 0.72). `generateEdgeSpawns` places spawns per wave by attack side, spread, placement and spacing.

### 5.2 The 2D "digicam" bake (`terrainBake.js:104`)

This feeds the 2D renderer (`?renderer=pixi`), the `?ground=baked` 3D path and `bakedBlocking`.
- 8 material layers; `sub 5` samples per cell; domain warp 0.6.
- Up to 5120 px wide, 6–24 px per cell; ray-marched shadows at 25° elevation.

### 5.3 Roads (offline, `tools/terrain3d-proto/bake3d.mjs`)

- `findRoute` paths: the primary route plus up to 2 alternates.
- Rasterised at 5 px per cell into a 320×160 wear mask: lane half-width 0.5 + 0.35 shoulder, soft cap at 55% of peak wear.
- Blocked, water and base cells take no wear.
- At runtime the ground colour turns to road edge above wear 0.1 and to road above 0.32 (`render3d/ground/lowpoly.js:91-92`).

### 5.4 Maps with no forge file (`buildCampaignMap`, `mapgen.js:127-353`)

The workbook generator: concentric rings, radially graded resource clusters, a 2-cell safe border with `playArea`, and a BFS spawn-to-base check. Water maps get a meandering 2–3-cell river that leaves a ford.

It produces **no terrain codes, no obstructions and no roads.** The 3D view derives a plain grass/brush ground for these maps (`render3d/ground/synthTerrain.js`). *Measured* on campaign map 2 (34×22): 72% grass, 28% brush, 0 rocks, 0 trees, 0 water.

---

## 6. How it is drawn (3D, the default view)

3D is the default whenever WebGL is available (`main.js:91-97`). `?renderer=pixi` keeps the 2D view.

### 6.1 Planet palette

Each faction's planet picks a world palette (`styles/lowpoly-palettes.js`, `data/planets.js`):

| Faction | Palette |
|---|---|
| Ground / Powder | meadow |
| Air | sakura |
| High Tech | savanna |
| Artillery | canyon |
| Water | winter |
| Arcane | volcanic |
| Space Tech | lunar (was highlands; 2026-10-23, barren grey moon, no grass) |
| Dark Energy | alien |
| Greenies | tropical |

`WORLD_LIGHT` sets the clear colour, apron colour and light levels per world.

### 6.2 Layers

| Layer | What it is | Detail | Cost (powder-map-1, High) |
|---|---|---|---|
| **Ground** (`ground/lowpoly.js`) | Flat plane; vertices every 0.5 cell, interior jittered ±21%; one hashed diagonal per quad; non-indexed | One colour per triangle from blended class fields, noise bands and the road mask; ±5% brightness and ±0.08 normal tilt per triangle (the faceted look) | 16,384 tris, 1 draw |
| **Detail maps** (`ground/grassDetail.js`) | Phong patched in `onBeforeCompile`, High/Standard only | Grass and sand albedo + normal maps (256², one tile per 1.6 / 1.8 cells), weighted per vertex | 4 textures |
| **Water** | Part of the ground mesh | Colour bands by water field: shore > .28, foam > .48, light → deep > .62 | 0 extra |
| **Grass tufts** | 3 open 3-sided cones per tuft, normals up, no shadows | Open grass p = .45, brush 1–2 per cell, tree border | 1,083 tufts, 9,747 tris, 1 draw |
| **Rocks & plateaus** (`obstructions/`) | One merged Lambert mesh, flat shaded, casts shadows | Boulder per rock cell; cliffs stack 2–3 courses; stones on rock borders | 213 pieces, 15,120 tris |
| **Trees** | One merged Lambert mesh | Authored `decor[]` positions first, then every remaining tree cell | 83 trees, 7,336 tris |
| **Apron** | Plane (cols+200) × (rows+200) at Y −0.02 | One colour; no hills or cliffs beyond the map | 2 tris |
| **Height field** (`obstructions/heightField.js`) | Max obstruction height per cell | Gives the flight floor (min 1.6, +0.55 margin, max 4.5) | measured floor 2.92 |
| **Cloud fog of war** (`overlays/fog.js`) | One 400-unit quad; the play area is discarded in the shader | Noise vignette (128² noise; second tap on High) | 1 draw |
| **Path lines** (`overlays/pathLines.js`) | Chevron strips per ground origin, per-wave hues | Fades 0.3 s | per live origin |
| **Track marks** (`fx/trackMarks.js`, PR #112) | One instanced quad mesh | Treads banded, wheels plain; 5 vehicle lengths, 5 s fade | ≤ 2400 / 1600 / 600 marks |
| **Lighting** (`lighting.js`) | Sun 135°/45°, ambient 0.1–0.2, hemisphere ≈ 0.5 | `BasicShadowMap` (hard edges), rendered once, re-rendered only when structures change | shadow map per tier |

No sky dome, no scene fog and no post-processing; MSAA is on.

### 6.3 Detail density

How much information each cell carries:

| Layer | Resolution |
|---|---|
| Sim (pathing, placement, blocking) | 1 sample per cell |
| Ground colour | 8 triangles per cell (High/Standard), 2 (Low) |
| Road wear | 25 px per cell (5 × 5) |
| Grass / sand detail texture | ~160 px per cell (256 px over 1.6 cells), repeating |
| 2D digicam bake | 25 sub-samples per cell, 6–24 px per cell |

Only the detail textures resolve finer than half a cell. Every terrain-type border is decided at triangle size (~0.5 cell), which is why borders read as zigzags (§8).

---

## 7. Budgets per quality tier (`render3d/quality.js:18-33`)

| | High | Standard | Low |
|---|---|---|---|
| Ground grid | 0.5 cell (16,384 tris) | 0.5 cell (16,384) | 1.0 cell (4,096) |
| Grass tufts | yes (~9.7k tris) | yes | no |
| Detail normal maps | yes | yes | no (vertex-lit Lambert) |
| Cloud detail tap | yes | no | no |
| Shadow map | 4096² | 2048² | 1024² |
| Pixel-ratio cap | 2 | 2 | 1.5 |
| Track marks | 2400 | 1600 | 600 |
| **Terrain total (measured)** | **≈ 48.6k tris** | ≈ 48.6k | **≈ 26.6k** (ground + obstructions) |

**Guards in tests:**
- ground tris = (cols/grid)·(rows/grid)·2 (`lowpoly.test.mjs`);
- ground + blades < 30,000;
- obstructions 5,000–60,000;
- Low has ¼ the ground triangles and 0 tufts (`quality.test.mjs`).

---

## 8. Known gaps and issues

| # | Issue | Effect | Where |
|---|---|---|---|
| 1 | Only one authored map; 8 copies plus a Powder mirror | Every faction fights on the same layout | `content/maps/forge/`, `main.js` `TEMP_MIRROR_FACTION` |
| 2 | Roads need a per-map offline bake + `npm install` | New maps play without roads and show a banner | §2 |
| 3 | 5 of 83 decor trees stand on walkable tree-border cells (code 7) | Units walk through those trees | `obstructions/placement.js` (decor first, no cell check) |
| 4 | Generated (workbook) maps have no obstructions, roads or terrain variety | Campaign maps 2–9 are open grass until authored | `buildCampaignMap`, `synthTerrain.js` |
| 5 | Flat ground, no elevation | Cliffs and plateaus are props on a plane; no slopes, valleys or raised base | `lowpoly.js` (Y = 0) |
| 6 | Hard colour edge at every triangle (faceted by design), terrain borders at ~0.5-cell zigzags, no anti-aliasing for colour edges | Zigzag borders crawl when the camera pans; water/shore edges look blocky | `lowpoly.js:67-95`, renderer has MSAA only |
| 7 | Water is static colour | No shoreline foam motion, reflection or depth | `lowpoly.js:93` |
| 8 | Hard shadows (`BasicShadowMap`) | Jagged shadow edges | `lighting.js:62` |
| 9 | Detail textures repeat every 1.6–1.8 cells, no tiling break-up | Visible repetition on open grass | `grassDetail.js` |
| 10 | Beyond the map edge is a flat apron | Fog hides it, but zoomed out the world ends at a plane | `lowpoly.js:256-263` |
| 11 | Blocking warp is near-identity (1 cell differs) | Harmless; the warp's cost buys almost nothing | `terrainBake.js:325-341` |
| 12 | Forge maps have no safe border / `playArea` | Building is allowed up to the map edge | `mapgen.js` (forge path) |

**Smoothing options** (owner question, 2026-10-21), all keeping the Y = 0 plane:

1. **Share vertex colours across triangles**, so ground types blend in gradients. Cheapest, but it drops the faceted look.
2. **Move terrain-type thresholds into the fragment shader**, with smooth class weights per vertex and an anti-aliased `fwidth` edge. Borders become crisp curves at pixel resolution and facets can stay. Recommended.
3. **An FXAA pass**: catches every edge but softens the whole frame.

Separately, `PCFSoftShadowMap` on High would soften shadow edges.

---

## 9. Docs this supersedes or corrects

- `docs/dev/Terrain-Engine-3D-Code-Design.md` describes the `body3d.html` prototype. Out of date:
  - "not yet in the game": 3D is now the default;
  - §4.8 ≈70% fill and off-map hills/cliffs: the code fills 100% with a flat apron;
  - §4.13 outline fog: now a cloud vignette;
  - §4.19 tier table;
  - §7 "≈81k tris idle": the terrain is now ≈49k.
- `docs/dev/Terrain-3D-Ground-Truth.md`: §2 (3D only under `?renderer=three`) and §11 (one level in 3D) are out of date. §4 (the raw `forge.blocking` fallback trap) still holds.
- `CLAUDE.md` cites `docs/16 Bulwark MM/design/Unit-Shading-Design.md` and `Shading-Epics.md`; neither exists.
- `src/main.js:250` comment ("Pixi canvas by default") is out of date.

Plan of record for the engine: `docs/tech-plan/Terrain-Engine-3D-and-Threejs-Migration.md`.

---

## 10. Sources

Code: `src/terrain/terrainGen.js`, `src/terrain/terrainBake.js`, `src/sim/mapgen.js`, `src/main.js` (map loading), `src/render3d/index.js`, `src/render3d/level.js`, `src/render3d/ground/{lowpoly,grassDetail,synthTerrain,baked}.js`, `src/render3d/obstructions/{placement,lowpoly,heightField}.js`, `src/render3d/overlays/{fog,pathLines}.js`, `src/render3d/fx/trackMarks.js`, `src/render3d/lighting.js`, `src/render3d/quality.js`, `src/render3d/styles/lowpoly-palettes.js`, `src/data/planets.js`, `tools/terrain3d-proto/bake3d.mjs`, `terrain.html`.

Data: `content/maps/forge/*.json`, `content/maps/forge/README.md`, `content/maps/baked/powder-map-1/`, `content/maps/wave-windows.js`.
