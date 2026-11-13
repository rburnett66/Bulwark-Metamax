"""Heavy cargo cube OC-47 — outpost decor, LARGE (edge cells only), and the farm's cargo.  [MM-story_mwfacvte_b]

Reference: Design/cargo-cube.png (2.2 m cube). The parts are cargo_parts.cube.

    python tools/blender/outposts/decor/cargo_cube.py [out_dir] [--render]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decor_common import build, mats  # noqa: E402
from cargo_parts import cube  # noqa: E402


def make(detail):
    cube("cube", (0, 0, 0), mats(), detail)


if __name__ == "__main__":
    build("cargo_cube", make, "large", label="Heavy cargo cube OC-47", ref="Design/cargo-cube.png")
