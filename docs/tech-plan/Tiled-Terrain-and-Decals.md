# TECH PLAN — Tiled Terrain Shader + Ground Decals (v0.1, prototype)

**Provenance.** Owner sentences are quoted and marked **owner**; everything else is **agent-proposed**. Written 2026-11-04 by the repo-rooted cloud session (Claude Code, Opus 5.5) from the owner's requests that day and the repo at `main` @ `3478e5b`. Epic `epic_mv77hbbc_1` (3D Terrain + three.js Renderer), story `story_mw2qkmb1_2`. **The repo copy is canonical**: `docs/tech-plan/Tiled-Terrain-and-Decals.md`; the MetaMax document mirrors it. It amends the ground plane of `docs/tech-plan/Terrain-Engine-3D-and-Threejs-Migration.md` (cited as **TE §n**).

**owner**: "how is the texture applied .. cant it be tiled in the terrain shader for a much lower cost?"

**owner**: "yes prototype it, and we can also add decals for terrain details, those draws should be very cheap since the decals get reused and do not draw off screen. The decals [can] also fade out as the camera pulls back to full map"

## 0. Governing decisions

- **D1 — Opt-in first.** The tiled ground is `?ground=tiled`. The default ground (low-poly, `ground/lowpoly.js`) and the painted tiles (`?ground=baked`) are unchanged until the owner chooses (§7).
- **D2 — No per-map download.** Each planet gets one 256² RGBA texture, generated in code at load time. Each channel is the detail height of one layer: R grass · G soil (dirt, roads) · B rock (rock, stone, cliff) · A sand. The painted ground (TE §3.1) costs about 3 MB per map (six 2048² WebP tiles).
- **D3 — The map decides where each layer shows.** Per-vertex layer weights come from the sim map's own terrain codes and the level's road mask (`colAt.layersAt`, the same fields the low-poly colour reads). No authoring step, no splat image.
- **D4 — The palette still owns colour.** The texture only shades the vertex colour between a dark and a light multiplier per layer, centred on 1, so a world palette (`styles/lowpoly-palettes.js`) keeps its look and every planet gets the shader for free.
- **D5 — Cost per pixel by tier.** High: 4 texture reads (base tap, a rotated + rescaled anti-repeat tap mixed by world-space macro noise, two bump taps). Standard: 1 read, colour detail only. Low: the flat ground, 0 reads.
- **D6 — Decals are reused and culled.** One atlas drawn in code; one `InstancedMesh` per 16 × 16-cell chunk sharing one quad and one material — at most 8 draw calls on a 64 × 32 map. Off-screen chunks are not drawn. Decals fade out as the view approaches the whole map and the group is hidden once faded (no draw calls).
- **D7 — Render-only.** Nothing here touches the sim or the replay. Placement uses seeded hashes / `rng` from `obstructions/placement.js`, never `Math.random`.

## 1. What exists today (main @ `3478e5b`)

- Default ground: `ground/lowpoly.js` — 0.5-cell jittered grid, one flat colour per triangle from terrain codes, plus `grassDetail.js` (a 256² blade normal + albedo and a sand detail, per-vertex masks) on High / Standard.
- Painted ground: `ground/baked.js` reads `content/maps/baked/<slug>/ground_*.webp`. Only map 1 of each faction has tiles; ~216 MB would be needed for all 72 remaining maps.
- Road mask: `content/maps/baked/<slug>/road_mask.png`, sampled by `roadSampler`.
- Quality tiers: `render3d/quality.js` (`groundRes`, `tufts`, `grassDetail`).

## 2. Tiled ground — `src/render3d/ground/splat.js`

### 2.1 The texture (pure, node-tested)
- `layerHeights(u, v, set)` → four heights from periodic value noise, periodic Worley and periodic ripples, so the tile wraps exactly (test: the u = 0 and u = 1 edges match per channel).
  - grass: soft clumps + low-contrast stretched noise, then ~2,600 short blade strokes stamped with wrap (`splatTextureData`).
  - soil: lumpy fbm + small pebbles (Worley).
  - rock: plates split by cracks (Worley F2 − F1).
  - sand: wind ripples warped by low noise, plus grain.
- Per-planet look: `WORLD_SET` (seed, clump / pebble / crack / ripple scales). Unknown worlds use meadow's.
- `splatTextureData(world)` is cached per world; the THREE `DataTexture` is made per build and freed with the ground (`material.userData.textures`, read by `disposeGroup`).
- One tile spans 3 × 3 cells (`SPLAT.tileCells`).

### 2.2 Mesh attributes (`lowpoly.js`)
- `buildGroundArrays(..., { splat: true })` adds `aSplat` (vec4 layer weights) and `aSUv` (world xz / tileCells). Same positions as the default ground (test).
- Vertex colour is sampled per **vertex**, not per triangle, so colour blends smoothly and the texture carries the detail — except triangles whose centroid is water or shore (`water > 0.15`), which keep their flat colour so the low-poly water bands stay crisp.
- `layersAt(x, z)` → `{ grass, soil, rock, sand, forest, water, road }`: soil from the dirt field below the sand threshold and from roads; sand above it; rock from rock + cliff + stone; grass is the remainder; all × (1 − water). A bare world (`palette.bare`, Lumen) turns grass into soil.

### 2.3 Shader (Phong patch, `createSplatGroundMaterial`)
- Height blend: `b = max(w·(t + 0.35) − (max − 0.22), 0)`, normalised — taller detail wins at a seam.
- Colour: `diffuse *= mix(1, Σ bᵢ·mix(darkᵢ, lightᵢ, tᵢ) · macro, Σw)`; `macro` = 0.93–1.07 from ALU value noise at 0.045 / cell.
- Bump (High only): blended height at `uv + dFdx(uv)` and `uv + dFdy(uv)` — two filtered taps, like three's `bumpMap` — through an inlined `perturbNormalArb`. Scale `SPLAT.bump.high` = 0.3.
- Program cache key `ground-splat-<taps>`.

## 3. Decals — `src/render3d/ground/decals.js`

- **Atlas** (pure): 4 × 4 cells of 128 px, 8 kinds in use — pebbles, crack, leaves, flowers, clover, ruts, mud, twigs. Greyscale kinds are tinted per instance by the ground colour under them (× a factor); flowers, leaves and twigs carry their own colour. Each cell's alpha fades to 0 at its border.
- **Placement** (`planDecals`, pure, deterministic per map): 2 tries per cell; a rule table maps layer → kind, chance, size range and tint. Never on blocked cells, the base's 3 × 3, or water (> 0.25). Ruts are laid along the road (rotation from the road-mask gradient). ~330–400 decals per Verdance map.
- **Draw**: `chunkDecals` buckets by 16 × 16 cells. Each chunk is a `BufferGeometry` sharing the quad's position / normal / uv / index buffers, with its own `aCell` (atlas offset) instanced attribute and a preset bounding sphere. `MeshLambertMaterial` with `map` = atlas, `instanceColor` for tint, `transparent`, `depthWrite: false`, `receiveShadow`. Shader patch: `vUv = vUv * 0.25 + aCell`, `alpha *= uFade`.
- **Fade** (`decalFade`, pure): `cover` = (visible ground width ÷ map width) × (visible depth ÷ map depth); `far` = dist ÷ `CAMERA.maxDist`. Fade = 1 − max(smoothstep(0.86, 1.0, cover), smoothstep(0.8, 0.97, far)). The `far` term handles portrait phones, which never see the whole map width. `update(cam, aspect)` runs every frame after the camera pose; `group.visible = fade > 0.01`.

## 4. Integration (`render3d/index.js`)
- `r.tiledGround = opts.ground === 'tiled'`.
- `setWorld`: on High / Standard (`tier.grassDetail`) the ground is built with `splat: { world, taps: tapsForTier(tier.key) }`; Low builds the flat ground. Decals are built on every tier when tiled, rebuilt with the world, and disposed with the old ground.
- `renderFrame`: `r.decals.update(r.viewCam || r.cam, w / h)` after the camera pose.
- `buildLowPolyGround` returns `colAt` so the decal planner reads the same fields and colours as the ground.

## 5. Measured (headless Chromium, software GL — draw calls and counts are valid, frame rates are not)

Review page, map 1 unless noted, 1280 × 720 unless noted:

| view | ground | draw calls | decal chunks drawn | fade |
|---|---|---|---|---|
| dist 30 | current (High) | 8 | — | — |
| dist 30 | painted | 12 | — | — |
| dist 30 | tiled (High) | 16 | 8 of 8 | 100% |
| dist 14 | tiled (High) | 13 | 5 of 8 | 100% |
| dist 66 (whole map) | tiled (High) | — | — | 4% |
| dist 40, 390 × 844 phone | tiled (High) | 12 | 4 of 8 | 100% |
| dist 95, 390 × 844 phone | tiled (High) | 8 | 0 of 8 | 0% |

- Fully zoomed out, the tiled ground costs the same draw calls as today's ground.
- GPU memory: 256 KB (+ mips) splat texture per planet, 1 MB (+ mips) decal atlas.
- Verdance maps 1–9 all build; 328–395 decals per map.

## 6. Decisions made while building (2026-11-04)

- **Screen-space bump was rejected.** `dFdx(height)` alone shades in 2 × 2 pixel blocks (reads as pixelation, worst on sand). Replaced by two filtered taps at the neighbouring pixels' uv (D5's 4 reads on High). Standard has no bump.
- **Contrast centred on 1.** The first multipliers (0.6–1.16) darkened every layer by ~12% and made grass read as noise. Now grass 0.82–1.10, soil 0.84–1.10, rock 0.74–1.16, sand 0.92–1.06.
- **Grass is strokes, not noise.** Value noise at near-pixel frequency read as static; stamped blade strokes over clumps read as turf. Sand ripples were halved in frequency and contrast so they do not read as stripes.
- **Water keeps flat facets.** Per-vertex colour smeared the shore → foam → water bands; triangles near water use the centroid colour.
- **Culling had to be turned back on.** three r128 sets `frustumCulled = false` on every `InstancedMesh`; each chunk sets it to `true`, which is safe because its bounding sphere is preset to the chunk. Pinned by a test.
- **No `renderOrder` on the decal group.** three sorts transparent objects by the group's order first, so a group order of 1 drew every decal over the fog clouds (order 8). Decals carry order 1 on the meshes only.
- **Review page opens the fog.** With no battle the fog tracker veils the map; `tools/terrain/index.html` stubs `r.fog.update` to the open board.

## 7. Plan — stories on epic `epic_mv77hbbc_1`

1. **TT-1 — Prototype** (`story_mw2qkmb1_2`, PR #157): `?ground=tiled`, splat texture + shader, decals, review page `tools/terrain/index.html`, tests. **Built.**
2. **TT-2 — Device check (owner call).** Frame time on iPhone 12 / Pixel 6 / desktop, tiled vs current (TE §7.2's T1 question). Not yet measured.
3. **TT-3 — Default (owner call).** If approved: tiled becomes the High / Standard default, the `grassDetail` path is retired, and the committed `ground_*.webp` tiles can be dropped from the shipped build.
4. **TT-4 — Per-planet tuning.** Review the other 8 palettes under `?world=`; tune `WORLD_SET` and the decal rules per planet (e.g. no flowers on Lumen, ash on volcanic).

## 8. Tests — `src/render3d/ground/splat.test.mjs`
Seamless tiling; texture contrast per channel, caching, differs per planet; tier → taps; layer weights follow terrain codes (grass, water, rock, roads → soil, sum ≤ 1); splat arrays keep the default mesh; material cache key; atlas size; decal placement (deterministic, never on blocked / base / water, flowers on turf, ≥ 4 kinds); chunking (≤ 8 chunks, one shared material, preset spheres, culling on); fade (desktop start full, desktop whole map gone, portrait far gone, close full, group hidden); all Verdance maps 1–9 build. `npm test` 978 / 978.

## 9. Open questions (owner)
- Q1 — Make tiled the default on High / Standard (TT-3)?
- Q2 — Drop the painted map-1 tiles once tiled is the default?
- Q3 — Decals on Low: they are ~8 draw calls; keep, or turn off with tufts?

## Dependencies

| relation | plan | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/tech-plan/Terrain-Engine-3D-and-Threejs-Migration.md | the ground plane (§3), quality tiers and draw-call budget (§7) this prototype amends |
| related | docs/16 Bulwark MM/design/Terrain-Detail-and-Complexity.md | the current terrain detail inventory and complexity audit |
