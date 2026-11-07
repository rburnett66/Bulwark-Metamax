#!/usr/bin/env python3
"""write_outpost_raids.py — put the measured raid sizes into the map-data workbook [MM-story_mw5oegk1_o].

    node tools/economy/outpost_raids.mjs --write       # measures, then runs this and tools/extract_mapdata.py

Writes (or rewrites) the Outpost_Raids sheet of docs/sources/Bulwark-Map-Data.xlsx from the JSON rows the
measurement writes: one row per planet (9), columns Planet_Key, Units, Breacher, Raider_HP_Mult, Raider_Damage_Mult, Size_Step1..3,
Far_Day_Bump, Measured_On
(tech plan docs/tech-plan/Outpost.md §3.1, §4.3). Same safe write as the other outpost sheets
(write_collective_contracts.write_sheet: LibreOffice recalculation, refused if any other sheet's values change).
The sizes are measured, not picked: re-run the measurement rather than hand-editing them.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from write_collective_contracts import write_sheet  # noqa: E402

COLS = ["Planet_Key", "Units", "Breacher", "Breacher_Every", "Breacher_HP_Mult", "Raider_HP_Mult", "Raider_Damage_Mult", "Size_Step1",
        "Size_Step2", "Size_Step3", "Strength_Step2", "Strength_Step3", "Far_Day_Bump", "Measured_On"]


def main(path):
    with open(path, encoding="utf-8") as fh:
        rows = json.load(fh)
    if len(rows) != 9:
        sys.exit(f"expected 9 planet rows, got {len(rows)}")
    write_sheet("Outpost_Raids", COLS, [
        "Outpost raids (9) — one per planet: the raiders and the raid size per contract step",
        "Measured by tools/economy/outpost_raids.mjs on the battle sim (design 5.2: the starter kit holds about 5 raids "
        "before a breach, the well defended set about 8, no repairs). Units: tier I lightGround ids, cycled in spawn "
        "order. Breacher: one unit added where the troops cannot hurt walls (owner 2026-11-07), in the raids of every "
        "Breacher_Every-th window (owner 2026-11-07: every other raid). Strength_Step2/3 scale both multipliers at that "
        "contract step (owner 2026-11-07: same set, smaller raids). Breacher_HP_Mult: the breacher's HP against its battle HP "
        "(its reach is cut to its faction's troops', so it must come under the guns). "
        "Raider_HP_Mult / Raider_Damage_Mult: raid-only raider strength, 1 = battle (owner 2026-11-07, weaker raiders). "
        "Far_Day_Bump: raiders added on a day the far buyer was used (design 8.5). Measured_On: the outpost map.",
        "",
    ], [[r.get(c) if r.get(c) is not None else "" for c in COLS] for r in rows])


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
