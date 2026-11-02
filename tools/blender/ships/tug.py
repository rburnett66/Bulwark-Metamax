"""Tug — the small utility craft that drifts around a capital ship to sell its scale.

    python3 tools/blender/ships/tug.py [out_dir] [--no-render]

About 1.1 units long against the capital ships' 21–24 (≈ 1 : 20), deliberately simple and readable at a
glance: a chunky cab with a lit bridge strip, a forward tow clamp, two side engine pods and a roof beacon.
Neutral industrial grey with hazard-yellow bands so it reads as a work boat beside any faction; its engines
are tinted at runtime to the capital ship's faction colour. Port side + centreline only — the build mirrors.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import box, build, cyl, engine, loft, mat  # noqa: E402


def make():
    hull = mat("hull", (0.42, 0.44, 0.47), rough=0.55, metal=0.3)
    dark = mat("dark", (0.10, 0.11, 0.13), rough=0.5, metal=0.4)
    hazard = mat("hazard", (0.85, 0.62, 0.08), rough=0.5)
    glow = mat("glow", (0.6, 0.8, 1.0), emit=(0.75, 0.9, 1.0), strength=6)
    beacon = mat("beacon", (1.0, 0.4, 0.2), emit=(1.0, 0.45, 0.15), strength=8)

    # cab: a blunt chamfered block, taller at the bridge
    loft("cab", [(-0.45, 0.22, 0.17, 0.07, 0, 0.0), (0.22, 0.22, 0.19, 0.07, 0, 0.02),
                 (0.42, 0.17, 0.13, 0.06, 0, 0.0)], hull)
    box("bridge", (0.12, 0, 0.24), (0.32, 0.30, 0.12), hull, chamfer=0.04)
    box("bridge_glass", (0.285, 0, 0.25), (0.02, 0.24, 0.04), glow)
    box("hazard_band", (-0.15, 0, 0.0), (0.06, 0.45, 0.39), hazard)
    box("roof_mast", (-0.05, 0, 0.36), (0.03, 0.03, 0.12), dark)
    box("roof_beacon", (-0.05, 0, 0.43), (0.05, 0.05, 0.03), beacon)

    # tow clamp: two jaws reaching forward
    box("clamp_root", (0.47, 0, -0.03), (0.08, 0.26, 0.12), dark)
    box("clamp_jaw", (0.58, 0.11, -0.03), (0.18, 0.04, 0.08), dark)
    box("clamp_tip", (0.66, 0.11, -0.03), (0.04, 0.06, 0.1), hazard)

    # side engine pods (port; mirrored)
    loft("pod", [(-0.55, 0.08, 0.09, 0.03, 0.31, -0.04), (0.18, 0.08, 0.09, 0.03, 0.31, -0.04),
                 (0.28, 0.05, 0.06, 0.02, 0.31, -0.04)], hull)
    box("pylon", (-0.12, 0.25, -0.03), (0.22, 0.06, 0.05), dark)
    box("pod_band", (0.0, 0.31, -0.04), (0.04, 0.17, 0.19), hazard)
    engine((-0.56, 0.31, -0.04), 0.06, dark, depth=0.08)
    engine((-0.46, 0.0, 0.0), 0.08, dark, depth=0.08)


if __name__ == "__main__":
    build("tug", make)
