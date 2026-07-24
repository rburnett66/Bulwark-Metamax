# Start-Up Polish & Wave Bonuses — Design (rev 1, 2026-07-22)

Canonical: repo docs/16 Bulwark MM/design/Wave-Bonuses-Design.md @ f8795c3 (repo wins on conflict). Board epic mm-49d52ced1b73, stories WB1-WB6.

## Feature 1 — Wave preview dialog
After the existing dialog and before each map starts, a REUSABLE dialog lists what units to expect on each wave, read straight from the authored wave schedule (spawnsByWave / makeWaves): shapes, counts, lanes per wave. No derived spoilers. Same dialog shell as the bonus picker.

## Feature 2 — Wave-end bonuses (pick 1 of 3)
3 distinct bonuses rolled per wave end from a 16-entry pool (owner verbatim): 10% dmg vs air / vs ground / vs troops; heal all walls / cannons / anti-air / harvesters; heal base 10%; harvesters +20% speed / capacity / hp; add mine-layer drones (WB1 defines as +N free STR-Mine credits); base cannon +10% range / +10% damage; enable Tier-3 turrets; enable Tier-3 walls.

PRE-NERFS shipping WITH the feature: starting harvester speed −35%; base super-cannon range −30% + damage −50%; turret AND wall tier caps start at T2 (T3 only via bonuses 15/16; structTiers plumbing exists).

Semantics (WB1 defaults, owner review): % mods run-persistent, self-additive, duplicates may re-offer; redundant unlocks leave the pool; offer roll from the SEEDED sim rng; the pick is a replay-logged command {type:'chooseBonus', bonusId}; no pick before next wave = forfeit.

## Contracts
Bonuses + pre-nerf constants are tables.js DATA; replay determinism proven end-to-end (WB6); one reusable dialog shell; deploy gates + balanceSim re-run.

## Build order
WB1 (doc+data) → WB3 (pre-nerfs) → WB4 (engine) → {WB2 preview, WB5 picker} → WB6 (proof).