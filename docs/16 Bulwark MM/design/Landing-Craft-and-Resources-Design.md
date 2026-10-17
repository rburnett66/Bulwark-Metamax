# Landing Craft, Landing Sequence and Resource Models — design

**Version:** 1.1 (2026-10-16) — v1.1 adds §3.4 landing polish (flare, thruster wash, set pieces) · epic **LC** [MM-epic_mvbkrvnz_2] · stories [MM-story_mvbk1hf3_1] (craft),
[MM-story_mvbks05m_4] (landing sequence), [MM-story_mvbks25v_5] (resources)

**Owner request (2026-10-16):** landing craft that occupy a 3 × 3 space, fly into the map and land before
deploying the resource harvesters; a defense weapon centre-top (shield, mortar, cannon, anti-aircraft missiles,
anti-troop gun or rocket launcher); ten variations — a beginner neutral craft and one per faction; detailed 3D
models. Then: "These are great, add them to the game repo and write up a design document. Also create an animation
package so the ships can fly into the scene and land before deploying the resource gathering vehicles. We also need
3d models for all the collectible resources in the game."

Everything here runs under `?renderer=three` (the three.js battle view). The Pixi view is unchanged.

---

## 1. What the player sees

1. The level loads; the opening dialogs play (how-to-play once, contract offer, wave intel, the faction's speaker).
2. When they close — the moment TAP TO START appears — the player's **landing craft** flies in nose-first from the
   west edge, flares, descends on its lift jets with the gear coming down, and touches down on the base cells in a
   ring of dust.
3. Both side hatches drop into ramps. The harvesters drive down the ramps and roll onto their docks.
4. The craft **is the base** for the rest of the match: its roof weapon tracks the base cannon's aim, its sensor head
   scans, a shield craft keeps its dome up.
5. The resource fields around the map are the battle planet's own crops — grain sheaves on Verdance, ice blocks on
   Rime, glowcap mushrooms on Xenthe — each with a coloured ring for its role.

The sequence is **presentation only**. The sim never waits for it and never sees it; the build phase stays
player-paced, and tapping start mid-landing just lets the wave begin while the craft settles.

## 2. The ten landing craft

Source: `prototype/test-game/src/render3d/craft/models.js`. Review page: `tools/landing-craft/` (§7).

| # | key | craft | faction (homeworld) | roof weapon | head | look |
|---|---|---|---|---|---|---|
| 0 | `lc_neutral` | **BS-7 Pathfinder** | Neutral / System — beginner | cannon | radar dish (spins) | the owner's reference sheet: ceramic white, orange + black diagonal livery, blue engine cluster |
| 1 | `lc_ground` | **Ironhoard Casemate** | Ground / Powder (Verdance) | anti-troop gun — twin rotary guns behind a raked shield | optic (sweeps) | olive slab armour, rivets, brass trim, oxblood banners, bunker cupolas, exhaust stacks |
| 2 | `lc_air` | **Skylark Carrier** | Air (Florael) | anti-aircraft missiles — twin 4-cell pods | bar radar (spins) | white, sky blue, racing red; long bubble canopy, nacelle pods, swept and tail fins |
| 3 | `lc_hightech` | **Sterling Vault** | High Tech (Ochre) | shield — three-prong projector | sensor hoop (spins) | graphite wedge monolith, gold spine and trim, white light-lines, hex pods |
| 4 | `lc_artillery` | **Siegeworks Emplacement** | Artillery (Kessra) | mortar — four tubes | bar radar (sweeps) | khaki + olive, hazard skirts, sandbag roof, ammo crates, splayed stabilizer legs |
| 5 | `lc_water` | **Tideborn Ark** | Water (Rime) | rocket launcher — harpoon rack | radar dish (sweeps) | ONE nautilus-shell hull (pearl growth ribs, keel, fins, coral blisters), steampunk-fitted: brass-ribbed wheelhouse with a glass bathysphere nose, bow salon window, amber portholes, steam pipes, gauges, vent cowls |
| 6 | `lc_arcane` | **Sanctum of the Flame** | Arcane / Energy (Cinder) | shield — halo spire | twin halos + flame orb (spin) | ONE cruciform basilica: nave bow-to-stern, transept gables are the resource portals, crimson hipped aisle roof, bonded turrets and flying buttresses |
| 7 | `lc_space` | **Lumen Survey Lander** | Space Tech (Lumen) | cannon — twin-rail railgun | large survey dish (sweeps) | federation white + navy, cyan ring-lights, capsule hull, drum pods, sensor masts |
| 8 | `lc_dark` | **Hollow Choir** | Dark Energy (Xenthe) | mortar — glowing corruption tubes | eye on a stalk (sweeps) | obsidian + violet, magenta seams, spiked ridge and pods |
| 9 | `lc_greenies` | **Brood Hive** | Greenies / Chem (Vexmire) | rocket launcher — spore rockets | spore pod (spins) | swamp green + toxic yellow, segmented organic hull, hex brood pods, glowing chem tanks |

All six weapon types are used; cannon, shield, mortar and rocket launcher twice each. The weapon is one line per craft
(`weapon: wMortar(roof)`), so reassigning is cheap. Choices follow the GDD's faction identities (§9): Air owns the sky;
High Tech "precision, shields"; Arcane "energy weapons, shields"; Artillery "range & arc"; Dark Energy "DoT,
corruption"; Greenies "swarms, chem clouds"; Space "orbital tech".

Approval history: v1 modular set (all ten); Sanctum and Tideborn reworked as single sculpted hulls (owner: "less
modular and more solid and shaped", same scale and shape); Tideborn given a clear cockpit, windows and steampunk
detail; then "These are great".

### 2.1 Layout (the owner's 3 × 3 sheet)

Nose = +X. 4 model units = 1 cell (`CRAFT_SCALE = 0.25`), so a craft fills X, Z ∈ [−6, 6] — the base's 3 × 3 cells.

```
            −Z (north)             centre                +Z (south)
 front   defense pod      ·   cockpit              ·   defense pod        x  2 .. 6
 middle  resource hatch   ·   main hull + WEAPON   ·   resource hatch     x −2 .. 2
 rear    pod + engine     ·   engine block / cargo ·   pod + engine       x −6 .. −2
```

The craft lands nose **east**, so its two hatches face **north and south** — exactly where the sim's harvester docks
are (`harvest.js` docks 2 cells N / S / E / W of the base centre). A hatch ramp's foot is 2.2 cells from the centre.
Opening 3.3 × 3.0 units fits SYS-Harvester (≈ 3 × 2.7). Barrels overhang the nose to 6.4 units; everything else
stays inside ±6.2. Heights: roof 3.9–5.1 units; overall ≈ 1.6–1.9 cells for gun crafts, 2.2 for the High Tech
projector and 2.8 for the Arcane spire (the tallest thing on the field, by design).

### 2.2 Model contract

Same part schema as the unit models (box / cyl / ext / loft / ell; one material key per part; `mir` mirrors in Z;
`d: 1` = detail). Built by `units/prims.js`. Authored pose = **landed, gear down, doors closed**, so anything that
ignores the animated groups still draws a parked craft.

| group | parent | motion | landing.js field |
|---|---|---|---|
| `body` | model | — | — |
| `weapon` | model | yaw (aims) | — (follows the base cannon) |
| `head` | weapon | sweep or spin (`def.head`) | — |
| `gear` | model | translate +Y by `anim.gear.retract` (1.15) to stow | `gear` 0 stowed … 1 down |
| `doorR` / `doorL` | model | rotate about X at the sill hinge, ±`anim.doorR.open` | `doors` 0 shut … 1 open |

**Palette per craft** (`def.palette`), not the units' global table: ten liveries share the same keys. Keys: the unit
set plus `accent`, `stripe`, `trim`, `brass` (metal/roughness added to `units/metal.js` UMETAL) and `glowE` (engine
light). Every `glow*` / `amber` key is unlit.

**Ramp angle is derived:** `open = 180° − acos((sill − 0.06) / doorHeight)` so the door tip lands on the ground
(sill 1.0, door 3.0 → 108°, an 18° ramp).

## 3. The landing sequence package

Two modules, split so the whole choreography is testable without WebGL:

- `render3d/craft/landing.js` — **pure**. The phase table, one-shot events, `landingPose(t, opts)`,
  `createLanding(opts)` (`step(dt)` → events crossed, `skip()`, `pose()`), `landedPose()`, `rampOf(def)` and
  `harvesterOnRamp(def, k)`. No three.js, no clock, no randomness.
- `render3d/craft/craft3d.js` — **the binder**. `createCraft3D(THREE, scene, key, opts)` builds the craft and
  exposes `place(baseCell)`, `apply(pose)`, `aim(yaw, dt)`, `scan(t)`, `setEnv`, `setMetal`, `setCastShadow`,
  `setVisible`, `toWorld(local)`, `dispose`.

### 3.1 Timeline

| phase | seconds | what happens |
|---|---|---|
| approach | 0 – 4.2 | cruises in nose-down (−6°) from 70 units (17.5 cells) out and 26 up, leaving contrails; from 55 % it **flares** — leans back 17° to turn the lift jets against its momentum; gear stowed; nav lights on |
| descent | 4.2 – 7.4 | arrives still drifting 5 units short and bleeds it off over 1.9 s as the lean-back eases, rocks 3.5° nose-forward as it levels; sinks from 8 units, still moving at contact; gear down 5.2 – 6.8 s; the wash hits the ground under 13 units — smoke billow, kicked debris, glow pools, scorch |
| touchdown | 7.4 – 8.4 | **shockwave** ring + burst, camera thump; the hull dips into its suspension and springs back (gear planted), rocks nose-down once; lift jets cut, nozzles cool through orange and steam |
| hatches | 8.4 – 9.8 | seams vent pressurised air; the doors unlatch, fall under their own weight, slap down as ramps (dust at the lip, small thump) and bounce once; shield crafts raise their dome; nav lights fade |
| deploy | 9.8 – 14.0 | harvesters drive down the ramps (70 %), then ease onto their sim positions (30 %) |

Events (fired once each, in order, whatever the frame step): `gearDown`, `touchdown`, `hatchesOpen`, `rampsDown`,
`deployStart`, `done`. Durations live in `PHASES`; everything else derives from them.

**Pose** — `{ phase, label, t, x, y, z, yaw, pitch, roll, gear, squash, doors, lift, rear, dust, shield, shadow, harv,
nav, heat }` in model units around the landing spot; `squash` = suspension travel (the gear's counter-offset);
`nav` = navigation lights 0…1; `heat` = engine heat 0…1; `yaw` uses three's rotation.y (nose along (cos yaw, 0, −sin yaw)); `harv` is
the harvester progress 0…1, or −1 while they are still aboard.

**Approach bearing** — `opts.fromDeg` (180 = from the west, the default); the craft always lands nose east, so the
hatches always meet the docks.

### 3.2 In the game (`render3d/index.js`, `main.js`)

- `createRenderer3D(…, { craft, landing, landingHeld, landingFrom, planet })`. The craft replaces the placeholder base
  mesh (`markers.setBaseVisible(false)`; towers still aim from the base cell).
- **When it plays:** `main.js` creates the renderer with `landingHeld: true`; the craft waits off-stage.
  `releaseLanding()` → `startLanding(r)` fires when the match-start dialogs close (TAP TO START appears), when there is
  no opening dialog, or at the latest when the first wave starts. A fresh board (restart, new map) calls
  `armLanding(r)`. `skipLanding(r)` jumps to the end.
- **Harvesters** — `landingHarvesters(r, state, views)` filters the drawn unit list during the sequence: harvesters
  are hidden while aboard, then follow `harvesterOnRamp` out of the hatch that faces their dock (north dock → north
  hatch), facing out, and ease onto their real sim position. After `done` the sim views pass straight through.
  The sim's units are never touched.
- **Roof weapon** — yaws toward `state.base.cannon.aimPos` when the cannon is aiming, idles in a slow sweep
  otherwise; turn rate is capped per frame.
- **Shadows** — airborne the craft does **not** cast into the static shadow map (that would re-render it every frame);
  a blob shadow follows it instead. On `touchdown` it starts casting and the map re-renders once.
- **World** — the metal finish reflects the world palette's sky and apron (`setWorld` → `craft.setEnv`).
- **Low tier** — no exhaust plumes, flares, glow pools or contrails; wash particles at 40 %; everything else the same.
- **Camera** — `r.craft.shake` (cells) is added to the camera beside the combat-impact shake: a thump at touchdown,
  a tap when the ramps land.

URL flags: `?craft=<faction key | craft key>` (default `system` → the neutral craft until the shell stores the
player's faction), `?landing=0` parks it, `?planet=<faction key>` overrides the resource planet.

### 3.3 Cost

One instance per level: each group merges to one Mesh (plus one engine-glow Mesh where it has engines) — 9–10
meshes per craft. In flight: per jet a core + sheath + flare (6–9 jets), 4 nav sprites, 4 glow pools + 4 scorch
decals, blob, dust haze, ring, smoke (one instanced draw, ≤ 520) and debris (one instanced draw, ≤ 110) — ≈ 50 small
draws for the ~14 s of the landing, when no battle is running. Landed and settled: ≈ 15 (plumes, pools, nav, ring
hidden; particles at 0). No dynamic lights are added (a point light would recompile every lit material and cost
every fragment for the whole match); the jets' light is faked with additive glow pools, flares and jet-lit smoke.

### 3.4 Landing polish — it plays with no battle running, so it gets the full treatment

Pure parts in `landing.js` (`FLARE`, `IMPACT`, `suspension(s)`, `doorOpen(s)`) and `landingFx.js` (particles); drawing
in `craft3d.js`. Everything is seeded (`mulberry32` + a deterministic value-noise `noise3` / `turb`), so a level
replays the same landing; nothing touches the sim.

| beat | what | how |
|---|---|---|
| momentum | nose-down cruise, 17° lean-back flare, forward drift carried into the descent, forward overshoot as it levels, contact with 30 % of descent speed left | `FLARE`, `IMPACT.carry` |
| thrusters | per jet a white-hot tapering **core** and a wider, fainter **sheath** of expanding gas: hot at the nozzle, cooling to the craft's engine colour, soft silhouette, shock bands scrolling away; a nozzle **flare** sprite; each plume breathes on its own noise (length, width, wobble) and **squashes against the ground** instead of passing through it; engine glow shimmers, then cools through orange after the cut | `plumeMaterial`, `noise3` |
| ground effect | wash strength = thrust × (1 − h/13)²; additive **glow pools** under each lift jet; **scorch marks** that build up while the jets are close and stay after landing | `washStrength`, `softDisc` |
| smoke billow | puffs biased away from the hull, gusting per jet; ride a turbulence field (more as they slow), grow and fade unevenly, lumpy rotating outlines, sun-lit crown, **lit orange by the jet** while young | `createLandingFx`, smoke shader |
| debris | mostly grit with the odd clod (size skewed small), irregular proportions, tumbling on three axes, buffeted by the wash, 1–2 bounces, comes in kicks not a stream; larger pieces puff dust where they land | `spawnDebris` |
| contrails | pale vapour streaming from the rear nozzles while cruising | `fx.trail` |
| touchdown | **shockwave**: a fast ring of dust + debris burst and an expanding ground ring; **camera thump**; suspension dip 0.55 → spring (ω 11, damping 4.6) with the gear planted; one nose-down rock | `fx.burst`, `suspension` |
| cooling | white **steam wisps** curl off the hot nozzles after the cut | `fx.wisp`, pose `heat` |
| hatches | **pressure vents** burst from the door seams; doors unlatch, fall (accelerating), slap down — **ramp dust** and a small tap — and bounce 5 % once | `fx.vent`, `doorOpen`, `fx.slap`, event `rampsDown` |
| lights | red port / green starboard pulsing, white strobes nose + tail double-flashing; fade after the hatches open | nav sprites, pose `nav` |

Tuning lives in `FLARE`, `IMPACT`, `CAPS`, the rates at the top of `landingFx.js`, and the spawn helpers.

## 4. Resource models — every collectible

Source: `prototype/test-game/src/render3d/resources/models.js`. Every homeworld has four resources (`data/planets.js`,
[MM-story_mvaf1d85_v]), so 9 × 4 = 36 models. Tier ← sim node:

| tier | sim node | ring | economy |
|---|---|---|---|
| common | `role: primary` | blue | the field the player harvests |
| uncommon | `role: premium` | yellow | worth 2× the common |
| rare | `role: quest`, red | red | collected for the unknown associate |
| epic | `role: quest`, green | green | collected for the unknown associate |

The battle planet is the **enemy faction's homeworld** (maps are faction-owned), passed from `main.js` as `planet`.

| homeworld | common | uncommon | rare | epic |
|---|---|---|---|---|
| Verdance (Ground) | **Loam Grain** — three bound wheat sheaves on tilled soil | **Heartwood Amber** — cut stump crowned with amber, one lump glowing | **Rootsong Seeds** — root mound with glowing green seeds | **Elder Bloom** — a great white-and-gold flower with a glowing heart |
| Florael (Air) | **Petal Silk** — rolled silk bolts and drifting petals | **Skyhoney** — a stacked honeycomb, its top cells glowing | **Dawnpollen** — glowing dandelion puffs on tall stems | **Choir Lily** — three white lily trumpets with lit throats |
| Ochre (High Tech) | **Sunsalt** — tumbled white salt cubes on sand | **Dune Quartz** — clear hexagonal quartz points | **Mirage Oil** — an iridescent violet-teal pool with bubbles | **Solar Pearl** — a floating sun-orb with a halo over fulgurite glass |
| Kessra (Artillery) | **Slag Iron** — rusty slag rocks | **Mesa Copper** — a mesa block veined in copper | **Ghost Brass** — a pile of old brass shell casings | **Dreadnought Core** — a half-buried reactor drum with a red-glowing window |
| Rime (Water) | **Brine Ice** — salt-crusted ice blocks | **Frost Pearl** — an open clam with its pearl | **Glacier Breath** — ice spikes around a glowing core | **Leviathan Scale** — great iridescent scales standing in the ice |
| Cinder (Arcane) | **Ash Basalt** — hexagonal basalt columns with an ember seam | **Ember Obsidian** — black glass shards with glowing cracks | **Phoenix Glass** — a twisting spire of fire-glass | **Heartflame** — a floating living ember in a black-rock cradle |
| Lumen (Space) | **Regolith** — grey moon rubble | **Helium-3** — pale frost crystals with a cyan glow | **Starfall Iron** — a meteorite in its crater, glowing seams | **Void Lens** — a floating violet-rimmed lens over a stone |
| Xenthe (Dark) | **Glowcap Spores** — teal/cyan glowing mushrooms | **Duskmoss Resin** — moss mound beaded with violet resin | **Dreamspore** — a tall pod freckled with pink light | **Mycelial Heart** — a knot of hyphae around a magenta core |
| Vexmire (Greenies) | **Mire Peat** — stacked peat bricks | **Venom Sap** — gnarled roots oozing toxic green sap | **Hive Jelly** — hex brood pods brimming with yellow jelly | **Broodqueen Egg** — a veined egg in a twig nest |

### 4.1 Rules

- **Cell units**: origin = cell centre on the ground; fits a 0.9 × 0.9 footprint (tested ≤ 0.5 from centre) and stays
  under ~0.95 tall — taller than a crystal, shorter than a tower.
- Each model carries its own palette; `glow*` keys are unlit so the read survives battle zoom and night presets.
- **Role ring** — a flat ring in the role colour under every node keeps the economy read (blue / yellow / red /
  green) independent of the shapes.
- **Drain** — instances shrink as a field drains, quantized to quarters (0.6 + 0.4 × q) so the shadow map re-renders
  rarely; a regrowing primary at zero shows as a dimmed stub (0.4, 45 % brightness, half-bright ring); consumed or
  not-yet-revealed nodes are not drawn. Per-node yaw and ±8 % size jitter from the node id.
- **Cost** — each model merges to two geometries (lit Lambert + unlit glow) drawn as InstancedMeshes: 8 draw calls for
  all fields on the map plus 1 for the rings; 1,000–2,000 triangles per planet set.

Renderer: `render3d/resources/resources3d.js` (`createResources3D(THREE, scene, planet)` → `setResources(state)` returns
true only when the static set changed — same contract as the LPS crystals, which remain the fallback when no planet
is known or under `?ground=baked`).

## 5. Files

| path | what |
|---|---|
| `src/render3d/craft/models.js` | the ten crafts + the build kit (gear, hatches, engines, six weapons, five heads); `FACTION_CRAFT`, `craftFor`, `CRAFT_SCALE` |
| `src/render3d/craft/landing.js` | the sequence (pure): phases, events, flare, suspension, door fall |
| `src/render3d/craft/landingFx.js` | the landing particles (pure, seeded): thruster wash smoke + debris, shockwave, contrails, vents, wisps, ramp dust; `noise3` / `turb` |
| `src/render3d/craft/craft3d.js` | the binder (three.js injected): model, plume / decal / smoke shaders, nav lights, set-piece triggers, camera shake |
| `src/render3d/resources/models.js` | the 36 resource models, `tierOf`, `planResources` |
| `src/render3d/resources/resources3d.js` | instanced resource fields |
| `src/render3d/index.js` | craft + landing + resources wiring; `armLanding`, `startLanding`, `skipLanding`, `landingHarvesters` |
| `src/render3d/units/metal.js` | metal/roughness for the livery keys |
| `src/render3d/markers.js`, `structures/lowpoly.js` | `setBaseVisible` |
| `src/main.js` | renderer options; `releaseLanding` in the dialog flow |
| `tools/landing-craft/` | review pages built from the modules above (§7) |

## 6. Tests

v1.1 adds: thruster wash (ground effect, billow, debris, seeded, Low caps), flare, touchdown + hatches (contact speed, suspension with planted gear, door fall + bounce, `rampsDown`), set pieces (shockwave, vapour kinds, caps, die-out), binder set pieces (shockwave + shake fired by the timeline, scorch, `clearFx`).


`node --test prototype/test-game/src/render3d/craft/craft.test.mjs prototype/test-game/src/render3d/resources/resources.test.mjs`
(vendored three.js for geometry; no WebGL):

- ten crafts, one per registry faction + neutral; palettes and metal values cover every key; all groups and pivots;
  all six weapon types used; every craft builds, stays in its 3 × 3 footprint, 2k–14k triangles, has lift jets and
  rear nozzles;
- events fire once each, in order, for any step size; skip fires the rest; the craft never climbs after the approach,
  gear only comes down, doors stay shut in flight, any approach bearing lands on the spot nose-east;
- every ramp tip rests on the ground at a drivable angle and its foot lands at the dock distance;
- the binder poses gear, doors and attitude, nests the head on the weapon, aims, maps ramp points to world cells, and
  disposes cleanly;
- the hand-off: aboard → down the north ramp facing north → the sim's own position, then pass-through;
- 36 resource models named after `planets.js`, palettes complete, each inside one cell; tier mapping; drain quarters,
  stubs, unrevealed/consumed nodes, ring colours, determinism; the renderer builds every planet and reports change.

The full game suite (347 tests) and both deploy gates stay green.

## 7. Review tools (standalone — open outside Claude)

`python prototype/test-game/tools/landing-craft/build.py` writes, from the game's own modules (no copies):

- `dist/landing-craft.html` — the ten crafts: the landing sequence (with approach bearing), Hover / Landed / Deployed
  poses, orbit / battle camera / ortho 4-up, any of the eleven world palettes, metal on/off, the harvesters on the ramps.
- `dist/resources.html` — the 36 resources: all at once (columns = homeworlds, rows = tiers) or one planet on a
  turntable, with the drain slider and role rings.

`--offline` inlines three.js from the root `node_modules`.

## 8. Open — owner decisions

- **Player faction.** The game stores no player faction yet, so the base flies the neutral craft unless `?craft=` is
  set. When the shell records the player's faction, pass its key as `craft`.
- **Weapon per faction** (§2) — confirm or reassign; one line each.
- **Does the roof weapon replace the base super-cannon in the sim**, so the six types behave differently (shield
  absorbs, mortar arcs, AA hits air only, anti-troop shreds organics)? Today the roof weapon only follows the one
  cannon's aim.
- **Approach bearing** — from the west by default; it could come from the side away from wave 1's spawns.
- **Roster ids** for the crafts (`SYS-LandingCraft`, `GND-LandingCraft`, …) if they need sim stats.
- **Resource names** are the `planets.js` placeholders until approved; the models follow whatever the names become.

## Dependencies

| relation | plan | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/tech-plan/Terrain-Engine-3D-and-Threejs-Migration.md | the three.js battle view, its camera, static shadow map, quality tiers and the read-only rule this builds on |
| related | docs/dev/Neon-Voxel-Art-Style.md | the low-poly world palettes and the metal unit material the crafts reuse |
