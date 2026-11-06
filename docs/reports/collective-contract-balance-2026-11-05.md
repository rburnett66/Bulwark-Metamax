# Collective contract — rare/epic out of the contract: balance measurement (2026-11-05)

refs [MM-story_mw4a1o3p_m] · branch `research/collective-contract-balance` · measured on `origin/main` d84a711

## Conclusion

Taking rare and epic out of the Collective contract removes **0.38–0.40 % of all harvest gold** across the 81 planet × map boards (fleet commander 2,621,688 → 2,611,672 gold, −10,016; quest commander 2,618,455 → 2,607,896, −10,559). The loss on a board is the old rare + epic quota × 4 gold, because every commander who hauls rare/epic fills those small quotas: **at most 200 gold per board** (maps 1 and 2), 40 gold on maps 4 and 7.

- **Worst map: map 1**, −1.27 % (fleet) / −1.28 % (quest) of the map's gold; worst single board **Vexmire map 1, −1.43 %** (fleet commander, 14,454 → 14,247 gold). Maps 4, 7, 8 and 9 lose 0.34 % or less.
- **Early affordability is not affected.** No board earns any rare/epic gold in waves 1–2, because no forge map seeds a rare/epic crystal before ring 3 (first ring with rare/epic: ring 3 on 34 boards, ring 4 on 7, ring 5 on 36, ring 6 on 4). By the end of wave 3 the mean cumulative gold drops by 7 gold (fleet) / 22 gold (quest); the largest single-board drop by then is 120 gold (Vexmire 9, Cinder 5), against a mean wave-3 bank of about 3,900 gold. On no board does the change push the wave-end bank below 300 gold (one T1 Cannon) where it was above before. The full-map loss of ≤ 200 gold is two-thirds of one T1 Cannon/Flak/Rockets/Missile (300), 1.3 Machine Guns (150), or under half of one Cannon T1→T2 upgrade (450).
- A player who issues **no orders** (the starting harvester on the game's own idle auto-gather) loses **nothing**: auto-gather always finds a nearer common field, so it never hauls rare/epic on any of the 81 boards.
- **Stars are unchanged**: the five wave stars (`waves.js scoreWave`) are judged on base damage, harvesters lost, the share of the ring's primary harvested, premium claimed and par time — none reads gold. **Final score** loses at most the lost gold (≤ 200 points), and only if that gold would have been left unspent (`core.js computeFinalScore`: +1 per gold remaining). Rare/epic **quest objectives** (`mapScore.questRed/questGreen`, missions `haul_rare` / `haul_epic`) count every unit hauled whether it is sold or kept, so they are unaffected; `harvest_common_gold` / `harvest_uncommon_gold` read only common/uncommon gold.
- The change moves gold into inventory: rare + epic units kept rise from 23,579 to 26,189 (quest commander, all 81 boards).

In plain words: the change costs a map 40–200 gold out of 16,000–48,000, none of it before wave 3, so it does not touch early affordability. The real lever on contract gold is the **uncommon** quota (30 or 20 gold a unit against 4 for rare/epic) — see the per-planet quota caveat below before adopting the per-planet CSV.

## Method

Tool: `tools/economy/contract_balance.mjs` (new; prints JSON for all 81 boards). The game's own deterministic sim — `createSim` / `stepSim`, seed 7, fixed 1/30 s tick, no `Math.random`/`Date.now` in the tick.

- **Boards**: every committed forge map `content/maps/forge/<faction>-map-<n>.json`, built as `main.js selectMap` builds a live board: `buildTerrainMap(forge, id, { seed: 0, bakeTune: {} })` then `resolveResourceTypes(map, 1)`. Faction slug → planet from `src/data/planets.js` + `factions.js` (powder = Verdance, air = Florael, high-tech = Ochre, artillery = Kessra, water = Rime, arcane-energy = Cinder, space-tech = Lumen, dark-energy = Xenthe, greenies = Vexmire).
- **No full battles.** There is no scripted commander that plays full battles: `balanceSim.js` prices a single attacking unit against a fixed tower layout on the classic harness board (no harvest, no contract). So this measures **harvest economics with no enemies**, the way `contract_quota.mjs` does. Gold spent on defence and harvesters lost to enemies are not modelled.
- **Ring schedule**: wave k's ring is revealed (`state.waves.current = k`, which `nodeRevealed` reads) for that ring's `Wave_Par_Sec`; wave 8 then runs on to the map's `Par_Time_Sec` (the horizon `contract_quota.mjs` uses for the common quota). Wave pars sum to 708–3,798 s, map par is 1,290–6,881 s.
- **Commanders**:
  - **starter**: no orders; the free starting harvester runs the game's idle auto-gather (nearest revealed crystal of any tier).
  - **fleet**: starter + buys a harvester (500 / 750 / 1,000 gold, `harvest.js HARVESTER_PRICE`) whenever it can afford one, up to the cap of 4.
  - **quest**: fleet + its first harvester is ordered onto the nearest revealed rare/epic field whenever it is empty and not already on one (a player chasing the quest objectives).
- **Contracts**: BEFORE = `contractFor(mapId)` (workbook quotas). AFTER = the same with `rare: 0, epic: 0`; common and uncommon unchanged.
- Gold, units, sold and kept come from the sim's own `deposit` events (`harvest.js creditDeposit`). "Gold lost" = rare + epic gold paid BEFORE (AFTER pays none). Prices: `src/data/tables.js` STRUCTURES cost per tier (Cannon/Flak/Rockets/Missile 300 / 750 / 1500, MG 150 / 375 / 750, Wall 100 / 250 / 500, Mine 150); an upgrade costs the difference between tiers (`structures.js startUpgrade`).
- Gold per unit on these boards: rare and epic 4 (they pay their type's Primary value, `harvest.js questGoldValue`), common 4 / 6 / 9, uncommon 20 / 30, by board.
- Reproduce: `node tools/economy/contract_balance.mjs > out.json` (≈ 3.5 min, 486 runs).

## Results

### Overall (81 boards)

| Commander | Gold BEFORE | Gold AFTER | Change | Direct loss (rare+epic gold BEFORE) | Direct loss % | Knock-on (other tiers) | Rare+epic units kept AFTER (BEFORE) |
|---|---:|---:|---:|---:|---:|---:|---:|
| starter | 2069526 | 2069526 | +0.00% | 0 | +0.00% | 0 | 0 (0) |
| fleet | 2621688 | 2611672 | -0.38% | 10016 | -0.38% | 0 | 15711 (13232) |
| quest | 2618455 | 2607896 | -0.40% | 10559 | -0.40% | 0 | 26189 (23579) |

### Per map — commander fleet (mean over the 9 planets; worst planet = largest total % drop)

| Map | Rare/Epic quota BEFORE | Ceiling loss (quota × 4 g) | Mean gold BEFORE | Mean gold AFTER | Mean direct loss | Mean change | Worst planet (change) | Rare+epic kept AFTER, mean units |
|---:|---|---:|---:|---:|---:|---:|---|---:|
| 1 | 10 / 40 | 200 | 16045 | 15841 | 204 | -1.27% | Vexmire (-1.43%) | 171 |
| 2 | 40 / 10 | 200 | 19130 | 18927 | 203 | -1.06% | Verdance (-1.15%) | 228 |
| 3 | 10 / 30 | 160 | 24198 | 24038 | 160 | -0.66% | Lumen (-0.71%) | 227 |
| 4 | 10 / 0 | 40 | 27988 | 27948 | 40 | -0.14% | Rime (-0.17%) | 229 |
| 5 | 30 / 0 | 120 | 29981 | 29866 | 116 | -0.39% | Ochre (-0.40%) | 198 |
| 6 | 30 / 10 | 160 | 38518 | 38354 | 164 | -0.42% | Rime (-0.43%) | 304 |
| 7 | 0 / 10 | 40 | 47331 | 47291 | 40 | -0.08% | Lumen (-0.09%) | 196 |
| 8 | 10 / 10 | 80 | 40371 | 40300 | 71 | -0.18% | Vexmire (-0.20%) | 93 |
| 9 | 10 / 30 | 160 | 47737 | 47622 | 116 | -0.24% | Verdance (-0.34%) | 100 |

### Per map — commander quest (mean over the 9 planets; worst planet = largest total % drop)

| Map | Rare/Epic quota BEFORE | Ceiling loss (quota × 4 g) | Mean gold BEFORE | Mean gold AFTER | Mean direct loss | Mean change | Worst planet (change) | Rare+epic kept AFTER, mean units |
|---:|---|---:|---:|---:|---:|---:|---|---:|
| 1 | 10 / 40 | 200 | 16041 | 15837 | 205 | -1.28% | Vexmire (-1.41%) | 179 |
| 2 | 40 / 10 | 200 | 19117 | 18912 | 205 | -1.07% | Verdance (-1.16%) | 227 |
| 3 | 10 / 30 | 160 | 24186 | 24026 | 160 | -0.66% | Lumen (-0.71%) | 227 |
| 4 | 10 / 0 | 40 | 27986 | 27946 | 40 | -0.14% | Rime (-0.17%) | 249 |
| 5 | 30 / 0 | 120 | 29921 | 29801 | 120 | -0.40% | Florael (-0.41%) | 309 |
| 6 | 30 / 10 | 160 | 38508 | 38345 | 163 | -0.42% | Rime (-0.43%) | 339 |
| 7 | 0 / 10 | 40 | 46888 | 46848 | 40 | -0.09% | Rime (-0.09%) | 391 |
| 8 | 10 / 10 | 80 | 40299 | 40219 | 80 | -0.20% | Kessra (-0.20%) | 444 |
| 9 | 10 / 30 | 160 | 47992 | 47832 | 160 | -0.33% | Vexmire (-0.34%) | 544 |

### Early waves — cumulative gold earned by the end of waves 1-3 (mean over 81 boards; max = largest single-board drop)

| Commander | Wave | Mean BEFORE | Mean AFTER | Mean drop | Max drop (board) | Mean bank at wave end AFTER | Boards where AFTER bank < 300 g but BEFORE ≥ 300 g |
|---|---:|---:|---:|---:|---|---:|---:|
| starter | 1 | 494 | 494 | 0 | 0 (—) | 1394 | 0 |
| starter | 2 | 1198 | 1198 | 0 | 0 (—) | 2098 | 0 |
| starter | 3 | 2014 | 2014 | 0 | 0 (—) | 2914 | 0 |
| fleet | 1 | 981 | 981 | 0 | 0 (—) | 406 | 0 |
| fleet | 2 | 2839 | 2839 | 0 | 0 (—) | 1638 | 0 |
| fleet | 3 | 5317 | 5310 | 7 | 120 (Vexmire 9) | 3960 | 0 |
| quest | 1 | 981 | 981 | 0 | 0 (—) | 406 | 0 |
| quest | 2 | 2839 | 2839 | 0 | 0 (—) | 1638 | 0 |
| quest | 3 | 5287 | 5265 | 22 | 120 (Cinder 5) | 3915 | 0 |

Waves 1-3 par time spans 112-564 s across boards.

The fleet and quest commanders bought their harvesters at the same seconds BEFORE and AFTER on every board, so all the gold change is the rare/epic gold itself (knock-on on other tiers = 0).

## Per-planet common / uncommon quotas

`node tools/economy/contract_quota.mjs --per-planet` writes `docs/reports/collective-contracts-per-planet.csv` (81 rows, `Planet,Map_ID,Common,Uncommon`). Same method as the per-map tool: common = one harvester on the richest common field for the map's `Par_Time_Sec`, no enemies, whole board revealed; uncommon = 80 % of what that planet's map seeds; floored to 10 — but per planet instead of the minimum over the nine. The default (no flag) output is unchanged and still reproduces the workbook's per-map values; the per-map minimum of the CSV equals the current workbook quota on every map.

| Map | Common, min–max over planets | Workbook common | Uncommon, min–max | Workbook uncommon |
|---:|---|---:|---|---:|
| 1 | 2020–2300 | 2020 | 270–510 | 270 |
| 2 | 2840–3390 | 2840 | 250–590 | 250 |
| 3 | 2660–3160 | 2660 | 300–570 | 300 |
| 4 | 3400–4260 | 3400 | 300–410 | 300 |
| 5 | 2720–2840 | 2720 | 270–440 | 270 |
| 6 | 7440–8930 | 7440 | 270–540 | 270 |
| 7 | 6680–7380 | 6680 | 330–440 | 330 |
| 8 | 4040–4880 | 4040 | 200–600 | 200 |
| 9 | 4760–5560 | 4760 | 280–520 | 280 |

**Caveat: the existing uncommon method does not count what the game seeds.** `contract_quota.mjs` counts uncommon on the raw forge board. The live board differs in two ways: `resolveResourceTypes(map, 1)` (main.js) resets every premium node to its resource's `Units_Per_Node`, and `initHarvest` drops crystals inside the base dock ring. On **56 of 81** boards the per-planet uncommon quota in the CSV is **larger than all the uncommon the live board seeds** (ratio CSV ÷ live seeding 0.58–1.59, median 1.33), so on those boards the uncommon quota could never fill and uncommon would effectively always sell. The last column of the appendix gives 80 % of the live seeding as the alternative. The current per-map workbook quotas come from the same method and have the same issue. Fix the method (build the board as main.js does) before the per-planet values go into the workbook.

## Caveats

- **No enemies, no defence spending.** Banks are what a harvest-only player holds; a real player spends most of it, and enemies can kill harvesters. The gold *lost* is still exact for any commander who hauls rare/epic, since it is capped by the old quota.
- **Commanders are scripted, not players.** The idle auto-gather player never reaches rare/epic, so loses nothing; a player who sends a truck at the quest crystals loses the full old quota.
- **Mixed loads (existing sim behaviour, found while measuring).** A load is credited wholly at the tier of the *last* crystal pulled (`harvest.js` sets `cargoColor` per pull). Retasking a part-loaded truck from a common field onto a rare/epic field turns its common units into rare/epic. Under AFTER those units are kept and pay nothing, so the change makes mid-load retasks costlier. An earlier run whose quest commander retasked part-loaded trucks showed it: 31 of 81 boards credited more rare/epic gold than the quota (up to 496 gold extra on one board), and Rime map 1 lost 12.9 % of its gold once a 7-second later harvester purchase changed the whole fleet's routing. The reported quest commander only retasks empty trucks.
- **Rounding.** Rare+epic gold paid BEFORE can exceed quota × 4 by up to 3.5 % (e.g. 205–207 gold on a 50-unit quota): `creditDeposit` floors the unit count but pays the fractional cargo's value.
- Faction typing is faction 1 for every planet, as main.js does today ("faction 1 typing for the node markers").
- One seed (7). The harvest loop draws no randomness here, so the seed does not change these numbers.
- The AFTER contract keeps the per-map common/uncommon quotas. The per-planet quotas were not simulated as a third variant.

## Appendix — every planet × map (commander quest)

| Planet | Map | Gold BEFORE | Gold AFTER | Change | Gold lost (rare+epic) | Rare / epic units hauled | Rare+epic kept AFTER | CSV Common / Uncommon | In-game uncommon seeded (80 %, floor 10) |
|---|---:|---:|---:|---:|---:|---|---:|---|---:|
| Verdance | 1 | 15639 | 15434 | -1.31% | 205 | 38 / 116 | 154 | 2100 / 360 | 240 (190) |
| Verdance | 2 | 17793 | 17586 | -1.16% | 207 | 95 / 57 | 152 | 3000 / 250 | 200 (160) |
| Verdance | 3 | 24352 | 24192 | -0.66% | 160 | 100 / 100 | 200 | 3160 / 430 | 270 (210) |
| Verdance | 4 | 29319 | 29279 | -0.14% | 40 | 80 / 160 | 240 | 3880 / 410 | 290 (230) |
| Verdance | 5 | 29983 | 29863 | -0.40% | 120 | 120 / 180 | 300 | 2840 / 270 | 390 (310) |
| Verdance | 6 | 37738 | 37575 | -0.43% | 163 | 116 / 198 | 314 | 7440 / 270 | 240 (190) |
| Verdance | 7 | 45779 | 45739 | -0.09% | 40 | 240 / 140 | 380 | 7380 / 350 | 240 (190) |
| Verdance | 8 | 40426 | 40346 | -0.20% | 80 | 220 / 220 | 440 | 4840 / 380 | 420 (330) |
| Verdance | 9 | 48592 | 48432 | -0.33% | 160 | 260 / 280 | 540 | 5480 / 280 | 375 (300) |
| Florael | 1 | 16743 | 16540 | -1.21% | 203 | 58 / 137 | 195 | 2180 / 510 | 320 (250) |
| Florael | 2 | 19474 | 19269 | -1.05% | 205 | 116 / 38 | 154 | 2840 / 590 | 390 (310) |
| Florael | 3 | 24355 | 24195 | -0.66% | 160 | 40 / 200 | 240 | 3040 / 360 | 270 (210) |
| Florael | 4 | 29089 | 29049 | -0.14% | 40 | 140 / 80 | 220 | 4110 / 380 | 280 (220) |
| Florael | 5 | 29387 | 29267 | -0.41% | 120 | 100 / 200 | 300 | 2840 / 360 | 405 (320) |
| Florael | 6 | 38638 | 38475 | -0.42% | 163 | 236 / 78 | 314 | 8540 / 330 | 270 (210) |
| Florael | 7 | 48026 | 47986 | -0.08% | 40 | 300 / 120 | 420 | 7070 / 440 | 280 (220) |
| Florael | 8 | 40422 | 40342 | -0.20% | 80 | 60 / 400 | 460 | 4760 / 460 | 450 (360) |
| Florael | 9 | 47495 | 47335 | -0.34% | 160 | 320 / 240 | 560 | 5440 / 520 | 555 (440) |
| Ochre | 1 | 16747 | 16543 | -1.22% | 204 | 119 / 77 | 196 | 2020 / 460 | 290 (230) |
| Ochre | 2 | 19281 | 19075 | -1.07% | 206 | 116 / 138 | 254 | 3390 / 330 | 250 (200) |
| Ochre | 3 | 25479 | 25319 | -0.63% | 160 | 80 / 160 | 240 | 3160 / 480 | 320 (250) |
| Ochre | 4 | 28483 | 28443 | -0.14% | 40 | 40 / 220 | 260 | 4260 / 400 | 260 (200) |
| Ochre | 5 | 29987 | 29867 | -0.40% | 120 | 180 / 120 | 300 | 2840 / 330 | 405 (320) |
| Ochre | 6 | 38893 | 38729 | -0.42% | 164 | 176 / 175 | 351 | 8610 / 540 | 360 (280) |
| Ochre | 7 | 47769 | 47729 | -0.08% | 40 | 220 / 160 | 380 | 7230 / 400 | 310 (240) |
| Ochre | 8 | 40424 | 40344 | -0.20% | 80 | 300 / 140 | 440 | 4840 / 600 | 585 (460) |
| Ochre | 9 | 47691 | 47531 | -0.34% | 160 | 200 / 340 | 540 | 5520 / 460 | 510 (400) |
| Kessra | 1 | 16536 | 16331 | -1.24% | 205 | 95 / 97 | 192 | 2260 / 410 | 270 (210) |
| Kessra | 2 | 19474 | 19269 | -1.05% | 205 | 77 / 176 | 253 | 3270 / 410 | 270 (210) |
| Kessra | 3 | 25525 | 25365 | -0.63% | 160 | 140 / 80 | 220 | 2850 / 570 | 360 (280) |
| Kessra | 4 | 27804 | 27764 | -0.14% | 40 | 180 / 40 | 220 | 4070 / 300 | 240 (190) |
| Kessra | 5 | 29987 | 29867 | -0.40% | 120 | 120 / 140 | 260 | 2760 / 330 | 360 (280) |
| Kessra | 6 | 38866 | 38703 | -0.42% | 163 | 216 / 137 | 353 | 8930 / 330 | 280 (220) |
| Kessra | 7 | 49013 | 48973 | -0.08% | 40 | 120 / 260 | 380 | 7100 / 410 | 330 (260) |
| Kessra | 8 | 39717 | 39637 | -0.20% | 80 | 240 / 200 | 440 | 4880 / 300 | 360 (280) |
| Kessra | 9 | 48590 | 48430 | -0.33% | 160 | 100 / 420 | 520 | 5440 / 380 | 450 (360) |
| Rime | 1 | 16538 | 16333 | -1.24% | 205 | 77 / 78 | 155 | 2020 / 410 | 270 (210) |
| Rime | 2 | 19479 | 19275 | -1.05% | 204 | 118 / 78 | 196 | 2920 / 440 | 310 (240) |
| Rime | 3 | 23169 | 23009 | -0.69% | 160 | 120 / 160 | 280 | 2660 / 360 | 230 (180) |
| Rime | 4 | 23926 | 23886 | -0.17% | 40 | 80 / 140 | 220 | 3400 / 380 | 260 (200) |
| Rime | 5 | 29991 | 29871 | -0.40% | 120 | 120 / 180 | 300 | 2800 / 380 | 450 (360) |
| Rime | 6 | 37408 | 37246 | -0.43% | 162 | 255 / 138 | 393 | 8540 / 360 | 260 (200) |
| Rime | 7 | 44495 | 44455 | -0.09% | 40 | 180 / 220 | 400 | 6680 / 330 | 260 (200) |
| Rime | 8 | 40433 | 40353 | -0.20% | 80 | 260 / 180 | 440 | 4040 / 360 | 405 (320) |
| Rime | 9 | 48093 | 47933 | -0.33% | 160 | 240 / 300 | 540 | 4760 / 410 | 465 (370) |
| Cinder | 1 | 15936 | 15731 | -1.29% | 205 | 38 / 58 | 96 | 2300 / 360 | 250 (200) |
| Cinder | 2 | 19506 | 19302 | -1.05% | 204 | 194 / 78 | 272 | 3270 / 430 | 300 (240) |
| Cinder | 3 | 23486 | 23326 | -0.68% | 160 | 100 / 120 | 220 | 3050 / 330 | 240 (190) |
| Cinder | 4 | 28454 | 28414 | -0.14% | 40 | 100 / 160 | 260 | 4110 / 380 | 260 (200) |
| Cinder | 5 | 29987 | 29867 | -0.40% | 120 | 240 / 60 | 300 | 2720 / 440 | 465 (370) |
| Cinder | 6 | 38833 | 38670 | -0.42% | 163 | 156 / 156 | 312 | 8930 / 430 | 310 (240) |
| Cinder | 7 | 46609 | 46569 | -0.09% | 40 | 200 / 180 | 380 | 7310 / 360 | 300 (240) |
| Cinder | 8 | 40406 | 40326 | -0.20% | 80 | 300 / 140 | 440 | 4840 / 320 | 345 (270) |
| Cinder | 9 | 48393 | 48233 | -0.33% | 160 | 340 / 200 | 540 | 5560 / 280 | 405 (320) |
| Lumen | 1 | 16756 | 16550 | -1.23% | 206 | 117 / 97 | 214 | 2260 / 460 | 300 (240) |
| Lumen | 2 | 19424 | 19220 | -1.05% | 204 | 136 / 177 | 313 | 3230 / 360 | 260 (200) |
| Lumen | 3 | 22584 | 22424 | -0.71% | 160 | 140 / 60 | 200 | 2850 / 300 | 210 (160) |
| Lumen | 4 | 29068 | 29028 | -0.14% | 40 | 140 / 200 | 340 | 4110 / 410 | 280 (220) |
| Lumen | 5 | 29992 | 29872 | -0.40% | 120 | 120 / 200 | 320 | 2760 / 410 | 450 (360) |
| Lumen | 6 | 38750 | 38585 | -0.43% | 165 | 137 / 215 | 352 | 8770 / 440 | 310 (240) |
| Lumen | 7 | 45920 | 45880 | -0.09% | 40 | 140 / 280 | 420 | 7350 / 440 | 300 (240) |
| Lumen | 8 | 40425 | 40345 | -0.20% | 80 | 180 / 260 | 440 | 4880 / 380 | 405 (320) |
| Lumen | 9 | 48092 | 47932 | -0.33% | 160 | 260 / 280 | 540 | 5560 / 410 | 435 (340) |
| Xenthe | 1 | 15035 | 14829 | -1.37% | 206 | 138 / 57 | 195 | 2180 / 330 | 220 (170) |
| Xenthe | 2 | 19533 | 19329 | -1.04% | 204 | 118 / 156 | 274 | 2880 / 410 | 270 (210) |
| Xenthe | 3 | 25250 | 25090 | -0.63% | 160 | 120 / 120 | 240 | 3040 / 430 | 300 (240) |
| Xenthe | 4 | 27278 | 27238 | -0.15% | 40 | 180 / 60 | 240 | 3600 / 320 | 220 (170) |
| Xenthe | 5 | 29991 | 29871 | -0.40% | 120 | 180 / 220 | 400 | 2800 / 360 | 420 (330) |
| Xenthe | 6 | 38615 | 38451 | -0.42% | 164 | 176 / 156 | 332 | 8810 / 360 | 270 (210) |
| Xenthe | 7 | 48121 | 48081 | -0.08% | 40 | 240 / 140 | 380 | 7020 / 430 | 290 (230) |
| Xenthe | 8 | 40414 | 40334 | -0.20% | 80 | 220 / 240 | 460 | 4880 / 460 | 495 (390) |
| Xenthe | 9 | 48391 | 48231 | -0.33% | 160 | 160 / 380 | 540 | 5480 / 410 | 435 (340) |
| Vexmire | 1 | 14443 | 14240 | -1.41% | 203 | 158 / 58 | 216 | 2060 / 270 | 200 (160) |
| Vexmire | 2 | 18090 | 17883 | -1.14% | 207 | 116 / 58 | 174 | 3080 / 300 | 210 (160) |
| Vexmire | 3 | 23476 | 23316 | -0.68% | 160 | 80 / 120 | 200 | 3160 / 360 | 240 (190) |
| Vexmire | 4 | 28453 | 28413 | -0.14% | 40 | 140 / 100 | 240 | 4040 / 330 | 260 (200) |
| Vexmire | 5 | 29980 | 29860 | -0.40% | 120 | 160 / 140 | 300 | 2800 / 280 | 330 (260) |
| Vexmire | 6 | 38835 | 38671 | -0.42% | 164 | 157 / 176 | 333 | 8460 / 360 | 280 (220) |
| Vexmire | 7 | 46262 | 46222 | -0.09% | 40 | 100 / 280 | 380 | 6790 / 330 | 250 (200) |
| Vexmire | 8 | 40026 | 39946 | -0.20% | 80 | 180 / 260 | 440 | 4880 / 200 | 345 (270) |
| Vexmire | 9 | 46593 | 46433 | -0.34% | 160 | 420 / 160 | 580 | 5560 / 280 | 375 (300) |
