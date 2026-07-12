# Schedule.md

# Schedule.md

# BULWARK — Project Schedule

## 1. Project Overview

### 1.1 High-Level Timeline

BULWARK's schedule targets the **vertical slice** defined in GDD §19 and Visuals §10 — a playable single-field defense with one walker, one floater, and one flyer attacker shape, three towers, the full deploy loop, and a battle-log + replay path that doubles as the determinism acceptance test (Technical-Plan §1). The plan spans **8 two-week sprints (16 weeks)** from **2026-01-05** to **2026-04-24**, followed by a hardening and release window.

| Phase | Sprints | Dates | Focus |
|---|---|---|---|
| Phase 0 — Foundations & Determinism Harness | S1–S2 | 2026-01-05 → 2026-01-30 | Sim core skeleton, fixed-point math, PRNG, replay-hash gate, dataset pipeline |
| Phase 1 — Core Systems | S3–S4 | 2026-02-02 → 2026-02-27 | Pathing, combat matrix, structure lifecycle, wave/economy loop |
| Phase 2 — Presentation & Slice Build | S5–S6 | 2026-03-02 → 2026-03-27 | Renderer, FX/audio, deploy-loop UI, environment layers |
| Phase 3 — Slice Integration & Hardening | S7–S8 | 2026-03-30 → 2026-04-24 | Vertical-slice assembly, cross-platform parity, acceptance |

**Team basis:** 4 human engineers + 4 supervised AI agents, **268 hrs/sprint total capacity** (Resourcing §1). Sequencing front-loads the Sim Core and its replay harness because they are prerequisites for meaningful Renderer, Toolchain, and QA verification (Resourcing §5.5).

### 1.2 Key Assumptions & Constraints

- **Determinism is load-bearing.** No floats, no wall-clock, no `Math.random`, no unordered iteration in the core; a CI replay-hash gate blocks any divergence (Technical-Plan §3).
- **No hardcoded balance.** All stats, costs, matrices, and wave scripts come from the versioned `dataset.<hash>.json` emitted from `bulwark-balance.xlsx` (GDD §18, Technical-Plan §1).
- **Single language** (TypeScript + PixiJS) for client and headless sim, eliminating a cross-runtime determinism port (Technical-Plan §1).
- **Input parity** — every action works with a single pointer or single finger (Visuals §8).
- **Slice-first, tier-later** — local logs only; backend services deferred to Tier-1 (Architecture §5.6).
- **QA is the thinnest resource** (44 hrs/sprint, 80% availability). Marcus is the designated backup gate reviewer (Resourcing §4).

### 1.3 Critical Path

**Fixed-point math + PRNG → Replay harness & CI hash gate → Sim tick loop (pathing + combat matrix) → Dataset pipeline feeding the sim → Renderer reading snapshots → Slice integration → Cross-platform acceptance.**

The harness is front-loaded because it is both the slice's definition-of-done and the safety net for every downstream system. The dominant schedule risk is **late-discovered determinism drift**: because the acceptance test *is* replay parity, any nondeterminism found in Phase 3 forces rework in code written weeks earlier. Front-loading the CI gate ensures each new subsystem is proven deterministic the day it lands, converting a catastrophic end-of-project risk into small, isolated failures.

---

## 2. Milestones

| Milestone | Target | Key Acceptance Criteria | Depends On |
|---|---|---|---|
| **M1 — Determinism Harness Ready** | 2026-01-30 | Lint bans on `Math.random`/`Date.now`/`performance.now`/float literals enforced in core; PRNG passes reference vectors; a recorded seed + input log replays to an identical FNV-1a/SHA-256 event-stream hash on ≥2 platforms in CI. | — |
| **M2 — Core Sim Complete** | 2026-02-27 | All combat resolves from `dataset.<hash>.json`; effective-DPS matches the workbook `Units` sheet; structure lifecycle (Placing→Building→Damaged→Aiming→Firing→Upgrading→Selling/Destroying) runs headlessly; a full slice wave replays bit-for-bit. | M1 |
| **M3 — Balance Dataset Pipeline Live** | 2026-02-27 | Schema + referential integrity pass (valid faction/shape/damage-type/armor-class, 6×5 matrix, 100-point budgets); price simulator applies `Cost_per_power_gold = 3` and T2/T3 curves; `dataset.<hash>.json` + manifest embedded in build. | M1 |
| **M4 — Vertical Slice Playable** | 2026-03-27 | 14-layer z-order; four-sublayer unit stack with sensor→weapon telegraph; ground + dim air shadows; three-part shot; structure FX; deploy loop (select→preview→drop/cancel); live-priced unit list; structure menu; troop march; coin-kill animation; ≥1 camera rotation proving parallax + shadow consistency (Visuals §10). | M2, M3 |
| **M5 — Slice Acceptance (Determinism Certified)** | 2026-04-24 | Slice sessions replay bit-for-bit across ≥2 platforms; Main-Menu replay reconstructs a battle identically; snapshot-immutability asserted at the sim→render boundary; all Visuals §10 items demonstrated; zero open determinism regressions. | M4 |

---

## 3. Epics

| Epic | Goal | Effort (SP) | Milestone |
|---|---|---|---|
| **E1 — Deterministic Foundations** | Fixed-point integer library with one documented rounding convention; seeded integer PRNG (xorshift/PCG); fixed-step tick loop with insertion-ordered entity storage. | 21 | M1 |
| **E2 — Replay Harness & CI Gate** | Headless replay runner, event-stream hasher, golden-log fixtures, cross-platform CI parity job. | 13 | M1 |
| **E3 — Pathing & Combat Matrix** | Walker/floater/flyer movement, 6×5 damage×armor matrix, status effects, all dataset-driven. | 21 | M2 |
| **E4 — Structure & Economy Loop** | Structure lifecycle state machine, wave scheduler, gold economy, targeting. | 21 | M2 |
| **E5 — Balance Toolchain** | Offline ingest/validate/price-sim pipeline emitting content-addressed JSON. | 13 | M3 |
| **E6 — Renderer & Environment Layers** | 14-layer z-order, camera/parallax, ground + air shadows, snapshot reader. | 21 | M4 |
| **E7 — FX, Audio & Deploy UI** | Three-part shot, structure FX, coin-kill, deploy loop, structure menu, live pricing. | 21 | M4 |
| **E8 — Slice Integration & Acceptance** | End-to-end assembly, immutability contract, cross-platform certification. | 13 | M5 |

**Total: ~144 SP** against ~268 hrs/sprint × 8 sprints, leaving buffer for the QA-constrained hardening tail.

---

## 4. Sprint Allocation & Buffers

| Sprint | Primary Epics | Load vs. Capacity | Notes |
|---|---|---|---|
| S1 | E1, E2 (start) | ~90% | Harness is critical-path; no parallel presentation work yet. |
| S2 | E1, E2 (finish) | ~85% | **M1 gate**. Slack reserved for CI parity debugging. |
| S3 | E3, E4, E5 (start) | ~95% | Peak load; three parallel workstreams over a proven core. |
| S4 | E3, E4, E5 (finish) | ~90% | **M2 + M3 gates.** |
| S5 | E6, E7 (start) | ~90% | Presentation begins against frozen sim snapshots. |
| S6 | E6, E7 (finish) | ~85% | **M4 gate.** |
| S7 | E8, hardening | ~75% | QA-led; deliberate slack for parity/regression fixes. |
| S8 | E8, acceptance | ~70% | **M5 gate.** Buffer absorbs late determinism drift. |

The declining S7–S8 load is intentional: acceptance work is gated by QA's 44 hrs/sprint, and hardening carries the highest variance risk.

---

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Late determinism drift | Rework of weeks-old code | CI hash gate from S1; per-subsystem golden logs on merge. |
| QA is the bottleneck resource | Acceptance slips | Marcus as backup reviewer; front-load automated parity checks. |
| Dataset/sim schema drift | Silent balance bugs | Content-addressed hashes + referential-integrity validator in E5. |
| Renderer coupling to mutable sim state | Nondeterminism reintroduced | Snapshot-immutability contract asserted at sim→render boundary. |
| Peak S3 overcommit | Slippage into S4 | Cap parallel workstreams at 3; defer non-slice matrix cells if needed. |

---

## Key Takeaways

1. **The replay harness is the project's spine** — it is delivered first (M1), and it *is* the acceptance test (M5). Every subsystem is proven deterministic the day it merges.
2. **M2 and M3 co-gate Phase 1**: the sim and its dataset pipeline must land together, since the sim has no hardcoded balance to fall back on.
3. **Presentation is deliberately downstream** — the renderer reads immutable snapshots and cannot influence sim outcomes, protecting determinism by construction.
4. **QA capacity, not engineering capacity, sets the hardening pace.** S7–S8 are intentionally under-loaded to absorb parity fixes.
5. **Recommendation:** treat any CI hash-gate failure as a build-stopping event from S1 onward. The cheapest determinism bug is the one caught the same sprint it is written.

---

*Generated by MetaMax Research Brain (LangGraph)*