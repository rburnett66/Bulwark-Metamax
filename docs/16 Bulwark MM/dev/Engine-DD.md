<!-- Engine / Model DD: 3917 chars · design source (GDD+visuals) 52156 chars · 7.5% of source (~13x smaller) -->

GAME (engine / strict-state view) — BULWARK — Vertical Slice (Tower Defense, Ground/Water/Air)
Build the DETERMINISTIC simulation to THIS. Strict state only — positions, hp, waves, economy, targeting, win/lose. Rendering/animation/particles are NOT your concern.
MAP & GEOMETRY:
- Single ground lane beside a single water lane; same board geometry as the balance-sim harness
- Both lanes end at the player base in a clearing
- Wall/moat terrain piece blocks and reroutes walker paths (moats block walkers; walls rout attack paths)
- Base hard-point slots: structures snap to fixed slots; slot count scales with base level
ENTITIES:
- Player base: position, HP; damaged by attackers; base HP → 0 = lose
- Attacker faction: Ground/Powder (tutorial faction), 3 units spanning behavior
- Walker unit: kind, position, hp; ground-only movement, blocked by water/walls/moats
- Floater/swimmer unit: kind, position, hp; travels the water lane
- Flyer unit: kind, position, altitude, hp; ignores ground terrain and walls
- Anti-ground tower: position, hp, tier, target; cannot target air
- Anti-air tower: position, hp, tier, target; can target air
- Wall/moat structure: position, footprint, hp; terrain piece that reroutes walkers
- Structure lifecycle state per structure: Placing → Building → Complete → Damaged → Destroyed, plus Upgrading and Selling
- Unit attributes are data-driven from tables: domain, health, dps (sim-derived), cost (from DPS), vision/radarSignature, targetsBase flag
MECHANICS (transitions the sim must implement):
- Basic attackers path to the base and attack the base, treating towers/structures as hazards; only flagged units target structures
- Domain pathing: walker uses ground lane, floater/swimmer uses water lane, flyer ignores terrain
- Wall/moat placement recomputes walker paths (visible path change)
- Weapon domain targeting: each weapon declares which domains it can hit (anti-air = can-target Air; anti-ground cannot hit air)
- Structure lifecycle: placement requires space + cost + build time; structures have health, fire a weapon, take damage, can be repaired, upgraded one tier, and sold for partial refund
- Repairs are free but consume troops; repairs take time and a troop must travel to the structure
- Real-time economy: money accrues live; kills grant income; spend on build/repair/upgrade; bankruptcy possible
- Waves: survive N waves = win; base HP reaches 0 = lose
- Vision (minimal, or explicitly stubbed): radar sees air not ground; air units see ground at range
- Determinism: seed-stable identical replay; sim core separated from rendering
- Combat core callable headless (same code path as the §17 balance sim)
- Balance sim pricing: unit price = average DPS over 100 automated battles on the fixed harness; prices stabilize across seeds
- No hardcoded balance: units/structures/costs read from data tables (config.data.tables / bulwark-balance workbook)
- Deployed troops spawn at the player base and march to the chosen drop location (drop point is a destination order, not a spawn point)
- Battle log stream: complete ordered record of inputs + seed + events written during play; replays re-drive the headless core from the log and prove determinism
- Deploy validity check: placement blocked by space, terrain, or insufficient cost
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