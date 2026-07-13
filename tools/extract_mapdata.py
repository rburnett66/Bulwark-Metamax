#!/usr/bin/env python3
"""extract_mapdata.py — Bulwark-Map-Data.xlsx -> content/maps/mapdata.json

The Map Design GDD's companion workbook is the VALUES source (the GDD holds the rules).
This mirrors tools/extract_dialog.py: design lives in docs/sources, the game consumes a
generated JSON — re-run after any workbook edit:

    python tools/extract_mapdata.py

Requires openpyxl. Formula cells are read as their last-computed values (data_only), so
open+save the workbook in Excel after changing inputs, or the derived sheets go stale.
"""
import json
import os
import sys

try:
    import openpyxl
except ImportError:
    sys.exit("pip install openpyxl")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "docs", "sources", "Bulwark-Map-Data.xlsx")
OUT = os.path.join(ROOT, "prototype", "test-game", "content", "maps", "mapdata.json")


def norm(v):
    """Excel loves floats; the game wants ints where they are ints."""
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, str):
        s = v.strip()
        if s in ("Yes", "yes"):
            return True
        if s in ("No", "no"):
            return False
        return s
    return v


def _is_int(v):
    return isinstance(v, (int, float)) and float(v).is_integer()


def sheet_rows(ws, key_ok, header_row_probe=("Map_ID", "Wave", "Param", "Star", "Faction_ID",
                                             "Resource", "Level", "Faction", "Map", "Outcome")):
    """Find the header row (first cell matches a known header), then yield dicts for every row whose
    KEY cell passes `key_ok` — the sheets carry titles above and prose notes below the data block."""
    rows = list(ws.iter_rows(values_only=True))
    hdr_i = None
    for i, r in enumerate(rows):
        if r and str(r[0]).strip() in header_row_probe:
            hdr_i = i
            break
    if hdr_i is None:
        return []
    headers = [str(h).strip() if h is not None else f"col{j}" for j, h in enumerate(rows[hdr_i])]
    out = []
    for r in rows[hdr_i + 1:]:
        if r is None or r[0] is None or not key_ok(r[0]):
            continue
        d = {}
        for h, v in zip(headers, r):
            if h and not h.startswith("col"):
                d[h] = norm(v)
        out.append(d)
    return out


def params_map(ws):
    """Global_Params: Param/Value/Unit/Notes -> {param: value} (section headers skipped)."""
    out = {}
    for row in sheet_rows(ws, key_ok=lambda v: isinstance(v, str) and v.strip() and not v.isupper(),
                          header_row_probe=("Param",)):
        p, v = row.get("Param"), row.get("Value")
        if p and v is not None:
            out[str(p).strip()] = norm(v)
    return out


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    data = {
        "_source": "docs/sources/Bulwark-Map-Data.xlsx",
        "_gdd": "docs/sources/Bulwark-Map-GDD.md.docx (v1.2 — rules win over values)",
        "globalParams": params_map(wb["Global_Params"]),
        "growthCurve": sheet_rows(wb["Growth_Curve"], _is_int),
        "maps": sheet_rows(wb["Maps"], _is_int),
        "factions": sheet_rows(wb["Factions"], _is_int),
        "resources": sheet_rows(wb["Resources"], lambda v: v in ("Flowers", "Crystals", "Minerals")),
        "harvesterUpgrades": sheet_rows(wb["Harvester_Upgrades"], _is_int),
        "starRubric": sheet_rows(wb["Star_Rubric"], _is_int),
        "waveTable": sheet_rows(wb["Wave_Table"], _is_int),
        "resourceRoles": sheet_rows(wb["Resource_Roles"], lambda v: isinstance(v, str) and v.startswith("Map_")),
        "techTree": sheet_rows(wb["Tech_Tree"], lambda v: isinstance(v, str) and v.startswith("Faction_")),
        "questContract": sheet_rows(wb["Quest_Contract"], lambda v: isinstance(v, str) and (v.startswith("ACCEPT") or v.startswith("DECLINE"))),
    }

    # ── validations the GDD demands (fail loud, never ship broken data) ──
    problems = []
    if len(data["maps"]) != 9:
        problems.append(f"Maps sheet: expected 9 maps, got {len(data['maps'])}")
    if len(data["waveTable"]) != 72:
        problems.append(f"Wave_Table: expected 72 rows (9 maps x 8 waves), got {len(data['waveTable'])}")
    if len(data["resourceRoles"]) != 81:
        problems.append(f"Resource_Roles: expected 81 pairings, got {len(data['resourceRoles'])}")
    broken = [r for r in data["resourceRoles"] if str(r.get("Valid?", "")).lower() != "ok"]
    if broken:
        problems.append(f"Resource_Roles: {len(broken)} BROKEN pairings (GDD 5.2 requires 0)")
    for f in data["factions"]:
        if f.get("Premium_Secondary") == f.get("Premium_Resource"):
            problems.append(f"{f.get('Faction_Name')}: Premium_Secondary == Premium_Resource (GDD 5.2)")
    # every wave must open a real ring (GDD 3.2)
    for r in data["waveTable"]:
        if r.get("Wave") != 1 and isinstance(r.get("Ring_Area_Added"), (int, float)) and r["Ring_Area_Added"] <= 0:
            problems.append(f"Map {r.get('Map_ID')} wave {r.get('Wave')}: ring adds no tiles (GDD 3.2)")
    if problems:
        for p in problems:
            print("BROKEN:", p)
        sys.exit(1)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1)
    # ES-module twin so the sim (browser) and node tests import the same data with no fetch/fs split.
    with open(OUT[:-2], "w", encoding="utf-8") as fh:   # .json -> .js
        fh.write("// GENERATED by tools/extract_mapdata.py — edit the workbook, not this file.\n")
        fh.write("export const MAPDATA = ")
        json.dump(data, fh, indent=1)
        fh.write(";\n")
    print(f"OK -> {os.path.relpath(OUT, ROOT)} (+ .js module)")
    print(f"   maps={len(data['maps'])} waveRows={len(data['waveTable'])} roles={len(data['resourceRoles'])} "
          f"factions={len(data['factions'])} params={len(data['globalParams'])}")


if __name__ == "__main__":
    main()
