# Tech Plan — Outposts and mining: data and visualization

Status: owner decisions applied (design §11) · 2026-11-06 · Epic *Outposts and mining* (initiative *Bulwark advanced mode*, L3)
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
map, the starter-kit models, the outpost view, live raids and the menu. Phase B adds the other eight maps, the
Harvester Bay and Upgrade Bay models and behaviour, contracts 2–3 and the Outpost tech nodes.

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

Four new sheets in `docs/sources/Bulwark-Map-Data.xlsx`, with the same "hand-edit, then extract" flow as
`Rare_Contracts`:

| Sheet | Rows | Columns |
|---|---|---|
| `Ores` | 27 (9 planets × 3 tiers) | `Planet_Key, Planet, Tier, Ore, Ore_Id, Rate_Per_Min, Price, Deep_Rate_Mult, Deep_Price_Mult, Colour, Rig_Head, Use` |
| `Outpost_Structures` | ~12 (each building × tier) | `Kind, Tier, Cost, Build_Sec, Power_Draw, Power_Supply, Capacity, Rate_Mult, Defense_Power, Model, Unlock` |
| `Outpost_Contracts` | 27 (9 planets × 3) | `Planet_Key, Step, Title, Ore_Tier, Deliver, Raids_Held, Gold, Loyalty, XP, Unlocks` |
| `Outpost_Params` | ~12 named values | `Load_Sec 300, Store_Hours 4, Deep_Price_Mult 5, Raid_Mean_Hours 6, Raid_Min_Gap_Hours 3, Raid_Wear 0.07, Raid_Strength 0.55, Breach_Storage_Loss 0.25, First_Raid_Sec 600, Away_Cap_Hours 72, Replay_Keep 20` |

`tools/extract_mapdata.py` extracts them to `MAPDATA.ores`, `.outpostStructures`, `.outpostContracts` and
`.outpostParams`. Its validation refuses a planet without exactly three ores, a duplicate `Ore_Id`, a structure kind
the code does not know, and a contract that delivers an ore tier the planet has not unlocked by then.

The design's numbers (Outpost-Design §3–§7) are the first values. `tools/economy/outpost_model.mjs` prints the
derived table: gold per hour per tier, fill times, raids held per defense rating. The design's tables come from it,
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
    pads: { hub: { kind:'hub', tier:1 }, p1: { kind:'power', tier:1 }, p2: { kind:'rig', tier:1, deposit:'common', deep:false },
            p3: { kind:'storage', tier:1 }, … },
    building: [{ pad:'p4', kind:'harvesterBay', tier:1, done: 1762470300000 }],
    defenses: [{ id:'d1', type:'machineGun', tier:1, cell:[12,7], integrity:1 }],
    storage: { iron: 412.6 },     // fractional units, shown floored
    raids: { window: 412, log: [{ at, result:'held'|'breach', wear }] },   // log keeps the last 20
    sold: { iron: 300 },          // lifetime, for contract steps
  },
};
s.outpostContracts = { ground: { step: 1, state: 'active', delivered: 0, raidsHeld: 0 } };
```

`migrate()` adds empty `outposts` and `outpostContracts`. Nothing is stored that can be derived (gold per hour, power
used, loads ready).

## 4. The outpost model (`src/outpost/model.js`)

All outpost rules live in one pure module, so the menu, the outpost view, the away report and the tests read the same
answers.

```js
advance(outpost, toMs, { params, ores, structures })  → { outpost, report }
loadsReady(outpost)                                   → n
sell(outpost)                                         → { outpost, loads: [{ ore, units, gold }], gold }   // one entry per load, for the pops
place(outpost, pad, kind) / repair(outpost, id) / setDeep(outpost, pad, on)   → outpost (or a refusal reason)
raidSchedule(seed, fromWindow, toWindow, params)      → [{ window, at }]
defenseRating(outpost) / raidOutcome(outpost, raid)   → { result, wear }
```

### 4.1 Advancing through time, in closed form

`advance` never steps second by second. It cuts the interval `[t, toMs]` at every event: a build finishing, a raid,
or storage filling. Nothing is ever sold inside `advance`: selling is always the player's tap (design §4.3). Between two events every rate is
constant, so extraction is `rate × Δt`, capped by the space left in storage. Three days away is a few dozen segments.

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

- **Away:** `raidOutcome` applies the rating rule (design §5.2): the defenses wear and, on a breach, storage loses
  `Breach_Storage_Loss` (25 %) of each ore. No building goes down.
- **First raid:** contract step 3's raid is not drawn. It is fixed `First_Raid_Sec` after the outpost comes online.

### 4.3 A live raid (outpost view open)

When a raid comes due while the view is open, the view runs it with the battle simulation:

- `createSim` on the outpost map, with only the defenses, walls and buildings as structures. The buildings are
  structures with HP and no weapon.
- One small wave of the planet faction's units, from `Outpost_Params` (count and tier by contract step), along the
  map's raid lanes.
- The sim's own seeded RNG, seeded with `seed + window`, so it obeys the determinism contract like any battle.
- When the wave is over: defenses that took damage lose integrity in proportion to the damage; if any raider reached
  the mesa, the raid is a breach and storage loses its 25 %; the result is logged like an away raid.

Live and away raids must agree on average. `outpost_model.mjs` runs a few hundred simulated raids per defense set and
checks that the away rule's breach rate matches the simulation's within 10 %. A gap is closed by tuning
`Raid_Strength`, not by changing the live raid.

### 4.4 Tests (`src/outpost/model.test.mjs`)

- 4 hours on the starter kit fills 720 iron; 5 minutes is a 15-unit load; deep fills in 16 hours.
- Advancing once over 10 hours equals advancing 600 times one minute at a time, within 1e-9 (the closed form is
  exact).
- A clock that goes back advances nothing. A 10-day gap is capped at 72 hours.
- The raid schedule for a seed is the same whether it is resolved in one call or in many.
- The starter kit holds 5 raids before a breach; a 1.0 rating holds 8 (design §5.2).
- Power: a building over budget is reported, and stays off.
- Building, repairing and selling refuse when the player cannot pay, or the pad is wrong, taken or unpowered.
- A breach removes exactly 25 % of each ore in storage and changes no building.
- `advance` never sells, whatever the tier of the shuttle; `sell` returns one entry per full load.

## 5. The contract and the missions

### 5.1 Granting it

`shipReveal.aboard()` already presents the ship's missions on the first visit. It gains one step before the
missions: if `outpostContractFor(planet, 1)` exists and the player has none for this planet, the captain's outpost
lines (§5.3) play, then the contract card. The card uses `showContractModal` with `kicker`, `task` and `terms` (the
fields added in Content-Reveal F4).

- **ACCEPT:** writes `outpostContracts[planet] = { step:1, state:'active' }`, creates the outpost with the kit placed
  on its default pads (`online: false` until the player confirms it in the view, design §2.3 step 1), and sets a menu
  badge.
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
  - top bar: gold, each ore in storage with its icon, the storage fill bar, power used / supplied, and the defense
    rating as a shield with its integrity;
  - bottom: **SELL** (with the number of loads), **BUILD** (pads and defenses), **REPAIR** when the defenses are worn;
  - the selected building's panel: status, tier, rate, the deep / shallow switch on a rig, and upgrade.
- **The away report.** On open, when anything happened since the last visit, a modal in the results-screen style
  (`render/resultsScreen.js`) lists extraction per ore, each raid with its result (and the ore lost on a breach), and
  the defenses' wear. Its rows are the `report` that `advance` returns.
- **Phone.** Portrait and landscape layouts, like the battle HUD. The mesa must frame in portrait: this sets the
  outpost maps' size (§6.6).
- **Performance.** The battle's quality tiers apply. The outpost view stops the menu stage while open, as the reveals
  do.

### 6.2 Building models

New GLB models through the capital ship pipeline: built in headless Blender, three LODs, loaded with `prepareShip`.

| Model | Notes | Triangles, LOD0 / LOD2 |
|---|---|---|
| `hub` | octagonal landing pad, two ramps, cargo pods on the deck, the parked shuttle (separate node) | 12k / 2k |
| `power` | round station with an open top and a glowing core (emissive, pulses) | 8k / 1.5k |
| `rig_base` | the pad footing, power socket and ore-cart track every rig shares | 3k / 0.5k |
| `rig_head_auger`, `_laser`, `_brine`, `_crystal`, `_bore`, `_shielded` | the six extraction heads (design §8.4), each with its animated nodes (screw, beam emitter, pump arm, resonator arms, core barrel, canister arms) | 6–8k / 1–1.2k each |
| `storage` | block with dish and antennas, a glass deck over the hologram (separate node: the fill bar) | 9k / 1.5k |
| `harvesterBay` | garage with two bays, door open | 7k / 1.2k |
| `upgradeBay` | hangar pad with two control towers and a small craft (separate node) | 10k / 1.8k |
| `shuttle` | the small craft the hub launches on SELL (Cargo Shuttle II is a larger variant) | 3k / 0.6k |
| tier II variants | power station and storage: the same base with added modules (larger core, extra tank) | +30 % |

**Rig Mk II is not a separate model** (owner, design §8.4). It is the same base and head with three runtime changes:
the `trim` and `glow_*` materials switch to the Mk II highlight colour (hot amber); the head's animation clips play
at 2× with larger amplitudes (a `power` parameter on each head's animator, 1 for Mk I and 2 for Mk II); and the
deposit's debris emitter runs at about 3× its particle rate with larger chunks. No new GLB is needed for Mk II.

- **Material contract.** Matches the concept image: light grey and white panels, dark grey chamfered bases, orange
  trim, cyan emissive. The trim is its own material slot (`trim`), so each faction's colour can be set at load time
  (design §8.2). Emissive slots are named `glow_*` so the existing bloom and `isGlowKey` pick them up.
- **Scale.** One pad is 4 × 4 battle cells. The hub's landing pad is 6 × 6. The parked shuttle reads at about the
  size of a battle aircraft.
- **States.** Building (rises in steps with a cool tint, as towers do today), online, unpowered (emissive off),
  worn defenses (darkened, sparking), upgrading (warm tint). These follow `lifecycleLook` in `render3d/structures/models.js`.
- **Animated nodes:** the reactor pulse, each rig head's working motion (on while extracting, aimed at the deposit,
  tinted with the ore's `Colour`), the storage hologram (its height is the fill), the shuttle (take-off arc on SELL),
  and harvesters and ore carts.
- **Which head:** the `Ores` sheet gains a `Rig_Head` column (auger, laser, brine, crystal, bore, shielded), filled
  from the design's §8.4 table. Validation refuses a planet whose three ores share a head.

### 6.3 Conduits

The glowing double lines are generated, not modelled: a path from the power station to each powered pad along the
pad graph the map declares (§6.6). Each is drawn as two thin emissive tubes with a light pulse running toward the
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
  - `pads: [{ id, x, y, w, h, role }]`, where `role` is `hub`, `power`, `rig`, `storage`, `bay` or `spare`;
  - `deposits: [{ tier, x, y, pad }]`;
  - `conduits: [[padA, padB], …]`, the pad graph for §6.3.

  Raid lanes use the existing `spawns`. The defense ring uses the existing buildable cells.
- **Forge support.** A pad tool and a deposit tool in `terrain.html`. Its existing validator gains three checks: the
  pads do not overlap and sit on flat buildable ground; every pad is reachable from the hub through the conduit
  graph; there is one deposit of each tier.
- **Size.** About 40 × 24 cells, measured to frame the mesa on a 390 × 844 portrait phone at the default zoom.
- **Recipe.** The Forge recipe for each planet (Faction-Terrain-Design §2.3), with a central raised mesa and one of
  the planet's signature props. Verdance is first.

### 6.7 Review page

`tools/outpost/index.html` is the review page, built and screenshotted first, before the menu wiring, so it can be
reviewed outside Claude:

- the outpost view on any planet's map (once it exists);
- a save state picker: fresh kit, running, full storage, a raid due, breached;
- a time slider that runs `advance`;
- each building model on a turntable;
- a live-raid button.

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

## 8. Stories

| # | Story | Phase |
|---|---|---|
| O1 | Data: the four workbook sheets, extraction and validation, `ores.js` / `outpost.js`, `outpost_model.mjs` | A |
| O2 | The outpost model: `advance`, sales, building, power, the raid schedule, the away raid rule, tests | A |
| O3 | Contract 1: the grant aboard the ship, mission rows, the new gates, the kit, the captain's lines (Verdance) | A |
| O4 | The Verdance outpost map, with the Forge's pad, deposit and conduit support and validation | A |
| O5 | Models: hub, power station, storage tower, shuttle, the rig base and Verdance's three rig heads (Auger Drill, Laser Cutter, Brine Pump); LODs, trim slot, states, the Mk II highlight and 2× animation | A |
| O6 | The outpost view: scene, camera, conduits, deposits, effects, HUD, the SELL sequence (shuttle, ore splatter, "$N" pops), build and repair, away report, phone layouts | A |
| O7 | Live raids with the battle sim on the outpost map, and the away rule calibrated against them | A |
| O8 | Menu: OUTPOST replaces REPLAY LAST BATTLE; replays stored per battle; REPLAY on history cards | A |
| O9 | Review page `tools/outpost/index.html` (built first, extended with each story) | A |
| O10 | Harvester Bay and Upgrade Bay: models, behaviour, the Outpost tech nodes replacing the ghosts | B |
| O11 | Outpost maps for the other eight planets, the remaining rig heads (Crystal Harvester, Deep Bore, Shielded Extractor), and the captains' outpost lines | B |
| O12 | Ore icons (27) and deposit colours, with the resource icon pipeline | B |
| O13 | Contracts 2 and 3: deep drilling in play, Rig Mk II, Cargo Shuttle II (+10 % sales) | B |

O9 starts with O2 so every later story is reviewable outside Claude as it lands. O5 runs alongside O1–O4.

## 9. Risks

- **Time-based play and clock cheats.** Handled by the guards in §4.1. Storage caps the gain from any clock trick
  at the value of one full storage per planet, which is small next to the tech tree.
- **localStorage size.** 20 replays plus outposts must stay well under the browser quota. O8 measures a replay's
  serialized size and lowers `Replay_Keep` if 20 would pass 1 MB.
- **Live and away raids disagreeing.** Handled by the calibration run in §4.3, which is part of O7's definition of
  done.
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
