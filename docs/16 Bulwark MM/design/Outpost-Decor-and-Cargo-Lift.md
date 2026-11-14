# Outpost decor and the farm's cargo lift — design and budget

Status: draft 1 for owner review · 2026-11-13 · companion to `Outpost-Design.md` and `Farming-Design.md`.
Reference sheets: `Design/` (repo root, owner 2026-11-13): water-tank, antenna, cargo-cube, cargo-lift, supplies,
supply-shelf, road-signs, chemical-drum.

## Owner direction (2026-11-13)

> I have a series of images that need to be modeled with Blender 5.2 with 2 levels of LOD simple flat shaded, and medium
> detail textured. Please create a budget for these since they are decoration and do not have real impact on the game.
> As new structures and plots are added to the Outpost and Farm these should be randomly added to the base. 2 decorations
> in a random location for each structure (plot) added. These should be small scaled items around the base not just next
> to the new structure. They should not be big enough to block a lane, and large structure can be placed in red
> non-buildable areas on the edge of the base. The Cargo containers can be used to plant and harvest crops. The cargo
> lift moves from the farm to the plot and either drops off seed pods and a cargo cube disappears, or an empty cargo-lift
> travels to a plot and picks up a cargo cube full of fruit and takes it to a silo. The lift can carry two plots of fruit
> or seed pods at one time.

Answered the same day: the cargo lift is **real logistics** — a plot starts growing when the lift drops its seed-pod
cube, and harvested fruit reaches the store when the lift unloads it at the Silo.

## 1. The assets

Scale: one outpost cell ≈ 4 m (the avatar, 0.45 cell, is a 1.8 m person). Sizes are the reference sheets'.

| Asset | Reference size | In cells | Class | Role |
|---|---|---|---|---|
| Water tank | Ø 0.5 m × 0.8 m | 0.13 × 0.2 | small | decor |
| Antenna mast | 0.32 m base × 1.5 m | 0.08 × 0.38 | small | decor |
| Chemical drum | Ø 0.58 m × 0.94 m | 0.15 × 0.24 | small | decor |
| Road sign post | 0.62 m panels × 1.5 m | 0.16 × 0.38 | small | decor |
| Supply shelf | 1.2 × 0.45 × 1.7 m | 0.3 × 0.11 × 0.43 | small | decor |
| Supply crate stack | ≈ 2.0 × 1.5 × 1.0 m | 0.5 × 0.38 × 0.25 | **large** | decor (edge only) |
| Cargo cube OC-47 | 2.2 m cube | 0.55 | **large** | decor (edge only) **and** the farm's cargo (§4) |
| Cargo lift (cube transport trailer) | 6.7 × 2.8 × 2.0 m | 1.7 × 0.7 × 0.5 | vehicle | the farm's carrier (§4), never decor |

## 2. The budget

Decor has no gameplay weight, so it gets the smallest budget of anything in the outpost. For scale, an outpost building is
2–5.6k triangles at LOD0, ~250–560 KB a file (`content/outposts/outposts.json`).

Two LODs per asset, as asked:

| LOD | Look | Used at | Triangles | Draw calls | Textures | File (GLB) |
|---|---|---|---|---|---|---|
| **flat** | flat shaded, colour by material (the outpost palette: dark / mid / light / trim / glow), no texture | Low tier, safe mode, far zoom | small **≤ 300** · large **≤ 600** · lift **≤ 1,200** | 1 (merged) | none | ≤ 40 KB |
| **textured** | medium detail, one baked texture atlas (colour, with the sheet's wear, decals, stripes, labels) | Standard and High tiers | small **≤ 1,200** · large **≤ 2,000** · lift **≤ 4,000** | ≤ 2 (body + glow) | one atlas: small **256²**, large/lift **512²**, JPEG/WebP in the GLB | small ≤ 120 KB · large ≤ 250 KB · lift ≤ 400 KB |

Scene budget (the whole base):

- **Instances:** 2 per structure or plot placed, capped at **80** decor pieces per outpost (a full base is ~25
  structures + ~12 plots ≈ 74). Over the cap, no more are added.
- **Draw calls:** decor is **instanced per asset and LOD** — at most 7 decor types × 2 meshes = **14 draw calls** for all
  decor, however many pieces. Cargo cubes in transit and the lifts add ≤ 4.
- **Triangles:** ≤ **80k** for all decor at the textured LOD (the cap × ~1k average); ≤ 25k at flat.
- **Texture memory:** 8 atlases (5 × 256², 3 × 512²) ≈ **4.4 MB** on the GPU with mipmaps — loaded once, shared by
  every instance.
- **Download:** all 16 GLBs ≤ **1.5 MB**, fetched only when the outpost opens (not the battles).
- **No shadows from small decor** (it would cost a shadow-map draw each); large decor and the lift cast into the static
  shadow map like the buildings. The moving lift uses the planar shadow (`models3d.shadowMaterial`), as walkers do.


### Built (2026-11-13, Blender 5.2.3, `tools/blender/outposts/decor/`)

| Model | Class | Size (cells) | Flat | Textured |
|---|---|---|---|---|
| water_tank | small | 0.16 × 0.13 × 0.23 | 144 tris · 10 KB | 452 tris · 37 KB |
| antenna | small | 0.10 × 0.10 × 0.38 | 108 tris · 8 KB | 492 tris · 38 KB |
| chemical_drum | small | 0.15 × 0.15 × 0.24 | 108 tris · 8 KB | 672 tris · 50 KB |
| road_signs | small | 0.24 × 0.07 × 0.38 | 80 tris · 6 KB | 304 tris · 29 KB |
| supply_shelf | small | 0.30 × 0.11 × 0.42 | 156 tris · 13 KB | 496 tris · 41 KB |
| supplies | large | 0.48 × 0.29 × 0.28 | 84 tris · 7 KB | 712 tris · 94 KB |
| cargo_cube | large | 0.59 × 0.59 × 0.59 | 132 tris · 11 KB | 432 tris · 79 KB |
| cargo_lift | lift | 0.66 × 1.70 × 0.47 | 496 tris · 38 KB | 1844 tris · 178 KB |

All 16 files: 656 KB (budget 1.5 MB). The flat cube carries the textured cube's light steel side panels and lid (2026-11-13: all-gunmetal read near-black in the game). Held to the budget by `src/render3d/outposts/decorBudget.test.mjs`.

## 3. Decor placement

- **When:** each time a structure is built or a plot is laid, **2 decor pieces** are added to the outpost record
  (`o.decor = [{ id, kind, x, y, rot, scale }]`), placed by the outpost's seeded rng (`o.seed`, the structure's id) — no
  `Math.random`, so the same base always looks the same and a replay never changes it. Selling a structure leaves its
  decor (it is the base's clutter, not the structure's).
- **Old saves:** an outpost opened with structures but no `o.decor` gets 2 per existing structure and plot once, the same
  way.
- **Where:** a random free cell **anywhere inside the base** (the outpost's built area plus 3 cells), not next to the new
  structure on purpose. "Free" = no structure, plot, conduit, deposit, the landing pad's clearance, or other decor.
- **Never blocks:** decor is drawn only — not a sim structure, never in the nav grid. Small pieces fit inside a third of
  a cell, so even a cluster never closes a lane visually.
- **Large pieces** (crate stacks, cargo cubes) go only in **red cells on the base's edge** — cells the build ghost shows
  red (not buildable: off the buildable ground, or within the pad clearance) that touch a buildable cell. If none is
  free, a small piece is placed instead.
- **Mix:** ~70 % small, ~30 % large; never the same kind twice in a row for one structure.
- **Building over decor:** a structure or plot placed on a decor cell clears that decor (no refund — it is free).

### Built (2026-11-13, `src/outpost/decor.js`, drawn by `src/render3d/outposts/decorModels.js`)

- Save shape: `o.decor = [{ id, kind, x, y, rot, scale, for }]` (x, y the piece's centre in cells) and `o.decorFor` —
  the keys (`pad:` / `def:` / `plot:` / `farm:` + id) that have had their 2 pieces, so an id is decorated once.
- `accrueDecor(o, map)` is the one entry, idempotent and seeded (`o.seed` + the key): the save session runs it on every
  advance (opening, every action, so old saves get their decor once), the visit on every view refresh (a structure placed
  in the live sim gets its decor at once, and it rides into the save on leaving).
- Ground: the build ghost's own rule for a 1-cell piece on an outpost with only its hub (`siting.positionCheck`), at the
  landing pad's height. Small pieces on buildable cells; large pieces on the red rock / rim cells that touch buildable
  ground (never water, never the landing pad's clearance — the transport keeps its pad clear).
- Conduits move as the grid changes, so a piece a conduit now runs over is left undrawn (it stays in the save).
- LOD for the visit: flat on the Low tier and in safe mode, textured otherwise. One InstancedMesh per kind and mesh
  (7 kinds → ≤ 7–9 draw calls). Large pieces cast shadows; small do not.

## 4. The cargo lift (real logistics)

The Farmhouse owns **one cargo lift** (the cube transport trailer). It carries **two cargo cubes** — two plots' worth of
seed pods or of fruit — and drives on the outpost's walker paths at `Lift_Speed` (proposed 1.2 cells/s).

**Planting**
1. Planting a plot (the FARM rail's crop on a prepped plot) takes its pods from the store at once and **queues a
   delivery**; the plot shows a pending marker ("waiting for the lift").
2. The lift loads up to two queued deliveries at the Farmhouse (a cargo cube appears on the trailer for each), drives to
   each plot, and drops the cube: **the cube disappears into the plot and the plot is planted then** (its grow clock
   starts at the drop).

**Harvesting**
1. Harvesting a Fruited plot fills a cargo cube on the plot ("waiting for the lift"); the plants are cleared as now.
2. The empty lift drives out, picks up to two full cubes, takes them to a **Silo** (no Silo: the Farmhouse), and the
   crop is **added to the store when the cube is unloaded**. A full Silo keeps the cubes waiting on the lift.

**Rules**
- The lift serves the oldest job first, pairing two jobs of the same kind (two plantings, or two pickups) when it can.
- While away, the lift's work runs on the outpost's clock like every other job (`model.advance`): deterministic, so a
  visit and a return compute the same farm.
- A raid: the lift shelters at the Farmhouse with the crew and resumes after. Cubes waiting on plots can be trampled
  (fruit lost, as a trampled Fruited plot).
- Data (Farm_Params, proposed): `Lift_Speed` 1.2 cells/s, `Lift_Capacity` 2, `Lift_Load_Sec` 2, `Lift_Unload_Sec` 2.
- Later: a second lift (tech or building) for big farms.

## 5. Build plan (stories)

1. **Budget and design** (this document).
2. **Decor models** — 7 decor kinds + the lift, Blender 5.2 (`tools/blender/outposts/decor/*.py`, one script per model),
   flat + textured LODs within §2, a `decor.json` manifest (tris, bytes, footprint, class).
3. **Decor placement** — `o.decor` in the outpost model (§3), seeded; migration for old saves; drawn instanced in
   `outpostScene`, LOD by tier.
4. **Cargo lift logistics** — the delivery/pickup queue and the lift's clock in the farm model (§4), the save shape, the
   store crediting at unload; tests for timing and capacity.
5. **Cargo lift view** — the trailer model driving the walker paths, cubes on it, the drop/pickup animations, the plot
   markers.

## Dependencies

| Document | Why |
|---|---|
| Outpost-Design.md | the base, its placement rules and raids |
| Farming-Design.md | plots, planting, harvest, the Silo and the Farmhouse |
