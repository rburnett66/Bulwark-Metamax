# Start-Up Polish & Wave Bonuses — Design

*rev 1 — 2026-07-22. Owner spec. Board epic: mm-49d52ced1b73 (WB1-WB6).*

## Feature 1 — Wave preview dialog

After the existing dialog and **before each map starts**, a **reusable dialog** tells the player what
units to expect on each wave — read straight from the authored wave schedule (forge `spawnsByWave` /
`makeWaves`): per wave, the unit shapes, counts, and lanes. No derived spoilers (no hp/dps math);
the schedule the designer authored IS the preview. The dialog shell is shared with the wave-end
bonus picker (Feature 2) — one component, two contents.

## Feature 2 — Wave-end bonuses (pick 1 of 3)

At the end of every wave the player is offered **3 distinct bonuses** rolled from the pool and picks
**one**. The pool (owner verbatim, 16 entries):

| # | Bonus | Effect class |
|---|---|---|
| 1 | 10% bonus damage vs air | persistent damage mod (defender fire vs Flyer) |
| 2 | 10% bonus damage vs ground | persistent damage mod (vs non-Flyer) |
| 3 | 10% bonus damage vs troops | persistent damage mod (vs Troops shape) |
| 4 | Heal all walls | instant heal to full |
| 5 | Heal all cannons | instant heal to full |
| 6 | Heal base 10% | instant heal (+10% of max) |
| 7 | Heal all anti-air | instant heal to full |
| 8 | 20% faster harvesters | persistent — **pre-nerf: starting harvester speed −35%** |
| 9 | 20% more harvester capacity | persistent |
| 10 | 20% more harvester hp | persistent |
| 11 | Heal all harvesters | instant heal to full |
| 12 | Add mine-layer drones | grant — WB1 defines: +N free STR-Mine deploy credits |
| 13 | Base cannon +10% range | persistent — **pre-nerf: current range −30%, power −50%** |
| 14 | Base cannon +10% damage | persistent (on the pre-nerfed power) |
| 15 | Enable Tier-3 turrets | unlock — **pre-nerf: turret tier cap starts at T2** |
| 16 | Enable Tier-3 walls | unlock — **pre-nerf: wall tier cap starts at T2** |

### Pre-nerfs (owner — these ship WITH the feature, not before)
- Starting harvester speed **−35%** (bonus 8 climbs back toward today's feel).
- Base super-cannon: range **−30%**, damage **−50%** (bonuses 13/14 buy it back; also blunts the
  slow-walker sniping finding mm-4815296bf7ee).
- `state.structTiers`: turrets AND walls capped at **T2** at run start; T3 exists only via 15/16
  (the campaign tier-gate plumbing already exists — hud reads structTiers today).

### Semantics (WB1 defaults — owner review)
- % mods are **run-persistent** and additive with themselves; duplicates MAY be re-offered and stack
  (10% → 20%…). Instant heals and unlocks leave the pool once fully redundant (an unlock already
  owned is never re-offered).
- Offer roll: 3 **distinct** entries via the **seeded sim rng** at wave end — replay-identical.
- The pick enters the sim as a **logged command** `{type:'chooseBonus', bonusId}` — replays carry it.
- No pick before the next wave starts = no bonus (the interlude's Next-Wave button confirms forfeit).

## Contracts
- **Balance is data**: the pool, magnitudes, and every pre-nerf constant live in `tables.js`
  (`BONUSES` + constants). Zero literals in sim code.
- **Replay determinism**: seeded offers + logged choices; `replay.js` round-trips a bonus run to an
  identical final hash (WB6 test).
- **Reusable dialog**: one shell component for preview + bonus picker (and future recaps).
- Deploy gates stay green; balanceSim re-run with pre-nerfs + representative loadouts.

## Build order
WB1 (doc+data) → WB3 (pre-nerfs) → WB4 (engine) → {WB2 preview, WB5 picker UI} → WB6 (proof).
