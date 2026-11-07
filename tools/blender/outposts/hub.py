"""Outpost Hub — the landing platform at the centre of the owner's outpost concept.  [MM-story_mw5oect7_m]

    python3 tools/blender/outposts/hub.py [out_dir] [--render]

Footprint: a 6 × 6 pad (one unit = one battle cell). From the concept crop ref/hub.jpg: a wide octagonal deck
on a light-grey wall with lit slits, a dark landing deck with orange markings, the cargo shuttle parked in the
middle (node `shuttle`, so the sell animation can lift it off), cargo pods with lit faces on both sides, a gate
block at the front and two ramps running down from the deck. Front = -Y.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, mats, octo, ring, window_strip  # noqa: E402
from shuttle import make_shuttle  # noqa: E402

DECK_Z = 0.72


def make():
    M = mats()
    # platform: dark foot, light wall band with lit slits, white rim, dark landing deck
    octo("base", 0, 0, 0.0, 0.14, 3.0, 2.72, 0.95, M["dark"])
    octo("wall", 0, 0, 0.14, 0.6, 2.9, 2.62, 0.9, M["light"], bevel=0.02)
    octo("rim", 0, 0, 0.6, 0.7, 2.98, 2.7, 0.94, M["white"])
    octo("deck", 0, 0, 0.7, DECK_Z, 2.72, 2.44, 0.82, M["deck"])
    for side in (-1, 1):                                  # lit slits and orange plates along the side walls
        for k, y in enumerate((-1.2, -0.4, 0.4, 1.2)):
            box(f"side_win_{side}_{k}", (side * 2.91, y, 0.42), (0.03, 0.4, 0.05), M["glow"])
            box(f"side_plate_{side}_{k}", (side * 2.91, y, 0.26), (0.03, 0.2, 0.06), M["trim"])
    for k in range(-5, 6):                                # wall dividers on the front and back faces
        x = k * 0.36
        for fy in (-1, 1):
            box(f"rib_{fy}_{k}", (x, fy * 2.625, 0.37), (0.06, 0.04, 0.46), M["mid"])
    window_strip("back_win", -1.6, 1.6, 2.62, 0.45, 0.05, M["glow"], n=6, face=1)

    # deck markings: an orange landing frame and a lit pad ring around the shuttle
    for sx in (-1, 1):
        box(f"mark_side_{sx}", (sx * 1.85, 0.0, DECK_Z + 0.005), (0.05, 3.0, 0.01), M["trim"])
        box(f"mark_tick_{sx}", (sx * 1.6, -1.5, DECK_Z + 0.005), (0.5, 0.05, 0.01), M["trim"])
        box(f"mark_tick_b_{sx}", (sx * 1.6, 1.5, DECK_Z + 0.005), (0.5, 0.05, 0.01), M["trim"])
    box("mark_front", (0, -1.9, DECK_Z + 0.005), (1.6, 0.05, 0.01), M["trim"])
    ring("pad_ring", (0, -0.05, DECK_Z), 2.0, 1.94, 0.012, M["glow"], sides=32)

    # cargo pods: light crates with lit faces, two per side
    for i, (x, y) in enumerate(((-2.25, -0.35), (-2.0, -1.45), (2.25, -0.35), (2.0, -1.45), (-2.2, 1.85), (2.2, 1.85))):
        z = DECK_Z
        box(f"pod_{i}", (x, y, z + 0.17), (0.4, 0.4, 0.3), M["light"], chamfer=0.05)
        box(f"pod_cap_{i}", (x, y, z + 0.34), (0.3, 0.3, 0.05), M["mid"])
        box(f"pod_face_{i}", (x, y - 0.205, z + 0.18), (0.22, 0.02, 0.08), M["glow"])
        box(f"pod_band_{i}", (x, y, z + 0.08), (0.42, 0.42, 0.04), M["trim"])
    # service gantries behind the wing roots
    for sx in (-1, 1):
        box(f"gantry_{sx}", (sx * 1.15, 1.55, DECK_Z + 0.22), (0.36, 0.36, 0.44), M["mid"], chamfer=0.04)
        box(f"gantry_light_{sx}", (sx * 1.15, 1.365, DECK_Z + 0.3), (0.2, 0.02, 0.08), M["glow"])

    # front gate block between the ramps
    octo("gate", 0, -2.85, 0.0, 0.66, 0.85, 0.42, 0.18, M["light"], bevel=0.02)
    box("gate_top", (0, -2.85, 0.69), (1.6, 0.8, 0.06), M["white"])
    box("gate_door", (0, -3.28, 0.26), (0.5, 0.03, 0.4), M["dark"])
    box("gate_light", (0, -3.285, 0.52), (0.6, 0.02, 0.06), M["glow"])
    for sx in (-1, 1):
        box(f"gate_plate_{sx}", (sx * 0.55, -3.28, 0.35), (0.18, 0.03, 0.16), M["trim"])

    # two ramps down from the deck at the front, stepped, with orange edge strips and white side rails
    n = 6
    for sx in (-1, 1):
        rx = sx * 1.65
        for i in range(n):
            top = 0.7 * (n - i) / n
            y = -2.7 - 0.2 * i - 0.1
            box(f"ramp_{sx}_{i}", (rx, y, top / 2), (0.9, 0.2, top), M["mid"])
            box(f"ramp_edge_{sx}_{i}", (rx, y - 0.095, top - 0.01), (0.86, 0.02, 0.02), M["trim"])
        for rs in (-1, 1):
            box(f"rail_{sx}_{rs}", (rx + rs * 0.5, -3.3, 0.38), (0.1, 1.2, 0.08), M["white"])
            box(f"rail_post_{sx}_{rs}", (rx + rs * 0.5, -3.85, 0.15), (0.1, 0.1, 0.3), M["white"])

    # the parked shuttle (node `shuttle`): lifts off for the sell animation
    # scaled up 1.55× about its pad so it fills the deck as in the concept
    import bpy
    before = set(bpy.context.scene.objects)
    pad, k = (0.0, -0.05, DECK_Z), 1.55
    make_shuttle(M, pad, "shuttle__")
    for ob in set(bpy.context.scene.objects) - before:
        ob.scale = (k, k, k)
        ob.location = tuple(c * (1 - k) for c in pad)

    anchor("shuttle_pad", (0.0, -0.05, DECK_Z))
    anchor("shuttle_exit", (0.0, -0.05, DECK_Z + 4.0), scale=1.55)
    anchor("gate", (0.0, -3.3, 0.0))


if __name__ == "__main__":
    build("hub", make, ref="hub.jpg")
