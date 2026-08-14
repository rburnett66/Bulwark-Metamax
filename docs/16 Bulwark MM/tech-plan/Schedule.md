# BULWARK — Project Schedule

> **Status — reconciled 2026-08-09.** This plan was generated 2026-07-02 and never checked against the
> code. Its 8-sprint window (2026-01-05 → 2026-04-24) **expired ~15 weeks ago**; the dates below are
> historical record, not a live commitment. Epics have been verified against source and the ones the
> project rejected were removed (see §3).
>
> **This document does not cover the work that now dominates the project.** The content-authoring
> tooling — Stack Forge, Terrain Forge, the voxel bake/pack pipeline, atlas composition, decor
> author→bake→scatter→render — has no epic here and never did. That is a gap in the plan, not a gap in
> the work. Flagged rather than invented: adding it is a scoping decision for the owner.

## 1. Project Overview

### 1.1 High-Level Timeline

BULWARK's schedule targeted the **vertical slice** defined in GDD §19 and Visuals §10 — a playable single-field defense with one walker, one floater, and one flyer attacker shape, three towers, the full deploy loop, and a battle-log + replay path that doubles as the determinism acceptance test (Technical-Plan §1). The plan spanned **6 two-week sprints (12 weeks)** from **2026-01-05** to **2026-03-27**. *(Originally 8 sprints to 2026-04-24; S7–S8 held only the removed E8 and its acceptance gate.)*

| Phase | Sprints | Dates | Focus |
|---|---|---|---|
| Phase 0 — Foundations & Determinism Harness | S1–S2 | 2026-01-05 → 2026-01-30 | Sim core skeleton, seeded PRNG, fixed-step tick, replay-hash tests |
| Phase 1 — Core Systems | S3–S4 | 2026-02-02 → 2026-02-27 | Pathing, combat matrix, structure lifecycle, wave/economy loop |
| Phase 2 — Presentation & Slice Build | S5–S6 | 2026-03-02 → 2026-03-27 | Renderer, FX/audio, deploy-loop UI, environment layers |
| ~~Phase 3 — Slice Integration & Hardening~~ | ~~S7–S8~~ | — | **Removed 2026-08-09** with E8. |

**Team basis:** 4 human engineers + 4 supervised AI agents, **268 hrs/sprint total capacity** (Resourcing §1). Sequencing front-loads the Sim Core and its replay harness because they are prerequisites for meaningful Renderer, Toolchain, and QA verification (Resourcing §5.5).

### 1.2 Key Assumptions & Constraints

- **Determinism is load-bearing.** No wall-clock, no `Math.random`, no unordered iteration in the tick path — randomness comes from seeded `src/sim/rng.js`. Replay-hash tests block divergence. *(Corrected 2026-08-09: the original "no floats" clause described a fixed-point core that was never built. The sim uses floats; determinism is held by the seeded RNG and a fixed step.)*
- **No hardcoded balance.** Stats, costs, matrices, and wave scripts are committed data — `src/data/tables.js` + `content/units/*.units.json` — validated by `src/sim/balanceSim.js`. *(Corrected 2026-08-09: the xlsx → `dataset.<hash>.json` pipeline was never adopted.)*
- **PixiJS renderer, one language, no build step.** The client renders through **PixiJS** — vendored at `prototype/test-game/vendor/pixi.min.js` and loaded as a classic global `<script>` before the ESM entry point, because 25 classic `<script src>` tags can't be imported as modules. Pixi is used across `src/render/renderer.js`, `projectiles.js`, `main.js`, and all of `src/harness/`. Application code is JavaScript ES modules with **no bundler and no build step**; the headless sim imports the same modules. *(The original plan's PixiJS call was correct and is retained. Its TypeScript half is not reflected in this repo — there are zero `.ts` files, no `tsconfig.json`, and no `package.json`.)*
- **Input parity** — every action works with a single pointer or single finger (Visuals §8).
- **Slice-first, tier-later** — local logs only; backend services deferred to Tier-1 (Architecture §5.6).
- **Content ships or nothing renders.** The game fetches `content/**` at runtime; a code-only deploy is a blank map.

### 1.3 Critical Path

**Seeded PRNG + fixed-step tick → Replay harness & hash tests → Sim tick loop (pathing + combat matrix) → Balance tables feeding the sim → Renderer reading snapshots.**

The harness is front-loaded because it is both the slice's definition-of-done and the safety net for every downstream system. The dominant schedule risk is **late-discovered determinism drift**: because the acceptance test *is* replay parity, any nondeterminism found in Phase 3 forces rework in code written weeks earlier. Front-loading the CI gate ensures each new subsystem is proven deterministic the day it lands, converting a catastrophic end-of-project risk into small, isolated failures.

---

## 2. Milestones

| Milestone | Target | Key Acceptance Criteria | Depends On |
|---|---|---|---|
| **M1 — Determinism Harness Ready** | 2026-01-30 | Lint bans on `Math.random`/`Date.now`/`performance.now`/float literals enforced in core; PRNG passes reference vectors; a recorded seed + input log replays to an identical FNV-1a/SHA-256 event-stream hash on ≥2 platforms in CI. | — |
| **M2 — Core Sim Complete** | 2026-02-27 | All combat resolves from the committed balance tables (`src/data/tables.js` + `content/units/*.units.json`); effective-DPS validated by `balanceSim.js`; structure lifecycle (Placing→Building→Damaged→Aiming→Firing→Upgrading→Selling/Destroying) runs headlessly; a full slice wave replays bit-for-bit. | M1 |
| ~~**M3 — Balance Dataset Pipeline Live**~~ | — | **Removed 2026-08-09** with E5. Balance is committed data validated by `balanceSim.js`, not a generated content-addressed dataset. | — |
| **M4 — Vertical Slice Playable** | 2026-03-27 | Layered z-order with contact-y depth interleave; four-sublayer unit stack with sensor→weapon telegraph; ground + dim air shadows; three-part shot; structure FX; deploy loop (select→preview→drop/cancel); live-priced unit list; structure menu; troop march; coin-kill animation; camera lean proving parallax + shadow consistency (Visuals §10). | M2 |
| ~~**M5 — Slice Acceptance (Determinism Certified)**~~ | — | **Removed 2026-08-09** with E8. Its live half — replay parity and zero determinism regressions — is enforced continuously by E2's replay-hash tests on every push, not certified once at a gate. Cross-platform certification does not apply to a single-target Pages build. | — |

---

## 3. Epics

| Epic | Goal | Effort (SP) | Milestone | State |
|---|---|---|---|---|
| **E1 — Deterministic Foundations** | Seeded integer PRNG (`src/sim/rng.js`); fixed-step tick loop (`stepSim(state, dtFixed)`) with insertion-ordered entity storage. | 21 | M1 | **Delivered** |
| **E2 — Replay Harness & CI Gate** | Headless replay runner (`src/sim/replay.js`), FNV-1a state hasher (`hashState`), golden-log fixtures, CI test gate. | 13 | M1 | **Delivered** |
| **E3 — Pathing & Combat Matrix** | Walker/floater/flyer movement, damage-type × armor-class effectiveness matrix, status effects — all table-driven. | 21 | M2 | **Delivered** |
| **E4 — Structure & Economy Loop** | Structure lifecycle state machine, wave scheduler, gold economy, harvest, targeting. | 21 | M2 | **Delivered** |
| **E6 — Renderer & Environment Layers** | Layered z-order with contact-y depth interleave, camera/parallax lean, ground + air shadows, sun/shading model. | 21 | M4 | **Delivered** |
| **E7 — FX, Audio & Deploy UI** | Three-part shot, structure FX, coin-kill, deploy loop, structure menu, live pricing. | 21 | M4 | **Delivered** |

**Total: ~118 SP.**

> **Removed 2026-08-09 — epics the project rejected, not epics it failed to finish.**
>
> - **E5 — Balance Toolchain** (13 SP) — specified an offline ingest/validate/price-sim pipeline over
>   `bulwark-balance.xlsx` emitting content-addressed `dataset.<hash>.json`. Bulwark went a different way
>   on purpose: balance is committed data (`src/data/tables.js` + `content/units/*.units.json`) validated
>   by `src/sim/balanceSim.js`. There is no xlsx ingest and no content-addressed dataset, and none is
>   wanted — see the "balance is data" contract in the root `CLAUDE.md`.
> - **E8 — Slice Integration & Acceptance** (13 SP) — its distinguishing deliverable was cross-platform
>   determinism certification across ≥2 platforms. The game ships as a single-target static build to
>   GitHub Pages and CI runs `ubuntu-latest` only. Determinism is still enforced, but by E2's replay-hash
>   tests, which run on every push — so the acceptance goal survives without the epic.
>
> Two clauses were also struck from surviving epics because they were never built: E1's **fixed-point
> integer library** (the sim uses floats; determinism is held by seeded RNG and a fixed step, not by
> integer math) and E2's **cross-platform CI parity job** (single-platform by design, as above).

---

## 4. Sprint Allocation & Buffers

| Sprint | Primary Epics | Load vs. Capacity | Notes |
|---|---|---|---|
| S1 | E1, E2 (start) | ~90% | Harness is critical-path; no parallel presentation work yet. |
| S2 | E1, E2 (finish) | ~85% | **M1 gate.** |
| S3 | E3, E4 (start) | ~95% | Peak load; parallel workstreams over a proven core. |
| S4 | E3, E4 (finish) | ~90% | **M2 gate.** |
| S5 | E6, E7 (start) | ~90% | Presentation begins against frozen sim snapshots. |
| S6 | E6, E7 (finish) | ~85% | **M4 gate.** |

S7–S8 held only E8 and its acceptance gate; both were removed on 2026-08-09, so the sprint plan ends at S6.

---

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Late determinism drift | Rework of weeks-old code | Replay-hash tests from S1; per-subsystem golden logs on merge. |
| Balance/table drift | Silent balance bugs | Retune `tables.js` / `*.units.json` and validate with `balanceSim.js` — never hardcode a special case. |
| Renderer coupling to mutable sim state | Nondeterminism reintroduced | Snapshot-immutability contract asserted at sim→render boundary. |
| Peak S3 overcommit | Slippage into S4 | Cap parallel workstreams at 3; defer non-slice matrix cells if needed. |
| **Content not committed with the feature** | A code-only deploy renders nothing | The game fetches content at runtime — commit `content/**` alongside the code that reads it. |

---

## Key Takeaways

1. **The replay harness is the project's spine** — delivered first, and it doubles as the determinism acceptance test. Every subsystem is proven deterministic the day it merges.
2. **Balance is data, not code paths.** The sim has no hardcoded balance to fall back on, so a retune is a table edit validated by `balanceSim.js` — never a special case in the tick path.
3. **Presentation is deliberately downstream** — the renderer reads immutable snapshots and cannot influence sim outcomes, protecting determinism by construction.
4. **Two epics were removed, not deferred.** E5 and E8 described an architecture the project chose against. Leaving them on the board as "unstarted" would have misreported deliberate decisions as debt.
5. **The plan's real gap is tooling, not epics.** Content authoring is where the effort actually went and no epic here describes it — see the status note at the top.

---

*Generated 2026-07-02 by MetaMax Research Brain (LangGraph). Reconciled against source 2026-08-09 under
`MM-story_msm1ix2r_1` — epic states verified by reading `src/sim/`, `src/render/`, `src/data/tables.js`,
and `.github/workflows/deploy-game.yml`, not inferred from the (stale) reality graph.*