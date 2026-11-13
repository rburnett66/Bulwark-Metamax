"""Cargo lift (the sci-fi cube transport trailer) — the farm's carrier, never decor.  [MM-story_mwfacvte_b]

Reference: Design/cargo-lift.png — 6.7 m long × 2.8 m wide × 2.0 m to the top of its load: a gunmetal chassis with
side rails, a ribbed deck, two four-wheel bogies (front and back), a drawbar and 50 mm coupling hitch at the front, and
two OC-47 cubes held by clamp frames. The two cubes are NODES `cube_a` (front) and `cube_b` (back), so the game shows
0, 1 or 2 of them (design §4: the lift carries two plots' worth). Front (the hitch) = -Y.

    python tools/blender/outposts/decor/cargo_lift.py [out_dir] [--render]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decor_common import M, box, build, cyl, mats  # noqa: E402
from cargo_parts import cube  # noqa: E402

L, W = 6.7 * M, 2.8 * M          # overall length (with the drawbar) and width
BED_L = 5.6 * M                  # the deck
DECK_Z = 0.55 * M                # deck top
CUBE = 1.3 * M                   # the cubes ride at trailer scale (the sheet's 2.0 m overall height)
WHEEL_R = 0.33 * M


def make(detail):
    P = mats()
    sides = 14 if detail else 8
    y0 = L / 2 - BED_L / 2        # the deck sits behind the drawbar
    # chassis: two main beams, cross members, the deck plate and its side rails
    for sx in (-1, 1):
        box(f"beam_{sx}", (sx * W * 0.3, y0, DECK_Z - 0.14 * M), (0.16 * M, BED_L, 0.18 * M), P["dark"])
    box("deck", (0, y0, DECK_Z - 0.03 * M), (W * 0.92, BED_L, 0.06 * M), P["gunmetal"], chamfer=0.02 * M if detail else 0.0)
    if detail:
        for i in range(7):
            box(f"rib_{i}", (0, y0 - BED_L / 2 + (i + 0.5) * BED_L / 7, DECK_Z + 0.005 * M), (W * 0.86, 0.04 * M, 0.02 * M), P["steel"])
        for sx in (-1, 1):
            box(f"rail_{sx}", (sx * W * 0.46, y0, DECK_Z + 0.06 * M), (0.06 * M, BED_L, 0.12 * M), P["hazard"])
    # bogies: an axle frame and four wheels each, front and back
    for by in (-1, 1):
        cy = y0 + by * BED_L * 0.3
        box(f"bogie_{by}", (0, cy, WHEEL_R + 0.04 * M), (W * 0.62, 0.9 * M, 0.12 * M), P["dark"])
        for sx in (-1, 1):
            for wy in ((-0.28, 0.28) if detail else (0.0,)):
                cyl(f"wheel_{by}{sx}{wy}", (sx * W * 0.42, cy + wy * M, WHEEL_R), WHEEL_R, 0.26 * M, P["dark"], sides=sides, axis="X")
                if detail:
                    cyl(f"hub_{by}{sx}{wy}", (sx * W * 0.42 + sx * 0.13 * M, cy + wy * M, WHEEL_R), WHEEL_R * 0.45, 0.04 * M, P["steel"], sides=8, axis="X")
    # the drawbar (an A-frame to the hitch ring at the front)
    hy = -L / 2
    for sx in (-1, 1):
        box(f"draw_{sx}", (sx * W * 0.15, (hy + y0 - BED_L / 2) / 2, DECK_Z - 0.2 * M), (0.08 * M, (y0 - BED_L / 2) - hy, 0.08 * M), P["gunmetal"])
    cyl("hitch", (0, hy, DECK_Z - 0.2 * M), 0.1 * M, 0.06 * M, P["steel"], sides=10, axis="Z")
    # clamp frames round each cube seat, then the two cubes (nodes cube_a front, cube_b back)
    for node, cy in (("cube_a", y0 - BED_L * 0.24), ("cube_b", y0 + BED_L * 0.24)):
        if detail:
            for sx in (-1, 1):
                for sy in (-1, 1):
                    box(f"clamp_{node}_{sx}{sy}", (sx * CUBE * 0.55, cy + sy * CUBE * 0.55, DECK_Z + 0.12 * M), (0.1 * M, 0.1 * M, 0.24 * M), P["hazard"])
        cube(node, (0, cy, DECK_Z), P, detail, side=CUBE)


if __name__ == "__main__":
    build("cargo_lift", make, "lift", label="Cargo lift: the farm's cube transport (2 cubes)", ref="Design/cargo-lift.png")
