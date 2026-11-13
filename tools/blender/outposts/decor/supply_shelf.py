"""Supply shelf — outpost decor, small.  [MM-story_mwfacvte_b]

Reference: Design/supply-shelf.png — 1.2 m wide × 0.45 m deep × 1.7 m tall weathered steel shelving: four posts, four
shelves, stocked with crates, bottles, a toolbox and a red rag.

    python tools/blender/outposts/decor/supply_shelf.py [out_dir] [--render]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decor_common import M, box, build, drum, mats  # noqa: E402

W, D, H = 1.2 * M, 0.45 * M, 1.7 * M
LEVELS = (0.12, 0.55, 0.98, 1.41)


def make(detail):
    P = mats()
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f"post_{sx}{sy}", (sx * (W / 2 - 0.02 * M), sy * (D / 2 - 0.02 * M), H / 2), (0.04 * M, 0.04 * M, H), P["gunmetal"])
    for i, z in enumerate(LEVELS):
        box(f"shelf_{i}", (0, 0, z * M), (W, D, 0.03 * M), P["steel"])
    # stock on each shelf: crates, bottles, a toolbox (fewer pieces on the flat LOD)
    stock = [
        (0, -0.38, "crate", P["olive"]), (0, 0.05, "crate", P["khaki"]), (0, 0.38, "box", P["dark"]),
        (1, -0.4, "bottles", P["white"]), (1, 0.0, "tool", P["red"]), (1, 0.35, "bottles", P["teal"]),
        (2, -0.3, "crate", P["teal"]), (2, 0.3, "bottles", P["cream"]),
        (3, -0.35, "box", P["khaki"]), (3, 0.25, "crate", P["olive"]),
    ]
    for i, (lvl, x, kind, mat) in enumerate(stock if detail else stock[::2]):
        z = LEVELS[lvl] * M + 0.015 * M
        if kind == "crate":
            box(f"crate_{i}", (x * M, 0, z + 0.1 * M), (0.3 * M, 0.3 * M, 0.2 * M), mat, chamfer=0.01 * M if detail else 0.0)
        elif kind == "box":
            box(f"box_{i}", (x * M, 0, z + 0.07 * M), (0.24 * M, 0.26 * M, 0.14 * M), mat)
        elif kind == "tool":
            box(f"tool_{i}", (x * M, 0, z + 0.06 * M), (0.3 * M, 0.16 * M, 0.12 * M), mat)
        else:
            for k in range(3 if detail else 1):
                drum(f"bottle_{i}_{k}", ((x + 0.09 * (k - 1)) * M, 0.02 * M * k, z), 0.035 * M, 0.2 * M, mat, sides=8 if detail else 6)


if __name__ == "__main__":
    build("supply_shelf", make, "small", label="Supply shelf", ref="Design/supply-shelf.png")
