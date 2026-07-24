<!-- Render / View DD: 6627 chars · design source (GDD+visuals) 64090 chars · 10.3% of source (~9x smaller) -->

VISUALS (render / choreography view) — BULWARK — Vertical Slice (Concern-Routed Design Model)
Draw the strict sim state to THIS look. Choreography, easing, particles, and layered art are yours; you READ state and never change it (presentation never affects replay).
MAP & LAYOUT (read-only geometry):
- Surfaces: water incl. sub-surface, ground low/mid/high, grass & bushes, trees, clouds, fog.
- One biome rendered with documented faction/biome palette (ground, shadows, units, effects, clouds, fog, score UI); reskin is a table change.
- Water renders surface layer plus sub-surface tint so swimmers read submerged vs. floaters on top; simple shader, no transparency/reflection; ripples and noisy particle wake on movement.
- Bench mode: isolated single-unit scene — compose the unit, drive its states, inspect under the camera; the M1 gating slice
- Field mode: many units on the map under the real sim + shared camera — roster in play, real combat, readability across the whole field
- Camera preview positions: top / left / right / centre for parallax/skew validation
- Early milestones allow dropping extra units into a scene to validate cross-unit readability and overlapping camera/shadow before roster scale-up
VISUAL LAYERS & CHOREOGRAPHY:
- Layered 2.5D: stacked 2D surfaces sorted back-to-front (painter's algorithm); canonical 14-layer z-order: sky, water (surface + sub-surface tint), ground bands, ground shadows, grass/bushes, trees, ground units, structures, projectiles/ground FX, air units + altitude shadows, clouds, muzzle/impact FX, fog of war, screen-space HUD (never rotates).
- Four-layer unit sprite stack (legs/locomotion, body, weapon rotating to target with muzzle flash, head/sensors telegraphing acquisition); air shapes swap legs for rotor/thrust; animation states Idle · Moving · Attacking · Death; depth-sorted by ground anchor (screen-projected Y) re-sorted every frame.
- Shadows: simple soft shadows for every ground unit/structure/tree, offset by global sun direction (configurable); air units cast dim offset altitude shadow — farther/fainter = higher; turret shadow rotates with aim.
- Dirt/dust trails under moving units, intensity tuned to unit mass (Heavy Tanks > Troops).
- Three-part shot: muzzle flash + smoke/sparks, visible traveling projectile matching weapon class (artillery lobs, hitscan beam), impact FX keyed to damage type (fire burn flare, electric arc, frost shatter).
- Structure lifecycle FX: placing ghost with valid/invalid tint; construction rising dust; universal gold pie-sweep flash on build/repair/upgrade completion; damage smoke scaling with damage; destruction dust + debris + rubble decal; sell dust puff + gold pickup. Structure atlas states: Placing · Building · Damaged · Aiming · Firing · Upgrading 1-2-3 · Selling/Destroying.
- Structure selection: dashed range circle + popup with name, damage, level, upgrade (with price), repair, sell (with sell price) buttons.
- Environment: trees occlude units behind them and animate via vertex shader; clouds drift, briefly occlude air units and dim ground, vapor shader; fog-of-war overlay layer.
- Camera: player-rotatable world with parallax between layers; rotation re-runs depth sort and re-projects shadow offsets against fixed sun; cinematic slow auto-rotate for intros framing base vs. incoming threat; HUD fixed to screen; shared projection function project(mapPos) → screen(scale, skew) with bottom-centre nearest.
- HUD/UX: unit and structure lists with live pricing and unaffordable (dimmed/disabled) state, gold readout with animated deltas, phase/wave indicator; deploy verb pick → preview → confirm/cancel; input parity: single pointer or single finger, no keyboard.
- Kill feedback: simple coin animation with classic-console coin sounds on attacker death.
- Menu flow: Main Menu → Play / Replays (first-class) / Factions-Codex / Settings / Store / Inventory / Character / Help / Leaderboard; Choose Location → Choose Gear → Play → Results → Menu.
- Primitive fallback: any part without a chosen sprite renders as a primitive placeholder; layered sprite path (pivots, muzzle point, per-part scale/offset, domain locomotion swap) authored/validated in the State Harness on the game's own Pixi pipeline.
- Pixi.js renderer (the game's renderer); Harness view pixel-accurate to what the game draws
- Pixi part-stack render: selectable base/weapon/head sprites at chosen sizes, layered in correct z-order with working pivots
- One Pixi camera/projection module shared by Harness and game render: parallax/skew correct at top / left / right / centre
- Silhouette shadow derived from base + turret shape, tracking position and aim
- Overlapping shadows across many units in field mode; cross-unit readability of the whole field
- Each state visibly drives the correct part(s): base = health, weapon = aim/acquire, head = awareness
- Flyer altitude shadow (M2)
ENTITY APPEARANCE (keyed by the sim entity's kind/state):
- Player base with HP; basic attackers target it; base HP → 0 = lose.
- Three slice attackers (Ground/Powder faction): walker (ground lane), floater/swimmer (water lane), flyer (ignores terrain); each has kind + position engine-owned, renderer-read.
- Three slice defenses: anti-ground tower, anti-air tower, wall/moat terrain piece.
- Unit shape classes (silhouette/atlas): Troops, Trucks, Tanks, Artillery, Heavy Tanks, Copters, Planes, Missiles.
- Full structure set: Blacksmith, Armory, Barracks, Stables, Science Lab, Balloons, Runway, Walls, Moats, Traps, Murder Holes.
- 81 heroes: one per alignment per faction, each with name + motivation; drama threads [DL][TA][RE][RV][TW][FL] stored as directed asymmetric relationships layered above the symmetric alignment matrix.
- Level = Biome + Map + 8 characters (conversations & tips) + Boss; Map = pathing (water/ground/air) + biome + base placement options.
- Unit: data-driven schema, one UNITS entry per unit; roster = N entries (full roster = 72 units)
- Portable unit definition: UNITS stats + part-stack (base/weapon/head sprite refs + sizing + pivots), same format the engine loads, spawns, and plays
- Unit part-stack: base, weapon, head sprites at chosen sizes with pivots
- Data registry: engine reads unit definitions from a registry (not only hardcoded UNITS); Harness writes/updates definitions, engine picks them up
- Unit kind/position/state owned by the sim, read identically at bench and field scales (per-unit readout identical)
- Domain variants: walker (M1), floater and flyer (M2)
- Balance/data companions: bulwark-balance-xlsx.md, values preloaded at runtime as config.data.tables (schema in table catalog)