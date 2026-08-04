# Content-Plan.md

# Content-Plan.md

*BULWARK — Content Production & Cadence Plan*
*Stage: DESIGN · Companion to `bulwark-gdd.md`, `bulwark-balance.xlsx`, `bulwark-visuals.md`*

> **Scope note.** BULWARK is a hybrid (tower defense × asymmetric-faction roster × alignment-driven narrative). The GDD's stated genre and scope are authoritative; the framework below is a structural lens only. Every quantity is grounded in the cited source sections and workbook sheets. Values not authored in the sources are marked *"not stated"* rather than invented.

> **Source-material accuracy note (this revision).** This plan has been reconciled against the authoritative source files now in context — `bulwark-gdd.md` (v2.0) and `bulwark-balance.xlsx` (v1). Several previously placeholder or approximate values are now corrected to the exact source figures: the **tier scaling multipliers** are drawn directly from the `Assumptions` sheet (no longer "fill before lock"), and the **alignment/character roster** (§10–§11 of the GDD) is now included as a first-class content axis it previously omitted. Where the sources genuinely do not state a value (e.g. wave counts per continent), the *"not stated"* marking is retained rather than invented.

---

## 0. Concept Snapshot

| Field | Value | Source |
|---|---|---|
| Working Title | BULWARK (codename, rename freely) | GDD header |
| One-Sentence Pitch | "Fortify a clearing, learn a faction, beat it, take its units — then do it again one scale up." | GDD §1 |
| Genre | Multi-faction, multi-domain tower defense with an automated balance sim | GDD header, §0 |
| Platform(s) | Single-pointer parity: mouse (desktop) or single finger (touch/phone) | Visuals §8 |
| Target Audience | Not stated | — |
| Session Length | Not numeric; session *shape* defined (see §1.2) | GDD §3 |

This document defines **what content exists**, **how much of it there is**, **the order it is produced in**, and **the DESIGN-stage vertical slice** that serves as the content definition of done.

---

## 1. Cadence Framing

### 1.1 Category Differentiators

BULWARK is tower defense plus three additive content pillars the GDD calls out as its distinctive mass:

- **Multi-domain combat** — ground, water, air; each pathed, seen, and defended differently (GDD §2 pillar 1, §5).
- **Asymmetry with counters** — nine factions in a directed 9-node counter graph; none dominant, none dead weight (GDD §2 pillar 3, §9).
- **Earn-by-beating progression** — defeating a faction unlocks its units for the player (GDD §2 pillar 4, §9).

Table-stakes mechanics present: structure placement, upgrade tiers, repair/sell lifecycle, wave series, derived economy (GDD §3, §8).

### 1.2 Content-Consumption Cadence

- **Per-wave loop:** `Scout → Fortify → Defend → Collect → Upgrade → (next wave) → Story → (next continent)` (GDD §3).
- **Battle/Build alternation:** Day Battle (survive; collect money via bounties + captures) → Day Build (spend on structures, upgrades, repairs) → repeat across a continent's wave series (GDD §3).
- **Story cadence:** each cleared wave grants **story**; each cleared continent advances the narrative and unlocks the beaten faction's units (GDD §3, §9).
- **Night-battle variant (advanced):** alters each faction's strategy and adds lighting as a second fog layer — extra content per continent with **no new rules** (GDD §3, §5).

Monetisation norms are **not stated** and are out of scope.

---

## 2. Content Inventory (full production surface)

### 2.1 Factions — 9

Nine asymmetric factions, each a pop-culture trope with a single hard counter forming a closed directed cycle (GDD §9; Balance `Factions` sheet).

| # | Faction | Trope | Beats | Signature Dmg | Identity |
|---|---|---|---|---|---|
| 1 | Ground / Powder | Nationalistic | Greenies | Kinetic | Infantry & armor; flags & honor |
| 2 | Air | Manga aces | Ground / Powder | Kinetic | Air superiority; weak on ground |
| 3 | High Tech | Mega-corp | Air | Electric | Precision, shields, expensive |
| 4 | Artillery | Siege military | High Tech | Concussion | Range & arc; poor up close |
| 5 | Water | Sea tribes | Artillery | Frost | Swimmers/floaters; coastal |
| 6 | Arcane / Energy | Theocracy | Water | Fire | Energy weapons; no ammo economy |
| 7 | Space Tech | Sci-Fi federation | Arcane / Energy | Electric | Orbital tech; strong vision; ignores some fog |
| 8 | Dark Energy | Cult | Space Tech | Poison | DoT, corruption, night-strong |
| 9 | Greenies (Chem) | Hive collective | Dark Energy | Poison | Swarms, chem clouds, area denial |

**Per-faction requirement:** palette/armor-class read (Visuals §2.1), signature damage type, armor theme, domain theme, and net-neutral stat tilt — average multiplier **≈1.00** per faction (Balance `Faction_Mods`, `Avg_x` column).

### 2.2 Unit Roster — 72 (8 shapes × 9 factions)

Eight shape classes drive silhouette and atlas; every faction fields all eight (Balance `Units`; GDD §6).

| Shape | Role | Domain | HP | DPS | Range | Speed | Vision |
|---|---|---|---|---|---|---|---|
| Troops | Skirmisher | Walker | 200 | 45 | 2.5 | 2 | 5.5 |
| Trucks | Support | Walker | 250 | 15 | 1.25 | 3.2 | 6 |
| Tanks | Bruiser | Walker | 400 | 45 | 3.75 | 0.8 | 4.5 |
| Artillery | Siege | Walker | 150 | 60 | 10 | 0.4 | 4 |
| Heavy Tanks | Juggernaut | Walker | 550 | 37.5 | 3 | 0.4 | 4.3 |
| Copters | Harasser | Flyer | 200 | 45 | 5 | 2 | 4.5 |
| Planes | Striker | Flyer | 150 | 52.5 | 6.25 | 2 | 4 |
| Missiles | Guided AA | Flyer | 100 | 67.5 | 8.75 | 0.8 | 4 |

Source: Balance `Archetypes`. Each base unit spends the same **100-point power budget** across HP/DPS/Range/Speed/Utility, so shapes differ in *shape*, not total strength (Balance Overview — Balance Philosophy). Cost is derived flat from power (**gold = power × 3**, `Assumptions` `Cost_per_power_gold`), so equal power = equal price.

**Per-unit requirement:** all base attributes plus T1/T2/T3 HP and DPS, cost (T1–T3), power, and effective DPS vs Organic / Machinery / Aircraft (Balance `Units`). Tier scaling derives directly from `Assumptions` (exact source values, no longer placeholder):

| Tier | HP × | DPS × | Cumulative unit-value × |
|---|---|---|---|
| T1 | 1.00 | 1.00 | 1.00 |
| T2 | 1.60 | 1.55 | 2.50 |
| T3 | 2.40 | 2.30 | 5.00 |

Source: `Assumptions` sheet — `Upgrade_HP_x_T2` = 1.6, `Upgrade_HP_x_T3` = 2.4, `Upgrade_DPS_x_T2` = 1.55, `Upgrade_DPS_x_T3` = 2.3, `Upgrade_Cost_x_T2` = 2.5, `Upgrade_Cost_x_T3` = 5. These are now authoritative and require no further fill before lock.

**Global conversion constants** (also from `Assumptions`, for downstream tooling): HP_per_point = 10, DPS_per_point = 1.5, Range_per_point = 0.25, Speed_per_point = 0.08, Vision_base = 4, Vision_per_util_point = 0.1.

### 2.3 Damage Types & Effectiveness Matrix — 6 × 5

The counter-play layer sits on top of even raw power (GDD §7; Balance `DamageTypes`, `Effectiveness`). Six damage types × five armor classes drive matchup texture and status effects; this matrix is authored content that gates unit VFX and tuning.

- **Damage types (6):** Kinetic (baseline) · Fire (Burn DoT) · Poison (Toxin DoT; machines/energy immune) · Concussion (Stagger; hurts machinery) · Electric (Overload; chains, disables machines) · Frost (Chill; slows all **except air**).
- **Armor classes (5):** Organic · Machinery · Aircraft · Structure · Energy.

**Per-type requirement:** status-effect VFX, DoT/slow/chain behavior flags, and the full 6×5 multiplier matrix (`Effectiveness`). Design rule to preserve: Frost deals its listed damage to Aircraft but applies **no slow** to air units.

### 2.4 Character Roster — 81 heroes (9 alignments × 9 factions)

*Newly surfaced from source.* Each faction fields **9 characters, one per alignment**, spanning the spectrum **AG · PG · G · CG · N · CE · E · PE · DE** (GDD §10–§11). This is a first-class narrative content axis (previously omitted from this plan) and materially increases the authored surface.

- **Alignment model:** two hidden axes — **Polarity** (Good / Neutral / Evil) and **Conviction** (T3 Zealots {AG,PG,PE,DE} · T2 Committed {G,E} · T1 Chaotic {CG,CE} · T0 Uncommitted {N}) (GDD §10.1).
- **Relationship matrix:** a **9×9** symmetric matrix (values ++ / + / 0 / − / − −) fully **regenerable from the 11 generating rules** in GDD §10.2 — an implementer can emit and validate it against the reference matrix in §10.3.
- **Roster format:** each hero authored as **Alignment — Name — motivation**, with `[TAG]` cross-faction drama threads (GDD §11).

**Per-character requirement:** name, alignment slot, one-line motivation, and any cross-faction `[TAG]` linkage. **Validation hook:** the emitted 9×9 matrix must match §10.3 (or be regenerable from §10.2 without contradiction across all 81 characters) — a gradeable consistency test.

### 2.5 Structures — 11 + emplacements

Fort buildings and defensive emplacements, each with T1–T3 upgrades (GDD §8; Balance `Structures` sheet).

- **Buildings (11):** Blacksmith · Armory · Barracks · Stables · Science Lab · Balloons · Runway · Walls · Moats · Traps · Murder Holes (GDD §8).
