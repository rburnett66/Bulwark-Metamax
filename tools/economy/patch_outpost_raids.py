#!/usr/bin/env python3
"""patch_outpost_raids.py — outpost raiders are troopers only, in the map-data workbook [MM-task_mwd2qc3c_4].

    python tools/economy/patch_outpost_raids.py       # rewrites the Units cell of every Outpost_Raids row
    python tools/extract_mapdata.py                   # → MAPDATA.outpostRaids[].Units → raidFor().units

Owner playtest 2026-11-12 (v2026.11.12-d): "base is getting attacked by heavy tanks, juggernauts". Owner rule
(TECH_PLAN::One-Battle-UX.md §5b): outpost raids are "very simple .. low level raids"; a bigger base brings MORE
FREQUENT raids, never stronger ones. The tanks the owner saw were each faction's Assault Tank (GND-Tanks: the
Shield Tank carrier, "Heavy armor", 2x a trooper's HP, drawn as the twin-barrel MBT) — the Units cycle was
"troops, troops, tank", and the visit probe picked the tank FIRST (60% of the probe raiders were tanks). The battle's
own light opening (sim/campaign.js LIGHT_WAVES: waves 1-2 are troops and scouts, assault tanks join from wave 3) is the
low level the owner means; an outpost raid now fields the planet's troops only. Sizes and multipliers are untouched
(more troopers is a sizes retune, measured by tools/economy/outpost_raids.mjs, which now composes troops only too).

Why a patch and not write_outpost_raids.py: that writer recalculates through LibreOffice, which this machine does not
have. This edits ONLY the Units cell of each planet's row inside the Outpost_Raids sheet XML: the Planet_Key and Units
columns are found by their HEADER NAMES, never fixed letters, and the cell is rewritten as an inline string (the
shared-strings table is read, never written). It refuses to save unless every other zip part is byte-identical, and it
is idempotent: when the cells already hold these units it writes nothing.
"""
import io
import os
import sys
import zipfile
import xml.dom.minidom
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patch_tier_power_draw import sheet_path, shared_strings, cell_text, ROW, CELL  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
XLSX = os.path.join(ROOT, "docs", "sources", "Bulwark-Map-Data.xlsx")
SHEET = "Outpost_Raids"
# Planet_Key → Units (the raid's cycle, spawn order). Troopers only: the planet's own tier I troops.
UNITS = {
    "ground": "GND-Troops", "air": "AIR-Troops", "hightech": "HTC-Troops", "artillery": "ART-Troops",
    "water": "WTR-Troops", "arcane": "ARC-Troops", "space": "SPC-Troops", "dark": "DRK-Troops",
    "greenies": "GRN-Troops",
}


def patch_sheet(xml, sst):
    """→ (new xml, {planet: (old, new)} for the cells rewritten). Raises when a planet row is missing."""
    rows = list(ROW.finditer(xml))
    header = None
    for m in rows:
        names = {cell_text(c.group(0), sst): c.group(1) for c in CELL.finditer(m.group(0))}
        if "Planet_Key" in names and "Units" in names:
            header = (int(m.group(1)), names)
            break
    if not header:
        raise SystemExit("%s: no header row with Planet_Key and Units" % SHEET)
    hrow, names = header
    key_col, units_col = names["Planet_Key"], names["Units"]
    seen, changed = set(), {}

    def new_row(m):
        r, row = int(m.group(1)), m.group(0)
        if r <= hrow or row.endswith("/>"):
            return row
        cells = {c.group(1): c for c in CELL.finditer(row)}
        if key_col not in cells:
            return row
        planet = cell_text(cells[key_col].group(0), sst)
        if planet not in UNITS:
            return row
        if planet in seen:
            raise SystemExit("%s: %s twice" % (SHEET, planet))
        seen.add(planet)
        c = cells.get(units_col)
        if not c:
            raise SystemExit("%s: %s has no Units cell" % (SHEET, planet))
        old, want = cell_text(c.group(0), sst), UNITS[planet]
        if old == want:
            return row
        changed[planet] = (old, want)
        head = c.group(0).split(">", 1)[0]
        style = ' s="%s"' % head.split(' s="', 1)[1].split('"', 1)[0] if ' s="' in head else ""
        cell = '<c r="%s%d"%s t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>' % (units_col, r, style, escape(want))
        return row[:c.start()] + cell + row[c.end():]

    out = ROW.sub(new_row, xml)
    missing = set(UNITS) - seen
    if missing:
        raise SystemExit("%s: planet rows not found: %s" % (SHEET, sorted(missing)))
    return out, changed


def main(path=XLSX):
    with open(path, "rb") as f:
        raw = f.read()
    zin = zipfile.ZipFile(io.BytesIO(raw))
    part = sheet_path(zin, SHEET)
    sst = shared_strings(zin)
    before = zin.read(part).decode("utf-8")
    after, changed = patch_sheet(before, sst)
    if not changed:
        print("Outpost_Raids already holds troops-only Units in", os.path.relpath(path, ROOT), "- nothing written")
        return
    # every cell but the Units cells we own is byte-identical
    units_col = None
    for m in ROW.finditer(before):
        names = {cell_text(c.group(0), sst): c.group(1) for c in CELL.finditer(m.group(0))}
        if "Planet_Key" in names and "Units" in names:
            units_col, hrow = names["Units"], int(m.group(1))
            break
    keep = lambda x: [c.group(0) for c in CELL.finditer(x) if not (c.group(1) == units_col and int(c.group(2)) > hrow)]
    assert keep(before) == keep(after), "a cell we do not own changed"
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
    for p, (old, new) in changed.items():
        print("  %s: %r -> %r" % (p, old, new))
    print("Outpost_Raids written in", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else XLSX)
