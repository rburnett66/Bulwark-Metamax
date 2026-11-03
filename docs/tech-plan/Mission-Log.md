# TECH PLAN — Bulwark Mission Log (v1.0)

**Provenance.** Owner sentences are quoted and marked **owner**; everything else is **agent-proposed**. Written 2026-11-01 by the repo-rooted cloud session (Claude Code, Opus 5.5) from the owner's request that day and the repo at `main` @ `02352f4`. Epic `epic_mvyqoffg_a`. **The repo copy is canonical**: `docs/tech-plan/Mission-Log.md`; the MetaMax document mirrors it. The design it builds is `docs/16 Bulwark MM/design/Mission-Log-Design.md` (cited as **MLD §n**), with the standalone page `docs/16 Bulwark MM/design/mission-log/Mission-Log-Design.html`.

**owner**: "I want a Mission Log to present all active missions, rewards, and status. Everytime a mission is assigned to the user it gets log with a progress bar. The primary button for this feature should live in the header of the main screen to the left of the Player Info (4 - Sargeant)."

## 0. Governing decisions

- **D1 — The log is a record, written at assignment.** A mission enters `save.missions` at the moment it is assigned (contract accepted, favour delivered to the player, campaign map unlocked, authored mission granted). Nothing is derived after the fact, so the log is the single place a mission's state lives.
- **D2 — Progress updates at battle end, never in the tick.** Counters advance from the battle result (`sim.mapScore`, kill tallies, haul totals) when `main.js` banks the result, in the same place contracts are judged today (`main.js:1125-1141`). The sim stays untouched, so replay determinism (`replay.js`, `balanceSim.js`) is unaffected. The one live read is the HUD tracker (D5), which reads the existing counters and writes nothing.
- **D3 — Status is computed, except for the terminal states.** `failed` and `done` are stored; `new`, `ready`, `risk` and `active` are computed from the record by one pure function (`missionStatus`), so the list, the header badge and the tests can never disagree.
- **D4 — Contracts become missions; they do not get a second system.** `save.maps[id].contract` stays the source of loyalty rules (`src/save/contracts.js`). The mission record points at it (`ref: {kind:'contract', mapId}`), and the contract's verdict (FULFILLED / BROKEN) sets the mission's terminal state. The Unknown Contact favour (`contactCall`, `src/comm/dialog.js:157`; design in `docs/16 Bulwark MM/design/Unknown-Contact-Dialog.md`), which is not saved anywhere today, gets its first persistence through the log.
- **D5 — Track in battle reuses the quest-crystal HUD line.** At most one tracked mission shows under the existing "● red ● green" counter (`src/render/hud.js:291-296`).

- **D6 — Flow (owner 2026-11-02, MLD §11).** One primary per planet × map (81) and an optional secondary per planet × map in a Light / Shadow version chosen by alignment history, unlocked by a replay that beats the best average stars. Gates: level, alignment band, owned tech node. The planet's faction capital ship arrives after map 1 at ≥ 3 stars; missions are granted and rewards collected aboard; collecting advances the quest line (planet campaign + favours line per planet). The wave-2 contract offer moves off the battle timeline and becomes the secondary.
- **D7 — Tech nodes unlock through missions, then are bought (owner 2026-11-02).** `tech_unlock` adds a node to an `unlocked` set; the Tech Net shows it purchasable and still charges its price. Starting-kit and free nodes stay owned from the start.
- **D6a — Ship after map 3 (owner 2026-11-03).** The planet's ship arrives on a ≥ 3★ win of map 3 (`SHIP_MAP`, `missionFlow.js`). Maps 1–3 missions are granted and collected aboard the Collective ship (`COLLECTIVE_SHIP`, always present; workbook Capital_Ships › `(Collective)` row → `missions.json` › `collective`); only maps 4–9 carry the `capital_ship_arrived` gate.
- **D8a — Collective contract (owner 2026-11-03, MLD §12).** `createSim` takes `contract` (per-tier quota from `data/collectiveContract.js` ← mapdata Maps › `Contract_*`), carried in the replay init. `harvest.js` pays a load's gold only for units within the quota; the rest is `kept` on the deposit event. `battleTally.kept` feeds `bankHarvest`, so the inventory receives only the surplus. No contract (classic board, harness) = every load pays and everything is kept.
- **D8 — Inventory (owner 2026-11-02, MLD §12).** `save.inventory[resourceId]` counts; an INVENTORY header chip next to MISSIONS opens the resource list grouped by faction / planet.

## 1. What exists today

- Contracts: `buildOffer` → `OFFERED`, `ACCEPTED`, `DECLINED`, `FULFILLED`, `BROKEN` in `save.maps[id].contract`, judged at match end. One offer per map, in the wave-2 interlude (`src/comm/questBeats.js`).
- Givers: `content/dialog/voicepacks.json` (9 factions × 9 characters, `align`, `motivation`, `phrases`); 81 portraits in `content/dialog/portraits/<slug>.png` (only Ground, Air, Greenies have finished art).
- Header: `progressWidget.js` (rank, gold, stars, research) inside `.bwm-prog`; red dots from `src/menu/badges.js`.
- No mission list, no per-objective tracking, no authored missions.

### 1.1 What the game can measure today (objective catalogue)

Audit of `main` @ `02352f4`, 2026-11-01. Paths are under `prototype/test-game/src/`. The sim emits rich events (`kill` carries unitId/lane/wave, `damage` carries type/target, structures emit build/upgrade/destroy), but `stepSim` (`sim/core.js:1233`) drains them and nothing tallies them. The save holds no lifetime totals: everything per-battle resets. An objective kind is only buildable when its row is tier A or B.

**Tier A — already persisted (read from the save; no new counting):**

| objective kind | source |
|---|---|
| Win map *N* | `maps[id].beaten` (`save/save.js:110-127`) |
| Reach average stars ≥ *x* on a map; total stars ≥ *n* | `maps[id].avg`, derived total (`save.js:126,141`) |
| Any 5-star wave | `lastRunFiveStar` (last battle only, `save.js:107`) |
| Reach rank / level *n* | `progress.xp` (`data/progression.js:24`) |
| Fulfil a faction contract | `maps[id].contract` (`save/contracts.js:92-131`) |
| Reach loyalty tier *t* with a faction | `loyalty[f]`, tiers 100/260/520 (`contracts.js:78-85`) |
| Beat a faction *n* times | `factionRecords[f].mapsWon` (`save.js:110-117`) |
| Buy *n* tech nodes / open a portal | `tech.owned` (`save.js:199-222`) |
| Raise the harvester to level *n* | `harvesterLevel` (`main.js:844-853`) |
| Shift alignment past a threshold | `alignment` (`contracts.js:126`) |

**Tier B — per-battle values that exist at battle end (add to `applyBattle`; no sim change):**

| objective kind | source |
|---|---|
| Kill *n* enemies (total only) | `eco.kills` (`sim/economy.js:107-137`) |
| Haul *n* rare / epic quest crystals | `mapScore.questRed` / `questGreen` (`sim/harvest.js:495-496`) |
| Earn *n* gold from common / uncommon harvest | `mapScore.goldFromPrimary` / `goldFromPremium` (`harvest.js:490-491`) |
| Spend *n* gold in one battle | `state.goldSpent` (`economy.js:84-87`) |
| Per-wave star flags, *n* waves: no core damage, no harvester lost, primary quota ≥ 60 %, premium claimed, under par time | `sim.waveStars[]` flags (`sim/waves.js:110-137`) |
| Score ≥ *n*; finish under *m* minutes | final score object (`sim/core.js:182-215`) |
| Take *n* wave bonuses / a specific bonus | `state.bonuses.owned[]` (`sim/bonuses.js:55,131`) |

**Tier C — the event exists but nothing counts it (needs a battle-end tally from the event stream, MLG-2):**

| objective kind | event |
|---|---|
| Kill *n* of a unit type / faction / domain (e.g. flyers) | `kill` (`sim/combat.js:715`) — no killer credit today |
| Kills by a tower type, the super-cannon or mines | `damage.sourceId` (`combat.js:513`), cannon `core.js:1140`, mines `sim/mines.js:100` |
| Build / upgrade *n* of a structure type or to tier *t* | `structures.js:193,233,344,356` |
| Lose no more than *n* walls / structures | destroyed (`combat.js:526`); `structuresLostThisWave` is presentation-only (`main.js:908`) |
| Keep base HP ≥ *x* % / take ≤ *n* damage | `damage` with target `base` |
| Deploy *n* troops | `cmdDeployTroop` (command log only, `core.js` ~498) |
| Lose no harvesters / troops | defender-side `kill` (`combat.js:715`) |
| Survive a faction ability (stuns, freezes, raises, mirrors) | `sim/abilities.js:140-354` |

**Tier D — not possible yet:**
- Survey (no survey-site event; galaxy and planet views are not counted).
- The Unknown Contact favour (`contactCall` exists but is not wired up or saved).
- Named planet resources: harvest counts by tier/colour; the names in `planets.js` are presentation. Haul objectives are therefore written per tier and shown with the planet's resource name.
- Losses and retries are not counted.

**Consequences for the design prototype's sample missions:**
- *Rootsong for the Vanguard*, *Order Through Fire* (contracts) and *First Light on Verdance* (campaign) are A/B today.
- *Silk for the Wings* is B when written as "common/uncommon gold on Florael".
- *Silence the Blight* (kills of one faction), *Not One Brick* (walls lost) and *Clear the Flight Lanes* (flyer kills) need tier C tallies.
- *Chart the Far Side* (survey) and *A Quiet Exchange* (favour) are tier D.

**Save defect to fix first in MLG-2:** `defaultSave()` declares `tech` twice (`save.js:37,45`), so the per-faction tiers `contracts.js:83` writes as `s.tech[faction]` share an object with `tech.owned`/`tech.paid`.

### 1.2 Economy — mission rewards vs the whole tech tree (owner 2026-11-02)

**owner**: "do a comparison of the total mapped rewards, against the total cost of unlocking 100 [%] of the current tech tree. Leave out Outpost upgrades."

The live version is the **Economy** sheet of `docs/sources/Bulwark-Missions.xlsx`. All numbers are formulas over the Rewards and Tech_Unlocks sheets.

**Tech tree, 100 %, 57 nodes: 140,300 gold.**
- Units: 39,300.
- Bases: 74,900, including the Apocalypse Cannon at 25,000.
- Map: 26,100, of which 22,000 is the 8 portals. Portals cost 1,000 + 500 × portals already owned, bought in unlock order.
- Left out: Outposts and Ships (both coming soon), the free starting kit, and the Map 3 milestone.

**Mission rewards, gold plus the gold value of granted common / uncommon resources:**

| | rewards | coverage | gap left for battle income |
|---|---|---|---|
| Primaries (81) | 73,629 | 52.5 % | 66,671 |
| Primaries + one secondary per step, Light path | 106,569 | 76.0 % | 33,731 |
| Primaries + one secondary per step, Shadow path | 110,889 | 79.0 % | 29,411 |

Primaries also give 24,300 XP. Rare and epic resources are quest crystals and are not counted.

**Per planet, the curve runs out late.** Each planet's primaries pay 6.4k (Verdance) to 10.0k (Vexmire), and the Light secondaries add 3.7k. The nodes those primaries unlock cost:
- Verdance: 5.6k.
- Lumen: 17.6k.
- Xenthe: 18.4k.
- Vexmire: 42.2k, including the Apocalypse Cannon.

On the Light path the running balance stays positive through Lumen (+37) and ends at −33.7k. The last two planets are where battle income has to carry the tree.

**Owner decision for now (2026-11-02, `task_mvzkudeg_1n`):** battle gold closes the gap, as designed today. Raising late mission rewards or moving the Apocalypse Cannon's price into resources stay open for later.

### 1.3 Ships (coming soon)

**owner**: "We will need to add Ship upgrades for future trade and space combat economies. Ship upgrades should be added to tech tree as coming soon."

Done in `src/data/techtree.js` and `src/menu/technet.js` (`story_mvzkubvz_1m`). There is a fifth division, **SHIPS**, between Outpost and the 360° seam:
- **Trade:** Cargo Holds, Trade Charter, Hyperlane Drive.
- **Space combat:** Deflector Screens, Broadside Batteries, Fighter Bay.

Like the Outpost ghosts, these nodes are never priced, counted or bought; `TECH_TOTAL` stays 57. The floor shader now takes 5 division colours, the 1–5 keys fly to each division, and the chips for coming-soon divisions are greyed without a count.

## 2. Data model — `save.missions[]`

```js
{ id, type,                 // 'contract'|'favour'|'defend'|'haul'|'bounty'|'survey'|'campaign'
  giver: { faction, index }, // voicepacks.json factions[faction].characters[index]; faction 'unknown' = the Contact
  planet, mapId, title, briefing,
  objectives: [{ id, kind, need, have, optional?, limit? }],  // kind: 'win'|'haul'|'kill'|'survey'|'noBreach'|'waves'…
  items:  [{ planet, tier, need }],                          // tier: common|uncommon|rare|epic (planets.js RESOURCE_TIERS)
  rewards:[{ kind, amount, faction?, tier?, id? }],          // kind: gold|xp|stars|research|loyalty|crystal|unit|structure|blueprint|sealed
  terms:  { fulfilAt?, expiresAfterBattles?, brokenPenalty? },
  ref?:   { kind:'contract', mapId },
  assignedBattle, seen:false, tracked:false, end: null|'failed'|'done', endReason? }
```

- `assignedBattle` is the battle counter (`save.progress.battles`), not wall-clock time.
- Authored missions come from `content/missions/missions.json`, generated from `docs/sources/Bulwark-Missions.xlsx` by `tools/extract_missions.py` (MLG-7, `story_mvys6jex_k`). Each mission carries requirement lists for **view**, **unlock**, **execute**, **complete** and **fail**, built from the workbook's condition catalogue (which repeats §1.1's tiers). The extractor refuses unknown conditions, conditions in the wrong stage, unknown reward kinds and missions with no objective. `missionStatus` gains **locked** (view met, unlock not). Contract and favour missions are built from the existing offers; campaign missions from map unlocks.
- **Content (v2, 2026-11-02):** 243 missions — 81 primaries and 162 secondaries (81 Light + 81 Shadow) — in 18 quest lines, plus 9 capital ships, 36 resources and 57 tech unlocks. Every mission is tier B (battle-end values) plus mechanics this epic builds (tier M). The 2026-11-01 starter set of 39 is replaced.
- **New save fields:**
  - `planetMaps[planet][map] = {beaten, bestAvg, runs}`: the per-planet record that drives capital ship arrival and replay improvement.
  - `capitalShips[planet] = {arrived}`.
  - `tech.unlocked`.
  - `inventory`.

## 3. Pure core — `src/save/missions.js`

`logMission(save, def)`, `missionStatus(m, save)`, `progress(m)` (required objectives only, limits and bonuses excluded, MLD §3), `applyBattle(save, result)`, `claim(save, id)` (banks rewards through the same ledger as `save.pendingRewards`, so they fly into the header like battle rewards), `abandon`, `dismiss`, `badge(save)` → `{ready, fresh}`.

## 4. UI

- Header chip in `progressWidget.js`, inserted before the rank button, with the hex count badge (MLD §1).
- Screen `missions` in `src/menu/missionLog.js`, added to `show()` in `src/menu/menu.js`. It reuses the design page's CSS and icon sprite, lifted into the menu CSS string.
- Assignment toast plus header ping, fired by `logMission` through the menu's event hook.
- Badges: a `MISSIONS` rule in `src/menu/badges.js` — dot when `ready > 0 || fresh > 0`; seen when the log opens (fresh clears per mission when its dossier opens).

## 5. Tests

`missions.test.mjs`:
- logging at assignment;
- status for every state, including limit-at-risk and expiry;
- `applyBattle` for each objective kind;
- contract verdict → terminal state;
- claim banks once;
- abandon applies the contract's decline rules.

Also `badges.test.mjs` for the new rule. Then the full suite and both deploy gates.

## 6. Plan — stories on epic `epic_mvyqoffg_a`

| story | id | depends on |
|---|---|---|
| Tech plan (this) | `story_mvyqoflh_b` | — |
| MLG-1 Mission Log full design | `story_mvyqojad_c` | — |
| MLG-2 Mission records + assignment logging | `story_mvyqol3w_d` | MLG-1 |
| MLG-3 Header Mission Log button | `story_mvyqomk8_e` | MLG-2 |
| MLG-4 Mission list view | `story_mvyqoo07_f` | MLG-2, MLG-6 |
| MLG-5 Mission detail view | `story_mvyqoplz_g` | MLG-4 |
| MLG-6 Mission iconography set | `story_mvyqor1y_h` | MLG-1 |
| MLG-7 Missions spreadsheet + extractor | `story_mvys6jex_k` | MLG-1 |
| MLG-8 Capital ships: arrival, grants, collection | `story_mvzkd148_1j` | MLG-2 |
| MLG-9 Primary/secondary flow + quest lines | `story_mvzkd2t8_1k` | MLG-2, MLG-8 |
| MLG-10 Inventory button + resource list | `story_mvzkdvrl_1l` | MLG-2 |

Open owner decisions: the authored mission list per planet (`content/missions/missions.json`), and whether tracking allows one mission or several (built: one).

## 7. Decisions made while building (2026-11-02)

**Owner, for now:**
- Tech nodes cost gold only until the workbook's resource columns are filled in. `inventory.test.mjs` fails if they are filled in without the Tech Net charging them.
- All four harvested tiers go to the inventory, and common and uncommon still pay their gold in battle.

**Agent, for owner review:**
- **Counting:** haul, harvest and kill objectives add up over every battle that counts. Gold spent, wave flags, five-star waves and finish time keep the best single battle.
- **Harvest on a loss:** what the harvesters brought home is kept, win or lose.
- **Failed secondaries:** the step is offered again only by another replay that beats the best. Otherwise a broken promise would strand the favours line.
- **Withdrawn favours:** leaving the alignment band costs the broken-promise penalty, as the design page's sample shows, and the other version takes its place.
- **Contract card:** not kept as a briefing. `render/contractModal.js` and the offer functions in `save/contracts.js` are no longer called by the game.
- **Timestamps:** a record carries both the battle counter and wall-clock time. Wall-clock is written in the save layer only, never in the tick.
- **Existing saves:** progress from before the log is not backfilled. Tech nodes already bought stay owned; the next one needs its mission.

## Dependencies

| relation | plan | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/16 Bulwark MM/design/Mission-Log-Design.md | the full UX: header button, status language, list, dossier, icons, layouts |
| depends-on | docs/16 Bulwark MM/design/Menu-Progression-Design.md | the header widget, the rewards fly-in ledger, red-dot badge rules |
| depends-on | docs/16 Bulwark MM/sources/bulwark-gdd.md | §10 alignment axis and conviction tiers, §12 drama tags |
