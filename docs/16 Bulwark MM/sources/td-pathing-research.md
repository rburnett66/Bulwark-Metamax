# Research: TD/RTS Pathing & Crowd-Movement in Shipped Games

*Deep-research report (2026-07-13): 5 search angles, 18 sources fetched, 83 claims extracted, top 25 adversarially verified — **25 confirmed, 0 refuted**. Commissioned to guide Bulwark's crowd-sim design after fighting jitter ("bumping"), bulldozing, and orbiting artifacts.*

## The headline

Shipped games converge on one pattern: **a single goal-rooted graph search shared by all units** (BFS/Dijkstra flow field, not per-unit A*), **soft unit-unit interaction only** (physics pushing or radial separation — never hard collision with repathing), and **large-unit/corridor problems solved at map-preprocessing time** (wall cushioning, cost gradients), not at steering time. Supreme Commander 2's postmortem and Factorio's biter redesign *independently* abandoned hard collision + individual pathing because it produces exactly our artifact set. The "principled" alternative (RVO/ORCA velocity obstacles) is documented by its own practitioners as inherently jittery in transients and specifically bad in corners/corridors — a poor fit for maze TD.

## Verified findings

1. **Per-unit paths + hard collision don't scale** *(high confidence — SupCom postmortem + Factorio FFF-316)*. Repathing on every collision compounds ("the game grinds to a halt"); each unit's avoidance is blocked by other units attempting the same. Both teams abandoned the architecture.
2. **SupCom 2's shipped architecture**: hierarchical grid + portal graph + cached per-sector **flow field tiles** shared across path requests — hundreds-to-thousands of agents. *(high)*
3. **SupCom 2 resolves contact with soft physics** — pushing and wall-sliding on top of flow steering. No repathing, no hard avoidance; it even became gameplay (explosions shoving units). *(high)*
4. **SupCom 2's anti-jitter mechanics**: (a) keep a persistent path-direction vector and *blend* newly sampled directions into it as the agent crosses cells; (b) within line-of-sight of the goal, ignore the field and steer straight at the exact goal (kills 4-neighbor integration artifacts). *(high)*
5. **Big units are a preprocessing problem**: per-movement-type cost fields, a "wall cushioning" erosion pass that closes gaps too narrow for large units, and a blur pass adding cost gradients near walls so flows stay centered in corridors. *(high)*
6. **Jitter is inherent to mutual avoidance, not a bug**: plain VO oscillates for two agents; RVO's fix breaks at ≥3 agents ("velocity flickering"). Our "bumping" was the textbook transient. *(high — Game AI Pro 2 & 3)*
7. **Off-the-shelf ORCA is wrong for maze corridors**: easily over-constrained in dense crowds, and at corners agents travel far off-trajectory or deadlock rather than change passing side. *(high — Havok AI lead)*
8. **If reciprocal avoidance is ever used**: substep it (multiple solver iterations per movement step, positions frozen) with a dodge-weight ramp to 0.5. *(high, practitioner recommendation)*
9. **Factorio's shipped answer: no biter-biter collision at all** — "some might consider a hack" — with soft separation keeping visual readability. Pathing is two-tier hierarchical A*, and the design persisted through 1.x/2.0. **Closest shipped precedent to Bulwark's architecture.** *(high)*
10. **Concrete tuning results** *(high — Guy & Karamouzas)*: anticipation time-horizon ~4 s ≈ natural motion (0.1 s = late overlap panic, 20 s = over-separation); for **already-overlapping agents, don't push apart — temporarily shrink each agent's radius** to just under half the current separation for one step so overlap can't worsen; **cap avoidance forces** (they use 20) so near-collision forces can't dominate.
11. **Production middleware (A* Pathfinding Project) documents our exact artifacts** — agents pushing others off the walkable area, jitter at graph edges in crowds — and ships "constrain agents to the graph" as the fix. Our artifacts were endemic to the technique class, not our implementation. *(high)*
12. **Goal-rooted search is the canonical TD pattern** *(medium — Red Blob Games)*: one BFS/Dijkstra from the exit gives every unit — including ones displaced by separation or spawned later — a precomputed next step from *any* cell, zero repathing. Recompute only on maze edits.
13. **Cautionary indie reproduction** *(low — hobbyist blog)*: hard never-overlap → frontal-sensor deadlock → asymmetric fix → overlap returns; the working end state was *conditional* avoidance (head-on only) and "mostly skip it."
14. **Design-level framing**: "to maze or not to maze" is the most consequential TD choice (Defender's Quest shipped fixed paths *specifically* to avoid this whole problem class). Bulwark is a mazing TD, so crowd behavior in player-shaped corridors is intrinsic. *(medium)*
15. **Synthesis for Bulwark** *(high)*: keep shared goal-rooted grid search (ideally as a **distance field** so displaced units never repath) · **soft capped separation only** — drop residual corridor avoidance steering · **radius-shrink for overlaps** instead of push impulses · **heading-blend + LOS-straight steering** for smoothness · **validate corridor width vs largest unit at placement time** and bias costs toward corridor centers · **accept overlap for mixed-speed overtaking** — every shipped solution lets fast units softly push past or pass through slow ones; reciprocal lane-changing in corridors deadlocks or orbits.

## What this means for our sim (status vs. recommendations)

| Recommendation | Bulwark status |
|---|---|
| Shared goal-rooted search | ✅ have (shared BFS routes) — upgrade path: full distance-field so displaced units never repath |
| Soft separation, no hard collision | ✅ have; recent fixes (capped step, no forward push, tapered force) match the pattern |
| Radius-shrink for existing overlaps | ❌ not yet — replaces push-apart when bodies interpenetrate |
| Heading blend + LOS-straight steering | ➖ partial (no waypoint snap) — persistent-heading blending would remove residual zigzag |
| Corridor width validation vs biggest unit | ❌ not yet — placement validation only checks lane-seal, not width for 2-3 tile bodies |
| Accept overlap when overtaking | ✅ now (removed the lane-change maneuver); could go further Factorio-style if needed |

## Open questions the research couldn't settle

- Internals of the named pure-TD titles (Kingdom Rush, BTD, Defense Grid…) are undocumented — genre convention says fixed paths/splines, unverified.
- No source gave a quantitative corridor-width margin (e.g., 1.5× unit diameter) or an acceptable overlap % for readability — tune locally.
- Determinism of soft-physics separation across platforms — moot for us (single JS runtime, fixed iteration), relevant only if lockstep multiplayer ever appears.

## Sources (verified)

Game AI Pro Ch. 23 (SupCom 2 postmortem, Emerson) · Game AI Pro 3 Ch. 19 (RVO/ORCA, Sunshine-Hill/Havok) · Game AI Pro 2 Ch. 19 (anticipatory avoidance, Guy & Karamouzas) · Factorio FFF-316/317 · Red Blob Games TD pathfinding · A* Pathfinding Project docs · Fortress of Doors (Defender's Quest) · plus corroborating dev blogs/forums (StarCraft 2 push-through behavior, boids-for-RTS).
