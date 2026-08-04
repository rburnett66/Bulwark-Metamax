# Sample-Level.md

# Sample-Level.md

*BULWARK — Vertical Slice Sample Level Specification*

**Version:** 1.1 · Companion to the BULWARK GDD (§19 vertical slice, systems source of truth), the Visual & Controls Spec (presentation & input contract), and the Menu-System spec (UI wiring). Data-bound to `bulwark-balance.xlsx` (Vertical_Slice, Units, Structures, Assumptions).

**Cross-refs:** GDD §3 (loop), §4 (scale tiers), §5 (terrain/vision), §7 (combat & damage types), §8 (structures), §19 (vertical slice); Visuals §1 (z-order), §5 (structure FX), §7 (camera), §8 (deploy loop), §10 (slice visual scope); Menu-System §3–§5 (HUD, deploy loop, structure menu).

---

## 1. Purpose & Scope

This document authors **one concrete, playable level** — the reference battle every implementer builds identically so results compare head-to-head (GDD §0, §19). It **does not invent** balance or systems; it selects an existing tier, faction, and units/structures from the locked source data and stitches them into a single defend-and-fortify encounter.

The slice's **visual definition of done** is fixed in Visuals §10; the slice's **gradeable scope** is fixed in GDD §19. This level is the world those two lists live inside.

**Design intent (pillar §5 "simple front, deep back"):** teach the full loop — Scout → Fortify → Defend → Collect → Upgrade → next wave — on a small board, using **no rules that don't scale to planets**.

---

## 2. Level at a Glance

| Field | Value | Source |
|---|---|---|
| **Working name** | "The Clearing" | GDD §1 high concept |
| **Tier** | Castle (fixed base + defenses) | GDD §4 |
| **Board** | Field-with-coast: open ground, one river/coast edge, a mountain choke | GDD §4, §5 |
| **Defender** | Player, on the Base | GDD §6 |
| **Attacker faction** | **Ground / Powder** (Nationalistic) | GDD §9, Vertical_Slice sheet |
| **Structure** | 3 waves + 2 build phases | GDD §3 cadence |
| **Session length** | Battle → Build → Battle → Build → Battle (short) | GDD §3 |
| **Slice units** | walker + flyer per Visuals §10 | Vertical_Slice sheet |
| **Slice towers** | 3 structures (see §6) | GDD §19, Visuals §10 |

**Why Castle tier.** It is the first tier that introduces the **structure lifecycle** (place → repair → upgrade → sell) and a **fixed base with hard-point slots** (GDD §4, §8; Visuals §8) — exactly the subsystems the slice must grade independently (GDD §0). Path/Field tiers are too thin to exercise the lifecycle; Kingdom+ layers on economy management the slice deliberately excludes.

**Why Ground / Powder as attacker.** It is the baseline faction: Kinetic signature damage (`1.0` vs every armor class except Energy, per Effectiveness sheet), net-neutral modifiers (`Avg_x ≈ 1.005`, Faction_Mods sheet), and the cleanest silhouette read (infantry + armor). It teaches the counter graph without ambushing a first-time player, and its roster is the workbook's first block (`GND-*`).

---

## 3. Board Layout

The board honours the three non-negotiable domains (GDD §2, §5): ground, water, air. It reads in a single non-rotated screen but **rewards one camera rotation** (Visuals §7, §10) to expose layer parallax.

```
              [ MOUNTAIN CHOKE ]  ← high ground, narrow lane
                     │
   [ RIVER / COAST ] │  ← water lane (floaters/swimmers)
        ~~~~~~~~~~~~~ │
   ═══════════════════════════════  ← open ground (main march lane)
                     │
                 [ BASE ]  ← player fort, hard-point slots
                     │
              (camera start: cinematic auto-rotate
               frames BASE ↔ incoming threat)
```

- **Open ground (main lane).** Walkers path here toward the Base; the bulk of Waves 1–3 arrive along it.
- **River / coast edge.** A side water lane (GDD §4, §5). Present in this slice for **domain read** — swimmers ride sub-surface, floaters ride the surface tint (Visuals §6). Ground / Powder has no native water unit, so the coast is **scouting texture and future-tier setup**, not a live Wave-1 threat.
- **Mountain choke.** A narrow high-ground lane (GDD §4, §5 "terrain is a weapon"). Walls/terrain here **rout attack paths** (GDD §8) — the natural place to spend the first structure.
- **Base.** The fixed fort. Structures snap to **hard-point slots only**; slot count scales with Base level (GDD §8; Visuals §8; Menu §4). The slice opens **slot-constrained on purpose** — added capacity is the Day-Build reward.

**Camera opening (Visuals §7).** On load, the camera auto-rotates to frame the **Base ↔ incoming-threat relationship** before handing control to the player, establishing where the first wave lands.

---

## 4. Attacker Roster (Ground / Powder)

All values pulled from the Units sheet (`GND-*`). Kinetic reads `1.0` against Organic / Machinery / Aircraft / Structure (Effectiveness sheet), making these the clean, texture-free baseline.

| Wave | Unit | Role | HP T1 | DPS T1 | Range | Speed | Armor | Cost (g) | Teaching Note |
|---|---|---|---|---|---|---|---|---|---|
| **1** | GND-Troops | Skirmisher | 220 | 45 | 2.5 | 1.84 | Organic | 300 | Baseline infantry; targets Base, not structures. |
| **1** | GND-Trucks | Support | 275 | 15 | 1.25 | 2.944 | Machinery | ~298 | Fast, low-DPS — "not everything is a killer." |
| **2** | GND-Tanks | Bruiser | 440 | 45 | 3.75 | 0.736 | Machinery | ~310 | Slow, tanky — the first health check. |
| **2** | GND-Copters | Harasser (air) | 220 | 45 | 5.0 | 1.84 | Aircraft | 300 | **Flyer** (Visuals §10 requirement); dim altitude shadow. |
| **3** | GND-HeavyTanks | Juggernaut | 605 | 37.5 | 3.0 | 0.368 | Machinery | ~315 | Wave-3 spike — the "upgrade or die" moment. |

**Wave-composition logic.** Wave 1 establishes reading (fast harmless truck + baseline infantry). Wave 2 introduces the first *air* threat (Copters) and the first *armor* wall (Tanks), forcing coverage across two domains simultaneously. Wave 3 caps HP (Heavy Tanks) so an un-upgraded structure line cannot clear it in time — this is where the Day-Build upgrade path becomes mandatory, not optional. The escalation curve is HP-driven, not count-driven, keeping unit spawns readable at slice camera distance.

---

## 5. Wave & Build Cadence

| Phase | Type | Player Objective | Loop Beat Taught |
|---|---|---|---|
| Battle 1 | Defend | Hold Base vs Wave 1 | Defend + Collect |
| Build 1 | Fortify | Repair, place 2nd structure, upgrade | Fortify + Upgrade |
| Battle 2 | Defend | Cover ground + air (dual domain) | Defend under pressure |
| Build 2 | Fortify | Unlock slot, tier-up a structure | Upgrade decision |
| Battle 3 | Defend | Survive HP spike | "Upgrade or die" payoff |

Each Build phase grants gold collected from the prior wave, closing the **Collect → Upgrade** economy loop without a standalone economy UI (deferred to Kingdom+ tier).

---

## 6. Slice Structures

Three structures per GDD §19 / Visuals §10 — one anti-ground, one anti-air, one wall/utility — so every attacker armor class has a legible counter and the **placement / repair / upgrade / sell** lifecycle is fully exercisable within three waves.

---

## Key Takeaways

- **Reference-first, not creative-first.** Every element is drawn from locked source data; the level's value is that all implementers build it identically for comparable grading.
- **Castle tier is the minimum viable teacher** — it is the earliest tier exposing the full structure lifecycle and hard-point slot system the slice must grade.
- **Ground / Powder is the neutral baseline** (Kinetic `1.0`, `Avg_x ≈ 1.005`), teaching the counter graph without punishing new players.
- **Escalation is HP-driven across three waves**, making the Day-Build upgrade path mandatory by Wave 3 rather than optional — the loop's core payoff.
- **Three domains, three structures, three waves** keep the board readable in one screen while proving ground, air, and terrain-routing systems all function.

---

*Generated by MetaMax Research Brain (LangGraph)*