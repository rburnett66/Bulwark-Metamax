"""Air capital ship — low-poly, from ref/air.jpg.

    python3 tools/blender/ships/air.py [out_dir] [--no-render]

Read of the reference: a white carrier with red and blue livery stripes; stacked, stepped flight decks
rising toward a central tower; the tower carries blue domes and thin spires; pointed forward hull pods
with upright chevron fins; swept delta wings with angled fins at the stern; jet engines at the back.
Modelled port-side + centreline only — the build mirrors it.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401  (bpy must load before bmesh)
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

from common import _obj, box, build, cyl, engine, loft, mat  # noqa: E402


# ── local helpers ─────────────────────────────────────────────────────────────────────
def _extrude(name, ring0, ring1, material, bevel=0.0):
    bm = bmesh.new()
    a = [bm.verts.new(Vector(p)) for p in ring0]
    b = [bm.verts.new(Vector(p)) for p in ring1]
    n = len(a)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material, bevel)


def plate(name, poly, z0, z1, material, bevel=0.0):
    """Flat plate: polygon in XY extruded from z0 to z1 (decks, wings, stripes)."""
    return _extrude(name, [(x, y, z0) for x, y in poly], [(x, y, z1) for x, y in poly], material, bevel)


def fin(name, poly, y, t, material, lean=0.0):
    """Upright fin: polygon in XZ, thickness t along Y, leaning outboard by `lean` per unit of height."""
    z0 = min(z for _, z in poly)
    return _extrude(name, [(x, y - t / 2 + (z - z0) * lean, z) for x, z in poly],
                    [(x, y + t / 2 + (z - z0) * lean, z) for x, z in poly], material)


def dome(name, center, r, material, h=None):
    """Faceted dome on a short drum, along +Z."""
    x, y, z = center
    h = h or r * 0.9
    cyl(name + "_drum", (x, y, z + 0.1), r, 0.2, material, sides=10, axis="Z")
    cyl(name + "_cap", (x, y, z + 0.2 + h * 0.3), r, h * 0.6, material, sides=10, axis="Z", r1=r * 0.72)
    cyl(name + "_top", (x, y, z + 0.2 + h * 0.75), r * 0.72, h * 0.3, material, sides=10, axis="Z", r1=r * 0.25)


def spire(name, center, h, r, material):
    x, y, z = center
    cyl(name, (x, y, z + h / 2), r, h, material, sides=4, axis="Z", r1=r * 0.25)


def make():
    hull = mat("hull", (0.95, 0.96, 0.98), rough=0.45, metal=0.15)
    trim = mat("trim", (0.10, 0.12, 0.17), rough=0.45, metal=0.3)
    red = mat("red", (0.70, 0.06, 0.06), rough=0.4, metal=0.1)
    blue = mat("blue", (0.08, 0.28, 0.78), rough=0.35, metal=0.2)
    deck = mat("deck", (0.58, 0.61, 0.66), rough=0.6, metal=0.2)
    glow = mat("glow", (0.3, 0.5, 0.9), emit=(0.55, 0.75, 1.0), strength=7)

    # ── main hull (centreline) ────────────────────────────────────────────────────────
    loft("hull", [(-10.4, 2.1, 0.75, 0.4, 0, 0.0), (3.0, 2.3, 0.8, 0.4, 0, 0.0), (7.0, 1.4, 0.6, 0.35, 0, -0.05),
                  (9.6, 0.45, 0.28, 0.2, 0, -0.1)], hull, bevel=0.03)
    loft("belly", [(-9.6, 1.6, 0.45, 0.25, 0, -0.9), (4.0, 1.7, 0.45, 0.25, 0, -0.9), (6.5, 0.9, 0.3, 0.2, 0, -0.75)],
         trim)
    for x in (-7.5, -5.0, -2.5, 0.0, 2.5):                                      # belly window bays
        box("belly_glow", (x, 1.72, -0.95), (1.4, 0.04, 0.18), glow)
    box("hull_red", (-1.0, 2.31, 0.15), (14.0, 0.05, 0.22), red)                # side livery
    box("hull_blue", (-1.0, 2.31, -0.15), (14.0, 0.05, 0.28), blue)

    # ── forward hull pods with pointed noses (port; mirrored) ─────────────────────────
    PY, PZ = 3.1, 0.15
    loft("pod", [(-6.6, 0.85, 0.75, 0.3, PY, PZ), (4.5, 0.85, 0.75, 0.3, PY, PZ), (8.0, 0.55, 0.5, 0.25, PY, PZ - 0.05),
                 (10.6, 0.08, 0.1, 0.03, PY, PZ - 0.2)], hull, bevel=0.03)
    plate("pod_red", [(-6.0, PY + 0.86), (4.5, PY + 0.86), (8.0, PY + 0.56), (8.0, PY + 0.62), (4.5, PY + 0.92),
                      (-6.0, PY + 0.92)], PZ + 0.0, PZ + 0.18, red)
    plate("pod_blue", [(-6.0, PY + 0.86), (4.5, PY + 0.86), (8.0, PY + 0.56), (8.0, PY + 0.62), (4.5, PY + 0.92),
                       (-6.0, PY + 0.92)], PZ + 0.22, PZ + 0.5, blue)
    plate("pod_top_blue", [(-4.0, PY - 0.25), (6.0, PY - 0.25), (8.5, PY - 0.1), (8.5, PY + 0.15), (6.0, PY + 0.25),
                           (-4.0, PY + 0.25)], PZ + 0.75, PZ + 0.79, blue)
    fin("pod_fin", [(1.0, PZ + 0.7), (4.6, PZ + 0.7), (2.4, PZ + 2.4), (1.6, PZ + 2.4)], PY, 0.35, hull)
    fin("pod_fin_blue", [(2.2, PZ + 1.5), (3.6, PZ + 1.5), (2.5, PZ + 2.2), (2.0, PZ + 2.2)], PY, 0.4, blue)
    box("pod_glow", (-1.0, PY + 0.86, PZ - 0.45), (8.0, 0.04, 0.1), glow)
    box("pod_bridge", (-1.5, 2.55, 0.1), (7.0, 1.0, 0.8), trim)                 # ties pod to hull

    # outer forward blade: a flat pointed wing reaching to the bow
    plate("blade", [(-4.0, 3.8), (2.5, 3.8), (8.8, 4.5), (8.6, 4.9), (0.5, 5.4), (-3.0, 5.0)], -0.15, 0.15, hull)
    plate("blade_red", [(2.5, 3.9), (8.6, 4.55), (8.5, 4.75), (1.5, 4.25)], 0.15, 0.19, red)
    plate("blade_blue", [(1.0, 4.3), (8.3, 4.85), (0.5, 5.3), (0.2, 4.9)], 0.15, 0.19, blue)
    fin("blade_fin", [(-3.4, 0.15), (-0.6, 0.15), (-2.5, 1.5), (-3.2, 1.5)], 5.0, 0.18, hull, lean=0.15)

    # ── stepped flight decks rising to the tower (centreline) ─────────────────────────
    decks = (  # (x aft, x fore, half width, z of deck top)
        (-9.0, 6.6, 3.4, 1.15),
        (-8.0, 4.6, 3.0, 1.95),
        (-7.0, 2.6, 2.6, 2.75),
        (-6.0, 0.6, 2.1, 3.55),
    )
    prev_top = 0.75
    for i, (xa, xf, w, zt) in enumerate(decks):
        poly = [(xa, -0.5), (xf, -0.5), (xf, w * 0.45), (xf - 1.2, w), (xa, w)]
        plate(f"deck{i}", poly, zt - 0.2, zt, deck, bevel=0.02)
        plate(f"deck{i}_red", [(xa, w), (xf - 1.2, w), (xf, w * 0.45), (xf + 0.04, w * 0.45 + 0.05),
                               (xf - 1.18, w + 0.05), (xa, w + 0.05)], zt - 0.2, zt - 0.05, red)
        plate(f"deck{i}_line", [(xa + 0.6, w * 0.5), (xf - 0.6, w * 0.5), (xf - 0.6, w * 0.5 + 0.06),
                                (xa + 0.6, w * 0.5 + 0.06)], zt, zt + 0.01, hull)
        # recessed hangar level under each deck (dark, with lit bays)
        hw = w - 0.45
        plate(f"hangar{i}", [(xa + 0.3, -0.5), (xf - 0.9, -0.5), (xf - 0.9, hw * 0.6), (xf - 1.9, hw), (xa + 0.3, hw)],
              prev_top, zt - 0.2, trim)
        h = zt - 0.2 - prev_top
        box(f"hangar{i}_glow", ((xa + xf) / 2 - 0.6, hw + 0.01, prev_top + h * 0.5), (xf - xa - 3.5, 0.03, h * 0.35), glow)
        prev_top = zt

    # ── central tower with blue domes and spires ──────────────────────────────────────
    TX = -3.6
    loft("tower_base", [(TX - 1.8, 1.25, 0.6, 0.3, 0, 4.15), (TX + 1.4, 1.25, 0.6, 0.3, 0, 4.15),
                        (TX + 2.2, 0.6, 0.35, 0.2, 0, 4.0)], hull, bevel=0.02)
    box("tower_band", (TX, 1.26, 4.25), (3.0, 0.04, 0.16), blue)
    box("tower_glow", (TX + 1.0, 1.27, 4.0), (1.6, 0.03, 0.08), glow)
    loft("tower_mid", [(5.25, 0.8, 0.75, 0.25, TX, 0), (6.3, 0.6, 0.55, 0.2, TX, 0), (6.35, 0.5, 0.45, 0.15, TX, 0),
                        (7.4, 0.4, 0.38, 0.12, TX, 0)], hull, axis="Z")
    box("tower_mid_blue", (TX + 0.3, 0, 6.8), (0.85, 0.82, 0.14), blue)
    dome("dome_mid", (TX + 1.0, 0, 5.4), 0.5, blue)
    spire("spire_mid2", (TX + 1.0, 0, 6.1), 1.0, 0.05, hull)
    box("tower_mid_red", (TX, 0, 5.35), (1.62, 1.62, 0.12), red)
    dome("dome_top", (TX, 0, 7.4), 0.55, blue)
    spire("spire_top", (TX, 0, 8.1), 1.6, 0.08, hull)
    dome("dome_fore", (TX + 2.2, 0, 4.3), 0.5, blue)
    dome("dome_side", (TX - 0.4, 1.75, 4.75 - 0.6), 0.42, blue)
    box("dome_side_plinth", (TX - 0.4, 1.75, 3.9), (1.0, 0.9, 0.5), hull, chamfer=0.15)
    dome("dome_aft", (TX - 2.4, 1.5, 3.55), 0.45, blue)
    spire("spire_side", (TX - 0.4, 1.75, 4.95), 1.3, 0.06, hull)
    spire("spire_aft", (TX - 2.4, 1.5, 4.3), 1.1, 0.06, hull)
    spire("spire_mid", (TX - 1.0, 0.7, 5.25), 1.6, 0.07, hull)
    box("tower_glass", (TX + 0.8, 0, 5.8), (0.04, 1.0, 0.14), glow)
    # chevron fin on the tower front (the emblem shape)
    fin("tower_fin", [(TX + 0.4, 3.55), (TX + 2.2, 3.55), (TX + 0.9, 5.0), (TX + 0.5, 5.0)], 0.35, 0.2, hull)
    box("tower_fin_blue", (TX + 1.1, 0.35, 4.1), (0.9, 0.22, 0.12), blue)

    # ── swept stern wings with angled fins (port; mirrored) ───────────────────────────
    WZ = -0.05
    plate("wing", [(-9.0, 2.0), (-2.0, 2.0), (-7.4, 7.2), (-9.9, 7.2)], WZ - 0.15, WZ + 0.15, hull, bevel=0.02)
    plate("wing_red", [(-2.6, 2.0), (-2.0, 2.0), (-7.4, 7.2), (-7.95, 7.2)], WZ + 0.15, WZ + 0.19, red)
    plate("wing_blue", [(-3.6, 2.0), (-2.9, 2.0), (-8.1, 7.0), (-8.75, 7.0)], WZ + 0.15, WZ + 0.19, blue)
    plate("wing_tip", [(-10.0, 7.0), (-7.3, 7.0), (-7.6, 7.35), (-9.9, 7.35)], WZ - 0.2, WZ + 0.2, red)
    fin("wing_fin", [(-10.1, WZ + 0.15), (-7.8, WZ + 0.15), (-9.6, 2.5), (-10.5, 2.5)], 6.9, 0.18, hull, lean=0.3)
    fin("wing_fin_red", [(-10.2, 2.1), (-9.45, 2.1), (-9.6, 2.5), (-10.5, 2.5)], 7.62, 0.22, red)
    fin("wing_fin_blue", [(-9.9, 1.0), (-8.6, 1.0), (-9.1, 1.5), (-10.0, 1.5)], 7.27, 0.22, blue)
    fin("wing_fin_lo", [(-9.8, WZ - 0.15), (-8.4, WZ - 0.15), (-9.6, -1.4), (-10.2, -1.4)], 4.6, 0.15, hull, lean=0.0)
    box("wing_glow", (-6.0, 4.6, WZ - 0.17), (2.4, 0.08, 0.03), glow)

    # dorsal stern fins rising behind the decks (port)
    fin("stern_fin", [(-10.2, 1.2), (-8.0, 1.2), (-9.6, 3.3), (-10.4, 3.3)], 2.6, 0.18, hull, lean=0.25)
    fin("stern_fin_blue", [(-10.0, 2.3), (-9.0, 2.3), (-9.5, 3.0), (-10.2, 3.0)], 2.6 + 0.3, 0.2, blue)

    # ── jet engines at the stern ──────────────────────────────────────────────────────
    engine((-10.6, 1.15, 0.2), 0.5, trim)
    engine((-10.6, 1.15, -0.65), 0.36, trim)
    engine((-6.8, PY, PZ), 0.55, trim)
    engine((-10.1, 4.4, WZ), 0.4, trim)
    loft("wing_nacelle", [(-9.9, 0.45, 0.4, 0.15, 4.4, WZ), (-6.5, 0.45, 0.4, 0.15, 4.4, WZ),
                          (-5.0, 0.2, 0.2, 0.1, 4.4, WZ)], hull)


if __name__ == "__main__":
    build("air", make)
