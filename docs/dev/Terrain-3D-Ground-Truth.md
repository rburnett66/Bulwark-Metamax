# Bulwark — 3D Port Ground Truth (T0)

**Ticket:** `[MM-story_mv77hfa8_2]` T0 Ground truth · epic `epic_mv77hbbc_1` · plan `docs/tech-plan/Terrain-Engine-3D-and-Threejs-Migration.md` (v2.2.2).
**Measured:** 2026-10-14 against `main` @ `b83c5d0` (after PR #29). Every claim cites the file it was read from. Line numbers are approximate.
**Provenance:** agent-measured from source. Owner direction is quoted where it settles an item.

Owner, 2026-10-14: *"The new design material is authoritative over previous work."* Where an older ticket disagrees with plan v2.2.1+, the code design or the art-style doc, this document records what the new design says and the ticket gets amended.

---

## 1. Code graph pinned at head — DONE

The MetaMax Reality graph reads `graph_head = live_head = b83c5d0` (it re-pinned itself after the merge). `refresh_graph` from this session is refused by design: graphs build on the desktop bridge, not the hosted server. That's expected, not a blocker.

**Graph defect found (reported to MetaMax as a gap):** `impact_of(bootTerrain)` lists `bootBench -> TerrainRenderer.load`, `bootGallery -> TerrainRenderer.load` and `createGauntletView -> TerrainRenderer.load`. None of those files imports `terrain/terrainRuntime.js`. Their `.load()` calls are on unrelated objects (`gview.load` in `src/gallery/gallery.js:358`). The graph bound a common method name to the wrong class. Treat `TerrainRenderer` callers from the graph as unverified.

## 2. The live terrain path — DECIDED

| Path | Where | Status at `b83c5d0` |
|---|---|---|
| Digicam bake into a Pixi sprite | `src/render/renderer.js` `bakeDigicamGround` (~l.57), called from `createRenderer` (~l.338) | **LIVE** for forge maps (`map.fromForge && map.terrain`) |
| Authored sprite-tile bake | `src/render/renderer.js` `bakeTerrainTiles` (~l.81) | **LIVE fallback** for non-forge maps, or when the digicam bake throws |
| `TerrainRenderer` / `bootTerrain` | `src/terrain/terrainRuntime.js` | **DEAD**: imported by no module, page or tool (verified by search; see §1 for the graph's false edges) |
| 3D baked ground | `src/render3d/ground/baked.js` reading `content/maps/baked/<slug>/` | **LIVE under `?renderer=three`** |

**For T7:** delete `terrainRuntime.js` outright (it's dead today), and remove `bakeDigicamGround` and `bakeTerrainTiles` together with the Pixi renderer. `bakeTerrain` (`src/terrain/terrainBake.js`) is **kept**: it's the map layer the 3D bake reuses (plan §3.2).

## 3. One sun — Q14 RESOLVED by the new design

Under plan goal 26 (complete conversion to 3D: no sprite units, no Pixi, no flat bake), everything that stands on the ground is lit by **one three.js directional light** from `src/render/sun.js`: **azimuth 135°, elevation 45°**. `render3d/lighting.js` already reads it (`sunDirection()`), and a test pins 135°/45° → light from the north-west.

What happens to the other numbers the old Q14 listed:

| Number | Where | Fate under goal 26 |
|---|---|---|
| Terrain self-shadow elevation 25° | `terrainBake.js` bake option | **Moot**: the 3D bake runs with `shadow: false`; shadows come from the shadow map |
| `pine-tree-1` decor 135° / 55° at camera 21° | `content/decor/voxel-decor.json` | **Moot once T4 lands**: trees become instanced 3D models lit by the one sun. Pixi keeps the sprite until T7 |
| Unit packs 179° at camera 37° | `content/units/voxel-units.json` | **Moot**: units are 3D models (T5, deployed). The sprite packs are the temporary fallback only; they are **not** re-baked |

**Re-bake list: none.** Q14 can't block T4's shadow sign-off, because there is nothing left to reconcile.

## 4. The renderer, roads and path lines use the sim's map — CONFIRMED, with one trap

- The sim builds forge maps with `buildTerrainMap(forge, id, { seed: 0, bakeTune })` (`src/main.js`, `selectMap`). `bakeTune` is always an object (`{}` by default), so the sim's blocking is **`bakedBlocking`** (domain-warped), not the raw forge mask (`src/sim/mapgen.js` ~l.391).
- `tools/terrain3d-proto/bake3d.mjs` calls the same function with `bakeTune: {}`, so the committed roads and routes come from the same blocking.
- `render3d/level.js checkLevelAgainstMap` compares the committed bake with the sim's map at runtime (size, base, every blocked cell) and shows a banner on any mismatch. `render3d.test.mjs` proves the committed `powder-map-1` bake equals `buildTerrainMap`'s blocking cell for cell.
- **Trap:** `buildTerrainMap` falls back to the RAW `forge.blocking` when `opts.bakeTune` is falsy (`mapgen.js` ~l.391). Every current caller passes `{}`, so the sim is safe today. A future caller that omits it would silently desync the sim from the picture. Recommendation (T2b/T6): make the baked blocking the default and remove the raw fallback.
- A local `tf.bake.v1` tune in the browser changes the sim's blocking and makes the committed bake stale. The 3D view reports this (by design) rather than drawing a wrong ground.

## 5. Water passability — RECORDED for story W

Water **blocks walkers** today: `src/sim/pathfinding.js` `buildNavGrid` (~l.29, "Water blocks walkers"). `buildTerrainMap` puts code-6 cells in `map.waterCells` and keeps them out of `blockedCells` (`mapgen.js` ~l.404–409). Floaters use a fixed water-lane waypoint path (`getWaterPath`, ~l.215). Story W changes walker passability (slow ground); floaters are unaffected.

## 6. Terrain Forge → obstruction mapping — CONFIRMED

`src/terrain/terrainGen.js` l.18–19:
- `TERRAIN_NAME` = 0 grass, 1 dirt, 2 brush, 3 rocks, 4 trees, 5 cliff, 6 water, 7 tree-border, 8 rock-border, 9 cliff-border.
- `BLOCKING` = { trees 4, rocks 3, cliff 5, cliff-border 9, water 6 }.

So the 3D obstruction mapping in plan §4.1 holds: 3 → rock, 4 → tree, 5 and 9 → plateau, 6 → water (its own layer). 7 and 8 stay walkable fringes. On `powder-map-1` the code counts are 0:934, 1:283, 2:152, 3:4, 4:78, 5:26, 6:162, 7:218, 8:117, 9:74 (of 2,048 cells).

## 7. Painted-path (dirt) cells per level — measured for Q8b

| Level | Code-1 "dirt" cells | Note |
|---|---|---|
| `powder-map-1` (the only committed forge level) | **283** of 2,048 (13.8%) | Shows as large dirt or sand areas beside the computed roads (code design §8.4) |

**Q8b stays an owner question** (keep painted dirt as clearings, or turn it to grass now that roads are computed). It only blocks T2b's migration of the road bake into the Terrain Forge, not T4.

## 8. "Map" vs "level"

The plan uses MAP = the ground grid and LEVEL = the game layout played on it. **The code doesn't make that distinction:** `src/` uses `map` (≈600 uses) for both. "level" appears only in unrelated senses (audio gain, base level, projectile tiers) plus `render3d/` and the baked `level.json`. Recommendation: no rename churn now; adopt `level` for the baked per-level content (`content/maps/baked/<slug>/level.json` already does), and revisit when Planets defines levels per faction.

## 9. Unit creation sites and spawn identity (input to T0b)

`createUnit(state, unitId, tier, pos, lane, side)` (`src/sim/entities.js` ~l.58) is called from:

| Site | What it spawns | Needs an origin for T3b? |
|---|---|---|
| `src/sim/waves.js` ~l.328 | **wave attackers** | **yes** |
| `src/sim/core.js` ~l.511 | player-deployed defenders | no (null) |
| `src/sim/harvest.js` ~l.73 | harvesters | no |
| `src/sim/structures.js` ~l.236 | repair troops | no |
| `src/sim/balanceSim.js` ~l.182 | balance-sim units | no (tooling) |
| `src/gallery/{calc,lane}.js`, `src/harness/{bench,scenario}.js` | tool / test units | no |

**Finding for T0b: there is no authored spawn id.** Forge spawn entries are `{ x, y, lane }` only (`content/maps/forge/powder-map-1.json`, `spawnsByWave`). The campaign builder keeps all painted points per lane (`mapgen.js` ~l.550, `spawnList`, "spawner cycles them"), and each wave spawn entry is `{ unitId, lane, delay, interval, count }` with no point reference (`src/sim/campaign.js` ~l.72+). T0b must **define** the origin rather than read it. Proposed: `origin = { wave, lane, point }`, where `point` is the index into that wave's painted points for that lane (stable while the forge file isn't reordered). Later, the Terrain Forge can write explicit ids per point. Non-forge maps have no painted points: origin is `{ wave, lane, point: null }`.

## 10. Pixi full-screen filters — NONE

No `filters =`, `PIXI.Filter`, `BlurFilter` or `ColorMatrixFilter` anywhere in `src/`. No effect depends on a full-screen pass, so nothing in the effects port needs a post-processing equivalent.

## 11. Finding beyond T0's list — only ONE level can render in 3D today

`content/maps/forge/` holds exactly one level, `powder-map-1.json`. Every other playable map (campaign maps 1–9 for the other factions, and maps 2–9 for Powder) is built by `buildCampaignMap` from the balance workbook. That produces **no terrain codes** (`terrain: false`, `fromForge: false`, 0 blocked cells; measured for maps 1–9). Those maps:
- can't be baked by `bake3d.mjs` (it needs forge terrain codes), so under `?renderer=three` they show the "no baked level" banner;
- have no rocks, trees or plateaus to put up in T4.

**Consequence:** plan goal 26 (complete conversion to 3D) requires **every playable level to be a Terrain Forge level with a committed bake**. That's content, not engine work. It lines up with the owner's next item (2026-10-14): *"we now have assigned terrain and planets for each of the 9 existing factions. Planets will come immediately after the 3D refactor is complete."* Recommendation: the Planets epic owns authoring the per-faction levels in the Terrain Forge, and T6's "Bake level" button makes baking part of saving. Until then the 3D port is developed and verified on `powder-map-1`.

## 12. Ticket changes this audit causes

- **T4** `story_mv77hsxk_6`: amended to the v2.2.2 scope (real 3D obstructions from forge data; 3D units receive the static shadow map; low-poly look by default; devices move to T1; palettes to LP). Its dependency on T2 is narrowed with a reason (T2's resource fields don't gate obstructions).
- **T0b** `story_mv7axdnv_f`: amended — origin is DEFINED as `{ wave, lane, point }` (§9), not read from a nonexistent authored id.
- **T1** `story_mv77himr_3`: note added — the owner has given the direction ("3D hardware on mobile seems to be able to accomodate the load"); device numbers now size the tiers rather than decide go/no-go.
- **New finding** for the Planets epic: §11.
