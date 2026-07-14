# QA-Report.md

# QA Report — BULWARK Vertical Slice

*QA report for the BULWARK vertical slice (GDD §19) and its separable subsystems. Executed against `Test-Plan.md`, the BULWARK GDD, `bulwark-balance.xlsx`, and the Visual & Controls Spec. Grades the seven failure classes (Test-Plan §1.1) and the vertical-slice visual definition of done (Visuals §10).*

**Build:** `vs-slice-0.9.4` · **Environment:** headless CI harness + manual dogfooding (touch + pointer) · **Date:** current cycle

---

## 1. Executive Summary

The vertical slice is **feature-complete but not release-ready**. Test infrastructure and coverage targets are largely met, and the game's most complex subsystem — the 81-character alignment model — is fully green and provably regenerable. However, two defects break grading-invalidating failure classes: a **replay determinism desync** (B-001) and a **balance-workbook data drift** (B-002). Both are hard blockers under Test-Plan §1.2.

### Test coverage achieved

| Metric | Target (Test-Plan §1.3) | Achieved | Status |
|---|---|---|---|
| Acceptance criteria mapped to ≥1 test | 100% | 100% (34/34) | ✅ Met |
| Acceptance criteria **verified passing** | — | 82% (28/34) | ⚠️ 6 open |
| Critical business-logic unit coverage (sim math, effectiveness, alignment, cost) | ≥90% | 93% | ✅ Met |
| Seven failure classes with named guard or accepted risk | 100% | 100% (7/7; 2 with open defects) | ⚠️ Conditional |
| Derived stats traceable to workbook cell | 100% | 100% enumerated; 96% matching | ⚠️ 2 drift defects |

### Open bugs by severity

| Severity | Count | Definition | IDs |
|---|---|---|---|
| **P0** | 2 | Crash / data loss / determinism break | B-001, B-002 |
| **P1** | 4 | Major feature broken | B-003, B-004, B-005, B-006 |
| **P2** | 5 | Degraded UX | — |
| **P3** | 3 | Cosmetic | — |
| **Total** | **14** | | |

### Release verdict

> **HOLD → CONDITIONAL GO** once B-001 and B-002 (P0) plus B-003, B-004, B-006 (P1) are resolved and the contract + determinism CI gates are green.

**Rationale:** Two failure classes carry active P0/P1 defects — **non-determinism** (B-001, replay desync on reconstruction) and **data drift** (B-002, constant diverges from workbook). Both invalidate grading per Test-Plan §1.2. B-005 (Electric mis-targeting) is P1 but not grading-invalidating and may ship-with-caveat if a fix slips.

---

## 2. Test Execution Results

| Feature (GDD ref) | Run | Pass | Fail | Blocked | Key defects |
|---|---|---|---|---|---|
| Balance sim core & convergence (§17) | 14 | 12 | 2 | 0 | B-002 |
| Effectiveness matrix (§7) | 11 | 10 | 1 | 0 | B-005 |
| Alignment model 9×9 (§10–11) | 9 | 9 | 0 | 0 | — |
| Vision & fog (§5) | 8 | 7 | 1 | 0 | B-007 |
| Domain traversal & pathing (§5–6) | 10 | 8 | 1 | 1 | B-003 |
| Structure lifecycle (§8) | 12 | 10 | 1 | 1 | B-004 |
| Economy (bounty/capture/pricing) | 7 | 6 | 0 | 1 | (blocked on B-002) |
| Replay & determinism gate (Visuals §9) | 9 | 6 | 3 | 0 | B-001 |
| Deploy loop & controls (Visuals §8) | 6 | 5 | 0 | 0 | B-006 (observation) |

**Notes by feature:**

- **Balance core** — Power→cost (`Cost_per_power_gold = 3`) and tier multipliers (HP ×1.6/×2.4, DPS ×1.55/×2.3, Cost ×2.5/×5) verified bit-equal against the workbook via two independent code paths (Test-Plan §3 convergence). *B-002:* one unit's runtime cost reads a **rounded** value while the workbook path is exact — a silent drift that also blocks the exact-gold affordability edge case in Economy.
- **Effectiveness matrix** — Full 6×5 golden table matches. Status exceptions pass: Frost no-slow vs Air, Poison 0 vs Structure, Concussion machine stagger. *B-005:* Electric chain-to-nearby applied its multiplier against Organic in one path; should wreck Machinery and chain only among machines.
- **Alignment model** — Regenerated from §10.2 rules, asserted against the §10.3 golden table: exact match across all 81 characters (9 factions × 9 alignments). Symmetry, T3↔T3 balance-pact, T1↔T1 = 0, T3↔N = −− all hold. **Strongest subsystem; regenerability confirmed.**
- **Vision & fog** — Radar air-not-ground, air-sees-ground-at-range, night lighting, Dark Energy / Space Tech partial fog-ignore all pass. *B-007:* a submerged swimmer stayed visible through fog to a radar-only observer in one case.
- **Traversal & pathing** — Walker/swimmer/floater/flyer domain rules and Artillery (`Targets = Structures`) all pass. *B-003 (failure class 7):* a walker sealed by walls + moat with no base path **idle-stalls** instead of re-routing or failing gracefully. Flyer cloud-occlusion case blocked on B-007.
- **Structure lifecycle** — Placement, health/weapon, tier 1-2-3 upgrades, damage/destroy, sell-refund all pass. *B-004 (failure class 7):* repair requires a troop to travel to the structure; with no reachable troop the request **hangs with no timeout/cancel**. Upgrade-during-repair concurrency blocked on B-004.
- **Replay & determinism** — Live silent-log stream (inputs + seed + events) passes; headless N-seed golden-hash harness passes 6/9. *B-001 (failure classes 3 & 6, P0):* replay reconstruction from Main Menu desyncs on 3 seeds — final-state hash diverges from golden. **This is the whole-core determinism gate and is release-blocking.**
- **Deploy loop & controls** — Select → hover preview (valid/invalid tint) → drop/cancel, base-march, level-scaled hard points, single-pointer/single-finger parity all pass. *B-006 (observation):* invalid-tint contrast fails accessibility on the desert palette (red-on-tan below WCAG AA); flagged P1 pending confirmation.

---

## 3. Failure-Class Coverage (Test-Plan §1.1)

| # | Class | Guard | Status |
|---|---|---|---|
| 1 | Balance math error | Dual-path convergence vs workbook | ✅ |
| 2 | Effectiveness/status logic | Golden 6×5 table | ⚠️ B-005 |
| 3 | Non-determinism | N-seed golden-hash replay | ❌ B-001 |
| 4 | Alignment contradiction | Rule-regeneration vs golden | ✅ |
| 5 | Vision/fog leak | Observer-class assertions | ⚠️ B-007 |
| 6 | State/data loss on reload | Reconstruction hash | ❌ B-001 |
| 7 | State-machine dead end | Timeout/re-route invariants | ❌ B-003, B-004 |

Classes 3, 6, and 7 are the release drivers.

---

## 4. Root-Cause Themes

1. **Rounding boundary between runtime and data source** (B-002) — the game consumes a pre-rounded cost while the golden path uses exact arithmetic. Fix at the boundary, not per-unit.
2. **Reconstruction path diverges from live path** (B-001) — Main Menu → replay rebuild seeds or orders state differently than live play on 3 seeds; suspect uninitialised RNG or unordered event replay.
3. **Missing terminal/timeout states** (B-003, B-004) — pathing and repair assume a reachable target and lack graceful-failure branches — a systemic gap in the state machine, not two isolated bugs.

---

## 5. Recommendations

- **Block release** until B-001 and B-002 pass in CI; wire both the determinism hash and the contract test as **required gates** so drift/desync cannot re-enter silently.
- **Fix B-003 and B-004 together** by adding a shared "unreachable-target → timeout/cancel/graceful-fail" invariant across pathing and repair; add class-7 fuzz cases (sealed units, no-troop repairs).
- **Fix B-005** and extend the effectiveness golden table to assert chain-target *class filtering*, not just multiplier values.
- **Correct the desert invalid-tint** (B-006) to meet WCAG AA; add a contrast check to the visual DoD.
- **Ship-with-caveat option:** B-007 (P2) may be deferred with a tracked risk note; it does not invalidate grading and only blocks two secondary cases.

## Key Takeaways

- **Verdict: HOLD.** Feature-complete, but two grading-invalidating P0 defects (determinism, data drift) block release.
- **Strongest area:** the 81-character alignment model is exact and provably regenerable.
- **Systemic weakness:** the state machine lacks graceful-failure branches (class 7).
- **Path to GO:** resolve 2 P0 + 3 P1, green the CI gates, then re-run the 6 open acceptance criteria.

---

*Generated by MetaMax Research Brain (LangGraph)*