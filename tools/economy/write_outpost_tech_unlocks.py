#!/usr/bin/env python3
"""write_outpost_tech_unlocks.py — the Outpost tech nodes in the Missions workbook [MM-story_mw5oem5o_r].

    python tools/economy/write_outpost_sheets.py         # the map-data workbook's Outpost_Tech sheet (the source)
    python tools/extract_mapdata.py                      # → MAPDATA.outpostTech (src/data/techtree.js reads it)
    python tools/economy/write_outpost_tech_unlocks.py   # this: Tech_Unlocks rows + the Economy sheet's Outpost line
    python tools/extract_missions.py                     # → content/missions/missions.json techUnlocks

Story O10 replaces the tech tree's five Outpost ghosts (op0–op4) with the seven Outpost nodes (Outpost-Design §7). The
Missions workbook mirrors the tree on its Tech_Unlocks sheet, which the Economy sheet sums. This script:
  - replaces every `outpost` division row of Tech_Unlocks with one row per node of the map-data workbook's
    Outpost_Tech sheet (id, name, price, requires), keeping every other row and re-numbering its formulas;
  - puts an Outpost line on the Economy sheet (row 10): the cost of the seven nodes, kept OUT of the "100 % of the
    tree" total, as the owner asked on 2026-11-02 ("leave out Outpost upgrades"), and the note under it.
Then LibreOffice recalculates the workbook; it is refused if any sheet but Tech_Unlocks and Economy changes value
(compared with the unchanged workbook recalculated the same way: the committed file carries no cached values).
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MISSIONS = os.path.join(ROOT, "docs", "sources", "Bulwark-Missions.xlsx")
MAPDATA = os.path.join(ROOT, "docs", "sources", "Bulwark-Map-Data.xlsx")
CHANGES = {"Tech_Unlocks", "Economy"}


def values(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    return {ws.title: [tuple(r) for r in ws.iter_rows(values_only=True)] for ws in wb}


def outpost_tech():
    ws = openpyxl.load_workbook(MAPDATA, data_only=True)["Outpost_Tech"]
    rows, head = [], None
    for r in ws.iter_rows(values_only=True):
        if head is None:
            if r and r[0] == "Node":
                head = list(r)
            continue
        if r[0] and str(r[0]).isidentifier():
            rows.append(dict(zip(head, r)))
    if not rows:
        sys.exit("Outpost_Tech is empty: run tools/economy/write_outpost_sheets.py first")
    return rows


def renumber(v, old, new):
    """A row's own formula moved from row `old` to `new`: A66 → A68 (absolute $A:$A columns untouched)."""
    if not (isinstance(v, str) and v.startswith("=")) or old == new:
        return v
    return re.sub(r"(?<![$A-Za-z])([A-N])" + str(old) + r"(?!\d)", lambda m: m.group(1) + str(new), v)


def main():
    soffice = shutil.which("soffice")
    if not soffice:
        sys.exit("soffice (LibreOffice) is needed to recalculate the workbook; open+save it in Excel instead")
    # the workbook is saved without cached values (openpyxl), so "before" is the unchanged workbook recalculated too
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([soffice, "--headless", "--calc", "--convert-to", "xlsx", "--outdir", tmp, MISSIONS],
                       check=True, capture_output=True)
        before = values(os.path.join(tmp, os.path.basename(MISSIONS)))
    wb = openpyxl.load_workbook(MISSIONS)
    ws = wb["Tech_Unlocks"]
    ncol = ws.max_column
    head = [c.value for c in ws[1]]
    col = {h: i for i, h in enumerate(head)}
    old = [(r, [c.value for c in ws[r]]) for r in range(2, ws.max_row + 1) if ws.cell(r, 1).value]
    template = next(v for r, v in old if v[col["Division"]] == "outpost")   # the ghost row's formulas (H, M, N)
    tmpl_row = next(r for r, v in old if v[col["Division"]] == "outpost")
    keep, insert_at = [], None
    for r, v in old:
        if v[col["Division"]] == "outpost":
            insert_at = len(keep) if insert_at is None else insert_at
            continue
        keep.append((r, v))
    new_rows = []
    for t in outpost_tech():
        v = [None] * ncol
        v[col["Node"]], v[col["Name"]], v[col["Division"]], v[col["Kind"]] = t["Node"], t["Name"], "outpost", "item"
        v[col["Gold price (game)"]] = t["Price"]
        v[col["Requires (game)"]] = " + ".join(str(t.get("Requires") or "").split()) or None
        for k in ("Unlocked by mission", "Effective price", "In 100 % total"):
            v[col[k]] = template[col[k]]
        new_rows.append((tmpl_row, v))
    rows = keep[:insert_at] + new_rows + keep[insert_at:]
    ws.delete_rows(2, ws.max_row)
    for i, (r0, v) in enumerate(rows, 2):
        for j, x in enumerate(v, 1):
            ws.cell(i, j, renumber(x, r0, i))

    ec = wb["Economy"]
    ec["A10"] = "Outpost (7 nodes, Outpost-Design §7) — bought with outpost income, kept out of the 100 % total"
    ec["B10"] = '=SUMIFS(Tech_Unlocks!$M:$M,Tech_Unlocks!$C:$C,"outpost")'
    ec["A11"] = ("Left out of the 100 % total: the Outpost line above (owner 2026-11-02: leave out Outpost upgrades), "
                 "Ships (coming soon), the free starting kit, the Map 3 milestone.")

    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "raw.xlsx")
        wb.save(raw)
        out = os.path.join(tmp, "out")
        subprocess.run([soffice, "--headless", "--calc", "--convert-to", "xlsx", "--outdir", out, raw],
                       check=True, capture_output=True)
        calc = os.path.join(out, "raw.xlsx")
        after = values(calc)
        changed = [t for t in before if before[t] != after.get(t) and t not in CHANGES]
        if changed:
            sys.exit(f"recalculation changed other sheets' values: {changed} — workbook left untouched")
        econ = {r[0]: r[1] for r in after["Economy"] if r and r[0]}
        shutil.copyfile(calc, MISSIONS)
    print(f"OK -> {os.path.relpath(MISSIONS, ROOT)} › Tech_Unlocks ({len(new_rows)} Outpost rows), Economy Outpost line "
          f"= {econ.get(ec['A10'].value)}; 100 % total = {econ.get('Total — 100 % of the tree')}; now run tools/extract_missions.py")


if __name__ == "__main__":
    main()
