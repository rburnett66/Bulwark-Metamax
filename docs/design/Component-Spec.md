# Component-Spec.md

# Component-Spec.md

**BULWARK — Component Specification**

*Design-stage reference deriving discrete, buildable components from the BULWARK GDD (`bulwark-gdd`), the balance data model (`bulwark-balance-xlsx`), and the visual & controls spec (`bulwark-visuals`). Each component below names its responsibilities, data contract, states, and dependencies. All balance values remain sourced from `bulwark-balance.xlsx` — GDD §18 prohibits hardcoded balance.*

---

## 0. Scope & Conventions

### 0.1 Purpose

This spec decomposes BULWARK into named, independently-implementable components suitable for parallel build-out and independent grading. Per GDD §0, the five subsystems — **vision, base-pathing, structure lifecycle, balance sim, alignment model** — grade independently while sharing **one deterministic core** (the balance sim, GDD §17). The component boundaries below are drawn to preserve that separability: presentation components (C11–C18) must never own balance state, and data components (C1–C4, C9–C10) must never embed rendering assumptions.

### 0.2 Key Definitions

| Term | Definition | Source |
|---|---|---|
| **Component** | A discrete module with a defined data contract and responsibility set. | — |
| **Shape class** | Unit silhouette/atlas category: Troops, Trucks, Tanks, Artillery, Heavy Tanks, Copters, Planes, Missiles. | GDD §6; `Archetypes` |
| **Movement domain** | Walker · Flyer · Swimmer/Floater — governs pathing and vision. | GDD §5–§6 |
| **Armor class** | Organic · Machinery · Aircraft · Structure · Energy. | GDD §7; `Effectiveness` |
| **Damage type** | Kinetic · Fire · Poison · Concussion · Electric · Frost. | GDD §7; `DamageTypes` |
| **Power budget** | Fixed 100-point allocation each base unit spends across HP/DPS/Range/Speed/Utility. | `Overview` / `Archetypes` |
| **Cell legend** | Blue = editable input · Black = formula · Green = cross-sheet pull. | `Overview` |
| **Slice** | The vertical slice (GDD §19) — benchmark deliverable and visual definition of done. | visuals §10 |

### 0.3 Data-Source Authority Rule

Where a component consumes a balance value it MUST read it from the sheet named in that component's **Data Contract**. Balance MUST NOT be hardcoded (GDD §18). Component code MAY read Green (cross-sheet) and Black (formula) outputs but MUST NOT re-derive them — the workbook is the single source of truth for numeric derivation.

---

## 1. Component Inventory

| # | Component | Layer | Primary Source |
|---|---|---|---|
| C1 | Unit Definition & Roster | Data | `Units`, `Archetypes`, GDD §6 |
| C2 | Archetype / Power-Budget Model | Data | `Archetypes`, `Assumptions` |
| C3 | Faction Model & Counter Graph | Data | `Factions`, `Faction_Mods`, GDD §9 |
| C4 | Damage & Effectiveness Matrix | Data | `DamageTypes`, `Effectiveness`, GDD §7 |
| C5 | Structure Definition & Lifecycle | Systems | `Structures`, GDD §8 |
| C6 | Balance Sim (deterministic core) | Systems | GDD §17–§18, `Assumptions` |
| C7 | Vision, Fog & Radar | Systems | GDD §5 |
| C8 | Pathing & Domain Traversal | Systems | GDD §5–§6 |
| C9 | Alignment & Relationship Matrix | Data | GDD §10 |
| C10 | Hero Roster | Data | GDD §11 |
| C11–C17 | Rendering, Sprites, FX, Environment, Camera | Presentation | visuals §1–§7 |
| C18 | Controls & Deploy Loop | Input/UX | visuals §8 |
| C19 | Replay & Battle Log | Systems | visuals §9, GDD §18 |
| C20 | Economy & Progression | Systems | GDD §3–§4, visuals §8 |

---

## 2. Data Components

### C1 — Unit Definition & Roster

**Responsibility:** Represent the full **72-unit roster** (9 factions × 8 shapes) with attributes across tiers T1–T3.

**Data contract (per unit, from `Units`):**

| Field | Type | Cell | Notes |
|---|---|---|---|
| `UnitID`, `Faction`, `Shape`, `Role` | id/enum | Blue | Identity |
| `Domain` | Walker/Flyer/Swimmer/Floater | Blue | Drives C7/C8 |
| `ArmorClass` | 5-enum | Blue | Keys C4 lookup |
| `DamageType` | 6-enum | Blue | Keys C4 lookup |
| `CanTarget` | Ground/Both | Blue | Anti-air = `Both` |
| `Targets` | Base/Structures | Blue | Path-target selector |
| `AoE_r`, `Status`, `Radar-Detect`, `Sees Ground` | mixed | Blue | Utility flags |
| `HP T1/T2/T3`, `DPS T1/T2/T3` | number | Black | Base × `Assumptions` tier multipliers |
| `Range`, `Speed`, `Vision`, `Power` | number | Blue/Black | Power = sum of budget points |
| `Cost T1/T2/T3` | number | Black | `Cost_per_power_gold` × power × tier mult |
| `EffDPS vs Org/Mach/Air` | number | Black | DPS × `Effectiveness` (Green) |

**Key rules:**
- **Basic units path to the base and attack it — not structures.** Only units with `Targets = Structures` (Artillery shape) engage buildings (GDD §6–§7).
- Anti-air is expressed solely via `CanTarget = Both`; it is orthogonal to `DamageType`.

**Dependencies:** C2 (base stats), C3 (faction mods), C4 (effectiveness), C6 (cost derivation).

---

### C2 — Archetype / Power-Budget Model

**Responsibility:** Provide the eight shape archetypes and their fixed **100-point** budgets that seed C1 base stats.

**Data contract (per archetype, `Archetypes`):**

| Field | Cell | Notes |
|---|---|---|
| `Shape`, `Role`, `Default Domain`, `Can Target`, `Targets` | Blue | Archetype identity |
| `HP_pts`, `DPS_pts`, `Range_pts`, `Speed_pts`, `Utility_pts` | Blue | MUST sum to 100 |
| `Base_HP`, `Base_DPS`, … | Black | Points × `Assumptions` scaling constants |

**Invariant:** For every archetype, `Σ(points) = 100`. A validator SHOULD assert this at load; violation is a balance-data defect, not a runtime error.

**Dependencies:** `Assumptions` (scaling constants); consumed by C1.

---

### C3 — Faction Model & Counter Graph

**Responsibility:** Apply per-faction stat modifiers and encode the intended rock-paper-scissors counter relationships across the 9 factions (GDD §9).

**Data contract:** `Faction_Mods` supplies multiplicative deltas per (Faction × stat). The **counter graph** is derived — not authored — from aggregate `EffDPS` matchups in C4, so faction identity emerges from damage/armor distribution rather than hand-tuned win tables.

**Dependencies:** C1, C4.

---

### C4 — Damage & Effectiveness Matrix

**Responsibility:** Own the 6×5 effectiveness lookup (6 damage types × 5 armor classes) driving all combat resolution.

**Data contract:** `Effectiveness` (Black/Green) yields the multiplier `mult[damageType][armorClass]`. C1's `EffDPS` columns and C6's resolution loop both read this table; neither recomputes it.

**Dependencies:** `DamageTypes`; consumed by C1, C3, C6.

---

### C5 — Structure Definition & Lifecycle

**Responsibility:** Define buildable structures and their state machine: `Placing → Building → Active → Damaged → Destroyed`.

**Data contract:** `Structures` supplies HP, build cost, build time, and function tags. Only C1 units with `Targets = Structures` can drive a structure below full HP. Lifecycle **states** map directly to C15 FX cues.

**Dependencies:** C6 (damage application), C15 (FX), C20 (cost gating).

---

## 3. Systems Components (Summary)

- **C6 — Balance Sim:** the single deterministic core. Fixed-timestep, seeded RNG, no float nondeterminism. Consumes C1/C4/C5; emits the event stream that C19 records.
- **C7 — Vision, Fog & Radar:** resolves `Vision`, `Radar-Detect`, `Sees Ground` per domain; flyers and radar units reveal otherwise-hidden targets.
- **C8 — Pathing & Domain Traversal:** routes each unit to its `Targets` destination per movement domain.

## 4. Presentation & UX (Summary)

Presentation components **C11–C17** consume simulation state read-only. **C18 (Controls & Deploy Loop)** is the sole input surface. **C19 (Replay & Battle Log)** replays C6's deterministic event stream — the audit trail proving GDD §18 compliance.

---

## 5. Key Takeaways

1. **The workbook is authoritative.** Every numeric field is Blue/Black/Green; code reads, never re-derives (GDD §18).
2. **Separability is structural, not incidental.** Data (C1–C4), systems (C5–C8), and presentation (C11–C18) are firewalled so each grades independently.
3. **The 100-point invariant is testable.** Validate `Σ(points)=100` per archetype at load to catch balance-data drift early.
4. **Targeting is a hard rule, not a heuristic.** Only `Targets = Structures` units hit buildings; everything else paths to the base.
5. **Determinism is the linchpin.** C6 must be the single fixed-timestep, seeded core; C19's replay is its proof.

---

*Generated by MetaMax Research Brain (LangGraph)*