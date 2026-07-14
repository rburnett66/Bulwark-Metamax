# Bulwark — Wave Doctrine: Per-Faction Composition Arcs

*Design strategy, owner session 2026-07-16. Companion to the Map GDD (rings/budgets) and the
balance workbook (Factions/Archetypes sheets). The workbook budgets say HOW MUCH pressure each
wave carries; this document says WHAT SHAPE that pressure takes, per faction, per wave band —
so fighting each faction FEELS different and the first two waves TEACH it.*

## 1. Principles

1. **Waves 1–2 are training waves** (per the ground-war opening rule, v2026.07.16-a: no air).
   Each faction's training waves introduce its *signature threat in its mildest form* plus basic
   troops — the player should be able to read "who am I fighting and what will hurt later" from
   wave 1 without being punished for not knowing yet.
2. **Waves 3–5 are the development** — the faction's signature axis enters (air for most, its
   doctrine shape for all) and the mix shifts toward identity. The player's counter-build must
   begin here or fall behind.
3. **Waves 6–8 are the doctrine climax** — the faction fights the way its trope demands, heavy
   shapes included, ending in a wave-8 composition that is unmistakably *theirs*.
4. **Budgets are untouched.** The workbook's per-ring points stay authoritative; doctrine only
   re-weights WHICH shapes spend the points (shape weights re-normalize over the faction's
   available lane roster each wave).
5. **Every arc answers the same three player questions in order:** wave 1–2 *"what is this
   faction?"* → wave 3–5 *"what do I build against it?"* → wave 6–8 *"did I commit enough?"*

## 2. Mechanical differentiators (owner, 2026-07-16)

Composition weights alone don't make factions FEEL different — each faction also gets a
mechanical hook, applied as faction-level stat/behavior modifiers on its units (prototype:
multipliers in FACTION_DOCTRINE.statMods, injected at unit creation; workbook should own the
numbers once tuned):

| Faction | Mechanical hook | Expression |
|---|---|---|
| Ground / Powder | The baseline | no mods — the reference army |
| Air | **Ignores walls** | flyers path straight over mazes (inherent); doctrine: wall spend is wasted vs Air — the game must SAY so (wave-1 telegraph) |
| High Tech | Shielded elite | fewer units; +HP "shield" tier on each (first N damage absorbed) |
| Artillery | Outranges towers | siege pieces fire from beyond cannon range; must be sallied |
| Water | **High volume, fast, squishy** | unit count ×~1.6, speed ×1.3, HP ×0.6 — a flood, not a column |
| Arcane / Energy | Relentless cadence | flat tempo, no lulls; slight regen (no-ammo trope) |
| Space Tech | Drop pulses | tight simultaneous clusters; +vision (ignores fog where present) |
| Dark Energy | Wide + DoT | max lateral spread, flank rotation; poison DoT on hits |
| Greenies (Chem) | **Hard shell** | HP ×1.5, speed ×0.75 — carapace columns that soak; chem area denial later |

## 2b. Shape vocabulary

Ground: **Troops** (skirmish), **Trucks** (fast support), **Tanks** (bruiser), **Artillery**
(siege, outranges towers), **Heavy Tanks** (breaker). Air: **Copters** (harass), **Planes**
(strike), **Missiles** (structure killers). Weights below are relative within the wave's lane
budget; 0 = absent by doctrine.

## 3. The nine arcs

### 1 · Ground / Powder — "The Old Colors" (infantry & armor, flags & honor)
- **Training (w1–2):** Troops-heavy with a single Tank in w2. Teaches: massed ground, walls work.
- **Development (w3–5):** Tanks + Troops line abreast; first Copters w3 (light); Artillery enters w5.
- **Climax (w6–8):** combined-arms parade — Heavy Tanks core, Artillery behind, Planes overhead.
  w8: the *Grand Assault* — every shape at once, the baseline doctrine other factions deviate from.
- **Teaches the player:** wall discipline + cannon lines; the reference fight.

### 2 · Air — "The Aces" (air superiority, weak on the ground)
- **Training (w1–2):** thin Troops/Trucks screens — deliberately weak (their walkers are escorts,
  not an army). Teaches: this faction's ground game is a bluff.
- **Development (w3–5):** the sky opens HARD — Copters w3, Planes w4, air share ~2× other factions
  (weights, not budget). Ground stays screens.
- **Climax (w6–8):** Missiles join (structure-killers); w8 is a *sky armada* with a token ground feint.
- **Teaches:** flak is not optional; over-invest in AA vs this faction, skip the wall maze —
  **air ignores walls entirely (owner)**: the wave-1 training screen should telegraph it (a lone
  Copter overflies the player's first wall untouched, wave 3+ makes it doctrine).

### 3 · High Tech — "The Corporation" (precision, shields, expensive)
- **Training (w1–2):** FEW but ELITE — the smallest unit COUNT of any faction's opening (weights
  favor the priciest affordable shapes). Teaches: each kill matters, single-target damage wins.
- **Development (w3–5):** Tanks + Planes precision pairs; no swarm shapes (Troops weight ~0 from w4).
- **Climax (w6–8):** Heavy Tanks + Missiles surgical strikes; w8 is *few, huge, terrifying*.
- **Teaches:** focus-fire value, tier upgrades over tower count.

### 4 · Artillery — "The Siege" (range & arc, poor up close)
- **Training (w1–2):** Troops screen + ONE Artillery piece in w2 lobbing from range.
  Teaches (gently): things will outrange your towers — push out or suffer.
- **Development (w3–5):** Artillery weight climbs every wave; Trucks rush escorts; minimal air.
- **Climax (w6–8):** rolling barrage — Artillery + Heavy Tanks creep; Copters only spot (light).
  w8: the *Gun Line* — max Artillery the budget affords.
- **Teaches:** sally tactics — the harvester economy must fund forward cannons; turtling loses.

### 5 · Water — "The Flood" (HIGH VOLUME, FAST, SQUISHY — owner)
- **Mechanics:** unit count ×~1.6 for the same budget, speed ×1.3, HP ×0.6. A flood, not a column.
- **Training (w1–2):** a rush of cheap fast Troops/Trucks — many bodies, each dying easily.
  Teaches: rate-of-fire and splash beat big single hits; don't over-invest in heavy cannons.
- **Development (w3–5):** the flood widens — water lane joins on coastal maps, Copter spray;
  tempo relentless, unit intervals short.
- **Climax (w6–8):** w8 *Spring Tide* — the highest unit COUNT of any faction's finale, arriving
  continuously; on water maps a simultaneous shore pincer.
- **Teaches:** AOE + throughput; the super-cannon earns its keep; walls buy less time than usual
  (fast units close the gaps quickly).

### 6 · Arcane / Energy — "The Theocracy" (energy weapons, shields, no ammo economy)
- **Training (w1–2):** slow Troops processions in even, chanting cadence (uniform spawn spacing).
  Teaches: relentless, rhythmic pressure — DPS uptime matters more than burst.
- **Development (w3–5):** Tanks (shield-bearers) + steady Copters; weights FLAT across shapes —
  the faction is balance incarnate, tempo never dips (interval smoothing, no lulls between groups).
- **Climax (w6–8):** the procession thickens; w8 *Litany* — flat maximum, all lanes, no spikes.
- **Teaches:** sustained-DPS builds beat burst builds; economy stamina.

### 7 · Space Tech — "The Federation" (orbital tech, vision, ignores some fog)
- **Training (w1–2):** Trucks-led recon columns (fast, evasive). Teaches: speed kills slow aim.
- **Development (w3–5):** Planes early and often (w3 heavier air than anyone but Air faction);
  fast shapes weighted up (Trucks/Copters), slow shapes down.
- **Climax (w6–8):** drop-style pulses — spawn groups arrive in tight simultaneous clusters
  (delay compression within groups, long gaps between). w8 *Planetfall* — three dense drops.
- **Teaches:** range extenders + reaction time; kill the drop before it spreads.

### 8 · Dark Energy — "The Cult" (DoT, corruption, night-strong)
- **Training (w1–2):** sparse, creeping Troops — fewest units, arriving in silence at the map's
  edges (max lateral spawn spread). Teaches: unease; watch your flanks.
- **Development (w3–5):** flank-weighted spawns (side-focus rotates every wave), Tanks + Missiles;
  compositions favor attrition shapes.
- **Climax (w6–8):** everything arrives wide and simultaneous from multiple sides; w8 *Eclipse* —
  the widest spawn footprint in the game, all lanes at once.
- **Teaches:** all-around defense; the base ring, not the wall line.

### 9 · Greenies (Chem) — "The Carapace" (HARD SHELL defenses — owner)
- **Mechanics:** HP ×1.5, speed ×0.75 — slow, armored columns that SOAK damage; chem area denial
  arrives with the climax.
- **Training (w1–2):** a few shelled Troops/Tanks grinding forward, barely killable by a lone
  cannon. Teaches: sustained DPS and focus matter; one tower is never enough vs the hive.
- **Development (w3–5):** Tanks + Heavy Tanks weights climb early (earlier than any faction);
  Copter shells w4; the column narrows onto one lane — a battering ram, not a flood.
- **Climax (w6–8):** w8 *Bulldozer Bloom* — max Heavy/Tank weight, slowest and hardest wave in
  the game; chem clouds (area denial around the column) if/when the FX system supports it.
- **Teaches:** tier upgrades + hardened turret perks + focus fire; time-to-kill management.

## 4. Implementation mapping (for campaign.js)

One data table drives it — per faction, per wave band, a weight per shape plus spawn-texture
knobs the scheduler already supports:

```
FACTION_DOCTRINE[faction] = {
  statMods:    { hpMult, speedMult, countBias, shieldHp?, regen?, dotOnHit? },   // the mechanical hook
  training:    { weights: {Troops, Trucks, Tanks, Artillery, HeavyTanks: 0, ...} },
  development: { weights: {...}, airShare×, sideFocus?, cadence? },
  climax:      { weights: {...}, grouping: 'flat'|'pulse'|'wide'|'swarm' },
}
// statMods apply at createUnit (deterministic, replay-safe); countBias expresses "same budget,
// more/fewer bodies" by biasing fillLane toward cheap/expensive shapes. Balance numbers migrate
// to the workbook once playtested.
```

- `fillLane` picks by weight-biased selection instead of biggest-affordable (deterministic rng
  already threaded).
- Texture knobs map to existing mechanisms: spawn `delay/interval` (cadence, pulses), staged
  border `sideFocus` (flanks), lateral spread (wide), unit-count bias (swarm/elite = prefer
  cheap/expensive shapes at equal weight).
- Training band = waves 1–2 (air already zeroed by the ground-war opening rule); development
  = 3–5; climax = 6–8.
- Budgets, determinism, and the replay contract unchanged.

## 5. Open tuning questions

1. Air faction's training bluff: how weak is fair? (Proposed: 70% of budget spent, rest banked
   into its w3 sky-opening.)
2. Space Tech pulse gaps vs the spawn-space gate — pulses must not deadlock the staging band.
3. Should doctrine apply in mixed-rotation (no chosen faction) battles, per wave's faction? (Proposed: yes.)
