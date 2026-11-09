# Tech Plan — Content Reveal: new planets, capital ships and the way aboard

Status: plan for review · 2026-11-06 · Epic: *Content reveal* (MetaMax project 16, ids in §10)

## 1. The request

Owner, 2026-11-06:

> We still need proper design and choreography around introducing new content, and navigating through it.
> A major part of good game design is exploration which is excellently supported with our galaxy map.
> […] New planets need a fly by and the arrival of the transport ship which has been prototyped. New capital ships
> need a fly by introduction which has also been prototyped.
> Where a player boards or departs a capital ship there is a nice screen transition which has already been
> prototyped which should be used.
> Although the introduction of a new Capital ship should include a choreographed path to a specific character to
> introduce story, once the story is present the user should have a way to leave the room and explore the ship
> before proceeding to the next mission.
> New planets get introduced after the player completes an objective like reaching a specific map level. At this
> point the player might want to keep fighting on the current planet. When the player returns to the menu triggers
> the new content presentation — "new planets discovered".
> This trigger would then introduce the planet, show the transport running a survey scan.
> The capital ship would be introduced and the ship would present itself in a stationary orbit in the upper left
> corner of the screen.
> If this is the first time introduction the camera would pan to the side of the ship in a cinematic way and then
> we get the transition that reveals the rooms and crew of the ship. The very first character is introduced and the
> planets first missions are presented and added to the mission log.
> The player can then explore, depart, and hit play to pick a planet to start gathering on.

The same message asked for Vesper to sit at the galaxy's far edge. That fix is separate (story
`story_mw55p9hi_12`, PR #170): Vesper now sits past the spiral's rim in the empty upper-left of the galaxy view.

**The rule this plan follows:** every piece of the reveal is something already built or prototyped, joined into one
sequence. The work is the sequence, its trigger and its persistence. No piece is drawn a second time.

## 2. What already exists

**The prototypes, where to open them.** Several exist only as Claude artifacts, not in the repo:

| Prototype | Source |
|---|---|
| Planet fly-by, transport arrival, survey scan | Artifact **Bulwark Orbital Survey** — https://claude.ai/artifact/YWypZzQT45WYG8yZmcaUTv; repo copy `tools/planets/orbital-survey.html` (owner-supplied 2026-11-06, identical to the artifact). Its comm card is the duplicate-dialog pattern and is **not** ported: any line in the reveal goes through `comm/` (Dialog-Unification) |
| Capital ship fly-by (Long Ledger at Vesper) | Repo review page `tools/opening/index.html` (`?t=` scrubs the opening); ship look and lenses in `tools/ships/viewer.html` |
| Board / depart transition, rooms, crew | Artifact **Bulwark Capital Ship** — https://claude.ai/artifact/S9B7GgVN7XcRDBTSF7BVth; repo copy `tools/ship-interior/prototype/long-ledger/index.html` |
| Characters | Artifact **Bulwark Character Sheet** — https://claude.ai/artifact/MBrTStmqgULyFM4XFkj5jM; repo copy `tools/ship-interior/prototype/character-sheet.html` |
| Globe look | Artifact **Bulwark Planets** — https://claude.ai/artifact/Ey7UQfY7eei6639zyobSXa (globe viewer only; no fly-by) |

The Orbital Survey source is committed at `tools/planets/orbital-survey.html` (as Interiors I0 did for the Long Ledger), so R4 ports from the repo.

Reality queries run before writing this plan (`does_exist`, project 16): "planet fly by transport arrival survey scan",
"capital ship fly by introduction", "board depart capital ship screen transition", "galaxy map planet position".
Board searches: "arrival", "board", "coast". Each piece is then read in source.

| Piece | Where | State | Role in the reveal |
|---|---|---|---|
| Galaxy map | `src/data/galaxy.js` (`SYSTEMS`, `galaxyCamera`), `src/menu/galaxyStage.js` | In the game | The fly out from the current planet, the new system lighting up, the fly in |
| Planet fly-by and transport arrival | *Bulwark Orbital Survey* artifact (`YWypZzQT45WYG8yZmcaUTv`): `startArrival` / `stepArrival` / `arcU`, `ARRIVE_S = 17` | Prototype; story `story_mvaf5x01_w` | Inbound past the moon, the gravity-assist swing, the braking burn into survey orbit, the four resource targets |
| Survey scan | Same artifact: `stepSurvey` (sweep → slew → dwell → lock → hold), site markers in the globe shader | Prototype | The scan: wide sweep, sites rated, one locked |
| Survey ship in the menu | `src/render3d/planet/surveyShip.js` (`makeSurveyShip`, `orbitFrame`, `scanLevel`) | In the game | The same hull keeps orbiting after the reveal |
| Capital ship fly-by | `src/opening/openingStage.js` + `timeline.js` beats `star`, `flyby`, `flank` (the Long Ledger at Vesper) | In the game (opening only) | First sight of any capital ship, and the pan to its flank |
| Capital ship arrival design | `docs/16 Bulwark MM/design/Capital-Ship-Arrival-Design.md` §3 beats, §6 return coast-in, §7 skip | Designed; `arrival.js`, `shipPresence.js` not built | Beat timings, sound and the resting composition |
| Board / depart transition | Long Ledger prototype (`tools/ship-interior/prototype/long-ledger/index.html`, `board()` / `depart()`); in the game as `introRunner.js` beat `open` and the launch close | In the game (opening only) | Every boarding and departure |
| Rooms, crew, walk-to | `src/ship-interior/` (`layout.js`, `crew.js`, `primitiveRooms.js`, `roomView.js`); timeline `roomsAt` beats `life`, `patron`, `bar` | In the game (opening only); Interiors I3–I5 open | The path to the first character, then free exploration |
| Dialog | `comm/commCard.js`, `comm/dialog.js`, `comm/voice.js` | In the game | The character's introduction, as a comm scene (Dialog-Unification F1) |
| Missions and the log | `save/missionFlow.js` (`syncMissions`, `GATE`, `loggedQueue`), `menu/missionLog.js`, `menu/missionView.js` | In the game | The planet's first missions, presented and added |
| Token flight to the top bar | Menu-Progression-Design §3.2 (rewards ledger) | In the game | Missions fly into MISSIONS the way gold flies into Gold |
| Unlock queue | `s.loggedQueue` `{kind:'mission'}`, `{kind:'ship', planet}` (`recordPlanetMap`) | In the game | Gains `{kind:'planet', planet}` |
| Planet gating | `menu/techSave.js` `planetOpen` (portal nodes), `ALL_PLANETS_OPEN = true` (testing) | In the game | Unchanged; discovery is a separate flag (§4.1) |

**Open story that this plan re-scopes:** `story_mvajkzq1_10` *Arrival scene at the start of runIntro* put the
transport arrival before every battle. The owner's direction moves it to the menu, once per new planet (R4).

## 3. The player's path

```
battle won ──► objective met (e.g. Verdance map 6) ──► results screen: "New signal — Florael discovered"
                                                         │
                     NEXT MAP / replay: keep fighting ◄──┤   nothing plays in battle
                                                         ▼
                                     back to the menu ──► rewards ledger (as today)
                                                         ▼
                                     NEW PLANET DISCOVERED (§5.1)
                                       galaxy fly-out · the system ignites · fly-in past the planet
                                       transport arrives · survey scan · site locked
                                                         ▼
                                     CAPITAL SHIP (§5.2)
                                       seen before → coasts in to the upper-left station
                                       first time  → fly-by arrival, ends at the upper-left station
                                                         ▼  first time only
                                     ABOARD (§5.3)
                                       pan to the flank · board transition · rooms and crew
                                       the path to the character · story · first missions → Mission Log
                                       explore: leave the room, walk the ship · ◂ DEPART
                                                         ▼
                                     MENU (§5.4): ship at its station, survey ship in orbit, PLAY lit
                                       PLAY → Survey → pick a planet → gather
```

## 4. Trigger, queue and persistence

### 4.1 Discovery

- A planet is **discovered** when its discovery objective is met. The objective is data, written with the existing
  gate conditions (`missionFlow.js` `GATE`), so no new condition code is needed:

  | Planet | Discovered when (default, Q2) |
  |---|---|
  | Verdance | at the opening (§6) |
  | Each next planet | the previous planet's map 6 is beaten (`reveals.SURVEY_MAP`). Owner 2026-11-08: "we have some design conflict between discovering new planets and unlocking the capital ships. Lets move new planets to map 6" — map 3 brings that planet's capital ship, map 6 discovers the next planet, so the two reveals no longer land on one win |

- Saved as `s.discovered[planetKey] = true`. Old saves migrate with every planet they have played discovered, so no
  one replays a reveal for a planet they know.
- `ALL_PLANETS_OPEN` (testing) also marks every planet discovered, and no planet reveal queues.
- **Undiscovered planets are not dimmed** (owner, 2026-11-06). Every system draws at full strength with its name and
  ring; one not yet reached is tagged **UNSURVEYED**. Its dossier says what surveys it, and PLAY is not offered
  there. The reveal's survey scan is what removes the tag.

### 4.2 The queue

- Settling a battle (`settleBattle`) pushes `{kind:'planet', planet}` onto `s.loggedQueue` when a planet is newly
  discovered. `{kind:'ship', planet}` is already pushed when a capital ship arrives.
- The results screen adds one line per entry: "New signal — <Planet> discovered" / "<Ship> is inbound to <Planet>".
  The battle flow is untouched: NEXT MAP and replays work as today and the queue waits.
- **The main menu plays the queue** the next time it opens, after the rewards ledger. Planets play first, in
  discovery order, then ships. Each entry is one reveal; the player can skip each.
- The Survey screen and the battle never play a reveal. If the player goes straight from the results screen to a
  battle, the queue waits for the next menu.

### 4.3 Persistence

- Each reveal writes its result at its **commit beat**: the planet is marked `revealSeen` when its survey site
  locks; a ship's `introSeen` is written at its title card (Arrival-Design §2); the first missions are added when
  they are presented.
- If the app closes before the commit beat, the reveal plays again next time.
- A **skip** jumps to the end state: the planet is marked seen, the ship parks at its station, and the missions are
  added. Nothing a reveal grants is lost by skipping.
- Every reveal can be replayed, and replays change nothing:
  - a planet's from its Survey dossier ("Replay discovery");
  - a ship's from the ship ("Replay arrival", Arrival-Design §6).

## 5. The choreography

Times are seconds. Every camera, ship and effect value is a pure function of `t`, the same pattern as
`timeline.js` `openingAt(t)`, so beats are testable and scrubbable.

### 5.1 New planet discovered (≈ 40 s, then player-paced)

| # | Time | Picture | Built from |
|---|---|---|---|
| P0 | 0–2.5 | The menu UI fades. Banner over the space backdrop: **NEW PLANET DISCOVERED**, then the planet's name types on beneath. A comm static ping. | Menu fade; `playSweep` |
| P1 | 2.5–4.1 | The camera flies out from the current planet to the galaxy. | `galaxyCamera` f 0 → 1 (`FLY` 1.6 s) |
| P2 | 4.1–6.5 | The uncharted star **ignites**: its glow swells, the orbit ring draws round, the label types on, the gold target marker pulses. | `galaxyStage` glow, ring and label, plus an ignite parameter |
| P3 | 6.5–9 | **Planet fly-by.** The focus glides to the new system and the camera flies in past the planet's limb. The globe takes over from the galaxy sphere at the same size. | `galaxyCamera` f 1 → 0 with the new focus; menu `bwm-galaxy-arrive` hand-off |
| P4 | 9–26 | **The transport arrives.** It comes in past the far moon on a fast inbound leg, swings round it, then makes a long braking burn down into survey orbit. The four resource targets appear one by one in the readout. | Orbital Survey `stepArrival`, `arcU`, `ARRIVE_S` = 17, targets list |
| P5 | 26–38 | **Survey scan.** A wide-area sweep, then candidate sites scanned one by one, rated, and one **locked** ("Landing site locked"). This is the commit beat. | Orbital Survey `stepSurvey`, site markers in the globe shader |
| P6 | 38–40 | The readout folds away; the camera settles on the menu's planet framing. The transport keeps orbiting as the menu's survey ship. | `surveyShip.js` (same hull) |

Owner, 2026-11-06: *"when you unlock a planet, and return to the menu the players transport ship surveys the new
planet. It is in the prototype, use the generic transport ship for now .. we will model transport ship options
later."* So the arriving ship is the player's transport, drawn with the prototype's **generic transport hull**. That
hull is already in the game as `makeSurveyShip` (`surveyShip.js`, ported from the prototype). One hull is used for
every planet and every player until transport options are modelled; `collective.transport` stays the save field the
choice will hang on.

### 5.2 The capital ship presents itself

Owner, 2026-11-06: *"The Collective always introduces new planets. Once a player completes Map 3 at 3 stars or
better the capital ship arrives for that faction and the player unlocks visiting the capital ship and collecting new
missions."* So two ships use this section:

- **A new planet → the Collective's Long Ledger.** After the survey (§5.1) it coasts in to the upper-left station
  over the new planet. The Factor calls on the comm, and the planet's first missions (maps 1–3) are offered **as a
  contract** (F6's contract card). ACCEPT grants them to the Mission Log. There is no boarding beat here, because
  the Long Ledger's first time aboard was the opening; the player can tap it to board.
- **Map 3 won at ≥ 3★ → that planet's faction ship.** It queues `{kind:'ship'}` (already built). On the next menu
  it plays **first sight**, then **first time aboard** (§5.3) with its captain, who grants the planet's next missions
  as a contract. From then on the player can visit the ship and collect missions there.

The timing for both:

- **A ship already seen** coasts in to its station in 3.5 s (Arrival-Design §6), engines settling to idle.
- **First sight** plays the arrival beats of Arrival-Design §3 (beats 0–6, 22 s): the arrival flash, the approach on
  a full burn, the pass, the braking burn and the power-down into orbit. Then, instead of §3 beat 7, it ends at the
  station.
- **The station is the upper-left of the screen** (owner, 2026-11-06). This replaces Arrival-Design §6's
  "upper-right":
  - Desktop: the band between the BULWARK logo and the hero text, about 24 % of the screen width.
  - Phone landscape: the band above the CAMPAIGN tag, left of GALAXY.
  - The anchor is a `[data-ship-anchor]` element, so the menu layout owns the space and the ship never covers a
    button.
- **At the station** the ship idles: a slow roll and bob, running lights, a tug or two. Tapping it boards (§5.3,
  without the story beats once seen).

### 5.3 First time aboard (player-paced)

| # | Picture | Built from |
|---|---|---|
| F1 | **The pan to the flank.** The camera leaves the station framing and swings round to the ship's side in a slow cinematic move (≈ 6 s). | Opening beat `flank` (30–40 s), generalised to any ship |
| F2 | **Board.** The scan line sweeps across the hull and wipes it away to reveal the rooms and crew (≈ 6 s). | The prototype's `board()`, in the game as beat `open` |
| F3 | Life inside: crew at their posts and walking the decks (≈ 4 s). | Beat `life`; Interiors I3 |
| F4 | **The path to the character.** Every other room dims, the character's room glows and they flash. A caption reads "<ROOM> · Tap to enter" (auto after a few seconds). The avatar walks there and the camera pushes in. | Beats `patron`, `bar`; walk-to (Interiors I4) |
| F5 | **The story.** The character's scene plays on the comm card, with holo-slides. | Dialog-Unification F1 `playScene`; scene from the dialog doc |
| F6 | **The first missions.** They are offered **as a contract**: the contract card (`contractModal`) shows the giver, the task and the terms, and ACCEPT grants the missions. They fly into the MISSIONS indicator, which pulses and counts up, and are now in the Mission Log. On the Collective ship this is the Verdance contract (owner, 2026-11-06). | `render/contractModal.js` (Dialog-Unification F4); the rewards-ledger token flight; `syncMissions` |
| F7 | **Explore.** The room view stays live. "◂ Leave room" pulls back to the whole ship. Tapping any room walks the avatar there and its occupant speaks. The top bar shows **◂ DEPART**. Nothing pushes the player on. | Interiors I4, I5 |
| F8 | **Depart.** The prototype's `depart()`: the hull closes behind the scan line and the shuttle leaves. Cut back to the menu. | The prototype's `depart()`, in the game as the launch close |

### 5.4 Back at the menu

- The planet view shows the new planet, the survey ship in orbit and the capital ship at its upper-left station.
- PLAY carries its red dot (Menu-Progression-Design §4), and MISSIONS shows the new count.
- PLAY → Survey → pick a planet → battle, exactly as today. The player chooses where to gather; the reveal does not
  choose for them.
- Tapping the ship boards it again (F2, F7, F8) with no story beats.

### 5.5 Optional rare-resource contract in battle

Owner, 2026-11-06: *"Players do not get missions associated with other planets, although a faction character can
appear if your star level is above a 2 on wave 3 and present you with the optional contract to collect rare
resources from a currently unlocked planet. Accepting the contract allows you to sell some rare resources without
actually visiting the capital ship for that faction, and the optional contract will resolve at the end of that map."*

- **No cross-planet missions.** The Mission Log only ever holds missions for the planet they were granted on.
- **When:** wave 3 is cleared with **3★ or better** (wave 3's own stars; owner, 2026-11-06). The offer plays in the existing interlude before wave 4 (the
  frozen pre-wave dialog in `main.js` `playPreBattleDialog`), so it never interrupts combat.
- **Who:** a faction whose **capital ship has arrived** (that planet's map 3 won at ≥ 3★). It is never the faction
  being fought on this map. The offer **introduces a new character** (owner, 2026-11-06), and this character is the
  same person who **greets the player and gives them a mission the first time they visit that ship**: the target of
  F4–F6 for that ship. Meeting them in battle is how the player first learns of them.
- **What:** an optional contract to **sell rare resources** from this map to that faction, up to a quota. It uses
  the existing `comm` call and the `contractModal`, which already offers ACCEPT and DECLINE (Dialog-Unification F4).
- **Accept:** rare finds this map count toward the quota, and are paid for when the contract resolves. Without the
  contract the player has to visit that faction's ship to sell them.
- **Decline:** costs nothing, but the offer is gone for this run and must be **re-earned** (3★ on wave 3 again, on a later run). Owner, 2026-11-06.
- **Resolves at the end of the map:** win or lose, the haul is paid and the giver gets the closing line
  (`questClosingDue`, already built). The result screen shows the sale.
- **Built from:** `save/contracts.js` (offer, accept, judge, loyalty), `comm/questBeats.js` (closing), harvest's
  per-tier crediting (`u.cargoMix`), and the workbook for the quota and price (a `Rare_Contracts` sheet beside
  `Collective_Contracts`). All 81 contracts are built (owner: *"propose defaults is fine, create all contracts"*):
  `docs/16 Bulwark MM/design/Rare-Contracts-Design.md`, `MAPDATA.rareContracts`, `src/data/rareContract.js` (PR #172).
- **What changes from 2026-11-02:** that move took the wave-2 faction contract out of battle and made it the
  planet's secondary mission aboard the ship. That stays. This is a separate, **optional**, rare-only offer from
  *another* faction.

Owner, 2026-11-06, on the "unknown contact": *"What unknown contact .. the optional contract which appears only if
you get 3 stars on wave 3 will introduce a new character."* The Orbital Survey prototype's unknown-contact call is
therefore **not** part of any reveal, and the contact favour story (`story_mvajl0pm_11`) is replaced by R11.

## 6. The opening is the first reveal

Owner, 2026-11-06: *"The first opening of the game should be the reveal of the red giant and the Collective ship. On
the Collective ship the mission for Verdance is granted as a contract."*

So a new game opens on a reveal, not on the menu: Vesper, the red giant, is discovered at the galaxy's edge, and the
Long Ledger makes its first-sight arrival there. Aboard, Mira grants the Verdance mission as a contract.

The merged Collective intro already runs most of these beats, but as its own one-off. It becomes the first
reveal, with the same parts:

| Today (`introRunner.js`) | As a reveal |
|---|---|
| Cold open on Vesper, the Long Ledger fly-by, the flank | §5.2 first sight on Vesper's star stage, ending at the upper-left station; then F1 |
| The scan wipe into the rooms, life, Mira flashes, walk to the bar | F2–F4 |
| The conversation and the first contract | F5–F6: Mira's scene, then the **Verdance contract**. ACCEPT grants the Verdance mission, which goes to the Mission Log |
| The Loading Bay transport, "TAP TO LAUNCH", forced departure to Verdance | F7 explore (the Loading Bay shows your transport), F8 depart, then **you survey Verdance** (§5.1): your transport arrives and runs the scan, then PLAY (owner, 2026-11-06) |
| The menu turns to Verdance | The menu shows Verdance with PLAY lit |

The save keeps its fields:

- `collective.launched` becomes `collective.departed`, migrated.
- The resume point after ACCEPT moves from the Loading Bay to F7.

## 7. Skip, accessibility, performance

- **Skip:** Arrival-Design §7's hold-to-skip on every timed beat. It appears after 2 s; tap-and-hold, Space or Esc
  for 0.6 s; accidental taps never skip. Player-paced beats (F4–F8) need no skip.
- **Reduced motion:** cuts and crossfades replace the flies and pans. The scan wipe is instant. The survey shows its
  locked result.
- **Captions** on every line and on the banner. Every interactive element is keyboard-reachable.
- **Interruption:** a hidden tab pauses the timeline and audio; on return it resumes from the start of the current
  beat.
- **GPU:** the reveal owns one full-screen mount while it plays (as `introRunner` does today), and the menu canvas
  pauses under it. Tiers follow Arrival-Design §8.

## 8. Architecture

| Module | New / reuse | Does |
|---|---|---|
| `src/data/discovery.js` | New, pure | The discovery table (§4.1) as gate conditions; `discoveredNow(s)` |
| `src/save/reveals.js` | New, pure | `s.discovered`, `revealSeen`, the queue order (§4.2), migration, skip end-states |
| `src/reveal/director.js` | Lifted from `introRunner.js` | One full-screen mount, the canvas stack, skip, pause-on-hide; plays a list of **segments**, each `{ at(t), stage }` or player-paced |
| `src/reveal/planetReveal.js` | New: segments P0–P6 | Banner; `galaxyStage` ignite; fly-in |
| `src/render3d/planet/surveyArrival.js` | Port of the Orbital Survey arrival and survey (pure) | `arrivalAt(t)`, `surveyAt(t)` → ship pose, camera, beam, sites; node-tested |
| `src/render3d/planet/surveyStage.js` | Port, reuses `globe.js`, `surveyShip.js` hull | Draws P4–P5 |
| `src/render3d/ships/arrival.js`, `arrivalStage.js` | Arrival-Design §8, generalised from `openingStage.js` | First sight of any ship, over a planet or Vesper's star |
| `src/menu/shipPresence.js` | Arrival-Design §8 | The upper-left station, coast-in, idle, tap to board |
| `src/ship-interior/boardTransition.js` | Lifted from `introRunner.js` (beat `open`, launch close) | `board()`, `depart()` over 3D; shared with the hub (Interiors I4) |
| `src/reveal/aboard.js` | Generalises `roomsAt` beats | F1–F8 from a ship's reveal script |
| `content/reveals/<ship>.json` | New data | Per ship: the first character, their room, the scene id, the missions it grants. The Collective's is Mira, the bar, `collective.firstContract`, Verdance maps 1–3 |
| `src/menu/menu.js` | Edit | Plays the queue after the rewards ledger; results-screen lines |
| `galaxyStage.js` | Edit | Uncharted state, ignite parameter |

Tests (node, local suite):

- the discovery table against the mission catalog;
- queue order, migration and skip end-states;
- `surveyArrival` beat boundaries and the locked site;
- `arrival` beat boundaries ending at the station;
- `aboard` beat sequence;
- a reveal never queues in battle.

Headless review (Playwright, swiftshader) at desktop and phone landscape.

## 9. Review page

`tools/reveal/index.html` plays any reveal outside the game, so it can be reviewed without Claude:

- the planet (any of the nine), the ship (any, first sight or seen) and first-time aboard;
- a scrub bar with beat markers;
- `?reduced=1`, `?tier=` and phone frames.

## 10. Stories

| # | Story | Depends on |
|---|---|---|
| R1 | Discovery and the reveal queue: data, save, migration, results-screen lines, uncharted systems in the galaxy | — |
| R2 | Reveal director lifted from `introRunner.js`; the opening still plays unchanged on it | — |
| R3 | Planet reveal P0–P3: banner, ignite, fly-out and fly-in | R1, R2 |
| R4 | Transport arrival and survey scan in the game (P4–P6), ported from the Orbital Survey prototype. Re-scopes `story_mvajkzq1_10` | R3 |
| R5 | Ship station at the upper-left: `shipPresence`, coast-in, idle, tap to board | R1 |
| R6 | Capital ship first sight in the game, for any ship, ending at the station (Arrival-Design stories 1, 2, 5) | R2, R5 |
| R7 | First time aboard F1–F6: flank pan, board, path to the character, scene, missions into the log | R6, Interiors I4, Dialog D1 |
| R8 | Explore and depart F7–F8, and re-boarding from the station | R7, Interiors I5 |
| R9 | The opening re-cut as the first reveal (§6) | R4, R8 |
| R10 | Review page and headless review | R4, R7 |
| R11 | Optional rare-resource contract in battle (§5.5) | Dialog D1 (contract card) |

## 11. Questions for the owner

- **Q1 — Decided 2026-11-06.** The Collective always introduces new planets. A faction's ship arrives when its map
  3 is won at ≥ 3★, and visiting it unlocks then (§5.2).
- **Q2 — Decided 2026-11-08.** The previous planet's map 6 beaten (it was map 3, the capital ship's win; the owner
  moved it to keep the planet and ship reveals apart).
- **Q3 — Decided 2026-11-06.** Not dimmed; tagged UNSURVEYED until surveyed (§4.1).
- **Q4 — Decided 2026-11-06.** There is no unknown contact in the reveal. The optional rare contract (3★ on wave 3)
  introduces a new character, who greets the player and gives a mission on the first visit to that ship (§5.5).
- **Q5 — Decided 2026-11-06.** The game opens on the red giant and the Collective ship; the Verdance mission is granted
  aboard as a contract; then the player departs, surveys Verdance, and presses PLAY.
- **Q6 — Decided 2026-11-06.** Proposed defaults accepted; all 81 contracts built (PR #172). Declining costs nothing
  but the offer must be re-earned.

## 12. As built (PR for R1–R11, 2026-11-06)

What changed from §4–§6 while building, and why:

- **The queue is derived, not pushed.** `save/reveals.js` `revealsDue(s)` reads the save: a planet is due when the
  previous planet's map 6 (`SURVEY_MAP`) is beaten and it is not in `s.reveals.surveyed`; a ship is due when it has arrived and is not
  in `s.reveals.shipSeen`. Nothing is pushed onto `loggedQueue`, so the queue cannot drift from the save, a reload
  replays exactly what was not committed, and old saves need no migration beyond `ensureReveals` (a planet already
  fought on counts as surveyed). The save keys `planetMaps` / `capitalShips` by planet **name** (missionFlow); the
  reveals read either.
- **Verdance's survey is owed by the departure (Q5).** Leaving the Long Ledger (`collective.launched`) makes Verdance
  due; the menu plays it as soon as the opening hands back (`onDone({ depart:'ground', survey:true })`).
- **`ALL_PLANETS_OPEN` does not touch reveals.** The survey follows the map 3 win whether or not the portal gate is
  switched off for testing, so the owner sees the reveal on today's builds.
- **The opening re-cut (R9).** After ACCEPT the bar's lights come up and the player can walk to any room; the Loading
  Bay is marked "YOUR TRANSPORT · TAP TO DEPART" and a DEPART button sits bottom-right. The old forced launch is gone.
- **The ship's station.** Desktop and landscape: the ship's own GLB, idling, drawn by the menu's single 3D canvas into
  the upper-left box over the planet; it coasts in when it first parks. Phone portrait has no room over the planet,
  so the station is a "BOARD THE SHIP ▸" chip. Until a faction ship is met, the Long Ledger holds the station.
- **Results notes.** The results screen has a notes panel: "NEW SIGNAL — Florael discovered…", "CAPITAL SHIP —
  Halbrecht's Oath is inbound…", and the rare contract's settlement.
- **Rare contract (R11).** Offered in the wave-end interlude after wave 3 at 3★+, before the next faction's dialog.
  The contact is the first of the buyer's crew who is not the captain (placeholder pick until the character registry,
  Dialog-Unification). The contact's name is stored in `s.reveals.contacts[planet]` for the first-visit greeting.
  Settlement runs inside the battle's save write, before the inventory banks, so sold units are not also kept.

Placeholders, to be replaced by authored content:

- Faction ships reuse the Long Ledger's room layout (`content/ships/collective/ship-layout.json`) with their own crew.
- The Collective's new-planet line in `content/reveals/reveals.json` waits for Dialog-Unification F5.
- **Follow-up:** the rare contact's greeting and mission on the first visit to that ship (Q4) — the name is stored;
  the greeting beat and its mission need authored lines and a mission row.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/16 Bulwark MM/design/Capital-Ship-Arrival-Design.md | the ship arrival beats, sound, skip rules and return coast-in (§6's corner is changed here to upper-left) |
| depends-on | docs/tech-plan/Capital-Ship-Interior.md | the room view, walk-to, board / depart over 3D and the hub (stories I3–I5) |
| depends-on | docs/tech-plan/Collective-Opening.md | the opening's beats that §6 re-cuts |
| depends-on | docs/tech-plan/Dialog-Unification.md | comm scenes and the character registry the first character comes from |
| depends-on | docs/16 Bulwark MM/tech-plan/Menu-Survey-Galaxy.md | the galaxy view and the camera fly |
| depends-on | docs/16 Bulwark MM/design/Menu-Progression-Design.md | the rewards ledger, token flight and red dots |
| depends-on | docs/tech-plan/Mission-Log.md | missions, gates and `loggedQueue` |
