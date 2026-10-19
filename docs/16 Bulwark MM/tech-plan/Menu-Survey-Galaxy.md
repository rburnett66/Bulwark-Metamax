# Menu cleanup — Main Menu + Survey, with a 3D galaxy

Owner 2026-10-19: *"the campaign selection should be integrated into the PLANET SURVEY screen. Today we have main
menu, factions, survey, campaign — I want Main Menu, Survey [with] the faction list and campaign list. I want to add a
3D galaxy view that shows the solar systems and location for each of the 9 planets. On the main menu the player can
zoom out to the galaxy view, but the default view is always the planet view for the current campaign. Once the player
is on the correct planet the player will be presented the highest unlocked campaign, but a drop down should allow the
player to select any of the unlocked campaigns. Short path: Main Menu → Survey → gameplay on the target campaign. Each
campaign is a map on the target planet."*

## Reading of the request (stated so it can be corrected)

- The **9 planets are the 9 enemy factions' homeworlds** (`data/planets.js`, keyed by faction key). "Target planet" =
  the faction you fight; it stays saved as `save.enemyFaction`.
- A **campaign is one of the 9 campaign maps** (`MAPDATA.maps`), fought on the target planet. Unlocks stay as today:
  one shared `save.unlockedThrough` (beat a map at the star gate → the next unlocks). No save-format change.
- "Current campaign" = the saved target planet + the highest unlocked map.

## Screens after the change

| Before | After |
|---|---|
| MAIN → FACTIONS → SURVEY → CAMPAIGN (maps grid) → battle | **MAIN → SURVEY → battle** |
| Post-battle "Main menu" opened the maps grid | opens SURVEY on the current planet |

Harvester, Tech Tree, Classic board, Replay, Reset and Settings stay as Main-menu side screens (untouched).

### Main menu
- Hero = the **current planet**, live (unchanged look) — always the default view on open.
- **Zoom out** (mouse wheel / pinch out / the `GALAXY` button) flies the camera out from that planet to the **galaxy
  view**; zoom in (wheel / pinch / `PLANET`) flies back. Clicking another solar system flies to it and makes that
  planet the target (saved), so the primary button and the Survey follow it.
- Primary button: **`SURVEY · <PLANET>`** → the Survey on the target planet. The old FACTIONS button is removed.

### Survey (one screen = faction list + planet dossier + campaign list)
- Left rail: the **9 planets / factions** as a compact list (thumbnail, planet, faction, maps won /9, ★ average);
  the selected one is highlighted. Click to switch; ‹ › arrows still step.
- Centre: the live globe (drag to spin). Right: the dossier (unchanged content).
- **Campaign drop-down**: the unlocked maps (1 … `unlockedThrough`), **defaulting to the highest unlocked**; a line
  under it shows that map's size, water, difficulty, par and best. Locked maps are listed disabled.
- **`BATTLE ON <PLANET> →`** saves the target planet and starts the chosen map directly (no maps grid).

## 3D galaxy (render-only, in `menu/menuStage.js`'s single WebGL canvas)
- `data/galaxy.js` (pure, tested): a seeded spiral-galaxy layout — star field (2 arms, core bulge) and the **9 solar
  systems** at fixed positions keyed by planet key, each with its star colour and the planet's orbit radius/phase.
- Scene: ~6k additive star points (two arms + bulge), each system = a glowing star + faint orbit ring + the planet as a
  small sphere tinted from its globe palette. HTML labels (planet name) are positioned by the stage each frame.
- Camera: one eased fly between two poses — **planet** (close on the target system's planet, where the live globe takes
  over) and **galaxy** (high, tilted overview). Default pose is always planet.
- Picking: a click in galaxy view raycasts the system markers (generous radius) → fly to it, then the hero swaps back
  to the live globe of the new target.
- Reduced motion: the fly is instant. No WebGL: the GALAXY button is hidden and the baked planet image stays.

## Tickets
Epic *Menu cleanup — Main Menu + Survey with 3D galaxy*: (1) Survey absorbs factions + campaign drop-down; main menu
short path; post-battle returns to Survey; FACTIONS/MAPS screens removed. (2) Galaxy data + 3D galaxy view with zoom
out/in and system picking on the main menu.

## Dependencies

| Document | Relation |
|---|---|
| — | — |
