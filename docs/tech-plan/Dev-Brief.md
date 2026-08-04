# Dev Brief — Bulwark MM

_Tech-Plan deliverable · generated 2026-07-02T17:15:41.427Z_
_Source documents: Component-Spec, Feature-System-Opportunities, Platform-Technology-Considerations_

## Architecture summary

BULWARK is a web-first, browser-native multi-faction, multi-domain tower defense built on a deterministic headless-callable balance simulation with all balance data externalized to bulwark-balance.xlsx (no hardcoded values). The architecture separates five independently-gradable subsystems (vision, base-pathing, structure lifecycle, balance sim, alignment model) sharing one deterministic core, with a strict boundary between data components and layered 2.5D presentation components. The vertical slice (GDD §19) is the headline deliverable and definition of done.

## Development tasks (20)

| Priority | Type | Title | Points | Description | Source |
| --- | --- | --- | --- | --- | --- |
| p0 | chore | Set up web-native project scaffold & build pipeline | 5 | Establish the browser-first project structure, build tooling, and 2.5D layered sprite rendering foundation to enable parallel component development. | Platform-Technology-Considerations |
| p0 | feature | Build balance workbook data loader | 8 | Implement loading and parsing of bulwark-balance.xlsx sheets (Archetypes, Faction_Mods, Effectiveness, DamageTypes, Units, Assumptions) as the single source of truth. Must read Green/Black outputs without re-deriving formulas per GDD §18. | Platform-Technology-Considerations |
| p0 | feature | Implement deterministic balance simulation core | 13 | Build the headless-callable, deterministic balance sim that all subsystems share, providing the convergence property described in GDD §0/§17. Core must be independently testable and grade separately. | Component-Spec |
| p1 | feature | Implement 100-point power budget & cost derivation | 5 | Build the archetype power-budget allocation (HP/DPS/Range/Speed/Utility) and derive unit cost from power using Assumptions constants (e.g. Cost_per_power_gold=3, HP_per_point=10). | Platform-Technology-Considerations |
| p1 | feature | Implement 6x5 effectiveness matrix system | 3 | Build damage-type vs armor-class effectiveness resolution from the Effectiveness sheet, covering 6 damage types and 5 armor classes for combat calculations. | Platform-Technology-Considerations |
| p1 | feature | Implement damage types & status effects | 5 | Build the 6 damage types (Kinetic, Fire, Poison, Concussion, Electric, Frost) and associated status effects from the DamageTypes sheet. | Component-Spec |
| p1 | feature | Implement 9-faction net-neutral modifier system | 5 | Build faction modifier tilts from Faction_Mods sheet ensuring net-neutral balance (Avg_x approx 1.00) applied to unit stats. | Platform-Technology-Considerations |
| p1 | feature | Implement 72-unit roster with T1-T3 stats | 5 | Load and instantiate the full 72-unit roster with tier stats and derived cost from the Units sheet, mapped to shape classes and movement/armor domains. | Platform-Technology-Considerations |
| p1 | feature | Implement base-pathing subsystem | 8 | Build pathing across Walker/Flyer/Swimmer-Floater movement domains where basic units path to and attack the base (not structures), and only flagged units target structures per GDD §6-§7. | Feature-System-Opportunities |
| p1 | feature | Implement vision rules subsystem | 5 | Build the vision system governed by movement domains, gradeable independently from other subsystems per GDD §0. | Component-Spec |
| p1 | feature | Implement structure lifecycle subsystem | 8 | Build the structure lifecycle (placement, upgrade, destruction) as an independently-gradable subsystem, keeping balance state out of presentation. | Component-Spec |
| p2 | feature | Implement 81-character alignment matrix model | 8 | Build the alignment/drama model as an 81-character matrix regenerable from GDD §10.2 rules without contradiction, gradeable independently. | Feature-System-Opportunities |
| p2 | feature | Implement 9-node counter graph | 3 | Build the counter relationship graph (9 nodes) that expresses unit/shape-class counters for the systems-literate audience per GDD §9. | Feature-System-Opportunities |
| p1 | feature | Build 2.5D layered sprite rendering system | 8 | Implement the fake-3D presentation via stacked 2D sprites for shape-class silhouettes/atlases, with presentation components owning no balance state. | Platform-Technology-Considerations |
| p2 | feature | Implement one-finger/touch control scheme | 5 | Build the trivial-input control scheme ('deep game, simple hands') supporting touch and one-finger play per Visuals §8. | Feature-System-Opportunities |
| p2 | feature | Implement deterministic replay system | 5 | Build replay capability leveraging the deterministic core, allowing playback and verification of simulation runs per Visuals spec. | Platform-Technology-Considerations |
| p1 | feature | Implement Scout-Fortify-Defend-Collect-Upgrade loop | 8 | Build the core session gameplay loop tying together pathing, structures, combat, and progression. | Platform-Technology-Considerations |
| p1 | feature | Build vertical slice benchmark deliverable | 13 | Assemble the fixed-scope vertical slice (GDD §19) as the headline deliverable and visual definition of done, integrating all subsystems. | Feature-System-Opportunities |
| p2 | feature | Build independent subsystem grading harness | 8 | Implement the grading harness (GDD §19-§20) that grades vision, base-pathing, structure lifecycle, balance sim, and alignment model independently. | Feature-System-Opportunities |
| p2 | spike | Validate sim determinism & convergence | 5 | Spike to verify the balance sim converges to a single deterministic result across headless and rendered runs, resolving determinism risks noted in the tech doc. | Platform-Technology-Considerations |
