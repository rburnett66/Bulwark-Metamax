# Land Mine (Mine Drone) — Design (rev 2, 2026-07-22)

**Rev 2 (owner, same day):** the purchase takes the **Moat's build slot (hotkey 4)** — STR-Moat is
replaced by STR-Mine; damage becomes **one-shot-any-tank** (burst **1500 Kinetic** — max roster
walker GND-HeavyTanks T3 @ 1452 hp; toughest Energy-armor walker 1320 needs 1200 effective at ×1.1);
blast shrinks to **0.5 tiles** ("very small"). Built as epics M1+M2+M3 in one pass — mines live in
`state.mines` (never structures: walkable, untargetable, no nav blocking), stepped by `src/sim/mines.js`.
Initial cost 150g, cap 8, drone speed 6 t/s — M4 tunes these via the gallery gauntlet + balanceSim.

## Concept
A consumable defensive purchase. The player targets a ground cell; a deploy drone launches from the base, flies to the cell, and buries itself, becoming an armed mine rendered as a red dot. The first enemy ground unit that touches the dot sets it off: one Cannon-class burst of damage in a small blast radius, then the mine is spent. Air units never trigger mines and never take mine damage.

## Rules (v1)
- Purchase: targeted buy, like a structure ghost (build key 6).
- Placement: any passable, non-water, non-blocking ground cell.
- Carrier: deploy drone, defender side, flies base→cell (getFlyerPath); not targetable in v1.
- Bury: on arrival the drone despawns; armed mine record appears (red dot).
- Trigger: first ground-domain attacker within 0.45 tiles. Air immune.
- Damage: 45 Kinetic — Cannon tower T1 dps as a one-shot burst, referencing STRUCTURES['STR-Cannon'].dps[0] so cannon retunes carry through ("same damage as base turret for now").
- Blast: 1.0-tile radius AoE, same burst to every ground attacker inside.
- Uses: single, consumed on detonation. Cap: 8 armed mines. Cost: TBD by Epic M0 measurement.

## Contracts
- Balance is data: all numbers land in tables.js (STR-Mine row, kind 'mine').
- Replay determinism: no randomness in flight/trigger; tie-break by ascending entity id.
- Damage via the real applyDamage (effectiveness matrix honest, standard events).
- Render-tier gate stays green; FX only through the shipping spawnFx/updateFx pipeline.

## Reference implementation
The Shooting Gallery GAUNTLET mode (src/gallery/lane.js, MINE_SPEC — commit 61484bd) carries the M0 prototype: real-sim lane run, mine buried on the unit's scouted route, measured burst. Prototype and this doc must not drift; M1 moves it into the sim proper.

## Open questions (answer via M0)
1. Cost point vs a T1 cannon's sustained 45 dps.
2. Kinetic (turret parity, v1) vs Concussion (anti-tank ×1.7 fantasy) — gauntlet can A/B.
3. Fixed 0.45 trigger vs unit-radius-scaled.
4. Attacker AI never avoids mines in v1 (red dot is player-facing info only).