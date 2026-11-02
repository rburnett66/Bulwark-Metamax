"""Dark capital ship — low-poly, from ref/dark.jpg.

    python3 tools/blender/ships/dark.py [out_dir] [--no-render]

Read of the reference: a long, low, wide black slab bristling with spikes; three tall faceted crystal
spires on top (one on the centreline, a mirrored pair aft) each with a glowing violet eye; tall hanging
banner pylons with violet diamonds; rows of downward spikes and fins under the keel; violet glow lines
along the rim. Near-black hull with gunmetal trim so the silhouette still reads. Modelled port-side +
centreline only — the build mirrors it.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import _obj, box, build, cyl, engine, loft, mat  # noqa: E402  (imports bpy before bmesh)
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402


def diamond(name, center, hw, hh, depth, material, axis="Y"):
    """A flat rhombus plate (the reference's eye/diamond glyph). axis: the plate's normal (X or Y)."""
    x, y, z = center
    bm = bmesh.new()
    rings = []
    for d in (-depth / 2, depth / 2):
        ring = []
        for u, v in ((hw, 0), (0, hh), (-hw, 0), (0, -hh)):
            p = (x + d, y + u, z + v) if axis == "X" else (x + u, y + d, z + v)
            ring.append(bm.verts.new(Vector(p)))
        rings.append(ring)
    for i in range(4):
        bm.faces.new((rings[0][i], rings[0][(i + 1) % 4], rings[1][(i + 1) % 4], rings[1][i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material)


def spike(name, base, length, r, material, sides=4, down=False, lean=(0.0, 0.0)):
    """A tapered point from base (x, y, z) up (or down) by length, optionally leaning in x / y."""
    bm = bmesh.new()
    bx, by, bz = base
    sg = -1 if down else 1
    ring = []
    for i in range(sides):
        a = 2 * math.pi * (i + 0.5) / sides
        ring.append(bm.verts.new(Vector((bx + r * math.cos(a), by + r * math.sin(a), bz))))
    tip = bm.verts.new(Vector((bx + lean[0], by + lean[1], bz + sg * length)))
    for i in range(sides):
        bm.faces.new((ring[i], ring[(i + 1) % sides], tip))
    bm.faces.new(list(reversed(ring)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material)


def spire(name, x, y, z0, scale, hull, trim, glow):
    """Faceted crystal spire: flared skirt → steep shaft → pyramid cap, with a violet eye facing port."""
    s = scale
    # a broad flared base sweeping up into a slim faceted point, like the reference's crystal pyramids
    cyl(name + "_skirt", (x, y, z0 + 0.6 * s), 2.5 * s, 1.2 * s, hull, sides=4, axis="Z", r1=1.15 * s)
    cyl(name + "_shaft", (x, y, z0 + 1.2 * s + 1.1 * s), 1.15 * s, 2.2 * s, hull, sides=4, axis="Z", r1=0.62 * s)
    cyl(name + "_collar", (x, y, z0 + 3.42 * s), 0.66 * s, 0.1 * s, trim, sides=4, axis="Z")
    spike(name + "_cap", (x, y, z0 + 3.4 * s), 3.0 * s, 0.62 * s * math.sqrt(2), hull, sides=4)
    # the eye sits on the port face of the shaft near its top, plus a slit running down
    face = 0.68 * s / math.sqrt(2) + 0.04
    diamond(name + "_eye", (x, y + face, z0 + 2.95 * s), 0.15 * s, 0.36 * s, 0.05, glow)
    box(name + "_slit", (x, y + face + 0.08, z0 + 1.85 * s), (0.05, 0.05, 1.2 * s), glow)
    # and one on the bow face, so the spire glows from the front too
    diamond(name + "_eye_f", (x + face, y, z0 + 2.95 * s), 0.13 * s, 0.3 * s, 0.05, glow, axis="X")
    # thorns ringing the skirt
    for dx, dy in ((1.9, 0.5), (-1.9, 0.5), (0.5, 1.9), (-0.6, 1.85), (1.4, 1.4), (-1.4, 1.4)):
        spike(name + "_thorn", (x + dx * s, y + dy * s, z0 + 0.1 * s), 1.1 * s, 0.11 * s, hull, lean=(dx * 0.12, dy * 0.12))


# hull plan: (x, half-width, half-height, chamfer, cy, cz)
HULL = [(11.6, 0.25, 0.14, 0.1, 0, 0.05), (9.4, 1.8, 0.42, 0.3, 0, 0.0), (6.0, 3.0, 0.58, 0.36, 0, 0.0),
        (3.0, 3.4, 0.7, 0.4, 0, 0.0), (-6.0, 3.4, 0.7, 0.4, 0, 0.0), (-9.4, 2.6, 0.55, 0.34, 0, 0.0),
        (-10.8, 2.0, 0.5, 0.3, 0, 0.0)]


def rim_w(x):
    """Hull half-width at x (linear between plan stations)."""
    for (x0, w0, *_), (x1, w1, *_) in zip(HULL, HULL[1:]):
        if x1 <= x <= x0:
            return w1 + (w0 - w1) * (x - x1) / (x0 - x1)
    return HULL[-1][1]


def make():
    hull = mat("hull", (0.028, 0.022, 0.04), rough=0.45, metal=0.35)
    trim = mat("trim", (0.16, 0.155, 0.18), rough=0.4, metal=0.5)
    glow = mat("glow", (0.4, 0.1, 0.8), emit=(0.42, 0.1, 0.9), strength=8)

    # the slab: long, low, wide, pointed at both ends
    loft("hull", HULL, hull, bevel=0.03)
    # gunmetal ledge around the top edge and a violet line around the waist
    loft("ledge", [(x, w + 0.06, 0.06, 0, 0, 0.32 * h / 0.62) for x, w, h, *_ in HULL], trim)
    loft("rim_glow", [(x + (0.06 if i == 0 else 0), w + 0.1, 0.035, 0, 0, -0.02) for i, (x, w, *_) in enumerate(HULL)],
         glow)
    # dorsal mound swelling up toward the spires
    loft("deck", [(9.6, 0.7, 0.12, 0.08, 0, 0.55), (6.5, 1.9, 0.4, 0.35, 0, 0.8), (3.0, 2.5, 0.55, 0.5, 0, 0.95),
                  (-7.0, 2.5, 0.55, 0.5, 0, 0.95), (-10.3, 1.6, 0.35, 0.3, 0, 0.7)], hull, bevel=0.03)
    # ventral mound
    loft("belly", [(9.0, 0.8, 0.14, 0.1, 0, -0.55), (5.5, 2.2, 0.45, 0.4, 0, -0.8), (-7.0, 2.4, 0.5, 0.45, 0, -0.85),
                   (-10.2, 1.5, 0.3, 0.25, 0, -0.6)], hull)
    box("keel_glow", (-0.5, 1.2, -1.36), (14.0, 0.06, 0.04), glow)

    # window band along the flat stretch of the side
    for i in range(10):
        x = 2.4 - i * 0.85
        box("window", (x, 3.41, 0.12), (0.42, 0.04, 0.12), glow)
    box("side_band", (-1.5, 3.41, -0.18), (9.0, 0.05, 0.16), trim)

    # three crystal spires — the signature: centreline fore, mirrored pair aft
    spire("spire_c", 2.6, 0.0, 1.2, 1.25, hull, trim, glow)
    spire("spire_p", -5.4, 1.4, 0.9, 1.05, hull, trim, glow)
    box("spine_glow", (-1.0, 0.45, 1.52), (14.0, 0.05, 0.03), glow)

    # thorns along the dorsal rim
    for i, x in enumerate((9.6, 8.6, 7.6, 6.6, 5.6, 4.6, 0.9, -0.1, -1.1, -2.1, -3.1, -8.0, -9.0, -9.9)):
        w = rim_w(x)
        spike("rim_thorn", (x, w - 0.5, 0.55), 0.6 + 0.4 * (i % 3), 0.1, hull, lean=(-0.15, 0.12))
    for i, x in enumerate((8.4, 6.9, -0.6, -2.6, -8.6)):          # taller thorns along the deck crest
        spike("crest_thorn", (x, 1.1, 1.3), 1.0 + 0.5 * (i % 2), 0.13, hull, lean=(-0.2, 0.0))

    # hanging banner pylons with violet diamonds, one under each spire plus one at the bow
    for x, ln in ((6.8, 3.0), (2.6, 3.8), (-5.4, 3.4)):
        w = rim_w(x) - 0.25
        loft("banner", [(-0.3, 0.42, 0.1, 0.03, x, w), (-0.3 - ln, 0.28, 0.07, 0.02, x, w)], trim, axis="Z")
        diamond("banner_eye", (x, w + 0.11, -0.3 - ln * 0.45), 0.14, 0.42, 0.04, glow)
        box("banner_line", (x, w + 0.11, -0.3 - ln * 0.45), (0.03, 0.03, ln * 0.85), glow)
        spike("banner_tip", (x, w, -0.3 - ln), 0.6, 0.18, trim, down=True)

    # rows of downward spikes and hanging fins under the slab
    rows = [(3.0, 0.22, 2.6), (1.9, 0.2, 2.1), (0.8, 0.16, 1.6)]
    for row, (y, r, ln) in enumerate(rows):
        for i in range(12):
            x = 9.4 - i * 1.65 - row * 0.7
            if x < -10.2 or rim_w(x) < y + 0.3 or any(abs(x - bx) < 0.6 for bx in (6.8, 2.6, -5.4)) and row == 0:
                continue
            l = ln * (0.75 + 0.45 * ((i * 7 + row * 3) % 4) / 3)
            spike("under_spike", (x, y, -0.45 - 0.25 * (row > 0)), l, r, hull, down=True)
            if (i + row) % 2 == 0:  # violet streak spikes alongside
                spike("under_glow", (x + 0.45, y - 0.15, -0.5 - 0.25 * (row > 0)), l * 0.9, 0.08, glow, down=True)
    for x, ln in ((5.0, 2.2), (0.6, 2.6), (-3.2, 2.4), (-7.6, 1.8)):  # thin hanging fins
        loft("fin", [(-0.8, 0.8, 0.05, 0.02, x, 1.3), (-0.8 - ln, 0.06, 0.02, 0.01, x, 1.3)], hull, axis="Z")
        box("fin_glow", (x, 1.36, -0.8 - ln * 0.4), (0.04, 0.03, ln * 0.7), glow)

    # stern
    engine((-10.85, 0.0, 0.0), 0.42, trim)
    engine((-10.85, 1.15, 0.0), 0.36, trim)


if __name__ == "__main__":
    build("dark", make)
