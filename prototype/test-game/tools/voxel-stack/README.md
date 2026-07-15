# voxel-stack kit — sprite-stack tanks (native Pixi v7)

A focused prototype for the Bulwark volume look: **high-detail sprites capping a stack of colored
voxel layers**, rendered as pure sprites on a real `PIXI.Application` (WebGL). Proves the technique
*and* the runtime optimization on the Pixi 7 / React-Native path.

## Run

From the repo root (needs internet for the Pixi CDN, like the other kits):

```
python serve_prototype.py prototype-kits/voxel-stack/index.html
```

It opens a browser tab. **WASD / arrows** drive the hero **M1 Abrams**; the **mouse** aims its
turret; **SPACE** A/B-toggles the smooth+sharpen pass. Three AI tanks wander and track the hero —
they share one baked cache, tinted per team.

The tank is procedural (see `drawBody` / `drawTurret`) — a desert-tan Abrams: faceted wedge turret,
long 120mm gun with thermal sleeve + bore evacuator, bustle rack, side skirts, sloped glacis, and
louvered engine deck. Each `drawFn(colorCtx, heightCtx, f)` paints a top-down part (front = +X) plus
a grayscale height map that drives the extrusion; swap these for real art without touching the bake.

Two **F-16s** fly over the battlefield (see `drawPlane`) — two-tone gray, swept cropped-delta wings,
bubble canopy, and a tall vertical tail fin (the height peak). They use the *same* slice → bake →
angle-cache path as the tank; a plane is just a single-part `Plane` that flies at altitude with a
detached ground shadow, proving the air-unit case from the same pipeline.

## What it demonstrates

- **Two objects per tank** — body and turret rotate independently. The turret sits on the hull
  (`MOUNT`) and aims wherever it likes while the body faces its heading.
- **Square footprint for rotating parts** (`FOOT = 64`) so the shape never clips at 45°.
- **The angle-cache bake — "redraw only on rotation", in its ideal form.** Each part's 16 layer
  slices are stacked + rotated and flattened into one `RenderTexture` per angle (`ANGLES = 64`),
  once, per unit *type*. At runtime a part is a single `Sprite` that swaps to the nearest baked
  angle. Re-bakes per frame: **0**. The HUD shows the bake time and cache VRAM.
- **Smooth + sharpen at bake time (SPACE to A/B)** — the "detail" pass lives in the bake, not a
  per-frame filter: each smoothed angle is 2× supersampled (anti-aliases the layer staircase) and
  run through a CAS-lite unsharp mask (`SHARPEN_FRAG`, one GLES2-safe pass). Both a flat and a
  smoothed cache are baked so the toggle is an instant texture swap — **runtime pass: none**, which
  is what keeps it RN-safe. Tune with `SHARP`.
- **Type-shared cache + per-instance tint** — all four tanks reference the same textures; team
  colour is just `sprite.tint`, which does not break batching in Pixi 7.
- **Depth sorting** — `world.sortableChildren` with `zIndex = y` so nearer tanks draw over farther.
- **Air units from the same rig** — a plane is one part (no turret) lifted by `PLANE_ALT` with its
  shadow on a separate ground layer beneath the units, and a big `zIndex` bias so it always draws
  over ground units. Same yaw angle-cache; same smooth/sharpen bake.

## Object target

`64 × 32 × 16` was the base target; rotating parts here use a **square 64×64×16** footprint (the
diagonal) so rotation is clean — keep 64×32 for things that never spin (static structure bases).

## Pixi 7 / RN notes

Deliberately **pure `Sprite` + `RenderTexture`** — no filters, no custom shaders, no MSAA render
targets — which is the portable subset for `@pixi/react-native`. Slices are generated procedurally
here; swap `drawBody` / `drawTurret` in `voxel-stack.js` for real art (or feed exported Stack Forge
atlases) without touching the bake or runtime.

## Files

- `index.html` — boot (Pixi CDN + the script).
- `voxel-stack.js` — procedural slices → angle-cache baker → `Tank` instances → scene.
