"""Laser Cutter Rig — the aluminum rig, from the owner's outpost tiles (ref/laser_tile.jpg).  [MM-story_mw5oect7_m]

    python3 tools/blender/outposts/rig_laser.py [out_dir] [--render] [--anim]

Footprint: a 3 × 3 pad (one unit = one battle cell). A dark rail deck with orange edge lines; an emitter cart (white
chamfered housing on a turntable, a dark muzzle with a lit ring) firing a faceted beam into the ore outcrop at the
front, where a cut block glows; crystal clusters of ore around the deck; an ore cart rover running the back track.
Nodes and clips: `emitter` and `beam` sweep together across the outcrop (the beam hides when the rig idles, in
code); `cart` runs out and back along its track. Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, clip, cyl, drum, mats, node_frame, octo, ring, ship  # noqa: E402

SWEEP = 3.0                                               # seconds per beam sweep (emitter and beam share it)


def crystal(name, x, y, h, M, n=5, seed=0.0):
    """A cluster of hexagonal ore crystals on a dark rock base."""
    drum(f"{name}_rock", (x, y, 0.0), 0.26, 0.12, M["dark"], sides=7, r1=0.2)
    for k in range(n):
        a = seed + 2 * math.pi * k / n
        r = 0 if k == 0 else 0.12
        hh = h * (1.0 if k == 0 else 0.55 + 0.1 * (k % 3))
        ob = cyl(f"{name}_xtal_{k}", (0, 0, hh / 2), 0.06 if k else 0.08, hh, M["ore"], sides=6, axis="Z", r1=0.01)
        ob.rotation_euler = (math.radians(14 * math.sin(a)) if k else 0, math.radians(14 * math.cos(a)) if k else 0, 0)
        ob.location = (x + r * math.cos(a), y + r * math.sin(a), 0.1)


def make():
    M = mats()
    M["ore"] = ship.mat("ore", (0.03, 0.3, 0.75), emit=(0.03, 0.3, 0.75), strength=1.4)
    M["beam"] = ship.mat("beam", (0.06, 0.42, 0.95), emit=(0.06, 0.42, 0.95), strength=2.0)

    # rail deck: dark plate, mid track strips with orange edge lines, a socket at the back
    octo("deck", 0, 0, 0.0, 0.1, 1.45, 1.4, 0.4, M["dark"])
    for k, y in enumerate((0.55, 0.95)):
        box(f"track_{k}", (0.2, y, 0.11), (2.3, 0.1, 0.03), M["mid"])
        box(f"track_line_{k}", (0.2, y - 0.055, 0.115), (2.3, 0.015, 0.01), M["trim"])
    box("track_cross", (0, 0.1, 0.11), (0.3, 1.2, 0.03), M["mid"])
    box("socket", (-1.15, 1.05, 0.2), (0.3, 0.3, 0.2), M["mid"], chamfer=0.03)
    box("socket_light", (-1.15, 0.895, 0.22), (0.12, 0.02, 0.05), M["glow"])
    for sx in (-1, 1):                                     # side plinths with orange caps
        box(f"plinth_{sx}", (sx * 0.62, -0.05, 0.18), (0.3, 0.5, 0.16), M["mid"], chamfer=0.03)
        box(f"plinth_cap_{sx}", (sx * 0.62, -0.05, 0.27), (0.2, 0.36, 0.03), M["trim"])

    # emitter cart (node `emitter`): turntable, white housing, dark muzzle with a lit ring
    piv = (0.0, -0.05, 0.12)
    drum("turntable", (0, -0.05, 0.1), 0.38, 0.06, M["mid"], sides=12)
    ring("turntable_ring", (0, -0.05, 0.16), 0.4, 0.34, 0.02, M["trim"], sides=12)
    box("emitter__housing", (0, 0.0, 0.5), (0.64, 0.8, 0.62), M["white"], chamfer=0.14)
    box("emitter__roof", (0, 0.06, 0.84), (0.4, 0.5, 0.08), M["light"], chamfer=0.03)
    box("emitter__hatch_light", (0.12, -0.2, 0.885), (0.08, 0.08, 0.01), M["glow"])
    cyl("emitter__muzzle", (0, -0.45, 0.48), 0.24, 0.16, M["dark"], sides=12, axis="Y")
    cyl("emitter__ring", (0, -0.54, 0.48), 0.26, 0.04, M["glow"], sides=12, axis="Y")
    cyl("emitter__lens", (0, -0.535, 0.48), 0.14, 0.03, M["beam"], sides=12, axis="Y")
    for sx in (-1, 1):
        box(f"emitter__vent_{sx}", (sx * 0.325, 0.05, 0.5), (0.02, 0.32, 0.1), M["trim"])
        box(f"emitter__side_light_{sx}", (sx * 0.325, -0.22, 0.62), (0.02, 0.06, 0.06), M["glow"])
    box("emitter__cable", (0, 0.45, 0.25), (0.12, 0.2, 0.12), M["dark"])

    # the beam (node `beam`): a faceted cone out of the muzzle into the cut block at the outcrop
    cyl("beam__cone", (0, -0.98, 0.44), 0.1, 0.9, M["beam"], sides=6, axis="Y", r1=0.2)
    box("beam__cut", (0, -1.48, 0.3), (0.26, 0.2, 0.2), M["beam"], chamfer=0.05)

    # the outcrop under the beam and crystal clusters around the deck (the deposit; tinted with the ore colour)
    drum("outcrop", (0, -1.42, 0.0), 0.42, 0.16, M["dark"], sides=8, r1=0.3)
    crystal("deposit_f", 0.35, -1.25, 0.42, M, seed=0.4)
    crystal("deposit_l", -1.05, -0.75, 0.55, M, seed=1.2)
    crystal("deposit_r", 1.1, -0.95, 0.4, M, seed=2.1)
    crystal("deposit_b", -1.1, 0.25, 0.48, M, seed=0.8)

    # the ore cart rover (node `cart`) on the back track
    cx, cy = 0.55, 0.75
    box("cart__body", (cx, cy, 0.42), (0.62, 0.4, 0.3), M["white"], chamfer=0.08)
    box("cart__cab", (cx - 0.18, cy, 0.63), (0.26, 0.34, 0.16), M["light"], chamfer=0.04)
    box("cart__window", (cx - 0.315, cy, 0.63), (0.02, 0.24, 0.08), M["glow"])
    box("cart__bin", (cx + 0.12, cy, 0.61), (0.3, 0.36, 0.1), M["mid"])
    box("cart__ore", (cx + 0.12, cy, 0.67), (0.24, 0.28, 0.05), M["ore"])
    box("cart__stripe", (cx, cy - 0.205, 0.46), (0.3, 0.02, 0.04), M["trim"])
    for wx in (-0.2, 0.2):
        for wy in (-0.26, 0.26):
            cyl(f"cart__wheel_{wx}_{wy}", (cx + wx, cy + wy, 0.18), 0.17, 0.12, M["dark"], sides=10, axis="Y")
            cyl(f"cart__hub_{wx}_{wy}", (cx + wx, cy + wy * 1.25, 0.18), 0.07, 0.02, M["mid"], sides=8, axis="Y")

    node_frame("emitter", piv)
    clip("emitter", "sweep", SWEEP, amp=14)
    node_frame("beam", piv)
    clip("beam", "sweep", SWEEP, amp=14)
    node_frame("cart", (cx, cy, 0.0))
    clip("cart", "travel", 5.0, vec=(-1.25, 0, 0))

    anchor("muzzle", (0, -0.56, 0.48))
    anchor("cut", (0, -1.48, 0.32))
    anchor("debris", (0, -1.48, 0.36), color="ore")           # cut fragments spray off the outcrop
    anchor("power", (-1.15, 1.05, 0.02))


if __name__ == "__main__":
    build("rig_laser", make, ref="laser_tile.jpg")
