# Stack Forge rebuild — voxel editing in the main 3D view

Owner's design, 2026-08-04. Editing moves out of the 2D grid slices and into the orbit view: you edit the
object you are looking at.

## Behaviour

1. **More zoom.** The main window's zoom range is unlocked — close enough to work on individual voxels.
2. **Hover raycast.** The mouse position casts a ray into the volume; the first voxel it hits **lights up**.
3. **Shift = select.** Holding shift turns hover into selection. Clicking adds the voxel to a selection
   set; clicking a selected voxel removes it. The selection stays highlighted on screen and accumulates —
   the artist keeps adding and unselecting until the set is right.
4. **DELETE** removes the selected voxels wherever they were selected — clears them in `VOL`. Adding a voxel is the same operation in reverse.
5. **ESC** puts them back.

Selection is a set of voxel keys, not a rect and not a slice. It persists while the camera orbits.

## ONE selection, shared by both views

There is a **single selection set** — `Set` of `z*foot*foot + y*foot + x` — and both views read and write
that same set. Not one per view, not a main-view set mirrored into a grid-view set.

- Selecting in the **main view** (shift + click on a raycast voxel) puts the key in the set.
- Selecting in the **grid view** puts the same key in the same set.
- Either view unselects by clicking a selected voxel again.
- Both views re-render the highlight from the set, so they are **always in sync** — there is nothing to
  reconcile, because there is only one thing.
- **DEL** removes whatever is in the set, whichever view has focus. **ESC** puts it back.

The old tool had `gridSel` (a rect), `gridSelVox` (a voxel set) and `gridSelView` (which facing drew the
rect) and had to keep them agreeing. Do not rebuild that: a rect and a facing are drawing details, not
state. Store the voxel keys; derive any outline from them when drawing.

## Grid view: Paint mode selects by layer

Paint mode shows the model with **no slice overlays** — just the voxels — and the Layer slider chooses
what you are looking at:

- **Layer 0 = the whole face.** For the current facing, each cell shows the FIRST filled voxel along that
  facing's depth axis — the surface you would see looking at the model from there.
- **Layer 1..N = one real slice** at that depth, so you can reach inside the model.

  INVARIANT: for N layers the slider runs **0..N** — N+1 positions, because position 0 is the surface
  projection and is not a layer. Position `i` shows layer `i`, and the readout must say `i`, not the
  internal array index `i-1`. Labelling the index made 28 layers read as 0..27.

Clicking or dragging in the grid puts those voxels into the shared selection set, and **they light up on
the main 3D view immediately** — same set, both views, nothing to reconcile. That is the point: the grid
is the precise way to pick voxels (a whole face, or one layer deep), and the 3D view is where you confirm
you picked the right ones before acting.

Then **DEL** removes them and **ESC** puts them back — the same two keys as a main-view selection,
because it is the same selection.

This is expected to be the fastest way to add or remove geometry: pick a layer, rubber-band a region,
check it in 3D, delete. Adding works the same way — the selection names voxels, and adding writes
`VOL[k] = 1` instead of `0`.

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
