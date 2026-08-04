# Core-Loop-Mechanics-Research.md

# Core Loop & Mechanics Research — BULWARK

*IDEA-stage research document. BULWARK is a hybrid: a **multi-faction, multi-domain tower defense** with a data-driven balance sim and roguelite-style "defeat-to-unlock" progression (GDD High Concept §1, Core Loop §3). Genre labels for comparables below are illustrative, not a reclassification of the project. This revision reflects the current source files, including GDD v2.0 and the companion balance workbook.*

---

## 0. Scope & Grounding Note

This report deconstructs the core loops of shipped titles and maps them onto BULWARK's stated loop to surface design risks and actionable recommendations. Sourcing rules:

- Claims from project sources are cited by section (GDD §, `bulwark-balance.xlsx` sheet, Visuals §).
- Claims about external titles are attributed to the specific game.
- Ungrounded claims are flagged **[ASSUMPTION]**.
- External market/sales figures are **[UNVERIFIED — needs a data pass]** and are deliberately omitted rather than presented as fact.

BULWARK's stated loop is the anchor throughout:

> `Scout → Fortify → Defend → Collect → Upgrade → (next wave) → Story → (next continent)` — GDD §3
> Day Battle → survive, **collect money** (bounties + captures). Day Build → **spend money** on structures, upgrades, repairs. — GDD §3

**Source-change watch (per current source files):** The GDD is now **v2.0** and its stated purpose is dual-use — a buildable design *and* a controlled benchmark whose **primary deliverable is the vertical slice (§19)**. This reframes several loop mechanics below as *gradeable subsystems* (vision rules, base-pathing, structure lifecycle, the balance sim, the alignment model), which grade independently (GDD §0). Where this document previously read the loop only as a play experience, it now also flags which strands map to separable, gradeable subsystems.

---

## 1. BULWARK's Loop Structure (from sources)

The loop operates across three coupled timescales. Each tier feeds the next: micro feedback teaches reads, meso resolves the wave, macro converts victory into permanent expansion.

| Tier | Timescale | What happens | Source |
|---|---|---|---|
| **Micro** | ~1–5 s | Sensor→weapon telegraph: head/sensor swings to target (acquisition) → weapon rotates + lock-on wind-up (time-to-fire) → three-part shot (muzzle FX + projectile + impact). Kill → coin animation + coin sound. | Visuals §2.1, §4, §10 |
| **Meso** | one wave | Defend the base; walkers/swimmers/flyers path **to the base** (only flagged units target structures); collect gold from bounties + captures. | GDD §3, §6, §7 |
| **Macro** | wave series → continent | Between waves: repair, upgrade (T1→T2→T3), expand hard points. Clear wave → **story**. Beat a faction → **unlock its units** (Pillar 4, §9). Advance scale: path → castle → kingdom → continent → planet → PvP/co-op (§1, §4). | §1, §3, §4, §8, §9 |

**Feedback & reward economy (BULWARK spec):**
- **Per-kill micro-reward:** coin animation + "classic console" coin sound on every kill (Visuals §10) — a reliable "cha-ching" that rewards each successful read.
- **Universal completion signal:** the **gold pie-sweep** radial flash is reused for build, repair, and every upgrade tier (Visuals §5). One learned signal across three contexts — economical and reinforcing.
- **Readability as feedback:** sensors lead, weapons follow (Visuals §2.1), so the player reads *who is about to shoot whom, and how soon* before damage resolves — the raw material for skillful pre-emption.

**Night Battle (advanced) — a source-noted second fog layer.** The current GDD §3 specifies a Night Battle mode that **changes each faction's strategy** and adds **lighting as a second fog layer** — the player sees less, and some factions (Dark Energy, Space Tech) see more (GDD §5). This is a loop-altering toggle that layers on top of the day loop rather than replacing it, and should be tracked as an additional legibility stressor (see §3–§4).

---

## 2. Benchmark Deconstruction

Five titles were chosen because each shares one of BULWARK's structural DNA strands: **lane TD**, **build↔wave alternation**, **counter-based asymmetry**, **"simple front, deep back" scaling**, and **run-based unlock progression**.

**A — Kingdom Rush (Ironhide) — classic lane TD.** Micro: towers auto-target; player triggers per-tower abilities and drops reinforcements/hero commands. Macro: level clear → stars → tech-tree + tower unlocks; three-star replay. *Maps to:* BULWARK's fixed-lane "Path" tier (§4) and per-tower T1→T3 upgrade ladder (§8). *Lesson:* Kingdom Rush keeps the micro layer optional-but-rewarding — BULWARK's sensor telegraph should similarly reward attention without punishing passive play.

**B — Bloons TD 6 (Ninja Kiwi) — "deep back" TD.** Macro standout: a persistent Monkey Knowledge meta-tree layered over per-round upgrade paths drives "one more map" pull. *Maps to:* BULWARK's **"simple front, deep back"** pillar (Pillar 5) — "one tower on one lane scales to planets with no new rules" (§4). *Lesson:* BTD6's depth lives in *combinations*, not new verbs — a model for how BULWARK's damage×armor matrix can deepen without adding UI.

**C — They Are Billions — RTS/TD hybrid.** Explicit **economy build ↔ wave defense** alternation with terrain (walls/chokes) as a primary defensive tool. *Maps to:* BULWARK's literal Day Build / Day Battle split (§3) plus terrain-as-defense — walls/moats reroute paths (§5, §8, Pillar 2). *Lesson:* the build phase must feel like consequential preparation, not a menu; TAB earns this via visible wall placement and pathing.

**D — Slay the Spire — roguelite unlock reference (not a TD).** Macro: beat content → unlock cards/relics → the next run plays differently. Additive, curiosity-driven. *Maps to:* BULWARK's **"Earn by beating"** pillar (Pillar 4) — "defeating a faction unlocks its units" (§9). This is BULWARK's most distinctive strand and has **no pure-TD analogue**, so it is benchmarked against the genre that executes it best. *Lesson:* unlocks must visibly change *how you play*, not just what you own.

**E — Advance Wars / Into the Breach — asymmetric counter combat.** Meso satisfaction from readable **rock-paper-scissors** matchups the player pre-empts. *Maps to:* BULWARK's damage-type × armor-class matrix, an RPS layer grounded in the current `Effectiveness` sheet (6 damage types × 5 armor classes):
- **Poison:** 1.8× vs Organic, 0.1× vs Machinery, **0× vs Structure** (machines & energy effectively immune, per `DamageTypes`)
- **Electric:** 1.8× vs Machinery; **chains** to nearby; disables machines
- **Concussion:** 1.7× vs Machinery, 0.4× vs Organic; brief machine **Stagger**
- **Fire:** 1.3× vs Organic, 1.1× vs Structure (burn DoT)
- **Frost:** slows **all except air** (design rule: deals listed damage to Aircraft but applies **no slow** to air), modest direct damage
- **Kinetic:** baseline 1.0× across the board (1.1× vs Energy)

*Lesson:* Into the Breach makes counters **legible before commitment** — BULWARK's sensor-leads-weapon telegraph is the mechanism that can make its matrix equally readable in real time.

**Balance-model note (source-change watch):** The `bulwark-balance.xlsx` model is **v1, even-baseline**: every base unit spends the **same 100-point power budget** across HP/DPS/Range/Speed/Utility, cost is derived flat from power (`Cost_per_power_gold = 3`), and faction modifiers are **mild, net-neutral tilts (avg ≈ 1.00)** — flavor, not advantage (`Overview`, `Faction_Mods`). This means BULWARK's asymmetry lives almost entirely in **damage-type texture and unit shape**, not raw strength — reinforcing that the RPS matrix is the load-bearing counter layer, and that true prices are resolved later by the automated sim (GDD §17).

---

## 3. Loop Coverage & Risk Analysis

BULWARK is unusually well-covered at every tier — but each strand imports a known failure mode. Per GDD §0, several of these strands are also **separable, independently gradeable subsystems** in the benchmark; that column is added below.

| Strand | Best-in-class | Coverage | Gradeable subsystem (GDD §0) | Primary risk |
|---|---|---|---|---|
| Micro telegraph | Into the Breach | Strong (Visuals §2.1) | Vision rules | Telegraph too subtle to read at planet-scale unit counts; night fog layer (§3/§5) compounds it |
| Meso wave defense | Kingdom Rush | Strong (§3, §6) | Base-pathing | Passive play if micro reward is too automatic |
| Build↔battle | They Are Billions | Strong (§3, §5) | Structure lifecycle | Build phase feels like a menu, not preparation |
| Deep-back scaling | Bloons TD 6 | Strong (Pillar 5, §4) | Balance sim (§17) | Complexity leaks to the front and breaks "simple front" |
| Unlock progression | Slay the Spire | **Distinctive** (Pillar 4, §9) | (roster/alignment §10–§11) | "Defeat-to-unlock" frustrates if defeat isn't clearly *progress* |

**Added risk (source-change watch): Night as a second fog layer.** GDD §3/§5 now specify night lighting stacking on continent-level fog, with some factions partly ignoring it. This is a deliberate legibility inversion that intensifies the dominant risk below — the telegraph and RPS reads must survive *reduced* visibility, not just high unit density.

---

## 4. Recommendations

1. **Protect the "simple front, deep back" contract.** Keep the damage×armor matrix (§7, `Effectiveness`) as the *only* depth axis at the front; push all new depth into combinations and meta-unlocks, per BTD6. The even-baseline balance model (`Overview`) makes this contract literal — since raw power is flat, the matrix *is* the front-line depth.
2. **Make the telegraph scale — including at night.** The sensor-leads-weapon read (Visuals §2.1) is the project's core skill expression — pressure-test its legibility at high unit density **and under the night fog layer** (GDD §3/§5) before it becomes noise. **[ASSUMPTION: high-density and low-light readability untested at IDEA stage.]**
3. **Reframe defeat as reward.** Since "defeating a faction unlocks its units" (§9),
