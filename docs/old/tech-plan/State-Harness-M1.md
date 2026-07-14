# TECH PLAN — State Harness M1 (one-walker full pipeline)

Design source: `sources/State-Harness-GDD.md`. Epic `sh-m1`. Strategy: **deterministic surface first**, so every
later DoD is a runnable scenario (the reach-to-surface gate), then render/UX on top, then drop→play.

## Build order (stories)
1. **s1 — Deterministic readouts + scenario harness** ✅ *(this PR)* — `harness/readout.js` derives the observable
   state (base←health, weapon←aim, head←awareness) from the sim; `harness/scenario.js` drives the real sim and
   captures a per-tick readout trace + assertion helpers; `harness/scenario.test.mjs` is the DoD as a headless,
   deterministic, exit-coded assertion. **This is the surface every other story asserts against.**
2. **s2 — Portable unit definition + registry loading + drop flow** — unit def = `UNITS` stats + part-stack refs
   (base/weapon/head sprite + sizing/pivots); engine loads defs from a **data registry** (not only hardcoded
   `UNITS`) so a dropped unit is spawnable without a code change.
3. **s3 — Pixi layered part-stack render** — base/weapon/head as Pixi layers, z-order + pivots, driven by the s1
   readout. Same Pixi pipeline as the game → pixel-accurate.
4. **s4 — Camera + silhouette shadow** — one `project(mapPos)→screen(scale,skew)` module (origin 0,0 bottom-mid) +
   `shadowFrom(base,weapon,aim,light)`; shared with the game render.
5. **s5 — Harness UX** — adopt the existing State-Harness menu shell; preview stage = the Pixi render; compose /
   state / camera controls.
6. **s6 — 7 states + drop→play** — drive idle/movement/acquire/attack/take-damage/heal/death; author→drop→play in
   the live engine.
7. **s7 — MetaMax DoD gate hook** — the develop gate RUNS a project-declared verification scenario (e.g.
   `node harness/scenario.test.mjs`) and refuses "done" on failure. Scoped e61 — makes MetaMax follow through on
   the DoD instead of a boot-check. This is the handoff line: after s7, MetaMax coordinates the roster (M2/M3).

## Verification
Each story ships a `harness/*.test.mjs` scenario (deterministic, exit-coded). s1 verified: unit acquires,
aims, health drops — `SCENARIO PASS`. Render/UX stories add a Pixi boot + a visual confirm; logic stays
scenario-gated.

## Two scales / droppable (from the GDD)
Everything here is built once for both bench + field, and produces engine-usable unit definitions — s2's registry
loading is the pivot that makes a Harness unit a game unit.
