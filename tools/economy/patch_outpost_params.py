#!/usr/bin/env python3
"""patch_outpost_params.py — upsert rows of the Outpost_Params sheet in the map-data workbook [MM-task_mwcutmnk_3h].

    python tools/economy/patch_outpost_params.py      # adds / rewrites the ROWS below on Outpost_Params
    python tools/extract_mapdata.py                   # → MAPDATA.outpostParams.<Param>

Owner 2026-11-11: "the attacks on the outpost are supposed to be mild but they are crushing my base". The visit probes
(src/outpost/visitRaids.js) ran at the full step-1 raid strength; Probe_Strength scales their raid multipliers (see the
row's note and the PR's measurement).

Why a patch and not write_outpost_sheets.py: that writer recalculates through LibreOffice, which this machine does not
have (write_outpost_sheets.py PARAMS lists the same rows, so a full rewrite keeps them). This edits ONLY the
Outpost_Params sheet XML inside the .xlsx: a row whose Param cell (found by its HEADER NAME, never a fixed column)
already names a param has its Value/Unit/Notes rewritten; a missing param is appended as a new row of inline strings
(the shared-strings table is read, never written) and the sheet's <dimension> grows to cover it. It refuses to save
unless every other zip part is byte-identical, and it is idempotent: when the rows already hold these values it writes
nothing.
"""
import io
import os
import re
import sys
import zipfile
import xml.dom.minidom
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patch_tier_power_draw import sheet_path, shared_strings, cell_text, num, ROW, CELL  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
XLSX = os.path.join(ROOT, "docs", "sources", "Bulwark-Map-Data.xlsx")
SHEET = "Outpost_Params"
COLS = ("Param", "Value", "Unit", "Notes")
# Param → (Value, Unit, Notes). write_outpost_sheets.py PARAMS carries the same rows.
ROWS = {
    "Probe_Strength": (0.4, "x", "owner 2026-11-11 'the attacks on the outpost are supposed to be mild': a visit probe's "
                       "raiders fight at the planet's step-1 raid strength (Outpost_Raids Raider_HP_Mult, "
                       "Raider_Damage_Mult) times this; measured so the starter kit kills every probe losing < 25% HP "
                       "on any defense (src/outpost/visitRaids.test.mjs)"),
}


def inline(ref, text):
    return '<c r="%s" s="0" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>' % (ref, escape(text))


def number(ref, v):
    return '<c r="%s" s="0" t="n"><v>%s</v></c>' % (ref, v)


def patch_sheet(xml, sst):
    """→ (new xml, {param: 'added' | 'updated'})."""
    rows = list(ROW.finditer(xml))
    header = None
    for m in rows:
        names = {cell_text(c.group(0), sst): c.group(1) for c in CELL.finditer(m.group(0))}
        if all(c in names for c in COLS):
            header = (int(m.group(1)), names)
            break
    if not header:
        raise SystemExit("%s: no header row with %s" % (SHEET, ", ".join(COLS)))
    hrow, names = header
    col = {c: names[c] for c in COLS}
    seen, changed = set(), {}

    def want_cells(r, param):
        v, unit, notes = ROWS[param]
        return [inline(col["Param"] + str(r), param), number(col["Value"] + str(r), v),
                inline(col["Unit"] + str(r), unit), inline(col["Notes"] + str(r), notes)]

    def new_row(m):
        r, row = int(m.group(1)), m.group(0)
        if r <= hrow or row.endswith("/>"):
            return row
        cells = {c.group(1): c for c in CELL.finditer(row)}
        pc = cells.get(col["Param"])
        param = cell_text(pc.group(0), sst) if pc else None
        if param not in ROWS:
            return row
        if param in seen:
            raise SystemExit("%s: %s twice" % (SHEET, param))
        seen.add(param)
        v, unit, notes = ROWS[param]
        have = {k: cell_text(cells[col[k]].group(0), sst) if col[k] in cells else None for k in COLS}
        if num(have["Value"]) == v and have["Unit"] == unit and have["Notes"] == notes:
            return row
        changed[param] = "updated"
        open_tag = row[:row.index(">") + 1]
        return open_tag + "".join(want_cells(r, param)) + "</row>"

    out = ROW.sub(new_row, xml)
    last = max(int(m.group(1)) for m in rows)
    add = ""
    for param in ROWS:
        if param in seen:
            continue
        last += 1
        add += ('<row r="%d" customFormat="false" ht="15" hidden="false" customHeight="false" outlineLevel="0" '
                'collapsed="false">%s</row>') % (last, "".join(want_cells(last, param)))
        changed[param] = "added"
    if add:
        out = out.replace("</sheetData>", add + "</sheetData>", 1)
        dim = re.search(r'<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/>', out)
        if dim and int(dim.group(4)) < last:
            out = out[:dim.start()] + '<dimension ref="%s%s:%s%d"/>' % (dim.group(1), dim.group(2), dim.group(3), last) + out[dim.end():]
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
        print(SHEET, "already holds", ", ".join(ROWS), "in", os.path.relpath(path, ROOT), "- nothing written")
        return
    # every row but the ones we own is byte-identical
    keep = lambda x: [m.group(0) for m in ROW.finditer(x) if not any(">%s<" % escape(p) in m.group(0) for p in ROWS)]
    assert keep(before) == keep(after), "a row we do not own changed"
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
    for p, how in changed.items():
        print("  %s: %s (%s)" % (p, how, ROWS[p][0]))
    print(SHEET, "written in", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else XLSX)
