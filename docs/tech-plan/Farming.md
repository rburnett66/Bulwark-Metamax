# Tech Plan — Farming: the third game mode

Status: draft 2 · 2026-11-10: the owner's rules of 2026-11-09 applied (below; they override the rest of this plan) ·
draft 1 2026-11-09 · Epic *Farming mode design* [MM-epic_mwa8eww2_1] and the four build
epics in §5
· Designs: `docs/16 Bulwark MM/design/Farming-Design.md` (draft 3: the mode) and
`docs/16 Bulwark MM/design/Farming-Distribution-Design.md` (draft 1: which faction gives what). This plan does not
restate them; it says how to build them, in what order, and what has to be settled first.

Repo copy (canonical): `docs/tech-plan/Farming.md` in rburnett66/Bulwark-Metamax.

> **owner** (2026-11-09): "Here is the next feature to implement, Farming. Read epic epic_mwa8eww2_1 and the two farming
> design docs in MetaMax project 16." … "do a design review using Reality Graph and Design Graph to build a tech plan
> with epics and stories"

## Owner rules (2026-11-09) — these override anything else in this plan

1. **Helium-4 is a new material.** Helium-3 and Helium-4 are two completely different materials. Helium-4 gets its own
   name, icon, model key and catalogue entry. **Helium-3 is not renamed or migrated, and no save changes** (§2.3 F1,
   story A2).
2. **Grow rooms are a future feature.** B3, B4, B5, B6, B7 and B10, and B9 which depends on them, are out of current
   scope: on the board they sit under the epic *Farming (future): grow rooms* (§5).
3. **Farming tech lives in the OUTPOST & FARM tree** (PR #225: SEED PODS, MACHINERY, STRUCTURES, MINING, reached by the
   two buttons at the top of the tech tree screen). It replaces B2's FARMING division: new farming nodes go into SEED PODS
   or MACHINERY in `src/data/techtree.js` (`DIVISIONS` with `tree: 'outpost'`, `TREES.outpost`) (§2.3 F8).
4. **Storage full stops mining.** On an outpost, when storage is full the miner stops, and both the miner and the
   Storage Tower show the storage-full icon. **Whether the Silo follows the same rule is the owner's call: ask before
   building it** (§2.3 F11, story A3).

## 1. Scope

Farming is a new mode on the outpost maps: plots planted with seed pods that grow on real-time clocks, harvested by
the player's avatar, with a faction-by-faction ladder of contracts, and later (owner rule 2) indoor grow rooms with
machines that need maintenance. It is built in the designs' four phases (Farming-Design §13), each its own epic:

| Epic | Phase | What it ships |
|---|---|---|
| **F-A · The loop on Verdance** | A | the Rig Mk II gate and Verdance F1; Farmhouse, Silo, Traditional and Irrigated plots on the Verdance outpost map; growth stages, Fruited and Dead; seed pods in five levels and the pod bench; Rare pods from battles; the SEED PODS tab; the surface avatar and farmhands; the ember harvest; raids trample; Helium-4 as a new material (owner rule 1) |
| **F-B · Environment** | B | the atmosphere model; farming nodes and enhancements in the OUTPOST & FARM tree (owner rule 3); the Vertical farm and Tub. **Future** (owner rule 2): the grow-room view; machines, levels and maintenance; the Hydroponics and Underground rooms and their doorways; gro-bots; Legendary's tech rule and mystery crops |
| **F-C · Farming across the factions** | C | F1–F3 on all nine planets; faction pod stores and loyalty ranks; the Collective's farm orders and wanted crops; machine blueprints; the remaining six methods; the 36 crop models; gems from the deep seam; the farm layer on the other eight maps |
| **F-D · Processing** | D | the Refinery, the Fabricator at Farming Research Level 3, the first parts, the recipe book |

Phase 0 (the scale prototype and the first Blender models) belongs to the design epic and is in review
[MM-story_mwa3hi6n_1, MM-story_mwa5fhvz_2].

## 2. Design review

Run 2026-11-09 with MetaMax's Reality graph (`graph_overview`, `does_exist`, `read_ticket`'s reality bundle) and Design
graph (`design_impact_of`, `design_findings`, `list_documents`, `check_plan`), then checked against the source on
`origin/main` (2d0eca6), because **the Reality graph is pinned at 2eb7b26 (2026-11-06) and is behind the repo**.
Everything in §2.1 was confirmed in the source, not taken from the graph alone.

### 2.1 What exists: reuse, do not rebuild

| Need | Reuse | Where (checked on main) |
|---|---|---|
| The map, power, reach, raids, the closed-form clock | the outpost model: `advance()`, `powerGrids()`, `warnings()`, the raid schedule; a farm advances in the same pass | `src/outpost/model.js` |
| Rig Mk II (the gate) | the rig's tier: `o.pads[id].kind === 'rig' && tier >= 2`; the node `rig_mk2` is unlocked by outpost contract 2 | `src/outpost/model.js`, `src/data/outpost.js` |
| The outpost view, build list, panels, SELL, away report | the outpost HUD and view (left icon list, panel, toast, SELL, away report); FARM is a tab in it, not a new screen | `src/outpost/view/*.js` |
| Visible raiders during a visit | visit probes (v2026.11.09-q) run on the battle sim on the outpost map | `src/outpost/view/visitProbe.js` |
| Construction sparks, damage sparks, impacts | `constructionFx`, `impacts.emit` (shade 1 blue, 2 red); the embers are a new shade on the same emitter | `src/outpost/view/constructionFx.js`, `src/render3d/fx/impactsView.js` |
| The avatar and the farmhands | the crew rig: `createCrewKit`, `cfgFor(faction)`, `PLAYER_CFG` (the gold hard hat), `drivePose`, `walkSwing`, `GESTURES` | `src/ship-interior/crew.js` |
| Rooms, walk-to, primitive props | `createRoomView` and `primitiveRooms` presets (side cutaway, deck lanes); the grow room reuses the kit, not the lane navigation (§2.3 F6) | `src/ship-interior/roomView.js`, `primitiveRooms.js` |
| Inventory | `s.inventory[resourceId]`, `inventoryBands`, the INVENTORY screen and its tabs (`INV_TABS`) | `src/save/inventory.js`, `src/menu/inventoryScreen.js` |
| Contracts, loyalty, the contract card | `addLoyalty` and `s.loyalty`; outpost contract offer/accept; `showContractModal`; the Mission Log | `src/save/contracts.js`, `src/outpost/contract.js`, `src/comm/contractModal.js`, `src/menu/missionView.js` |
| Standings | `s.rapport`, `standingOf`, the Standings screen aboard a ship | `src/save/standings.js`, `src/menu/standingsScreen.js` |
| Tech tree | the OUTPOST & FARM tree (`TREES.outpost`: SEED PODS, MACHINERY, STRUCTURES, MINING; its ghost nodes `pod_bench`, `pod_bench2`, `pod_store`, `mc_irrigation`, `mc_engineering`, `mc_grobots`), `techStatus`, `buyTech`, `createGameTechAdapter`; contracts unlock, gold buys (rule D7) | `src/data/techtree.js`, `src/menu/techSave.js` |
| Resources (the 36 crops) | the catalogue in `content/missions/missions.json` (`id` is the name's slug: `loam-grain`), the icons and 3D resource models | `missions.json`, `src/data/resourceIcons.js`, `src/render3d/resources/models.js` |
| Battle harvest | `bankHarvest(s, result, catalog)` banks the tally after a battle; Rare pods come from the same tally (§2.3 F9) | `src/save/inventory.js` |
| Data pipeline | workbook sheets written by `tools/economy/write_*_sheets.py`, extracted by `tools/extract_mapdata.py` to `content/maps/mapdata.{js,json}` | `docs/sources/Bulwark-Map-Data.xlsx` |
| Models | headless Blender, the outpost material contract (`trim`, `glow_*`, `glass`), shared textures keyed by material (v2026.11.09-c) | `tools/blender/`, `src/render3d/outposts/outpostModels.js` |
| Error reports, iPhone safe mode | `src/diag/errorLog.js`; `outpostSafeMode()` (Low tier, `lodLevels:[2]`) | `src/outpost/view/outpostView.js` |

Phase 0 (the two designs, `tools/farming/scale.html`, the Blender scripts `tools/blender/farming/*.py`) is on main
(PR #224, story A0).

### 2.2 Design-graph findings

| # | Finding | Source | Action |
|---|---|---|---|
| G1 | **Both farming designs are store-only**: they exist in MetaMax and on `feat/farming-prototype`, not on main. The epic's `tech_plan_links` name paths that do not exist on main. | `design_findings: cites_missing`, `design_impact_of` | Story **A0**: land the designs (and the scale page) on main before Phase A code |
| G2 | `Farming-Distribution-Design.md` measures **UNMEASURABLE**: it names no repo paths | `list_documents` | Fine for a design. This plan carries the paths |
| G3 | Two of Farming-Design's dependencies are **stale**: `Capital-Ship-Interior.md` and `Landing-Craft-and-Resources-Design.md` | `read_ticket` read-first list | Read against source, not the documents, for the room kit (now half-size figures, v2026.11.09-o; faction rooms, v2026.11.09-p) and the resource models |
| G4 | No reserved-word or identifier collisions are reported for the farming docs. The design itself flags the one naming hazard: pod levels share names with resource tiers (D4) | `design_findings`, Farming-Design §8.2 | Keep the designs' rule: pod level is a coloured badge, tier is a ring; code uses `level` (1–5) and `tier` (`common`…) and never mixes them |
| G5 | 27 owner rulings are recorded from Farming-Design (D7, D12, D15–D17, D20, D25, D29, D34, D38–D43). 33 questions are still open (D1–D46, X1–X10) | `design_impact_of: decided_by` | §4 lists which ones block which epic |
| G6 | `check_plan`: **derivation_fresh** — Outpost-Design changed (2026-11-10, the rules today R1–R14 and the owner's answers on guns, harvesters, selling and miner storage) after both farming designs were written | `check_plan` on F-A | Re-read: the farming designs name no gun cap, harvester count or storage rule, so they still hold. Surface Collection rides the new harvester cap (§2.3 F10); whether the Silo copies the storage rule is the owner's call (F11, rule 4) |
| G7 | `check_plan`: **overlap_declared** — this plan and Collective-Faction both change `tools/extract_mapdata.py` | `check_plan` on F-A | Declared below (Dependencies). The farm sheets are new sheets read by a new block in the extractor; no Collective sheet changes. One branch per story, merged in order, the full suite run locally before each merge |
| G8 | `check_plan`: **closure_bounded** — the documents this plan reaches through the designs exceed the bound (12–14, cap 6) | `check_plan` on F-A | This plan depends only on the two designs and the outpost tech plan; the room kit, crew and tech-tree documents are `related`. The designs' own long chains are theirs to fold when they next change |

### 2.3 Engineering findings (reading the designs against the code)

| # | Finding | What it means for the build |
|---|---|---|
| F1 | **Helium-4 is a new material, not a rename** (owner rule 1). Helium-3 stays exactly as it is: its id `helium-3`, its icon, its model key, everything a save already holds. Helium-4 is added with its own name, id (`helium-4`), icon, model key and catalogue entry; it is Lumen's uncommon-tier crop (Distribution §2.2). | Story **A2**: add Helium-4 everywhere a material is defined; **no migration and no save version change**; a test that Helium-3 is unchanged and Helium-4 resolves on its own |
| F2 | **Two ledgers.** Faction loyalty is `s.loyalty` (contracts, tech tiers by threshold); character standing is `s.rapport`. Distribution §4.1's pod-store ranks (Known / Trusted 25 / Honoured 50 / Exalted 100) are new names on `s.loyalty`. | Read ranks from `s.loyalty` with thresholds in the workbook; do not add a third ledger. The rank names need the owner's yes (X6) |
| F3 | **One clock.** The outpost advances in closed form between events. A farm adds plot stage boundaries, Fruited windows, machine maintenance deadlines and bot rounds, and the design wants them replayed in time order (§13). | The farm model advances in **segments**: find the next event (a stage boundary, a deadline, a raid), advance in closed form to it, apply it, repeat. Same shape as the outpost's raid loop; the same `advance(o, now, ctx)` call drives both |
| F4 | **Determinism.** Lucky level-ups, raid trampling and truffle finds are random. | Seed every roll from the outpost seed plus the plot id and its cycle number; never `Math.random()` (CLAUDE.md) |
| F5 | **Raids must see the plots.** Raids and visit probes run the battle sim on the outpost map; plots do not block paths (§10) but a raider crossing one tramples it. | The raid sim reports raider cells per tick (it already moves units on cells); the farm model applies trampling from the cells after the raid, so the sim stays unchanged |
| F6 | **The grow room is not the ship's room view.** `roomView` is a side cutaway with deck lanes; the grow room is one room from about 50° above, with a 2D floor of plot and machine slots. | New `src/farm/room/` view built from the crew kit, primitive props and the ship's orthographic units, with its own floor graph; `roomView` is not bent to fit |
| F7 | **iPhone memory.** The outpost view already needed shared textures, a released menu stage and a safe mode to stay alive on an iPhone (v2026.11.09-c/-d). The farm adds instanced plants, crew rigs and ember particles to the same scene. | A budget per plot (one instanced draw per plant state per crop), at most 3 crew rigs on screen, embers on the existing particle pool, and **safe mode covers the farm**: no farmhands, no idle embers |
| F8 | **No fifth sector is needed** (owner rule 3). The OUTPOST & FARM tree (PR #225) already has SEED PODS and MACHINERY divisions with "coming soon" ghost nodes, and its total is counted apart from the battle tree (`TREE_TOTAL.outpost`). | Farming nodes replace those ghosts in SEED PODS (pods, the pod bench) and MACHINERY (Pump, Sprinklers and later machines); each division's `total` and `soon` flag change as real nodes land |
| F9 | **Rare pods from battles** are best made after the battle, not inside it. | `bankHarvest` already gets the kept tally per tier; pods = ⌊units ÷ 200⌋ (epic ⌊÷ 100⌋), with the remainder carried in the save, so the sim and its replays are untouched |
| F10 | **Harvester cap changed today** (1 to start, 2 at most, v2026.11.10-b, pending). Surface Collection is a farming method that rides on it. | No change to farming; the design's "Rare quality" for Surface Collection stands |
| F11 | **Outpost storage: full stops mining** (owner rule 4). When storage is full the miner stops and the miner and the Storage Tower show the storage-full icon (`production().ore[].stopped === 'full'`, `report.full`). The Silo is the farm's storage. | **Ask the owner before building the Silo's full rule** (A3). Until answered the Silo has a capacity and a full warning only; whether a full Silo stops harvests, spills or blocks HARVEST is open |
| F12 | **The contract card and the opening use one dialog system now** (v2026.11.09-k). | Farming contracts use `showContractModal` and `comm.playScene`; no new dialog code |

## 3. Architecture

### 3.1 Modules

| Module | Pure? | What it holds |
|---|---|---|
| `src/data/farm.js` | yes | readers for the farm sheets: `cropOf(id)`, `methodOf(id)`, `podLevel(n)`, `growTime(crop, method)`, `yieldOf(crop, method, level)`, `FARM` params; the 36 crops are the catalogue's resources joined to `Crops` rows |
| `src/farm/model.js` | yes | `createFarm`, `place` (plots, buildings), `prep`, `plant`, `harvest`, `harvestAll`, `advance` (segments, §2.3 F3), `trample`, `silo` store and warnings; state in `s.farms[planet]` beside `s.outposts[planet]` |
| `src/farm/pods.js` | yes | `s.pods[cropId][level]`, `addPods`, `spendPods`, `benchUpgrade` (3 → 1), `battlePods(tally)` (§2.3 F9), the lucky roll |
| `src/farm/contract.js` | yes | the gate (`farmingOpen(s, planet)`: a Rig Mk II on that planet's outpost), F1–F3 offers, steps and rewards, on the outpost contract pattern |
| `src/farm/env.js` | yes | Phase B (in scope): planet ambients, crop needs, `match(crop, where, enhancements)`, the Legendary check |
| `src/farm/machines.js` | yes | **Future** (owner rule 2): machine levels, maintenance clocks, overdue stop, bots' rounds (all advanced by `farm/model.advance`) |
| `src/farm/view/farmLayer.js` | no | the FARM tab in the outpost view: plots, buildings, plants (instanced by crop × state), the build list entries, the plot panel, HARVEST ALL |
| `src/farm/view/avatar.js` | no | the surface avatar and farmhands: the crew rig at 0.45 cell, walk-to on the outpost nav grid, the work pose, the tap queue |
| `src/farm/view/embers.js` | no | the harvest effect: a new shade on `impacts.emit`, five level colours, value-noise drift |
| `src/farm/room/` | no | **Future** (owner rule 2): the grow-room view (tilted orthographic, floor graph, thirds, slots, machines, bots) |
| `src/menu/seedPods.js` | no | the SEED PODS tab in the INVENTORY screen |
| `tools/farming/` | no | review pages: the scale page (Phase 0), `farm.html` (the real FARM tab on a seeded save), `rooms.html` (Phase B) |

### 3.2 Data (the workbook)

New sheets in `Bulwark-Map-Data.xlsx`, written by `tools/economy/write_farm_sheets.py`, extracted by
`extract_mapdata.py` into `MAPDATA.farm*`, all values proposed until the owner rules (D14):

| Sheet | Rows | Columns (main) |
|---|---|---|
| `Farm_Params` | tuning | Prep gold/time, Fruited window ratio, lucky chance, bench costs, battle pod rate, Silo hours, avatar scale, research level thresholds |
| `Crops` | 36 | Resource id, Category, Grows_As (living/accreted), Best_Method, Base_Grow_H, Yield, Needs (four axes), Enhancements, Vigour |
| `Farm_Methods` | 14 | Footprint, Where, Speed_Mult, Yield_Mult, Power, Prep_Mult, Pods_Per, Family, Taught_By |
| `Pod_Levels` | 5 | Level, Colour, Value_Mult, Yield_Bonus, Ember count/lifetime |
| `Farm_Buildings` | Farmhouse, Silo, Pump, doorways, Kennel, Refinery, Fabricator | Cost, Build time, Power, Footprint |
| `Farm_Contracts` | 27 | Planet, Step, Asks, Pays, Unlocks (Distribution §5.2) |
| `Farm_Tech` | ~25 | Node, Price, Effect, Opened_By (Farming-Design §12) |
| `Farm_Machines` | 6 × 4 levels | Cost, Power, Interval_Days, Upgrade_Mult, Blueprint (Distribution §6) |
| `Pod_Stores` | 9 × ranks | Faction, Rank, Crop tier, Level, Price |

Phase A needs `Farm_Params`, `Crops`, `Farm_Methods` (the two it ships), `Pod_Levels`, `Farm_Buildings` (Farmhouse,
Silo, Pump) and Verdance's F1 row; the rest of the sheets come with their epics.

### 3.3 Save

`s.farms[planet]` (plots, buildings, Silo, the farm's clock `t`, its seed), `s.pods[crop][level]`,
`s.podCarry[crop]` (the battle pod remainder), `s.farmContracts[planet]` (F1–F3 progress). New fields default empty
on load; Helium-4 is a new id and needs **no migration** (owner rule 1).

## 4. Open questions, by the epic they block

| Blocks | Questions (Farming-Design D…, Distribution X…) | The plan builds with the design's assumption unless the owner says otherwise |
|---|---|---|
| **F-A** | D1 (four stages + Dead), D2 (Fruited lasts the grow time), D5 (how pods level up), D6/X3 (value per level), D8 (F1 contract), D9 (trample rules), D14 (every number), D36 (4 pods per plot), D44 (avatar 0.45 cell), D45 (farmhands), D46/X4 (per planet), X7 (battle pod rate); **the Silo when full (owner rule 4: asked before A3 builds it)** | yes, except the Silo rule |
| **F-B** | D37 (Vertical floors); enhancements on the surface. The grow-room questions (D3, D18, D19, D21, D23, D24, D26, D27, D28, D30, D31, D32, D33) wait with the future grow rooms (owner rule 2) | yes |
| **F-C** | D11 (gems as a byproduct), D13 (Lumen enclosed only), D35 (footprints), X1 (accreted crops), X5 (specialties), X6 (rank names and thresholds), X8, X9, X10 | yes |
| **F-D** | the recipe book (its own design, Farming-Design §11.2) | a design story first |

## 5. Epics and stories

Stories are tickets on the MetaMax board (the DoD lives there); this table is the order and the dependencies.

### F-A · The loop on Verdance

| Story | Builds | Depends on |
|---|---|---|
| **A0** Farming designs on main | the two designs, the scale page and the Blender scripts from `feat/farming-prototype`, merged (design epic) | — |
| **A1** Farm data | the Phase A sheets, `write_farm_sheets.py`, extraction, `src/data/farm.js`, tests | A0 |
| **A2** Helium-4 | **a new material** (owner rule 1): its own name, id `helium-4`, icon, model key and catalogue entry as Lumen's uncommon-tier crop; Helium-3 untouched; no migration | — |
| **A3** Farm model | plots, prep, plant, stages, Fruited window, Dead returns pods, harvest yield by level, lucky roll (seeded), Silo (capacity and full warning; **its full rule asked of the owner first**, rule 4), segment advance, away report lines, tests | A1 |
| **A4** Seed pods | `s.pods`, the pod bench (3 → 1), Rare pods from battle tallies with carry, the F1 Pod Crate, tests | A1 |
| **A5** The gate and Verdance F1 | `farmingOpen` (Rig Mk II), the F1 offer aboard the ship (contract card), its three steps and rewards, the FARM button and its status line, Mission Log | A3, A4 |
| **A6** Verdance farm cells | the farmable-cell layer on the Verdance outpost map (Forge tags: soil, slope, water, grove, collection), its reader, the placement rule (2 × 2 on soil, not on pads, lanes or the mesa), tests | A1 |
| **A7** The FARM tab | the OUTPOST / FARM tab in the outpost view, build list entries (Farmhouse, Silo, Traditional, Irrigated, Pump), placing plots, the plot panel, HARVEST ALL and SELL, the plot bed and plant models in their states, safe-mode rules | A3, A6 |
| **A8** The surface avatar | the gold avatar at 0.45 cell, walk-to on the outpost nav grid, the work pose, the tap queue; Verdance farmhands; both shelter in a raid | A7 |
| **A9** Embers | the harvest effect in five colours, the idle embers over Fruited plots, the dead-plot dust | A7 |
| **A10** SEED PODS tab | the INVENTORY tab: crops by planet, five level slots each, the detail panel, UPGRADE and PLANT | A4 |
| **A11** Raids and the farm | trampling from raider cells (raids and visit probes), Silo breach 25%, tests | A3 |
| **A12** Review page | `tools/farming/farm.html` on seeded saves (every plot state, a raid, the away report), phone frames | A7–A11 |

### F-B · Environment

| Story | Builds | Depends on |
|---|---|---|
| **B1** Atmosphere | planet ambients, crop needs, `match()`, the take/no-take rule, tests | F-A |
| **B2** Farming tech in the OUTPOST & FARM tree | (owner rule 3; replaces the FARMING division) farming nodes in SEED PODS and MACHINERY in place of the ghosts, enhancements on the surface, the Research Level count | B1 |
| **B8** Vertical farm and Tub | the Vertical farm's four floors and the Tub on the surface | B2 |

**Future: grow rooms** (owner rule 2). Out of current scope; on the board under *Farming (future): grow rooms*. Kept
here so the order survives when they come back:

| Story | Builds | Depends on |
|---|---|---|
| **B3** Grow-room view | the 50° room, floor graph, thirds and slots, the avatar's walk-to and plot actions, the room tabs | F-A |
| **B4** Machines and maintenance | six machines, levels 1–4, the maintenance clocks, MAINTAIN and MAINTAIN ROOM, the overdue stop, the one-clock replay | B3 |
| **B5** Hydroponics | the glass dome doorway and the one hydroponic room set | B3, B4 |
| **B6** Underground | the ammunition bunker doorway, the cavern kit and the nine accent sets | B3, B4 |
| **B7** Gro-bots | the Robot Bay, Gro-bot I and II, their offline rounds | B4 |
| **B9** Legendary and mystery crops | the Legendary tech check, mystery pods, affinities, the Growth Journal | B2, B5, B6 |
| **B10** Rooms review page | `tools/farming/rooms.html`: both rooms, nine accents, each equipping stage, machine levels, one overdue | B5–B7 |

### F-C · Farming across the factions

| Story | Builds | Depends on |
|---|---|---|
| **C1** The 27 contracts | F1–F3 for every planet (data and flow) | F-A, F-B |
| **C2** Pod stores | each ship's pod store by loyalty rank | C1 |
| **C3** The Collective's farm orders and wanted crops | orders after two farmed planets; the 1.5× wanted crop | C1 |
| **C4** Machine blueprints | levels 3 and 4 from the specialist factions, Machine Engineering I–III | C1, B4 (future: waits with the grow rooms) |
| **C5** The six other methods | Terraced, Orchard, Solo, Spatial (§5.5), Hydrofarm, Truffle Hunting and the Hunter Kennel | C1 |
| **C6** The 36 crop models | living and accreted, every state, LODs | A7 |
| **C7** Gems from the deep seam | the 5% cut-gem chance per load | — |
| **C8** The other eight maps | the farmable-cell layer on each outpost map | A6 |

### F-D · Processing

| Story | Builds | Depends on |
|---|---|---|
| **D0** Recipe book design | the full recipe list (design, owner review) | F-C |
| **D1** Refinery | refining jobs, level carries through | D0 |
| **D2** Fabricator | Research Level 3 gate, the first ship parts and upgrades | D1 |

## 6. Testing and review

- **Node tests** beside each pure module, run by `npm test` locally; no GitHub CI.
- **Determinism tests**: advancing a farm once over 72 hours equals advancing it in one-minute steps (the outpost's
  closed-form test, applied to the farm), with raids, Fruited windows and Dead plots in the span.
- **Save tests**: an old save keeps its `helium-3` exactly as it was (no migration); a save with no `farms` opens the
  FARM tab empty.
- **Review pages** outside Claude: `tools/farming/farm.html` (F-A) and `tools/farming/rooms.html` (F-B), each with
  `?state=` presets and phone frames; screenshots with Playwright before each PR.
- **iPhone**: the error report's GPU breadcrumbs (`gpuLine`) cover the FARM tab; a farm with 20 plots and the avatar
  is measured in safe mode before F-A closes.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/16 Bulwark MM/design/Farming-Design.md | the mode: methods, plots, stages, pod levels, rooms, machines, maintenance, research, raids, processing |
| depends-on | docs/16 Bulwark MM/design/Farming-Distribution-Design.md | which faction gives which crops, pods, methods, enhancements, blueprints and contracts |
| depends-on | docs/tech-plan/Outpost.md | the outpost model, view, maps, raids and Blender pipeline the farm is built on |
| related | docs/16 Bulwark MM/design/Outpost-Design.md | the rules today (R1–R14) the farm shares: power, reach, raids, selling |
| related | docs/tech-plan/Capital-Ship-Interior.md | the room kit and orthographic units the grow rooms reuse |
| related | docs/tech-plan/Ship-Crew-Characters.md | the crew rig the avatars and farmhands use |
| related | docs/tech-plan/Collective-Faction.md | overlap declared: both change `tools/extract_mapdata.py` (G7) |
| related | docs/tech-plan/Mission-Log.md | contracts in the Mission Log; the INVENTORY screen |
| related | docs/16 Bulwark MM/design/Tech-Tree-Design.md | divisions, rule D7 |
