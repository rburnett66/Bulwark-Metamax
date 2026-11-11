#!/usr/bin/env python3
"""patch_power_priority.py — put the Power_Priority column into the map-data workbook [MM-subtask_mwco9m19_39].

    python tools/economy/patch_power_priority.py      # adds / rewrites Power_Priority on Outpost_Structures + Farm_Buildings
    python tools/extract_mapdata.py                   # → MAPDATA.outpostStructures[].Power_Priority, .farmBuildings[].Power_Priority

Owner 2026-11-11 (#282 answer 4): who gets power first on a short grid is a WORKBOOK column, not a code constant.
Lower serves first; a blank cell is "unlisted" and serves last (data/outpost.js powerPriority). The values are the
constant this replaces (design §4.5, One Battle UX §5.2). The farm buildings are consumers on the same grids (owner
rule 7), so Farm_Buildings carries the column too.

Why a patch and not write_outpost_sheets.py: that writer recalculates through LibreOffice, which this machine does not
have. This edits ONLY the two sheets' XML inside the .xlsx (inline strings; the shared-strings table is read, never
written), and refuses to save unless every other zip part is byte-identical. Idempotent: run it again (e.g. on a
workbook another branch changed) and it rewrites the column in place. The writers (write_outpost_sheets.py,
write_farm_sheets.py) list the same column, so a full rewrite keeps it.
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
HEADER = "Power_Priority"
HEADER_ROW = 4
# kind → priority (lower first). Unlisted kinds (power, pylon: grid nodes; wall: draws nothing; harvester: not a
# building on the grid) stay blank.
PRIORITY = {"hub": 0, "storage": 1, "rig": 2, "mg": 3, "cannon": 3, "resourceBay": 4, "upgradeBay": 5,
            "habitat": 6, "farmhouse": 7, "silo": 7, "pump": 8}
SHEETS = ("Outpost_Structures", "Farm_Buildings")


def col_name(i):  # 0 → A
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def col_index(name):
    n = 0
    for ch in name:
        n = n * 26 + ord(ch) - 64
    return n - 1


def sheet_paths(z):
    wb = z.read("xl/workbook.xml").decode("utf-8")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    out = {}
    for tag in re.findall(r"<sheet [^>]*>", wb):
        name = re.search(r'name="([^"]+)"', tag).group(1)
        rid = re.search(r'r:id="([^"]+)"', tag).group(1)
        tgt = re.search(r'Id="%s"[^>]*Target="([^"]+)"' % re.escape(rid), rels) or \
            re.search(r'Target="([^"]+)"[^>]*Id="%s"' % re.escape(rid), rels)
        t = tgt.group(1)
        out[name] = t.lstrip("/") if t.startswith("/") else "xl/" + t
    return out


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


CELL = re.compile(r'<c r="([A-Z]+)(\d+)"[^>]*?(?:/>|>.*?</c>)', re.S)


def patch_sheet(xml, sst):
    rows = list(re.finditer(r'<row r="(\d+)"[^>]*?(?:/>|>(.*?)</row>)', xml, re.S))
    header = next((m for m in rows if int(m.group(1)) == HEADER_ROW), None)
    if not header:
        raise SystemExit("no header row %d" % HEADER_ROW)
    cells = list(CELL.finditer(header.group(0)))
    names = {cell_text(c.group(0), sst): col_index(c.group(1)) for c in cells}
    if "Kind" not in names:
        raise SystemExit("no Kind column")
    col = names.get(HEADER, max(col_index(c.group(1)) for c in cells) + 1)
    letter, kind_col = col_name(col), col_name(names["Kind"])
    style = re.search(r'\bs="(\d+)"', cells[0].group(0))
    s_attr = ' s="%s"' % style.group(1) if style else ""

    def new_row(m):
        r = int(m.group(1))
        row = m.group(0)
        if row.endswith("/>") or r < HEADER_ROW:
            return row
        body = [c for c in CELL.finditer(row) if c.group(1) != letter]   # drop an old Power_Priority cell
        if r == HEADER_ROW:
            add = '<c r="%s%d"%s t="inlineStr"><is><t>%s</t></is></c>' % (letter, r, s_attr, HEADER)
        else:
            kind = next((cell_text(c.group(0), sst) for c in body if c.group(1) == kind_col), "")
            p = PRIORITY.get(kind)
            add = '<c r="%s%d"%s t="n"><v>%d</v></c>' % (letter, r, s_attr, p) if p is not None else ""
        cs = [(col_index(c.group(1)), c.group(0)) for c in body]
        if add:
            cs.append((col, add))
        cs.sort(key=lambda x: x[0])
        open_tag = re.match(r"<row[^>]*>", row).group(0)
        return open_tag + "".join(c for _, c in cs) + "</row>"

    out = re.sub(r'<row r="(\d+)"[^>]*?(?:/>|>(.*?)</row>)', new_row, xml, flags=re.S)
    # widen the sheet's dimension when the column is new
    dim = re.search(r'<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/>', out)
    if dim and col_index(dim.group(3)) < col:
        out = out.replace(dim.group(0), '<dimension ref="%s%s:%s%s"/>' % (dim.group(1), dim.group(2), letter, dim.group(4)))
    return out


def main(path=XLSX):
    with open(path, "rb") as f:
        raw = f.read()
    zin = zipfile.ZipFile(io.BytesIO(raw))
    paths = sheet_paths(zin)
    sst = shared_strings(zin)
    targets = {paths[n]: n for n in SHEETS}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename in targets:
                data = patch_sheet(data.decode("utf-8"), sst).encode("utf-8")
            out = zipfile.ZipInfo(info.filename, date_time=info.date_time)   # a copy: writestr rewrites the
            out.compress_type, out.external_attr, out.create_system = info.compress_type, info.external_attr, info.create_system  # one it is given
            zout.writestr(out, data)
    # verify: every other part byte-identical, the patched sheets parse and carry the column
    check = zipfile.ZipFile(io.BytesIO(buf.getvalue()))
    assert [i.filename for i in check.infolist()] == [i.filename for i in zin.infolist()], "part list changed"
    for info in zin.infolist():
        if info.filename not in targets:
            assert check.read(info.filename) == zin.read(info.filename), "part changed: " + info.filename
    for part, name in targets.items():
        x = check.read(part).decode("utf-8")
        assert ">%s<" % HEADER in x, name + ": no header"
        xml.dom.minidom.parseString(x)   # well-formed
    with open(path, "wb") as f:
        f.write(buf.getvalue())
    print("Power_Priority written to", ", ".join(SHEETS), "in", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else XLSX)
