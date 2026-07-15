# Bulwark — Voxel Sprite-Stack Unit Pipeline (Tech Plan)

**Source of truth for the contract:** `prototype/test-game/tools/voxel-stack/HANDOFF.md`
(landed from metamax-ux-test PR #86). **Reference implementation:** the prototype in the same folder
(`voxel-stack.js`, `index.html`). **Schedule:** epic `vox-epic` + stories `vox-s1…s6` in PG project 16.

---

## Goal

Unit art from a **small set of static hand-drawn images at one locked iso camera** — no turntables —
with two render paths chosen per part:

- **Bodies → directional sprites.** Exact art; rotation **snaps** to N facings (fine — hulls turn slowly).
- **Turrets / smooth-aim parts → voxel sprite-stack.** Volume reconstructed from the views (+ optional
  elevations), baked into a per-angle cache → **smooth 360°** rotation.

Runtime is pure `Sprite` + `RenderTexture` (a part swaps to the nearest cached frame/angle; team colour
= `sprite.tint`). **No runtime filters/shaders/MSAA** — the `@pixi/react-native`-safe subset. **Pixi 7**
(matches Bulwark's vendored 7.4.2 and the WebView/RN target).

## Camera — set interactively by orbiting the 3D model (owner, 2026-07-17)

The bake camera is **chosen in Stack Forge, not pre-fixed.** Once a unit's voxel model is built, the user
**spins it as a real 3D object** (orbit controls) and **sets the camera angle** (azimuth/elevation) they
want baked. That chosen angle is written into the unit pack's `camera` and drives the stack's
`layerSpacing` (SP) so stacked parts sit together.

The prototype's **45° / 30°** is the sensible **default**, and once a game-wide look is chosen it should be
reused across units for consistency — but it is a value the tool captures from the 3D view, not a constant
hardcoded before art. (Practically: orbit → set → the tool locks it into the pack; the same angle is offered
as the default for the next unit.)

## Multi-part models (base + turret)

A unit is **split into parts**, each with its own voxel volume: e.g. a tank = **base (hull)** + **turret**.
Each part bakes independently on the chosen camera — the base as `directional` (or its own stack), the
turret as a smooth `stack` mounted on the hull at `mount` — and the runtime composes them (see §runtime).
Static structures = a fixed base + a rotating weapon part; air = a single body part lifted by `alt`. The
part list in `<unit>.json` (§data contract) already carries this; the model builder + 3D preview operate
**per part** so each can be inspected/aimed on its own before the whole unit is baked.

## Data contract — the "unit pack" (Stack Forge emits, game consumes)

Decouples tool from game; the game never reads raw artist PNGs. Per `<unit>.json`:

```jsonc
{
  "id": "abrams", "class": "ground",              // ground | air | structure
  "footprint": [64, 64, 16],                      // W, D (square for rotating parts), H layers
  "camera": { "azimuth": 45, "elevation": 30 },   // must match the art
  "layerSpacing": 2,                              // SP — must match camera tilt
  "parts": [
    { "id": "body",   "kind": "directional", "facings": 8, "atlas": "abrams.body.png",
      "cell": [64,64], "pivot": [32,44], "zeroFacing": "+x" },
    { "id": "turret", "kind": "stack", "angles": 64, "atlas": "abrams.turret.png",
      "cell": [64,64], "pivot": [32,44], "mount": [0,0,9] }   // dx,dy px; dz layers (rests on hull)
  ],
  "shadow": { "kind": "ellipse", "rx": 33, "ry": 14, "alt": 0 },  // alt>0 ⇒ flying
  "stats": { "speed": 90, "turnRate": 3.0, "turretRate": 4.0 }
}
```

- `directional` atlas = N facing frames; runtime picks nearest to heading (snaps), mirrors as needed.
- `stack` atlas = `angles` baked frames; runtime picks nearest angle bucket (smooth).
- **Bucket-0 = facing +X (east)**; any offset/flip is fixed **at bake**, never at runtime (must match
  the runtime's `bucketOf`).

## Stack Forge (offline baker) — where + what

**Home:** `prototype/test-game/tools/voxel-stack/` in the Bulwark repo — an HTML baker matching the
prototype for authoring, with the deterministic bake core (`makeSlices`, `bakeAngleCache`, `bucketOf`,
`SHARPEN_FRAG`) factored so it can also run as a **Node CLI** for CI/golden tests.

Responsibilities:
1. Ingest the §2 artist input set (iso body/turret views + optional side/front **elevations**, pivots, JSON),
   **per part** (base, turret, …).
2. **Build the 3D voxel model per part** — reconstruct the volume from the views (heightmap derived /
   measured from side elevation / space-carved from side+front). This is a real voxel grid, not just a
   heightmap stack.
3. **3D orbit preview + camera-set** — show the reconstructed model as a spinnable 3D object; the user
   orbits it and **sets the bake camera** (azimuth/elevation). The whole unit (all parts) previews together
   at that camera so base+turret alignment is visible before baking.
4. **Body path:** drawn facings → mirror the diagonally-opposite pair → 4 (8 with extra views) → facing atlas.
5. **Turret/stack path:** from the voxel model at the chosen camera → `makeSlices` → `bakeAngleCache`
   (+ optional 2× supersample + CAS-lite unsharp) → angle atlas.
6. **Emit a unit pack** (atlases + `<unit>.json`, `camera` = the angle set in step 3). **Deterministic** —
   same input + same camera always bakes the same pack.

## Game runtime — Bulwark

A `Unit` composes parts from the pack: `directional` → nearest-facing `Sprite`; `stack` → nearest-angle
`Sprite` at `mount`, air units lifted by `alt` with a detached ground shadow on a low `zIndex`. Depth sort
by `y` (`sortableChildren`); team colour via `sprite.tint`. **Loader is data-driven** — adding a unit = drop
a pack in, no code per unit. Reuse the prototype's `Tank`/`Plane`, generalised to "part kind" so one class
covers ground-with-turret, static-base-with-weapon, and air.

## Build phases (= schedule stories)

| Story | Scope | Definition of Done (HANDOFF §6) |
|-------|-------|-------|
| vox-s1 | Stack Forge input ingest + schema validation | §6.1 valid pack from the §2 input set |
| vox-s2 | Body directional path | facings/mirror/atlas; +X bucket-0 convention |
| vox-s3 | Turret voxel-stack path | §6.3 side elevation measurably changes height profile |
| vox-s4 | Unit-pack emit (data contract) | §6.1 schema-valid + deterministic |
| vox-s5 | Game runtime — data-driven loader | §6.2/§6.5/§6.6 smooth turret, team tint, depth sort, pure Sprite, RN/Pixi 7 |
| vox-s6 | Golden round-trip: procedural Abrams | §6.4 baked Abrams matches the prototype within tolerance |

**First milestone:** vox-s6 golden round-trip — export the procedural Abrams to the §2 input set, re-import
through the pipeline, match the prototype. It's the smallest end-to-end slice that proves tool→pack→game.

## Open items

- **Node-CLI bake** for CI/golden (the deterministic core runs headless with a canvas polyfill or an
  offscreen renderer) — factor from the HTML baker.
- Multi-facing body interpolation (8 from 2 drawn) quality pass.
- Structure (static base + rotating weapon) as a `stack`-part composition — falls out of vox-s5.
