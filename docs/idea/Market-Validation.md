# Market Validation — Bulwark MM

> **Sourcing note:** This analysis incorporates the full **`bulwark-gdd`** (v2.0) and its companion **`bulwark-visuals`** (v1.0). Concept, systems, and presentation fundamentals below are **confirmed from these source files** and no longer speculative. The **`bulwark-balance.xlsx`** workbook (the canonical, data-driven stat source) is referenced by both docs but was not provided in machine-readable form; specific per-unit balance figures remain **[ASSUMPTION]** pending that file — though the *design intent* around balance (deterministic sim pricing, 6×5 damage/armor matrix) is confirmed in the GDD. Market figures are drawn from public/third-party sources and are directional; Steam does not publish unit sales.

---

## 0. Concept Snapshot (Confirmed from Source Files)

| Field | Answer | Confidence |
|---|---|---|
| Working Title | Bulwark (codename; renamable) | Confirmed (GDD §0) |
| One-Sentence Pitch | *"Fortify a clearing, learn a faction, beat it, take its units — then do it again one scale up."* | Confirmed (GDD §1) |
| Genre / Category | Multi-faction, multi-domain **tower defense / base-defense** with an automated balance sim | Confirmed (GDD §1) |
| Core Loop | Scout → Fortify → Defend → Collect → Upgrade → Story → next continent (real-time economy) | Confirmed (GDD §3, §13) |
| Domains | Ground / water (incl. sub-surface) / air, with vision/radar/fog rules | Confirmed (GDD §5) |
| Scale ramp | Path → Field → River/Coast → Mountain → Castle → Kingdom → Continent → Planet → PvP/Co-op | Confirmed (GDD §4) |
| Content depth | 9 asymmetric factions, 81 named heroes across a 9-alignment spectrum, cross-faction drama threads | Confirmed (GDD §9–§12) |
| Distinctive tech | Deterministic balance sim that **prices units by average DPS over 100 headless battles** | Confirmed (GDD §17) |
| Visual approach | **Layered 2.5D** — stacked, independently-animated 2D surfaces faking 3D via layer order, shadows, and camera rotation | Confirmed (Visuals §1–§2) |
| Platform(s) | Not specified in GDD; 2D-sprite rendering with **mouse/touch input parity** (single pointer or single finger) — phone-capable | Confirmed input model (Visuals §8); platform target still a product decision |
| Target Audience | Not explicitly stated; profile inferred as strategy/builder/defense enthusiasts | Inferred |
| Monetisation | Not specified in either source doc | Unstated |

**Remaining blocking items:** **Platform target** and **monetisation** are still unresolved product decisions. Note the input model is now settled — the Visuals spec mandates **full single-pointer/single-finger parity with no keyboard requirement** (Visuals §8), which materially widens platform optionality (see §1 macro forces). Target-audience definition should follow from the platform call. Genre, loop, presentation, and differentiation are firmly established, so Sections 1–3 are validated against the correct comparable set.

**Important correction retained:** *Bulwark* is **not** primarily a roguelite. The GDD structures progression as a **campaign that scales up in board size** (path → planet) with **story unlocks and captured units**, not run-based meta-progression. Roguelite framing remains demoted throughout.

---

## 1. Genre / Category Health

*Bulwark* sits squarely in **tower/base defense**, extended with **fortress-building** (walls, moats, traps, structure lifecycle — GDD §8) and **multi-domain strategy** (ground/water/air with scouting and fog — GDD §5). It draws on three adjacent, healthy segments:

- **Tower / base defense.** A mature, durable niche — not an explosive-growth category. Anchored by long-tail perennials (e.g., *Bloons TD 6*), not blockbusters. Steady release cadence, steady demand. *Bulwark*'s explicit "path → castle → kingdom → continent → planet" scaling (GDD §4) is an unusually ambitious answer to this genre's typical replayability ceiling.
- **City / fortress builders.** Demonstrably strong on PC. *Manor Lords* (Hooded Horse) reportedly surpassed **1M copies within a day** of its April 2024 launch and led Steam wishlists pre-launch — clear evidence of large latent demand for builder/strategy hybrids. *Bulwark*'s structure lifecycle and terrain-as-weapon pillars (GDD §2, §8) target this appetite.
- **Multi-domain / asymmetric strategy.** The 9-faction directed counter graph with unlock-on-defeat (GDD §9) is closer to a collectible-strategy loop than a pure defense title — a differentiator (see §3), not a fatigue signal.

**Table-stakes / trending mechanics (mapped to source files):**
- Wave-based progression with campaign-level story unlocks (GDD §3, §14) — retention lever confirmed.
- **Deterministic, spreadsheet-driven balance** — the `bulwark-balance.xlsx` workbook (GDD §7, §17, §18) makes balance a first-class, data-driven design pillar with a rule ("no hardcoded balance"). This is a genuine positive signal and the game's most defensible technical moat.
- Terrain-as-defense and domain-split combat (GDD §5, §8) — deeper than the genre norm.
- **Presentation polish as a marketing asset.** The Visuals spec's **layered 2.5D** approach — a four-layer unit stack (legs/body/weapon/head) with a **sensor-leads-weapon telegraph**, universal shadows conveying altitude, dirt-on-movement, three-part shot FX, and a signature **gold "pie-sweep" completion flash** (Visuals §2–§5) — gives the title a distinctive, screenshot-legible look without a full-3D art budget. **Camera rotation is a first-class control** that shows off the layer parallax (Visuals §7), a natural trailer/GIF hook.
- Steam Workshop / mod support — a proven long-tail retention driver for builder/strategy titles. The GDD's explicit **builder tool / content pipeline (§16)** plus the atlas/state-driven sprite contract is a strong foundation for this; recommend confirming public-facing mod support as a roadmap item.

### Breakout successes and cautionary signals

**Category-adjacent successes:**
- **Manor Lords** — >1M day-one sales (2024); validates builder/strategy demand.
- **They Are Billions** — colony-builder + tower-defense fusion; validated the exact defense-builder hybrid *Bulwark* targets, and the closest structural comparable.
- **Kingdom Two Crowns** — long-selling minimalist defense-builder; proves "defend a base against waves" has durable appeal — the same core loop as *Bulwark*'s per-continent arc (GDD §14).
- **Bloons TD 6** — perennial premium + DLC earner with an exceptionally long tail on mobile/PC; a model for deep, data-tuned tower rosters.

**Risks:**
- The strategy/builder space is **crowded at the low-mid tier**. Many well-reviewed builders never clear low-thousands lifetime sales — discovery is dominated by a handful of tentpoles.
- **Scope risk over roguelite fatigue.** With the prior roguelite assumption removed, the dominant execution risk shifts to the sheer breadth of the source material — 9 factions × 81 heroes × 9 scale tiers × multi-domain combat, *plus* the Visuals spec's substantial presentation demands (four-layer per-unit animation, shadow/altitude system, FX suite, camera rotation, replay). Both source docs mitigate this by converging on a single **vertical slice** as the primary deliverable — GDD §19 for systems and Visuals §10 for its visual definition of done — which is the correct scoping discipline.

### Macro forces
- **Discoverability, not demand, is the binding constraint.** Steam ships well over 10,000 titles/year (SteamDB); pre-launch wishlist accumulation largely determines fate.
- **Premium buy-once remains viable** for PC strategy/builders — unusual in a broadly F2P-dominated market, and a natural fit for *Bulwark*'s campaign-and-unlock structure.
- **Cross-platform expectation is rising** — and here the source files materially strengthen the position. The Visuals spec mandates **input parity across a single pointer (mouse) or single finger (touch), with no multi-key combos or required keyboard** (Visuals §8), and the GDD's 2D-sprite, sim/render-separated architecture (§18) keeps porting options open. This is a **phone-viable design by construction**, not a retrofit — meaningfully de-risking a mobile SKU if the platform decision goes that way, though it would still face stiff mobile-defense competition.

---

## 2. Sales & Engagement Benchmarks

> Figures are third-party estimates (VG Insights, Gamalytic) or press-reported; treat as directional.

| Title | Category | Typical Price | Sales Signal | Sentiment |
|---|---|---|---|---|
| Manor Lords | City/fortress builder | ~$40 | >1M day-one (press) | Very Positive |
| They Are Billions | Colony + TD hybrid | ~$30 | Multi-million lifetime (est.) | Very Positive |
| Kingdom Two Crowns | Defense-builder | ~$20 | Strong long tail | Very Positive |
| Bloons TD 6 | Tower defense | ~$14 + DLC | 20M+ (Ninja Kiwi, reported) | Overwhelmingly Positive |
| Median low-mid builder | Builder/strategy | $15–25 | Low-thousands lifetime | Mixed–Positive |

**Interpretation of the spread:** The category exhibits a severe power-law. The ceiling is high (7-figure hits exist), but the median outcome is modest. Outcomes cluster on (a) a differentiated hook, (b) a strong pre-launch wishlist base, and (c) sustained post-launch content or mod support. *Bulwark* must plan around the median, not the ceiling — with the vertical slice (GDD §19 / Visuals §10) as the wishlist-driving proof point. Note the slice's visual DoD explicitly includes trailer-ready elements — camera rotation demonstrating parallax, the gold completion flash, the coin/kill feedback — which doubles the slice as a **marketing capture asset**, not just an engineering milestone.

**Engagement benchmarks (genre norms):**
- Builders/strategy skew to long sessions (45–120+ min) and high hours-per-buyer (20–100+), which supports premium pricing. *Bulwark*'s session shape (Scout → Fortify → Defend → Collect → Upgrade, GDD §3) and scale ramp fit this profile well.
- The faction-unlock-on-defeat loop (GDD §9) and 81-character story layer (GDD §11–§12) are natural hours-per-buyer and long-tail drivers if executed — potentially exceeding genre-median retention.
- **Replay/battle-log system** (Visuals §9) — every deterministic battle is silently logged and replayable from the Main Menu. Beyond doubling as the determinism acceptance
