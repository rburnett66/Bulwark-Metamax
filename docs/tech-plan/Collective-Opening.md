# Tech Plan — The Collective Opening (Vesper, the cinematic, the bar beat, the first contract)

**Epic:** `epic_mvo5po8u_4` The Collective trade faction · **Design:** `docs/16 Bulwark MM/design/Collective-Opening-Design.md`
**Status:** v0.4, 2026-11-05. S1 and beats 0–3 merged (PR #164). Beats 4–8 play in the game as a prototype (`story_mw4d1bsw_q`). Notes and as-built justifications for this epic go here, not
on the tickets.

## 1. Scope

- The red giant **Vesper** as a tenth, unplayable galaxy body.
- The opening, in order:
  1. star;
  2. fly-by (the current Collective GLB);
  3. swing to the flank;
  4. scan wipe into the room view;
  5. patron flash;
  6. bar highlight;
  7. conversation with holo-slides;
  8. contract;
  9. Loading Bay transport;
  10. depart to Verdance.
- Driving the room view and crew for the opening: room dim / highlight, the patron's `flash` / `turn` / `sit-drink`, and
  the camera.
- Save, skip and replay of the opening; the opening review page.

**Out of scope (own plans):**
- The room view, primitive rooms, layout editor and hub: `Capital-Ship-Interior.md`.
- The crew rig, poses and crew life: `Ship-Crew-Characters.md`.
- Reply choices, standing and locks, including the Bar's standing-choice conversation with Dorian Quell:
  `Dialog-Response-Reputation.md`.

**Out of scope (later):**
- Other factions' ship interiors (their layouts are data later).
- Room skins other than primitive.
- The music commission.

## 2. Module map

All paths are under `prototype/test-game/` unless they start with `tools/`.

| Module | Kind | Responsibility |
|---|---|---|
| `src/data/galaxy.js` | edit | Add `SYSTEMS.collective = { r: 34, a: 4, y: 7, kind: 'star', playable: false }`. `SYSTEM_KEYS` stays the playable list; new `ALL_SYSTEM_KEYS`. |
| `src/menu/galaxyStage.js` | edit | Draw Vesper (pulse sprite + gold ring) and the trade lanes after `introSeen`. Tapping it opens the hub. |
| `src/render3d/star/redGiant.js` | new | Granulation sphere, prominences, glare. `createRedGiant(THREE, opts) → { group, update(t), dispose }`. |
| `src/opening/timeline.js` | new | **Pure.** Beat table and `openingAt(t) → { beat, camera, scan, roomDim, flash, ... }`. The arrival design's `arrivalAt` pattern. |
| `src/opening/openingStage.js` | new | Owns the renderer during the opening. Wires the star, the ship GLB (+ `engineFx` / `tugs`), the scan wipe, the room view and the dialog. Pauses the menu canvas. |
| `src/ship-interior/*` | — | **Owned by `Capital-Ship-Interior.md`** (`layout`, `primitiveRooms`, `hull`, `roomView`, `layoutEditor`) and **`Ship-Crew-Characters.md`** (`crew`, `closeUp`). The opening drives them: it sets room states (dim / highlight), the patron's `flash` and `turn`, and the camera. |
| `src/dialog/conversation.js` | new | Player-paced dialog. A 3D close-up of the speaker (the prototype's modal scene), typewriter, `voice.js`, captions, speaker swaps, holo-slide cues, input. Shares typography with `comm/commCard.js`. |
| `src/dialog/holoSlide.js` | new | Projector bloom, Ken Burns / parallax, flicker, cross-dissolve. |
| `src/opening/contractCard.js` | new | First-contract card; reads the Verdance quota from `data/collectiveContract.js`. |
| save / `missionFlow` | edit | `collective.{introSeen, contractAccepted, transport, faction?}`; milestone resume; mark existing saves as seen. |
| menu | edit | New-save route → opening; "Replay opening" in Settings; a one-time prompt for existing saves; a "Collective" entry → hub. |
| `src/audio/openingAudio.js` | new | Star bed, scan hum + clunks, per-room spot ambiences by camera distance, bell, swell, seal stamp. Synthesized. |
| `tools/collective/index.html` | new | Review page (as built: `tools/ship-interior/` for the room view, `tools/opening/` for beats 0–3, the game's `?intro=1` for the whole intro): the room view with the editor, an opening scrub bar, a crew board (all helmets × all poses), tier / reduced-motion / phone frames. |

### Data files

| File | Holds |
|---|---|
| `content/ships/collective/ship-layout.json`, `crew.json` | Defined in `Capital-Ship-Interior.md` §3.1 and `Ship-Crew-Characters.md` §3.3. |
| `content/dialog/opening.json` cast override | Puts Mira Valcourt on a bar stool (`sit-drink`) for the opening, in place of the room's standing occupant. |
| `content/dialog/opening.json` | `lines: [{speaker, text, slide?, camera?, pose?}]`, `speakers`, `slides`. Placeholder until the owner's transcript. |
| `content/opening/slides/*.webp` | Stills at 1280 px. |

## 3. Key technical choices

1. **Pure timeline + thin stage.** Every beat value comes from `openingAt(t)` (the arrival design's `arrivalAt`
   pattern), so tests scrub it headlessly and the review page's scrub bar is the same function.
2. **The opening drives, it does not own.** Rooms, crew and the hub belong to `Capital-Ship-Interior.md` and
   `Ship-Crew-Characters.md`. The opening only sets room states, the patron's poses and the camera through their APIs.
3. **Conversation panel.** `src/dialog/conversation.js` is built here (player-paced, typed lines, voice, holo-slides).
   Response mode (replies with effects) is added by `Dialog-Response-Reputation.md`.
4. **The cast override.** The opening seats Mira Valcourt at the bar for the first run only; later visits use the
   layout's occupant.
5. **The 3D GLB only for the fly-by.** Beats 1–3 use the current Collective model. The scan wipe hands over from its
   side view to the primitive cutaway, as the prototype hands over from `exterior.jpg`. When the ship is revised, only
   the fly-by model changes.

## 4. Tests (node --test, local suite)

| Test | Checks |
|---|---|
| `opening/timeline.test.mjs` | Beats in order and contiguous; skip from beat 3 lands on beat 7; reduced motion swaps pushes for cuts; flash ≤ 3 Hz. |
| `data/galaxy.test.mjs` (edit) | Vesper exists, is not in `SYSTEM_KEYS`, and does not overlap any homeworld marker. |
| `dialog/conversation.test.mjs` | Line advance, hold to finish typing, slide cues, captions always on. |
| save tests (edit) | `introSeen` written on ACCEPT; resume after ACCEPT goes to the transport; existing saves are marked seen. |

**Headless review.** Playwright + swiftshader on `tools/collective/index.html`. Screenshots at beats 1, 3, 5, 7 and 8,
in desktop, phone portrait and phone landscape frames.

## 5. Story breakdown

| # | Story | Depends on |
|---|---|---|
| S1 | Vesper in the galaxy + red giant renderer | — |
| S2 | Opening timeline + stage: star, fly-by, swing to the flank, scan wipe into the room view | S1, I1 |
| S3 → I1 | Room view from primitives — moved to the Capital Ship Interiors epic (`Capital-Ship-Interior.md`) | — |
| S4 → I2 | Crew rig port and new poses — moved (`Ship-Crew-Characters.md`) | — |
| S5 → I3 | Crew life — moved (`Ship-Crew-Characters.md`) | I1, I2 |
| S6 | Bar beat + conversation + holo-slides (placeholder script) | I1, I2 |
| S7 | Contract, Loading Bay transport, depart to Verdance; save, skip, replay; existing saves | S2, S6 |
| S8 → I5 | Hub on later visits — moved (`Capital-Ship-Interior.md` §5.4) | I3, S7 |
| S9 | Opening sound | S2, S6 |
| S10 | Review page + headless review across tiers and phone frames | S2, I3, S6 |

## 6. Risks

| Risk | Mitigation |
|---|---|
| Phone portrait readability | Deck-width fit with drag to pan, and a minimap strip; beats 3–4 frame the bar's side. |
| Script arrives late | Placeholder lines in `opening.json`; the transcript is a content swap. |

## 7. Notes

- **2026-11-05, v0.1.** Written with an invented 15-room list and a Blender character pipeline, because no room list was
  found in the repo or on the board.
- **2026-11-05, v0.2.** The owner pointed to the Long Ledger prototype, which already has the rooms and animated crew
  for each faction, and asked for primitive rooms instead of its per-faction base image, since the faction ships will be
  revised. Changes:
  - The room list is now the prototype's seven rooms.
  - The Blender rig, outfits and prop kit are dropped; the stories S3–S5 are rewritten.
  - The patron is Factor Mira Valcourt, per the Dossier.
- **2026-11-05, v0.3.** The room view, crew and reply/standing work were each given their own tech plan, built from the
  prototypes as they are:
  - `Capital-Ship-Interior.md` and `Ship-Crew-Characters.md`, on the new Capital Ship Interiors epic;
  - `Dialog-Response-Reputation.md`, on its existing epic.

  S3, S4, S5 and S8 moved to the interiors epic. This plan keeps the opening: Vesper, the cinematic, the bar beat, the
  conversation, the contract, the transport and save.
- **2026-11-05, as built (PR #164).** Vesper (S1) and beats 0–3 of the opening (S2) are built, with a standalone
  review page at `tools/opening/`. Deviations from the design:
  - **The flank is shot from starboard, not port.** The ship flies bow-first along +X, so from starboard the bow is on
    the right. That matches the room view, where the stern is on the left. Vesper hangs off the port side, behind the
    ship.
  - **The fly-by lens is 135 mm** throughout beats 1–2 and eases to **105 mm** for the flank.
  - **Timing.** The ship crosses at 0.12 L/s.
  - **Vesper is its own export, not a `SYSTEMS` row.** `galaxy.js` exports `VESPER` and `vesperPos()`, so
    `SYSTEMS` and `SYSTEM_KEYS` stay the nine homeworlds and no `ALL_SYSTEM_KEYS` is needed. Its galaxy label is not
    tappable yet; tapping it opens the hub once the hub exists (I5).

  Still to come: beat 4 onward, which waits on the room view (I1), and the galaxy's trade lanes, which wait on
  `collective.introSeen` (S7).
- **2026-11-05, the intro in the game (prototype)** (`feat/collective-intro-ingame`, story `story_mw4d1bsw_q`).
  > **owner**: "We need to put the prototype in the game" … "Do rooms and capital ship presentation for collective intro
  > only as in game prototype"

  - **Entry.** Tap VESPER in the menu's galaxy view, or open the game with `?intro=1` (`&introT=<s>` starts later).
    It is not yet the new-save route (S7).
  - **`src/opening/introRunner.js` `playIntro`.** A full-screen overlay with two canvases: the 3D shot
    (`openingStage`) under the room view (Capital-Ship-Interior I1). The scan wipe is the prototype's: a
    left-to-right `clip-path` on the room canvas behind a cyan line, not a shader pass. Both canvases pause when the
    tab hides, and the menu's own 3D pauses under the overlay.
  - **Timeline.** `SHIP_UNTIL` is 40 (the 3D camera holds the flank); `BUILT_UNTIL` is 63 (the timed beats).
    `roomsAt(t)` gives the scan, the flash (two pulses at 56.4 s and 57.0 s, then a soft glow), the dim and
    highlight, the camera focus, the prompt, and auto-enter at 66 s. Skip lands on the bar.
  - **Beat 8.** The avatar walks into the bar, the camera pushes in, and Mira turns. A placeholder line card
    ("PROTOTYPE") stands in for the conversation panel (S6). CONTINUE or ✕ returns to the menu.
  - **Phone portrait.** The camera holds the bar's side from beat 5 and pushes in closer (design §8).

  Not yet:
  - the conversation and holo-slides (S6);
  - the contract, transport, save and replay (S7);
  - sound (S9);
  - the scan wipe peeling the 3D hull itself: the room view's hull is a stylised cutaway, not the GLB's profile.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| implements | docs/16 Bulwark MM/design/Collective-Opening-Design.md | the experience, beats, rooms, cast and open decisions |
| depends-on | docs/16 Bulwark MM/design/Capital-Ship-Arrival-Design.md | the arrival timeline pattern, engine FX, the red-giant variant and the coast-in |
| depends-on | docs/16 Bulwark MM/tech-plan/Menu-Survey-Galaxy.md | the galaxy stage and the galaxy-to-planet fly |
| depends-on | docs/tech-plan/Capital-Ship-Interior.md | the room view, primitive rooms, hub, layout and editor |
| depends-on | docs/tech-plan/Ship-Crew-Characters.md | the figures, poses (incl. flash / turn / sit-drink) and crew life |
| depends-on | docs/tech-plan/Collective-Faction.md | the Collective as a faction, its cast, and the Verdance map 1 contract the opening hands over |
