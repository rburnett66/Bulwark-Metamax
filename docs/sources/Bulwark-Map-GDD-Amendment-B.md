# Bulwark — GDD Amendment B: Meta Economies & Upgrade Paths

*Owner design session 2026-07-15. Supersedes the workbook Tech_Tree sheet's "T1 unit / T2
structure / T3 base upgrade" concept — those referred to an original tech idea. This document is
the source of truth for the campaign meta-game until folded into the GDD proper.*

## B1. The core loop

**Choose a faction to fight → complete a map → gain rewards → choose upgrades → choose a faction
to fight.** Every collection or upgrade path is an ECONOMY with its own earn/spend loop.

| Economy | Earned by | Spent on / gates |
|---|---|---|
| **Gold** | Battle (kills, harvest) — syncs to the campaign BANK at map end | Harvester levels 1–5 (built) · **structure tier unlocks** (B2) |
| **Loyalty** (per faction, signed) | Quest contracts (fulfil/decline/break, rivalry burn) | **Faction upgrades** (B3) — 3 per faction at the 100/260/520 thresholds |
| **Stars** | Wave rubric (5 conditions/wave) | Map unlocks (≥3.0 average) |
| **Alignment** (good↔evil axis) | Whose contracts you fulfil (81-hero matrix) | Identity; future gating TBD |

**Economy sync rule — DECIDED (owner, 2026-07-15): bank = LEFTOVER gold.** Spend-in-battle is
gone forever; fight-rich vs bank-it is the intended tension.

## B2. Structure tier unlocks (gold economy)

All units/structures start the campaign at **Tier 1**. The RIGHT to upgrade in-battle must be
unlocked in the meta, **individually per structure type**:

- **Cannons**: unlock T2, then T3, then **T4 (NEW — improves range)**
- **Anti-air**: unlock T2 → T3 → **T4 (range)**
- **Walls**: unlock T2 → T3 → **T4 = INCREASED HP (owner decided)**

Bought with banked gold. In-battle upgrade button is gated on the meta unlock for that type.
T4 requires extending the structures table (hp/cost/dps arrays gain a 4th entry) and tier-4 art
slots in the System faction.

## B3. Faction upgrades (loyalty economy) — the 27-slot matrix

Earning loyalty with a faction unlocks that faction's themed upgrades at the existing cumulative
thresholds (100 / 260 / 520). **9 factions × 3 perks = 27 slots.** Owner's pool (assignment of
perk→faction below is the agent's PROPOSAL, themed to faction identity — owner to confirm/remap;
slots 24–27 were "?" and are proposed here):

| # | Perk | Effect sketch | Proposed faction |
|---|---|---|---|
| 1 | Base defense | Base HP +25% | Ground/Powder T1 |
| 2 | Base awareness | Reveal spawn telegraphs / incoming wave preview | High Tech T1 |
| 3 | Harvester turrets | Harvesters mount a small anti-ground gun | Artillery T1 |
| 4 | Harvester anti-air | Harvester gun also targets air | Air T1 |
| 5 | Turret 4 | Discount/enable Cannon T4 | Artillery T2 |
| 6 | Turret and air | Cannons can target air (reduced dps) | High Tech T2 |
| 7 | Air 4 | Discount/enable Flak T4 | Air T2 |
| 8 | Hardened turrets | Cannon HP +30% | Ground/Powder T2 |
| 9 | Hardened air | Flak HP +30% | Dark Energy T1 |
| 10 | Fast repairs ("run fast fix fast") | Repair bots move + weld faster | Greenies T1 |
| 11 | Cheaper level 1 walls | Wall T1 cost −30% | Ground/Powder T3 |
| 12 | Turret range extender | Cannon range +20% | Artillery T3 |
| 13 | Anti-air range extender | Flak range +20% | Air T3 |
| 14 | Base range | Super-cannon range +20% | Space Tech T1 |
| 15 | Hardened base armor | Base armor +25% | Dark Energy T2 |
| 16 | Bunkers | New structure: anti-tank + anti-air emplacement | Space Tech T2 |
| 17 | Amphibious | Ground units cross water at 30% speed boost profile: troops 70% / heavy tanks 30% / light vehicles 50% of normal speed | Water T1 |
| 18 | Harvester economy boost | +10% yield | Greenies T2 |
| 19 | Balloon scouts | Persistent vision pickets | Water T2 |
| 20 | Bomber run | Callable airstrike (cooldown) | Space Tech T3 |
| 21 | Anti-air drones | Autonomous AA drone wing | High Tech T3 |
| 22 | Anti-tank drones | Autonomous AT drone wing | Dark Energy T3 |
| 23 | Mine field | Placeable mines | Arcane/Energy T1 |
| 24 | *(proposed)* Arcane ward | Structures in aura take −15% damage | Arcane/Energy T2 |
| 25 | *(proposed)* Overcharge | Super-cannon cooldown −25% | Arcane/Energy T3 |
| 26 | *(proposed)* Tidal moats | Moats slow air (spray) and cost −25% | Water T3 |
| 27 | *(proposed)* Salvage crews | +50% sell refund, kills near base pay +10% | Greenies T3 |

## B4. Build order (agent proposal)

1. **Schema + screens**: retire the old "T1 unit/T2 structure/T3 base" badge semantics; badges
   become the faction's 3 PERKS (named, hover = effect). Save: `structTiers {cannon,flak,wall}`,
   `perks {}` map. Bank sync per B1 decision.
2. **Structure tier unlock economy** (gold → T2/T3 per type; in-battle upgrade gating; T4 later —
   needs table + art).
3. **Perk effects in waves**: stat-mod perks first (1, 8, 9, 11, 12, 13, 14, 15, 18 — pure
   numbers injected at createSim), then behavior perks (3, 4, 6, 10, 17), then content perks
   (16, 19–23 — new entities, one story each).
4. T4 tier (tables, art slots, range semantics).

## B5. Decisions (owner, 2026-07-15)

1. Bank = LEFTOVER gold. DECIDED.
2. Walls T4 = increased HP. DECIDED.
3. Perk→faction assignment: SKIP FOR NOW — B3 table stays a proposal; no perk effects built yet.
4. Loyalty: perks unlock at cumulative THRESHOLDS (100/260/520). DECIDED.
5. Slots 24–27: discuss later.

Build scope now: B2 (structure tier unlock economy). B3 effects deferred until the assignment
is confirmed; T4 deferred until tables + art.
