# Tech Tree — design

**Version:** 1.0 (2026-10-22) · epic **TT** [MM-epic_mvkg5mm7_2] · plan story [MM-story_mvkg5mpn_3]

Repo copy is canonical: `docs/16 Bulwark MM/design/Tech-Tree-Design.md`.

**Owner request (2026-10-22):** "We need to implement a proper tech tree. Unlocking tier 2 and tier 3 upgrades, long range rockets, missiles, and the bases, base defenses should all be upgrade slots even portal code to visit new planets." Then: "We should structure upgrades for the base and for the harvesters. Each of the bases is an upgrade and the 4 defense pods could be unlocked. Each base model should provide bonuses to attack, defense, range, damage, upgrade cost, harvester speed, harvester gathering." Earlier the same day: "The base defense is supposed to be an upgrade" [MM-story_mvk635mq_p].

## 1. What is there today (three systems, none of them complete)

| system | where | what it does | problem |
|---|---|---|---|
| TECH screen | `src/menu/menu.js`, `src/save/save.js` `structTiers` + `TIER_COSTS` | gold buys the right to tier Cannon / Flak / Wall to T2 / T3 in battle | `main.js` passes `structTiers` only for non-forge maps, and every map is a forge map now — **it does nothing** |
| Tech Tree screen | `src/menu/techtree.js` + `techtree.data.js` | 20 nodes + the Apocalypse Cannon, clearance-gated (Map-2 faction wins), bought with banked gold into `save.techNodes` | **display only** — no node changes a battle |
| Harvester screen | `menu.js` `refreshHarvester`, `mapdata.harvesterUpgrades` | Harvester L1–L5 (capacity / speed / HP multipliers) | works; lives on its own screen |
| Wave bonuses | `src/sim/bonuses.js`, `tables.js` `BONUS_NERFS` | in battle: T3 unlocks (bonus 15/16), cannon range/damage buybacks | stays — it is the in-battle layer, not the tree |

The tree replaces the first three with one screen and one save field; the wave bonuses stay as the in-battle layer on top.

## 2. Shape — five branches

The tree is bought **between battles** with **banked gold** (`save.carry.gold`, as today). Everything owned is turned into one **loadout** at `createSim`, so the battle stays deterministic and a replay carries its loadout.

| branch | what it holds | items |
|---|---|---|
| **BASE** | the landing-craft models (each a bonus profile), the 4 defense pods and their weapons, the super-cannon | 21 |
| **HARVESTERS** | harvester marks, extra docks, refinery | 7 |
| **TOWERS** | new tower types (Rockets, Missile, Mine) and T2 / T3 per tower type | 17 |
| **PORTALS** | the portal code for each planet | 8 |
| **COMMAND** | the old tree's specials that nothing else covers | 4 |
| | **total** | **57** |

§9 lists every item. The old tree's generic stat nodes (structure HP, damage, range, base armour, harvest yield…) are folded into the base models and tower tiers rather than kept as separate buys (owner decision D2).

## 3. BASE branch

### 3.1 Base models — each landing craft is an upgrade

The ten landing craft (Landing-Craft-and-Resources-Design §2, `render3d/craft/models.js`) become ten **base models**. The player owns one or more and **equips one** before a battle; the equipped craft is the one that lands, and its **profile** applies for the whole battle.

**The seven stats** (owner list), each a signed fraction (+0.20 = +20 %):

| stat | key | applies to |
|---|---|---|
| Attack | `atk` | the BASE's own weapons: super-cannon damage and the defense pods' dps |
| Defense | `def` | base max HP and every built structure's max HP |
| Range | `rng` | every tower's and pod's range (super-cannon included) |
| Damage | `dmg` | every built tower's dps |
| Upgrade cost | `cost` | discount on in-battle build and tier-up prices (positive = cheaper) |
| Harvester speed | `hspd` | harvester move speed |
| Harvester gathering | `hgat` | harvester capacity (gold per trip) |

Attack and Damage are split so the base and the towers can be tuned apart: Attack is the base, Damage is the towers (owner decision D3).

**Budget rule:** the starter craft is all zeros. Every faction craft is a trade: **+50 points of strengths, −10 of weakness** (net +40), so no craft is strictly better than another — they suit different plans. The numbers are data (`src/data/techtree.js` `BASE_MODELS`) and get tuned in the balance pass (§8).

| craft | faction | plays as | atk | def | rng | dmg | cost | hspd | hgat | price | requires |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BS-7 Pathfinder | Neutral | starter, no trade | 0 | 0 | 0 | 0 | 0 | 0 | 0 | free | — |
| Ironhoard Casemate | Ground (Verdance) | hold the line | +10 | **+25** | 0 | +15 | 0 | −10 | 0 | 2,000 | Verdance portal + 1 win there |
| Skylark Carrier | Air (Florael) | fast economy, reach | +15 | −10 | +10 | +5 | 0 | **+20** | 0 | 2,000 | Florael portal + 1 win |
| Sterling Vault | High Tech (Ochre) | cheap upgrades, shield | −10 | **+20** | 0 | 0 | **+20** | 0 | +10 | 2,500 | Ochre portal + 1 win |
| Siegeworks Emplacement | Artillery (Kessra) | out-range everything | +10 | 0 | **+25** | +15 | 0 | −10 | 0 | 2,500 | Kessra portal + 1 win |
| Tideborn Ark | Water (Rime) | the gatherer | −10 | +10 | +10 | 0 | 0 | +10 | **+20** | 3,000 | Rime portal + 1 win |
| Sanctum of the Flame | Arcane (Cinder) | strong base, dear towers | **+20** | +15 | 0 | +15 | −10 | 0 | 0 | 3,000 | Cinder portal + 1 win |
| Lumen Survey Lander | Space Tech (Lumen) | long-range precision | 0 | −10 | **+20** | +10 | +10 | +10 | 0 | 3,500 | Lumen portal + 1 win |
| Hollow Choir | Dark (Xenthe) | glass cannon | **+25** | −10 | 0 | **+25** | 0 | 0 | 0 | 3,500 | Xenthe portal + 1 win |
| Brood Hive | Greenies (Vexmire) | swarm economy | 0 | −10 | 0 | 0 | +15 | +15 | **+20** | 4,000 | Vexmire portal + 1 win |

"Requires a win there": you salvage the faction's craft by beating them on their own planet. Each craft keeps its own roof weapon as its look (the super-cannon is one sim weapon whatever the roof shows — Landing-Craft §7 left that open; this spec keeps it).

### 3.2 Defense pods — four slots

Every craft has four corner pods (`models.js`: front pair are defense pods, rear pair carry engines). They become **four pod slots**, unlocked in order, shared by every base model (a pod bought once is on whichever craft is equipped).

| slot | price | requires |
|---|---|---|
| Pod 1 (front starboard) | 800 | — |
| Pod 2 (front port) | 1,600 | Pod 1 |
| Pod 3 (rear starboard) | 3,000 | Pod 2 + 1 portal |
| Pod 4 (rear port) | 5,000 | Pod 3 + 3 portals |

Each open slot mounts one **pod weapon**, chosen before battle (several slots may take the same weapon):

| pod weapon | role | targets | range | dps (T1-equivalent) | price | from the old tree |
|---|---|---|---|---|---|---|
| Gun Pod | close defence | light ground + air | 4 | 20 | free with Pod 1 | — |
| RPG Pod | splash vs clusters | ground | 6, aoe 1.0 | 26 | 1,800 | `b-rpg` RPG Battery |
| SAM Pod | guided anti-air | air | 8 | 30 | 3,200 | `b-sam` SAM Site |
| Repair Pod | mends structures | own structures within 4 | 4 | heals 8 /s | 1,500 | `h-rep` Repair Drone |

In the sim a pod is a weapon emitter at its corner of the base: it fires like a tower (its own `STRUCTURES`-style row in `tables.js` `POD_WEAPONS`), uses the base's HP (no HP of its own, not targetable), and scales with **Attack** and **Range**. In the 3D view the pod's mesh on the craft gets the weapon's small turret.

### 3.3 Super-cannon — an upgrade, not a default [MM-story_mvk635mq_p]

| item | price | effect |
|---|---|---|
| Super-cannon | 1,200 | the base fires its long-range shell (`core.js` `CANNON`) — today's nerfed values (range × 0.70, damage × 0.50) |
| Cannon range I / II | 900 / 2,000 | buy back the range nerf: × 0.85, then × 1.0 |
| Cannon power I / II | 900 / 2,000 | buy back the damage nerf: × 0.75, then × 1.0 |

Without the item, `stepBaseCannon` never arms. The wave bonuses 13 / 14 still stack on top in battle.

## 4. HARVESTERS branch

| item | price | effect | from |
|---|---|---|---|
| Harvester Mk II | 600 | capacity × 1.2, speed × 1.05, HP × 1.15 | harvester L2 |
| Harvester Mk III | 1,500 | × 1.4 / 1.15 / 1.3 + auto-return at 90 % | L3 |
| Harvester Mk IV | 3,200 | × 1.65 / 1.25 / 1.55 | L4 |
| Harvester Mk V | 6,000 | × 2.0 / 1.4 / 1.9 + premium fast-harvest | L5 |
| Dock 3 | 1,200 | a 3rd harvester can be bought in battle | new |
| Dock 4 | 2,500 | a 4th | new |
| Refinery | 1,800 | +12 % gold per load | `e-dmg` Output Boost |

The marks keep `mapdata.harvesterUpgrades` as their data (one source). Docks: the fleet cap in battle starts at **2** (today 4), Dock 3 / Dock 4 raise it (owner decision D5 — this makes the early economy tighter than today). The base model's `hspd` / `hgat` multiply on top of the mark.

## 5. TOWERS branch

**Starting kit:** Cannon, Flak, Wall, Machine Gun at T1.

| item | price | requires |
|---|---|---|
| Rocket Tower (long-range, ground) | 1,500 | Cannon T2 |
| Missile Tower (long-range, air) | 1,500 | Flak T2 |
| Mine | 800 | — |
| Cannon T2 / T3 | 600 / 1,500 | T3 needs 1 portal |
| Flak T2 / T3 | 600 / 1,500 | as above |
| Wall T2 / T3 | 400 / 1,000 | as above |
| Machine Gun T2 / T3 | 400 / 1,000 | as above |
| Rockets T2 / T3 | 900 / 2,200 | Rocket Tower |
| Missile T2 / T3 | 900 / 2,200 | Missile Tower |
| Mine T2 / T3 | 500 / 1,200 | Mine |

A tower type not owned is greyed out in the build bar with its price in the tree. The in-battle tier cap per type is the owned tier. Wave bonuses 15 / 16 ("Enable Tier-3") still unlock T3 **for that battle** when it is not owned; once it is owned they are dropped from the bonus pool.

## 6. PORTALS branch

Each planet other than the starting one needs its **portal code** before it can be entered from the galaxy menu.

| item | price | requires |
|---|---|---|
| Portal: each of the 8 other homeworlds | 1,000 · 1,500 · 2,000 · 2,500 · 3,000 · 3,500 · 4,000 · 4,500 (the n-th code bought costs this, whichever planet) | beat Map 3 on any planet you already hold |

The rising price by count (not by planet) lets the player choose the order. Portals replace the old **clearance** gate (Map-2 faction wins) as the tree's progression: "1 portal" / "3 portals" in the requirements above means portal codes owned.

## 7. COMMAND branch

The old tree's nodes that no other branch covers:

| item | price | effect | old id |
|---|---|---|---|
| Mining Drone | 1,500 | +5 gold /s passive | `h-min` |
| Early Warning Net | 2,600 | the next wave's composition is shown before it deploys | `h-ewn` |
| L3 Troop Command | 3,800 | fields allied troops each wave | `h-l3` |
| Apocalypse Cannon | 25,000 | the ultimate: needs every branch's last item | `ult` |

Dropped (folded into base models or tiers): `b-def`, `b-atk`, `b-awr`, `e-hp`, `e-rng`, `e-dual`, `e-rep`, `s-hp`, `s-dmg`, `s-rng`, `s-dual`, `s-rep`, `h-l4`. A save that researched one gets its gold back on migration.

## 8. How it is built

- **Data:** `src/data/techtree.js` — every item `{ id, branch, name, price, requires: [ids], gate: { portals, winsOn }, effect }`, plus `BASE_MODELS` (the §3.1 table), `POD_WEAPONS`, `TOWER_START`. Balance is data: retunes are table edits.
- **Loadout (pure):** `deriveLoadout(owned, equipped) → { baseModel, mods: {atk, def, rng, dmg, cost, hspd, hgat}, pods: [weapon|null ×4], cannon: {on, rangeMult, powerMult}, towers: {[structId]: maxTier | 0}, harvester: {mark, docks, yield}, command: {...} }`. No save access, no clock — the same input always gives the same loadout.
- **Save:** `save.tech = { owned: {[id]: true}, equip: { base, pods: [...] } }`. Migration: `structTiers` → tower tier items; `harvesterLevel` → marks; `techNodes` → kept ids, refunds for dropped ones. Existing players keep Super-cannon and the starting kit, so a migrated save plays as today.
- **Sim:** `createSim(map, { loadout })` on **every** map (forge maps included — fixes the ignored `structTiers`). The loadout is logged in the replay init. Hooks: `structures.js` tier cap + tower availability + `cost` discount + `def`/`dmg`/`rng`; `harvest.js` mark, docks, `hspd`/`hgat`, refinery; `core.js` super-cannon on/off and its multipliers × `atk`/`rng`; a new `pods.js` steps the pod weapons.
- **Render:** the equipped base model is the craft that lands (replaces `?craft=` / neutral default); pods show their weapon.
- **Menu:** one **TECH TREE** screen with the five branches, replacing the TECH, Tech Tree and Harvester screens; an **EQUIP** panel (base model + pod weapons) before battle. Prototype first, reviewable outside Claude (standalone HTML), before it goes in the game.
- **Balance:** `balanceSim.js` takes a loadout; the pass checks (a) starter loadout on Maps 1–3 still wins at today's rates, (b) each base model is within ±10 % of the others on a mixed map set, (c) the prices fit what a player banks per map (with [MM-task_mvjxajem_j]).
- **Tests:** loadout derivation (every item, requirement chains, migration), sim hooks per stat, replay round-trip with a loadout, deploy gates green.

## 9. Every item (57)

**BASE (21):** 9 faction base models · Pod 1–4 (4) · RPG Pod, SAM Pod, Repair Pod (3) · Super-cannon · Cannon range I, II · Cannon power I, II.
**HARVESTERS (7):** Mk II–V (4) · Dock 3, Dock 4 · Refinery.
**TOWERS (17):** Rocket Tower, Missile Tower, Mine (3) · T2 + T3 for Cannon, Flak, Wall, MG, Rockets, Missile, Mine (14).
**PORTALS (8):** one per homeworld other than the start.
**COMMAND (4):** Mining Drone · Early Warning Net · L3 Troop Command · Apocalypse Cannon.

(The starter Pathfinder and the Gun Pod come free and are not counted.)

## 10. Open — owner decisions

| # | decision | this spec assumes |
|---|---|---|
| D1 | How a base model is unlocked: gold only, or gold + beating that faction on its planet | gold + one win on that planet |
| D2 | Drop the old generic stat nodes (13 nodes) in favour of base models + tiers | dropped, gold refunded |
| D3 | Attack = base weapons, Damage = towers (or: Attack = fire rate, Damage = hit damage — identical in the sim, which runs on dps) | base vs towers |
| D4 | Upgrade cost = in-battle build/tier-up prices (or the tree's own prices) | in-battle prices |
| D5 | Harvester fleet starts at 2 docks, Dock 3/4 bought (today: 4 from the start) | start at 2 |
| D6 | Does a brand-new player start with T2 already owned (today's in-battle cap) or at T1 | T1 — T2 is the first cheap buy |
| D7 | Super-cannon owned from the start for new players, or bought | bought (1,200) — migrated saves keep it |
| D8 | Starting planet: Verdance, or the player's choice | Verdance |
| D9 | Portal requirement: beat Map 3 anywhere, or clear a planet's whole campaign | Map 3 anywhere |
| D10 | All prices | placeholders until the balance pass |

## Dependencies

| relation | plan | what it holds that this plan does not restate |
|---|---|---|
| depends-on | docs/16 Bulwark MM/design/Landing-Craft-and-Resources-Design.md | the ten craft, their pods and roof weapons, the landing sequence |
| related | docs/16 Bulwark MM/design/Wave-Bonuses-Design.md | the in-battle bonus layer and BONUS_NERFS that the cannon buybacks and tier unlocks interact with |

The original display-only tree and its clearance gate are in the repo source `docs/sources/Bulwark-Tech-Tree-Epic.md` (not an ingested plan); §6 replaces its clearance gate.
