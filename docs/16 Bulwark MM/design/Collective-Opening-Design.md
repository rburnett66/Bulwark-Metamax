# The Collective Opening — red giant, capital ship, room view and the first contract

**Provenance.** Owner sentences are quoted and marked **owner**. Everything else is **agent-proposed** and open to
correction. Written 2026-11-05 by the repo-rooted cloud session (Claude Code, Opus 5.5) from:
- the owner's request that day;
- `Capital-Ship-Arrival-Design.md`, which this extends;
- `Menu-Survey-Galaxy.md` (the galaxy);
- the Collective ship build (`tools/blender/ships/collective.py`, LOD0–2 GLBs in `content/ships/`);
- the comm-card dialog and procedural voice (`src/comm/`);
- the 81 faction characters (`Bulwark-Missions.xlsx` › Givers, 81 portraits);
- the Collective contract economy (`src/sim/harvest.js`, `src/data/collectiveContract.js`).

Epic `epic_mvo5po8u_4` (The Collective trade faction). Tech plan: `docs/tech-plan/Collective-Opening.md`.

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

---

## 0. Reading of the request (stated so it can be corrected)

1. **A tenth body in the galaxy, not a battlefield.** The red giant has no maps, no survey and no campaign. Its
   only content is the Collective capital ship in orbit, which is the player's first employer and hub.
2. **The game opens there.** On a new save, the first thing the player sees is the red giant. The Collective ship
   flies by, the camera swings to the ship's flank, and the hull opens into a cutaway of rooms with people moving
   in them. The patron at the bar is called out, the bar lights up, and a click-through conversation gives the
   player their first contract and a transport ship. Then the player goes to Verdance.
3. **The "animated slide show"** is the owner's opening material, kept as stills to keep the download small
   (owner, earlier: "my plan was to take snap shots and present text"). It is presented *inside* the bar
   conversation as holo-slides the patron shows the player (§6.3). This is a reading; §11 Q3 offers the
   alternative of a prologue before the red giant.
4. **The room view is a lasting place, not a cutscene backdrop.** It is drawn from data (a room list and a deck
   layout) so the same view serves as the Collective hub on later visits, and later each faction's capital ship.
5. **"The room modules we have already listed"** — no such list was found in the repo, the MetaMax board and
   documents, the workbooks or past conversations. §4.2 proposes one. It is a single data file
   (`content/ships/collective/rooms.json`), so the owner's list replaces it without code changes (§11 Q1).

---

## 1. What exists today

| Piece | Where | State |
|---|---|---|
| Collective capital ship model | `tools/blender/ships/collective.py` → `content/ships/collective_lod{0,1,2}.glb` | Built, v2 surface. Ivory hull ~21.5 units long (1 unit = 25 m, so ≈ 540 m), orange livery, blue light line, central dome, fore cathedral tower with spires, eight cargo spokes, eight-nozzle stern. Shown only in `tools/ships/viewer.html`. |
| Arrival cinematic design | `Capital-Ship-Arrival-Design.md` | Designed, not built. §5 already says the Collective arrival plays above a red giant (`createBackdrop({star:'redGiant'})`, broad glare instead of a lens flare) and is the game's opening. |
| Engine FX, tugs, presentation shots | `src/render3d/ships/engineFx.js`, `tugs.js`, `shots.js` | Built (viewer). |
| Galaxy | `src/data/galaxy.js` (`SYSTEMS`, `systemPos`), `src/menu/galaxyStage.js`, `menuStage.js` | Built. Nine homeworlds on a two-armed spiral, radius 100. Verdance at r 22, 18°. |
| Planets | `src/data/planets.js` (`PLANETS`) | Nine playable homeworlds. |
| Dialog | `src/comm/commCard.js` (in-battle comm card), `voice.js` (procedural voice, mute/volume), 81 portraits in `content/dialog/portraits/` | Built for one-way in-battle transmissions. |
| Characters | Givers sheet: 9 per faction × 9 factions, alignment-ranked (AG → DE). The nine captains are the PG of each faction. | Data + 2D portraits only. No 3D characters exist. |
| Collective economy | contract quota per map and tier; the Collective ship grants and collects missions on maps 1–3 | Built. |
| Collective cast | — | **None.** "Collective giver name" has been open since 2026-11-03. |

---

## 2. The opening at a glance

First launch, new save. Total ≈ 70 s before the conversation; the conversation is player-paced.

| # | Beat | Time | What the player sees | Hands-on |
|---|---|---|---|---|
| 0 | **Cold open** | 0–3 s | Black. Comm static rises; caption "COLLECTIVE ANCHORAGE · VESPER". | — |
| 1 | **The red giant** | 3–14 s | Vesper fills the frame: a vast, slow-boiling red star, granulated surface, prominences curling off the limb. Long lens, almost still. | — |
| 2 | **Fly-by** | 14–30 s | The Collective ship crosses the star's face bow-first, silhouetted, then lit by the red glare as it passes the camera. Tugs peel away. Arrival design §3 beats 2–5, with the Collective variant of §5. | — |
| 3 | **Swing to the flank** | 30–40 s | The camera matches speed and arcs to the ship's port beam. It flattens from the 85 mm close-up to a long-lens side view; the ship fills the width, level, bow to the right. | — |
| 4 | **The hull opens** | 40–46 s | The flank plating separates along panel seams and slides back in layers, revealing the cutaway: decks of lit rooms inside the ship's own silhouette. | — |
| 5 | **Life inside** | 46–56 s | The view settles. Crew walk corridors and ride lifts; dockhands move crates; faction delegates sit in their embassies; the dome's trade floor bustles. Slow drift across the ship. | Drag to look around (from here on). |
| 6 | **The patron** | 56–60 s | In the bar, one seated figure **flashes**: a rim-light pulse twice and a small gold chevron above her. | — |
| 7 | **The bar** | 60–63 s | The bar room **highlights**: every other room dims to 35 %, the bar's frame glows gold, and a label slides in: "THE EMBER ROOM — TAP TO ENTER". The camera eases toward it. | **Tap the bar** (auto after 6 s idle). |
| 8 | **The conversation** | player-paced | The camera pushes into the bar. The patron turns to face the camera. The dialog panel opens: portrait, name, typed lines, procedural voice. Holo-slides rise from the table for the lines that show something. | Click / tap / Space advances; hold to fast-type. |
| 9 | **The contract** | — | A contract card: terms, the Collective seal, ACCEPT. | **Accept.** |
| 10 | **The transport** | ≈ 8 s | The camera drops two decks to the docking bay. The player's transport is lit, its colours chosen there (Q5). | Pick your colours (if Q5 = yes). |
| 11 | **Departure** | ≈ 6 s | The transport launches out of the bay; cut to the galaxy, flying from Vesper to Verdance. | — |
| 12 | **Hand-off** | — | Verdance planet screen; map 1 is ready. | Play. |

Beats 0–7 can be skipped from beat 3 on a first run, and at any time on a replay (§9). The conversation can
never be skipped on a first run, because it carries the premise and the contract. Each line can still be
fast-typed.

---

## 3. Vesper, the red giant (the tenth body)

### 3.1 Identity

| Field | Proposal |
|---|---|
| Name | **Vesper** (red giant). The ship's station there is **Collective Anchorage**. *(Q2)* |
| Kind | `star`, not a planet. No surface battles, no survey, no resources. |
| Playable | `false`. It never appears in the faction picker, the campaign list or the inventory's planet list. |
| Look | Deep red-orange (≈ 3,200 K), very large, slowly boiling granulation, darker limb, a few prominences. It is the key light for everything near it: red rim light on the ship, long red-black shadows. |
| Galaxy marker | A larger, softly pulsing red point with a thin gold ring (the Collective's colour). Label: "Vesper · The Collective". |

### 3.2 Place in the galaxy

> **owner**: "not to far from verdance maybe at the edge of the galaxy"

Verdance sits on the inner arm (r 22, 18°). Two readings:

| Option | Position | Effect |
|---|---|---|
| **A (recommended)** | **r 34, 4°, y +7.** Just off the end of Verdance's arm segment, lifted above the disc. | Close to Verdance: the opening's flight is short and reads as "next door". Sitting above the disc makes it read as outside the spiral, an edge without being far away. |
| B | r 97, 18°, y +2. On the true outer rim, on Verdance's bearing. | Literally the galaxy's edge. The first flight crosses most of the galaxy, which is spectacular but long, and it puts the hub far from every later planet. |

The galaxy view gains a faint gold "trade lane" from Vesper to every homeworld the player has unlocked: the
Collective's reach. It is drawn only after the opening.

### 3.3 Rendering Vesper

- **Opening and hub backdrop:** a screen-filling star. A sphere with an animated granulation shader: two octaves
  of cellular noise drifting at different speeds, limb darkening and a red-to-orange ramp. Two or three
  billboard prominences loop slowly. A broad, soft glare replaces the lens flare (arrival design §5). Cost: one
  draw for the sphere, one for prominences, one for the glare.
- **Galaxy:** a point sprite with a pulse plus the gold ring. It uses the same pipeline as the other systems in
  `galaxyStage.js`.

---

## 4. The capital ship's room view

### 4.1 How the side view becomes rooms

The real ship is ≈ 540 m long and ≈ 30 decks tall at 4 m a deck, too fine to read. The room view is therefore a
**stylized cutaway**, the way an ant-farm or dollhouse view works: a few chunky decks of big, readable rooms
inside the ship's true side silhouette. The hull is the frame and the rooms are the picture.

- **Transition (beat 4).** The camera reaches the flank shot with an orthographic-like long lens (fov 10–12°).
  The flank's panel plates (the existing panel UVs) separate along seams: plates offset 2–4 % outward and slide
  aft in staggered bands over 1.2 s, then fade. Behind them the cutaway is already in place, lit, inside a
  dark interior shell that matches the hull's side profile. Keel, dome, tower and spires stay solid as the frame.
- **The cutaway is a separate scene layer** aligned to the side silhouette: a 2.5D stage of room boxes seen
  from the side, open on the near face. It uses a perspective camera with a narrow fov and a gentle 4–6°
  downward tilt, so floors read and characters stand on them.
- **Navigation.**
  - Drag pans along the ship; pinch or wheel zooms from the whole ship (every room visible) to a single room
    (filling about 70 % of the screen).
  - Tapping a room focuses it: the camera eases in, the room label shows, and its occupants become tappable.
  - Edge limits keep the ship in frame.

### 4.2 Rooms (proposed list — owner to replace, Q1)

Laid out to match the ship's shape: dome amidships, cathedral tower fore, engines aft, docking and cargo low.
"Bays" are the horizontal room unit (one bay ≈ one small room); decks are numbered from the top.

| Deck | Room | Bays | Where | Purpose (opening → hub later) |
|---|---|---|---|---|
| Dome | **The Exchange** (trade floor) | 4 | under the dome | Traders, tickers, haggling. Hub: sell / buy resources. |
| Dome | Observation Gallery | 2 | dome cap | Visitors at the windows looking at Vesper. Ambience. |
| Tower | **Bridge** | 2 | fore tower top | Officers at consoles. Hub: the ship's captain. |
| Tower | Governor's Office | 1 | fore tower, below the bridge | The Collective's governor (later story). |
| 1 | **The Ember Room** (the bar) | 3 | amidships, under the Exchange | **The opening conversation.** Hub: Collective contracts and missions for maps 1–3. |
| 1 | Counting House | 2 | aft of the bar | Clerks, ledgers, a vault door. Hub: contract history. |
| 1 | Embassy Row | 3 | fore of the bar | The faction delegations (§5.3). Hub: faction characters met. |
| 2 | Crew Quarters | 2 | aft | Bunks, lockers. Ambience. |
| 2 | Mess Hall | 2 | amidships | Crew eating. Ambience. |
| 2 | Medbay | 1 | fore | Ambience. |
| 2 | Market Stalls | 2 | fore | Small traders, faction goods. Hub: later shop. |
| 3 | Cargo Holds | 3 | amidships | Container stacks, a gantry crane, dockhands. |
| 3 | Workshop / Refit | 2 | fore | Mechanics on a transport. Hub: transport upgrades. |
| 4 | **Docking Bay** | 3 | lowest deck, open to space on the near side | **The player's transport (beat 10).** |
| 4 | Engineering | 2 | aft, above the stern nozzles | Reactor glow, engineers. |
| all | Corridors, lifts, stairwells | — | between rooms | Walking routes (§5.4). |

That is 15 rooms plus circulation, about 35 bays. The whole-ship view shows every room at once on a 16:9 screen.

### 4.3 Drawing a room module

Every room is built from **one shell plus a prop set**. Both are data, so new rooms are mostly content.

- **Shell (code).** A parametric box from bays × deck height:
  - back wall, floor, ceiling and side walls with door cut-outs; the near face is open;
  - trim lines at the floor and ceiling;
  - a lit sign over the door;
  - a palette from the room's theme (Collective ivory / gold / orange by default, faction colours for
    embassies);
  - two-tone baked-in shading (vertex AO along corners) and an emissive ceiling strip.

  It is one merged mesh, one draw.
- **Props (kit).** A low-poly library built in the same headless-Blender pipeline as the ships, with the same
  detail-scale standard and palette materials. Each prop is a GLB entry in a single kit file with a shared
  texture atlas. Around 40 props cover the list:

  | Group | Props |
  |---|---|
  | Bar | bar counter, bar stool, booth, round table, bottles shelf, tap rack, lamp |
  | Trade | ticker board, trading desk, scales, crate stack, banner |
  | Office and command | desk, chair, console, wall screen, star map table, vault door |
  | Living | bunk, locker, mess table, bench, medbay bed |
  | Industry | container, gantry crane, cable spool, reactor core, pipes, barrel, tool rack |
  | Bay | docking clamp, launch rail, bay door frame |
  | Small | plant, rug, poster, holo-projector |
- **Room recipe (data).** `rooms.json` lists, per room, the shell size and theme, the props with bay-relative
  positions, and the **points of interest** characters use: `seat`, `stand`, `lean`, `work`, `door`. A
  room-recipe editor is out of scope; recipes are hand-authored JSON and previewed on the review page (§10).
- **Draw cost per room:** shell 1, props 1–2 (static props merged per room at load), signs 1. The whole ship is
  about 45 draws for rooms.

### 4.4 Light and mood

- **Inside the cutaway**, rooms are self-lit:
  - warm 2700 K ceiling light for the bar and quarters;
  - cool white for the bridge, medbay and workshop;
  - amber ticker light on the Exchange;
  - blue-white reactor glow in Engineering.
- **Outside**, Vesper's red key light rims the hull frame.
- **Each room has one shadowless point light** for its occupants, so characters pop against the back wall.
- **Bloom** is reserved for signs, screens and the reactor.

---

## 5. Characters and crew

### 5.1 Who is aboard

| Group | Who | Where | Behaviour |
|---|---|---|---|
| **The patron** | The Collective's agent who hires the player. Proposed: **Factor Ottoline Crane**, Chief Factor of the Collective (Q4). | Ember Room, a stool at the near end of the bar | Seated, sipping, glancing at the door. Flashes in beat 6. Turns to camera in beat 8. |
| Barkeep | Proposed: **Mags Tolliver** | behind the bar | Wipes glasses, pours, slides drinks. |
| Bar patrons | 3–5 off-duty crew and a few faction characters (§5.3) | booths and stools | Sit, drink, talk (gesture loop), occasionally leave. |
| Officers | 3 | Bridge | Work consoles; one walks between stations. |
| Traders | 4–6 | The Exchange | Stand, haggle (gesture), walk between desks. |
| Clerks | 2 | Counting House | Sit and write; one carries ledgers to the vault. |
| Crew | 6–10 | corridors, mess, quarters | Walk schedules between rooms and lifts. |
| Dockhands | 3 | Cargo, Docking Bay | Carry crates, ride the gantry, wave in the transport. |
| Engineers | 2 | Engineering, Workshop | Work panels, inspect the reactor. |
| Faction delegations | see §5.3 | Embassy Row, the bar | Posted at their suite; some visit the bar. |

That is about 30–40 animated figures, which is within budget (§8).

### 5.2 Character look and rig

- **Style.** Low-poly, chunky, readable at small size, matching the ships and battle units. About 600–900
  triangles each. Proportions run slightly heroic: big heads and hands so gestures read from the whole-ship view.
- **One shared body, many outfits.** A single humanoid mesh with a 17-bone rig: hips, spine ×2, neck, head, and
  two each of shoulder, upper arm, forearm, hand, thigh, shin and foot. Outfits are attached kit pieces on bone
  sockets: coats, hats, helmets, aprons, armour plates, tool belts, robes and mechanical parts. Each faction
  gets 3–4 outfit sets built from its palette and trope:

  | Faction | Outfit |
  |---|---|
  | Ground / Powder | greatcoats and peaked caps |
  | Air | flight suits and goggles |
  | High Tech | sharp suits and visors |
  | Artillery | flak vests and helmets |
  | Water | reef wraps and shell ornaments |
  | Arcane | robes and lantern staffs |
  | Space Tech | ship uniforms |
  | Dark Energy | hooded cloaks |
  | Greenies | hazmat and chem tanks |
  | Collective | ivory-and-gold merchant coats, aprons for crew |
- **Faces.** Key characters get a face decal drawn from their existing portrait (the 81 portraits), so the 3D
  figure and the dialog portrait read as the same person. Crew get generic faces from a small set.
- **Built in the existing headless-Blender pipeline:** one script for the body and rig, one per outfit kit,
  exported to glTF with skinning. One shared animation file holds all clips (§5.5).

### 5.3 Key faction characters in their rooms

The ship is neutral ground, so every faction keeps a delegation aboard. **Embassy Row** has one suite per
faction:
- In the whole-ship view three suites are visible at once; the row scrolls, or nests as a "corridor of doors"
  that opens on tap.
- Each suite is themed in its faction's colours and props.
- The faction's **captain** (the capital-ship captain from the Capital_Ships sheet) is posted at a desk there.
- The **Neutral** character of each faction is the attaché at the door (the quartermaster, mechanic, actuary
  and so on).

**Who appears in the opening.** Showing all 18 at once is crowded, so the opening shows the delegations the
story has met:
- On a first run, only Verdance's delegation is present. Colonel Aldric Vane is at his desk and Quartermaster
  Ines Roth is at the door; Verdance is the first planet.
- The other suites show closed doors with their faction emblem lit dim.
- Later visits fill a suite once its planet is reached.
- A few named characters drop into the bar now and then, chosen by alignment, so the bar feels like a
  crossroads. Proposed: Sergeant "Bricks" Malloy (Ground, CG) arm-wrestling, and Mechanic Sora Ito (Air, N)
  nursing a drink.

### 5.4 Walking around: routes and schedules

- **Nav graph (data).** Nodes come from each room's `door` points, its points of interest, the corridor
  waypoints and the lift stops. Edges are corridor segments, room interiors (straight lines from the door to
  each point) and lift shafts, which link the same column across decks. It is built once from `rooms.json` at
  load.
- **Movement.** Characters move along graph edges at walk speed (1.2–1.6 m/s, scaled to the stylized room
  size). They turn smoothly, slow at doors, ride lifts (enter, doors close, platform moves, exit) and use
  stairs (a climb clip on the stair segment).
  - **Avoidance** is cheap: two walkers on the same edge in opposite directions sidestep and pass.
  - At a point of interest that is already taken, the walker waits or re-picks.
- **Schedules.** Each crew member has a short loop of activities with dwell times, for example quarters
  (sleep) → mess (eat) → workstation (work) → bar (drink) → corridor.
  - Each activity is a point of interest plus a clip (sit-eat, work-console, lean-bar, and so on).
  - A deterministic seed per character picks the order and the dwell lengths, so the ship looks the same each
    time the opening plays, which matters for review.
  - Key characters are mostly posted: they idle at their post and take short walks, such as Vane going to the
    star map.
- **Not the sim.** This is presentation only, outside the game sim and its replay determinism. It runs on its
  own clock and its own seeded RNG.

### 5.5 Animation clips

Twelve clips on the shared rig cover everything:

| Clip | Use |
|---|---|
| idle (breathing, weight shift) | anyone standing |
| walk, walk-carry | crew; dockhands with crates |
| climb (stairs / ladder) | stairwells |
| sit-idle, sit-drink, sit-write | bar, mess, counting house |
| lean-bar | bar patrons standing |
| talk-gesture | conversations, haggling |
| work-console | bridge, engineering, workshop |
| wipe-glass / pour | barkeep |
| turn-to-camera | the patron in beat 8 |

They are authored in Blender as keyed poses with eased interpolation, which is cheap to make. Clips crossfade
in 0.2–0.3 s. Two people talking face each other and alternate talk-gesture with idle (listening).

---

## 6. The bar beat and the conversation

### 6.1 The flash and the highlight (beats 6–7)

- **The flash.** The patron gets two rim-light pulses (gold, 0.25 s up / 0.35 s down) and a soft
  scale-pulse on a gold chevron marker above her head. It respects the flash limits (≤ 3 per second). Reduced
  motion: a steady gold outline instead.
- **The highlight.**
  - Every other room fades to 35 % brightness and desaturates by half over 0.6 s.
  - The bar's frame gets a gold outline glow and its sign brightens.
  - A label card slides in beside the bar: "THE EMBER ROOM", then "Tap to enter" after 1 s.
  - The camera eases from whole-ship to a bar-and-neighbours framing.
  - Inviting input: a soft pulse on the label every 2 s. After 6 s idle the game enters by itself.

### 6.2 Into the bar (beat 8)

- The camera dollies into the bar (1.6 s, ease-in-out) until the room fills the frame. Neighbouring rooms stay
  visible at the edges, dimmed.
- The patron plays turn-to-camera; the barkeep pauses mid-wipe; ambient chatter ducks −8 dB.
- **The dialog panel** opens along the bottom, reusing the comm card's typography and the procedural voice. It
  is a different shell: a warm, in-person "conversation" skin, not a radio transmission.
  - **Layout.** Portrait left (the patron's portrait), then name and title, then the typed line. On the right
  sits a "▸ Continue" affordance; a progress pip row sits at the bottom.
  - **Input.** Click, tap, Space or Enter advances. Holding or a second press finishes the typing at once. Esc
    opens "Skip conversation?" on replays only.
  - **Speakers.** Lines can change speaker, for example the barkeep's aside. The camera does a gentle
    shot-reverse: it favours whoever speaks within the bar framing.
  - **Captions.** Always on. Voice follows the master and voice volume.

### 6.3 The slide show inside the conversation

- The opening stills (the owner's "animated slide show") are **holo-slides**. Lines that show something carry a
  `slide` reference. A holo-projector on the bar table blooms, and the still appears as a floating, slightly
  scan-lined panel above the table.
- **Animation.** A slow Ken Burns pan and zoom on the still. For stills that are split into layers, a two- or
  three-layer parallax. Subtle holo flicker; a cross-dissolve between consecutive slides.
- **Text** stays in the dialog panel; the slide carries only the picture.
- **The transport ship slides.** These are the two jungle stills the owner wants to swap. They use the
  replacement images when supplied, otherwise the current stills.
- **Download.** Stills are WebP at 1280 px long edge, ≈ 80–150 KB each. They load progressively during
  beats 1–5, so ten slides cost ≈ 1–1.5 MB.

### 6.4 The script

The script is the owner's to supply (the transcript of the opening video). Until then the conversation runs on
**placeholder lines** that carry the premise in the order the owner described:
1. Welcome aboard.
2. Who the Collective are (traders, not soldiers).
3. The frontier planets and their resources.
4. The offer: a transport and a contract to harvest on Verdance.
5. The terms: sell to the Collective up to the quota, and keep the surplus.
6. The handshake.

It is about 12–16 lines with 4–6 slides. The script is data (`content/dialog/opening.json`), so the transcript
replaces it without code changes.

### 6.5 The contract and the transport (beats 9–10)

- **The contract card** slides up over the bar: the Collective seal, "FIRST CONTRACT — VERDANCE", and the terms
  in plain words (the Verdance quota from the workbook: what the Collective buys per tier, and that surplus is
  the player's), with one ACCEPT button. This is the moment the existing contract economy starts. Accepting
  writes the save's opening state (§9).
- **The transport.** The camera drops to the Docking Bay. The player's transport sits in the clamps, lit by
  bay floods; dockhands step back, and the barkeep's line plays as an off-screen comm. If the faction choice
  happens here (Q5), the existing faction picker opens over the bay ("Choose the colours you fly under"), and
  the transport takes that faction's landing-craft livery. Otherwise the transport is a Collective-issue craft
  in ivory and orange.
- **Launch.** Bay doors open to Vesper's glare, the launch rail fires and the transport slides out. Cut to the
  galaxy: the camera follows a gold trail from Vesper to Verdance, the same galaxy-to-planet fly the menu
  already uses, and arrives on the Verdance planet screen.

---

## 7. Sound

| Element | Treatment |
|---|---|
| Vesper | A deep, slow sub-bass swell with a crackling high layer (the star's "boil"), panned wide. |
| Fly-by | The engine roar of the arrival design §4, using the Collective's timbre (smooth, harmonic, merchant-ship hum). |
| Hull opening | Mechanical plate slides and clunks, staggered with the plate bands. |
| Room view | A bed of ship ambience plus per-room spots that fade with camera distance: the bar's murmur, glass clinks and a faint music box; the Exchange's chatter and ticker beeps; the bay's clangs and hydraulics; Engineering's reactor hum. |
| Flash / highlight | A soft bell for the flash and a warm swell for the bar highlight. |
| Conversation | The procedural voice per speaker; a slide-in whoosh for holo-slides; a seal stamp on ACCEPT. |
| Music | The Collective theme: warm, mercantile, brass and strings. The arrival cue (arrival design §4) uses its key, and it resolves into Verdance's theme at hand-off. Synthesized fallback until commissioned (arrival design Q4). |

---

## 8. Platforms, performance, accessibility

- **Budgets.** The opening owns the GPU; the menu canvas is paused. All three tiers keep animation at 30 Hz or
  better.

  | | Desktop / high | Mobile / mid | Low |
  |---|---|---|---|
  | Ship | LOD0 | LOD0 | LOD1 |
  | Post | full HDR chain | half-res bloom | bloom only |
  | Room shell + props | ≈ 45 draws | ≈ 45 draws | merged per deck |
  | Animated figures | 40 | 30 (far ones update at 15 Hz) | 18 |
  | Target | 60 fps | 60 fps, floor 30 | 30 fps |
- **Skinning.** Skinned figures share one material and atlas. three r128 has no skinned instancing, so each
  figure is one draw. Forty figures is about 40 draws, under budget. Figures outside the camera are culled.
- **Phone portrait.**
  - The ship is long and the screen is narrow. In the whole-ship view the ship is shown at the width that
    fits the bar plus a room on each side, panned by drag.
  - A thin minimap strip of the ship silhouette sits at the top with the viewport box.
  - Beats 3–4 frame the side view on the bar's third of the ship, so the bar highlight lands on screen.
- **Phone landscape:** whole ship visible, as on desktop.
- **Reduced motion:**
  - beats 1–3 are cross-fades;
  - the hull opening is a fade;
  - no camera dollies (cuts with a short fade);
  - the flash is a steady outline;
  - walkers still walk, slower.
- **Captions** for every voiced line and labels for every room. A focus ring and keyboard for the bar and every
  button. Text meets WCAG AA contrast on the dialog panel.
- **Backgrounding** pauses the timeline and resumes from the start of the current beat.

---

## 9. Persistence, skip and later visits

- **New save.** The opening plays. The first contract is accepted in beat 9; the transport is granted in beat
  10.
  - Saved: `collective.introSeen`, `collective.contractAccepted`, `collective.transport` (and the faction, if
    picked there).
  - A reload mid-opening resumes at the last completed milestone: before the bar it restarts the opening; after
    ACCEPT it resumes at the transport.
- **Skip.**
  - **First run:** Skip appears from beat 3 and jumps straight to beat 7 (the highlighted bar). The
    conversation itself is never skipped on a first run, though each line can be fast-typed.
  - **Replays:** the whole opening is skippable.
  - Skipping counts as seen (arrival design Q3).
- **Replay.** "Replay opening" in Settings and in the Collective hub.
- **Later visits: the Collective hub.**
  - Tapping Vesper in the galaxy, or "Collective" on the main menu, opens the room view directly with a short
    coast-in of the ship at the side view (arrival design §6), with no fly-by.
  - Rooms with a purpose are tappable: the bar (Collective contracts and maps 1–3 missions), the Exchange
    (sell), the Docking Bay (your transport) and Embassy Row (characters met).
  - The first version wires the bar and the bay; the other rooms are ambience until their stories land.
- **Existing saves.** Players who already have progress skip the opening. Their save is marked `introSeen`, and
  a "Replay opening" prompt appears once on the main menu.

---

## 10. Review outside the game

`tools/collective/index.html` (owner rule: UI must be reviewable outside Claude) offers:
- **Opening:** play the whole opening with a scrub bar and beat markers.
- **Room view:** jump to it, with every room labelled; tap a room to focus it.
- **Overlays:** toggle the nav graph and points of interest.
- **Character board:** every figure with its outfit and a clip picker.
- **Settings:** tier (low / mid / high), `?reduced=1`, phone portrait and landscape frames, and mute.

---

## 11. Open decisions (owner)

| # | Decision | Proposal |
|---|---|---|
| Q1 | **The room list** — "the room modules we have already listed" was not found anywhere. Supply the list, or approve §4.2. | §4.2 (15 rooms). |
| Q2 | Names: the red giant and the station. | Vesper; Collective Anchorage. |
| Q3 | Where the animated slide show plays. | Inside the bar conversation as holo-slides (§6.3). Alternative: a short prologue of stills before beat 1. |
| Q4 | The patron's name and the Collective cast (this also closes "Collective giver name", open since 11-03). | Factor Ottoline Crane (patron), Mags Tolliver (barkeep). A full Collective roster, alignment-ranked like the other factions, is a follow-up story. |
| Q5 | Faction choice: before the opening, or in the docking bay after the contract? | In the bay: "Choose the colours you fly under". The transport takes that faction's landing-craft livery. |
| Q6 | Galaxy position: A (r 34, near Verdance, above the disc) or B (true outer rim). | A. |
| Q7 | Embassy Row in the opening: only Verdance's delegation, or all nine? | Verdance only; the others fill as planets are reached. |
| Q8 | Skip on a first run: from beat 3 to the highlighted bar, conversation never skipped. | As proposed. |
| Q9 | Opening script and slide order. | Owner transcript replaces the placeholder lines in `content/dialog/opening.json`. |
| Q10 | Transport ship images for the two jungle stills. | Owner to supply; current stills until then. |

---

## Dependencies

| relation | document | what it holds that this design does not restate |
|---|---|---|
| extends | docs/16 Bulwark MM/design/Capital-Ship-Arrival-Design.md | the arrival beats, hit points, engine roar, camera grammar and the Collective red-giant variant (§5) |
| depends-on | docs/16 Bulwark MM/tech-plan/Menu-Survey-Galaxy.md | the galaxy view, systems and the galaxy-to-planet camera fly |
| depends-on | docs/16 Bulwark MM/design/Capital-Ship-Scale-Research.md | the ship surface, scale standard and presentation pipeline the room kit reuses |
