# Monetization-Business-Model-Research.md

# Monetization & Business Model Research — BULWARK

*Genre-neutral research framework. BULWARK is a multi-faction, multi-domain tower defense with an automated balance sim (bulwark-gdd §1). The source materials do not state a monetization model, platform commercial strategy, or business objectives; all model recommendations below are grounded in comparable-market evidence and flagged as analysis, not project fact.*

---

## 0. Grounding & Scope Notes

**What the sources DO specify (authoritative):**
- BULWARK targets **mouse or touch, identical**, with **input parity** — "every action works with a single pointer (mouse) or a single finger (touch)" (bulwark-visuals §8). Both **PC and mobile** are in scope.
- A **strict competitive-integrity design philosophy**: every unit spends "the SAME 100-point power budget," faction modifiers are "mild, net-neutral tilts (avg multiplier ~1.00) — flavor, not advantage," and prices are "derived from power (flat gold-per-power), so equal power = equal price" (bulwark-balance-xlsx, Overview). A `Balance_Check` sheet exists specifically to "prove 'even'."
- **In-match economy is closed and skill-based**: "each unit costs gold to create, each kill generates gold" (bulwark-visuals §8; bulwark-gdd §3). This gold is a *match resource*, never a purchasable currency in any stated design.
- **Content unlock is earned, not sold**: "Beating a faction unlocks its units" (bulwark-gdd §2, §9).
- **PvP and Co-op are planned tiers** (bulwark-gdd §4, §1).
- A rich **cosmetic surface** exists: four-layer unit stacks, faction palettes, shadows, FX, camera-rotation polish (bulwark-visuals §1–§7), and 81 named heroes across 9 factions (bulwark-gdd §10–§11).

**What the sources DO NOT specify (open decisions, not facts):**
- Price point, F2P vs. premium, live-service cadence, or storefront strategy.
- Whether BULWARK is a commercial product at all — bulwark-gdd §0 states a **"dual-use"** purpose: "(1) a real, buildable game design; (2) a controlled benchmark." Monetization applies only to purpose (1).

**The governing constraint:** BULWARK's core loop and balance model are explicitly, mechanically **anti-pay-to-win**. Any recommendation contradicting "equal power = equal price" or "earn by beating" would undermine stated pillars. This report is built around that constraint.

---

## 1. Current Monetization Landscape

### 1.1 The TD market is bimodal

Tower defense revenue splits into two structurally distinct poles.

**Premium / paid-once (PC & console dominant):**
- *Bloons TD 6* (Ninja Kiwi) — ~$13.99 on Steam, discounted to $3–7. **"Overwhelmingly Positive," 200,000+ reviews** — an exceptional ratio for the genre. Monetizes as a premium purchase with optional cosmetic Trophy Store items layered later. *Exact LTV is not public; review volume and sustained concurrency are the durability proxies.*
- *Kingdom Rush* series (Ironhide) — the archetypal premium TD, ~$4.99–$14.99, with long-tail sales across PC/mobile/Switch via multi-title, multi-platform re-releases.
- *Defense Grid / Dungeon Defenders* — premium-plus-DLC; functional but modest ceilings.

**Free-to-play / live-service (mobile dominant):**
- *Bloons TD Battles / BTD6 mobile* — F2P with IAP, still cosmetic-leaning by genre standards.
- *Arknights* (Hypergryph) — the outlier: a TD-mechanics gacha grossing **well over $1B lifetime** by Sensor Tower estimates since 2019. Its revenue comes from **character gacha and rate-ups**, not TD skill — a model in direct tension with "earn by beating" and "equal power." *Treat the figure as an industry estimate, not audited.*

### 1.2 What works vs. what fails

| Model | Working in TD? | Evidence / caveat |
|---|---|---|
| **Premium paid-once** | **Yes, durably** | BTD6, Kingdom Rush sustain years of sales + top-tier sentiment. Low risk, modest ceiling. |
| **Cosmetic-only IAP on premium base** | **Yes** | BTD6 layers cosmetics with zero balance impact; sentiment stays positive. |
| **Battle pass (cosmetic/XP track)** | **Yes, if non-pay-to-win** | Proven in strategy/PvP (e.g., *Clash Royale*, *Fortnite*); drives retention without power sales. |
| **Character gacha (TD-adjacent)** | **Highest revenue, highest risk** | *Arknights* proves the ceiling but relies on character power — structurally opposed to BULWARK. |
| **Pay-for-power / cash faction unlocks** | **Fails on sentiment** | Contradicts "earn by beating"; the single largest driver of strategy-audience backlash. |
| **Aggressive energy/timer gates** | **Declining** | Strategy-audience tolerance for stamina gates has fallen sharply since ~2018. |

### 1.3 ARPU / LTV benchmarks (comparables, flagged)

- **Premium TD:** effectively a one-time **~$5–$15** transaction; cosmetic attach rates typically **low single-digit %** of buyers.
- **F2P mobile strategy:** blended ARPDAU commonly **$0.05–$0.25/day**, with revenue concentrated in a **~2–5% paying share** (standard whale distribution).
- **Gacha (Arknights-class):** ARPPU is far higher, but is inseparable from selling power/rate-up — non-viable for BULWARK.

*All figures are industry benchmarks, not BULWARK-specific.*

---

## 2. Recommended Model for BULWARK

### 2.1 Primary: Premium base + cosmetic-only live layer ("BTD6 model")

This is the only model that fully preserves BULWARK's pillars:
- **Base sale (~$9.99–$14.99 PC; free or $4.99 mobile)** monetizes the core game.
- **Cosmetic-only store** monetizes the existing four-layer unit-stack and faction-palette surface (bulwark-visuals §1–§7) — alternate palettes, hero skins, FX variants, victory animations. None touch the 100-point power budget.
- **All 81 heroes and 9 factions remain earned**, never sold (bulwark-gdd §2, §9), protecting competitive integrity for PvP.

### 2.2 Secondary: Cosmetic battle pass (post-launch)

Once PvP/co-op tiers ship (bulwark-gdd §4), a **non-pay-to-win battle pass** — cosmetics, XP boosts, and *purely visual* prestige — adds recurring revenue while respecting balance. Explicitly exclude any pass reward that alters unit power or unlock speed relative to the earned track.

### 2.3 Explicitly rejected

- **Pay-for-power / cash unlocks** — violates the balance model's central promise.
- **Gacha for heroes** — the 81-hero roster is a *gacha-shaped* asset, but monetizing it via rate-ups would directly contradict `Balance_Check`'s "prove 'even'" purpose and poison PvP legitimacy.
- **Energy/timer gates** — alienates the strategy audience with no offsetting revenue upside at this scale.

---

## 3. Platform & Sequencing Strategy

- **PC (Steam) first** — the genre's premium buyers concentrate here; positive review velocity (the BTD6 lever) compounds visibility.
- **Mobile second**, leveraging the input-parity design (bulwark-visuals §8) at near-zero porting cost. Mobile can go F2P-with-cosmetics to widen the funnel while PC anchors margin.
- **Cross-progression** for earned unlocks reinforces "earn by beating" across devices and increases retention.

---

## 4. Key Recommendations

1. **Ship premium on PC** (~$9.99–$14.99) as the revenue anchor; optimize for review sentiment, not extraction.
2. **Monetize only cosmetics** — skins, palettes, FX — never power, unlocks, or gold. This is a hard constraint, not a preference.
3. **Add a cosmetic battle pass post-launch**, timed with the PvP/co-op tiers, to convert the live-service audience without breaking balance.
4. **Go F2P-cosmetic on mobile** to widen reach, using input parity to make porting cheap and cross-progression to retain.
5. **Never sell heroes or factions.** The 81-hero roster's gacha shape is a trap; monetizing it destroys the competitive-integrity brand and the benchmark's credibility.
6. **Treat the balance model as a marketing asset.** "Provably even" is a differentiator no gacha competitor can claim — lead with it.

**Bottom line:** BULWARK's anti-pay-to-win design forecloses the highest-revenue TD model (gacha) but maps cleanly onto the genre's most *durable* one. A premium base plus a cosmetic-only live layer maximizes revenue within the constraints the design itself imposes.

---

*Generated by MetaMax Research Brain (LangGraph)*