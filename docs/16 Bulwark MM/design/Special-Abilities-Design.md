# Special Abilities — one per faction

Version 1.2 · 2026-10-24 · owner request, built to the sim as it is on main (v2026.10.23-c).

> Owner, 2026-10-24: "I want to create a special ability unit for each faction … You can figure out how
> to best match these abilities to the right faction. The ability can be attached to any unit in the
> faction but no faction get more than one ability. The ability should probably be attached to scouts,
> drones or trucks, but in some case light drones or other units could also work."

## 1. Rules

- **One ability per faction, on one unit.** Nine abilities, nine factions. No faction gets two, and every faction gets one.
- **The carrier is a unit the faction already fields.** No new unit ids. A carrier spawns through the campaign's points budget, which guarantees a quota of carriers per wave (§8). It keeps the same id, model, stats and cost.
- **Enemy waves only, in v1.** Abilities fire for `side: 'attacker'` units. The defender side never gets an ability until a design for player-deployed specials exists (§7, open question Q1).
- **Balance is data.** Every number lives in one `ABILITIES` table in `tables.js`, keyed by ability id. Every carrier declares `ability: '<id>'` on its unit row. The sim reads the table and nothing is hard-coded.
- **Deterministic.** Durations and cooldowns are counted in ticks. Choices use nearest-first with the id as tie-break. No `Math.random()` and no `Date.now()`.
- **Every ability is readable on screen.** Each one emits a sim event that the renderer turns into a visual cue (§5). A player who loses a tower to an ability can see what took it.

## 2. The match-ups

| # | Faction | Identity (Content-Plan §2.1) | Ability | Carrier | Why it fits |
|---|---|---|---|---|---|
| 1 | Ground / Powder | Infantry & armor; flags & honor | **Shield Tank**: heavy armor | Assault Tank (`GND-Tanks`) | The armor faction. Its tank guards the column, so a tank wears the shield. |
| 2 | Air | Air superiority; manga aces | **Freeze Missile**: stuns an area | Fighter (`AIR-Planes`) | An ace's missile run. The fighter dives in and freezes a tower cluster before the wave reaches it. |
| 3 | High Tech | Precision, **shields**, expensive | **Shield Drone**: anti-missile | MG Drone (`HTC-Missiles`) | "Shields" is already its identity. A drone carries the interceptor bubble. |
| 4 | Artillery | Siege military; range & arc | **Mine Layer**: protects resources | Scout truck (`ART-Trucks`) | Combat engineers. The siege army mines the ground it means to hold. |
| 5 | Water | Sea tribes; Frost | **Water Blobs**: disrupt units | MG Drone (`WTR-Missiles`) | Water's own scout is a floater that only spawns on water maps. Its drone flies every map, so the blobs show up on every map. |
| 6 | Arcane / Energy | Theocracy; energy weapons | **Mirror Units**: decoys that draw tower fire | Scout (`ARC-Trucks`) | Illusion magic. The priest's cart casts mirror images. |
| 7 | Space Tech | Sci-fi federation; orbital tech | **Stealth**: hidden from basic towers | Scout (`SPC-Trucks`) | A cloaking field, the classic federation tech. |
| 8 | Dark Energy | Cult; corruption, night-strong | **Resurrected**: raises the fallen | Scout (`DRK-Trucks`) | A cult that raises its dead. |
| 9 | Greenies (Chem) | Hive collective; swarms | **Stun Drones**: disable towers one at a time | Scout (`GRN-Trucks`) | A hive truck releases its swarm drones one at a time. |

Six of the nine sit on a scout truck or a drone, as the owner suggested. The three exceptions are deliberate:
- Ground's ability is a *tank* by name.
- Air's is a *missile*, and fighters carry missiles.
- Water's scout never leaves the water lane (§2, row 5).

## 3. Each ability

All radii are in cells. Durations are in seconds, converted to ticks. Tier scales the numbers marked *×tier*, using the unit's own `hp`/`dps` tier ratio (1 / 1.6 / 2.4).

### 3.1 Shield Tank (Ground / Powder)
- **Effect:** the tank and every friendly ground unit within **2.5** cells take **30% less damage**. It is an aura, so it does not stack, and two shield tanks protect no more than one.
- **Counter:** kill the tank first. With 440 HP it is no harder to kill than any other assault tank. Only what stands near it is harder.

### 3.2 Freeze Missile (Air)
- **Effect:** once per fighter life, when the fighter has a completed tower within **7** cells, it fires one missile at it. The missile lands after **0.6 s**.
- Every tower within **2** cells of the impact point is **stunned for 3 s** (*+0.5 s ×tier step*). So is every defender unit there.
- A stunned tower holds fire and drops its target.
- **Counter:** spread towers so one missile cannot freeze several. Kill the fighters before they close.

### 3.3 Shield Drone (High Tech)
- **Effect:** while the drone lives, friendly units within **2.5** cells take **no damage from missile towers**: Rockets (`STR-Rockets`) and Missile Tower (`STR-Missile`).
- The drone absorbs that damage instead, from a **shield pool of 300** (*×tier*). When the pool is empty the bubble pops and the missiles land again. The drone's own HP is untouched by blocked missiles.
- **Counter:** Cannon, Machine Gun and Flak ignore the bubble. The Machine Gun shreds the drone.

### 3.4 Mine Layer (Artillery)
- **Effect:** the truck plants mines on **resource fields**. When it passes within **3** cells of a resource node that still has stock and has no enemy mine within 1.5 cells, it plants one.
- Limits: a **2 s** cooldown between mines and **3 mines per truck**.
- A mine arms after **1 s**. It detonates when a **defender ground unit** (a harvester, repair drone or deployed defender) comes within **0.8** cells. The burst does **180 Concussion** (*×tier*) within **1** cell. Concussion is heavy against Machinery, so harvesters feel it.
- Mines outlive the truck. Each one lasts **60 s**, then fizzles.
- **Counter:** kill the truck before it reaches the fields, or keep harvesters off a mined field until the mines fizzle. Mines cannot be shot in v1.

### 3.5 Water Blobs (Water)
- **Effect:** every **6 s**, the drone lobs a blob at the nearest defender unit within **5** cells. If there is none, it lobs at the nearest resource node within 5 cells. The blob lands after 0.8 s.
- It leaves a **puddle of radius 1.5 for 6 s**. A defender unit inside the puddle is **disrupted**: it cannot move, harvest, repair or fire. A harvester in a puddle stops working.
- **Counter:** Machine Gun and Flak out-range the drone, so shoot it down. Keep harvesters near AA cover.

### 3.6 Mirror Units (Arcane / Energy)
- **Effect:** every **8 s**, the scout casts a mirror of the strongest friendly unit within **4** cells, measured by max HP, with itself as the fallback.
- The mirror appears **1.5** cells further along that unit's path. It looks the same and walks the same route.
- It has **30% of the source's HP**, deals **no damage**, and fades after **8 s**.
- Towers **prefer mirrors** in range, the same preference the MG has for artillery, so the decoys soak fire.
- A mirror pays **no bounty**, is not a kill and cannot hurt the base. Each scout keeps at most **2** live mirrors.
- **Counter:** splash damage hits the real unit behind the decoy, and killing the scout ends the casting.

### 3.7 Stealth (Space Tech)
- **Effect:** the scout and every friendly unit within **2.5** cells are **cloaked**.
- **Tier 1 towers cannot see or target** cloaked units. That is what "basic towers" means here. **Upgraded towers (tier 2+) and the base cannon see through it.** This ties the ability to the upgrade path that just gained range.
- A cloaked unit stays visible to the player on screen, drawn translucent, so the play stays readable.
- **Counter:** upgrade a tower on the approach, or kill the scout. It is the only uncloaked-to-T2 unit in the field.

### 3.8 Resurrected (Dark Energy)
- **Effect:** when a friendly unit dies within **3** cells of the scout, it **rises 1.5 s later where it fell**, at **50% HP**.
- Mirrors, other carriers and units that have already risen are never raised. A raised unit pays **no bounty the second time**.
- **3 raises per scout.** If the scout dies before the 1.5 s are up, the raise is cancelled.
- **Counter:** focus the scout. It is fragile, with 225 HP.

**Escort pace (Stealth, Resurrected, Mirror Units):** an aura scout slows to the slowest friendly unit of its own domain within 5 cells. Scouts are the fastest units on most rosters, and an aura that runs ahead of the column covers nothing. Alone, it moves at its own speed.

### 3.9 Stun Drones (Greenies)
- **Effect:** when a completed tower is within **6** cells, the truck releases **one stun drone** at the nearest one.
- The drone flies **0.5 s** (cosmetic) and **disables that tower for 3 s**. A disabled tower holds fire and drops its target.
- **One tower at a time:** the next drone launches only after the current stun ends, plus a **1 s** cooldown.
- The drone is not an entity and cannot be shot. The truck is the target.
- **Counter:** kill the truck, and overlap tower coverage so losing one at a time costs little.

## 4. Sim shape

- **`src/data/tables.js`:**
  - `ABILITIES` holds one frozen row per ability id, with every number in §3.
  - Each carrier unit row gains `ability: '<id>'`.
  - A test asserts nine abilities, one per faction, each on exactly one unit of that faction.
- **`src/sim/abilities.js`** (new) is a single `stepAbilities(state, dt)`. It runs after movement and before combat in `stepSim`. On new units it uses `unit.ability`, `unit.abilityReady` (tick) and `unit.abilityUses`.
- **State added:**
  - on structures, `stunnedUntil` (tick);
  - on units, `disruptedUntil`, `cloaked`, `isMirror`, `mirrorOf`, `expiresAt`, `noBounty`, `raised`;
  - the sim state gains `enemyMines[]`, `puddles[]` and `abilityFx[]` (missiles, drones and blobs in flight, and raises waiting to land).
- **Combat hooks (`combat.js`):**
  - **Stunned towers:** a tower with `stunnedUntil > tick` skips firing and clears its target.
  - **Cloaked units:** `canSee` refuses a cloaked unit to a tier-1 tower.
  - **Decoys:** towers prefer `isMirror` targets in range, through the same preferred-target pass the MG uses for artillery.
  - **Damage reductions** (`applyDamage`): the Shield Tank's 30% cut, and the Shield Drone's absorb for missile-tower sources.
  - **Mirrors deal no damage.**
- **Death hooks:**
  - `grantKillIncome` honours `noBounty`.
  - Both death paths (combat and core cleanup) call `abilities.onUnitDeath`, which queues raises.
  - Mirrors and raised units are not counted as kills.
- **Movement and harvest:** a unit with `disruptedUntil > tick` does not move, harvest or repair.

## 5. On screen (built: `render3d/fx/abilityFx.js`, unit looks in `units/models3d.js`)

| Ability | What the player sees |
|---|---|
| Shield Tank | A golden hex-energy dome over the tank (radius 2.5) with a turning ground ring; a light sweep runs round it, and it flares when a covered unit is hit |
| Freeze Missile | A glowing ice-blue missile arcs from the fighter, trailing frost. On impact: a frost-nova ring, a burst of ice shards and mist. Frozen towers wear a translucent ice crust with glints, and frost drifts off them until they thaw |
| Shield Drone | An iridescent cyan-violet bubble with a faint hex weave and ripples, sitting where the sim protects. An energy tether runs from the drone to the bubble while the drone flies its attack run. It flashes when it blocks a missile, and shatters into shards with a shockwave when its shield is spent |
| Mine Layer | A dirt puff where the truck drops a mine. A dark mine sits on the field; its red eye blinks once armed. A detonation is a fireball with dirt, sparks and a shockwave |
| Water Blobs | A wobbling water blob arcs over, dripping. It splats with foam and droplets into a rippling, glinting puddle that fades as it dries. Units stuck in the puddle trail bubbles |
| Mirror Units | Mirrors are drawn only as cyan holograms (scanlines, rim light, a sweeping band), so the player can read them as fakes while the towers still fall for them. They flicker in their last 1.5 s, and shatter into glass shards when killed or faded |
| Stealth | A violet broken ring with heat-haze bands and a sweeping light marks the field. Cloaked units are drawn as see-through ghosts with a shimmering rim |
| Resurrected | A green rune circle turns where the unit fell, with soul wisps spiralling in. The unit stands up in a green soul column with a shockwave, and glows green for a moment |
| Stun Drones | A small glowing dart weaves from the truck to the tower. The disabled tower crackles with electric arcs and throws sparks until the stun ends |

Every carrier that has no aura gets a small coloured beacon over it, so the player can pick it out of the column.

The unit card shows the carrier's ability name and effect. A mirror reads "mirror image · a harmless decoy", and a risen unit is marked "risen (no bounty)".

**Where to see them:** the Effects Lab (`fxlab.html`, reached from Settings). Pick a faction, then **★ Special ability** in the Attackers list. `fxlab.html?faction=dark&ability` opens straight on one.

## 6. Build order and tickets

Epic **Special Abilities: one per faction** (`epic_mvn06sbi_6`), with these stories, one PR each:
1. **Framework + all nine abilities in the sim** (`story_mvn06wnv_7`):
   - the `ABILITIES` table and the carrier flags;
   - `abilities.js`;
   - the hooks.
   - One sim test per ability (it fires, its effect lands, it stops when the carrier dies), plus the one-per-faction rule test.
2. **On-screen cues** (§5), in the 3D renderer and in the unit info card (`story_mvn06y2l_8`).
3. **Balance pass** (`story_mvn06zdh_9`). `balanceSim` before and after per faction. A carrier's `power`/`cost` is raised only if its faction's win rate moves out of band.

## 7. Open questions for the owner

- **Q1:** should player-deployed units of a faction carry the ability too? This would need defender-side versions: stun drones hitting enemy units, stealth against enemy fire.
- **Q2:** Stealth is defined as "tier-1 towers can't see it". Is that the right meaning of "basic towers", or should one tower type be the detector, a future radar tower for example?
- **Q3:** do Water Blobs target only player units (harvesters, repair drones, defenders)? Or should a puddle on a tower slow its fire too?

## 8. Carriers in waves, and the first balance reading

**Carriers are guaranteed in waves.** The campaign wave filler takes the biggest affordable unit first. The scout trucks are the cheapest units on most rosters, so without help five of the nine abilities never appeared in a balance run. Each campaign wave now includes `ABILITY_CARRIERS_PER_WAVE` = `[0, 1, 1, 1, 2, 2, 2, 2]` of its faction's carrier (index = wave − 1):
- they are paid out of their own lane's budget, so a wave's total pressure is unchanged;
- they ride a third of the way into the wave;
- an air carrier waits for its lane to open (wave 3 for factions that also field ground units).

Some rosters draft extra carriers on their own. Greenies trucks and Ground tanks often appear several times per wave.

**First reading** (`map-balance-sim`, all nine factions, seeds 1–5 on the old and new maps, scripted defender; player wins out of 10):

| Faction | Wins before → after | Base HP left | Note |
|---|---|---|---|
| Ground / Powder | 10 → 10 | 100% → 100% | |
| Air | 8 → 6 | 79% → 60% | freeze missiles open gaps |
| High Tech | 3 → 5 | 20% → 46% | carriers displace stronger units; the shield only covers missile towers |
| Artillery | 6 → 5 | 60% → 50% | |
| Water | 1 → 2 | 10% → 20% | blobs hit harvesters, not the base |
| Arcane / Energy | 3 → 5 | 30% → 50% | mirrors soak fire but the scouts replace real damage |
| Space Tech | 7 → 6 | 60% → 60% | |
| Dark Energy | 10 → 8 | 100% → 100% | losses are stalls, not base damage |
| Greenies (Chem) | 8 → 5 | 100% → 100% | many stun trucks per wave; losses are stalls |
| **Total** | **56 → 52 of 90** | | |

The tuning belongs to the balance-pass story (§6.3).

## Dependencies

| Document | Relation |
|---|---|
| Content-Plan.md | faction identities (§2.1) |
| Balance-Sim-Report-2026-10-22.md | baseline for the balance pass |
