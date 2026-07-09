# Platform & Technology Considerations

*IDEA Stage Research Artifact — Project "Bulwark MM" (working title)*
*Category: Multi-faction, multi-domain Tower Defense with automated balance sim*
*Target platform: Web browser | Presentation: layered 2.5D (fake-3D via stacked 2D sprites) | Session length: `Scout → Fortify → Defend → Collect → Upgrade` loop*

---

## 0. Scope & Grounding

This document evaluates technical feasibility for a **web-first, browser-native** multi-faction, multi-domain **Tower Defense** with a deterministic, headless-callable balance sim (`bulwark-gdd` §17), a character-driven alignment/drama system (§10–§12), and a scale ramp from single lane to planet-scale PvE→PvP→co-op (§4).

Claims about engine capabilities, browser APIs, and platform limits reflect the **2025–2026 web platform state**. This revision incorporates the authoritative source docs — **`bulwark-gdd.md`** (systems, now **v2.0**) and **`bulwark-visuals.md`** (rendering, controls, replay) — together with the canonical balance workbook **`bulwark-balance.xlsx`** (the data-driven stat source), plus the **IDEA-stage artifacts** now folded into this project, so prior `[ASSUMPTION]` gaps around presentation model, controls, and determinism are resolved from source.

> **Source-change tracking (this revision).** Per the standing directive to track changes on the source files (including the GDD), the technical baseline below is reconciled against the **current GDD v2.0** and the **canonical `bulwark-balance.xlsx`** workbook. Key source-driven deltas folded in this pass:
> - The GDD now explicitly frames itself as a **benchmark spec** whose **headline deliverable is the vertical slice (§19)** — the sim/render split and headless-core recommendations below are re-anchored on that acceptance surface.
> - Balance is **fully data-driven and externalized** to `bulwark-balance.xlsx` (Overview: *"no hardcoded balance in game code"*). Concrete authoritative tables now exist and drive the data-loading recommendations in §2: the **8 archetype 100-pt power budgets** (Archetypes sheet), the **9-faction net-neutral modifier tilts** (Faction_Mods, `Avg_x ≈ 1.00`), the **6×5 effectiveness matrix** (Effectiveness sheet), the **6 damage types + status effects** (DamageTypes sheet), the **72-unit roster with T1–T3 stats and derived cost** (Units sheet), and the **global tuning constants** (Assumptions sheet — e.g. `Cost_per_power_gold = 3`, `HP_per_point = 10`).
> - Cost is **derived from power** via a flat gold-per-power rate (Assumptions), and *"true prices are resolved later by the automated sim (GDD §17)"* — reinforcing that the client must **load a computed price table, never compute or hardcode balance**.

**Rendering direction (confirmed by source):** the game **fakes 3D with stacked, independently-animated 2D surfaces** sorted back-to-front (painter's algorithm) — `bulwark-visuals` §1–§2. This is a **2D/2.5D** presentation, not full 3D, and anchors every recommendation below on **Pixi.js**, a high-performance WebGL/WebGPU **2D** rendering library. The layered z-order, four-sub-layer unit stacks, shadow/altitude cues, and camera rotation are all 2D-sprite techniques Pixi is well suited to.

**Two hard architectural constraints from source (drive everything below):**
- **Sim/render separation with a headless-callable combat core** (`bulwark-gdd` §18, §19.1). The deterministic balance sim (§17) runs automated battles headless to derive unit prices from the power budgets in `bulwark-balance.xlsx`; the same core must be reachable without rendering.
- **Determinism under seed** (`bulwark-gdd` §18; `bulwark-visuals` §9). Every battle writes an invisible ordered log stream (inputs + seed + events); replays re-drive the same core and are the acceptance test for both determinism and the headless core.

**Cross-cutting IDEA-artifact linkage:** the recommendations here are the technical counterpart to the sibling IDEA docs (concept, market/audience, monetization/live-service, art/audio direction, and risk register). Where those artifacts assert a design intent — single-pointer input parity, additive faction/story content cadence, replay-as-proof, sub-5MB fast-load — the platform choices below are chosen to *satisfy* those intents rather than to constrain them.

---

## 1. Target Platform Analysis

### 1.1 Web (Browser) — Primary and Only Declared Platform

**Why web fits this concept:**
- **Zero-install funnel.** For a game that ramps to PvP/co-op (`bulwark-gdd` §4) where virality and population liquidity matter, a shareable link *is* the install. This directly serves the acquisition assumptions in the market/monetization IDEA artifacts.
- **Session fit.** The build-vs-fight cadence and wave-series structure (§3) align with web's interruptible play patterns.
- **Live-service agility.** No store cert cycle — patch by redeploy. Strong fit for the additive faction/character/story content the design ships across extended tiers (the **81-hero alignment roster**, §10–§11) and the live-service cadence flagged in the sibling IDEA docs.
- **Cross-device reach.** One build spans desktop and mobile browsers; **input parity is a design requirement** — every action works with a single pointer (mouse) or single finger (touch), no multi-key combos, no keyboard (`bulwark-visuals` §8).

**Constraints to design against:**
- **Load-time drop-off.** Web abandonment is steep beyond ~10–15s to interactive. **[ASSUMPTION — directional]** Treat as a design pressure requiring aggressive asset streaming and a sub-5MB initial payload target. Pixi.js's small runtime footprint is a strong advantage; the vertical-slice scope (§19) is one biome / one map / a small locked unit-and-tower set, which keeps the initial atlas set small.
- **Performance ceiling.** Pixi.js renders on **WebGPU** where available (Pixi v8+) with automatic **WebGL2/WebGL** fallback (the universal baseline). **Ship WebGL as baseline; let Pixi auto-select WebGPU as an enhancement path** — no launch gating on WebGPU coverage. The layered per-unit sprite stacks, per-frame depth re-sorting on camera rotation, particle FX (dirt, muzzle/impact, gold pie-sweep), and shader-driven trees/clouds/water all push fill and draw-call budgets — Pixi's sprite batching is the mitigation. Note that the 72-unit roster (`bulwark-balance.xlsx` Units) and swarm-heavy factions (Greenies, Faction_Mods: *"Swarm; cheap, many"*) imply high on-screen entity counts, raising the batching stakes.
- **Memory limits.** Tabs are memory-constrained. iOS Safari is historically tightest (~1–1.5 GB before tab termination); the per-biome/per-faction sprite atlases (`bulwark-gdd` §5, §16) plus long sessions risk crashes — manage texture memory with atlases and on-demand, per-biome loading.
- **No background execution.** Browsers throttle/suspend inactive tabs — a direct threat to any real-time PvP assuming a persistent connection (see §3).
- **Discovery friction.** No native store surface; distribution depends on portals, embeds, or owned channels — consistent with the go-to-market assumptions in the market IDEA artifact.

### 1.2 Sub-Platform Split

| Sub-platform | Fit | Key Considerations |
|---|---|---|
| **Desktop browser** | **Strong (primary)** | Pointer precision suits tower placement, the deploy loop (select → hover preview → drop/cancel), and camera rotation; best GPU/CPU headroom and memory budget. |
| **Tablet browser** | **Moderate** | Touch + larger screen; the single-pointer input-parity model (`bulwark-visuals` §8) maps cleanly. A 2.5D Pixi presentation is lighter than 3D. |
| **Mobile browser** | **Conditional (viable by design)** | Input parity means the full control set is single-finger by spec — TD placement, structure menu, deploy loop all work touch-only. Pixi's 2.5D pipeline is more forgiving on mobile GPUs/thermals than 3D, but tight memory (iOS Safari) and the layered-FX + swarm entity budget still apply. |

**Recommendation:** design **desktop-first, mobile-tolerant**. Because the source mandates **single-pointer input parity** (`bulwark-visuals` §8), mobile is more attainable than a keyboard-dependent design — the deciding constraints become GPU/memory budget for layered sprites and FX, not control scheme. This aligns with the broad-reach audience posture in the sibling IDEA artifacts.

### 1.3 Platform Features Worth Leveraging

- **Pointer / touch events** for the deploy loop, tower placement, structure menus, and camera rotation — Pixi's interaction/event system maps directly, and the single-pointer contract keeps mouse and touch identical (`bulwark-visuals` §8).
- **Gamepad API** — optional enhancement, but note the input-parity spec forbids requiring it.
- **WebSockets / WebRTC** for multiplayer transport (§3).
- **IndexedDB + cloud sync** — offline-capable local cache with a server-authoritative source of truth; also a natural home for the **replay log stream** (`bulwark-visuals` §9).
- **Web Audio API** — essential to the character drama/tips pillar (§10–§12), the per-level character conversations/tips, and the **classic-console coin sounds on kills** (`bulwark-visuals` §10); ties to the audio direction described in the art/audio IDEA artifact.
- **PWA installability** — optional "add to home screen" to cut re-entry friction without app-store dependency.

---

## 2. Technology Stack Evaluation

### 2.1 Rendering Engine / Runtime

For this version, the rendering layer is decided: **Pixi.js**, and the source's fake-3D approach is authored entirely in 2D sprites (`bulwark-visuals` §1–§2), which Pixi serves directly.

| Aspect | Pixi.js Assessment |
|---|---|
| **Rendering** | WebGPU (Pixi v8+) with automatic WebGL2/WebGL fallback — universal coverage without launch-gating on WebGPU. |
| **Payload / cold-start** | Small runtime and tree-shakeable modules yield the smallest builds — best-in-class for the sub-5MB fast-load pillar. |
| **Fit** | Purpose-built 2D renderer with strong sprite batching — needed for the 72-unit roster, swarm factions, per-unit four-layer stacks, and particle-heavy combat FX. |
| **Presentation model** | **2.5D layered sprites (confirmed):** the 14-layer world z-order (`bulwark-visuals` §1), four-sub-layer unit stacks (legs/body/weapon/head, §2), simple + altitude shadows (§3), and camera rotation with per-frame depth re-sort (§7). |
|
