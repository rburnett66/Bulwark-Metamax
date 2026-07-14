# Risk-Assumption-Analysis.md

# Risk & Assumption Analysis — BULWARK

*IDEA-stage risk assessment for a multi-faction, multi-domain tower defense with an automated balance sim. Grounded in the BULWARK GDD (v2.0), the Balance Data Model (v1, even-baseline), and the Visual & Controls Spec (v1.0). External market context is drawn from public industry data and flagged as such.*

> **Source-change note (per directive).** This revision re-checks assumptions against the current source files, giving priority to the GDD (v2.0) and the Balance Data Model workbook (`bulwark-balance.xlsx`, v1). Where the GDD and workbook now pin down concrete values or rules, those are cited directly and are **no longer treated as open assumptions** — the risk register below has been narrowed accordingly so we do not raise "unvalidated" flags on things the sources actually specify.

> **Dual-purpose caveat.** GDD §0 declares BULWARK "dual-use — (1) a real, buildable game design; (2) a controlled benchmark for comparing Metamax vs. Cursor vs. Grok Super Heavy." The GDD further states **"the primary benchmark deliverable is a vertical slice (§19)"** and that *"the slice is the headline test."* This report treats BULWARK primarily as a **game concept** (per the IDEA stage) but flags where the benchmark framing — and specifically its concentration into the §19 vertical slice — changes the risk profile. The dual mandate is itself a top-tier risk (§3.1).

---

## 1. Critical Assumptions

Each assumption is rated on how well current sources support it. "Evidence" = what is *specified* in the current GDD/workbook; "Gap" = what is asserted-but-unvalidated or absent. Values are cited from the sources verbatim where possible.

### 1.1 Market Assumptions

| # | Assumption | Evidence in sources | Gap / Status |
|---|---|---|---|
| M1 | Meaningful demand exists for a *complex* TD scaling "path → castle → kingdom → continent → planet → PvP/co-op" (GDD §1, §4). | Scale ladder fully specified as a pillar ("Simple front, deep back", §2.5); §4 table maps each tier's new pressure. | **Unvalidated.** No sizing, comps, or audience data. The premium/complex TD niche (e.g. *Kingdom Rush*, *Bloons TD 6*) is a fraction of mainstream mobile TD revenue (public data). |
| M2 | The multi-domain (ground/water/air) + vision/radar layer is a differentiator players *pay* for, not friction they bounce off. | GDD §5 specifies domain × traversal and fog/radar rules in detail (**"Radar sees air, not ground"; "Air units see ground at range"; fog is a continent-level concern**). | **Unvalidated.** No evidence of appetite for this specific depth. |
| M3 | A cross-platform release (mouse *and* single-finger touch, Visuals §8) reaches PC and mobile audiences with one build. | Visuals §8 mandates single-pointer parity, no multi-key combos. | **Design-evidenced, market-unvalidated.** PC TD players expect hotkeys/speed; mobile players expect session-length tuning. One build may satisfy neither fully. |

### 1.2 Audience Assumptions

| # | Assumption | Evidence in sources | Gap / Status |
|---|---|---|---|
| A1 | Players want "deep game, simple hands" — one verb (pick → preview → confirm) over enormous depth (Visuals §8). | Control model fully specified and internally consistent. | **Design-evidenced, player-unvalidated.** No usability testing referenced. |
| A2 | The 81-hero alignment drama (GDD §10–§12) drives retention via narrative. | 81 heroes + rule-generated 9×9 relationship matrix specified (§10.3), regenerable from §10.2 rules. | **Unvalidated as *value*.** GDD §0 explicitly frames the alignment model as a *reasoning stress-test* for the benchmark ("stress-testing large-spec reasoning, esp. the 81-character alignment model in §10–§11") — not proven as a fun feature. |
| A3 | "Earn by beating" (defeat faction → unlock its units, §2.4/§9) is a compelling meta-hook. | Pillar and unlock rule specified ("Beating a faction unlocks its units"). | **Unvalidated.** No engagement data; risks a slow, gated early game. |

### 1.3 Design Assumptions

| # | Assumption | Evidence in sources | Gap / Status |
|---|---|---|---|
| D1 | The "even-baseline" philosophy (every base unit = 100 power points; equal power = equal cost) yields balanced play. | Balance Overview: `Cost_per_power_gold = 3` (Assumptions sheet); all 8 archetypes' point budgets sum to `Total_pts = 100`; Faction_Mods `Avg_x` audited to ≈1.00. | **Internally consistent, dynamically unproven.** Equal *raw* power ≠ balanced *matchups* once the 6×5 matrix, T1–T3 upgrades, and swarms interact. Greenies (Chem) `Avg_x = 0.95` is a **source-flagged deviation** ("Swarm; cheap, many") from the ≈1.00 target — an intentional but unvalidated tilt. |
| D2 | The damage-type × armor-class matrix (§7) yields readable, fair rock-paper-scissors. | Full 6×5 Effectiveness matrix present, with extremes: **Poison vs Organic = 1.8; vs Machinery = 0.1; vs Aircraft = 0.1; vs Structure = 0; vs Energy = 0.** Also **Concussion vs Machinery = 1.7; Electric vs Machinery = 1.8.** | **High variance = high risk.** Poison-signature factions (Dark Energy, Greenies — both listed with Poison signature damage) can be **hard-countered to zero** against Structure/Energy — potential "feels-bad" swings, untested. |
| D3 | Nine asymmetric factions form a healthy counter graph ("none dominant, none dead weight", §9). | Clean 9-node cycle in Factions sheet: each faction's "Beats (counter)" forms a directed cycle (Ground beats Greenies, Air beats Ground, … Greenies beats Dark Energy). | **Structurally clean, dynamically unverified.** A paper cycle doesn't guarantee balanced win-rates once economy, tiers, and terrain compound advantages. |
| D4 | Terrain-as-weapon (walls/moats/traps reroute attackers, §5, §8) creates meaningful decisions. | Traversal + terrain-defense rules fully specified (moats block walkers; walls rout paths; traps/murder holes punish chokes). | **Unvalidated for fun *and* for AI-pathing robustness.** Reroute logic is a determinism and exploit surface. |
| D5 | Frost's design-rule exception (slows all **except air**, but still deals its listed damage to aircraft) reads clearly to players. | DamageTypes/Effectiveness note: "Frost deals its listed damage to Aircraft but applies NO slow to air (design rule)." | **Source-specified, comprehension-unvalidated.** A conditional status rule is an added rules-clarity and edge-case-implementation risk. |

### 1.4 Technology Assumptions

| # | Assumption | Evidence in sources | Gap / Status |
|---|---|---|---|
| T1 | A **deterministic, seed-stable, headless-callable** combat core is achievable and stays deterministic under all features. | GDD §18/§19 require it; Visuals §9 makes replay the acceptance test. | **Specified and self-testing, but genuinely hard.** Determinism across floating-point, multi-domain pathing, and status DoT/chain effects (e.g. Electric chain) is a known engineering hazard. |
| T2 | The balance sim (§17) can *derive* fair prices numerically; two correct builds converge (GDD §0). | Balance model supplies inputs (`Cost_per_power_gold`, archetype budgets, faction mods, effectiveness matrix); GDD §0 states two correct builds should converge on numeric prices. | **Research-grade.** Producing *balanced* prices (not merely *consistent* ones) is unproven; convergence assumes a well-behaved solution space that may not exist under hard counters (D2). |
| T3 | Layered 2.5D "fake 3D" render (stacked sprites, painter's algorithm) reads clearly at scale. | Visuals §1–§7 specify layering rules; §5 adds sun-driven shadows, cloud occlusion, and an effects layer above units. | **Unvalidated at density.** Painter's-order overlap ambiguity grows with unit count; readability at "continent/planet" scale is untested. |

---

## 2. Risk Register

Scored **Likelihood × Impact** (1–5).

| ID | Risk | L | I | Score | Trigger / Evidence |
|---|---|---|---|---|---|
| R1 | Balance sim yields consistent-but-*unbalanced* prices; hard counters (D2) prevent convergence. | 4 | 5 | **20** | T2, D2 |
| R2 | Determinism drift breaks replays and the §19 vertical-slice acceptance test (the headline benchmark). | 3 | 5 | **15** | T1, D4 |
| R3 | Complexity (multi-domain + fog + 9 factions) exceeds target-market tolerance; poor onboarding. | 4 | 4 | **16** | M1, M2, A1 |
| R4 | Poison/zero-effectiveness counters (Poison vs Structure/Energy = 0) produce feels-bad, non-fun swings. | 3 | 4 | **12** | D2 |
| R5 | Alignment/hero system built as benchmark artifact (§10–§11 stress-test), not player value → wasted scope. | 4 | 3 | **12** | A2, §3.1 |
| R6 | Cross-platform "one build" satisfies neither PC nor mobile conventions. | 3 | 3 | **9** | M3 |
| R7 | "Earn by beating" gating produces a slow, unmotivating early game. | 2 | 3 | **6** | A3 |
| R8 | Scope built beyond the §19 vertical slice before the slice itself is proven; the "headline test" slips. | 3 | 4 | **12** | GDD §0, §3.1 |
| R9 | Conditional status rules (Frost-vs-air exception) implemented inconsistently across sim and render, breaking readability/determinism. | 2 | 3 | **6** | D5, T1 |

---

## 3. Cross-Cutting Analysis

### 3.1 The Dual-Mandate Conflict (root risk)
Several features (81-hero alignment matrix, extreme-valued damage matrix, sim-derived pricing) exist *primarily* to stress-test the AI benchmark, not because player evidence demands them. GDD §0 is explicit that **the vertical slice (§19) is "the headline test,"** with the extended tiers existing "for stress-testing large-spec reasoning." This inflates scope and injects the very extremes (Poison = 0 vs Structure/Energy) that jeopardise balance convergence (R1), and it creates a sequencing risk (R8): effort spent on out-of-slice systems before the slice is graded. **The benchmark goals and the shippable-game goals are
