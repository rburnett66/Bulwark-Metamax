"""Power Station II — the energy reactor, from the owner's revised concept (ref/set_power_reactor.jpg).  [MM-story_mw5oect7_m]

    python3 tools/blender/outposts/power.py [out_dir] [--render]

Footprint: a 4 × 4 pad (one unit = one battle cell). A white-rimmed octagonal pad; a round stepped base with lit
slits and a glowing ring channel; a dark core column ringed with light (node `core`, pulses at runtime) rising
through a cluster of capsule cells (four large on the diagonals, four small between) with lit windows and orange
straps; a white crown with a glowing top, two orange fins, and a light beam rising from it (node `beam`). Pod
antennae carry small lights. Station II (outpost design §4.5) adds cells later. Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, drum, mats, octo, ring  # noqa: E402

TOP = 2.55


def rbox(name, at, size, material, yaw):
    """A box turned `yaw` radians about Z around its own centre (for parts facing out from the column)."""
    ob = box(name, (0, 0, 0), size, material)
    ob.rotation_euler = (0, 0, yaw)
    ob.location = at
    return ob


def make():
    M = mats()
    # pad: dark foot, white rim, mid deck with orange corner marks
    octo("pad_foot", 0, 0, 0.0, 0.1, 2.0, 2.0, 0.62, M["dark"])
    octo("pad_rim", 0, 0, 0.1, 0.2, 1.95, 1.95, 0.6, M["white"])
    octo("pad_deck", 0, 0, 0.2, 0.22, 1.78, 1.78, 0.52, M["deck"])
    for k in range(8):
        a = math.radians(22.5 + k * 45)
        rbox(f"pad_mark_{k}", (1.6 * math.cos(a), 1.6 * math.sin(a), 0.225), (0.04, 0.4, 0.01), M["trim"], a)

    # round stepped base: a light segmented wall with lit slits, a white collar, a glowing channel, a mid tier
    drum("base_wall", (0, 0, 0.22), 1.5, 0.36, M["light"], sides=16)
    ring("base_collar", (0, 0, 0.58), 1.54, 1.2, 0.07, M["white"], sides=16)
    for k in range(16):
        a = math.radians(11.25 + k * 22.5)
        rbox(f"base_rib_{k}", (1.51 * math.cos(a), 1.51 * math.sin(a), 0.4), (0.06, 0.08, 0.34), M["mid"], a)
        mat = M["glow"] if k % 2 else M["trim"]
        b = math.radians(k * 22.5)
        rbox(f"base_slot_{k}", (1.505 * math.cos(b), 1.505 * math.sin(b), 0.45), (0.02, 0.22, 0.07), mat, b)
    ring("core__channel", (0, 0, 0.6), 1.15, 1.05, 0.03, M["glow"], sides=32)
    drum("tier", (0, 0, 0.58), 1.02, 0.22, M["mid"], sides=16)
    ring("core__swirl", (0, 0, 0.8), 0.72, 0.64, 0.02, M["glow"], sides=32)

    # core column: dark shaft with glowing rings
    drum("column", (0, 0, 0.8), 0.42, TOP - 0.8, M["dark"], sides=12)
    for k, z in enumerate((0.95, 1.35, 1.75, 2.15)):
        ring(f"core__ring_{k}", (0, 0, z), 0.47, 0.42, 0.05, M["glow"], sides=24)

    # capsule cells: four large on the diagonals, four small between, lit windows facing out, orange straps
    for k in range(8):
        big = k % 2 == 0
        a = math.radians(45 + k * 45)
        r = 0.72 if big else 0.62
        cx, cy = r * math.cos(a), r * math.sin(a)
        rad, top = (0.3, 2.2) if big else (0.2, 1.75)
        drum(f"cell_{k}_foot", (cx, cy, 0.8), rad + 0.04, 0.12, M["mid"], sides=8)
        drum(f"cell_{k}", (cx, cy, 0.92), rad, top - 0.92, M["light"], sides=8)
        drum(f"cell_{k}_cap", (cx, cy, top), rad, 0.12, M["white"], sides=8, r1=rad * 0.6)
        ox, oy = math.cos(a), math.sin(a)
        rbox(f"cell_{k}_win", (cx + ox * (rad + 0.005), cy + oy * (rad + 0.005), (0.92 + top) / 2 + 0.1),
             (0.02, rad * 0.75, (top - 0.92) * 0.4), M["glow"], a)
        for z in (1.05, top - 0.12):
            rbox(f"cell_{k}_strap_{z:.2f}", (cx + ox * (rad + 0.01), cy + oy * (rad + 0.01), z),
                 (0.03, rad * 0.9, 0.07), M["trim"], a)
        if big and k in (2, 6):                            # the side cells carry lit antennae
            drum(f"cell_{k}_mast", (cx, cy, top + 0.12), 0.025, 0.42, M["mid"], sides=6)
            drum(f"feat_cell_{k}_tip", (cx, cy, top + 0.54), 0.04, 0.05, M["glow"], sides=6)

    # crown: white segmented ring with a lit band, a glowing top disc, two orange fins at the back
    ring("crown", (0, 0, TOP - 0.3), 0.66, 0.4, 0.3, M["white"], sides=12)
    ring("crown_band", (0, 0, TOP - 0.18), 0.68, 0.66, 0.06, M["glow"], sides=12)
    ring("crown_lip", (0, 0, TOP), 0.6, 0.42, 0.05, M["mid"], sides=12)
    drum("core__top", (0, 0, TOP - 0.06), 0.4, 0.05, M["glow"], sides=16)
    ring("core__top_ring", (0, 0, TOP - 0.01), 0.26, 0.2, 0.02, M["dark"], sides=16)
    for sx in (-1, 1):
        box(f"fin_{sx}", (sx * 0.38, 0.36, TOP + 0.18), (0.12, 0.12, 0.4), M["trim"], chamfer=0.03)

    # the beam (node `beam`): a thin light shaft rising from the crown
    drum("beam__shaft", (0, 0, TOP), 0.05, 1.1, M["glow"], sides=6, r1=0.015)

    # conduit stubs at the pad edge, front right and back left, where the map's power lines join
    for k, (x, y) in enumerate(((1.3, -1.6), (-1.3, 1.6))):
        box(f"conduit__stub_{k}", (x, y, 0.225), (0.12, 0.6, 0.02), M["glow"])

    anchor("core", (0, 0, 1.6))
    anchor("beam", (0, 0, TOP + 1.1))
    anchor("conduit", (1.3, -1.95, 0.02))


if __name__ == "__main__":
    build("power_ii", make, ref="power_reactor.jpg")
