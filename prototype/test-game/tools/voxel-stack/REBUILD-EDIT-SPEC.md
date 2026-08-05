# Stack Forge rebuild — voxel editing in the main 3D view

Owner's design, 2026-08-04. Editing moves out of the 2D grid slices and into the orbit view: you edit the
object you are looking at.

## Behaviour

1. **More zoom.** The main window's zoom range is unlocked — close enough to work on individual voxels.
2. **Hover raycast.** The mouse position casts a ray into the volume; the first voxel it hits **lights up**.
3. **Shift = select.** Holding shift turns hover into selection. Clicking adds the voxel to a selection
   set; clicking a selected voxel removes it. The selection stays highlighted on screen and accumulates —
   the artist keeps adding and unselecting until the set is right.
4. **DELETE** removes the selected voxels — clears them in `VOL`. Adding a voxel is the same operation in reverse.
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

**EDITS GO STRAIGHT INTO THE CARVED VOLUME.** There is no edit layer. `VOL` (a `Uint8Array`, one byte per
voxel) is the model, and editing writes to it:

```
delete voxel  ->  VOL[k] = 0
add voxel     ->  VOL[k] = 1        (colour written to the same index in vcol)
```

That is the whole mechanism. None of `voxEdit`'s complexity comes back — no overlay applied after the
carve, no `'del'` sentinel distinct from "absent", no second store to keep in sync, no key remapping when
the grid resizes, no ordering rules about which layer wins, and nothing about edits in the project file.
After an edit, `VOL` is simply the model; rebuild faces from it and draw.

- **ESC / undo** = restore a snapshot of `VOL` taken before the operation. One array copy, no diffing.
- **A re-carve** (the Carve buttons) rebuilds `VOL` from the slices and discards edits. That is correct
  and predictable: carving is how you start over.
- **Saving** writes `VOL`. There is no separate edit record to serialise, so a reload cannot resurrect
  edits onto a fresh carve — the failure that made a correct carve look broken all day.

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
