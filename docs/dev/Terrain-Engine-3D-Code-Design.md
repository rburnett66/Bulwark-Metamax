# Bulwark — 3D Terrain Engine & three.js Renderer: Code Design (handoff)

**Status:** prototype complete, not yet in the game. **Revision 2 (2026-10-13, late):** adds world-impact
effects (§4.11b) and metallic unit shading (§4.11), with their owner direction, measurements, port layout,
board stories and open questions. This document is the handoff from the prototype
session (claude.ai cloud session, 2026-10-13) to a repo-rooted CLI session that will port the code into
`prototype/test-game/`, write the MetaMax tech plan, and open the PR.

**Provenance.** Owner sentences are quoted and marked **owner**. Everything else is **agent-proposed**,
written from the prototype source in this bundle (read, built and run headless — not traced on a
device). Repo baseline for everything here: `rburnett66/Bulwark-Metamax` `main` @ `31b62eb`.

**Board.** Epic `epic_mv77hbbc_1` "3D Terrain + three.js Renderer" on Bulwark MM (project 16), stories
listed in §12. MetaMax documents already posted (all `provenance: claimed`):
`TECH_PLAN::Terrain-Engine-3D-and-Threejs-Migration.md` (**v2.1**, version `ea8337bf627d` — adds effects and
metal units, Dependencies table fixed and parsed as 3 rows) and `DEVELOPMENT::Neon-Voxel-Art-Style.md`
(**v1.3**, version `539a3aadd90c` — adds unit-material and effect looks and the 11 world palettes).
Evidence appended to T1 `story_mv77himr_3` and T5 `story_mv77hv5d_7`.

**Landed in the repo 2026-10-14** (`[MM-story_mv87jtfa_3]`, branch `feat/terrain3d-port`). Where this
document and the repo now differ, the repo wins:
- Tool deps are dev-only in the root `package.json` (`three@0.128.0`, `@napi-rs/canvas@0.1.100`): run
  `npm install` at the repo root. Nothing under `prototype/test-game/` depends on them. (The root
  `package.json` must NOT set `"type": "module"` — that re-parses every `.js` in the repo and failed 63 tests.)
- `bake3d.mjs [mapId]` writes the renderer's inputs to **`content/maps/baked/<mapId>/`** (committed — tiles,
  half-res ground, road mask, `routes.json`, `level.json`); 2D-prototype leftovers and previews go to the
  gitignored `tools/terrain3d-proto/out3d/`. The local bake of powder-map-1 is byte-identical to the cloud
  bake in this bundle (48 ground spawns → 137 polylines).
- `build3d.mjs` concatenates head + body itself (no `template3d.html` step) and writes the gitignored `dist/`.
- `test3d.py`, `shot.py` and `compare.html` load three.js from the repo-root `node_modules`. The paths in §3.3
  were already repo-relative; the real defect was `new URL(import.meta.url).pathname`, which breaks on Windows
  (`/C:/…`), now `fileURLToPath`.
- The published `dist/*.html` pages are not committed (reproducible, ≈4.4 MB).

---

## 0. Contents of this handoff bundle

Paths are repo-relative as they would land in `rburnett66/Bulwark-Metamax`. Nothing here is wired into
the game; the bundle is a reference implementation plus its tools.

| path in bundle | what it is |
|---|---|
| `docs/dev/Terrain-Engine-3D-Code-Design.md` | this document |
| `prototype/test-game/tools/terrain3d-proto/src/head3d.html` | page head: CSS, HUD/dock markup, three.js `<script>` tag |
| `prototype/test-game/tools/terrain3d-proto/src/body3d.html` | the whole engine (1,772 lines, one `<script>`, one IIFE) — §4 |
| `prototype/test-game/tools/terrain3d-proto/bake3d.mjs` | offline level bake (Node) — §2 |
| `prototype/test-game/tools/terrain3d-proto/build3d.mjs` | assembles head + body + data into one HTML file — §3 |
| `prototype/test-game/tools/terrain3d-proto/test3d.py` | headless Playwright harness (screenshots + HUD stats) — §3 |
| `prototype/test-game/tools/terrain3d-proto/out3d/` | baked assets for powder-map-1: 6 ground tiles, half-res ground, road mask, `level.json`, `routes.json` |
| `prototype/test-game/tools/unit-models/src/prims.js` | primitive model builder — §6 |
| `prototype/test-game/tools/unit-models/src/models.js` | the four unit definitions — §6 |
| `prototype/test-game/tools/unit-models/src/viewer.html` | unit model viewer page (orbit / ortho 4-up / battle scale / styles) |
| `prototype/test-game/tools/unit-models/src/compare.html`, `compare.py`, `measure.py`, `build.py`, `shot.py` | reference-sheet → model verification loop |
| `prototype/test-game/tools/unit-models/ref/` | the owner's four orthographic reference sheets (thumbnails + per-view crops) |
| `dist/terrain-proto.html`, `dist/unit-models.html` | the two built, self-contained pages (≈4 MB / 0.46 MB) as published |

**Absolute paths.** The scripts were written in a cloud container and contain absolute paths
(`/home/claude/rburnett66/bulwark-metamax/...`, `/home/claude/proto/...`, `/home/claude/units/...`). Fix
these to repo-relative paths before running anything (§3.3).

Published artifacts (claude.ai, private to the owner): "Bulwark Terrain Engine" (v9: effects + metal units)
and "Bulwark Unit Models" (v3: adds the "Studio metal" style).

---

## 1. What was decided (owner direction, 2026-10-13)

**owner** goals (verbatim where quoted):
1. "the ground plane should have texture that feels like terrain"
2. "the playable ground is a single 2D plane"
3. "the game will be about lines of enemies attacking the base"
4. "their will be resource fields (groups of cell) for collection"
5. "obstructed terrain should be filled with trees, large rocks, and plateaus"
6. "foliage should be very efficient but will only be viewed from one angle"
7. "shadows should be accurate and consistent, and terrain shadows can be baked"
8. "the cell distribution for the terrain is 100% based on the existing scale"
9. Worn-road pathing: "The map visuals should precalculate expected pathing and layout texture to indicate a probable path for troops and units, like a worn dirt road. The path should have edging detail but we will expect congested unit to pick alternate path occasionally."
10. Path lines: "draws the expected pathing from spawn to base on the ground. Which will update if obstructed by a tower or wall unit"; "The path overlays should always be on during the battle"; "the line from spawn to the base will only be on while units from that spawn are alive. Each wave lines should be drawn will a slightly different color"; "We will need to add that to the simulation."
11. "Three.js replaces the pixi renderer. Before Unity. Let's focus on terrain performance first and later we can choose unit tech. Keep sprites for now. Web mobile and web desktop." (Units later went 3D — see 14.)
12. "Water is a simple terrain type that affect unit speed … It can be added in a later phase."
13. "Camera rotation is done before and after battle .. but during battle the camera will pan but not rotate." "Terrain forge has a way to identify cells as obstruction so we should use existing terrain data."
14. "iPhone 12 and pixel 6 is fine. Realtime shadows can be turned off on low end devices." "Preview of route impact is not necessary but placement should be check for validity."
15. On the first prototype: "a 3d terrain engine needs to be 3d ??" → real 3D camera and geometry (v2.0).
16. On styles: neon voxel was asked for ("neon minecraft look"); then "This kind of blocky stylized organic look for groun, rocks, mounds, trees, would be good"; then "Low poly organic is the best yet"; then "can we create 10 more color variations of the low poly world?"
17. On units: ortho sheets supplied for four units; "LOVE THE TANK", "All of them are perfect"; "lets test it" (3D units in the engine).
18. Process: "Before we PR I feel like we might need to run this as a proper session through Metamax."
19. Effects: "now that we have a truly 3d world. I would like to create particle effects that look like impact the world. Like sparks that bounce off the tank and hit the ground. Or tanks the explode their turrets off and burn." → §4.11b.
20. Materials: "Is it possible to use a material shader to give the tanks a more metallic look?" → §4.11.

Terminology (owner): a **LEVEL** is the game layout played on a **MAP**.

---

## 2. Offline bake — `bake3d.mjs`

Runs in Node and imports the repo's **own** modules, so the ground, the blocking and the routes are
exactly what the current game computes. Requires `@napi-rs/canvas`.

1. **Canvas shim.** `bakeTerrain` falls back to `document.createElement('canvas')` without
   `OffscreenCanvas`; the script sets `globalThis.document = { createElement: () => createCanvas(1,1) }`.
2. **Map.** `buildTerrainMap(forge, 1, { seed: 0, bakeTune: {} })` from `src/sim/mapgen.js` — the call
   `main.js` makes. Blocking comes from the bake's `bakedBlocking` (domain-warped outline), **not** the
   raw forge `blocking` mask; water cells go to `waterCells`.
3. **Ground image.** `bakeTerrain({cols, rows, terrain}, { cliffDrop: 0, shadow: false })` from
   `src/terrain/terrainBake.js`: 5120×2560 for 64×32 (PX_PER_CELL 80, sub 5 × 16 px), digicam material
   stack, **no painted cliff faces and no painted self-shadow** (3D geometry and the shadow map replace
   them).
4. **Routes.** `buildNavGrid(map, [])` (no base footprint — identical to sim `core.js`; passing the base
   cells produced 0 routes). For every ground spawn of every wave: `findRoute(nav, spawn, base)` plus up to
   2 alternates using the `seedRoute` avoid pattern (avoid buffer 1, then 0). Weights 1.0 / 0.35 / 0.15.
   powder-map-1: 48 ground spawns → 137 polylines (`routes.json`).
5. **Wear field.** Polylines rasterised at SUB = 5 per cell: flat core half-width 0.5 cell + 0.35 shoulder;
   summed by weight; normalised to 55% of the busiest corridor; zeroed on blocked, water and base cells.
6. **Road paint** (into the ground image, digicam blocks of `DIGI` px): bands EDGE ≥ 0.06, WORN ≥ 0.16,
   CORE ≥ 0.38 with ±0.03 hashed jitter per block; 3 dirt tones per band derived from the bake's dirt
   (#785632); pebbles on 6% of WORN blocks; EDGE leaves 45% of blocks as grass with brighter tufts; a dark
   seam on the road's north edge; road colour multiplied by the luminance of the baked pixel underneath.
7. **Outputs** to `out3d/`: `ground_{tx}_{ty}.webp` (≤2048 px tiles, lossless; 6 tiles ≈1.86 MB),
   `ground_half.webp` (2560×1280), `road_mask.png` (320×160, R = wear 0–1, written for stylised
   renderers), `routes.json`, `level.json`, plus legacy `pine.png`, `shadow_mask.png` (2D prototype only).

`level.json` schema: `{ cols, rows, PX_PER_CELL, base:{x,y}, baseCells:[{x,y}], blocked:[cellIndex],
water:[cellIndex], terrain:[code per cell], decor:[{x,y,type,dx,dy,s}], waveWindows:[{wave,w,h,x,y,attack}],
spawnsByWave:{wave:[{x,y,lane,...}]}, resources:[{x,y,role,color}], tiles:[{name,x,y,w,h}], pine, shadowAlpha
(0.24), maskPx }`. Cell index = `y * cols + x`. Wave windows are 1-based (`x - 1` is the left cell).

Terrain codes (`terrainGen.js TERRAIN_NAME`): 0 grass, 1 dirt, 2 brush, 3 rocks, 4 trees, 5 cliff, 6 water,
7 tree-border, 8 rock-border, 9 cliff-border. On powder-map-1 the blocking set is exactly 3, 4, 5, 6, 9.

---

## 3. Build and test tooling

### 3.1 `build3d.mjs`
Reads `src/head3d.html` + `src/body3d.html` (concatenated beforehand into `src/template3d.html`) and
replaces four placeholders:
- `/*__LEVEL__*/null` → `level.json`
- `/*__IMAGES__*/{}` → data-URIs: every ground tile by name, `roadMask`, `tankBody`, `tankTurret`,
  `tankBodyShadow`, `tankTurretShadow` (from `content/units/voxel/GND-Tanks.*.png`)
- `/*__PATHFINDING__*/` → the repo's `src/sim/pathfinding.js` **verbatim**, from `function clampInt` up to
  the `/**\n * Fixed water-lane` comment, with `export ` stripped
- `/*__UNITS__*/` → `tools/unit-models/src/prims.js` + `models.js`

Output `dist/terrain-proto-3d.html` (~3.9 MB). In the game none of this inlining exists (§10).

### 3.2 `test3d.py`
Playwright + headless Chromium with SwiftShader (`--use-gl=angle --use-angle=swiftshader`). It inlines a
local three.js r128 build (`node_modules/three/build/three.min.js`) in place of the CDN tag, strips the
font links, writes `dist/test3d.html`, loads it and prints the HUD stats. Actions (argv[1]): `desk`,
`phone` (390×844 @2×, touch), `stress`, `place` (wall placement + gold check), `zoom`, `day`,
`style:<preset>`, `lpzoom`, `max` / `maxsprite` / `maxfull` / `maxneon` (400-unit flood), `unitzoom`,
`allpal` (screenshots every low-poly palette), `boom` (zooms in, presses **FX demo**, screenshots `boom_0..6` at
1.5–9.5 s), `metal` (parks a still line-up via `__showroom()`, screenshots Meadow / Dusk / Neon with metal on and
off → `metal_<style>_on|off.png`). SwiftShader runs the `setTimeout`-driven demo in slow motion; that is not a bug. **Frame rates under SwiftShader are meaningless; draw calls,
triangles and CPU submit time are valid.**

### 3.3 Running it in the repo
1. `npm i three@0.128.0 @napi-rs/canvas` (dev-only, for the tools).
2. Replace absolute paths with paths relative to `prototype/test-game/`.
3. `node tools/terrain3d-proto/bake3d.mjs` → `cat src/head3d.html src/body3d.html > src/template3d.html`
   → `node tools/terrain3d-proto/build3d.mjs` → open the dist file (it needs network for the three.js CDN tag
   and Google Fonts; `test3d.py` inlines three.js for offline runs).

---

## 4. Runtime engine — `body3d.html`

One IIFE (`main()`), ordered by section. Line numbers are approximate (body3d.html as bundled).

### 4.1 World, camera, renderer (L14–63)
- **Axes:** X = column (east), Z = row (south), Y = up; **1 world unit = 1 cell**; play surface = plane Y=0.
- **Sun:** `sun.js` azimuth 135° (top-left on screen = north-west), elevation 45°.
  `SUN = (-cos el·√½, sin el, -cos el·√½)`. Later moved per style by `setSun(azOff, elDeg)` (§4.18).
- **Camera:** `PerspectiveCamera(FOV 30, near 0.5, far 600)`, pitch **37°** (= the GND-Tanks sprite bake
  camera elevation, so sprites match the geometry), `cam = { tx, tz, dist, yaw, yawTarget }`.
  `applyCam()`: position = target + dist·(sin yaw·cos p, sin p, cos yaw·cos p); clamps dist 10–95 and the
  target to the map ±2; refreshes `camRight / camUp / camFwd` (shared uniforms for billboards).
- **Renderer:** `WebGLRenderer({ antialias, stencil: true })`; `shadowMap.enabled`, `type = BasicShadowMap`
  (hard edges), **`shadowMap.autoUpdate = false`** — the static shadow map is rendered once and again only
  when `renderer.shadowMap.needsUpdate = true` (structure change, tier change, style/sun change).
  `renderer.info.autoReset = false` (reset manually per frame so post passes are counted).
- **Lights:** `AmbientLight` (`ambient`), `DirectionalLight` (`sun`, `castShadow`, ortho shadow camera ±42
  around the map centre, near 1 far 220, bias −0.0006 — **`updateProjectionMatrix()` is required after
  setting the extents**, else three keeps ±5), `HemisphereLight` (`hemi`, intensity 0 except low-poly).
  Balance: `AMB = 0.6`, `DIR = (1 − AMB)/SUN.y` so a sunlit flat ground shows its texture exactly and
  shadowed ground is 0.6 of it.

### 4.2 Helpers (L65–108)
`loadImage`, `texFrom(img, nearest)` (no mipmaps, linear min, nearest or linear mag, anisotropy ≤4),
`hash2(x,y,s)` (integer hash → [0,1)), `angleBucket(rad, n)` (= `render/voxel/select.js`),
`frameUV(img, cellW, cellH, cols, i)` (atlas frame → [u0,v0,u1,v1]).
`class Geo` — flat-shaded box/quad builder with per-vertex colour and **`aEdge`** (per-face local
distances `(u, v, w, h)` so a shader can draw block edges): `quad(a,b,c,d, normal, colour, uvs?)`,
`box(cx, y0, cz, sx, sy, sz, top, side, skip?)`, `build()` → BufferGeometry (position, normal, color, aEdge,
uv?). `hex(h)` → [r,g,b].

### 4.3 Style system (L110–226)
- `STYLE` shared uniforms: `uNeon` (0/1), `uTime`, `uRoad` (road mask texture), `uMap` (cols, rows),
  `uUnitTint`. `GU` ground uniforms: `uGTint, uGSat, uSeam, uMono, uGridCol/K, uRoadCol/K, uWaterCol/K,
  uWaterBase/K, uLow, uTerr`. `KINDU[kind]` = per-kind face/edge uniforms; `SETS = { blocky:[], low:[] }`.
- **`stylize(mat, o)`** injects into a stock `MeshLambertMaterial` via `onBeforeCompile`, so lighting, the
  hemisphere light and the shadow map keep working:
  - vertex: declares `aEdge, vEdge, vWPos, vWNrm`; after `#include <project_vertex>` computes world position
    and world normal (handles `USE_INSTANCING` via `instanceMatrix`).
  - fragment: after `#include <color_fragment>` — if `GROUND == 1 && uLow > 0.5` the low-poly ground branch
    (terrain colour texture, noise bands, road blend, triangle facets — used only by baked tiles, the
    low-poly ground mesh replaced it, §4.8); else if `uNeon > 0.5`: GROUND → night-tinted terrain, per-cell
    brightness, cell seams, emissive grid/roads/water; non-ground → dark face colour × 8×8 pixel noise +
    emissive edges from `edgeDist()` (`EDGE_MODE 1` = face-local `aEdge`, `2` = world lattice 1×0.5×1 for
    plateaus, axes chosen by world normal).
  - `outgoingLight += neonEmit`.
  - `customProgramCacheKey` = `sty{mode}{ground}`; `o.kind` registers the uniforms in `KINDU`.
- `NEON` = per-kind `{ kind, mode, face, edge, edgeW }` for plateau, rock, tree, base, wall, tower.

### 4.4 Billboard sprite batches (L228–307)
`class SpriteBatch(tex, cap, mode, renderOrder, nudge, look)` — one `InstancedBufferGeometry` quad with
instanced `iPos(3) iSize(2) iPivot(2) iUV(4) iCol(4)`; `begin() / push(...) / end()` per frame.
- `BB_VERT`: camera-facing billboard anchored at the ground contact point, built from `camRight/camUp`,
  pulled `nudge` toward the camera; depth-tested against the 3D scene (no painter's sort).
- `SH_VERT`: a sprite's baked **shadow atlas frame laid flat** on Y=0.02, stretched by 1/sin(37°) along
  the view so it projects to the drawn shape.
- `FRAG_CUTOUT`: alpha cut 0.45; in neon styles transparent texels within `uTexel` of the silhouette become
  an outline colour (8 taps); opaque texels × `uTint × uBoost`.
- `FRAG_SHADOW`: black × alpha with **stencil-once** (`NotEqual ref 1`, `Replace`) — overlaps never
  double-darken. `FRAG_ADD`: additive glow.

### 4.5 Level state (L309–322)
`blockedSet, waterSet, mapForNav` (cells for `buildNavGrid`), `BASE`, `baseKey`, `structures[]`,
`structVersion`, `nav = buildNavGrid(mapForNav, [])`, sim stand-in state
`S = { gold, wave, units[], projectiles[], fx[], lines: Map, nextUnitId, spawnQueue[], time, stress, orbit }`.

### 4.6 `build()` (L324–354)
1. Load every data-URI image.
2. Ground tiles: `PlaneGeometry(t.w, t.h)` rotated flat, `stylize(Lambert{map, depthWrite:false},
   {ground:true})`, `receiveShadow`, renderOrder 0 → `groundFull[]`. A half-res canvas composite →
   `groundHalf` (Low tier) and `halfTex` (plateau tops).
3. Apron: 200-cell Lambert plane at Y −0.02, renderOrder −1, `receiveShadow`.
4. `STYLE.uRoad = road mask`; `IMGS = imgs`.
5. `buildPlateaus(); buildRocks(); buildTrees(); buildBase(); buildLowPoly(LOWPAL.meadow);`
6. `buildResources(); buildUnitBatches(imgs); buildUnits3D(); buildFx(); buildFx3D(); buildLines(); buildFog(); buildGhost(); rebuildStructures();`

### 4.7 Voxel geometry set (L586–669) — registered in `SETS.blocky`
- **`buildPlateaus()`**: blocked cells with code 5 or 9 → extruded blocks, height `PH = 1.0` (two half-cell
  courses). Tops textured from `halfTex` (`stylize ground`); side faces only where the neighbour is not
  plateau, 4 columns × 3 bands per face (bright bottom 12%, mid, dark top 36%), three rock tones; two merged
  meshes, `cast/receiveShadow`.
- **`buildRocks()`**: one `InstancedMesh` of a 4-box boulder (`rockGeometry`) — large on blocked code-3
  cells, small on 35% of code-8 cells (hashed); random 90° yaw.
- **`buildTrees()`**: one `InstancedMesh` of a stepped voxel pine (`pineGeometry`: trunk + 5 tiers) at
  `LEVEL.decor` positions with authored offset/scale and hashed height/yaw.
- **`buildBase()`**: base as boxes (3×3 footprint, corner turrets, keep).

### 4.8 Low-poly organic set (L358–585) — registered in `SETS.low`
- `rng(seed)` (mulberry32), `class Merge` (append transformed geometry with one flat colour per triangle,
  ±jitter; `mesh()` → vertex-coloured Lambert, cast+receive shadow, hidden, pushed to `SETS.low`),
  `blob(detail, seed, amt)` (icosphere with hashed per-vertex displacement; duplicated vertices keyed by
  rounded position so the shape stays closed).
- `LOWPAL` — 11 palettes: meadow, autumn, winter, canyon, tropical, sakura, dusk, volcanic, alien, highlands,
  savanna. Fields: `rock[4], rockB, pebble, tuft, ground{lime, grass, teal, brush, forest, stone, lilac, sand,
  dirt, road, roadEdge, shore, foam, waterL, waterD}, canopy[5], rare, pine[4], trunk, hills[4], cliff[4]?`.
- **`buildLowPoly(LP)`** — disposes and rebuilds the whole set (same seed → identical geometry and placement;
  only colours change):
  1. Terrain colour `DataTexture` (one texel per cell) → `GU.uTerr` (used by the shader branch only).
  2. **Rocks:** plateau cells → stacked faceted boulders, up to three courses (2nd if ≥2 plateau neighbours,
     75%; 3rd if 4 neighbours, 45%); code 3 → boulder + pebble; code 8 → small stones (30%).
  3. **Low-poly ground mesh** (`lowGround`, depthWrite off, renderOrder 0): 0.5-cell grid, interior
     vertices jittered ±21% of the spacing, border fixed, diagonal per quad by hash, **one flat colour per
     triangle** from `colAt(x, z)` at the centroid, normal tilted up to ±0.08 per triangle. `colAt`:
     two-octave value noise bands teal → grass → lime; bilinear class fields (grass/brush/dirt/water/tree/rock/
     stone/cliff as 0/1 grids) blend brush, forest floor, stone, lilac; dirt > 0.32 → dirt/sand; road mask
     (CPU-decoded from `IMGS.roadMask`) 0.10–0.32 → road edge, > 0.32 → road; water field 0.28/0.48/0.62 →
     shore / foam / light→deep water; ±5% per triangle.
  4. **Grass tufts:** 3 leaning 3-sided blades per tuft on open grass (45% of cells) and brush (1–2), never on
     roads, coloured from the ground, normals forced up, no shadow casting.
  5. **Trees:** ROUND 55% (blue Y-trunk: trunk + two angled branches; icosphere canopy, rare white) and PINE
     45% (2–3 stacked six-sided cones), from `decor[]` + ≈70% fill of blocked tree cells + 220 outside the map.
  6. **Outside world:** 140 faceted hills sunk to show their caps (kept clear by `r·1.35 + 2`), 70 boulder
     cliffs north of the map.

### 4.9 Resources (L671–690)
Crystal sprites (4 colours from a generated 128×32 canvas) in a `SpriteBatch` (boost 2.6 for neon) plus a
dark "tilled" decal per field cell (`resDecal`, hidden in low-poly).

### 4.10 Sprite units (L692–711)
`TANK` = the GND-Tanks pack: body 16 facings (4 cols, cell 216×266, pivot 108×158), turret 64 angles
(8 cols), mount [−12, 0, 27], footprint 64, renderScale 2, tiles 2, layerSpacing 0.88, light azimuth 179.
`VOXEL_UNIT_SCALE 0.5` (= `render/voxel/loader.js`). `buildUnitBatches` creates body, turret and two
shadow batches. Draw (§4.16): body frame = `angleBucket(heading + yaw, 16)`; turret frame from aim; turret
anchor = contact + mount rotated by heading × voxel size, lifted along `camUp` by `mount.z × layerSpacing`.

### 4.11 3D units (L713–841)
- `UNIT_TYPES ['tank','buggy','beetle','jet']`, `UNIT_MIX [0.4,0.3,0.2,0.1]`, `UNIT_SPEED`,
  `UNIT_SCALE 0.27` (hull 4 model units ≈ 1.08 cells), `UNIT_CAP 500`, `UCOL` (studio palette per material key).
- **`unitMaterial(metalU = U3.uMetalK)`** — `MeshPhongMaterial` (per-pixel) + `onBeforeCompile`, so the sun,
  ambient and hemisphere lights keep working. Attributes: `aEmit` (1 on glow/amber parts) and **`aMR`**
  (metalness, roughness) written per vertex at merge time from **`UMETAL[materialKey]`**:

  | key | metal | rough | | key | metal | rough |
  |---|---|---|---|---|---|---|
  | hull | 0.55 | 0.45 | | black | 0.4 | 0.6 |
  | hull2, panel | 0.6 | 0.4 | | track | 0.3 | 0.75 |
  | dark | 0.7 | 0.35 | | metal | 0.95 | 0.2 |
  | glass | 1.0 | 0.05 | | glow, glowB, amber | 0 | 1 (unlit) |

  Fragment, after `#include <lights_phong_fragment>` (`mtl = metal·uMetalK`, `rgh = mix(0.6, rough, uMetalK)`):
  diffuse × (1 − 0.72·mtl); specular colour `mix(0.05, base·1.6 + 0.15, mtl)` (metals tint their highlight,
  zero on emissive parts); shininess `mix(6, 110, 1 − rgh)`. After `outgoingLight`: a **fake environment
  reflection** — view-space `reflect(−V, N)` taken to world space (`vec4(R,0)·viewMatrix`), a two-colour
  environment `mix(uEnvGround·0.3, uEnvSky·(0.75…1.1 brighter toward the horizon), smoothstep(−0.12, 0.18, Rw.y))`,
  fresnel `pow(1 − N·V, 4)`; added as `env · (mix(0.03, base, mtl)·(0.75 − 0.6·rgh) + fr·(0.3 − 0.22·rgh)) · uMetalK`.
  Then as before: non-emissive colour × `uFace`, emissive output `baseCol × uEmit`, `+ uRim × vRim` (neon outline).
  Result: tops of hulls catch the sky, vertical sides pick up the darker ground, curved shells get a hot
  highlight — reads as metal with no env map, no PBR and no extra draw call. `uMetalK` 0 = the old flat look
  ("Metal units" checkbox). Wrecks pass their own uniform `FX.wreckMetal` (0.1) so charred hulls stay matte.
  `U3.uEnvSky / uEnvGround` are set by `applyStyle` (§4.18).
- **`unitShadowMaterial()`** — planar projection: `w = modelMatrix · instanceMatrix · p; w −= L·(w.y/L.y);
  w.y = 0.03`; black × alpha (`min(0.5, shadowAlpha·1.4)`), stencil-once like sprite shadows. `U3.uSunDir`
  follows `setSun`.
- **`lodDef(def)`** — drops parts flagged `d` (detail: tread cleats, hubs) and parts whose middle extent is
  < 0.12 model units (glow parts < 0.05); caps cylinder segments at 6.
- **`buildUnits3D()`** — per type, per variant (full, LOD), per group (body, turret): merge all parts into ONE
  vertex-coloured geometry with `aEmit` and `aMR`; one `InstancedMesh` each; each group also gets a planar-shadow
  `InstancedMesh`; **all three share one `instanceMatrix` buffer**. Logs `UNITTRIS`.
- **Shadow proxies (`shadow.js`, `shadowDef(def)`)** [MM-story_mvibvqd2_7] — the planar shadow casts a PROXY, not the
  LOD mesh (which was ~half of all unit triangles). Derived per group from the model's parts ranked by shadow throw
  (ground footprint + side × 1/tan(sun elevation)), skipping glow parts, rotors (`spin*`) and parts boxed inside a part
  already chosen; each part reduced to its cheapest form (box; cylinder ≤ 6 sides, 4 for rods; ellipsoid at 6 segments;
  extrusion ≤ 8-point outline — big rings keep an 8-point hole, tracks and small rings cast solid; loft ≤ 5 sections ×
  ≤ 6 points). Budgets per group (`SHADOW_GROUP_BUDGET`: body 300 (+80 for flyers), turret 90, barrel 90, deploy 30),
  `SHADOW_MAX_TRIS` 560 per model. A model may author `shadow`: an array (whole proxy) or `{ group: [parts] }` (those
  groups only — the Arcane organ battery casts its pipe bank as one slab). Wrecks cast the same proxy (`lodGroups()`
  returns `shGeo`). Average per unit: ~380 shadow tris vs ~1,450 LOD. Review tools: `tools/unit-models/shadows.py`
  (old vs new silhouettes per faction), `field.py` (a faction through `createUnits3D` with live shadows).
- **`drawUnits3D(units, liveShadows)`** — per unit: `T(x, y, z) · Ry(−heading) · S(UNIT_SCALE)`; turret
  `· T(pivot) · Ry(−(aim − heading))`; jets hover at 1.1 cells with a bob. Counts per type; LOD on when
  `U3.lodMode === 'on'` or (`'auto'` and `cam.dist > 22`).
- Heading convention: model forward is +X; `heading = atan2(dz, dx)` in the cell grid; rotation Y = −heading.

### 4.11b World-impact effects (L842–1181) — `buildFx3D`, `fxHit`, `fxGround`, `fxExplode`, `boom`, `stepFx`, `drawFx`
Presentation only: reads hits and deaths, never changes the sim. CPU-simulated particles drawn by GPU-instanced
batches. `FX = { wind (0.35, 0, −0.18), G 11, shake }`.

**Batches** (built in `buildFx3D`):
| object | type | cap | renderOrder | blend |
|---|---|---|---|---|
| `FX.add` | `PBatch` — sparks, fire, flash, embers | 4000 | 4.2 | additive |
| `FX.smoke` | `PBatch` — smoke, dust | 1500 | 4.1 | normal |
| `FX.decDark` | `DBatch` — scorch marks | 300 | 1.2 | normal |
| `FX.decAdd` | `DBatch` — shock rings, fire-light pools | 300 | 1.3 | additive |
| `FX.chunkMesh` | `InstancedMesh` box, Lambert `0x4a4644` | 400 | default | — |
| `FX.wreckMesh[type][group]` | `InstancedMesh` of the unit's **LOD** geometry + planar-shadow mesh sharing its `instanceMatrix`; `unitMaterial(FX.wreckMetal)`, cache key `unit3d-wreck`; `instanceColor` (0.42, 0.38, 0.35) = char, set **before** `count = 0` (setColorAt sizes the buffer by count) | 120 per type per group | 3 / 2 | — |

- `PVERT/PFRAG`: one quad per particle, **velocity-stretched** in view space (`dir` = view-space velocity, the
  quad's normal is `vec2(dir.y, −dir.x)` — the other sign mirrors the quad and it is back-face culled); length
  = width + stretch; round soft falloff; `uAdd` selects premultiplied additive or alpha output.
- `DVERT/DFRAG`: flat quads on the ground with `iSize = (radius, rotation, kind, seed)`; kind 0 scorch
  (blotchy, wavy-edged dark disc), 1 shock ring, 2 light pool (`(1 − r)²`).
- Particle kinds `K_SPARK, K_FIRE, K_FLASH, K_EMBER, K_SMOKE, K_DUST`; `emit()` (hard cap 5,200 live), `decal()`
  (ring buffer of 280).

**Events → effects:**
- **`fxHit(x, z, dirx, dirz, y, n)`** — a round hitting armour. 70% of sparks ricochet back off the plate
  within ±0.8 rad, 30% skate sideways (±0.9–1.6 rad); speed 2.2–5.2, up 0.8–3.2; plus a flash and two puffs of
  smoke. Hover units are hit at y + 1.1.
- **`fxGround(x, z)`** — a miss: 6 dust, 4 sparks, a dusty puff, a small scorch (6 s).
- **`fxExplode(u)`** — a kill (3D mode):
  - ground units: `boom(x, z, 1)`; the **hull stays** as a wreck (slight random pitch/roll) burning 7–10 s;
    the **turret is blown off** — start = turret pivot rotated by heading × `UNIT_SCALE`, yaw = last aim,
    launched up 4.2–6.0 and sideways 0.6–1.6, spinning; bounces up to twice, settles, burns 5–8 s.
  - hover units (jet): no boom in the air — flash + fire, then the body **falls** with its forward momentum
    and tumble, trailing fire and smoke, and booms where it hits the ground, then burns.
  - units that reach the base still use the small `boom(…, 0.6)`.
- **`boom(x, z, k)`** — flash; fire ×14k; sparks ×28k; smoke ×8k; chunks ×6k (size 0.025–0.055, life 2–3.5 s);
  scorch (22 s), expanding shock ring, light pool; camera shake +0.12k (cap 0.25).
- **`fxBurn`** — per burning wreck per frame: fire 26k/s, smoke 7k/s, embers 3k/s, plus a flickering light pool.

**`stepFx(dt)`** — particles: gravity for sparks/embers/dust, buoyancy and wind drift for fire/smoke, growth
for smoke; sparks and dust **bounce** on Y=0 with restitution 0.38 and skid; chunks spin, bounce and rest;
wrecks integrate, bounce, burn, and **sink** into the ground 6 s after the fire is out, then are removed.
**`drawFx()`** — sparks white-hot → orange → red with age, streak length from speed; fills every batch;
camera shake applied in `frame()`.

**Prototype hooks:** projectile hit in `step()` → `fxHit` on a unit / `fxGround` otherwise (35% of visual-only
stress shots); `killUnit` → `fxExplode`; units with `u.parked` skip movement; dock button **FX demo**
(`#detonate`) parks six units at the view centre, rakes them with 26 hits, then kills them 0.42 s apart;
`window.__showroom()` parks a still line-up (shading checks); debug globals `__FX, __emit, __cam`.

### 4.12 Path lines (L1183–1240)
One mesh for all live lines. Per line (keyed `wave:spawnId`): route from `findRoute(nav, spawn, BASE)`;
ribbon of quads, half-width 0.16, offset sideways by `((wave−1) % 3 − 1)·0.13` so overlapping waves separate;
Y = 0.05; attributes `aDist aAcross aColor aAlpha aProg`. Shader: discard beyond `aProg` (draw-in), chevrons
`fract((dist − t·1.6)/0.9)` with `fract(f + |across|·0.32)` (tips point to the base), soft edge.
Colour: `WAVE_HUES [186,198,174,210,162,222,150,234]`, lightness 62/52% alternating. Life: alpha and progress
ramp 0.3 s in while any live unit carries the origin, 0.3 s out after the last one dies. Every live line
re-routes on structure change (`onStructuresChanged`). `rebuildLineGeometry` only when the set changes;
`updateLineAttrs` otherwise.

### 4.13 Ring reveal fog (L1242–1258)
Large plane at Y 0.06, `depthTest:false`, renderOrder 6; shader uses **world** coordinates (`modelMatrix`)
— inside the wave window discard except a 0.07 outline (`lineCol`), outside `fogCol`.
`windowRect(w)`, `setWindow(w)`.

### 4.14 Structures and placement (L1260–1330)
- `KIND = { wall: {cost 10, H 0.6}, tower: {cost 50, H 1.4} }`; `rebuildStructures()` → two instanced
  meshes (stylized `wall`, `tower`), then `shadowMap.needsUpdate = true`.
- **`validatePlacementProto(kind, x, y)`** — mirrors the sim's `validatePlacement` rules with the real
  pathfinder; reasons, in order: "Outside the map", "No space: the base is here", "Blocked terrain",
  "No space: already built here", "Outside the revealed area", "Not enough gold (N g)", "Would block the path
  to the base" (rebuilds a nav grid including the candidate and runs `findRoute` from every ground spawn of
  the current wave). Cached by `kind:x,y:structVersion:gold:wave`.
- Ghost: translucent box + edges at the structure height, green/red, evaluated once per cell change; touch
  lifts the pick 1.4 cells above the finger. `place()` → `onStructuresChanged()` (version++, nav rebuild,
  re-route lines and units, rebuild instances, refresh ghost).

### 4.15 Prototype unit mover (L1332–1420) — **do not port**
Stand-in for the sim: spawn queue per wave, 4 per ground spawn; units follow `findRoute` paths with turn
smoothing; towers fire at the nearest unit within 3.4 cells every 0.55 s; projectiles home; kills pay 5 g;
`stress()` floods waves 1–3 (≈160 units, hp 40) and keeps 300 visual projectiles + 50 effects alive;
`maxUnits()` floods waves 1–4 to the 400 cap. `step(dt)` also runs path-line life and the camera rule:
during battle (`units alive or queued`) yaw eases back to 0 and orbit is disabled; outside battle orbit/
twist is allowed. In the game, units, towers, projectiles and kills come from the sim snapshot.

### 4.16 `draw()` (L1422–1465)
Sets ground axes for flat sprite shadows; `drawUnits3D` (3D mode) or the sprite loop; projectiles and
effects into the additive batch with per-style colour maps (`PRESETS[name].proj`, `.fx`); path-line update;
`lineMat.time`.

### 4.17 Glow pass (L1467–1509)
Scene → `WebGLMultisampleRenderTarget` (WebGL2, `stencilBuffer: true`) → bright pass to half res
(threshold per preset) → separable 5-tap blur at half and quarter res → composite add. 6 extra draw calls.
On when the preset has `bloom` and the tier allows it (High, Standard).

### 4.18 Presets and `applyStyle(name)` (L1511–1612)
`PRESETS` keys: voxel `neon, synth, ember, holo`; low-poly `lowpoly` (Meadow) and `lp_autumn … lp_savanna`;
`day`. Fields: `label, neon, low, pal, clear, apron, amb[col,k], hemi[sky,ground,k], sun[col, k, azOff, el],
fogNear, fogFar, ground{…}|null, kinds{kind:[face,edge]}|null, unitTint, outline, fog[rgba], ring[rgba],
proj[rgb], fx[mul r,g,b, add r,b], bloom[th,k]|null`.
`applyStyle`: rebuild low-poly if the palette changed → `uNeon`, `uLow`, set visibility (`SETS`,
`updateGroundVis`), hemisphere, scene fog, clear/apron, ambient, `setSun` (re-renders the shadow map),
ground uniforms, per-kind colours, unit tint/outline and `U3` face/rim/emit, **metal environment**
(`uEnvSky` = `hemi[0]` or `clear`, halved in neon styles; `uEnvGround` = `apron`), glow parameters, fog/ring colours,
HUD labels. Default at load: `lowpoly`.

### 4.19 Quality tiers (L1614–1636)
| tier | DPR | shadow map | live (unit) shadows | ground | fx cap | glow |
|---|---|---|---|---|---|---|
| High (desktop) | ≤2 | 4096 | on | full tiles | 900 | on |
| Standard (touch default) | ≤2 | 2048 | on | full tiles | 900 | on |
| Low | ≤1.5 | 1024 | off | half-res | 120 | off |

### 4.20 Input (L1638–1684)
Pointer events on the canvas: drag = pan (screen → ground, accounting for pitch and yaw), wheel/pinch =
zoom, right-drag / two-finger twist = yaw **only outside battle**; tap/click = place when a build mode is on.
`toCell()` = ray from the camera against the plane Y=0.

### 4.21 UI and loop (L1686–1772)
HUD (`head3d.html`): fps, CPU render ms, draw calls (incl. post), triangles, units, projectiles, path lines,
tier, phase, style, units-as; Quality panel (tier, live shadows, glow, **Metal units**); dock: wave select, Start wave,
Stress test, 400 units, **FX demo**, Wall, Tower, Clear, gold, unit mode (3D auto LOD / full / LOD only / sprites), style
menu, Fit wave, Orbit. `fitWave()` frames the wave window (portrait fills height). `frame()`:
`step → stepFx → draw → drawFx → camera shake → renderer.info.reset → renderFrame()`; stats every 0.5 s. Startup: build → tier auto → style
lowpoly → two starter towers beside wave-1 routes → wave 1.

---

## 5. Render order and cost

| order | what | depth | notes |
|---|---|---|---|
| −1 | apron | no write | |
| 0 | ground tiles / half / low-poly ground | no write | receive shadows |
| 1 | resource decals | no write | hidden in low-poly |
| 1.2 / 1.3 | FX scorch decals / shock rings + light pools | test, no write | normal / additive |
| 1.5 | path lines | test, no write | DoubleSide |
| 2 | sprite shadows, 3D-unit planar shadows | test, no write | stencil-once |
| default/3 | plateaus, rocks, trees, base, structures, crystals, units, wrecks, chunks | test + write | cast/receive |
| 4 | additive effects, projectiles | test, no write | |
| 4.1 / 4.2 | FX smoke / FX sparks, fire, flash, embers | test, no write | normal / additive |
| 5 | placement ghost | no write | |
| 6 | ring fog | **no test** | world-space shader |

Static shadow map: rendered at load and on structure/tier/style change only.

---

## 6. Unit model pipeline — `tools/unit-models/`

### 6.1 `prims.js` — `Prims.buildModel(def, mats) → { group, groups, tris }`
Model space: X forward, Y up, Z right, hull ≈ 4 units; 4 model units = 1 cell in game. Part schema:

| `t` | fields | notes |
|---|---|---|
| `box` | `s:[sx,sy,sz]` | |
| `cyl` | `r` or `r:[rPlusEnd, rMinusEnd]`, `l`, `ax: 'x'|'y'|'z'`, `seg`, `open`, `rot0` | radius[0] at the + end |
| `ext` | `poly`, `holes?`, `ax`, `d:[from,to]` | extruded profile: ax z → poly (x,y); ax y → poly (x,z); ax x → poly (z,y) |
| `loft` | `ax`, `secs: [[at, [[u,v,offset?]…]]…]`, `caps` | same point count per section; optional 3rd value = offset along the axis (raked lips); caps face away from the neighbouring section |
| `ell` | `s:[rx,ry,rz]`, `half`, `phi`, `seg` | faceted ellipsoid |

Common: `p:[x,y,z]`, `r3:[rx,ry,rz]` degrees (Euler order YZX), `m` material key (`hull, hull2, panel, dark,
black, track, metal, glass, glow, glowB, amber`), `mir: true` (mirror across Z, winding fixed), `g` group
(`'body'` default, `'turret'`), `d: 1` = detail part dropped by LOD. Everything is non-indexed with face
normals (faceted). Buckets merge per group × material; `def.pivots[group]` sets a group's pivot.
`Prims.track({x0,x1,h,z,w,t,rr,wheels,wr,wy,hub,glowHub,wheelShift,mir})` = track loop with hole + filler +
wheels + hubs + sprocket/idler + cleats.

### 6.2 `models.js` — `UNIT_MODELS`
| key | name | parts* | tris full / LOD | turret | notes |
|---|---|---|---|---|---|
| `tank` | Twin-barrel MBT | 148 | 3,362 / 1,272 | yes, pivot (−0.35, 1.22, 0) | lofted hex turret, chamfered skirts, twin barrels, sensor pods |
| `buggy` | SR-07 scout | 48 | 1,260 / 680 | yes, pivot (−0.85, 1.69, 0) | octagonal lofted body, wheel pods, energy barrel |
| `beetle` | Stag tracker | 110 | 2,748 / 1,492 | no | lofted elytra halves, segmented mandibles, side cannons |
| `jet` | FS-217 striker | 40 | 994 / 602 | no | lofted fuselage + canopy, raked caret intakes, canted fins; `hover 1.4` |

*parts after mirroring. `views` per model records how its reference sheet is oriented (side nose
left/right, top nose up/down/right) for the compare tool.

### 6.3 Verification loop
`measure.py` segments each sheet into front/side/top/rear crops and silhouette profiles; `compare.py <unit>`
renders the model's four orthographic views at the crops' sizes (`compare.html`) and writes a side-by-side
`cmp_<unit>.png` with aspect ratios. The sheets disagree with themselves by 5–15% between views; the side
view was treated as authoritative.

### 6.4 Viewer styles
`viewer.html` styles: Studio, **Studio metal** (the same metal model as §4.11, applied per material through
uniforms instead of per-vertex attributes; env sky `0xe8eef6`, ground `0x8a9096`), Neon voxel, Synthwave,
Ember, Hologram.

---

## 7. Measurements (headless Chromium + SwiftShader; draw calls, triangles and CPU submit time are valid, frame rates are not)

| scene | draw calls | triangles | units | CPU submit |
|---|---|---|---|---|
| voxel styles, wave 1 | 19–20 (25–28 with glow) | ~10–11k | 5–9 | 0.6–0.9 ms |
| sprite units, stress | 20 | ~11.6k | ~100 | ~0.9 ms |
| low-poly world, idle | 14–20 | ~81k | — | ~0.7 ms |
| 3D units, LOD | 24 | ~0.66M | 267 | ~1.0 ms |
| 3D units, full detail | 24 | ~1.1M | 243 | ~0.7 ms |
| 3D units, 400, zoomed (full) | 23 | ~1.46M | 400 | ~1.5 ms |
| sprite units, 400-flood | 16 | ~84k | 267 | ~1.2 ms |
| FX demo peak (low-poly, metal units, 6 kills burning + live units) | 40 | ~173k | 21 | ~1.35 ms |

FX cost: 4 batches + 1 chunk mesh + up to 2 instanced meshes per unit type with wrecks (body, turret) + their
shadows ≈ +16 draw calls at worst. The metal material adds no draw calls; its cost is per-pixel lighting on
unit pixels (Phong instead of per-vertex Lambert).

Draw calls and CPU are not the risk; GPU triangle/vertex load on iPhone 12 / Pixel 6 is. Planar shadows were half of
the 3D-unit triangles; since the shadow proxies (§4.11) a 267-unit field drops from ~0.77M to ~0.49M triangles
zoomed out and from ~1.06M to ~0.78M zoomed in (faction-model averages). Not yet measured on devices.

---

## 8. Known issues and compromises

1. Sprite units do not darken inside shadow-map shadows; a sprite shadow can stack on a shadow-map shadow.
2. Low-poly palettes: Sakura reads washed out; Dusk's large painted-dirt area reads like lava.
3. Base, walls, towers and resource crystals are boxes in every style; no low-poly versions.
4. Painted dirt (code 1) shows as large sand/dirt areas beside the computed roads (owner question Q8b).
5. Five different sun/camera numbers in the repo (sun.js 135°/45°, terrain bake self-shadow 25°, pine decor
   135°/55° at camera 21°, GND-Tanks 179° at camera 37°); 3D geometry now uses one sun, sprite packs do not
   (owner question Q14). 3D units remove the issue for units.
6. Off-map surroundings are random per seed; should come from a map-tool "surroundings" layer.
7. Unit models: rear view of the tank shows identical pods (the sheet shows one camera pod); beetle
   mechanicals are simplified; jet wings have no anhedral.
8. Prototype UI select state is not synced when styles are switched programmatically (test hook only).
9. `GridHelper` lines along Z did not render in the unit viewer's battle view (cosmetic).
10. **FX are not tier-capped yet.** `tierState.fxCap` only limits the old 2D effect batch; the new particles
    are capped by batch size (4000 / 1500) and `emit()`'s 5,200 limit on every tier. Low needs its own caps
    (fewer sparks per hit, no burning-wreck light pools, shorter smoke).
11. FX use `Math.random` — fine for presentation (never feeds the sim), but replays will not show identical
    debris. Seed per event id if identical replays matter.
12. Metal reflection is a two-colour sky/ground gradient, not an environment map: no reflected terrain, and
    the horizon is the same in every direction. Reads well at battle distance; a close-up showroom could
    use a real env map.
13. Wreck meshes hold 120 instances per type per group; beyond that, extra wrecks are not drawn (no eviction
    policy yet — oldest-first is the obvious one).
14. three.js **r128** UMD was used because of the artifact CDN rule; r128 has `WebGLMultisampleRenderTarget`
    (removed in later releases — use `WebGLRenderTarget({ samples })` when upgrading).

---

## 9. Port design — target layout in `prototype/test-game/` (agent-proposed)

The game is plain ES modules with no build step; Pixi is `vendor/pixi.min.js`. Keep that model.

| new file | from prototype | responsibility |
|---|---|---|
| `vendor/three.module.js` (or `three.min.js`) | — | three.js, pinned version; ES module import preferred |
| `src/render3d/index.js` | §4.1, §4.21 loop | `createRenderer3D(canvas, opts)` facade with the same surface `main.js` uses from `render/renderer.js` (`renderFrame(snapshot)`, resize, dispose) |
| `src/render3d/camera.js` | §4.1, §4.20 | battle camera (pitch 37°, pan/zoom, yaw only outside battle), picking ray → cell |
| `src/render3d/lighting.js` | §4.1, `setSun` | sun from `render/sun.js`, ambient/hemisphere, shadow-map policy (render once, `invalidateShadows()`) |
| `src/render3d/styles/shader.js` | §4.3 | `stylize()` injection |
| `src/render3d/styles/presets.js` | §4.18 | `PRESETS`, `applyStyle` (data only) |
| `src/render3d/styles/lowpoly-palettes.js` | §4.8 `LOWPAL` | world palettes (data) |
| `src/render3d/ground/baked.js` | §4.6 | ground tiles + half-res ground from the committed bake |
| `src/render3d/ground/lowpoly.js` | §4.8 (3–4) | triangulated ground + tufts |
| `src/render3d/obstructions/voxel.js` | §4.7 | plateaus, rocks, trees, base |
| `src/render3d/obstructions/lowpoly.js` | §4.8 (2, 5, 6) | boulders, trees, surroundings |
| `src/render3d/units/sprites.js` | §4.4, §4.10 | `SpriteBatch`, sprite units + flat shadows (kept as a fallback tier) |
| `src/render3d/units/models3d.js` | §4.11 | instanced 3D units, LOD, planar shadows |
| `src/render3d/units/prims.js`, `content/units/model/*.model.json` | §6 | builder (shared with the Stack Forge) + the four definitions as JSON |
| `src/render3d/overlays/pathLines.js` | §4.12 | expected-path lines keyed by sim origin |
| `src/render3d/overlays/fog.js` | §4.13 | ring reveal |
| `src/render3d/overlays/placement.js` | §4.14 ghost | ghost only — validity comes from `sim/structures.js validatePlacement` |
| `src/render3d/fx.js` | §4.4 additive, §4.17 | effects batch, glow pass |
| `src/render3d/fx/particles.js` | §4.11b `PBatch`, `DBatch`, shaders | instanced particle and decal batches |
| `src/render3d/fx/impacts.js` | §4.11b `fxHit`, `fxGround`, `fxExplode`, `boom`, `fxBurn`, `stepFx`, `drawFx` | event → effect recipes, simulation, wrecks and debris |
| `src/render3d/units/material.js` | §4.11 `unitMaterial`, `UMETAL` | metal unit material (shared by live units and wrecks) |
| `src/render3d/quality.js` | §4.19 | tiers |
| `tools/terrain-bake/bake3d.mjs` | §2 | "Bake level" → `content/maps/baked/<map>/` (tiles, half, road mask, routes) |

**Integration rules.**
- Selected by `?renderer=three`; Pixi stays the default until parity (T3), then T7 removes Pixi.
- Read the sim **snapshot** only (Architecture.md §3: renderer is read-only, presentation never affects
  replay). Units: position, heading, aim target, kind → model key mapping (data table), origin.
- Pathfinding: import `src/sim/pathfinding.js` — never the verbatim copy. Map: the map the sim builds
  (`buildTerrainMap` → `bakedBlocking`), never the raw forge mask.
- Placement validity: `validatePlacement` / `refreshHoverValidity`; the prototype's reasons list is the UX
  copy to match.
- Unit origin `{wave, spawnId}` must exist in the sim first (T0b) for path lines.
- Baked content is committed (`content/maps/baked/...`) — the repo guide: a code-only deploy renders nothing.
- No data-URIs, no inlined pathfinding, no prototype mover (§4.15) in the game.
- **Effects need events from the sim.** The renderer cannot infer a ricochet direction or a kill from
  positions alone. The snapshot (or a per-tick event list beside it) must carry: *hit* `{targetId | ground
  cell, x, y, direction of travel}`; *kill* `{unitId, kind, x, y, heading, aim, reachedBase}`. Effects consume
  each event once by tick + id, so a renderer that drops frames does not double-fire. Adding these is a sim
  output change only (no state change) — confirm against the replay hashes like T0b.

---

## 10. Testing in the repo (agent-proposed)

- Unit tests (`node --test`): pure helpers — `UMETAL` lookup (every material key has an entry), FX recipe
  counts per event (sparks per hit, chunks per boom), wreck lifecycle (burn → sink → removed), `lodDef`, `Prims` part counts per model (golden numbers in §6.2),
  `colAt` determinism (same seed → same colours), path-line keying by origin, tier table.
- Determinism guard: renderer changes must leave the existing replay hashes unchanged; T0b origin is the only
  sim change and is checked with origin-stripped hashes.
- Headless smoke (adapted `test3d.py`): boot `index.html?renderer=three`, assert no page errors, draw calls
  ≤ 60 and the HUD counters move.
- Device check (T1): iPhone 12 Safari, Pixel 6 Chrome, desktop GPU — fps, frame time, memory per tier, with
  "400 units" in 3D LOD and sprite modes.

---

## 11. MetaMax tech plan — what the CLI session should write

Use MetaMax's tech-plan format (as in current platform plans): title `# TECH PLAN — <name>`; provenance
block (owner quotes marked **owner**, rest **agent-proposed**); `## Dependencies` table with columns
`relation | plan | what it holds that this plan does not restate` (relations `depends-on`, `related`,
`supersedes`); numbered sections — owner intent, the model, modules touched (named, for `check_plan`),
stories keyed to board ids, risks, out of scope. File it in the docs home `docs/tech-plan/`
(`docs/metamax-docs.json` marks `docs/` as the docs home), post it superseding
`TECH_PLAN::Terrain-Engine-3D-and-Threejs-Migration.md`, attach with `tech_plan_links` on
`epic_mv77hbbc_1`, run `check_plan`. Expect it to flag `docs/dev/View-DD.md` (Pixi 2.5D painter's
algorithm, free player rotation, shared Pixi projection) — that document needs an amendment.

**Dependency rows must name REPO PATHS** (`docs/tech-plan/Architecture.md`), not MetaMax doc ids:
`post_document` refused `TECH_PLAN::Architecture.md`-style refs as "documents that do not exist" and accepted
the paths. The art-style doc has no repo path yet, so it cannot be a row until it is copied to `docs/dev/`.

Dependencies to list: `docs/tech-plan/Architecture.md` (depends-on: sim/presentation boundary,
determinism contract), `docs/dev/View-DD.md` and `docs/dev/Engine-DD.md` (related; amended),
`DEVELOPMENT::Neon-Voxel-Art-Style.md` (related: style rules and palettes — copy it into `docs/dev/` so
the repo copy is canonical).

---

## 12. Board mapping (epic `epic_mv77hbbc_1`)

| story | id | state of the work |
|---|---|---|
| T0 Ground truth | `story_mv77hfa8_2` | open: one sun/camera standard (Q14); confirm `bakedBlocking` |
| T0b Unit origin in the sim | `story_mv7axdnv_f` | not started; needed for path lines |
| T1 Spike | `story_mv77himr_3` | prototype done; device measurement remains |
| T2 Ground plane | `story_mv77hmbe_4` | prototyped (baked tiles + low-poly ground) |
| T2b Worn roads | `story_mv79mfwu_c` | prototyped in the bake |
| T3 Renderer port behind `?renderer=three` | `story_mv77hppn_5` | **the port this handoff is for** |
| T3b Expected-path overlay | `story_mv79mi1o_d` | prototyped; needs T0b |
| T4 Obstructions + shadows | `story_mv77hsxk_6` | prototyped (voxel + low-poly, shadow map, planar unit shadows) |
| T5 Unit render tech | `story_mv77hv5d_7` | evidence recorded: 3D models instanced + LOD work; owner approved the models |
| T6 Tool parity | `story_mv77hwq7_8` | not started |
| T7 Remove Pixi | `story_mv77i09b_9` | after parity |
| W Water | `story_mv7bccaa_g` | later phase |

Suggested additional stories (not on the board): *Low-poly style pack and world palettes* (palette per
level/biome in the level file), *Unit model pipeline in the Stack Forge* (part-list models, ortho-sheet
compare tool, LOD flags), *Low-poly base/walls/towers/crystals*, *Map-tool surroundings layer*,
*World-impact effects* (§4.11b; needs the sim hit/kill events, tier caps), *Metal unit material* (§4.11;
`UMETAL` as data beside the model JSON).

---

## 13. Open owner questions

- **Q8b** Off-route painted dirt (code 1): keep as clearings, or paint it as grass now that roads are computed?
- **Q14** The one standard sun (azimuth, elevation) and sprite bake camera elevation. 3D units make the
  camera pitch free; sprites still need it if they stay as a tier.
- Default style for the game: low-poly organic (owner: "the best yet") with a palette chosen per level?
- Do 3D units replace sprites outright, or do sprites stay as the Low tier?
- Effects on the Low tier: keep wrecks and turret blow-offs but thin the particles, or drop burning wrecks
  entirely on phones?
- How long should wrecks stay? Prototype: burn 7–10 s, then sink after 6 s. Longer wrecks block nothing in
  the sim but crowd the view in big waves.
- Metal per unit or per faction? `UMETAL` is per material key today; a faction (rusty raiders vs polished
  corp) would want a per-unit-type override.
