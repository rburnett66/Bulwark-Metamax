# Technical-Plan.md

# BULWARK — Technical Plan

## 1. Executive Summary

BULWARK is a deterministic, data-driven, multi-faction tower-defense game rendered in **layered 2.5D** (stacked, independently-animated 2D sprites sorted back-to-front). The primary deliverable is the **vertical slice** defined in GDD §19 and Visuals §10: a playable single-field defense with one walker, one floater, and one flyer attacker shape, three towers, the full deploy loop, and a battle log + replay path that doubles as the determinism acceptance test. The plan targets that slice first while leaving explicit seams for extended tiers (world scale, the 81-hero alignment model, and backend services).

**Primary technical approach.** A single implementation language serves both the interactive client and the headless simulation, eliminating a cross-runtime determinism port (Architecture §5.2). We recommend **TypeScript + PixiJS (WebGL)** for client/presentation and a **pure TypeScript simulation core** compiled to one portable, side-effect-free ES module. The core is fixed-step, fixed-point (integer/quantized), seeded-PRNG-driven, and mutated only through ordered inputs (Architecture §3). Presentation reads sim snapshots and subscribes to an ordered event stream; **FX and audio are purely event-driven**, so replays render identically for free. Balance is fully offline: a build-time toolchain ingests `bulwark-balance.xlsx`, validates it, runs the price simulator (GDD §17), and emits a content-addressed canonical JSON dataset consumed by every runtime.

**Key constraints and assumptions.**
- **No hardcoded balance in game code** (GDD §18). All damage matrices, costs, wave scripts, stats, and alignment relationships come from the versioned dataset.
- **Determinism is load-bearing.** No floats, no wall-clock, no `Math.random`, no unordered iteration in the core (Architecture §3). A CI replay-hash gate blocks any divergence.
- **Input parity** — every action works with a single pointer (mouse) or single finger (touch) (Visuals §8).
- **Slice-first, tier-later** — local logs only; backend services (unlocks, save sync, PvP/co-op, leaderboards) are deferred to Tier-1 (Architecture §5.6).
- Balance values (armor/damage matrix, per-unit stats, upgrade curves) come directly from `bulwark-balance.xlsx`; the game never recomputes them at runtime.

---

## 2. Component Inventory

**Deterministic Sim Core** — *Complexity: High*
- **Responsibility:** The entire simulation as a fixed-step tick loop consuming `(initial state, seed, ordered inputs)` and producing `(final state, ordered event stream)`. Owns pathing across walker/floater/flyer domains (GDD §5–§6), vision/radar/fog (GDD §5), combat via the 6×5 damage-type × armor-class effectiveness matrix (GDD §7, balance `Effectiveness` sheet), status effects (DoT/slow/stagger/overload/chain per `DamageTypes`), the structure lifecycle state machine (GDD §8), and the wave/economy loop (GDD §3). No rendering, wall-clock, float math, or network I/O.
- **Technology:** TypeScript compiled to one portable ES module; fixed-point integer arithmetic (integer ticks, quantized tile positions/velocities); a single seeded integer PRNG (deterministic xorshift/PCG).
- **Interfaces:** In-process SDK — `step(inputs) -> events`, `snapshot()`, `restore(snapshot)`; the log-replay driver; the JSON dataset loader. No network surface.

**Renderer (Layered 2.5D Presentation)** — *Complexity: High*
- **Responsibility:** Reads a sim snapshot per frame and draws the canonical 14-layer world z-order (Visuals §1). Owns the four-sublayer unit stack (legs/body/weapon/head — Visuals §2.1), per-frame depth sort by ground anchor after camera rotation (Visuals §2.2), the sensor→weapon lock-on telegraph, ground and dim air-altitude shadows (Visuals §3), structure render states (Visuals §5), environment layers (water surface/sub-surface, grass, bushes, animated trees, drifting clouds — Visuals §6), and world rotation with shadow re-projection (Visuals §7). Never mutates sim state.
- **Technology:** PixiJS (WebGL) with sprite batching; custom GLSL shaders for tree vertex sway, cloud vapor cycling, and water surface. Layers 2–11 rotate in world space; HUD (layer 14) is fixed to screen space.
- **Interfaces:** Reads sim snapshots and subscribes to the event stream over the SDK (read-only).

**FX & Audio System** — *Complexity: Medium*
- **Responsibility:** The three-part shot — muzzle light/smoke/sparks, traveling projectile, and damage-keyed impact (Visuals §4), keyed off `DamageTypes` (fire→burn flare, electric→arc, frost→shatter). Structure lifecycle FX including the universal **gold pie-sweep** completion flash (Visuals §5), construction/damage/destruction FX, dust trails scaled to unit mass (Visuals §3), water ripples/wakes (Visuals §6), and the coin-kill animation with a classic-console coin sound (Visuals §10). Entirely event-driven and thus deterministically reproducible in replay.
- **Technology:** A particle + timeline system layered on PixiJS; Web Audio API for SFX. Subscribes to the ordered sim event stream; owns no simulation state.

**Balance Toolchain (offline)** — *Complexity: Medium*
- **Responsibility:** Ingests `bulwark-balance.xlsx`; validates schema and referential integrity (every unit references a valid faction/shape/damage-type/armor-class; the effectiveness matrix is 6×5; power budgets total 100 per archetype); runs the **price simulator** resolving unit cost from power budget (`Cost_per_power_gold = 3`, so equal power = equal cost — Assumptions sheet); applies upgrade curves (T2/T3 HP, DPS, cost multipliers); and emits a versioned, content-addressed canonical JSON dataset. Build-time only.
- **Technology:** Node.js scripts (SheetJS for parsing, Zod/AJV for schema validation). Emits `dataset.<hash>.json` plus a manifest embedded in each build.

**Log/Replay & Determinism Harness** — *Complexity: Medium*
- **Responsibility:** Records the seed + ordered input log; replays it headlessly and hashes the resulting event stream. The CI gate compares replay hashes across platforms and against a golden baseline, failing on any divergence.
- **Technology:** Headless TypeScript runner (Node); FNV-1a/SHA-256 event-stream hashing.

---

## 3. Determinism Strategy

Determinism is the project's load-bearing invariant. Enforcement is layered:

1. **Language-level:** Lint rules ban `Math.random`, `Date.now`, `performance.now`, and floating-point literals inside the core module.
2. **Arithmetic:** All positions, velocities, and damage are fixed-point integers; division rounds via a single documented convention.
3. **Iteration order:** Entities are stored in stable, insertion-ordered structures; no `Set`/`Map` iteration in hot paths without a sort key.
4. **CI gate:** Every PR replays the golden log and compares the event-stream hash. Any mismatch blocks merge.

This makes the replay path both a debugging tool and the acceptance test — a slice is "done" only when its recorded log reproduces bit-for-bit.

---

## 4. Data Flow

```
bulwark-balance.xlsx ──(build)──▶ dataset.<hash>.json
                                        │
        seed + input log ──▶ Sim Core ──┴──▶ event stream ──▶ FX/Audio
                                │                          └─▶ Renderer
                                └─ snapshot() / restore()
```

The dataset flows one way at build time; the sim never mutates it. Presentation and FX are strictly downstream consumers of snapshots and events.

---

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Float creep into the core | Silent replay divergence | Lint bans + CI hash gate on every PR |
| Cross-platform PRNG mismatch | Divergent enemy behavior | Integer-only PRNG with unit-tested reference vectors |
| Renderer reading mutable sim state | Presentation-driven desync | Read-only snapshot API; no direct handles |
| Balance regressions from spreadsheet edits | Broken economy | Schema + referential validation + price-simulator assertions |

---

## 6. Recommendations

- **Adopt TypeScript + PixiJS** for a single-language client and headless sim, eliminating the cross-runtime determinism port.
- **Ship the replay harness first**, before content — it is the slice's definition-of-done and the safety net for all later work.
- **Keep all balance in the dataset**; treat any hardcoded stat as a build-blocking defect.
- **Gate CI on replay-hash parity** across at least two platforms to catch determinism drift early.
- **Defer all backend services** to Tier-1; the slice must be fully playable and verifiable offline.

---

*Generated by MetaMax Research Brain (LangGraph)*