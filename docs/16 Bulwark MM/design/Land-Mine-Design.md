# Land Mine (Mine Drone) — Design

*rev 1 — 2026-07-22. Owner concept: "Land mine is a new unit placed on the ground by deploying a
drone — the drone gets to the location and buries itself as a red dot; when a tank hits the red dot
it explodes. Does not affect air units. Same damage as the base turret for now."*

## Concept

A **consumable defensive purchase**. The player targets a ground cell; a small **deploy drone**
launches from the base, flies to the cell (drones fly — terrain blocking doesn't gate placement
routes), and **buries itself**, becoming an **armed mine** rendered as a red dot. The first enemy
ground unit that touches the dot sets it off: one Cannon-class burst of damage in a small blast
radius, then the mine is spent. Air units never trigger mines and never take mine damage.

The fantasy: cheap, positional area denial — you mine the lane the wave will walk, not the wave itself.

## Rules (v1)

| Rule | Value | Why |
| --- | --- | --- |
| Purchase | targeted buy, like a structure ghost (build key 6) | reuses ghost/validate UX |
| Placement | any passable, non-water, non-blocking ground cell | mines are LAND mines |
| Carrier | deploy drone, defender side, flies base→cell (`getFlyerPath`) | "deployed by a drone"; no ground-path failures |
| Drone in transit | killable? **No (v1)** — attackers never target defenders' drones (no defender-unit targeting exists) | zero new targeting rules in v1 |
| Bury | on arrival: drone despawns, armed mine record appears (red dot) | one-way trip |
| Trigger | first **ground-domain** attacker (Walker; Floaters/Swimmers can't reach land cells by placement) within **0.45 tiles** | "when a tank hits the red dot" |
| Air | never triggers, never damaged | owner rule |
| Damage | **45 Kinetic** — Cannon tower T1 dps as a one-shot burst (`STRUCTURES['STR-Cannon'].dps[0]`) | "same damage as base turret for now" |
| Blast | **1.0 tile** radius AoE around the trigger point, same burst to every ground attacker inside | mines counter clumps; matches aoe conventions |
| Uses | single — consumed on detonation | consumable economy |
| Cap | max **8** armed mines on the board | perf + spam guard |
| Cost | **TBD by M0** — measured in the Shooting Gallery gauntlet + balanceSim before shipping | balance is data |

## Contracts (must hold)

- **Balance is data**: damage/type/radii/cost/cap live in `tables.js` (new `STR-Mine` row,
  `kind: 'mine'`) — the sim reads the table, never a literal. v1 damage intentionally *references*
  the cannon row so "same as base turret" stays true under cannon retunes.
- **Replay determinism**: drone flight, bury tick, and trigger check are pure functions of state —
  no `Math.random`/`Date.now` anywhere in the path. Trigger order on a shared tick = ascending
  entity id (same convention as `acquireTarget`).
- **Damage through `applyDamage`**: the explosion applies via the real effectiveness matrix
  (Kinetic ×1 vs Machinery/Organic — a plain, honest burst), emitting the standard `damage` events.
- **Render-tier gate**: if the drone ships as a `UNITS` row it needs an explicit `render_tier`
  (`'A'`); if it stays a sim-side courier record it must never enter wave data. Either way the two
  deploy-gate tests stay green.
- **FX through the shipping pipeline**: explosion = `spawnFireClump` + `spawnGlow` + small shake via
  the `spawnFx`/`updateFx` path — no bespoke FX code.

## Sim shape (M1 sketch)

- `state.mines: Map<id, {id, pos, state:'flying'|'armed', targetCell, flightPath, pathIdx}>` stepped
  by a new `src/sim/mines.js` (`stepMines(state, dt)`): advance flying drones along their path;
  armed mines scan live attacker walkers within trigger radius → detonate (burst to all ground
  attackers within blast radius via `applyDamage`), emit `mineExplode`, delete.
- Command: `{type:'placeMine', cell}` → validates (passable, cap, gold) → spends → spawns courier.
- The **Shooting Gallery gauntlet carries the reference implementation** (`src/gallery/lane.js`,
  `MINE_SPEC`) until M1 lands in the sim — the prototype and this doc must not drift.

## Open questions (answer via M0 measurements)

1. Cost point — what does 45 burst damage at a chokepoint actually buy vs a T1 cannon's sustained 45 dps?
2. Should the blast damage type be Concussion (anti-Machinery ×1.7, the "anti-tank mine" fantasy)
   instead of Kinetic parity with the turret? v1 ships Kinetic per owner; gauntlet can A/B it.
3. Trigger radius vs unit radius — should big units (radius 0.5) trigger earlier than troops (0.38)?
   v1: fixed 0.45 from mine center; revisit if it feels wrong in the gauntlet.
4. Visibility: does the attacker AI ever avoid mines? v1: never (dumb walkers), the red dot is
   player-facing info only.
