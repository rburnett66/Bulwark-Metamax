# Tech Plan — The Collective as a faction (no planet) and its resource contracts

**Epic:** `epic_mvo5po8u_4` The Collective trade faction.
**Status:** v0.3, 2026-11-05. Q1 and Q7 decided by the owner. C1 and C2 built on branch `feat/collective-contracts` (PR #165, not merged). Notes and as-built justifications for this epic go here, not on the tickets.

**Companion plans:**
- `Collective-Opening.md`: the first contract is handed over in the opening.
- `Dialog-Response-Reputation.md`: standing levels, locks and replies.
- `Capital-Ship-Interior.md`: The Long Ledger hub, where contracts are reviewed.

> **owner** (2026-11-05): "The collective should be designed as another faction, without a playable planet. The player
> gains faction with the collective by completing resource contracts which exist for each planet and each map. The
> contracts are related to the collection of common and uncommon resources."

## 1. Reading

1. **A tenth faction.** It has an entry in the faction registry, a standing (Hostile … Honored), a cast of characters,
   a voice, and an outfit and helmet (the Collective service cap already exists in the crew rig). It has **no
   planet**: no maps, no campaign, no survey, never an enemy wave, not in the counter ring, no rival. Its home is a
   ship, The Long Ledger above Vesper (Collective-Opening).
2. **Standing comes from resource contracts.** There is one contract **per planet per map**: 9 planets × 9 maps = 81.
   Completing one raises your standing with the Collective. This answers Dialog-Response-Reputation Q2.
3. **The contracts cover common and uncommon resources only.** Rare and epic stay outside them. Rare resources belong to
   the **secondary contracts**, which make each map harder and give players a reason to go back and replay levels
   (owner 2026-11-05). They also feed loyalty with the combat factions through quest contracts.

## 2. What exists

| Piece | Where | As built |
|---|---|---|
| Faction registry | `src/data/factions.js` | Nine combat factions (ordinals 1–9) plus `system`. Each entry has `key, prefix, name, files, voice, ordinal`. |
| Collective contract (economy) | `src/data/collectiveContract.js` `contractFor(mapId)`; `src/sim/harvest.js` `initContract` / `creditDeposit` | A quota **per map only** (9 rows, the same on every planet), across **four tiers** (common / uncommon / rare / epic). A load pays gold until its tier's quota is sold; the surplus is kept (inventory). It earns **no standing**. |
| Quota source | Workbook `Bulwark-Map-Data.xlsx` › Maps (`Contract_Common/_Uncommon/_Rare/_Epic`) → `tools/extract_mapdata.py` → `content/maps/mapdata.js` | Starting values come from `tools/economy/contract_quota.mjs`. It already measures every planet and keeps the minimum per map. |
| Loyalty ledger | `src/save/contracts.js` `addLoyalty`; `s.loyalty`, `s.factionTiers` | Per faction, fed by **quest** contracts (rare / epic quest crystals) with rival effects. |
| Collective cast | Dossier artifact (`VFU7kuFB51N61M9YChgeb9`) | Nine officers by alignment, each favouring one combat faction; rows 1–5 owner-specified. Not in `voicepacks.json`. |
| Collective look | Crew rig (`Ship-Crew-Characters.md`) | `servicecap` helmet, orange outfit, gold stripe. |

## 3. Design

### 3.1 The Collective in the registry

```js
{ key: 'collective', prefix: 'COL', name: 'The Collective', files: [], voice: 'collective', ordinal: 10,
  planet: null, playable: false, combat: false }
```

- **`combat: false` is the guard.** The registry gains `COMBAT_FACTIONS` (the nine). Every caller that means "a faction
  you fight or play" switches to it: the faction picker, the counter ring, rivals, wave factions, the quest-contract
  giver, unit files and the menu planet rail. A test pins `COMBAT_FACTIONS.length === 9` and checks the Collective is
  excluded from each of those callers, so adding it changes no battle.
- **The workbook** Factions sheet gains row 10, "The Collective", with no planet and no rival, so the ordinal stays the
  join key.
- **Standing** uses the same ledger as everyone else: `s.loyalty['The Collective']`. Standing levels come from
  `standingOf` (Dialog-Response-Reputation §3.1). Combat-faction tech tiers are not used for the Collective; it has its
  own rewards (§3.5).

### 3.2 The cast

- The Dossier's nine officers become the `collective` voice pack, through the same source doc → `extract_dialog.py` →
  `voicepacks.json` path as the other factions. Each officer keeps an alignment, a motivation, a "favourite faction" and
  signature lines.
- Placeholder portraits come from the existing generator (`tools/dialog/placeholder_portraits.py`) until the art is
  done.

| Align | Officer | Role in the game |
|---|---|---|
| G | **Factor Mira Valcourt** | Gives the ship and the first contract (opening); your contract officer |
| CG | Supercargo Dorian Quell | Her boss; met when capital ships unlock; the Bar after the opening |
| PG | Fleet Superintendent Harlan Boerhaave | Transport upgrades |
| AG | Director Prudence Lund | Worries the wealth corrupts the staff |
| E | Director Caspian Roe | "Greed is good"; names productive recruits |
| N | Chief Ledger-Keeper Ovid Marlow | Contract records (Trade Station) |
| CE | Licensed Interloper Sabine Roux | Smuggler on a Company letter of marque |
| PE | Governor Isembard Croke | "A total trade order is a kind of peace." |
| DE | The Standing Charter | Faceless authority |

### 3.3 Contracts — one per planet per map, common and uncommon

- **Data.** A new workbook sheet, **`Collective_Contracts`** in `Bulwark-Map-Data.xlsx`, with one row per planet × map
  (81):

  | Column | Meaning |
  |---|---|
  | `Planet` | Homeworld name |
  | `Map_ID` | 1–9 |
  | `Common` | Units the Collective buys |
  | `Uncommon` | Units the Collective buys |
  | `Standing` | Collective standing for completing it |
  | `Gold_Bonus` | Optional completion bonus |

  `extract_mapdata.py` emits it as `MAPDATA.collectiveContracts`.
- **Starting values.** `tools/economy/contract_quota.mjs` already measures every planet. It writes the per-planet value
  instead of the minimum across planets:
  - **common**: what one harvester delivers from the richest common field in the map's par time;
  - **uncommon**: 80 % of what that planet's map seeds.
- **`contractFor(planet, mapId)` → `{ common, uncommon }`.** The current per-map signature stays as a fallback while the
  sheet is filled, then goes.
- **In battle** (`harvest.js`). The quota has only common and uncommon. Common and uncommon loads pay gold until their
  quota is sold, then the surplus is kept, as now.
- **Rare and epic are not bought by the Collective.** Today they sell up to a small quota (rare 0–40, epic 0–40 per map).
  Under this plan every rare and epic unit goes to the player's inventory and still counts toward quest objectives. This
  is a balance change: gold from rare and epic drops by that small quota. Measured at about −0.4 % of harvest gold and
  decided by the owner (Q1, Notes).
- **Completing a contract.** It is complete when **both** quotas are sold by the end of a battle that is won (Q2). The
  HUD's contract line shows `common sold / quota · uncommon sold / quota`, ticks each when met, and shows "Contract
  complete" when both are.

### 3.4 Standing from contracts

- **First completion of a planet × map contract.** The `Standing` value goes to `addLoyalty(s, 'The Collective', n)`.
  Proposed: 10 for maps 1–3, 15 for maps 4–6, 20 for maps 7–9, so a full planet is 135 and all 81 contracts are 1,215.
- **Repeats.** A replayed map pays the contract's gold again but gives **no** further standing, so standing reflects
  breadth of trade, not grinding one map (Q3).
- **Never negative.** A missed contract costs nothing beyond the lost sale. The Collective doesn't punish (Q4). Replies
  can still lower Collective standing (Dialog-Response-Reputation).
- **What that means against the standing thresholds** (Dialog-Response-Reputation Q1: Trusted 100, Honored 260):
  - **Trusted** comes around Verdance map 8. The first planet's contracts nearly reach it.
  - **Honored** comes around two planets' worth of contracts.
- **Saved** in `s.collective.contracts[planet][mapId] = { completedAt, battles }`.

### 3.5 What Collective standing does

Proposed; owner decision Q5. It follows the Dossier's ladder, where each officer gates something.

| Standing | Unlocks |
|---|---|
| Neutral (start) | Factor Valcourt; the first contract; Bar and Loading Bay in the hub |
| Trusted | Supercargo Quell at the Bar (the standing-choice conversation); Fleet Superintendent Boerhaave's transport upgrade |
| Honored | Directors Lund and Roe; Collective-only rooms on The Long Ledger (e.g. the Helm's missions); better sell prices for kept surplus |
| Wary / Hostile | Only reachable through replies; the Bar refuses new conversation lines until you are Neutral again |

Rooms gate through `unlock: {fac: 'collective', need}` in `ship-layout.json`, so this table becomes layout data plus a
few reward rows.

### 3.6 Where the player sees it

- **Before a battle:** the map card shows that planet × map's contract (common and uncommon quotas, standing on first
  completion, ✓ when already done).
- **In battle:** the HUD contract line (§3.3).
- **Results:** "Contract complete · +15 Collective standing", or what was missing.
- **The hub:** the Bar (Mira, then Quell) opens a **contract ledger**: a 9 × 9 grid of planets × maps with completed
  marks, standing earned, and the next threshold. This is the Bar's `contracts` purpose in Capital-Ship-Interior §5.4.
- **Standing strip:** the Collective appears beside the nine factions (Dialog-Response-Reputation R1).

## 4. Modules

| Module | Kind | Change |
|---|---|---|
| `src/data/factions.js` | edit | Collective entry (`combat: false`, `planet: null`); `COMBAT_FACTIONS`; callers switched. |
| Workbook + `tools/extract_mapdata.py` | edit | Factions row 10; the `Collective_Contracts` sheet (81 rows). |
| `tools/economy/contract_quota.mjs` | edit | Per-planet output for common and uncommon. |
| `src/data/collectiveContract.js` | edit | `contractFor(planet, mapId)` → `{common, uncommon}`. |
| `src/sim/harvest.js` | edit | Two-tier quota; rare and epic never sold under a contract. |
| `src/save/collective.js` | new | `judgeCollectiveContract(s, planet, mapId, contractState, won)` → `{complete, standing, firstTime}`; writes `s.collective.contracts` and the ledger. |
| `src/main.js`, results screen, HUD | edit | Contract line, result line, map-card contract. |
| Voice pack source doc + `extract_dialog.py` | edit | The `collective` pack (nine officers). |
| Hub (Capital-Ship-Interior) | edit | Contract ledger UI behind the Bar's `contracts` purpose. |

## 5. Tests

| Test | Checks |
|---|---|
| `data/factions.test.mjs` | The Collective exists with `combat: false` and no planet; `COMBAT_FACTIONS` is the nine; the picker, counter ring, rivals, wave factions and quest givers never return it. |
| `data/collectiveContract.test.mjs` | 81 contracts, every planet × map, common and uncommon only, all positive. |
| `sim/contract.test.mjs` (edit) | Common and uncommon sell to quota then keep; rare and epic always keep; a replay rebuilds the same contract. |
| `save/collective.test.mjs` | First completion adds standing; a repeat adds none; a loss or a missed quota adds none; never negative; the ledger records the planet × map. |
| Balance | `balanceSim.js` before/after the rare and epic change, reported in this plan's notes. |

## 6. Stories

| # | Story | Depends on |
|---|---|---|
| C1 | The Collective in the faction registry (no planet, non-combat) with `COMBAT_FACTIONS` guarding every combat caller | — |
| C2 | Contracts per planet × map on common and uncommon: workbook sheet, extractor, quota tool, `contractFor`, sim | C1 |
| C3 | Completing a contract raises Collective standing: judge, ledger, HUD line, results, map card | C2, Reputation R1 |
| C4 | The Collective cast: nine officers in the voice pack, placeholder portraits | C1 |
| C5 | The contract ledger in the hub Bar, and Collective standing rewards (officer ladder, room locks) | C3, Interiors I5 |

## 7. Open decisions (owner)

| # | Question | Proposal |
|---|---|---|
| Q1 | Rare and epic under contract today (small quotas): drop them so contracts are common and uncommon only? | **Decided by the owner (2026-11-05):** yes. Rare resources belong to the **secondary contracts**, which make each map harder and give players a reason to replay levels. Cost measured at −0.4 % of harvest gold (Notes). |
| Q2 | When is a contract complete? | Both quotas sold and the battle won |
| Q3 | Standing on repeats | First completion only |
| Q4 | Can a contract lower Collective standing? | No; only replies can |
| Q5 | What Collective standing unlocks | The officer ladder in §3.5 |
| Q6 | Standing per contract | 10 / 15 / 20 by map band (a planet = 135) |
| Q7 | Per-planet common quotas raise harvest gold about 7.5 % (Notes, C2 as built). Keep them, or hold each map's common quota at the old minimum over the nine planets? | **Decided by the owner (2026-11-05):** keep them. |

## 8. Notes

- **2026-11-05.** Plan written from the owner's direction. Collective standing now comes from resource contracts. This
  closes Dialog-Response-Reputation Q2, which proposed +10 per met quota.
- **2026-11-05, balance measurement (Q1).** Branch `research/collective-contract-balance`, commit `584ec1f`. Full report:
  `docs/reports/collective-contract-balance-2026-11-05.md`. New tool: `tools/economy/contract_balance.mjs`.
  - **Method.** The game's seeded sim on all 81 boards, with no enemies, run to each map's par time, with three
    commanders: starter, fleet and quest. `balanceSim.js` only prices units against towers, so it couldn't measure this.
  - **Result.** Taking rare and epic out of the contract removes about 0.4 % of all harvest gold (fleet −0.38 %, quest
    −0.40 %). The starter commander loses nothing, because the default harvester never reaches rare or epic. Maps 1 and 2
    lose the most, at most about 200 gold (map 1 −1.27 %; worst board Vexmire map 1 −1.43 %).
  - **Early game unaffected.** Nothing changes in waves 1–2, because no map has rare or epic before ring 3. No board
    falls below the 300 gold a tier-1 Cannon costs. Wave stars don't read gold, so they don't change. Quest objectives
    still count every rare and epic unit.
  - **Found 1: uncommon quotas are counted on the raw forge map.** The live board resets uncommon node sizes and clears
    the cells next to the base. On 56 of 81 boards the per-planet uncommon quota is larger than everything the board
    holds, so it could never fill. The current per-map workbook quotas share this flaw. The quota tool must count the
    live board, at 80 % of what it actually holds (the report's appendix lists these values), before
    `Collective_Contracts` is filled (C2).
  - **Found 2: mixed loads.** A part-loaded truck sent to a rare or epic field sells its whole load at the tier of its
    last crystal. With the change, its common units would be kept unpaid. C2 must credit each unit at its own tier
    (`harvest.js` `creditDeposit`).
- **2026-11-05, owner decision (Q1).**
  > **owner**: "the rare resources are part of the secondary contracts that make each map harder, and also give players
  > a reason to go back and replay levels"

  Collective contracts are common and uncommon only. Rare and epic stay with the secondary and quest contracts, so
  first-time Collective standing (Q3) and replayed secondaries pull in different directions: breadth across planets
  for the Collective, depth on each map for the secondaries.
- **2026-11-05, C1 as built** (`feat/collective-contracts`, `445af41`). Deviations from §3.1:
  - **The Collective sits beside `SYSTEM`, not inside `FACTIONS`.** `FACTIONS` already meant "the nine the player picks
    between", so no caller had to be switched to stay correct. `COMBAT_FACTIONS` is added as that list's name for
    combat callers, and the production callers that iterate it now read it (`fxlab.js`, `rivalOf`, `voice.js`). The
    Stack Forge, which lists `ALL`, keeps only factions with `combat !== false`.
  - **No workbook Factions row 10.** That sheet is each faction's harvester profile and rival; a Collective row would
    give it a harvester. The registry's ordinal 10 is enough for `factionOfOrdinal`.
  - Tests: `src/data/collectiveFaction.test.mjs`.
- **2026-11-05, C2 as built** (`c8e5edb`, `57e818e`, `ca0080f`).
  - **Per-tier crediting (Found 2).** `harvest.js` keeps `u.cargoMix` (units, value and role per colour) and
    `creditDeposit` credits each colour at its own tier, one `deposit` event per colour (blue, yellow, red, green). A
    single-colour load credits exactly as before.
  - **Live-board quotas (Found 1).** `contract_quota.mjs` builds the board as `main.js` does
    (`resolveResourceTypes` + `createSim`) and prints the 81-row CSV; a test checks no uncommon quota exceeds what its
    board holds. `tools/economy/write_collective_contracts.py` writes the `Collective_Contracts` sheet and recalculates
    the workbook with LibreOffice headless, refusing if any other sheet's values change.
  - **Sheet columns** add `Planet_Key` (the registry key the battle passes) beside `Planet` (the name). `Gold_Bonus` is 0
    everywhere for now.
  - **`contractFor(planet, mapId)` → `{common, uncommon}`** with no per-map fallback, since the sheet is full. The Maps
    sheet's `Contract_*` columns are no longer read; they can be deleted from the workbook.
  - **HUD.** A tier the Collective doesn't buy shows only what is kept (`● +12`), not a tick.
  - **Balance before/after** (`tools/economy/contract_compare.mjs`, run on `origin/main` and on the branch; live board,
    no enemies, to par time):

    | Commander | Harvest gold, main → branch | Change | Worst board | Best board |
    |---|---|---|---|---|
    | starter | 2,069,526 → 2,265,874 | +9.5 % | 0 % | Lumen map 4 +19.9 % |
    | fleet | 2,621,688 → 2,819,448 | +7.5 % | Rime map 1 −11.1 % | Xenthe map 8 +27.9 % |
    | quest | 2,618,455 → 2,812,550 | +7.4 % | Rime map 1 −11.1 % | Xenthe map 8 +23.5 % |

    By tier (fleet): common +245,207, uncommon −37,431, rare and epic −10,016. The rare and epic loss is the −0.4 %
    measured before. The rise comes from **per-planet common quotas**: the old per-map quota was the minimum over the
    nine planets, so on most boards the Collective now buys more of the common harvest. Map 1 falls 5.6 % because the
    live-board uncommon quotas are smaller than the old raw-board ones. The uncommon quota now fills on 55 of 81 boards
    (was 34). The lowest board after the change still pays 7,950 gold to a starter commander. Owner decision Q7.
- **2026-11-05, owner decision (Q7).**
  > **owner**: "Keep them"

  The per-planet common quotas stay as measured; harvest gold rises about 7.5 % against `main`.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/tech-plan/Dialog-Response-Reputation.md | standing levels, thresholds, the ledger API and replies that change Collective standing |
| depends-on | docs/tech-plan/Capital-Ship-Interior.md | the hub Bar where the contract ledger lives and the room locks |
