"""Tug — the small utility craft that drifts around a capital ship to sell its scale.

    python3 tools/blender/ships/tug.py [out_dir] [--no-render]

About 0.6 units (≈ 15 m) long against the capital ships' 21–24 units (≈ 550 m): a chunky cab with a lit
bridge, a forward tow clamp, two side engine pods and a roof beacon. Neutral industrial grey with
hazard-yellow bands so it reads as a work boat beside any faction; its engines are tinted at runtime to the
capital ship's faction colour. The hull is drawn at S × its design size; windows and mast stay at the
standard human scale (common.DETAIL), which is exactly what makes a small craft read as small.
Port side + centreline only — the build mirrors.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DETAIL, box, build, engine, loft, mat, window_row  # noqa: E402

S = 0.55                     # hull scale: 1.1 u design → ≈ 0.6 u (15 m)


def v(*xs):
    return tuple(x * S for x in xs)


def make():
    hull = mat("hull", (0.42, 0.44, 0.47), rough=0.55, metal=0.3)
    dark = mat("dark", (0.10, 0.11, 0.13), rough=0.5, metal=0.4)
    hazard = mat("hazard", (0.85, 0.62, 0.08), rough=0.5)
    glow = mat("glow", (0.6, 0.8, 1.0), emit=(0.75, 0.9, 1.0), strength=6)
    beacon = mat("beacon", (1.0, 0.4, 0.2), emit=(1.0, 0.45, 0.15), strength=8)

    # cab: a blunt chamfered block, taller at the bridge
    loft("cab", [v(-0.45, 0.22, 0.17, 0.07, 0, 0.0), v(0.22, 0.22, 0.19, 0.07, 0, 0.02),
                 v(0.42, 0.17, 0.13, 0.06, 0, 0.0)], hull)
    box("bridge", v(0.12, 0, 0.25), v(0.32, 0.30, 0.16), hull, chamfer=0.04 * S)
    # two standard windows across the bridge front (one per side after mirroring)
    wy = DETAIL["win"]["w"] / 2 + 0.01
    window_row("win_bridge", (0.28 * S, wy, 0.25 * S), (0.28 * S, wy, 0.25 * S), glow, face="x", count=1)
    box("hazard_band", v(-0.15, 0, 0.0), v(0.06, 0.45, 0.39), hazard)
    m = DETAIL["mast"]["t"]
    box("mast_roof", (-0.05 * S, 0, 0.33 * S + 0.05), (m, m, 0.1), dark)
    box("feat_beacon", (-0.05 * S, 0, 0.33 * S + 0.115), (0.05, 0.05, 0.03), beacon)

    # tow clamp: two jaws reaching forward
    box("clamp_root", v(0.47, 0, -0.03), v(0.08, 0.26, 0.12), dark)
    box("clamp_jaw", v(0.58, 0.11, -0.03), v(0.18, 0.04, 0.08), dark)
    box("clamp_tip", v(0.66, 0.11, -0.03), v(0.04, 0.06, 0.1), hazard)

    # side engine pods (port; mirrored)
    loft("pod", [v(-0.55, 0.08, 0.09, 0.03, 0.31, -0.04), v(0.18, 0.08, 0.09, 0.03, 0.31, -0.04),
                 v(0.28, 0.05, 0.06, 0.02, 0.31, -0.04)], hull)
    box("pylon", v(-0.12, 0.25, -0.03), v(0.22, 0.06, 0.05), dark)
    box("pod_band", v(0.0, 0.31, -0.04), v(0.04, 0.17, 0.19), hazard)
    engine(v(-0.56, 0.31, -0.04), 0.06 * S, dark, depth=0.08 * S)
    engine(v(-0.46, 0.0, 0.0), 0.08 * S, dark, depth=0.08 * S)


if __name__ == "__main__":
    build("tug", make)
