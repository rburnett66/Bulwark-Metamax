"""Arcane capital ship — low-poly, from ref/arcane.jpg.

    python3 tools/blender/ships/arcane.py [out_dir] [--no-render]

Read of the reference: a crimson gothic cathedral-hall. A long, steep, ribbed crimson nave roof stepped over
lower aisle roofs, all on a dark gunmetal frame lined with glowing lancet windows; a pointed bow façade tower
with flanking pinnacles; a crossing transept whose gable end carries the big glowing rose-window "eye" (one
per flank once mirrored) under a spired dome; thin spires along the ridge; a dark keel hung with long
downward spikes and raking buttress blades. Glow magenta-pink with an amber rose core.
Modelled port-side + centreline only — the build mirrors it.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import _obj, box, build, cyl, engine, loft, mat  # noqa: E402

import bmesh  # noqa: E402  (after common, which imports bpy first)
from mathutils import Vector  # noqa: E402


# ── local helpers ─────────────────────────────────────────────────────────────────────
def rings_mesh(name, rings, material, cap0=True, cap1=True):
    """Skin a list of equal-length vertex rings (lists of 3-tuples)."""
    bm = bmesh.new()
    rv = [[bm.verts.new(Vector(p)) for p in r] for r in rings]
    n = len(rv[0])
    for a, b in zip(rv, rv[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap0:
        bm.faces.new(list(reversed(rv[0])))
    if cap1:
        bm.faces.new(rv[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material)


def gable(name, stations, material, axis="X", c=0.0):
    """Pitched-roof (house-section) prism. stations: [(t, w, zb, zw, zr), …] — t along the axis, half-width w,
    base z, eave z, ridge z. axis X: centred on y = 0 (the build cuts it). axis Y: c is the centre x."""
    rings = []
    for t, w, zb, zw, zr in stations:
        prof = [(w, zb), (w, zw), (0.0, zr), (-w, zw), (-w, zb)]
        if axis == "X":
            rings.append([(t, u, z) for u, z in prof])
        else:
            rings.append([(c + u, t, z) for u, z in prof])
    return rings_mesh(name, rings, material)


def spike(name, base, tip, r, material, sides=4, flat=1.0, twist=0.0):
    """Pyramid from a base ring (radius r, squashed by `flat` on its second axis) to a point."""
    b, t = Vector(base), Vector(tip)
    d = (t - b).normalized()
    ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(ref).normalized()
    v = d.cross(u).normalized()
    bm = bmesh.new()
    ring = []
    for i in range(sides):
        a = 2 * math.pi * (i + 0.5) / sides + twist
        ring.append(bm.verts.new(b + u * (r * math.cos(a)) + v * (r * flat * math.sin(a))))
    apex = bm.verts.new(t)
    for i in range(sides):
        bm.faces.new((ring[i], ring[(i + 1) % sides], apex))
    bm.faces.new(list(reversed(ring)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material)


def spire(name, x, y, z0, h, r, material, glow=None, sides=4):
    """Gothic pinnacle: short square plinth + tall tapered needle (+ optional glowing tip)."""
    cyl(name + "_plinth", (x, y, z0 + r * 1.2), r * 1.25, r * 2.4, material, sides=sides, axis="Z")
    spike(name, (x, y, z0 + r * 2.4), (x, y, z0 + h), r, material, sides=sides)
    if glow:
        box(name + "_tip", (x, y, z0 + h * 0.62), (0.07, 0.07, 0.07), glow)


# ── the ship ──────────────────────────────────────────────────────────────────────────
def make():
    roof = mat("roof", (0.24, 0.018, 0.04), rough=0.45, metal=0.2)       # crimson
    frame = mat("frame", (0.11, 0.105, 0.12), rough=0.45, metal=0.45)    # gunmetal
    trim = mat("trim", (0.045, 0.04, 0.05), rough=0.4, metal=0.4)        # near-black ribs and keel
    bronze = mat("bronze", (0.30, 0.17, 0.12), rough=0.4, metal=0.6)     # rose-window rim
    glow = mat("glow", (0.5, 0.1, 0.35), emit=(1.0, 0.2, 0.62), strength=3)
    core = mat("core", (0.5, 0.25, 0.1), emit=(1.0, 0.5, 0.16), strength=4)

    # frame deck + gallery ledge + keel (centreline)
    loft("deck", [(-10.4, 2.75, 0.45, 0.3, 0, -0.15), (8.2, 2.75, 0.45, 0.3, 0, -0.15),
                  (9.6, 2.2, 0.4, 0.3, 0, -0.15)], frame, bevel=0.03)
    box("gallery", (-1.2, 2.82, 0.32), (18.0, 0.18, 0.1), trim)
    loft("keel", [(-9.6, 0.9, 0.35, 0.25, 0, -0.8), (-7.5, 1.5, 0.6, 0.35, 0, -1.0), (6.0, 1.5, 0.6, 0.35, 0, -1.0),
                  (8.6, 0.8, 0.35, 0.25, 0, -0.8)], trim)

    # aisle: dark walls with lancet windows, lean roof up into the nave
    gable("aisle", [(-10.2, 2.55, 0.25, 1.25, 2.6), (7.6, 2.55, 0.25, 1.25, 2.6)], frame)
    gable("aisle_roof", [(-10.3, 2.7, 1.15, 1.25, 2.7), (7.6, 2.7, 1.15, 1.25, 2.7)], roof)
    # nave: clerestory walls + steep crimson roof
    gable("nave", [(-10.0, 1.65, 1.2, 2.3, 2.6), (7.6, 1.65, 1.2, 2.3, 2.6)], frame)
    gable("nave_roof", [(-10.15, 1.9, 2.15, 2.3, 4.4), (7.8, 1.9, 2.15, 2.3, 4.4)], roof)
    gable("nave_ridge", [(-10.2, 0.14, 4.25, 4.3, 4.55), (7.8, 0.14, 4.25, 4.3, 4.55)], trim)
    gable("stern_cap", [(-10.35, 1.95, 2.1, 2.3, 4.45), (-10.15, 1.95, 2.1, 2.3, 4.45)], trim)
    gable("stern_aisle_cap", [(-10.45, 2.75, 0.25, 1.3, 2.75), (-10.25, 2.75, 0.25, 1.3, 2.75)], trim)
    box("stern_glow", (-10.47, 0.0, 3.0), (0.04, 0.5, 1.2), glow)

    # roof ribs (dark arches proud of the crimson) and windows, skipping the crossing
    bays = [x for x in (-9.0, -7.6, -6.2, -4.8, 0.8, 2.2, 3.6, 5.0, 6.4)]
    for x in bays:
        gable("nave_rib", [(x - 0.08, 1.95, 2.12, 2.3, 4.48), (x + 0.08, 1.95, 2.12, 2.3, 4.48)], trim)
        gable("aisle_rib", [(x - 0.08, 2.75, 1.12, 1.26, 2.75), (x + 0.08, 2.75, 1.12, 1.26, 2.75)], trim)
        box("aisle_win", (x + 0.7, 2.57, 0.72), (0.34, 0.05, 0.62), glow)
        box("nave_win", (x + 0.7, 1.67, 1.78), (0.3, 0.05, 0.5), glow)
        spire("aisle_pin", x, 2.55, 1.25, 1.5, 0.11, frame)
    for x in (-9.0, -6.2, 2.2, 5.0):
        spire("ridge_spire", x, 0.0, 4.4, 1.6, 0.1, frame)

    # crossing transept with the rose-window eye on its gable end (port; mirrored → one per flank)
    CX = -2.0
    gable("transept", [(0.05, 2.1, -0.4, 2.6, 4.9), (3.0, 2.1, -0.4, 2.6, 4.9)], frame, axis="Y", c=CX)
    gable("transept_roof", [(0.05, 2.25, 2.55, 2.65, 5.05), (3.1, 2.25, 2.55, 2.65, 5.05)], roof, axis="Y", c=CX)
    gable("transept_rib", [(3.05, 2.35, 2.5, 2.65, 5.15), (3.25, 2.35, 2.5, 2.65, 5.15)], trim, axis="Y", c=CX)
    RZ = 1.5
    cyl("rose_rim", (CX, 3.1, RZ), 1.8, 0.3, bronze, sides=16, axis="Y")
    cyl("rose_glass", (CX, 3.26, RZ), 1.5, 0.04, glow, sides=16, axis="Y")
    cyl("rose_ring", (CX, 3.3, RZ), 0.9, 0.04, trim, sides=12, axis="Y")
    cyl("rose_inner", (CX, 3.33, RZ), 0.76, 0.04, glow, sides=12, axis="Y")
    cyl("rose_core", (CX, 3.36, RZ), 0.4, 0.04, core, sides=8, axis="Y")
    for ang in range(0, 180, 30):                                  # tracery spokes
        a = math.radians(ang)
        d = Vector((math.cos(a), 0, math.sin(a))) * 1.5
        spike("rose_spoke", Vector((CX, 3.31, RZ)) + d, Vector((CX, 3.31, RZ)) - d, 0.04, trim, sides=4)
        spike("rose_spoke", Vector((CX, 3.31, RZ)) - d, Vector((CX, 3.31, RZ)) + d, 0.04, trim, sides=4)
    for dx in (-2.15, 2.15):                                         # corner pinnacles of the transept
        spire("transept_pin", CX + dx, 3.0, 2.6, 2.4, 0.14, frame, glow)

    # crossing dome + spire crown (centreline)
    cyl("dome_drum", (CX, 0, 4.8), 2.0, 0.6, frame, sides=8, axis="Z")
    cyl("dome", (CX, 0, 5.6), 1.95, 1.0, roof, sides=8, axis="Z", r1=1.0)
    cyl("dome_band", (CX, 0, 5.1), 2.05, 0.12, trim, sides=8, axis="Z")
    cyl("lantern", (CX, 0, 6.35), 0.75, 0.5, frame, sides=8, axis="Z")
    spike("crown", (CX, 0, 6.6), (CX, 0, 9.6), 0.42, frame, sides=8)
    box("crown_tip", (CX, 0, 8.6), (0.1, 0.1, 0.1), glow)
    for dx, dy in ((-0.95, 0.55), (0.95, 0.55)):
        spire("crown_pin", CX + dx, dy, 6.1, 2.2, 0.12, frame, glow)

    # bow façade tower: pointed gable, tall lancet + small rose, flanking pinnacles
    gable("facade", [(7.4, 2.3, -0.4, 3.0, 7.6), (9.6, 2.1, -0.4, 3.0, 7.6)], frame)
    gable("facade_roof", [(7.3, 2.42, 2.85, 3.0, 7.8), (9.75, 2.22, 2.85, 3.0, 7.8)], trim)
    spike("facade_lancet", (9.62, 0.55, 0.6), (9.62, 0.55, 4.2), 0.2, glow, sides=4, flat=0.15)
    spike("facade_arch", (9.63, 0.05, 1.0), (9.63, 0.05, 5.3), 0.3, glow, sides=4, flat=0.15)
    cyl("facade_rose_rim", (9.6, 0, 6.0), 0.75, 0.12, bronze, sides=12)
    cyl("facade_rose", (9.68, 0, 6.0), 0.55, 0.04, glow, sides=12)
    box("facade_side_win", (8.5, 2.12, 2.2), (0.6, 0.05, 1.6), glow)
    for x in (7.4, 9.6):
        spire("facade_pin", x, 2.3, 2.9, 4.6, 0.22, frame, glow)
    spire("facade_crown", 8.5, 0.0, 7.3, 2.6, 0.16, frame, glow)

    # underside: buttress blades and long downward spikes
    for x, top_y, tx, ty, tz, r in ((8.6, 2.4, 10.4, 3.2, -4.8, 0.55), (2.8, 2.6, 3.6, 3.4, -4.4, 0.5),
                                     (-6.5, 2.6, -6.0, 3.4, -4.6, 0.5), (-9.8, 2.4, -10.6, 3.0, -3.6, 0.45)):
        spike("blade", (x, top_y, 0.6), (tx, ty, tz), r, trim, sides=4, flat=0.35)
        box("blade_glow", (x + (tx - x) * 0.4, top_y + (ty - top_y) * 0.4 + 0.15, 0.6 + (tz - 0.6) * 0.4),
            (0.12, 0.05, 0.6), glow)
    for x, y, L in ((6.0, 0.0, 3.6), (4.5, 1.3, 2.4), (0.5, 0.0, 4.6), (-1.0, 1.3, 2.8), (-4.0, 0.0, 3.8),
                    (-7.8, 1.2, 2.6), (-2.0, 2.0, 2.0)):
        spike("keel_spike", (x, y, -1.2), (x, y, -1.2 - L), 0.32, trim, sides=4)
    for x in (-8.5, -5.2, -1.8, 1.5, 4.8):                              # glowing undercroft ports
        box("under_win", (x, 2.0, -0.62), (0.5, 0.05, 0.3), glow)

    # stern engines
    engine((-10.9, 1.6, -0.05), 0.42, trim)
    engine((-10.9, 0.55, -0.05), 0.42, trim)
    engine((-10.1, 0.6, -0.85), 0.3, trim)


if __name__ == "__main__":
    build("arcane", make)
