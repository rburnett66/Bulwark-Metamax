"""Antenna mast — outpost decor, small.  [MM-story_mwfacvte_b]

Reference: Design/antenna.png — 1.5 m tall: a 320 mm square bolted base plate, a stepped column, a junction box with a
label and cable, a slimmer upper column and a flat round dish on top.

    python tools/blender/outposts/decor/antenna.py [out_dir] [--render]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decor_common import M, box, build, cyl, drum, mats  # noqa: E402

H = 1.5 * M


def make(detail):
    P = mats()
    sides = 14 if detail else 8
    box("plate", (0, 0, 0.02 * M), (0.32 * M, 0.32 * M, 0.04 * M), P["gunmetal"], chamfer=0.02 * M if detail else 0.0)
    drum("column_low", (0, 0, 0.04 * M), 0.06 * M, 0.5 * M, P["steel"], sides=sides)
    box("box", (0, -0.02 * M, 0.66 * M), (0.14 * M, 0.11 * M, 0.26 * M), P["gunmetal"])
    drum("column_high", (0, 0, 0.79 * M), 0.035 * M, 0.6 * M, P["steel"], sides=sides)
    drum("dish", (0, 0, H - 0.04 * M), 0.2 * M, 0.04 * M, P["steel"], sides=sides + 4 if detail else sides)
    if not detail:
        return
    for sx in (-1, 1):
        for sy in (-1, 1):
            drum(f"bolt_{sx}{sy}", (sx * 0.12 * M, sy * 0.12 * M, 0.04 * M), 0.012 * M, 0.015 * M, P["dark"], sides=6)
    drum("collar", (0, 0, 0.4 * M), 0.075 * M, 0.04 * M, P["gunmetal"], sides=sides)
    box("label", (0, -0.078 * M, 0.72 * M), (0.08 * M, 0.004 * M, 0.04 * M), P["white"])
    box("lamp", (0.04 * M, -0.078 * M, 0.6 * M), (0.02 * M, 0.004 * M, 0.02 * M), P["water"])
    cyl("cable", (0.05 * M, 0.04 * M, 0.42 * M), 0.012 * M, 0.36 * M, P["dark"], sides=6, axis="Z")
    drum("dish_rim", (0, 0, H - 0.005 * M), 0.21 * M, 0.01 * M, P["gunmetal"], sides=sides + 4)
    drum("dish_hub", (0, 0, H), 0.05 * M, 0.012 * M, P["dark"], sides=10)


if __name__ == "__main__":
    build("antenna", make, "small", label="Antenna mast", ref="Design/antenna.png")
