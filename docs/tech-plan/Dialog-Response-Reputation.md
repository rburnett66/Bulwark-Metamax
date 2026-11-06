# Tech Plan — Dialog Response + Reputation

**Epic:** `epic_mvodtfae_1` "Dialog response + reputation" (Bulwark advanced mode).
**Status:** v0.1, 2026-11-05, agent-proposed. Notes and as-built justifications for this epic go here, not on the tickets.

**Epic text:** "Extend one-way dialog into a RESPONSE mode: player chooses replies. Right answers reward; wrong answers lose
faction favor; offending one faction can open a door with a rival. Reputation rides on the alignment matrix, counter ring
and hero affinity."

**Design inputs:**
- the Advanced Mode deck ("They remember you — each character's love or hate shifts with your success");
- the Dossier (9 × 9 alignment matrix, rivals, 81 heroes);
- the Long Ledger prototype (bar choices, standing locks);
- `Collective-Opening-Design.md` v0.2.

## 1. Scope

**In scope:**
- **Replies.** Any conversation line can offer two to four replies, each with effects.
- **Standing.** A per-faction level (Hostile … Honored) derived from the loyalty the game already keeps.
- **Locks.** Rooms and offers gated by standing.
- **Rivals.** Offending one faction raises its rival.
- **Affinity.** Each named hero remembers how you treated them.
- **Alignment.** Replies nudge the player's good / evil axis, and heroes react to it through the alignment matrix.

**Out of scope:**
- Writing the reply content (the owner's script).
- Voice recording.
- PvP reputation (L4+).

## 2. What exists

### 2.1 In the game (`prototype/test-game/src/`)

| Piece | Where | As built |
|---|---|---|
| **Loyalty ledger** | `save/contracts.js` `addLoyalty(s, faction, delta)` | `s.loyalty[faction]` is a number. Tech tiers are cumulative thresholds `Tech_T1/T2/T3 = 100 / 260 / 520` (workbook), recomputed and never revoked. |
| **Rivals** | `rivalOf(faction)` from the workbook's `Rival_Faction` | Four pairs by ordinal: 1↔2, 3↔4, 5↔6, 7↔8. Faction 9 has none. |
| **Rival rules** | Quest contracts | Decline: giver −30, rival +50 % of that. Fulfil: giver +gain, rival −50 % of the gain. Broken promise: −45. All are workbook parameters (`Decline_Cost`, `Decline_Rival_Gain`, `Rival_Penalty`, `Broken_Promise_Penalty`). |
| **Alignment** | `s.alignment` (number); `ALIGN_SCORE` AG +4 … DE −4; `alignWord` | Fulfilling a hero's contract shifts alignment by 2 × that hero's score. Missions offer Light or Shadow secondaries by alignment band (`missions.js` `alignmentBand`). |
| **Dialog** | `comm/dialog.js` (seeded moment selection over `voicepacks.json`); `comm/commCard.js` (one-way comm card); `comm/voice.js` | 81 heroes with `align` and phrases. No replies anywhere. |
| **Alignment matrix** | — | Not in code. It exists in the GDD §10 and the Dossier artifact: symmetric, from polarity × conviction, with the four "zealot" alignments respecting each other across good and evil. |
| **Hero affinity** | — | Not in code. |

### 2.2 In the Long Ledger prototype (artifact `S9B7GgVN7XcRDBTSF7BVth`)

| # | Feature | As built |
|---|---|---|
| R1 | Reply choices | The Bar's room dialog offers two buttons: "Business is business." (note "Collective favor +2") and "They had it coming." (note "Arcane −2 · Dark Energy +1 — offending one opens another"). It shows a hint line under the buttons: "Your reply shifts standing — offending one faction can open a door with its rival." The buttons only toast their note; nothing changes. |
| R2 | Standing levels | `STAND` = Hostile, Wary, Neutral, Trusted, Honored. A hard-coded `STANDING` table: Collective Trusted, Arcane Neutral, Space Tech Wary. |
| R3 | Locks | A room with `unlock: {fac, need}` is sealed below `need`: grey and hatched, with a lock badge naming the faction and level, and a toast on tap. The Chapel needs Trusted with Arcane; Engineering needs Trusted with Space Tech. |

The prototype's "Arcane −2 · Dark Energy +1" does not match the workbook's rivals: Arcane (6) is paired with Water (5),
and Dark Energy (8) with Space Tech (7). The pairs are Ground ↔ Air, High Tech ↔ Artillery, Water ↔ Arcane and Space
Tech ↔ Dark Energy; Greenies has no rival. The game uses the workbook (§3.3).

## 3. Design

### 3.1 Standing from loyalty — one ledger, not two

Standing is **derived** from `s.loyalty[faction]`. There is no second number.

| Standing | Loyalty |
|---|---|
| Hostile | ≤ −60 |
| Wary | −59 … −1 |
| Neutral | 0 … 99 |
| Trusted | 100 … 259 (Tech T1) |
| Honored | ≥ 260 (Tech T2) |

The thresholds are new workbook parameters (`Standing_Hostile = −60`; Trusted and Honored reuse `Tech_T1_Threshold` and
`Tech_T2_Threshold`), so balance stays in data. `standingOf(s, faction)` and `standingAtLeast(s, faction, need)` live in
`save/reputation.js`.

**The Collective** is a tenth faction without a planet and joins the ledger under its own key (owner 2026-11-05). Its
standing comes from **completing resource contracts**: one per planet per map, on common and uncommon resources.
Replies to its officers can also move it. The contracts, their values and what Collective standing unlocks are in
`Collective-Faction.md`.

### 3.2 Replies (response mode)

A conversation line may carry `choices`:

```json
{ "speaker": "quell", "text": "Heard you soured things with the Arcane. Bold. Costly. Which was it?",
  "choices": [
    { "t": "Business is business.", "tone": "N",
      "effects": [{ "fac": "Collective", "d": 10 }],
      "affinity": [{ "hero": "Supercargo Dorian Quell", "d": 1 }], "next": "quell_pleased" },
    { "t": "They had it coming.", "tone": "CE",
      "effects": [{ "fac": "Arcane / Energy", "d": -20 }],
      "affinity": [{ "hero": "Supercargo Dorian Quell", "d": -1 }], "next": "quell_wary" }
  ] }
```

- **`effects`** are applied through `addLoyalty`, so tech tiers move exactly as they do for contracts.
- **Rival rule.** A negative effect on faction F also gives `rivalOf(F)` +`Decline_Rival_Gain` × |d|, the same rule as
  declining a contract. That is "offending one faction can open a door with a rival".
- **Tone.** Each reply's alignment tag. It shifts `s.alignment` by ¼ × `ALIGN_SCORE[tone]`, a much smaller step than a
  fulfilled contract (2 ×), so talk is cheaper than deeds.
- **`affinity`** changes the named hero's affinity (§3.4).
- **`next`** branches the script. With no `next`, the line continues.
- **Right answers reward.** `rewards: [...]` on a choice uses the existing reward kinds (`save.js` ledger and
  inventory), shown in the toast and logged.
- **The panel shows each reply's consequences before you choose:** the faction chips with ▲ / ▼, and the rival chip with
  ▲. No hidden numbers. The prototype's hint line stays as the first-time explainer.
- **One answer per offer.** A reply is recorded (`s.replies[lineId] = choiceIndex`), so a replayed conversation shows
  the earlier answer and cannot be farmed.

### 3.3 Locks and offers by standing

- **Rooms.** `unlock: {fac, need}` in `ship-layout.json` (Capital-Ship-Interior §3.1) is checked with
  `standingAtLeast`. Locked rooms render and toast as in R3. A room unlocks the moment standing reaches the level, with
  an unlock flash.
- **Offers.** Missions and contracts may add a `standing` gate (`{fac, need}`) beside the existing alignment gates
  (`missionFlow.js`). An unknown condition still throws, as the file requires.
- **Shown everywhere.** A standing strip lists every faction's level, with the next threshold, in the player profile,
  and as a tooltip on any lock badge.

### 3.4 Hero affinity

- `s.affinity[heroName]` is −5 … +5, starting at 0. It changes through:
  - replies (`affinity`);
  - battle results: beating a hero's faction on its own planet −1 to that faction's Champion (PE) and +1 to its Neutral
    character, a small "they remember you";
  - fulfilling or breaking that hero's contract (+2 / −2).
- **What it changes:**
  - which signature line they open with (`voicepacks` gains `greet.warm` / `greet.cold` variants when written);
  - their idle pose in the room view (affinity ≥ +3 → `wave` on approach; ≤ −3 → `angry`);
  - a warm hero's contract offers +10 % loyalty.

  Purely presentational effects come first; the loyalty bonus is behind a workbook parameter.

### 3.5 The alignment matrix

- Add `src/data/alignmentMatrix.js`: the 9 × 9 symmetric table from the GDD §10 (values `++ + 0 − −−` → `+2 … −2`).
- **Use:** when a reply has a `tone`, every named hero **present in the scene** changes affinity by
  `matrix[hero.align][tone] / 2`, rounded toward zero, so ++ gives +1 and −− gives −1. A good hero frowns at a cruel
  answer even when it wasn't addressed to them.
- The matrix is data with its own test (symmetric, diagonal ++, the four zealots' cross-respect).

### 3.6 The counter ring

The epic names the counter ring, which is the battle relation (each faction beats one and loses to one). Proposed use:
replies and contracts that harm faction F give a small +5 to the faction F beats (it gains from F's weakness).

This is the lightest-touch use and it stacks with the rival rule. Owner decision Q3, because it makes most choices touch
three factions.

## 4. Modules

| Module | Kind | Responsibility |
|---|---|---|
| `src/save/reputation.js` | new | `standingOf`, `standingAtLeast`, `applyReply(s, choice, scene)` (effects, rival rule, alignment, affinity, rewards, `s.replies`), `affinityOf`. Pure over the save. |
| `src/data/alignmentMatrix.js` | new | The 9 × 9 matrix and `relation(a, b)`. |
| `content/maps/mapdata.js` / workbook | edit | `Standing_Hostile`, `Reply_Align_Factor`, `Affinity_Contract`, `Warm_Offer_Bonus`. |
| `src/dialog/conversation.js` | edit (from Collective-Opening) | Response mode: renders choices with consequence chips, calls `applyReply`, follows `next`. |
| `src/ship-interior/roomView.js` | edit (Capital-Ship-Interior) | Lock state from `standingAtLeast`; unlock flash. |
| `src/save/missionFlow.js` | edit | `standing` gate condition. |
| `src/save/save.js` | edit | `affinity: {}`, `replies: {}` defaults and migration. |
| Profile UI | edit | Standing strip. |

## 5. As built → target

| Prototype | Target |
|---|---|
| R1 choices that only toast | `choices` with `effects`, `tone`, `affinity`, `rewards`, `next`; applied and saved; consequence chips. |
| R2 hard-coded `STANDING` | `standingOf` derived from the loyalty ledger (thresholds in the workbook). |
| R3 locks | Same visuals; live from the save; unlock flash. |
| Prototype rival "Dark Energy" | The workbook rival (`rivalOf`). |

## 6. Tests

| Test | Checks |
|---|---|
| `save/reputation.test.mjs` | Standing thresholds at every boundary; a negative effect raises the rival by the workbook factor; positive effects don't touch the rival; tone shifts alignment by the factor; replies can't be applied twice; affinity clamps to ±5; rewards land in the ledger. |
| `data/alignmentMatrix.test.mjs` | Symmetric; diagonal ++; zealot cross-respect (AG / PG ↔ PE / DE = +); values in −2 … +2. |
| `dialog/conversation.test.mjs` (edit) | Choices render with chips; picking one applies and branches; a replay shows the earlier pick. |
| `save/missionFlow.test.mjs` (edit) | A `standing` gate holds and releases an offer. |

## 7. Stories

| # | Story | Depends on |
|---|---|---|
| R1 | Standing derived from loyalty (`reputation.js`), the workbook thresholds and the standing strip | — |
| R2 | Response mode: reply choices with effects, the rival rule, alignment tone, rewards, one-answer-per-offer | R1, Collective-Opening S6 (conversation panel) |
| R3 | Standing locks live in the room view, and `standing` gates on missions and contracts | R1, Capital-Ship-Interior I1 |
| R4 | Hero affinity: ledger, battle and contract feeds, greeting variants and room poses | R2 |
| R5 | The alignment matrix as data; present heroes react to reply tone | R2, R4 |

## 8. Open decisions (owner)

| # | Question | Proposal |
|---|---|---|
| Q1 | Standing thresholds | Hostile ≤ −60; Trusted = Tech T1 (100); Honored = Tech T2 (260) |
| Q2 | How the Collective earns standing | **Decided by the owner (2026-11-05):** by completing the resource contract for each planet and map (common and uncommon). See `Collective-Faction.md`. |
| Q3 | Use the counter ring in reputation? | Small +5 to the faction that beats the one you harmed; or leave the ring to battle only |
| Q4 | Reply alignment weight | ¼ of the reply tone's score (a fulfilled contract is 2×) |
| Q5 | The prototype's Bar reply names Dark Energy as Arcane's rival; the workbook pairs Arcane with Water | Follow the workbook |

## 9. Notes

- **2026-11-05.** Plan written. It closes the epic's "Complete the tech plan" story. It grounds reputation in the
  existing loyalty ledger and workbook rivals rather than a second standing number.
- **2026-11-05.** The owner decided Q2. The Collective is a faction without a planet, and its standing comes from the
  per-planet, per-map resource contracts on common and uncommon resources. Detail is in `Collective-Faction.md`.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/tech-plan/Collective-Opening.md | the conversation panel that response mode extends |
| depends-on | docs/tech-plan/Ship-Crew-Characters.md | the poses affinity selects and the close-up |

`Capital-Ship-Interior.md` renders the standing locks and calls the room dialog. It depends on this plan, so it is not
listed here (the dependency graph stays one-way).
