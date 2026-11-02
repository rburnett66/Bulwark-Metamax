"""Lumen capital ship — low-poly, from ref/lumen.jpg.  [MM-story_mvzrzcjh_1z]

    python3 tools/blender/ships/lumen.py [out_dir] [--no-render]

Read of the reference: a long panelled spine; twin blunt bow pods; a dorsal ridge that climbs to a stepped
bridge; two big octagonal collar rings with a cyan glow outline; aft side pods; white-grey plates, navy
inset bands and cyan light strips. Modelled port-side + centreline only — the build mirrors it.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import box, build, cyl, loft, mat  # noqa: E402


def make():
    hull = mat("hull", (0.40, 0.43, 0.48), rough=0.5, metal=0.25)
    trim = mat("trim", (0.035, 0.06, 0.16), rough=0.4, metal=0.3)
    glow = mat("glow", (0.1, 0.5, 0.9), emit=(0.25, 0.75, 1.0), strength=7)

    # spine (centreline)
    loft("spine", [(-10.4, 1.5, 1.45, 0.5, 0, 0), (4.5, 1.5, 1.45, 0.5, 0, 0)], hull, bevel=0.03)
    loft("keel", [(-8.5, 0.7, 0.35, 0.2, 0, -1.55), (-6, 0.9, 0.5, 0.25, 0, -1.7), (2, 0.9, 0.5, 0.25, 0, -1.7),
                  (4, 0.6, 0.3, 0.2, 0, -1.4)], hull)

    # twin bow pods (port; mirrored)
    Y, Z = 1.3, 0.1
    loft("bow_pod", [(-2, 1.0, 1.15, 0.38, Y, Z), (7.2, 1.0, 1.15, 0.38, Y, Z), (9.2, 0.9, 0.95, 0.45, Y, Z - 0.05),
                     (10.4, 0.6, 0.55, 0.35, Y, Z - 0.15)], hull, bevel=0.03)
    box("bow_band", (3.2, Y + 1.0, Z - 0.15), (8.4, 0.06, 0.55), trim)          # navy side band
    box("bow_glow_lo", (3.2, Y + 1.02, Z - 0.48), (8.4, 0.05, 0.05), glow)        # light strip under it
    for dy in (-0.32, 0.32):                                                      # twin dorsal strips
        box("bow_glow_top", (3.0, Y + dy, Z + 1.16), (7.6, 0.07, 0.03), glow)
    for x in (-0.6, 1.8, 4.2, 6.4):                                               # segment collars
        loft("bow_seg", [(x - 0.1, 1.03, 1.18, 0.39, Y, Z), (x + 0.1, 1.03, 1.18, 0.39, Y, Z)], trim)
    loft("bow_face", [(10.38, 0.5, 0.47, 0.3, Y, Z - 0.15), (10.44, 0.5, 0.47, 0.3, Y, Z - 0.15)], trim)
    for dy in (-0.18, 0.18):                                                      # vertical nose lights
        box("bow_face_glow", (10.46, Y + dy, Z - 0.15), (0.03, 0.05, 0.8), glow)
    box("bow_vent", (6.0, Y, Z + 1.18), (2.0, 0.36, 0.06), trim)

    # dorsal ridge climbing to the bridge (centreline)
    loft("ridge", [(8.6, 0.55, 0.12, 0.08, 0, 0.95), (5.0, 0.95, 0.75, 0.3, 0, 1.55), (0.5, 1.15, 1.15, 0.4, 0, 2.0),
                   (-6.5, 1.15, 1.15, 0.4, 0, 2.0), (-8.6, 0.95, 0.75, 0.35, 0, 1.6)], hull, bevel=0.03)
    box("ridge_band", (-2.5, 1.17, 2.0), (7.0, 0.05, 0.45), trim)
    box("ridge_glow", (-4.5, 0.6, 3.16), (3.6, 0.06, 0.03), glow)
    for x in (-7.6, -1.0):
        loft("ridge_seg", [(x - 0.12, 1.18, 1.18, 0.41, 0, 2.0), (x + 0.12, 1.18, 1.18, 0.41, 0, 2.0)], trim)
    box("bridge", (-2.6, 0, 3.55), (3.0, 1.7, 0.8), hull, chamfer=0.3)
    box("bridge_top", (-2.9, 0, 4.15), (1.4, 1.0, 0.5), hull, chamfer=0.2)
    box("bridge_glass", (-1.12, 0, 3.62), (0.06, 1.2, 0.18), glow)
    cyl("antenna", (-3.1, 0, 4.9), 0.04, 1.2, hull, sides=4, axis="Z")
    for x in (-6.0, -5.0):
        box("ridge_block", (x, 0.55, 3.25), (0.7, 0.5, 0.25), hull)

    # octagonal collar rings — the signature shape
    for name, x in (("ring_fore", 1.4), ("ring_aft", -4.6)):
        sec = (2.95, 2.55, 1.1, 0, 0.35)
        loft(name, [(x - 0.75, *sec), (x + 0.75, *sec)], hull, bevel=0.04)
        loft(name + "_band", [(x - 0.22, 3.0, 2.6, 1.12, 0, 0.35), (x + 0.22, 3.0, 2.6, 1.12, 0, 0.35)], trim)
        for side in (-1, 1):                                    # glow outline on both faces
            f = x + side * 0.77
            loft(name + "_glow", [(f - 0.02, 2.82, 2.42, 1.04, 0, 0.35), (f + 0.02, 2.82, 2.42, 1.04, 0, 0.35)], glow)
            loft(name + "_cover", [(f - 0.03, 2.66, 2.26, 0.97, 0, 0.35), (f + 0.03, 2.66, 2.26, 0.97, 0, 0.35)], hull)

    # aft side pods (port; mirrored)
    AY, AZ = 2.05, -0.15
    loft("aft_pod", [(-10.6, 0.78, 0.92, 0.3, AY, AZ), (-1.6, 0.78, 0.92, 0.3, AY, AZ), (-0.4, 0.5, 0.6, 0.25, AY, AZ)],
         hull, bevel=0.03)
    box("aft_band", (-6.0, AY + 0.79, AZ), (8.6, 0.05, 0.4), trim)
    box("aft_glow", (-6.0, AY + 0.8, AZ - 0.32), (8.6, 0.04, 0.04), glow)
    for x in (-9.0, -6.8, -2.6):
        loft("aft_seg", [(x - 0.1, 0.81, 0.95, 0.31, AY, AZ), (x + 0.1, 0.81, 0.95, 0.31, AY, AZ)], trim)
    box("aft_block", (-8.2, AY, AZ + 1.0), (1.6, 0.8, 0.35), hull, chamfer=0.1)

    # spine detail + stern engines
    box("spine_band", (-8.0, 1.51, 0.2), (4.6, 0.05, 0.6), trim)
    cyl("engine_pod", (-10.62, AY, AZ), 0.5, 0.06, glow, sides=8)
    cyl("engine_main", (-10.45, 0.62, 0.15), 0.42, 0.06, glow, sides=8)
    cyl("engine_main_lo", (-10.45, 0.62, -0.8), 0.32, 0.06, glow, sides=8)


if __name__ == "__main__":
    build("lumen", make)
