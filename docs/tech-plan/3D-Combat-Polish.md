# TECH PLAN — Bulwark 3D Combat Polish (v1.1)

**Provenance.** Owner sentences are quoted and marked **owner**; everything else is **agent-proposed**. Written
2026-10-18 by the repo-rooted cloud session (Claude Code, Opus 5.5) from the owner's requests that day, the
as-built design snapshot `docs/dev/Battle-3D-DD.md`, and the repo at `main` @ `a21a6e3`. Epic `epic_mvedxju3_3`.
**The repo copy is canonical**: `docs/tech-plan/3D-Combat-Polish.md` on `main`; the MetaMax document mirrors it.

v1.0 (2026-10-18) puts the plan in the house format and in the tech-plan folder. **owner**: "There is a format for
technical plans and a folder they should be place[d] in." It replaces the draft
`docs/16 Bulwark MM/tech-plan/TECH-PLAN-Combat-Polish-Barrels.md` (MetaMax
`TECH_PLAN::TECH-PLAN-Combat-Polish-Barrels.md`), which had the right content in the wrong place and shape. The
baseline it builds on now lives in its own document, `docs/dev/Battle-3D-DD.md`, so this plan cites that document
(as **DD §n**) instead of restating the code. **owner**: "It might be good to create a complete design doc
snapshot of the current threejs battle system. Then begin the development … Work from this new tech plan."

v1.1 (2026-10-18) records the barrel chain as built on one branch, `feat/barrels` (CP-2 … CP-6, CP-8), and adds
CP-13 (aircraft clear terrain). **owner**: "keep building c 2,3,4,5,6,7" (CP-7 had already merged, so this meant
CP-2 … CP-6) and "also check plane elevation against the height of the plateaus, rocks, trees". The cannon apex
became quadratic (§3.1), the tank's twin guns became two groups so only the one that fired recoils (§5), and the
barrel chain ships as one PR because each step builds on the one before (§11).

Owner request: polish the 3D battle (fire rate, barrels, smoke, construction, placement on mobile, aircraft and fog).

---

## 0. Governing decisions

### 0.1 Owner goals (2026-10-18)
1. **owner**: "the cannon tower should slow their fire rate."
2. **owner**: "rebuild all towers, tanks, and base defenses to have barrel that can go up and down based on fire
   trajectory."
3. **owner**: "when build up a unit there should be dirt puffs around the base during constriction [construction]."
4. **owner**: "The smoke on a cannon fire needs to be small as the barrel tip, it should have a little velocity out
   from barrel and it's should expand and dissipate."
5. **owner**: "the tower placement on mobile should use a virtual joystick so the finger controlling placement does
   not sit on the placement location. The placement slot should show up and left of the touch point and it should
   build on finger release."
6. **owner**: "attacking planes should not stop, they should do attack runs then circle back and attack again.
   Drones and copters can hover."
7. **owner**: "draw the map 5 cells beyond the actual focus play area, but I want a darkened fog and all units
   outside of the play area should be indicated with red reticle to hide what unit type they are." **owner**:
   "Darkened area similar to a vignette effect."
8. **owner**: "also check plane elevation against the height of the plateaus, rocks, trees." (added v1.1)

### 0.2 Decisions taken (owner answers, 2026-10-18)
- **D1 Cannon pace:** 2-round volleys every 1.5 s. **owner**: "Yes." (to "Is 1.5 s per volley the right pace?")
- **D2 Recoil:** **owner**: "Yes but no recoil on guns, missiles or rockets." So only cannon-type barrels recoil:
  the cannon tower, tank and Tiger/King Tiger main guns, and the base super-cannon.
- **D3 Attack runs:** render-only flight path (owner picked "Visual flight path (Recommended)"). Damage, balance
  and replays stay unchanged.
- **D4 Fog margin:** a vignette, not a flat tint and not a hard line.
- **D5 Scope:** **owner**: "Put this work in the same plan." Items 5–7 joined this epic.

### 0.3 Terms
- **Barrel group / trunnion:** a model group holding the gun parts, pivoting about the trunnion axis for pitch,
  under the yawing `weapon`/`turret` group.
- **Firing point:** a model's `muzzles[]` entry (tip, axis, breech, brake). Today only System towers have them
  (DD §5.3).
- **Play area:** the fog window (`fogWindow`, DD §7): the current wave's window on forge maps, or the ring on
  campaign maps.
- **Hidden contact:** an enemy unit outside the play area, drawn as a red reticle.

### 0.4 Corrections found while planning (verified in source)
1. **The sim has no fire rate.** Tower damage is continuous `dps × dt` (`sim/combat.js:569-599`). Cadence is a
   render hint, so goals 1 and 4 change visuals only, never balance (DD §6.1).
2. **Towers never aim at structures or the base.** `system3d.update` resolves only unit targets (DD §5.3). Pitch
   needs a real target, so this gap is fixed first (CP-4; fixed on `feat/barrels`, v1.1).
3. **Low tier never reduces world-impact particles.** `LOW_IMPACT_CAPS` is unused (DD §3.2). This is outside this
   plan's goals but filed on the epic as `[MM-task_mveeqkyi_h]`, because the new dust and smoke add to the same
   budget.

## 1. What exists today
See **DD** (`docs/dev/Battle-3D-DD.md`, snapshot at `main` @ `a21a6e3`). The parts this plan changes:
- **Fire rate:** DD §6.1 (`STRUCT_RECIPES`, cadence from `tables.js`).
- **Barrels:**
  - DD §5.3: System towers; fixed elevations (cannon 8°, rockets 28°, missile 18°); `writeMoving`; yaw-only
    `muzzlePoint`.
  - DD §5.2: unit turrets, with no barrel group or firing points.
  - DD §5.4: the craft's roof weapon, which yaws only and has a fixed `muzzleWorld`.
- **Trajectories:** DD §6.1. Shells, flak and tracers fly straight; rockets lob on `0.9 + 0.12·dist`; missiles home.
  The base cannon lobs on `(1.6 + 0.32·d)·apexK` (DD §6.2).
- **Construction:** DD §5.3 (4-step rise and tint). Nothing listened for build events until CP-7.
- **Placement input:** DD §2.2–2.3 (tap-to-place, `TOUCH_LIFT` 1.4 cells up-screen, one-finger pan always on).
- **Aircraft:** DD §5.2 and §10.5. Flyers stop at range in the sim, and the view draws the sim position.
- **Fog and minimap:** DD §7 (flat veil, cyan outline, everything drawn to the map edge; the minimap shows flyers
  white).

## 2. Fire rate (goal 1) — CP-1, **delivered PR #64**
- `STR-Cannon` gains `cadence: 1.5, burst: 2` in `data/tables.js` (render hint; dps unchanged).
- The 3D `STRUCT_RECIPES` reads cadence and burst from `tables.js` instead of copying them (Rockets and Missile
  too), and the Pixi renderer reads the same burst. This took ~24 rounds per 4 s down to 6.
- Flak keeps its AA-missile recipe and gets no data fields yet.

## 3. Elevating barrels (goal 2) — CP-2 … CP-6

### 3.1 Pitch from the trajectory — CP-2
- A new pure module, `render3d/fx/elevation.js`, exports `pitchFor(kind, from, to, apex)`:
  - **Straight shots** (tank guns, flak, tracers): `atan2(dy, horizDist)`. A small angle that tilts down on high
    ground and up at aircraft.
  - **Lobbed shots** (cannon tower, rockets, base super-cannon): the parabola's launch slope,
    `atan((4·apex + dy) / horizDist)`. Far targets get a high lob, near ones a flat one.
- **The cannon tower switches to a lobbed shell,** with a modest apex scaling with distance, below the base
  cannon's. That gives its barrel a visible reason to rise with range.
- **One function serves both** the flight path and the barrel angle, so they cannot disagree.
- Rocket racks and missile pods tilt to their launch angle instead of the fixed 28° and 18°.
- **As built (v1.1):** `pitchFor(from, to, apex)` and `apexFor(kind, d)` with `LOB` as data. The cannon's apex is
  **quadratic**, `0.035·d²`, so its launch slope `(dy + 4·apex)/d` rises with range (nearly flat at 1–2 cells, about
  30° at its 4.5-cell reach). A linear apex with a constant term did the opposite: the slope `4·base/d` fell with
  range. Rockets use `0.25 + 0.2·d` (bug fix `task_mvejw9k0_m`: the old `0.9 + 0.12·d` stood the rack at 47–65° up close, where its yaw no longer read; now about 40–48°, capped at 50°). The STR-Cannon recipe has `lob: 1, speed: 13`.

### 3.2 The barrel rig — shared convention
- **Convention:** an optional **`barrel` group with a trunnion pivot** under the yawing group.
- **Motion:**
  - Pitch slews at a model-set rate, between a depression and an elevation limit per model.
  - It eases back to rest when idle.
  - It is render-only and driven by frame time, never the tick.
- **CP-3 System towers:**
  - `mergeSystemModel` and the instancing gain a fourth group.
  - `writeMoving` composes `W · T(P − pw) · Rz(pitch)` for the barrel.
  - `muzzlePoint` tilts the tip, axis and breech about the trunnion before yawing, so flash, smoke and shell leave
    the real tip.
  - The `ON_TARGET` gate checks pitch as well as yaw.
  - Cannon, flak, rockets and missile; the cannon's parts are already tagged `el:1` with a trunnion `P`.
- **CP-4 Aiming gap:** towers aim at structure and base targets as well as units.
- **CP-5 Units:**
  - Tank, buggy and Tiger/King Tiger split their gun parts into `barrel` with a trunnion pivot. `models3d.js`
    composes the pitch after the turret yaw.
  - Units gain `muzzles`, so their shots leave the tip instead of the cell centre.
  - Beetle and jet have no gun and are unchanged.
- **CP-6 Base super-cannon:** the craft's `wCannon` barrels pitch to the `cannonFx` launch angle. `muzzleWorld()`
  follows the tilted group.
- **As built (v1.1):**
  - **Towers:** each model's `barrel` data holds `authored` (the angle the parts are drawn at), `rest`, `min`, `max`,
    `rate` and `aim` (`shell` | `rocket` | `straight` | `missile`); `pivots.barrel` is the trunnion. The barrel
    pitches by `pitch − authored`, so the rocket rack and missile pods kept their authored 28° and 18° geometry.
    Pitch is aimed from the current firing point, the same point the round leaves, so barrel and flight agree.
    `towerTarget()` resolves drawn flyers, units, structures and the base (CP-4).
  - **Fire gate:** `muzzlePoint` reports `pmin`/`pmax`/`aim`; `combatFxModel` holds fire until the pitch is within
    `ON_PITCH` of `wantPitch()` (clamped to the limits, so an out-of-range target can't stall a barrel).
  - **Units:** `units/unitBarrels.js` slews `view.pitch` (straight shots) and serves `opts.unitMuzzle`; unit turrets
    aim at the drawn plane on an attack run. Wreck turrets keep their guns (barrels folded into the turret
    geometry).
  - **Base:** `cannonFx.baseLaunchPitch()` is the main round's own arc slope, from the gun's muzzle to the aim point;
    the gun is clamped 0–60°. The railgun's rails pitch too.

## 4. Construction dust (goal 3) — CP-7, **built (PR pending)**
- New `render3d/fx/buildFx.js`, the same shape as `repairFx.js`.
- **While building:** a structure in `Building` kicks up earthy puffs (`dusty`) on its footprint edge, drifting
  outward. The rate eases off as `progress` nears 1.
- **Events:** `build/start` breaks ground with a dust ring (`impacts.ring`) and a burst; `build/complete` settles
  with a softer burst. Each event is consumed once.
- **Quality:** counts scale with the tier (High 1, Standard 0.7, Low 0.25).

## 5. Recoil (decision D2) — CP-8
- **Which barrels:** cannon-type only (cannon tower, tank and Tiger main guns, base super-cannon). Guns (flak, MG,
  the buggy's energy gun), missiles and rockets never recoil.
- **Motion:**
  - On each shot the barrel slides back along its tilted axis, about 18% of its length in about 0.06 s, then eases
    forward over about 0.35 s.
  - On twin barrels only the barrel that fired moves.
- **How:** an offset along the barrel's local axis, after the pitch. The firing point is taken before the recoil,
  so the flash stays at the tip.
- **Data:** a per-model `recoil` field (length fraction; 0 = none) keeps it data-driven.
- **As built (v1.1):** `fx/recoil.js` (kick 0.06 s, run-out 0.35 s). `recoil` is a distance in model units
  (cannon tower 0.65, tank 0.2 per gun, Tiger 0.65, base shell gun 18% of its length; the railgun 0).
  `combatFxModel` calls `opts.kick(shooterKey, n)` for every round off a modelled barrel. The tank's twin guns are
  two groups (`barrel`, `barrel2`), so only the gun that fired moves. The base gun kicks on each `cannonShot`.

## 6. Gunsmoke (goal 4) — CP-9, **delivered PR #64**
- New `render3d/fx/muzzleSmoke.js` replaces the inline forward puff.
- Each puff is born no wider than the barrel tip (0.05 vs the tip's ~0.12). It leaves along the barrel at 1.2–2.2
  with drag 3.2, so it stalls about half a cell out, then grows ~8× as it fades over ~2 s.
- Five puffs per shell instead of nine. All values are named constants.

## 7. Mobile tower placement (goal 5) — CP-10
Touch only; mouse is unchanged.
- **Touch down with a tower armed:** the ghost appears **up and to the left of the finger**, a fixed screen offset of
  about 56 px left and 72 px up (CSS px), constant at every zoom. It replaces the straight-up `TOUCH_LIFT`.
- **Drag:** the ghost follows the finger at that offset, like a virtual joystick. While a tower is armed, a
  one-finger drag **moves the ghost and does not pan**. Two fingers still pinch, zoom and pan.
- **Release:** builds on the ghost's cell if it is valid (green), and the tool stays armed. Release on a red cell
  builds nothing.
- **Cancel:** slide back onto the build palette and release, add a second finger, or tap the palette button again.
- **Screen edges:** near the top or left edge, the slot point is clamped inside the view. Panning the camera at the
  edge is a follow-up.
- **How:**
  - `eventToCell` picks at `(clientX − ox, clientY − oy)` through `screenToGroundCell`.
  - `input.js` gains a touch "placing" press (no tap slop; place on pointerup at the ghost cell).
  - The camera's pan listener skips a pointer that input has claimed.

## 8. Aircraft attack runs (goal 6, decision D3) — CP-11
- **Flight path:** a new pure module, `render3d/units/flightPath.js`, gives each attacking plane a deterministic loop
  (phase seeded from the unit id, time from the render clock): an inbound strafing run, an overfly, a climbing
  banked turn, then back for the next run. Radius and speed scale with the unit's speed and range.
- **Fly-in:** planes fly in along their sim path. The loop starts when the sim says `'attacking'` and blends in from
  the current position.
- **Heading and bank:** from the loop's tangent (banking into the turn), not from `heading.js`.
- **Firing:** the plane's shots are drawn only on the inbound run. Damage is unchanged.
- **Everything follows the drawn plane:** the same offset (keyed by unit id) feeds AA missile homing (`aimPoint`),
  the shot origin, turret aim, health bars, wrecks and dust.
- **Which units:** a data flag in `tables.js`, `attackPattern: 'strafe'`, on Planes and `AIR-HeavyBomber`. Copters
  and Missiles (drones) have no flag and hover as today. Nothing checks `artClass` in code.
- **Rejected:** real attack runs in the sim. They would change plane DPS and dwell time in tower range, need a
  `balanceSim` re-baseline, and invalidate saved replays.
- **Follow-up:** copters and drones still use the jet model; their own rotor/drone models would make the hover read
  better.

### 8.1 Aircraft clear terrain — CP-13 (goal 8)
- **Problem:** flyers were drawn at a fixed `HOVER_HEIGHT` 1.1, while rocks reach about 2.4 and trees about 2.1, so
  planes and copters flew through them.
- **Built:** `obstructions/heightField.js` builds a per-cell top height from the obstruction meshes when the world
  is set. `createAirLift()` eases every flyer's drawn height (up 2.4/s, down 0.9/s) to at least the 3×3-cell maximum
  plus 0.45. Its `drawn` map feeds `fxOpts.flight`, the System turrets and the unit barrels, so aim, shots, homing
  and health bars follow the lifted plane. Render-only.

## 9. Fog margin and hidden contacts (goal 7, decision D4) — CP-12
Only where the fog is active; maps without windows are unchanged.
- **Vignette:** the fog shader goes from a flat tint to a smoothstep on distance outside the play area. It is clear at
  the edge and near-black at 5 cells out, with everything beyond fully dark, so the map visibly ends 5 cells past
  the play area. The cyan outline goes; the reveal flash on window growth stays. The width and curve are named
  constants.
- **Hidden contacts:** `buildUnitViews` tests each enemy unit against the play area. Outside it, the unit is drawn
  as a **red reticle** instead of its model:
  - Same size for every type; flyers get a ground reticle too, so type, size and altitude are hidden.
  - The reticle reuses the base cannon's pulsing red decal shader (`fx/cannonFx.js`).
  - Health bars, dust and the unit's own muzzle effects are suppressed.
  - Crossing in cross-fades over about 0.25 s. Player units are never hidden.
- **Minimap:** attackers outside the play area become plain red dots (no white for flyers).

## 10. Performance and quality
- Every new emitter goes through the world-impact particles and scales with the tier (CP-7 already does). Fixing
  `[MM-task_mveeqkyi_h]` makes the Low tier's particle budget real for all of them.
- Barrel groups add one instanced mesh per gun model (towers) or per gun unit group (units): about +5 draw calls for
  towers and +3 for units, at the same instance counts.
- Hidden-contact reticles are one instanced decal mesh (one draw call).

## 11. Plan — stories on epic `epic_mvedxju3_3`

| story | id | state (v1.0) / what remains |
|---|---|---|
| CP-0 DD snapshot + this plan | `story_mveenh2y_g` | DD and plan v1.0 merged (#66); v1.1 on `feat/barrels` |
| CP-1 Cannon cadence as data | `story_mvedxogl_4` | **delivered** (PR #64) |
| CP-2 Elevation solver + lobbed cannon shell | `story_mvedxq1v_5` | **built** on `feat/barrels` |
| CP-3 Barrels on System towers | `story_mvedxxo7_7` | **built** on `feat/barrels` |
| CP-4 Towers aim at structures and base | `story_mvedxzco_8` | **built** on `feat/barrels` (with CP-3) |
| CP-5 Barrels + firing points on gun units | `story_mvedy16u_9` | **built** on `feat/barrels` |
| CP-6 Base super-cannon pitch | `story_mvedy2wj_a` | **built** on `feat/barrels` |
| CP-7 Build-site dirt puffs | `story_mvedxrmi_6` | **delivered** (PR #67) |
| CP-8 Cannon recoil (cannons only) | `story_mvee15ja_b` | **built** on `feat/barrels` |
| CP-9 Cannon gunsmoke | `story_mvee3vj5_c` | **delivered** (PR #64) |
| CP-10 Mobile placement: offset slot, release to build | `story_mvee80a0_d` | **delivered** (PRs #68–#71) |
| CP-11 Plane attack runs (render-only) | `story_mvee9r08_e` | **delivered** (PRs #68–#71) |
| CP-12 Fog vignette + hidden contacts | `story_mveehs1r_f` | **delivered** (PRs #68–#71) |
| CP-13 Aircraft clear plateaus, rocks, trees | `story_mvegnpxf_i` | **built** on `feat/barrels` |
| BUG Low tier impact caps | `task_mveeqkyi_h` | not started; independent |

**Order:** independent stories first (CP-12, CP-10, CP-11, the bug), then the barrel chain CP-2 → CP-4/CP-3 → CP-5
→ CP-6 → CP-8. One branch and PR per story, merged only on owner approval — except the barrel chain, which v1.1
builds as one branch (`feat/barrels`, one commit per story, each stamped `closes [MM-…]`) and one PR, since every
step changes the files the step before it changed (the stacked PRs #68–#71 showed the cost of splitting such work).

**Overlapping epic** (planning rule `overlapping-epics-one-initiative`): the Terrain-Engine epic
(`epic_mv77hbbc_1`, created 2026-10-13, last updated 2026-10-17) is still open and overlaps this plan at the **file**
level. Board read 2026-10-18:
- **Backlog, not touching these files:** T1 (device numbers), T2/T2b (ground/roads), T6 (tool parity), T7 (Pixi
  removal), UMP, SUR, W.
- **In progress and overlapping:**
  - `story_mvbr0qfb_o` (System towers port): `structures/system3d.js`, `systemModels.js`, the files CP-3/CP-4 change.
  - `story_mvbry2p7_p` (3D parity umbrella): FX and `index.js`.
  - `story_mvbyf8gq_10` (Rocket/Missile towers): `systemModels.js`, `combatFxModel.js`.
  - `story_mvbqugeo_l` and `story_mvbr0oo5_n` (3D default; ground on every map): `main.js`, `ground/*`.
  - Their code is merged on `main` (PRs #51–#54, #58), but the tickets were never closed. Nothing is in flight on a
    branch.
- **Recommendation (owner decides):** close those five as delivered, or group the two epics under one initiative.
  Until then, each CP story branches from `main` and merges one at a time, so there is no integration branch to
  reconcile.

## 12. Tests
- CP-2: `elevation.test.mjs` (straight vs lobbed, monotonic with range, clamped); the lobbed shell lands on target.
- CP-3 (as built): `structures/barrels.test.mjs` — every armed tower has a barrel group and limits; at rest the tip is
  the authored one (so `firingPoints.test.mjs` stands unchanged); pitched, tip and axis follow; a farther cannon
  target wants a higher pitch; the drawn barrel and the firing point pitch together; the fx gate holds a flat
  barrel and fires once elevated.
- CP-4: the same file — `towerTarget` resolves units, drawn flyers, structures and the base; a tower turns to a
  structure target.
- CP-5: `units/unitBarrels.test.mjs` — barrel group, pivot, limits and muzzles per gun unit; the tip follows the
  turret, not the hull; a tank looks up at a hovering target and settles level; wreck turrets keep their guns.
- CP-6: `craft/baseGun.test.mjs` — the launch pitch equals the shell arc's slope at the muzzle; `elevate` slews,
  clamps and settles; `muzzleWorld` rises with the gun.
- CP-13: `obstructions/heightField.test.mjs` — clearance over obstruction tops, eased climb and descent.
- CP-7: `buildFx.test.mjs` (done).
- CP-8: `fx/recoil.test.mjs` — a cannon barrel recoils and returns; flak, rocket, missile, buggy and railgun barrels
  never move; only the tank gun that fired moves; the firing point is unaffected.
- CP-9: `muzzleSmoke.test.mjs` (done).
- CP-10: `picking.test.mjs`:
  - Up-left offset.
  - An armed touch drag doesn't pan, and release places at the offset cell.
  - Release on an invalid cell does nothing.
  - A second finger cancels.
  - Release over the palette cancels.
  - Mouse unchanged.
- CP-11:
  - A plane view is never stationary while attacking.
  - The loop is continuous and bounded.
  - Copter and drone views stay put.
  - AA homing aims at the drawn plane.
  - Shots are drawn only on the inbound run.
- CP-12:
  - `fog.test.mjs`: darkness is monotonic 0 → near-black over 5 cells, fully dark beyond.
  - `contacts.test.mjs`:
    - An outside unit gets a reticle and no model, bar or dust.
    - Flyer and walker reticles are identical.
    - Crossing cross-fades.
    - Maps without fog hide nothing.
  - The minimap colours hidden attackers red.
- **Always:** the full suite runs locally (`npm test` and the pre-push hook), with the deploy gates
  `renderTiers.test.mjs` and `render/voxel/pack.test.mjs`. No GitHub CI (owner rule).

## 13. Open questions
- **Q1:** the placement offset (about 56 px left, 72 px up) is a starting value to tune on device.
- **Q2:** the reticle's size and pulse rate are starting values to tune on device.

## 14. Out of scope
- Recoil on guns, missiles and rockets (excluded by D2). The voxel-era "BBB Barrel polish" epic's recoil story is for
  the old sprite pipeline; CP-8 is its 3D replacement.
- Sim-side fire rate, projectiles or attack runs (D3).
- Audio.
- The other discrepancies listed in DD §10 that no goal asks for (unused `sys_mg`/`sys_harvester`, the Tiger's
  head sweep, the shared shell-shadow material, the single-cell ghost).

## Dependencies
| relation | plan | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/dev/Battle-3D-DD.md | the as-built 3D battle view this plan changes: modules, frame order, matrices, recipes, fog, input |
| related | docs/tech-plan/Terrain-Engine-3D-and-Threejs-Migration.md | the plan the 3D view was ported under; its epic is still open (see §11) |
