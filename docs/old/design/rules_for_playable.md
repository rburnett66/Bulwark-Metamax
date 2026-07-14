# Rules for Playable

> The engine's interpretation of the playable prompt — the rule set used to build the game.

**Summary:** A deterministic single-lane tower-defense vertical slice where the Ground/Powder faction fortifies a Castle base with data-driven towers and walls across three build/battle/collect waves against the Greenies (Chem) swarm.

## Flow

1. MENU: entry point with links to deploy, store, inventory, character/heroes, settings, help, and leaderboard
2. CHOOSE LOCATION: select the single continent/biome to deploy into (fog-of-war scouted)
3. CHOOSE GEAR: pick the units and structures to deploy before the first wave
4. PLAY — Build phase: timer paused; spend gold on towers/walls/moats, upgrades, repairs, sells at fixed build slots, then press Ready
5. PLAY — Battle phase: Greenies (Chem) spawn per the wave list, path to the Castle base, towers auto-fire; phase ends when all wave units die (wave cleared) or base HP reaches 0 (defeat)
6. PLAY — Collect: on a cleared wave grant story text + collected gold, then return to Build phase for the next wave (CHOOSE GEAR re-entry between waves)
7. Repeat Build → Battle → Collect for waves 1, 2, 3
8. RESULTS: post-battle summary of bounties and story unlocks after clearing waves (or on defeat)
9. Return to MENU

## Rules

- The deterministic core simulates from (seed, orderedInputs) and must produce identical outcomes on every run (T1).
- The core advances in fixed timesteps (fixed dt) only; no wall-clock or frame-rate dependence is permitted in simulation logic (T2).
- A battle log records seed plus ordered, timestamped inputs; replaying the log reproduces byte-identical outcomes (T3).
- Accessibility/visual options (palette, captions, icons, camera) alter presentation only and never change core state or replay outcomes (T4).
- All unit/structure stats, damage multipliers, and cost values are read from the external balance table keyed to the named sheets; the core reads but never re-derives them (T5).
- The slice is one continent, one lane, with a fixed Castle base at the defensive end and attackers spawning at the far end (F1).
- Each wave runs Build phase → Battle phase → Collect, with distinct Build and Battle screens (F2).
- The slice is exactly 3 waves of Greenies (Chem) attackers versus the Ground/Powder defender (F3).
- During Build phase the simulation timer is paused and the player may spend gold to place structures, upgrade, repair, or sell; pressing Ready begins the wave (F4).
- During Battle phase enemy units spawn per the wave list, path to the base, and attack; the phase ends in a wave-clear when all wave units are dead or in defeat when base HP reaches 0 (F5).
- Win the slice by clearing all 3 waves; lose the slice if base HP ≤ 0 at any point (F6).
- On each cleared wave the player receives story text plus collected gold and returns to Build phase; a lost wave (base destroyed) is not recoverable within the slice (F6).
- The Castle base starts at HP = 2000 (table-tunable) and takes damage from any attacker in contact/range of it (F7).
- Basic enemy units (targets = Base) path to the base and attack it, treating structures as impassable hazards they do not target (U2).
- GRN-Artillery (targets = Structures) targets and attacks defensive structures instead of the base, with AoE r 2 and Stagger (U2, U8).
- Walkers move on ground only and are blocked/rerouted by Walls and Moats; Flyers ignore ground terrain and walls and are affected only by air-capable defenses and radar (U3, P5).
- A unit dies at HP ≤ 0; killing a unit grants a bounty equal to its current-tier Cost (U4).
- Unit movement is tiles/sec = Speed, and attacks resolve continuously at DPS while a valid target is within Range (U5).
- GRN-Troops (Greenies): Walker, Organic, Poison, targets Base — HP 220 (T1), DPS 45 (T1), Range 2.5, Speed 1.84, Vision 5.5 (Units sheet).
- GRN-Tanks (Greenies): Walker, Machinery, Poison, targets Base — HP 440 (T1), DPS 45 (T1), Range 3.75, Speed 0.736 (Units sheet).
- GRN-Artillery (Greenies): Walker, Machinery, Concussion, AoE r 2, Stagger, targets Structures — HP 165 (T1), DPS 60 (T1), Range 10, Speed 0.368 (Units sheet).
- Greenies faction modifiers (HP_x 0.82, DPS_x 0.98, Range_x 0.95, Speed_x 1.05) are already baked into the Units-sheet rows and must not be re-applied by the core (U9, Faction_Mods).
- Every structure follows the lifecycle Placing → Building (build time) → Health & weapon active → Repair → Upgrade (T1→T2→T3) → Damaged → Destroyed → Sell (partial refund) (P2).
- Structures occupy fixed build slots beside the lane; placement costs gold, an available slot, and build time (P3).
- The slice must provide at least one anti-ground kinetic tower (CanTarget Ground), one anti-air tower (CanTarget Both/Air), and one Wall (P6).
- Towers auto-target the nearest valid in-range enemy each tick (P6).
- Walls and Moats block Walker pathing (Walls also reroute), are destructible, and are ignored by Flyers (P5).
- Repair restores HP for gold proportional to missing HP; Sell returns a partial refund of invested gold (P7).
- Cost = Power × Cost_per_power_gold with Cost_per_power_gold = 3, so equal power equals equal cost (E1).
- Upgrades apply HP ×1.6 (T2)/×2.4 (T3), DPS ×1.55 (T2)/×2.3 (T3), and cumulative value ×2.5 (T2)/×5 (T3) as table values (E3).
- Gold sources are kill bounties (slain unit's tier Cost) plus wave-clear reward; gold sinks are build, upgrade, and repair; a running gold balance is shown on both Build and Battle screens (E4).
- The player begins with a fixed opening gold budget sufficient to place at least 2 towers + 1 wall before wave 1 (E5).
- Effective damage = DPS × Effectiveness[DamageType][TargetArmorClass] using the Effectiveness matrix (C1, C2).
- Kinetic effectiveness: Organic 1, Machinery 1, Aircraft 1, Structure 1, Energy 1.1 (Effectiveness sheet).
- Poison effectiveness: Organic 1.8, Machinery 0.1, Aircraft 0.1, Structure 0, Energy 0 (Effectiveness sheet).
- Concussion effectiveness: Organic 0.4, Machinery 1.7, Aircraft 0.9, Structure 1, Energy 0.4 (Effectiveness sheet).

## Controls

- Pointer select on a build slot → open that slot's structure/upgrade choices (single-verb model, P1)
- Pointer pick a structure/upgrade option → stage the selection for confirmation (P1)
- Pointer confirm → commit the build/upgrade/repair/sell, deducting gold and starting build time (P1, P3)
- Pointer on an existing structure → offer Repair, Upgrade (T1→T2→T3), or Sell actions (P2, P7)
- Press Ready → end Build phase and begin the Battle phase for the current wave (F4)
- Single touch (parity with mouse) → identical select/pick/confirm behavior across desktop and touch (P1)
- Presentation toggles (palette, captions, icons, camera) → change display only, never core state or replay (T4)

## Scoring

Gold is accumulated from kill bounties (equal to each slain unit's current-tier Cost) plus wave-clear rewards and spent on build/upgrade/repair; clearing all 3 waves is the win with surviving base HP as the measure of success.

## Assumptions

- Structure build times, tower costs, and specific defensive-emplacement stats are read from the Structures sheet, which was truncated in the provided data; exact tower rows were not fully visible here.
- The exact opening gold budget and per-wave clear reward values are table-tunable but not given numerically in the visible data, so specific amounts are deferred to the table.
- The composition and counts of each of the 3 waves (Vertical_Slice sheet) were not shown, so the exact spawn list per wave is assumed to come from that locked sheet.
- The Fire effectiveness row in the prompt (1.3 / 0.8 / 0.8) is assumed to match the full Effectiveness sheet row (Organic 1.3, Machinery 0.8, Aircraft 0.8, Structure 1.1, Energy 0.8).
- The U6–U8 prompt stats (e.g., GRN-Troops HP 180, Speed 1.93) are treated as superseded by the canonical Units-sheet rows (HP 220, Speed 1.84) per instruction to cite the table over invented numbers.
- CHOOSE LOCATION, STORE, INVENTORY, CHARACTER, HELP, LEADERBOARD, and SETTINGS are treated as menu/meta screens outside the core deterministic simulation and are restated in the prompt's Bulwark theme.
- The 'PLAY → PLAY : CHOOSE GEAR' self-transition is interpreted as the between-wave return to Build/gear selection during the session loop.
- RESULTS is assumed to be reachable both on full clear and on defeat, summarizing bounties and unlocks.
- Only Walls are explicitly required with an anti-ground and anti-air tower; Moats are included as an available blocking structure but are not required minimum content.
- Stagger from Concussion is assumed to briefly disable/stall machinery targets per the DamageTypes design note, though its exact duration is table-defined and not shown.
- Bounty is assumed to be paid at the enemy's current tier Cost; since the 3 slice waves' tiers are unspecified, tier is assumed to be defined per wave in the Vertical_Slice sheet.

## Open questions

- The prompt's U6–U8 unit stats conflict with the canonical Units sheet (e.g., GRN-Troops HP 180 vs 220, Speed 1.93 vs 1.84) — should the core always read the Units sheet as authoritative?
- What are the exact contents of each of the 3 waves (which Greenies units, counts, tiers, spawn timing) from the Vertical_Slice sheet?
- What is the numeric opening gold budget and the per-wave-clear gold reward?
- What are the full Structures-sheet rows (HP, DPS, Range, cost, build time per tier) for the required anti-ground tower, anti-air tower, Wall, and Moat?
- For structures, what fraction of invested gold does Sell refund, and what is the exact gold-per-missing-HP rate for Repair?
- Does


<!-- playable-rules-json — machine-readable rule set; do not edit by hand -->
```json
{
  "summary": "A deterministic single-lane tower-defense vertical slice where the Ground/Powder faction fortifies a Castle base with data-driven towers and walls across three build/battle/collect waves against the Greenies (Chem) swarm.",
  "flow": [
    "MENU: entry point with links to deploy, store, inventory, character/heroes, settings, help, and leaderboard",
    "CHOOSE LOCATION: select the single continent/biome to deploy into (fog-of-war scouted)",
    "CHOOSE GEAR: pick the units and structures to deploy before the first wave",
    "PLAY — Build phase: timer paused; spend gold on towers/walls/moats, upgrades, repairs, sells at fixed build slots, then press Ready",
    "PLAY — Battle phase: Greenies (Chem) spawn per the wave list, path to the Castle base, towers auto-fire; phase ends when all wave units die (wave cleared) or base HP reaches 0 (defeat)",
    "PLAY — Collect: on a cleared wave grant story text + collected gold, then return to Build phase for the next wave (CHOOSE GEAR re-entry between waves)",
    "Repeat Build → Battle → Collect for waves 1, 2, 3",
    "RESULTS: post-battle summary of bounties and story unlocks after clearing waves (or on defeat)",
    "Return to MENU"
  ],
  "rules": [
    "The deterministic core simulates from (seed, orderedInputs) and must produce identical outcomes on every run (T1).",
    "The core advances in fixed timesteps (fixed dt) only; no wall-clock or frame-rate dependence is permitted in simulation logic (T2).",
    "A battle log records seed plus ordered, timestamped inputs; replaying the log reproduces byte-identical outcomes (T3).",
    "Accessibility/visual options (palette, captions, icons, camera) alter presentation only and never change core state or replay outcomes (T4).",
    "All unit/structure stats, damage multipliers, and cost values are read from the external balance table keyed to the named sheets; the core reads but never re-derives them (T5).",
    "The slice is one continent, one lane, with a fixed Castle base at the defensive end and attackers spawning at the far end (F1).",
    "Each wave runs Build phase → Battle phase → Collect, with distinct Build and Battle screens (F2).",
    "The slice is exactly 3 waves of Greenies (Chem) attackers versus the Ground/Powder defender (F3).",
    "During Build phase the simulation timer is paused and the player may spend gold to place structures, upgrade, repair, or sell; pressing Ready begins the wave (F4).",
    "During Battle phase enemy units spawn per the wave list, path to the base, and attack; the phase ends in a wave-clear when all wave units are dead or in defeat when base HP reaches 0 (F5).",
    "Win the slice by clearing all 3 waves; lose the slice if base HP ≤ 0 at any point (F6).",
    "On each cleared wave the player receives story text plus collected gold and returns to Build phase; a lost wave (base destroyed) is not recoverable within the slice (F6).",
    "The Castle base starts at HP = 2000 (table-tunable) and takes damage from any attacker in contact/range of it (F7).",
    "Basic enemy units (targets = Base) path to the base and attack it, treating structures as impassable hazards they do not target (U2).",
    "GRN-Artillery (targets = Structures) targets and attacks defensive structures instead of the base, with AoE r 2 and Stagger (U2, U8).",
    "Walkers move on ground only and are blocked/rerouted by Walls and Moats; Flyers ignore ground terrain and walls and are affected only by air-capable defenses and radar (U3, P5).",
    "A unit dies at HP ≤ 0; killing a unit grants a bounty equal to its current-tier Cost (U4).",
    "Unit movement is tiles/sec = Speed, and attacks resolve continuously at DPS while a valid target is within Range (U5).",
    "GRN-Troops (Greenies): Walker, Organic, Poison, targets Base — HP 220 (T1), DPS 45 (T1), Range 2.5, Speed 1.84, Vision 5.5 (Units sheet).",
    "GRN-Tanks (Greenies): Walker, Machinery, Poison, targets Base — HP 440 (T1), DPS 45 (T1), Range 3.75, Speed 0.736 (Units sheet).",
    "GRN-Artillery (Greenies): Walker, Machinery, Concussion, AoE r 2, Stagger, targets Structures — HP 165 (T1), DPS 60 (T1), Range 10, Speed 0.368 (Units sheet).",
    "Greenies faction modifiers (HP_x 0.82, DPS_x 0.98, Range_x 0.95, Speed_x 1.05) are already baked into the Units-sheet rows and must not be re-applied by the core (U9, Faction_Mods).",
    "Every structure follows the lifecycle Placing → Building (build time) → Health & weapon active → Repair → Upgrade (T1→T2→T3) → Damaged → Destroyed → Sell (partial refund) (P2).",
    "Structures occupy fixed build slots beside the lane; placement costs gold, an available slot, and build time (P3).",
    "The slice must provide at least one anti-ground kinetic tower (CanTarget Ground), one anti-air tower (CanTarget Both/Air), and one Wall (P6).",
    "Towers auto-target the nearest valid in-range enemy each tick (P6).",
    "Walls and Moats block Walker pathing (Walls also reroute), are destructible, and are ignored by Flyers (P5).",
    "Repair restores HP for gold proportional to missing HP; Sell returns a partial refund of invested gold (P7).",
    "Cost = Power × Cost_per_power_gold with Cost_per_power_gold = 3, so equal power equals equal cost (E1).",
    "Upgrades apply HP ×1.6 (T2)/×2.4 (T3), DPS ×1.55 (T2)/×2.3 (T3), and cumulative value ×2.5 (T2)/×5 (T3) as table values (E3).",
    "Gold sources are kill bounties (slain unit's tier Cost) plus wave-clear reward; gold sinks are build, upgrade, and repair; a running gold balance is shown on both Build and Battle screens (E4).",
    "The player begins with a fixed opening gold budget sufficient to place at least 2 towers + 1 wall before wave 1 (E5).",
    "Effective damage = DPS × Effectiveness[DamageType][TargetArmorClass] using the Effectiveness matrix (C1, C2).",
    "Kinetic effectiveness: Organic 1, Machinery 1, Aircraft 1, Structure 1, Energy 1.1 (Effectiveness sheet).",
    "Poison effectiveness: Organic 1.8, Machinery 0.1, Aircraft 0.1, Structure 0, Energy 0 (Effectiveness sheet).",
    "Concussion effectiveness: Organic 0.4, Machinery 1.7, Aircraft 0.9, Structure 1, Energy 0.4 (Effectiveness sheet)."
  ],
  "controls": [
    "Pointer select on a build slot → open that slot's structure/upgrade choices (single-verb model, P1)",
    "Pointer pick a structure/upgrade option → stage the selection for confirmation (P1)",
    "Pointer confirm → commit the build/upgrade/repair/sell, deducting gold and starting build time (P1, P3)",
    "Pointer on an existing structure → offer Repair, Upgrade (T1→T2→T3), or Sell actions (P2, P7)",
    "Press Ready → end Build phase and begin the Battle phase for the current wave (F4)",
    "Single touch (parity with mouse) → identical select/pick/confirm behavior across desktop and touch (P1)",
    "Presentation toggles (palette, captions, icons, camera) → change display only, never core state or replay (T4)"
  ],
  "scoring": "Gold is accumulated from kill bounties (equal to each slain unit's current-tier Cost) plus wave-clear rewards and spent on build/upgrade/repair; clearing all 3 waves is the win with surviving base HP as the measure of success.",
  "assumptions": [
    "Structure build times, tower costs, and specific defensive-emplacement stats are read from the Structures sheet, which was truncated in the provided data; exact tower rows were not fully visible here.",
    "The exact opening gold budget and per-wave clear reward values are table-tunable but not given numerically in the visible data, so specific amounts are deferred to the table.",
    "The composition and counts of each of the 3 waves (Vertical_Slice sheet) were not shown, so the exact spawn list per wave is assumed to come from that locked sheet.",
    "The Fire effectiveness row in the prompt (1.3 / 0.8 / 0.8) is assumed to match the full Effectiveness sheet row (Organic 1.3, Machinery 0.8, Aircraft 0.8, Structure 1.1, Energy 0.8).",
    "The U6–U8 prompt stats (e.g., GRN-Troops HP 180, Speed 1.93) are treated as superseded by the canonical Units-sheet rows (HP 220, Speed 1.84) per instruction to cite the table over invented numbers.",
    "CHOOSE LOCATION, STORE, INVENTORY, CHARACTER, HELP, LEADERBOARD, and SETTINGS are treated as menu/meta screens outside the core deterministic simulation and are restated in the prompt's Bulwark theme.",
    "The 'PLAY → PLAY : CHOOSE GEAR' self-transition is interpreted as the between-wave return to Build/gear selection during the session loop.",
    "RESULTS is assumed to be reachable both on full clear and on defeat, summarizing bounties and unlocks.",
    "Only Walls are explicitly required with an anti-ground and anti-air tower; Moats are included as an available blocking structure but are not required minimum content.",
    "Stagger from Concussion is assumed to briefly disable/stall machinery targets per the DamageTypes design note, though its exact duration is table-defined and not shown.",
    "Bounty is assumed to be paid at the enemy's current tier Cost; since the 3 slice waves' tiers are unspecified, tier is assumed to be defined per wave in the Vertical_Slice sheet."
  ],
  "questions": [
    "The prompt's U6–U8 unit stats conflict with the canonical Units sheet (e.g., GRN-Troops HP 180 vs 220, Speed 1.93 vs 1.84) — should the core always read the Units sheet as authoritative?",
    "What are the exact contents of each of the 3 waves (which Greenies units, counts, tiers, spawn timing) from the Vertical_Slice sheet?",
    "What is the numeric opening gold budget and the per-wave-clear gold reward?",
    "What are the full Structures-sheet rows (HP, DPS, Range, cost, build time per tier) for the required anti-ground tower, anti-air tower, Wall, and Moat?",
    "For structures, what fraction of invested gold does Sell refund, and what is the exact gold-per-missing-HP rate for Repair?",
    "Does"
  ]
}
```
