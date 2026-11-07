# Tech Plan — Outposts and mining: data and visualization

Status: owner decisions applied (design §11; the build-it-yourself start, 2026-11-07) · 2026-11-07 · Epic *Outposts and mining* (initiative *Bulwark advanced mode*, L3)
· Design: `docs/16 Bulwark MM/design/Outpost-Design.md` (what the player gets, and why; this plan does not restate it)

## 1. Scope

What this plan builds, in order:

1. **The data.** Ores, outpost buildings, contracts and tuning live in the map-data workbook, are extracted to
   game data, and are read by pure modules.
2. **The outpost model.** A pure, tested module advances an outpost through real time: extraction, storage, build
   timers, the raid schedule and its outcome, and sales.
3. **The first contract,** granted on the first visit to a capital ship, with new mission gates.
4. **The outpost view.** A 3D scene of the planet's outpost map with the new buildings, conduits and effects, the
   outpost HUD and the away report, and live raids run by the battle simulation.
5. **The menu change.** OUTPOST replaces REPLAY LAST BATTLE, and replay moves to the battle history cards.
6. **The models and maps.** Six buildings, the shuttle, the ore deposits, and nine outpost maps.

Phase A (the first PR set) is Verdance end to end: data for all nine planets, the model, contract 1, the Verdance
map, the first-setup models, the outpost view, live raids and the menu. Phase B adds the other eight maps, the
Resource Bay (was the Harvester Bay) and Upgrade Bay models and behaviour, contracts 2–3 and the Outpost tech nodes.

## 2. What already exists — reuse, do not rebuild

Checked with MetaMax (`list_tickets`, `list_documents`, `does_exist`) and the repo, 2026-11-06. No outpost or mining
code, document or ticket exists beyond the initiative's one-line "L3 outposts+mining" and the five tech-tree ghosts.

| Need | Reuse | Where |
|---|---|---|
| tuning tables in data | the map-data workbook → `extract_mapdata.py` → `MAPDATA` | `docs/sources/Bulwark-Map-Data.xlsx`, `content/maps/mapdata.js` |
| save, migration, write | `updateSave` / `migrate` / `defaultSave` | `src/save/save.js` |
| loyalty, gold bank | `addLoyalty`, `s.carry.gold` | `src/save/contracts.js`, `save.js` |
| contracts, gates, Mission Log | mission rows, `GATE`, `missionLog.sync` | `content/missions/missions.json`, `src/save/missionFlow.js` |
| first visit aboard a ship | the boarding sequence and contract card | `src/reveal/shipReveal.js`, `src/render/contractModal.js` |
| a map with terrain, decor, resources, spawns | Terrain Forge maps and the battle loader | `content/maps/forge/*.json`, `terrain.html`, `main.js` |
| a 3D view of a map | the battle 3D renderer: ground, decor, resources, towers, units, FX | `src/render3d/index.js` and below |
| towers, walls, harvesters, enemy units | the battle simulation and its structures | `src/sim/**`, `src/render3d/structures/*` |
| big GLB models with emissive and LODs | the capital ship pipeline: headless Blender, `prepareShip`, `createEngineFx` | `tools/blender/`, `content/ships/`, `src/render3d/ships/engineFx.js` |
| seeded randomness | `createRng(seed)` | `src/sim/rng.js` |
| red dots and menu buttons | menu badges | `src/menu/menu.js`, Menu-Progression-Design §4 |
| replay of a logged battle | `startReplay(log)` on its own board | `src/main.js` |
| battle history cards | `openBattleHistory` | `src/menu/battleHistory.js` |
| a review page outside Claude | the `tools/<feature>/index.html` pattern | e.g. `tools/reveal/index.html` |

## 3. Data

### 3.1 Workbook sheets (the source of truth)

Five new sheets in `docs/sources/Bulwark-Map-Data.xlsx`, with the same "hand-edit, then extract" flow as
`Rare_Contracts`:

| Sheet | Rows | Columns |
|---|---|---|
| `Ores` | 27 (9 planets × 3 tiers) | `Planet_Key, Planet, Tier, Ore, Ore_Id, Rate_Per_Min, Price, Deep_Rate_Mult, Deep_Price_Mult, Colour, Rig_Head, Wanted_By, Use` |
| `Outpost_Structures` | ~12 (each building × tier) | `Kind, Tier, Cost, Value, Build_Sec, Power_Draw, Power_Supply, Power_Reach, Bay_Hours, Rate_Mult, Capacity_Mult, Battle_Struct, Model, Unlock` — `Battle_Struct` names the `STRUCTURES` entry a defense takes its stats from (`STR-MG`, `STR-Cannon`, `STR-Wall`) |
| `Outpost_Raids` | 9 (one per planet) | `Planet_Key, Units (the faction's tier I lightGround unit ids), Breacher, Raider_HP_Mult, Raider_Damage_Mult, Size_Step1, Size_Step2, Size_Step3, Far_Day_Bump, Measured_On` — measured by `outpost_raids.mjs` (§4.3, as built O7) |
| `Outpost_Contracts` | 27 (9 planets × 3) | `Planet_Key, Step, Title, Ore_Tier, Deliver, Raids_Held, Gold, Loyalty, XP, Unlocks` |
| `Outpost_Params` | ~18 named values | `Load_Sec 300, Store_Hours 4, Deep_Price_Mult 5, Raid_Mean_Hours 6, Raid_Min_Gap_Hours 3, Breach_Storage_Loss 0.25, First_Raid_Sec 600, Away_Cap_Hours 72, Replay_Keep 20, Far_Buyer_Mult 2, Far_Loyalty_Cost 1, Rig_Bay_Min 15, Harvester_Cap 2, Harvester_Max 4` (the last three O16) |

`tools/extract_mapdata.py` extracts them to `MAPDATA.ores`, `.outpostStructures`, `.outpostRaids`, `.outpostContracts`
and `.outpostParams`. Its validation refuses a planet without exactly three ores, a duplicate `Ore_Id`, a structure kind
the code does not know, and a contract that delivers an ore tier the planet has not unlocked by then. It also refuses
a raid unit that is not `lightGround` or not tier I, and an outpost defense whose `Battle_Struct` is anti-air or has
a range above 5 (owner: no anti-air, no long range).

**As built (O1).** `tools/economy/write_outpost_sheets.py` seeded `Ores`, `Outpost_Structures`, `Outpost_Contracts`
and `Outpost_Params` from the design; from then on the workbook is the source (re-running the script overwrites hand
edits). `Outpost_Raids` is written later, by the sim measurement (§4.3), since its sizes cannot be picked by hand.
The extractor checks what the sheets alone can show (three ores per planet in three rig designs, unique ids, one
far-buyer want per faction, known kinds, outpost-only `Battle_Struct`s, the contract ladder's unlock order, every
param present); the checks that need the battle tables (defense range within 5, no air-only tower, prices equal to
the battle price × 4 at every tier) run in `src/data/outpost.test.mjs` against `STRUCTURES`. Contracts 2–3 carry
proposed rewards (4,000 / 8,000 gold, +30 / +40 loyalty, 500 / 800 XP) to tune after contract 1 has been played.

The design's numbers (Outpost-Design §3–§7) are the first values. `tools/economy/outpost_model.mjs` prints the
derived table: gold per hour per tier, fill times, and raids held per defense set (by running the sim, §4.3). The design's tables come from it,
so a retune shows its consequences before it is extracted.

### 3.2 Game data readers (pure, node-tested)

- `src/data/ores.js`: `oresOf(planet)` → `[{ id, name, tier, rate, price, deep, colour }]`, `oreById(id)`,
  `oreValuePerHour(ore, { deep, rigTier })`.
- `src/data/outpost.js`: `structureDef(kind, tier)`, `contractFor(planet, step)`, `OUTPOST` (the params), and
  `powerBudget(structures)`.
- `src/data/resourceIcons.js` gains the 27 ores. Their icons are new art (story O12); until it lands, a tinted
  ore-chunk glyph in the ore's `Colour` is used.

### 3.3 The save

```js
s.outposts = {
  ground: {                       // planet key
    seed: 912345,                 // from the save's id + planet; drives the raid schedule
    online: true,                 // contract step 1 done
    t: 1762470000000,             // last advanced (ms since epoch, wall clock)
    pads: { hub: { kind:'hub', tier:1 },          // the only building the contract grants (O16); the rest are bought
            p1: { kind:'power', tier:1 }, p2: { kind:'rig', tier:1, deposit:'common', deep:false },
            p3: { kind:'storage', tier:1 }, … },
    building: [{ pad:'p4', kind:'resourceBay', tier:1, done: 1762470300000 }],   // 'harvesterBay' in old saves, migrated
    harvesters: 2,                // bought once a Resource Bay is finished, up to Harvester_Cap (O16; behaviour O10)
    stations: [{ pad:'p1', tier:1 }, { pad:'r2', tier:1 }],   // power stations; grids are derived from reach
    defenses: [{ id:'d1', struct:'STR-MG', tier:1, cell:[12,7], hp:240 }],   // HP carries over between raids
    storage: { p2: { iron: 412.6 } },   // per rig bay (pad id), fractional units, shown floored; deep grade is 'iron_deep'
    raids: { window: 412, log: [{ at, result:'held'|'breach', damage }] },   // log keeps the last 20
    sold: { iron: 300 },          // lifetime, for contract steps
  },
};
s.outpostContracts = { ground: { step: 1, state: 'active', delivered: 0, raidsHeld: 0 } };
s.outpostTrade = { discovered: { air: 'lithium' }, farSoldToday: { day: 20398, loads: 3 } };   // the far buyer (design §8.5)
```

`migrate()` adds empty `outposts` and `outpostContracts`, renames a saved `harvesterBay` to `resourceBay` and gives an
outpost without one `harvesters: 0` (O16). Nothing is stored that can be derived (gold per hour, power used, loads
ready, bay caps, warnings).

## 4. The outpost model (`src/outpost/model.js`)

All outpost rules live in one pure module, so the menu, the outpost view, the away report and the tests read the same
answers.

```js
advance(outpost, toMs, { params, ores, structures })  → { outpost, report }
loadsReady(outpost)                                   → n
sell(outpost, { buyer })                              → { outpost, loads: [{ ore, units, gold }], gold, loyalty }   // one entry per load, for the pops; buyer defaults to the home ship
place(outpost, pad, kind) / repair(outpost, id) / setDeep(outpost, pad, on)   → outpost (or a refusal reason)
raidSchedule(seed, fromWindow, toWindow, params)      → [{ window, at }]
powerGrids(outpost, map)                              → [{ stations, supply, draw, powered: Set<pad> }]   // reach + pooling
runRaid(outpost, raid, { map, sim })                  → { result: 'held'|'breach', defenses (new HP), events }
```

**As built (O2).** `src/outpost/model.js` with 16 node tests in `src/outpost/model.test.mjs`. Where it differs from
the sketch above:

- **The signatures take a `ctx`.** `advance(o, toMs, { map, raid?, params? })`, `sell(o, ctx, { buyer })`,
  `place(o, { pad | cell, kind }, { map, gold, now, unlockedTiers, unlocks })`; `upgrade`, `repair`, `repairCost`,
  `setDeep`, `onlineProblems`, `confirmOnline`, `loadsReady`, `status` and `createOutpost(planet, { seed, map, now })`
  complete the set. `powerGrids` returns `{ grids, powered: Set, off: { pad: 'reach' | 'supply' } }`.
- **Stations are derived from the pads,** not stored separately: any pad holding a `power` building is a station.
  Consumers draw in priority order: hub, storage, rigs, defenses, bays.
- **`place` allows an unpowered pad,** so a remote rig can be built before its station; it simply stays off.
- **`runRaid` is not in the model.** `advance` resolves each due raid through an optional `ctx.raid(outpost, raid)`
  hook returning `{ result, defenses }`; without it a raid counts as held. O7 plugs the battle sim into that hook.
- **Until O4 authors the real maps,** the model, its tests and the review page run on `src/outpost/draftLayout.js`
  (`DRAFT_LAYOUT`, 40 × 24: a mesa within reach of the first station, a remote rare pad with its own station).

**As built (O16), the build-it-yourself start** (owner, 2026-11-07; design §2.3, §4.2, §4.5, §6, §6.1, §11):

- **`createOutpost` grants only the hub.** `pads: { hub }`, no defenses, no storage, `harvesters: 0`. The player buys
  the rest with `place(o, { pad, kind }, ctx)` (`PAD_KINDS`: `power`, `rig`, `storage`, `resourceBay`, `upgradeBay`;
  `harvesterBay` is read as `resourceBay`) and `place(o, { cell, kind }, ctx)` for `DEFENSE_KINDS` (`mg`, `cannon`,
  `wall`; anything else is `unknown building …`). `place` refuses `hub` ("the hub comes with the contract") and
  `harvester` ("harvesters are bought, not placed (buyHarvester)"). Pad buildings land after their `Build_Sec`
  (Power I and Rig I 2 min, Storage I 1 min) through `advance`; defenses are placed at once. `defaultPads(map)` names
  the setup's pads (hub, power, the common rig pad, storage) for the view.
- **`referenceOutpost(planet, { seed, map, now })`** is the former kit: the four buildings finished plus the map's
  `kitDefenses` (the field keeps its name). Nothing in play grants it. The raid measurement (`stepOutpost`), the
  tests and the review fixtures start from it.
- **Going online** (`onlineProblems` / `confirmOnline`) asks for the hub, a Power Station, a Mining Rig on the
  common deposit and a Storage Tower, all finished, and the hub, the common rig and the tower powered. The messages are
  `no power station`, `no mining rig on the <ore>`, `no storage tower`, `no hub`, `<pad> unpowered (reach|supply)`.
  Other unpowered buildings no longer block it.
- **Storage and power** (owner, 07:33). A rig mines whenever it is finished and powered: online or not, with or
  without a tower. It mines into its own bay. With no open tower the bay holds `Rig_Bay_Min` (15) minutes of its
  shallow output × Mk II. A finished, powered Storage Tower raises the bay to `Bay_Hours` (× Mk II × Storage II). An
  unpowered tower's door is closed, and an unpowered rig does not mine. Stored ore is never removed by a power change,
  and `sell` ships it whatever the power. `bayCapacity(o, pad, map?)` takes the map so it can tell whether the tower is
  powered; without the map, every finished tower counts. The old rule that mining waits for online, a powered hub and
  a powered tower is gone.
- **`warnings(o, map)`** → `{ [padId | defenseId]: ['no_power' | 'storage_full' | 'door_closed'] }`, only for ids with a
  warning. `storage_full` marks a rig whose bay is full, and the tower when every rig's bay is full. `door_closed`
  marks an unpowered tower. The view draws its warning icons from it.
- **Harvesters.** `buyHarvester(o, { gold, params? })` → `{ outpost, cost }` or `{ error }`. The refusals, from
  `harvesterRefusal(o, ctx)`, are `build the Resource Bay first` (none finished), `the Resource Bay holds N
  harvesters` (at `Harvester_Cap`) and `costs 2000 gold`. Price and cap come from `harvesterDef()` in
  `src/data/outpost.js`: the `harvester` row of `Outpost_Structures` (2,000, the battle harvester's 500 × 4),
  `Harvester_Cap` 2 and `Harvester_Max` 4. Raising the cap toward 4 and what harvesters gather are O10.
- **Data.** `src/data/outpost.js` exports `GRANTED` (`['hub']`), `ESTABLISH` (the four), `REFERENCE_SET` (the former
  `KIT`), `KIND_ALIASES` / `canonicalKind`, and `harvesterDef`. `structureDef('harvesterBay')` resolves to the
  Resource Bay, so a view that still says `harvesterBay` keeps building and pricing. `bayUnits(ore, { storageTier: 0 })`
  is the rig's own bay. The extractor knows `resourceBay` and `harvester`. It requires a hub with `Unlock` `granted`
  and a positive `Cost` on every other row, a one-row `harvester` with no power draw, the three new params, and
  `0 < Harvester_Cap ≤ Harvester_Max`.
- **Prices** (design §6.1): Power Station I 600, Mining Rig I 600, Storage Tower I 300 (the first setup 1,500, about
  2 h of iron), Resource Bay 2,500, harvester 2,000, defenses at the battle price × 4. `outpost_model.mjs` prints the
  setup, its payback and the bank it is sized to.
- **Measured, the first raid against a bought outpost** (Verdance map, `makeRaidHook`, seeds 1–5). The setup with an
  MG, a Cannon, or both: breached 5 of 5. With the six reference walls alone: breached 5 of 5. Walls + MG: held 4 of 5.
  Walls + Cannon: held 1 of 5. A player who buys only the setup will lose a quarter of the stored ore to the scripted
  raid. That is allowed (step 3 waits), but it belongs to the open raid-balance decision (§4.3 as built O7, design §11
  "weaker raiders").

### 4.1 Advancing through time, in closed form

`advance` never steps second by second. It cuts the interval `[t, toMs]` at every event: a build finishing, a raid,
or storage filling. Nothing is ever sold inside `advance`: selling is always the player's tap (design §4.3). Between two events every rate is
constant, so each rig's extraction is `rate × Δt`, capped by the space left in its own bay (design §4.2: a bay holds
`Bay_Hours` of the rig's shallow output, × `Capacity_Mult` for Mk II and Storage Tower II). Three days away is a few
dozen segments.

- **The clock.** Wall-clock time (`Date.now()`) is read only by the menu and the outpost view, then passed in.
  `advance` itself is pure. This is outside the battle simulation, so the replay-determinism contract is not
  touched.
- **Clock guards.** If `toMs < t` (the device clock went back), nothing advances and `t` is not lowered. The away
  interval is capped at `Away_Cap_Hours` (72), so a clock pushed forward gains at most what full storage holds, which
  storage caps anyway.
- **Precision.** Storage is fractional; the UI floors it, and sales sell whole loads.

### 4.2 The raid schedule

Time is cut into 3-hour windows from the epoch. A window holds a raid with probability `3 / Raid_Mean_Hours`
(0.5), at a minute inside it, both drawn from `createRng(hash(seed, window))`. The draw depends only on the seed and the window
index, so opening the game more or less often never changes which raids happen. `raids.window` records the last
window resolved, so a raid is resolved exactly once.

- **Every raid runs the battle sim** (design §5.2): `runRaid` builds a `createSim` on the outpost map with the
  outpost's defenses (their `STRUCTURES` stats at their tier, starting from their saved HP), its buildings as
  weaponless structures, and one wave of the planet's `Outpost_Raids` units at the contract step's size, on the raid
  lanes. It runs the sim to the end of the wave and reads the result: each defense's HP, and a breach if any raider
  reached a building. A breach takes `Breach_Storage_Loss` (25 %) of each ore. No building goes down.
- **First raid:** contract step 3's raid is not drawn. It is fixed `First_Raid_Sec` after the outpost comes online.

`advance` stays pure: the sim is passed in (`{ sim }`), and the sim is itself deterministic and seeded with
`seed + window`, so the same raid gives the same result live, headless or in a test, and the replay-determinism
contract holds.

### 4.3 Live and away raids are the same raid

- **Away:** `advance` runs each due raid headless, in order, during catch-up.
- **Live (outpost view open):** the view runs the same `runRaid`, ticking the sim in real time and drawing it with the
  battle renderer. Closing the view mid-raid finishes it headless; the result is identical.
- **Tuning:** `outpost_model.mjs` runs repeated raids against the starter kit and the "well defended" set with no
  repairs, per planet, and searches each step's raid size so the kit holds about 5 raids and the well defended set
  about 8 (design §5.2). It writes `Size_Step1..3` to the `Outpost_Raids` sheet. A retune of any tower or unit in
  `tables.js` is followed by re-running it.

**As built (O7).** `src/outpost/raid.js` (its header is the contract with the view, O6):
`runRaid(outpost, raid, { map, step })` → `{ result, defenses: [{ id, hp }], events, ticks, timedOut }`;
`createRaid(…)` → `{ state, tick(), step(seconds), finish(), done, result(), defenseIds, buildingPads, lanes }` for the
live view (fixed `FIXED_DT` ticks, so any frame timing then `finish()` gives runRaid's result, tested);
`makeRaidHook({ map, step })` is `ctx.raid` for `advance`. Where it differs from the sketch above:

- **The board is the battle board.** The outpost map's Forge export goes through `buildTerrainMap` with the default
  bake tune, as `main.js` loads a battle map (built once per map and cached); then the base is put on the hub, the one
  wave comes down the map's ground spawns (the first lane drawn from the raid seed, then alternating), surface
  resources and wave windows are dropped, the hub's super-cannon is off, and finished buildings' pads are solid. The
  draft layout (no terrain) gets an open board.
- **Raiders fire on the defenses they pass** (`engagesStructuresWhileAdvancing` set on raid units only): battle
  attackers ignore towers, so without it a defense would never wear and "damage carries over" would mean nothing.
  Water's swimmers walk (an outpost has no water lane).
- **Walls may close the ramps**, unlike a battle's placement rule. A raider the router leaves with no open route
  marches on the hub up to the first defense in its way and shoots it until it falls (siege). The Verdance kit's walls
  were moved to close the three ways onto the mesa (`tools/maps/outpost-maps.mjs` and the shipped map): measured, walls
  that only flank a ramp let a single tier I troop walk past both guns to the hub, which sits 1–2 cells from the ramp
  heads. The third way is the mesa's south-east corner, (44, 21): the battle's bake warp opens that rim cell, which the
  Forge grid has as cliff. The reference MG moved to (42, 20) to cover it and the south ramp.
- **A breach** is a raider on the mesa top within 0.75 cells of a finished, non-remote pad (the hub included); below
  the cliff does not count. A raid undecided after 300 s, or in which nothing moves, hurts or is hurt for 10 s (raiders
  at a wall they cannot damage, out of every gun's reach), is held (`timedOut`: the survivors withdraw).
- **Unpowered guns** (not in `raid.powered`) are placed but inert; wrecks (HP 0) are not placed.
- **The two measured sets.** The *starter set* is the defenses a player typically buys first: the map's `kitDefenses`
  (on Verdance a Cannon, a Machine Gun and six walls closing the three ways in), on the reference outpost
  (`referenceOutpost`, O16). *Well defended* is the starter set plus one Machine Gun (design §5.2), on the free powered
  mesa-top cell nearest the starter set's Machine Gun (`wellDefended`). Beside the Cannon it adds nothing on this map:
  every raid now comes down both lanes, and the MG's way in breaks first.

**Owner decisions, 2026-11-07, as built.**

- **Weaker raiders.** `Outpost_Raids` gains `Raider_HP_Mult` and `Raider_Damage_Mult` per planet (0–1, one pair for all
  three contract steps), applied inside `createRaid` only, to every raider: HP and damage × the multipliers. The
  battle game's units are unchanged (tested). Every raider's range is also capped at the outposts' longest gun
  (`RAID_RANGE_CAP`, 5), the "no long range" rule applied to raiders.
- **A breacher.** `Outpost_Raids` gains `Breacher`: one unit added after the others in each raid of a planet whose
  troops do nothing to a wall (their damage type's `EFFECTIVENESS` against Structure is 0: Toxic, Xenthe and Vexmire).
  The rule picks the faction's own ground unit that hurts structures most, light ground first. No light ground unit of
  those factions hurts structures at all (Toxic is 0 against Structure), so the closest is used: their **Artillery**
  (Concussion), tier I, with its range capped at 5 by the raid. This is the one documented exception to "troops and
  low-end tanks only"; the extractor allows exactly `<prefix>-Artillery` as a breacher of the planet's own faction.
- **The scripted first raid is a probe** (contract 1 step 3, "winnable while watching"): `FIRST_RAID_SIZE` (1) of the
  planet's Units, no breacher, down the lane that passes closest to an armed, powered defense; the probe marches on the
  nearest gun and fights it where it stands. Measured on Verdance (10 seeds, every planet's raiders): the setup plus
  one Machine Gun plus two walls (on the south ramp, on the west ramp, or the MG on the west ramp) holds it 10 / 10;
  the MG alone holds it; with no defenses it walks in. Without this rule the first raid was a normal raid, and a
  player needed a gun at every way in to hold it (the O16 measurement: six walls + MG held 4 / 5).
- **Measurement:** `node tools/economy/outpost_raids.mjs --write` is the whole pipeline (measure → `write_outpost_raids.py`
  → `extract_mapdata.py` → `MAPDATA.outpostRaids` → `raidFor(planet, step)`), one child process per planet in parallel;
  `node tools/economy/outpost_raids.mjs dark greenies --write` re-measures some planets and keeps the others' rows.
  `outpost_model.mjs` prints what the data holds. Per planet it searches the multipliers (HP 0.3–1, damage 0.3–1) and
  the contract-1 raid size (2–4: the owner wants raids above one troop) together, then the size for steps 2 and 3 at
  those multipliers; median over 7 outpost seeds, 12 raids at most, no repairs, scored by the distance from 5 (starter)
  and 8 (well defended), ties to the strongest raiders. Only Verdance has an outpost map; the other eight planets are
  measured on it with their own units. Units are `<prefix>-Troops <prefix>-Troops <prefix>-Tanks` cycled.
  **Re-run it whenever a map, a tower or a unit changes** (about 30 min for all nine on a 2-core machine).
- **Measured (2026-11-07, the 64 × 32 Verdance map).** Starter / well defended medians at step 1:

  | Planet | Raiders | HP × | Damage × | Size (steps 1, 2, 3) | Starter | Well defended |
  |---|---|---|---|---|---|---|
  | Verdance (ground) | troops, tanks | 0.8 | 0.5 | 2, 2, 2 | 4 | 8 |
  | Florael (air) | troops, tanks | 0.7 | 0.3 | 3, 3, 3 | 5 | 8 |
  | Ochre (hightech) | troops, tanks | 0.8 | 1 | 2, 2, 2 | 5 | 8 |
  | Kessra (artillery) | troops, tanks | 0.9 | 0.4 | 2, 2, 2 | 5 | 8 |
  | Rime (water) | troops, tanks | 0.9 | 0.4 | 3, 3, 3 | 5 | 8 |
  | Cinder (arcane) | troops, tanks | 0.4 | 1 | 3, 4, 4 | 4 | 8 |
  | Lumen (space) | troops, tanks | 0.5 | 0.6 | 4, 4, 4 | 5 | 8 |
  | Xenthe (dark) | troops, tanks + Artillery | 0.4 | 1 | 3, 1, 1 | 5 | 10 |
  | Vexmire (greenies) | troops, tanks + Artillery | 0.4 | 1 | 3, 1, 1 | 5 | 11 |

  Every planet's starter set is in 4–6 and seven of nine well defended sets are in 7–9. Xenthe and Vexmire's well
  defended sets hold 10–11: their result swings on which lane the breacher takes, and the grid found nothing closer.
  At steps 2–3, where the larger outpost changes the routes, Florael and Rime's starter sets hold 7 and Cinder's 3–4.

### 4.4 Tests (`src/outpost/model.test.mjs`)

- 4 hours on the reference set fills 720 iron; 5 minutes is a 15-unit load; deep fills in 16 hours.
- Advancing once over 10 hours equals advancing 600 times one minute at a time, within 1e-9 (the closed form is
  exact).
- A clock that goes back advances nothing. A 10-day gap is capped at 72 hours.
- The raid schedule for a seed is the same whether it is resolved in one call or in many.
- With the measured raid sizes, the starter kit holds 4–6 raids before a breach and the well defended set 7–9, on
  every planet (design §5.2).
- A raid's result is identical run once headless, run twice, or run live and finished headless.
- Raids contain only tier I `lightGround` units; outpost defenses are only `STR-MG`, `STR-Cannon`, `STR-Wall`.
- Power: a building over its grid's supply, or outside every station's reach, is reported and stays off; two stations
  within reach of each other pool their supply; a remote rig with its own station is powered.
- Building, repairing and selling refuse when the player cannot pay, or the pad is wrong, taken or unpowered.
- A breach removes exactly 25 % of each ore in storage and changes no building.
- A Mk II rig's bay holds twice a Rig I's; a deep rig fills its bay in 16 hours; one full bay stops only its rig.
- Only `repair` restores a defense's HP; `place` does not. A kit item's repair is priced from its `Value`.
- The scripted first raid runs headless if the view is closed; a breach leaves contract step 3 waiting.
- A far-buyer sale pays `Far_Buyer_Mult` and costs home loyalty; before discovery `sell` refuses a far buyer.
- `advance` never sells, whatever the tier of the shuttle; `sell` returns one entry per full load.

**As built (O2):** every item above is tested except those that need the battle sim (measured raid sizes and the
4–6 / 7–9 hold counts, raid determinism live vs headless, raid composition, the scripted first raid run headless).
Those move to O7, with `ctx.raid`.

**As built (O16):** `model.test.mjs` adds the base-only grant, the first setup bought with gold and brought online,
the four going-online asks, the harvester purchase (refused before a finished Resource Bay, then capped), the
defense kinds, the Harvester Bay save migration, a rig mining to its own small bay with no tower and the tower raising
it, an unpowered rig and an unpowered tower (door closed, ore kept, still sold), and `warnings`. `contract.test.mjs`
runs contract 1 end to end on the Verdance map. The player buys the setup, an MG and the six reference walls with
4,500 gold, and holds the scripted raid on the real raid hook. `data/outpost.test.mjs` checks the prices, the
harvester (battle price × 4) and the rig's own bay.

**As built (O7):** those items are in `src/outpost/raid.test.mjs` (9 tests, about 2.5 s), on the real Verdance outpost
map: raid composition (light ground raiders of the planet's own faction, the breacher only where the troops cannot
hurt walls, the raid-only multipliers and range cap, the battle units unchanged) and outpost defenses, determinism
(headless twice, and stepped live with uneven frame times then finished headless), saved HP / wrecks / unpowered guns,
the starter set holding 4–6 raids and the well defended set 7–9 (Verdance, from the data), the first-raid probe held by
the setup plus one MG and two walls, the scripted first raid through `advance` with `makeRaidHook`, and a breach's
25 % loss through `advance`. Only Verdance has an outpost map, so the hold counts are tested there; the other planets'
are in the measurement's table (§4.3).

## 5. The contract and the missions

### 5.1 Granting it

`shipReveal.aboard()` already presents the ship's missions on the first visit. It gains one step before the
missions: if `outpostContractFor(planet, 1)` exists and the player has none for this planet, the captain's outpost
lines (§5.3) play, then the contract card. The card uses `showContractModal` with `kicker`, `task` and `terms` (the
fields added in Content-Reveal F4).

- **ACCEPT:** writes `outpostContracts[planet] = { step:1, state:'active' }`, creates the outpost with only the hub on
  its pad (O16; `online: false` until the player has bought and powered the setup and confirms it in the view, design
  §2.3 step 1), and sets a menu badge.
- **Decline:** leaves the contract `offered`; the Mission Log shows it with ACCEPT.

### 5.2 Missions and gates

The three outpost contracts per planet are mission rows in `content/missions/missions.json`, with `type:
'outpost'`, generated from `Outpost_Contracts` by `tools/extract_missions.py`, so the Mission Log lists, tracks and
rewards them like any mission. New gate conditions in `missionFlow.js` `GATE`:

| Condition | True when |
|---|---|
| `outpost_online` (param planet) | `s.outposts[planet].online` |
| `ore_sold` (param ore id, value n) | `s.outposts[planet].sold[ore] ≥ n` |
| `raids_held` (param planet, value n) | count of `held` in the outpost's raid log since the contract step began ≥ n |
| `outpost_contract_step` (param planet, value n) | `s.outpostContracts[planet].step ≥ n` |

Each is added to `GATE_CONDITIONS` and covered in `missionFlow.test.mjs`. Rewards use the existing reward kinds:
gold, XP, loyalty, and `tech_unlock` for the node the step unlocks.

**As built (O16).** ACCEPT grants only the hub. The card (`outpostCard`) says the contract grants an outpost base, that
the player builds a power station, a mining station on the common ore and a storage tower with their own gold, and
that the defenses are theirs to buy. Its step 1 reads "power, a mining station on the iron and storage, all powered".
`extract_missions.py` writes step 1's objective as "Establish the outpost on Verdance: build power, a mining station
on the iron and storage, all powered". Vane's `offer` line in `reveals.json` no longer promises a kit. The greet,
turn and warning lines, which keep the owner's words, are unchanged.

**As built (O3).**

- **`src/outpost/contract.js`** holds what is outpost-specific: `outpostOffer`, `acceptOutpostContract` (creates the
  outpost through `createOutpost`, since O16 the hub only, not online, and sets `outpostContracts[key] = { step, state, since }`),
  `declineOutpostContract`, `contractStepCollected`, `outpostUnlocks`, `outpostCard` (the card's words), and the three
  measures. It has 7 tests, including contract 1 end to end: logged, accepted, online, 300 iron sold, a raid held,
  collected, contract 2 active.
- **The missions are generated, not hand-entered.** `extract_missions.py` reads `Outpost_Contracts` and `Ores` from
  the map-data workbook and writes one `type: 'outpost'` mission per planet × step (`OC-VER-1`, quest line
  `QL-VER-O`), granted and collected aboard the planet's ship. A planet's contracts are written only once its outpost
  map exists (`content/maps/forge/<planet key>-outpost.json`), so no planet is offered an outpost it has no ground
  for. The Missions workbook is not changed.
- **Completion reads the save, not a battle.** `outpost_online`, `ore_sold` and `raids_held` are `SAVE_MEASURE`
  conditions in `missions.js`. They latch, because the raid log keeps only the last raids. `raids_held` counts raids
  since the mission was assigned. `refreshSaveObjectives` / `missionFlow.settleOutpost` re-read them outside a
  battle; the outpost view (O6) calls `settleOutpost` after each sale and advance. The four conditions are also
  `GATE` conditions, as planned.
- **The unlocks are derived, not rewarded.** Collecting step *k* moves `questSteps[QL-…-O]`, and `outpostUnlocks`
  reads the `Unlocks` of every collected step (ore tiers and outpost techs such as `deep_drilling_1`). No
  `tech_unlock` reward is used, because the Outpost tech nodes join the tree only in O10. The rewards are gold and XP,
  plus the contract's loyalty as the mission's `impact.loyaltyPlanet`.
- **Aboard:** `playShipReveal({ outpost })` plays the captain's outpost lines (`reveals.json factionShip.outpost`,
  Verdance only until O11) in place of the generic greeting, then the outpost card (ACCEPT CONTRACT / LATER). After
  that come the generic offer line and the missions card, as before. LATER leaves the mission in the Mission Log, whose
  dossier shows **Accept the outpost contract** until the outpost exists. `tools/reveal/index.html` shows the card
  (`?outpost=0` hides it).

### 5.3 Lines

The captain's outpost lines go in `content/reveals/reveals.json` under `factionShip.outpost`, one set per planet,
until Dialog-Unification moves faction lines into the dialog document. Verdance's are in the design (§2.2). The
other eight are written in Phase B, in each captain's voice from the voice packs.

## 6. Visualization

### 6.1 The outpost view

A full-screen view opened from the menu's OUTPOST button. It follows the battle view's structure and reuses its
renderer.

- **Scene.** The planet's outpost map is loaded through the same path as a battle map, so ground, palette, decor,
  rocks and surface resources are drawn by the battle renderer (`render3d/index.js`). New layers on top:
  buildings (§6.2), conduits (§6.3), deposits (§6.4) and the outpost effects (§6.5).
- **Camera.** The concept image's three-quarter angle, framing the mesa. Pinch or wheel zooms between the whole mesa
  and one building, and a drag pans within the map. Tapping a building focuses it and opens its panel.
- **The HUD** uses the battle HUD's visual language:
  - top bar: gold, each ore in storage with its icon, the storage fill bar, power used / supplied, and the
    defenses' state as a shield filled to their total HP;
  - bottom: **SELL** (with the number of loads), **REPAIR** when the defenses are worn;
  - left: the **BUILD** list, icons with prices, as in battle (story O17, "As built (O17)" below);
  - the selected building's panel: status, tier, rate, the deep / shallow switch on a rig, and upgrade.
- **The away report.** On open, when anything happened since the last visit, a modal in the results-screen style
  (`render/resultsScreen.js`) lists extraction per ore, each raid with its result (and the ore lost on a breach), and
  the defenses' wear. Its rows are the `report` that `advance` returns.
- **Phone.** Portrait and landscape layouts, like the battle HUD. The mesa must frame in portrait: this sets the
  outpost maps' size (§6.6).
- **Performance.** The battle's quality tiers apply. The outpost view stops the menu stage while open, as the reveals
  do.

**As built (O6):** `src/outpost/view/` (`outpostView.js` opens it; the menu's OUTPOST button calls it and pauses its
own 3D stage while it is open, then refreshes the button, the missions and the bank). The map goes through the battle
path: `outpostBoard.js` builds the board with `buildTerrainMap` on the map's Forge export and hands
`createRenderer3D` the baked level (`content/maps/baked/<planet>-outpost/`) when it exists; ground, palette, decor,
resource fields and the defenses (System `STR-MG` / Cannon / Wall, darkened and sparking when worn) are the battle
renderer's, with no waves and the ring fog off. `outpostScene.js` adds pad plates, the GLB buildings
(`render3d/outposts/outpostModels.js`, factored from the O5 review page: LODs, trim slot, clips while working, Mk II
amber + 2× + 3× debris, rise / cool / warm / unpowered states, offline lights dimmed), conduits (two merged meshes, a
pulse toward the building), procedural ore outcrops (cut face under a rig, dim with a lock when locked), mining
debris, the storage hologram's fill and the SELL sequence (`sellTimeline.js`: drain, crates along the conduit route,
shuttle with `createEngineFx`, camera shake, ore splatter, "$N" pops via `goldPopups`, count-up; reduced motion keeps
the pops and count-up). `hud.js` is the HUD, panels, BUILD sheet (pads, then defenses placed on `defenseRing`), the
GO ONLINE card (`onlineProblems` / `confirmOnline`) and the away report; `hudModel.js`, `layout.js`, `conduits.js`,
`awayReport.js` and `session.js` are pure and node-tested (24 tests). On open the away catch-up runs one raid window per frame (`session.openChunked`; advance is split-invariant, so it equals one call) behind the loading line, for O7's sim raids. Every action runs `session.act`: advance the
save to now, the model function, the gold, then `settleOutpost`. `Date.now()` is read only by the view (on open, a 1 s
live tick that saves only when a raid or build lands, and each action). Raids: `raidSeam.js` `raidHookFor(map, step)`
is the one place O7's `makeRaidHook` plugs in; it returns no hook yet, so raids count as held. Review:
`tools/outpost/view.html` (presets, quality, clock speed, stand-in raids; in-memory save), linked from
`tools/outpost/index.html`. Deviations: deposits are procedural outcrops in `outpostScene.js`, not a new kind in
`resources/models.js`; the Harvester and Upgrade Bays draw as placeholder blocks until O10; the hull is drawn nearly
dielectric and lifted (`bodyLift`) because the battle view has no environment map and writes linear colour; the camera
keeps the battle pitch (37°) and its 95 distance cap, so a portrait phone frames the mesa's pads rather than the whole
rim (`layout.framedCamera` falls back), and the three-quarter angle is a 0.38 rad yaw. **Frame time, low tier, full
kit** (every pad built: hub, three stations, Rig Mk II, laser and brine rigs, Storage II, both bays, 12 defenses; the
`fullkit` preset of `tools/outpost/view.html`, `handle.measure(60)`: script + draw + `gl.finish` per frame, then 20
frames during a SELL): 390 × 844 — 8.9 ms average (p95 16), 73 draw calls, 90k triangles; 844 × 390 — 12.0 ms (p95
17.1), 90 calls; 1280 × 800 — 14.7 ms (p95 22.2), 85 calls; during a SELL 12.7–16.5 ms average, p95 50–62 ms (the
shuttle's first frames build its engine FX and LOD clones). Measured in headless Chromium on SwiftShader (software GL)
on a 2-core Xeon at 2.1 GHz, where the frame interval (215–677 ms) is the software rasteriser and the headless
compositor, not the view; these are a ceiling for the CPU side, not a phone figure, and need a real low-tier phone
before launch. The live raid's frame time is O7's.

**As built (O17), the build menu** (owner, 2026-11-07: "building an outpost should be done the same way the tower
defense game works. An icon list with cost on the left side of the screen"; follow-ups: Storage Tower required, the
turret tower is the Cannon Tower, harvesters bought from the list once the Resource Bay stands; 07:33: warnings for no
power and full storage, the unpowered Storage Tower's door shut). This replaces the **BUILD** button and sheet above:
- **The battle's palette, shared.** Its CSS, its SVG fallback glyphs and the reactive left rail's sizing moved out of
  `render/hud.js` into `render/buildPalette.js` (`PALETTE_CSS`, `paletteBaseCss(scope)`, `STRUCT_ICONS`, `railFit`,
  `applyRailFit`); the battle HUD imports them unchanged and the outpost HUD draws the same `bw-palette` / `bw-buildbtn`
  buttons: picture + name + price, the hotkey badge (1–9), `bw-selected` when armed, `bw-poor` greyed when short of
  gold (the price turns red), plus a padlock and the reason (hover title, toast on tap) when locked.
- **The list** (`view/buildMenu.js`, pure): Power Station, Mining Station, Storage Tower, Resource Bay, Upgrade Bay,
  Harvester (n / cap), Wall, Machine Gun, Cannon Tower. Prices are `structureDef(kind, 1).cost` and `harvesterDef()`;
  which pads / cells take an item is asked of `model.place` on a copy with unlimited gold (so the rules, not the menu,
  decide: pad roles, unlocked deposits, taken cells, a later gun cap); the harvester's lock is `harvesterRefusal` (gold
  aside). Pictures: the defenses and the harvester reuse the battle's baked icons (`content/icons/build/`); power,
  storage and each rig head are rendered from their GLBs once on open (`view/menuIcons.js`, the view's own renderer to
  a render target); the bays (no GLB until O10) keep a glyph. The Mining Station's picture is the head of the first
  free deposit.
- **Placement** is the battle's loop as a reducer (`placementStep`): pick arms (pick again, Esc or right-click
  disarms); valid pads glow (pulsing cyan) or the defense ring's free cells light; the mouse's ghost follows the
  pointer; a click on a lit spot builds. On touch the first tap aims (ghost + **CONFIRM** in the banner) and a second
  tap or CONFIRM builds, because a pad building costs thousands. Pad buildings' ghost is the GLB (or the bay block)
  in the battle ghost's cyan / red with an inverted-hull rim; defenses use the battle renderer's own outline ghost and
  range ring (`renderFrame`'s `ui`). Every build is `session.act({ type: 'place' })` (advance, `model.place`, the gold,
  `settleOutpost`); a pad building returns to the list and opens its panel, a defense stays armed for the next one.
  The harvester is bought straight from the list (`session.act({ type: 'buyHarvester' })` → `model.buyHarvester`).
  An empty pad's panel lists what fits; each entry arms the menu on that pad. Upgrade, repair and deep stay on the
  building panel; SELL and REPAIR stay on the action row; the GO ONLINE card steps aside while placing.
- **Guidance.** Until the outpost is online the first missing of Power Station → Mining Station → Storage Tower pulses
  with the battle's hint glow and a nudging arrow (`guideStep`).
- **Warnings** (`view/warnings.js`): `model.warnings(o, map)` (O16), with a fallback derived from `powerGrids().off`
  and the bays. A screen-sized marker floats over each building with one (a bolt for no power, a full crate for storage
  full), the building panel lists the reasons, and an unpowered Storage Tower gets a shutter over its door anchor
  (the GLB has no door node) and the status "No power: door shut".
- **Layout.** The rail runs from under the top bar to the bottom (portrait: to the SELL row) on every layout, one column
  of ~64 px buttons on a portrait phone and a desktop, two columns on a landscape phone, as the battle's rail does.
  `layout.js` leaves it clear when framing (left inset 144 landscape, 100 desktop); on a portrait phone the capped
  camera cannot, so there the rail floats over the mesa's western edge, as the battle's floats over its board.
- **Review.** `tools/outpost/view.html` `?state=fresh` now opens the contract's hub-only start (build it up from the
  list); the running presets start from `referenceOutpost`. `handle.pick / aim / hoverAt / confirm / cancel` drive
  the menu for screenshots. Tests: `view/buildMenu.test.mjs` (items, prices, locks, targets, guidance, the placement
  reducer for mouse and touch, the warnings).

### 6.2 Building models

New GLB models through the capital ship pipeline: built in headless Blender, three LODs, loaded with `prepareShip`.

| Model | Notes | Triangles, LOD0 / LOD2 |
|---|---|---|
| `hub` | octagonal landing pad, two ramps, cargo pods on the deck, the parked shuttle (separate node) | 12k / 2k |
| `power` | Power Station I: round drum with an open top over the glowing core, a central tower on a glass sleeve, four ramps (owner's 4-view sheet) | 8k / 1.5k |
| `power_ii` | Power Station II: the energy reactor, a core column through a ring of capsule cells with a light beam (owner's revised concept) | 9k / 2k |
| `rig_auger`, `rig_laser`, `rig_brine`, `rig_crystal`, `rig_bore`, `rig_shielded` | the six rig buildings, one per extraction method (design §8.4), each with its animated nodes (augers and ore chute, beam emitter, pump arm, resonator arms, tilted drill column, canister arms) | 6–8k / 1–1.5k each |
| `storage` | block with dish and antennas, a glass deck over the hologram (separate node: the fill bar) | 9k / 1.5k |
| `resourceBay` (was `harvesterBay`) | garage with two bays, door open | 7k / 1.2k |
| `upgradeBay` | hangar pad with two control towers and a small craft (separate node) | 10k / 1.8k |
| `shuttle` | the small craft the hub launches on SELL (Cargo Shuttle II is a larger variant) | 3k / 0.6k |
| tier II variants | storage: the same base with added modules (extra tank); the power station's tier II is `power_ii` | +30 % |

**Rig Mk II is not a separate model** (owner, design §8.4). It is the same rig building with three runtime changes:
the `trim` and `glow_*` materials switch to the Mk II highlight colour (hot amber); the rig's animation clips play
at 2× with larger amplitudes (a `power` parameter on each rig's animator, 1 for Mk I and 2 for Mk II); and the
deposit's debris emitter runs at about 3× its particle rate with larger chunks. No new GLB is needed for Mk II.

- **Material contract.** Matches the concept image: light grey and white panels, dark grey chamfered bases, orange
  trim, cyan emissive. The trim is its own material slot (`trim`), so each faction's colour can be set at load time
  (design §8.2). Emissive slots are named `glow_*` so the existing bloom and `isGlowKey` pick them up.
- **Scale.** One pad is 4 × 4 battle cells. The hub's landing pad is 6 × 6. The parked shuttle reads at about the
  size of a battle aircraft.
- **States.** Building (rises in steps with a cool tint, as towers do today), online, unpowered (emissive off),
  damaged defenses (darkened, sparking, by their HP), upgrading (warm tint). These follow `lifecycleLook` in `render3d/structures/models.js`.
- **Animation clips (built, O5).** Moving parts are baked into the GLB as looping glTF clips, one per node, named
  after the node (`auger_l`, `auger_r`, `ore`, `radar`, `pump`, `dish`). Each node's meshes hang under a pivot empty
  (extras `node`, `pivot: true`) so the clip turns them about the right point; find nodes by the `node` extra, not
  by name (lower LODs carry a `.001` suffix). The game plays every clip on a three.js `AnimationMixer`, looping
  while the building works (a rig: while extracting) and stopped when idle or unpowered; Mk II sets `timeScale = 2`.
  Values set by game state (the storage hologram's fill, the brine level, the core pulse, the shuttle's take-off) are
  driven in code, not clips. `--anim` on any building script renders `<slug>_anim.gif` for review.
- **Animated nodes:** the reactor pulse, each rig's working motion (on while extracting, aimed at the deposit,
  tinted with the ore's `Colour`), the storage hologram (its height is the fill), the shuttle (take-off arc on SELL),
  and harvesters and ore carts.
- **Which head:** the `Ores` sheet gains a `Rig_Head` column (auger, laser, brine, crystal, bore, shielded), filled
  from the design's §8.4 table. Validation refuses a planet whose three ores share a head.

### 6.3 Conduits

The glowing double lines are generated, not modelled: a path from each station to every powered pad within its reach,
and between stations of the same grid (design §4.5), routed along the pad graph the map declares (§6.6). A station's
reach is drawn as a faint ring when the player is placing a building. Each is drawn as two thin emissive tubes with a light pulse running toward the
building, and goes dark when the building is unpowered. One merged mesh per state, so all conduits cost two draw
calls.

### 6.4 Ore deposits

A deposit is drawn with the existing resource models (`render3d/resources/models.js`), with a new `ore` kind: a rocky
outcrop with a crystalline core in the ore's `Colour`, at three sizes. With a rig on it, the outcrop shows a cut
face. A locked tier is drawn dim, with a lock marker.

### 6.5 Effects

The **sale** is the outpost's signature moment and must feel like a harvester's delivery in battle (design §4.3).
It is a timeline driven by `sell`'s per-load entries, built from the battle's own pieces:

| Time | Beat | Built from |
|---|---|---|
| 0.0 s | the storage hologram drains; crates (instanced boxes in the ore colour) ride the conduit to the pad | the hologram node; `unloadFx.js`'s glint stream |
| 0.6 s | the shuttle's engines light; it lifts with a camera shake | `createEngineFx`; the battle camera shake |
| 0.8 s | **ore splatter**: a burst of ore chunks from the cargo bay, bouncing on the pad | the world-impact particles, with ore-chunk sprites in the ore colour |
| 0.9 s | **"$N" pops** per load, staggered 0.12 s, stacking upward in the ore colour | `overlays/goldPopups.js` (`deposit`-style events) |
| 1.4–3.0 s | the shuttle arcs up and out of frame; the HUD gold counts up | a spline; the HUD counter |

Reduced motion: the pops and the count-up stay, and the shuttle and the splatter are skipped.

The other effects also reuse the battle's FX system (`render3d/fx`):

- the shuttle's engine glow (`createEngineFx`);
- **mining debris** at each working deposit: rock chips, dust and ore chunks in the ore's colour, from the
  world-impact particles; about 3× the rate and larger chunks under a Mk II rig;
- raid fire, explosions and wrecks, from the battle;
- on a breach, the storage tower's hologram drops by the lost quarter, with a burst of scattered ore.

### 6.6 The outpost maps

- **Forge format.** Each outpost map is a Terrain Forge map (`content/maps/forge/<faction>-outpost.json`) with three
  new top-level fields the Forge writes and the loader reads:
  - `pads: [{ id, x, y, w, h, role, remote }]`, where `role` is `hub`, `power`, `rig`, `storage`, `bay` or `spare`,
    and `remote` marks the pads at the remote rare site (a rig pad and a power pad);
  - `deposits: [{ tier, x, y, pad }]`;
  - `conduits: [[padA, padB], …]`, the pad graph for §6.3.

  Raid lanes use the existing `spawns`. The defense ring uses the existing buildable cells.
- **Forge support.** A pad tool and a deposit tool in `terrain.html`. Its existing validator gains three checks: the
  pads do not overlap and sit on flat buildable ground; every pad is reachable from the hub through the conduit
  graph; there is one deposit of each tier; the rare deposit is outside the first station's reach and has a power pad
within reach of its rig pad.
- **Size.** About 40 × 24 cells, measured to frame the mesa on a 390 × 844 portrait phone at the default zoom.
  *(Superseded 2026-11-07: the large maps' 64 × 32, with the view framing the mesa; see As built.)*
- **Recipe.** The Forge recipe for each planet (Faction-Terrain-Design §2.3), with a central raised mesa and one of
  the planet's signature props. Verdance is first.

**As built (O4):** `content/maps/forge/ground-outpost.json` (named by planet key, `<planet>-outpost.json`) is made
exactly like the large tower-defense maps (**owner direction 2026-11-07**: "the outpost maps must be created identically
to the large tower-defense maps", which replaces the ~40 × 24 size above): a **64 × 32** world-mode Forge map on
Verdance's §2.3 recipe (the `powder` slug's), **seed 313**, with Powder map 1's base, wave windows and spawn tuning,
the Forge's full decor groves (145) and resource fields (54), inside the §1 fairness guardrails (19.7 % impassable,
both lanes reach the base, a second route for each, no sealed pockets; ~9 farm ponds, Verdance's signature), exported
by the real headless Forge (`forge-export.py`) and baked to `content/maps/baked/ground-outpost/` (`bake3d.mjs
ground-outpost --no-tiles`). **The mesa is part of the forge terrain**, not an overlay: `stampOutpost` writes a
rock-border stone top, a cliff rim and dirt ramps into `terrain` after generation (the recipe knobs still work), so
the terrain bake raises it and the battle renderer draws the rim as stone ridges round a stone plateau; `heights`
records the same shape as numbers for framing. The hub is centred on the large maps' base (31, 15), so the raid sim
marches on it; the mesa (21 × 19) carries the hub and seven pads (`p1`, `r1`, `s1`, `r2`, `b1`, `b2`, `x1`, the draft
layout's ids) within Power Station I's reach of 10, 1-cell walkways between them; iron on `r1` and aluminum on `r2` at
the mesa edge; lithium remote in the west lowland on `r3` with its station pad `p2`; two raid lanes (west and east map
edges, worn into cart tracks) up two ramps; the kit's cannon, MG and six walls at the ramp heads; decor and resources
stay off the mesa, ramps, tracks and clearings. `src/terrain/outpostPads.js` holds the outpost layer (`stampOutpost`,
`deriveConduits`, `defenseRing`, `mesaFrame`, `validateOutpostLayout`). The validator checks pad roles, ids, bounds and
overlap; one hub, on the mesa and under the map's base; a first station on the mesa; every pad on open, flat ground,
mesa pads on the mesa top; every mesa pad within the first station's reach; conduits naming real pads, with a power
end, within reach; every mesa pad reachable from the hub through the conduits and every remote pad linked to a power
pad; exactly one deposit per tier, each inside a rig pad, common and uncommon within the first station's reach; the
rare pad outside it with another power pad in reach; kit defenses on buildable cells off the pads, powered ones in
reach; and at least two ground lanes, each walking to the hub around the other pads. Deviations: **conduits are
derived from reach by default** (each pad to its nearest station in reach, stations in reach of each other; this
reproduces the draft layout's hand list), and the Forge's *derive from reach* box turns that off for hand editing;
remote pads need a power pad, not the hub, at the end of their conduits, since a remote station is its own grid
(design §4.5); the map adds `mesa`, `heights` and `kitDefenses` beside the three fields above; the guardrails' second
route is checked per lane (each lane as its own wave), since the outpost has one raid wave. The Forge's outpost panel
(`terrain.html`) places, moves and deletes pads (role, remote), deposits (tier), conduits, ramps, lanes and kit
defenses, shows the validator's problems live, and exports or ships `<planet>-outpost.json`; `?outpost=ground` opens
the map. `tools/maps/outpost-maps.mjs` holds the authored layout, the seed search and the checks;
`tools/maps/outpost-maps.test.mjs` keeps the file on its recipe, in the guardrails, equal to the node generator and in
step with its bake, like `faction-maps.test.mjs`. `src/outpost/outpostMap.js` `outpostMapFor(planet)` loads it for the
model and views, falling back to `DRAFT_LAYOUT`. **Framing:** the views frame the mesa, not the 64 × 32 map — on a
390 × 844 phone the 23 × 21-cell mesa frame fills the width at about 17 px a cell (a 4 × 4 pad is about 68 px), using
about 360 px of height; the 3D terrain review (`tools/terrain/index.html?faction=powder&map=outpost`) fits the battle
camera to the same frame.

### 6.7 Review page

`tools/outpost/index.html` is the review page, built and screenshotted first, before the menu wiring, so it can be
reviewed outside Claude:

- the outpost view on any planet's map (once it exists);
- a save state picker: fresh kit, running, full storage, a raid due, breached;
- a time slider that runs `advance`;
- each building model on a turntable;
- a live-raid button.

**As built (O2):** `prototype/test-game/tools/outpost/index.html` draws the draft layout on a canvas with the five
save presets (or `?state=`), time buttons from +5 min to +3 days, a raid stand-in (wear, breach or off), SELL and far
sell, Go online, build / upgrade / deep / repair on the selected pad or defense, defense placement, unlock switches,
and the away report. The map view, turntables and live raid wait on O4–O7. **O4:** it runs on the Verdance outpost
map (terrain, mesa and raid lanes drawn under the pads; the defense ring shown while placing), with a Mesa / Whole map
view that defaults to the mesa; `?map=draft` keeps the draft layout.

## 7. The menu and replay

- **`menu.js`:** the `REPLAY LAST BATTLE` button becomes `OUTPOST`.
  - Locked until a contract is accepted.
  - Its status line and red dot come from `loadsReady`, the storage-full flag, worn defenses, and the last raid. These are
    computed by advancing a copy of the outpost to now, without saving.
  - It opens the outpost view for the targeted planet, or the most recent outpost.
- **Replays per battle:** `main.js` stores each played battle's serialized replay in `localStorage
  'bulwark:replays'`, a map keyed by the battle log entry's `at` timestamp (entries have no other id), keeping the most recent `Replay_Keep` (20) and
  dropping the oldest. `bulwark:lastReplay` is migrated into it once.
- **History:** `battleHistory.js` cards get a REPLAY button when the card's `at` has a stored replay. It closes the
  menu and calls `startReplay(log)`, the same path the old button used.

**As built (O8):**

- `src/menu/outpostButton.js` (`outpostButtonModel(save, target, now)`, 4 tests) gives the button its locked state,
  status line and dot. The copy advances without a raid hook, so raids that came while away are counted
  ("5 raids while away") rather than fought; the outpost view fights them (O7). Until the view exists (O5) the
  unlocked button only flashes a message.
- `src/save/replays.js` (6 tests) stores replays compact (`serializeLog` pretty-prints; compact is about half).
  **Measured size:** about 0.15 KB per command, so a 100-command battle is about 15 KB and 20 of them about 0.3 MB.
  `Replay_Keep` stays at 20, and a 1 MB budget drops the oldest replays when long battles would pass it. A storage
  quota error also drops the oldest rather than failing.
- The battle log entry and its stored replay share one `at`, taken when the battle ends.

## 8. Stories

| # | Story | Phase |
|---|---|---|
| O1 | Data: the five workbook sheets, extraction and validation, `ores.js` / `outpost.js`, `outpost_model.mjs` | A |
| O2 | The outpost model: `advance`, sales, building, power grids with reach, the raid schedule, tests | A |
| O3 | Contract 1: the grant aboard the ship, mission rows, the new gates, the kit, the captain's lines (Verdance) | A |
| O4 | The Verdance outpost map, with the Forge's pad, deposit and conduit support and validation | A |
| O5 | Models: hub, Power Station I and II, storage tower, shuttle, and Verdance's three rigs (Auger Drill, Laser Cutter, Brine Pump); LODs, trim slot, states, the Mk II highlight and 2× animation | A |
| O6 | The outpost view: scene, camera, conduits, deposits, effects, HUD, the SELL sequence (shuttle, ore splatter, "$N" pops), build and repair, away report, phone layouts | A |
| O7 | Raids on the battle sim: `runRaid` (headless and live), the raid sizes measured per planet, the live raid view | A |
| O8 | Menu: OUTPOST replaces REPLAY LAST BATTLE; replays stored per battle; REPLAY on history cards | A |
| O9 | Review page `tools/outpost/index.html` (built first, extended with each story) | A |
| O10 | Resource Bay (was Harvester Bay), harvesters' behaviour, and Upgrade Bay: models, behaviour, the Outpost tech nodes replacing the ghosts | B |
| O11 | Outpost maps for the other eight planets, the remaining rigs (Crystal Harvester, Deep Bore, Shielded Extractor), and the captains' outpost lines | B |
| O12 | Ore icons (27) and deposit colours, with the resource icon pipeline | B |
| O13 | Contracts 2 and 3: deep drilling in play, Rig Mk II, Cargo Shuttle II (+10 % sales) | B |
| O14 | The far buyer (design §8.5): `Wanted_By`, the discovery line, the second buyer on SELL, loyalty cost, raid +1 unit that day | B |
| O15 | Habitat (owner, 2026-11-07): the hub crews 3 guns, each Habitat tier adds 2 (design §6); model, cap in `place`, tests | B |
| O16 | Build-it-yourself start (owner, 2026-11-07): the contract grants only the hub; power, rig, storage, Resource Bay, harvesters and defenses bought; prices; storage and power rules and warnings; contract text | A |
| O17 | The build menu: the icon list with prices on the left of the outpost view, like the battle's (owner, 2026-11-07) | A |

O9 starts with O2 so every later story is reviewable outside Claude as it lands. O5 runs alongside O1–O4.

## 9. Risks

- **Time-based play and clock cheats.** Handled by the guards in §4.1. Storage caps the gain from any clock trick
  at the value of one full storage per planet, which is small next to the tech tree.
- **localStorage size.** 20 replays plus outposts must stay well under the browser quota. O8 measures a replay's
  serialized size and lowers `Replay_Keep` if 20 would pass 1 MB. *Measured (O8): about 0.3 MB for 20 typical
  battles; a 1 MB budget in `replays.js` drops the oldest when long battles would pass it.*
- **Catch-up cost.** 72 hours away is at most 24 raids, each a short headless sim of a few light units. O2 measures
  the catch-up time on a phone-class CPU and caps it under 200 ms, or spreads it across frames behind the away report.
  *Measured (O7, node on the dev container, Verdance, the measured raids, the reference set, no repairs): 72 h away is
  10–24 raids and takes 117–177 ms warm, about 450 ms on the first open (the one-time terrain bake and JIT warm-up); a
  raid is 7–28 ms. The first open is over the 200 ms budget, so the view advances one raid window per frame behind the
  away report (O6, as built). The stall rule (10 s with nothing happening) keeps a raid that cannot finish from
  running the full 300 s.*
- **Model budget.** Six buildings plus the map must hold the battle view's frame time on the low tier. O6 measures
  frame time on the review page's low tier with the full kit and a live raid.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/16 Bulwark MM/design/Outpost-Design.md | every rule, number and look this plan builds |
| depends-on | docs/tech-plan/Content-Reveal.md | the first visit aboard, where the contract is granted |
| depends-on | docs/tech-plan/Mission-Log.md | missions, gates and the Economy sheet |
| depends-on | docs/tech-plan/Capital-Ship-Interior.md | the boarding sequence and room view used by the grant |
| depends-on | docs/16 Bulwark MM/design/Tech-Tree-Design.md | the Outpost division the nodes go in |
| depends-on | docs/16 Bulwark MM/design/Landing-Craft-and-Resources-Design.md | the resource model kinds the ore deposits extend |

Each planet's Forge recipe, palette and signature prop come from `docs/16 Bulwark MM/design/Faction-Terrain-Design.md`
(mirrored in MetaMax as *Faction Terrain Design: the nine battlefield planets*).
