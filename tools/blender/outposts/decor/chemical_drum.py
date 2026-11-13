"""Chemical drum (FUEL JP-8 / F-76) — outpost decor, small.  [MM-story_mwfacvte_b]

Reference: Design/chemical-drum.png — Ø 580 mm × 940 mm, weathered gunmetal steel, two rolling hoops, a lid with a
bung and a blue status light, a hazard label panel, a pressure gauge and valve on the front, two security straps.

    python tools/blender/outposts/decor/chemical_drum.py [out_dir] [--render]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decor_common import M, box, build, cyl, drum, mats, mat_stripes  # noqa: E402

R, H = 0.29 * M, 0.94 * M


def make(detail):
    P = mats()
    sides = 18 if detail else 10
    drum("drum__body", (0, 0, 0), R, H, P["gunmetal"], sides=sides)
    # rolling hoops and the chimes top and bottom
    for z in ((0.03, 0.33, 0.62, 0.91) if detail else (0.33, 0.62)):
        drum(f"hoop_{z}", (0, 0, z * M - 0.012 * M), R * 1.035, 0.024 * M, P["steel"], sides=sides)
    if not detail:
        return
    # lid: a slightly inset disc, the bung and the blue status light
    drum("lid", (0, 0, H), R * 0.92, 0.01 * M, P["steel"], sides=sides)
    drum("bung", (R * 0.45, 0, H), 0.04 * M, 0.03 * M, P["dark"], sides=8)
    drum("light", (-R * 0.3, R * 0.25, H), 0.035 * M, 0.02 * M, P["blue"], sides=8)
    # the hazard label panel and its stencil band on the front (-Y)
    box("label", (0, -R * 0.99, 0.62 * H), (0.30 * M, 0.006 * M, 0.26 * M), P["white"])
    box("label_band", (0, -R * 1.0, 0.75 * H), (0.30 * M, 0.006 * M, 0.04 * M), mat_stripes(scale=14))
    # gauge and valve low on the front
    cyl("gauge", (-0.08 * M, -R * 1.02, 0.3 * H), 0.045 * M, 0.02 * M, P["white"], sides=10, axis="Y")
    box("valve", (0.06 * M, -R * 1.03, 0.28 * H), (0.05 * M, 0.04 * M, 0.08 * M), P["dark"])
    # two security straps
    for z in (0.18, 0.48):
        drum(f"strap_{z}", (0, 0, z * M), R * 1.02, 0.02 * M, P["dark"], sides=sides)


if __name__ == "__main__":
    build("chemical_drum", make, "small", label="Chemical drum: fuel JP-8 / F-76", ref="Design/chemical-drum.png")
