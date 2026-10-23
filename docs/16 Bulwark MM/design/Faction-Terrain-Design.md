# Faction Terrain Design: the nine battlefield planets

**Version:** 1.2 (2026-10-22) · **Status:** proposal for owner review · v1.1: owner direction on water maps (ponds that some units path around while others path over) · v1.2: owner movement rules for water, ponds only, no rivers (§2.1) · **Ticket:** [MM-task_mvj6goch_5] under epic PLN [MM-epic_mva2enos_7]
**Feeds:** PLN-FOL foliage sets [MM-story_mva2g4o7_n], PLN-MAP level picks its planet [MM-story_mva2g98f_p], PLN-ATM atmosphere [MM-story_mva2g1yw_m], PLN-AIR airborne particles [MM-story_mva2g6tn_o]
**Builds on:** `Terrain-Detail-and-Complexity.md` (the terrain as built, [MM-task_mvj5n3g1_4])

**Owner ask (2026-10-21):** "Create a terrain design and describe the terrain for each faction to be consistent with the planet and the known aspects of each faction."

**Sources:**
- GDD §2, §4, §5, §9, §11, §14, §15: `SOURCES::bulwark-gdd`
- Visual spec §6: `SOURCES::bulwark-visuals`
- `Landing-Craft-and-Resources-Design.md`
- `src/data/planets.js`: planet type, survey text, globe and resources
- `src/render3d/styles/lowpoly-palettes.js`: world palettes
- `content/planets/*.png`: the globes players see on the faction cards
- `content/maps/mapdata.js`: rivals and premium resources
- unit palettes and landing-craft comments
- `content/units` lane data
- `Style-Guide.md` §4

Paths are under `prototype/test-game/` unless they start with `docs/`.

---

## 1. Purpose and principles

A battle is fought on the **enemy faction's homeworld** (`planets.js`: the battle planet is the homeworld of the faction you fight). So each faction's terrain is the ground the player learns that faction on. It should feel like that planet from the first frame and play like that faction's war.

**Principles:**

1. **One planet, one look, one read.** Every terrain choice follows from what the planet already promises:
   - its globe image on the faction card;
   - its survey line (trees, ground, rocks, airborne);
   - its four resources;
   - the faction's trope.

   Where today's data contradicts itself, this doc picks a side and flags it (§4).
2. **Terrain is a weapon** (GDD pillar 2). Each planet's layout leans toward its faction's battlefield identity: long sightlines for the gunners, pond shortcuts for the sea tribes, choke-heavy swamps for the swarm. It must never take the fight away from the player.
3. **Blocking must read as blocking.** Anything units cannot cross (rocks, trees, cliffs, water) has to look solid or deep. Anything walkable has to look flat and open. This rule outranks style.
4. **Props are planetary, never faction-tinted** (Style Guide §4: "Trees, grass, bushes, clouds are neutral props, never faction-tinted"). A planet's flora and stone belong to the world. Faction colour lives on units, the landing craft, banners and FX.
5. **Same rules everywhere** (GDD pillar 5). All nine planets use the existing 10 terrain codes and the same sim. A planet changes what each code *looks like* and how much of it there is, never what it does.

**Fairness guardrails.** These are the checks every authored map must pass, on every planet:
- impassable cells (obstructions + water, as ground units see them) make up **12–24%** of the play area (powder-map-1 is 17%);
- at least **two distinct ground routes** reach the base, so a single wall cannot seal it (placement already refuses a full seal);
- the base gap stays open grass;
- resource fields sit on walkable ground;
- on water maps, ponds sit **between** the spawn edges and the base, so water units gain a real shortcut over them while ground units take a real detour (§2.1).

---

## 2. Shared framework

### 2.1 Water maps: ponds, never rivers

**Owner direction (2026-10-21):**
- "The most effective design for the water maps would be to include ponds that some units path around while others path over the water."
- "Water units can path over ground and water without a movement bonus. Other units can also path water but so slowly it always makes sense to path around it. This is why I want to avoid rivers and stick to ponds."

**The movement rules:**

| Unit | On ground | On water | Result |
|---|---|---|---|
| **Water units** (swimmers, floaters) | normal | **normal**, no bonus | they take the direct line, straight over ponds |
| **Everything else** that walks (enemy ground units, the player's troops, harvesters) | normal | **very slow**: allowed, but so costly that a detour always wins | they path around ponds |
| **Flyers** | ignore terrain | ignore terrain | unchanged |

Rocks, trees and cliffs still block water units and ground units alike.

**Why ponds, never rivers:**
- A pond always has a way around, so a ground unit never has to wade.
- A river that crosses the map leaves no way around. Ground units would be forced into the water at a crawl. Water would also stop being a real choice between two routes.
- So **no planet uses crossing rivers**. Water is authored as `patches` ponds everywhere, and the Forge's `connected` mode (one big body) is not used for battle maps.
- Because water is never a wall, it can never seal the base off from ground units.

**How it plays:**
- A pond sits in the way of one army and not the other.
- Water units cut straight across ponds toward the base; ground units bend around them.
- Ponds placed **on the direct lines between the spawns and the base** make the two armies arrive by different routes, and the player has to defend both.
- Towers still cannot be built on water (#110), so defences ring the shores. Pond **edges** funnel ground units; pond **far shores** are where water units come ashore.

**Who it affects:**
- Only the Water faction fields water units (5 swimmers/floaters, 3 flyers, **no ground units**; `content/units`). Its battles are on Rime, so **Rime is the water map**.
- The rules live in the sim, so they hold on every planet. A player-deployed water unit cuts across ponds anywhere. Every planet's ponds (lily ponds, oases, lava pools, bog pools) slow ground units the same way.

**What the sim does today:**
- Water units follow a fixed `waterLane` waypoint list (`pathfinding.js` `getWaterPath`) and never reroute.
- Forge maps carry no water lane, so on every forge map today (powder-map-1 and its copies) a water unit heads **straight for the base over open land**. The terrain clamp keeps it off rocks and cliffs, but it **never uses the water**. Checked 2026-10-21: a Water-faction swimmer on powder-map-1 spent all 439 ticks of its approach on land, 0 on water.
- Ground units treat water as a hard wall (nav grid), not as slow terrain.
- Both change with the pathing in §5.0.

### 2.2 The terrain vocabulary per planet

The sim has 10 codes. Each planet skins them as its own materials (what the player sees and what the survey calls it). Blocking never changes.

| Code (sim) | Verdance (Ground) | Florael (Air) | Ochre (High Tech) | Kessra (Artillery) | Rime (Water) | Cinder (Arcane) | Lumen (Space) | Xenthe (Dark) | Vexmire (Greenies) |
|---|---|---|---|---|---|---|---|---|---|
| 0 GRASS | turf & wildflowers | flower meadow | dry scrubland | packed dust | wind-packed snow | grey ash flats | pale regolith highlands | teal glow-moss | sickly marsh grass |
| 1 DIRT | tilled fields, cart tracks | petal-strewn paths | sand flats & dunes | rust dust, shell scars | blue ice sheet | black ash & cinders | dark maria regolith | violet spore loam | peat mud |
| 2 BRUSH | hedgerows | blossom bushes | thornscrub | dry twigs & scrap | tussock grass | scorched twigs | crystal scatter | glowing sprouts | reed beds |
| 3 ROCKS ⛔ | grey boulders | lilac boulders | sandstone hoodoos | slag & rubble | ice shards | basalt columns | grey shards | magenta crystal clusters | moss boulders |
| 4 TREES ⛔ | broadleaf woods & pines | pink blossom trees | cacti, acacias, dead snags | spike trees, bleached snags | snow pines, ice spires | charred spike trees, ember tips | needle spires, glowing crystals | mushroom trees | spore pods & hive mounds |
| 5 CLIFF ⛔ | low stone ridges | mossy outcrops | sandstone ridges | layered mesas | ice shelves | basalt ridges | crater walls | crystal ridges | rotting log jams |
| 6 WATER ⛔* | farm ponds | lily ponds | cyan oases | rust sumps | **ice-rimmed sea ponds (water units cross them)** | **lava pools** | **deep craters / void pits** | green seas | **toxic bog pools** |
| 7 TREE_BORDER | wood edge (brush) | blossom edge | scrub edge | snag litter | snow drifts | ash drifts | crystal dust | moss carpet | marsh edge |
| 8 ROCK_BORDER | stones | pebbles | pebbles | shell fragments | ice pebbles | pumice | crater ejecta | crystal shards | moss pebbles |
| 9 CLIFF_BORDER ⛔ | ridge rubble | outcrop rubble | ridge rubble | mesa talus | shelf rubble | basalt talus | rim rubble | ridge shards | log debris |

⛔ = blocks movement (sim `BLOCKING`). \*Water is the exception under §2.1: water units cross it at normal speed; everything else may enter it but only at a crawl, so it paths around.

### 2.3 Forge recipes

These are Terrain Forge settings per planet (`types` pct / noise 0–100, `water` mode / pct / noise). Low noise gives big smooth regions; high noise gives fine grain. They are **starting points for authoring**, not final maps. Every map is still hand-tuned and must pass the §1 guardrails.

The last two columns are **measured**: `generateTerrain` was run on a 64×32 map, averaged over seeds 7, 23 and 101. Two generator behaviours shape the numbers:
- every planet uses `patches` water (ponds), never `connected` (§2.1);
- the edge cells of every tree, rock and cliff region turn into walkable border codes, so obstacle percentages overstate what actually blocks.

| Planet | dirt | brush | rocks | trees | cliff | water (mode · pct · noise) | Impassable (measured) | of which water | Intent |
|---|---|---|---|---|---|---|---|---|---|
| Verdance | 22 · 30 | 14 · 45 | 5 · 60 | 24 · 30 | 3 · 50 | patches · 10 · 45 | 19.7% | 10.1% | farmland, woods, about 9 farm ponds |
| Florael | 8 · 30 | 22 · 55 | 6 · 55 | 16 · 45 | 2 · 50 | patches · 8 · 35 | 12.9% | 8.1% | open meadows, groves, ponds |
| Ochre | 40 · 25 | 10 · 60 | 9 · 60 | 6 · 65 | 9 · 40 | patches · 3 · 20 | 12.6% | 3.1% | open desert, hoodoos and ridges, rare oases |
| Kessra | 35 · 30 | 6 · 70 | 8 · 55 | 3 · 75 | 17 · 30 | patches · 2 · 20 | 19.4% | 2.1% | mesas and ridgelines, open killing ground |
| Rime | 18 · 30 | 8 · 50 | 6 · 60 | 12 · 40 | 6 · 45 | patches · 16 · 55 | 23.8% | 16.1% | frozen coast scattered with sea ponds (about 11 ponds of 4+ cells, largest about 90) |
| Cinder | 20 · 30 | 6 · 60 | 9 · 55 | 8 · 55 | 9 · 40 | patches · 10 · 45 | 19.7% | 10.1% | ash plain studded with about 9 lava pools |
| Lumen | 30 · 40 | 4 · 70 | 12 · 55 | 6 · 65 | 7 · 50 | patches · 7 · 30 | 14.3% | 7.1% | cratered regolith, crystal spires |
| Xenthe | 12 · 40 | 20 · 55 | 7 · 60 | 30 · 30 | 3 · 50 | patches · 9 · 35 | 20.6% | 9.1% | dense fungal groves, glowing seas |
| Vexmire | 14 · 45 | 18 · 55 | 5 · 60 | 14 · 40 | 2 · 50 | patches · 17 · 45 | 20.5% | 17.0% | swamp of many small bog pools |
| *Forge default (reference)* | 25 · 35 | 12 · 50 | 8 · 60 | 15 · 40 | 5 · 50 | patches · 8 · 25 | 15.8% | 8.1% | |

The shape of each planet shows in where its blocking comes from:
- **on land:** Kessra 17% (mesas) and Xenthe 12% (groves);
- **in water:** Rime 16% (about 11 sea ponds), Vexmire 17% (bog pools), Verdance and Cinder 10% (about 9 ponds each);
- **open:** Florael and Ochre, about 13% in total.

### 2.4 Prop kits

Today every planet uses the same two tree shapes (round, pine) and one rock shape (faceted blob), recoloured by palette. The PLN-FOL story already lists the families this design needs. Each planet picks from them:

| Family | Planets that use it |
|---|---|
| broadleaf (round) | Verdance |
| blossom | Florael |
| pine (stacked cones) | Verdance, Rime (snow-capped), Florael (few) |
| flower bush | Verdance, Florael |
| spike tree | Kessra, Cinder (charred, ember tips) |
| dead snag | Ochre, Kessra, Rime, Vexmire |
| cactus · flat-top acacia | Ochre |
| ice spire | Rime |
| needle spire | Lumen |
| crystal cluster | Lumen (cyan), Xenthe (magenta) |
| mushroom tree | Xenthe |
| spore pod · hive mound | Vexmire |

| Rock style | Planets |
|---|---|
| rounded boulder | Verdance, Florael, Vexmire (mossed) |
| sandstone hoodoo / stacked pillar | Ochre |
| layered mesa (stepped plateau) | Kessra |
| ice shard | Rime |
| hexagonal basalt column | Cinder |
| angular shard + crater rim | Lumen |
| crystal ridge | Xenthe |

**Built 2026-10-22 [MM-story_mvk4auz0_n].** The kits are data in `src/data/foliage.js` (one per planet: tree families with weights, a rock style, walkable ground cover with a density per terrain class, and kit colours). The shapes are `src/render3d/obstructions/families.js`. Every family above exists, plus snow pine (Rime) and these ground-cover families, which are walkable and purely cosmetic:

| Planet | Ground cover |
|---|---|
| Verdance | shrubs, flower bushes |
| Florael | blossom bushes, flower bushes |
| Ochre | thornscrub, barrel cacti and prickly pads |
| Kessra | dry twigs, thornscrub |
| Rime | tussock grass, frozen twigs |
| Cinder | scorched twigs with ember tips |
| Lumen | crystal scatter |
| Xenthe | glowing sprouts, toadstools |
| Vexmire | reeds with cattails, moss shrubs |

Ground cover is what keeps the nearly treeless maps dressed (Kessra map 1 has one blocked tree cell, Lumen four). It is placed on walkable grass, dirt, brush and tree-border cells. It never goes on water, a blocked cell, the base, a resource field, a spawn or a road, and it uses its own seeded stream, so adding it moved no tree or rock.

Emissive parts (embers, crystals, mushroom caps, spire tips, bog blisters) are one unlit mesh. A planet costs at most four draw calls: rocks, trees, glow and cover. The per-map triangle budget is a node test (`planetKits.test.mjs`): rocks + trees + glow ≤ 30k, cover ≤ 16k, and at least 150 plants and trees on every map 1.

### 2.5 Atmosphere, light and air

Each planet already defines a haze colour, a sun colour and an airborne kind (`planets.js`); `WORLD_LIGHT` sets the light levels per palette. The per-planet tables in §3 list them. PLN-ATM (distance haze, drifting cloud shadows) and PLN-AIR (camera particles, at most 2 draws) are where they get built. The cloud **fog of war** should tint toward each planet's haze, so the edge of the map feels like that world's sky.

### 2.6 One signature feature per planet

Each planet gets one landmark that makes a map recognisable at a glance and gives the layout a shape. It is built from the existing codes, so it costs nothing in the sim.

| Planet | Signature |
|---|---|
| Verdance | farm ponds between fields and woods |
| Florael | blossom groves ringing open meadows |
| Ochre | oases on a sightline desert |
| Kessra | mesa ridgelines over shell-scarred flats |
| Rime | pond fields: shortcuts for water units, detours for ground |
| Cinder | lava pools ringed by basalt columns |
| Lumen | craters |
| Xenthe | glowing mycelium groves |
| Vexmire | bog pool mazes around hive mounds |

---

## 3. The nine planets

Each spec gives:
- **Planet:** what the globe and survey already say.
- **Faction:** what the terrain expresses about the faction.
- **Ground:** the walkable surface.
- **Obstructions:** what blocks, and what it looks like.
- **Water:** what code 6 is on this world.
- **Resources:** where the four crops sit.
- **Signature:** the landmark.
- **Sky & air.**
- **Palette:** the current palette, and what changes.
- **Today / needs:** what the engine draws now, and what is missing.

### 3.1 Ground / Powder: **Verdance**, the contested homeland

- **Planet:** "Lush homeworld". The globe is earthlike: deep blue oceans, bright green continents, wheat-coloured plains, polar caps. Survey: green canopy trees, pines, flowering bushes; grass and wildflowers; grey boulders; pollen.
- **Faction:** *Nationalistic, old-empire army*, infantry and armour, flags and honour ("defend the realm without staining it" / "Nations are furnaces"). Their world is the farmland an empire sends its sons to defend. It is the tutorial planet, so it is the most readable and the most "normal". Terrain says *homeland worth holding*: fields, hedgerows, farm ponds, woods.
- **Ground:** about half turf with wildflowers; large low-noise **tilled fields** (dirt) laid out in broad, soft-edged blocks, crossed by cart tracks that the road bake wears into roads; hedgerows (brush) along field edges.
- **Obstructions:** broadleaf woods in a few solid copses with pines on the higher ground. Grey boulders are rare and scattered. Low stone ridges sit at the map edges (cliff 3%).
- **Water:** about **9 farm ponds** (patches 10% at noise 45). Ground units bend around them, so the gaps between pond, wood and ridge become natural chokepoints. It is the clearest use of GDD pillar 2 (terrain reroutes attackers) and teaches it on the first planet.
- **Resources:** Loam Grain (common) in the tilled fields; Heartwood Amber (uncommon) at wood edges; Rootsong Seeds and Elder Bloom (quest) on meadow far from the base.
- **Signature:** **farm ponds between fields and woods.**
- **Sky & air:** warm golden low sun (`meadow` light: "golden low sun, warm haze"), haze #a8c4ec, pollen motes.
- **Palette:** `meadow`, keep. The 2026-10-18 retune (saturated turf, red-orange canopies on cobalt trunks) is approved.
- **Today / needs:** drawable today (powder-map-1 is this planet). Needs the **flower bush** prop family for hedgerow accents, and pollen particles (PLN-AIR).

### 3.2 Air: **Florael**, the blooming sky garden

- **Planet:** "Blooming garden". The globe is periwinkle seas and soft green land splashed with **pink blossom continents**. Survey: pink blossom trees, flowering bushes; dense flower meadows; lilac boulders; petals.
- **Faction:** *Manga ace pilots*, air superiority, weak on the ground ("Bring every kid home" / "The sky belongs to whoever's fastest"). The terrain is a postcard seen from a cockpit. Because Air is weak on the ground, its world is **open**: few hard obstacles and wide meadows, so the threat reads as coming from the sky and the player's ground defence has room to breathe.
- **Ground:** dense **flower meadows** (brush 22%) over soft green, threaded by petal-strewn paths (dirt kept low at 8%).
- **Obstructions:** **blossom groves** in rounded clumps, lilac boulders, almost no cliffs.
- **Water:** small **lily ponds** (patches), pale blue with white foam. Decorative moats, never barriers that split the map.
- **Resources:** Petal Silk (common) in meadows; Skyhoney (uncommon) at grove edges; Dawnpollen and Choir Lily (quest) by ponds.
- **Signature:** **blossom groves ringing open meadows**, a sky-view composition that reads beautifully from above, because that is how Air sees it.
- **Sky & air:** bright cool light (`sakura`: sun 0.95, hemi 0.55), haze #e6c6e6, **drifting petals**.
- **Palette:** `sakura`, keep, but fix its known issue ("Sakura reads washed out", `lowpoly-palettes.js`): saturate grass (#a8e0a0 → about #8fd486) and deepen the canopy pinks one step so groves read as solid blockers against the meadow.
- **Today / needs:** drawable today with recoloured round trees. Needs the **blossom** tree family (wide, layered canopy) and **flower bush**, plus petal particles.

### 3.3 High Tech: **Ochre**, the open-market desert

- **Planet:** "Arid desert". The globe is orange-gold with **cyan oases and inland seas**. Survey: cacti, flat-top acacias, dead snags; dry scrub, pebbles, rare flowers; sandstone hoodoos; light dust. "A high white sun over open desert… long clear sightlines for precision weapons."
- **Faction:** *Capitalist mega-corp*: precision, shields, expensive ("Innovation must serve, not rule" / "Optimize everything. Forever."). Precision needs **sightlines**, so the desert is wide and open, and the few landmarks are prized: the oases are the only green, the only water, the obvious thing to own.
- **Ground:** **sand flats and dunes** (dirt 40%, low noise, long soft swells) over dry scrubland, with thornscrub patches.
- **Obstructions:**
  - **sandstone hoodoos and pillars** standing alone or in short rows;
  - sandstone ridges as long low walls (cliff 9%) that cut the map into lanes;
  - sparse **cacti, acacias and dead snags** (trees only 6%).
- **Water:** **rare cyan oases** (3%), each ringed with scrub, the only lush spots on the map.
- **Resources:** Sunsalt (common) on the flats; Dune Quartz (uncommon) at hoodoo feet; Mirage Oil by the oases; Solar Pearl (epic) out on the open sand.
- **Signature:** **oases on a sightline desert.**
- **Sky & air:** white-hot sun (`savanna`: sun 1.2), haze #f0d8a8, light blowing dust.
- **Palette:** `savanna`, keep. Raise oasis water saturation toward the globe's cyan (#5ac0c8) so the oases pop against the sand.
- **Today / needs:** drawable today with round trees (they read wrong here). Needs **cactus · acacia · dead snag** and the **hoodoo** rock style, plus dust particles.

### 3.4 Artillery: **Kessra**, the shelled mesa wastes

- **Planet:** "Barren dust". The globe is rust-orange with dark-brown mesa basins and **brown seas**. Survey: spike trees, bleached dead snags; dry twigs and pebbles; layered mesas; blowing dust. "A shelled-out wasteland of mesas and dust: ridgelines for the guns, nothing left standing in between."
- **Faction:** *Siege military*: range and arc, poor up close ("Every horizon is a range card"). The faction shelled its own world flat. The terrain is **ridgelines and open killing ground**: big stepped mesas (cliff 17%, low noise, so a few large plateaus rather than many small ones) with wide dusty flats between them. Attackers come around and between the mesas, the way an artillery doctrine would funnel them.
- **Ground:** rust dust with **shell scars** (dirt 35%), dry twigs and scrap (brush 6%).
- **Obstructions:** **layered mesas** with talus skirts (cliff + cliff border), slag and rubble heaps, a few spike trees and bleached snags.
- **Water:** **rust sumps**: small, muddy, brown (2%). Flooded shell craters, not seas.
- **Resources:** Slag Iron (common) on the flats; Mesa Copper (uncommon) against mesa walls; Ghost Brass (rare) in shell fields; Dreadnought Core (epic) half-buried in the open.
- **Signature:** **mesa ridgelines over shell-scarred flats.** It is also the setting of the revenge thread: Nerea (Water) hunts the gunner who shelled her reef. Kessra shows what that shelling looks like.
- **Sky & air:** hard dry light (`canyon`: sun 1.15), haze #c89a70, **blowing dust**.
- **Palette:** `canyon`, **change water**. Its teal water (#4ad0c8) contradicts the planet's brown seas. Set waterL / waterD to rust browns (about #8a5a3a / #5a3a2a) and foam to dust (#d8b07e).
- **Today / needs:** mesas read today as stacked boulders. Needs the **layered mesa** rock style (stepped flat-topped strata), **spike tree** and **dead snag**, **shell-crater decals** on dirt (a ground-colour stamp), and dust particles.

### 3.5 Water: **Rime**, the frozen pond coast

- **Planet:** "Frozen". The globe is white ice caps over deep-blue seas with **teal-grey coasts**. Survey: snow-capped pines, ice spires, dead stumps; ice shards, pebbles, sparse grass; snow-capped ice shards; snow. "Frozen seas and ice coasts."
- **Faction:** *Fantasy RPG sea tribes*: swimmers and floaters, coastal, Frost damage ("The deep keeps balance; so must we" / "Power sleeps below"). **Rime is the water map** (§2.1). Its ice coast is broken into a field of **sea ponds**: open water in the ice. The Water faction's units go straight across the ponds toward the base; the player's own troops and harvesters walk around them.

  The layout is built for that asymmetry:
  - **ponds sit across the direct lines** from the spawn edges to the base, so the water army comes straight over them while any ground unit has to bend around;
  - **detour ground** wraps around every pond: no pond chain closes off a route;
  - the **base sits on solid ice** with no pond touching the base gap, so the last approach is always over land.
- **Ground:** wind-packed snow, blue **ice sheets** (dirt), tussock grass in sheltered patches.
- **Obstructions:** **snow pines** and **ice spires** in clumps; ice shards; **ice shelves** as raised blue-white cliffs. These block **both** armies, so they shape the pond chains.
- **Water:** **ice-rimmed sea ponds** (`patches` 16% at noise 55: about 11 ponds of 4+ cells per map, the largest about 90 cells). Deep blue in the middle, pale at the rim, with white foam and small ice floes. A highway for water units, a moat for everything else.
- **Resources:** Brine Ice (common) on the shore ice; Frost Pearl (uncommon) at pond rims; Glacier Breath and Leviathan Scale (quest) on ice between ponds, where both armies cross.
- **Signature:** **pond fields: shortcuts for water units, detours for ground.**
- **Sky & air:** soft cold light (`winter`: ambient 0.1, sun 0.9), haze #cfe0f0, **snow**.
- **Palette:** `winter`, keep. Its red roof and rare colour (#c84a4a) gives the one warm accent on a white world.
- **Today / needs:**
  - ponds are authorable today, and placement already keeps towers off them;
  - the **amphibious water pathing** (§5) is required for the design to work. Today water units on forge maps walk straight to the base over land and never use the water;
  - also needed: **snow pine**, **ice spire** and **ice shard**, a pond-rim foam and ice-floe treatment, wakes on water units, and snow particles. Rime is where animated water (visual spec §6: surface plus sub-surface tint, ripples and wakes) pays off most.

### 3.6 Arcane / Energy: **Cinder**, the world of living fire

- **Planet:** "Volcanic ash". The globe is charcoal land with **glowing lava seas** (`lava: true`). Survey: charred spike trees with ember tips; ash, pebbles, scorched twigs; basalt columns, lava; ash and embers. "A world of living fire: the theocracy draws its energy from the lava and worships the flame."
- **Faction:** *Fantasy theocracy*: energy weapons, no ammo economy, Fire damage ("The Light is order made merciful" / "the flame is free"). The lava is their **sacred source**, and the terrain is built around it: **lava pools** like sacred wells, each ringed by ordered basalt columns, with ash causeways winding between them like temple approaches. A world that looks consecrated.
- **Ground:** grey **ash flats**, black **cinder** fields (dirt), scorched twigs.
- **Obstructions:** **hexagonal basalt columns** (rocks) in rows and clusters; basalt ridges (cliff); **charred spike trees with glowing ember tips** in sparse stands.
- **Water:** about **9 lava pools** (patches 10% at noise 45), glowing orange-yellow cores fading to deep red edges (the palette already does this: waterL #ff7a1a, waterD #d0300a, foam #ffb03a). Under §2.1 lava behaves exactly as water does.
- **Resources:** Ash Basalt (common) on ash flats; Ember Obsidian (uncommon) near the lava; Phoenix Glass and Heartflame (quest) on the ash between pools.
- **Signature:** **lava pools ringed by basalt columns.**
- **Sky & air:** dark red-brown sky (`volcanic`: clear #3a2420), ember-orange sun, haze #5a3a34, **ash and drifting embers**.
- **Palette:** `volcanic`, keep.
- **Today / needs:** lava draws today as colour bands, but does not glow. Needs **emissive lava**: unlit or self-lit lava triangles, a slow pulse, and an orange glow on nearby ground. Also the **basalt column** rock style, **spike tree with ember tips** (emissive tips), and ember particles. Cinder is the planet that most needs lighting help, since it is the darkest.

### 3.7 Space Tech: **Lumen**, the airless survey moon

- **Planet:** "Airless moon". The globe is grey, **heavily cratered**, with no clouds. Survey: needle spires, glowing crystal clusters; regolith pebbles, small craters, crystal shards; grey shards; "None: no atmosphere". "No air, no haze: the clearest sightlines in the system."
- **Faction:** *Sci-Fi federation*: orbital tech, strong vision, ignores some fog, Electric ("Explore, uplift, protect" / "Convert. Assimilate. Continue."). Their world is a **survey site**: no air, so no haze; razor-sharp shadows; a black-blue sky. **Craters** are the terrain: round basins whose rims block, so attackers thread between them.
- **Ground:** pale **highland regolith** and dark **maria** (dirt 30%, broad regions); scattered crystal dust.
- **Obstructions:** **crater rims** (rings of rock and rock border around a basin); grey angular shards; **needle spires** and **glowing cyan crystal clusters** (the only colour on the map).
- **Water:** **deep craters / void pits**: dark basins (7%, patches) at crater centres. They block like water. No liquid is implied on an airless moon.
- **Resources:** Regolith (common) on the maria; Helium-3 (uncommon) as frost in crater shadows; Starfall Iron in a crater; Void Lens (epic) floating over open highland.
- **Signature:** **craters.**
- **Sky & air:** white, unfiltered sun; **no haze** (haze #1c2236 is near-black, so distance fades toward space-dark); **no airborne particles** (survey: none). The cloud fog of war should become a dark starfield-tinted edge. This is the one planet with no air, and the fog should say so.
- **Palette:** `highlands` **contradicts the planet**: green grass, green and orange canopies, blue-green water on an airless grey moon. Add a new **`lunar`** palette:
  - greys from the globe (#7a7e86 … #d0d2d6) for ground and rock;
  - near-black (#3e424a) for crater pits;
  - cyan crystal glow (#5ac8e8) as `canopy` / `rare`;
  - very low ambient with a strong sun, for hard shadows.
- **Today / needs:** craters cannot be authored today. The generator makes noise blobs, not rings. Needs:
  - a **crater stamp** in the Forge (place a rim of rock + rock border around a pit, sized 3–7 cells);
  - the `lunar` palette;
  - the **needle spire** and **crystal cluster** props (emissive);
  - planet-off particles and a dark fog edge.

### 3.8 Dark Energy: **Xenthe**, the glowing fungal world

- **Planet:** "Fungal alien", lush 0.95. The globe is **teal and turquoise land with lime-green seas** and magenta-violet highlands. Survey: glowing mushroom trees, crystal spires; glowing sprouts, alien flowers; magenta crystal clusters; glowing spores. "A violet twilight world that glows in the dark."
- **Faction:** *Social realignment, a cult/movement*: DoT, corruption, night-strong, Poison ("remake society without cruelty" / "Erase the self; only the Movement remains"). The world is alive and **connected underground**: mycelium joins every grove, the way the Movement joins every member. The terrain is **dense and enclosing**: many fungal groves (trees 30%, low noise; about 12% of the map ends up blocked by land, the most of any planet but Kessra), so sightlines are short and the map feels like being inside something. It is a twilight world, so the light is dim and the props **glow**, which suits a night-strong faction.
- **Ground:** teal **glow-moss**, violet spore loam (dirt), carpets of **glowing sprouts** (brush 20%).
- **Obstructions:** **mushroom trees** (yellow caps, the palette's canopy, on violet stalks) in big groves; **magenta crystal clusters** and crystal ridges.
- **Water:** **green seas** (lime water, the palette already has it: waterL #b8f040), bright and strange.
- **Resources:** Glowcap Spores (common) in moss clearings; Duskmoss Resin (uncommon) on grove edges; Dreamspore and Mycelial Heart (quest) deep between groves.
- **Signature:** **glowing mycelium groves**: faint glowing threads on the ground linking the groves (a ground-colour pattern between tree clusters).
- **Sky & air:** violet twilight (`alien`: hemi ground #7a3ac8), haze #7a6ac8, **glowing spores**.
- **Palette:** `alien`, keep. Lower overall light one step (ambient 0.16 → 0.12) so the emissive props carry the scene.
- **Today / needs:** colours work today on round trees. Needs the **mushroom tree** and **crystal cluster** families, **emissive caps and crystals**, the mycelium thread pattern in the ground colour, and spore particles. Night battles (GDD §3) would land here first.

### 3.9 Greenies / Chem: **Vexmire**, the toxic hive swamp

- **Planet:** "Toxic hive swamp". The globe is olive and lime land with **toxic yellow-green seas** and heavy cloud. Survey: spore pods, hive mounds, rotting snags; sickly grass, glowing toxic blisters; moss-green boulders; chem clouds. "A living chemical swamp."
- **Faction:** *Socialist hive collective*: swarms, chem clouds, area denial, Poison ("Everyone shares the harvest; no one is weeded" / "Dissolve every boundary"). Unaligned, with no rival. The world is **area denial made terrain**: a maze of **many small bog pools** (water 17%, patches, high noise) and hive mounds that breaks the ground into narrow causeways. Swarms pour through them; the player's walls bite hardest here. The collective builds **hive mounds** everywhere, the shared architecture of a hive.
- **Ground:** sickly marsh grass, **peat mud** (dirt), reed beds (brush).
- **Obstructions:** **hive mounds** and **spore pods** (trees), moss boulders, rotting log jams (cliff, few).
- **Water:** **toxic bog pools**: yellow-green, opaque, with glowing blisters at the edges.
- **Resources:** Mire Peat (common) on mud; Venom Sap (uncommon) at pool edges among roots; Hive Jelly and Broodqueen Egg (quest) beside hive mounds.
- **Signature:** **bog pool mazes around hive mounds.**
- **Sky & air:** murky yellow-green (haze #a8b860, sun #f0ffc8), **drifting chem clouds** (low wisps over the bogs).
- **Palette:** `tropical` **contradicts the planet**: turquoise water, pink and orange canopies, white rare. Add a new **`toxic`** palette:
  - moss greens and olive from the globe (#5e7a3a, #8aa040);
  - peat brown dirt;
  - bog water #78a018 / #c8f030 with blister-yellow foam;
  - hive-yellow canopy accents (#c8c848);
  - moss-green rocks.
- **Today / needs:** many small pools are authorable today (patches, high noise). Needs the `toxic` palette, the **spore pod**, **hive mound** and **dead snag** props, the glowing blister edge on bog water, and chem-cloud particles.

---

## 4. Contradictions this design resolves

| Where | Today | This design |
|---|---|---|
| Lumen palette | `highlands`: green grass and trees, blue-green water | new `lunar` palette: grey regolith, black pits, cyan crystals (§3.7) |
| Vexmire palette | `tropical`: turquoise water, pink canopies | new `toxic` palette: moss, peat, yellow-green bog (§3.9) |
| Kessra water | `canyon` teal water vs the globe's brown seas | rust-brown sumps (§3.4) |
| Florael look | "Sakura reads washed out" | saturate grass, deepen blossom pinks (§3.2) |
| Every planet's props | 2 tree shapes + 1 rock shape, recoloured; survey text promises cacti, mushrooms, crystals, basalt… | prop kits per planet (§2.4) |
| Map content | every faction plays the Powder map (copies + mirror) | one Forge recipe and signature per planet (§2.3, §2.6) |

---

## 5. What the engine needs (suggested build order)

Each item is phrased as the change it makes. The PLN stories own them; this doc is the spec they build to.

0. **Water movement rules (sim, first)**, per §2.1:
   - **water units:** open ground and water both cost 1 and move at normal speed (no bonus); rocks, trees and cliffs block;
   - **all other walking units:** water becomes passable but very costly, for example cost ×12 and speed ×0.15 inside it, so A* always takes any real detour and a unit pushed into a pond wades out slowly instead of being stuck behind a wall;
   - paths are recomputed when structures change, as walkers' already are;
   - replaces the fixed `waterLane` list (`getWaterPath`) on forge maps, keeping it as a fallback for workbook maps;
   - deterministic (A* on the grid, no randomness) so replays hold, with tests for a pond crossed by a water unit and walked around by a ground unit, plus a ground unit that is forced into a pond and wades out; the obstruction-grid test stays green (towers off water, ground units around ponds);
   - **its own story [MM-story_mvj70e3w_6], with a balance check**, because it changes how the Water faction plays everywhere.
1. **Planet palettes:** add `lunar` and `toxic`; fix `canyon` water and `sakura` saturation; point Lumen and Vexmire at the new palettes (`planets.js`). Data only. → PLN-FOL
2. **Per-planet Forge presets:** the §2.3 recipes as a preset menu in the Terrain Forge, plus a **pond-shortcut** map check for water maps: the water-unit route is meaningfully shorter than the ground route, and no pond touches the base gap. → PLN-MAP
3. **Prop families:**
   - first wave: blossom, cactus/acacia, dead snag, spike tree, mushroom tree, snow pine;
   - rock styles: hoodoo, layered mesa, basalt column, ice shard;
   - second wave: crystal cluster, needle spire, ice spire, spore pod, hive mound, flower bush.

   Families are chosen per planet as data (`planets.js` foliage set); placement stays the existing seeded planner, and each family keeps the current triangle budget (rocks + trees ≤ ~25k per map). → PLN-FOL
4. **Emissive terrain:** lava (Cinder), crystals (Lumen, Xenthe), ember tips, mushroom caps, bog blisters. These are unlit vertex colours in the ground or obstruction meshes, so they add no extra draws. → PLN-FOL / PLN-ATM
5. **Forge stamps and modes:**
   - a crater stamp (Lumen) and a shell-scar decal (Kessra);
   - mycelium threads (Xenthe) as a ground-colour pattern.

   → PLN-MAP
6. **Atmosphere and air:** per-planet haze, fog-edge tint and camera particles (pollen, petals, dust, snow, ash and embers, spores, chem wisps; none on Lumen). → PLN-ATM / PLN-AIR
7. **Water treatments:** animated surface, pond-rim foam and floes, wakes (Rime first), lava pulse (Cinder), toxic blister edge (Vexmire). → PLN-ATM
8. **Author the maps:** one map per planet from its recipe, then baked roads (`bake3d.mjs`). This retires the Powder mirror (`TEMP_MIRROR_FACTION`).

---

## 6. Owner decisions

1. **Signatures:** approve the nine signature features (§2.6), or swap any.
2. **Water movement:** decided 2026-10-22 (§2.1): water units cross ground and water with no bonus; others wade only at a crawl; ponds only, no rivers. One remaining call: should a troop order **onto** a water cell stay refused (today: "ground troops can't go on water"), or be allowed and the troop wade there slowly?
3. **New palettes:** approve the two new palettes (`lunar`, `toxic`) and the `canyon` / `sakura` adjustments.
4. **Prop-family order:** first wave as in §5.3, or reprioritise by which faction maps get authored first.
5. **Openness by faction:** Air and High Tech open, Dark and Greenies enclosed, Artillery funnelled by mesas. Approve this as the rule, or flatten the variation for balance.
6. **Night battles:** should Xenthe (night-strong Dark Energy) default to a darker lighting preset now, ahead of the GDD's night system?

## Dependencies

| relation | doc | what it holds that this doc does not restate |
|---|---|---|
| builds on | `docs/16 Bulwark MM/design/Terrain-Detail-and-Complexity.md` | the terrain as built: codes, generator, layers, budgets |
| depends on | `docs/tech-plan/Terrain-Engine-3D-and-Threejs-Migration.md` | the 3D renderer, quality tiers, budgets |
| related | `docs/16 Bulwark MM/design/Landing-Craft-and-Resources-Design.md` | homeworld names, the 36 resource models, landing craft per faction |
| related | `docs/16 Bulwark MM/create/Style-Guide.md` | neutral props rule, faction colour rules |
