# Implementation-Notes.md

# Implementation-Notes.md

# BULWARK — Implementation Notes

*Companion to Architecture.md, Technical-Plan.md, and Schedule.md. This document translates BULWARK's architecture into concrete, day-to-day engineering guidance.*

**Ground truth:** balance/stat values live in `bulwark-balance.xlsx`; systems live in `bulwark-gdd.md`; presentation/input lives in `bulwark-visuals.md`. When this document and a ground-truth source disagree, the source wins — file an issue.

**Scope reminder.** The headline deliverable is the **vertical slice (GDD §19)**: one walker, one floater, one flyer, three towers, the deploy loop, the three-part shot, structure FX, camera rotation, and the **battle log + replay determinism check** (Visuals §10). Everything below is written to get a mid-level engineer productive on the slice on day one.

---

## 1. Environment Setup

### 1.1 Prerequisites

- **Deterministic runtime.** The sim core targets a deterministic engine; ensure the toolchain's fixed-point / deterministic-math path is active (see §6–§7). Determinism is non-negotiable (GDD §18/§19).
- **Package manager with a committed lockfile.** Do not float versions — a floated math library silently breaks bit-reproducibility.
- **Spreadsheet-to-data toolchain.** A converter that reads `bulwark-balance.xlsx` and emits runtime tables. This is a **first-class build step**, not a manual copy; GDD §18 forbids hardcoded balance.
- **Git LFS** for sprite atlases (four-layer unit stacks, structure-state atlases; Visuals §2, §5).

### 1.2 Local Dev Setup

1. Clone and pull LFS assets.
2. Install runtime + deps from the committed lockfile.
3. **Generate balance data:** convert `bulwark-balance.xlsx` → runtime tables (`Assumptions`, `Archetypes`, `Faction_Mods`, `DamageTypes`, `Effectiveness`, `Units`, `Structures`, `Vertical_Slice`). **Fail the build** if any derived column disagrees with the sheet's own formula output.
4. **Matrix self-check:** regenerate the 9×9 alignment matrix from the §10.2 rules and assert byte-for-byte equality with the §10.3 table.
5. Run the headless (renderer-free), seeded sim smoke test; confirm it emits a battle log.
6. Launch the client; load the `Vertical_Slice` scenario.
7. Replay the smoke-test log; confirm **bit-identical** reproduction.

### 1.3 Environment Variables (names, not values)

| Variable | Purpose |
|---|---|
| `BULWARK_BALANCE_XLSX_PATH` | Canonical workbook path |
| `BULWARK_DATA_OUT_DIR` | Generated runtime tables |
| `BULWARK_SIM_SEED` | Default seed (overridable per battle) |
| `BULWARK_REPLAY_LOG_DIR` | Battle logs read/written |
| `BULWARK_HEADLESS` | Renderer-less sim mode |
| `BULWARK_ASSET_ATLAS_DIR` | Sprite atlas root |
| `BULWARK_LOG_LEVEL` | Diagnostic log verbosity |

### 1.4 First-Run Checklist

- [ ] Balance data regenerated and validated against `bulwark-balance.xlsx`.
- [ ] Alignment matrix regenerated from §10.2, matches §10.3.
- [ ] Headless seeded sim runs and emits a log.
- [ ] Replay of that log reproduces the battle exactly (zero drift).
- [ ] `Vertical_Slice` loads with walker + floater + flyer and the three slice towers.
- [ ] Camera rotation re-sorts depth and re-projects shadows correctly.

---

## 2. Coding Standards

### 2.1 Architectural Rules (non-negotiable)

- **Quarantine the deterministic core.** All simulation logic (movement, combat, damage resolution, economy) lives in a renderer-free, seed-driven module. No wall-clock time, no unordered iteration, no floating-point where the target path is fixed-point. See §7 "Deterministic Sim Step".
- **Data over code.** No balance constant may be typed into gameplay code; all stats resolve from generated tables (GDD §7/§18).
- **Presentation reads sim, never writes it.** The render layer (Visuals §1–§7) is a pure consumer. A frame drop or camera rotation must never change a simulation result.

### 2.2 Naming Conventions

- **Files:** one system per file, named for the subsystem — `vision`, `pathing`, `structure_lifecycle`, `balance_sim`, `alignment`, `replay`. Match Architecture.md subsystem names exactly.
- **Functions:** verb-first, effect-honest — `resolveDamage`, `stepSim`, `emitLogEvent`, `regenerateAlignmentMatrix`. Pure helpers named for their return.
- **Variables:** use source vocabulary — `armorClass`, `damageType`, `effDPS`, `power`, `costT1/T2/T3`, `radarSignature`, `targetsBase`. Never invent synonyms for GDD/xlsx terms.
- **Data keys mirror xlsx headers 1:1** so generated tables map directly: `UnitID`, `Faction`, `Shape`, `Role`, `Domain`, `Armor Class`→`armorClass`, `Damage Type`→`damageType`, `Can Target`, `Targets`, `HP T1/T2/T3`, `DPS T1/T2/T3`, `Range`, `Speed`, `Vision`, `Power`, `EffDPS vs Org/Mach/Air`. Alignment codes are the fixed set `AG, PG, G, CG, N, CE, E, PE, DE`.

### 2.3 Error Handling

| Layer | Policy | Rationale |
|---|---|---|
| **Data (build/load)** | Fail loud, never default | A missing unit, a stat that disagrees with the sheet formula, or a matrix mismatch **aborts the run**. Data-integrity validation *gates*; it does not merely inform. |
| **Sim (runtime)** | Recover, but record | Recoverable errors are written into the replay stream so they reproduce deterministically on replay. |
| **Presentation** | Degrade gracefully | A missing atlas frame or shader failure renders a placeholder and logs a warning — it must never desync the sim. |

> The GDD design value "validation that informs rather than gates" applies to **gameplay** (e.g. deploy hints), *not* to data integrity. Balance data must gate.

### 2.4 Logging: Two Distinct Streams

1. **Battle log stream** (Visuals §9) — an ordered, deterministic record of `seed + inputs + events`. This **is** the replay source and the determinism acceptance test. It is not a debug log; it is written silently during every battle and must be sufficient to reconstruct the match bit-for-bit.
2. **Diagnostic log** (`BULWARK_LOG_LEVEL`) — structured engineering telemetry. May contain wall-clock, frame timing, and warnings. **Never consulted by the sim** and never a replay input.

Keeping these separate prevents the classic failure mode where a debug print's timestamp or ordering leaks into replay and causes drift.

---

## 3. The Balance Pipeline (why it gates everything)

The xlsx is authoritative because designers iterate there daily. The pipeline exists to guarantee that *what runs equals what the sheet says*:

1. **Extract** the eight named tables.
2. **Recompute** every derived column (e.g. `EffDPS vs Org` from `DPS`, `Effectiveness`, and `Faction_Mods`) in code and compare to the sheet's own output. Mismatch = build failure with the offending `UnitID` and column named.
3. **Emit** immutable runtime tables into `BULWARK_DATA_OUT_DIR`.
4. **Self-check the matrix** against §10.2 rules.

This turns "did someone forget to re-export?" into a compile-time error rather than a silent balance regression discovered weeks later.

---

## 4. Determinism Discipline (the acceptance test)

The vertical slice passes only when a recorded log replays bit-identically. Common drift sources to audit on every PR touching the core:

- **Iteration order** — iterate entity collections by stable `UnitID`/spawn index, never by hash-map order.
- **Float leakage** — any `float` in damage, movement, or economy is a bug; use the fixed-point path.
- **Hidden clock reads** — no `now()` inside `stepSim`; time advances only by tick.
- **Uncaptured input** — every deploy, target, and camera command that affects sim state must enter the battle log before it reaches `stepSim`. (Camera rotation is presentation-only and must *not* enter the log.)

CI should run the smoke-test record-then-replay on every commit and reject any drift.

---

## Key Recommendations

1. **Make the balance converter a build gate on day one** — it prevents the most expensive class of late-stage bugs (silent balance drift) for the least effort.
2. **Enforce the sim/presentation boundary in code review**, not just convention: any write from render → sim is an automatic rejection.
3. **Wire record-then-replay into CI immediately**, before adding gameplay features — determinism is far cheaper to preserve than to retrofit.
4. **Treat the two log streams as architecturally separate**; never let diagnostic output influence or contaminate the battle log.
5. **Mirror xlsx headers verbatim** so designers and engineers share one vocabulary and generated tables map without translation layers.

---

*Generated by MetaMax Research Brain (LangGraph)*