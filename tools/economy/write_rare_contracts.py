#!/usr/bin/env python3
"""write_rare_contracts.py — put the optional rare contracts into the map-data workbook [MM-task_mw5h8fxu_d].

    node tools/economy/rare_quota.mjs > /tmp/rc.csv
    python tools/economy/write_rare_contracts.py /tmp/rc.csv
    python tools/extract_mapdata.py

Writes (or rewrites) the Rare_Contracts sheet of docs/sources/Bulwark-Map-Data.xlsx: one row per planet × map (81),
columns Planet_Key, Planet, Map_ID, Rare_Seeded, Quota, Price_Per_Unit, Loyalty. Same safe write as the Collective
contracts (write_collective_contracts.write_sheet). Design: docs/16 Bulwark MM/design/Rare-Contracts-Design.md.
"""
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from write_collective_contracts import write_sheet  # noqa: E402

SHEET = "Rare_Contracts"
COLS = ["Planet_Key", "Planet", "Map_ID", "Rare_Seeded", "Quota", "Price_Per_Unit", "Loyalty"]


def main(csv_path):
    with open(csv_path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    if len(rows) != 81:
        sys.exit(f"expected 81 planet × map rows, got {len(rows)}")
    write_sheet(SHEET, COLS, [
        "Rare contracts (81) — the optional in-battle offer, one per planet × map, rare resources only",
        "Owner 2026-11-06: offered after wave 3 is won at 3★ or better by a faction whose capital ship has arrived; "
        "sells this map's rare finds up to Quota at Price_Per_Unit; resolves at the end of the map; declining costs "
        "nothing but the offer must be re-earned. Measured by tools/economy/rare_quota.mjs; tune by hand.",
        "",
    ], [[r["Planet_Key"], r["Planet"]] + [int(r[c]) for c in COLS[2:]] for r in rows])


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
