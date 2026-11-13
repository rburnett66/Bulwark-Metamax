#!/usr/bin/env python3
"""patch_farm_method_pods.py — a plot takes one seed pod per plant: Pods_Per 16 on Farm_Methods [MM-story_mwelnbfc_1].

    python tools/economy/patch_farm_method_pods.py    # rewrites Pods_Per of the methods below on Farm_Methods
    python tools/economy/patch_farm_params.py         # Pods_Per_Plot 16 on Farm_Params
    python tools/extract_mapdata.py                   # → MAPDATA.farmMethods[].Pods_Per / farmParams.Pods_Per_Plot

Owner 2026-11-12: "when I plant a plot with seed pods but I only have 7 pods I should only see 7 plants" — chose
1 pod = 1 plant: a plot holds up to 16 plants (its 4 × 4 spots), planting uses as many pods as held up to that, and the
harvest scales with how full it is. The same header-name, byte-identical-elsewhere, idempotent patch as
patch_tier_power_draw.py, keyed by the Method column (write_farm_sheets.py METHODS carries the same numbers).
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import patch_tier_power_draw as P  # noqa: E402

SHEET, HEADER = "Farm_Methods", "Pods_Per"
PODS = {"traditional": 16, "irrigated": 16}


def patch_sheet(xml, sst):
    rows = list(P.ROW.finditer(xml))
    header = None
    for m in rows:
        names = {P.cell_text(c.group(0), sst): c.group(1) for c in P.CELL.finditer(m.group(0))}
        if "Method" in names and HEADER in names:
            header = (int(m.group(1)), names)
            break
    if not header:
        raise SystemExit("%s: no header row with Method and %s" % (SHEET, HEADER))
    hrow, names = header
    key_col, val_col = names["Method"], names[HEADER]
    seen, changed = set(), {}

    def new_row(m):
        r, row = int(m.group(1)), m.group(0)
        if r <= hrow or row.endswith("/>"):
            return row
        cells = {c.group(1): c for c in P.CELL.finditer(row)}
        if key_col not in cells:
            return row
        key = P.cell_text(cells[key_col].group(0), sst)
        if key not in PODS:
            return row
        seen.add(key)
        c = cells[val_col]
        cell = c.group(0)
        old = P.num(re.search(r"<v>([^<]*)</v>", cell).group(1))
        if old == PODS[key]:
            return row
        changed[(key, "")] = (old, PODS[key])
        return row[:c.start()] + re.sub(r"<v>[^<]*</v>", "<v>%s</v>" % PODS[key], cell, count=1) + row[c.end():]

    out = P.ROW.sub(new_row, xml)
    if set(PODS) - seen:
        raise SystemExit("%s: rows not found: %s" % (SHEET, sorted(set(PODS) - seen)))
    return out, changed


P.SHEET, P.patch_sheet = SHEET, patch_sheet

if __name__ == "__main__":
    P.main(sys.argv[1] if len(sys.argv) > 1 else P.XLSX)
