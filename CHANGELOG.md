# Bulwark — change log

The game's build stamp lives in `prototype/test-game/src/version.js` and shows in the HUD top bar.
Each release lists the pull requests merged to `main` since the previous version bump.
MetaMax board: Bulwark MM (project 16).

## v2026.10.18-a — 2026-10-18

The 3D view becomes the game. Covers PRs #19–#61, everything merged since the last bump (Aug 7, 2026).
Release ticket: [MM-task_mvedqhsf_2].

### 3D view
- #28 Terrain prototype tools, tech plan v2.2.1, `?renderer=three` skeleton
- #29 Sim units render as 3D part-list models (LOD + planar shadows)
- #30 3D port ground truth + tech plan v2.2.2
- #32 Plateaus, rocks and trees as low-poly 3D from the sim's map
- #33 Expected-path lines from each spawn point to the base
- #34 Fix: far-zoom 3D units no longer drop extruded parts
- #35 Low-poly organic ground + 11 world palettes
- #36 Smooth hull and turret turning (no snapping)
- #38 Metal material for 3D units
- #40 Select, build and deploy under the 3D view, with placement ghost
- #42 Ring fog + battle-only camera rules
- #44 Low-poly base, walls, towers and resource crystals
- #45 Quality tiers (High / Standard / Low), auto-picked, Settings override
- #52 3D is the game's view: every map, System towers + walls, King Tiger, landing opens level 1
- #53 Base super-cannon shells + tower range / coverage map

### Combat and FX
- #41 Projectiles + combat effects in 3D
- #43 World-impact effects: sparks, booms, burning wrecks, turrets blown off
- #54 Health bars, $N pop-ups, homing AA missiles, per-base weapons, 3 s unload
- #56 Repair sparks (blue, bouncing, cooling to orange)
- #58 Turrets at true height with firing points on the barrel tips; cannon muzzle flash, smoke and
  shockwave; rocket flame trails and slower rocket fire; AA missiles tighten their turn and burst near
  the plane; dust trails on moving tanks; experimental light flashes

### Planets, factions and maps
- #46 Factions screen shows each faction's homeworld planet
- #47 Four named resources per homeworld
- #51 Landing craft base, landing sequence, 36 planet resource models
- #55 Planet Survey on faction pick; live planet + landing craft on the Main Menu
- #60 Every faction plays Powder's map 1 in its own planet's look (playtest copies)

### Menus, dialog and HUD
- #48 Accepted contract no longer hangs TAP TO START
- #49 Unknown Contact speaker, voice and favour lines
- #50 Phone landscape: menu, factions, comm card
- #56 Dialog stops when returning to the menu
- #57 Pre-battle dialogs run one at a time, in order
- #58 Landing completes before the map banner or dialog; left nav always fits, minimap never covers it
- #59 Contract card no longer covers the landing

### Simulation
- #31 Roster guard; wave attackers record their spawn origin
- #39 AIR-Trucks wall flip-flop fixed

### Unit authoring (Stack Forge)
- #19 Palette is model data; carving happens on request
- #20 #22 Unit card art and captioned 256×256 cards
- #21 Remove units from a faction without the autosave bringing them back
- #23 Fix a GPU texture leak behind a Chrome crash
- #24 Card grid decodes atlases at a capped rate
- #25 Layout and model-blur fixes; schedule reconciled against source
- #26 "+ Add unit" no longer overwrites an existing unit
- #27 .vox export matches the 3D view on every facing

### Tooling
- #37 Ground test no longer needs @napi-rs/canvas
- #61 CI runs locally (`npm test` + pre-push hook); GitHub only deploys main to Pages
