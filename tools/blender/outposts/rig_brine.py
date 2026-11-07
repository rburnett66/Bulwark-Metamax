"""Brine Pump Rig — the lithium rig, from the owner's 4-view sheet (ref/mv_brine.jpg).  [MM-story_mw5oect7_m]

    python3 tools/blender/outposts/rig_brine.py [out_dir] [--render]

Footprint: a 3 × 3 pad (one unit = one battle cell). The drill-bunker family: a light chamfered bunker framed by
pillars with lit panels, a dark portal and a dish on the roof (node `dish`). In front, a pump-jack over a round
wellhead: an A-frame derrick and a walking beam with a horsehead (node `pump`: the beam rocks about anchor
`pump`). Two tall tanks flank the bunker with glass windows of glowing pale brine (node `brine`: the level shows
here at runtime). Pipes with orange valve wheels run from the wellhead to the tanks, and three evaporation trays of
pale pink lithium salt sit at the front (node `salt`). Rubble heaps around the base. Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, cyl, drum, mats, octo, ring, ship  # noqa: E402
from rig_auger import heap  # noqa: E402


def rot(parts, pivot, euler):
    """Turn parts built about the origin by `euler` and place them at `pivot`."""
    for ob in parts:
        ob.rotation_euler = euler
        ob.location = pivot


def make():
    M = mats()
    M["ore"] = ship.mat("ore", (0.25, 0.55, 0.6), emit=(0.25, 0.55, 0.6), strength=1.2)
    M["brine"] = ship.mat("brine", (0.25, 0.8, 0.75), emit=(0.25, 0.8, 0.75), strength=1.2)
    M["salt"] = ship.mat("salt", (0.95, 0.78, 0.8), rough=0.8)

    # pad, rubble heaps and the bunker
    octo("pad", 0, 0, 0.0, 0.08, 1.45, 1.4, 0.35, M["dark"])
    for k, (x, y, r) in enumerate(((-1.25, 0.75, 0.38), (1.25, 0.75, 0.38), (-1.3, -0.9, 0.3), (1.3, -0.9, 0.3), (0, 1.2, 0.4))):
        heap(f"heap_{k}", x, y, r, 0.2, M, chunks=2, seed=k)
    box("body", (0, 0.35, 0.62), (1.7, 1.2, 1.08), M["white"], chamfer=0.28)
    box("roof", (0, 0.4, 1.17), (1.1, 0.8, 0.1), M["mid"], chamfer=0.04)
    for sx in (-1, 1):
        x = sx * 0.66
        box(f"pillar_{sx}", (x, -0.3, 0.55), (0.34, 0.4, 1.06), M["white"], chamfer=0.08)
        box(f"pillar_foot_{sx}", (x, -0.3, 0.06), (0.42, 0.48, 0.12), M["mid"])
        box(f"pillar_light_{sx}", (x, -0.505, 0.78), (0.06, 0.02, 0.12), M["glow"])
        box(f"pillar_dot_{sx}", (x, -0.505, 0.56), (0.04, 0.02, 0.04), M["glow"])
        box(f"roof_plate_{sx}", (sx * 0.45, 0.05, 1.28), (0.13, 0.13, 0.15), M["trim"], chamfer=0.03)
    box("lintel", (0, -0.3, 1.06), (1.66, 0.42, 0.12), M["white"], chamfer=0.04)
    box("lintel_light", (0, -0.515, 1.04), (0.36, 0.02, 0.05), M["glow"])
    box("portal", (0, -0.12, 0.52), (0.98, 0.1, 0.84), M["dark"])
    box("portal_inner", (0, -0.18, 0.5), (0.4, 0.04, 0.4), M["mid"])
    box("portal_inner_light", (0, -0.205, 0.5), (0.12, 0.02, 0.12), M["glow"])

    # dish on the roof (node `dish`)
    drum("dish_mount", (-0.38, 0.62, 1.22), 0.22, 0.14, M["mid"], sides=10)
    ring("dish_mount_ring", (-0.38, 0.62, 1.36), 0.24, 0.17, 0.04, M["trim"], sides=10)
    pivot = (-0.38, 0.62, 1.48)
    rot([cyl("dish__neck", (0, 0, -0.05), 0.05, 0.12, M["dark"], sides=8, axis="Z"),
         cyl("dish__bowl", (0, 0, 0.08), 0.09, 0.11, M["light"], sides=14, axis="Z", r1=0.26),
         cyl("dish__face", (0, 0, 0.135), 0.24, 0.01, M["mid"], sides=14, axis="Z"),
         cyl("dish__horn", (0, 0, 0.24), 0.018, 0.2, M["dark"], sides=6, axis="Z")],
        pivot, (math.radians(45), 0, math.radians(-20)))

    # tanks with glowing brine windows (node `brine`)
    for sx in (-1, 1):
        x, y = sx * 1.12, -0.15
        drum(f"tank_foot_{sx}", (x, y, 0.08), 0.38, 0.1, M["mid"], sides=10)
        drum(f"tank_{sx}", (x, y, 0.18), 0.33, 1.0, M["light"], sides=10)
        drum(f"tank_cap_{sx}", (x, y, 1.18), 0.33, 0.1, M["white"], sides=10, r1=0.24)
        box(f"tank_frame_{sx}", (x, y - 0.32, 0.65), (0.26, 0.04, 0.66), M["mid"])
        box(f"brine__window_{sx}", (x, y - 0.335, 0.65), (0.18, 0.03, 0.56), M["brine"])
        box(f"tank_light_{sx}", (x, y - 0.325, 1.06), (0.06, 0.02, 0.06), M["glow"])

    # wellhead and pump-jack (node `pump`: the walking beam and horsehead rock)
    wx, wy = 0.28, -0.78
    drum("well_0", (wx, wy, 0.08), 0.36, 0.14, M["mid"], sides=12)
    drum("well_1", (wx, wy, 0.22), 0.28, 0.14, M["light"], sides=12)
    ring("well_rim", (wx, wy, 0.36), 0.3, 0.22, 0.04, M["mid"], sides=12)
    drum("well_head", (wx, wy - 0.12, 0.36), 0.05, 0.4, M["dark"], sides=6)
    dx = wx - 0.32                                       # the derrick stands left of the well; the beam runs along X
    for sy in (-1, 1):                                   # A-frame derrick legs, spread front to back
        leg = box(f"derrick_{sy}", (0, 0, 0), (0.07, 0.07, 1.12), M["mid"])
        leg.rotation_euler = (math.radians(12 * sy), 0, 0)
        leg.location = (dx, wy + sy * 0.13, 0.82)
    for k, (z, w) in enumerate(((0.55, 0.36), (0.95, 0.22))):
        box(f"derrick_brace_{k}", (dx, wy, z), (0.05, w, 0.05), M["mid"])
    box("derrick_foot", (dx, wy, 0.12), (0.2, 0.5, 0.08), M["dark"])
    box("samson_post", (dx, wy, 1.4), (0.12, 0.12, 0.1), M["dark"])
    beam_pivot = (dx, wy, 1.48)
    rot([box("pump__beam", (0.08, 0, 0), (1.0, 0.1, 0.1), M["mid"]),
         box("pump__head", (0.56, 0, -0.06), (0.12, 0.14, 0.34), M["light"], chamfer=0.03),
         box("pump__bridle", (0.6, 0, -0.5), (0.02, 0.02, 0.56), M["dark"]),
         box("pump__tail", (-0.44, 0, -0.04), (0.16, 0.14, 0.14), M["mid"])],
        beam_pivot, (0, math.radians(5), 0))

    # pipes and valve wheels from the wellhead to the tanks
    for sx in (-1, 1):
        cyl(f"pipe_{sx}", (sx * 0.62, wy, 0.22), 0.06, 0.6, M["dark"], sides=8, axis="X")
        cyl(f"pipe_up_{sx}", (sx * 0.9, wy, 0.22), 0.07, 0.08, M["mid"], sides=8, axis="X")
        cyl(f"pipe_rise_{sx}", (sx * 0.95, wy + 0.2, 0.22), 0.06, 0.42, M["dark"], sides=8, axis="Y")
        cyl(f"valve_stem_{sx}", (sx * 0.52, wy, 0.38), 0.025, 0.22, M["mid"], sides=6, axis="Z")
        cyl(f"valve_wheel_{sx}", (sx * 0.52, wy - 0.02, 0.5), 0.1, 0.03, M["trim"], sides=10, axis="Y")
        cyl(f"valve_hub_{sx}", (sx * 0.52, wy - 0.04, 0.5), 0.03, 0.03, M["dark"], sides=6, axis="Y")

    # evaporation trays of lithium salt (node `salt`)
    for k in range(3):
        x = -0.62 + 0.62 * k
        box(f"tray_{k}", (x, -1.38, 0.1), (0.58, 0.46, 0.13), M["mid"], chamfer=0.02)
        box(f"salt__{k}", (x, -1.38, 0.15), (0.48, 0.36, 0.06), M["salt"])
        for j in range(3):
            box(f"salt__grain_{k}_{j}", (x - 0.14 + 0.14 * j, -1.38 + 0.06 * (j - 1), 0.19), (0.07, 0.06, 0.03), M["salt"])

    anchor("dish", pivot)
    anchor("pump", beam_pivot)
    anchor("brine_l", (-1.12, -0.5, 0.37), height=0.56)
    anchor("brine_r", (1.12, -0.5, 0.37), height=0.56)
    anchor("power", (0, 1.2, 0.02))


if __name__ == "__main__":
    build("rig_brine", make, ref="brine_front.jpg")
