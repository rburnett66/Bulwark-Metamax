"""Upgrade Bay — the hangar pad with two control towers and a small craft, from the owner's 4-view sheet
(ref/mv_upgrade_pad.jpg) and the concept crop (ref/upgrade_bay.jpg).  [MM-story_mw5oem5o_r] (story O10)

    python3 tools/blender/outposts/upgrade_bay.py [out_dir] [--render] [--anim]

Footprint: a 4 × 4 pad (one unit = one battle cell). A raised octagonal deck, its light walls lined with orange and
lit slots, a dark deck with a mid-grey grid and orange guide lines; a ramp out at the front and stubs to the other
three sides (the plus shape of the top view). Two octagonal control towers at the back corners: a stepped plinth,
a tapering shaft with a window, a lit band at the top and a cluster of spires. The small craft (node `craft`: white
fuselage, dark canopy, swept wings and upright fins in orange, blue engine glows) hovers over the middle, bobbing
gently (clip `craft`); a lit scanner frame (node `scan`) rises and falls over it while an upgrade installs (clip
`scan`); a small rover is parked at its right. Both clips loop while the bay works. Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, clip, cyl, drum, loft, mats, node_frame, octo, yloft  # noqa: E402

DECK = 0.36


def craft(p, x, y, z, M):
    """The small craft from the sheet, belly at (x, y, z), nose toward -Y."""
    yloft(p + "hull", [(y - 0.78, 0.04, 0.03, 0.01, x, z + 0.2), (y - 0.55, 0.13, 0.09, 0.04, x, z + 0.21),
                       (y - 0.1, 0.2, 0.13, 0.06, x, z + 0.24), (y + 0.45, 0.2, 0.14, 0.06, x, z + 0.25),
                       (y + 0.68, 0.14, 0.1, 0.04, x, z + 0.25)], M["white"])
    yloft(p + "canopy", [(y - 0.55, 0.04, 0.02, 0.01, x, z + 0.3), (y - 0.38, 0.1, 0.05, 0.02, x, z + 0.34),
                         (y - 0.1, 0.11, 0.05, 0.02, x, z + 0.37)], M["glass"])
    box(p + "spine", (x, y + 0.25, z + 0.4), (0.16, 0.6, 0.05), M["light"], chamfer=0.02)
    box(p + "nose_band", (x, y - 0.5, z + 0.21), (0.27, 0.05, 0.19), M["trim"])
    for sx in (-1, 1):
        loft(p + f"wing_{sx}", sorted([(x + sx * 0.18, 0.26, 0.03, 0.01, y + 0.2, z + 0.22),
                                       (x + sx * 0.78, 0.12, 0.02, 0.01, y + 0.38, z + 0.22)]), M["white"])
        box(p + f"wing_tip_{sx}", (x + sx * 0.84, y + 0.38, z + 0.22), (0.12, 0.24, 0.05), M["trim"], chamfer=0.015)
        box(p + f"wing_panel_{sx}", (x + sx * 0.45, y + 0.28, z + 0.25), (0.26, 0.2, 0.02), M["light"])
        cyl(p + f"pod_{sx}", (x + sx * 0.24, y + 0.3, z + 0.17), 0.08, 0.6, M["light"], sides=8, axis="Y")
        cyl(p + f"burn_{sx}", (x + sx * 0.24, y + 0.605, z + 0.17), 0.06, 0.02, M["glow"], sides=8, axis="Y")
        cyl(p + f"lift_{sx}", (x + sx * 0.24, y + 0.0, z + 0.085), 0.05, 0.01, M["glow"], sides=8, axis="Z")
        loft(p + f"fin_{sx}", [(z + 0.3, 0.025, 0.14, 0.0, x + sx * 0.14, y + 0.48),
                               (z + 0.62, 0.02, 0.07, 0.0, x + sx * 0.17, y + 0.64)], M["trim"], axis="Z")


def rover(p, x, y, z, M):
    """The little service rover parked beside the craft."""
    box(p + "body", (x, y, z + 0.14), (0.3, 0.46, 0.14), M["white"], chamfer=0.04)
    box(p + "cab", (x, y - 0.06, z + 0.26), (0.22, 0.2, 0.1), M["light"], chamfer=0.03)
    box(p + "visor", (x, y - 0.165, z + 0.27), (0.16, 0.01, 0.04), M["glow"])
    box(p + "rack", (x, y + 0.14, z + 0.25), (0.24, 0.14, 0.06), M["mid"])
    box(p + "stripe", (x + 0.152, y, z + 0.15), (0.01, 0.3, 0.03), M["trim"])
    for sx in (-1, 1):
        for wy in (-0.14, 0.14):
            cyl(p + f"wheel_{sx}_{wy}", (x + sx * 0.17, y + wy, z + 0.07), 0.07, 0.06, M["dark"], sides=8, axis="X")


def tower(name, x, y, M, h=1.85):
    """A control tower: stepped plinth, tapering octagonal shaft with a window, lit band, roof and spires."""
    octo(f"{name}_plinth", x, y, DECK, DECK + 0.14, 0.34, 0.34, 0.11, M["mid"])
    octo(f"{name}_foot", x, y, DECK + 0.14, DECK + 0.3, 0.3, 0.3, 0.1, M["light"])
    octo(f"{name}_shaft", x, y, DECK + 0.3, DECK + h - 0.32, 0.24, 0.24, 0.08, M["white"])
    box(f"{name}_window", (x, y - 0.245, DECK + 0.85), (0.08, 0.02, 0.3), M["glass"])
    box(f"{name}_dot", (x + 0.1, y - 0.245, DECK + 0.45), (0.04, 0.02, 0.04), M["glow"])
    octo(f"{name}_head", x, y, DECK + h - 0.32, DECK + h - 0.08, 0.3, 0.3, 0.1, M["light"])
    for k in range(8):                                    # lit band of windows round the head
        a = math.radians(k * 45)
        w = box(f"{name}_band_{k}", (0, 0, 0), (0.02, 0.12, 0.06), M["glow"])
        w.rotation_euler = (0, 0, a)
        w.location = (x + 0.3 * math.cos(a), y + 0.3 * math.sin(a), DECK + h - 0.2)
    octo(f"{name}_roof", x, y, DECK + h - 0.08, DECK + h - 0.02, 0.26, 0.26, 0.09, M["mid"])
    drum(f"{name}_spire", (x, y, DECK + h - 0.02), 0.08, 0.2, M["mid"], sides=8, r1=0.05)
    drum(f"{name}_mast", (x, y, DECK + h + 0.18), 0.025, 0.36, M["dark"], sides=6)
    drum(f"feat_{name}_tip", (x, y, DECK + h + 0.54), 0.035, 0.04, M["glow"], sides=6)
    for k, (dx, dy, hh) in enumerate(((0.14, 0.05, 0.22), (-0.12, -0.08, 0.16))):
        drum(f"{name}_aerial_{k}", (x + dx, y + dy, DECK + h - 0.02), 0.02, hh, M["dark"], sides=6)


def make():
    M = mats()
    # the raised deck: dark foot, light wall with orange slots and lit slits, white rim, dark deck
    octo("foot", 0, 0.1, 0.0, 0.08, 1.78, 1.78, 0.6, M["dark"])
    octo("wall", 0, 0.1, 0.08, DECK - 0.06, 1.7, 1.7, 0.56, M["light"])
    octo("rim", 0, 0.1, DECK - 0.06, DECK, 1.74, 1.74, 0.58, M["white"])
    octo("deck", 0, 0.1, DECK, DECK + 0.01, 1.56, 1.56, 0.5, M["deck"])
    for k in range(8):
        a = math.radians(k * 45)
        if k == 6:
            continue                                      # the front ramp
        for j, off in enumerate((-0.45, 0.45)):
            mat = M["trim"] if j == 0 else M["glow"]
            px, py = 1.705 * math.cos(a) - off * math.sin(a), 0.1 + 1.705 * math.sin(a) + off * math.cos(a)
            w = box(f"wall_slot_{k}_{j}", (0, 0, 0), (0.02, 0.3, 0.06), mat)
            w.rotation_euler = (0, 0, a)
            w.location = (px, py, 0.2)
    # deck grid and orange guide lines
    for k in range(-3, 4):
        box(f"grid_x_{k}", (k * 0.45, 0.1, DECK + 0.012), (0.012, 2.8, 0.004), M["mid"])
        box(f"grid_y_{k}", (0, 0.1 + k * 0.45, DECK + 0.012), (2.8, 0.012, 0.004), M["mid"])
    for sx in (-1, 1):
        box(f"guide_{sx}", (sx * 0.62, 0.0, DECK + 0.016), (0.03, 2.4, 0.004), M["trim"])
    box("guide_front", (0, -1.2, DECK + 0.016), (1.27, 0.03, 0.004), M["trim"])
    box("guide_back", (0, 1.2, DECK + 0.016), (1.27, 0.03, 0.004), M["trim"])

    # the front ramp and stub extensions to the sides and back (the plus shape)
    n = 4
    for i in range(n):
        top = DECK * (n - i) / n
        box(f"ramp_{i}", (0, -1.66 - 0.11 * i, top / 2), (0.86, 0.11, top), M["mid"])
        box(f"ramp_edge_{i}", (0, -1.715 - 0.11 * i, top - 0.004), (0.8, 0.012, 0.008), M["trim"])
    for sx in (-1, 1):
        box(f"ramp_rail_{sx}", (sx * 0.46, -1.78, DECK / 2), (0.08, 0.44, DECK), M["light"])
    for k, (x, y, sx, sy) in enumerate(((-1.82, 0.1, 0.3, 0.86), (1.82, 0.1, 0.3, 0.86), (0, 1.92, 0.86, 0.2))):
        box(f"stub_{k}", (x, y, (DECK - 0.04) / 2), (sx, sy, DECK - 0.04), M["light"])
        box(f"stub_top_{k}", (x, y, DECK - 0.03), (sx - 0.06, sy - 0.06, 0.02), M["deck"])
        box(f"stub_line_{k}", (x, y, DECK - 0.018), (0.03 if sy > sx else sx - 0.2, 0.03 if sx > sy else sy - 0.2, 0.004), M["trim"])

    # the control towers at the back corners
    tower("tower_l", -1.12, 1.1, M)
    tower("tower_r", 1.12, 1.1, M)

    # the craft (node `craft`): hovers and bobs over the middle of the deck
    cz = DECK + 0.12
    craft("craft__", 0, -0.15, cz, M)
    node_frame("craft", (0, -0.15, cz))
    clip("craft", "travel", 3.0, vec=(0, 0, 0.1))
    for sx in (-1, 1):                                    # landing pads under the hover points
        cyl(f"hover_pad_{sx}", (sx * 0.24, -0.15, DECK + 0.015), 0.12, 0.01, M["glow"], sides=12, axis="Z")

    # the scanner frame (node `scan`): a lit rectangle that rises and falls over the craft
    sz, sy0, hx, hy = DECK + 0.05, -0.2, 0.95, 0.8
    for sy in (-1, 1):
        box(f"scan__bar_y_{sy}", (0, sy0 + sy * hy, sz), (2 * hx, 0.04, 0.03), M["glow"])
    for sx in (-1, 1):
        box(f"scan__bar_x_{sx}", (sx * hx, sy0, sz), (0.04, 2 * hy, 0.03), M["glow"])
    for sx in (-1, 1):                                    # the scanner's guide posts at the corners
        for sy in (-1, 1):
            box(f"scan_post_{sx}_{sy}", (sx * (hx + 0.05), sy0 + sy * (hy + 0.05), DECK + 0.4), (0.06, 0.06, 0.8), M["mid"])
            box(f"scan_post_cap_{sx}_{sy}", (sx * (hx + 0.05), sy0 + sy * (hy + 0.05), DECK + 0.82), (0.09, 0.09, 0.04),
                M["trim"])
    node_frame("scan", (0, sy0, sz))
    clip("scan", "travel", 4.0, vec=(0, 0, 0.68))

    rover("rover_", 1.25, -0.75, DECK, M)

    anchor("craft", (0, -0.15, cz))
    anchor("craft_exit", (0, -0.15, cz + 4.0))
    anchor("ramp", (0, -2.05, 0.0))
    anchor("power", (0, 2.0, 0.02))


if __name__ == "__main__":
    build("upgradeBay", make, ref="mv_upgrade_pad.jpg")
