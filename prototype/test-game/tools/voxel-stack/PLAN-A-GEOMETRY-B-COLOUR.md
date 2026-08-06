# Stack Forge — Plan A (geometry accuracy) · Plan B (colour + painting)

`feat/forge-save-architecture`, 2026-08-06. Two independent workstreams. B can start immediately; A's
sequencing depends on the compatibility analysis now running.

---

# PLAN B — colour and painting, rebuilt

## B0 · The problem, stated once

Colour has **five stores** (`vcol`, `voxEdit`, `palMap`, `palKeep`/`palDrop`, `state.paletteN`) and
**four independently-derived palettes**. `vcol` is the model. Nothing an artist does writes it — every
colour tool writes `voxEdit`, which `buildModel` does not read. `buildFaces` reads the *painted* flag
from `voxEdit` and the *colour* from `vcol`, so painting a voxel suppresses its wall art and applies no
colour. Measured: a voxel painted red renders as flat hull grey in 3D and in the bake.

Nothing below works until that is fixed, so B1 is not optional groundwork — it is the feature.

## B1 · Foundation: one colour model, one writer, one history

**`m.PAINT`** — `Uint8Array(layers·foot²)` beside `VOL` and `vcol` on `carveCache[part].m`.
`1` = artist colour, authoritative. `0` = carve-derived, re-derivable.

**`setVox(part, k, rgb)`** — the *only* function that writes colour:
```js
m.vcol[k*3] = r; m.vcol[k*3+1] = g; m.vcol[k*3+2] = b; m.PAINT[k] = 1;
```
Repoint every colour tool at it: brush, fill, mirrors, re-project, both remaps. Delete `voxEdit`,
`applyVoxEdits`, `snapVoxEdit` and the `'del'` sentinel.

**Wall art moves into `vcol` at carve time.** After the carve smears each column's top colour, walk the
exposed faces once and write the side/front/back sheet colour into `vcol` for surface voxels. Then
delete `wallCol`/`pick` from `buildFaces` entirely.

> This is the highest-leverage change in the plan. `collectVox` — which builds `pack.model` for Tier C
> and the `.vox` export — is **per-voxel** and cannot carry per-face art, so today a Tier C unit renders
> with side-sheet art at Tier A/B and a flat top-down smear at Tier C. Baking art into `vcol` makes the
> model exactly what every consumer already assumes, and that whole divergence disappears by
> construction rather than by another special case.

**One history.** `pushEdit(part)` snapshots `{VOL, vcol, PAINT}` together. Ctrl+Z, Ctrl+Y and both
toolbar buttons drive it. Delete the `volHistory`/`undoStack` split — today Ctrl+Z undoes geometry
while the ↶ button undoes paint, so an accidental mirror plus Ctrl+Z *compounds* the damage.

**One quantiser**, cached on `carveCache[part]` keyed `(paletteN, palEpoch, carveEpoch)`, read by the
grid, `buildFaces` and `collectVox`. Today the grid and `buildFaces` build theirs from different
buffers, so one paint stroke re-bins **unpainted** voxels differently between the two views.

**Persist** `vcol` + `PAINT` in `snapshotProject` exactly as `VOL` is — b64, stamped with `foot`/
`layers`, written only when `PAINT` is non-empty.

## B2 · `palette.js` — the reduction core  *(written, proven)*

DOM-free, `carve.js` idiom, importable in node. Already validated against a realistic model.

- `extractPalette(vcol, count, filled)` → every colour the model actually uses, with populations,
  deterministic ordering (ties broken by value, never by Map insertion).
- `reducePalette(entries, n)` → **half the budget to COVERAGE, half to VARIETY.**

> Median cut alone collapses a hull that is 90% grey into nine greys and discards the red stripe that
> carries the silhouette. So coverage gets `ceil(n/2)` slots by population-weighted median cut; the rest
> go to the entries *furthest* from what coverage already chose, weighted by `log2(1+population)` so one
> stray pixel cannot win a slot. Distance is luminance-weighted, so "variety" means what the eye sees.

  Measured on 90% hull grey + red stripe + dark visor + gold trim + blue lens:
  | n | result |
  |---|---|
  | 2 | dark visor + hull grey — max contrast, **not** two adjacent greys |
  | 4 | red accent survives, lumSpread 101, 2 hue families |
  | 8 | all seven real colours, meanErr 0.0 |

- `paletteStats` → `meanErr`, `worstErr`, `lumSpread`, `hueCount` — the numbers the modal shows so the
  choice is informed rather than aesthetic guesswork.
- `paletteOptions(entries, [2,4,8,16,32,48])` → what the modal renders.
- `applyPalette(vcol, count, filled, palette)` → in place, returns voxels changed.

**Refinement to land with the modal:** merge near-identical entries (ΔE below a threshold) before
allocating slots, so a cluster of three greys within 2 units of each other cannot consume three slots.

## B3 · The palette modal

Full-screen. Three regions.

**Left — the original palette.** Every colour the model actually uses, largest population first, with
counts. This is the starting point and it is never destroyed; every option is derived from it, and
`Revert to original` is always one click.

**Centre — the six options: 2 · 4 · 8 · 16 · 32 · 48.** Each a swatch strip plus its stats
(`mean error`, `lum spread`, `hue families`). The current selection is outlined. Sizes with more slots
than the model has colours are shown but marked *"model has only N colours"* rather than hidden — the
artist should see the ceiling.

**Right — the sample window: TOP and SIDE, live.** Both views redrawn with the candidate palette, side
by side with the unmodified original above them. This is the deliverable that makes the choice
real — a swatch strip cannot tell you that dropping to 4 colours flattens the turret shadow.

> Renders through the same code path the grid uses, at a fixed cell size, from `vcol` + the candidate
> palette. Not a screenshot, not an approximation — if it looks right here it looks right in the model.

**Apply** runs `applyPalette` on the model's `vcol` and bumps `palEpoch`. Because it writes the model,
it is one undo step and is included in the same history as every other edit.

## B4 · The paint tools, simplified

Paint mode currently exposes Delete / Add / Paint / Select plus Fill, Mirror ×4, Re-project, Select
layer, Clear layer, two Resets and a Lasso — seventeen controls in a flat wrap. Reduce to **four
tools plus a colour**:

| tool | does | notes |
|---|---|---|
| **⬚ Select** | rubber-band voxels; SHIFT adds, CTRL trims | already built and shared across all views |
| **✥ Move** | drag the selection through the volume | new: `VOL`/`vcol`/`PAINT` moved together, one undo step |
| **🖌 Brush** | paint voxels under the cursor in the current colour | writes via `setVox`; size 1–5 |
| **🪣 Fill** | flood the current selection, or the contiguous same-colour region if none | one `setVox` per voxel, one undo step |

**The colour button — Photoshop-style.** A single large swatch showing the current colour. Click it to
open the picker: the model's reduced palette first (the colours actually in the unit), then a standard
picker for anything else. **Alt-click anywhere on the model to eyedrop** — the classic modifier, and it
replaces the dead `sampleColor` function that exists today with zero call sites and no button.

Everything else moves out of the tool row: mirrors and re-project become **Ops** (transient, applied to
the selection), resets become a visually separated destructive group with confirms.

## B5 · Sequence

| # | step | gate |
|---|---|---|
| 1 | `PAINT` array + `setVox` + repoint every writer | painting a voxel changes its colour in grid **and** 3D |
| 2 | wall art baked into `vcol`; delete `wallCol` | Tier C and Tier A/B render identically |
| 3 | one history `{VOL, vcol, PAINT}` | Ctrl+Z undoes paint and geometry in true order |
| 4 | one cached quantiser | grid and `buildFaces` bin every voxel identically |
| 5 | `palette.js` wired; palette modal with live TOP/SIDE preview | the six options render and apply |
| 6 | four tools + colour button; retire the rest | tool row fits one line |
| 7 | persist `vcol` + `PAINT` | paint survives a reload |

Steps 1–4 are invisible to the artist and mandatory. Step 5 is the feature. Step 6 is what makes it
usable daily.

---

# PLAN A — geometry accuracy

Staged carving (`carveCuts`, the three ⬛ buttons) is **settled design**, not a defect. What A covers is
accuracy and legacy cleanup around it.

## A0 · Open decision — carve staging persistence

The staging currently resets on every load. Two readings, one line apart:

- **(a)** Reset to top-only on load — staged carving is the workflow; you always start from the top.
- **(b)** Persist the stage — a reload restores whatever stage you left it at.

I have implemented (b) plus an all-three default. **If (a) is intended, the default reverts and only the
persistence stays.** Awaiting your call; nothing else in A depends on it.

## A1 · Known-verified defects (independent of the compatibility pass)

| # | defect | symptom |
|---|---|---|
| A1.1 | **FRONT slice mirrored in y** between the carve index and both `AX.front` and `GEOAX.front`. Side and back are consistent — exactly one facing disagrees | an off-centre feature drawn in the front elevation appears on the opposite side in the Front grid view and in the overlay you align against |
| A1.2 | **Barrel cannot protrude** — `bx1` clamps to `foot-1` for every `reach` since the box became the grid; also half a voxel off-centre (`bh/2` vs `(bh-1)/2`) and ignores `z0` | barrel length has no visible effect past the hull |
| A1.3 | **Bake and orbit frames sized from the BODY footprint** — a 96-foot turret on a 64 body loses ~18px off the baked sprite, and the orbit clips too | turret corners cut off in the shipped atlas, invisible in preview |
| A1.4 | **Decor bakes at one elevation, records another** — `sp` from `state.el`, frames at `bakeElOf()` | decor packs ship a `layerSpacing`/`elevation` that does not match their own pixels |
| A1.5 | **`bodyTopLayer` re-carves the body uncached** and misses hand edits | shave the hull top and the turret keeps floating at the old height |
| A1.6 | **Three resamplers** for the same slice→face projection: `sliceMask` (majority), overlay `drawImage` (nearest), dim box `projImg` (bilinear, smoothing never disabled) | a 1px antenna survives in the overlay you align against and is deleted by the carve |
| A1.7 | **Four alpha thresholds**, one of which is `INK_A` | thresholds drift the moment `INK_A` moves |
| A1.8 | **`carveCache` keyed on `{foot, layers}` only** — no epoch | correct only because ~20 sites remember to call `recarve()`; a new control that forgets returns a stale model silently |

## A2 · The structural fix that prevents recurrence

**Load `carve.js` and delete the inline carve.** `<script src="carve.js">` before `stack-forge.js`;
`buildVolume` calls `carve({foot, layers, box, slices, cuts})`.

`carve.js` has **19 green tests** and `stack-forge.html` has never loaded it — the tested carve and the
shipped carve are different code. One line of HTML converts an entire tested module into a deploy gate.
Same for `select.js`.

**Do this before A1**, so every A1 fix lands against a test that can hold it.

## A3 · Compatibility

A compatibility pass is running now, producing: a dependency-ordered sequence where each step leaves the
tool working, an explicit conflict table for fixes touching the same quantity, and for each
double-computed quantity a decision on which site becomes canonical. **A1.1 in particular must be fixed
in exactly one place** — the carve index or the axis map, never both, or it inverts twice and looks
fixed while being wrong in a new way.

Quantities known to be computed in more than one place, each needing a single-source decision:
the carve · slice→face resampling · ink threshold · the geometry box (clamped vs unclamped) · the body
volume · footprint centre (`foot/2` vs `(foot-1)/2` vs `oy+bh/2`) · wall-colour sampling · bake frame
radius · the grid↔span axis map.

---

## Recommended order across both plans

1. **A2** — load `carve.js`. One line, converts 19 tests into a gate, makes everything after it safe.
2. **B1** — the colour foundation. Nothing in B works without it, and it removes `voxEdit` entirely,
   which also deletes five dead geometry writers that A would otherwise have to reason about.
3. **A1.1 / A1.2 / A1.3** — visible placement errors, now test-backed.
4. **B2–B3** — `palette.js` and the modal. The feature you asked for.
5. **B4** — the four tools and the colour button.
6. **A1.4–A1.8, B7** — correctness cleanup and persistence.

B1 before A's placement work is deliberate: retiring `voxEdit` deletes five dead geometry edit paths, so
A stops having to account for tools that write to a store nobody reads.
