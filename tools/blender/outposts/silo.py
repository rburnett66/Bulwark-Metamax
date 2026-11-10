"""Silo — the farm's store for harvested goods, an outpost building on a pad (Farming-Design §6).  [MM-task_mwagi1nr_1e]

    python3 tools/blender/outposts/silo.py [out_dir] [--render] [--anim]
    blender -b -P tools/blender/outposts/silo.py -- [out_dir] [--render]

Footprint: a pad's 2 × 2 cells, modelled at the pad scale like the other pad buildings (4 × 4 units; the view draws
it at padModelScale). A tall corrugated grain silo on the stepped plinth: a ribbed drum with stiffener rings and
vertical seams, a conical roof with a catwalk ring and its railing, a roof vent whose cowl turns while the farm works
(node `vent`, clip `vent`); a caged LADDER up the front to the catwalk; the FILL GAUGE, a lit column in a dark frame
with tick marks on the front face (node `gauge`, pivot at its foot: the view scales it on Y with the Silo's fill, as
the Storage Tower's hologram); a raised HOPPER on four legs at the front right that takes the harvest, with the
bucket-elevator leg running up to the roof; a discharge chute with a hazard-striped spout, a control box and a
grain cart. Flat shaded, geometry detail; the outpost material set. Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, clip, cyl, drum, mats, node_frame, octo, ring, strut  # noqa: E402
import common as ship  # noqa: E402

PLINTH = 0.2
SX, SY, R = -0.35, 0.3, 1.05       # the silo drum's centre and radius
TOP = 3.0                           # eave of the drum
FRONT = -math.pi / 2                # the front of the drum faces -Y


def on_drum(a, r, z):
    return (SX + r * math.cos(a), SY + r * math.sin(a), z)


def make():
    M = mats()
    M["straw"] = ship.mat("farm_straw", (0.62, 0.50, 0.24), rough=0.9, metal=0.0)
    M["hazard"] = ship.mat("farm_hazard", (0.85, 0.66, 0.08), rough=0.6, metal=0.1)   # hazard yellow (body, not trim)
    # ── the plinth
    octo("foot", 0, 0, 0.0, 0.08, 1.98, 1.96, 0.42, M["dark"])
    octo("step", 0, 0, 0.08, PLINTH - 0.02, 1.9, 1.88, 0.38, M["mid"])
    octo("deck", 0, 0, PLINTH - 0.02, PLINTH, 1.86, 1.84, 0.36, M["deck"])
    for i in range(11):
        for y in (-1.963, 1.963):
            box(f"foot_rivet_{i}_{y:.0f}", (-1.5 + 0.3 * i, y, 0.05), (0.03, 0.012, 0.03), M["mid"])
    box("front_strip", (0, -1.905, 0.135), (3.2, 0.02, 0.04), M["trim"])

    # ── the drum: foundation ring, corrugated body, stiffener rings, vertical seams, rivet rows
    drum("found", (SX, SY, PLINTH), R + 0.14, 0.14, M["mid"], sides=24)
    drum("found_cap", (SX, SY, PLINTH + 0.14), R + 0.08, 0.04, M["dark"], sides=24)
    drum("body", (SX, SY, PLINTH + 0.18), R, TOP - PLINTH - 0.18, M["white"], sides=24)
    for k, z in enumerate((0.75, 1.3, 1.85, 2.4)):
        ring(f"stiffener_{k}", (SX, SY, z), R + 0.035, R - 0.01, 0.06, M["light"], sides=24)
    ring("stiffener_trim", (SX, SY, TOP - 0.12), R + 0.04, R - 0.01, 0.08, M["trim"], sides=24)
    for k in range(24):                                   # vertical seams: every other face, skipping the gauge
        a = 2 * math.pi * (k + 0.5) / 24 + math.pi / 24
        if abs(math.remainder(a - (FRONT + 0.55), 2 * math.pi)) < 0.2:
            continue
        seam = box(f"seam_{k}", (0, 0, 0), (0.03, 0.025, TOP - PLINTH - 0.4), M["light"])
        seam.rotation_euler = (0, 0, a + math.pi / 2)
        seam.location = on_drum(a, R + 0.008, (PLINTH + TOP) / 2 + 0.05)

    # ── the conical roof, catwalk and railing, the vent (node `vent`)
    drum("roof", (SX, SY, TOP), R + 0.06, 0.55, M["light"], sides=24, r1=0.28)
    for k in range(12):                                   # roof ribs
        a = 2 * math.pi * k / 12
        strut(f"roof_rib_{k}", on_drum(a, R + 0.05, TOP + 0.01), on_drum(a, 0.3, TOP + 0.55), 0.018, M["mid"], sides=4)
    ring("catwalk", (SX, SY, TOP - 0.03), R + 0.28, R + 0.02, 0.04, M["deck"], sides=24)
    ring("catwalk_rail", (SX, SY, TOP + 0.25), R + 0.28, R + 0.25, 0.03, M["trim"], sides=24)
    for k in range(16):
        a = 2 * math.pi * k / 16
        x, y, _ = on_drum(a, R + 0.265, 0)
        box(f"catwalk_post_{k}", (x, y, TOP + 0.12), (0.025, 0.025, 0.26), M["mid"])
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        strut(f"catwalk_brace_{k}", on_drum(a, R + 0.27, TOP - 0.03), on_drum(a, R, TOP - 0.45), 0.018, M["mid"], sides=4)
    drum("vent_collar", (SX, SY, TOP + 0.55), 0.3, 0.06, M["mid"], sides=16)
    drum("vent_glow", (SX, SY, TOP + 0.61), 0.22, 0.04, M["glow"], sides=16)
    vz = TOP + 0.65
    drum("vent__cowl", (SX, SY, vz), 0.22, 0.18, M["white"], sides=12, r1=0.12)
    drum("vent__cap", (SX, SY, vz + 0.18), 0.16, 0.04, M["trim"], sides=12)
    for k in range(6):                                   # the cowl's fins: they read as it turns
        a = 2 * math.pi * k / 6
        fin = box(f"vent__fin_{k}", (0, 0, 0), (0.12, 0.015, 0.16), M["light"])
        fin.rotation_euler = (0, 0, a)
        fin.location = (SX + 0.2 * math.cos(a), SY + 0.2 * math.sin(a), vz + 0.08)
    node_frame("vent", (SX, SY, vz))
    clip("vent", "spin", 6.0, axis="Z")
    drum("feat_beacon", (SX, SY, vz + 0.22), 0.03, 0.06, M["glow"], sides=6)

    # ── the ladder up the front (slightly left of centre) with its safety cage hoops
    la = FRONT - 0.3
    lx, ly, _ = on_drum(la, R + 0.12, 0)
    tang = (-math.sin(la), math.cos(la))                  # along the drum's surface at the ladder
    for s in (-1, 1):
        x, y = lx + tang[0] * s * 0.12, ly + tang[1] * s * 0.12
        strut(f"ladder_rail_{s}", (x, y, PLINTH + 0.18), (x, y, TOP + 0.3), 0.016, M["mid"], sides=4)
    for i in range(18):
        z = PLINTH + 0.35 + i * 0.145
        strut(f"ladder_rung_{i}", (lx - tang[0] * 0.12, ly - tang[1] * 0.12, z), (lx + tang[0] * 0.12, ly + tang[1] * 0.12, z),
              0.01, M["light"], sides=4)
    for i in range(6):                                    # the cage: hoops from 1.1 up
        z = PLINTH + 1.1 + i * 0.32
        ring(f"ladder_hoop_{i}", (lx + math.cos(la) * 0.1, ly + math.sin(la) * 0.1, z), 0.2, 0.18, 0.025, M["mid"], sides=10)
    for s in (-1, 0, 1):
        ox, oy = math.cos(la) * 0.28 + tang[0] * s * 0.16, math.sin(la) * 0.28 + tang[1] * s * 0.16
        box(f"ladder_cage_bar_{s}", (lx + ox - math.cos(la) * 0.0, ly + oy, PLINTH + 1.1 + 0.8), (0.02, 0.02, 1.6), M["mid"])

    # ── the fill gauge (node `gauge`): a dark frame with tick marks and a lit column, front right of centre
    ga = FRONT + 0.55
    gx, gy, _ = on_drum(ga, R + 0.03, 0)
    face = ga + math.pi / 2
    g0, g1 = PLINTH + 0.45, TOP - 0.3
    frame = box("gauge_frame", (0, 0, 0), (0.22, 0.05, g1 - g0 + 0.12), M["dark"])
    frame.rotation_euler = (0, 0, face)
    frame.location = (gx, gy, (g0 + g1) / 2)
    for i in range(9):
        z = g0 + (g1 - g0) * i / 8
        t = box(f"gauge_tick_{i}", (0, 0, 0), (0.28 if i % 4 == 0 else 0.25, 0.04, 0.02), M["trim"])
        t.rotation_euler = (0, 0, face)
        t.location = (gx, gy, z)
    ox, oy = math.cos(ga) * 0.03, math.sin(ga) * 0.03
    col = box("gauge__column", (0, 0, 0), (0.12, 0.03, g1 - g0), M["glow"])
    col.rotation_euler = (0, 0, face)
    col.location = (gx + ox, gy + oy, (g0 + g1) / 2)
    node_frame("gauge", (gx + ox, gy + oy, g0))
    box("gauge_head", (gx + ox * 1.5, gy + oy * 1.5, g1 + 0.12), (0.2, 0.2, 0.1), M["light"], chamfer=0.03)

    # ── the hopper at the front right on four legs, with the bucket elevator leg up to the roof
    hx, hy, hz = 1.15, -1.05, 0.95
    drum("hopper_cone", (hx, hy, hz - 0.45), 0.1, 0.45, M["light"], sides=8, r1=0.48)
    drum("hopper_bin", (hx, hy, hz), 0.48, 0.3, M["white"], sides=8)
    ring("hopper_lip", (hx, hy, hz + 0.3), 0.5, 0.44, 0.04, M["trim"], sides=8)
    drum("hopper_grain", (hx, hy, hz + 0.3), 0.44, 0.12, M["straw"], sides=8, r1=0.12)   # the heaped harvest
    for k in range(4):
        a = math.radians(45 + 90 * k)
        x, y = hx + 0.42 * math.cos(a), hy + 0.42 * math.sin(a)
        box(f"hopper_leg_{k}", (x, y, (PLINTH + hz + 0.1) / 2), (0.06, 0.06, hz + 0.1 - PLINTH), M["mid"], chamfer=0.01)
        strut(f"hopper_brace_{k}", (x, y, PLINTH + 0.1), (hx + 0.42 * math.cos(a + math.pi / 2), hy + 0.42 * math.sin(a + math.pi / 2), hz - 0.05),
              0.012, M["dark"], sides=4)
    drum("hopper_spout", (hx, hy, PLINTH + 0.3), 0.07, 0.22, M["dark"], sides=8)
    for k in range(3):                                   # hazard bands on the spout
        drum(f"hopper_hazard_{k}", (hx, hy, PLINTH + 0.32 + 0.06 * k), 0.075, 0.025, M["hazard"] if k % 2 == 0 else M["dark"], sides=8)
    # the elevator leg: a square casing from beside the hopper up past the roof, a head box, a spout to the roof
    ex, ey = 0.95, -0.2
    box("leg_casing", (ex, ey, (PLINTH + TOP + 0.9) / 2), (0.18, 0.18, TOP + 0.9 - PLINTH), M["light"], chamfer=0.02)
    for i in range(7):
        box(f"leg_band_{i}", (ex, ey, PLINTH + 0.4 + i * 0.5), (0.21, 0.21, 0.04), M["mid"])
    box("leg_head", (ex, ey, TOP + 0.95), (0.3, 0.26, 0.2), M["white"], chamfer=0.04)
    box("leg_head_light", (ex, ey - 0.135, TOP + 0.95), (0.16, 0.01, 0.04), M["glow"])
    strut("leg_spout", (ex - 0.1, ey + 0.02, TOP + 0.92), (SX + 0.2, SY - 0.05, TOP + 0.6), 0.05, M["mid"], sides=8)
    strut("leg_feed", (hx - 0.15, hy + 0.15, hz + 0.05), (ex, ey - 0.08, PLINTH + 0.6), 0.045, M["mid"], sides=8)
    for k, z in enumerate((1.2, 2.2)):                   # stays from the leg to the drum
        strut(f"leg_stay_{k}", (ex - 0.09, ey, z), on_drum(-0.25, R, z), 0.015, M["dark"], sides=4)

    # ── the discharge chute at the drum's foot, a control box, a grain cart
    ca = FRONT - 0.95
    cx, cy, _ = on_drum(ca, R + 0.1, 0)
    strut("chute", on_drum(ca, R - 0.05, PLINTH + 0.5), (cx + math.cos(ca) * 0.3, cy + math.sin(ca) * 0.3, PLINTH + 0.3), 0.07,
          M["mid"], sides=8)
    box("chute_gate", (cx, cy, PLINTH + 0.47), (0.2, 0.2, 0.06), M["trim"])
    cart_x, cart_y = cx + math.cos(ca) * 0.55, cy + math.sin(ca) * 0.55
    box("cart_bin", (cart_x, cart_y, PLINTH + 0.2), (0.42, 0.3, 0.18), M["light"], chamfer=0.03)
    box("cart_load", (cart_x, cart_y, PLINTH + 0.29), (0.38, 0.26, 0.04), M["straw"])
    box("cart_band", (cart_x, cart_y - 0.152, PLINTH + 0.24), (0.42, 0.01, 0.04), M["trim"])
    for sx in (-1, 1):
        cyl(f"cart_wheel_{sx}", (cart_x + sx * 0.15, cart_y, PLINTH + 0.07), 0.07, 0.34, M["dark"], sides=8, axis="Y")
    box("control_box", (0.15, -1.05, PLINTH + 0.35), (0.34, 0.2, 0.5), M["light"], chamfer=0.03)
    box("control_screen", (0.15, -1.152, PLINTH + 0.45), (0.22, 0.01, 0.14), M["glass"])
    box("control_lamp", (0.15, -1.156, PLINTH + 0.45), (0.16, 0.01, 0.04), M["glow"])
    box("control_stripe", (0.15, -1.152, PLINTH + 0.2), (0.3, 0.01, 0.04), M["trim"])
    strut("control_conduit", (0.15, -0.95, PLINTH + 0.5), on_drum(FRONT + 0.15, R, PLINTH + 0.5), 0.02, M["dark"], sides=4)
    for k, (x, y) in enumerate(((1.55, 1.45), (1.2, 1.6))):
        drum(f"sack_{k}", (x, y, PLINTH), 0.14, 0.24, M["straw"], sides=8, r1=0.1)

    anchor("hopper", (hx, hy, hz + 0.3))
    anchor("gauge", (gx, gy, g1))
    anchor("chute", (cx, cy, PLINTH))
    anchor("power", (0, 1.95, 0.02))


if __name__ == "__main__":
    build("silo", make)
