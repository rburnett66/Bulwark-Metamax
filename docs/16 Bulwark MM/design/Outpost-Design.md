# Outposts and Mining — design

Status: owner decisions applied (Q1–Q7, 2026-11-06) · 2026-11-06 · Epic *Outposts and mining* (initiative *Bulwark advanced mode*, L3)
· Tech plan: `docs/tech-plan/Outpost.md` · Concept art: the owner's outpost image (2026-11-06), described in §8

![Outpost concept (owner, 2026-11-06)](outpost/outpost-concept.jpg)

## Owner direction (2026-11-06)

> We need a design for the first contracts. When a player arrives at the capital ship the contract will be for a mined
> resource. A requirement for the contract will be to successfully start your outpost on the active planet.
>
> For example if the player has just earned 3 stars on map 3 of Verdance they discover the Verdance capital ship.
> Verdance faction acknowledges the progress on Verdance and offers a distraction. "You have done so well gathering
> surface resources on Verdance, how are you at mining and farming?" The player is given a small outpost and a mining
> rig: outpost building, power station, miner, and a storage tower. "Not everybody in this faction is happy about your
> progress but you will gain some moral equity by helping us gather the ore. There will be opposition but we will pay
> well for these resources."
>
> We will need another unique map for Verdance and the other planets for the outpost. We will also need the new
> structures and game mechanics. […] On the main menu "Replay Last Battle" will become the Outpost button which is
> only clickable when the Outpost is contracted. Replay will be a feature on the game history pages. […] We will need
> new 3D models. In the picture you also see an upgrade bay which can be used to add upgrades from the tech tree, and
> a harvester bay so the player can also run a resource harvest for the surface and build new ones just like in the
> tower defense game.
>
> Outposts will see light attacks occasionally so they should have defenses but these occur rarely so a well defended
> Outpost can stay running for up to 2 days without new construction. The mining storage will have enough resource to
> sell every 5 minutes and the storage building can hold 4 hours of resources. Upgraded mining buildings can dig deeper
> for higher quality ore which gets collected at 1/4 the speed but sells for 3x as much.
>
> Contract success will unlock the second ore and mining technology. Each planet has 3 ores to collect just like the
> resources gathered on the surface: uncommon, common and rare. The ores on Verdance will be iron, aluminum, and
> lithium, used to build outposts and spacecraft. The next planet will supply magnesium, boron, cobalt for enhanced
> materials and power stations. We should be able to fill in the rest of the planets. These resources will sell for
> gold to be used to construct Outposts, mining equipment, and eventually spacecraft.

### Owner decisions (2026-11-06)

> 1. Yes, 2. Ground defenses cannon and machine gun, and walls 3. Raise the price 4. Ores are good 5. Harvesting ore
> selling is always a manual tap with a cool shuttle animation, ore splatter, and a dollar value animation just like
> in combat 6. When raids break through 25% of ore is lost. 7. Yes, I simplified to 3 for now.

> The ore mining towers for different materials should be different designs, while the 2x miner simply uses a
> different highlight color with an enhanced mining animation. More debris. *(owner, 2026-11-06, 16:53)*

The first build is **the Verdance contract plus the Verdance outpost map** (Q1). The answers are applied throughout;
§11 records them. ("sooner animation" in the reply is read as *shuttle* animation.)

## 1. What the outpost is

The battle game is played in sessions: land, hold eight waves, leave. The outpost is the part of Bulwark that keeps
running when the player is not playing. It is a small base on a planet's surface that mines ore and harvests the
surface on its own. Every few minutes the ore is ready to fly up to the capital ship and sell. Once in a while
dissidents raid it.

It gives the player three things the battles do not:

- **A reason to come back several times a day.** A shuttle load is ready every 5 minutes, and storage fills in 4 hours.
- **A gold income that grows.** It pays for outposts, mining equipment and, later, spacecraft.
- **A second relationship with each faction.** The faction pays for the ore and grows to trust the player. Not every
  member of the faction approves, and that is where the raids come from.

It is not a second tower-defense game. A raid is small and rare, and a well built outpost holds for about two days
without the player touching it.

## 2. Where it starts: the first contract

### 2.1 The trigger

The trigger is unchanged from Content-Reveal: map 3 of a planet won at 3★ or better brings that faction's capital
ship. On the first visit aboard, the faction officer greets the player and the contract card comes up. **The first
contract on every faction ship is the outpost contract.** The ship's campaign missions (map 4 onward) are presented
in the same visit, as they are today.

### 2.2 The scene, Verdance

The scene uses the Content-Reveal boarding sequence: walk to the helm, the captain turns, comm lines, contract card.
The speaker is the ship's captain, Colonel Aldric Vane. These are draft lines; the owner's own words are kept where
they were given.

| Beat | Speaker | Line |
|---|---|---|
| greet | Vane | "You have done well gathering what lies on the surface of Verdance. Better than most of my own regiments." |
| turn | Vane | "So tell me: how are you at mining? And farming?" |
| offer | Vane | "We have a site for you. A small outpost and a mining rig: a hub, a power station, a miner and a storage tower. Yours to run." |
| warning | Vane | "Not everybody aboard is happy about your progress. Help us bring up the ore and you will earn some moral equity with the realm. There will be opposition. We will pay well." |
| card | — | Contract card: **Outpost contract: Iron for the Oath** (§2.3) |

ACCEPT grants the outpost kit and lights the OUTPOST button on the main menu. Declining keeps the card in the Mission
Log, where it can be accepted later. It costs nothing, because this contract is the gateway to the outpost and must
not be lost.

### 2.3 The contract

| | Verdance, contract 1: *Iron for the Oath* |
|---|---|
| Granted | aboard *Halbrecht's Oath*, first visit |
| Kit | Outpost Hub, Power Station I, Mining Rig I, Storage Tower I, and the ground defenses: a Cannon, a Machine Gun and a wall ring (Q2) |
| Step 1 | **Establish the outpost on Verdance.** All four buildings are placed on their pads, the rig sits on the iron deposit, and every building is powered. The outpost reads ONLINE. |
| Step 2 | **Deliver 300 iron to the Oath.** That is 20 shuttle loads, about 100 minutes of the starter rig. |
| Step 3 | **Hold the outpost through its first raid.** The first raid is scripted for 10 minutes after the outpost comes online, so it arrives while the player is watching (§5.3). |
| Pays | 4 gold per iron delivered (contract price, the same as market), then **2,000 gold**, **+20 loyalty with Verdance** ("moral equity"), 300 XP |
| Unlocks | **Aluminum**, the second ore, and **Deep Drilling I**, the first mining technology (§4.4) |

Each planet's first contract has the same shape: establish, deliver its common ore, hold the first raid. Only the
names and lines change. Its gate is `capital_ship_arrived` for that planet, so a player who reaches several ships
gets several outposts, one per planet.

### 2.4 The contract ladder per planet

| Contract | Ask | Unlocks |
|---|---|---|
| 1 — establish | outpost online; deliver 300 common ore; hold the first raid | the uncommon ore; Deep Drilling I |
| 2 — expand | build a second Mining Rig on the uncommon deposit; deliver 150 uncommon ore | the rare ore; Rig Mk II (2× extraction) |
| 3 — master | deliver 60 rare ore; hold 3 raids without a breach | Cargo Shuttle II (+10 % on every sale, §4.3); the planet's spacecraft blueprint (later, Ships division) |

Only contract 1 is specified to build. Contracts 2 and 3 fix the direction and the unlock order; their numbers are
set with the ore table once contract 1 has been played.

## 3. Ores

Each planet has three ores, the same tiers as its surface resources: **common, uncommon, rare**. Ores are a separate
family from the surface resources. Surface resources come from battles and the Harvester Bay; ores come only from
mining rigs. Each planet's ores lean toward a use, so that later crafting has a reason to need more than one planet.

| # | Planet | Common | Uncommon | Rare | Used for |
|---|---|---|---|---|---|
| 1 | Verdance | Iron | Aluminum | Lithium | outposts, hulls, batteries — the basics of building anything |
| 2 | Florael | Magnesium | Boron | Cobalt | enhanced (light, strong) materials and power stations |
| 3 | Ochre | Silicon | Copper | Gallium | electronics, sensors, solar arrays |
| 4 | Kessra | Nickel | Chromium | Tungsten | armour plate and ordnance |
| 5 | Rime | Manganese | Titanium | Vanadium | hull alloys for cold and vacuum |
| 6 | Cinder | Zinc | Platinum | Iridium | heat-proof parts and reactor catalysts |
| 7 | Lumen | Thorium | Uranium | Helium-3 | reactor and drive fuel |
| 8 | Xenthe | Neodymium | Yttrium | Europium | magnets, shields and energy cells (rare earths) |
| 9 | Vexmire | Sulfur | Phosphorus | Palladium | fuels, chemistry and catalysts |

Rows 1 and 2 are the owner's. Rows 3–9 are proposed. They follow each planet's identity (Faction-Terrain-Design §3):
Ochre is solar and mega-corp electronics, Kessra the siege foundry, Rime the cold sea, Cinder fire, Lumen the
airless survey moon, Xenthe dark energy, Vexmire the toxic swamp. All 27 are real elements with no repeats. Kessra's
surface already has *Slag Iron* and *Mesa Copper*; they stay surface salvage, and the mined ores are Verdance's
Iron and Ochre's Copper.

## 4. How mining works

### 4.1 The numbers that are fixed by the owner

- **A shuttle load every 5 minutes.** A load is 5 minutes of what the outpost extracts.
- **Storage holds 4 hours.** Storage Tower I holds 4 hours of the starter rig.
- **Deep ore: ¼ the speed, a higher price** (Q3: raised to 5×).
- **Up to 2 days without new construction** for a well defended outpost.

### 4.2 Extraction rates and prices (proposed defaults)

The same rig extracts each tier at a different speed; rarer ore is slower and worth more per hour.

| Tier | Rig I speed | Price | Gold per hour | Shuttle load (5 min) |
|---|---|---|---|---|
| Common (Iron) | 3 units / min | 4 gold | 720 | 15 units |
| Uncommon (Aluminum) | 1.5 units / min | 12 gold | 1,080 | 7.5 units |
| Rare (Lithium) | 0.8 units / min | 30 gold | 1,440 | 4 units |

**Storage Tower I holds 720 units**, 4 hours of the starter rig on iron. Storage counts units (crates), not gold, so
the slower ores take longer to fill it.

**What 4 hours is worth.** A full Storage Tower I of iron sells for 2,880 gold. A Verdance mission primary pays
about 700–1,100 gold, and a won battle banks what is left of its gold. So 4 hours of a starter outpost is worth
roughly one good battle. It is meaningful, but it does not replace playing. The whole tech tree costs 140,300 gold
(Mission-Log §1.2); the outpost is the steady income that closes the late-game gap the battles leave.

### 4.3 Selling

Selling is **always a manual tap** (Q5). There is no automatic selling at any tier.

- When the storage holds at least one load, the hub shows **LOADS READY**, and the menu's OUTPOST button gets a red
  dot.
- **SELL** sells every full load in storage to the planet's capital ship. A partial load stays. The tap plays the
  sale the way combat plays a harvester delivery:
  1. the storage tower's hologram drains and the ore crates ride the conduit to the landing pad;
  2. the shuttle lifts off the hub with a burst of **ore splatter**, chunks of the ore in its colour spraying from
     the cargo bay;
  3. the **"$N" pops** over the hub, the same pop, rise and fade as a kill's bounty or a harvester's delivery in
     battle (`overlays/goldPopups.js`), one per load, stacking upward and in the ore's colour;
  4. the shuttle arcs up and out of frame, and the gold counter in the HUD counts up.
- The buyer is the planet's own faction ship, at the contract price while a contract is active and the market price
  after. The defaults set both to the table price.
- When storage is full the rig stops; nothing is lost, it just stops earning. The menu shows **STORAGE FULL** on the
  OUTPOST button.
- **Cargo Shuttle II** (contract 3) is a bigger shuttle that pays **+10 %** on every sale. It still sells only on a
  tap.

### 4.4 Deep drilling

**Deep Drilling I** (the contract 1 unlock, then bought in the Upgrade Bay) lets a rig switch to its deposit's
**deep seam**: the same ore at a higher grade (*Iron, deep grade*), extracted at **¼ the speed** and sold at **5×
the price** (Q3: the owner raised it from 3×).

Deep ore earns **1.25× per hour** (¼ × 5) and fills storage four times slower: 16 hours to fill Storage Tower I
instead of 4. So the upgrade is a straight improvement, and it suits both kinds of player: more gold per hour, and
an outpost that keeps earning overnight instead of stopping full at hour 4.

| Deep grade, Rig I | Speed | Price | Gold per hour | Hours to fill Storage I |
|---|---|---|---|---|
| Iron | 0.75 / min | 20 | 900 | 16 |
| Aluminum | 0.375 / min | 60 | 1,350 | 32 |
| Lithium | 0.2 / min | 150 | 1,800 | 60 |

The switch is one tap per rig, and the rig keeps its setting. Shallow stays useful when a contract asks for
quantity: deliveries count units, and deep ore delivers a quarter as many.

### 4.5 Power

The Power Station feeds every building through the glowing conduits in the concept art. Each building draws power;
an unpowered building stops. Power is what limits how much a player can build before upgrading the station.

| Building | Draw | | Building | Draw |
|---|---|---|---|---|
| Outpost Hub | 2 | | Harvester Bay | 2 |
| Mining Rig | 4 | | Upgrade Bay | 1 |
| Storage Tower | 1 | | each defense | 1 |

Walls draw no power. Power Station I supplies **10**. The kit (hub, rig, storage, cannon, machine gun) draws 9, so
the player has room for one more small building. Power Station II supplies 20.

## 5. Raids

### 5.1 Who and why

The raiders are **dissidents of the planet's own faction**, the members "not happy about your progress". They use
that faction's battle units, in small numbers. The warning comes from the captain in the contract scene, so the first
raid is no surprise. Later, the Dialog Response + Reputation epic can let the player answer the dissidents; that is
out of scope here.

### 5.2 How often, and how hard

- **About one raid every 6 hours** on average, never more than one per 3-hour window. The schedule is drawn from the
  outpost's seed, so it is the same however often the game is opened.
- Every defense has **integrity** (100 %). Each raid wears the defenses that fought it by **7 %**. Repairs cost gold
  and count as construction.
- The outpost's **defense rating** is the sum of its defenses' power times their integrity. A raid **breaches** when
  the rating falls below the raid's strength.
- **A breach** loses **25 % of the ore in storage** (Q6). Nothing else breaks: the buildings keep running. Every
  breach while the defenses stay worn loses another quarter, which is the cost of leaving them unrepaired.

Proposed tuning that matches "up to 2 days":

| Outpost | Rating at start | Raids held before the first breach | Hours, at one raid per 6 h |
|---|---|---|---|
| Well defended (4 defenses, walls) | 1.00 | 8 | ~48 |
| Starter kit (cannon, machine gun, walls) | 0.80 | 5 | ~30 |
| No defenses | 0 | 0 | the first raid breaches |

Raid strength is 0.55 of a well defended outpost's rating and does not grow over time. Building or repairing
anything resets the worn defenses, so the 2-day clock is about how long the player can leave it alone.

### 5.3 Watching a raid

- **While the player is in the outpost view,** a due raid plays live. A few enemy units come in along the map's raid
  lanes and the defenses fight, using the battle game's own simulation on the outpost map. The player can tap
  REPAIR, but cannot build during a raid. The first contract's raid is scripted to arrive this way, 10 minutes after
  the outpost comes online.
- **While the player is away,** raids are resolved by the rating rule above.
- **Back in the outpost view,** a **while you were away** report lists what was extracted, each raid (repelled, or
  breached with the ore lost) and the defenses' wear.

## 6. The buildings

Every building in the concept image is in the design. They sit on **pads** (fixed build sites on the outpost map),
joined by power conduits, as in the picture. Pads keep the layout readable on a phone and let the conduits route
themselves. Defenses are placed freely on the outer ring, the way towers are placed in battle.

| Building | In the picture | What it does | Tiers |
|---|---|---|---|
| **Outpost Hub** | centre: the octagonal landing pad with the ship, ramps | command and landing pad; the shuttle sells from here; must exist for anything else to run | I |
| **Power Station** | top left: round building with the blue core | supplies power (§4.5) | I, II |
| **Mining Rig** | bottom left: the drill with the crystal laser, ore carts on a track | built on an ore deposit; extracts that ore; shallow or deep (§4.4). **A different design for each material** (§8.4) | I, II (2×) |
| **Storage Tower** | bottom right: the building with the dish and the holographic floor | holds extracted ore; the hologram shows how full it is | I (4 h), II (8 h) |
| **Harvester Bay** | left: the garage with the buggies | builds and runs surface harvesters on the outpost map, just like in battle; their resources go to the inventory | I |
| **Upgrade Bay** | top right: the hangar pad with two control towers and a small craft | where Outpost-division tech upgrades are bought and installed; it also lets tech-tree tower upgrades apply to the outpost's defenses | I |
| **Defenses** | not in the picture | the battle game's ground defenses: Cannon, Machine Gun and walls (Q2), at the tiers the player owns | from the tech tree |

### 6.1 Costs (proposed defaults)

| Building | Cost | Build time |
|---|---|---|
| Outpost Hub, Power Station I, Mining Rig I, Storage Tower I, Cannon, Machine Gun, wall ring | free (contract kit) | instant |
| second Mining Rig I | 3,000 | 5 min |
| Harvester Bay | 2,500 | 5 min |
| Upgrade Bay | 4,000 | 10 min |
| Power Station II | 6,000 | 15 min |
| Storage Tower II | 5,000 | 15 min |
| Mining Rig II (2× extraction) | 8,000 | 20 min |
| a defense | its battle price × 4 | 2 min |
| repair | 10 % of the building's cost per 10 % integrity | instant |

Build times are real time and run while the player is away. They are short on purpose: the outpost is a place to
spend gold, not to wait.

## 7. The Outpost division of the tech tree

The tech tree already has an **OUTPOST** division with five "coming soon" ghosts (`techtree.js`: Outpost Hub,
Forward Relay, Supply Depot, Sensor Spire, Outpost Walls). This design replaces them with real nodes. They are bought
with gold from the tech tree or from the Upgrade Bay; the Upgrade Bay is the outpost's door to the same nodes.

| Node | Effect | Unlocked by |
|---|---|---|
| Deep Drilling I | rigs can mine the deep seam (§4.4) | contract 1 |
| Rig Mk II | Mining Rig II: **2× extraction**, shown by its highlight colour (§8.4) | contract 2 |
| Supply Depot | Storage Tower II: 8 hours | contract 1 |
| Power Grid II | Power Station II: 20 power | contract 1 |
| Reinforced Walls | the kit's walls upgraded; raid wear 7 % → 4 % | contract 1 |
| Sensor Spire | raid early warning (the menu shows "raid inbound"), +15 % defense rating | contract 2 |
| Cargo Shuttle II | +10 % on every sale (still a manual tap) | contract 3 |

Prices are set in the workbook with the rest of the tech tree. They are counted in a new **Outpost** line of the
Economy sheet, which Mission-Log §1.2 left out until now.

## 8. Look and feel

### 8.1 The concept image

The owner's image is the target. What it establishes:

- **One plateau, seen at three-quarters from above.** The outpost is an island of cracked, hexagonal-tiled rock with
  boulders at the rim, and the six buildings arranged around a central landing pad.
- **Materials.** Light grey and white hull panels over dark grey chamfered bases, orange trim stripes and fins, and
  cyan-blue emissive light (windows, cores, conduits, hologram floors).
- **Power conduits** run as glowing blue double lines between the buildings.
- **Life.** Engines glow, the reactor core pulses, the laser cuts the crystal, buggies and ore carts sit ready.
- **Low-poly and chunky**, close to the capital ship and landing craft models, not the voxel units.

### 8.2 Per planet

Each planet's outpost map has the planet's own ground, rocks and light (its battle palette), so a Florael outpost
sits in blossom meadows and a Rime outpost on ice. The buildings stay the same models with one change: the trim
colour takes the faction's colour. The concept's orange is Verdance's default.

### 8.3 Ore deposits

Three deposits per map, one per tier, drawn as ore outcrops in each ore's colour. The concept shows the rare
deposits as blue and violet crystal clusters. A deposit with a rig on it shows the cut and the laser; a locked tier
(not yet unlocked by a contract) shows as a dim outcrop with a lock.

### 8.4 Mining rigs: one design per material

The owner's direction: the mining towers for different materials are **different designs**. A rig is a shared
base (the pad footing, the power socket and the ore-cart track to storage) with an **extraction head** that shows
how that material comes out of the ground. There are six heads, and every ore has one. On every planet the three
ores use three different heads, so the three rigs of one outpost never look alike.

| Head | How it works, on screen | Ores |
|---|---|---|
| **Auger Drill** | a heavy screw drill hammering into the rock; ore chunks ride a conveyor into the carts | Iron, Copper, Nickel, Manganese, Zinc, Thorium, Neodymium, Phosphorus |
| **Laser Cutter** | the concept's rig: a beam slices the outcrop, cut blocks drop onto the track | Aluminum, Magnesium, Chromium, Titanium |
| **Brine Pump** | a pump derrick with tanks; the ore comes up as glowing fluid and drains into evaporation trays | Lithium, Boron, Sulfur, Helium-3 |
| **Crystal Harvester** | resonator arms ring the crystal cluster until shards break off and float into a collector | Silicon, Yttrium, Iridium |
| **Deep Bore** | a tall derrick lowering a core barrel; cores come up and are split on the deck | Cobalt, Gallium, Tungsten, Vanadium, Platinum, Palladium, Europium |
| **Shielded Extractor** | a sealed dome with warning lights; robotic arms move lead-lined canisters | Uranium |

| Planet | Common | Uncommon | Rare |
|---|---|---|---|
| Verdance | Iron: Auger Drill | Aluminum: Laser Cutter | Lithium: Brine Pump |
| Florael | Magnesium: Laser Cutter | Boron: Brine Pump | Cobalt: Deep Bore |
| Ochre | Silicon: Crystal Harvester | Copper: Auger Drill | Gallium: Deep Bore |
| Kessra | Nickel: Auger Drill | Chromium: Laser Cutter | Tungsten: Deep Bore |
| Rime | Manganese: Auger Drill | Titanium: Laser Cutter | Vanadium: Deep Bore |
| Cinder | Zinc: Auger Drill | Platinum: Deep Bore | Iridium: Crystal Harvester |
| Lumen | Thorium: Auger Drill | Uranium: Shielded Extractor | Helium-3: Brine Pump |
| Xenthe | Neodymium: Auger Drill | Yttrium: Crystal Harvester | Europium: Deep Bore |
| Vexmire | Sulfur: Brine Pump | Phosphorus: Auger Drill | Palladium: Deep Bore |

Every head also takes the ore's colour on its working parts (the beam, the fluid, the cores, the shards), so two
Auger Drills on different planets still read as different materials.

**Rig Mk II is the same design, not a new model** (owner). It is the 2× miner, and it reads as stronger through:

- **a different highlight colour:** its trim lights and emissive edges switch from the base cyan to **hot amber**,
  so a Mk II rig is recognisable from across the mesa;
- **an enhanced mining animation:** the head works at double tempo with a heavier rhythm (bigger drill strokes, a
  wider beam, a faster pump stroke, quicker resonance pulses), and the ore carts leave twice as often;
- **more debris:** about three times the particles at the deposit: rock chips, dust plumes and ore chunks in the
  ore's colour, bouncing off the pad. The debris is the clearest sign of the doubled output.

## 9. The outpost map, per planet

Nine new maps, one per planet, authored in the Terrain Forge like the battle maps.

- **Smaller than a battle map,** about 40 × 24 cells, sized to frame in one view on a phone in landscape and portrait.
- **A central build mesa** with **7 pads**: the hub pad in the middle and 6 around it (power, rig × 2, storage,
  harvester bay, upgrade bay). There is one spare rig pad on the uncommon deposit; the rare deposit gets a pad at
  contract 2.
- **Three ore deposits**, one per tier, at the mesa's edge next to rig pads.
- **Surface resource fields** for the Harvester Bay, a few rings like a battle map's first ring.
- **Two raid lanes** coming in from the map edge, and a **defense ring** of tower cells around the mesa.
- **One signature prop** from the planet's battle maps (Faction-Terrain-Design §2.6), so each outpost reads as that
  planet.

## 10. The menu

- **REPLAY LAST BATTLE becomes OUTPOST.** Before an outpost contract is accepted it is shown locked: "Accept an
  outpost contract aboard a capital ship." After, it opens the outpost of the planet the menu is targeting. If that
  planet has no outpost, it opens the player's most recent one, with a planet switcher in the outpost header.
- **The OUTPOST button's status:** a red dot when loads are ready or the defenses are worn; the line under the label
  reads *3 loads ready*, *storage full*, *raid repelled* or *raid broke through: ore lost*.
- **Replay moves to battle history.** Each battle card in the planet's history modal gets **REPLAY** when that battle
  has a stored replay. The game keeps replays of the most recent 20 battles; older cards show no button.

## 11. Owner decisions (2026-11-06)

| # | Question | Decision |
|---|---|---|
| Q1 | The cut-off sentence: what to build first | **Yes**: the Verdance contract and the Verdance outpost map first; the other eight maps follow |
| Q2 | Defenses in the starter kit | **Ground defenses: a Cannon, a Machine Gun and walls** |
| Q3 | Deep ore value | **Raise the price**: 5×, so deep ore earns 1.25× per hour (§4.4) |
| Q4 | Ores for planets 3–9 | **The proposed list stands** (§3) |
| Q5 | Selling | **Always a manual tap**, with a shuttle animation, ore splatter and a "$N" pop like combat (§4.3); no automatic selling at any tier |
| Q6 | A breach | **25 % of the ore in storage is lost**; nothing else breaks (§5.2) |
| Q7 | The star ladder | **3★ on map 3** brings the ship and the outpost contract, simplified to 3 for now |

## Dependencies

| relation | document | what it holds that this design does not restate |
|---|---|---|
| depends-on | docs/tech-plan/Content-Reveal.md | the capital ship's first visit, where the contract is granted |
| depends-on | docs/16 Bulwark MM/design/Tech-Tree-Design.md | the Outpost division and how nodes are bought |
| depends-on | docs/tech-plan/Mission-Log.md | how contracts show in the Mission Log, gates and stages |
| depends-on | docs/16 Bulwark MM/design/Rare-Contracts-Design.md | the shape of faction contracts and loyalty bands |
| depends-on | docs/16 Bulwark MM/design/Menu-Progression-Design.md | red dots and the menu's main buttons |

Each planet's look, palettes and signature props come from `docs/16 Bulwark MM/design/Faction-Terrain-Design.md`
(mirrored in MetaMax as *Faction Terrain Design: the nine battlefield planets*).
