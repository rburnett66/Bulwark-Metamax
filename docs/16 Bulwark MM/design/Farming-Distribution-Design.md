# Farming across the factions: crops, seed pods, machine upgrades and missions — design

Status: draft 1 for owner review · 2026-11-09 · companion to `Farming-Design.md` (the mode itself); this document says
**which faction gives what**. Repo copy to be: `docs/16 Bulwark MM/design/Farming-Distribution-Design.md`

## Owner direction (2026-11-09, 20:41)

> To unlock farming the player will need to level up the miner to level 2.
>
> We need a design for distribution of the seed pods, upgrades to the machinery. The missions and crops will need to be
> distributed across all the factions. The crops for each faction can be the same as the ones that get harvested, with
> the variation of seed pod quality. The quality we gather in the game is level 3.

Read as four rules, applied throughout:

1. **Farming opens per planet at Rig Mk II.** The "miner" is the outpost's Mining Rig; level 2 is **Rig Mk II**, the 2×
   miner unlocked by that planet's outpost contract 2 (Outpost-Design §2.4). A planet's farming contract is offered once
   its outpost has a Rig Mk II built. The first one opens the FARM button.
2. **A faction's crops are its four surface resources** — the same 36 the battles harvest (Landing-Craft-and-Resources
   §4). No new crop list. What varies is the **pod level**.
3. **Battle quality is level 3.** What the battle's harvesters gather is **Rare** (level 3 of 5: Common, Uncommon,
   **Rare**, Epic, Legendary). A Rare pod grows battle-quality crops; below it the farm earns less than fighting, above it
   more.
4. **Every faction holds a share of farming.** Each one teaches one method, makes one room machine better than anyone,
   owns some of the enhancements and sells its own pods, so a full farm needs contracts on many planets.

## 1. The planets, the factions and what each farms

| Planet | Faction (registry key) | Farming character | Specialty method | Specialty machine | Enhancements it teaches |
|---|---|---|---|---|---|
| Verdance | Ground / Powder (`ground`) | the breadbasket; fields and old groves | **Orchard** | — (the **Farmhouse**: Pod Bench II) | Sprinklers |
| Florael | Air (`air`) | blooming gardens, pollinators | **Spatial** | **Air Control** | Air Tanks: oxygen |
| Ochre | High Tech (`hightech`) | solar glass, clean labs | **Hydroponic** | **Light Rig** | Grow Lights: amber; Hydroponic Chambers |
| Kessra | Artillery (`artillery`) | the foundry; terraced mesas | **Terraced** | **Robot Bay** and gro-bots | — (it brings automation: Gro-bot II) |
| Rime | Water (`water`) | frozen seas, clam beds | **Hydrofarming** | **Irrigation System** | Grow Lights: blue; Climate: chiller |
| Cinder | Arcane / Energy (`arcane`) | fire, kilns, the holy flame | **Solo** (tree or spire) | **Climate Unit** | Grow Lights: red; Climate: heater |
| Lumen | Space Tech (`space`) | airless moon, sealed towers | **Vertical farm** | — (Vertical farm floors 3 and 4) | Air Tanks: pressurised; Grow Lights: white |
| Xenthe | Dark Energy (`dark`) | fungal dark, caverns | **Subterrain** and **Truffle hunting** | — (the underground kit; Hunter Kennel II) | Grow Lights: violet |
| Vexmire | Greenies / Chem (`greenies`) | toxic hive swamp, chemistry | **Tub** | **Nutrient Doser** | Fertilizer; Air Tanks: scrubbed |

Traditional, Irrigated, Surface Collection and Mining belong to no faction: every planet's first contract gives them.
The Collective, which has no planet (Collective-Faction tech plan §3.1), is the cross-planet broker (§6.3).

## 2. The crops: each faction's four surface resources

Every surface resource is a crop. Its **tier** (common, uncommon, rare, epic: the battle field it came from) sets how
hard it is to grow; its **pod level** (§3) sets its quality. The two are different scales: a Legendary pod of Loam Grain
is still a common-tier crop.

### 2.1 Two growth families

Not every resource is a plant, so a seed pod comes in two forms that share every rule (the five levels, the stages
Planted → Sprout → Plant → Fruited → Dead, the ember harvest):

- **Living crops** — plants, trees, fungi, shellfish and hive pods — grow from a **seed pod**.
- **Accreted crops** — salts, metals, crystals, ice, oil, gases — grow from a **seed core**: a crystal or nanite seed
  that builds the resource up in a bed. Its stages read as *seeded → first crystals → growing cluster → ripe cluster →
  crumbled*. Same item family, same inventory tab, same levels; only the art differs. *(See §8 X1.)*

### 2.2 The 36 crops

Category is the owner's: Grain, Vegetable, Fruit, Materials (harvested), Minerals, Gems (mining). The best method is
where the crop grows at full speed and can reach Legendary; most can be grown elsewhere at a lower match
(Farming-Design §7).

| Planet | Tier | Crop | Category | Grows as | Best method |
|---|---|---|---|---|---|
| Verdance | common | **Loam Grain** | Grain | wheat | Traditional, Irrigated |
| | uncommon | **Heartwood Amber** | Materials | resin from forest trees | Orchard |
| | rare | **Rootsong Seeds** | Vegetable | humming roots | Subterrain |
| | epic | **Elder Bloom** | Materials | a great flowering tree | Solo |
| Florael | common | **Petal Silk** | Materials | fibre flowers | Traditional, Terraced |
| | uncommon | **Skyhoney** | Fruit | blossom trees with hives | Orchard |
| | rare | **Dawnpollen** | Materials | glowing puff flowers (white light) | Spatial, Vertical |
| | epic | **Choir Lily** | Materials | singing lily (amber light) | Hydroponic |
| Ochre | common | **Sunsalt** | Minerals | seed core in a flooded salt pan | Irrigated |
| | uncommon | **Dune Quartz** | Gems | seed core, quartz points | Subterrain |
| | rare | **Mirage Oil** | Materials | seed core in a seep bed | Tub |
| | epic | **Solar Pearl** | Gems | seed core under a lightning spire | Solo |
| Kessra | common | **Slag Iron** | Minerals | seed core, iron-eating rust bloom | Traditional |
| | uncommon | **Mesa Copper** | Minerals | seed core, copper lichen on the steps | Terraced |
| | rare | **Ghost Brass** | Materials | seed core, brass-plating lichen | Spatial |
| | epic | **Dreadnought Core** | Materials | seed core grown in a shielded bed | Subterrain |
| Rime | common | **Brine Ice** | Minerals | seed core in freeze pans | Hydrofarming |
| | uncommon | **Frost Pearl** | Gems | clam beds | Hydrofarming |
| | rare | **Glacier Breath** | Materials | seed core in an ice cavern (chiller) | Subterrain |
| | epic | **Leviathan Scale** | Materials | shed by a pen-raised deep creature | Hydrofarming (deep pen) |
| Cinder | common | **Ash Basalt** | Minerals | seed core in lava beds | Traditional |
| | uncommon | **Ember Obsidian** | Gems | seed core, warm glass | Subterrain |
| | rare | **Phoenix Glass** | Gems | seed core, fire-glass spire (heater) | Vertical |
| | epic | **Heartflame** | Materials | a living ember in a rock cradle | Solo |
| Lumen | common | **Regolith** | Minerals | seed core in pressurised trays | Vertical |
| | uncommon | **Helium-4** | Minerals | seed core, frost crystals (chiller) | Subterrain |
| | rare | **Starfall Iron** | Minerals | seed core, meteoric iron | Subterrain |
| | epic | **Void Lens** | Gems | seed core, vacuum lens (violet light) | Hydroponic |
| Xenthe | common | **Glowcap Spores** | Vegetable | glowing mushrooms | Subterrain |
| | uncommon | **Duskmoss Resin** | Materials | twilight moss | Terraced |
| | rare | **Dreamspore** | Vegetable | vision pods | Subterrain |
| | epic | **Mycelial Heart** | Materials | the network's knot | Solo |
| Vexmire | common | **Mire Peat** | Materials | bog beds | Irrigated |
| | uncommon | **Venom Sap** | Materials | swamp trees | Orchard |
| | rare | **Hive Jelly** | Fruit | stacked hive pods | Vertical |
| | epic | **Broodqueen Egg** | Materials | a nest kept warm | Subterrain |

What the table does:

- **Every planet has an easy crop.** Each common-tier crop grows on its own planet's open ground (Lumen's in a sealed
  Vertical farm, the only option without air), so every planet's first contract can be met with what it gives.
- **The epic-tier crop is the faction's prize.** It needs the faction's specialty method or a Solo slot, and its full
  set of enhancements for Legendary (Farming-Design §7.3).
- **The best methods spread across the factions.** A player who wants every crop at its best needs Subterrain (Xenthe),
  Hydrofarming (Rime), Vertical (Lumen) and so on: the methods are why a farmer goes to every planet.
- **Food is thin on purpose.** Grain is Verdance's alone; Fruit is Florael's Skyhoney and Vexmire's Hive Jelly;
  Vegetables are Verdance's roots and Xenthe's fungi. Food refining (Farming-Design §11.1) therefore needs those
  planets. *(This replaces the 27 new food crops of Farming-Design draft 2; see §8 X2.)*

## 3. Seed pod levels and quality

The five levels are the owner's (Farming-Design §8.2). **Level 3, Rare, is battle quality.**

| Level | Colour | Quality vs battle | Harvest value (× the resource's battle price) | How it is obtained |
|---|---|---|---|---|
| 1 · Common | white | below | 0.5× | faction stores, contract crates |
| 2 · Uncommon | green | below | 0.75× | faction stores at Trusted loyalty, Collective orders, upgrading |
| **3 · Rare** | blue | **= battle** | **1.0×** | **battles** (harvesters bring back Rare pods), stores at Honoured, upgrading |
| 4 · Epic | purple | above | 1.3× | upgrading, contract F3, rare contracts, truffle hunting |
| 5 · Legendary | gold | above | 1.75× | **only by upgrading**, and grows as Legendary only with every enhancement its crop uses |

So the owner's first rule still holds: **a farm earns less than fighting until its pods are upgraded**. A player
starting on Common pods earns half of what the same land would yield in battle; at Rare they match it; Epic and
Legendary are the reason to keep upgrading. Surface Collection and battle-gathered resources count as Rare in the
inventory. *(Values proposed; see §8 X3.)*

## 4. Where seed pods come from, faction by faction

### 4.1 Each faction sells its own pods

Each faction's capital ship stocks pods of **its own four crops only**. What it offers grows with loyalty
(Outpost-Design's loyalty, the same ledger the contracts pay into):

| Loyalty rank (proposed) | Common-tier crop | Uncommon-tier | Rare-tier | Epic-tier |
|---|---|---|---|---|
| Known (any) | Common pods | — | — | — |
| Trusted (25) | Uncommon pods | Common pods | — | — |
| Honoured (50) | Rare pods | Uncommon pods | Common pods (after F2) | — |
| Exalted (100) | Rare pods | Rare pods | Uncommon pods | Common pods (after F3) |

Proposed prices: a Common pod costs 4× the crop's battle price per unit, and each level up doubles it. The store never
sells Epic or Legendary pods.

### 4.2 Battles drop Rare pods of the planet they are fought on

A battle's harvester working a field brings back **one Rare pod** of that resource now and then (proposed: 1 per 200
units carried; an epic field 1 per 100). Battles are therefore the main source of Rare pods, and the only steady source
of rare-tier and epic-tier crop pods before Exalted. Since every battle is on an enemy faction's homeworld, **fighting
on a planet is how you collect its pods**.

### 4.3 Every other source

| Source | Gives | Faction |
|---|---|---|
| Farming contract F1 | a Pod Crate: 12 Common pods of the common-tier crop | the planet's |
| F2, F3 | pods of the rare-tier and epic-tier crops (§5.2) | the planet's |
| Dead plants | the planted pods back (Farming-Design §5.2) | — |
| Fruited harvests | some pods of the same crop and level; small chance of one a level up (Farming-Design §8.3) | — |
| Pod bench (Farmhouse) | 3 pods → 1 of the next level; Pod Bench II (Verdance F3) halves the cost | — |
| Collective farm orders | Uncommon pods of **another** planet's crop (§6.3) | the Collective |
| Truffle hunting (Xenthe's) | that planet's mystery pod; Epic pods of local crops | the planet hunted on |
| Rare contracts (Rare-Contracts-Design) | Epic pods of the contract planet's epic-tier crop | the planet's |

## 5. Missions: the farming contracts of each faction

### 5.1 The shape every faction shares

| Contract | Offered when | Ask | Pays |
|---|---|---|---|
| **F1 · Break ground** | the planet's outpost has a **Rig Mk II** | prep and plant 3 plots of the common-tier crop; harvest one at Fruited; deliver it | gold, loyalty, XP; the Pod Crate; Irrigated and Sprinklers (first F1 only); the faction's first **enhancement** from §1, where it has one |
| **F2 · Our way** | F1 done, loyalty Trusted | build the faction's **specialty method** (granted as a one-off for this contract) and grow its rare-tier crop there; deliver at Uncommon or better | the specialty method unlocked for good (on every planet); the **level 3 blueprint** for the faction's specialty machine (or its specialty upgrade); rare-tier crop pods |
| **F3 · The prize** | F2 done, loyalty Honoured | grow the faction's epic-tier crop at **Epic or better** and deliver it | the **level 4 blueprint** for its specialty machine (or its last upgrade); its second enhancement where it has one; Epic pods of the epic-tier crop; the faction's manufacturing line (Farming-Design §11.2) |

A method learned from one faction is available on every planet the player farms (as research is, Farming-Design §12),
so the contracts spread the methods across the galaxy rather than locking them to one map.

### 5.2 The 27 contracts

| Planet | F1 · Break ground | F2 · Our way | F3 · The prize |
|---|---|---|---|
| Verdance | *Bread for the Regiments*: Loam Grain · Sprinklers | *The Old Groves*: Orchard, Rootsong Seeds | *Once a Century*: Elder Bloom (Solo) · Pod Bench II |
| Florael | *Silk Season*: Petal Silk · oxygen Air Tanks | *Let Them Compete*: Spatial, Dawnpollen · Air Control L3 | *The Choir*: Choir Lily · Air Control L4 |
| Ochre | *White Pans*: Sunsalt · amber Grow Lights | *Clean Rooms*: Hydroponic and Hydroponic Chambers, Mirage Oil · Light Rig L3 | *Captured Noon*: Solar Pearl · Light Rig L4 |
| Kessra | *Rust Harvest*: Slag Iron | *Up the Mesa*: Terraced, Ghost Brass · Robot Bay L3 | *Wake the Core*: Dreadnought Core · Robot Bay L4, Gro-bot II |
| Rime | *Cutting Ice*: Brine Ice · blue Grow Lights | *Clam Beds*: Hydrofarming, Glacier Breath · Irrigation L3 | *What Moves Below*: Leviathan Scale · Irrigation L4, chiller |
| Cinder | *Ash Fields*: Ash Basalt · red Grow Lights | *The Kiln*: Solo, Phoenix Glass · Climate Unit L3 | *Keep the Flame*: Heartflame · Climate Unit L4, heater |
| Lumen | *Sealed Trays*: Regolith in a granted Vertical farm · pressurised Air Tanks | *Towers*: Vertical farm, Starfall Iron · Vertical floors 3–4 | *The Lens*: Void Lens · white Grow Lights |
| Xenthe | *Glowcap Dark*: Glowcap Spores · violet Grow Lights | *Into the Rock*: Subterrain and Truffle Hunting, Dreamspore · Hunter Kennel II | *The Network's Heart*: Mycelial Heart · the underground accent sets |
| Vexmire | *Peat and Rot*: Mire Peat · Fertilizer | *Pots of Poison*: Tub, Hive Jelly · Nutrient Doser L3 | *The Queen's Nest*: Broodqueen Egg · Nutrient Doser L4, scrubbed Air Tanks |

Notes:

- **Lumen has no air**, so its F1 grants a level-1 Vertical farm for Regolith (proposed); the method itself is still
  learned in its F2.
- **Hydroponic is Ochre's** (planet 3), so the owner's example super crop — a hydroponic room with an oxygen tank on
  another planet — needs Ochre's F2 and Florael's F1 at least: two factions, as intended.
- **Kessra teaches no enhancement**: it brings automation (the Robot Bay's levels and Gro-bot II). Every other faction
  teaches at least one enhancement, and the five grow-light colours come from five different factions.

## 6. Machine upgrades across the factions

### 6.1 The level ladder

Machines have four levels (Farming-Design §2.8: maintenance every 4 / 10 / 15 / 20 days). Who gives each level:

| Level | Unlocked by | Bought with |
|---|---|---|
| 1 | the FARMING research node that brings the machine (Farming-Design §12) | gold |
| 2 | research **Machine Engineering I** (any machine) | gold, 1.5× |
| 3 | the machine's **specialist faction, contract F2** (blueprint) and **Machine Engineering II** | gold, 3× |
| 4 | the specialist faction's **F3** (blueprint) and **Machine Engineering III** | gold, 6× |

| Machine | Specialist faction | Level 3 from | Level 4 from |
|---|---|---|---|
| Irrigation System | Rime (Water) | *Clam Beds* | *What Moves Below* |
| Air Control | Florael (Air) | *Let Them Compete* | *The Choir* |
| Light Rig | Ochre (High Tech) | *Clean Rooms* | *Captured Noon* |
| Climate Unit | Cinder (Arcane) | *The Kiln* | *Keep the Flame* |
| Nutrient Doser | Vexmire (Chem) | *Pots of Poison* | *The Queen's Nest* |
| Robot Bay (+ gro-bots) | Kessra (Artillery) | *Up the Mesa* | *Wake the Core* |

The specialist faction's ship also **sells its machine at 20 % off** at Honoured (proposed). A machine upgraded on one
planet's blueprint can be upgraded in every grow room on every planet.

### 6.2 Surface upgrades

| Upgrade | Faction |
|---|---|
| Vertical farm floors 1–2 | research (Vertical farm node) |
| Vertical farm floors 3–4 | Lumen F2 |
| Pod Bench II | Verdance F3 |
| Hunter Kennel II (2nd and 3rd drone) | Xenthe F2 |
| Silo tiers, Pump | research |

### 6.3 The Collective's farm orders

The Collective trades with every faction and fights none. Once the player has farms on **two** planets, its ship posts
**farm orders** (proposed: three open at a time, refreshed daily): *deliver N of crop X at level ≥ L*. They pay gold,
Collective loyalty and **Uncommon pods of a crop from a planet where the player does not farm yet**: the Collective is
how a farmer first gets other planets' pods, and why a Verdance grain farmer might plant Skyhoney.

### 6.4 Wanted crops

Like the far buyer for rare ore (Outpost-Design §8.5), each faction pays **1.5×** for one other planet's epic-tier crop
(proposed; not advertised; found through the rare-contract contact):

| Faction | Wants | Faction | Wants |
|---|---|---|---|
| Verdance | Choir Lily | Cinder | Leviathan Scale |
| Florael | Elder Bloom | Lumen | Solar Pearl |
| Ochre | Void Lens | Xenthe | Broodqueen Egg |
| Kessra | Heartflame | Vexmire | Mycelial Heart |
| Rime | Dreadnought Core | | |

## 7. Mystery crops across the factions

One per planet (Farming-Design §7.4), found by truffle hunting on its home planet, thriving only on **another** planet
in a specific enclosed set-up. The affinities are a derangement: every planet is one mystery crop's home and another's
affinity (proposed, secret in data):

| Mystery crop (working name) | Home | Thrives on | Set-up |
|---|---|---|---|
| Hushroot | Verdance | Xenthe | hydroponic room, violet light, oxygen |
| Starpetal | Florael | Lumen | vertical farm, white light, pressurised air |
| Glasswort | Ochre | Rime | underground room, heater |
| Ironvine | Kessra | Vexmire | hydroponic room, scrubbed air, fertilizer |
| Snowbell | Rime | Cinder | underground room, chiller |
| Ashlily | Cinder | Ochre | vertical farm, red light |
| Moonmoss | Lumen | Florael | hydroponic room, blue light, oxygen |
| Veilcap | Xenthe | Kessra | underground room, amber light |
| Sporequeen | Vexmire | Verdance | hydroponic room, fertilizer, oxygen |

Each set-up uses enhancements from at least two factions, so the super crops are the top of the economy that only a
player with friends on several planets reaches.

## 8. Open questions

| # | Question | This draft assumes |
|---|---|---|
| X1 | Resources that are not plants (salts, metals, crystals, ice, oil, gases): grown at all? | yes, as **accreted crops** from seed cores (§2.1), same rules, different art |
| X2 | The 27 extra food crops of the farming design draft 2 | dropped: crops are exactly the 36 surface resources (owner, 20:41) |
| X3 | Harvest value per level, with Rare = battle | 0.5×, 0.75×, 1.0×, 1.3×, 1.75× |
| X4 | Does farming open per planet, or everywhere once any rig is Mk II? | per planet, like outposts; the first Mk II opens the FARM button |
| X5 | Specialty methods and machines per faction (§1) | as listed |
| X6 | Loyalty ranks for the pod store (25 / 50 / 100) and store prices | placeholders for the workbook |
| X7 | Battle pod drop rate (1 per 200 units; epic fields 1 per 100) | placeholder |
| X8 | Collective farm orders open after two farmed planets | yes |
| X9 | Wanted crops at 1.5×, unadvertised | yes |
| X10 | Mystery crop names and affinities (§7) | working names; affinities a derangement |

## Dependencies

| relation | document | what it holds that this design does not restate |
|---|---|---|
| depends-on | docs/16 Bulwark MM/design/Farming-Design.md | the mode: methods, plots, stages, pod levels, enhancements, machines, maintenance, research, raids, processing |
| depends-on | docs/16 Bulwark MM/design/Outpost-Design.md | Rig Mk II and outpost contract 2, loyalty, the far buyer this copies |
| depends-on | docs/16 Bulwark MM/design/Landing-Craft-and-Resources-Design.md | the 36 surface resources and their tiers per planet |
| related | docs/tech-plan/Collective-Faction.md | the Collective as a non-playable trading faction |
