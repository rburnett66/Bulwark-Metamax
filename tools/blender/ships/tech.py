"""Tech capital ship — low-poly, from ref/tech.jpg.

    python3 tools/blender/ships/tech.py [out_dir] [--no-render]

Read of the reference: a dark graphite arrowhead — pointed bow, wide flat stern — with a flat upper deck
studded with hexagonal pads; clusters of tall faceted crystal-glass towers (a big centreline cluster aft,
mirrored side clusters and a smaller fore cluster); thin gold trim lines along the deck edges; a glowing
gold hangar opening in each flank; gun turrets with forward barrels along the sides. Modelled port-side +
centreline only — the build mirrors it.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import _obj, box, build, cyl, engine, loft, mat  # noqa: E402
import bmesh  # noqa: E402  (bpy, imported by common, must load first)
from mathutils import Vector  # noqa: E402

# deck plan: (x, half-width) of the main slab's outer edge — the arrowhead silhouette
PLAN = [(-11.0, 4.3), (-4.5, 4.75), (0.5, 4.45), (11.2, 0.22)]
TOP = 1.0          # deck top
C = 0.32           # deck edge chamfer


def width(x):
    for (x0, w0), (x1, w1) in zip(PLAN, PLAN[1:]):
        if x0 <= x <= x1:
            return w0 + (w1 - w0) * (x - x0) / (x1 - x0)
    return PLAN[0][1] if x < PLAN[0][0] else PLAN[-1][1]


def strip(name, p0, p1, w, h, material):
    """Thin box from p0 to p1 (any direction in the XY plane), w wide and h tall: diagonal trim lines."""
    a, b = Vector(p0), Vector(p1)
    d = (b - a)
    d.z = 0
    d.normalize()
    side = Vector((-d.y, d.x, 0)) * (w / 2)
    up = Vector((0, 0, h / 2))
    bm = bmesh.new()
    vs = [bm.verts.new(p + s + u) for p in (a, b) for s in (side, -side) for u in (up, -up)]
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material)


def crystal(name, x, y, z, r, h, material, sides=4):
    """Faceted crystal tower: a straight prism body capped by a sharp pyramid tip."""
    body = h * 0.86
    cyl(name, (x, y, z + body / 2), r, body, material, sides=sides, axis="Z", r1=r * 0.82)
    cyl(name + "_tip", (x, y, z + body + (h - body) / 2), r * 0.82, h - body, material, sides=sides, axis="Z",
        r1=r * 0.12)


def cluster(name, x, y, z, towers, glass, trim, glow, base_r):
    """Hexagonal plinth with a gold rim, carrying several crystal towers (dx, dy, r, h)."""
    cyl(name + "_plinth", (x, y, z + 0.2), base_r, 0.4, trim, sides=6, axis="Z", r1=base_r * 0.88)
    cyl(name + "_rim", (x, y, z + 0.41), base_r * 0.74, 0.03, glow, sides=6, axis="Z")
    cyl(name + "_step", (x, y, z + 0.55), base_r * 0.7, 0.3, trim, sides=6, axis="Z", r1=base_r * 0.6)
    for i, (dx, dy, r, h) in enumerate(towers):
        crystal(f"{name}_t{i}", x + dx, y + dy, z + 0.6, r, h, glass)
        if h > 2.8:                                   # gold seam ring where the tall towers taper
            cyl(f"{name}_t{i}_seam", (x + dx, y + dy, z + 0.6 + h * 0.55), r * 0.9, 0.05, glow, sides=4, axis="Z")


def turret(name, x, y, z, hull, trim, glow):
    """Flank gun sponson with twin forward barrels."""
    loft(name + "_house", [(x - 0.7, 0.35, 0.28, 0.12, y, z), (x + 0.4, 0.38, 0.3, 0.14, y, z),
                           (x + 0.8, 0.26, 0.2, 0.1, y, z)], hull, bevel=0.02)
    box(name + "_line", (x - 0.05, y + 0.39, z + 0.12), (0.9, 0.03, 0.04), glow)
    for dz in (-0.1, 0.1):
        cyl(name + "_barrel", (x + 1.5, y + 0.05, z + dz), 0.06, 1.5, trim, sides=6, axis="X")


def make():
    hull = mat("hull", (0.065, 0.065, 0.075), rough=0.45, metal=0.35)        # graphite plates
    trim = mat("trim", (0.03, 0.03, 0.035), rough=0.4, metal=0.4)          # near-black pads/plinths
    glass = mat("glass", (0.06, 0.07, 0.10), rough=0.2, metal=0.5)        # crystal-glass towers
    glow = mat("glow", (0.6, 0.45, 0.1), emit=(1.0, 0.6, 0.16), strength=4)  # gold trim + hangar light

    # ── main wedge slab and faceted belly ──
    loft("deck", [(x, w, 1.05, C, 0, TOP - 1.05) for x, w in PLAN], hull, bevel=0.03)
    loft("belly", [(-10.6, 3.6, 0.6, 0.45, 0, -1.2), (-4.5, 4.0, 0.65, 0.5, 0, -1.25),
                   (0.5, 3.7, 0.65, 0.5, 0, -1.25), (10.4, 0.2, 0.18, 0.1, 0, -0.6)], hull)
    loft("keel", [(-9.5, 1.6, 0.3, 0.2, 0, -1.95), (2.0, 1.6, 0.3, 0.2, 0, -1.95), (7.0, 0.4, 0.12, 0.08, 0, -1.6)],
         trim)

    # gold trim: perimeter band on the flanks + lines along the top chamfer edge
    loft("edge_glow", [(x if x > -11 else -10.98, w + 0.02, 0.025, 0.02, 0, 0.62) for x, w in PLAN], glow)
    pts = [(x, width(x) - C + 0.02, TOP + 0.01) for x in (-11.0, -4.5, 0.5, 11.0)]
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        strip(f"top_glow{i}", a, b, 0.05, 0.03, glow)
    strip("stern_glow", (-10.97, 0.05, 0.62), (-10.97, 4.3, 0.62), 0.03, 0.025, glow)
    # inner deck lines echoing the arrowhead
    strip("deck_line", (-3.0, 3.4, TOP + 0.01), (9.0, 0.05, TOP + 0.01), 0.04, 0.02, glow)

    # raised centre spine on the deck
    loft("spine", [(-10.8, 1.3, 0.18, 0.12, 0, TOP + 0.12), (2.0, 1.3, 0.18, 0.12, 0, TOP + 0.12),
                   (7.5, 0.3, 0.1, 0.08, 0, TOP + 0.05)], hull)

    # ── hexagonal deck pads ──
    for x, y, r in ((3.4, 1.4, 1.0), (5.9, 0.0, 0.85), (1.2, 2.8, 0.95), (-1.2, 3.6, 0.8), (7.8, 0.0, 0.6),
                    (-5.7, 3.5, 0.9), (-9.4, 3.1, 0.85), (-9.4, 1.0, 0.75), (-0.6, 1.4, 0.75), (4.0, 3.0, 0.6)):
        cyl("pad", (x, y, TOP + 0.16), r, 0.32, trim, sides=6, axis="Z", r1=r * 0.86)
        cyl("pad_ring", (x, y, TOP + 0.33), r * 0.8, 0.02, glow, sides=6, axis="Z")
        cyl("pad_top", (x, y, TOP + 0.36), r * 0.76, 0.08, hull, sides=6, axis="Z", r1=r * 0.6)

    # ── crystal tower clusters (the signature) ──
    Z0 = TOP + 0.3
    cluster("aft", -6.6, 0.0, Z0, [(0.0, 0.0, 0.62, 5.6), (-0.6, 0.65, 0.45, 4.0), (0.55, 0.7, 0.4, 3.0),
                                  (-1.05, 0.0, 0.38, 2.6), (0.9, 0.0, 0.36, 2.1)], glass, trim, glow, 1.9)
    cluster("mid", -2.6, 2.3, Z0, [(0.0, 0.0, 0.5, 4.4), (-0.5, 0.45, 0.36, 3.0), (0.45, -0.4, 0.32, 2.2),
                                  (0.45, 0.5, 0.28, 1.6)], glass, trim, glow, 1.25)
    cluster("fore", 0.6, 0.0, Z0, [(0.0, 0.0, 0.48, 3.8), (-0.5, 0.45, 0.34, 2.4), (0.55, 0.35, 0.3, 1.7)],
            glass, trim, glow, 1.15)

    # ── flank hangar (glowing gold opening) ──
    hx, hw = -2.2, width(-2.2)
    box("hangar_frame", (hx, hw + 0.06, 0.05), (3.4, 0.16, 1.5), trim, chamfer=0.12)
    box("hangar_glow", (hx, hw + 0.15, 0.02), (2.8, 0.04, 1.1), glow)
    box("hangar_deck", (hx, hw + 0.25, -0.52), (3.0, 0.3, 0.1), hull)
    box("hangar_lintel", (hx, hw + 0.2, 0.6), (3.1, 0.14, 0.1), hull)
    for dx in (-0.6, 0.6):
        box("hangar_strut", (hx + dx, hw + 0.2, 0.02), (0.08, 0.1, 1.1), trim)
    # windows strip aft of the hangar
    box("windows", (-7.0, width(-7.0) + 0.01, 0.15), (4.5, 0.03, 0.06), glow)

    # ── flank gun sponsons ──
    for x in (1.6, 4.4, -8.6):
        w = width(x)
        turret(f"gun{x}", x, w - 0.1, -0.1, hull, trim, glow)

    # ── stern engines ──
    for y, z, r in ((0.9, 0.2, 0.42), (2.2, 0.2, 0.42), (3.4, 0.2, 0.34)):
        engine((-11.05, y, z), r, trim)


if __name__ == "__main__":
    build("tech", make)
