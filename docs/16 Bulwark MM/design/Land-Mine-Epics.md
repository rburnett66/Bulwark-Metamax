# Land Mine (Mine Drone) — Epics & Stories

Tracks the build of `Land-Mine-Design.md` (rev 1). Check items as they land.
Convention: `[ ]` todo · `[~]` in progress · `[x]` done. Each epic ≈ one PR-sized chunk.

Dependency order: **M0 → M1 → {M2, M3} → M4**. M0 is the measurement gate: no sim code before
the gauntlet says the numbers are worth shipping.

---

## Epic M0 — Gauntlet prototype & measurement  *(Shooting Gallery, zero sim changes)*
- [~] M0.1 `src/gallery/lane.js` — headless GAUNTLET runner on the real sim (`createSim`/`stepSim`,
  no waves): one attacker paths spawn→base past a chosen defense; measures dps dealt/received,
  target-acquisition time, survivability (reached-base %, hp remaining, distance on death).
- [~] M0.2 `MINE_SPEC` reference constants in `lane.js` (45 Kinetic burst, 0.45 trigger, 1.0 blast,
  ground-only) — the single prototype source the design doc points at.
- [~] M0.3 Gauntlet view in the gallery: lane board left→right, defense picker
  (Cannon T1-3 / Flak T1-3 / Mine / none), live run with the game's FX pipeline, metrics readout.
- [~] M0.4 Matrix sweep: one click runs every defense config for the selected attacker+tier →
  results table (outcome, hp left, acquisition, dps received, time).
- [ ] M0.5 Measurement pass with the owner: pick the mine's cost point, settle Kinetic-vs-Concussion
  (design Q2) and the trigger radius feel (Q3). Update `Land-Mine-Design.md` with the numbers.

## Epic M1 — Data & sim core  *(the mine becomes real)*  ✅ DONE (rev 2 — see build log)
- [x] M1.1 `tables.js`: `STR-Mine` row (`kind:'mine'`, damage referencing `STR-Cannon.dps[0]`,
  triggerRadius, blastRadius, cost from M0.5, cap 8). No literals in sim code.
- [x] M1.2 `src/sim/mines.js`: `state.mines` + `stepMines` — drone flight (`getFlyerPath`), bury on
  arrival, deterministic trigger scan (ascending id), blast via `applyDamage` to every ground
  attacker in radius, `mineDeploy`/`mineArmed`/`mineExplode` events, mine deleted on detonation.
- [x] M1.3 Command `{type:'placeMine', cell}`: validate (passable land, non-water, cap, gold),
  spend, spawn courier. Wired into `core.js` command dispatch + `stepMines` into the tick order.
- [x] M1.4 Node tests: determinism (two seeded runs identical), air immunity, blast hits a clump,
  cap enforced, replay log round-trips a mine game.

## Epic M2 — Deploy UX  *(subject→action consistent)*  ✅ DONE (rev 2 — see build log)
- [x] M2.1 Build palette slot + key `6`: mine ghost on hover (red dot + blast ring), red/green
  validity via the real `placeMine` validation.
- [x] M2.2 Place → command → HUD flash ('Mine drone launched'), palette stays active for laying a
  field of mines (same repeat-place convention as structures).
- [x] M2.3 HUD: armed-mine count / cap indicator; reject reasons flash (cap, gold, bad cell).

## Epic M3 — Render  *(drone, dot, boom)*  ✅ DONE (rev 2 — see build log)
- [x] M3.1 Drone in flight: Tier A primitive (small defender-tinted dart) at first; Stack Forge
  voxel pack later. Render-tier entry if it ships as a `UNITS` row.
- [x] M3.2 Armed mine: red dot on the resources layer (under units, over terrain) + subtle 1s pulse;
  visible to the player only (no enemy AI reaction — design Q4 v1).
- [x] M3.3 Explosion through the shipping FX pipeline: `spawnFireClump` + `spawnGlow` + small shake
  keyed off `mineExplode` in `spawnFx` — no bespoke FX path.
- [x] M3.4 Shooting Gallery gauntlet swaps its `MINE_SPEC` prototype for the real `STR-Mine` table
  row + `stepMines` (prototype retired; gallery keeps exercising shipping code only).

## Epic M4 — Balance & ship
- [ ] M4.1 balanceSim pass with mines in the fixture layout (does mine-assisted defense skew unit
  pricing?); gauntlet matrix re-run; retune `STR-Mine` cost in tables if needed.
- [ ] M4.2 Deploy gates green (`renderTiers.test.mjs`, `pack.test.mjs`) + full sim suite.
- [ ] M4.3 Content committed with the feature (any new pack/atlas for the drone), CLAUDE.md
  ship-contract respected. Mobile playtest on the Pages link → owner sign-off.

---

### Build log
- 2026-07-22 — design rev 1 + epics created. M0 started in the same session (gauntlet runner,
  prototype `MINE_SPEC`, lane view + matrix in the Shooting Gallery).
- 2026-07-22 (later) — **design rev 2** (owner): mine takes the MOAT build slot (hotkey 4), damage →
  one-shot-any-tank (1500 Kinetic burst), blast → 0.5. **M1+M2+M3 BUILT in one pass**: STR-Mine row
  (tables.js), `src/sim/mines.js` (state.mines — never structures: walkable/untargetable/no nav
  blocking; deploy→fly→arm→ground-contact detonation through the real applyDamage), cmdPlace routes
  kind 'mine' to deployMine, stepMines at 5c; validatePlacement mine branch (land-only, cap, no
  seal-off check); renderer: courier dart + red flashing dot + mineExplode via spawnFireClump/Glow;
  HUD mine icon; gallery MINE_SPEC reads the real row (M3.4 done). 11-test mines suite;
  52/52 across all suites. M0.5 (cost point) folds into M4.
