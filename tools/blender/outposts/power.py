"""Power Station I — the round reactor building, from the owner's 4-view sheet (ref/mv_power.jpg).  [MM-story_mw5oect7_m]

    python3 tools/blender/outposts/power.py [out_dir] [--render]

Footprint: a 4 × 4 pad (one unit = one battle cell). A low octagonal outer wall with orange-lit slits and
machinery on its deck; four ramps in a cross (the front one runs up to the drum door); a light drum with lit
windows whose open top shows the glowing core basin (node `core`); a smaller central tower rising out of the core
on a glass sleeve that shows the lit core column, with a white cap, an orange nub and an antenna. Three lit
conduits run out from the front right (node `conduit`), as in the first concept. Power Station II is the reactor
(power_ii.py). Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, drum, mats, octo, ring, window_strip  # noqa: E402


def make():
    M = mats()
    # outer wall: dark foot, light octagonal wall with orange slits and dark dividers, mid deck
    octo("foot", 0, 0, 0.0, 0.1, 1.85, 1.85, 0.62, M["dark"])
    octo("wall", 0, 0, 0.1, 0.42, 1.78, 1.78, 0.58, M["light"], bevel=0.02)
    octo("wall_cap", 0, 0, 0.42, 0.47, 1.82, 1.82, 0.6, M["white"])
    octo("deck", 0, 0, 0.47, 0.49, 1.6, 1.6, 0.5, M["deck"])
    for k in range(16):
        a = math.radians(k * 22.5)
        r = 1.78 / max(abs(math.cos(a)), abs(math.sin(a)), 0.83)
        box(f"wall_rib_{k}", (r * math.cos(a), r * math.sin(a), 0.26), (0.07, 0.07, 0.3), M["dark"])
    for side in (-1, 1):
        window_strip(f"slits_{side}", -1.05, 1.05, side * 1.78, 0.27, 0.06, M["trim"], n=4, face=side)
    for side in (-1, 1):
        for k, y in enumerate((-0.7, 0.7)):
            box(f"slit_side_{side}_{k}", (side * 1.79, y, 0.27), (0.03, 0.4, 0.06), M["trim"])

    # four ramps in a cross, standing out from the wall; the front one is wide and leads to the drum door
    for k, (dx, dy) in enumerate(((0, -1), (0, 1), (-1, 0), (1, 0))):
        w = 0.62 if k == 0 else 0.42
        for i in range(4):
            top = 0.47 * (i + 1) / 4
            d = 2.06 - 0.13 * i
            size = (w, 0.16, top) if dx == 0 else (0.16, w, top)
            box(f"ramp_{k}_{i}", (dx * d, dy * d, top / 2), size, M["mid"])
            edge = (w, 0.03, 0.01) if dx == 0 else (0.03, w, 0.01)
            box(f"ramp_edge_{k}_{i}", (dx * (d + 0.065), dy * (d + 0.065), top + 0.005), edge, M["trim"])
        cheek = (0.08, 0.5, 0.2) if dx == 0 else (0.5, 0.08, 0.2)
        for sx in (-1, 1):                                 # low white cheeks along each ramp
            off = sx * (w / 2 + 0.04)
            at = (off, dy * 1.9, 0.1) if dx == 0 else (dx * 1.9, off, 0.1)
            box(f"ramp_cheek_{k}_{sx}", at, cheek, M["white"])
    # front walkway from the ramp to the door
    box("walk", (0, -1.35, 0.5), (0.62, 0.6, 0.02), M["mid"])

    # machinery on the deck between the ramps
    for k, (x, y) in enumerate(((-1.15, -0.95), (1.15, -0.95), (-1.15, 1.0), (1.2, 0.95))):
        box(f"mach_{k}", (x, y, 0.62), (0.36, 0.32, 0.26), M["light"], chamfer=0.04)
        box(f"mach_top_{k}", (x, y, 0.77), (0.26, 0.22, 0.05), M["mid"])
        box(f"mach_face_{k}", (x, y - 0.165, 0.64), (0.18, 0.02, 0.05), M["glow"])

    # drum: light wall with lit windows and a front door, white lip, open top over the glowing core basin
    drum("drum_foot", (0, 0, 0.49), 1.12, 0.08, M["mid"], sides=16)
    ring("drum_wall", (0, 0, 0.57), 1.05, 0.82, 0.48, M["light"], sides=16)
    ring("drum_lip", (0, 0, 1.05), 1.09, 0.8, 0.08, M["white"], sides=16)
    ring("drum_inner", (0, 0, 0.75), 0.82, 0.7, 0.3, M["dark"], sides=16)
    for k in range(16):
        a = math.radians(11.25 + k * 22.5)
        x, y = 1.055 * math.cos(a), 1.055 * math.sin(a)
        if abs(math.degrees(a) - 270) < 20:                # the door faces front
            continue
        ob = box(f"drum_win_{k}", (0, 0, 0), (0.03, 0.16, 0.06), M["glow"] if k % 3 else M["trim"])
        ob.rotation_euler = (0, 0, a)
        ob.location = (x, y, 0.84)
    box("door", (0, -1.04, 0.72), (0.34, 0.06, 0.4), M["dark"])
    box("door_frame", (0, -1.07, 0.95), (0.44, 0.03, 0.05), M["white"])
    box("door_light", (0, -1.075, 0.88), (0.18, 0.02, 0.04), M["glow"])
    drum("basin", (0, 0, 0.57), 0.7, 0.3, M["dark"], sides=16)
    drum("core__pool", (0, 0, 0.87), 0.68, 0.02, M["glow"], sides=24)
    ring("core__band_0", (0, 0, 0.89), 0.55, 0.5, 0.015, M["dark"], sides=24)

    # central tower rising out of the core: glass sleeve over the lit core column, white segmented cap
    drum("core__column", (0, 0, 0.89), 0.3, 0.62, M["glow"], sides=12)
    for k in range(6):                                     # sleeve mullions
        a = math.radians(k * 60)
        box(f"sleeve_post_{k}", (0.42 * math.cos(a), 0.42 * math.sin(a), 1.2), (0.06, 0.06, 0.62), M["mid"])
    ring("sleeve_base", (0, 0, 0.89), 0.48, 0.32, 0.08, M["mid"], sides=12)
    drum("tower", (0, 0, 1.51), 0.52, 0.42, M["light"], sides=12)
    ring("tower_band", (0, 0, 1.68), 0.535, 0.5, 0.06, M["glow"], sides=12)
    ring("tower_cap", (0, 0, 1.93), 0.56, 0.3, 0.1, M["white"], sides=12)
    drum("tower_mouth", (0, 0, 1.93), 0.3, 0.06, M["dark"], sides=12)
    drum("core__eye", (0, 0, 1.99), 0.16, 0.02, M["glow"], sides=12)
    box("tower_nub", (0.3, 0.3, 2.08), (0.12, 0.12, 0.12), M["trim"], chamfer=0.03)
    drum("mast", (-0.32, 0.25, 2.03), 0.025, 0.55, M["mid"], sides=6)
    drum("feat_mast_tip", (-0.32, 0.25, 2.58), 0.035, 0.05, M["glow"], sides=6)

    # three lit conduits leaving the front right across the deck and off the pad
    for k, dx in enumerate((-0.15, 0.0, 0.15)):
        x = 1.05 + dx
        box(f"conduit_bed_{k}", (x, -1.45, 0.5), (0.11, 0.5, 0.03), M["dark"])
        box(f"conduit__top_{k}", (x, -1.45, 0.52), (0.045, 0.5, 0.02), M["glow"])
        box(f"conduit_drop_{k}", (x, -1.82, 0.24), (0.11, 0.08, 0.48), M["dark"])
        box(f"conduit__face_{k}", (x, -1.865, 0.24), (0.045, 0.02, 0.48), M["glow"])
        box(f"conduit__run_{k}", (x, -2.2, 0.02), (0.045, 0.7, 0.02), M["glow"])

    anchor("core", (0, 0, 0.9))
    anchor("conduit", (1.05, -2.55, 0.02))
    anchor("door", (0, -2.4, 0.0))


if __name__ == "__main__":
    build("power", make, ref="power_mv_front.jpg")
