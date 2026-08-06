# Stack Forge — save architecture rebuild

Owner's direction, 2026-08-06. One faction at a time, one unit at a time.

---

# START HERE — how to pick this up in a new session

## 0. Root the session in THIS repo (hard rule)

Open a terminal **in the repo root** and start there. Never `cd` in from another project.

```powershell
cd C:\Users\hottd\Documents\Metamax\Bulwark-Metamax
claude
```

Rooting elsewhere means this repo's `CLAUDE.md`, `.claude/settings.json` +
`.claude/settings.local.json` (permissions, incl. `git push`) and project memory **never load** — the
permission classifier then blocks pushes and a routine deploy becomes a fire. If you find yourself
mis-rooted, STOP and relaunch inside the repo; do not work around it by `cd`-ing, editing permission
config, or embedding a PAT.

(To keep the current terminal and just drop context, `/clear` works and stays correctly rooted.
`claude -c` resumes the last session; `claude --resume` picks one.)

## 1. Warm up on MetaMax — tickets BEFORE development

Bulwark is tracked as **Bulwark MM (project 16)** on the owner's MetaMax platform. **No dev without a
ticket.** This applies in THIS repo, not just the platform repo.

1. Make sure the backend is up — the `metamax-reality` MCP server needs it:
   ```powershell
   cd C:\Users\hottd\Documents\Metamax\metamax-ux-test\backend
   uvicorn server:app --port 8000
   ```
   It needs `METAMAX_MCP_TOKEN`; the owner mints one with
   `python backend/scripts/mint_mcp_token.py`. **Note :8000 is uvicorn — the forge is served on :9000.**
2. `session_start` → orient. `list_projects` for the current set (never trust a hardcoded roster).
3. `list_workstreams` for project 16 → find or create the epic for this work, then a story per plan step.
   Keep statuses current **while** working, not after.
4. `graph_overview` / `does_exist` / `impact_of` before building or changing shared code — the reality
   graph answers structural questions faster than grep.
5. `post_document` this plan to the board (the repo copy stays canonical).
6. Stamp commits `closes [MM-<work_item_id>]` so reconcile advances the tickets.

If MetaMax is offline, say so and ask the owner whether to proceed without tickets — they have waived it
before, but it is their call, not an assumption.

## 2. Re-orient on the code (this machine crashes mid-work)

```powershell
git fetch; git status -sb; git log --oneline -8; git worktree list
git log --oneline -5 origin/main
```

## 3. Serve the tool — and get the root right

```powershell
python serve_prototype.py prototype/test-game/harness.html      # Stack Forge  → http://127.0.0.1:9000
```

**Serve `harness.html`, not `stack-forge.html`.** `serve_prototype.py` roots the server at the HTML
file's own directory, so opening `stack-forge.html` directly roots it inside `tools/voxel-stack/` and
`../../content/units/voxel-units.json` **404s** — silently swallowed, leaving `shippedUnits` empty and
every faction reduced to generic `U1…U8` slots. Ports 9000–9049 are scanned; uvicorn holds 8000.
**Always diff the served file against the working tree before believing a "no change" report.**

## 4. Verify like this, not with `node --check`

`node --check` proves a file parses and nothing else. It has passed on genuinely broken builds here.

```powershell
node --test prototype/test-game/src/data/renderTiers.test.mjs prototype/test-game/src/render/voxel/pack.test.mjs
```
Those two are the CI gates on the Pages deploy — keep both green. For forge maths, extract the shipped
function and prove it headlessly before wiring it (see `carve.test.mjs`, `select.test.mjs`).

## 5. State as of 2026-08-06

Branch **`feat/forge-save-architecture`** (off `feat/voxel-decor`, which is merged to `main`).

- **DONE — step 1, fail loud.** `doSaveUnit` returns `{ok,…}`; `saveFailed()` shouts via console, a red
  state line and a blocking dialog; `quickSave` wraps `doBake` and reports only after checking `r.ok`.
- **DONE — size reporting.** Every save logs the manifest size + per-unit bulk, warns past 1.5M chars,
  and warns when a save embeds voxel geometry.
- **NEXT — step 3**, the atlas split. Biggest win (4.2 MB → a few KB) and **zero game-side risk**.
- Not started: steps 2, 4, 5, 6.

**Bootstrap prompt for a fresh session:**

> Continue the Stack Forge save-architecture rebuild on branch `feat/forge-save-architecture`. Read
> `prototype/test-game/tools/voxel-stack/SAVE-ARCHITECTURE-PLAN.md` first — measurements, six steps, and
> the game-code scope are all in it. Step 1 and the size reporting are done. Start at **step 3**: move
> sprite atlases out of the manifest into real PNGs. `loader.js:50` already resolves
> `atlasBase + pt.atlas`, so this needs zero game changes.

## 6. Open questions for the owner

- Where should atlas PNGs live? `loader.js:32` currently expects `content/units/voxel/`.
- The dev-preview path (`loader.js:36`) passes `atlasBase = null` — that single `null` is what forced
  base64 into localStorage. Give it a base, or have the preview read atlases from IndexedDB?
- Still open from the previous branch: **the orbit projection is mirrored in X** (camera at +Y by the
  painter sort, culling and depth, yet +X drawn screen-right). Fixing it mirrors every baked sprite, so
  everything needs re-baking — owner's call. It also reverses the bake's rotation sense, so
  `zeroFacing: '+x'` is quietly wrong.
- Also open: the turret faces right in the slice view but backwards in the model view.

---

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

## Two different things are called "layers" — only one goes

- **`state.bodyLayers` / `state.turretLayers`** — voxel height in the editor. **STAYS.** This is the
  slider, the z span, the grid depth.
- **`units[id].layers{base,weapon,head}`** — the old STACKED-SPRITE composite, superseded by voxels +
  sprite sheets. **REMOVED.** Its only reader is `src/harness/bench.js` (the authoring bench), never the
  game runtime — so removing it is tool-side only.

## How much game code changes: almost none

**Atlases — ZERO game changes.** `loader.js:32` already calls the shipped path with
`atlasBase = 'content/units/voxel/'`, and `:50` resolves:
```js
const src = (entry.atlases && entry.atlases[pt.id]) || (atlasBase ? atlasBase + pt.atlas : null);
```
Inline base64 is merely the FIRST branch of a fallback that has always existed. Stop inlining, write real
PNGs to `content/units/voxel/`, and the loader picks them up untouched. Same for shadows (`:64`) and
decor (`:108`). The only reason inline exists at all: `loader.js:36` passes `atlasBase = null` for the
localStorage manifest — the dev-preview path with no files on disk. That single `null` is what forced
megabytes of base64 into localStorage.

**Geometry — ONE game change.** `live3d.js:66` reads the model inline:
```js
if (!pack || !pack.model || !pack.model.b64) return null;
```
Model-by-path means `live3d.js` (or the loader, hydrating ahead of it) must accept `model.src` and fetch
it. That is the ONLY game-side edit in this plan, and it affects Tier C units only.

**Consequence: step 3 is safely incremental.** Atlases can move to files today with zero game risk and
the manifest drops from 4.2 MB to a few KB immediately. Geometry-by-path follows separately.

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
