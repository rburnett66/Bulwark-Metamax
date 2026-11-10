# Tech Plan — Capital Ship Interior: the room view and the hub

**Epic:** `epic_mw49625t_b` "L2 Capital ship interiors" (Bulwark advanced mode).
**Status:** v0.2, 2026-11-05. I1 in progress: the room view from primitives plays in the game's Collective intro (prototype). Notes and as-built justifications for this epic go here, not on the tickets.

**Design inputs:**
- `docs/16 Bulwark MM/design/Collective-Opening-Design.md` v0.2 (§4 rooms, §9 hub);
- the Advanced Mode deck (capital ships are "space cities … crewed by the heroes you chat with in battle");
- the Long Ledger prototype.

**Companion plans:**
- `docs/tech-plan/Ship-Crew-Characters.md`: the people in the rooms.
- `docs/tech-plan/Dialog-Response-Reputation.md`: replies, standing and locks.
- `docs/tech-plan/Collective-Opening.md`: the first-run cinematic that ends in this view.

> **owner** (2026-11-05): "You already have a prototype with animated characters and crew for each faction. The
> prototype assumes there is a base image for each faction. I expect the faction ships to be revised so for now I would
> prefer to mockup rooms with primitives."
>
> **owner** (2026-11-05): "Right before the character sheet was created the interior work started, then both were
> combined in a demo."

## 1. Scope

**In scope:**
- The capital ship's **room view**: a side cutaway of decks and rooms, with crew walking, rooms to tap, a walk-to-room
  avatar and a room dialog.
- Getting aboard and leaving: board / depart.
- The **layout editor** that authors it.
- Moving the prototype into the game's modules, with rooms drawn from **primitives**.
- **The hub** on later visits.

The Collective's ship (The Long Ledger) is the first ship. Every faction's capital ship reuses the same system with its
own layout file.

**Out of scope here:**
- The figures themselves (Ship-Crew-Characters).
- Reply choices and the standing model (Dialog-Response-Reputation).
- The opening cinematic (Collective-Opening).
- Room purposes beyond those wired in §5.4.
- Final room art, which waits for the faction-ship revision.

## 2. As built — the Long Ledger prototype

**Source:** artifact `S9B7GgVN7XcRDBTSF7BVth`, 2026-10-27. It is now committed at
`prototype/test-game/tools/ship-interior/prototype/long-ledger/` (`index.html`, `cutaway.jpg` 1792 × 1008,
`exterior.jpg`) as the reference for the port. It is a single file using three.js r128 from a CDN.

| # | Feature | How it works today |
|---|---|---|
| P1 | **Stage** | A 16:9 box (`aspect-ratio: 1792/1008`) holding a pre-rendered cutaway image. A transparent three.js canvas sits over it, with an orthographic camera spanning 100 × 56.25 world units, so a % position maps straight to world space (`toWX`, `toWY`). |
| P2 | **Rooms** | A `ROOMS` array of 7 records. Each has `id, name, fac` (occupant faction), `cap` (captain), `who`, `line`, `flag` (mission / reward / store / talk / upgrade), `acts` or `choices`, an optional `unlock: {fac, need}`, the hotspot box `x, top, w, h` in %, and the stand spot `fx, fy`. The rooms are Helm, Chapel, Armory, Bar, Trade Station, Loading Bay and Engineering. |
| P3 | **Decks** | `FLOORS = [40, 57, 90]` (% y). Each room snaps to its nearest floor (`r.floor`), and its stand spot sits on that deck's walk line. |
| P4 | **Hotspots** | An absolutely positioned button per room with a name tip on hover or focus. Flagged rooms get a colour badge and a 2.9 s pulse (still under reduced motion). The header shows "N things to do" (flagged, unlocked rooms) and a colour legend. |
| P5 | **Locks** | `STAND` = Hostile < Wary < Neutral < Trusted < Honored. A fixed `STANDING` table holds the player's standing per faction. A room whose `unlock.need` is above the player's standing renders greyed, half-bright and hatched in the lock faction's colour, with a lock badge "Arcane · Trusted". Tapping it shows a toast ("… is sealed. Reach Trusted with Arcane to open it."). |
| P6 | **Crew layer** | Ambient crew walk deck lanes between gesture breaks. Up to 16 per deck, one per depth layer (z gap 2.0, rise 0.4, shrink 0.975 per layer), so they pass in front of and behind each other without clipping. Six ambient crew show the helmets the rooms do not. See Ship-Crew-Characters §2. |
| P7 | **Player avatar** | A gold hard-hat figure on deck 3. Tapping a room walks it to the room's stand spot on that room's deck (`walkPlayerTo`), and the room dialog opens on arrival. It does not path between decks; it snaps to the target floor. |
| P8 | **Room dialog** | A modal sheet. On the left, a live 3D close-up of the occupant (own renderer, perspective camera) on a faction-tinted backdrop; the occupant waves for 1.4 s, then plays the room's signature pose (the captain salutes). On the right: the activity tag, room name, who, the line, and buttons. The buttons are `acts` (a primary action and others) or `choices` with a standing note (the Bar). A button shows a toast. Esc or a backdrop tap closes it. |
| P9 | **Board / depart** | An exterior image (`exterior.jpg`) covers the stage while "outside". **Board**: a CSS shuttle flies in and docks, the exterior zooms ×1.14, then a cyan scan line sweeps left to right while a clip-path reveals the cutaway (1.1 s) and the cutaway zooms back to 1. **Depart** reverses it and the shuttle leaves. The crew, hotspots and editor are hidden outside. Reduced motion makes the durations 1 ms. |
| P10 | **Layout editor** | "✎ Edit layout" (or the **E** key) enters edit mode, available inside only. Drag a room to move it, drag the gold corner to resize, drag the cyan dot to move the stand spot along the floor, and drag a deck pill to move that floor; the crew lanes follow live. A readout shows the numbers. **Copy JSON** / **Download ship-layout.json** exports `{floors, rooms}` (private `_` keys stripped) through the `downloads` capability, or a blob download when local. |
| P11 | **Light** | Hemisphere fill, a warm sun and a cool rim. sRGB output. |

**Known limits of the prototype:**
- The backdrop is one painted image per ship, so changing a room means re-rendering art. This is the owner's reason for
  primitives.
- `STANDING` is hard-coded.
- The avatar does not use stairs or lifts.
- Crew use `Math.random`, so the scene differs every load.
- Each figure is about 40 meshes.
- Hotspots are DOM boxes over an image, not tied to 3D rooms.
- Nothing is saved, and `acts` only toast.
- Phone portrait shows the whole 16:9 stage letterboxed and small.

## 3. Target

The same experience, inside the game, drawn from data:

```
content/ships/<faction>/ship-layout.json   ← authored with the layout editor (P10)
        │
layout.js (pure: load, validate, derive lanes / doors / lifts)
        │
   ┌────┴──────────────┬───────────────────┬────────────────────┐
primitiveRooms.js   hull.js           crew (Ship-Crew)     roomView.js (camera, hotspots, states,
(shell + props)     (primitive frame)                       walk-to, board / depart, dialog hook)
```

### 3.1 Data — `ship-layout.json`

It keeps the prototype's export shape so the editor stays the authoring tool, with additions marked ⊕:

```json
{
  "ship": "collective",
  "name": "The Long Ledger",
  "floors": [40, 57, 90],
  "rooms": [{
    "id": "bar", "name": "Bar", "fac": "collective", "cap": false,
    "who": "Supercargo Dorian Quell · Collective", "line": "…", "flag": "talk",
    "choices": [{ "t": "Business is business.", "effects": [{ "fac": "collective", "d": 2 }] }],
    "unlock": null, "x": 49, "top": 44, "w": 23, "h": 16, "fx": 60, "floor": 1,
    "⊕ purpose": "contracts",
    "⊕ theme": "warm",
    "⊕ props": "bar",
    "⊕ skin": "primitive"
  }],
  "⊕ lifts": [{ "x": 8, "floors": [0, 1, 2] }],
  "⊕ hull": { "x0": 3, "x1": 95, "top": 8, "bottom": 98, "dome": { "x": 52, "w": 26 }, "stern": "left" }
}
```

- `choices[].effects` replaces the prototype's free-text `note`. Its meaning is owned by Dialog-Response-Reputation.
- `purpose` routes a tap to a hub feature (§5.4).
- `props` is a preset name or an inline list (§3.3).
- `skin` defaults to `primitive`.

### 3.2 Validation (`layout.js`)

`validateLayout(json) → { ok, errors[] }` checks:
- every room lies inside the hull box;
- every room sits on an existing floor;
- the stand spot `fx` lies inside the room's x-range;
- no two rooms on one deck overlap;
- room ids are unique;
- every `unlock.fac` and `fac` is a known faction;
- every lift serves at least two floors.

It also derives:
- **lanes**: per floor, from the leftmost to the rightmost room edge;
- **doors**: shared walls between same-deck neighbours, which become gaps;
- **lift stops**.

The review page shows the errors loudly. The game refuses an invalid layout and logs it.

### 3.3 Rooms from primitives (`primitiveRooms.js`)

**Shell**, from the room box, in the same 100 × 56.25 orthographic world as P1:
- back wall at z −6, in the occupant faction colour at 40 % value;
- floor slab whose top sits on the deck line, with a lighter 1.2 % top strip so the floor reads straight-on;
- ceiling slab with an emissive strip (warm or cool per `theme`);
- side walls 0.6 units thick, with a door gap of 3 × 4.5 units at floor height wherever §3.2 found a neighbour;
- a sign plate over the door, using a canvas-texture name from one shared 1024 × 256 atlas for all rooms;
- a frame outline whose material carries the room state.

**States:** `normal | dim | highlight | locked | flagged`.
- `dim`: 35 % brightness, half desaturation.
- `highlight`: gold outline and glow.
- `locked`: grey, half brightness, hatch texture in the lock faction colour, lock badge.
- `flagged`: pulse in the flag colour.

These reproduce P4 and P5 in 3D, so the hotspot is the room itself.

**Props.** A recipe is a list of `{shape: box|cyl|sphere|plane, at:[x,y,z], size:[w,h,d], color, glow?}` in room-relative
units, or a preset name. There is one preset per prototype room:

| Preset | Props |
|---|---|
| `helm` | Consoles with glowing screens, captain's chair, viewport of star points |
| `chapel` | Altar, candles with glowing tips, pews, tinted window panes |
| `armory` | Two tank hulls (box + turret cylinder + barrel), weapon rack, crate |
| `bar` | Counter + lip, 4 stools (marked as `seat` points), back shelf with bottles, 2 booths, 3 glowing lamps |
| `trade` | Ticker (glowing plane with a scrolling canvas texture), desks, crate stacks, scale |
| `loading` | Orange container stacks, gantry frame, door stripes, clamps |
| `engineering` | Reactor cylinder (pulsing glow), pipe runs, panels |

- **Points of interest.** Presets name points the crew use (`seat`, `stand`, `work`, `lean`) via `poi: "seat"` on a prop.
- **Merging.** Static props merge per room into one vertex-coloured `BufferGeometry` plus one glow geometry. A room is
  about 4 draws; seven rooms plus the hull is about 32.

### 3.4 Hull (`hull.js`)

- A rounded rectangle from `hull` (extruded thin `THREE.Shape`, Collective ivory, from the ship's palette).
- An orange flank stripe and a dark interior plane behind the rooms.
- A dome stub over `hull.dome` and a stern block on `hull.stern`.

It hints at the ship without copying a model that will be revised. When a revised ship has a real side profile, `hull`
gains an optional `profile` polyline exported from Blender.

### 3.5 Room view (`roomView.js`)

| Area | Behaviour |
|---|---|
| **Camera** | The prototype's orthographic frame, plus drag-to-pan and pinch / wheel zoom, from the whole ship down to one room filling about 70 %. Tapping a room eases to it. |
| **Phone portrait** | The width fits the focused room plus one neighbour, with a minimap strip of the hull at the top showing the viewport. |
| **Picking** | Raycast against room frames. DOM hotspots remain only as an accessibility layer (a focusable button per room, with its aria-label carrying the lock text), positioned from the projected room box. |
| **Walk-to** | The avatar walks its deck lane to the lift, rides it (Ship-Crew §4), walks to the room's stand spot, then fires `onRoomOpen(room)`. |
| **Room dialog hook** | `onRoomOpen` opens the existing modal (P8) for `acts`. Rooms with `choices` or a script hand over to the conversation panel (Collective-Opening `src/dialog/conversation.js`, response mode in Dialog-Response-Reputation). |
| **Board / depart** | P9's sequence. The exterior is the ship GLB at the side view in the game, or `exterior.jpg` on the review page. The scan wipe becomes a full-screen shader pass, so it works over 3D. |
| **Pause** | Hidden canvas → stop. Backgrounding → stop. |

### 3.6 Layout editor (`layoutEditor.js`)

The prototype's editor (P10), ported to drive the 3D rooms. It adds:
- room add / delete / rename;
- the `fac`, `flag`, `props` and `unlock` fields in a side panel;
- lift placement;
- a live validation readout (§3.2).

It is loaded only on the review page and with `?edit=1`, and never ships to players by default. Export is unchanged.

## 4. As-built → target, feature by feature

| Prototype | Target | Change |
|---|---|---|
| P1 stage | `roomView` orthographic world | Same coordinates; adds pan, zoom and phone fit. |
| P2 `ROOMS` | `ship-layout.json` | Moved to data; adds `purpose`, `theme`, `props`, `skin`; `note` → `effects`. |
| P3 floors | `floors` + lanes + lifts | Lifts added. |
| P4 hotspots | Room frame states + accessibility buttons | Picking moves into 3D. |
| P5 locks | `locked` state + standing from save | `STANDING` comes from Dialog-Response-Reputation. |
| P6 crew | Ship-Crew-Characters | Seeded, merged, posts, lift. |
| P7 avatar | Walk-to with lift | Crosses decks properly. |
| P8 room dialog | Modal for `acts`; conversation panel for `choices` | Actions call hub features. |
| P9 board / depart | Same sequence; GLB exterior; shader wipe | — |
| P10 editor | `layoutEditor.js` | More fields, validation. |
| `cutaway.jpg` | Primitive rooms | Image kept only as `skin: 'image'` (§6). |

## 5. Work

### 5.1 Port the prototype into modules

`src/ship-interior/{layout, primitiveRooms, hull, roomView, layoutEditor}.js`, and
`content/ships/collective/ship-layout.json` seeded from the prototype's `ROOMS` and `FLOORS`.

### 5.2 Primitives replace the backdrop

§3.3–3.4. Room presets for all seven rooms.

### 5.3 Review page

`prototype/test-game/tools/ship-interior/index.html`:
- the room view with the editor;
- the crew layer;
- standing toggles per faction to preview locks;
- tier, reduced motion, and phone portrait and landscape frames.

It is standalone (owner rule: reviewable outside Claude). The prototype stays beside it for comparison.

### 5.4 The hub

- **Entry.** Tap Vesper in the galaxy, or the "Collective" menu entry. The Long Ledger appears at the side view;
  **Board** runs the scan and opens the room view. **Depart** returns to the galaxy.
- **Room purposes in the first version:**
  - `contracts` (Bar): the Collective contract and maps 1–3 missions, from the existing mission system.
  - `transport` (Loading Bay): your transport and the idle haul.
- **Other purposes**, shown as ambience until their stories land:
  - `missions` (Helm): faction missions.
  - `market` (Trade Station): sell.
  - `upgrade` (Armory).
  - `counsel` (Chapel).
  - `power` (Engineering).
- **Flags** come from game state (a ready mission → `mission`; uncollected haul → `reward`), not from the layout.
- **Persistence:** none here beyond what the features save.

### 5.5 Every faction's ship

**As built (v2026.11.09-p).** Owner 2026-11-09: "It seems like rooms are missing in the ships. All ships should have all
neutral rooms and faction specific rooms on the correct capital ships." Until a faction's own layout is authored,
`src/ship-interior/shipRooms.js` `factionShipLayout` derives it from the Long Ledger's:

- **Neutral rooms, on every ship:** Helm (the captain), Armory, Bar, Trade Station, Loading Bay and Engineering. The
  host faction crews them, and none is sealed. The Long Ledger's locks belong to its envoys, not to a faction's own
  ship.
- **The faction room, on that faction's ship only,** goes in the Chapel's slot:

| Faction | Room | Preset |
|---|---|---|
| Ground / Powder | War Room | `warroom`: map table, regimental flags |
| Air | Flight Deck | `flightdeck`: a fighter, runway lights |
| High Tech | Shield Lab | `shieldlab`: generator dome, panels |
| Artillery | Fire Control | `firecontrol`: plotting table, shell racks |
| Water | Moon Pool | `moonpool`: open pool, railing, winch |
| Arcane / Energy | Chapel | `chapel` |
| Space Tech | Observatory | `observatory`: telescope, star window |
| Dark Energy | Void Shrine | `voidshrine`: obelisk, ring |
| Greenies (Chem) | Greenhouse | `greenhouse`: planters, grow lights, vats |

- **The Long Ledger** keeps its authored envoy rooms, including the sealed Chapel and Engineering that teach standing
  locks (Collective-Opening-Design §5).
- **To review:** `tools/ship-interior/?ship=<faction>`.

The loader takes `ship` → `content/ships/<faction>/ship-layout.json`. Only `collective` exists now. Each faction's
capital ship arrives (existing rule: after map 3 at 3★) with a layout authored in the editor once its interior is
designed.

## 6. Room skins later

`skin: 'image'` restores the prototype's mode: a rendered cutaway behind invisible room frames, with the frames still
carrying state, picking and crew. `skin: 'model'` loads a GLB room kit at the room box. Both are optional and
per-room, so a revised ship can convert room by room. Neither is built in this epic.

## 7. Tests (node --test, local suite)

| Test | Checks |
|---|---|
| `ship-interior/layout.test.mjs` | The committed Collective layout validates; the prototype's 7 rooms and 3 floors load unchanged; door gaps are found between neighbours; overlaps, off-floor rooms, unknown factions and stand spots outside rooms are each refused with the room named; the editor export round-trips. |
| `ship-interior/primitiveRooms.test.mjs` | Every preset builds; ≤ 4 draws a room; `setState` covers all five states; a locked room's badge names its faction and level. |
| `ship-interior/roomView.test.mjs` | Picking a room's projected centre returns that room; walk-to across decks visits the lift; reduced motion makes board / depart instant. |

**Headless review.** Playwright + swiftshader on the review page: whole ship, a focused room, locked rooms, the editor,
and phone frames.

## 8. Stories

| # | Story | Depends on |
|---|---|---|
| I0 | Prototype sources committed and recorded (as built) | — |
| I1 | Room view from primitives: port stage + editor, `ship-layout.json`, primitive rooms and hull (was Opening S3) | — |
| I2 | Crew rig port and new poses (Ship-Crew-Characters; was Opening S4) | — |
| I3 | Crew life (Ship-Crew-Characters; was Opening S5) | I1, I2 |
| I4 | Walk-to across decks + room dialog hook + board / depart over 3D | I1, I2 |
| I5 | Hub entry and the Bar / Loading Bay purposes (was Opening S8) | I3, I4, Opening S7 |
| I6 | Review page + headless review (room view, editor, locks, phone frames) | I1, I3 |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Primitive rooms read as placeholder | Presets chosen to name each room at a glance; toned palette, light strips, signs; I1 lands first for an owner look. |
| Phone portrait | Room-plus-neighbour fit, minimap, focus on tap. |
| Room list changes | It is data, edited in the editor and validated. |
| Faction ships revised | Layout and crew are independent of skin (§6). |

## 10. Notes

- **2026-11-05.** Plan written from the Long Ledger prototype as built. The prototype and the Character Sheet were
  combined in one demo (owner). There were no tickets or plan for that work; I0 records it.
- **2026-11-05, I1 as built for the intro** (`feat/collective-intro-ingame`, story `story_mw4d1bsw_q`).
  > **owner**: "We need to put the prototype in the game" … "Do rooms and capital ship presentation for collective intro
  > only as in game prototype"

  Built:
  - `content/ships/collective/ship-layout.json`: the prototype's seven rooms and three decks, plus `props`, `theme`,
    `purpose`, `hull` and an empty `lifts`. Faction keys are the registry's (`space`, not the prototype's
    `spacetech`). `choices[].effects` replaces the free-text `note`.
  - `src/ship-interior/layout.js`: `validateLayout`, `prepareLayout` (floor, lanes, doors), `isLocked`, `toWorld`.
    Tested in `layout.test.mjs`.
  - `src/ship-interior/primitiveRooms.js`: the shell, the seven prop presets, the sign, the frame and the sealed-room
    hatch, merged per room into one vertex-coloured mesh plus one glow mesh. The hull is a rounded ivory silhouette
    with a dark interior, an orange stripe, a dome stub and a stern block. States are `normal | dim | highlight`, plus
    the flag pulse and the locked look.
  - `src/ship-interior/roomView.js`: the 100 × 56.25 orthographic stage. The camera fits the whole ship or eases to
    one room. Also picking, screen boxes for DOM labels, ambient crew in depth layers, one post per room, the
    patron seated at the bar and the avatar's walk-to.
  - `tools/ship-interior/index.html`: review page (`?state=bar`, `?flash=1`, `?focus=bar`, `?reduced=1`,
    `?standing=arcane:Trusted`).

  Not yet:
  - the layout editor (P10);
  - lifts and walking between decks (the avatar starts on the bar's deck);
  - DOM accessibility hotspots and lock badges;
  - drag and pinch on the camera;
  - the hub.

  Draws: the rooms and hull are about 40 draws; the crew is most of the rest (≈ 480 for the whole ship at 1280 × 720,
  ≈ 120 close on the bar). Merging figures stays with I3.

## Dependencies

| relation | document | what it holds that this plan does not restate |
|---|---|---|
| implements | docs/16 Bulwark MM/design/Collective-Opening-Design.md | the room list, primitive-room direction, hub behaviour and open decisions |
| depends-on | docs/tech-plan/Ship-Crew-Characters.md | the figures, poses, lanes, lift rides and posts |
| depends-on | docs/tech-plan/Dialog-Response-Reputation.md | reply effects, the standing model and lock thresholds |
| depends-on | docs/tech-plan/Collective-Opening.md | the conversation panel and the first-run entry into this view |
