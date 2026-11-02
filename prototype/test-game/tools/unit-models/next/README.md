# Unit models — next (prototype, not yet in the game)

Three-part part-list models — **base** (hull/plinth), **weapon** (turret, yaws to aim), **head** (radar/optic,
sweeps or spins) — plus the detail passes from 2026-10-15/16:

| Model | Roster id | Notes |
|---|---|---|
| tank, buggy (SR-07), beetle, jet | GND-Tanks, GND-Trucks, GRN-Tanks, GND-Planes | buggy has the 10-16 detail pass |
| tiger | GND-HeavyTanks | King Tiger from the repo's tiger ortho set |
| sys_cannon | SYS-Cannon | v2 contemporary: plinth / turret+barrel (fixed 8° EL) / sweeping optic |
| sys_flak, sys_wall | SYS-Flak, SYS-Wall | |
| sys_harvester | SYS-Harvester | widened body; empty hopper — `def.cargo` = where the game draws the gems |
| sys_mg, sys_rockets | *(none yet — proposed SYS-MG, SYS-Rockets)* | |

`prims.js` / `models.js` are classic scripts (globals `Prims`, `UNIT_MODELS`). Group names are base/weapon/head;
`body`→base and `turret`→weapon are accepted aliases.

**Not the runtime source.** The game draws from `src/render3d/units/{prims,models}.js` (ES modules) until the HEAD
story ports these and teaches `models3d.js` the head group. [MM-story_mva2f3vg_9]

Build the review page: `python tools/unit-models/next/build.py` → `tools/unit-models/dist/unit-models-next.html`.
The terrain prototype (`terrain3d-proto/build3d.mjs`) inlines these files too.
