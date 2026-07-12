# Risk-Mitigation.md

# BULWARK — Risk Mitigation Plan

*Companion to Technical-Plan.md. Scope: the vertical slice defined in GDD §19 and Visuals §10, with explicit seams for extended tiers. Every risk below is grounded in the concrete commitments of the Technical Plan — determinism-first, single-language TS core, offline balance toolchain, event-driven presentation — and the source specs.*

---

## 1. Risk Summary

| Severity | Count | IDs |
|---|---|---|
| **Critical** | 1 | R-01 |
| **High** | 3 | R-02, R-03, R-08 |
| **Medium** | 6 | R-04–R-07, R-09, R-10 |
| **Low** | 3 | R-11–R-13 |
| **Total** | **13** | — |

**Top 3 risks requiring immediate attention:**

1. **R-01 — Nondeterminism creep in the sim core (Critical).** Determinism is the load-bearing invariant (Technical Plan §3) and the slice's definition-of-done (Visuals §9). A single float or unordered iteration silently breaks replay and the CI hash gate; every downstream milestone depends on it.
2. **R-02 — Cross-platform PRNG / arithmetic divergence (High).** Replay-hash parity is required across ≥2 platforms (Technical Plan §6). An integer-PRNG or coercion mismatch produces divergent enemy behavior that is expensive to diagnose late.
3. **R-08 — Vertical-slice scope creep from extended tiers (High).** The GDD carries a large deferred world (81-hero alignment model §10–§11, planet-scale tiers §4). Pulling any of it into the slice jeopardizes the headline deliverable.

The determinism cluster (R-01, R-02, R-03) is deliberately front-loaded: it fails silently, compounds across milestones, and cannot be retrofitted once content depends on the broken baseline. Mitigation cost is near-zero if paid at day one and near-catastrophic if deferred.

---

## 2. Risk Register

### R-01 — Nondeterminism creep into the sim core
- **Category:** Technical · **Probability:** High · **Impact:** High · **Score: Critical (H×H)**
- **Why probable:** TypeScript defaults to IEEE-754 floats and `Math.random`; every arithmetic line is a potential violation, and contributors used to ordinary JS reach for `Math.floor`, `Date.now`, and `Array.sort` (whose comparator-less default is lexicographic) by habit.
- **Impact:** Silent replay divergence. The replay path *is* the acceptance test (Technical Plan §3; Visuals §9); if the core is not bit-stable, the slice cannot be declared done and the "determinism-for-free" presentation guarantee (Technical Plan §1) collapses.
- **Mitigation:**
  1. Failing CI lint stage — not a warning — banning `Math.random`, `Date.now`, `performance.now`, and float literals inside the core module (Technical Plan §3.1).
  2. Positions, velocities, and damage stored as fixed-point integers (Technical Plan §2); division uses one documented rounding convention (Technical Plan §3.2).
  3. Entities held in insertion-ordered structures; ban `Set`/`Map` iteration and comparator-less `sort` in hot paths without an explicit stable key (Technical Plan §3.3).
  4. Ship the replay harness *before* content (Technical Plan §6) so the hash gate exists from day one.
- **Contingency:** Bisect the input log against the golden baseline to the first divergent tick, dump the fixed-point state diff, and quarantine the offending PR. A per-subsystem "determinism unit test" suite isolates the failing system fast.
- **Owner:** Sim Core Lead
- **Early warnings:** Lint suppressions in core files; the replay-hash job flaking or being marked allow-fail; combat/pathing math changed without a golden-log update.

### R-02 — Cross-platform PRNG / integer-arithmetic divergence
- **Category:** Technical · **Probability:** Medium · **Impact:** High · **Score: High**
- **Why probable:** The seeded integer PRNG (xorshift/PCG, Technical Plan §2) is simple, but JS bitwise ops coerce to 32-bit signed integers; `>>>` vs `>>` slips and V8/JSC overflow differences yield platform-specific results.
- **Mitigation:**
  1. Integer-only PRNG with committed reference vectors — a fixed output sequence for a known seed, asserted in CI (Technical Plan §5).
  2. All PRNG and fixed-point math confined to one audited module with explicit `| 0` / `>>> 0` masking; raw arithmetic forbidden elsewhere.
  3. Replay-hash gate runs on ≥2 platforms (Linux CI + one other engine/OS) per Technical Plan §6.
- **Contingency:** Pin the affected operation to a BigInt fallback, re-baseline the golden log, and document the coercion that caused it.
- **Owner:** Sim Core Lead
- **Early warnings:** Reference-vector test failing on any target; hashes matching on one platform but not another; bitwise ops added outside the math module.

### R-03 — Renderer / FX reads mutable sim state (presentation-driven desync)
- **Category:** Technical · **Probability:** Medium · **Impact:** High · **Score: High**
- **Why probable:** Renderer and FX run every frame; under performance pressure the temptation to reach into live entities is strong.
- **Mitigation:**
  1. Sim exposed only via a read-only snapshot API and an ordered event stream (Technical Plan §2, §4); presentation receives immutable views, never entity handles.
  2. FX & Audio kept *entirely event-driven* (Technical Plan §2; Visuals §4–§5) so they own no sim state and replay identically for free.
  3. Build-time import lint blocks presentation packages from importing core-internal mutation APIs.
- **Contingency:** Diff the rendered event stream against the logged stream for the same seed; any presentation write path is a build-blocking defect and is reverted.
- **Owner:** Presentation Lead

### R-08 — Vertical-slice scope creep from extended tiers
- **Category:** Product/Scope · **Probability:** High · **Impact:** High · **Score: High**
- **Why probable:** The GDD's deferred content (81-hero alignment §10–§11, planet-scale tiers §4) is visible and appealing; "just one hero" requests accumulate.
- **Mitigation:**
  1. A written slice boundary (GDD §19 / Visuals §10) treated as the contract; extended-tier work requires an explicit change-order, not an inline PR.
  2. Architect *seams*, not features — data-driven hero/tier tables that can grow later without new code paths shipping now.
  3. Track a running "slice budget" (heroes, enemy types, tiers) and reject additions that exceed it.
- **Contingency:** Cut newest-added scope first; the day-one slice definition is the fallback deliverable.
- **Owner:** Product Lead

### R-04–R-07, R-09–R-13 (summary)
- **R-04 (Med) — Fixed-point overflow at high entity counts:** widen accumulators, add saturating-add asserts. *Owner: Sim Core.*
- **R-05 (Med) — Offline balance toolchain drifts from runtime constants:** single source-of-truth data file consumed by both; CI diff check. *Owner: Tools.*
- **R-06 (Med) — Event-stream ordering ambiguity for simultaneous events:** deterministic tie-break key on emit. *Owner: Sim Core.*
- **R-07 (Med) — Snapshot API copy cost at scale:** structural sharing / typed-array views. *Owner: Presentation.*
- **R-09 (Med) — Golden-log churn slows iteration:** auto-regen tooling with human sign-off. *Owner: Tools.*
- **R-10 (Med) — Single-language core limits perf headroom:** profile early, reserve a hot-path escape hatch (WASM). *Owner: Sim Core.*
- **R-11–R-13 (Low):** asset-pipeline naming drift, audio-latency perception, docs lag. Handled by lint/checklist.

---

## 3. Recommendations

1. **Pay the determinism tax on day one.** Land the lint gate, fixed-point math module, and replay harness *before* any content (R-01, R-02). Retrofitting is impossible once content depends on a broken baseline.
2. **Make the boundaries structural, not cultural.** Import lints and CI gates enforce the read-only presentation contract (R-03) and the math-module isolation (R-02) so correctness does not rely on reviewer vigilance.
3. **Treat the slice definition as a signed contract** (R-08). Route all extended-tier appetite through change-orders; build seams, ship the slice.
4. **Instrument the early-warning signals** — allow-fail CI jobs, lint suppressions, and un-updated golden logs are the leading indicators; wire alerts to the relevant leads.
5. **Re-score the register at each milestone**, promoting medium risks (fixed-point overflow, snapshot cost) as entity counts scale toward extended tiers.

---

*Generated by MetaMax Research Brain (LangGraph)*