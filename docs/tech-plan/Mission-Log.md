# TECH PLAN — Bulwark Mission Log (v1.0)

**Provenance.** Owner sentences are quoted and marked **owner**; everything else is **agent-proposed**. Written 2026-11-01 by the repo-rooted cloud session (Claude Code, Opus 5.5) from the owner's request that day and the repo at `main` @ `02352f4`. Epic `epic_mvyqoffg_a`. **The repo copy is canonical**: `docs/tech-plan/Mission-Log.md`; the MetaMax document mirrors it. The design it builds is `docs/16 Bulwark MM/design/Mission-Log-Design.md` (cited as **MLD §n**), with the standalone page `docs/16 Bulwark MM/design/mission-log/Mission-Log-Design.html`.

**owner**: "I want a Mission Log to present all active missions, rewards, and status. Everytime a mission is assigned to the user it gets log with a progress bar. The primary button for this feature should live in the header of the main screen to the left of the Player Info (4 - Sargeant)."

## 0. Governing decisions

- **D1 — The log is a record, written at assignment.** A mission enters `save.missions` at the moment it is assigned (contract accepted, favour delivered to the player, campaign map unlocked, authored mission granted). Nothing is derived after the fact, so the log is the single place a mission's state lives.
- **D2 — Progress updates at battle end, never in the tick.** Counters advance from the battle result (`sim.mapScore`, kill tallies, haul totals) when `main.js` banks the result, in the same place contracts are judged today (`main.js:1125-1141`). The sim stays untouched, so replay determinism (`replay.js`, `balanceSim.js`) is unaffected. The one live read is the HUD tracker (D5), which reads the existing counters and writes nothing.
- **D3 — Status is computed, except for the terminal states.** `failed` and `done` are stored; `new`, `ready`, `risk` and `active` are computed from the record by one pure function (`missionStatus`), so the list, the header badge and the tests can never disagree.
- **D4 — Contracts become missions; they do not get a second system.** `save.maps[id].contract` stays the source of loyalty rules (`src/save/contracts.js`). The mission record points at it (`ref: {kind:'contract', mapId}`), and the contract's verdict (FULFILLED / BROKEN) sets the mission's terminal state. The Unknown Contact favour (`contactCall`, `src/comm/dialog.js:157`; design in `docs/16 Bulwark MM/design/Unknown-Contact-Dialog.md`), which is not saved anywhere today, gets its first persistence through the log.
- **D5 — Track in battle reuses the quest-crystal HUD line.** At most one tracked mission shows under the existing "● red ● green" counter (`src/render/hud.js:291-296`).

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
- Authored missions (haul, bounty, survey, defend) come from a new content file, `content/missions/missions.json`, keyed by planet and unlock condition. Contract and favour missions are built from the existing offers; campaign missions from map unlocks.

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

Open owner decisions: the authored mission list per planet (`content/missions/missions.json`), and whether tracking allows one mission or several.

## Dependencies

| relation | plan | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/16 Bulwark MM/design/Mission-Log-Design.md | the full UX: header button, status language, list, dossier, icons, layouts |
| depends-on | docs/16 Bulwark MM/design/Menu-Progression-Design.md | the header widget, the rewards fly-in ledger, red-dot badge rules |
| depends-on | docs/16 Bulwark MM/sources/bulwark-gdd.md | §10 alignment axis and conviction tiers, §12 drama tags |
