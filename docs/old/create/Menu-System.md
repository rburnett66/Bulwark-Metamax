# Menu-System.md

# Menu-System.md

*BULWARK — Menu & UI Interaction Specification*

**Version:** 1.1 · Companion to the BULWARK GDD (systems source of truth) and the Visual & Controls Spec (presentation & input contract).
**Cross-refs:** GDD §3 (core loop), §7–§8 (structures & derived costs), §9–§11 (factions/alignment/heroes), §19 (vertical slice); Visuals §1 (z-order), §5 (structure lifecycle FX), §7 (camera), §8 (controls & UX), §9 (replay); `bulwark-balance.xlsx` (Units, Structures, Assumptions).

---

## 1. Scope & Principles

This document specifies the **menu and in-game UI layer** for BULWARK. It does not author balance, systems, or content; it wires the existing GDD and Visual specs into a coherent screen-and-panel model that any implementer can build against without re-deriving intent.

**Governing principle (Visuals §8): *deep game, simple hands.*** A single interaction verb — **pick → preview → confirm/cancel** — covers nearly every action. Two hard constraints follow:

- **Input parity.** Every action must complete with one pointer (mouse) *or* one finger (touch). No multi-key combos, no keyboard requirement, no hover-only affordances (touch has no hover state).
- **Domain separation.** UI splits into two z-order domains that behave differently under camera rotation:

| Domain | Contents | Layer | Rotates with world? |
|---|---|---|---|
| **World UI** | Placement ghosts, range circles, coin/bounty animations, march paths | 2–12 | **Yes** |
| **HUD / menu UI** | Gold readout, unit/structure lists, phase indicator, context menus | 14 | **No** |

**Always-visible core reads** (non-negotiable, per Visuals §8):
- **Live pricing** on every unit/structure list entry — "each unit costs gold to create, each kill generates gold."
- **Affordability state** — the player never has to do mental arithmetic to know what they can buy.
- **Current gold balance** — the loop currency (earned in Day Battle, spent in Day Build; GDD §3).

---

## 2. Menu Map (top level)

Replays are first-class from the Main Menu (Visuals §9), so the menu tree must expose them as a peer of Play — not buried under Options.

```
Main Menu
├── Play  ─────────────► scale/continent select ► battle
├── Replays ───────────► reconstructed from the battle-log stream (Visuals §9)
├── Factions / Codex ──► 9 factions (GDD §9), unlocked rosters, 81-hero alignment set (§11)
├── Options ───────────► input, audio, camera, accessibility
└── Quit
```

| Item | Purpose | Source |
|---|---|---|
| **Play** | Enter a battle. Scale ramps path → castle → kingdom → continent → planet → PvP/co-op. | GDD §1, §4 |
| **Replays** | Browse and re-drive recorded battles from the invisible log stream; doubles as the **determinism check** (a divergent replay signals a desync bug). | Visuals §9 |
| **Factions / Codex** | Reference the 9 asymmetric factions, their counter graph, unlocked rosters, and the 81-hero alignment matrix. | GDD §9–§11 |
| **Options** | Input, audio, camera, accessibility. | — |
| **Quit** | Exit. | — |

---

## 3. In-Battle HUD

The HUD is screen-fixed on **layer 14 and never rotates**, even as the player spins the world (Visuals §7). Its purpose: keep the loop currency and the deploy surface within a single tap at all times.

| Element | Content | Behaviour |
|---|---|---|
| **Gold readout** | Current gold balance. | Rises on kills (bounties + captures, GDD §3); falls on build/upgrade/repair/deploy spend. Animate deltas so the player links cause to effect. |
| **Unit list** | Deployable units. | **Live create cost** per unit (Visuals §8); values from `bulwark-balance.xlsx` Units (Cost T1/T2/T3). |
| **Structure list** | Buildable fort structures. | Same live-pricing rule; values from Structures sheet. |
| **Phase / wave indicator** | Day Battle vs. Day Build; current wave in the continent series. | GDD §3 cadence. Must telegraph the *next* phase so players prep before the switch. |
| **Camera rotate control** | First-class control to rotate the world. | Re-runs depth sort + re-projects shadows (Visuals §7). |

### 3.1 Live pricing & affordability

Cost is **derived data, never hardcoded** (GDD §7, §18). The canonical formula:

> `gold_cost = power × Cost_per_power_gold`

with `Cost_per_power_gold = 3`, and tier multipliers `Upgrade_Cost_x_T2 = 2.5` and `Upgrade_Cost_x_T3 = 5` from `bulwark-balance.xlsx` Assumptions. **Worked example:** a T1 unit of power 10 costs `10 × 3 = 30g`; its T2 form costs `30 × 2.5 = 75g`; its T3 form costs `30 × 5 = 150g`.

Because prices flow from the sheet, a balance patch requires **zero UI code changes** — the lists re-read on load. Entries the player cannot afford must render in a distinct **unaffordable state** (dimmed + disabled tap target), and that state must re-evaluate live as gold rises and falls mid-battle.

---

## 4. The Deploy Loop (units & structures)

The one verb, applied to placement. Byte-identical on mouse or touch (Visuals §8).

1. **Select** a unit or structure from the list.
2. **Preview.** Hover (mouse) or drag (touch) to a location; a **placement ghost** shows with a **valid/invalid tint**. Invalidity has three causes — **space, terrain, or cost** (Visuals §8; ghost FX per Visuals §5 "Placing").
3. **Confirm** to deploy, or **cancel** to abort with no spend.

**Deployment-specific rules — read these carefully; they defy tower-defense convention:**

- **Troops march from base; they do *not* spawn at the drop point.** The drop point is a **destination order**, not a spawn location. Units path out from the player's base along the world's march lanes (world-UI path FX). UI must make this legible or players will misread deploy latency as a bug — show the origin, the destination, and the march line during preview.
- **Structures snap to fixed hard-point slots only.** Defenses cannot be free-placed; they occupy **hard-point slots** on the Base. **Slot count scales with Base level** — early game is deliberately slot-constrained, and additional capacity is a *progression reward*. The preview must reflect live slot availability: an occupied or not-yet-unlocked slot reads as **invalid**, distinct from a cost/terrain rejection so the player learns *why* placement failed.

---

## 5. Structure Context Menu

**Tap/click an existing structure** opens its contextual menu (Visuals §5, §8) and draws a **dashed range circle** in the world (world UI, so it tracks rotation).

| Field / Button | Content | Notes |
|---|---|---|
| **Name** | Structure name. | From Structures sheet. |
| **Damage / Health** | Current health state. | Drives the Repair decision; visualize as a bar, not raw numbers. |
| **Level** | Tier 1 / 2 / 3. | Upgrade lifecycle, GDD §8. |
| **Upgrade (with price)** | Advance one tier; shows gold price via the tier multipliers (§3.1). | Disabled/unaffordable state when gold is short or already at T3. |
| **Repair (with price)** | Restore health over time. | Scale cost to missing health so full-repair-vs-rebuild stays a real decision. |
| **Sell (with price)** | Remove for a **partial refund**. | GDD §8 lifecycle; selling FX per Visuals §5. |

**Buildable structures (GDD §8):** Blacksmith · Armory · Barracks · Stables · Science Lab.

Every priced button here is subject to the same **live-pricing and affordability** rule as the deploy lists — no exceptions.

---

## 6. Key Recommendations

1. **Single source of truth for cost.** Bind all displayed prices to `bulwark-balance.xlsx` at load time; never hardcode a gold value in UI. This keeps balance iteration a data-only task.
2. **Design for touch first, mouse for free.** No hover-only reveals, no combos. If it works with one finger, it works everywhere.
3. **Never rotate the HUD; always rotate world UI.** Enforce the layer-14 (HUD) vs. layer-2–12 (world) split rigidly — it is the difference between a readable and a nauseating camera experience.
4. **Distinguish invalidity causes.** Cost, terrain, space, and *slot-locked* rejections should read differently in the placement preview so players learn the rules instead of guessing.
5. **Teach the march model in the UI.** Since troops originate at base rather than the drop point, surface origin → destination → path during preview to prevent perceived input lag.
6. **Make affordability reactive.** Recompute affordable/unaffordable state continuously as gold changes mid-battle, not just on panel open.

---

*Generated by MetaMax Research Brain (LangGraph)*