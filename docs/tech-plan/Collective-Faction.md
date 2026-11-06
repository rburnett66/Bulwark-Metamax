# Tech Plan — The Collective as a faction (no planet) and its resource contracts

**Epic:** `epic_mvo5po8u_4` The Collective trade faction.
**Status:** v0.1, 2026-11-05, agent-proposed. Notes and as-built justifications for this epic go here, not on the tickets.

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
3. **The contracts cover common and uncommon resources only.** Rare and epic stay outside them. Those are the quest and
   prize resources, which already feed loyalty with the combat factions through quest contracts.

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
  is a balance change: gold from rare and epic drops by that small quota. `balanceSim.js` is rerun and reported before it
  merges (owner rule: balance is data). See Q1.
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
| Q1 | Rare and epic under contract today (small quotas): drop them so contracts are common and uncommon only, with rare and epic always kept? | Yes; rerun the balance sim and report the gold change |
| Q2 | When is a contract complete? | Both quotas sold and the battle won |
| Q3 | Standing on repeats | First completion only |
| Q4 | Can a contract lower Collective standing? | No; only replies can |
| Q5 | What Collective standing unlocks | The officer ladder in §3.5 |
| Q6 | Standing per contract | 10 / 15 / 20 by map band (a planet = 135) |

## 8. Notes

- **2026-11-05.** Plan written from the owner's direction. Collective standing now comes from resource contracts. This
  closes Dialog-Response-Reputation Q2, which proposed +10 per met quota.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/tech-plan/Dialog-Response-Reputation.md | standing levels, thresholds, the ledger API and replies that change Collective standing |
| depends-on | docs/tech-plan/Capital-Ship-Interior.md | the hub Bar where the contract ledger lives and the room locks |
