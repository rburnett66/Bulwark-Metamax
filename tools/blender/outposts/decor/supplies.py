"""Supply crate stack — outpost decor, LARGE (edge cells only).  [MM-story_mwfacvte_b]

Reference: Design/supplies.png — about 2.0 × 1.5 m of stacked military crates (olive, khaki, teal, rust) two and three
high: TOOLS, MEDICAL (a red cross), RATIONS and FRAGILE stencils, lid seams and latches.

    python tools/blender/outposts/decor/supplies.py [out_dir] [--render]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decor_common import M, box, build, mats  # noqa: E402

# (x, y, z-level, w, d, h, colour, stencil) in metres
CRATES = [
    (-0.62, -0.35, 0, 0.62, 0.5, 0.42, "olive", "tools"), (0.02, -0.38, 0, 0.6, 0.45, 0.4, "khaki", "medical"),
    (0.66, -0.34, 0, 0.62, 0.5, 0.44, "teal", "tools"), (-0.6, 0.25, 0, 0.66, 0.6, 0.46, "khaki", None),
    (0.05, 0.22, 0, 0.6, 0.55, 0.44, "rust", None), (0.7, 0.26, 0, 0.55, 0.55, 0.42, "olive", None),
    (-0.5, -0.1, 1, 0.6, 0.5, 0.36, "teal", "fragile"), (0.15, -0.12, 1, 0.55, 0.48, 0.34, "olive", "rations"),
    (0.66, 0.18, 1, 0.45, 0.42, 0.3, "khaki", None), (-0.15, 0.1, 2, 0.45, 0.4, 0.28, "olive", None),
]


def make(detail):
    P = mats()
    tops = {}
    for i, (x, y, lvl, w, d, h, col, stencil) in enumerate(CRATES if detail else CRATES[:7]):
        z = 0.0 if lvl == 0 else tops.get(lvl - 1, 0.44)
        cx, cy, ch = x * M, y * M, h * M
        box(f"crate_{i}", (cx, cy, z * M + ch / 2), (w * M, d * M, ch), P[col], chamfer=0.012 * M if detail else 0.0)
        tops[lvl] = max(tops.get(lvl, 0), z + h)
        if not detail:
            continue
        box(f"seam_{i}", (cx, cy - d * M / 2 - 0.002 * M, z * M + ch * 0.8), (w * M * 0.98, 0.006 * M, 0.02 * M), P["dark"])
        for sx in (-1, 1):
            box(f"latch_{i}_{sx}", (cx + sx * w * M * 0.3, cy - d * M / 2 - 0.006 * M, z * M + ch * 0.7), (0.05 * M, 0.01 * M, 0.05 * M), P["steel"])
        if stencil == "medical":
            box(f"cross_h_{i}", (cx, cy - d * M / 2 - 0.004 * M, z * M + ch * 0.4), (0.14 * M, 0.006 * M, 0.04 * M), P["red"])
            box(f"cross_v_{i}", (cx, cy - d * M / 2 - 0.004 * M, z * M + ch * 0.4), (0.04 * M, 0.006 * M, 0.14 * M), P["red"])
        elif stencil:
            box(f"stencil_{i}", (cx, cy - d * M / 2 - 0.004 * M, z * M + ch * 0.38), (w * M * 0.45, 0.006 * M, 0.06 * M), P["white"])


if __name__ == "__main__":
    build("supplies", make, "large", label="Supply crate stack", ref="Design/supplies.png")
