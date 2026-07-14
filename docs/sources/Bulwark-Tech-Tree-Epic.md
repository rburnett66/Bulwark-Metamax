# Bulwark — Tech Tree Epic

**Status:** design locked on layout; content values (order, stat impact, pricing) are placeholders to tune in playtest.
**Design proof:** interactive artifact (see `bulwark-tech-tree-proof.html` in this folder) + Claude Artifact URL in the chat thread.
**Reference art:** `docs/art/Reference/IMG_6938.jpeg` (the mockup this interprets).

---

## 1. Concept

A single **Tech Tree** screen where the player permanently upgrades the Bulwark between runs. Reads
like the reference mockup — a root **SYS-BASE** node fanning out through **curved, color-coded paths**
into image-forward node cards, with a gold **ULTIMATE** capstone, a tier-progress panel, and a
selected-node **inspector** carrying the RESEARCH/UNLOCK button.

Two currencies of progression, kept deliberately separate:

| Axis | How it advances | What it does |
|------|-----------------|--------------|
| **Tier clearance** (1–4) | Beat a faction on **Map 2** — any order, one tier per victory | Gates which upgrades are even *visible/buyable* |
| **Gold** | Collected in-run, banked between runs | Actually *purchases* an unlocked upgrade |

So clearance is earned by skill/progression; the upgrade itself is bought with economy. You can be
Tier 4 and broke, or rich and Tier 1 — both gate you.

---

## 2. The four economies (columns / paths)

Each path is a color lane (color coding is a hard design requirement per the owner). Five nodes each,
staggered up in tier and price down the column.

| Path | Color | Theme | Nodes (T = tier gate) |
|------|-------|-------|-----------------------|
| **Base Systems** | gold `#f2c869` | core base defense & guns | Reinforced Hull (T1) · Cannon Calibration (T1) · Threat Awareness (T2) · RPG Battery (T3) · SAM Site (T4) |
| **Economy** | green `#57d98a` | yield & sustain | Core Capacity (T1) · Output Boost (T1) · Extended Reach (T2) · Dual Refinery (T3) · L4 Repair Bay (T4) |
| **Structures** | blue `#4aa3ff` | turret & wall tech | Bulwark Plating (T1) · Munition Upgrade (T1) · Targeting Optics (T2) · Layered Armor (T3) · Repair Slot IV (T4) |
| **Hi-Tech** | purple `#b06cff` | drones & exotic | Repair Drone (T2) · Mining Drone (T2) · Early Warning Net (T3) · L3 Troop Command (T4) · L4 Energy Core (T4) |

**ULTIMATE — Apocalypse Cannon (MK VII):** capstone; requires all 4 tiers unlocked; big gold sink
(placeholder 25,000). Overcharges the base super-cannon into a map-wide strike.

> ECONOMY vs STRUCTURES intentionally share stat *names* (HP/Damage/Range/Dual/Repair) but different
> *subjects*: Economy buffs the base + harvesters; Structures buffs deployed cannon/flak/wall.

### Placeholder pricing (staggered by tier — TO TUNE)

`T1 ≈ 400–500 · T2 ≈ 900–1500 · T3 ≈ 1800–2600 · T4 ≈ 3200–4500 · ULT 25,000`

The staggering rule to preserve when we retune: **cost climbs with tier**, and a path's later nodes
should each cost more than its earlier ones, so the player makes real choices about where gold goes.

---

## 3. Screen behavior

- **Node states:** locked (tier > clearance, dimmed + lock icon) · buyable (tier ≤ clearance, gold ≥ cost) ·
  can't-afford (tier ≤ clearance, gold < cost — shown but RESEARCH disabled) · owned (green tick, "Researched").
- **Select** any non-locked node → inspector shows art, description, stat delta chip(s), cost, and a
  **faction-influence** readout (ties into the campaign alignment axis — some upgrades lean the
  player's alignment darker/lighter). Clicking a locked node explains *how* to unlock (beat a Map-2 faction).
- **RESEARCH** deducts gold, marks owned, refreshes the tree + resource chips, fires a confirm toast.
- **Tier panel** shows 1–4 with which are unlocked and the "beat a Map-2 faction" hint for the rest.
- **Resource chips** (top-right): Gold bank · Tiers X/4 · Map-2 factions beaten X/9.
- **Curved connectors:** SVG bezier from root → each path header, then a spine down each column.
  Redrawn on resize; hidden on narrow mobile where the grid reflows to 2-up.

---

## 4. Save schema additions (`bulwark:save`)

Extends the existing v1 save (additive; `migrate()` fills defaults):

```
tech: {
  owned: { [nodeId]: true },     // researched upgrades
}
techTier: 0,                     // 0–4, = number of distinct Map-2 factions beaten
// (Map-2 faction wins already tracked via factionRecords / map completion — techTier derives from that count, capped 4.)
```

Node IDs are stable strings (`b-def`, `e-hp`, `s-rng`, `h-l3`, …) so reordering/retuning the display
never breaks saves. Owning `ult` requires `techTier >= 4`.

**Wiring to gameplay (later stories):** each owned node maps to a modifier applied in `createSim`/carry
at t=0 (deterministic), same channel as harvesterLevel / structTiers. This epic ships the *screen +
data + economy*; the stat hookups land per-node as balance is decided.

---

## 5. Build stories

1. **Data model** — `src/menu/techtree.data.js`: PATHS, NODES, ULT, stable IDs, placeholder tier/cost/stat/infl. ✅ mirrors proof.
2. **Screen** — TECH TREE screen in `menu.js` (DOM overlay, `bwm-` styling extended with path colors + SVG wires). Replaces the old flat TECH screen.
3. **Economy wiring** — read/write `save.tech.owned` + `save.techTier`; RESEARCH spends `goldBank`; derive techTier from Map-2 faction wins.
4. **Stat hookups** — per-node modifiers applied at sim start (own story per node cluster; gated on balance pass).
5. **Ultimate** — Apocalypse Cannon effect + all-tiers gate.
6. **Art** — replace SVG glyph stand-ins with real per-upgrade images from the sprite-atlas pipeline.

### Deferred / to tune in playtest
- Final node **order**, **stat impact**, and **pricing** (owner: "we will shuffle later").
- Which nodes carry **faction influence** and how much.
- Whether tier clearance caps at 4 or extends (currently 4 = 4 Map-2 factions).
