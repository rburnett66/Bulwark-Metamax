# Bulwark — 3D Battle View: As-Built Design (snapshot)

**Status:** as-built snapshot of the three.js battle view on `main` @ `a21a6e3` (2026-10-18), after PRs #28–#64.
Story `[MM-story_mveenh2y_g]`, epic `epic_mvedxju3_3`.

**Provenance.** Everything here is **agent-measured from source**: three read-only surveys of
`prototype/test-game/src/render3d/**`, `src/input/input.js`, `src/menu/menuStage.js` and `src/main.js`, each
fact cited as `path:line`. It is a description of what the code **does**, not of what any plan intends.
**Owner** sentences are quoted where they set a behaviour. Paths are relative to `prototype/test-game/src/`
unless they start with `content/` or `docs/`.

**Why it exists.** **owner** (2026-10-18): "It might be good to create a complete design doc snapshot of the
current threejs battle system." Plans that change the 3D view, starting with `docs/tech-plan/3D-Combat-Polish.md`,
cite this document for the baseline instead of restating it. The older
`docs/tech-plan/Terrain-Engine-3D-and-Threejs-Migration.md` and `docs/dev/Terrain-Engine-3D-Code-Design.md`
describe the port *as planned*. Where they disagree with this snapshot, this snapshot is what runs.

**How to keep it true.** This is a snapshot. A change that alters a behaviour described here should update the
section it touches in the same PR, or note in the PR that this document is now stale at §N.

---

## 1. Boot and the renderer facade

### 1.1 Which view runs
- **3D is the default.** `USE_3D` is true unless `?renderer=pixi|2d`, or the device has no WebGL
  (`main.js:79-81`). When 3D runs, the Pixi canvas stays mounted but hidden and stops drawing (`main.js:87`).
- **Fallback.** `fallbackTo2D()` destroys the 3D view, shows Pixi, rebinds input and flashes "3D view unavailable"
  (`main.js:90-100`). It fires when the mount throws (`:133-135`) or after 30 consecutive `renderFrame` throws
  (`:1045-1046`).
- **Mounting.** `mount3D(map, slug)` (`main.js:101-137`):
  - A sequence counter cancels stale mounts. It destroys the old view, then imports `render3d/index.js` and
    `quality.js` on demand.
  - It calls `createRenderer3D(mountEl, map, opts)` with `slug`, `world` (`?world`), `ground` (`?ground`), `craft`
    (`?craft`, default `'system'`), `landing` (off with `?landing=0`; only during an interlude), `landingHeld`,
    `planet` (`?planet`, else the enemy faction key), `projFx`/`projScale` getters, `qualityQuery` (`?quality`)
    and `qualityChoice` (localStorage).
  - It registers the Settings entry `quality3d`. Changing it saves the choice and remounts (`:129-132`).
  - The 3D view is not mounted while the menu is open.
- **Per frame:** `renderFrame(renderer3d, sim, ui, pendingEvents, dtMs/1000)`, then `pendingEvents` is cleared
  (`main.js:1045-1049`).

### 1.2 Public surface of `render3d/index.js`
- `createRenderer3D` (`:141`), `renderFrame` (`:430`), `destroyRenderer` (`:605`), `setWorld` (`:398`, exported
  but not called by `main.js`), `landingHarvesters` (`:528`).
- Landing controls: `armLanding`, `startLanding`, `landingPhase`, `skipLanding` (`:552-579`).
- Picking: `screenToCell(r, px, py, lift)` (`:582`), `eventToCell` (`:592`), `cellToScreen` (`:600`).
- `resize` is private and runs at the start of every frame (`:421-428`).
- Input binds to `renderer3d.canvas` with `{ pick: eventToCell, tapToAct: true }` (`main.js:230-234`).

### 1.3 Construction (`index.js:141-373`)
- three.js r128 is vendored as an ES module (`vendor/three.module.js`, `index.js:84`).
- `WebGLRenderer` has antialias, stencil (needed by planar shadows) and `powerPreference: 'high-performance'`.
  The pixel ratio comes from the quality tier (`:152-156`).
- `PerspectiveCamera(CAMERA.fovDeg, …)` (`:163`); `createLights(…, tier.shadowSize)` (`:164`).
- `groundMap = renderMapFor(map)` (`:167`). The ground style is low-poly unless `?ground=baked` **and** a slug
  exists (`:168`).
- Subsystems (`:170-202`): low-poly structures (or placeholder `markers` for the baked style), `units3d`, `system`
  towers (low-poly only), the craft plus landing, resources (low-poly with a planet), path lines, placement ghost,
  combat FX (caps = `tier.effects`), world impacts, fog, base-cannon FX, coverage, health bars, gold pop-ups,
  unload rings, repair sparks, build dust, dust trails, flash lights.
- **World selection** (`:371`): `opts.world` → `map.world` → `level.world` → `PLANETS[opts.planet].palette` → Meadow.
- **Baked level** (only with a slug): fetches `content/maps/baked/<slug>/level.json` (`level.js:15`) and checks it
  against the map (size, base, blocking). Low-poly loads `road_mask.png` for worn roads (`:376-386`). A stale or
  failed level shows a red banner (`:337-365`).

### 1.4 Frame order (`renderFrame`, `index.js:430-520`)
1. `resize`.
2. `inBattle = state.waves.active`; `stepYaw`, `clampCamera`.
3. Landing intro camera (`introCamera`) while the landing runs.
4. Structures → `system.setStructures` (System kinds) and `markers.setStructures` (the rest). Changes invalidate
   shadows.
5. `system.update(dt, state)` (turret slew).
6. Resources → `resources.setResources` (or markers). Changes invalidate shadows.
7. Craft: `landing.step`, `craft.apply`/`update`, `craft.aim` (base cannon), `craft.scan`.
8. Units: `buildUnitViews` (dt ≤ 0.1), `landingHarvesters`, `dust.step`, `units3d.setUnits(views, cam.dist,
   tier.liveShadows)`.
9. Path lines update/sync.
10. `fx.update(state, map, events, dt, fxOpts)` (combat shots).
11. Flash lights.
12. Base-cannon FX `onEvents`/`step`/`sync`.
13. Coverage overlay.
14. `fxView.sync(fx)`.
15. `impacts.update(state, map, events, dt, views, …)`.
16. Health bars.
17. Gold pop-ups.
18. Repair sparks, then build dust.
19. Unload rings.
20. `impactsView.sync`.
21. Camera shake (impacts, base cannon, craft).
22. Fog.
23. Placement ghost.
24. `renderer.render`.
25. Gold labels (DOM, using the final shaken camera).
26. Stats (draw calls, triangles).

### 1.5 The `fxOpts` hooks (`index.js:215, 234-326`)
- `getDef` = `getUnitDef`. `projFx`/`projScale` are refreshed each frame.
- `trail(kind, …)`:
  - `missile`: white-hot core, tight flame, thin contrail.
  - `rocket`: ragged orange tongue, embers and brown smoke while burning (flight fraction < 0.55), then a dim coast.
  - `burst`: AA proximity burst, with a flash, fire, sparks and a black smoke puff.
- `fire(kind, firingPoint, look)`:
  - shell/flak/tracer: muzzle flash and forward cone, fire tongue, brake petals and side puffs, sparks, gunsmoke
    (`fx/muzzleSmoke.js`), a ground shock ring and the dust it lifts.
  - rocket: starter plume and backblast.
  - missile: ignition puff.
- `muzzle(id, n)` → `system.muzzle` (tower firing points). `boom` → `impacts.boom`.
- All of them emit into the world-impact particles (§6.2).

## 2. Camera, input and picking

### 2.1 Camera (`render3d/camera.js`, pure)
- **Frame:** X east (column), Z south (row), Y up. **1 world unit = 1 cell**; `cellToWorld(c) = c + 0.5` (`:28`).
- **Constants** (`:14-23`): pitch 37°, FOV 30°, near 0.5, far 600, distance 10–95 (start 46), pan margin 2 cells past
  the map.
- **Start:** centred on the base cell, or the map centre (`:36-44`).
- `clampCamera` keeps the target inside `[-2, cols+2] × [-2, rows+2]` (`:47-52`).
- **Yaw:** free outside battle. In battle `stepYaw` eases any yaw back to 0 and `twistBy` refuses to turn
  (`:89-113`).
- **Picking:** `pickRay` matches `THREE.Raycaster`; `rayToGround` hits Y = 0; `screenToGroundCell` returns null off
  the map; `groundCellToScreen` returns null behind the camera (`:125-180`).

### 2.2 Camera gestures (`index.js:102-139`)
- One pointer pans. Right-drag turns the view outside battle, and pans in battle.
- Two pointers pinch-zoom (`dist = dist0 · d0/d`) and twist (outside battle).
- The wheel zooms by `exp(deltaY · 0.001)`.
- These listeners run **alongside** the input listeners on the same canvas. Nothing stops one-finger panning
  while a tower is armed.

### 2.3 Input (`input/input.js`)
- `createInput(canvas, renderer, getState, submit, ui, opts)` (`:313`).
- **Tap detection** (`:304-362`): a tap moves at most `TAP_SLOP` 8 px and lasts at most `TAP_MS` 500 ms. With
  `tapToAct` the action fires on pointerup. A second finger makes the gesture a pinch, which never acts;
  `pointercancel` never acts.
- **Placement** (`:139-165`): with a tower armed, a tap submits `{type:'place', structId, cell, slot}` and the tool
  stays armed. Tapping an existing structure selects it and drops the tool.
- **Validity:** `refreshHoverValidity` calls the sim's `validatePlacement` every frame and writes `ui.hoverValid`
  (`:73-90`). The sim re-checks when the command lands.
- **Cancel:** right/middle click, the context menu, Escape, the same number key or palette button again.
- **Touch lift:** `eventToCell` aims `TOUCH_LIFT` 1.4 cells straight up-screen for touch while a tool is armed
  (`index.js:589-597`). Today this is the only thing keeping the finger off the slot.
- **Keys:** 1–9 pick builds, Space starts the wave, U/X/R upgrade/sell/repair.

## 3. Lighting and quality

### 3.1 Lights (`lighting.js`)
- **Sun:** from `render/sun.js`, azimuth 135° and elevation 45°, so light comes from the north-west (`:19-22`).
- **Lights:** ambient 0.6. The sun's intensity is (1−ambient)/dir.y, so flat sunlit ground is exactly 1.0. The
  hemisphere light starts at 0 (`:36-68`).
- **Shadows:**
  - Orthographic shadow camera over the map, `BasicShadowMap` (hard edges), bias −0.0006, map size from the tier.
  - **Static:** `autoUpdate = false`, rendered once, re-armed by `invalidateShadows()` on structure, resource,
    touchdown or world changes. Never re-rendered per frame.
- **`setWorld(WORLD_LIGHT[k])`** changes the clear colour, ambient, hemisphere colours and sun colour. It never
  moves the sun.

### 3.2 Quality tiers (`quality.js:14-28`)

| Tier | DPR cap | Shadow map | Live unit shadows | Ground res | Tufts | Shots / flashes | Flash lights |
|---|---|---|---|---|---|---|---|
| High | 2 | 4096 | yes | 1 | yes | 400 / 200 | 4 |
| Standard | 2 | 2048 | yes | 1 | yes | 400 / 200 | 2 |
| Low | 1.5 | 1024 | no | 0.5 | no | 80 / 40 | 0 |

- **Auto pick** (`:41-48`): Low for weak GPUs (swiftshader, llvmpipe, old Mali/Adreno, PowerVR SGX), ≤ 2 GB
  memory, ≤ 2 cores or max texture < 4096. Otherwise mobile devices get Standard and desktops get High.
- **Override order:** `?quality=` → Settings (`bw.quality3d` in localStorage) → auto.
- **Known gap:** the world-impact budget is **not** tiered. `LOW_IMPACT_CAPS` exists (`fx/impacts.js:62-64`) but
  `impacts.setCaps` is never called at runtime, so Low devices get the full particle budget. Only combat shots get
  `tier.effects`. Filed as `[MM-task_mveeqkyi_h]`.

## 4. The world

### 4.1 Ground (`ground/lowpoly.js`, default)
- A 0.5-cell jittered triangle grid, one flat colour per triangle (`:26-28`, `:101-131`).
- **Colour layers** (`createGroundColour`, `:66-95`): noise bands teal→grass→lime; terrain-class fields (brush,
  forest, stone, lilac, dirt/sand); worn roads from the baked road mask's red channel; water bands.
- **Tufts:** 3-blade cones on grass and brush. They skip blocked cells, the base's 3×3 and roads (`:137-158`).
- **Apron:** a plane (cols+200)×(rows+200) in the world's apron colour at y −0.02 (`:217-225`).
- **Low tier:** a 1-cell grid and no tufts (`index.js:409`).
- **Variants:** `ground/baked.js` (`?ground=baked`) is one textured plane per tile with a dark apron.
  `ground/synthTerrain.js` makes terrain codes up for maps that have none.
- **Palettes:** 12 world palettes in `styles/lowpoly-palettes.js`: meadow, autumn, winter, canyon,
  tropical, sakura, dusk, volcanic, alien, highlands, lunar, savanna. `WORLD_LIGHT` holds the matching lighting. Each
  faction's planet names its palette in `data/planets.js`. A palette may set `bare` (no grass tufts or grass texture)
  and `craters` (crater bowls and rims shaded into the ground) — `lunar`, Lumen's barren moon, sets both.

### 4.2 Obstructions and resources
- **Placement plan** (`obstructions/placement.js`, seed 1234):
  - Plateaus stack up to 3 courses by neighbour count.
  - Rocks are boulders plus pebbles; rock borders get cosmetic pebbles.
  - Trees come from authored `map.decor[]`, then from bare tree cells: 55% round, otherwise pine.
  - A "no invisible walls" invariant is checked (`:110-118`).
- **Meshes** (`obstructions/lowpoly.js`): displaced icospheres, merged into two flat-shaded meshes (rocks, trees)
  that cast and receive shadows. **Not instanced.** There is no voxel obstruction module.
- **Resources** (`resources/resources3d.js`, with a planet): 4 tiers × (lit + glow) `InstancedMesh`, cap 600,
  plus a ring under each node.
  - `resources/models.js` has 36 part-list models (9 planets × 4 tiers).
  - A draining node shrinks in quarter steps, and a regrowing stub dims (`:367-382`).
  - Without a planet the fallback is low-poly crystal shards (`structures/lowpoly.js:115-127`).

## 5. Things on the map

### 5.1 The part-list model format (`units/prims.js`)
- **Axes:** X forward, Y up, Z right; about 4 model units per hull length.
- **Part types:** `box`, `cyl`, `ext` (extruded polygon with holes), `loft` (sections along an axis), `ell`.
- **Per-part fields:** `p`, `r3` (Euler degrees, YZX), `mir` (mirrored copy), `g` group, `m` material key, `d:1`
  (detail part, dropped at LOD).
- **Grouping:** parts are grouped by group, then material. Each group sits at its pivot, with geometry stored
  pivot-relative, so an instance matrix is `base · T(pivot) · R` with no −pivot.
- Flat-shaded, non-indexed. Shared by units, System towers, the craft, resources and the menu.

### 5.2 Units (`units/*`)
- **Models** (`units/models.js`): `tank` (twin-barrel MBT, turret group), `buggy` (turret), `beetle` (body only),
  `jet` (body only), `tiger` (King Tiger).
  - The Tiger is authored with `weapon` + `head` but folded into `turret`, so its radar head turns with the turret
    and never sweeps (`:286-290`).
- **Model keys** (`units/modelKeys.js:15-30`): art class → model, scale.
  - Own models: tank, plane→jet, heavyTank→tiger.
  - Stand-ins: artillery→tank 0.95, truck→buggy, infantry→beetle 0.55, copter→jet 0.8, missile→jet 0.6,
    heavyBomber→jet 1.4.
  - `SYS-Harvester` → buggy 0.9.
  - `UNIT_SCALE` 0.27. Never returns null (domain fallback).
- **Drawing** (`units/models3d.js`):
  - Per model and group: full, LOD and planar-shadow `InstancedMesh`es sharing one matrix buffer, cap 600.
  - LOD beyond camera distance 22 (`lod.js:20`).
  - Planar shadows are projected to y 0.03 along the sun, with a stencil so overlaps darken once.
  - Units receive the static shadow map but don't cast into it.
  - Matrices: root = T · Ry(−heading) · S(0.27·scale); turret = root · T(pivot) · Ry(−(aim−heading)) (`:159-170`).
  - About 16 live draw calls (8 lit + 8 shadow).
- **Views** (`units/unitViews.js:45-64`):
  - `buildUnitViews` → `{id, model, scale, x, y, z, heading, aim}`, straight from the sim's `u.pos` with no tick
    interpolation.
  - Flyers sit at `HOVER_HEIGHT` 1.1. `HOVER_HEIGHT` is duplicated in `models3d.js:28`, and the jet's
    `hover: 1.4` is unread.
  - Aim comes from the target (unit, structure or base); with none, it follows the hull.
- **Heading** (`render3d/heading.js`): travel direction after 0.2 cells of movement. The hull eases at 240°/s, the
  turret at 300°/s.
- **Material** (`units/material.js`, `metal.js`): one MeshPhong with vertex colours, patched for metalness, fake
  environment reflection and fresnel. Glow parts are unlit. `UMETAL` holds [metalness, roughness] per material key.

### 5.3 Structures
- **System towers** (`structures/systemModels.js`): groups `body`, `weapon` (yaws), `head` (rides the weapon).
  - Models: `sys_cannon` (barrel fixed at 8° elevation, 1 muzzle), `sys_flak` (twin, alternating), `sys_rockets`
    (fixed 28°, 4 noses), `sys_missile` (fixed 18°, 8 tubes), `sys_wall`, `sys_mg`, `sys_harvester`.
  - `SYSTEM_SCALE` 0.25–0.32.
  - `sys_mg` and `sys_harvester` are authored but never instanced (`system3d.js:28`).
- **Binding** (`structures/system3d.js`):
  - Kind → model: antiGround→cannon, antiAir→flak, wall→wall. STR-Rockets and STR-Missile map by id.
  - Towers face away from the base. Walls join along neighbour axes.
  - One `InstancedMesh` per model and group, with the lifecycle tint in `instanceColor`. Only `body` casts shadows.
  - Matrices: `writeMoving` sets weapon = root · T(pw) · Ry(wy−ry) and head = weapon · T(ph−pw) · Ry(sweep)
    (`:160-176`).
  - Turrets slew at 5 rad/s toward `s.targetId`, but only **unit** targets are resolved. A structure or base
    target leaves the turret idle (`:194-208`).
  - `muzzlePoint(it, wy, i)` returns the yawed barrel tip, axis, breech, brake and ground foot (`:93-109`). It
    turns by yaw only.
- **Lifecycle look** (`structures/models.js:264-278`):
  - Building/Placing: rises in 4 steps (sy 0.3→0.9) with a cool tint.
  - Upgrading: warm tint. Selling: grey. Damaged: D1, or D2 below 40% hp.
- **Other structures** (`structures/lowpoly.js`): bays and fallback blocks, plus the base mesh. The base mesh is
  hidden while the landing craft is the base.

### 5.4 The base: landing craft (`craft/*`)
- **Ten crafts** (`craft/models.js:961`), each 3×3, with gear and doors:
  - `lc_neutral` BS-7 Pathfinder — cannon
  - `lc_ground` Ironhoard Casemate — anti-troop gun
  - `lc_air` Skylark Carrier — AA missiles
  - `lc_hightech` Sterling Vault — shield
  - `lc_artillery` Siegeworks — mortar
  - `lc_water` Tideborn Ark — rockets
  - `lc_arcane` Sanctum of the Flame — shield
  - `lc_space` Lumen — railgun
  - `lc_dark` Hollow Choir — mortar
  - `lc_greenies` Brood Hive — rockets
- **Drawing** (`craft/craft3d.js`): plain meshes, metal material, glowing engine parts.
  - Plumes are skipped on Low.
  - Ground decals: blob shadow, dust, glow pools, scorch, shock ring, and a shield dome for shield crafts.
  - Nav lights, smoke and debris.
  - `aim(worldYaw)` eases the roof weapon's yaw only. `muzzleWorld()` is a **fixed** local point (2.4, 0.35, 0)
    in weapon space (`:443-458`).
- **Landing** (`craft/landing.js`, deterministic, no clocks): approach 4.2 s → descent 3.2 s → touchdown 1.0 s →
  hatches 1.4 s → deploy 4.2 s, 14 s in all. Events: gearDown, touchdown, hatchesOpen, rampsDown, deployStart,
  done. Harvesters roll down the ramps and are handed to their sim positions.
- **Intro order:** every level runs landing → map banner → how-to-play → contract → wave intel → speaker.

## 6. Effects

### 6.1 Combat shots (`fx/combatFxModel.js`, `combatFx.js`)
- **Model:** pure and read-only, with its own mulberry32 seeded from the map.
- **Heights:** `MUZZLE` (ground 0.35, structure 0.85, antiGround 0.6, antiAir 0.5, barrel 0.42); `AIM` (ground
  0.3, structure 0.5, base 0.6).
- **Recipes** (`:32-46`):
  - `RECIPES`: antiGround shell 0.55 s × 3 (the generic default); antiAir homing missile 0.6 s × 2; units 0.6 s × 1.
  - `STRUCT_RECIPES`: STR-Cannon shell, STR-Rockets rocket × 4, STR-Missile missile. Cadence (and the cannon's
    burst) are **read from `data/tables.js`**: the cannon is 1.5 s × 2 (owner, 2026-10-18), rockets 3.0 s,
    missile 1.6 s.
  - The sim has no fire rate (tower damage is continuous `dps × dt`, `sim/combat.js:569-599`), so cadence is a
    render hint only.
- **`fire()`** (`:196-215`):
  - Per-shooter clock with ±15% jitter.
  - **ON_TARGET gate:** a modelled turret holds fire until its yaw is within the kind's cone (shell/flak 0.35,
    tracer 0.5, missile 0.9, rocket 0.6). Yaw only.
  - Barrels cycle via `roundNo`; extra rounds are queued (0.07 s; rocket 0.24, missile 0.12).
- **Flight** (`advance`, `:312-385`):
  - Shells, flak and tracers fly **straight** at constant speed.
  - Rockets lob on `apex = 0.9 + 0.12·dist`.
  - AA missiles home with a turn rate that grows with flight time and closeness, burst on the proximity fuse or as
    range opens, and time out at 2.6 s.
- **Origins:** tower shots leave the modelled firing point; **unit shots leave the cell centre** at
  `MUZZLE.ground` (`:271`), since units have no firing points.
- **View:** one instanced additive quad billboarded along the flight direction, with a round head and a fading
  tail (`combatFx.js`).

### 6.2 World impacts (`fx/impacts.js`, `impactsView.js`, `particles.js`)
- **Particle kinds:** SPARK, FIRE, FLASH, EMBER (additive), SMOKE, DUST (alpha).
  `emit(kind, x,y,z, vx,vy,vz, life, size, grow, shade, dusty, drag)` (`:112`); `ring()` for ground rings (`:473`).
- **Events → recipes:**
  - `damage` → `fxHit`: sparks off the plate, with `fxGround` as fallback; throttled per pair.
  - `kill` → `fxExplode`: a ground unit booms, leaves a burning wreck and blows its turret off; a flyer falls and
    booms.
  - `destroyed` → `boom(1.3)`; `mineExplode` → `boom(0.6)`.
  - Each event is consumed once.
- **Wrecks:** falling → burning → charred → sinking → removed, evicted oldest-first per model and part.
- **Shake** decays at 0.6/s.
- **Caps:** `DEFAULT_IMPACT_CAPS` additive 4000, smoke 1500, … (`:54-56`). Not tiered at runtime; see §3.2.
- **Emitters that feed it:**
  - `muzzleSmoke.js`: cannon gunsmoke, born tip-sized (0.05), pushed out at 1.2–2.2 with drag 3.2, then grows ~8×
    and clears over ~2 s.
  - `dustTrail.js`: moving ground vehicles (≥ 0.12 cells/s), from both track rears.
  - `repairFx.js`: blue weld sparks cooling to orange, 26/s, plus a shower on completion.
  - `buildFx.js`: build-site dirt puffs; see the polish plan (CP-7).
  - `flashLights.js`: a pool of point lights pulsed by large flashes (High 4, Standard 2, Low 0;
    `?flashlights=N`).
- **Base super-cannon** (`fx/cannonFx.js`): 7 styles keyed by the craft's weapon (shell, rail, mortar, rockets,
  missiles, gatling, energy). It shows a reticle on `cannonAim`. Shells launch from `muzzleWorld` on `cannonShot`
  and land on the sim's impact time with a boom, ground fires and shake. A pulsing red ground-decal shader draws
  the reticle. All shell shadows share one material (`:160, :186`).

## 7. Overlays and HUD in the world

- **Fog** (`overlays/fogModel.js`, `fog.js`):
  - `fogWindow` is the play area: campaign `rings`, or forge maps' per-wave `waveWindows` (defaults in
    `content/maps/wave-windows.js`; wave 1 is 24×16 of a 64×32 world), widened ±2 cells around the base. No windows
    means no fog.
  - The veil is one quad 400 cells past the map: a flat 0.34 (open) or 0.38 (gated) darkening outside the window,
    a cyan outline, and a 0.9 s reveal flash when the window grows.
  - Terrain, decor and units are drawn to the full map edge regardless.
- **Placement ghost** (`overlays/placement.js`): a single-cell box, green or red from `ui.hoverValid`. It never
  decides validity and ignores footprints.
- **Path lines** (`overlays/pathLinesModel.js`, `pathLines.js`): one line per live ground origin, routed with the
  sim's `findRoute`, fading in and out. One ribbon mesh with scrolling chevrons.
- **Health bars** (`overlays/healthBars.js`):
  - Units get one from their first hit, structures while damaged, the base once hit (for the match).
  - The fill eases, with a damage chunk and a hit flash.
  - One instanced billboard, cap 700.
- **Gold pop-ups** (`overlays/goldPopups.js`): "$N" DOM labels for kill income and deposits, rising and stacking.
- **Unload rings** (`overlays/unloadFx.js`): a fill ring plus glints toward the base for harvester deposits.
- **Coverage** (`overlays/coverage.js`): the selected tower's range and same-type coverage, the build-ghost range,
  mine rings, the selected unit's range.
- **Minimap** (`render/hud.js:692-709`, DOM): attackers only, redrawn every 500 ms. Flyers are white, others red.
  No fog awareness.

## 8. Menu 3D (outside the battle view)

- `menu/menuStage.js`: one alpha WebGL canvas with scissor regions drawing every visible `[data-globe]`,
  `[data-craft]` and `[data-res]` element. Globes can be drag-spun; the craft and resources turn on turntables. It
  stops when the menu closes and clears its last frame.
- `render3d/planet/globe.js`: fbm continents, oceans or lava, craters, polar caps, a +35% saturation push, a rim
  haze, drifting clouds and a BackSide atmosphere halo. The same shader is used by `tools/planets/bake.html`.

## 9. Contracts

- **Read-only on the sim.** No assignment to `state.*` anywhere in `render3d/**` (tests excluded). Landing
  harvesters are shallow copies.
- **No clocks or `Math.random` in the battle view.** There are zero code hits in `src/render3d`; tests trap
  `Math.random`. Render randomness comes from seeded mulberry32 or Lehmer PRNGs and GLSL hash noise.
  `performance.now` appears only in the menu's globe spin.
- **Not replay-deterministic by design.** Effects advance on real frame `dt` (clamped to 0.1 s), so visuals depend
  on frame timing. The sim does not.
- **Deploy gates** stay green: `renderTiers.test.mjs`, `render/voxel/pack.test.mjs`.

## 10. Known discrepancies (as of this snapshot)

1. Low tier never reduces world-impact particles (`LOW_IMPACT_CAPS` unused). `[MM-task_mveeqkyi_h]`
2. Towers don't aim at structure or base targets (`system3d.js:194-208`). CP-4.
3. Turrets only yaw. Barrel elevations are fixed at build time, and firing points and the on-target gate are
   yaw-only. CP-2/3/5/6.
4. Unit shots leave the cell centre (no unit firing points). CP-5.
5. Flyers park in mid-air while attacking (the sim stops them at range; the view draws the sim position). CP-11.
6. `sys_mg` and `sys_harvester` are authored but never instanced.
7. The King Tiger's radar head doesn't sweep (folded into the turret).
8. The craft's `muzzleWorld` is a fixed point for every weapon.
9. `HOVER_HEIGHT` is duplicated; the jet's `hover: 1.4` is unused.
10. All base-cannon shell shadows share one material, so per-shell opacity overwrites it.
11. The placement ghost is always one cell, whatever the footprint.
12. One-finger camera pan can't be suppressed while placing (touch). CP-10.
13. Stale comments: `units/models.js:1` says "four" models (there are five); `craft3d.js:89` names a
    `harvesterWorld` method that is called `toWorld`.

## 11. Tests (by area)

- **Units:** `units/units3d.test.mjs` (golden triangle counts, groups/pivots, colours, LOD, roster resolution, views,
  heading), `units/metal.test.mjs`.
- **Structures:** `structures/structures.test.mjs` (heights, footprints, joins, facing, lifecycle, instancing),
  `structures/system3d.test.mjs`.
- **Craft:** `craft/craft.test.mjs` (ten crafts, palettes, footprint, timeline, pose, ramps, harvester hand-off,
  intro camera).
- **FX:**
  - `fx/combatFx.test.mjs` (17, including cannon cadence from tables, homing, no orbit, read-only, determinism)
  - `fx/impacts.test.mjs` (18)
  - `fx/firingPoints.test.mjs` (5)
  - `fx/cannonFx.test.mjs`
  - `fx/muzzleSmoke.test.mjs`
  - `fx/repairFx.test.mjs`
  - `fx/buildFx.test.mjs`
  - `fx/dustTrail.test.mjs` (with flash lights)
- **Overlays:** `overlays/fog.test.mjs` (windows, reveal, camera yaw), `overlays/pathLines.test.mjs`, health bars, gold
  pop-ups, unload rings, coverage.
- **Picking:** `picking.test.mjs` (ray = Raycaster, round trip, touch lift, tap places, drag/long-press/pinch never
  place, cancel).
- **Other:** `quality.test.mjs`, `render3d.test.mjs`, ground and obstruction suites.
- All of them run locally with `npm test`, and the pre-push hook runs them too. There is no GitHub CI (owner rule,
  2026-10-18).

## Dependencies
| relation | plan | what it holds that this document does not restate |
|---|---|---|
| related | docs/tech-plan/Terrain-Engine-3D-and-Threejs-Migration.md | the plan the 3D view was ported under: goals, decisions, stories T0–T7 |
| related | docs/dev/Terrain-Engine-3D-Code-Design.md | the prototype handoff the port came from (as planned, not as built) |
| related | docs/dev/Terrain-3D-Ground-Truth.md | the T0 audit of what the pre-3D code did |
