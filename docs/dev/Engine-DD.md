<!-- Engine / Model DD: 9970 chars · design source (GDD+visuals) 64090 chars · 15.6% of source (~6x smaller) -->

GAME (engine / strict-state view) — BULWARK — Vertical Slice (Concern-Routed Design Model)
Build the DETERMINISTIC simulation to THIS. Strict state only — positions, hp, waves, economy, targeting, win/lose. Rendering/animation/particles are NOT your concern.
MAP & GEOMETRY:
- One map: a single ground lane beside a single water lane, ending at the player base in a clearing; same board as the §17 balance harness.
- Wall/moat terrain piece reroutes walkers (visible path change); walls & natural terrain rout attack paths; moats block walkers; traps/murder holes punish chokepoints.
- Surfaces: water incl. sub-surface, ground low/mid/high, grass & bushes, trees, clouds, fog.
- Base hard points: fixed structure slots on the base; slot count scales with player level (progression reward).
- Scale tiers reuse the same rules: path → field → river/coast → mountain → castle → kingdom → continent → planet → PvP/co-op.
- Fog of war is a continent-level concern; reveal is scouting-driven, not free.
- Bench mode: isolated single-unit scene — compose the unit, drive its states, inspect under the camera; the M1 gating slice
- Field mode: many units on the map under the real sim + shared camera — roster in play, real combat, readability across the whole field
- Early milestones allow dropping extra units into a scene to validate cross-unit readability and overlapping camera/shadow before roster scale-up
ENTITIES:
- Player base with HP; basic attackers target it; base HP → 0 = lose.
- Three slice attackers (Ground/Powder faction): walker (ground lane), floater/swimmer (water lane), flyer (ignores terrain); each has kind + position engine-owned, renderer-read.
- Three slice defenses: anti-ground tower, anti-air tower, wall/moat terrain piece.
- Unit attributes: domain, health, dps (derived by sim), cost (from DPS), vision/radarSignature, targetsBase flag; each unit declares what it sees (ground/air/both) and range.
- Unit shape classes (silhouette/atlas): Troops, Trucks, Tanks, Artillery, Heavy Tanks, Copters, Planes, Missiles.
- Full structure set: Blacksmith, Armory, Barracks, Stables, Science Lab, Balloons, Runway, Walls, Moats, Traps, Murder Holes.
- Nine asymmetric factions (Ground/Powder, Air, High Tech, Artillery, Water, Arcane/Energy, Space Tech, Dark Energy, Greenies) as data with directed 9-node counter graph; none dominant, none dead weight.
- Alignment model: 9 alignments (AG PG G CG N CE E PE DE), two hidden axes (polarity, conviction T0–T3), generating rules regenerate the symmetric 9×9 relationship matrix (++/+/0/−/−−).
- 81 heroes: one per alignment per faction, each with name + motivation; drama threads [DL][TA][RE][RV][TW][FL] stored as directed asymmetric relationships layered above the symmetric alignment matrix.
- Level = Biome + Map + 8 characters (conversations & tips) + Boss; Map = pathing (water/ground/air) + biome + base placement options.
- Unit: data-driven schema, one UNITS entry per unit; roster = N entries (full roster = 72 units)
- Portable unit definition: UNITS stats + part-stack (base/weapon/head sprite refs + sizing + pivots), same format the engine loads, spawns, and plays
- Unit part-stack: base, weapon, head sprites at chosen sizes with pivots
- Data registry: engine reads unit definitions from a registry (not only hardcoded UNITS); Harness writes/updates definitions, engine picks them up
- Unit stats drive combat in the shared sim
- Unit kind/position/state owned by the sim, read identically at bench and field scales (per-unit readout identical)
- Domain variants: walker (M1), floater and flyer (M2)
- Balance/data companions: bulwark-balance-xlsx.md, values preloaded at runtime as config.data.tables (schema in table catalog)
MECHANICS (transitions the sim must implement):
- Basic units path to base and attack the base, not structures; structures treated as hazards; only units flagged Targets=Structures engage buildings.
- Domain traversal: walkers ground-only, blocked by water/walls/moats; swimmers/floaters use water lanes (swimmers sub-surface: harder to hit, limited vision); flyers ignore ground terrain and walls, limited only by air defense and radar.
- Vision rules: radar sees air not ground; air units see ground at range; implemented or explicitly stubbed in slice. Night adds a lighting layer over fog; some factions (Dark Energy, Space Tech) partly ignore it; night changes faction strategies.
- Universal structure lifecycle: placement (space + cost + build time) → health & weapon → repair → upgrade (slice: one tier; full: tiers 1-2-3) → damage/destroy → sell (partial refund). Repairs are free but repair troops are not; repairs take time and a troop travel-to-structure time.
- Real-time economy: money accrues and is spent live in battle; income from wave-clear bounties, kills, captures (later idle harvest/grow); spend on build/repair/upgrade/deploy; bankruptcy possible; real-time mid-battle upgrades if affordable.
- Units repair OR attack — a live resource choice, never both.
- Win/lose: survive N waves = win; base HP → 0 = lose; each cleared wave grants story; cadence Scout → Fortify → Defend → Collect → Upgrade → Story.
- Damage types (Kinetic, Fire burn DoT, Poison DoT organics-only, Concussion vs machinery + stagger, Electric chains/disables machines, Frost slows all except air) × armor classes (Organic, Machinery, Aircraft, Structure, Energy) as a data-driven 6×5 multiplier matrix; AoE and anti-air are orthogonal columns; weapons declare targetable domains; chem lingers on ground, energy arcs on water.
- Weapon coverage: projectile, ballistic arcs, hitscan/energy, guided missiles, area/splash, chem/DoT; damage resolves vs. unit and structure health alike.
- Targeting: sensor acquires target first (sticky-then-reacquire), then weapon rotates with lock-on wind-up whose duration equals time-to-fire; only after lock does the projectile launch.
- Deploy loop: troops always deploy from the player's base and path/march to the chosen drop location (destination order, not spawn point); structures snap to base hard-point slots; placement invalid by space, terrain, or cost.
- Determinism: sim core separated from rendering, runs headless, seed-stable identical replay; battle log stream (inputs + seed + events) reconstructs replays exactly — replay is the determinism acceptance test.
- Balance sim: unit price = average effective DPS across 100 automated headless battles on the fixed ground+water lane harness with a standard defense set at fixed positions; prices stabilize over 100 runs and across seeds within tolerance.
- All units/structures/factions/palettes/alignments are data-driven tables (bulwark-balance.xlsx canonical); no hardcoded balance; no external services.
- Defeating a faction unlocks its units; per-continent arc: outpost in clearing → scout/defend → wave series → story per victory → repair/upgrade between waves; endgame PvE → PvP → co-op (base-vs-field roles) → idle farming & protection.
- Deterministic sim: seed + fixed dt; replay-safe and balance-checkable; dropped units run on the same sim
- Seven unit states: idle, movement, acquire, attack, take-damage, heal, death — driven off the deterministic sim
- Real combat in field mode: units acquire and attack each other; units spawn, move, acquire, attack, and die
- Same sim serves both scales: one unit isolated (bench) and full deterministic multi-unit sim (field) with no re-architecture
- Floater and flyer locomotion swaps (M2)
- Drop flow: author in Harness → write definition + asset refs to registry → unit spawns in live game and moves, acquires, attacks, dies with authored part-stack + stats — no re-authoring, no engine code change
- Registry loading is the one structural engine change; lands in M1 as it shapes the data model
- One authoring pipeline: author/tune one unit (bench) up to roster library, batch, and export to UNITS (field); M3 adds save/load definitions, sprite-library browser, roster batch, full drop/export pipeline
- M1 gate: one walker through full pipeline — compose → drive all seven states → camera preview with parallax + silhouette shadow → drop into live engine and play
- Same unit dropped into the game behaves identically: one state, one sim
ACCEPTANCE (you are gated on every item):
- Builds and runs with **no manual fixes**.
- Both lanes present; **walker uses ground, floater uses water, flyer ignores terrain**.
- Basic attackers **path to base and damage it**, ignoring towers unless flagged.
- **Wall/moat reroutes walkers** (visible path change).
- All 3 towers: **place (space+cost+build time), fire, take damage, repair, upgrade once, sell**.
- Real-time economy: **kill→income, spend→build/upgrade/repair**, bankruptcy possible.
- **Win** on surviving waves; **lose** on base death.
- **Deterministic** under a fixed seed.
- **Combat core callable headless.**
- A unit authored in the Harness is **dropped into the existing game engine and is fully playable** — it spawns, moves, acquires, attacks, and dies with its authored part-stack + stats, loaded from the registry (no code change).
- Rendered with **Pixi.js** (the game's renderer) — the Harness view is **pixel-accurate** to what the game draws.
- A unit is composed from **selectable base/weapon/head sprites at chosen sizes**, layered in correct z-order with working pivots.
- Each state (**idle, movement, acquire, attack, take-damage, heal, death**) **visibly drives the correct part(s)** — base = health, weapon = aim/acquire, head = awareness — off the deterministic sim.
- The unit renders under the camera with correct **parallax/skew** at top / left / right / centre, and a **shadow derived from the base + turret shape** that tracks position and aim.
- **Additional units can be dropped into a scene** (field mode) and read correctly together — the same architecture proving the design scales from one unit to the full roster.
- The **same** unit dropped into the game looks and behaves identically (one state, one Pixi projection).