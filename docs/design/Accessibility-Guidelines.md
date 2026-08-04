# Accessibility-Guidelines.md

# Accessibility-Guidelines.md

**BULWARK — Accessibility Guidelines**

*Design-stage accessibility contract for BULWARK. This document derives concrete, buildable accessibility requirements from the BULWARK GDD (`bulwark-gdd`), the Visual & Controls Spec (`bulwark-visuals`), the balance data model (`bulwark-balance.xlsx`), and the Visual Design System (`Visual-Design-System`). It defines how BULWARK's presentation and input systems must be built so the vertical slice (GDD §19) is playable and legible across a wide range of sensory, motor, and cognitive abilities — without violating the presentation firewall (Visual-Design-System §0.2).*

**Governing rule:** Accessibility features are **presentation-layer and input-layer concerns only**. They live in C11–C18 and must never mutate the deterministic core (C6) or own balance state. All balance-keyed values (damage type, cost, tier, mass) are **read from `bulwark-balance.xlsx`** (GDD §18). An accessibility option may change *what the player sees* or *how they input*, but never *what the simulation computes* — verifiable via C19 replay determinism.

> **Source-material sync note (this revision):** This revision re-verifies every balance-keyed claim against the current project source materials — `bulwark-balance.xlsx` (v1, even-baseline) and `bulwark-gdd.md` (v2.0). Two corrections were folded in from the sources: (1) the **six damage types and their status effects** are now cited exactly as the `DamageTypes` sheet enumerates them, including which types carry a status and which do not; (2) the **status-glyph set** is reconciled to the actual statuses the workbook defines. Where this document previously implied statuses the workbook does not enumerate, those are corrected below. No balance values were changed — this document remains a read-only consumer of the workbook (§0.2).

---

## 0. Scope, Conventions & Firewall

### 0.1 Purpose

This document makes BULWARK's accessibility requirements explicit and buildable within the vertical slice. It restates and extends the presentation and input contracts of `bulwark-visuals` and the Visual Design System, consistent with three existing design commitments:

- **The presentation firewall** (Visual-Design-System §0.2): accessibility features are read-only consumers of simulation state.
- **The single-verb control model** (visuals §8): "deep game, simple hands" is already an accessibility posture; this document formalises and extends it.
- **The data-driven balance model** (balance-xlsx Overview): all damage-type, cost, and tier values are read from the workbook, so accessibility skins never require balance edits.

### 0.2 The Accessibility Firewall Corollary

| Rule | Consequence |
|---|---|
| Accessibility options live in **C11–C18** (presentation + input). | They change *what you see* / *how you input*, never *what happens*. |
| No option reads or writes **C6** (deterministic core) balance state. | Two players with different accessibility settings, given identical inputs + seed, produce **identical outcomes** and **identical C19 replays**. |
| All balance-keyed cues resolve from **`bulwark-balance.xlsx`**. | Re-skinning a cue never touches balance; re-tuning balance never breaks a cue. |

**Worked example:** An accessibility profile may render a Poison impact with a distinct texture *and* a caption *and* an icon, but the underlying event — the **Toxin** DoT applied per the `DamageTypes` sheet — is byte-identical for all players. Accessibility never confers or removes gameplay advantage.

### 0.3 Component Cross-Reference

| Accessibility domain | Owning component(s) | Source contract |
|---|---|---|
| Colour / contrast / palette | C11 (Rendering), C12 (Sprites), C15 (FX) | Visual-Design-System §1–§4 |
| Damage-type & status legibility | C15 (FX) | visuals §4; balance-xlsx DamageTypes |
| Motion / camera rotation | C17 (Camera) | visuals §7; Visual-Design-System §5 |
| Input remapping & parity | C18 (Controls) | visuals §8 |
| Audio cues & captions | C15 (FX), C18 (UX) | visuals §4, §5, §8 |
| Cognitive load / pacing / previews | C18 (Deploy loop) | visuals §8 |
| Replay-based review | C19 (Replay) | visuals §9; GDD §18 |

### 0.4 Key Definitions

| Term | Definition |
|---|---|
| **Redundant coding** | Communicating one piece of information through two or more independent channels (colour *and* shape *and* sound), so no single channel is load-bearing. |
| **Load-bearing channel** | The *only* carrier of gameplay-critical information. Accessibility requires eliminating these. |
| **Damage type** | Kinetic · Fire · Poison · Concussion · Electric · Frost — the six types enumerated by the `DamageTypes` sheet; each keys a distinct impact FX. |
| **Status effect** | The workbook-defined status a damage type may apply: **Burn** (Fire) · **Toxin** (Poison) · **Stagger** (Concussion) · **Overload** (Electric) · **Chill** (Frost). Kinetic applies **no** status ("—"). See §2. |
| **Shape class** | Troops · Trucks · Tanks · Artillery · Heavy Tanks · Copters · Planes · Missiles — silhouette communicates role (GDD §6). |
| **Deploy loop** | pick → preview → confirm/cancel; the single interaction verb (visuals §8). |
| **Input parity** | Every action works with a single pointer OR single finger; no multi-key combos, no required keyboard. |

---

## 1. Accessibility Principles

1. **No sensory channel is load-bearing (redundant coding).** Every gameplay-critical cue carries information on at least two independent channels. See §2.
2. **Preserve "deep game, simple hands."** The single-verb deploy loop and input parity are extended, never replaced. See §5.
3. **Motion is polish, not prerequisite.** Camera rotation must be reducible or disable-able without loss of legibility. See §4.
4. **Every cue is data-driven and re-skinnable.** Palettes, icons, and captions map to workbook keys, so accessibility profiles are pure presentation swaps.

---

## 2. Redundant Coding of Damage Types & Status

The six damage types in `balance-xlsx DamageTypes` currently key **only colour** in the default FX — a load-bearing colour channel, which fails colour-blind and low-vision players. Each type must carry three independent channels. The status column below is quoted directly from the `DamageTypes` sheet:

| Damage type | Status effect (workbook) | Colour (default) | Shape/icon | Motion signature |
|---|---|---|---|---|
| Kinetic | — (none) | Grey-white | Chevron | Sharp radial burst |
| Fire | Burn (DoT) | Orange | Flame glyph | Rising flicker |
| Poison | Toxin (DoT) | Green | Droplet | Slow pulsing cloud |
| Concussion | Stagger | Blue-white | Ring | Expanding shockwave |
| Electric | Overload (chain) | Cyan | Bolt | Rapid jitter |
| Frost | Chill (slow) | Pale blue | Crystal | Crystallising freeze-frame |

> **Source correction:** The `DamageTypes` sheet defines exactly five status effects — **Burn, Toxin, Stagger, Overload, Chill** — with **Kinetic carrying none**. Per the sheet's design notes: Electric **chains** to nearby targets; Frost **slows all except air units**; Poison/Frost trade raw multiplier for status utility. These behaviours are simulation-owned (C6); this document only ensures they are *legible* (C15).

**Requirement A11Y-DMG-1:** Icon and motion signature ship in the default profile — they are *not* opt-in — so no player relies on hue alone. Colour-blind palettes (Protanopia, Deuteranopia, Tritanopia) re-map the colour channel only; icon and motion are invariant.

**Requirement A11Y-STATUS-1:** Persistent statuses render a per-unit status glyph plus an optional text caption toggle. The glyph set is reconciled to the workbook's five statuses — **Burn, Toxin, Stagger, Overload, Chill** — with no glyph invented for statuses the workbook does not enumerate. Silhouette (shape class) is always readable at the game's minimum render scale.

> **Status-set reconciliation:** Earlier drafts listed "Burning, Poisoned, Slowed, Stunned." Mapped to the authoritative `DamageTypes` sheet these become **Burn** (Fire), **Toxin** (Poison), **Chill** (Frost — a slow), and **Stagger** (Concussion — a brief machine stagger, not a generic "stun"), plus **Overload** (Electric — disables machines / chains). The glyph set uses these workbook terms so captions and simulation events share one vocabulary.

---

## 3. Contrast & Palette

**A11Y-CONTRAST-1:** All gameplay-critical text and HUD elements meet **WCAG 2.1 AA** (4.5:1 for body text, 3:1 for large text and UI icons). Faction/team identity uses colour *and* a shape marker (friendly = filled, hostile = outlined).

**A11Y-PALETTE-1:** A high-contrast HUD mode boosts silhouette-to-background separation via outline stroke, independent of the world palette.

---

## 4. Motion, Camera & Vestibular Safety

**A11Y-MOTION-1:** Camera rotation (visuals §7) is a toggle with three levels — Full, Reduced (no auto-rotate; snap-only), Off (fixed isometric). Gameplay legibility must hold at all three; nothing gameplay-critical is communicated *only* through camera movement.

**A11Y-MOTION-2:** Screen shake, bloom, and full-screen flashes each have independent intensity sliders (0–100%). The **gold pie-sweep** confirmation (visuals §5) at 0% shake still renders its radial flash — because it is a *confirmation cue*, its redundant icon+sound channels satisfy the signal.

**A11Y-FLASH-1:** No effect exceeds **3 flashes/second** at default intensity (photosensitive-epilepsy safe, per WCAG 2.3.1).

---

## 5. Input Parity & Motor Accessibility

**A11Y-INPUT-1:** Every action is achievable via single pointer or single finger. No action requires simultaneous inputs, held modifiers, or a keyboard.

**A11Y-INPUT-2:** Full remapping of every bound action, including on-screen touch targets sized ≥ 9mm (per platform touch guidance). Adjustable dwell/hold thresholds for confirm.

**A11Y-INPUT-3:** The deploy loop supports an explicit **confirm/cancel** stage, so no action is committed on a single accidental tap — protecting players with tremor or imprecise input.

---

## 6. Audio & Captions

**A11Y-AUDIO-1:** Every load-bearing audio cue (lock-on wind-up, impact, gold confirmation) has a visual counterpart. The **telegraphing rule** (sensors lead, weapon follows; wind-up = time-to-fire) is fully readable
