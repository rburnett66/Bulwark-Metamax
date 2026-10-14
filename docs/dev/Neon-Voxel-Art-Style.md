# Bulwark — Art Styles: Neon Voxel and Low-poly Organic (v1.3, 2026-10-13)

v1.3: adds the look of UNIT MATERIALS (metal, §7) and WORLD-IMPACT EFFECTS (§8), both built in the prototype ("Bulwark Terrain Engine" artifact version 9), and records the eleven low-poly world palettes (§6.5). Owner, on effects: "Like sparks that bounce off the tank and hit the ground. Or tanks the explode their turrets off and burn." Owner, on materials: "Is it possible to use a material shader to give the tanks a more metallic look?" The engine side (batches, events, costs) is in TECH_PLAN::Terrain-Engine-3D-and-Threejs-Migration.md v2.1 §6.10–6.11.

v1.2: the owner rated LOW-POLY ORGANIC "the best yet"; it is now the lead direction and the prototype's default style (§6). The low-poly ground was rebuilt as real triangulated geometry with one flat colour per triangle (§6.1, §6.3). v1.1 added three voxel presets (§5) and low-poly organic. Prototype: "Bulwark Terrain Engine" artifact version 6 (style menu in the dock).

Original direction (v1.0): make the 3D terrain more stylized — "a neon minecraft look". An earlier attempt did not work. §1–§4 say what that look is made of, why it usually fails, and the exact rules the renderer uses.

## 1. Why neon voxel usually fails
1. NEON ON EVERYTHING. If every surface glows, nothing reads. Glow is reserved for edges, roads, water, resources, effects and units' outlines. Faces stay dark.
2. NO DARK BASE VALUE. Neon only reads against near-black. The scene's darkest values must be darker than any emissive line by a wide margin.
3. FLAT FACES. Minecraft reads because each block face has a small pixel texture. Flat dark faces with glowing lines read as Tron wireframe, not Minecraft.
4. BLOOM DOING ALL THE WORK. A strong bloom washes everything out. Emissive lines must look right with bloom off; bloom only adds a halo.
5. HIDING THE TERRAIN. Desaturating the ground to grey loses grass, dirt and water. The ground keeps its own colours, cooler and darker.

## 2. The neon voxel look — rules
### 2.1 Value structure
- Clear colour #06040D. Map apron #090614.
- Block faces: a dark per-kind base colour × 0.78–1.22 pixel noise. No face exceeds about 30% brightness before lighting.
- Emissive edges: 1.4× the edge colour on the line plus a soft halo (exp falloff, 0.2). This is the brightest thing on any block.
### 2.2 Blocks
- Every face gets an 8 × 8-per-cell pixel texture (hashed per pixel, deterministic).
- Plateaus: world-space lattice — one block per cell horizontally, two half-cell courses vertically (plateau height 1.0 cell).
- Trees, rocks, base, walls, towers: edges on every box face of the model.
- Kind palette (face / edge): Plateau #2E2A58 / #29E8FF; Rock #3E3064 / #C45CFF; Tree #1D5A3C / #3DFF8A; Base #463A5C / #FFC23D; Wall #2E4260 / #7FF0FF; Tower #3A3652 / #FF9A2A. Line width 0.03–0.05 cell.
### 2.3 Ground
- Baked terrain colours at 85% saturation × (0.62, 0.66, 0.86).
- Each cell is a block: ±15% hashed brightness, dark seam (50%) on borders, faint cyan line (0.06).
- Roads glow violet (up to 0.3) from the baked road wear mask (`road_mask.png`, 5 px per cell). Water glows cyan (0.13 ± 0.06).
### 2.4 Lighting
- Moonlight #B8C8FF from the one sun direction; ambient #9A8CFF at 0.66.
### 2.5 Units, resources, effects
- Unit sprites × (0.5, 0.5, 0.74) with a hot-pink outline (#FF2D78), 7 / 5 texels. Crystals 2.6× brightness. Projectiles cyan-white; explosions toward magenta. Ring outline magenta.
### 2.6 Glow pass
- Bright pass at half resolution → blur at half and quarter → added back. 6 extra draw calls. On for High and Standard, off for Low. Must still read with it off.

## 3. Implementation of the voxel styles (as built)
- Stock three.js Lambert materials with the style injected by `onBeforeCompile`; shared uniforms switch style at runtime; no duplicate materials, no re-bake.
- Edge distance from a per-face attribute (`aEdge`) for boxes, a world-space lattice for plateaus.
- Measured (headless, software GL): 20 draw calls without the glow pass, 25–28 with it; ~10–11k triangles.

## 4. Open (voxel)
- Device check of the glow pass on iPhone 12 / Pixel 6 (part of T1).
- Night variants of the unit packs instead of shader tinting.
- Tree and rock models authored as boxes, so edges fall on block seams.

## 5. Presets of the voxel shader
A preset is data only (sky, apron, ambient, sun colour/strength/azimuth/elevation, ground tint/saturation/seam/mono/grid/road/water, per-kind face and edge, unit tint and outline, ring and fog, projectile and effect colours, glow). Changing the sun re-renders the static shadow map once.
| Preset | Sky | Sun | Ground | Edges | Water | Units |
|---|---|---|---|---|---|---|
| Neon voxel | #06040D | moonlight, 45° | cool, cyan grid, violet roads | cyan / violet / green / gold | cyan glow | pink outline |
| Synthwave dusk | #1A0626 | orange, low 20° | purple, magenta grid, orange roads | magenta / orange / cyan | purple glow | cyan outline |
| Ember | #0B0402 | red-orange, 35° | scorched, glowing road cracks | orange / red / amber | lava | cold-blue outline |
| Hologram | #020A1C | cold, 50° | monochrome blue, bright grid | white / ice / teal | cyan | amber outline |

## 6. Low-poly organic — LEAD DIRECTION (v1.2)
Owner reference: a stylized low-poly landscape — faceted boulder cliffs, round faceted tree canopies on Y-shaped trunks, cone pines, rolling grass, blue sky. It changes GEOMETRY, so it is a second geometry set, not a voxel preset.
### 6.1 Rules
- Facets, not texture. Every shape is a low-detail icosphere, cone or triangle with flat colour; detail comes from facets, never from a pixel texture.
- THE GROUND IS TRIANGLES. The play plane is a real triangulated mesh at Y = 0: a 0.5-cell grid with interior vertices jittered ±21% of the spacing, diagonals chosen per quad by hash, map border vertices fixed. Each triangle gets ONE flat colour, sampled at its centroid. Each triangle's normal is tilted up to ±0.08 so facets catch the sun differently. The surface stays perfectly flat (goal 2).
- Triangle colour, in order:
  1. Rolling light bands from two octaves of value noise (0.085 and 0.21 per cell): teal #2F9C86 → grass #5FCA6E → lime #9BDC5C.
  2. Smoothed terrain fields (each terrain class as a 0/1 grid, bilinear at the centroid) blend in: brush #49B46E, forest floor #2F8F72 under trees, stony #B6C69A on rock fringes, lilac #A3A3D6 under rocks and plateaus.
  3. Dirt field > 0.32 → dirt #D2B27C, > 0.55 → sand #E2C88E.
  4. Road wear mask: 0.10–0.32 → road edge #D9C08A; > 0.32 → road #F0DFB0.
  5. Water field: 0.28–0.48 → shore #EAD79C; 0.48–0.62 → foam #B4E4F2; > 0.62 → water #6FB6F2 deepening to #3F7FE0.
  6. ±5% random brightness per triangle.
- Grass tufts: three leaning three-sided blades per tuft on open grass (45% of cells) and brush (1–2 per cell), never on roads, coloured from the triangle below; upward normals so they light like the ground; no shadow casting.
- Rocks are piles, not walls. Plateau cells → stacked faceted boulders (up to three courses, sparser and smaller going up); rock cells → a boulder and a pebble; rock-border cells → small scattered stones. Boulder: icosphere detail 1, ±16% hashed vertex displacement.
- Trees in two families: ROUND (55%) — blue Y-trunk #3B4FC4, faceted canopy coral / salmon / peach, rare white; PINE (45%) — 2–3 stacked six-sided teal cones. From the level's decor groves plus ≈70% fill on blocked tree cells.
- The world continues past the map: faceted hills, trees and a lilac boulder-cliff backdrop to the north, kept clear of the play area. Sky #6F90D4 with distance fog in the same colour (70–190 units).
- Lighting: hemisphere (sky #C4D8FF / ground #86B88F, 0.5) + warm sun #FFF0D8 at 50° (1.05) + ambient 0.16. Hard shadows from the one sun.
### 6.2 Palette (Meadow)
| Element | Colours |
|---|---|
| Grass bands | #2F9C86, #5FCA6E, #9BDC5C; brush #49B46E; forest floor #2F8F72 |
| Dirt / roads | #D2B27C, #E2C88E; road #F0DFB0, edge #D9C08A |
| Water | shore #EAD79C, foam #B4E4F2, #6FB6F2 → #3F7FE0 |
| Boulders | #7F83D8, #8A8AE2, #7479CC, #9194E6; rocks #A3A6CF; ground under rock #A3A3D6 |
| Canopies | #E07A62, #E8906E, #D96B5C, #EEA07C, rare #D8E0EA |
| Pines | #3F9A8A, #2F8A7C, #4FAE94, #3A8F78 |
| Trunks | #3B4FC4 |
| Hills | #5CC86A, #74D46C, #4CB87A, #86DC6A |
### 6.3 Implementation (as built)
- The low-poly ground mesh (~16k triangles), tufts, rocks, trees and the outside world are static, vertex-coloured Lambert meshes, built once. The baked ground tiles are hidden in this style; the voxel and low-poly sets switch by visibility and the static shadow map re-renders on the switch.
- Ground colour is computed on the CPU at load from the level data (terrain codes, road mask), so it needs no new art and follows any level.
- Measured (headless, software GL): 14–20 draw calls; ~80k triangles total.
### 6.4 Open
- Base, walls, towers and resource crystals are still boxes; they need faceted low-poly versions.
- Units: the primitive-built 3D unit models (artifact "Bulwark Unit Models") fit this style; replacing the sprites is the T5 decision.
- Off-map surroundings are random per seed; production should take them from a "surroundings" layer in the map tool.
- Q8b becomes visible here: the painted dirt (code 1) shows as large sand areas beside the roads.
- Device check of 80k triangles on iPhone 12 / Pixel 6 (T1); the ground grid can drop to 0.75 cells on the Low tier.
- Sakura reads washed out; Dusk's large painted-dirt area reads like lava (§6.5).
### 6.5 World palettes (v1.3 records them)
Owner: "can we create 10 more color variations of the low poly world?" A palette only recolours: geometry and placement come from the same seed, so switching palettes rebuilds the set with identical shapes. Each palette sets rocks, pebbles, tufts, every ground class, canopies (+ a rare accent), pines, trunks, hills and backdrop cliffs; each world preset adds sky, apron, hemisphere, sun colour/strength/azimuth/elevation and fog.
| World | Character |
|---|---|
| Meadow | the §6.2 reference |
| Autumn | ochre grass, orange/red canopies, low warm sun |
| Winter | snow ground and canopies, dark teal pines, pale sky |
| Canyon | red-orange rock, sandy ground, turquoise water |
| Tropical | saturated greens, pink/orange canopies, cyan water |
| Sakura | pale greens, pink canopies, lilac rock |
| Dusk | blue-violet ground, orange canopies, low orange sun, glow on |
| Volcanic | charcoal rock and ground, lava instead of water, glow on |
| Alien | teal ground, magenta rock, yellow canopies, purple pines |
| Highlands | muted greens, grey rock, heather accents, overcast |
| Savanna | golden grass, olive canopies, high warm sun |
Production: a palette per level or biome, named in the level file.

## 7. Unit materials — metal (v1.3)
- Units read as METAL, not plastic: tops of hulls catch the sky, vertical sides pick up the darker ground, curved shells (the beetle's elytra, the jet's canopy) get a hot highlight. Armour is brushed, not chrome.
- Per-part finish, by material key (metalness / roughness): hull 0.55 / 0.45; secondary hull and panels 0.6 / 0.4; dark armour 0.7 / 0.35; black parts 0.4 / 0.6; tracks and rubber 0.3 / 0.75 (near matte); bare metal (barrels, hubs) 0.95 / 0.2; glass 1.0 / 0.05 (mirror-dark); glow strips stay unlit emissive.
- The reflection takes its colours from the WORLD: the style's sky colour above the horizon, its ground (apron) colour below, darkened. So Meadow armour has a blue-white top and a green underside; Dusk armour goes orange. In neon styles the sky term is halved so the neon outline and glow strips still lead.
- Metal must never wash a unit out: diffuse drops as metalness rises (up to 72%), and reflection strength falls with roughness.
- WRECKS are charred and matte (metal ≈ 0.1, colour × (0.42, 0.38, 0.35)) — burnt metal never shines.
- A "Metal units" toggle returns the flat look for comparison. The Unit Models viewer's "Studio metal" style shows the same finish on a grey studio set.

## 8. World-impact effects — the look (v1.3)
- SPARKS are streaks, not dots: white-hot when fresh, cooling through orange to red; length follows speed. Most fly back off the armour toward the shooter; some skate along the plate. They must visibly hit the ground and bounce, skid and die out there.
- MISSES kick up ground-coloured dust and leave a small scorch.
- A KILL is a short, bright beat: a flash, a fireball, a burst of sparks, a few small dark-grey metal chunks (never big black cubes), a scorch that stays about 20 s, an expanding warm shock ring, a fire-light pool on the ground and a small camera shake.
- The tank's TURRET is BLOWN OFF: it goes up visibly higher than the hull, spins, bounces and lands nearby, then burns on its own.
- The HULL stays as a charred, matte WRECK that burns: flames at the hull, a dark smoke column leaning with the wind, the odd ember, and a flickering warm light on the ground. When the fire dies the wreck sinks into the ground — the battlefield never fills with permanent clutter.
- JETS do not explode in the air: they fall burning, trailing fire and smoke, and explode where they hit the ground.
- Smoke is the only alpha-blended layer; everything hot is additive. In neon styles the same effects run; their warm colours read against the dark world without extra glow rules.
- Restraint for phones (Q15 in the tech plan): the Low tier keeps the turret blow-off and the wreck but thins particles and drops the fire-light pools.

## Dependencies
| relation | plan | what it holds that this plan does not restate |
|---|---|---|
| related | docs/dev/View-DD.md | the battle-view design whose art style these rules replace |
