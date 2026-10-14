# TECH PLAN — Bulwark Terrain Engine + three.js Renderer Migration (v2.2.2)

**Provenance.** Owner sentences are quoted and marked **owner**; everything else is **agent-proposed**. v2.2 written 2026-10-14 by the repo-rooted CLI session (Claude Code, Opus 5.5) from v2.1, the code design handoff (`docs/dev/Terrain-Engine-3D-Code-Design.md` rev 2) and the repo at `main` @ `31b62eb`. Epic `epic_mv77hbbc_1`. **The repo copy is canonical**: `docs/tech-plan/Terrain-Engine-3D-and-Threejs-Migration.md` on `main`; this MetaMax document mirrors it.

v2.2.2 (2026-10-14) ORDER, AUTHORITY, AND WHAT COMES NEXT. **owner**: "Keep working in the proper order. The new design material is authoritative over previous work. We are still lacking new units which I will keep working on and we now have assigned terrain and planets for each of the 9 existing factions. Planets will come immediately after the 3D refactor is complete." So: (1) stories are worked in board dependency order (§8); (2) where a ticket written before 2026-10-14 disagrees with this plan, the code design or the art-style doc, the newer material wins and the ticket is amended; (3) new unit MODELS are the owner's lane, so agents port and wire but do not author them; (4) the next epic after this one is PLANETS (§14). T0's audit (`docs/dev/Terrain-3D-Ground-Truth.md`) resolves Q14 under goal 26 (§12) and finds that only ONE level can render in 3D today (§0.4.8).

v2.2.1 (2026-10-14) RESOLVES Q18 and adds goal 26. **owner**: "sprites as fallback is only a temporary feature. The goal is a complete conversion to 3D since 3D hardware on mobile seems to be able to accomodate the load." Sprite units exist only as a stop-gap and leave with Pixi in T7; nothing new is built on them.

v2.2 (2026-10-14) MAKES 3D MODELS THE UNIT TECHNOLOGY. **owner**, 2026-10-14: "Design is changing to 3D models." Goal 15's "units stay sprites" is retired (§0.1 goal 15, new goal 25); T5 is un-deferred. Adds: the port layout and integration rules (§6.12), the modules this plan touches (§13), stories keyed to board ids (§8), the three.js version decision (§6.6), and two corrections found by reading the repo (§0.4.6 — the sim ALREADY emits damage and kill events; §0.4.7 — the tools and the baked level are now in the repo). Also in the repo now: the prototype tools and the baked powder-map-1 level (`[MM-story_mv87jtfa_3]`), and the art-style doc at `docs/dev/Neon-Voxel-Art-Style.md` (now a Dependencies row).

v2.1 (2026-10-13, late) ADDS world-impact effects (§6.10) and a metallic unit material (§6.11), both built and running in the prototype ("Bulwark Terrain Engine" artifact version 9), and fixes the Dependencies table to the standard format. Owner, on effects: "now that we have a truly 3d world. I would like to create particle effects that look like impact the world. Like sparks that bounce off the tank and hit the ground. Or tanks the explode their turrets off and burn." Owner, on materials: "Is it possible to use a material shader to give the tanks a more metallic look?" Since v2.0 the prototype also gained 3D unit models (instanced, LOD, planar shadows) and eleven low-poly world palettes; those are recorded in the code design handoff (`docs/dev/Terrain-Engine-3D-Code-Design.md`, revision 2) and will be folded into this plan by the repo session that ports the code.

v2.0 (2026-10-13) REVERSES the v1.9 camera "correction". Owner, on the v1.9 prototype: "a 3d terrain engine needs to be 3d". The engine is now real 3D: a tilted perspective camera, lit 3D geometry for plateaus, rocks, trees, base and structures, and a shadow map from one sun. The play surface stays a single flat plane and units stay sprites. Prototype rebuilt as real 3D at the same published artifact ("Bulwark Terrain Engine", version 2). Earlier versions: v1.9 first prototype findings; v1.8 quality tiers, effects vs post-processing, placement validity; v1.7 three.js before Unity, terrain first, web mobile + desktop, water later, rotation only outside battle; v1.6 unit origin in the sim; v1.5 per-wave, per-spawn path lines; v1.3 computed roads; v1.2 LEVEL; v1.1 primary goals.

Owner request: a new terrain engine for Bulwark, and migrate the renderer from Pixi 7 to three.js so GPU 3D presents battles and units better.

---

## 0. Governing decisions

### 0.1 Owner goals (2026-10-13)
1. The ground plane has texture that feels like terrain.
2. The playable ground is a SINGLE 2D PLANE.
3. The game is lines of enemies attacking the base.
4. Resource fields are groups of cells, for collection.
5. Obstructed terrain is filled with trees, large rocks and plateaus.
6. Foliage must be very efficient. It is seen from ONE angle during the battle.
7. Shadows are accurate and consistent; terrain shadows may be baked.
8. Cell distribution is 100% the existing scale.
9. The ground shows probable troop routes as worn dirt roads with edging detail, precalculated from expected pathing. Congested units may occasionally take an alternate path.
10. During the battle, the expected path from a spawn to the base is drawn while units from that spawn are alive, and updates when a tower or wall obstructs it. Each wave's lines are a slightly different colour.
11. Map assets are GENERATED. The full map is a single regenerated image; keep that model.
12. The simulation records which wave and which spawn point every attacking unit came from.
13. Spawn points are placed and edited in the map tool and fixed before the battle. Out of scope.
14. three.js REPLACES the Pixi renderer, BEFORE any Unity attempt.
15. TERRAIN PERFORMANCE FIRST. ~~Units stay sprites; unit render tech is chosen later.~~ (v2.2: superseded by goal 25.)
16. Targets: WEB MOBILE and WEB DESKTOP. Floor devices: iPhone 12 (Safari) and Pixel 6 (Chrome).
17. WATER is a simple terrain type that affects unit speed, added in a LATER PHASE.
18. CAMERA rotation happens before and after the battle only; during the battle it pans and zooms but never rotates.
19. OBSTRUCTIONS come from the existing Terrain Forge data.
20. REAL-TIME SHADOWS can be turned off on low-end devices. Baked terrain shadows always stay.
21. No route-impact preview while placing. Placement IS checked for validity.
22. (v2.0) THE ENGINE IS REAL 3D: a tilted 3D camera, lit 3D geometry for everything that stands on the ground, and real shadows. Matching the old flat 2D look is NOT a goal.
23. (v2.1) IMPACTS AFFECT THE WORLD: sparks bounce off armour and hit the ground; destroyed tanks lose their turrets and burn.
24. (v2.1) UNITS LOOK METALLIC, via a material shader.
25. (v2.2) UNITS ARE 3D MODELS. **owner** 2026-10-14: "Design is changing to 3D models." The four approved part-list models (tank, buggy, beetle, jet — **owner**: "All of them are perfect") are the first set: instanced, LOD, planar shadows (§6.3). (v2.2.1) Sprites are a TEMPORARY fallback only (goal 26).
26. (v2.2.1) COMPLETE CONVERSION TO 3D. **owner** 2026-10-14: "The goal is a complete conversion to 3D since 3D hardware on mobile seems to be able to accomodate the load." The end state has no sprite units, no Pixi and no flat-bake path. Any sprite fallback is temporary and is removed in T7; the Low tier is a lighter 3D tier (LOD, no live shadows, fewer effects), not a sprite tier. T1's device measurements confirm the load; they do not reopen the decision.

### 0.2 Terms
- MAP — the ground: the terrain-forge grid of cells (terrain codes, blocking, obstructions).
- LEVEL — the game layout played on a map: base, spawn points per lane, wave windows and ring growth, resource fields.
- SPAWN POINT — an authored point in the level with a stable id, fixed for the battle.
- GROUND IMAGE — the single generated image the ground plane shows; one per LEVEL.
- BATTLE — one play of a level, from the moment waves can start to the results screen.
- WORLD — (v2.0) X = column (east), Z = row (south), Y = up; 1 world unit = 1 cell; the play surface is the plane Y = 0.
- BATTLE VIEW — (v2.0) perspective camera, field of view 30°, pitched down 37° (the elevation the unit sprites were baked at), yaw 0 = looking north. Pan and zoom only during the battle. (v2.2: with 3D units the pitch is no longer pinned by sprites; 37° stays the default until tuned.)
- STATIC SHADOWS — the shadow map from every static caster (plateaus, rocks, trees, base, structures), rendered once and re-rendered only when something static changes.
- LIVE SHADOWS — (v2.2) 3D-unit planar shadows: the unit's LOD mesh projected onto Y = 0 along the sun, stencil-once. (Sprite-era definition: the packs' baked shadow atlases laid flat on the ground.)
- ORIGIN — (wave number, spawn point id) recorded on a unit by the sim at spawn.
- PATH LINE — one expected-path line, keyed by an origin; lives while a unit with that origin is alive.
- IMPACT EVENT — (v2.1) a hit or a kill the sim reports to the renderer for that tick (§6.10).
- WRECK — (v2.1) a destroyed unit's own mesh, charred, left in the world to burn and sink; DEBRIS — a part thrown off it (a turret).
- POST-PROCESSING, QUALITY TIER — as in v1.8.

### 0.3 What earlier versions removed
Terraced heightfield for the play surface; water as lower geometry; in-battle rotation; native voxel units in this migration (v2.2: replaced by part-list 3D models, not voxel meshes); route-impact preview. (v2.0 RESTORES GPU shadow maps, removed in v1.4, as the static shadow model — see §5.)

### 0.4 Corrections
1. CAMERA MODEL (v2.0, replaces v1.9 §0.4.1). v1.9 made the camera a straight-down orthographic view so the scene matched the old 2D art; that produced a 2D engine on a 3D API. Reversed. The engine uses a real 3D perspective camera at the sprite bake pitch (37°), with real lit geometry. The depth buffer orders geometry and sprites; there is no contact-row depth trick.
2. ONE SUN IS NOT TRUE TODAY. The repo carries five different light/camera numbers:
   - `src/render/sun.js`: azimuth 135°, elevation 45°.
   - Terrain bake terrain self-shadow: elevation 25°.
   - `pine-tree-1` decor pack: light 135°, baked shadow elevation 55°, bake camera elevation 21°.
   - `GND-Tanks` and the unit pack config: light azimuth 179°, bake camera elevation 37°.
   v2.0 removes most of this problem: terrain, plateaus, rocks, trees and structures are now lit and shadowed by ONE three.js directional light (prototype: `sun.js` 135° / 45°). Only the unit sprite packs still carry baked light (179°) and must be re-baked to the standard sun (Q14). (v2.2.2: RESOLVED — units are 3D, sprites are temporary, nothing is re-baked; T0 audit §3.)
3. PX_PER_CELL = 80. The existing bake (sub 5 × 16 px) produces 5120 × 2560 for a 64 × 32 map. That exceeds the 4096 texture limit common on older phones, so tiling is required, not optional.
4. Water is IMPASSABLE in the sim today (`buildNavGrid`: "Water blocks walkers"; `buildTerrainMap` puts code-6 cells in `waterCells`). Story W changes that.
5. The sim's walkable grid comes from `bakedBlocking` (the bake's domain-warped outline), not the raw forge `blocking` mask: `main.js` calls `buildTerrainMap(forge, id, { seed: 0, bakeTune })`. The renderer, roads and path lines must use the map the sim builds, never the raw forge mask.
6. (v2.2) THE SIM ALREADY EMITS IMPACT EVENTS — v2.1 §6.10 assumed it did not. `src/sim/combat.js` emits `damage {tick, sourceId, targetId, targetKind, amount, damageType, killed, pos}` and `kill {tick, entityId, unitId, side, lane, income, radius, pos}`; `src/sim/core.js` emits `kill` for units that reach the base; `main.js` already batches them into `pendingEvents` and hands them to `renderFrame(renderer, sim, ui, events, dt)`. So the renderer takes travel direction from the SOURCE's position in the same state and heading/aim from its own last-frame cache per entity id. A sim change is needed only if that proves insufficient (e.g. the source died the same tick) — and then only as extra OUTPUT fields, checked against the replay hashes.
7. (v2.2) THE PROTOTYPE IS IN THE REPO. `prototype/test-game/tools/terrain3d-proto/` (bake, build, headless test) and `tools/unit-models/` (part-list builder, the four models, viewer, ortho-sheet compare). `bake3d.mjs` writes the renderer's inputs to `content/maps/baked/<mapId>/` (committed); the local bake of powder-map-1 is byte-identical to the cloud one. Dev-only deps (`three@0.128.0`, `@napi-rs/canvas`) are in the root `package.json`; the game ships none of them.
8. (v2.2.2) ONLY ONE LEVEL CAN RENDER IN 3D TODAY. `content/maps/forge/` holds one level, `powder-map-1`. Every other playable map is built by `buildCampaignMap` from the workbook and carries no terrain codes, so it can't be baked and has no obstructions to raise. Goal 26 therefore needs every playable level authored in the Terrain Forge with a committed bake. That is content work owned by PLANETS (§14), with T6's "Bake level" making the bake part of saving. Until then the port is built and verified on `powder-map-1`. (T0 audit §11.)
9. (v2.2.2) `src/terrain/terrainRuntime.js` (`TerrainRenderer`, `bootTerrain`) is DEAD CODE: imported by nothing. The live Pixi terrain is `renderer.js` `bakeDigicamGround` with `bakeTerrainTiles` as fallback; both go in T7, `terrainRuntime.js` can go any time. (T0 audit §2.)

## 1. What exists today (measured at 31b62eb)
- Renderer: `src/render/renderer.js` (Pixi 7) — `createRenderer`, `renderFrame`, `cellToLocal` (square grid), `bakeTerrainTiles`, `bakeDigicamGround`, sprite effects `spawnGlow` / `glowTexture` / `updateGlows`, `spawnFlame`, `spawnFireClump`.
- Ground bake: `src/terrain/terrainBake.js` `bakeTerrain(map, opt)` — the digicam material stack (water, shore, dirt, grass, brush, rocks, trees, cliff), terraces, cliff faces, terrain self-shadow; deterministic from seed; pure apart from a canvas. Runs unchanged in Node with a canvas shim. Options `cliffDrop: 0` and `shadow: false` turn off the painted cliff faces and painted self-shadow; the 3D engine uses both (geometry and the shadow map replace them).
- Map: `content/maps/forge/powder-map-1.json` (terrain-forge v2): 64 × 32 `terrain` codes, `blocking`, 8 `waveWindows`, `spawnsByWave` (48 ground spawns across 8 waves), 89 `resources`, 83 `decor` pines, `base`.
- Terrain codes (`terrainGen.js` `TERRAIN_NAME`): 0 grass, 1 dirt, 2 brush, 3 rocks, 4 trees, 5 cliff, 6 water, 7 tree-border, 8 rock-border, 9 cliff-border. In powder-map-1 the blocking mask equals exactly codes 3, 4, 5, 6, 9; codes 7 and 8 are walkable fringes.
- Decor: `content/decor/voxel-decor.json` — one type, `pine-tree-1`, as a sprite atlas only. No 3D model exists for any tree or rock; only `content/units/model/SPA-U3.json` carries an embedded voxel model.
- Units: `content/units/voxel-units.json` + `content/units/voxel/*.png` — e.g. `GND-Tanks`: 16 body facings, 64 turret angles, baked body and turret shadow atlases; sized by `buildVoxelUnit` (`tiles` × `VOXEL_UNIT_SCALE` 0.5). (v2.2) 3D models: `src/render3d/units/models.js` (tris full / LOD: tank 3,362 / 1,272; buggy 1,260 / 680; beetle 2,748 / 1,492; jet 994 / 602), built by `src/render3d/units/prims.js` (moved from `tools/unit-models/src/` by T5; the tools build from them).
- Pathing: `src/sim/pathfinding.js` — `buildNavGrid`, `findRoute`, `findWalkerPath`, all pure. `src/sim/core.js` `seedRoute` seeds up to 4 alternates per spawn; `baseAttackSlots` assigns ring slots around the 3 × 3 base.
- Placement: `validatePlacement` (`sim/structures.js`), `refreshHoverValidity` (`input/input.js`).
- Unit origin: `createUnit(state, unitId, tier, pos, lane, side)` — no origin yet (T0b).

## 2. Scale — fixed (goal 8)
World unit = 1 cell; map 64 × 32; playable area 24 × 16 growing by ring; PX_PER_CELL = 80 on the ground image; ground detail 5 sub-cells per cell, digicam blocks 5 px. Unit sprite sizing keeps `buildVoxelUnit`'s rule. Geometry heights (v2.0, prototype values, tuned in T4): plateau 1.15 cells; pine about 1.6–2.1 cells; large rock about 0.9 cells; wall 0.6; tower 1.4; base 1.8. terrain-forge v2 files load unchanged.

## 3. The ground plane

### 3.1 One plane, one generated image per level
- One flat set of tiles at Y = 0, lit (Lambert) so it receives the shadow map, depth-write off, drawn first. Picking: a ray from the camera through the pointer, intersected with the plane Y = 0.
- Generator layers: (1) map layers = `bakeTerrain` with `cliffDrop: 0, shadow: false`; (2) road wear; (3) road-aware detail. No painted shadows: all terrain shadows come from the shadow map (§5).
- Output: 5120 × 2560, split into ≤ 2048 tiles; about 1.7 MB as lossless WebP on powder-map-1. Half-resolution composite for the Low tier and for plateau tops.
- Shipped builds load the committed image; only Terrain Forge "Bake level" and dev builds generate it.

### 3.2 Map layers
`bakeTerrain` IS the map layer: material stack, digicam pattern. Keep it; do not re-implement. Painted cliff faces and painted self-shadow are switched off by option, not deleted (the Pixi path still uses them until T7).

### 3.3 Depth table
Emboss steps (already in the bake's ladder) on the flat ground; real height only on plateaus.

### 3.4 Resource fields
Decal per field cell + camera-facing impostor per resource type with per-cell state; ≤ 2 draw calls per type. (Prototype: placeholder crystals; real crop art needed.)

### 3.5 Worn roads — COMPUTED (tuned on the prototype)
Unchanged from v1.9: primary + 2 alternates per ground spawn (weights 1 / 0.35 / 0.15), lane core 0.5 with 0.35 shoulder, normalised against 55% of the busiest corridor, bands EDGE ≥ 0.06, WORN ≥ 0.16, CORE ≥ 0.38 with ±0.03 jitter per digicam block, dirt tones from #785632, pebbles, grass tufts, north-edge seam, luminance-preserving. Roads are part of the ground image, so the shadow map darkens them like any ground. 48 ground spawns → 137 route polylines on powder-map-1.

### 3.6 Water — later phase (story W)
Material in the ground image plus an optional shimmer decal. Story W makes it passable slow ground in the sim; roads and path lines follow automatically.

## 4. Obstructed terrain — real 3D geometry (v2.0)

### 4.1 Mapping from existing data (goal 19)
Unchanged: on cells the sim blocks, 3 rocks → rock; 4 trees → tree; 5 cliff and 9 cliff-border → plateau; 6 water → water. Codes 7 tree-border and 8 rock-border are walkable ground detail (8 also gets small scattered stones). Trees are placed by the level's `decor[]`, not one per tree cell.

### 4.2 Plateaus
- Every blocked cliff / cliff-border cell becomes a raised block 1.15 cells high, merged into ONE mesh for tops and ONE for sides.
- Top faces: textured from the half-resolution ground image at that cell.
- Side faces: on every exposed side (N, S, E, W — the camera can see all of them when it rotates outside the battle). Rock in three digicam tones, banded: bright bottom band 12% of the height, dark top band 36% (about 1/3).
- Lambert, flat-shaded, lit by the one sun; cast and receive shadows.

### 4.3 Trees
- ONE InstancedMesh for all trees (83 on powder-map-1), placed from `decor[]` with the authored offset and scale, plus hashed height and rotation variation.
- Prototype model: a procedural voxel pine (trunk + 5 stepped tiers, 3 greens). Production: a Stack Forge pine MODEL (not a sprite) exported as a mesh; 2–3 variants as separate InstancedMeshes.
- Foliage efficiency (goal 6): low-poly voxel tiers (prototype: about 70 triangles per tree), no alpha cutout, no overdraw. Cast and receive shadows.

### 4.4 Rocks
- ONE InstancedMesh: voxel boulder clusters on blocked rock cells (large), and small stones on about 35% of rock-border cells (hashed, deterministic).
- Production: Stack Forge rock models, 2–3 variants.

### 4.5 Base and structures
Lit 3D geometry, instanced per kind (wall, tower); cast and receive shadows. Placing or removing a structure re-renders the static shadow map once.

## 5. Shadows — one model (v2.0)
- ONE three.js directional light = the sun: `sun.js` azimuth 135°, elevation 45° — the standard (v2.2.2, Q14 resolved; T0 audit §3).
- Lighting balance: ambient 0.6 + sun so a flat sunlit ground shows its baked colour exactly; ground in shadow is 0.6 of it.
- STATIC shadows: one shadow map from every static caster, hard-edged (`BasicShadowMap`, matching the voxel look). `shadowMap.autoUpdate = false`: rendered once at load and again only when a structure changes. This is baked-equivalent cost (goal 7) with exact agreement between geometry and shadow. Always on, every tier; map size 4096 / 2048 / 1024 by tier.
- (v2.2) LIVE shadows for 3D units: a planar projection of the unit's LOD instances along the sun onto Y = 0 (`w −= L · (w.y / L.y)`), black × alpha, stencil-once; exact silhouettes, no per-frame shadow map. Off on the Low tier (goal 20). The sprite-era bullet below applies only while the temporary sprite fallback exists (goal 26).
- (sprite era) LIVE shadows: each unit part's baked shadow atlas laid flat on the ground (stretched by 1 / sin 37° along the view so it projects to the shape it was drawn as). Stencil-once so overlaps never double-darken. Off on the Low tier (goal 20).
- Known gaps: units no longer darken inside tree shadows (the shadow map is not sampled by unit sprites); a unit sprite shadow can stack on top of a shadow-map shadow. Fix in T4: sample the shadow map in the sprite shader (one texture lookup per sprite). (v2.2.2: units are 3D, so T4 makes the unit material RECEIVE the static shadow map instead; the sprite fix is not built.)

## 6. Renderer (three.js)

### 6.1 Camera (v2.0)
- PerspectiveCamera, field of view 30°, pitch 37° down, target on the ground plane. Position = target + distance × (sin yaw · cos 37°, sin 37°, cos yaw · cos 37°).
- During the battle: pan (drag) and zoom (wheel / pinch), yaw locked at 0. When a wave starts the camera eases back to yaw 0.
- Outside the battle: free yaw (right-drag, two-finger twist, or the overview orbit). Sprite facings follow: body bucket = angleBucket(heading + yaw); 16 body facings and 64 turret angles cover every yaw.
- Pitch is fixed at the sprite bake elevation so sprites and geometry agree. If unit tech moves to 3D models (T5), pitch becomes free. (v2.2: it has — keep 37° until tuned on device.)

### 6.2 Scene order (as built)
Ground tiles (lit, receive shadows, no depth write) → field decals → (v2.1) impact scorch decals, shock rings and fire-light pools → path lines (depth-tested, no depth write) → live unit shadows (stencil once) → depth-tested opaque geometry and cutout sprites (plateaus, rocks, trees, base, structures, resources, unit bodies, turrets, wrecks, debris chunks) → additive effects → (v2.1) smoke, then sparks / fire / flashes / embers → fog of unrevealed rings → placement ghost. The HUD is a DOM layer.

### 6.3 Units — 3D models (v2.2)
- Each unit type is a PART LIST (box, cylinder, extruded profile, loft, ellipsoid; one material key per part; groups `body` and `turret` with pivots), built by `prims.js` and merged per type × group into ONE vertex-coloured geometry with per-vertex emissive and metal/roughness attributes.
- One `InstancedMesh` per type × group × variant (full, LOD); the planar-shadow mesh shares the LOD `instanceMatrix`. Transform per unit: `T(x, y, z) · Ry(−heading) · S(0.27)`; the turret adds `T(pivot) · Ry(−(aim − heading))`; hover units fly at 1.1 cells. Model forward = +X; heading = atan2(dz, dx) in cell space.
- LOD drops detail parts (flag `d`) and tiny parts and caps cylinders at 6 sides; automatic above camera distance 22.
- The sim unit → model key mapping is a DATA table (the roster is far larger than four models); an unmapped unit falls back to its chassis' nearest model, and a test lists every fallback — nothing is silently drawn as nothing.
- Production models move to `content/units/model/*.model.json` and are authored in the Stack Forge (story UMP).
- Sprite-era design, kept ONLY as the temporary fallback until T7 (goal 26): camera-facing billboards anchored at their ground contact point, sized by `buildVoxelUnit`'s rule; the depth buffer sorts them against 3D geometry. Turret anchor = contact point + the `mount` ground offset rotated by heading, lifted along the camera's up axis by `mount.z` × `layerSpacing`. One draw call per part regardless of count. (Prototype since v2.0: instanced 3D unit models with LOD and planar shadows run alongside sprites; the T5 decision is pending — see the code design handoff §4.11.)

### 6.4 Effects
Additive billboards from one glow texture; projectiles instanced and flying at height. No post-processing by default (v1.8 §6.4 unchanged). v2.1: world-impact effects in §6.10.

### 6.5 Ring reveal
Fog shader over everything outside the current wave window, with a thin window outline.

### 6.6 Facade
Unchanged from v1.8, made concrete in §6.12. THREE.JS VERSION (v2.2 decision, agent-proposed): the port vendors **r128 as an ES module** (`vendor/three.module.js`, copied from the pinned dev dependency) — the version every number in this plan was measured on and every shader injection was written against. Upgrading is a separate, later story: r155+ changes light-intensity units and colour management (which would break the AMB 0.6 / DIR balance of §5) and removes `WebGLMultisampleRenderTarget` (use `WebGLRenderTarget({ samples })`).

### 6.7 Expected-path lines (as built)
Unchanged from v1.9 (one mesh keyed by origin; draw-in 0.3 s, fade 0.3 s; wave hues 186/198/174/210/162/222/150/234; ±0.13 cell sideways offset; chevrons toward the base; re-route on structure change). The ribbon lies just above the ground and is hidden by plateaus and rocks in front of it.

### 6.8 Unit origin in the simulation — T0b
Unchanged from v1.8.

### 6.9 Placement validity (as built)
Unchanged from v1.9 (same reasons and path test). The ghost is now a translucent 3D block at the structure's height with an outline, green or red; picking is ray against Y = 0 (touch lifts the target 1.4 cells above the finger).

### 6.10 World-impact effects (v2.1, as built in the prototype)
Presentation only — effects read impact events and never change the sim. CPU-simulated particles, drawn by GPU-instanced batches.
- BATCHES: additive particles (sparks, fire, flash, embers; cap 4000), alpha smoke and dust (cap 1500), ground decals in two batches (dark scorch marks; additive shock rings and fire-light pools; cap 300 each), one instanced chunk mesh (400), and one instanced wreck mesh per unit type per part (body, turret; 120 each) built from the unit's own LOD geometry, with a planar shadow mesh sharing its matrices.
- PARTICLES: one quad per particle stretched along its view-space velocity, so fast sparks read as streaks. Sparks are white-hot → orange → red with age.
- HIT ON ARMOUR: about 70% of the sparks ricochet back off the plate (within ±0.8 rad of the reverse travel direction), 30% skate sideways; they fall, BOUNCE on the ground (restitution 0.38), skid and die. Plus a flash and two puffs of smoke. Hover units are hit at their flying height.
- MISS: dust, a few sparks, a dusty puff and a small scorch on the ground.
- KILL (ground unit): flash, fireball, sparks, a few small metal chunks, a scorch (22 s), an expanding shock ring, a fire-light pool, a short camera shake. The HULL stays as a charred wreck and burns 7–10 s (flames, a smoke column drifting with the wind, embers, a flickering light pool), then sinks into the ground. The TURRET is BLOWN OFF: launched upward and sideways from its pivot, spinning, bounces up to twice, settles and burns 5–8 s.
- KILL (air unit): the jet falls with its forward momentum, tumbling and trailing fire and smoke, and explodes where it hits the ground, then burns.
- (v2.2: CORRECTED by §0.4.6 — the sim already emits `damage` and `kill`; the renderer derives direction and heading itself, and the sim change below is a fallback only.) REQUIRES IMPACT EVENTS FROM THE SIM. The renderer cannot infer a ricochet direction or a kill from positions. The snapshot (or a per-tick event list beside it) carries: HIT {target unit id or ground cell, x, y, travel direction}; KILL {unit id, kind, x, y, heading, aim, reachedBase}. Effects consume each event once by tick + id, so dropped frames never double-fire. This is a sim OUTPUT change only (no state change); verified against the replay hashes like T0b.
- RANDOMNESS: effects use an unseeded random source; fine for presentation, but replays do not show identical debris. Seed per event id if identical replays are wanted (Q16).
- COST (prototype, headless): FX demo peak 40 draw calls, ~173k triangles, 21 units incl. wrecks, CPU submit ~1.35 ms. Worst case ≈ +16 draw calls over the base scene.
- TIERS: not yet tier-capped — the Low tier needs its own caps (fewer sparks per hit, no wreck light pools, shorter smoke) (Q15).

### 6.11 Unit material — metal (v2.1, as built in the prototype)
- Phong (per-pixel) instead of per-vertex Lambert, injected with `onBeforeCompile` so the sun, ambient, hemisphere light and planar shadows are unchanged. No env map, no PBR, no extra draw call.
- PER-PART METALNESS AND ROUGHNESS by material key (written per vertex when parts are merged): hull 0.55 / 0.45; hull2 and panel 0.6 / 0.4; dark 0.7 / 0.35; black 0.4 / 0.6; track 0.3 / 0.75; bare metal 0.95 / 0.2; glass 1.0 / 0.05; glow parts unlit.
- SHADING: metals darken their diffuse and tint their highlight with their own colour; shininess from roughness. A FAKE ENVIRONMENT REFLECTION: the reflected view ray picks between the style's sky colour (above the horizon) and a darkened ground colour (below), plus a fresnel edge. Tops of hulls catch the sky, sides pick up the ground, curved shells get a hot highlight.
- STYLE-DRIVEN: sky = the preset's hemisphere sky colour (or clear colour), ground = the preset's apron; halved sky in neon styles. A Dusk world puts orange on the armour.
- WRECKS use the same material with metal ≈ 0.1, so charred hulls stay matte.
- A "Metal units" toggle (metal 0 = the previous flat look) stays as a quality/debug option. The Unit Models viewer has the same model as its "Studio metal" style.

### 6.12 Port layout and integration rules (v2.2)
Target: `prototype/test-game/src/render3d/`, plain ES modules, no build step — the game's existing model.

| module | from the prototype (code design §) | responsibility |
|---|---|---|
| `vendor/three.module.js` | — | three.js r128 as an ES module (§6.6) |
| `src/render3d/index.js` | §4.1, §4.21 | `createRenderer3D(canvas, map, opts)` with the surface `main.js` uses from `render/renderer.js`: `renderFrame(r, state, ui, events, dt)`, `destroyRenderer(r)`, `screenToCell(r, sx, sy)`, `cellToScreen(r, cell)`, resize |
| `src/render3d/camera.js` | §4.1, §4.20 | battle camera (pitch 37°, pan / zoom, yaw only outside battle), ray → cell picking |
| `src/render3d/lighting.js` | §4.1 `setSun` | sun from `render/sun.js`, ambient / hemisphere balance, static shadow map rendered once + `invalidateShadows()` |
| `src/render3d/ground/baked.js` | §4.6 | ground tiles + half-res ground from `content/maps/baked/<mapId>/` |
| `src/render3d/ground/lowpoly.js`, `obstructions/{voxel,lowpoly}.js`, `styles/*` | §4.3, §4.7, §4.8, §4.18 | obstructions, styles, palettes (T4, LP) |
| `src/render3d/units/{prims,models3d,material}.js` | §4.11, §6 | 3D units, LOD, planar shadows, metal (T5, MAT, UMP) |
| `src/render3d/overlays/{pathLines,fog,placement}.js` | §4.12–4.14 | path lines (T3b), ring fog, placement ghost |
| `src/render3d/fx/{particles,impacts}.js` | §4.11b | world-impact effects (FX) |
| `src/render3d/quality.js` | §4.19 | tiers |

Integration rules:
- SELECTED BY `?renderer=three`. Pixi stays the default until parity; T7 removes it. `main.js` picks the module at boot; nothing else in the game imports `render3d/` (T6 brings the tools over).
- READ-ONLY. The renderer reads the sim state and the event list it is handed and never writes to the sim (Architecture: presentation never affects replay).
- NO COPIES. Pathfinding is `src/sim/pathfinding.js`; the map is the one the sim builds (`buildTerrainMap` → `bakedBlocking`); placement validity is `sim/structures.js` `validatePlacement`, and its reasons are the UX copy. The prototype's inlined pathfinder, data-URIs and unit mover (code design §4.15) never enter the game.
- CONTENT IS COMMITTED. A map without `content/maps/baked/<mapId>/` cannot render under `?renderer=three`; the renderer says so on screen rather than drawing an empty plane.
- THE DEFAULT PATH IS UNTOUCHED. `index.html` keeps loading only Pixi; `render3d/` and three.js are imported dynamically under the flag, so the default build's bytes and boot do not change.
- TESTABLE WITHOUT A GPU. Pure helpers (camera maths, cell ↔ world, tier table, model-key mapping, LOD part filter) live in modules that import no three.js and are covered by `node --test` — CI has neither three.js nor WebGL.

## 7. Performance

### 7.1 Quality tiers
- High (desktop): DPR ≤ 2, shadow map 4096, live shadows on.
- Standard (iPhone 12 / Pixel 6): DPR ≤ 2, shadow map 2048, live shadows on.
- Low: DPR ≤ 1.5, shadow map 1024, live shadows off, half-resolution ground, effect cap 120 (v2.1: impact-effect caps to be defined, Q15).

### 7.2 Measured in the real-3D prototype (headless Chromium, software GL — draw calls and counts are valid; frame rates are not)
| Scene | Draw calls | Triangles | Units | Projectiles | Path lines |
|---|---|---|---|---|---|
| Wave 1 marching | 19–20 | ~10,100 | 5–9 | 0–1 | 5–6 |
| Stress (live shadows on) | 20 | ~11,600 | 81–102 | 300 | 18 |
| Wave 1 + wall + placement ghost | 21–22 | ~10,150 | 8 | 0 | 6 |
| (v2.1) FX demo peak, low-poly world, metal 3D units | 40 | ~173,000 | 21 | 1 | 6 |
| (v2.2) 3D units, auto LOD | 24 | ~660,000 | 267 | — | — |
| (v2.2) 3D units, 400, zoomed, full detail | 23 | ~1,460,000 | 400 | — | — |
| (v2.2) re-run locally 2026-10-14, wave 1, low-poly, 3D LOD (`test3d.py desk`) | 37 | ~134,700 | 22 | 1 | 6 |
- (v2.2) With 3D units, draw calls stay flat (one instanced mesh per type × group); triangles are what grow — half of them planar shadows. That is the T1 device question.
- Draw calls stay at about 20 with full 3D terrain: plateaus 2, trees 1, rocks 1, base 1, structures 2, plus ground tiles, sprites, lines, fog. Budget 60.
- About 10,000 triangles of static geometry for the whole map; the static shadow pass runs only at load and on structure change.
- CPU time to fill instance buffers and submit: 0.6–0.9 ms (1.35 ms at the FX demo peak).
- Frame rate on iPhone 12, Pixel 6 and desktop GPUs is NOT yet measured (T1). v2.1 adds per-pixel unit lighting and particle overdraw to what T1 must measure.

## 8. Plan — stories on epic `epic_mv77hbbc_1`
Order follows the board's `depends_on`; the ids are the `[MM-<id>]` to stamp.

| story | id | state (v2.2.2) / what remains |
|---|---|---|
| T0 Ground truth | `story_mv77hfa8_2` | (v2.2.2) audited 2026-10-14: `docs/dev/Terrain-3D-Ground-Truth.md` |
| T0b Unit origin in the sim | `story_mv7axdnv_f` | not started; needed by T3b path lines. (v2.2.2) There is no authored spawn id: origin is DEFINED as `{ wave, lane, point }` (T0 audit §9) |
| T1 Spike | `story_mv77himr_3` | prototype done (tools now in the repo); remaining: iPhone 12 / Pixel 6 / desktop GPU fps, frame time, memory per tier, with 400 3D units (LOD) and the FX demo; owner go/no-go |
| T2 Ground plane | `story_mv77hmbe_4` | prototyped; the port is `ground/baked.js` |
| T2b Worn roads | `story_mv79mfwu_c` | prototyped in `bake3d.mjs`; the bake still has to move into the Terrain Forge "Bake level" (T6) |
| **T3a Land tools + baked level** | `story_mv87jtfa_3` | **deployed 2026-10-14** (PR #28) — tools, `content/maps/baked/powder-map-1/`, root dev deps |
| **TP This plan** | `story_mv87juej_4` | **deployed 2026-10-14** (PR #28); revised since by T0 |
| T3 Renderer port behind `?renderer=three` | `story_mv77hppn_5` | in progress — T3.1 skeleton `task_mv883c5d_b` **deployed** (PR #28); remaining: placement under the 3D view, overlays, tiers; DoD amended 2026-10-14: 3D units, not sprites |
| T3b Expected-path overlay | `story_mv79mi1o_d` | prototyped; needs T0b |
| T4 Obstructions + shadows | `story_mv77hsxk_6` | prototyped; (v2.2.2) scope amended by T0: plateaus / rocks / trees as real 3D from forge data, 3D units receive the static shadow map, low-poly look by default; devices → T1, palettes → LP |
| T5 Unit render tech — 3D models | `story_mv77hv5d_7` | **deployed 2026-10-14** (PR #29): 3D part-list models, LOD + planar shadows, model-key table (7 stand-in classes listed) |
| UMP Unit model pipeline in the Stack Forge | `story_mv87jypv_8` | models as `content/units/model/*.model.json`; one shared `prims.js`; author / preview / LOD flags in the forge |
| MAT Metal unit material | `story_mv87jwol_6` | §6.11; UMETAL as data beside the model JSON |
| FX World-impact effects | `story_mv87jvnb_5` | §6.10 — consumes the EXISTING `damage` / `kill` events (§0.4.6); a sim change only if the derivation fails; Low-tier caps; wreck eviction |
| LP Low-poly style pack + world palettes | `story_mv87jxp2_7` | low-poly ground, obstructions and the 11 palettes; palette named per level |
| LPS Low-poly base, walls, towers, crystals | `story_mv87jzov_9` | replaces the boxes (code design §8.3) |
| SUR Surroundings layer | `story_mv87k0nt_a` | the off-map world authored in the Terrain Forge, not random per seed |
| T6 Tool parity | `story_mv77hwq7_8` | Harness, Gallery, Terrain Forge on the shared view; "Bake level" in the Terrain Forge |
| T7 Remove Pixi | `story_mv77i09b_9` | after parity; (v2.2.1) also removes the temporary sprite unit fallback — the end state is fully 3D (goal 26) |
| W Water | `story_mv7bccaa_g` | later phase |

Proposed, not yet on the board (agent): **three.js upgrade r128 → current**, after T3 (light units, colour management, multisample target — §6.6).

## 9. Guardrails
As v1.8, plus:
- The renderer, roads and path lines use the map the sim builds (`buildTerrainMap` → `bakedBlocking`), never the raw forge `blocking` mask.
- `bakeTerrain` is reused, not rewritten.
- Everything that stands on the ground is 3D geometry lit by the one sun — (v2.2) units included; effects are the only billboards.
- The static shadow map never re-renders per frame.
- (v2.1) Effects never write to the sim; impact events are output only and never alter replay hashes.
- (v2.2) `?renderer=three` is opt-in: with the flag absent the game's loaded bytes and behaviour are unchanged, and the two deploy gates (`renderTiers.test.mjs`, `voxel/pack.test.mjs`) stay green.
- (v2.2) No three.js import in any module a `node --test` file loads; pure helpers are split out so CI can test them.

## 10. Risks
As v1.8, plus:
- Shadow-map resolution on phones: 2048 over a 64 × 32 map is about 32 texels per cell; hard edges may shimmer at full zoom. Mitigation: fit the shadow camera to the revealed ring (it is static between rings) and re-render on ring growth.
- ~~Sprites in a perspective view~~ (v2.2: moot with 3D units; v2.2.1: sprites are temporary, so this risk ends with T7).
- Tree and rock models do not exist yet; procedural placeholders stand in until Stack Forge exports meshes.
- (v2.1) Particle overdraw on phones: smoke and fire are large soft quads; a big wave of kills stacks many on the same pixels. Mitigation: Low-tier caps, smaller smoke, fewer burning wrecks.
- (v2.1) The metal look is a two-colour sky/ground reflection, not an environment map; it reads at battle distance but not in a close-up showroom.
- (v2.2) GPU TRIANGLE LOAD of 3D units on the floor devices is now the headline risk (0.66 M tris at 267 units with LOD, 1.46 M at 400 full; half of it planar shadows). Mitigations, in order: a dedicated ~300-tri shadow LOD; full detail only inside a zoom radius; T1 device numbers decide.
- (v2.2) ROSTER COVERAGE. Four models exist; the game has many more unit types. Until UMP produces them the mapping table's fallbacks show repeated chassis — visible, never invisible.
- (v2.2) STAYING ON r128 delays fixes from later three.js releases; accepted for the port, retired by the upgrade story.

## 11. Documents this changes
As v1.8. View-DD (`docs/dev/View-DD.md`): camera section → a tilted 3D perspective camera at 37° over a flat play plane, real lit geometry, a static shadow map and (v2.2) 3D unit models with planar shadows — replacing the Pixi 2.5D painter's order, free player rotation and the shared Pixi projection. (v2.1) View-DD's effects section: world-impact effects and wrecks. Engine-DD (`docs/dev/Engine-DD.md`): (v2.2) the impact events already in the sim output (§0.4.6) become a documented renderer contract; unit fields gain a model key. The art-style rules and palettes live in `docs/dev/Neon-Voxel-Art-Style.md` (v1.3, now in the repo).

## 12. Owner questions
Resolved: Q1–Q13 as listed in v1.8. (v2.2) Unit render tech: 3D models (**owner** 2026-10-14). (v2.2.1) Q18: sprites are a temporary fallback only; the goal is a complete conversion to 3D (**owner** 2026-10-14, goal 26). (v2.2.2) Q14: the one sun is `sun.js` 135° / 45°; under goal 26 nothing needs a re-bake (T0 audit §3).
Still open:
- Q8b Off-route painted path cells: dirt clearings or grass?
- Q15 (v2.1) Effects on the Low tier: keep wrecks and turret blow-offs and thin the particles, or drop burning wrecks on phones?
- Q16 (v2.1) Wreck lifetime (prototype: burn 7–10 s, sink 6 s later) and whether replays must show identical debris.
- Q17 (v2.1) Metal per material only, or per faction / unit type (e.g. rusty raiders vs polished corp)?
- Q19 (v2.2) Default world style for the game: low-poly organic (**owner**: "the best yet") with a palette per level?

## 13. Modules this plan touches (for check_plan)
- New: `prototype/test-game/src/render3d/**`, `prototype/test-game/vendor/three.module.js`, `prototype/test-game/content/maps/baked/**`, `prototype/test-game/content/units/model/*.model.json`.
- Changed: `prototype/test-game/src/main.js` (renderer selection under `?renderer=three`), `prototype/test-game/src/render/sun.js` (the single sun), `prototype/test-game/tools/voxel-stack/**` (UMP), `prototype/test-game/terrain.html` + `prototype/test-game/src/terrain/**` (T6 "Bake level", SUR), `prototype/test-game/src/sim/core.js` + `prototype/test-game/src/sim/waves.js` (T0b origin only).
- Read, never changed by the renderer: `prototype/test-game/src/sim/pathfinding.js`, `prototype/test-game/src/sim/mapgen.js`, `prototype/test-game/src/sim/structures.js`, `prototype/test-game/src/sim/combat.js`, `prototype/test-game/src/terrain/terrainBake.js`.
- Removed (T7): the Pixi path in `prototype/test-game/src/render/renderer.js`, `prototype/test-game/vendor/pixi.min.js`.

## 14. Next: PLANETS (v2.2.2)
**owner** 2026-10-14: "we now have assigned terrain and planets for each of the 9 existing factions. Planets will come immediately after the 3D refactor is complete." A separate epic, started when this one closes. What this plan hands it: the 3D renderer, the bake pipeline, and the requirement in §0.4.8 that every playable level be a Terrain Forge level with a committed bake. The owner's faction terrain and planet assignments are not yet in the repo or on the board; that material defines the epic.

## Dependencies
| relation | plan | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/tech-plan/Architecture.md | the sim/presentation boundary and the determinism contract that impact events and unit origin must respect |
| related | docs/dev/View-DD.md | the current battle-view design (Pixi, painter's order, camera, effects) that this plan amends |
| related | docs/dev/Engine-DD.md | the engine design (Pixi acceptance line, level definition, unit fields, water) that this plan amends |
| related | docs/dev/Neon-Voxel-Art-Style.md | the style rules, presets, the eleven low-poly palettes, and the unit-material and effect looks |
