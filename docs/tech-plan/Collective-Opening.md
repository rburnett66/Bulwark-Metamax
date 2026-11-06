# Tech Plan — The Collective Opening (Vesper, The Long Ledger room view, crew, first contract)

**Epic:** `epic_mvo5po8u_4` The Collective trade faction · **Design:** `docs/16 Bulwark MM/design/Collective-Opening-Design.md`
**Status:** v0.2, 2026-11-05, agent-proposed. Not started. Notes and as-built justifications for this epic go here, not
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
- **The room view, ported from the Long Ledger prototype** (artifact `S9B7GgVN7XcRDBTSF7BVth`), with its pre-rendered
  cutaway replaced by **rooms built from three.js primitives**. The owner expects the faction ships to be revised.
- **Crew**: the prototype's rig, helmets and pose machine, plus legs, sit / sit-drink / work / flash poses, room posts,
  a lift and a seeded RNG.
- Save, skip and replay; the hub on later visits (Bar + Loading Bay wired); the review page.

**Out of scope:**
- Room purposes beyond the Bar and the Loading Bay.
- The Bar's standing-choice conversation with Dorian Quell.
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
| `src/ship-interior/layout.js` | new | **Pure.** Loads and validates `ship-layout.json` in the prototype's export shape (`{floors, rooms}`, with each room's `id, name, fac, cap, who, line, flag, acts / choices, unlock, x, top, w, h, fx, floor` plus the new `props` and `skin`). Snaps rooms to floors, finds shared walls for door gaps, and returns the lanes. |
| `src/ship-interior/primitiveRooms.js` | new | Builds each room's shell (back wall, floor slab + top strip, ceiling + light strip, side walls with door gaps, sign plate, state frame) and props from primitive recipes and presets. Merges static props per room (vertex colours) plus one glow geometry. Also builds the primitive hull frame. `buildRooms(THREE, layout) → { group, rooms: Map<id, {frame, setState(normal / dim / highlight / locked)}> }`. |
| `src/ship-interior/crew.js` | new (port) | The prototype's `makeChar`, `makeHelmet`, `FACTIONS`, `cfgFor`, `POSE`, `drivePose`, depth layers and lane walkers, moved into a module. **Adds** hip pivots + leg swing; `sit`, `sit-drink`, `work` and `flash` poses; turn-to-camera; room posts; lift rides; a seeded RNG (mulberry32, presentation only, never `sim/rng.js`). Merges each figure's static meshes per material at spawn. |
| `src/ship-interior/roomView.js` | new (port) | The prototype's stage: orthographic 100 × 56.25 camera, hotspots, flags, locks + toast, walk-to-room, the board / depart scan and shuttle, dim / highlight, drag-to-pan and the phone minimap. Reused by the hub. |
| `src/ship-interior/layoutEditor.js` | new (port) | The prototype's editor (drag rooms, resize, stand spots, floor lines, Copy / Download `ship-layout.json`). Loaded only on the review page and with `?edit=1`. |
| `src/dialog/conversation.js` | new | Player-paced dialog. A 3D close-up of the speaker (the prototype's modal scene), typewriter, `voice.js`, captions, speaker swaps, holo-slide cues, input. Shares typography with `comm/commCard.js`. |
| `src/dialog/holoSlide.js` | new | Projector bloom, Ken Burns / parallax, flicker, cross-dissolve. |
| `src/opening/contractCard.js` | new | First-contract card; reads the Verdance quota from `data/collectiveContract.js`. |
| save / `missionFlow` | edit | `collective.{introSeen, contractAccepted, transport, faction?}`; milestone resume; mark existing saves as seen. |
| menu | edit | New-save route → opening; "Replay opening" in Settings; a one-time prompt for existing saves; a "Collective" entry → hub. |
| `src/audio/openingAudio.js` | new | Star bed, scan hum + clunks, per-room spot ambiences by camera distance, bell, swell, seal stamp. Synthesized. |
| `tools/collective/index.html` | new | Review page: the room view with the editor, an opening scrub bar, a crew board (all helmets × all poses), tier / reduced-motion / phone frames. |

### Data files

| File | Holds |
|---|---|
| `content/ships/collective/ship-layout.json` | Seeded from the prototype's `ROOMS` and `FLOORS` (7 rooms, 3 decks), plus per-room `props` (primitive recipes or a preset name) and `skin: 'primitive'`. Edited with the layout editor. |
| `content/ships/collective/crew.json` | Ambient crew: `{fac, deck, role?: 'civilian' \| 'crew', seed}`. Key characters come from the rooms' `fac`, `who` and `cap`. The opening override puts Mira Valcourt at the bar. |
| `content/dialog/opening.json` | `lines: [{speaker, text, slide?, camera?, pose?}]`, `speakers`, `slides`. Placeholder until the owner's transcript. |
| `content/opening/slides/*.webp` | Stills at 1280 px. |

## 3. Key technical choices

1. **Port, don't rebuild.** The prototype already proves:
   - the stage, the hotspots and the walk-to-room flow;
   - the crew and their depth layering;
   - locks, the scan wipe and the editor.

   The work is to move its single-file code into modules, swap the backdrop image for primitives, and add what the
   opening needs.
2. **The layout is the contract between authoring and drawing.** `ship-layout.json` (the editor's own export) drives
   the hotspots, the walk lines and the primitive rooms. `layout.js` validates it (rooms inside the frame, every room on
   a floor, stand spots inside their room, no overlapping rooms on one deck) and fails loud on the review page.
3. **Primitives in the same orthographic frame.** The rooms are built in the prototype's 100 × 56.25 world, so the %
   layout and the crew code carry over unchanged.
   - Floors read through a lighter top strip, not a tilted camera.
   - A room is about 4 draws; the ship is about 30.
   - `skin` leaves room for image or model rooms later without touching layout or crew.
4. **Figures merged per material.** The prototype draws about 40 meshes per figure. At spawn, the static parts under
   each pivot group are merged per material, giving about 6 draws a figure with the pivots intact.
5. **Presentation determinism.** Crew use their own seeded RNG and a fixed 30 Hz step, so the room view repeats exactly
   across runs. This is separate from the battle sim's replay contract.
6. **The 3D GLB only for the fly-by.** Beats 1–3 use the current Collective model. The scan wipe hands over from its
   side view to the primitive cutaway, as the prototype hands over from `exterior.jpg`. When the ship is revised, only
   the fly-by model changes.

## 4. Tests (node --test, local suite)

| Test | Checks |
|---|---|
| `opening/timeline.test.mjs` | Beats in order and contiguous; skip from beat 3 lands on beat 7; reduced motion swaps pushes for cuts; flash ≤ 3 Hz. |
| `ship-interior/layout.test.mjs` | The committed layout validates; the prototype's 7 rooms and 3 floors load; door gaps are found between neighbours; a broken layout is refused with the room named. |
| `ship-interior/primitiveRooms.test.mjs` | Every room builds; draw count ≤ 4 per room; a locked room gets the locked state; `setState('highlight')` dims the others. |
| `ship-interior/crew.test.mjs` | Every faction helmet builds; every pose including sit / work / flash drives without NaN; same seed → same positions at t = 60 s; key characters stay at their posts; at most 16 per deck lane; ≤ 8 draws per merged figure. |
| `data/galaxy.test.mjs` (edit) | Vesper exists, is not in `SYSTEM_KEYS`, and does not overlap any homeworld marker. |
| `dialog/conversation.test.mjs` | Line advance, hold to finish typing, slide cues, captions always on. |
| save tests (edit) | `introSeen` written on ACCEPT; resume after ACCEPT goes to the transport; existing saves are marked seen. |

**Headless review.** Playwright + swiftshader on `tools/collective/index.html`. Screenshots at beats 1, 3, 5, 7 and 8,
in desktop, phone portrait and phone landscape frames.

## 5. Story breakdown

| # | Story | Depends on |
|---|---|---|
| S1 | Vesper in the galaxy + red giant renderer | — |
| S2 | Opening timeline + stage: star, fly-by, swing to the flank, scan wipe into the room view | S1, S3 |
| S3 | Room view from primitives: port the prototype stage and editor, `ship-layout.json`, primitive rooms and hull | — |
| S4 | Crew: port the prototype rig, add legs, sit / sit-drink / work / flash, turn-to-camera, merged figures | — |
| S5 | Crew life: room posts, ambient deck crew, lift, seeded schedules, the opening cast (Mira at the bar) | S3, S4 |
| S6 | Bar beat + conversation + holo-slides (placeholder script) | S3, S4 |
| S7 | Contract, Loading Bay transport, depart to Verdance; save, skip, replay; existing saves | S2, S6 |
| S8 | Hub on later visits (Bar + Loading Bay wired) | S5, S7 |
| S9 | Opening sound | S2, S6 |
| S10 | Review page + headless review across tiers and phone frames | S2, S5, S6 |

## 6. Risks

| Risk | Mitigation |
|---|---|
| Primitive rooms read as placeholder | Toned colours, light strips, a sign per room, and props chosen to name the room at a glance. The review page lets the owner judge early (S3 lands first). |
| Prototype figure draw counts on phones | Merge per material at spawn (≈ 6 draws a figure); tier counts 20 / 20 / 12. |
| Phone portrait readability | Deck-width fit with drag to pan, and a minimap strip; beats 3–4 frame the bar's side. |
| Owner revises the room list | It is the editor's export; layout tests validate any list. |
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

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| implements | docs/16 Bulwark MM/design/Collective-Opening-Design.md | the experience, beats, rooms, cast and open decisions |
| depends-on | docs/16 Bulwark MM/design/Capital-Ship-Arrival-Design.md | the arrival timeline pattern, engine FX, the red-giant variant and the coast-in |
| depends-on | docs/16 Bulwark MM/tech-plan/Menu-Survey-Galaxy.md | the galaxy stage and the galaxy-to-planet fly |
