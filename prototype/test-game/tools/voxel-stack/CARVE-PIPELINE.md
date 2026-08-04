# Stack Forge — the carve pipeline, button press to idle

Every function that runs when you press **⬛ Regenerate geometry**, in order, with line numbers in
`stack-forge.js`. Written by reading the shipped code, not from intent or comments.

The thing to look for is the column **"can remove voxels"**. A voxel you expected and did not get was
removed by exactly one of the steps marked ✂.

---

## 0. Entry — `$('gridRegen').onclick` (`:2033`)

```
part   = gridPart()            :1272   'turret' if state.part === 'turret', else 'body'
foot   = footOf(part)          :1201   state.foot        (turret: state.turretFoot || state.foot)
layers = gridLayersOf(part)    :1273   state.bodyLayers  (turret: state.turretLayers)
gridModel = null                       drop the grid view's cached model
→ rebuildSlices()
→ renderGridView()
→ buildModel(part, foot, layers)       ONLY to count voxels for the readout
→ modelBBox()                          bounding box for the readout
→ paint #gridDims
```

`footOf` / `gridLayersOf` now return the raw state values — nothing derives or grows the grid any
more. They agree with `state.foot` / `state.bodyLayers` by construction.

---

## 1. `rebuildSlices()` (`:1688`) — the single entry point for a re-carve

```
:1689  carveEpoch++                         invalidate the collision cache
:1690  destroy bodyBaked / turretBaked / gBodyBaked / gTurretBaked
:1692  state.baked = null; voxSig = ''      force the orbit to redraw
:1693  bodyMountZ = bodyTopLayer(...)       where the turret sits
:1694  bodyFaces   = buildFaces('body',   state.foot,      state.bodyLayers)     ← THE CARVE
:1695  turretFaces = buildFaces('turret', footOf('turret'), state.turretLayers)  ← THE CARVE
:1697  voxBounds = {...}                    canvas size for the worst-case azimuth
:1699  buildOrbitTarget(orbitS())           allocate the orbit render target
:1700  rebuild the in-game inset sprites
:1713  setTimeout(renderScaleChart, 0)
:1714  gridModel = null; renderGridView()
```

`rebuildSlices` is called from **42** places. Any control that touches the model funnels here, which
is why the carve currently re-runs on every slider nudge.

---

## 2. `buildFaces(partId, foot, layers)` (`:650`)

```
:651  { filled, vcol, views } = buildModel(partId, foot, layers)      ← the model
:653  quant = buildQuantiser(...)        palette reduction (colour only, never geometry)
:668  for every voxel with filled(x,y,z):
        emit a face for each of the 5 directions whose neighbour is EMPTY
        n: 0 = +z, 1 = +x, 2 = −x, 3 = +y, 4 = −y      (there is no −z face — no bottom)
```

Faces are the **surface only**. A solid block emits its shell and nothing inside — that is correct
and is not a gap.

---

## 3. `buildModel` (`:532`) = `applyVoxEdits(buildModelRaw(...))`

### 3a. `buildModelRaw` (`:508`)

```
:509  v = buildVolume(partId, foot, layers)      ← the actual carve, section 4
:510  .vox import short-circuits here
:512  for each column (x,y):
:513     if cd alpha <= INK_A  → skip the column           ✂ leaves voxels BLACK, not removed
:515     else every filled voxel in that column takes the top colour
```

### 3b. `applyVoxEdits` (`:520`) ✂ **removes voxels**

```
:521  if voxEdit[part] is empty → return the model untouched
:523  non-'del' entries overwrite the voxel colour
:526  editedFilled(x,y,z):
         e = voxEdit.get(z*N + y*foot + x)
         e !== undefined ? e !== 'del' : base(x,y,z)
```

**Every `'del'` entry punches a hole in the finished carve**, and `voxEdit` is persisted (section 6).
This runs after the carve and overrides it completely.

---

## 4. `buildVolume(partId, foot, layers)` (`:374`) — the carve itself

```
:375  voxPart[partId]      → buildVoxVolume, skips the carve entirely
:376  state.decorProc      → buildProceduralTree, skips the carve entirely
:378  src = imgs[partId]
:379  no art at all        → procedural placeholder body/turret

      PER-VIEW SLICE PREP — for top, side, front, back:
:394    keyedCanvas(src[v], keyTolState, polyState, pickState)      :166
          → keyBackground  :115   ✂ flood-fills background from the border to alpha 0
                                  ✂ polyState CUT shapes punch holes
                                  ✂ polyState KEEP shapes delete everything outside them
                                  ✂ pickState colours are extra flood seeds
:394    xfCanvas(...)      :1138  per-slice scale/offset from imgXf   ✂ can push art off the face

      THE BOX:
:403    sp = geomSpans(...)  :341   geomState[part] if manual, else autoSpans
:336    autoSpans(foot, layers)     the WHOLE GRID — no aspect fit, no normalize
        ox,bw / oy,bh / z0,Hv derived from sp

      THE MASKS — one resampler for every face:
:415    topG   = sliceMask(topC,   bw, bh, false)     :195
:423    sideG  = sliceMask(sideC,  bw, Hv, true)
:424    frontG = sliceMask(frontC, bh, Hv, true)
:426    backG  = sliceMask(backC,  bh, Hv, true)      colour only, never cuts
        sliceMask: per face cell, count the source pixels it covers; majority opaque → ink.
        Binary alpha, no interpolation, no averaging.        ✂ a cell under 50% opaque is not ink

      THE CARVE:
:432    VOL = new Uint8Array(layers*N)                1. CLEAR
:433    fill VOL = 1 for every voxel inside the box   2. FILL SOLID
:444    cut(topG, (x,y) => (y-oy)*bw + (x-ox))        3. CUT ✂ TOP ONLY (side/front do NOT cut yet)
:446    if no top slice → cut by cd's flat fill instead

      AFTER THE CARVE:
:455    barrel: a tube ORed IN (turret only, barrelLen > 0) — the only step that ADDS
:467    filled = bodyFilled, or bodyFilled || inBarrel
:471    H[] = per-column top surface height
```

---

## 5. `renderGridView()` (`:1345`) and the orbit `update()` (`:1719`)

```
renderGridView  :1352  caches buildModelRaw into gridModel (keyed part+foot+layers)
                :1359  filled() re-applies voxEdit on top of the cache          ✂ again
                       draws the current slice / surface projection

update()        :1734  builds a signature of az/el/taim/part/light/zScale/selection/dimbox
                :1738  if sig !== voxSig → drawScene() → renderParts()  :697
                       renderParts culls faces with camDot <= 0.02 and painter-sorts them
```

Note: `voxSig` does **not** include anything about the model. `rebuildSlices` clears it (`:1692`),
which is what forces the one redraw after a carve.

---

## 6. Persisted state — restored on load, autosaved continuously

`snapshotProject` (`:3425`) writes and `loadProject` (`:3463`) restores all of these. Each one
changes what you see, and each survives a reload:

| key | line | effect |
|---|---|---|
| `voxEdit` | `:3474` | ✂ per-voxel delete/paint applied AFTER the carve |
| `geom` (`geomState`) | `:3475` | the box; if manual, the block does not start as the full grid |
| `imgXf` | `:3476` | ✂ per-slice scale/offset |
| `polys` (`polyState`) | snapshot | ✂ polygon keep/cut shapes cut the silhouette |
| `picks` (`pickState`) | snapshot | ✂ extra colours keyed to transparent |
| `keyTol` (`keyTolState`) | snapshot | ✂ how much the background flood eats |
| `state` | snapshot | foot, layers, zScale, barrel, decorProc … |

---

## Every place a voxel can go missing — the complete ✂ list

1. `keyBackground` flood removed it from the slice (tolerance too high, or the subject touches the
   border and is background-coloured).
2. `polyState` CUT shape punched it out, or a KEEP shape excluded it.
3. `pickState` eyedropper colour keyed it away.
4. `imgXf` moved or scaled the slice so that region fell off the face.
5. `sliceMask` — the face cell it maps to is under 50% opaque coverage.
6. `geomState` manual box — it is outside the box, so it was never filled.
7. **`applyVoxEdits` `'del'` — a saved manual erase.**
8. `buildFaces` did not emit a face because the neighbour is filled (not missing, just interior).
9. `renderParts` back-face culled it (`camDot <= 0.02`, i.e. edge-on).

Steps 1–4 damage the **slice** before the carve sees it. Step 5 is the sampling rule. Steps 6–7 are
persisted state. Steps 8–9 are rendering, not geometry.

**Currently only the TOP slice cuts.** Side and front masks are computed and used for wall colour, but
they do not remove any voxel. So with a top slice loaded, the result must be that silhouette extruded
through the full height of the box — anything else came from the ✂ list above.
