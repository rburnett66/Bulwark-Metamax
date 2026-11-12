#!/usr/bin/env python3
"""patch_tier_power_draw.py — upgraded tiers draw more power, in the map-data workbook [MM-story_mwcp7u7b_3a].

    python tools/economy/patch_tier_power_draw.py     # rewrites Power_Draw for the tiered kinds on Outpost_Structures
    python tools/extract_mapdata.py                   # → MAPDATA.outpostStructures[].Power_Draw

Owner 2026-11-11: "Tiers no [they don't count toward raid size] — but upgraded buildings can use more power requiring
upgraded power stations." Starting numbers (owner tunes): tier N draws N x the tier-I draw for the kinds that have
tiers and draw power (rig, storage, mg, cannon). Single-tier kinds and zero-draw kinds are not touched.

Why a patch and not write_outpost_sheets.py: that writer recalculates through LibreOffice, which this machine does not
have (write_outpost_sheets.py STRUCTS carries the same numbers, so a full rewrite keeps them). This edits ONLY the
<v> of the Power_Draw cells of the rows below, inside the Outpost_Structures sheet XML. The column is found by its
HEADER NAME and the rows by Kind + Tier — never by a fixed column letter or row number — so it keeps working after
another patch adds a column (patch_power_priority.py). It refuses to save unless every other zip part (and every
other cell) is byte-identical, and it is idempotent: when the cells already hold these numbers it writes nothing.
"""
import io
import os
import re
import sys
import zipfile
import xml.dom.minidom
from xml.sax.saxutils import unescape

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
XLSX = os.path.join(ROOT, "docs", "sources", "Bulwark-Map-Data.xlsx")
SHEET = "Outpost_Structures"
HEADER = "Power_Draw"
# (Kind, Tier) → Power_Draw. Tier N = N x tier I.
DRAW = {
    ("rig", 1): 4, ("rig", 2): 8,
    ("storage", 1): 1, ("storage", 2): 2,
    ("mg", 1): 1, ("mg", 2): 2, ("mg", 3): 3,
    ("cannon", 1): 1, ("cannon", 2): 2, ("cannon", 3): 3,
}

ROW = re.compile(r'<row r="(\d+)"[^>]*?(?:/>|>(.*?)</row>)', re.S)
CELL = re.compile(r'<c r="([A-Z]+)(\d+)"[^>]*?(?:/>|>.*?</c>)', re.S)


def sheet_path(z, name):
    wb = z.read("xl/workbook.xml").decode("utf-8")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    for tag in re.findall(r"<sheet [^>]*>", wb):
        if re.search(r'name="([^"]+)"', tag).group(1) != name:
            continue
        rid = re.search(r'r:id="([^"]+)"', tag).group(1)
        tgt = re.search(r'Id="%s"[^>]*Target="([^"]+)"' % re.escape(rid), rels) or \
            re.search(r'Target="([^"]+)"[^>]*Id="%s"' % re.escape(rid), rels)
        t = tgt.group(1)
        return t.lstrip("/") if t.startswith("/") else "xl/" + t
    raise SystemExit("no sheet " + name)


def shared_strings(z):
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    x = z.read("xl/sharedStrings.xml").decode("utf-8")
    return ["".join(unescape(t) for t in re.findall(r"<t[^>]*>(.*?)</t>", si, re.S))
            for si in re.findall(r"<si>(.*?)</si>", x, re.S)]


def cell_text(cell, sst):
    t = re.search(r'\bt="([^"]+)"', cell.split(">", 1)[0])
    t = t.group(1) if t else "n"
    if t == "s":
        return sst[int(re.search(r"<v>(\d+)</v>", cell).group(1))]
    if t == "inlineStr":
        return "".join(unescape(x) for x in re.findall(r"<t[^>]*>(.*?)</t>", cell, re.S))
    v = re.search(r"<v>(.*?)</v>", cell)
    return v.group(1) if v else ""


def num(s):
    try:
        f = float(s)
    except (TypeError, ValueError):
        return None
    return int(f) if f == int(f) else f


def patch_sheet(xml, sst):
    """→ (new xml, {(kind, tier): (old, new)} for the cells rewritten). Raises when a target row is missing."""
    rows = list(ROW.finditer(xml))
    header = None
    for m in rows:
        names = {cell_text(c.group(0), sst): c.group(1) for c in CELL.finditer(m.group(0))}
        if "Kind" in names and "Tier" in names and HEADER in names:
            header = (int(m.group(1)), names)
            break
    if not header:
        raise SystemExit("%s: no header row with Kind, Tier and %s" % (SHEET, HEADER))
    hrow, names = header
    kind_col, tier_col, draw_col = names["Kind"], names["Tier"], names[HEADER]
    seen, changed = set(), {}

    def new_row(m):
        r, row = int(m.group(1)), m.group(0)
        if r <= hrow or row.endswith("/>"):
            return row
        cells = {c.group(1): c for c in CELL.finditer(row)}
        if kind_col not in cells or tier_col not in cells:
            return row
        key = (cell_text(cells[kind_col].group(0), sst), num(cell_text(cells[tier_col].group(0), sst)))
        if key not in DRAW:
            return row
        if key in seen:
            raise SystemExit("%s: %s tier %s twice" % (SHEET, key[0], key[1]))
        seen.add(key)
        c = cells.get(draw_col)
        if not c:
            raise SystemExit("%s: %s tier %s has no %s cell" % (SHEET, key[0], key[1], HEADER))
        cell = c.group(0)
        typ = re.search(r'\bt="([^"]+)"', cell.split(">", 1)[0])
        if (typ and typ.group(1) != "n") or not re.search(r"<v>[^<]*</v>", cell):
            raise SystemExit("%s: %s tier %s %s is not a number cell: %s" % (SHEET, key[0], key[1], HEADER, cell))
        old = num(re.search(r"<v>([^<]*)</v>", cell).group(1))
        want = DRAW[key]
        if old == want:
            return row
        changed[key] = (old, want)
        new_cell = re.sub(r"<v>[^<]*</v>", "<v>%s</v>" % want, cell, count=1)
        return row[:c.start()] + new_cell + row[c.end():]

    out = ROW.sub(new_row, xml)
    missing = set(DRAW) - seen
    if missing:
        raise SystemExit("%s: rows not found: %s" % (SHEET, sorted(missing)))
    return out, changed


def other_cells(xml):
    """Every cell but the Power_Draw ones we may touch, for the 'nothing else changed' check."""
    return [m.group(0) for m in CELL.finditer(xml)]


def main(path=XLSX):
    with open(path, "rb") as f:
        raw = f.read()
    zin = zipfile.ZipFile(io.BytesIO(raw))
    part = sheet_path(zin, SHEET)
    sst = shared_strings(zin)
    before = zin.read(part).decode("utf-8")
    after, changed = patch_sheet(before, sst)
    if not changed:
        print("Power_Draw already holds the tier draws in", os.path.relpath(path, ROOT), "- nothing written")
        return
    # only the changed cells' <v> differ: same cell count, and every other cell byte-identical
    a, b = other_cells(before), other_cells(after)
    assert len(a) == len(b), "cell count changed"
    diff = [i for i, (x, y) in enumerate(zip(a, b)) if x != y]
    assert len(diff) == len(changed), "more cells changed than asked: %d vs %d" % (len(diff), len(changed))
    assert re.sub(r"<v>[^<]*</v>", "", before) == re.sub(r"<v>[^<]*</v>", "", after), "markup outside <v> changed"
    xml.dom.minidom.parseString(after)   # well-formed
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zout:
        for info in zin.infolist():
            data = after.encode("utf-8") if info.filename == part else zin.read(info.filename)
            out = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            out.compress_type, out.external_attr, out.create_system = info.compress_type, info.external_attr, info.create_system
            zout.writestr(out, data)
    check = zipfile.ZipFile(io.BytesIO(buf.getvalue()))
    assert [i.filename for i in check.infolist()] == [i.filename for i in zin.infolist()], "part list changed"
    for info in zin.infolist():
        if info.filename != part:
            assert check.read(info.filename) == zin.read(info.filename), "part changed: " + info.filename
    assert check.read(part).decode("utf-8") == after
    with open(path, "wb") as f:
        f.write(buf.getvalue())
    for (k, t), (o, n) in sorted(changed.items()):
        print("  %s tier %s: Power_Draw %s -> %s" % (k, t, o, n))
    print("Power_Draw written to", SHEET, "in", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else XLSX)
