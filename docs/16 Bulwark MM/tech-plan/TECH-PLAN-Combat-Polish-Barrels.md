# Tech Plan — 3D Combat Polish: cannon cadence, elevating barrels, build-site dust

Status: draft for owner review · 2026-10-18 · Bulwark MM (project 16)
Owner asks (2026-10-18): (1) the cannon tower should fire more slowly; (2) rebuild every tower, tank and
base defence so the barrel tilts up and down to match the shot's trajectory; (3) dirt puffs around the
base of a structure while it is being built.

All three are **render-side** changes to the 3D view. The sim stays as it is, with no gameplay or balance
change, and the replay contract holds (no `Date.now()` / `Math.random()` in the tick path; the FX use their
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

### 2.6 Fix the aiming gap
Towers aim at structure and base targets as well as units. This is a prerequisite for correct pitch, so the
barrel doesn't aim at nothing.

## 3. Work breakdown (MetaMax stories, in order)

1. **Cannon cadence as data, slower:** `tables.js` cadence/burst for Cannon and Flak; recipes import them;
   Pixi reads the same.
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
