<!-- Render / View DD: 3930 chars · design source (GDD+visuals) 52156 chars · 7.5% of source (~13x smaller) -->

VISUALS (render / choreography view) — BULWARK — Vertical Slice (Tower Defense, Ground/Water/Air)
Draw the strict sim state to THIS look. Choreography, easing, particles, and layered art are yours; you READ state and never change it (presentation never affects replay).
MAP & LAYOUT (read-only geometry):
- One biome rendered with documented faction palette table (ground, shadows, units, effects, clouds, fog, UI)
- Ground drawn as low/mid/high bands; water drawn as surface layer plus sub-surface tint so swimmers read submerged vs floaters on top
VISUAL LAYERS & CHOREOGRAPHY:
- Layered 2.5D painter's-algorithm z-order back→front: sky, water (surface + sub-surface tint), ground bands, ground shadows, grass/bushes, trees with cast shadows, ground units, structures, projectiles/ground FX, air units + dim altitude shadows, clouds, muzzle/impact FX, fog of war, screen-space HUD
- Four-layer unit sprite stack (legs/locomotion, body, weapon, head/sensors); weapon rotates independently toward target; air shapes use rotor/thrust layer instead of legs
- Telegraphing rule: head/sensor swings to target first, then weapon rotates with a lock-on wind-up equal to time-to-fire before the projectile launches
- Ground units/structures depth-sorted by ground anchor (screen-projected Y), re-sorted every frame
- Unit animation states: Idle · Moving · Attacking · Death; structure render states: Placing · Building · Damaged · Aiming · Firing · Upgrading 1-2-3 · Selling/Destroying
- Simple soft shadows for all ground units, structures, trees, offset by global sun direction; air units cast dim offset shadows whose distance/fade conveys altitude
- Dirt/dust trails under moving units, intensity scaled to unit mass
- Three-part shot: muzzle flash (light + smoke/sparks), visible traveling projectile matching weapon class (ballistic lob vs hitscan beam), impact effect keyed to damage type
- Structure lifecycle FX: translucent placement ghost with valid/invalid tint, rising construction dust, gold pie-sweep flash on build/repair/upgrade completion, damage smoke scaling with damage, dust + debris + rubble decal on destruction, sell dust puff + gold pickup
- Structure selection: dashed range circle plus popup with name, damage, level, upgrade button with price, repair, and sell with sell price
- Environment shaders: trees sway via vertex shader; clouds drift with vapor-cycling shader and dim ground/occlude air; water shader with no transparency/reflection; moving objects create particle ripples and wake
- Camera rotation as first-class control: rotation re-runs depth sort and re-projects shadow offsets against fixed sun; HUD never rotates; cinematic slow auto-rotate frames base vs incoming threat at battle intro/outro
- Deploy loop UI: select from list → hover/drag placement preview ghost with valid/invalid tint → drop or cancel; identical mouse/touch, single pointer
- HUD: gold readout with animated deltas, unit/structure lists with live pricing and dimmed unaffordable state, phase/wave indicator, march line shown during deploy preview
- Kill reward feedback: simple coin animation with classic-console coin sounds when an attacker dies
ENTITY APPEARANCE (keyed by the sim entity's kind/state):
- Player base: position, HP; damaged by attackers; base HP → 0 = lose
- Attacker faction: Ground/Powder (tutorial faction), 3 units spanning behavior
- Walker unit: kind, position, hp; ground-only movement, blocked by water/walls/moats
- Floater/swimmer unit: kind, position, hp; travels the water lane
- Flyer unit: kind, position, altitude, hp; ignores ground terrain and walls
- Anti-ground tower: position, hp, tier, target; cannot target air
- Anti-air tower: position, hp, tier, target; can target air
- Wall/moat structure: position, footprint, hp; terrain piece that reroutes walkers
- Structure lifecycle state per structure: Placing → Building → Complete → Damaged → Destroyed, plus Upgrading and Selling