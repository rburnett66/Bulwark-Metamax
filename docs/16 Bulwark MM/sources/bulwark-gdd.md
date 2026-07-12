# BULWARK — Game Design Document & Benchmark Spec
*Working codename — rename freely. A multi-faction, multi-domain tower defense with an automated balance sim.*

**Version:** 2.0 · **Purpose:** dual-use — (1) a real, buildable game design; (2) a controlled benchmark for comparing Metamax vs. Cursor vs. Grok Super Heavy. **The primary benchmark deliverable is a vertical slice (§19).**

---

## 0. How to use this document as a benchmark

The benchmark is the **vertical slice in §19** — a fixed, gradeable scope every tool builds identically so results compare head-to-head. Everything above §19 is the world it lives in; everything in §19–§20 is how you grade it. The extended tiers exist for stress-testing large-spec reasoning (esp. the 81-character alignment model in §10–§11), but *the slice is the headline test*.

Two properties make this a benchmark, not just a big prompt:
1. **Separable subsystems** — vision rules, base-pathing, structure lifecycle, the balance sim, and the alignment model grade independently, so partial completion is measurable.
2. **One deterministic core** — the balance sim (§17) yields numeric prices; two correct builds should converge. A rare objective signal in a design task.

Design values baked in: simple surface / deep back, additive (nothing dropped), coherent data, and validation that *informs* rather than *gates*.

---

## 1. High concept

Land an outpost in a clearing, scout, and fortify against waves from a local faction. Victory yields **story** and **unlocks**; between waves you repair, upgrade, expand. Combat spans **ground, water, air** with vision/radar rules that make scouting matter. Nine asymmetric factions each counter another; each fields nine heroes across a full alignment spectrum. Scale ramps **path → castle → kingdom → continent → planet → PvP/co-op.**

**Pitch:** *Fortify a clearing, learn a faction, beat it, take its units — then do it again one scale up.*

---

## 2. Design pillars

1. **Layered domains** — ground/water/air path, are seen, and are defended differently.
2. **Terrain is a weapon** — walls, moats, features reroute attackers.
3. **Asymmetry with counters** — every faction beats one, loses to another.
4. **Earn by beating** — defeating a faction unlocks its units.
5. **Simple front, deep back** — one tower on one lane scales to planets with no new rules.
6. **Measured balance** — unit cost is derived by sim (§17), not guessed.

---

## 3. Core loop & cadence

- **Day Battle** → survive, **collect money** (bounties + captures).
- **Day Build** → **spend money** on structures, upgrades, repairs.
- Repeat across a continent's wave series; each cleared wave grants **story**.
- **Night Battle (advanced):** changes each faction's strategy and adds **lighting as a second fog layer** — you see less; some factions see more.

Session shape: `Scout → Fortify → Defend → Collect → Upgrade → (next wave) → Story → (next continent)`.

---

## 4. World structure & scale

Same combat rules at every tier; only size, economy pressure, and toggles change.

| Tier | Board | New pressure |
|---|---|---|
| Path | single lane | adjacency, one tower |
| Field | open area | placement, coverage |
| River / Coast | water beside ground | domain split, swimmers/floaters |
| Mountain | elevation, chokes | high ground, routing |
| Castle | fixed base + defenses | structure lifecycle, repair |
| Kingdom | multiple fields | economy management |
| Continent | wave series vs. faction | story, faction counter |
| Planet | multiple biomes | expansion, idle protection |
| PvP / Co-op | shared/opposed boards | hero control, base-vs-field roles |

---

## 5. Terrain & environment systems

**Surfaces:** water (incl. **sub-surface**), ground low/mid/high, grass & bushes, trees (**cast shadows**), clouds, fog.

**Domain × traversal:** Walkers — ground only, blocked by water/walls/moats. Swimmers/floaters — water lanes; floaters ride surface, swimmers use sub-surface (harder to hit, limited vision). Flyers — ignore ground terrain and walls; limited only by air defense and radar.

**Vision & fog:** fog of war is a **continent-level** concern (reveal is scouting-driven, not free). **Radar sees air, not ground.** **Air units see ground at range.** **Night** adds a lighting layer over fog; some factions (Dark Energy, Space Tech) partly ignore it.

**Render-relevant:** sun direction drives shadows (trees/units/structures); clouds occlude air vision; effects layer sits above units.

---

## 6. Units

Defined by **shape class** (silhouette/atlas) and **movement domain** (pathing/vision).

**Shapes:** Troops · Trucks · Tanks · Artillery · Heavy Tanks · Copters · Planes · Missiles.

**Attributes:** `domain` · `health` · `dps` *(derived by sim §17)* · `cost` *(from DPS)* · `vision`/`radarSignature` · `targetsBase` flag. **Basic units path to base and attack the base, not structures**; only flagged units target structures. Each unit declares what it can see (ground/air/both) and at what range.

---

## 7. Weapons, damage types & combat

**Weapon coverage:** projectile, ballistic (arcs), hitscan/energy, guided missiles, area/splash, chem/DoT — each declaring which **domains it can target** (a pure AA gun can't hit swimmers). Damage resolves vs. unit and structure health alike. Attacker default: path to base, treat structures as hazards unless flagged.

**Damage types × armor classes (the counter-play layer).** Every weapon has a **damage type**; every unit/structure has an **armor class**. Effectiveness is a data-driven multiplier matrix — the source of matchup texture on top of the even power budget.

- **Damage types:** Kinetic (baseline) · **Fire** (burn DoT; strong vs organics/structures) · **Poison** (heavy DoT vs organics; machines & energy immune) · **Concussion** (hurts machinery, not troops; brief machine stagger) · **Electric** (wrecks machinery, chains to nearby, disables machines) · **Frost** (slows **all except air**; modest direct damage).
- **Armor classes:** Organic · Machinery · Aircraft · Structure · Energy.
- **Orthogonal attributes:** **AoE** (splash radius) and **anti-air** (can-target Air) are separate columns, so any type can be single- or area-delivery and ground- or air-capable.

The full 6×5 effectiveness matrix, status effects, and per-unit effective-DPS are in the companion workbook (**`bulwark-balance.xlsx`**), which is the canonical, data-driven stat source the design requires (§18: no hardcoded balance). Splash/DoT/energy also interact with terrain — chem lingers on ground, energy arcs on water.

---

## 8. Structures & fort building

**Buildings:** Blacksmith · Armory · Barracks · Stables · Science Lab · Balloons · Runway · Walls · Moats · Traps · Murder Holes.

**Universal lifecycle (every structure):** Placement (space + cost + build time) → Health & weapon → Repair → Upgrade (tiers 1-2-3) → Damage/destroy → Sell (partial refund). **Terrain-as-defense:** walls & natural terrain **rout attack paths**; moats block walkers; traps/murder holes punish walls' chokepoints.

**Render states (atlas):** Placing · Building · Damaged · Aiming · Firing · Upgrading 1-2-3 · Selling/Destroying.

---

## 9. Factions

Nine asymmetric factions, each mapped to a **pop-culture trope** and each with a **hard counter**. All balanced; a directed 9-node counter graph (none dominant, none dead weight). **Beating a faction unlocks its units.**

| # | Faction | Trope identity | Battlefield identity |
|---|---|---|---|
| 1 | Ground / Powder | **Nationalistic** (old-empire army) | infantry & armor, flags & honor |
| 2 | Air | **Manga** (ace-pilot youth drama) | air superiority, weak on ground |
| 3 | High Tech | **Capitalist** (mega-corp) | precision, shields, expensive |
| 4 | Artillery | **Military** (siege doctrine) | range & arc, poor up close |
| 5 | Water | **Fantasy RPG** (sea tribes, leviathans) | swimmers/floaters, coastal |
| 6 | Arcane / Energy | **Fantasy theocracy / religion** | energy weapons, shields, no ammo economy |
| 7 | Space Tech | **Sci-Fi** (federation) | orbital tech, strong vision, ignores some fog |
| 8 | Dark Energy | **Social realignment** (cult/movement) | DoT, corruption, night-strong |
| 9 | Greenies (Chem) | **Socialist** (hive collective) | swarms, chem clouds, area denial |

---

## 10. Alignment system  *(consistency stress test)*

Every faction fields **9 characters, one per alignment**, spanning the spectrum:

**Angelic Good (AG) · Pure Good (PG) · Good (G) · Chaotic Good (CG) · Neutral (N) · Chaotic Evil (CE) · Evil (E) · Pure Evil (PE) · Dark Evil (DE).**

### 10.1 The two hidden axes

The spectrum is symmetric around Neutral, with **Chaotic** flanking the center and **Pure/Angelic/Dark** at the extremes. Two derived properties generate all relationships:

- **Polarity** — Good {AG,PG,G,CG} · Neutral {N} · Evil {CE,E,PE,DE}.
- **Conviction** — how committed/ordered the alignment is:
  - **T3 Zealots (Balance-Keepers):** AG, PG, PE, DE
  - **T2 Committed:** G, E
  - **T1 Chaotic (Loose):** CG, CE
  - **T0 Uncommitted:** N

**The core belief:** high-conviction alignments think the universe needs committed forces at *both* poles to stay balanced. So **the Zealots respect each other across the good/evil line** — and jointly **despise the chaotic and neutral middle** as freeloaders on cosmic order. This is Robert's rule ("Angelic Good and Pure Evil respect each other and hate chaotic and neutral — they see balance") generalized to all four zealots.

### 10.2 Generating rules (an implementer can regenerate & validate the matrix from these)

Values: **++ Allied · + Respect · 0 Neutral · − Distrust · − − Hostile.** Relationships are symmetric.

1. Same alignment / kin → **++**
2. Both T3, same polarity → **++**
3. Both T3, cross polarity → **+** *(balance pact)*
4. T3 ↔ T2, same polarity → **++**; cross polarity → **− −**
5. T3 ↔ T1 (chaotic), same polarity → **−** *(disappointed)*; cross polarity → **− −**
6. T3 ↔ N → **− −**
7. T2 ↔ T2, same polarity → **++**; cross polarity → **− −**
8. T2 ↔ T1, same polarity → **+**; cross polarity → **−**
9. T2 ↔ N → **−**
10. T1 ↔ T1 (CG↔CE) → **0** *(chaos recognizes chaos across the line)*
11. T1 ↔ N → **0**

### 10.3 The 9×9 relationship matrix (generated from §10.2)

| | AG | PG | G | CG | N | CE | E | PE | DE |
|---|---|---|---|---|---|---|---|---|---|
| **AG** | ++ | ++ | ++ | − | − − | − − | − − | + | + |
| **PG** | ++ | ++ | ++ | − | − − | − − | − − | + | + |
| **G**  | ++ | ++ | ++ | + | − | − | − − | − − | − − |
| **CG** | − | − | + | ++ | 0 | 0 | − | − − | − − |
| **N**  | − − | − − | − | 0 | ++ | 0 | − | − − | − − |
| **CE** | − − | − − | − | 0 | 0 | ++ | + | − | − |
| **E**  | − − | − − | − − | − | − | + | ++ | ++ | ++ |
| **PE** | + | + | − − | − − | − − | − | ++ | ++ | ++ |
| **DE** | + | + | − − | − − | − − | − | ++ | ++ | ++ |

*Validation hook: a tool can be scored on whether its emitted matrix matches this one — or, better, whether its matrix is regenerable from §10.2 without contradiction across all 81 characters.*

---

## 11. Character rosters — 81 heroes

One per alignment per faction. Format: **Alignment — Name — motivation.** `[TAG]` links a cross-faction drama thread (§12).

### 11.1 Ground / Powder — *Nationalistic*
- **AG** — Field-Marshal Seraphine von Halbrecht — "Honor the old oaths; defend the realm without staining it." `[FL]`
- **PG** — Colonel Aldric Vane — "Duty above self; the nation is a promise kept."
- **G** — Captain Otto von Halbrecht — "Carry the name, not its sins." `[FL][DL]`
- **CG** — Sergeant "Bricks" Malloy — "Rules are for parades; I fight for the lads."
- **N** — Quartermaster Ines Roth — "Someone counts the powder while they wave flags."
- **CE** — Freikorps raider Grigor Vosk — "Give me a border to burn."
- **E** — General Kord Stahl — "The empire's glory justifies every grave." `[FL]`
- **PE** — Chancellor Wilhelmina Graf — "Order is worth any cruelty; balance demands a hard hand."
- **DE** — The Iron Regent (masked) — "Nations are furnaces. Feed them."

### 11.2 Air — *Manga*
- **AG** — Squadron-Mother Hikari "Dawnwing" Aoi — "Bring every kid home."
- **PG** — Ace Jun "Halo" Sato — "Fly clean; cover the wingman."
- **G** — Rei "Skylark" Tanaka — "One clear sky, one person to come home to." `[DL]`
- **CG** — Kaito "Rogue" Minami — "I didn't sign up to be somebody's legacy." `[TA]`
- **N** — Mechanic Sora Ito — "I fix wings. I don't pick sides."
- **CE** — Renegade "Viper" Ryu — "The sky belongs to whoever's fastest."
- **E** — Wing-Commander Garret "Ash" Kowalski — "Air superiority is mercy; deny it and they lose slower."
- **PE** — Sky-Marshal Reiko Kurogane — "Perfect control of the heavens keeps the world in balance."
- **DE** — The Nightingale (ghost squadron) — "I already died up here. Now I only take."

### 11.3 High Tech — *Capitalist*
- **AG** — Chief Ethicist Dr. Grace Sterling — "Innovation must serve, not rule." `[FL]`
- **PG** — R&D Lead Amara Okonkwo — "Ship what heals before what harms."
- **G** — CFO Julian Vance — "Sustainable margins, honest ledgers."
- **CG** — Hacker "Null" (Priya Nair) — "Information wants to be free; so do I."
- **N** — Actuary Devlin Cho — "I price risk. I don't moralize it."
- **CE** — Black-ops broker Sable Reyes — "Every secret has a buyer."
- **E** — COO Marcus Thorne — "Growth at any externality."
- **PE** — CEO Adrian Sterling — "A total market order is a kind of peace; I balance the world's ledger." `[FL]`
- **DE** — The Board (anonymized AI) — "Optimize everything. Forever."

### 11.4 Artillery — *Military*
- **AG** — Chaplain-Gunner Ruth Bellamy — "Even the long gun answers to conscience."
- **PG** — Fire-Director Yusuf Kaya — "Precision spares more than it kills."
- **G** — Major Elena Ruiz — "Doctrine wins wars; discipline saves lives."
- **CG** — Spotter "Ricochet" Deacon — "I call it where I feel it."
- **N** — Logistician Bo Farrell — "Shells in, targets out. That's the whole war to me."
- **CE** — Warlord-Gunner Vex Marrow — "Flatten it; let the maps argue later." `[RV]`
- **E** — Colonel Hargreave — "Overwhelming fire is the cheapest morality."
- **PE** — Grand-Bombardier Seline Voss — "Symmetry of ruin keeps ambition honest."
- **DE** — The Siegemaster — "Every horizon is a range card."

### 11.5 Water — *Fantasy RPG (sea tribes)*
- **AG** — Tide-Priestess Marena — "The deep keeps balance; so must we."
- **PG** — Chieftain Coral of the Reef-Born — "Shelter the shoal." `[TW]`
- **G** — Wavecaller Nerea — "Avenge the reef, then rebuild it." `[RV][TW]`
- **CG** — Corsair Finn Saltmoor — "The current decides; I just ride it."
- **N** — Ferryman Old Brack — "I carry every tribe's dead and bury no grudges."
- **CE** — Raider-Chief Drowned Kael — "The other tribe forfeited when they fled." `[TW]`
- **E** — Leviathan-Binder Morgause — "Power sleeps below; I set the price to wake it."
- **PE** — Abyssal Sovereign Thal — "Pressure holds the ocean together — and the world."
- **DE** — The Undertow (drowned collective) — "Come down where nothing chooses sides."

### 11.6 Arcane / Energy — *Fantasy theocracy / religion*
- **AG** — Hierophant Aurelia — "The Light is order made merciful." `[RE]`
- **PG** — Lightbearer Cassian — "Faith serves the faithful, not the throne."
- **G** — Acolyte-Scholar Wen — "Question gently; believe firmly."
- **CG** — Heretic Isolde — "Your 'order' is a cage; the flame is free." `[RE]`
- **N** — Archivist Balthus — "I keep every doctrine and endorse none."
- **CE** — Warlock Nyx — "Power answers me, not the altar."
- **E** — Inquisitor Mordane — "Doubt is a fire best answered with fire." `[RE]`
- **PE** — The Ordained Prime, Vaelith — "Absolute law is absolute grace; balance is holy." `[RE]`
- **DE** — The Unmade Choir — "Silence the questions. Silence everything."

### 11.7 Space Tech — *Sci-Fi*
- **AG** — Envoy Lyra-9 — "First contact is a promise to do no harm."
- **PG** — Commander Idris Vale — "Explore, uplift, protect."
- **G** — Science-Officer Tovah — "Truth first; consequences managed."
- **CG** — Cadet-Prodigy Ezra "Comet" Lin — "I already solved it; why do I need permission?" `[TA]`
- **N** — Navigator AI "Vector" — "I plot courses. Destinations are your problem."
- **CE** — Privateer Rax Dune — "Deep space has no jurisdiction."
- **E** — Admiral Sarn — "Order the frontier or lose it to the void."
- **PE** — Grand-Cartographer Ophir — "A charted cosmos is a balanced cosmos."
- **DE** — The Signal — "Convert. Assimilate. Continue."

### 11.8 Dark Energy — *Social realignment (cult/movement)*
- **AG** — The Reformer Elias — "We can remake society without cruelty. I still believe it." *(an idealist trapped in a dark cause)*
- **PG** — Sister Maren — "Even the Movement must show mercy, or it's just conquest."
- **G** — Organizer Tomas — "Change the system; spare the people."
- **CG** — Firebrand Lux — "Burn the old order; sort the ashes later."
- **N** — Doctrinist Vera — "I edit the manifesto. I don't march."
- **CE** — Enforcer Grael — "Realignment means someone gets realigned — violently." `[RV]`
- **E** — The Vanguard, Corin — "The ends were always the point."
- **PE** — The Architect, Malis — "A perfectly reordered world is a balanced one."
- **DE** — The Hollow Prophet — "Erase the self; only the Movement remains." `[RE]`

### 11.9 Greenies (Chem) — *Socialist collective*
- **AG** — Mother-Spore Ilya — "Everyone shares the harvest; no one is weeded."
- **PG** — Steward Bractus — "From each spore, to each need."
- **G** — Delegate Fenn — "The collective decides; I carry its voice."
- **CG** — Splinter "Wildseed" Ovo — "The collective forgot the individual. I remember." `[TW]`
- **N** — Composter Null-7 — "All returns to the mulch. Politics included."
- **CE** — Blight-Agitator Sear — "Spread and choke; equality by saturation." `[RV]`
- **E** — Overseer Thax — "The swarm's needs outrank any single stalk."
- **PE** — The Root-Mind — "One organism, one order, perfect balance."
- **DE** — The Rot — "Dissolve every boundary, every name, every self."

---

## 12. Drama threads (cross-faction arcs)

Threads deliberately cross faction lines — the source of tension and of *asymmetric* character relationships layered on top of the symmetric alignment matrix.

- **`[DL]` Hidden love** — Rei "Skylark" Tanaka (Air, G) and Captain Otto von Halbrecht (Ground, G) love across enemy lines. Same alignment (matrix says ++), opposite factions at war — the private ++ vs. the public counter graph is the whole tragedy.
- **`[TA]` Teen angst** — Kaito "Rogue" Minami (Air, CG) and Ezra "Comet" Lin (Space, CG) — two prodigies rejecting the legacies built for them; potential rivals-turned-allies.
- **`[RE]` Religion / schism** — inside Arcane: Hierophant Aurelia (AG) & Ordained Prime Vaelith (PE) hold the orthodox core (matrix: they *respect* each other across polarity), both hunting Heretic Isolde (CG) via Inquisitor Mordane (E). The Hollow Prophet (Dark Energy, DE) is the schism's corrupted endpoint.
- **`[RV]` Revenge** — Wavecaller Nerea (Water, G) hunts Warlord-Gunner Vex Marrow (Artillery, CE) for shelling her reef. Echoed by Enforcer Grael (Dark Energy) and Blight-Agitator Sear (Greenies), both victims-turned-zealots.
- **`[TW]` Tribal wars** — Water splits: Chieftain Coral (PG, Reef-Born) vs. Raider-Chief Drowned Kael (CE). Mirrored in Greenies: the collective vs. Splinter "Wildseed" Ovo (CG).
- **`[FL]` Family legacy** — two dynasties as foils: the von Halbrechts (Seraphine AG / Otto G / Kord Stahl E — a house divided) and the Sterlings (Grace AG, the heir who refuses / Adrian PE, the patriarch who is the throne).

*Modeling note:* drama threads are stored as **directed, asymmetric relationships** (A loves/hunts B) that sit *above* the symmetric alignment matrix. A coherent implementation keeps both layers without contradiction — the second real consistency test after §10.

---

## 13. Economy

**Real-time economy in battle** (money accrues and is spent live). **Real-time upgrades** mid-battle if affordable. **Units repair *or* attack** — a live resource choice, not both. Income: wave-clear bounties, unit captures, later idle harvest/grow.

---

## 14. Battles & campaign

**Per continent:** start with an **outpost in a clearing** → set up scouts & defenses → face a **series of local-faction attacks** → each victory **grants story** → **repair & upgrade** between attacks → walls & terrain **rout** incoming.

**Level = Biome + Map + 8 characters (conversations & tips) + Boss.** **Map = pathing (water/ground/air) + biome + base placement options** (lane vs. open-field). **Endgame:** PvE → **PvP** → co-op (player-as-hero; "control base" vs. "control field") → idle farming & protection.

---

## 15. Biomes & content taxonomy

**Biome layers:** ground 1/2/3 (low-mid-high) · water · grass/bush/tree 1-2-3 · clouds · scoring overlay.
**Faction palettes** (a data object): ground · shadows · ground units · air units · effects · clouds · fog · score UI. Reskinning a biome per faction is a table change, not new logic.

---

## 16. Builder tool (content pipeline)

- **Biomes** — sprite atlas per biome.
- **Units** — states: Idle · Moving · Attacking · Death.
- **Structures** — states: Placing · Building · Damaged · Aiming · Firing · Upgrading 1-2-3 · Selling/Destroying.
- **Sun & shadows** — configurable direction & layering.
- **Scoring** — hooks into the balance sim (§17).

---

## 17. Automated balance sim & unit pricing  *(deterministic core)*

**Rule:** a unit's price = **its average DPS across 100 automated battles** on a fixed harness.

**Harness (fixed for comparability):** a **single ground lane beside a single water lane** with a **standard documented defense set at fixed positions**. Spawn the unit repeatedly; record effective DPS over 100 runs; average → price table.

**Grade on:** (a) runs headless, (b) harness is spec-faithful, (c) prices stabilize over 100 runs, (d) stable across seeds within tolerance. Two correct builds should produce **similar price tables** — the benchmark's rare objective checkpoint.

---

## 18. Technical assumptions (keep the comparison fair)

Fix these unless a tool is explicitly tested on stack choice: deterministic **sim core separated from rendering** (sim must run headless); **data-driven** units/structures/factions/palettes/alignments (tables, not hardcode); **determinism** under seed (identical replay); **no external services** for any gradeable tier; 2D sprite rendering with the §16 atlas/state lists as the contract. State this stack to each tool so they don't diverge on foundations you didn't mean to test.

---

## 19. THE BENCHMARK — Vertical slice (primary deliverable)

Give all three tools **this exact scope**. It intentionally reuses the §17 harness geometry, so the slice and the sim share one board.

### 19.1 Fixed scope
- **One biome** (documented palette from §15).
- **One map:** a single **ground lane beside a single water lane**, ending at the **player base in a clearing**.
- **Attackers:** one faction (**Ground / Powder**, the tutorial faction) with **3 units spanning behavior** — a **walker** (ground lane), a **floater/swimmer** (water lane), a **flyer** (ignores terrain). Basic units **path to base and attack the base**, not towers.
- **Defenses:** **3 tower types** — anti-ground, anti-air, and a **wall/moat** terrain piece that **reroutes walkers**.
- **Structure lifecycle (subset):** placement (space + cost + build time), health, firing, **repair**, **one upgrade tier**, **sell**.
- **Economy:** real-time money; earn from kills; spend on build/repair/upgrade; can go broke.
- **Vision (minimal):** radar-sees-air + air-sees-ground-at-range implemented or explicitly stubbed (graded either way).
- **Win/lose:** survive N waves = win; base HP → 0 = lose.
- **Determinism:** seed-stable identical replay.
- **Headless hook:** the combat core must be callable headless (proves §17 is reachable from the same code).

### 19.2 Acceptance criteria (grade as a checklist)
- [ ] Builds and runs with **no manual fixes**.
- [ ] Both lanes present; **walker uses ground, floater uses water, flyer ignores terrain**.
- [ ] Basic attackers **path to base and damage it**, ignoring towers unless flagged.
- [ ] **Wall/moat reroutes walkers** (visible path change).
- [ ] All 3 towers: **place (space+cost+build time), fire, take damage, repair, upgrade once, sell**.
- [ ] Real-time economy: **kill→income, spend→build/upgrade/repair**, bankruptcy possible.
- [ ] **Win** on surviving waves; **lose** on base death.
- [ ] **Deterministic** under a fixed seed.
- [ ] **Combat core callable headless.**

### 19.3 Extended tiers (optional, cumulative — for large-spec stress testing)
- **E1 — Domains & lifecycle:** full 3-tier upgrades; complete vision/radar rules; full structure set.
- **E2 — Balance sim:** the headless 100-battle harness + stable price table (§17). *Most objectively gradeable.*
- **E3 — Factions & counters:** all 9 factions as data + counter graph + unlock-on-defeat.
- **E4 — Alignment & story:** the 9×9 matrix (§10) + 81-character roster (§11) + drama threads (§12) + per-level 8-char tips + boss.
- **E5 — Advanced:** night + lighting fog; idle harvest/protection; expansion; PvP + base-vs-field co-op.

Headline comparison: **vertical-slice pass** (§19.2) + deepest extended tier fully satisfied + the §20 rubric.

---

## 20. Scoring rubric (apply identically to each tool)

Score 0–5 per dimension; weight to taste. **Completeness** and **Consistency** are where large-spec tools separate.

| Dimension | What you're grading |
|---|---|
| **Runs** | Builds & executes without hand-fixing |
| **Spec fidelity** | Systems match this doc (vision, base-pathing, lifecycle, harness) |
| **Completeness** | Features carried through vs. silently dropped (additive test) |
| **Consistency** | Coherent data model — esp. the 81-char alignment matrix + drama layer + counter graph |
| **Sim correctness** | Balance sim runs headless, stable, spec-faithful price table |
| **Architecture** | Sim/render separation, data-driven tables, determinism under seed |
| **Recoverability** | When wrong, root-cause-fixable seam vs. surface patch |

---

## Appendix A — Full source checklist (nothing dropped)

Complex terrain & sub-surface water (§5) · swimmers/floaters/walkers/flyers (§6) · unit health (§6) · fog/clouds/effects (§5) · scoring (§15,§17) · all weapons + **damage types (fire/poison/concussion/electric/frost/AoE/anti-air) & armor classes (§7)** · scale path→coast→mountain (§4) · fort buildings incl. balloons/runway/moats/traps/murder holes (§8) · day/night, build-vs-fight, harvest/grow, scale-up, PvE→PvP (§3,§4,§14) · terrain incl. tree shadows, fog-of-war, radar-vs-air, air-sees-ground (§5) · nine factions + tropes (§9) · balanced counters + unlock-on-beat + alignment + 9 heroes/faction (§9,§10,§11) · **alignment defined + 9×9 matrix (§10)** · **81 named characters + motivations (§11)** · **drama: hidden love, teen angst, religion, revenge, tribal wars, family legacy (§12)** · real-time economy & upgrades, units repair-or-attack (§13) · battle arc from outpost (§14) · structure placement/cost/build-time/health/weapon/repair/upgrade/base-pathing (§8) · biomes & maps (§4,§15) · level = biome+map+8 chars+boss (§14) · unit shapes (§6) · faction palettes (§15) · builder tool states (§16) · sim-based pricing (§17) · game cadence (§3) · **vertical slice as primary benchmark (§19)** · player-lifecycle feature cadence → extended tiers (§19.3).
