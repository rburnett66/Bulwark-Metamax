# Architecture.md

# BULWARK — System Architecture

## 1. System Overview

BULWARK is a deterministic, data-driven tower-defense game rendered as **layered 2.5D** (stacked 2D sprites sorted back-to-front) with a **seed-stable, headless-callable combat core** that produces identical results across the interactive client, a headless simulation runner, and a replay reconstructor.

The architecture enforces three hard boundaries:

- A **pure simulation core** — deterministic, no rendering, no I/O, no wall-clock time.
- A **presentation layer** — rendering, FX, input, audio; reads sim state, never mutates it.
- An **offline balance toolchain** — resolves unit prices from power budgets and emits a canonical data artifact.

The governing constraint (GDD §18) is **no hardcoded balance in game code**. All balance — damage matrices, costs, wave scripts, hero alignment — lives in the `bulwark-balance.xlsx`-derived dataset. The vertical slice (GDD §19) is the primary deliverable; the architecture targets it first while leaving headroom for extended tiers (world scale, the 81-hero alignment model).

```
                         +-----------------------------------+
                         |         Balance Toolchain         |
                         |  (offline, build-time)            |
                         |  xlsx -> validator -> price sim   |
                         |  -> canonical JSON dataset        |
                         +-----------------+-----------------+
                                           | (versioned data artifact)
                                           v
+-------------------+   inputs+seed   +-----------------------------------+
|   Presentation    |---------------->|      Deterministic Sim Core       |
|   (Client)        |                 |  fixed-step, integer/fixed-point  |
|                   |<----------------|  tick loop, no rendering, no I/O  |
| - Renderer (2.5D) |  event stream   |                                   |
| - FX system       |                 | - pathing (walk/swim/fly)         |
| - Camera/rotate   |                 | - vision/radar/fog                |
| - Input/deploy    |                 | - combat + damage matrix          |
| - HUD (screen sp) |                 | - structure lifecycle             |
| - Audio           |                 | - economy (gold/bounties)         |
+-------------------+                 | - alignment resolver (§10)        |
        |                             +-----------------+-----------------+
        | writes                                        | emits (ordered)
        v                                               v
+-------------------+                         +-----------------------+
|  Battle Log Store |<------------------------|  Log Stream (seed +   |
|  (local file)     |    replay = re-drive    |  inputs + events)     |
+-------------------+       core from log      +-----------------------+
        |
        v (optional, Tier-1+)
+-------------------------------------------------------------+
| Backend Services (unlocks, save sync, PvP/co-op, leaderbd)  |
+-------------------------------------------------------------+
```

Render layers 2–11 rotate with the world; the HUD (layer 14) is fixed to screen space (visuals §1, §7).

---

## 2. Component Inventory

**Deterministic Sim Core** — *Complexity: High*
- **Responsibility:** The entire simulation — fixed-step tick loop; pathing across ground/water/air domains (GDD §5–§6); vision/radar/fog (GDD §5); combat via the damage-type × armor-class matrix (GDD §7, balance `Effectiveness` sheet); structure lifecycle state machine (GDD §8); wave/economy loop (GDD §3). Consumes `(initial state, seed, ordered inputs)` and produces `(final state, ordered event stream)`. No rendering, wall-clock, float non-determinism, or network I/O.
- **Technology:** TypeScript compiled to one portable module, *or* C#/.NET — chosen to match the client runtime so identical code runs interactively and headless. Fixed-point arithmetic (integer ticks, quantized positions) guarantees cross-run bit-stability.
- **Interfaces:** In-process SDK (`step(inputs) -> events`, `snapshot()`, `restore(snapshot)`); log-replay driver; no network surface.

**Renderer (Layered 2.5D Presentation)** — *Complexity: High*
- **Responsibility:** Reads sim state per frame; draws the canonical z-order (visuals §1). Owns the four-sublayer unit stack (legs/body/weapon/head — §2), depth sort by ground anchor after camera rotation (§2.2), the sensor→weapon telegraph (§2.1), ground/altitude shadows (§3), structure render states (§5), and environment layers (water surface/sub-surface, grass, bushes, animated trees, drifting clouds — §6).
- **Technology:** A 2.5D-capable engine with sprite batching and shaders (Unity/C# or a WebGL/TS engine). Custom vertex/cloud/water shaders (§6). Single-pointer input parity (§8).
- **Interfaces:** Reads sim snapshots + events over the SDK; never mutates sim state.

**FX & Audio System** — *Complexity: Medium*
- **Responsibility:** The three-part shot (muzzle FX + traveling projectile + damage-keyed impact — §4); structure lifecycle FX including the universal **gold pie-sweep** completion flash (§5); dirt/dust trails scaled to unit mass (§3); water ripples/wakes (§6); coin-kill animation with classic-console coin sound (§10). Impact visuals key off `DamageTypes` (fire→flare, electric→arc, frost→shatter).
- **Technology:** Particle + timeline system, **event-driven off the sim event stream** so all FX are deterministically reproducible in replay.
- **Interfaces:** Subscribes to the ordered event stream; owns no simulation state.

**Balance Toolchain** — *Complexity: Medium*
- **Responsibility:** Ingests `bulwark-balance.xlsx`, validates schema/referential integrity, runs the offline **price simulator** that resolves unit costs from power budgets, and emits a versioned canonical JSON dataset consumed by all runtimes.
- **Technology:** Offline scripts (Node/Python); runs at build time, never shipped in the game loop.
- **Interfaces:** File-in / dataset-out; failure blocks the build.

**Log/Replay Subsystem** — *Complexity: Medium*
- **Responsibility:** Persists `(seed + inputs + emitted events)` per battle. Replay re-drives the core from stored inputs and asserts event-stream equality — the primary determinism regression test.
- **Technology:** Append-only local file store; optional Tier-1 backend sync.

---

## 3. Determinism Contract

Determinism is the load-bearing property. It is enforced by:

1. **Fixed-step ticks** — the core advances by integer ticks; frame rate never influences simulation.
2. **Fixed-point math** — no floating-point in the core; positions/velocities are quantized integers.
3. **Seed-driven RNG** — a single seeded PRNG; no `Date.now()`, no `Math.random()`, no hardware entropy.
4. **Input-only mutation** — the core changes state *only* via ordered inputs; the renderer is read-only.
5. **Ordered event emission** — events emit in a stable, tick-then-priority order so replay and interactive runs match bit-for-bit.

**CI gate:** every build replays a fixture library and asserts identical final-state hashes and event streams. Any divergence fails the build.

---

## 4. Key Data Flows

- **Build time:** xlsx → validator → price sim → versioned JSON. The dataset is content-addressed so a battle log can be re-simulated against the exact balance version that produced it.
- **Runtime (interactive):** input → core `step()` → events → renderer/FX/audio + log store.
- **Replay:** log store → core (re-driven from inputs) → events → renderer. Because FX subscribe to events, replays render identically.
- **Tier-1 (optional):** backend for unlocks, save sync, PvP/co-op, leaderboards — validates client-submitted logs by re-simulating them server-side, making cheating detectable.

---

## 5. Key Takeaways & Recommendations

1. **Guard the core boundary above all.** The single greatest risk is leaking non-determinism (float math, wall-clock, unordered iteration) into the core. Enforce with a lint rule banning `float`/`Date`/`Math.random` inside the core module and a mandatory CI replay-hash gate.
2. **Ship the core and client in one language.** Pick TypeScript *or* C# and use it for both, eliminating a cross-runtime determinism port — the highest-cost failure mode for this design.
3. **Make FX purely event-driven.** No FX should read simulation state directly; every effect keys off an emitted event so replay fidelity is free rather than re-engineered.
4. **Version the dataset like code.** Content-address the JSON artifact and stamp each battle log with it, so old replays remain reproducible after balance changes.
5. **Build the replay harness first.** It is simultaneously the determinism test suite, the debugging tool, and the future server-side anti-cheat validator — treat it as core infrastructure, not tooling.
6. **Slice-first, tier-later.** Deliver the vertical slice with local logs only; defer backend services until determinism and the price simulator are proven.

---

*Generated by MetaMax Research Brain (LangGraph)*