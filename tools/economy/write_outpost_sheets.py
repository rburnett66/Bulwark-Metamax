#!/usr/bin/env python3
"""write_outpost_sheets.py — put the outpost data into the map-data workbook [MM-story_mw5oe4ap_i].

    python tools/economy/write_outpost_sheets.py      # writes Ores, Outpost_Structures, Outpost_Contracts, Outpost_Tech, Outpost_Params
    python tools/extract_mapdata.py                   # → MAPDATA.ores / .outpostStructures / .outpostContracts / .outpostParams
    node tools/economy/outpost_model.mjs              # prints the derived tables (design §4)

Seeds the four sheets with the design's values (docs/16 Bulwark MM/design/Outpost-Design.md §2–§8; tech plan
docs/tech-plan/Outpost.md §3.1). After this first write the WORKBOOK is the source: tune it by hand in Excel and
re-extract; re-running this script overwrites hand edits. Same safe write as the contract sheets
(write_collective_contracts.write_sheet: LibreOffice recalculation, refused if any other sheet's values change).
Outpost_Raids is not written here: raid sizes are measured by running the battle sim (tech plan §4.3, story O2/O3).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from write_collective_contracts import write_sheet  # noqa: E402

# planet key, planet, (common, uncommon, rare) ores, use — design §3; rig heads design §8.4
PLANETS = [
    ("ground", "Verdance", ("Iron", "Aluminum", "Lithium"), ("auger", "laser", "brine"),
     "outposts, hulls, batteries"),
    ("air", "Florael", ("Magnesium", "Boron", "Cobalt"), ("laser", "brine", "bore"),
     "light, strong materials and power stations"),
    ("hightech", "Ochre", ("Silicon", "Copper", "Gallium"), ("crystal", "auger", "bore"),
     "electronics, sensors, solar arrays"),
    ("artillery", "Kessra", ("Nickel", "Chromium", "Tungsten"), ("auger", "laser", "bore"),
     "armour plate and ordnance"),
    ("water", "Rime", ("Manganese", "Titanium", "Vanadium"), ("auger", "laser", "bore"),
     "hull alloys for cold and vacuum"),
    ("arcane", "Cinder", ("Zinc", "Platinum", "Iridium"), ("auger", "bore", "crystal"),
     "heat-proof parts and reactor catalysts"),
    ("space", "Lumen", ("Thorium", "Uranium", "Helium-3"), ("auger", "shielded", "brine"),
     "reactor and drive fuel"),
    ("dark", "Xenthe", ("Neodymium", "Yttrium", "Europium"), ("auger", "crystal", "bore"),
     "magnets, shields and energy cells"),
    ("greenies", "Vexmire", ("Sulfur", "Phosphorus", "Palladium"), ("brine", "auger", "bore"),
     "fuels, chemistry and catalysts"),
]
TIERS = ("common", "uncommon", "rare")
RATE = {"common": 3, "uncommon": 1.5, "rare": 0.8}          # Rig I units per minute (design §4.2)
PRICE = {"common": 4, "uncommon": 12, "rare": 30}           # gold per unit
COLOUR = {
    "Iron": "#8a4b32", "Aluminum": "#c9d2dc", "Lithium": "#e8c8d6", "Magnesium": "#d8d8cc", "Boron": "#6f5a4a",
    "Cobalt": "#2a52be", "Silicon": "#6f7b8f", "Copper": "#b87333", "Gallium": "#a9b8c6", "Nickel": "#9c9a8a",
    "Chromium": "#cfd8e0", "Tungsten": "#5a5f66", "Manganese": "#8e6e8c", "Titanium": "#b8c0c8",
    "Vanadium": "#3f6fa8", "Zinc": "#a7b0b8", "Platinum": "#e5e4e2", "Iridium": "#7fb6ff", "Thorium": "#6a8f5a",
    "Uranium": "#7cff5a", "Helium-3": "#a8e8ff", "Neodymium": "#8a7fb0", "Yttrium": "#b06fd8",
    "Europium": "#6a4fe0", "Sulfur": "#e6d23a", "Phosphorus": "#f0f0e0", "Palladium": "#c9c4b8",
}
# The far buyer (design §8.5): each faction wants one other planet's rare ore and pays Far_Buyer_Mult for it.
# Florael → Lithium and Lumen → Iridium are the design's; the rest follow each faction's use (§3), one want each.
WANTED_BY = {"Lithium": "air", "Cobalt": "water", "Gallium": "greenies", "Tungsten": "ground", "Vanadium": "artillery",
             "Iridium": "space", "Helium-3": "arcane", "Europium": "hightech", "Palladium": "dark"}

ORE_COLS = ["Planet_Key", "Planet", "Tier", "Ore", "Ore_Id", "Rate_Per_Min", "Price", "Deep_Rate_Mult",
            "Deep_Price_Mult", "Colour", "Rig_Head", "Wanted_By", "Use"]


def ore_rows():
    rows = []
    for key, planet, ores, heads, use in PLANETS:
        for tier, ore, head in zip(TIERS, ores, heads):
            oid = ore.lower().replace("-", "")
            rows.append([key, planet, tier, ore, oid, RATE[tier], PRICE[tier], 0.25, 5, COLOUR[ore], head,
                         WANTED_BY.get(ore, ""), use])
    return rows


STRUCT_COLS = ["Kind", "Tier", "Cost", "Value", "Build_Sec", "Power_Draw", "Power_Supply", "Power_Reach",
               "Bay_Hours", "Rate_Mult", "Capacity_Mult", "Battle_Struct", "Model", "Unlock", "HP", "Power_Priority"]
# Cost: the price to build one with the player's own gold. Value: what a repair is priced against (design §6.1).
# HP: a building's hit points where it has them (the Pylon); blank = 1 (buildings are breached, never shot).
# Power_Priority (owner 2026-11-11): who a short grid serves first, lower first; blank = last. Same values as
# patch_power_priority.py PRIORITY (that script adds the column without LibreOffice).
from patch_power_priority import PRIORITY as POWER_PRIORITY  # noqa: E402
# Owner 2026-11-07: the contract grants only the hub; the player buys power, the mining station, storage, the Resource
# Bay, harvesters and the defenses. The first setup (Power I + Rig I + Storage I, 1,500) is sized to the gold a player
# banks by map 3 at 3 stars and pays back from iron (720 gold an hour) in about two hours (design §6.1).
# Defense prices are the battle price × 4 (design §5.2), the battle tier stats come from Battle_Struct; the
# harvester is the battle harvester's 500 × 4 (the same ×4 as the defenses).
STRUCTS = [
    ["hub", 1, 0, 0, 0, 2, 0, 0, "", "", "", "", "hub", "granted"],
    ["power", 1, 600, 600, 120, 0, 10, 10, "", "", "", "", "power", "contract:1"],
    ["power", 2, 6000, 6000, 900, 0, 20, 14, "", "", "", "", "power_ii", "tech:power_grid_2"],
    ["rig", 1, 600, 600, 120, 4, 0, 0, "", 1, 1, "", "rig", "contract:1"],
    ["rig", 2, 8000, 8000, 1200, 4, 0, 0, "", 2, 2, "", "rig", "tech:rig_mk2"],
    ["storage", 1, 300, 300, 60, 1, 0, 0, 4, "", "", "", "storage", "contract:1"],
    ["storage", 2, 5000, 5000, 900, 1, 0, 0, 8, "", "", "", "storage", "tech:supply_depot"],
    ["resourceBay", 1, 2500, 2500, 300, 2, 0, 0, "", "", "", "", "resource_bay", "contract:1"],
    ["harvester", 1, 2000, 2000, 0, 0, 0, 0, "", "", "", "", "harvester", "contract:1"],
    ["upgradeBay", 1, 4000, 4000, 600, 1, 0, 0, "", "", "", "", "upgrade_bay", "contract:1"],
    # Habitat (owner 2026-11-07, story O15): raises the gun cap (Gun_Cap + Habitat_Guns_Per_Tier x tier). Tier II is the
    # upgrade of the one Habitat. It draws no power, so the gun cap never moves with the grid (design 6, 11).
    ["habitat", 1, 3000, 3000, 600, 0, 0, 0, "", "", "", "", "habitat", "contract:1"],
    ["habitat", 2, 5000, 5000, 900, 0, 0, 0, "", "", "", "", "habitat", "contract:1"],
    ["mg", 1, 600, 600, 120, 1, 0, 0, "", "", "", "STR-MG", "", "contract:1"],
    ["mg", 2, 1500, 1500, 120, 1, 0, 0, "", "", "", "STR-MG", "", "techtree+upgradeBay"],
    ["mg", 3, 3000, 3000, 120, 1, 0, 0, "", "", "", "STR-MG", "", "techtree+upgradeBay"],
    ["cannon", 1, 1200, 1200, 120, 1, 0, 0, "", "", "", "STR-Cannon", "", "contract:1"],
    ["cannon", 2, 3000, 3000, 120, 1, 0, 0, "", "", "", "STR-Cannon", "", "techtree+upgradeBay"],
    ["cannon", 3, 6000, 6000, 120, 1, 0, 0, "", "", "", "STR-Cannon", "", "techtree+upgradeBay"],
    ["wall", 1, 400, 400, 120, 0, 0, 0, "", "", "", "STR-Wall", "", "contract:1"],
    ["wall", 2, 1000, 1000, 120, 0, 0, 0, "", "", "", "STR-Wall", "", "tech:reinforced_walls"],
    # Pylon (One Battle UX S2b, owner 2026-11-11 "keep it very simple"): a 1x1 grid node with reach only — one tier,
    # no supply, no draw. Starting numbers for tuning: cheap (a quarter of a Power Station), reach a little short of
    # Power Station I's 10, HP (the HP column: buildings without one are not combat targets) under a Wall I's 600.
    ["pylon", 1, 150, 150, 30, 0, 0, 8, "", "", "", "", "", "contract:1", 300],
]

CONTRACT_COLS = ["Planet_Key", "Step", "Title", "Ore_Tier", "Deliver", "Raids_Held", "Gold", "Loyalty", "XP", "Unlocks"]
# Contract 1 is the design's (§2.3); 2 and 3 follow the ladder (§2.4) with proposed rewards, to tune after play.
LADDER = [
    (1, "common", 300, 1, 2000, 20, 300, "ore:uncommon tech:deep_drilling_1 tech:supply_depot tech:power_grid_2 tech:reinforced_walls"),
    (2, "uncommon", 150, 0, 4000, 30, 500, "ore:rare tech:rig_mk2 tech:sensor_spire"),
    (3, "rare", 60, 3, 8000, 40, 800, "tech:cargo_shuttle_2 far_buyer"),
]
TITLE = {1: "Establish: {ore}", 2: "Expand: {ore}", 3: "Master: {ore}"}
TITLE_OVERRIDE = {("ground", 1): "Iron for the Oath"}


def contract_rows():
    rows = []
    for key, planet, ores, _, _ in PLANETS:
        for step, tier, deliver, raids, gold, loyalty, xp, unlocks in LADDER:
            ore = ores[TIERS.index(tier)]
            title = TITLE_OVERRIDE.get((key, step), TITLE[step].format(ore=ore))
            rows.append([key, step, title, tier, deliver, raids, gold, loyalty, xp, unlocks])
    return rows


PARAMS = [
    ["Param", "Value", "Unit", "Notes"],
    ["Load_Sec", 300, "s", "a shuttle load is this many seconds of a rig's output (owner: a load every 5 min)"],
    ["Store_Hours", 4, "h", "a Storage Tower I bay holds this many hours of its rig's shallow output"],
    ["Deep_Rate_Mult", 0.25, "x", "deep seam extraction speed (owner: 1/4)"],
    ["Deep_Price_Mult", 5, "x", "deep grade price (owner Q3: raised from 3x to 5x)"],
    ["Raid_Mean_Hours", 6, "h", "average time between raids"],
    ["Raid_Min_Gap_Hours", 3, "h", "at most one raid per window of this length"],
    ["Breach_Storage_Loss", 0.25, "share", "ore in storage lost on a breach (owner Q6)"],
    ["First_Raid_Sec", 600, "s", "the scripted first raid, after the outpost comes online"],
    ["Away_Cap_Hours", 72, "h", "time advanced at most when the game reopens"],
    ["Replay_Keep", 20, "count", "raids kept in the log"],
    ["Far_Buyer_Mult", 2, "x", "the far buyer's price for its wanted rare ore (design 8.5)"],
    ["Far_Loyalty_Cost", 1, "loyalty", "home-faction loyalty lost per load sold far"],
    ["Defense_Price_Mult", 4, "x", "an outpost defense costs its battle price times this (design 5.2)"],
    ["Repair_Share_Per_HP", 1, "x", "repair cost = value x this x share of HP restored (10% per 10%)"],
    ["Shuttle_II_Bonus", 0.10, "share", "Cargo Shuttle II adds this to every sale"],
    ["Rig_Bay_Min", 15, "min", "a rig's own bay without a powered Storage Tower: this many minutes of its shallow output (owner 2026-11-07)"],
    ["Harvester_Cap", 1, "count", "harvesters an outpost may own once its Resource Bay is built (owner 2026-11-09: start at 1; outpost land is sparse next to a survey location)"],
    ["Harvester_Max", 2, "count", "the most harvesters an outpost can ever hold (owner 2026-11-09: cap 2; Dock 3 through the Upgrade Bay raises 1 -> 2, O10)"],
    ["Hopper_Hours", 4, "h", "the Resource Bay's hopper holds this many hours of its harvesters' gathering (design 6, O10)"],
    ["Harvest_Route_Mult", 1.3, "x", "a harvester's drive is the straight line from the Resource Bay to its field times this (the ramps' detour, O10)"],
    ["Harvest_Rate_Mult", 1, "x", "outpost harvesters gather at the battle harvest rate times this (1 = the battle's rate, design 6; tune here)"],
    ["Surface_Respawn_Mult", 0.05, "x", "owner 2026-11-07: outpost surface fields regrow at 5% of the battle maps' rate (units per cell / Primary_Respawn_Sec); stock as a battle field (O10)"],
    ["Gun_Cap", 4, "count", "guns (Machine Guns and Cannons; walls do not count) the hub crews without a Habitat (owner 2026-11-09: 4 base)"],
    ["Habitat_Guns_Per_Tier", 4, "count", "guns each Habitat tier adds: Habitat I +4, Habitat II +8 (owner 2026-11-09: 4 more per habitat)"],
    ["Raid_Chance_Per_Size", 0.05, "x", "owner 2026-11-11: the bigger the base the more frequent attacks; a window's raid chance = (Raid_Min_Gap_Hours / Raid_Mean_Hours) x (1 + this x size), size = finished buildings + defenses, hub not counted"],
    ["Raid_Chance_Max", 0.9, "share", "the raid chance per window never goes above this, however big the base (at most 1: one raid per window)"],
]

TECH_COLS = ["Node", "Name", "Price", "Effect", "Unlocked_By", "Requires", "Applies"]
# The Outpost division of the tech tree (design 7, story O10). A contract step UNLOCKS a node (Outpost_Contracts
# Unlocks, tech:<node>); the player then BUYS it with gold in the Tech Tree (tech plan D7: a mission unlocks, gold buys).
# Prices are proposed defaults, sized to outpost income (a Rig I on iron earns 720 gold an hour). Applies: 'outposts' =
# every outpost at once; 'upgradeBay' = a defense tier, installed only at an outpost with a finished Upgrade Bay.
OUTPOST_TECH = [
    ["deep_drilling_1", "Deep Drilling I", 3000, "rigs can mine the deep seam: 1/4 the speed, 5x the price", "contract 1", "", "outposts"],
    ["supply_depot", "Supply Depot", 4000, "Storage Tower II: 8 hours per rig bay", "contract 1", "", "outposts"],
    ["power_grid_2", "Power Grid II", 4000, "Power Station II: 20 power, 14-cell reach", "contract 1", "", "outposts"],
    ["reinforced_walls", "Reinforced Walls", 2500, "walls to tier II (960 HP), installed in the Upgrade Bay", "contract 1", "", "upgradeBay"],
    ["rig_mk2", "Rig Mk II", 6000, "Mining Rig II: 2x extraction and 2x bay", "contract 2", "deep_drilling_1", "outposts"],
    ["sensor_spire", "Sensor Spire", 3500, "raid early warning: the outpost shows a raid inbound 10 minutes ahead", "contract 2", "", "outposts"],
    ["cargo_shuttle_2", "Cargo Shuttle II", 10000, "+10% on every sale (still a manual tap)", "contract 3", "", "outposts"],
]


def main():
    write_sheet("Ores", ORE_COLS, [
        "Ores (27) — three per planet, mined only by outpost rigs; one design per extraction head",
        "Design: docs/16 Bulwark MM/design/Outpost-Design.md §3, §4.2, §8.4, §8.5. Rate_Per_Min is Rig I shallow; "
        "deep = rate x Deep_Rate_Mult at price x Deep_Price_Mult. Wanted_By: the faction that pays the far price.",
        "",
    ], ore_rows())
    write_sheet("Outpost_Structures", STRUCT_COLS, [
        "Outpost buildings and defenses, per tier",
        "Design §4.5 (power), §5.2 (defenses, battle price x 4), §6.1 (costs). Only the hub is granted (owner 2026-11-07); "
        "everything else is bought. harvester: bought once a Resource Bay is built (battle price x 4). Defenses take "
        "their battle stats from Battle_Struct (STRUCTURES in src/data/tables.js); no anti-air, no long range.",
        "",
    ], [r + [""] * (len(STRUCT_COLS) - 1 - len(r)) + [POWER_PRIORITY.get(r[0], "")] for r in STRUCTS])
    write_sheet("Outpost_Contracts", CONTRACT_COLS, [
        "Outpost contracts (27) — three steps per planet",
        "Design §2.3 (contract 1, specified) and §2.4 (the ladder; steps 2-3 rewards proposed, tune after play). "
        "Deliver counts both grades of the step's ore; Raids_Held counts raids repelled while the step is active.",
        "",
    ], contract_rows())
    write_sheet("Outpost_Tech", TECH_COLS, [
        "The Outpost division of the tech tree (7 nodes)",
        "Design 7. A contract step unlocks a node (Outpost_Contracts Unlocks); the player buys it in the Tech Tree. "
        "Read by src/data/techtree.js through MAPDATA.outpostTech; counted on the Missions workbook's Economy sheet (Outpost line).",
        "",
    ], OUTPOST_TECH)
    write_sheet("Outpost_Params", PARAMS[0], [
        "Outpost tuning",
        "Design §4.1 (the owner's fixed numbers), §5, §8.5. Read by src/data/outpost.js as OUTPOST.",
        "",
    ], PARAMS[1:])


if __name__ == "__main__":
    main()
