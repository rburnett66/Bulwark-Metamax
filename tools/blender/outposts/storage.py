"""Storage Tower — the ore depot, from the owner's 4-view sheet (ref/mv_storage.jpg).  [MM-story_mw5oect7_m]

    python3 tools/blender/outposts/storage.py [out_dir] [--render]

Footprint: a 4 × 4 pad (one unit = one battle cell). A blocky body on a stepped skirt; a sunken roof court holding
a lit hologram box (node `hologram`: the fill level shows here at runtime); a raised block at the left carrying
a radar dish (node `dish`, turns slowly about anchor `dish`); two raised blocks at the right with stepped spires;
a central entry portal with an orange lintel and stairs, and side doors with lit windows. Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, cyl, drum, mats, octo, ring  # noqa: E402

ROOF = 1.0


def spire(name, x, y, z, height, M):
    """A stepped spire: three shrinking blocks, a mast and a lit tip."""
    for i, (w, h) in enumerate(((0.36, 0.22), (0.26, 0.2), (0.16, 0.18))):
        box(f"{name}_step_{i}", (x, y, z + h / 2), (w, w, h), M["mid"] if i % 2 else M["light"], chamfer=0.03)
        z += h
    drum(f"{name}_mast", (x, y, z), 0.035, height, M["dark"], sides=6)
    drum(f"feat_{name}_tip", (x, y, z + height), 0.045, 0.05, M["glow"], sides=6)


def make():
    M = mats()
    # stepped skirt and the main body
    octo("skirt_0", 0, 0, 0.0, 0.1, 2.0, 1.85, 0.5, M["dark"])
    octo("skirt_1", 0, 0, 0.1, 0.22, 1.9, 1.75, 0.46, M["mid"])
    octo("body", 0, 0, 0.22, ROOF - 0.06, 1.72, 1.52, 0.4, M["light"], bevel=0.02)
    octo("body_band", 0, 0, 0.56, 0.62, 1.74, 1.54, 0.41, M["mid"])
    octo("roof_rim", 0, 0, ROOF - 0.06, ROOF, 1.76, 1.56, 0.42, M["white"])
    octo("roof_deck", 0, 0, ROOF, ROOF + 0.015, 1.58, 1.38, 0.34, M["mid"])

    # front: central portal with a dark door, orange lintel and lit transom; stairs; side doors with windows
    box("portal", (0, -1.6, 0.6), (1.2, 0.3, 0.8), M["light"], chamfer=0.05)
    box("portal_cap", (0, -1.6, 1.03), (1.3, 0.36, 0.08), M["white"])
    box("portal_door", (0, -1.755, 0.5), (0.62, 0.03, 0.56), M["dark"])
    box("portal_door_seam", (0, -1.77, 0.5), (0.02, 0.02, 0.5), M["mid"])
    box("portal_lintel", (0, -1.765, 0.88), (0.8, 0.03, 0.07), M["trim"])
    box("portal_light", (0, -1.775, 0.73), (0.3, 0.02, 0.04), M["glow"])
    for i in range(4):
        top = 0.22 * (i + 1) / 4
        box(f"stair_{i}", (0, -1.83 - 0.11 * (3 - i), top / 2), (0.86, 0.11, top), M["mid"])
    for sx in (-1, 1):
        box(f"stair_rail_{sx}", (sx * 0.48, -1.95, 0.16), (0.08, 0.4, 0.32), M["light"])
        box(f"stair_line_{sx}", (sx * 0.4, -1.95, 0.225), (0.03, 0.4, 0.01), M["trim"])
        x = sx * 1.1
        box(f"side_door_{sx}", (x, -1.53, 0.45), (0.42, 0.03, 0.46), M["dark"])
        box(f"side_win_{sx}", (x, -1.535, 0.82), (0.3, 0.03, 0.08), M["glow"])
        box(f"side_plate_{sx}", (sx * 0.73, -1.765, 0.6), (0.06, 0.02, 0.2), M["trim"])
        # east / west wings: low bump-outs with a lit slot and an orange stripe
        box(f"wing_{sx}", (sx * 1.86, 0.1, 0.35), (0.3, 1.1, 0.5), M["light"], chamfer=0.04)
        box(f"wing_slot_{sx}", (sx * 2.015, 0.1, 0.42), (0.02, 0.5, 0.06), M["glow"])
        box(f"wing_stripe_{sx}", (sx * 2.015, 0.1, 0.26), (0.02, 0.8, 0.04), M["trim"])
    box("back_band", (0, 1.53, 0.75), (2.0, 0.03, 0.06), M["trim"])

    # sunken court with the hologram (node `hologram`): a lit plate and a low wire box
    hx, hy, s, h = 0.05, -0.2, 1.1, 0.42
    box("court", (hx, hy, ROOF + 0.02), (s + 0.3, s + 0.3, 0.04), M["dark"])
    box("hologram__plate", (hx, hy, ROOF + 0.045), (s, s, 0.01), M["glow"])
    box("court_inner", (hx, hy, ROOF + 0.052), (s - 0.16, s - 0.16, 0.01), M["deck"])
    t, z0, z1 = 0.03, ROOF + 0.06, ROOF + 0.06 + h
    for a in (-1, 1):
        for b in (-1, 1):
            box(f"hologram__post_{a}_{b}", (hx + a * s / 2, hy + b * s / 2, (z0 + z1) / 2), (t, t, h), M["glow"])
        box(f"hologram__x_{a}", (hx, hy + a * s / 2, z1), (s, t, t), M["glow"])
        box(f"hologram__y_{a}", (hx + a * s / 2, hy, z1), (t, s, t), M["glow"])
    for k in (-1, 1):                                      # target rings on the plate, as in the top view
        box(f"hologram__grid_x_{k}", (hx, hy + k * 0.2, ROOF + 0.06), (0.42, 0.02, 0.01), M["glow"])
        box(f"hologram__grid_y_{k}", (hx + k * 0.2, hy, ROOF + 0.06), (0.02, 0.42, 0.01), M["glow"])

    # raised block at the left carrying the dish
    octo("block_l", -1.12, 0.2, ROOF, ROOF + 0.38, 0.5, 1.05, 0.15, M["light"])
    box("block_l_cap", (-1.12, 0.2, ROOF + 0.41), (1.02, 2.12, 0.06), M["white"])
    box("block_l_win", (-1.12, -0.86, ROOF + 0.24), (0.4, 0.03, 0.08), M["glow"])
    mx, my = -1.12, 0.55
    drum("dish_mount", (mx, my, ROOF + 0.44), 0.3, 0.16, M["mid"], sides=12)
    ring("dish_mount_ring", (mx, my, ROOF + 0.6), 0.32, 0.24, 0.04, M["trim"], sides=12)
    pivot = (mx, my, ROOF + 0.72)
    parts = [
        cyl("dish__neck", (0, 0, -0.06), 0.06, 0.14, M["dark"], sides=8, axis="Z"),
        cyl("dish__bowl", (0, 0, 0.1), 0.12, 0.14, M["white"], sides=16, axis="Z", r1=0.46),
        cyl("dish__face", (0, 0, 0.175), 0.43, 0.01, M["light"], sides=16, axis="Z"),
        cyl("dish__horn", (0, 0, 0.3), 0.022, 0.24, M["dark"], sides=6, axis="Z"),
        cyl("dish__feed", (0, 0, 0.43), 0.05, 0.05, M["glow"], sides=6, axis="Z"),
    ]
    for ob in parts:                                       # tilted up toward the front left
        ob.rotation_euler = (math.radians(40), 0, math.radians(-35))
        ob.location = pivot

    # two raised blocks at the right with stepped spires, one at the back centre
    octo("block_rb", 1.12, 0.65, ROOF, ROOF + 0.45, 0.48, 0.55, 0.14, M["light"])
    box("block_rb_win", (1.12, 0.09, ROOF + 0.3), (0.36, 0.03, 0.08), M["glow"])
    spire("spire_rb", 1.12, 0.65, ROOF + 0.45, 0.6, M)
    octo("block_rf", 1.12, -0.6, ROOF, ROOF + 0.3, 0.42, 0.42, 0.12, M["light"])
    box("block_rf_plate", (1.12, -1.03, ROOF + 0.15), (0.12, 0.03, 0.16), M["trim"])
    spire("spire_rf", 1.12, -0.6, ROOF + 0.3, 0.35, M)
    octo("block_b", 0.1, 1.15, ROOF, ROOF + 0.3, 0.45, 0.3, 0.1, M["light"])
    spire("spire_b", 0.1, 1.15, ROOF + 0.3, 0.45, M)

    anchor("dish", pivot)
    anchor("hologram", (hx, hy, ROOF + 0.06), size=s, height=h)
    anchor("door", (0, -2.3, 0.0))


if __name__ == "__main__":
    build("storage", make, ref="storage.jpg")
