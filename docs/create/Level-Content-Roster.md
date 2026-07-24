# Level-Content-Roster.md

# Level-Content-Roster.md

*BULWARK — Vertical Slice Content Roster & Data Bill-of-Materials*

**Version:** 1.1 · Companion to Sample-Level.md ("The Clearing"), the BULWARK GDD (§19 vertical slice, §6 units, §8 structures), the Visual & Controls Spec (§10 slice visual scope), and the Menu-System spec.
**Data source of truth:** `bulwark-balance.xlsx` — sheets *Vertical_Slice, Units, Structures, Assumptions, Effectiveness, Faction_Mods, DamageTypes.*
**Cross-refs:** Sample-Level §2–§6; GDD §4/§6/§7/§8/§19; Visuals §2/§5/§8/§10.

---

## 1. Purpose & Scope

Sample-Level.md fixes *the encounter* — one board, one attacker faction, three waves, three build phases. This document fixes *the manifest*: every unit, structure, tier, stat, and asset that encounter instantiates, transcribed directly from `bulwark-balance.xlsx` so implementers populate the slice from one identical bill-of-materials instead of re-reading spreadsheets and quietly diverging.

**This roster does not invent content.** It transcribes the locked `Vertical_Slice` selection and its upstream `Units`/`Structures` rows, then annotates each entry with the tier-scaling math (`Assumptions`) and the damage-vs-armor multipliers (`Effectiveness`) the slice's combat resolves against. Where Sample-Level.md states design *intent* ("HP-driven escalation," "upgrade or die"), this document supplies the numbers that make that intent true and testable.

The slice's **visual definition of done** lives in Visuals §10; its **gradeable systems scope** lives in GDD §19. This roster is the content those two lists operate on.

---

## 2. Roster at a Glance

| Category | Count | Source | Notes |
|---|---|---|---|
| Attacker faction | 1 | Factions row 1 | Ground / Powder (Nationalistic) |
| Attacker unit types | 5 | Units `GND-*` | 4 walkers + 1 flyer (Sample-Level §4) |
| Defender | Player on Base | GDD §6 | Fixed Castle-tier fort |
| Slice structures | 3 | Structures sheet | anti-ground · anti-air · wall/utility |
| Tier band exercised | T1 → T2 → T3 | Assumptions | player upgrade mandatory by Wave 3 |
| Damage types in play | Kinetic (attacker only) | DamageTypes / Effectiveness | `1.0` vs all armor except Energy (`1.1`) |
| Armor classes present | Organic, Machinery, Aircraft, Structure | Units / Structures | attacker mix + player buildings |

**Read of the manifest.** The attacker roster is monochrome by design — every `GND-*` unit deals **Kinetic**, rated `1.0` against Organic, Machinery, Aircraft, and Structure. This is precisely why Ground / Powder is the chosen slice attacker (Sample-Level §2): with no damage-type texture on the incoming side, the *player's* counter-picks and the HP curve become the only variables under test. Introducing an Energy attacker would add a second axis and muddy first-pass balance reads.

---

## 3. Attacker Unit Manifest (Ground / Powder)

All rows transcribed from `Units` (`GND-*`). T1 values are the slice's opening numbers; attacker units always arrive at their listed **T1** stats. T2/T3 columns matter because Wave 3 pressure assumes the *player* has climbed the tier curve.

| Field | GND-Troops | GND-Trucks | GND-Tanks | GND-Copters | GND-HeavyTanks |
|---|---|---|---|---|---|
| **Role** | Skirmisher | Support | Bruiser | Harasser | Juggernaut |
| **Domain** | Walker | Walker | Walker | **Flyer** | Walker |
| **Armor Class** | Organic | Machinery | Machinery | Aircraft | Machinery |
| **Damage Type** | Kinetic | Kinetic | Kinetic | Kinetic | Kinetic |
| **Can Target** | Ground | Ground | Ground | Both | Ground |
| **Targets** | Base | Base | Base | Base | Base |
| **HP T1** | 220 | 275 | 440 | 220 | 605 |
| **DPS T1** | 45 | 15 | 45 | 45 | 37.5 |
| **Range** | 2.5 | 1.25 | 3.75 | 5.0 | 3.0 |
| **Speed** | 1.84 | 2.944 | 0.736 | 1.84 | 0.368 |
| **Vision** | 5.5 | 6 | 4.5 | 4.5 | 4.3 |
| **Radar-Detect** | No | No | No | Yes | No |
| **Sees Ground** | No | No | No | Yes | No |
| **Cost T1 (g)** | 300 | 297.9 | 309.6 | 300 | 315.3 |
| **First Wave** | 1 | 1 | 2 | 2 | 3 |

**Manifest notes.**

- **Every attacker targets the Base, not structures.** No slice unit is a Siege/Artillery shape, so none flag `Targets → Structures` (GDD §6). Player buildings are *hazards to route around*, not primary targets — which is exactly why the wall/utility structure (§4.3) earns its slot: it **reroutes the march**, it does not get rushed.
- **GND-Copters is the sole air unit** — the only row with `Radar-Detect: Yes` and `Sees Ground: Yes`, the mandated **flyer** (Visuals §10), and the reason the anti-air structure (§4.2) must exist by Wave 2. Note its outlier `Range 5.0` and dual-domain targeting: it can chip the Base from beyond most ground-tower ranges, making it a soft-DPS threat rather than a brute.
- **GND-Trucks is the intentional non-threat** — 15 DPS at 2.944 speed. It teaches "not everything is a killer" while stress-testing target-priority AI: a fast, cheap, low-value mover the player's towers *should deprioritise* in favour of Tanks/HeavyTanks.
- **HP-driven escalation is literal in the data:** 220 → 440 → 605 across the wave arc. Count stays low; the health wall climbs. GND-HeavyTanks at 605 HP and Speed 0.368 is the "upgrade or die" gate — slow enough to focus-fire, tanky enough to punish un-upgraded towers.

### 3.1 Effective DPS by target armor (Effectiveness sheet, Kinetic row)

Because every attacker is Kinetic (`1.0` vs Organic/Machinery/Aircraft/Structure), effective DPS equals raw DPS against all present armor. Transcribed from `Units.EffDPS`:

| Unit | EffDPS vs Organic | EffDPS vs Machinery | EffDPS vs Aircraft |
|---|---|---|---|
| GND-Troops | 45 | 45 | 0 |
| GND-Trucks | 15 | 15 | 0 |
| GND-Tanks | 45 | 45 | 0 |
| GND-Copters | 45 | 45 | 45 |
| GND-HeavyTanks | 37.5 | 37.5 | 0 |

The `0` vs Aircraft for every walker is the mechanical enforcement of `Can Target: Ground` — walkers **cannot** hit air, so a player leaning only on anti-ground towers loses to Copters regardless of tier. Copters, being dual-domain, are the only attacker that can threaten a defensive air-frame if one existed. This asymmetry is the puzzle Wave 2 poses.

---

## 4. Defender Structure Manifest (3 slice structures)

Transcribed from `Structures`. Player fort is fixed **Castle-tier**; all three structures are upgradeable T1→T3.

| Field | Anti-Ground Tower | Anti-Air Tower | Wall / Redirector |
|---|---|---|---|
| **Role** | Ground DPS | Air denial | Pathing / utility |
| **Can Target** | Ground | Air | — (blocker) |
| **Damage Type** | Kinetic | Kinetic | — |
| **HP T1 → T3** | 400 → 900 | 350 → 780 | 800 → 1600 |
| **DPS T1 → T3** | 60 → 150 | 55 → 140 | — |
| **Range** | 3.5 | 6.0 | — |
| **Cost T1 (g)** | 350 | 375 | 200 |

**Manifest notes.**

- **The three-structure set maps 1:1 to the three attacker threats:** walkers (anti-ground), Copters (anti-air), and pathing pressure (wall). Removing any one makes a wave unwinnable — this is the minimum sufficient toolkit, not a sampler.
- **Anti-Air range 6.0 > Copter range 5.0** by design: a correctly placed AA tower out-ranges the flyer and kills it before it fires. Mis-placement inverts the trade. This is the slice's one genuine positioning skill-check.
- **Wall/Redirector has no DPS.** Its value is entirely `HP × pathing`: it forces the walker column into the kill-zone of the anti-ground tower, converting raw HP tables into a *time-in-range* advantage.

---

## 5. Tier-Scaling Reference (Assumptions sheet)

The player must reach **T2 by Wave 2** and **T3 by Wave 3** or fail the HP wall. Per-tier multipliers applied to structure T1 base:

| Tier | HP × | DPS × | Cost × | Unlocks by |
|---|---|---|---|---|
| T1 | 1.00 | 1.00 | 1.00 | Wave 1 |
| T2 | 1.50 | 1.60 | 1.80 | Wave 2 |
| T3 | 2.25 | 2.50 | 3.20 | Wave 3 |

DPS scales faster than HP (2.5× vs 2.25× at T3) — upgrading is offensively rewarded, incentivising the intended "climb, don't turtle" loop against GND-HeavyTanks' 605 HP.

---

## 6. Key Takeaways

1. **Monochrome attacker is deliberate.** All-Kinetic incoming isolates the HP curve and player counter-pick as the sole test variables — do not add Energy attackers to this slice.
2. **Three threats, three tools, no slack.** Anti-ground, anti-air, and wall each answer exactly one attacker vector; the roster is minimum-sufficient, and cutting any structure breaks a wave.
3. **Air is a hard gate, not a soft one.** Walkers deal `0` to Aircraft; Copters at Wave 2 are unwinnable without the AA tower placed inside its 6.0 range.
4. **Escalation lives in HP, not count.** 220 → 440 → 605 with slow HeavyTanks forces upgrading; DPS-favoured tier scaling rewards it.
5. **Ship this as one manifest.** Implementers should populate the slice from this table set alone — divergence from `bulwark-balance.xlsx` is a bug, not a variation.

---

*Generated by MetaMax Research Brain (LangGraph)*