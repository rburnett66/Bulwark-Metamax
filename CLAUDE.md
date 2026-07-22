# Bulwark — project guide

**Bulwark** is a wave-defense RTS prototype. The playable game is **fully static** and lives entirely under `prototype/test-game/` — plain ES modules + HTML/canvas, no framework, no build step. Everything above that (`docs/`, `Bulwark Unit Design/`) is design/authoring material that stays repo-only and never ships.

## The two halves (and the agents that own them)

Bulwark splits cleanly into a runtime half and an authoring half. Two focused subagents live in `.claude/agents/` — reach for them for scoped work:

- **`bulwark-combat`** — runtime **simulation & balance**. `src/sim/**` (combat, waves, economy, harvest, pathfinding, structures, campaign, balanceSim, replay, rng), `src/data/tables.js` (stat/balance knobs), `content/units/*.units.json`, and combat/unit-facing rendering (`src/render/projectiles.js`, `unitArt.js`).
- **`bulwark-terrain-tools`** — **content-authoring pipeline & terrain**. The **Stack Forge** (`tools/voxel-stack/stack-forge.{html,js}`, `harness.html` + `src/harness/**`) for authoring voxel units/decor; the **Terrain Forge** (`terrain.html`, `maplab.html`, `src/terrain/**`) for maps + decor scatter; the voxel runtime (`src/render/voxel/**`); atlas/bake tools; and the decor **author→bake→scatter→render** flow.

`src/render/renderer.js` is **shared** (units + terrain + decor depth-interleave by contact-y) — coordinate changes there, don't let one half clobber it.

## Load-bearing contracts — don't break these

- **Render-tier deploy gate.** Every unit needs an explicit `render_tier` in `src/data/renderTiers.js`; a Tier C unit whose wave data can exceed `MAX_LIVE_3D` **fails the build**. `renderTiers.test.mjs` + `src/render/voxel/pack.test.mjs` are the two CI gates on the Pages deploy — keep both green.
- **Replay determinism.** The sim is replay-driven. Never put `Date.now()`/`Math.random()` in the tick path — draw randomness from the seeded `src/sim/rng.js`, or you break `replay.js` and `balanceSim.js`.
- **Scale & light.** Voxel units and decor bake to a shared scale + lighting model so units, decor, and terrain read consistently in-game. Preserve on-map scale and the sun/shading contract (`src/render/sun.js`; see `docs/16 Bulwark MM/design/Unit-Shading-Design.md`, `Shading-Epics.md`).
- **Content must be committed to ship.** The game fetches content at runtime (e.g. `content/decor/voxel-decor.json`, maps carry `decor[]` groves). These are data files, not code — a code-only deploy renders nothing. Commit `content/**` with the feature. (This gap once shipped decor with no groves.)
- **Balance is data.** Prefer a `tables.js` / `*.units.json` retune validated by `balanceSim.js` over a hardcoded special-case.

## Testing & local preview

- Tests are `node --test` ESM alongside the code (`*.test.mjs`). Run the relevant suite after changes, e.g.
  `node --test prototype/test-game/src/sim/*.test.mjs` — and always keep the two deploy-gate tests green.
- The forges are browser tools (no headless UI test). Preview by serving locally:
  `python serve_prototype.py prototype/test-game/harness.html` (Stack Forge) · `.../terrain.html` (Terrain Forge) · `.../index.html` (the game).

## Deploy

- Pipeline: `.github/workflows/deploy-game.yml`. A push to **`main`** touching `prototype/test-game/**` runs the gate, then publishes to GitHub Pages → **https://rburnett66.github.io/Bulwark-Metamax/** (the mobile link). Only `prototype/test-game/**` ships.
- **Don't push or deploy unless explicitly asked.** Hand back a clean, tested branch.

## Tracking — MetaMax FIRST, always

**No development without MetaMax tickets.** Bulwark is tracked as **Bulwark MM (project 16)** on the
owner's MetaMax platform (`metamax-reality` MCP; local backend on :8000). Before ANY dev task:
check the board (`list_workstreams`), create/update the epic + stories (`create_ticket` — statuses
current while you work, not after), and mirror design docs (`post_document`; the repo copy under
`docs/16 Bulwark MM/design/` stays canonical). Stamp commits with the returned
`closes [MM-<work_item_id>]` so reconcile auto-advances tickets. Repo markdown alone is NOT
visible tracking — the owner runs every project through the MetaMax board.

## Session start

This machine crashes mid-work — never reason from a remembered picture. Before any task: `git fetch` + `git status -sb` + `git log --oneline -8` (current branch AND `origin/main`), and `git worktree list`. Detailed working memory (Stack Forge, geometry/WIP, shading, game audit, voxel decor) is in the user's memory index (`MEMORY.md`).

## Design docs

`docs/16 Bulwark MM/` — `design/` (specs, shading, UX), `create/` (rosters, sample level, style guide), `content/` (unit + atlas source), `design/rules_for_playable.md`.
