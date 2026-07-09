# Feature & System Opportunities — BULWARK

*IDEA-stage research document. Every feature claim is grounded in the BULWARK GDD (v2.0), the balance workbook (`bulwark-balance.xlsx` v1), and the Visual & Controls Spec (v1.0). Tower-defense (TD) / hybrid-strategy market comparisons are drawn from published external evidence and flagged **[market — assumption]** where they rest on general genre knowledge rather than sourced facts. The stated concept — a "multi-faction, multi-domain tower defense with an automated balance sim" (GDD §1) — is authoritative.*

> **Source-change note (this revision).** This pass re-anchors every feature claim against the current source files, with particular attention to the GDD (v2.0). Key GDD alignments confirmed and folded in below: the **dual-use benchmark framing** where the *vertical slice (§19) is the headline deliverable* and everything else is either its world or its grading harness (GDD §0); the **separable-subsystems** grading model (vision rules, base-pathing, structure lifecycle, balance sim, alignment model grade independently, GDD §0); the **one-deterministic-core** convergence property of the balance sim (GDD §0, §17); the **basic-unit base-pathing rule** — basic units path to and attack the *base*, not structures, and only flagged units target structures (GDD §6–§7); and the **alignment model's regenerability** requirement — an 81-character matrix that must be regenerable from the §10.2 rules without contradiction (GDD §10). These are now reflected in cluster scoping, sequencing, and risk.

---

## 0. Connection to Prior Findings

- **Market positioning (pending Market Validation doc):** BULWARK is a premium/benchmark-grade, single-player-first TD with deep systems ("simple front, deep back," GDD §2 pillar 5). Features below are prioritized against that positioning, *not* a live-service F2P norm.
- **Audience (pending Audience doc):** the design targets a *systems-literate* strategy player (data-driven balance §17–18; a 9-node counter graph §9; an 81-character alignment matrix §10) while keeping input trivial (Visuals §8, "deep game, simple hands"). Features are therefore rated against a dual audience: depth-seekers **and** one-finger/touch players.
- **Benchmark framing (GDD §0):** the authoritative deliverable is the **vertical slice (§19)** — a fixed, gradeable scope. Everything above §19 is the world it lives in; §19–§20 is how it grades. Two properties make it a benchmark, not just a big prompt: **separable subsystems** (partial completion is measurable) and **one deterministic core** (the balance sim yields numeric prices; two correct builds converge). Feature prioritization below treats slice-relevant subsystems as first-order and stress-test scope (esp. the alignment model) as separable.

---

## 1. High-Value Feature Clusters

Each cluster is rated on **Player Demand**, **Differentiation**, and **Goal Alignment** (Low / Med / High). Ratings are the researcher's judgement against the sources, with reasoning stated so it can be challenged.

| # | Cluster | Core sources | Demand | Differentiation | Alignment |
|---|---|---|---|---|---|
| A | Multi-domain combat (ground/water/air) + radar/vision/fog | GDD §1, §5–6 | Med–High | **High** | **High** (pillar 1) |
| B | Asymmetric-faction counter system (9 factions, directed graph) | GDD §9; Factions sheet | **High** | **High** | **High** (pillars 3–4) |
| C | Data-driven balance sim & determinism | GDD §0, §17–18; Visuals §9 | Low (invisible) | **High** (rare) | **High** (pillar 6) |
| D | "Earn by beating" unlock progression | GDD §2 pillar 4, §3, §9 | **High** | Med–High | **High** |
| E | Terrain-as-weapon fort building & base-pathing | GDD §5, §6–§8; Visuals §5 | **High** | Med | **High** (pillar 2) |
| F | Layered 2.5D "fake-3D" + rotatable camera | Visuals §1–7 | Med | **High** | **High** |
| G | Readable-combat telegraphing (sensor→lock→shot) | Visuals §2, §4 | Med | **High** | **High** (pillar 5) |
| H | Scale ramp (path→castle→kingdom→continent→planet) | GDD §1, §4 | Med | Med–High | **High** (pillar 5) |
| I | Night battles / lighting as second fog layer | GDD §3, §5, §9 | Med | **High** | Med–High |
| J | 81-hero alignment system + cross-faction drama | GDD §10–§12 | Med | **High** | Med (content risk) |
| K | Damage-type × armor-class matrix (6×5) + status | GDD §7; DamageTypes/Effectiveness | **High** | Med–High | **High** |
| L | Replay / battle-log system | Visuals §9; GDD §18–19 | Low–Med | Med | **High** (doubles as sim test) |

**Rating logic.** Clusters **A, B, K** are the mechanical spine — the source of "matchup texture on top of even raw power" (balance Overview) and where BULWARK is most defensible. Cluster **C** has near-zero surface demand but is the *headline benchmark deliverable* (GDD §0) and underpins fairness. Cluster **E** now explicitly carries the **base-pathing rule** (GDD §6–§7): basic units path to and attack the base, treating structures as hazards, while only flagged units (`Targets = Structures`, e.g. Artillery-shape units in the Units sheet) target buildings — a separable, gradeable subsystem in the §0 sense. Cluster **J** carries the highest content-per-value risk (81 hand-authored characters) and is explicitly framed in the GDD as a *consistency stress test* whose matrix must be **regenerable from the §10.2 rules without contradiction** (GDD §10), not a proven fun driver.

---

## 2. Detailed Feature Opportunities

### 2.1 Multi-Domain Combat with Radar/Vision/Fog (Cluster A)

**What it is.** Combat spans ground, water (surface + sub-surface), and air, each with distinct pathing, visibility, and defense (GDD §5). Walkers are blocked by water/walls/moats; floaters ride the surface; swimmers use sub-surface (harder to hit, limited vision); flyers ignore ground terrain and walls, bounded only by air defense and radar. Vision is asymmetric: **radar sees air but not ground; air units see ground at range; fog is a continent-level, scouting-driven concern.**

**Why it matters.** Targeting is genuinely constrained ("a pure AA gun can't hit swimmers," GDD §7), so placement and scouting become real decisions rather than a single-lane damage race — the exact texture a systems-literate audience seeks. Per GDD §0, **vision rules grade as a separable subsystem**, so this cluster is directly benchmarkable in isolation.

**Differentiation.** Air/ground splits are established in the TD lineage **[market — assumption]**; BULWARK's edge is the *combination* — three domains **plus** radar-vs-vision asymmetry **plus** sub-surface stealth — under one rule set that "scales to planets with no new rules" (GDD §2 pillar 5).

**Complexity/risk (High).** Needs per-domain pathing, a targeting-eligibility system keyed to the Units-sheet flags (`Can Target` = Ground/Air/Both; `Sees Ground`; `Radar-Detect`), and fog resolution. Chief risk is the "why can't my unit hit that?" readability failure — mitigated by telegraphing (§2.3).

**Synergies.** Feeds E (terrain reroutes walkers, not flyers; base-pathing), I (night as a second fog layer), and G (domain state made visible via sensor cues).

### 2.2 Asymmetric-Faction Counter System (Cluster B)

**What it is.** Nine factions form a directed counter graph (GDD §9), each with distinct signature damage type and armor/domain theme from the balance workbook (Factions and Faction_Mods sheets — e.g. Ground/Powder beats Greenies via Kinetic; Air beats Ground/Powder; the graph is a single directed 9-node cycle with none dominant). The 6×5 DamageTypes × Effectiveness matrix (Cluster K) provides the per-unit texture beneath the faction-level graph.

**Why it matters.** This is the highest-demand cluster: faction identity plus rock-paper-scissors depth is the primary replay driver and the strongest word-of-mouth hook. It converts the balance sim (C) from invisible infrastructure into visible strategic meaning.

**Complexity/risk (High).** Nine asymmetric factions is a large tuning surface, kept honest by the balance philosophy that faction modifiers are **mild, net-neutral tilts (avg multiplier ≈1.00** — flavor, not advantage; balance Overview and Faction_Mods `Avg_x`). The sim (C) is the mitigation — no faction should be dominant across the graph, and the workbook must enforce this automatically (Balance_Check audit) rather than by hand-tuning.

### 2.3 Readable-Combat Telegraphing (Cluster G)

**What it is.** A three-part shot pipeline — sensor detection → weapon lock → fired shot (Visuals §2, §4) — makes every engagement legible without text.

**Why it matters.** It is the load-bearing bridge between "deep back" and "simple front" (pillar 5). It directly de-risks A and K by *showing* eligibility and matchup outcomes visually. This is the single highest-leverage readability investment in the project.

### 2.4 "Earn by Beating" Progression (Cluster D)

**What it is.** Defeating a faction unlocks its units (GDD §2 pillar 4, §3, §9). Progression and the counter graph are the same system, so unlock order is meaningful rather than a grind gate.

**Why it matters.** High demand, tight goal alignment, and low added content cost — it reuses B's assets. Its risk is a difficulty/order lock; the sim (C) should validate that no faction is a mandatory-first bottleneck.

### 2.5 Terrain-as-Weapon Fort Building & Base-Pathing (Cluster E)

**What it is.** Walls & natural terrain **rout attack paths**, moats block walkers, and traps/murder holes punish wall chokepoints (GDD §5, §8). This sits on top of the GDD's core targeting rule: **basic units path to the base and attack the base, not structures** (GDD §6); attackers "treat structures as hazards unless flagged" (GDD §7). Only units flagged `Targets = Structures` (the Artillery shape in the Units sheet) siege buildings.

**Why it matters.** The base-pathing rule is what makes terrain a *weapon* — rerouting the path is meaningful only because attackers commit to reaching the base. Per GDD §0, **base-pathing and structure lifecycle grade as separable subsystems**, so this cluster is independently benchmarkable and a natural early build target.

**Complexity/risk (Med).** Requires the universal structure lifecycle (Placement → Health/weapon → Repair → Upgrade T1-2-3 → Damage/destroy → Sell, GDD §8) plus pathfinding that re-routes around walls/moats while honoring the base
