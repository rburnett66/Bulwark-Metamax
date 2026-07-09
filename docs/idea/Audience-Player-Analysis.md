# Audience-Player-Analysis.md

# Audience & Player Analysis — *Bulwark*

**Version:** 2.0 · **Date:** 2025-06-12 · **Prepared By:** MetaMax Research Brain (Research Role)
**Purpose:** Define *Bulwark*'s target players — who they are, what motivates them, how they discover and commit to games, and what would make them feel this concept was built "for them."

> **Sourcing note (RESOLVED):** The authoritative project materials — `bulwark-gdd.md` (Game Design Document & Benchmark Spec, v2.0) and `bulwark-visuals.md` (Visual & Controls Spec, v1.0) — are now in context and are the governing definition of the concept. **The prior "two mutually exclusive concept tracks" framing is retired.** There is **no mining loop and no adult/18+ relationship-management content** in *Bulwark*. Any earlier reference to a "Track B" is void and has been removed. The concept is a **single, well-specified design**: a multi-faction, multi-domain **tower defense / fortification** game with a deterministic balance sim. This analysis is rebuilt entirely against that source.

---

## 0. The Concept, As Sourced

*Bulwark* (working codename) is, per the GDD:

> *"Fortify a clearing, learn a faction, beat it, take its units — then do it again one scale up."*

Land an outpost in a clearing, scout, and fortify against waves from a local faction. Combat spans **ground, water, and air**, with vision/radar rules that make scouting matter. Victory yields **story** and **unlocks** (defeat a faction, gain its units). Scale ramps **path → castle → kingdom → continent → planet → PvP/co-op** using the *same rules at every tier* — "simple front, deep back."

Design pillars that shape the audience read: **layered domains**, **terrain as a weapon**, **asymmetry with counters** (nine factions, a 9-node counter graph), **earn by beating**, and **measured balance** (unit cost derived by an automated 100-battle sim, not guessed). Presentation is **layered 2.5D** — stacked 2D sprites faked into depth via layer order, shadows, and camera rotation — with readable combat (sensor→weapon telegraphing), a universal gold "pie-sweep" completion flash, and a select→preview→confirm deploy loop that works identically on **mouse or a single finger on a phone**.

**Implication for this analysis:** the audience is a **strategy / tower-defense / base-defense** audience — cross-platform (PC and touch), depth-seeking, and drawn by *legible mastery* and *asymmetric variety*. There is one audience model, profiled below.

---

## 1. Primary Audience Profile

### Persona 1 — "The Siege Architect" (primary)

| Attribute | Detail |
|---|---|
| Age / context | 22–40, broad gender spread (co-op and tower-defense audiences skew mixed). Employed, disposable income for premium strategy titles. |
| Platform | **PC (Steam-first)** and **touch/mobile** — the GDD's input-parity mandate (single pointer *or* single finger, no keyboard combos) makes both first-class. |
| Play habits | Session shape `Scout → Fortify → Defend → Collect → Upgrade → Story`. 30–90 min sessions on PC; shorter, repeatable runs on touch. Returns across weeks for new factions/scales. |
| Spend behavior | Buys premium; tolerant of Early Access **if** the core loop is fun and the vertical slice proves out. Values depth and content cadence (new factions, biomes, scales). |
| Emotional drivers | **Mastery** (optimizing defenses, reading counters), **investment protection** (defending the base they built), **creative ownership** (their layout, their hard-point placement), **earn-by-beating** progression (take the units you defeated). |

**Evidence:** *They Are Billions* (~1M+ EA units) proves demand for the **hold-the-line siege fantasy**; *Bloons TD 6* and *Kingdom Rush* prove the **legible, escalating tower-defense loop** travels across PC and mobile; *Valheim*/*Palworld* show the scale and co-op orientation of the build-and-defend audience *Bulwark*'s late-tier PvP/co-op can reach.

### Persona 2 — "The Optimizer / Tinkerer" (secondary)

Solo-leaning strategy/TD player driven by **system mastery**, escalating difficulty, and efficient builds. *Bulwark*'s **damage-type × armor-class matrix** (6×5, data-driven), the **9-faction counter graph**, and the **deterministic balance sim** are catnip for this player — the design promises depth that rewards study without a sandbox's aimlessness. Lower tolerance for grind; high tolerance for punishing difficulty and knowable systems.

### Persona 3 — "The Lore / Faction Collector" (tertiary)

Drawn by the **nine asymmetric factions** (each a pop-culture trope), the **81-hero roster across a 9-alignment spectrum**, and the **cross-faction drama threads** (hidden love, revenge, tribal wars, family legacy, religious schism). Motivated by unlock-on-defeat collection and by story granted per cleared wave. This player values *coherent* worldbuilding — the alignment matrix and drama layer must hold together — and rewards a game that treats its fiction as systematically as its balance.

---

## 2. Jobs-to-be-Done

- **Functional:** an escalating, multi-domain defense loop (ground/water/air) where **terrain reroutes attackers** and **counters matter**; base-building with a full structure lifecycle (place → fire → repair → upgrade → sell); clear progression across scales; a deploy loop simple enough for touch.
- **Emotional:** the tension-and-relief of surviving a wave; pride in a base and hard-point layout that *held*; the satisfaction of **cracking a faction's counter** and taking its units.
- **Social:** war stories, base screenshots, replay clips (the built-in **replay system** is a natural share hook), faction/counter discussion. Late-tier **PvP and base-vs-field co-op** extend this into head-to-head bragging rights.

---

## 3. Discovery & Adoption

- **Channels:** Steam (wishlist algorithm, Next Fest demos), mobile stores (touch parity makes this real), Twitch/YouTube TD & strategy creators, Reddit (r/towerdefense, strategy subs), Discord.
- **Decision sequence:** (1) *Discovers* via creator playthrough, Next Fest, or store feature; (2) *Evaluates* on the **signature moment** — a wave routed through walls/moats into a killbox, or a cracked faction counter — plus review sentiment (>80% "Very Positive" is table stakes) and content-cadence credibility; (3) *Commits* by wishlisting early, buying on a strong demo.
- **Onboarding expectation:** the GDD's **tutorial faction (Ground / Powder)** and the **vertical slice** (one biome, one ground+water lane to the base, three units, three towers) are the make-or-break first impression. Reach the first defended wave fast; teach building *through* the defense loop. The **cinematic auto-rotate** framing the base vs. the incoming threat sells the fantasy before the player takes control.

---

## 4. Pain Points & Friction

- **Competitor gaps the concept exploits:** most tower defense is single-domain and single-faction; *Bulwark*'s **ground/water/air domains**, **nine asymmetric factions with hard counters**, and **earn-by-beating unlocks** are the wedge. *They Are Billions* is punishing and co-op-light; classic TD lacks *Bulwark*'s base-building and scale ramp. The differentiator is **layered domains + asymmetric counters + measured balance** in one accessible package.
- **Adoption barriers:** heavy strategy/TD wishlist competition; "another tower defense" fatigue absent a legible hook (mitigant: the *signature routed-wave / cracked-counter moment*); the risk that **depth reads as complexity** — the "simple front, deep back" pillar and the one-verb deploy loop are the countermeasures and must be preserved in the slice.
- **Consistency risk as a player-trust issue:** the 81-character alignment matrix and drama threads are a selling point *only if coherent*. Contradictions in the fiction erode the Faction Collector's trust — the design's own consistency stress test (GDD §10–§12) is therefore also an audience-facing quality bar.

---

## Key Takeaways & Recommendations

1. **One audience, now sourced.** The concept is a multi-faction, multi-domain **tower defense / fortification** game. Persona planning proceeds on the Siege Architect (primary), Optimizer/Tinkerer (secondary), and Faction Collector (tertiary) — no further concept resolution is blocking.
2. **Win on the signature moment.** Prioritize the **routed-wave / cracked-counter** legible payoff, wishlist-building, Next Fest presence, >80% review sentiment. The **vertical slice (GDD §19)** is the audience's first proof — treat its acceptance checklist as marketing-critical.
3. **Protect "simple front, deep back."** The one-verb deploy loop and touch parity keep the depth-seeking audience *and* the mobile audience reachable. Depth (matrix, counters, sim) must never leak into the onboarding surface.
4. **Treat fiction coherence as a retention lever.** The 81-hero roster, alignment matrix, and drama threads convert the Lore/Faction Collector — but only if internally consistent. Coherence is both a design stress test and an audience-trust bar.
5. **Lean on built-in shareability.** The replay system, cinematic camera, and clean 2.5D visual read (gold pie-sweep, dirt trails, altitude shadows, coin-pop on kills) are ready-made clip fuel — a low-cost, high-value marketing asset for a strategy audience that markets itself when the loop is legible.

*All claims are now grounded in `bulwark-gdd.md` and `bulwark-visuals.md`.*

---

*Generated by MetaMax Research Brain (LangGraph)*
