{
  "title": "BULWARK — Vertical Slice (Concern-Routed Design Model)",
  "map": [
    {
      "text": "One map: a single ground lane beside a single water lane, ending at the player base in a clearing; same board as the §17 balance harness.",
      "concern": "behavioral",
      "refs": [
        "§17",
        "§19.1"
      ]
    },
    {
      "text": "Wall/moat terrain piece reroutes walkers (visible path change); walls & natural terrain rout attack paths; moats block walkers; traps/murder holes punish chokepoints.",
      "concern": "behavioral",
      "refs": [
        "§5",
        "§8",
        "§19.1"
      ]
    },
    {
      "text": "Surfaces: water incl. sub-surface, ground low/mid/high, grass & bushes, trees, clouds, fog.",
      "concern": "shared",
      "refs": [
        "§5"
      ]
    },
    {
      "text": "One biome rendered with documented faction/biome palette (ground, shadows, units, effects, clouds, fog, score UI); reskin is a table change.",
      "concern": "presentational",
      "refs": [
        "§15",
        "§19.1"
      ]
    },
    {
      "text": "Water renders surface layer plus sub-surface tint so swimmers read submerged vs. floaters on top; simple shader, no transparency/reflection; ripples and noisy particle wake on movement.",
      "concern": "presentational",
      "refs": [
        "visuals §6"
      ]
    },
    {
      "text": "Base hard points: fixed structure slots on the base; slot count scales with player level (progression reward).",
      "concern": "behavioral",
      "refs": [
        "visuals §8",
        "Menu-System §4"
      ]
    },
    {
      "text": "Scale tiers reuse the same rules: path → field → river/coast → mountain → castle → kingdom → continent → planet → PvP/co-op.",
      "concern": "behavioral",
      "refs": [
        "§4"
      ]
    },
    {
      "text": "Fog of war is a continent-level concern; reveal is scouting-driven, not free.",
      "concern": "behavioral",
      "refs": [
        "§5"
      ]
    },
    {
      "text": "Bench mode: isolated single-unit scene — compose the unit, drive its states, inspect under the camera; the M1 gating slice",
      "concern": "shared",
      "refs": [
        "§5"
      ]
    },
    {
      "text": "Field mode: many units on the map under the real sim + shared camera — roster in play, real combat, readability across the whole field",
      "concern": "shared",
      "refs": [
        "§5"
      ]
    },
    {
      "text": "Camera preview positions: top / left / right / centre for parallax/skew validation",
      "concern": "presentational",
      "refs": [
        "§8"
      ]
    },
    {
      "text": "Early milestones allow dropping extra units into a scene to validate cross-unit readability and overlapping camera/shadow before roster scale-up",
      "concern": "shared",
      "refs": [
        "§5"
      ]
    }
  ],
  "entities": [
    {
      "text": "Player base with HP; basic attackers target it; base HP → 0 = lose.",
      "concern": "shared",
      "refs": [
        "§19.1"
      ]
    },
    {
      "text": "Three slice attackers (Ground/Powder faction): walker (ground lane), floater/swimmer (water lane), flyer (ignores terrain); each has kind + position engine-owned, renderer-read.",
      "concern": "shared",
      "refs": [
        "§9",
        "§19.1"
      ]
    },
    {
      "text": "Three slice defenses: anti-ground tower, anti-air tower, wall/moat terrain piece.",
      "concern": "shared",
      "refs": [
        "§19.1"
      ]
    },
    {
      "text": "Unit attributes: domain, health, dps (derived by sim), cost (from DPS), vision/radarSignature, targetsBase flag; each unit declares what it sees (ground/air/both) and range.",
      "concern": "behavioral",
      "refs": [
        "§6"
      ]
    },
    {
      "text": "Unit shape classes (silhouette/atlas): Troops, Trucks, Tanks, Artillery, Heavy Tanks, Copters, Planes, Missiles.",
      "concern": "shared",
      "refs": [
        "§6"
      ]
    },
    {
      "text": "Full structure set: Blacksmith, Armory, Barracks, Stables, Science Lab, Balloons, Runway, Walls, Moats, Traps, Murder Holes.",
      "concern": "shared",
      "refs": [
        "§8"
      ]
    },
    {
      "text": "Nine asymmetric factions (Ground/Powder, Air, High Tech, Artillery, Water, Arcane/Energy, Space Tech, Dark Energy, Greenies) as data with directed 9-node counter graph; none dominant, none dead weight.",
      "concern": "behavioral",
      "refs": [
        "§9"
      ]
    },
    {
      "text": "Alignment model: 9 alignments (AG PG G CG N CE E PE DE), two hidden axes (polarity, conviction T0–T3), generating rules regenerate the symmetric 9×9 relationship matrix (++/+/0/−/−−).",
      "concern": "behavioral",
      "refs": [
        "§10"
      ]
    },
    {
      "text": "81 heroes: one per alignment per faction, each with name + motivation; drama threads [DL][TA][RE][RV][TW][FL] stored as directed asymmetric relationships layered above the symmetric alignment matrix.",
      "concern": "shared",
      "refs": [
        "§11",
        "§12"
      ]
    },
    {
      "text": "Level = Biome + Map + 8 characters (conversations & tips) + Boss; Map = pathing (water/ground/air) + biome + base placement options.",
      "concern": "shared",
      "refs": [
        "§14"
      ]
    },
    {
      "text": "Unit: data-driven schema, one UNITS entry per unit; roster = N entries (full roster = 72 units)",
      "concern": "shared",
      "refs": [
        "§5"
      ]
    },
    {
      "text": "Portable unit definition: UNITS stats + part-stack (base/weapon/head sprite refs + sizing + pivots), same format the engine loads, spawns, and plays",
      "concern": "shared",
      "refs": [
        "§6"
      ]
    },
    {
      "text": "Unit part-stack: base, weapon, head sprites at chosen sizes with pivots",
      "concern": "shared",
      "refs": [
        "§6",
        "§8"
      ]
    },
    {
      "text": "Data registry: engine reads unit definitions from a registry (not only hardcoded UNITS); Harness writes/updates definitions, engine picks them up",
      "concern": "shared",
      "refs": [
        "§6"
      ]
    },
    {
      "text": "Unit stats drive combat in the shared sim",
      "concern": "behavioral",
      "refs": [
        "§6"
      ]
    },
    {
      "text": "Unit kind/position/state owned by the sim, read identically at bench and field scales (per-unit readout identical)",
      "concern": "shared",
      "refs": [
        "§5"
      ]
    },
    {
      "text": "Domain variants: walker (M1), floater and flyer (M2)",
      "concern": "shared",
      "refs": [
        "§7"
      ]
    },
    {
      "text": "Balance/data companions: bulwark-balance-xlsx.md, values preloaded at runtime as config.data.tables (schema in table catalog)",
      "concern": "shared",
      "refs": [
        "§bal"
      ]
    }
  ],
  "mechanics": [
    {
      "text": "Basic units path to base and attack the base, not structures; structures treated as hazards; only units flagged Targets=Structures engage buildings.",
      "concern": "behavioral",
      "refs": [
        "§6",
        "§7",
        "§19.1"
      ]
    },
    {
      "text": "Domain traversal: walkers ground-only, blocked by water/walls/moats; swimmers/floaters use water lanes (swimmers sub-surface: harder to hit, limited vision); flyers ignore ground terrain and walls, limited only by air defense and radar.",
      "concern": "behavioral",
      "refs": [
        "§5",
        "§6"
      ]
    },
    {
      "text": "Vision rules: radar sees air not ground; air units see ground at range; implemented or explicitly stubbed in slice. Night adds a lighting layer over fog; some factions (Dark Energy, Space Tech) partly ignore it; night changes faction strategies.",
      "concern": "behavioral",
      "refs": [
        "§3",
        "§5",
        "§19.1"
      ]
    },
    {
      "text": "Universal structure lifecycle: placement (space + cost + build time) → health & weapon → repair → upgrade (slice: one tier; full: tiers 1-2-3) → damage/destroy → sell (partial refund). Repairs are free but repair troops are not; repairs take time and a troop travel-to-structure time.",
      "concern": "behavioral",
      "refs": [
        "§8",
        "§19.1",
        "visuals §5"
      ]
    },
    {
      "text": "Real-time economy: money accrues and is spent live in battle; income from wave-clear bounties, kills, captures (later idle harvest/grow); spend on build/repair/upgrade/deploy; bankruptcy possible; real-time mid-battle upgrades if affordable.",
      "concern": "behavioral",
      "refs": [
        "§13",
        "§19.1"
      ]
    },
    {
      "text": "Units repair OR attack — a live resource choice, never both.",
      "concern": "behavioral",
      "refs": [
        "§13"
      ]
    },
    {
      "text": "Win/lose: survive N waves = win; base HP → 0 = lose; each cleared wave grants story; cadence Scout → Fortify → Defend → Collect → Upgrade → Story.",
      "concern": "behavioral",
      "refs": [
        "§3",
        "§14",
        "§19.1"
      ]
    },
    {
      "text": "Damage types (Kinetic, Fire burn DoT, Poison DoT organics-only, Concussion vs machinery + stagger, Electric chains/disables machines, Frost slows all except air) × armor classes (Organic, Machinery, Aircraft, Structure, Energy) as a data-driven 6×5 multiplier matrix; AoE and anti-air are orthogonal columns; weapons declare targetable domains; chem lingers on ground, energy arcs on water.",
      "concern": "behavioral",
      "refs": [
        "§7"
      ]
    },
    {
      "text": "Weapon coverage: projectile, ballistic arcs, hitscan/energy, guided missiles, area/splash, chem/DoT; damage resolves vs. unit and structure health alike.",
      "concern": "behavioral",
      "refs": [
        "§7"
      ]
    },
    {
      "text": "Targeting: sensor acquires target first (sticky-then-reacquire), then weapon rotates with lock-on wind-up whose duration equals time-to-fire; only after lock does the projectile launch.",
      "concern": "behavioral",
      "refs": [
        "visuals §2.1",
        "Harness §2"
      ]
    },
    {
      "text": "Deploy loop: troops always deploy from the player's base and path/march to the chosen drop location (destination order, not spawn point); structures snap to base hard-point slots; placement invalid by space, terrain, or cost.",
      "concern": "behavioral",
      "refs": [
        "visuals §8",
        "Menu-System §4"
      ]
    },
    {
      "text": "Determinism: sim core separated from rendering, runs headless, seed-stable identical replay; battle log stream (inputs + seed + events) reconstructs replays exactly — replay is the determinism acceptance test.",
      "concern": "behavioral",
      "refs": [
        "§18",
        "§19.1",
        "visuals §9"
      ]
    },
    {
      "text": "Balance sim: unit price = average effective DPS across 100 automated headless battles on the fixed ground+water lane harness with a standard defense set at fixed positions; prices stabilize over 100 runs and across seeds within tolerance.",
      "concern": "behavioral",
      "refs": [
        "§17"
      ]
    },
    {
      "text": "All units/structures/factions/palettes/alignments are data-driven tables (bulwark-balance.xlsx canonical); no hardcoded balance; no external services.",
      "concern": "behavioral",
      "refs": [
        "§7",
        "§18"
      ]
    },
    {
      "text": "Defeating a faction unlocks its units; per-continent arc: outpost in clearing → scout/defend → wave series → story per victory → repair/upgrade between waves; endgame PvE → PvP → co-op (base-vs-field roles) → idle farming & protection.",
      "concern": "behavioral",
      "refs": [
        "§9",
        "§14"
      ]
    },
    {
      "text": "Deterministic sim: seed + fixed dt; replay-safe and balance-checkable; dropped units run on the same sim",
      "concern": "behavioral",
      "refs": [
        "§6"
      ]
    },
    {
      "text": "Seven unit states: idle, movement, acquire, attack, take-damage, heal, death — driven off the deterministic sim",
      "concern": "behavioral",
      "refs": [
        "§7",
        "§8"
      ]
    },
    {
      "text": "Real combat in field mode: units acquire and attack each other; units spawn, move, acquire, attack, and die",
      "concern": "behavioral",
      "refs": [
        "§5",
        "§8"
      ]
    },
    {
      "text": "Same sim serves both scales: one unit isolated (bench) and full deterministic multi-unit sim (field) with no re-architecture",
      "concern": "behavioral",
      "refs": [
        "§5"
      ]
    },
    {
      "text": "Floater and flyer locomotion swaps (M2)",
      "concern": "behavioral",
      "refs": [
        "§7"
      ]
    },
    {
      "text": "Drop flow: author in Harness → write definition + asset refs to registry → unit spawns in live game and moves, acquires, attacks, dies with authored part-stack + stats — no re-authoring, no engine code change",
      "concern": "shared",
      "refs": [
        "§6",
        "§7"
      ]
    },
    {
      "text": "Registry loading is the one structural engine change; lands in M1 as it shapes the data model",
      "concern": "shared",
      "refs": [
        "§6"
      ]
    },
    {
      "text": "One authoring pipeline: author/tune one unit (bench) up to roster library, batch, and export to UNITS (field); M3 adds save/load definitions, sprite-library browser, roster batch, full drop/export pipeline",
      "concern": "shared",
      "refs": [
        "§5",
        "§7"
      ]
    },
    {
      "text": "M1 gate: one walker through full pipeline — compose → drive all seven states → camera preview with parallax + silhouette shadow → drop into live engine and play",
      "concern": "shared",
      "refs": [
        "§7"
      ]
    },
    {
      "text": "Same unit dropped into the game behaves identically: one state, one sim",
      "concern": "behavioral",
      "refs": [
        "§8"
      ]
    }
  ],
  "visual_layers": [
    {
      "text": "Layered 2.5D: stacked 2D surfaces sorted back-to-front (painter's algorithm); canonical 14-layer z-order: sky, water (surface + sub-surface tint), ground bands, ground shadows, grass/bushes, trees, ground units, structures, projectiles/ground FX, air units + altitude shadows, clouds, muzzle/impact FX, fog of war, screen-space HUD (never rotates).",
      "concern": "presentational",
      "refs": [
        "visuals §1"
      ]
    },
    {
      "text": "Four-layer unit sprite stack (legs/locomotion, body, weapon rotating to target with muzzle flash, head/sensors telegraphing acquisition); air shapes swap legs for rotor/thrust; animation states Idle · Moving · Attacking · Death; depth-sorted by ground anchor (screen-projected Y) re-sorted every frame.",
      "concern": "presentational",
      "refs": [
        "visuals §2",
        "§16"
      ]
    },
    {
      "text": "Shadows: simple soft shadows for every ground unit/structure/tree, offset by global sun direction (configurable); air units cast dim offset altitude shadow — farther/fainter = higher; turret shadow rotates with aim.",
      "concern": "presentational",
      "refs": [
        "§5",
        "§16",
        "visuals §3",
        "Harness §3"
      ]
    },
    {
      "text": "Dirt/dust trails under moving units, intensity tuned to unit mass (Heavy Tanks > Troops).",
      "concern": "presentational",
      "refs": [
        "visuals §3"
      ]
    },
    {
      "text": "Three-part shot: muzzle flash + smoke/sparks, visible traveling projectile matching weapon class (artillery lobs, hitscan beam), impact FX keyed to damage type (fire burn flare, electric arc, frost shatter).",
      "concern": "presentational",
      "refs": [
        "visuals §4"
      ]
    },
    {
      "text": "Structure lifecycle FX: placing ghost with valid/invalid tint; construction rising dust; universal gold pie-sweep flash on build/repair/upgrade completion; damage smoke scaling with damage; destruction dust + debris + rubble decal; sell dust puff + gold pickup. Structure atlas states: Placing · Building · Damaged · Aiming · Firing · Upgrading 1-2-3 · Selling/Destroying.",
      "concern": "presentational",
      "refs": [
        "§8",
        "§16",
        "visuals §5"
      ]
    },
    {
      "text": "Structure selection: dashed range circle + popup with name, damage, level, upgrade (with price), repair, sell (with sell price) buttons.",
      "concern": "presentational",
      "refs": [
        "visuals §5",
        "§8"
      ]
    },
    {
      "text": "Environment: trees occlude units behind them and animate via vertex shader; clouds drift, briefly occlude air units and dim ground, vapor shader; fog-of-war overlay layer.",
      "concern": "presentational",
      "refs": [
        "visuals §6"
      ]
    },
    {
      "text": "Camera: player-rotatable world with parallax between layers; rotation re-runs depth sort and re-projects shadow offsets against fixed sun; cinematic slow auto-rotate for intros framing base vs. incoming threat; HUD fixed to screen; shared projection function project(mapPos) → screen(scale, skew) with bottom-centre nearest.",
      "concern": "presentational",
      "refs": [
        "visuals §7",
        "Harness §3"
      ]
    },
    {
      "text": "HUD/UX: unit and structure lists with live pricing and unaffordable (dimmed/disabled) state, gold readout with animated deltas, phase/wave indicator; deploy verb pick → preview → confirm/cancel; input parity: single pointer or single finger, no keyboard.",
      "concern": "presentational",
      "refs": [
        "visuals §8",
        "Menu-System §3"
      ]
    },
    {
      "text": "Kill feedback: simple coin animation with classic-console coin sounds on attacker death.",
      "concern": "presentational",
      "refs": [
        "visuals §10"
      ]
    },
    {
      "text": "Menu flow: Main Menu → Play / Replays (first-class) / Factions-Codex / Settings / Store / Inventory / Character / Help / Leaderboard; Choose Location → Choose Gear → Play → Results → Menu.",
      "concern": "presentational",
      "refs": [
        "Menu-System §2",
        "UX-Design"
      ]
    },
    {
      "text": "Primitive fallback: any part without a chosen sprite renders as a primitive placeholder; layered sprite path (pivots, muzzle point, per-part scale/offset, domain locomotion swap) authored/validated in the State Harness on the game's own Pixi pipeline.",
      "concern": "presentational",
      "refs": [
        "Harness §1",
        "Harness §4"
      ]
    },
    {
      "text": "Pixi.js renderer (the game's renderer); Harness view pixel-accurate to what the game draws",
      "concern": "presentational",
      "refs": [
        "§8"
      ]
    },
    {
      "text": "Pixi part-stack render: selectable base/weapon/head sprites at chosen sizes, layered in correct z-order with working pivots",
      "concern": "presentational",
      "refs": [
        "§5",
        "§8"
      ]
    },
    {
      "text": "One Pixi camera/projection module shared by Harness and game render: parallax/skew correct at top / left / right / centre",
      "concern": "presentational",
      "refs": [
        "§5",
        "§8"
      ]
    },
    {
      "text": "Silhouette shadow derived from base + turret shape, tracking position and aim",
      "concern": "presentational",
      "refs": [
        "§7",
        "§8"
      ]
    },
    {
      "text": "Overlapping shadows across many units in field mode; cross-unit readability of the whole field",
      "concern": "presentational",
      "refs": [
        "§5"
      ]
    },
    {
      "text": "Each state visibly drives the correct part(s): base = health, weapon = aim/acquire, head = awareness",
      "concern": "presentational",
      "refs": [
        "§8"
      ]
    },
    {
      "text": "Flyer altitude shadow (M2)",
      "concern": "presentational",
      "refs": [
        "§7"
      ]
    }
  ],
  "acceptance": [
    "Builds and runs with **no manual fixes**.",
    "Both lanes present; **walker uses ground, floater uses water, flyer ignores terrain**.",
    "Basic attackers **path to base and damage it**, ignoring towers unless flagged.",
    "**Wall/moat reroutes walkers** (visible path change).",
    "All 3 towers: **place (space+cost+build time), fire, take damage, repair, upgrade once, sell**.",
    "Real-time economy: **kill→income, spend→build/upgrade/repair**, bankruptcy possible.",
    "**Win** on surviving waves; **lose** on base death.",
    "**Deterministic** under a fixed seed.",
    "**Combat core callable headless.**",
    "A unit authored in the Harness is **dropped into the existing game engine and is fully playable** — it spawns, moves, acquires, attacks, and dies with its authored part-stack + stats, loaded from the registry (no code change).",
    "Rendered with **Pixi.js** (the game's renderer) — the Harness view is **pixel-accurate** to what the game draws.",
    "A unit is composed from **selectable base/weapon/head sprites at chosen sizes**, layered in correct z-order with working pivots.",
    "Each state (**idle, movement, acquire, attack, take-damage, heal, death**) **visibly drives the correct part(s)** — base = health, weapon = aim/acquire, head = awareness — off the deterministic sim.",
    "The unit renders under the camera with correct **parallax/skew** at top / left / right / centre, and a **shadow derived from the base + turret shape** that tracks position and aim.",
    "**Additional units can be dropped into a scene** (field mode) and read correctly together — the same architecture proving the design scales from one unit to the full roster.",
    "The **same** unit dropped into the game looks and behaves identically (one state, one Pixi projection)."
  ],
  "_source_hash": "c3e1bedf8d97c8ae"
}