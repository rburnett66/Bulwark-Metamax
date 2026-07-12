# Resourcing.md

# BULWARK — Resourcing Plan

## 1. Executive Summary

BULWARK is a deterministic, 2.5D tower-defense simulation built in TypeScript/PixiJS. Its architecture imposes a hard constraint — bit-for-bit reproducibility across platforms — which shapes every resourcing decision below. This plan allocates a hybrid team of **4 human engineers and 4 AI coding agents** across four load-bearing subsystems: the Deterministic Sim Core, the Renderer, the Balance Toolchain, and the Testing & Quality gate.

| Metric | Value |
|---|---|
| Total headcount | 8 (4 human, 4 AI agents) |
| Human effective capacity | 224 hrs/sprint |
| AI supervised throughput | ~44 hrs/sprint effective |
| **Total sprint capacity** | **268 hrs/sprint** (2-week sprint) |

> **Capacity basis:** A sprint is two weeks. Human figures reflect *effective* engineering hours after meetings, reviews, and context-switching — not raw calendar time. AI throughput is deliberately capped: agent output is only counted once human-reviewed and integrated, so the effective number is far below wall-clock generation speed. AI agents are **force multipliers, not seats** — each is paired to a human owner who supervises, reviews, and merges its work.

---

## 2. Human Resources

Each human owns one subsystem end-to-end and is the accountable reviewer for the AI agent paired to that subsystem.

**Marcus Okafor — Developer (Sim Core owner)**
- Capacity: 64 hrs/sprint · Availability: 100%
- **Specialisation:** Deterministic simulation and systems engineering in TypeScript. Expert in fixed-point integer arithmetic, seeded PRNGs (xorshift/PCG), and fixed-step tick loops. Owns the load-bearing determinism invariant — banning floats/wall-clock/`Math.random` from the core, enforcing stable insertion-ordered iteration, and building the replay-hash CI gate (Technical-Plan §3).
- **Sprint allocation:** Deterministic Sim Core — pathing across walker/floater/flyer domains (GDD §5–6), the 6×5 damage-type × armor-class effectiveness matrix (GDD §7), status effects (DoT/slow/stagger/overload/chain), the structure lifecycle state machine (GDD §8), and the wave/economy loop (GDD §3). Also owns the Log/Replay & Determinism Harness.

**Elena Vasquez — Developer (Renderer owner)**
- Capacity: 60 hrs/sprint · Availability: 100%
- **Specialisation:** Graphics/rendering engineering with PixiJS/WebGL. Strong in sprite batching, per-frame depth sorting by ground anchor, and custom GLSL shaders (tree sway, cloud vapor, water surface). Skilled at read-only snapshot consumption so presentation never mutates sim state (Technical-Plan §2).
- **Sprint allocation:** Renderer (Layered 2.5D) — the 14-layer world z-order (Visuals §1), the four-sublayer unit stack legs/body/weapon/head with sensor→weapon lock-on telegraph (Visuals §2.1), ground and dim air-altitude shadows (§3), structure render states (§5), environment layers (§6), and world rotation with shadow re-projection (§7).

**Devin Cho — Developer (Toolchain owner)**
- Capacity: 56 hrs/sprint · Availability: 100%
- **Specialisation:** Gameplay/tools engineering and build toolchains in Node.js/TypeScript. Expert in data pipelines (SheetJS parsing, Zod/AJV validation), content-addressed asset emission, and event-driven FX/audio (PixiJS particle+timeline, Web Audio API). Bridges deploy-loop UX with mouse/touch input parity.
- **Sprint allocation:** Balance Toolchain — ingesting `bulwark-balance.xlsx`, validating referential integrity (valid faction/shape/damage-type/armor-class, the 6×5 matrix, 100-point power budgets), running the price simulator (`Cost_per_power_gold = 3`), and emitting `dataset.<hash>.json`. Co-owns the FX & Audio System (three-part shot, gold pie-sweep, coin-kill — Visuals §4–5, §10) and the deploy-loop UI (§8).

**Priya Nair — QA (Quality owner)**
- Capacity: 44 hrs/sprint · Availability: 80%
- **Specialisation:** Automated test engineering for deterministic systems. Strong in headless harnesses, golden-file/replay-hash comparison (FNV-1a/SHA-256), cross-platform parity testing, and PRNG reference-vector tests. Treats the replay path as acceptance: a slice is "done" only when its recorded log reproduces bit-for-bit.
- **Sprint allocation:** Testing & Quality Strategy — the CI replay-hash gate across ≥2 platforms, balance-dataset validation assertions (power spread, per-faction averages), determinism regression suites, and vertical-slice acceptance (GDD §19, Visuals §10).

---

## 3. AI Agent Resources

Agents are scoped to well-specified, high-boilerplate work under a named human reviewer. Their output does not count toward capacity until merged.

| Agent | Model | Human reviewer | Scope |
|---|---|---|---|
| **Claude Sim-Core** | Claude Code | Marcus | Fixed-point math routines, PRNG reference vectors, tick-loop state machines, matrix resolution; determinism unit tests. Strong at pinning rounding conventions and iteration-order stability. |
| **Cursor Renderer** | Cursor | Elena | z-order layering, four-sublayer unit stack, shadow projection, environment shaders (tree/cloud/water), camera rotation + shadow re-projection; FX timeline/particle scaffolding on read-only snapshots. |
| **Copilot Toolchain** | GitHub Copilot | Devin | SheetJS parsing, Zod/AJV schemas, referential-integrity checks, content-addressed hashing/manifests, price-simulator arithmetic, CI glue scripts. |
| **GPT Harness-QA** | GPT-4o | Priya | Headless Node runners, golden-log capture/replay scaffolding, FNV-1a/SHA-256 stream hashing, cross-platform comparison scripts, and reference-vector fixtures. |

---

## 4. Capacity Analysis & Risks

**Allocation balance.** Sim Core and Renderer are the deepest subsystems and carry the two highest-capacity engineers (64/60 hrs). The Toolchain is scoped narrower and correctly sits at 56 hrs. QA at 44 hrs (80% availability) is the thinnest link.

**Primary risk — QA is a single point of failure.** The determinism invariant is only as strong as the CI replay-hash gate, and that gate depends on one 80%-available engineer. If Priya is unavailable during a hardening sprint, no one else can certify bit-for-bit reproducibility.
- *Mitigation:* Marcus (who builds the harness) is the designated backup reviewer for the gate. GPT Harness-QA carries scaffolding load to reduce Priya's boilerplate burden.

**Secondary risk — cross-subsystem seam.** The Renderer and FX consume sim snapshots read-only, but a single accidental mutation breaks determinism silently. This seam spans Elena and Devin's areas.
- *Mitigation:* enforce a frozen/immutable snapshot contract at the sim→presentation boundary; add a lint/runtime assertion, owned by Marcus.

**AI throughput risk.** The 44 effective AI hours assume clean review flow. If review capacity lags generation, unmerged agent output becomes waste and hidden WIP.
- *Mitigation:* cap concurrent agent tasks per human at 1–2; treat "reviewed & merged" as the only accounting unit (already reflected in §1).

---

## 5. Recommendations & Key Takeaways

1. **Protect the QA gate.** It is the load-bearing quality mechanism and the team's thinnest resource. Formalise Marcus as backup gate reviewer and front-load harness automation via GPT Harness-QA.
2. **Enforce the snapshot immutability contract early.** A runtime-asserted, frozen sim→render boundary prevents the most likely and most expensive class of determinism regression.
3. **Account for AI at merged throughput only.** Keep the 268-hr figure honest by counting agent output post-review; cap concurrent agent tasks to prevent review starvation.
4. **Keep one human owner per subsystem.** Clear ownership (Marcus/Elena/Devin/Priya) maps cleanly to the four agents and keeps accountability unambiguous.
5. **Sequence work behind determinism.** The Sim Core and its harness are prerequisites for meaningful Renderer, Toolchain, and QA verification — prioritise them in early sprints so downstream work can be validated against a stable replay hash.

---

*Generated by MetaMax Research Brain (LangGraph)*