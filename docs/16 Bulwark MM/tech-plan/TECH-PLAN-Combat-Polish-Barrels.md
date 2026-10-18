# Tech Plan — 3D Combat Polish: cannon, barrels, build dust, mobile placement, attack runs, fog margin

Status: owner decisions recorded 2026-10-18 · Bulwark MM (project 16)
Owner asks (2026-10-18): (1) the cannon tower should fire more slowly; (2) rebuild every tower, tank and
base defence so the barrel tilts up and down to match the shot's trajectory; (3) dirt puffs around the
base of a structure while it is being built. Added the same day: (4) cannon gunsmoke that starts tip-sized, is
pushed a little way out, then expands and clears; (5) on mobile, tower placement uses a virtual-joystick
offset so the finger never covers the slot, and the tower builds when the finger lifts; (6) attacking planes
never stop: they make attack runs, overfly, circle back and attack again, while drones and copters may hover;
(7) the map is drawn 5 cells past the play area under a vignette-style darkening, and every unit outside the
play area shows only as a red reticle that hides its type.

Every item is a client-side change (3D rendering, or touch input for item 5). The sim stays as it is, with
no gameplay or balance change, and the replay contract holds (no `Date.now()` / `Math.random()` in the tick path; the FX use their
own seeded PRNGs as today).

## Dependencies

| Document | Relationship |
|---|---|

(The 3D renderer this builds on is described in the Terrain-Engine-3D-and-Threejs-Migration tech plan.
That plan reads as stale against the code, so this plan cites source paths directly.)

## 1. What exists today (verified against source, main @ dd302e7)

Paths are relative to `prototype/test-game/`.

**Fire rate.** The sim has no fire rate: towers do `dps × dt` every tick (`src/sim/combat.js:569-599`).
How often a tower *visibly* fires is a render setting:
- The cannon's rate is hard-coded at `RECIPES.antiGround {kind:'shell', cadence:0.55, burst:3}`
  (`src/render3d/fx/combatFxModel.js:34`), so a 3-round burst every 0.55 s ±15%.
- `STRUCT_RECIPES` copies the Rockets (3.0) and Missile (1.6) cadences from `tables.js` by hand (`:39-43`).
- Pixi has its own 0.55 fallback (`src/render/renderer.js:682`).

So slowing the cannon changes only how it looks. Damage per second stays the same, and so does balance.

**Barrels.** Turrets only turn left and right.
- **System towers** (`src/render3d/structures/systemModels.js`) have three groups: body, `weapon` (turns) and
  `head` (sweeps). The cannon's barrel parts are already tagged `el:1`, and a trunnion point `P` is defined
  (`:38`), but the barrel is tilted a fixed 8° at build time (`:92-96`). Flak barrels, the rocket rack (fixed
  28°) and the missile pods (fixed 18°) all sit inside the turning group.
- **Turret matrices** are built as `root · T(pivot) · Ry(yaw)` in `writeMoving` (`system3d.js:160-176`).
- **Firing points**: `muzzlePoint` turns the muzzle offset by yaw only (`:93-109`), and so does the
  on-target check (`combatFxModel.js:199-200`).
- **Units** (`src/render3d/units/models.js`): tank, buggy and Tiger/King Tiger guns are part of the `turret`
  group, with no barrel group and no firing points. Unit shots start at the cell centre
  (`combatFxModel.js:271`).
- **Base super-cannon** (`src/render3d/craft/models.js:110-130`, `craft3d.js:443-458`) only turns, but its
  `muzzleWorld()` reads the weapon group's world matrix, so it will follow a tilted group for free.
- **Gap:** towers only aim at unit targets. A structure or base target falls back to the idle facing
  (`system3d.js:201-202`).

**Trajectories.**
- Shells, flak and tracers fly in a straight line (`combatFxModel.js:357-365`).
- Rockets lob: `apex = 0.9 + 0.12·dist`.
- The base cannon lobs: `apex = (1.6 + 0.32·d)·apexK` (`cannonFx.js`).
- Missiles home in on their target.

**Construction.**
- The sim sets `lifecycle 'Building'` and `progress`, and emits `build` start/complete events
  (`src/sim/structures.js:168-173, 318-324`).
- In the 3D view the only feedback is the 4-step rise with a blue tint (`structures/models.js:264-276`).
  Nothing listens for build events.
- `repairFx.js` is the pattern to copy: per frame it scans for a state, emits particles at a rate, and fires a
  burst on the event.

## 2. Design

### 2.1 Cannon cadence becomes data, and slower
- Add `cadence` (seconds between volleys) and `burst` to `STR-Cannon` and `STR-Flak` in `src/data/tables.js`,
  next to the existing Rockets/Missile values (balance is data).
- `STRUCT_RECIPES` imports these values instead of copying them, and the Pixi fallback reads the same field,
  so the two views can't drift apart.
- **Proposed cannon:** 1.5 s cadence, burst 2 (now 0.55 s, burst 3), about a third as many rounds. Damage is
  unchanged because the sim is continuous.
- **Owner approved 1.5 s (2026-10-18).** It can still be tuned on device with one data edit.
- **Delivered in PR #64 for the cannon only.** Flak keeps its AA-missile recipe, so it gets no data fields yet.

### 2.2 The barrel rig (shared by every gun)
Introduce one convention: an optional **`barrel` group with a trunnion pivot** under the turning group.
- **System towers:**
  - `mergeSystemModel` and the instanced-mesh setup gain a fourth group.
  - `writeMoving` composes `W · T(P − pw) · Rz(pitch)` for the barrel.
  - `muzzlePoint` tilts `p`, `d` and `back` about the trunnion before yawing, so the flash, smoke and
    shell leave the real tip.
  - The on-target check compares pitch as well as yaw.
- **Units:**
  - The tank, buggy and Tiger split their gun parts out of `turret` into `barrel`, with a trunnion pivot.
  - `models3d.js` composes the pitch after the turret yaw.
  - Units gain `muzzles` like the towers, so their shots start at the tip instead of the cell centre.
  - Beetle and jet have no gun and stay as they are.
- **Base super-cannon:** the `wCannon` barrels tilt about their mount. `muzzleWorld()` follows automatically.
- **Motion:**
  - Pitch slews at a model-set rate (deg/s), and stays between a minimum (depression) and maximum
    (elevation) per model.
  - It eases back to a rest pitch when idle.
  - It is render-only and frame-time driven, never in the tick path.

### 2.3 Pitch from the trajectory
A new pure module, `src/render3d/fx/elevation.js`:
- `pitchFor(kind, from, to, apex)` returns the launch angle.
  - **Straight shots** (tank guns, flak, tracers): `atan2(dy, horizDist)`. That is a small angle, which tilts
    down on high ground and up at aircraft.
  - **Lobbed shots** (cannon, rockets, base super-cannon): the slope of the flight parabola at launch,
    `atan((4·apex + dy) / horizDist)`. Far targets get a high lob and near targets a flat one.
- **The cannon tower switches to a lobbed shell,** with a modest apex scaling with distance and below the base
  cannon's. That gives the barrel a visible reason to rise as targets get further away.
- Rockets and missiles: the rack or pods tilt to the launch angle instead of the fixed 28°/18°. Missiles
  then home in as today.
- One function serves the shot's flight path and the barrel angle, so they can't disagree, and it's unit-tested.

### 2.4 Build-site dirt puffs
A new `src/render3d/fx/buildFx.js`, the same shape as `repairFx.js`:
- **While building:** a structure with `lifecycle === 'Building'` puffs dusty smoke (`impacts.emit(... dusty=1,
  drag)`) at random points around its footprint edge, low and drifting outward. The rate eases off as
  `progress` approaches 1.
- **On `build/start`:** a small `impacts.ring` plus a burst of puffs, as the ground is broken.
- **On `build/complete`:** a settling burst of puffs.
- **Quality:** the count scales with the quality tier (Low = about a quarter).
- The same hook is the home for upgrade dust later (the `upgrade` phases already exist in the sim).

### 2.5 Cannon recoil (owner-approved 2026-10-18: cannons only)
- **Which barrels recoil:** cannon-type barrels only, meaning the cannon tower, the tank and Tiger/King Tiger
  main guns, and the base super-cannon.
- **Which don't:** guns (flak, machine guns, the buggy's energy gun), missiles and rockets.
- **Motion:** on each shot the barrel slides back along its tilted axis, about 18% of its length in roughly
  0.06 s, then eases forward over roughly 0.35 s. On twin barrels only the barrel that fired moves.
- **How:** an offset along the barrel's local axis applied after the pitch in the barrel matrix. The firing
  point is taken before the recoil, so the flash stays at the tip.
- A per-model `recoil` field (length fraction; 0 = none) keeps it data-driven. Only the cannon-type models set it.

### 2.6 Cannon gunsmoke (CP-9 — delivered in PR #64)
- `src/render3d/fx/muzzleSmoke.js` replaces the inline forward puff in `fxOpts.fire`.
- Each puff is born no wider than the barrel tip (0.05 vs the tip's ~0.12) and leaves along the barrel at
  1.2–2.2 with drag 3.2, so it stalls about half a cell out. It then grows to about 8× as it fades over ~2 s.
- Five puffs per shell instead of nine. All values are named constants for tuning.

### 2.7 Mobile tower placement: offset slot, build on release (CP-10)
**Today** (verified): on touch, placing a tower is a tap that builds on release. `eventToCell` aims a fixed
1.4 cells straight up-screen (`TOUCH_LIFT`, `src/render3d/index.js:589-597`). A one-finger drag always pans
the camera (`index.js:102-139`), so the ghost can't be steered with the finger. Taps are classified in
`src/input/input.js:344-362`.

**New behaviour, touch only (mouse unchanged):**
- **Touch down with a tower armed:** the placement ghost appears **up and to the left of the finger**, a fixed
  screen offset of about 56 px left and 72 px up (CSS px), so the fingertip never covers it. The offset is in
  screen space, so it stays the same at every zoom level. It replaces the straight-up `TOUCH_LIFT`.
- **Drag:** the ghost follows the finger at that offset, like a virtual joystick. While a tower is armed, a
  one-finger drag **moves the ghost and does not pan the camera**. Two fingers still pinch, zoom and pan.
- **Release:** builds on the ghost's cell if it is valid (green), and the tool stays armed for the next tower,
  as today. Releasing on an invalid (red) cell builds nothing.
- **Cancel:** slide back onto the build palette and release, put a second finger down, or tap the palette
  button again. Escape and right-click still cancel on desktop.
- **Screen edges:** near the top or left edge, the slot point is clamped inside the view so it stays
  reachable. Panning the camera when the slot reaches the edge is a possible follow-up, not in this story.

**How:**
- `eventToCell` picks at `(clientX − ox, clientY − oy)` through `screenToGroundCell` instead of shifting the
  ground hit by a lift.
- `input.js` gains a touch "placing" press: armed + touch → no tap slop, and the place command is sent on
  pointerup at the current ghost cell.
- The camera's pan listener skips a pointer that input has claimed for placing. Input sets a flag on the
  pointerId, and the camera checks it before panning.

**Tests** (`src/render3d/picking.test.mjs`):
- Update the touch-lift test to up-and-left.
- New tests:
  - An armed touch drag does not pan, and release places at the offset cell.
  - Release on an invalid cell places nothing.
  - A second finger cancels.
  - Release over the palette cancels.
  - Mouse click still places under the cursor.

### 2.8 Planes fly attack runs; drones and copters hover (CP-11)
**Today** (verified):
- **Air units:** each faction has Copters, Planes and Missiles (a drone), plus `AIR-HeavyBomber`.
- **Classification:** only `artClass` tells them apart (`copter`, `plane`, `missile`, `heavyBomber`;
  `src/data/tables.js`). In 3D all four use the same `jet` model at different scales (`units/modelKeys.js:18-25`).
- **Stopping:** in the sim, a flyer that reaches weapon range switches to `'attacking'`, stops moving and
  deals continuous `dps × dt` (`src/sim/core.js:603-611`; structure hunters `:585-587`).
- **Render:** the 3D view draws the unit at its sim position (`unitViews.js:58`), so a plane parks in mid-air.

**Two ways to do it. Owner picked A, the render-only flight path (2026-10-18):**

| | A. Render-only flight path (**chosen**) | B. Sim attack runs |
|---|---|---|
| What moves | the drawn plane flies a pass-and-turn loop around its sim position | the sim unit itself flies the loop |
| Damage / balance | unchanged (still continuous) | changes plane DPS and how long planes sit inside tower range; `balanceSim` needs re-baselining |
| Replays | unaffected | the state hash changes; saved replay logs are invalidated |
| Effort | 3–5 pts | 8+ pts plus a balance pass |

**Plan A, in detail:**
- **Flight path:** a new pure module, `src/render3d/units/flightPath.js`, gives each attacking plane a
  deterministic loop (phase seeded from unit id; time from the render clock):
  - an inbound strafing run toward the target;
  - an overfly past it;
  - a climbing banked turn;
  - then back around for the next run.
  - Radius and speed scale with the unit's speed and range.
- **Fly-in:** planes still fly in along their sim path. The loop starts when the sim says `'attacking'`, and
  blends in from the current position so there is no jump.
- **Heading and bank:** come from the loop's tangent (bank into the turn), not from `heading.js`.
- **Firing:** the plane's shots are drawn only during the inbound run, so it reads as attack runs. The damage
  model doesn't change.
- **Everything follows the drawn plane:** the same offset (keyed by unit id) feeds AA missile homing
  (`combatFxModel.js aimPoint`), the shot origin, tower turret aim, health bars, wrecks and dust. AA fire
  chases the plane you see.
- **Which units:** a data flag in `tables.js` decides who flies runs, `attackPattern: 'strafe'` on Planes and
  `AIR-HeavyBomber`. Copters and Missiles (drones) have no flag and keep hovering at their attack position.
  Balance is data; nothing checks `artClass` in code.
- **Tests:**
  - A plane view is never stationary while attacking.
  - The loop is continuous (no jumps) and stays within a radius.
  - Copter and drone views stay put.
  - AA homing aims at the drawn position.
  - Shots are drawn only on the inbound run.
- **Follow-up (not in this story):** copters and drones still use the jet model. Giving them their own
  rotor/drone models would make the hover read better.

### 2.9 Fog margin and hidden contacts (CP-12)
**Today** (verified):
- **The play area is the fog window.** `fogWindow` (`src/render3d/overlays/fogModel.js:24-50`) takes it from the
  map's per-wave windows: forge maps' `waveWindows` (defaults in `content/maps/wave-windows.js`, wave 1 is 24×16
  of a 64×32 world) or campaign `rings`. Maps without windows have no fog.
- **The fog** (`overlays/fog.js`) darkens everything outside the window by a flat 0.34–0.38 and draws a cyan
  outline.
- **Nothing is hidden.** Terrain, decor and units are drawn to the full map edge (`ground/lowpoly.js:102-104`,
  `obstructions/placement.js`). Units outside the window show their real models, health bars and dust.
- **The minimap** (`render/hud.js:692-709`) colours flyers white and everything else red, which gives the type
  away.
- **The camera** can pan 2 cells past the map (`camera.js:22, 47-52`).

**New behaviour** (only where the fog is active; maps without windows are unchanged):
- **Vignette margin.** The fog shader changes from a flat tint to a vignette over the 5 cells outside the window:
  - Clear at the window edge, darkening smoothly to near-black at 5 cells out (a smoothstep on distance to
    the window rect).
  - Everything beyond that band is fully dark, so the map visibly ends 5 cells past the play area.
  - No hard line: the cyan outline goes. The reveal flash when the window grows stays, so a new wave still
    reads.
  - The darkness curve and the 5-cell width are named constants.
- **Hidden contacts.** `buildUnitViews` (`units/unitViews.js:45-64`) tests each enemy unit against the window.
  Outside it, the unit is drawn as a **red reticle** instead of its model:
  - Same size and colour for every type. Flyers get the same ground reticle as walkers, so type, size and
    altitude are all hidden.
  - The reticle reuses the pulsing red decal shader from the base cannon's target marker (`fx/cannonFx.js`).
  - Health bars, dust trails and the unit's own muzzle effects are suppressed for hidden contacts.
  - When a contact crosses into the window, the reticle fades out and the model fades in over about 0.25 s.
  - Player units are never hidden.
- **Minimap:** attackers outside the window are drawn as plain red dots (no white for flyers).
- **Render-only:** the sim, targeting and damage are unchanged.

**Tests:**
- `fog.test.mjs`: darkness rises monotonically from 0 at the window edge to near-black at 5 cells, and is
  fully dark beyond.
- New `contacts.test.mjs`:
  - A unit outside the window gets a reticle and no model, health bar or dust.
  - Flyer and walker reticles are identical.
  - A unit inside is drawn normally.
  - Crossing the window cross-fades.
  - Maps without fog hide nothing.
- Minimap colour test for hidden attackers.

### 2.10 Fix the aiming gap
Towers aim at structure and base targets as well as units. This is a prerequisite for correct pitch, so the
barrel doesn't aim at nothing.

## 3. Work breakdown (MetaMax stories, in order)

1. **Cannon cadence as data, slower:** `tables.js` cadence/burst for the Cannon; recipes import them; Pixi
   reads the same. Delivered (PR #64).
2. **Elevation solver:** `elevation.js` plus the cannon's lobbed shell; flight path and pitch share one
   function; tests.
3. **Barrel rig on system towers:** barrel group + trunnion in merge, instancing and `writeMoving`; tilted
   muzzle points; on-target pitch check; cannon, flak, rockets, missile. Depends on 2.
4. **Tower aims at structures and base:** the targeting gap. Small, can land with 3.
5. **Barrel rig on units:** tank, buggy, Tiger/King Tiger barrel groups, pitch and muzzle points.
   Depends on 2.
6. **Base super-cannon pitch:** the craft cannon tilts to the `cannonFx` launch angle. Depends on 2.
7. **Build-site dirt puffs:** `buildFx.js`. Independent, can go first.
8. **Cannon recoil:** cannon tower, tank/Tiger main guns and base super-cannon only. Depends on 3, 5, 6.
9. **Cannon gunsmoke:** tip-sized, pushed out, expands and clears. Delivered (PR #64) with 1.
10. **Mobile tower placement:** offset slot up-left of the finger, drag steers it, release builds. Independent.
11. **Plane attack runs:** pass-and-turn loops for planes; drones and copters hover. Plan A (owner's choice).
12. **Fog margin and hidden contacts:** vignette over 5 cells past the play area; outside units as red
    reticles; minimap all-red outside. Independent.

## 4. Tests
- `firingPoints.test.mjs` asserts the cannon tip at a fixed 8° and **will change**. It becomes "the tip follows
  the pitch": a far target gives a higher tip than a near one, and depression on high ground.
- New: `elevation.test.mjs` (straight vs lobbed, monotonic with range, clamped), `buildFx.test.mjs` (puffs only
  while Building, burst on start/complete, none when Complete, tier scaling).
- Extend `units3d.test.mjs` (barrel group + pivot per gun unit), `system3d.test.mjs` (four groups),
  `combatFx.test.mjs` (cannon cadence read from tables; lobbed shell arrives on target).
- Recoil: a cannon barrel is displaced back after a shot and returns to rest; flak, rocket, missile and buggy
  barrels never move; the firing point is unaffected.
- Keep `renderTiers.test.mjs` and `pack.test.mjs` green. The full suite runs locally before every push (no
  GitHub CI).

## 5. Out of scope / follow-ups
- **Recoil on guns, missiles and rockets:** excluded by the owner (2026-10-18). The voxel-era "BBB Barrel
  polish" epic's recoil story is for the old sprite pipeline; CP-8 is its 3D replacement.
- **Sim-side fire rate or projectiles:** not proposed. Damage stays continuous.
- **Audio:** not part of this plan.
