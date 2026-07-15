# Handoff — voxel-stack unit pipeline (Bulwark)

Implementation contract for taking the `voxel-stack` prototype into **the game (Bulwark)** and
**the tool (Stack Forge)**. The prototype in this folder is the validated reference implementation
(PR #86). This doc is the source of truth for the artist input contract, the tool↔game data format,
and the runtime design — the primary CLI implements against *this*, not by re-reading the prototype.

> **Placement (MetaMax rules).** Bulwark is a *managed* project. Its durable tech plan lives in
> **Bulwark's own repo** (materialized from its per-project PG `stage_files`), **not** in MetaMax's
> tree. The work items (epic → stories → tasks) go into the **PG schedule** via `pm_repository` /
> the plan API, each task's acceptance criteria = its Definition of Done, linked to the Bulwark
> tech plan via `techPlanLinks`. This file is the input the primary CLI uses to author those; it is
> not itself the managed-project doc.

---

## 1. Decision: Hybrid pipeline

Units are built from a small set of **static hand-drawn images at one locked iso camera** — no
turntables. Two render paths, chosen per part:

- **Bodies → directional sprites.** Exact art, kept pixel-perfect. Rotation **snaps** to N facings.
  Fine because bodies turn slowly.
- **Turrets (and any part needing smooth aim) → voxel sprite-stack.** Volume reconstructed from the
  views (+ optional elevations), baked into the per-angle cache. **Smooth** 360° rotation.

Runtime is unchanged from the prototype: a part is a `Sprite` that swaps to the nearest cached
frame/angle; per-instance team colour is `sprite.tint`. Pure `Sprite` + `RenderTexture`, no runtime
filters/shaders/MSAA — the `@pixi/react-native`-safe subset. **Pixi 7.**

---

## 2. Artist input contract (per unit)

All images at **one fixed iso camera locked for the whole game** (azimuth + elevation chosen once).
PNG with **alpha** (or a flat key colour). Consistent canvas size and **consistent pivot pixel**
across every frame of a part. Left-right symmetric on anything relied on for mirroring.

| File | Required | Purpose |
|---|---|---|
| `<unit>.body.front.png` | ✔ | Hull only, front-corner iso |
| `<unit>.body.rear.png` | ✔ | Hull only, rear-corner iso (object spun 180°) |
| `<unit>.body.side.png`, `.front3q…` | optional | Extra facings → 8 instead of 4 (finer snap) |
| `<unit>.turret.front.png` | ✔ | Turret only (hull hidden), front-corner iso |
| `<unit>.turret.rear.png` | ✔ | Turret only, rear-corner iso |
| `<unit>.turret.side.png` | recommended | **Side elevation (silhouette only)** → measured height |
| `<unit>.turret.frontEl.png` | optional | **Front elevation** → resolves width-varying height (space-carve) |
| `<unit>.json` | ✔ | pivots, mount offset, footprint, stats (schema below) |

Height quality ladder for the stacked parts:
- iso views only → height **derived** (rough).
- **+ side elevation** → height **measured** along length (best single addition).
- **+ side & front elevations** → **space-carved** true volume (handles height that varies across
  width, e.g. tall turret centre vs. low fenders at the same station).

Minimum to see a unit on screen: `body.front` + `turret.front` (importer mirrors/singles the rest).

---

## 3. Tool changes — Stack Forge

Stack Forge is the offline baker. It must:

1. Accept the artist input set above (iso views + optional side/front **elevations**).
2. **Body path:** load drawn facings → mirror the diagonally-opposite pair → **4 facings** (8 with
   extra drawn views or interpolation). Pack to a facing atlas.
3. **Turret/stack path:** de-skew iso views toward top-down → composite front+rear → build the
   **heightmap** (derived, or measured from the side elevation, or space-carved from side+front) →
   slice → bake the **angle cache** (reuse the prototype's `makeSlices` + `bakeAngleCache`, incl. the
   optional 2× supersample + CAS-lite unsharp `SHARPEN_FRAG`). Pack to an angle atlas.
4. **Emit a "unit pack"** — the tool↔game contract in §4 (atlases + `<unit>.json`). Deterministic,
   so a given input set always bakes the same pack (golden-testable).

---

## 4. Data contract — the "unit pack" (tool emits, game consumes)

This decouples tool from game. Stack Forge writes it; Bulwark loads it. Nothing in the game reads raw
artist PNGs.

```jsonc
// <unit>.json
{
  "id": "abrams",
  "class": "ground",                 // ground | air | structure
  "footprint": [64, 64, 16],         // W, D (square for rotating parts), H layers
  "camera": { "azimuth": 45, "elevation": 30 },  // the locked iso angle (must match art)
  "layerSpacing": 2,                 // SP — must match camera tilt so parts sit together
  "parts": [
    { "id": "body",   "kind": "directional", "facings": 8,
      "atlas": "abrams.body.png",   "cell": [64,64], "pivot": [32, 44], "zeroFacing": "+x" },
    { "id": "turret", "kind": "stack",       "angles": 64,
      "atlas": "abrams.turret.png", "cell": [64,64], "pivot": [32, 44],
      "mount": [0, 0, 9] }           // dx,dy in footprint px; dz in layers (rests on hull)
  ],
  "shadow": { "kind": "ellipse", "rx": 33, "ry": 14, "alt": 0 },  // alt>0 ⇒ flying (plane)
  "stats": { "speed": 90, "turnRate": 3.0, "turretRate": 4.0 }
}
```

- `directional` atlas = N facing frames; runtime picks nearest to heading (snaps), mirrors as needed.
- `stack` atlas = `angles` baked frames; runtime picks nearest angle bucket (smooth).
- `zeroFacing`/bucket-0 convention = **facing +X (east)**; direction must match the runtime's
  `bucketOf`. Fix any offset/flip at bake, not at runtime.

---

## 5. Game runtime — Bulwark (Pixi 7 / RN)

- A `Unit` composes its parts from the pack: `directional` part → nearest-facing `Sprite`;
  `stack` part → nearest-angle `Sprite` mounted at `mount`, lifted by `alt` for air units with a
  detached ground shadow on a low-`zIndex` layer.
- Reuse the prototype's `Tank`/`Plane` structure; generalise "part kind" so one class covers
  ground-with-turret, static-base-with-weapon, and air.
- Depth sort by `y` (`sortableChildren`); air units get a `zIndex` bias.
- Loader is **data-driven from the pack** — adding a unit = dropping a pack in, no code per unit.
- Keep it pure `Sprite` + textures at runtime (no filters) for the RN path.

---

## 6. Acceptance criteria (Definition of Done)

1. Stack Forge ingests the §2 input set and emits a valid §4 unit pack (schema-validated).
2. Given only the two iso body views + two turret views, a unit renders in-game with a directional
   body and a **smoothly-aiming** turret, team-tinted, correct depth sort.
3. Side elevation, when supplied, measurably changes the turret height profile (golden compare).
4. **Golden round-trip:** the current procedural **Abrams** exported to the §2 input set and re-imported
   through the pipeline visually matches the prototype's procedural Abrams within tolerance.
5. Runtime stays pure `Sprite` (no runtime filters); bake time and cache VRAM reported.
6. Runs under `@pixi/react-native` (Pixi 7) — no MSAA render targets, no custom runtime shaders.

---

## 7. Reference material

- **Reference implementation:** `prototype-kits/voxel-stack/` (this repo, PR #86) — `makeSlices`,
  `bakeAngleCache` (+ `SHARPEN_FRAG` supersample/unsharp), `Tank`, `Plane`, procedural
  `drawBody`/`drawTurret`/`drawPlane`.
- **Golden example to generate:** export the four PNGs + `<unit>.json` for the Abrams from the
  prototype as the drawing template + regression fixture (see §6.4).

---

## 8. Open questions for the primary CLI

- Where does **Stack Forge** live as a committed tool (repo/path)? The prototype version is an HTML
  tool; production baker likely a Node/Python CLI in the tool's repo.
- Bulwark repo + PG dev-project id for the tech plan and schedule items.
- Final **locked iso camera** (azimuth/elevation) for the whole game — drives both the art and the
  stack's `layerSpacing`; must be fixed before art production starts.
