# Tech Plan — The Collective Opening (Vesper, the capital ship room view, crew, first contract)

**Epic:** `epic_mvo5po8u_4` The Collective trade faction · **Design:** `docs/16 Bulwark MM/design/Collective-Opening-Design.md`
**Status:** v0.1, 2026-11-05, agent-proposed. Not started. Notes and as-built justifications for this epic are recorded
here, not on the tickets.

## 1. Scope

- The red giant **Vesper** as a tenth, unplayable galaxy body.
- The opening cinematic: star → fly-by → flank swing → hull opens → room view → patron flash → bar highlight →
  conversation with holo-slides → contract → transport → launch to Verdance.
- A data-driven **room view** of the Collective capital ship: shells, prop kit and recipes.
- **Characters**: one shared rig, outfit kits, 12 clips, a nav graph and schedules; key faction characters posted in
  their rooms.
- Save state, skip and replay, the later-visit **hub** (bar and bay wired), and the review page.

**Out of scope:**
- Room purposes beyond the bar and bay.
- The full Collective roster.
- Other factions' ship interiors. The system is built so they are data later.
- A recipe editor.
- The music commission.

## 2. Module map

All paths are under `prototype/test-game/` unless they start with `tools/`.

| Module | Kind | Responsibility |
|---|---|---|
| `src/data/galaxy.js` | edit | Add `SYSTEMS.collective = { r: 34, a: 4, y: 7, kind: 'star', playable: false }`. `SYSTEM_KEYS` stays the playable list; new `ALL_SYSTEM_KEYS`. |
| `src/data/vesper.js` | new | Vesper's identity: name, colour ramp, size and label. |
| `src/menu/galaxyStage.js` | edit | Draw Vesper (pulse sprite + gold ring) and the trade lanes to unlocked homeworlds after `introSeen`. Tapping Vesper opens the hub. |
| `src/render3d/star/redGiant.js` | new | Granulation sphere shader, prominence billboards and glare. `createRedGiant(THREE, opts) → { group, update(t), dispose }`. |
| `src/opening/timeline.js` | new | **Pure.** Beat table and `openingAt(t) → { beat, camera, hullOpen, roomDim, flash, ... }`. Same pattern as the arrival design's `arrivalAt`. Unit-testable without GL. |
| `src/opening/openingStage.js` | new | Owns the renderer during the opening: wires the star, ship (existing GLB + `engineFx`/`tugs`), hull-open plates, the room view and the dialog. Pauses the menu canvas. |
| `src/opening/hullOpen.js` | new | Flank plate bands: offset, slide and fade driven by `hullOpen ∈ [0,1]`. |
| `src/ship-interior/rooms.js` | new | **Pure.** Loads and validates `rooms.json`; lays out decks and bays inside the side silhouette; returns room rectangles, prop placements and points of interest. |
| `src/ship-interior/roomShell.js` | new | Parametric shell mesh per room (one merged geometry), theme palette, vertex AO and the sign. |
| `src/ship-interior/propKit.js` | new | Loads `content/ships/interior/props.glb` + atlas; merges static props per room. |
| `src/ship-interior/navGraph.js` | new | **Pure.** Builds the graph from doors, points of interest, corridors and lifts; A* over it; point-of-interest reservation. |
| `src/ship-interior/crew.js` | new | Figures: spawn from `cast.json`, per-character seeded schedule, movement along edges, lift rides, simple pass avoidance, clip selection and crossfade. Own clock and its own `mulberry32` seed (not `sim/rng.js`; presentation only). |
| `src/ship-interior/figures.js` | new | Skinned mesh loading (`content/characters/body.glb`, outfits, clips), outfit sockets, face decals from portraits, LOD update rates. |
| `src/ship-interior/roomView.js` | new | Camera (pan, zoom, focus room), dim/highlight, labels, tap targets, the portrait minimap strip. Reused by the hub. |
| `src/dialog/conversation.js` | new | In-person dialog panel: speaker switches, typewriter, `voice.js`, captions, holo-slide cues, input (click/Space/Enter/hold). Shares typography with `comm/commCard.js`. |
| `src/dialog/holoSlide.js` | new | Projector bloom, Ken Burns / parallax, flicker, cross-dissolve. |
| `src/opening/contractCard.js` | new | First-contract card; reads the Verdance quota from `data/collectiveContract.js`. |
| `src/save/…` (`missionFlow`) | edit | `collective.{introSeen, contractAccepted, transport, faction?}`; milestone resume; mark existing saves as seen. |
| `src/menu/…` | edit | New-save route → opening; "Replay opening" in Settings; one-time prompt for existing saves; "Collective" menu entry → hub. |
| `src/audio/openingAudio.js` | new | Star boil bed, plate clunks, per-room spot ambiences by camera distance, bell and swell, seal stamp. Synthesized from the existing WebAudio helpers. |
| `tools/blender/interior/props.py` | new | Headless Blender prop kit (≈ 40 props), palette materials, one atlas → `props.glb`. |
| `tools/blender/characters/body.py`, `outfits.py`, `clips.py` | new | Body + 17-bone rig, outfit kits per faction, 12 keyed clips → glTF with skinning. |
| `tools/collective/index.html` | new | Review page (design §10). |

### Data files

| File | Holds |
|---|---|
| `content/ships/collective/rooms.json` | Decks, rooms (bays, deck, theme, sign, props with bay-relative positions, points of interest `{id, kind: seat\|stand\|lean\|work\|door, x, facing}`), corridors and lifts. **The owner's room list replaces this file.** |
| `content/ships/collective/cast.json` | Figures: `{id, name?, giver?, faction, outfit, face?, post: {room, poi}, schedule?: [{room, poi, clip, dwell:[min,max]}], seed}`. Key characters reference the Givers sheet by name. |
| `content/dialog/opening.json` | `lines: [{speaker, text, slide?, camera?, clip?}]`, `speakers: {id: {name, title, portrait, voice}}`, `slides: {id: {src, layers?, pan}}`. Placeholder until the owner's transcript. |
| `content/opening/slides/*.webp` | Stills at 1280 px long edge. |

## 3. Key technical choices

1. **Pure timeline + thin stage.** Every beat value comes from `openingAt(t)`. This is the arrival design's pattern:
   tests scrub it headlessly, and the review page's scrub bar is the same function.
2. **The cutaway is its own layer, not the hull's real interior.** The GLB stays as built. The interior is a
   separate group aligned to the side silhouette, drawn after the hull with the flank plates fading over it. No
   change to `collective.py` beyond exporting a side-profile polyline (`content/ships/collective/profile.json`) for
   the interior shell to follow.
3. **Rooms from data.** Shell, props and points of interest all come from `rooms.json`. `rooms.js` validates it
   (bays fit the deck, doors line up with corridors, every point is inside its room) and fails loud on the review
   page. That makes the owner's room list a content edit.
4. **Skinned figures, one material.** three r128 skinning: one draw per figure, shared atlas. Far figures update
   their mixers at 15 Hz on mid tier; off-screen figures stop. No instanced skinning (not in r128).
5. **Presentation determinism.** The crew's own seeded RNG and fixed-step clock (30 Hz) keep the room view
   identical across runs for review and screenshots. It is kept separate from the battle sim so its replay
   contract is untouched.
6. **Dialog reuse.** `voice.js` and the comm-card typography are reused. `conversation.js` is a sibling of
   `commCard.js`, not a mode of it: the comm card is a one-way, timed broadcast, while this is a player-paced,
   multi-speaker scene.
7. **Loading.**
   - Stills, the prop kit and the figure GLBs stream during beats 1–5.
   - The room view waits on them at beat 4 with a short hold on the closed flank if needed.
   - Budget ≈ 1.5 MB stills, ≈ 0.4 MB props, ≈ 0.6 MB figures + clips, ≈ 2.5 MB in total.

## 4. Tests (node --test, local suite)

| Test | Checks |
|---|---|
| `opening/timeline.test.mjs` | Beats in order and contiguous; skip from beat 3 lands on beat 7; reduced motion swaps dollies for cuts; flash ≤ 3 Hz. |
| `ship-interior/rooms.test.mjs` | `rooms.json` validates; every room fits its deck; every point of interest is inside its room; every room reachable from every other. |
| `ship-interior/navGraph.test.mjs` | A* across decks via lifts; reservation prevents two figures on one seat. |
| `ship-interior/crew.test.mjs` | Same seed → same positions at t = 60 s; nobody leaves the graph; key characters return to their post. |
| `data/galaxy.test.mjs` (edit) | Vesper exists, is not in `SYSTEM_KEYS`, and does not overlap any homeworld marker. |
| `dialog/conversation.test.mjs` | Line advance, hold to finish typing, slide cues, captions always on. |
| save tests (edit) | `introSeen` written on ACCEPT; resume after ACCEPT goes to the transport beat; existing saves are marked seen. |

Headless review uses Playwright + swiftshader on `tools/collective/index.html`. It takes screenshots at beats 1, 3, 5, 7
and 8 in desktop, phone portrait and phone landscape frames, and checks the draw count against §8 of the design.

## 5. Story breakdown

| # | Story | Depends on |
|---|---|---|
| S1 | Vesper in the galaxy + red giant renderer | — |
| S2 | Opening timeline + stage: star, fly-by, flank swing, hull opening | S1 |
| S3 | Room view: `rooms.json`, shells, prop kit, camera, dim/highlight | — |
| S4 | Characters: body, rig, outfits, 12 clips (Blender pipeline) | — |
| S5 | Crew life: nav graph, schedules, cast placement incl. key faction characters | S3, S4 |
| S6 | Bar beat + conversation + holo-slides (placeholder script) | S3 |
| S7 | Contract, transport bay, launch and hand-off; save, skip, replay; existing saves | S2, S6 |
| S8 | Collective hub on later visits (bar + bay wired) | S5, S7 |
| S9 | Opening sound | S2, S6 |
| S10 | Review page + headless review across tiers and phone frames | S2, S5, S6 |

## 6. Risks

| Risk | Mitigation |
|---|---|
| 40 skinned figures on mid phones | Tiered counts (40 / 30 / 18), 15 Hz far updates, off-screen stop; measure on the review page. |
| Room readability at whole-ship zoom on phone portrait | Portrait framing on the bar's third + minimap strip; big-head proportions. |
| Owner room list arrives after S3 | Rooms are data; S3 tests validate any list. |
| Script arrives late | Placeholder lines in `opening.json`; the transcript is a content swap. |

## 7. Notes

- 2026-11-05: plan written alongside the design. No room-module list was found anywhere, so `rooms.json` starts from
  design §4.2.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| implements | docs/16 Bulwark MM/design/Collective-Opening-Design.md | the experience, beats, rooms, cast and open decisions |
| depends-on | docs/16 Bulwark MM/design/Capital-Ship-Arrival-Design.md | the arrival timeline pattern, engine FX, the red-giant variant and the coast-in |
| depends-on | docs/16 Bulwark MM/tech-plan/Menu-Survey-Galaxy.md | the galaxy stage and the galaxy-to-planet fly |
