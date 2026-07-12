# Scalability-Considerations.md

# BULWARK — Scalability Considerations

## 0. Framing: What "Scale" Means for BULWARK

BULWARK is architected **slice-first, tier-later** (Architecture §5.6, Technical-Plan §1). The vertical slice (GDD §19, Visuals §10) is a **fully offline, single-player, client-side** deliverable: a deterministic TypeScript simulation core plus a PixiJS renderer, with a **local append-only battle log** and no network surface (Architecture §1–§2; Technical-Plan §2). There is no server, no shared state, and no live user traffic.

Consequently, scalability has **two distinct axes**, treated separately here:

- **Axis A — In-client simulation & render scale** (relevant *now*): how many entities, ticks, log records, and draw calls a single client sustains before the frame budget or determinism cost breaks. This is the only load that exists today.
- **Axis B — Backend service scale** (deferred to Tier-1, Architecture §5.6): unlocks, save sync, PvP/co-op, leaderboards, and server-side log re-simulation for anti-cheat. This load does not exist until backend services are built.

Every claim below is grounded in the balance dataset (`bulwark-balance.xlsx`), the render z-order and per-frame work in Visuals §1–§7, and the determinism contract (Architecture §3, Technical-Plan §3).

---

## 1. Scale Targets

### 1.1 Axis A — Per-Client Simulation & Render (Slice)

The slice is a **single-field defense**: one walker, one floater, one flyer, three towers (GDD §19, Visuals §10). Entity counts are bounded by roster and wave design, not user volume.

| Metric | Slice Target | Basis |
|---|---|---|
| Concurrent active attackers | 40–80 on-field | Greenies "swarm" archetype; single field caps under 100 (GDD §9) |
| Concurrent structures | ≤ 11 building types, base hard-point bound | GDD §8; hard points scale with base level (Visuals §8) |
| Simulation tick rate | Fixed-step, 30 Hz integer ticks | Fixed-step contract (Architecture §3.1) |
| Render frame rate | 60 FPS desktop / 30 FPS mobile floor | PixiJS WebGL (Visuals §8) |
| Sprites per unit | 4 sub-layers (legs/body/weapon/head) | Visuals §2.1 — 80 units ≈ 320 sprites + shadows + FX |
| Event records per battle | Low thousands (shots, impacts, kills, lifecycle) | Event-driven FX (Architecture §2) |
| Battle-log size per battle | ~50 KB–500 KB (seed + inputs + events) | Log is inputs+seed+events, not per-frame state (Visuals §9) |

**Latency is frame time, not request time:**

| Percentile | Target frame time | Equivalent |
|---|---|---|
| P50 | ≤ 8 ms | 120 FPS headroom |
| P95 | ≤ 16.6 ms | 60 FPS sustained |
| P99 | ≤ 33 ms | 30 FPS mobile floor, no dropped input |

### 1.2 Axis B — Backend User Targets (Tier-1, Deferred)

These are **planning placeholders** to size eventual step-functions, not committed launch numbers (Architecture §5.6, Technical-Plan §6).

| Horizon | Registered | Peak concurrent | Scope added |
|---|---|---|---|
| Tier-1 launch | 1,000 | ~50 | Unlocks + save sync |
| 6 months | 10,000 | ~500 | Leaderboards + async log validation |
| 12 months | 100,000 | ~5,000 | PvP/co-op matchmaking; server-side re-sim |

**Backend latency targets:**

| Operation | P50 | P95 | P99 |
|---|---|---|---|
| Save sync (write) | 80 ms | 250 ms | 500 ms |
| Unlock/roster fetch (read) | 40 ms | 150 ms | 300 ms |
| Leaderboard read | 60 ms | 200 ms | 400 ms |
| Async log re-sim (anti-cheat) | Background job, completes < 30 s |

**Data growth:** at 100k users × ~50 logs × ~250 KB average, raw log storage ≈ **1.25 TB**, growing ~100 GB/month. Logs dominate; save state and unlocks are kilobytes per user.

---

## 2. Current Architecture Limits

Axis-A limits are **per-device budgets**; Axis-B limits are properties of a *future* backend.

### 2.1 Deterministic Sim Core
- **Ceiling:** Fixed-point integer tick loop over on-field entities. Naive pairwise interactions (targeting, vision/radar checks, chain/splash per `DamageTypes`) are O(N²)-risk and degrade around **a few hundred entities per tick** before the 33 ms budget breaks on mid-tier mobile.
- **Breaks first at:** targeting/vision acquisition and **Electric chain / AoE splash** resolution (Effectiveness sheet, `Chain/Splash` column) — the pairwise-search hot paths.
- **Leading indicator:** wall-clock **ms per sim tick**, measured out-of-band and never fed back into the sim (Architecture §3.3).

### 2.2 Renderer (Layered 2.5D)
- **Ceiling:** Per-frame **depth re-sort by ground anchor after camera rotation** (Visuals §2.2) is O(N log N) over all ground units + structures. PixiJS sprite batching absorbs thousands of quads; the CPU cost is the sort plus shadow re-projection on rotation (Visuals §7).
- **Breaks first at:** **camera-rotation frames** (sort + shadow re-projection fire together) and dense **muzzle/impact FX** bursts (layer 12) at peak fire volume.
- **Leading indicator:** frame time on rotation frames; draw calls per frame.

### 2.3 FX & Audio
- **Ceiling:** Particle count for the three-part shot (muzzle + projectile + impact, Visuals §4) plus dust trails, water ripples, and gold-pickup effects, all multiplied by peak concurrent fire. FX are decorative and event-driven — never authoritative — so they can be shed under load without affecting the sim.
- **Breaks first at:** simultaneous multi-tower fire against a full swarm, when particle spawn rate outpaces the frame budget.
- **Leading indicator:** live particle count; FX draw calls per frame.

### 2.4 Battle Log (Local, Append-Only)
- **Ceiling:** IndexedDB write throughput and quota. At ~500 KB/battle and hundreds of retained logs, a device sees tens of MB — well within quota, but unbounded retention will eventually exceed it.
- **Breaks first at:** unbounded local retention on low-storage mobile.
- **Leading indicator:** total log-store bytes; write latency spikes.

---

## 3. Scaling Strategies

### Axis A (implement in-slice)
1. **Spatial partitioning** — replace pairwise targeting/vision/chain scans with a uniform grid or bucketed lookup, converting O(N²) into near-O(N). This is the single highest-leverage fix and directly protects the 30 Hz tick.
2. **Cap chain/splash fan-out** — bound Electric chain hops and splash target counts in the balance data, keeping worst-case pairwise work constant.
3. **Cache the depth sort** — recompute the ground-anchor sort only on movement or rotation, not every frame; skip shadow re-projection on non-rotation frames.
4. **FX budgeting** — enforce a hard live-particle cap with graceful degradation (skip decorative particles first); pool sprite objects to avoid GC churn.
5. **Log rotation** — cap retained local logs (e.g., last N battles or a byte ceiling) with LRU eviction.

### Axis B (design for Tier-1, build later)
1. **Stateless read replicas + CDN** for unlock/roster and leaderboard reads (cacheable, read-heavy).
2. **Async re-sim workers** — the deterministic core means anti-cheat validation is embarrassingly parallel: replay seed + inputs off the critical path, scale horizontally by queue depth.
3. **Object-store logs** — push battle logs to blob storage, not the primary DB; keep only metadata and validation status relational.
4. **Sharded matchmaking** — partition PvP/co-op queues by skill/region once concurrency approaches ~5,000.

---

## 4. Key Takeaways

- **Two axes, one that matters now.** Only Axis A (in-client) carries real load in the slice; Axis B is a planning placeholder — do not over-build backend before Tier-1.
- **The determinism contract is a scaling asset, not a constraint.** It makes server-side re-sim trivially parallelizable and keeps logs tiny (seed + inputs, not state).
- **O(N²) is the enemy.** Targeting, vision, and chain/splash are the first things to break; spatial partitioning and bounded fan-out are the priority in-slice fixes.
- **FX and logs are safe to shed.** Both are non-authoritative and can degrade or rotate under pressure without touching the sim.
- **Measure the right latency.** In-slice, watch **ms/tick** and **rotation-frame time**; never feed timing back into the deterministic loop.

---

*Generated by MetaMax Research Brain (LangGraph)*