# Content-Production-Plan.md

# BULWARK — Content Production Plan

*Content-Production-Plan.md · Stage: CONTENT*
*Companion to the BULWARK GDD (v2.0), Balance Data Model (v1), and Visual & Controls Spec (v1.0).*

---

## 0. Scope & Grounding

This plan enumerates the concrete content assets BULWARK requires, derives production quantities directly from the source specifications, and sequences production against the benchmark priority stated in the GDD: **the vertical slice (§19) is the headline deliverable** (GDD §0). All other content is subordinate to shipping a gradeable slice.

Where this plan proposes ordering, batching, or cadence not fixed by the sources, those items are marked **[ASSUMPTION]**. Where the slice unit/tower identities are not visible in the provided GDD §19 excerpt, they are flagged **[UNRESOLVED — pull exact values from GDD §19 / Balance `Vertical_Slice` sheet]**.

Two content tiers structure this document:
- **Slice content** — the fixed, gradeable benchmark scope (GDD §19; Visuals §10).
- **Full-game content** — the complete roster and world tiers (GDD §4, §6, §9–§11; Balance workbook).

---

## 1. Content Inventory Summary

| Content class | Full-game count | Source |
|---|---|---|
| Factions | 9 | GDD §9; Balance `Factions` |
| Unit shape classes (silhouettes/atlases) | 8 | GDD §6; Balance `Archetypes` (Troops, Trucks, Tanks, Artillery, Heavy Tanks, Copters, Planes, Missiles) |
| Units (full roster) | 72 | Balance `Units` (= 9 factions × 8 shapes) |
| Damage types | 6 | GDD §7; Balance `DamageTypes` |
| Armor classes | 5 | GDD §7 (Organic, Machinery, Aircraft, Structure, Energy) |
| Structures / fort buildings | 11 | GDD §8; Balance `Structures` |
| Structure upgrade tiers | 3 (T1–T3) each | GDD §8; Balance `Assumptions` |
| Unit upgrade tiers | 3 (T1–T3) each | Balance `Units` (HP/DPS/Cost T1–T3) |
| Alignments per faction | 9 | GDD §10 |
| Named heroes | 81 | GDD §11 (9 factions × 9 alignments) |
| Relationship matrix cells | 81 (9×9) | GDD §10.3 |
| World tiers | 9 | GDD §4 (Path → PvP/Co-op) |

**Art-volume driver.** The 72-unit roster resolves into far more than 72 assets. Each unit is a **four-sub-layer stack** (legs/body/weapon/head — Visuals §2.1) animated across **four states** (Idle · Moving · Attacking · Death — Visuals §2.2, GDD §16). Air shapes substitute a rotor/thrust layer for legs (Visuals §2.2). Full-roster animated art is therefore on the order of **72 units × 4 sub-layers × 4 states ≈ 1,152 sub-layer animation sets** before FX and upgrade-tier variants — an order of magnitude that must not be attempted before the slice validates the pipeline.

---

## 2. The Vertical Slice — Content Definition of Done

**Priority: the primary benchmark deliverable (GDD §0).** The slice proves the full four-layer stack, the sensor→weapon telegraph, the three-part shot, the deploy loop, and deterministic replay across all three movement domains.

### 2.1 Slice unit content (Visuals §10)

Render **one walker, one floater, and one flyer**, each with the full stack and telegraph:

| Slice role | Domain | Sub-layers required |
|---|---|---|
| Walker | ground | legs · body · weapon · head/sensor |
| Floater | water surface | locomotion · body · weapon · head/sensor |
| Flyer | air | rotor/thrust · body · weapon · head/sensor + dim altitude shadow (§3, §10) |

**[UNRESOLVED]** The exact faction/shape identities of the three slice units are locked in the `Vertical_Slice` sheet. Production must pull those specific units and their T1–T3 stats from that sheet — **do not select freely**, as identity affects silhouette, weapon class, and telegraph timing.

### 2.2 Slice structure content (Visuals §5, §10)

**Three slice towers** (identities **[UNRESOLVED]** per GDD §19), each requiring the full FX lifecycle:

| Structure state | Asset |
|---|---|
| Building | rising dust around footprint for build duration |
| Complete (build/repair/upgrade) | **gold pie-sweep** — single 360° radial gold wedge; universal "done + paid" motif |
| Damaged | light smoke, scaling with damage |
| Destroyed | dust + debris burst → rubble decal |
| Lifecycle (T1+) | placing ghost · aiming/firing · upgrading 1-2-3 · selling (GDD §8) |

**Slice minimum (Visuals §10):** construction dust, gold pie-sweep, damage smoke, and destruction debris on all three towers.

### 2.3 Slice combat & FX content

- **Three-part shot** (Visuals §4): muzzle FX (flash + smoke/sparks) → traveling projectile (tracer/shell/bolt/missile, arc matched to weapon class) → impact keyed to damage type (fire burn flare, electric arc, frost shatter, per Balance `DamageTypes`).
- **Dirt-on-movement** trails under the legs layer, intensity tuned to unit mass (Visuals §3).
- **Ground shadows** for ground units; **dim altitude shadow** for the flyer (Visuals §3).
- **Kill reward FX**: coin animation + classic-console coin SFX on killing an attacker (Visuals §10).

### 2.4 Slice UI/UX content

- **Deploy loop**: select → hover preview (ghost + valid/invalid tint) → drop/cancel (Visuals §8).
- **Unit list with live pricing** — gold cost, kill-generated gold, values sourced from Balance workbook.
- **Structure contextual menu** — Upgrade (price) · Repair · Sell (sell price); selection shows dashed range circle + info window (name, damage, level).
- **Troops march from base** — path out rather than spawn at the drop point (Visuals §8).
- **One camera rotation** demonstrating layer parallax + shadow consistency (Visuals §7).

### 2.5 Slice determinism content

- **Battle log + replay path** — silent, ordered input log producing bit-identical playback; verifies the deterministic simulation contract before any content scales (GDD §16).

---

## 3. Production Sequencing **[ASSUMPTION]**

Ordering is inferred from the slice-first mandate and the art-volume dependency chain; adjust once GDD §19 identities are resolved.

1. **Pipeline spike** — build one walker end-to-end (four sub-layers × four states) + one tower full lifecycle + three-part shot for its weapon. Validates atlas, layering, and FX conventions.
2. **Complete the slice trio** — add floater and flyer (altitude shadow), remaining two towers, deploy loop, live pricing, camera rotation, kill FX, and determinism log.
3. **Slice DoD sign-off** — grade against §2 checklist; freeze conventions (gold pie-sweep, muzzle→projectile→impact, dirt trails).
4. **Faction/shape matrix rollout** — batch full-roster art **by shape class first** (all 9 factions of one silhouette share rig/anim timing), reusing slice-proven templates. This maximises rig reuse and keeps per-unit cost low.
5. **Structures, upgrade tiers, heroes, world tiers** — layer in after core combat art is stable.

---

## 4. Risks & Open Items

- **Unresolved slice identities** are the single largest planning gap; every slice art task is blocked on the `Vertical_Slice` sheet.
- **Air-shape layer substitution** (rotor/thrust for legs) must be a first-class pipeline case, proven in the slice, not retrofitted.
- **Damage-type × impact-FX combinatorics** (6 types) should be authored as a reusable impact library during the slice to avoid per-unit rework at roster scale.

---

## Key Recommendations

1. **Resolve GDD §19 slice identities immediately** — unblock all slice art before any modelling starts.
2. **Prove the full four-layer × four-state pipeline on a single walker first**; treat it as the gating milestone.
3. **Freeze FX conventions at slice sign-off** (gold pie-sweep, three-part shot, dirt trails) so roster production is pure template application.
4. **Batch full-roster art by shape class**, not by faction, to exploit shared rigs and animation timing.
5. **Do not begin the ~1,152-set roster art volume** until the slice validates that the per-unit cost is sustainable.

---

*Generated by MetaMax Research Brain (LangGraph)*