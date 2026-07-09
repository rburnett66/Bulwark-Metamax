## Sheet: Overview

| BULWARK — Balance Data Model  (v1, even-baseline) |
| --- |
| Companion to the BULWARK GDD. This is the canonical, data-driven stat source the design calls for (no hardcoded balance in game code). |
|  |
| BALANCE PHILOSOPHY — 'as evenly as possible, for now' |
| Every base unit spends the SAME 100-point power budget, distributed differently across HP / DPS / Range / Speed / Utility. |
| So a Tank and an Artillery piece differ in shape, not in total strength. Cost is derived from power (flat gold-per-power), so equal power = equal price. |
| Faction modifiers are mild, net-neutral tilts (avg multiplier ~1.00) — flavor, not advantage. See Balance_Check for the audit. |
| Damage TYPES add matchup texture (rock-paper-scissors) on top of even raw power. True prices are resolved later by the automated sim (GDD §17). |
|  |
| HOW TO TUNE |
| Change any blue input on Assumptions / Archetypes / Faction_Mods / Effectiveness and every derived stat recalculates. Do not edit black formula cells. |
|  |
| COLOR LEGEND |
| Blue = input you can change   \|   Black = formula   \|   Green = pulled from another sheet |
|  |
| SHEETS |
| Assumptions .......... global tuning constants (conversion rates, upgrade + cost curves) |
| Factions ............. 9 factions, tropes, counter graph |
| Archetypes ........... 8 unit shapes and their 100-pt power budgets -> base stats |
| Faction_Mods ......... per-faction stat tilts, signature damage, armor/domain themes |
| DamageTypes .......... the 6 damage types and their status effects |
| Effectiveness ........ damage type x armor class multiplier matrix (fire/poison/etc.) |
| Units ................ full 72-unit roster: all attributes, T1-T3 stats, cost, effective DPS |
| Structures ........... 11 fort buildings + defensive emplacements, with T1-T3 upgrades |
| Vertical_Slice ....... the locked units + towers for the primary benchmark (GDD §19) |
| Balance_Check ........ audit: power spread, per-faction averages (proves 'even') |

## Sheet: Assumptions

| Parameter | Value | Notes |
| --- | --- | --- |
| HP_per_point | 10 | 1 HP budget point = 10 hit points |
| DPS_per_point | 1.5 | 1 DPS point = 1.5 damage/sec (raw, pre-type) |
| Range_per_point | 0.25 | 1 range point = 0.25 tiles |
| Speed_per_point | 0.08 | 1 speed point = 0.08 tiles/sec |
| Vision_base | 4 | baseline vision in tiles |
| Vision_per_util_point | 0.1 | each utility point adds 0.1 tiles vision |
| Cost_per_power_gold | 3 | gold cost = power x this (even: equal power = equal cost) |
| Upgrade_HP_x_T2 | 1.6 | HP multiplier at tier 2 |
| Upgrade_HP_x_T3 | 2.4 | HP multiplier at tier 3 |
| Upgrade_DPS_x_T2 | 1.55 | DPS multiplier at tier 2 |
| Upgrade_DPS_x_T3 | 2.3 | DPS multiplier at tier 3 |
| Upgrade_Cost_x_T2 | 2.5 | cumulative unit value at tier 2 |
| Upgrade_Cost_x_T3 | 5 | cumulative unit value at tier 3 |

## Sheet: Factions

| # | Faction | Trope | Beats (counter) | Signature Damage | Battlefield identity |
| --- | --- | --- | --- | --- | --- |
| 1 | Ground / Powder | Nationalistic | Greenies (Chem) | Kinetic | Infantry & armor; flags & honor |
| 2 | Air | Manga (ace pilots) | Ground / Powder | Kinetic | Air superiority; weak on the ground |
| 3 | High Tech | Capitalist (mega-corp) | Air | Electric | Precision, shields, expensive |
| 4 | Artillery | Military (siege) | High Tech | Concussion | Range & arc; poor up close |
| 5 | Water | Fantasy RPG (sea tribes) | Artillery | Frost | Swimmers/floaters; coastal |
| 6 | Arcane / Energy | Fantasy theocracy / religion | Water | Fire | Energy weapons, shields, no ammo economy |
| 7 | Space Tech | Sci-Fi (federation) | Arcane / Energy | Electric | Orbital tech; strong vision; ignores some fog |
| 8 | Dark Energy | Social realignment (cult) | Space Tech | Poison | DoT, corruption, night-strong |
| 9 | Greenies (Chem) | Socialist (hive collective) | Dark Energy | Poison | Swarms, chem clouds, area denial |

## Sheet: Archetypes

| Shape | Role | Default Domain | Can Target | Targets | HP_pts | DPS_pts | Range_pts | Speed_pts | Util_pts | Total_pts | Base_HP | Base_DPS | Base_Range | Base_Speed | Base_Vision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Troops | Skirmisher | Walker | Ground | Base | 20 | 30 | 10 | 25 | 15 | 100 | 200 | 45 | 2.5 | 2 | 5.5 |
| Trucks | Support | Walker | Ground | Base | 25 | 10 | 5 | 40 | 20 | 100 | 250 | 15 | 1.25 | 3.2 | 6 |
| Tanks | Bruiser | Walker | Ground | Base | 40 | 30 | 15 | 10 | 5 | 100 | 400 | 45 | 3.75 | 0.8 | 4.5 |
| Artillery | Siege | Walker | Ground | Structures | 15 | 40 | 40 | 5 | 0 | 100 | 150 | 60 | 10 | 0.4 | 4 |
| Heavy Tanks | Juggernaut | Walker | Ground | Base | 55 | 25 | 12 | 5 | 3 | 100 | 550 | 37.5 | 3 | 0.4 | 4.3 |
| Copters | Harasser | Flyer | Both | Base | 20 | 30 | 20 | 25 | 5 | 100 | 200 | 45 | 5 | 2 | 4.5 |
| Planes | Striker | Flyer | Ground | Base | 15 | 35 | 25 | 25 | 0 | 100 | 150 | 52.5 | 6.25 | 2 | 4 |
| Missiles | Guided AA | Flyer | Both | Base | 10 | 45 | 35 | 10 | 0 | 100 | 100 | 67.5 | 8.75 | 0.8 | 4 |

## Sheet: Faction_Mods

| Faction | HP_x | DPS_x | Range_x | Speed_x | Signature Damage | Armor Theme | Domain Theme | Avg_x (≈1.00) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ground / Powder | 1.1 | 1 | 1 | 0.92 | Kinetic | Machinery | Ground | 1.005 | Tanky, deliberate |
| Air | 0.85 | 1.05 | 0.98 | 1.2 | Kinetic | Aircraft | Air | 1.02 | Fast, fragile |
| High Tech | 0.95 | 1.05 | 1.12 | 0.9 | Electric | Machinery | Ground | 1.005 | Long-range, precise |
| Artillery | 0.92 | 1.1 | 1.25 | 0.78 | Concussion | Machinery | Ground | 1.0125 | Siege reach, slow |
| Water | 1.12 | 0.95 | 0.98 | 0.98 | Frost | Organic | Water | 1.0075 | Durable sea life |
| Arcane / Energy | 1 | 1.08 | 1.02 | 0.92 | Fire | Energy | Ground | 1.005 | Shielded casters |
| Space Tech | 0.96 | 0.98 | 1.1 | 1 | Electric | Machinery | Ground / Air | 1.01 | High vision & range |
| Dark Energy | 0.9 | 1.12 | 1 | 1.02 | Poison | Energy | Ground | 1.01 | Corrosive DoT |
| Greenies (Chem) | 0.82 | 0.98 | 0.95 | 1.05 | Poison | Organic | Ground | 0.95 | Swarm; cheap, many |

## Sheet: DamageTypes

| Damage Type | Status Effect | DoT | Slow | Chain / Splash | Design note |
| --- | --- | --- | --- | --- | --- |
| Kinetic | — | No | No | No | Baseline physical; even vs everything. |
| Fire | Burn | Yes | No | No | Damage-over-time; strong vs organics & structures. |
| Poison | Toxin | Yes | No | No | Heavy DoT vs organics; machines/energy immune. |
| Concussion | Stagger | No | No | No | Hurts machinery, not troops; brief machine stagger. |
| Electric | Overload | No | No | Chain | Wrecks machinery; chains to nearby; disables machines. |
| Frost | Chill | No | Yes | No | Slows ALL except air units; modest direct damage. |

## Sheet: Effectiveness

| Damage Type | Organic | Machinery | Aircraft | Structure | Energy |
| --- | --- | --- | --- | --- | --- |
| Kinetic | 1 | 1 | 1 | 1 | 1.1 |
| Fire | 1.3 | 0.8 | 0.8 | 1.1 | 0.8 |
| Poison | 1.8 | 0.1 | 0.1 | 0 | 0 |
| Concussion | 0.4 | 1.7 | 0.9 | 1 | 0.4 |
| Electric | 0.5 | 1.8 | 1.2 | 0.5 | 0.6 |
| Frost | 0.6 | 0.6 | 0.5 | 0.5 | 0.9 |
|  |  |  |  |  |  |
| Note: 1.0 = normal. Frost deals its listed damage to Aircraft but applies NO slow to air (design rule). Poison/Frost trade raw multiplier for status utility. |  |  |  |  |  |

## Sheet: Units

| UnitID | Faction | Shape | Role | Domain | Armor Class | Damage Type | Can Target | Targets | AoE r | Status | Radar-Detect | Sees Ground | HP T1 | HP T2 | HP T3 | DPS T1 | DPS T2 | DPS T3 | Range | Speed | Vision | Power | Cost T1 | Cost T2 | Cost T3 | EffDPS vs Org | EffDPS vs Mach | EffDPS vs Air |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GND-Troops | Ground / Powder | Troops | Skirmisher | Walker | Organic | Kinetic | Ground | Base | 0 | — | No | No | 220 | 352 | 528 | 45 | 69.75 | 103.5 | 2.5 | 1.84 | 5.5 | 100 | 300 | 750 | 1500 | 45 | 45 | 0 |
| GND-Trucks | Ground / Powder | Trucks | Support | Walker | Machinery | Kinetic | Ground | Base | 0 | — | No | No | 275 | 440 | 660 | 15 | 23.25 | 34.5 | 1.25 | 2.944 | 6 | 99.3 | 297.9 | 744.75 | 1489.5 | 15 | 15 | 0 |
| GND-Tanks | Ground / Powder | Tanks | Bruiser | Walker | Machinery | Kinetic | Ground | Base | 0 | — | No | No | 440 | 704 | 1056 | 45 | 69.75 | 103.5 | 3.75 | 0.736 | 4.5 | 103.2 | 309.6 | 774 | 1548 | 45 | 45 | 0 |
| GND-Artillery | Ground / Powder | Artillery | Siege | Walker | Machinery | Concussion | Ground | Structures | 2 | Stagger | No | No | 165 | 264 | 396 | 60 | 93 | 138 | 10 | 0.368 | 4 | 101.1 | 303.3 | 758.25 | 1516.5 | 24 | 102 | 0 |
| GND-HeavyTanks | Ground / Powder | Heavy Tanks | Juggernaut | Walker | Machinery | Kinetic | Ground | Base | 0 | — | No | No | 605 | 968 | 1452 | 37.5 | 58.125 | 86.25 | 3 | 0.368 | 4.3 | 105.1 | 315.3 | 788.25 | 1576.5 | 37.5 | 37.5 | 0 |
| GND-Copters | Ground / Powder | Copters | Harasser | Flyer | Aircraft | Kinetic | Both | Base | 0 | — | Yes | Yes | 220 | 352 | 528 | 45 | 69.75 | 103.5 | 5 | 1.84 | 4.5 | 100 | 300 | 750 | 1500 | 45 | 45 | 45 |
| GND-Planes | Ground / Powder | Planes | Striker | Flyer | Aircraft | Kinetic | Ground | Base | 1 | — | Yes | Yes | 165 | 264 | 396 | 52.5 | 81.375 | 120.75 | 6.25 | 1.84 | 4 | 99.5 | 298.5 | 746.25 | 1492.5 | 52.5 | 52.5 | 0 |
| GND-Missiles | Ground / Powder | Missiles | Guided AA | Flyer | Aircraft | Kinetic | Both | Base | 1 | — | Yes | Yes | 110 | 176 | 264 | 67.5 | 104.625 | 155.25 | 8.75 | 0.736 | 4 | 100.2 | 300.6 | 751.5 | 1503 | 67.5 | 67.5 | 67.5 |
| AIR-Troops | Air | Troops | Skirmisher | Walker | Organic | Kinetic | Ground | Base | 0 | — | No | No | 170 | 272 | 408 | 47.25 | 73.2375 | 108.675 | 2.45 | 2.4 | 5.5 | 103.3 | 309.9 | 774.75 | 1549.5 | 47.25 | 47.25 | 0 |
| AIR-Trucks | Air | Trucks | Support | Walker | Machinery | Kinetic | Ground | Base | 0 | — | No | No | 212.5 | 340 | 510 | 15.75 | 24.4125 | 36.225 | 1.225 | 3.84 | 6 | 104.65 | 313.95 | 784.875 | 1569.75 | 15.75 | 15.75 | 0 |
| AIR-Tanks | Air | Tanks | Bruiser | Walker | Machinery | Kinetic | Ground | Base | 0 | — | No | No | 340 | 544 | 816 | 47.25 | 73.2375 | 108.675 | 3.675 | 0.96 | 4.5 | 97.2 | 291.6 | 729 | 1458 | 47.25 | 47.25 | 0 |
| AIR-Artillery | Air | Artillery | Siege | Walker | Machinery | Concussion | Ground | Structures | 2 | Stagger | No | No | 127.5 | 204 | 306 | 63 | 97.65 | 144.9 | 9.8 | 0.48 | 4 | 99.95 | 299.85 | 749.625 | 1499.25 | 25.2 | 107.1 | 0 |
| AIR-HeavyTanks | Air | Heavy Tanks | Juggernaut | Walker | Machinery | Kinetic | Ground | Base | 0 | — | No | No | 467.5 | 748 | 1122 | 39.375 | 61.03125 | 90.5625 | 2.94 | 0.48 | 4.3 | 93.76 | 281.28 | 703.2 | 1406.4 | 39.375 | 39.375 | 0 |
| AIR-Copters | Air | Copters | Harasser | Flyer | Aircraft | Kinetic | Both | Base | 0 | — | Yes | Yes | 170 | 272 | 408 | 47.25 | 73.2375 | 108.675 | 4.9 | 2.4 | 4.5 | 103.1 | 309.3 | 773.25 | 1546.5 | 47.25 | 47.25 | 47.25 |
| AIR-Planes | Air | Planes | Striker | Flyer | Aircraft | Kinetic | Ground | Base | 1 | — | Yes | Yes | 127.5 | 204 | 306 | 55.125 | 85.44375 | 126.7875 | 6.125 | 2.4 | 4 | 104 | 312 | 780 | 1560 | 55.125 | 55.125 | 0 |
| AIR-Missiles | Air | Missiles | Guided AA | Flyer | Aircraft | Kinetic | Both | Base | 1 | — | Yes | Yes | 85 | 136 | 204 | 70.875 | 109.85625 | 163.0125 | 8.575 | 0.96 | 4 | 102.05 | 306.15 | 765.375 | 1530.75 | 70.875 | 70.875 | 70.875 |
| HTC-Troops | High Tech | Troops | Skirmisher | Walker | Organic | Electric | Ground | Base | 0 | Overload | No | No | 190 | 304 | 456 | 47.25 | 73.2375 | 108.675 | 2.8 | 1.8 | 5.5 | 99.2 | 297.6 | 744 | 1488 | 23.625 | 85.05 | 0 |
| HTC-Trucks | High Tech | Trucks | Support | Walker | Machinery | Electric | Ground | Base | 0 | Overload | No | No | 237.5 | 380 | 570 | 15.75 | 24.4125 | 36.225 | 1.4 | 2.88 | 6 | 95.85 | 287.55 | 718.875 | 1437.75 | 7.875 | 28.35 | 0 |
| HTC-Tanks | High Tech | Tanks | Bruiser | Walker | Machinery | Electric | Ground | Base | 0 | Overload | No | No | 380 | 608 | 912 | 47.25 | 73.2375 | 108.675 | 4.2 | 0.72 | 4.5 | 100.3 | 300.9 | 752.25 | 1504.5 | 23.625 | 85.05 | 0 |
| HTC-Artillery | High Tech | Artillery | Siege | Walker | Machinery | Concussion | Ground | Structures | 2 | Stagger | No | No | 142.5 | 228 | 342 | 63 | 97.65 | 144.9 | 11.2 | 0.36 | 4 | 105.55 | 316.65 | 791.625 | 1583.25 | 25.2 | 107.1 | 0 |
| HTC-HeavyTanks | High Tech | Heavy Tanks | Juggernaut | Walker | Machinery | Electric | Ground | Base | 0 | Overload | No | No | 522.5 | 836 | 1254 | 39.375 | 61.03125 | 90.5625 | 3.36 | 0.36 | 4.3 | 99.44 | 298.32 | 745.8 | 1491.6 | 19.6875 | 70.875 | 0 |
| HTC-Copters | High Tech | Copters | Harasser | Flyer | Aircraft | Electric | Both | Base | 0 | Overload | Yes | Yes | 190 | 304 | 456 | 47.25 | 73.2375 | 108.675 | 5.6 | 1.8 | 4.5 | 100.4 | 301.2 | 753 | 1506 | 23.625 | 85.05 | 56.7 |
| HTC-Planes | High Tech | Planes | Striker | Flyer | Aircraft | Electric | Ground | Base | 1 | Overload | Yes | Yes | 142.5 | 228 | 342 | 55.125 | 85.44375 | 126.7875 | 7 | 1.8 | 4 | 101.5 | 304.5 | 761.25 | 1522.5 | 27.5625 | 99.225 | 0 |
| HTC-Missiles | High Tech | Missiles | Guided AA | Flyer | Aircraft | Electric | Both | Base | 1 | Overload | Yes | Yes | 95 | 152 | 228 | 70.875 | 109.85625 | 163.0125 | 9.8 | 0.72 | 4 | 104.95 | 314.85 | 787.125 | 1574.25 | 35.4375 | 127.575 | 85.05 |
| ART-Troops | Artillery | Troops | Skirmisher | Walker | Organic | Concussion | Ground | Base | 0 | Stagger | No | No | 184 | 294.4 | 441.6 | 49.5 | 76.725 | 113.85 | 3.125 | 1.56 | 5.5 | 98.4 | 295.2 | 738 | 1476 | 19.8 | 84.15 | 0 |
| ART-Trucks | Artillery | Trucks | Support | Walker | Machinery | Concussion | Ground | Base | 0 | Stagger | No | No | 230 | 368 | 552 | 16.5 | 25.575 | 37.95 | 1.5625 | 2.496 | 6 | 91.45 | 274.35 | 685.875 | 1371.75 | 6.6 | 28.05 | 0 |
| ART-Tanks | Artillery | Tanks | Bruiser | Walker | Machinery | Concussion | Ground | Base | 0 | Stagger | No | No | 368 | 588.8 | 883.2 | 49.5 | 76.725 | 113.85 | 4.6875 | 0.624 | 4.5 | 101.35 | 304.05 | 760.125 | 1520.25 | 19.8 | 84.15 | 0 |
| ART-Artillery | Artillery | Artillery | Siege | Walker | Machinery | Concussion | Ground | Structures | 2 | Stagger | No | No | 138 | 220.8 | 331.2 | 66 | 102.3 | 151.8 | 12.5 | 0.312 | 4 | 111.7 | 335.1 | 837.75 | 1675.5 | 26.4 | 112.2 | 0 |
| ART-HeavyTanks | Artillery | Heavy Tanks | Juggernaut | Walker | Machinery | Concussion | Ground | Base | 0 | Stagger | No | No | 506 | 809.6 | 1214.4 | 41.25 | 63.9375 | 94.875 | 3.75 | 0.312 | 4.3 | 100 | 300 | 750 | 1500 | 16.5 | 70.125 | 0 |
| ART-Copters | Artillery | Copters | Harasser | Flyer | Aircraft | Concussion | Both | Base | 0 | Stagger | Yes | Yes | 184 | 294.4 | 441.6 | 49.5 | 76.725 | 113.85 | 6.25 | 1.56 | 4.5 | 100.9 | 302.7 | 756.75 | 1513.5 | 19.8 | 84.15 | 44.55 |
| ART-Planes | Artillery | Planes | Striker | Flyer | Aircraft | Concussion | Ground | Base | 1 | Stagger | Yes | Yes | 138 | 220.8 | 331.2 | 57.75 | 89.5125 | 132.825 | 7.8125 | 1.56 | 4 | 103.05 | 309.15 | 772.875 | 1545.75 | 23.1 | 98.175 | 0 |
| ART-Missiles | Artillery | Missiles | Guided AA | Flyer | Aircraft | Concussion | Both | Base | 1 | Stagger | Yes | Yes | 92 | 147.2 | 220.8 | 74.25 | 115.0875 | 170.775 | 10.9375 | 0.624 | 4 | 110.25 | 330.75 | 826.875 | 1653.75 | 29.7 | 126.225 | 66.825 |
| WTR-Troops | Water | Troops | Skirmisher | Swimmer | Organic | Frost | Ground | Base | 0 | Chill | No | No | 224 | 358.4 | 537.6 | 42.75 | 66.2625 | 98.325 | 2.45 | 1.96 | 5.5 | 100.2 | 300.6 | 751.5 | 1503 | 25.65 | 25.65 | 0 |
| WTR-Trucks | Water | Trucks | Support | Floater | Organic | Frost | Ground | Base | 0 | Chill | No | No | 280 | 448 | 672 | 14.25 | 22.0875 | 32.775 | 1.225 | 3.136 | 6 | 101.6 | 304.8 | 762 | 1524 | 8.55 | 8.55 | 0 |
| WTR-Tanks | Water | Tanks | Bruiser | Swimmer | Organic | Frost | Ground | Base | 0 | Chill | No | No | 448 | 716.8 | 1075.2 | 42.75 | 66.2625 | 98.325 | 3.675 | 0.784 | 4.5 | 102.8 | 308.4 | 771 | 1542 | 25.65 | 25.65 | 0 |
| WTR-Artillery | Water | Artillery | Siege | Floater | Organic | Concussion | Ground | Structures | 2 | Stagger | No | No | 168 | 268.8 | 403.2 | 57 | 88.35 | 131.1 | 9.8 | 0.392 | 4 | 98.9 | 296.7 | 741.75 | 1483.5 | 22.8 | 96.9 | 0 |
| WTR-HeavyTanks | Water | Heavy Tanks | Juggernaut | Swimmer | Organic | Frost | Ground | Base | 0 | Chill | No | No | 616 | 985.6 | 1478.4 | 35.625 | 55.21875 | 81.9375 | 2.94 | 0.392 | 4.3 | 105.01 | 315.03 | 787.575 | 1575.15 | 21.375 | 21.375 | 0 |
| WTR-Copters | Water | Copters | Harasser | Flyer | Aircraft | Frost | Both | Base | 0 | Chill | Yes | Yes | 224 | 358.4 | 537.6 | 42.75 | 66.2625 | 98.325 | 4.9 | 1.96 | 4.5 | 100 | 300 | 750 | 1500 | 25.65 | 25.65 | 21.375 |
| WTR-Planes | Water | Planes | Striker | Flyer | Aircraft | Frost | Ground | Base | 1 | Chill | Yes | Yes | 168 | 268.8 | 403.2 | 49.875 | 77.30625 | 114.7125 | 6.125 | 1.96 | 4 | 99.05 | 297.15 | 742.875 | 1485.75 | 29.925 | 29.925 | 0 |
| WTR-Missiles | Water | Missiles | Guided AA | Flyer | Aircraft | Frost | Both | Base | 1 | Chill | Yes | Yes | 112 | 179.2 | 268.8 | 64.125 | 99.39375 | 147.4875 | 8.575 | 0.784 | 4 | 98.05 | 294.15 | 735.375 | 1470.75 | 38.475 | 38.475 | 32.0625 |
| ARC-Troops | Arcane / Energy | Troops | Skirmisher | Walker | Energy | Fire | Ground | Base | 0 | Burn | No | No | 200 | 320 | 480 | 48.6 | 75.33 | 111.78 | 2.55 | 1.84 | 5.5 | 100.6 | 301.8 | 754.5 | 1509 | 63.18 | 38.88 | 0 |
| ARC-Trucks | Arcane / Energy | Trucks | Support | Walker | Energy | Fire | Ground | Base | 0 | Burn | No | No | 250 | 400 | 600 | 16.2 | 25.11 | 37.26 | 1.275 | 2.944 | 6 | 97.7 | 293.1 | 732.75 | 1465.5 | 21.06 | 12.96 | 0 |
| ARC-Tanks | Arcane / Energy | Tanks | Bruiser | Walker | Energy | Fire | Ground | Base | 0 | Burn | No | No | 400 | 640 | 960 | 48.6 | 75.33 | 111.78 | 3.825 | 0.736 | 4.5 | 101.9 | 305.7 | 764.25 | 1528.5 | 63.18 | 38.88 | 0 |
| ARC-Artillery | Arcane / Energy | Artillery | Siege | Walker | Energy | Concussion | Ground | Structures | 2 | Stagger | No | No | 150 | 240 | 360 | 64.8 | 100.44 | 149.04 | 10.2 | 0.368 | 4 | 103.6 | 310.8 | 777 | 1554 | 25.92 | 110.16 | 0 |
| ARC-HeavyTanks | Arcane / Energy | Heavy Tanks | Juggernaut | Walker | Energy | Fire | Ground | Base | 0 | Burn | No | No | 550 | 880 | 1320 | 40.5 | 62.775 | 93.15 | 3.06 | 0.368 | 4.3 | 101.84 | 305.52 | 763.8 | 1527.6 | 52.65 | 32.4 | 0 |
| ARC-Copters | Arcane / Energy | Copters | Harasser | Flyer | Aircraft | Fire | Both | Base | 0 | Burn | Yes | Yes | 200 | 320 | 480 | 48.6 | 75.33 | 111.78 | 5.1 | 1.84 | 4.5 | 100.8 | 302.4 | 756 | 1512 | 63.18 | 38.88 | 38.88 |
| ARC-Planes | Arcane / Energy | Planes | Striker | Flyer | Aircraft | Fire | Ground | Base | 1 | Burn | Yes | Yes | 150 | 240 | 360 | 56.7 | 87.885 | 130.41 | 6.375 | 1.84 | 4 | 101.3 | 303.9 | 759.75 | 1519.5 | 73.71 | 45.36 | 0 |
| ARC-Missiles | Arcane / Energy | Missiles | Guided AA | Flyer | Aircraft | Fire | Both | Base | 1 | Burn | Yes | Yes | 100 | 160 | 240 | 72.9 | 112.995 | 167.67 | 8.925 | 0.736 | 4 | 103.5 | 310.5 | 776.25 | 1552.5 | 94.77 | 58.32 | 58.32 |
| SPC-Troops | Space Tech | Troops | Skirmisher | Walker | Organic | Electric | Ground | Base | 0 | Overload | No | No | 192 | 307.2 | 460.8 | 44.1 | 68.355 | 101.43 | 2.75 | 2 | 5.5 | 99.6 | 298.8 | 747 | 1494 | 22.05 | 79.38 | 0 |
| SPC-Trucks | Space Tech | Trucks | Support | Walker | Machinery | Electric | Ground | Base | 0 | Overload | No | No | 240 | 384 | 576 | 14.7 | 22.785 | 33.81 | 1.375 | 3.2 | 6 | 99.3 | 297.9 | 744.75 | 1489.5 | 7.35 | 26.46 | 0 |
| SPC-Tanks | Space Tech | Tanks | Bruiser | Walker | Machinery | Electric | Ground | Base | 0 | Overload | No | No | 384 | 614.4 | 921.6 | 44.1 | 68.355 | 101.43 | 4.125 | 0.8 | 4.5 | 99.3 | 297.9 | 744.75 | 1489.5 | 22.05 | 79.38 | 0 |
| SPC-Artillery | Space Tech | Artillery | Siege | Walker | Machinery | Concussion | Ground | Structures | 2 | Stagger | No | No | 144 | 230.4 | 345.6 | 58.8 | 91.14 | 135.24 | 11 | 0.4 | 4 | 102.6 | 307.8 | 769.5 | 1539 | 23.52 | 99.96 | 0 |
| SPC-HeavyTanks | Space Tech | Heavy Tanks | Juggernaut | Walker | Machinery | Electric | Ground | Base | 0 | Overload | No | No | 528 | 844.8 | 1267.2 | 36.75 | 56.9625 | 84.525 | 3.3 | 0.4 | 4.3 | 98.5 | 295.5 | 738.75 | 1477.5 | 18.375 | 66.15 | 0 |
| SPC-Copters | Space Tech | Copters | Harasser | Flyer | Aircraft | Electric | Both | Base | 0 | Overload | Yes | Yes | 192 | 307.2 | 460.8 | 44.1 | 68.355 | 101.43 | 5.5 | 2 | 4.5 | 100.6 | 301.8 | 754.5 | 1509 | 22.05 | 79.38 | 52.92 |
| SPC-Planes | Space Tech | Planes | Striker | Flyer | Aircraft | Electric | Ground | Base | 1 | Overload | Yes | Yes | 144 | 230.4 | 345.6 | 51.45 | 79.7475 | 118.335 | 6.875 | 2 | 4 | 101.2 | 303.6 | 759 | 1518 | 25.725 | 92.61 | 0 |
| SPC-Missiles | Space Tech | Missiles | Guided AA | Flyer | Aircraft | Electric | Both | Base | 1 | Overload | Yes | Yes | 96 | 153.6 | 230.4 | 66.15 | 102.5325 | 152.145 | 9.625 | 0.8 | 4 | 102.2 | 306.6 | 766.5 | 1533 | 33.075 | 119.07 | 79.38 |
| DRK-Troops | Dark Energy | Troops | Skirmisher | Walker | Energy | Poison | Ground | Base | 0 | Toxin | No | No | 180 | 288 | 432 | 50.4 | 78.12 | 115.92 | 2.5 | 2.04 | 5.5 | 102.1 | 306.3 | 765.75 | 1531.5 | 90.72 | 5.04 | 0 |
| DRK-Trucks | Dark Energy | Trucks | Support | Walker | Energy | Poison | Ground | Base | 0 | Toxin | No | No | 225 | 360 | 540 | 16.8 | 26.04 | 38.64 | 1.25 | 3.264 | 6 | 99.5 | 298.5 | 746.25 | 1492.5 | 30.24 | 1.68 | 0 |
| DRK-Tanks | Dark Energy | Tanks | Bruiser | Walker | Energy | Poison | Ground | Base | 0 | Toxin | No | No | 360 | 576 | 864 | 50.4 | 78.12 | 115.92 | 3.75 | 0.816 | 4.5 | 99.8 | 299.4 | 748.5 | 1497 | 90.72 | 5.04 | 0 |
| DRK-Artillery | Dark Energy | Artillery | Siege | Walker | Energy | Concussion | Ground | Structures | 2 | Stagger | No | No | 135 | 216 | 324 | 67.2 | 104.16 | 154.56 | 10 | 0.408 | 4 | 103.4 | 310.2 | 775.5 | 1551 | 26.88 | 114.24 | 0 |
| DRK-HeavyTanks | Dark Energy | Heavy Tanks | Juggernaut | Walker | Energy | Poison | Ground | Base | 0 | Toxin | No | No | 495 | 792 | 1188 | 42 | 65.1 | 96.6 | 3 | 0.408 | 4.3 | 97.6 | 292.8 | 732 | 1464 | 75.6 | 4.2 | 0 |
| DRK-Copters | Dark Energy | Copters | Harasser | Flyer | Aircraft | Poison | Both | Base | 0 | Toxin | Yes | Yes | 180 | 288 | 432 | 50.4 | 78.12 | 115.92 | 5 | 2.04 | 4.5 | 102.1 | 306.3 | 765.75 | 1531.5 | 90.72 | 5.04 | 5.04 |
| DRK-Planes | Dark Energy | Planes | Striker | Flyer | Aircraft | Poison | Ground | Base | 1 | Toxin | Yes | Yes | 135 | 216 | 324 | 58.8 | 91.14 | 135.24 | 6.25 | 2.04 | 4 | 103.2 | 309.6 | 774 | 1548 | 105.84 | 5.88 | 0 |
| DRK-Missiles | Dark Energy | Missiles | Guided AA | Flyer | Aircraft | Poison | Both | Base | 1 | Toxin | Yes | Yes | 90 | 144 | 216 | 75.6 | 117.18 | 173.88 | 8.75 | 0.816 | 4 | 104.6 | 313.8 | 784.5 | 1569 | 136.08 | 7.56 | 7.56 |
| GRN-Troops | Greenies (Chem) | Troops | Skirmisher | Walker | Organic | Poison | Ground | Base | 1 | Toxin | No | No | 164 | 262.4 | 393.6 | 44.1 | 68.355 | 101.43 | 2.375 | 2.1 | 5.5 | 96.55 | 289.65 | 724.125 | 1448.25 | 79.38 | 4.41 | 0 |
| GRN-Trucks | Greenies (Chem) | Trucks | Support | Walker | Organic | Poison | Ground | Base | 1 | Toxin | No | No | 205 | 328 | 492 | 14.7 | 22.785 | 33.81 | 1.1875 | 3.36 | 6 | 97.05 | 291.15 | 727.875 | 1455.75 | 26.46 | 1.47 | 0 |
| GRN-Tanks | Greenies (Chem) | Tanks | Bruiser | Walker | Organic | Poison | Ground | Base | 1 | Toxin | No | No | 328 | 524.8 | 787.2 | 44.1 | 68.355 | 101.43 | 3.5625 | 0.84 | 4.5 | 91.95 | 275.85 | 689.625 | 1379.25 | 79.38 | 4.41 | 0 |
| GRN-Artillery | Greenies (Chem) | Artillery | Siege | Walker | Organic | Concussion | Ground | Structures | 2 | Stagger | No | No | 123 | 196.8 | 295.2 | 58.8 | 91.14 | 135.24 | 9.5 | 0.42 | 4 | 94.75 | 284.25 | 710.625 | 1421.25 | 23.52 | 99.96 | 0 |
| GRN-HeavyTanks | Greenies (Chem) | Heavy Tanks | Juggernaut | Walker | Organic | Poison | Ground | Base | 1 | Toxin | No | No | 451 | 721.6 | 1082.4 | 36.75 | 56.9625 | 84.525 | 2.85 | 0.42 | 4.3 | 89.25 | 267.75 | 669.375 | 1338.75 | 66.15 | 3.675 | 0 |
| GRN-Copters | Greenies (Chem) | Copters | Harasser | Flyer | Aircraft | Poison | Both | Base | 1 | Toxin | Yes | Yes | 164 | 262.4 | 393.6 | 44.1 | 68.355 | 101.43 | 4.75 | 2.1 | 4.5 | 96.05 | 288.15 | 720.375 | 1440.75 | 79.38 | 4.41 | 4.41 |
| GRN-Planes | Greenies (Chem) | Planes | Striker | Flyer | Aircraft | Poison | Ground | Base | 1 | Toxin | Yes | Yes | 123 | 196.8 | 295.2 | 51.45 | 79.7475 | 118.335 | 5.9375 | 2.1 | 4 | 96.6 | 289.8 | 724.5 | 1449 | 92.61 | 5.145 | 0 |
| GRN-Missiles | Greenies (Chem) | Missiles | Guided AA | Flyer | Aircraft | Poison | Both | Base | 1 | Toxin | Yes | Yes | 82 | 131.2 | 196.8 | 66.15 | 102.5325 | 152.145 | 8.3125 | 0.84 | 4 | 96.05 | 288.15 | 720.375 | 1440.75 | 119.07 | 6.615 | 6.615 |

## Sheet: Structures

| Structure | Category | Footprint | Cost T1 | Build s | Health T1 | Weapon? | Damage Type | DPS T1 | Range | Can Target | AoE r | Health T2 | Health T3 | DPS T2 | DPS T3 | Cost T2 | Cost T3 | Function / target priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Blacksmith | Production | 2 | 250 | 20 | 600 | No | — | 0 | 0 | — | 0 | 960 | 1440 | 0 | 0 | 625 | 1250 | Upgrades ground units (T1-3) |
| Armory | Production | 2 | 250 | 20 | 600 | No | — | 0 | 0 | — | 0 | 960 | 1440 | 0 | 0 | 625 | 1250 | Unlocks weapons & ammo tiers |
| Barracks | Production | 2 | 200 | 18 | 550 | No | — | 0 | 0 | — | 0 | 880 | 1320 | 0 | 0 | 500 | 1000 | Trains troops / repair crews |
| Stables | Production | 2 | 200 | 18 | 500 | No | — | 0 | 0 | — | 0 | 800 | 1200 | 0 | 0 | 500 | 1000 | Mounts; unit speed bonus |
| Science Lab | Research | 2 | 350 | 26 | 500 | No | — | 0 | 0 | — | 0 | 800 | 1200 | 0 | 0 | 875 | 1750 | Radar, energy, tech unlocks |
| Balloons | Support | 1 | 180 | 14 | 300 | No | — | 0 | 0 | — | 0 | 480 | 720 | 0 | 0 | 450 | 900 | Aerial vision; sees ground at range |
| Runway | Production | 3 | 400 | 28 | 650 | No | — | 0 | 0 | — | 0 | 1040 | 1560 | 0 | 0 | 1000 | 2000 | Builds & launches air units |
| Walls | Defense | 1 | 60 | 6 | 900 | No | — | 0 | 0 | — | 0 | 1440 | 2160 | 0 | 0 | 150 | 300 | Blocks & reroutes walkers |
| Moats | Defense | 1 | 50 | 8 | 700 | No | — | 0 | 0 | — | 0 | 1120 | 1680 | 0 | 0 | 125 | 250 | Blocks walkers; passable only by water/air |
| Traps | Defense | 1 | 90 | 6 | 200 | Yes | Concussion | 70 | 1.5 | Ground | 2 | 320 | 480 | 108.5 | 161 | 225 | 450 | One-shot/recharge; triggers on overlap |
| Murder Holes | Defense | 1 | 120 | 8 | 350 | Yes | Kinetic | 55 | 2 | Ground | 0 | 560 | 840 | 85.25 | 126.5 | 300 | 600 | Chokepoint anti-ground; short range |
| Cannon Tower | Emplacement | 1 | 150 | 10 | 500 | Yes | Kinetic | 45 | 4 | Ground | 1 | 800 | 1200 | 69.75 | 103.5 | 375 | 750 | SLICE anti-ground tower |
| Flak Tower | Emplacement | 1 | 150 | 10 | 400 | Yes | Kinetic | 40 | 5 | Air | 1 | 640 | 960 | 62 | 92 | 375 | 750 | SLICE anti-air tower |
| Wall / Moat | Emplacement | 1 | 60 | 6 | 900 | No | — | 0 | 0 | — | 0 | 1440 | 2160 | 0 | 0 | 150 | 300 | SLICE terrain piece; reroutes walkers |

## Sheet: Vertical_Slice

| VERTICAL SLICE — primary benchmark (GDD §19). Locked config; stats link live to Units / Structures. |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tutorial faction: Ground / Powder. Map: one ground lane beside one water lane, ending at the base in a clearing. |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |
| MATCH PARAMETERS |  |  |  |  |  |  |  |  |
| Waves to survive (win) | 5 |  |  |  |  |  |  |  |
| Base HP (lose at 0) | 2000 |  |  |  |  |  |  |  |
| Starting gold | 800 |  |  |  |  |  |  |  |
| Income per kill | unit Cost T1 x 0.35 |  |  |  |  |  |  |  |
| Seed-deterministic | Yes (identical replay) |  |  |  |  |  |  |  |
| Headless combat core | Required (feeds sim §17) |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |
| ATTACKERS (3 units spanning the domains) |  |  |  |  |  |  |  |  |
| Role in slice | UnitID | Domain | Damage Type | HP T1 | DPS T1 | Range | Speed | Cost T1 |
| Walker | GND-Troops | Walker | Kinetic | 220 | 45 | 2.5 | 1.84 | 300 |
| Floater (amphibious) | GND-Trucks | Walker | Kinetic | 275 | 15 | 1.25 | 2.944 | 297.9 |
| Flyer | GND-Copters | Flyer | Kinetic | 220 | 45 | 5 | 1.84 | 300 |
| Note: GND-Trucks is fielded as an amphibious floater for the slice's water lane (domain override). |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |
| DEFENSES (3 towers) |  |  |  |  |  |  |  |  |
| Role in slice | Structure | Can Target | Health T1 | DPS T1 | Range | Cost T1 |  |  |
| Anti-ground | Cannon Tower | Ground | 500 | 45 | 4 | 150 |  |  |
| Anti-air | Flak Tower | Air | 400 | 40 | 5 | 150 |  |  |
| Reroute terrain | Wall / Moat | — | 900 | 0 | 0 | 60 |  |  |

## Sheet: Balance_Check

| BALANCE AUDIT — proves the roster is 'as even as possible' for now |  |  |
| --- | --- | --- |
|  |  |  |
| Whole roster (Units, T1 power) |  |  |
| Units | 72 |  |
| Avg power (target 100) | 100.436111111111 |  |
| Min power | 89.25 |  |
| Max power | 111.7 |  |
| Spread (max-min) | 22.45 |  |
| Std dev of power | 3.68999505918046 |  |
| Avg cost T1 (gold) | 301.308333333333 |  |
|  |  |  |
| Average power by faction (should cluster near 100) |  |  |
| Faction | Avg power | Avg cost |
| Ground / Powder | 101.05 | 303.15 |
| Air | 101.00125 | 303.00375 |
| High Tech | 100.89875 | 302.69625 |
| Artillery | 102.1375 | 306.4125 |
| Water | 100.70125 | 302.10375 |
| Arcane / Energy | 101.405 | 304.215 |
| Space Tech | 100.4125 | 301.2375 |
| Dark Energy | 101.5375 | 304.6125 |
| Greenies (Chem) | 94.78125 | 284.34375 |
|  |  |  |
| Read: tight spread + per-faction averages near 100 = evenly balanced baseline. Damage types add matchup asymmetry that the sim (§17) will price. |  |  |