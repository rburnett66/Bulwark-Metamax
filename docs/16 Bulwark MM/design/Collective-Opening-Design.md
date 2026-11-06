# The Collective Opening — Vesper, The Long Ledger, the room view and the first contract

**v0.2, 2026-11-05.** Owner sentences are quoted and marked **owner**. Everything else is **agent-proposed** and open to
correction. Epic `epic_mvo5po8u_4` (The Collective trade faction). Tech plan: `docs/tech-plan/Collective-Opening.md`.

**Sources:**
- the owner's requests of 2026-11-05;
- `Capital-Ship-Arrival-Design.md`, which this extends;
- `Menu-Survey-Galaxy.md` (the galaxy);
- the Collective ship build (`tools/blender/ships/collective.py`, LOD0–2 GLBs);
- the **Bulwark Capital Ship** prototype ("The Long Ledger", artifact `S9B7GgVN7XcRDBTSF7BVth`, 2026-10-27): rooms, decks, live three.js crew, faction helmets, poses, the walk-to-room and dialog flow, standing locks, the board/depart scan and the layout editor;
- the **Bulwark Character Sheet** artifact (`MBrTStmqgULyFM4XFkj5jM`): the shared rig, civilians, roles and the emote set;
- the **Bulwark Dossier** artifact (`VFU7kuFB51N61M9YChgeb9`): the nine Collective officers;
- the comm-card dialog and procedural voice (`src/comm/`);
- the Collective contract economy.

> **owner**: "we should add the collective capital ship and the red giant it orbits as a new unplayable planet. The
> red giant will also need to be added to the galaxy, not to far from verdance maybe at the edge of the galaxy. The
> player will be first introduced to the game at the collectives capital ship where we will be presented the
> animated slide show and dialog which gives the player their first contract and transport ship."
>
> **owner**: "The conversation will occur at the bar on the collectives capital ship .. the introduction to the game
> will include presentation of the red giant, the fly by of the collective ship .. the camera path to the ships
> side .. then the presentation of the collectives room modules view .. the character sitting in the bar will flash
> then the bar will appear highlighted and the dialog with the patron appears letting the user clicks through the
> conversation."
>
> **owner**: "We will need the new planet, the introduction of the capital ship, the camera to the side view. We will
> also need a way to draw each of the room modules we have already listed, and we will need to populate the key
> faction characters in appropriate rooms. This will include the characters and crew walking around and animating."
>
> **owner** (v0.2): "You already have a prototype with animated characters and crew for each faction. The prototype
> assumes there is a base image for each faction. I expect the faction ships to be revised so for now I would prefer
> to mockup rooms with primitives."

## What changed in v0.2

- **Rooms.** The room list is the Long Ledger prototype's seven rooms on three decks, not an invented list. Rooms are
  **mocked up with three.js primitives** instead of the prototype's pre-rendered base image (`cutaway.jpg`), because
  the faction ships will be revised.
- **Characters.** Crew and key characters reuse the prototype's rig, faction helmets and pose machine. The Blender
  character pipeline is dropped.
- **Names.** The ship is **The Long Ledger**. The patron is **Factor Mira Valcourt**, who per the Dossier "gives you
  the ship and the opening contract". The invented names from v0.1 (Ottoline Crane, Mags Tolliver, the Ember Room,
  Collective Anchorage, Embassy Row) are withdrawn.

---

## 0. Reading of the request

1. **A tenth body in the galaxy, not a battlefield.** The red giant has no maps, no survey and no campaign. Its only
   content is The Long Ledger in orbit, which is the player's first employer and hub.
2. **The game opens there.** On a new save:
   - the red giant;
   - The Long Ledger flies by;
   - the camera swings to the ship's flank;
   - the hull opens into the room view with crew moving in it;
   - the patron seated at the bar flashes and the bar lights up;
   - a click-through conversation gives the first contract and a transport;
   - the player goes to Verdance.
3. **The "animated slide show"** is the owner's opening material, kept as stills (owner, earlier: "my plan was to take
   snap shots and present text"). It is presented *inside* the bar conversation as holo-slides (§6.3). Q3 offers a
   prologue instead.
4. **The room view is a lasting place.** It is the hub the prototype already sketches ("Collective capital ship · your
   hub — click a room to walk in"). The opening is the first time the player sees it.
5. **Primitives now, art later.** Every room is drawn from boxes, cylinders, spheres and planes driven by the layout
   data. When a faction's ship is revised, its rooms can take a rendered or modelled skin without changing the
   layout, the crew or the flow (§4.5).

---

## 1. What exists today

| Piece | Where | State |
|---|---|---|
| **Hub prototype — The Long Ledger** | Artifact `S9B7GgVN7XcRDBTSF7BVth` (not in the repo) | Built as a review page. A pre-rendered cutaway image with hotspot rooms on three deck floors, and a live three.js orthographic crew layer on top. Your gold avatar walks to a clicked room, then a dialog opens with a 3D close-up of the occupant. It also has faction-standing locks, a board/depart scan wipe from an exterior image, and a layout editor that exports `ship-layout.json` (`{floors, rooms}`). |
| **Crew rig** | Same prototype + Character Sheet artifact | A primitive humanoid (the Project City foreman) with a vest, stripes and a per-faction helmet. There are ten faction helmets plus the captain's cap, a hard hat and a beanie. An 8-state pose machine covers idle, walk, talk, point, wave, salute, angry and celebrate. Civilians and roles are also defined. |
| **Collective officers** | Dossier artifact | Nine officers by alignment. Factor Mira Valcourt (G) gives the ship and opening contract. Supercargo Dorian Quell (CG) is her boss, met at the capital-ship unlock. Seven more complete the ladder. |
| Collective capital ship model | `tools/blender/ships/collective.py` → `content/ships/collective_lod{0,1,2}.glb` | Built. Ivory ≈ 540 m hull. Used for the fly-by. Will be revised with the other faction ships. |
| Arrival cinematic design | `Capital-Ship-Arrival-Design.md` | Designed, not built. §5 puts the Collective arrival above a red giant as the game's opening. |
| Engine FX, tugs, shots | `src/render3d/ships/` | Built (viewer). |
| Galaxy | `src/data/galaxy.js`, `menu/galaxyStage.js` | Built. Nine homeworlds; Verdance at r 22, 18°. |
| Dialog | `src/comm/commCard.js`, `voice.js`, 81 portraits | Built for one-way in-battle transmissions. |
| Collective economy | Contract quota per map and tier | Built. |

---

## 2. The opening at a glance

First launch, new save. About 70 s before the conversation; the conversation is player-paced.

| # | Beat | Time | What the player sees | Hands-on |
|---|---|---|---|---|
| 0 | **Cold open** | 0–3 s | Black. Comm static; caption "THE LONG LEDGER · VESPER". | — |
| 1 | **The red giant** | 3–14 s | Vesper fills the frame: boiling granulation, prominences off the limb. Long lens, almost still. | — |
| 2 | **Fly-by** | 14–30 s | The Long Ledger crosses the star's face bow-first, silhouetted, then lit red as it passes. Tugs peel away. Arrival design §3 beats 2–5 with the §5 variant. | — |
| 3 | **Swing to the flank** | 30–40 s | The camera matches speed and arcs to the port beam, flattening to a long-lens side view. The ship fills the width, bow right. | — |
| 4 | **The hull opens** | 40–46 s | The prototype's scan line sweeps the hull and peels the plating away behind it, revealing the primitive cutaway: three decks of lit rooms. | — |
| 5 | **Life inside** | 46–56 s | Crew walk the decks, gesture, talk, salute; officers work in their rooms. Slow drift. | Drag to look around. |
| 6 | **The patron** | 56–60 s | In the bar, Mira Valcourt sits at the counter. She **flashes**: two gold pulses and a chevron. | — |
| 7 | **The bar** | 60–63 s | Every other room dims; the bar's frame glows gold; label "THE BAR — TAP TO ENTER". | **Tap the bar** (auto after 6 s idle). |
| 8 | **The conversation** | player-paced | Your avatar walks in (prototype flow); the camera pushes in; Mira turns to you. The dialog panel opens: 3D close-up, name, typed lines, voice. Holo-slides rise from the counter. | Click / tap / Space; hold to fast-type. |
| 9 | **The contract** | — | Contract card: terms, the Collective seal, ACCEPT. | **Accept.** |
| 10 | **The transport** | ≈ 8 s | The camera drops to the **Loading Bay**. Your transport (a primitive mock until its art lands) sits in the clamps. | Pick your colours (if Q5). |
| 11 | **Departure** | ≈ 6 s | The prototype's depart flow: the hull closes, your shuttle leaves; cut to the galaxy, Vesper → Verdance. | — |
| 12 | **Hand-off** | — | Verdance planet screen; map 1 ready. | Play. |

Beats 0–7 can be skipped from beat 3 on a first run, and at any time on replays (§9). The conversation is never
skipped on a first run, because it carries the premise and the contract; lines can be fast-typed.

---

## 3. Vesper, the red giant

| Field | Proposal |
|---|---|
| Name | **Vesper** (Q2). |
| Kind | `star`. No battles, survey or resources. |
| Playable | `false`. It never appears in the faction picker, the campaign list or the inventory planets. |
| Look | Deep red-orange (≈ 3,200 K), huge, slow granulation, a darker limb, prominences. It is the key light for everything near it. |
| Galaxy marker | A larger, pulsing red point with a thin gold ring. Label: "Vesper · The Long Ledger". |

**Placement.** Owner: "not to far from verdance maybe at the edge of the galaxy". Two options:

| Option | Position | Effect |
|---|---|---|
| **A (recommended)** | r 34, 4°, y +7: just off Verdance's arm segment, lifted above the disc. | Close to Verdance, and it reads as outside the spiral. |
| B | r 97, 18°, y +2: the true rim, on Verdance's bearing. | The literal edge, but a long first flight and far from every later planet. |

After the opening, faint gold trade lanes run from Vesper to every unlocked homeworld.

**Rendering.** A granulation-shader sphere, 2–3 looping prominence billboards and a broad soft glare instead of a
lens flare. Three draws. In the galaxy it is a pulse sprite plus the ring.

---

## 4. The room view — primitives on the prototype's layout

### 4.1 What carries over from the prototype, and what changes

| Kept as built | Replaced |
|---|---|
| The 100 × 56.25 orthographic stage, the % layout and the deck walk lines (`FLOORS`) | `cutaway.jpg` → rooms built from primitives (§4.3) |
| The `ROOMS` record (`id, name, fac, cap, who, line, flag, acts / choices, unlock, x, top, w, h, fx, floor`) | `exterior.jpg` → the 3D Collective GLB side view (beats 3–4) |
| Hotspots, activity flags and pulses, the "N things to do" count | — |
| Standing locks (`unlock: {fac, need}`), the sealed-room toast | — |
| The crew layer: depth layers, ambient walkers and gestures | — |
| The walk-to-room avatar, then the dialog with a 3D close-up | — |
| The board / depart scan wipe and shuttle | — |
| The layout editor (drag rooms, resize, stand spots, deck floors) and `ship-layout.json` export | — |

The layout editor becomes the authoring tool for the room view. A room is moved in the editor, exported, and committed
as data.

### 4.2 The rooms — the prototype's list

Three decks: deck 1 is the top. Positions are the prototype's current layout.

| Deck | Room | Occupant | Faction | Activity | Lock | Role in the opening |
|---|---|---|---|---|---|---|
| 1 | **Helm** | Captain Vale (captain's cap) | Collective | Mission | — | Ambience: officers at consoles. |
| 1 | **Chapel** | Confessor Aldous | Arcane | Talk | Trusted with Arcane | Seen sealed (greyed, lock badge). Shows the player that rooms open with standing. |
| 2 | **Armory** | Quartermaster Roth | Ground · Powder | Upgrade | — | Ambience: tank hulls, recruits. Roth is Verdance's quartermaster, so the first planet's face is aboard. |
| 2 | **Bar** | **Factor Mira Valcourt** (opening); Supercargo Dorian Quell (later, Q4) | Collective | Talk | — | **The conversation.** |
| 3 | **Trade Station** | Factor Mira Valcourt in the prototype (Q4) | High Tech in the prototype | Deal | — | Ambience: ticker, crates. Hub: sell. |
| 3 | **Loading Bay** | Ops-Chief Farrell | Artillery | Reward | — | **The transport (beat 10)** and the departure. |
| 3 | **Engineering** | Chief Okonkwo | Space Tech | — | Trusted with Space Tech | Seen sealed. |

When the owner revises the room list, it is changed in the editor or in `ship-layout.json`. No code changes.

### 4.3 Drawing a room from primitives

Each room is a **shell** plus a **prop set**, both built in code from three.js primitives with flat, toned colours.
Nothing is loaded from an image or a model.

**The shell**, from the room's box (`x, top, w, h`):
- **Back wall.** A plane set back in z, in the room's tone: the occupant faction's outfit colour, darkened 60 %.
- **Floor slab.** A box whose top face sits on the deck's walk line. A lighter top strip makes the floor read in the
  straight-on orthographic view.
- **Ceiling slab** with an emissive light strip (warm for Bar, Chapel and Armory; cool for Helm, Engineering and Trade
  Station).
- **Side walls.** Thin boxes, with a door gap at floor height wherever the room meets a neighbour on the same deck,
  so walkers pass through.
- **Sign plate** over the door: a canvas-texture label with the room name.
- **Frame.** An outline in the room's state colour. It carries the prototype's flag pulse, the gold highlight (beat 7)
  and the locked hatch.

**The hull** is a primitive too:
- a rounded-rectangle silhouette (`THREE.Shape`, extruded thin) in Collective ivory around the deck block;
- an orange flank stripe and a dark interior behind the rooms;
- a stub of the dome above deck 1 and the stern block left of deck 3.

It hints at the ship without copying a design that will change.

**Props per room.** A small recipe of primitives, each `{shape: box | cyl | sphere | plane, at, size, color,
glow?}` in room-relative %. Presets keep the data short:

| Room | Props |
|---|---|
| Helm | Three consoles (boxes with glowing screen faces), the captain's chair (box + cylinder), a viewport on the back wall (dark plane with star points) |
| Chapel | Altar box, two candle cylinders with glowing tips, two pews, a stained window (four tinted glowing panes) |
| Armory | Two tank hulls (box + cylinder turret + barrel), a weapon rack (thin boxes), a crate |
| Bar | Long counter (box + lip), four stools (cylinder + disc), a back shelf with bottle cylinders, two booth tables, three hanging lamps (glowing spheres) |
| Trade Station | Ticker board (glowing plane with a scrolling canvas texture), two desks, crate stacks, a scale |
| Loading Bay | Container stacks (Collective orange), a gantry (box frame), bay door stripes, clamps, and **the transport** (capsule body + two fin boxes + a glowing engine disc) |
| Engineering | Reactor (cylinder with pulsing glow), pipe runs (cylinders), wall panels |

**Draw cost.** Static props in a room are merged into one vertex-coloured geometry, plus one emissive geometry for
glows. A room is about 4 draws (shell, props, glows, sign), so the ship is about 30 draws plus the hull.

### 4.4 Light and mood

- One hemisphere fill and one warm sun, as in the prototype, so crew look the same as they do today.
- Each room adds its ceiling strip (emissive, no real light) and one shadowless point light for its occupants.
- Vesper's red tints the hull frame's outer edge.
- **Locked rooms** use the prototype's treatment: grey, half brightness, a hatch pattern in the lock faction's colour,
  and a lock badge.

### 4.5 When the faction ships are revised

- The layout (`ship-layout.json`) and the crew layer do not depend on how a room is drawn.
- A room may later declare `skin: 'primitive' | 'image' | 'model'`:
  - `image` is the prototype's original mode (a rendered cutaway behind the hotspots);
  - `model` is a GLB room kit.
- Primitive stays the default. Each faction's capital ship gets its own layout file
  (`content/ships/<faction>/ship-layout.json`) when its interior is designed. Only the Collective's exists now.

---

## 5. Characters and crew — the prototype's rig

### 5.1 Reused as built

- **Body.** The foreman rig: squashed-sphere head with hair, eyes and ears; shirt torso; an open vest with reflective
  stripes; denim legs; shoes; arm pivots at the shoulders; head pivot at the neck.
- **Helmets.** One per faction:

  | Faction | Helmet |
  |---|---|
  | Collective | Service cap |
  | Ground | Combat helmet |
  | Air | Aviator |
  | High Tech | Tech visor |
  | Artillery | Tanker |
  | Water | Diver |
  | Arcane | Cowl |
  | Space Tech | Space helm |
  | Dark Energy | Hood and mask |
  | Greenies | Gas mask |

  Plus the captain's peaked cap, the player's gold hard hat, and the Character Sheet's civilians (bare head, beanie).
- **Poses.** The 8-state pose machine (`drivePose`): idle, walk, talk, point, wave, salute, angry, celebrate. Each
  room's flag picks its occupant's signature gesture (mission → point, reward → celebrate, deal and talk → talk); the
  captain salutes.
- **Deck crew.** Up to 16 per deck, one per depth layer so none clip; walk / gesture / walk cycles; reduced motion
  honoured.
- **Player.** The gold avatar walks to the clicked room's stand spot, then the dialog opens.

### 5.2 Added for this design

| Addition | Why |
|---|---|
| **Leg pivots** at the hips and a leg swing in walk | Today only the arms swing. Sitting needs legs that bend. |
| **sit** and **sit-drink** poses | The owner's patron is "sitting in the bar". Bar patrons and the stools use them. |
| **work** pose (hands forward, small nods) | Officers at consoles and engineers at panels. |
| **Flash** state | The patron's vest material (`vestM`) pulses gold emissive twice; a gold chevron sprite bobs above her (beat 6). |
| **Turn-to-camera** | Mira turns from the counter to face you in beat 8 (yaw ease). |
| **Room posts** | A key character stays at their room's stand spot and plays their signature gesture with idle breaks, instead of walking the deck lane. |
| **Lift between decks** | A primitive lift shaft at the stern end of the decks. Ambient crew sometimes ride it, so movement crosses decks, not only along them. |
| **Seeded RNG** | The prototype uses `Math.random`. The game version takes a seeded generator so the room view looks the same on every run (review and screenshots). It is presentation only, outside the battle sim. |

### 5.3 Who is where

- **Key characters, one per room**, from the prototype's list (§4.2), with Mira Valcourt at the bar for the opening.
- **Ambient crew** chosen so every faction's helmet appears somewhere (as the prototype does): Air and Dark Energy on
  deck 1, Water and Greenies on deck 2, Space Tech and High Tech on deck 3. Add two or three Collective deck crew and
  Character Sheet civilians (dockhand, trader) in the Loading Bay and Trade Station.
- **The bar** has the patron on a stool, plus one or two seated Collective crew in a booth. The prototype's bar has no
  barkeep. One can be added as a Collective crew member with the talk pose.

About 15–20 figures in total: well within budget (§8).

---

## 6. The bar beat and the conversation

### 6.1 The flash and the highlight (beats 6–7)

- **Flash.** Two gold pulses on Mira's vest (0.25 s up, 0.35 s down) and a bobbing chevron. Flashes stay at three a
  second or fewer. Reduced motion: a steady gold outline.
- **Highlight.**
  - Every other room dims to 35 % and half-desaturates over 0.6 s.
  - The bar's frame turns gold with a glow.
  - A label slides in, "THE BAR", then "Tap to enter" after 1 s, pulsing every 2 s.
  - The game auto-enters after 6 s idle.

### 6.2 Into the bar (beat 8)

- The prototype's flow: your avatar walks to the bar's stand spot, the camera pushes in until the bar fills most of the
  frame, and Mira turns to you.
- **The dialog panel** replaces the prototype's modal for this scene and reuses its parts: the 3D close-up of the
  speaker (same rig, larger), the faction tag, the name and the line. It adds:
  - **Typed lines** with the procedural voice (`voice.js`), captions always on.
  - **Input.** Click, tap, Space or Enter advances; holding or a second press finishes the line.
  - **Speaker changes.** The close-up swaps character.
  - **Holo-slides** (§6.3).
  - **Progress pips.**
  - Esc → "Skip conversation?" on replays only.
- The prototype's bar **choices** ("Business is business." / "They had it coming.", with standing changes) stay as a
  later hub conversation with Dorian Quell. The opening ends on the contract, not a standing choice.

### 6.3 The slide show inside the conversation

- Lines can carry a `slide`. A holo-projector (a glowing primitive disc) on the counter blooms, and the still floats
  above it as a scan-lined panel.
- Animation: slow Ken Burns pan and zoom, 2–3-layer parallax for layered stills, a subtle flicker, cross-dissolves.
- The text stays in the panel.
- The two jungle transport stills use the owner's replacement images when supplied.
- WebP at 1280 px, about 80–150 KB each, preloaded during beats 1–5.

### 6.4 The script

The owner supplies the transcript. Until then, placeholder lines follow the owner's order:
1. Welcome aboard The Long Ledger.
2. Who the Collective are (traders, not soldiers).
3. The frontier planets and their resources.
4. The offer: a transport and a contract to harvest on Verdance.
5. The terms: sell to the Collective up to the quota, and keep the surplus.
6. The handshake.

That is 12–16 lines and 4–6 slides, in `content/dialog/opening.json`.

### 6.5 The contract and the transport (beats 9–10)

- **The contract card.** The Collective seal, "FIRST CONTRACT — VERDANCE", the terms in plain words (the Verdance quota
  per tier; the surplus is the player's), and one ACCEPT button. Accepting starts the existing contract economy and
  writes the opening save state.
- **The transport.** The camera drops to the Loading Bay.
  - The primitive transport sits in the clamps under the bay's lights. Ops-Chief Farrell celebrates (his flag is
    *reward*) and a dockhand waves.
  - If Q5 = bay, the faction picker opens here ("Choose the colours you fly under") and the transport takes that
    faction's colours.
- **Launch.** The prototype's depart sequence: the hull closes and the shuttle leaves. Then the galaxy fly from Vesper
  to Verdance, ending on the Verdance planet screen.

---

## 7. Sound

| Element | Treatment |
|---|---|
| Vesper | Deep, slow sub-bass swell with a crackling high "boil", wide. |
| Fly-by | The arrival design §4 engine roar in the Collective's smooth, harmonic merchant hum. |
| Hull opening | A scan hum that sweeps with the line, and plate clunks behind it. |
| Room view | A ship bed plus per-room spots that fade with camera distance: bar murmur and glasses; Helm console beeps; Chapel hum and candle crackle; Armory clanks; Trade ticker; Loading Bay hydraulics; Engineering reactor drone. |
| Flash / highlight | A soft bell; a warm swell. |
| Conversation | Procedural voice per speaker; a holo-slide whoosh; a seal stamp on ACCEPT. |
| Music | The Collective theme, resolving into Verdance's at hand-off. Synth fallback until commissioned. |

---

## 8. Platforms, performance, accessibility

| | Desktop / high | Mobile / mid | Low |
|---|---|---|---|
| Ship (fly-by) | LOD0 | LOD0 | LOD1 |
| Post | Full HDR | Half-res bloom | Bloom only |
| Primitive rooms + hull | ≈ 30 draws | ≈ 30 draws | Merged per deck (≈ 8) |
| Figures | 20 | 20 | 12 |
| Target | 60 fps | 60, floor 30 | 30 |

- **Figure cost.** Each figure is about 40 small meshes in the prototype. The game version merges each figure's static
  parts per material at spawn, so a figure is about 6 draws (body, vest, stripes, skin, helmet, shadow) with pivots
  kept as groups. Twenty figures is about 120 draws, comfortably under budget.
- **Phone portrait.** The room view fits deck width to the screen at a scale where the bar and one neighbour show,
  with drag to pan and a thin minimap strip of the deck block at the top. Beats 3–4 frame the bar's side of the ship
  so the highlight lands on screen.
- **Phone landscape:** the whole ship, as on desktop.
- **Reduced motion:**
  - beats 1–3 cross-fade;
  - the scan wipe becomes a fade;
  - cuts instead of camera pushes;
  - a steady outline instead of the flash;
  - walkers keep walking, with no bob (as the prototype does).
- Captions on every voiced line; labels on every room; a focus ring and keyboard for every room and button; WCAG AA on
  the panel.
- **Backgrounding** pauses and resumes at the start of the current beat.

---

## 9. Persistence, skip and later visits

- **New save.** The opening plays.
  - Saved: `collective.introSeen`, `collective.contractAccepted`, `collective.transport` (and the faction, if picked
    there).
  - A reload before the bar restarts the opening; after ACCEPT it resumes at the transport.
- **Skip.** On a first run, from beat 3 straight to beat 7; the conversation is never skipped. Replays are fully
  skippable. Skipping counts as seen.
- **Replay.** "Replay opening" in Settings and in the hub.
- **The hub on later visits.** This is the prototype's Board flow.
  - Tap Vesper in the galaxy, or "Collective" on the main menu: The Long Ledger at the side view, then Board, the scan,
    and the room view. No fly-by.
  - Rooms behave as in the prototype: flags, walk-to, dialog, locks by standing.
  - The first version wires the Bar (Collective contracts, maps 1–3 missions) and the Loading Bay (your transport, idle
    haul). The rest are ambience until their stories land.
- **Existing saves** skip the opening, are marked `introSeen`, and see a one-time "Replay opening" prompt.

---

## 10. Review outside the game

`tools/collective/index.html`. It starts from the prototype page, ported into the repo:
- the room view drawn with primitives, with the layout editor and `ship-layout.json` export;
- the whole opening with a scrub bar and beat markers;
- a crew board: every helmet and pose, including the new sit, sit-drink, work and flash;
- toggles for tier, `?reduced=1`, phone portrait and landscape frames, and mute.

---

## 11. Open decisions (owner)

| # | Decision | Proposal |
|---|---|---|
| Q1 | The room list | The prototype's seven rooms (§4.2). Revise in the editor at any time. |
| Q2 | The red giant's name | Vesper |
| Q3 | Where the slide show plays | Inside the bar conversation as holo-slides. Alternative: a prologue of stills before beat 1. |
| Q4 | Who is at the bar for the opening, and Mira's faction. The Dossier makes Mira a Collective officer who gives the ship and contract; the prototype puts her in Trade Station dressed as High Tech, with Dorian Quell at the bar. | Mira at the bar for the opening, in Collective dress. Quell takes the bar afterwards (the Dossier has him "met when Capital ships unlock"). Trade Station gets another Collective officer from the Dossier, e.g. Chief Ledger-Keeper Ovid Marlow. |
| Q5 | Faction choice: before the opening, or in the Loading Bay after the contract | In the bay |
| Q6 | Galaxy position A or B | A |
| Q7 | Add a barkeep to the bar? | Yes: one Collective crew member, no name needed |
| Q8 | First-run skip | From beat 3 to the highlighted bar; the conversation is never skipped |
| Q9 | The opening script and slide order | The owner's transcript replaces the placeholder lines |
| Q10 | Transport ship images for the two jungle stills | Owner to supply |

---

## Dependencies

| relation | document | what it holds that this design does not restate |
|---|---|---|
| extends | docs/16 Bulwark MM/design/Capital-Ship-Arrival-Design.md | the arrival beats, hit points, engine roar, camera grammar and the Collective red-giant variant (§5) |
| depends-on | docs/16 Bulwark MM/tech-plan/Menu-Survey-Galaxy.md | the galaxy view, systems and the galaxy-to-planet camera fly |
| depends-on | docs/16 Bulwark MM/design/Capital-Ship-Scale-Research.md | the ship model and scale standard used for the fly-by |
