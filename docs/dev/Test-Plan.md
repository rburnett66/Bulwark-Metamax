# Test-Plan.md

# BULWARK — Test Plan

*QA test plan for the BULWARK vertical slice (GDD §19) and its supporting subsystems. Grounded in the BULWARK GDD, `bulwark-balance.xlsx`, and the BULWARK Visual & Controls Spec. The vertical slice (§19) is the headline gradeable deliverable; the separable subsystems (vision, base-pathing, structure lifecycle, balance sim §17, alignment model §10–§11) grade independently.*

---

## 1. Test Strategy

### 1.1 Testing philosophy

Two of BULWARK's design guarantees make large parts of the game objectively gradeable and shape this plan:

1. **One deterministic core** (GDD §0, §18). The balance sim (§17) produces numeric prices, so two correct builds must converge to identical values. The combat core is seed-stable and headless-callable. We therefore test *convergence and reproduction* — measurable properties — rather than subjective "feel."
2. **No hardcoded balance** (GDD §7, §18). Every stat originates in `bulwark-balance.xlsx` (Assumptions, Archetypes, Faction_Mods, DamageTypes, Effectiveness, Units, Structures). The dominant risk is **data drift**: game code silently diverging from the workbook, or labels/enums drifting *within* the workbook across sheets.

We test **by failure class, not by volume**. A large logic-only suite can pass green while every recurring incident ships (persistence gaps, data drift, seam bypass, restart failures). We add **one cheap, high-leverage guard per failure class** on top of targeted unit tests for the deterministic math.

**The seven failure classes** (each needs a named guard or an accepted-risk sign-off):
1. *Data drift* — game constant ≠ workbook cell.
2. *Intra-workbook enum drift* — an armor class or damage type named inconsistently across sheets.
3. *Non-determinism* — same seed + inputs produces divergent state.
4. *Persistence gaps* — replay/battle-log stream loses inputs, seed, or events.
5. *Seam bypass* — gameplay path skips the sim/effectiveness layer.
6. *Restart failure* — replay reconstruction from Main Menu crashes or desyncs.
7. *State-machine dead ends* — structure lifecycle stuck (e.g. repair with no reachable troop).

### 1.2 Risk-based prioritisation

| Area | Risk | Why | Weight |
|---|---|---|---|
| Balance sim (§17) determinism & convergence | **Critical** | Objective benchmark; drift here invalidates grading | Highest |
| Replay reproduction (Visuals §9) | **Critical** | Doubles as the determinism acceptance test for the whole combat core | Highest |
| Data contract: stats vs `bulwark-balance.xlsx` | **Critical** | "No hardcoded balance" is a rule; silent drift is invisible to fixture tests | Highest |
| Damage-type × armor-class effectiveness (§7) | High | Core counter-play; wrong multiplier = wrong game | High |
| Alignment matrix (§10) regenerability | High | Exact 9×9 across 81 characters is gradeable | High |
| Vision/radar & fog (§5) | High | Separable gradeable subsystem; scouting pillar | High |
| Base-pathing & domain traversal (§5, §6) | High | Domain-specific pathing + target-flag routing | High |
| Structure lifecycle (§8) | Medium | Place→build→repair→upgrade→destroy→sell state machine | Medium |
| Economy (bounty/capture gold, live pricing) | Medium | Affordability + capture-unlock loop | Medium |
| Rendering/FX & camera (Visuals §1–§7) | Medium | Not unit-testable; routed to e2e + dogfooding | Medium |
| Controls / deploy loop UX (Visuals §8) | Medium | Feel/flow is human-judged | Medium |

### 1.3 Coverage targets

- **100%** of vertical-slice acceptance criteria (Visuals §10 DoD + GDD §19 subsystems) mapped to ≥1 test case.
- **≥ 90%** of critical business logic (sim math, effectiveness matrix, alignment generator, cost derivation) covered by unit tests.
- **100%** of the seven failure classes addressed by a named guard or explicit accepted risk.
- Every derived-stat value used by game code traces to a workbook cell (contract test).

---

## 2. Test Scope

### 2.1 In scope

- **Balance sim core (§17):** power→cost derivation (`Cost_per_power_gold = 3`), tier multipliers (HP ×1.6/×2.4, DPS ×1.55/×2.3, Cost ×2.5/×5), effective-DPS-by-armor.
- **Effectiveness matrix:** 6 damage types × 5 armor classes, plus status rules (Frost = no slow vs air; Poison = 0 vs Structure; Concussion stagger on machinery).
- **Alignment model (§10–§11):** hidden axes (Polarity, Conviction T0–T3) → 9×9 matrix (§10.3) across all 81 characters.
- **Vision & fog (§5):** radar sees air not ground; air sees ground at range; night lighting; Dark Energy / Space Tech partial fog-ignore.
- **Domain traversal & base-pathing (§5, §6):** walkers blocked by water/walls/moats; swimmers sub-surface; floaters surface; flyers ignore ground terrain; basic units path to base, only flagged units (Artillery `Targets = Structures`) target structures.
- **Structure lifecycle (§8):** placement (space+cost+build time), health/weapon, repair (time + troop travel), upgrade tiers 1-2-3, damage/destroy, sell (partial refund).
- **Economy:** bounty + capture gold; live unit-list pricing; capture-to-unlock.
- **Deploy loop & controls (Visuals §8):** select → hover preview (valid/invalid tint) → drop/cancel; troop march; base hard points scale with level; single-pointer/single-finger parity.
- **Rendering & FX (Visuals §1–§7, §10):** four-layer unit stack with sensor→weapon telegraph; ground+altitude shadows; dirt trails; three-part shot; structure FX; camera re-sort/re-project; coin-drop on kill.
- **Replay & battle log (Visuals §9):** silent log stream (inputs + seed + events); reconstruction from Main Menu.

### 2.2 Out of scope (and why)

- **Full 9-faction / 72-unit balance tuning.** The slice locks a subset (Vertical_Slice sheet). We test the *mechanism*; roster tuning is later live-ops.
- **World tiers beyond the slice** (Kingdom/Continent/Planet/PvP-Co-op, §4). Same rules, larger boards — validated post-slice.
- **81-hero narrative content (§11–§12).** We test the *matrix generator* against all 81; narrative copy is routed to human review, not automation.

---

## 3. Test Design Notes

- **Convergence test:** derive prices from two independent code paths and assert bit-equality against the workbook; a single mismatch fails the build.
- **Contract test:** a fixture enumerates every workbook cell consumed by code and asserts value + enum-label match — closing failure classes 1 and 2 in one guard.
- **Determinism harness:** replay N seeded matches headless, hash final state, compare against golden hashes (failure classes 3, 4, 6).
- **Effectiveness snapshot:** the full 6×5 grid plus status exceptions asserted as a table, so a single edit surfaces the delta.

---

## Key Recommendations

1. **Make the contract test blocking in CI** — it is the cheapest guard against the highest-probability failure (data drift) and covers two failure classes at once.
2. **Treat replay reconstruction as the whole-core determinism gate** — one passing headless replay validates far more than isolated unit tests.
3. **Assert the 9×9 alignment matrix and 6×5 effectiveness grid as golden tables**, not per-cell asserts, so drift shows as a readable diff.
4. **Route all non-deterministic surfaces** (FX, camera, controls feel) to structured human dogfooding against Visuals §10, and log accepted risks explicitly — never leave a failure class silently uncovered.

---

*Generated by MetaMax Research Brain (LangGraph)*