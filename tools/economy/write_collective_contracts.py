#!/usr/bin/env python3
"""write_collective_contracts.py — put the Collective contracts into the map-data workbook [MM-story_mw4a1o3p_m].

    node tools/economy/contract_quota.mjs > /tmp/cc.csv
    python tools/economy/write_collective_contracts.py /tmp/cc.csv
    python tools/extract_mapdata.py

Writes (or rewrites) the Collective_Contracts sheet of docs/sources/Bulwark-Map-Data.xlsx: one row per planet × map
(81), columns Planet_Key, Planet, Map_ID, Common, Uncommon, Standing, Gold_Bonus. Tech plan:
docs/tech-plan/Collective-Faction.md §3.3.

openpyxl keeps the other sheets' formulas but drops their cached values, and extract_mapdata.py reads cached values
(data_only). So the workbook is recalculated afterwards with LibreOffice headless, and every other sheet's values are
checked unchanged before the file is replaced. Without soffice on PATH the script refuses rather than ship a workbook
the extractor would read as empty.
"""
import csv
import os
import shutil
import subprocess
import sys
import tempfile

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
XLSX = os.path.join(ROOT, "docs", "sources", "Bulwark-Map-Data.xlsx")
SHEET = "Collective_Contracts"
COLS = ["Planet_Key", "Planet", "Map_ID", "Common", "Uncommon", "Standing", "Gold_Bonus"]


def values(path, skip):
    wb = openpyxl.load_workbook(path, data_only=True)
    return {ws.title: [tuple(r) for r in ws.iter_rows(values_only=True)] for ws in wb if ws.title != skip}


def write_sheet(sheet, cols, header_lines, rows):
    """Replace `sheet` in the map-data workbook with header_lines, the column row and rows, recalculate with
    LibreOffice, and refuse if any other sheet's values change. Shared with write_rare_contracts.py."""
    soffice = shutil.which("soffice")
    if not soffice:
        sys.exit("soffice (LibreOffice) is needed to recalculate the workbook; open+save it in Excel instead")
    before = values(XLSX, sheet)
    wb = openpyxl.load_workbook(XLSX)
    if sheet in wb.sheetnames:
        del wb[sheet]
    ws = wb.create_sheet(sheet)
    for line in header_lines:
        ws.append([line] if line else [])
    ws.append(cols)
    for r in rows:
        ws.append(r)
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "raw.xlsx")
        wb.save(raw)
        out = os.path.join(tmp, "out")
        subprocess.run([soffice, "--headless", "--calc", "--convert-to", "xlsx", "--outdir", out, raw],
                       check=True, capture_output=True)
        calc = os.path.join(out, "raw.xlsx")
        after = values(calc, sheet)
        changed = [t for t in before if before[t] != after.get(t)]
        if changed:
            sys.exit(f"recalculation changed other sheets' values: {changed} — workbook left untouched")
        shutil.copyfile(calc, XLSX)
    print(f"OK -> {os.path.relpath(XLSX, ROOT)} › {sheet} ({len(rows)} rows); now run tools/extract_mapdata.py")


def main(csv_path):
    with open(csv_path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    if len(rows) != 81:
        sys.exit(f"expected 81 planet × map rows, got {len(rows)}")
    write_sheet(SHEET, COLS, [
        "Collective contracts (81) — one per planet × map, common and uncommon only",
        "Measured by tools/economy/contract_quota.mjs on the live board; tune by hand. Rare and epic belong to the "
        "secondary contracts (owner 2026-11-05). Standing is paid on the first completion only.",
        "",
    ], [[r["Planet_Key"], r["Planet"]] + [int(r[c]) for c in COLS[2:]] for r in rows])


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
