"""Water tank — outpost decor, small.  [MM-story_mwfacvte_b]

Reference: Design/water-tank.png — Ø 500 mm × 800 mm galvanised steel tank with two blue bands, a vertical sight glass
(blue water, HIGH / LOW marks), an inlet pipe with a valve wheel at the top, an outlet tap at the bottom and four feet.

    python tools/blender/outposts/decor/water_tank.py [out_dir] [--render]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decor_common import M, box, build, cyl, drum, mats  # noqa: E402

R, H, FOOT = 0.25 * M, 0.8 * M, 0.06 * M


def make(detail):
    P = mats()
    sides = 18 if detail else 10
    drum("body", (0, 0, FOOT), R, H - FOOT, P["steel"], sides=sides)
    for z in (0.22, 0.78):
        drum(f"band_{z}", (0, 0, FOOT + z * (H - FOOT) - 0.03 * M), R * 1.02, 0.06 * M, P["blue"], sides=sides)
    # the sight glass on the front
    box("glass", (0, -R * 1.0, FOOT + 0.5 * (H - FOOT)), (0.06 * M, 0.02 * M, 0.42 * M), P["water"])
    for sx in (-1, 1):
        box(f"feet_{sx}", (sx * R * 0.55, 0, FOOT / 2), (0.05 * M, R * 1.6, FOOT), P["gunmetal"])
    if not detail:
        return
    box("glass_frame", (0, -R * 0.99, FOOT + 0.5 * (H - FOOT)), (0.09 * M, 0.015 * M, 0.46 * M), P["gunmetal"])
    drum("lid", (0, 0, H), R * 0.94, 0.012 * M, P["steel"], sides=sides)
    # the inlet: a riser and an elbow over the rim, a valve wheel on top
    cyl("inlet_riser", (-R * 0.95, 0, H + 0.04 * M), 0.025 * M, 0.12 * M, P["steel"], sides=8, axis="Z")
    cyl("inlet_arm", (-R * 1.1, 0, H + 0.1 * M), 0.025 * M, 0.12 * M, P["steel"], sides=8, axis="X")
    cyl("valve", (-R * 0.6, 0, H + 0.03 * M), 0.05 * M, 0.015 * M, P["red"], sides=10, axis="Z")
    # the outlet tap low on the side
    cyl("tap", (R * 1.05, -R * 0.3, FOOT + 0.06 * M), 0.02 * M, 0.1 * M, P["steel"], sides=8, axis="X")
    box("tap_handle", (R * 1.13, -R * 0.3, FOOT + 0.1 * M), (0.02 * M, 0.05 * M, 0.02 * M), P["dark"])


if __name__ == "__main__":
    build("water_tank", make, "small", label="Water tank", ref="Design/water-tank.png")
