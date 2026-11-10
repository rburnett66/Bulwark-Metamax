#!/usr/bin/env python3
"""write_farm_sheets.py — put farming's Phase A data into the map-data workbook [MM-story_mwabgax7_9].

    python tools/economy/write_farm_sheets.py     # writes Farm_Params, Crops, Farm_Methods, Pod_Levels,
                                                  #        Farm_Buildings, Farm_Contracts
    python tools/extract_mapdata.py               # → MAPDATA.farmParams / .crops / .farmMethods / .podLevels /
                                                  #   .farmBuildings / .farmContracts

Seeds the sheets with the designs' proposed values (docs/16 Bulwark MM/design/Farming-Design.md §4–§8,
Farming-Distribution-Design.md §2–§5; tech plan docs/tech-plan/Farming.md §3.2). Every number is a placeholder until the
owner rules on it (Farming-Design D14). After this first write the WORKBOOK is the source: tune it by hand and
re-extract; re-running this script overwrites hand edits to these six sheets.

How it writes: these sheets hold plain values, no formulas, so nothing needs recalculating. Each sheet is written
straight into the .xlsx package as its own part; every other part is copied byte for byte. The script then reads every
other sheet back and refuses (leaving the workbook untouched) if any value changed — the same guarantee as
write_collective_contracts.write_sheet, which needs LibreOffice to recalculate formula sheets.
"""
import os
import re
import shutil
import sys
import tempfile
import zipfile
from xml.sax.saxutils import escape

try:
    import openpyxl
except ImportError:
    sys.exit("pip install openpyxl")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
XLSX = os.path.join(ROOT, "docs", "sources", "Bulwark-Map-Data.xlsx")

# ── the 36 crops: each planet's four surface resources (Distribution §2.2) ─────────────────────────────────────────
# (planet key, planet, [(tier, crop, category, grows as, best method)…]). Helium-4 is a NEW material (owner rule 1,
# 2026-11-09): Lumen's uncommon-tier crop; Helium-3 stays the battle resource and the rare ore, untouched.
CROPS = [
    ("ground", "Verdance", [("common", "Loam Grain", "Grain", "living", "traditional irrigated"),
                            ("uncommon", "Heartwood Amber", "Materials", "living", "orchard"),
                            ("rare", "Rootsong Seeds", "Vegetable", "living", "subterrain"),
                            ("epic", "Elder Bloom", "Materials", "living", "solo")]),
    ("air", "Florael", [("common", "Petal Silk", "Materials", "living", "traditional terraced"),
                        ("uncommon", "Skyhoney", "Fruit", "living", "orchard"),
                        ("rare", "Dawnpollen", "Materials", "living", "spatial vertical"),
                        ("epic", "Choir Lily", "Materials", "living", "hydroponic")]),
    ("hightech", "Ochre", [("common", "Sunsalt", "Minerals", "accreted", "irrigated"),
                           ("uncommon", "Dune Quartz", "Gems", "accreted", "subterrain"),
                           ("rare", "Mirage Oil", "Materials", "accreted", "tub"),
                           ("epic", "Solar Pearl", "Gems", "accreted", "solo")]),
    ("artillery", "Kessra", [("common", "Slag Iron", "Minerals", "accreted", "traditional"),
                             ("uncommon", "Mesa Copper", "Minerals", "accreted", "terraced"),
                             ("rare", "Ghost Brass", "Materials", "accreted", "spatial"),
                             ("epic", "Dreadnought Core", "Materials", "accreted", "subterrain")]),
    ("water", "Rime", [("common", "Brine Ice", "Minerals", "accreted", "hydrofarm"),
                       ("uncommon", "Frost Pearl", "Gems", "living", "hydrofarm"),
                       ("rare", "Glacier Breath", "Materials", "accreted", "subterrain"),
                       ("epic", "Leviathan Scale", "Materials", "living", "hydrofarm")]),
    ("arcane", "Cinder", [("common", "Ash Basalt", "Minerals", "accreted", "traditional"),
                          ("uncommon", "Ember Obsidian", "Gems", "accreted", "subterrain"),
                          ("rare", "Phoenix Glass", "Gems", "accreted", "vertical"),
                          ("epic", "Heartflame", "Materials", "living", "solo")]),
    ("space", "Lumen", [("common", "Regolith", "Minerals", "accreted", "vertical"),
                        ("uncommon", "Helium-4", "Minerals", "accreted", "subterrain"),
                        ("rare", "Starfall Iron", "Minerals", "accreted", "subterrain"),
                        ("epic", "Void Lens", "Gems", "accreted", "hydroponic")]),
    ("dark", "Xenthe", [("common", "Glowcap Spores", "Vegetable", "living", "subterrain"),
                        ("uncommon", "Duskmoss Resin", "Materials", "living", "terraced"),
                        ("rare", "Dreamspore", "Vegetable", "living", "subterrain"),
                        ("epic", "Mycelial Heart", "Materials", "living", "solo")]),
    ("greenies", "Vexmire", [("common", "Mire Peat", "Materials", "living", "irrigated"),
                             ("uncommon", "Venom Sap", "Materials", "living", "orchard"),
                             ("rare", "Hive Jelly", "Fruit", "living", "vertical"),
                             ("epic", "Broodqueen Egg", "Materials", "living", "subterrain")]),
]
# Farming-Design §5.4: a category's Traditional grow time (h) and yield per 2 × 2 plot; the Fruited window equals the
# grow time (D2). A crop's tier stretches the time and shrinks the yield by the same factor (§5.4, proposed).
CATEGORY = {"Grain": (2, 16), "Vegetable": (3, 12), "Fruit": (6, 8), "Materials": (4, 6), "Minerals": (4, 6), "Gems": (8, 3)}
TIER_STRETCH = {"common": 1, "uncommon": 1.5, "rare": 2.5, "epic": 4}
# §9.1: a Fruited harvest returns some pods at the same level — grain 20 %, vegetables 10 % (at least 1 for grain).
POD_RETURN = {"Grain": 0.2, "Vegetable": 0.1}


def slug(name):
    """The catalogue's resource id rule (src/data/resourceIcons.js): 'Loam Grain' → 'loam-grain'."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


CROP_COLS = ["Planet_Key", "Planet", "Tier", "Crop", "Resource_Id", "Category", "Grows_As", "Best_Method",
             "Grow_Hours", "Yield", "Fruited_Hours", "Pod_Return", "Material"]
# Material: "battle" = the battle resource of the same name; "new" = a material only farming makes (owner rule 1, 5:
# it lives in the outpost & farm inventory, never the battle INVENTORY). Helium-4 is the one new material.
NEW_MATERIALS = {"Helium-4"}


def crop_rows():
    rows = []
    for key, planet, crops in CROPS:
        for tier, name, cat, grows, best in crops:
            hours, yld = CATEGORY[cat]
            k = TIER_STRETCH[tier]
            grow = round(hours * k, 2)
            rows.append([key, planet, tier, name, slug(name), cat, grows, best, grow, max(1, round(yld / k)), grow,
                         POD_RETURN.get(cat, 0), "new" if name in NEW_MATERIALS else "battle"])
    return rows


# Farming-Design §4.2: Phase A ships two methods. Foot in battle cells (§4.4: a 4-row plot is 2 × 2, owner).
METHOD_COLS = ["Method", "Name", "Family", "Foot_W", "Foot_H", "Where", "Speed_Mult", "Yield_Mult", "Power",
               "Prep_Mult", "Pods_Per", "Water_Reach", "Taught_By"]
METHODS = [
    ["traditional", "Traditional plot", "open", 2, 2, "soil", 1, 1, 0, 1, 4, 0, "every F1"],
    # within Water_Reach cells of water or a Pump; the Pump draws the power (Farm_Buildings)
    ["irrigated", "Irrigated plot", "open", 2, 2, "soil", 1.5, 1, 0, 1, 4, 4, "the first F1"],
]

# Farming-Design §5.3, §8.2, §8.3; colours and embers as the signed-off scale prototype draws them
# (tools/farming/scale.html: count 110 × 1.5^i, life 1.6 + 0.35 i s, rise 0.9 + 0.18 i cells).
LEVEL_COLS = ["Level", "Name", "Colour", "Value_Mult", "Yield_Bonus", "Bench_Gold", "Ember_Count", "Ember_Life_Sec",
              "Ember_Rise"]
LEVELS = []
for i, (name, colour, value, bench) in enumerate([("Common", "#ffffff", 0.5, 50), ("Uncommon", "#4dff6a", 0.75, 150),
                                                  ("Rare", "#4da6ff", 1.0, 400), ("Epic", "#b25cff", 1.3, 1000),
                                                  ("Legendary", "#ffc83d", 1.75, "")]):
    LEVELS.append([i + 1, name, colour, value, round(0.05 * i, 2), bench, round(110 * 1.5 ** i),
                   round(1.6 + 0.35 * i, 2), round(0.9 + 0.18 * i, 2)])

# Farming-Design §6: Phase A's buildings. Cost/Build_Sec proposed (D14), sized like the outpost's pads.
BUILDING_COLS = ["Kind", "Name", "Foot_W", "Foot_H", "Cost", "Build_Sec", "Power_Draw", "Water_Reach", "Unlock"]
BUILDINGS = [
    ["farmhouse", "Farmhouse", 2, 2, 0, 0, 1, 0, "granted by F1"],
    ["silo", "Silo", 2, 2, 800, 180, 1, 0, "F1"],
    ["pump", "Pump", 1, 1, 400, 60, 2, 4, "irrigated"],
]

# Distribution §5.2 / Farming-Design §2.2: Verdance's F1, "Bread for the Regiments". Phase A ships F1 on Verdance only.
CONTRACT_COLS = ["Planet_Key", "Contract", "Title", "Crop_Id", "Plant_Plots", "Deliver", "Methods_At_Once", "Gold",
                 "Loyalty", "XP", "Pod_Crate", "Pod_Crate_Level", "Grants", "Unlocks"]
CONTRACTS = [
    ["ground", "F1", "Bread for the Regiments", "loam-grain", 3, 40, 2, 1500, 15, 300, 12, 1, "farmhouse",
     "button:farm tab:seedpods method:irrigated tech:sprinklers"],
]

PARAMS = [
    ["Param", "Value", "Unit", "Notes"],
    ["Prep_Gold", 100, "gold", "prepping a Traditional plot (§5.1); a method's Prep_Mult scales it"],
    ["Prep_Sec", 120, "s", "prep time of a Traditional plot (§5.1)"],
    ["Sprout_At", 0.1, "share", "Planted becomes Sprout at this share of the grow time (§5.1)"],
    ["Plant_At", 0.3, "share", "Sprout becomes Plant at this share of the grow time (§5.1)"],
    ["Fruited_Window", 1, "x", "Fruited lasts this times the grow time, then the plant dies (D2)"],
    ["Pods_Per_Plot", 4, "count", "one pod per row of a 4-row plot (D36)"],
    ["Lucky_Chance", 0.05, "share", "a Fruited harvest returns one pod a level up (§8.3)"],
    ["Lucky_Chance_High", 0.03, "share", "the lucky chance from Rare pods up (§8.3)"],
    ["Bench_In", 3, "count", "pods of one crop and level the bench turns into one of the next level (§8.3)"],
    ["Battle_Pod_Units", 200, "units", "a battle field gives one Rare pod per this many units carried (§9.1, X7)"],
    ["Battle_Pod_Units_Epic", 100, "units", "the same on an epic-tier field"],
    ["Pod_Crate", 12, "count", "Common pods in an F1 Pod Crate (§9.1)"],
    ["Silo_Hours", 8, "h", "the Silo holds this many hours of the farm's output (§6)"],
    ["Farmhouse_Store_Hours", 1, "h", "without a finished, powered Silo the Farmhouse holds this many hours of output (as a rig's own bay without a Storage Tower)"],
    ["Plot_Walkway_Cells", 1, "cells", "a clear walkway kept between a plot and every other farm thing, for the avatar and the agrobots (owner 2026-11-10)"],
    ["Breach_Silo_Loss", 0.25, "share", "what a raid breach takes from the Silo (§10)"],
    ["Trample_Fruited_Yield", 0.5, "share", "a trampled Fruited plot keeps this share of its yield (§10)"],
    ["Avatar_Cells", 0.45, "cells", "the surface avatar's height (D44)"],
    ["Farmhands", 3, "count", "farmhands walking a farmed planet's surface (D45)"],
]


# ── the writer ────────────────────────────────────────────────────────────────────────────────────────────────────
NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
SHEET_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
SHEET_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"


def col_name(i):
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def sheet_xml(lines):
    out = [f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="{NS}"><sheetData>']
    for ri, line in enumerate(lines, start=1):
        cells = []
        for ci, v in enumerate(line):
            if v is None or v == "":
                continue
            ref = f"{col_name(ci)}{ri}"
            if isinstance(v, bool):
                cells.append(f'<c r="{ref}" t="b"><v>{int(v)}</v></c>')
            elif isinstance(v, (int, float)):
                cells.append(f'<c r="{ref}"><v>{v}</v></c>')
            else:
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t xml:space="preserve">{escape(str(v))}</t></is></c>')
        out.append(f'<row r="{ri}">{"".join(cells)}</row>')
    out.append("</sheetData></worksheet>")
    return "".join(out).encode("utf-8")


def all_values(path, skip=()):
    wb = openpyxl.load_workbook(path, data_only=True)
    return {ws.title: [tuple(r) for r in ws.iter_rows(values_only=True)] for ws in wb.worksheets if ws.title not in skip}


def write_values_sheets(sheets):
    """sheets: [(name, [row, …])]. Adds or replaces each as a plain-values part; every other part is copied as is."""
    names = {n for n, _ in sheets}
    before = all_values(XLSX, skip=names)
    with zipfile.ZipFile(XLSX) as z:
        parts = {n: z.read(n) for n in z.namelist()}
        infos = {i.filename: i for i in z.infolist()}
    wbx = parts["xl/workbook.xml"].decode("utf-8")
    rels = parts["xl/_rels/workbook.xml.rels"].decode("utf-8")
    ct = parts["[Content_Types].xml"].decode("utf-8")
    for name, lines in sheets:
        m = re.search(rf'<sheet name="{re.escape(name)}" sheetId="\d+"[^>]*r:id="(rId\d+)"/>', wbx)
        if m:   # replace the existing part
            target = re.search(rf'Id="{m.group(1)}"[^>]*Target="([^"]+)"', rels).group(1)
            parts["xl/" + target] = sheet_xml(lines)
            continue
        sid = max(int(x) for x in re.findall(r'sheetId="(\d+)"', wbx)) + 1
        rid = "rId" + str(max(int(x) for x in re.findall(r'Id="rId(\d+)"', rels)) + 1)
        n = 1
        while f"xl/worksheets/sheet{n}.xml" in parts:
            n += 1
        part = f"worksheets/sheet{n}.xml"
        parts["xl/" + part] = sheet_xml(lines)
        wbx = wbx.replace("</sheets>", f'<sheet name="{escape(name)}" sheetId="{sid}" state="visible" r:id="{rid}"/></sheets>')
        rels = rels.replace("</Relationships>", f'<Relationship Id="{rid}" Type="{SHEET_REL}" Target="{part}"/></Relationships>')
        ct = ct.replace("</Types>", f'<Override PartName="/xl/{part}" ContentType="{SHEET_CT}"/></Types>')
    parts["xl/workbook.xml"] = wbx.encode("utf-8")
    parts["xl/_rels/workbook.xml.rels"] = rels.encode("utf-8")
    parts["[Content_Types].xml"] = ct.encode("utf-8")
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "out.xlsx")
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            order = ["[Content_Types].xml"] + [n for n in parts if n != "[Content_Types].xml"]
            for n in order:
                z.writestr(infos.get(n) or zipfile.ZipInfo(n), parts[n], zipfile.ZIP_DEFLATED)
        after = all_values(out, skip=names)
        changed = sorted(t for t in before if before[t] != after.get(t))
        if changed or set(before) != set(after):
            sys.exit(f"writing the farm sheets would change other sheets: {changed} — workbook left untouched")
        got = all_values(out)
        for name, lines in sheets:   # read back what was written: the effect, not the intent
            want = [tuple(None if v == "" else v for v in l) for l in lines]
            have = [tuple(c for c in r[:len(w)]) + (None,) * max(0, len(w) - len(r)) for r, w in zip(got[name], want)]
            if len(got[name]) < len(want) or any(h != w for h, w in zip(have, want)):
                sys.exit(f"{name}: what was read back differs from what was written — workbook left untouched")
        shutil.copyfile(out, XLSX)
    print(f"OK -> {os.path.relpath(XLSX, ROOT)} › {', '.join(n for n, _ in sheets)}; now run tools/extract_mapdata.py")


def block(title, note, cols, rows):
    return [[title], [note], [], cols] + rows


def main():
    write_values_sheets([
        ("Farm_Params", block("Farm tuning (Phase A)", "Farming-Design §5, §6, §8, §10. Read by src/data/farm.js as FARM. "
                              "Every value proposed (D14).", PARAMS[0], PARAMS[1:])),
        ("Crops", block("Crops (36) — each planet's four surface resources (Distribution §2.2)",
                        "Grow_Hours and Yield are Traditional per 2 × 2 plot: category (Farming-Design §5.4) × the tier "
                        "stretch (uncommon 1.5, rare 2.5, epic 4). Helium-4 is a new material (owner 2026-11-09).",
                        CROP_COLS, crop_rows())),
        ("Farm_Methods", block("Farming methods (Phase A: Traditional and Irrigated)",
                               "Farming-Design §4.2, §4.4. The other twelve come with their epics.", METHOD_COLS, METHODS)),
        ("Pod_Levels", block("Seed pod levels (5)", "Farming-Design §5.3, §8.2, §8.3; colours and embers as "
                             "tools/farming/scale.html. Bench_Gold: gold to make one of the next level.", LEVEL_COLS, LEVELS)),
        ("Farm_Buildings", block("Farm buildings (Phase A)", "Farming-Design §6. Cost and Build_Sec proposed.",
                                 BUILDING_COLS, BUILDINGS)),
        ("Farm_Contracts", block("Farming contracts (Phase A: Verdance F1)", "Distribution §5; Farming-Design §2.2.",
                                 CONTRACT_COLS, CONTRACTS)),
    ])


if __name__ == "__main__":
    main()
