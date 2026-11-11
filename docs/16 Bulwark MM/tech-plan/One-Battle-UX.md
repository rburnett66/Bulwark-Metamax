# One Battle UX — Outpost and Farm on the battle's own code

Epic [MM-epic_mwc8zv0b_2c] · tech plan story [MM-story_mwc8zv5u_2d] · status: APPROVED by the owner 2026-11-11 · S1 shipped in PR #267 (v2026.11.11-a)
Intent: this plan is the project's direction, held in MetaMax (`TECH_PLAN::One-Battle-UX.md`) and mirrored here and on the local drive.
The repo's code is canon; where the plan and the code disagree, MetaMax raises it and the owner resolves it (HITM).

## 1. The rule

Owner, 2026-11-11:

> Users are trained to work with camera, characters, and structure in one pattern and we don't want two patterns
> or two sets of code that is in conflict. We should never have to change UX in two places to update one common
> UX function.

So: **one interaction pattern, one implementation.** When the player is looking at a battle, an outpost or a farm,
the camera, selection, structure placement, construction, upgrade, repair, sell, harvest, fog and the HUD/build
rail come from the **same modules**. A mode adds *rules and content* to those modules (config, hooks, data);
it never ships its own copy of them. "Like the tower-defense game" means *the same code*, not a restyle.

## 2. Where we are (audit of origin/main 5bce1f7)

Outpost reuses the battle's 3D renderer (ground, decor, fields, tower models), runs its raids on the battle sim
(`outpost/raid.js` → `sim/core`, `combat`, `waves`, `pathfinding`), and borrows the palette CSS/icons
(`render/buildPalette.js`), the build/repair FX and the harvester art.

Everything below was re-implemented alongside the battle version:

| System | Battle (keep) | Outpost copy (retire) |
|---|---|---|
| Pointer / tap / select / place | `input/input.js` (`createInput(canvas, renderer, getState, submit, ui)`) | placement state machine in `outpost/view/buildMenu.js`; pointer handling in `outpost/view/outpostView.js` |
| HUD, build rail, selection panel | `render/hud.js` (`createHud(mount, callbacks)`) | `outpost/view/hud.js` (59 KB), `hudModel.js`, `menuIcons.js` |
| Placement rules | sim structure placement on battle cells | fixed pads (`terrain/outpostPads.js`) + `model.place` |
| Construct / upgrade / repair / sell | sim commands `place`, `upgrade`, `repair`, `sell` (`sim/core.js` applyCommand) | `outpost/model.js` `place`, `upgrade`, `upgradeDefense`, `repair`, `sellStructure` + own times/costs |
| Harvest | `sim/harvest.js` (real trucks, cargo, unload) | closed-form `harvestPlan`; trucks animation-only (`outpost/view/harvestDrive.js`) |
| Fog of war | battle fog (`render3d/overlays/fog*.js`) | none |
| Camera / layout | battle camera + `hudInsets` in `main.js` | `outpost/view/layout.js` |

Farm (`src/farm/**`) is layered on the outpost model and view (`farm/view/farmLayer.js` → `outpostScene.js`), so it
inherits every row.

Consequence already seen: the iPhone "BUILD rail vanishes after SELL" bug (#265) lived only in the outpost copy, and
the follow-up "exact same placement as map defense" was another patch to the copy.

## 3. Why it happened

The battle session is not a module. `main.js` `boot()` is one ~90 KB closure that creates the renderer, input,
HUD, camera, fog, frame loop, wave flow, dialogs and results all together. There was nothing the outpost *could*
mount, so each outpost story rebuilt the piece it needed. The building blocks underneath are already generic —
`createInput` takes any sim state and a `submit` function; `createHud` takes callbacks; `raid.js` already turns an
outpost into a battle `SimState`. What is missing is the session that ties them together.

## 4. Target

```
src/battle/session.js            ← the battle session, moved out of main.js boot() (S1, PR #267)
  createBattleSession(mountEl, { getSim, getUi, submit, mapId, mountOptions })
    → { createHud, mount3D, setBoard, bindInput, start(hooks), suspend3D, resume3D, view3d, ... }
  owns: 3D renderer, camera + insets, input, HUD + build rail + selection panel, fog, frame loop, FX
  mode = { catalogue, placementRules, hudSections, waveFlow, onCommand, ... }   ← per-mode config, data only

main.js (campaign)   → createBattleSession + start(campaign hooks)     — waves, dialogs, results stay in main.js
outpost/view/*       → createBattleSession + start(outpost hooks)  (S2)      — away report, SELL, contracts, raid timer
farm/view/*          → plugs a farm layer + farm catalogue into the OUTPOST session
```

While the player is **at** the outpost, the outpost **is a live battle SimState** (built the way `raid.js` builds
one): its buildings and defenses are sim structures, its harvesters are sim harvesters, gold is sim economy.
Every tap goes through the battle's `input.js` → `submit` → `applyCommand`. Raids are the sim's waves.

What stays outpost-only (no battle equivalent, so not a duplicate):
- **Away time** — the closed-form accrual in `outpost/model.js advance()`, raid schedule, away report. Its rates
  must come from the same table the sim uses, with a test that a sim run and the closed form agree (§6 S4).
- **Resource SELL, contracts, the far buyer** — outpost economy, surfaced as a HUD section / command.
- **Placement constraints** — e.g. a rig must stand on a deposit, power reach. These become `placementRules`
  the shared sim placement check consults, exactly as the battle already refuses water/obstruction cells.
- **Save/load** — on leave, the SimState is written back to `save.outposts[planet]`; on enter it is rebuilt.

## 5. Placement: a proximity system replaces fixed pads (owner decision 2026-11-11)

Owner: "I like the fixed pads because they made energy grid elegant and provided space for vehicles and characters
to walk. In general I think fixed pad is bad because it takes the ability for users to design their own base. Let's
replace fixed grid with a proximity system and figure out how to space structures by build spacing into each
placement and redesign the energy griding system."

So pads go, and the two things pads gave us — **walk space** and an **elegant grid** — become rules of the one
placement system, the battle's `validatePlacement` / `placeStructure` (`sim/structures.js`). Same mechanism in every
mode; only the per-structure numbers differ.

### 5.1 Build spacing — one cell

Owner 2026-11-11: spacing "needs to be the size of the harvester"; then "if it is easier to separate buildings by 1
cell that is fine. I want the simplest implementation." The harvester (`SYS-Harvester`, `radius: 0.42`) is 0.84 cells
wide, so a one-cell lane fits it.

- Each structure def gets **`spacing`** (whole cells, data in the structure table): **1** for outpost buildings
  (hub, power, pylon, rig, storage, bays, habitat, farm buildings), **0** for Wall, MG, Cannon and every battle tower.
- Rule in the battle's `validatePlacement`: a new footprint must leave **`max(spacingA, spacingB)` free cells** to every
  existing footprint (Chebyshev distance, so diagonals count). Two outpost buildings → a 1-cell lane; a building and a
  tower → 1 cell; two towers → 0, they may touch as today. New refusal reason **`'spacing'`**, shown on the ghost like
  `'occupied'`.
- Lanes are ordinary open cells, so harvesters, the repair drone, farmhands and raiders path through them — the walk
  space pads used to give. A test pins that a harvester drives the lane between two outpost buildings.
- Models are unchanged (no inset). Battle values are 0, so **the battle plays exactly as tuned** (replay hashes and
  `balanceSim` unchanged).
- The battle's existing seal-off check still refuses a placement that cuts the hub off from a building or a raid lane
  from the base.

### 5.2 Energy grid by proximity

Today's rules (`outpost/model.js powerGrids`) are already distance-based: stations within reach of each other pool
supply; a consumer joins the nearest station whose reach covers it; a short grid serves consumers in priority order.
Pads only fixed the *positions* and the *conduit routes*. The redesign:

- **Nodes.** Power Stations (supply + reach) and a new cheap **Pylon** (no supply, reach only) — the pylon is what
  gives the player freedom to lay the grid out across their own base. Owner 2026-11-11: "keep it very simple" —
  the Pylon is **1 × 1, one tier, no upgrade, no power draw, no special panel** (the battle selection panel's
  sell/repair only); cost, reach and HP are three workbook rows.
- **Links.** Two nodes link when within the larger of their reaches; linked nodes form one grid and pool supply.
  A consumer connects to the nearest node of any grid whose reach covers its footprint centre.
- **Priority** when short: unchanged (`PRIORITY` table moves to data).
- **Conduits are derived, never authored**: drawn as the minimum spanning tree of each grid's nodes plus one
  branch from each consumer to its node, routed along the open lanes so they read as tidy runs between
  buildings — the elegance pads gave, now from whatever base the player designs. Conduit art and pulse stay
  (`outpost/view/conduits.js` becomes a pure "plan conduits from structures" function).
- **Reach display = the battle's weapon-radius system** (owner 2026-11-11: "pylon can behave just like the weapon
  radius system where you select one and see the collective radius of all pylons"). `render3d/overlays/coverage.js`
  `planCoverage` already does this for towers — select one and every live tower of the same kind shows its ring, a
  faint fill so overlaps stack brighter; the same coverage map shows while placing, plus the ghost's own ring. Grid
  nodes join it as a third coverage class, **`power`** (cyan, beside `antiGround` amber and `antiAir` blue), radius =
  `reach`: select a Pylon or Power Station → the collective reach of every grid node; arm one for placement → the
  same map plus the ghost's reach at the hover cell. No grid-specific ring code.
- **Placement feedback (same ghost as battle):** the ghost is **cyan** when placeable and powered, **amber** when
  placeable but it would be unpowered ("no power in reach" / "grid short"), **red** when refused. Arming any
  power-drawing building also shows the `power` coverage map, so the player sees where power reaches before paying.
  A dashed preview conduit shows which node it would join.
- **Battle:** battle structures draw no power, so the grid is simply absent there; the mechanism lives in the shared
  placement/sim code and is switched on by the mode's structure catalogue, not by a separate system.

### 5.3 Other outpost constraints as placement rules

- **Rig** must cover a deposit (refusal `'needs a deposit'`); the deposit marker is visible while a rig is armed.
- **Hub** is placed by the contract kit at the map's authored hub spot (the one fixed point; it anchors raids) —
  owner confirmed 2026-11-11.
- Mesa / ramps / cliff rules are the battle's terrain checks (obstruction grid), unchanged.

### 5.4 Migration

Existing saves: each pad building becomes a structure at its pad's centre; if that breaks spacing, it is nudged
to the nearest legal cell (deterministic). Maps: `pads[]` and `conduits[]` are removed from outpost maps (hub spot
and deposits stay); the Terrain Forge stops authoring pads.

## 6. Stories (in order; each deletes the copy it replaces)

Board ids: S1 story_mwc9p7al_2e · S2a story_mwc9p8ee_2f · S2 story_mwc9pkcd_2g · S2b story_mwc9plas_2h · S2c story_mwc9pmbn_2i · S3 story_mwc9pynw_2k · S4 story_mwc9pzyd_2l · S5 story_mwc9q0yy_2m · S6 story_mwc9q1y6_2n · S7 story_mwc9pneu_2j

| id | story | done when | pts |
|---|---|---|---|
| S0 | This plan | owner approves; mirrored to MetaMax | 2 |
| S1 | Extract the battle session | `src/battle/session.js` mounts renderer + camera + input + HUD + fog + loop; `main.js` campaign uses it with **no behaviour change**: replay hashes unchanged, full suite green, owner plays a campaign map on iPhone + desktop | 13 |
| S2 | Outpost visit is a battle session | the outpost runs on `createBattleSession` with a live SimState; selection, camera, build rail and placement are the battle's; `outpost/view/hud.js`, `buildMenu.js`, `layout.js` and the outpost pointer code are **deleted**; outpost buildings are sim structure defs in data | 13 |
| S2a | Build spacing in the shared placement | `spacing` (1 outpost / 0 battle) in the structure data; `validatePlacement` refuses `'spacing'` within `max(a, b)` cells; lanes stay walkable; battle values 0 → replay hashes + balanceSim unchanged; tests for spacing, walkability and seal-off | 3 |
| S2b | Proximity energy grid | Pylon structure; grid from node links (no pads); consumers join by reach; priority from data; conduits derived (MST + branches); reach shown through the battle coverage map (planCoverage, new `power` class: select one → all nodes' collective reach); ghost cyan/amber/red with preview conduit; tests port `powerGrids` cases to free positions | 8 |
| S2c | Pad removal + save migration | outpost maps lose `pads`/`conduits` (hub spot + deposits stay); Forge stops authoring pads; saves migrate pad buildings to legal cells deterministically; rig-on-deposit rule | 5 |
| S3 | Build / upgrade / repair / sell through sim commands | outpost uses `place` / `upgrade` / `repair` / `sell`; the matching `outpost/model.js` functions are deleted; outpost times/costs are rows in the structure data | 8 |
| S4 | Harvest is the battle harvester | visit runs `sim/harvest.js`; `harvestDrive.js` deleted; away accrual reads the same rates; test: sim run vs closed form agree within tolerance | 8 |
| S5 | Fog on the outpost | battle fog renders at the outpost | 3 |
| S6 | Farm on the session | farm layer and farm catalogue plug into the outpost session; no farm pointer/HUD code of its own | 8 |
| S7 | Guard test | test fails if `src/outpost/**` or `src/farm/**` adds pointer listeners, a build rail, a HUD root, or placement/construct/repair logic, or stops importing `battle/session.js` | 2 |

**Freeze:** no new Outpost/Farm features until S2 lands (bug fixes allowed). Open farm branches
(`feat/farm-*` worktrees) are re-based onto S2/S6 rather than merged as-is.

## 7. Risks

- **S1 touches the campaign** — the most tuned code in the game. Mitigation: pure extraction, no rule changes,
  replay-hash and full-suite gate, owner playtest before merge. One PR, nothing else in it.
- **Replay determinism** — the outpost SimState must use the seeded rng only; away time stays outside the sim.
- **Save migration** — pad buildings → structures; tested on the reference outpost and a real save.
- **Scope** — S1–S6 is ~71 points across ~9 PRs. The old outpost model/view code (~500 KB with tests) shrinks
  substantially; tests that only exercised deleted copies are deleted with them.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/tech-plan/Outpost.md | the outpost model, view, maps and raids this plan re-bases |
| depends-on | docs/tech-plan/Farming.md | the farm layer that moves onto the shared session |
| related | docs/16 Bulwark MM/design/Outpost-Design.md | outpost rules that become config/hooks on the shared systems |
