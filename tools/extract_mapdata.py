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


# ── MAP-SIZE REWORK (owner, 2026-07-13, rev 2): the whole map is playable from wave 1 (open play),
# so these are the true per-map play areas. Owner specified maps 1-3 (24x16, 30x18, 34x20); the rest
# complete the pattern (width alternates +6/+4, height +2 per map) landing exactly on 64x32 at map 9.
# Lives here rather than in the workbook because openpyxl cannot recompute the derived sheets — fold
# these into the Maps sheet in Excel when convenient (values here win until then).
REWORK_DIMS = {1: (24, 16), 2: (30, 18), 3: (34, 20), 4: (40, 22), 5: (44, 24),
               6: (50, 26), 7: (54, 28), 8: (60, 30), 9: (64, 32)}


def playable_dims(full_w, full_h, fracs):
    """Per-wave playable dims from the growth curve, honoring the GDD's hard rules (§3.1-3.2):
    every wave adds real area (≥2 tiles on an axis), rings never shrink, wave 8 = the full map,
    waves 1-7 always leave something to reveal. Even-rounded so concentric rects stay centered."""
    dims = []
    for i, f in enumerate(fracs):
        w = max(8, 2 * round(full_w * f / 2))
        h = max(6, 2 * round(full_h * f / 2))
        if i:
            pw, ph = dims[-1]
            w, h = max(w, pw), max(h, ph)
            if w < pw + 2 and h < ph + 2:          # no real growth — force the width rule
                if pw + 2 <= full_w:
                    w = pw + 2
                elif ph + 2 <= full_h:
                    h = ph + 2
        w, h = min(w, full_w), min(h, full_h)
        if i < 7 and w >= full_w and h >= full_h:  # waves 1-7 must leave wave 8 a reveal
            w = full_w - 2
        dims.append((w, h))
    dims[7] = (full_w, full_h)                     # wave 8: exactly the full map, no remainder
    return dims


def apply_rework(data):
    gp = data["globalParams"]
    # Owner tuning history: regrow rate halved (75s -> 150s), then reduced another 75%
    # (150s -> 600s). Net: primaries regrow at 1/8 the workbook rate — big merged fields can
    # no longer sustain a perpetual farm ahead of the story-4 time bonus.
    gp["Primary_Respawn_Sec"] = round((gp.get("Primary_Respawn_Sec") or 75) * 8)
    setback = gp.get("Spawn_Setback", 2)
    per100 = gp.get("Par_Time_Per_100_Tiles", 42)
    waves_per_map = gp.get("Waves_Per_Map", 8)
    fracs = [g["Linear_Fraction"] for g in sorted(data["growthCurve"], key=lambda g: g["Wave"])]
    by_map = {}
    for m in data["maps"]:
        w, h = REWORK_DIMS.get(m["Map_ID"], (m["Full_W"], m["Full_H"]))
        m["Full_W"], m["Full_H"] = w, h
        m["Full_Area"] = w * h
        m["Par_Time_Sec"] = round(per100 * m["Full_Area"] / 100 * waves_per_map)
        by_map[m["Map_ID"]] = m
    # recompute the dims-derived Wave_Table columns; budgets / sides / node counts stay authored
    for m in data["maps"]:
        dims = playable_dims(m["Full_W"], m["Full_H"], fracs)
        rows = sorted([r for r in data["waveTable"] if r["Map_ID"] == m["Map_ID"]], key=lambda r: r["Wave"])
        prev_area = 0
        for r, (pw, ph) in zip(rows, dims):
            r["Playable_W"], r["Playable_H"] = pw, ph
            r["Playable_Area"] = pw * ph
            r["Ring_Area_Added"] = pw * ph - prev_area
            prev_area = pw * ph
            r["Spawn_Dist_X"] = pw // 2 + setback
            r["Spawn_Dist_Y"] = ph // 2 + setback
            r["Wave_Par_Sec"] = max(15, round(per100 * pw * ph / 100))
    return data


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

    apply_rework(data)

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
