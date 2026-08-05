# Stack Forge rebuild — voxel editing in the main 3D view

Owner's design, 2026-08-04. Editing moves out of the 2D grid slices and into the orbit view: you edit the
object you are looking at.

## Behaviour

1. **More zoom.** The main window's zoom range is unlocked — close enough to work on individual voxels.
2. **Hover raycast.** The mouse position casts a ray into the volume; the first voxel it hits **lights up**.
3. **Shift = select.** Holding shift turns hover into selection. Clicking adds the voxel to a selection
   set; clicking a selected voxel removes it. The selection stays highlighted on screen and accumulates —
   the artist keeps adding and unselecting until the set is right.
4. **DELETE** removes the selected voxels.
5. **ESC** puts them back.

Selection is a set of voxel keys, not a rect and not a slice. It persists while the camera orbits.

## What this replaces

The 2D grid paint/erase tools, the marquee, the layer walk, and the `voxEdit` overlay applied after the
carve. **Do not rebuild those.** The grid view stays as a *reference* — it shows the slices and the carve —
not as the editing surface.

## Technical notes for the implementation

**The projection to invert** (`renderParts`, orthographic orbit):

```
PX(X,Y)   = cx + S*(X*ca - Y*sa + gx)
PY(X,Y,Z) = groundY + S*((X*sa + Y*ca + gy)*se - (z0 + Z)*h*ce)
```
`ca/sa` = cos/sin(azimuth), `se/ce` = sin/cos(elevation), `h` = zScale, `S` = screen scale.

Two viable picking strategies:

- **Face hit-test (simplest, reuses what exists).** `buildFaces` already produces every exposed face, and
  `renderParts` already sorts them far→near along the view ray. Walk that sorted list in reverse (near
  first), project each face's quad, and take the first quad containing the cursor. The face carries
  `{x,y,z,n}` — that is the voxel and which side was hit. No new maths, and it is exact because it uses
  the same projection that drew the pixels.
- **Volume march.** Invert the projection to a ray in voxel space and DDA through the grid. More code, but
  it can pick *into* the model (e.g. with a modifier) rather than only the visible surface.

Start with the face hit-test; it answers "which voxel am I pointing at" with the geometry already built.

**Deleting must act on the carved volume**, not through an overlay layered on top of it. The carve is the
model — see `CARVE-PIPELINE.md`. Concretely: keep the carved `VOL` (a `Uint8Array`) as the live model,
have DELETE clear those indices in it, and rebuild faces from it. ESC restores from a snapshot of `VOL`
taken before the delete. A re-carve (the Carve buttons) rebuilds `VOL` from the slices and discards edits,
which is correct and predictable.

**Highlighting.** Hover and selection are render state, not model state — they must not enter `VOL`, the
pack, or the project file. Draw them as a tint/outline pass over the affected faces after the normal face
render.

## Rules the rebuild still has to honour

- Original slices decide geometry; alpha is **binary**, opaque or clear — never a ramp.
- Slices stretch over the **sides of a box**; their collisions carve it; the result is mostly solid.
- One resampler for every face, one ink threshold, one placement store.
- The carve runs only when asked (the Carve buttons), never on every control change.
- The tool is served on **:9000**. `node --check` proves a file parses and nothing else — prove geometry
  maths headlessly before wiring it.
