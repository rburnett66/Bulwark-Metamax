# Stack Forge — save architecture rebuild

Owner's direction, 2026-08-06. One faction at a time, one unit at a time.

## The problem, measured

`content/units/voxel-units.json` = **4,223,752 bytes for three units**. 99.9–100% of every entry is
base64 PNG inlined as text. The actual descriptor is ~1 KB.

| | atlases | model.b64 | entry |
|---|---|---|---|
| abrams | 570,096 | 0 | 570,740 |
| SPA-U3 | 1,516,184 | **742,744** | 2,260,023 |
| GND-Tanks | 1,392,120 | 0 | 1,393,177 |

Causes, compounding: 64 turret angles (8×8 grid, 1728×2128 px per unit) · four atlases per unit
(body/turret + both shadows) · base64 costs +33% · cell size tripled (122×136 → 216×266) · and
`model.b64` written for units that are not Tier C.

`SPA-U3`, `abrams`, `GND-Tanks` appear **nowhere** in `renderTiers.js` — none is Tier C, yet SPA-U3
carries 742 KB of voxel geometry. The game renders these from sprites.

## The rule this all follows

**Most units ship as sprite atlases. Only Tier C (hero flying) units render as live 3D voxels.**
But EVERY unit keeps its full voxel geometry for **editing** — that is authoring truth, not payload.

So: geometry is saved per unit, always. It is bundled for gameplay only for Tier C.

## Target: three stores, three lifetimes

| store | holds | who reads it | size |
|---|---|---|---|
| **`proj:<id>`** (IndexedDB) | the editable unit — slices, cutouts, `imgXf`, `geomState`, `VOL`+`vcol`, palette | the Forge only | MB, fine — IDB has room |
| **`<id>.<part>.png`** (disk, `content/units/atlas/`) | sprite atlases + shadows | the game | real PNGs, no base64 |
| **`content/units/<faction>.units.json`** | descriptor: id, class, footprint, parts, `atlas: "<file>.png"`, stats, tier | the game | **~1 KB per unit** |

`model.b64` leaves the manifest entirely. Tier C units get `content/units/model/<id>.vox`, referenced by
path. Non-Tier-C units never write one — enforced, not optional.

Net: the faction manifest goes from ~4.2 MB to a few KB. localStorage stops being a payload store.

## Work plan

### 1 — Fail loud (do first; everything else depends on trusting saves)
`doSaveUnit` returns `void` on BOTH the quota-failure path and the silent `if (!state.baked) return`.
`quickSave` then prints `Saved "<id>" … reload the game to see it` unconditionally and paints the card
selected. **A failed save reports success.** This is why a lost unit cost a day.
- `doSaveUnit` returns `{ok, id, error}`.
- `quickSave` reports only what actually happened; on failure it throws a visible modal, not a note.
- Wrap `doBake()`/`buildPack()` — a throw there currently aborts with NO message at all.
- Any write that silently no-ops becomes an error dialog naming the store and the reason.

### 2 — Delete what we do not need
- `model.b64` for non-Tier-C units (742 KB on SPA-U3 alone).
- The legacy `layers{base,weapon,head}` 2D-compositing block in the faction files — dead under the
  voxel pipeline; confirm no reader before removing.
- Inline `atlases` base64 in the manifest → replaced by filenames in step 3.
- `config` duplicated per manifest when it is game-wide.

### 3 — Split the stores
- `buildPack()` emits a descriptor with `atlas: "<id>.body.png"` instead of a data-URL.
- Ship writes real `.png` files next to the manifest.
- `loader.js` resolves atlas paths (verify it already does — it reads the shipped file today).
- `model` → its own file, Tier C only, gated by `renderTiers.js` the same way the deploy test gates.
- **`embedModel` stops being a checkbox** and becomes a function of the unit's tier.

### 4 — One save flow on unit switch
Selecting a unit from the Unit Set asks once: **Save "<current>"? Yes / No / Cancel**, showing the
default destination.
- **Yes** → save EVERYTHING for the outgoing unit: `proj:<id>` (voxels + slices), sprite atlases, and
  the faction manifest entry. One action, all three stores, reported loudly.
- **No** → discard and load the new unit.
- **Cancel** → stay put.
No second prompt, no separate "save sprites" vs "save 3D" choice — tier decides that.

### 5 — Clean open
Opening a unit clears the workspace FIRST — geometry (`VOL`, `carveCache`), slices, cutouts, `imgXf`,
`geomState`, selection, undo — then loads that unit's stored geometry. (The unconditional clear landed
2026-08-06; verify slices and `geomState` are included, since a stale `geomState` span silently pinned
turret height across units.)

### 6 — Collapse the buttons
Fourteen controls write to four destinations. Target: **three verbs + one open.**

| keep | absorbs |
|---|---|
| **Save** | `saveUnit`, `saveAs3D`, `saveAsSprites`, `wipSaveNow` |
| **Ship** | `shipManifest`, `decorSaveShip` |
| **Export ▾** | `dlManifest`, `dlSheet`, `projSave`, `exportVox` |
| **Open…** | `loadUnit`, `saveAsLoad`, project-file load |

Plus a persistent status line naming the store last written and when. Most of this session's confusion
was not knowing which of four stores "I saved" meant.

## Order

1 (fail loud) → 2 (delete) → 3 (split) → 5 (clean open) → 4 (one flow) → 6 (buttons).

Fail-loud first so every later step is verifiable. Buttons last — the UI should describe the
architecture once it is settled, not before.
