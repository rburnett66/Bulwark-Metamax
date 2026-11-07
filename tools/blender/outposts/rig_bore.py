"""Deep Bore rig — the deep-seam drill, from the owner's drill sheets (ref/mv_drill_bore.jpg, mv_drill_bore_b.jpg).
[MM-story_mw5oem5o_r] (story O11's remaining rigs; outpost design §8.4)

    python3 tools/blender/outposts/rig_bore.py [out_dir] [--render] [--anim]

Footprint: a 3 × 3 pad, the Auger Drill's bunker family (one unit = one battle cell). A white chamfered bunker framed
by two pillars with lit panels, a dark portal over an ore chute; a low wing to the right with a side auger angled
into a rubble heap; at the front left the tall drill column, leaning back and out, its armoured housing broken by
glowing orange core bands; a dish on the roof; a big ventilation fan in an octagonal frame on the back wall.
Nodes and clips (all loop while the rig mines; Mk II plays them at 2×): `bore` (the core and bit inside the column
spin), `auger_r` (the screw spins), `ore` (ore rides down the chute), `fan` (the back fan turns), `dish` (turns).
Ores: Cobalt, Gallium, Tungsten, Vanadium, Platinum, Palladium, Europium (Rig_Head `bore`). Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, clip, cyl, drum, mats, node_frame, octo, ring, ship, yloft  # noqa: E402
from rig_auger import auger, heap  # noqa: E402

BORE_TILT = (math.radians(-21), math.radians(-9), 0.0)   # leans back (+Y) and out to the left, as on the sheets
BORE_BASE = (-1.02, -0.86, 0.22)


def column(M, hot):
    """The drill column, built along +Z from its base: the static housing (base node) and the spinning core and bit
    (node `bore`). Returns (housing parts, core parts) for the caller to tilt."""
    hs, cs = [], []
    # housing: a heavy lower sleeve, then collars with gaps where the glowing core shows, and a cap
    hs.append(cyl("column_sleeve", (0, 0, 0.42), 0.27, 0.84, M["mid"], sides=10, axis="Z"))
    hs.append(cyl("column_foot", (0, 0, 0.05), 0.31, 0.12, M["dark"], sides=10, axis="Z"))
    for k in range(3):                                   # armour plates on the sleeve
        a = math.radians(30 + k * 120)
        p = box(f"column_plate_{k}", (0, 0, 0), (0.08, 0.2, 0.5), M["light"], chamfer=0.02)
        p.location = (0.27 * math.cos(a), 0.27 * math.sin(a), 0.45)
        p.rotation_euler = (0, 0, a)
        hs.append(p)
    hs.append(cyl("column_trim_0", (0, 0, 0.86), 0.29, 0.06, M["trim"], sides=10, axis="Z"))
    z = 0.89
    for k, (h, gap) in enumerate(((0.32, 0.16), (0.22, 0.16), (0.2, 0.16), (0.18, 0.15))):
        hs.append(cyl(f"column_collar_{k}", (0, 0, z + h / 2), 0.24 - 0.012 * k, h, M["light"] if k % 2 else M["white"],
                      sides=10, axis="Z"))
        hs.append(cyl(f"column_lip_{k}", (0, 0, z + h - 0.02), 0.255 - 0.012 * k, 0.04, M["mid"], sides=10, axis="Z"))
        z += h + gap
    hs.append(cyl("column_cap", (0, 0, z + 0.06), 0.2, 0.12, M["mid"], sides=10, axis="Z", r1=0.13))
    hs.append(cyl("column_cap_trim", (0, 0, z + 0.015), 0.215, 0.03, M["trim"], sides=10, axis="Z"))
    hs.append(cyl("column_mast", (0, 0, z + 0.24), 0.03, 0.24, M["dark"], sides=6, axis="Z"))
    hs.append(cyl("feat_column_tip", (0, 0, z + 0.38), 0.045, 0.05, M["glow"], sides=6, axis="Z"))
    top = z
    # the core (node `bore`): a glowing orange barrel the full height, ribbed so the spin reads, and the bit
    cs.append(cyl("bore__core", (0, 0, 0.86 + (top - 0.86) / 2), 0.185, top - 0.86, hot, sides=10, axis="Z"))
    for k in range(int((top - 0.9) / 0.075)):
        t = math.radians(k * 50)
        rib = box(f"bore__rib_{k}", (0, 0, 0), (0.05, 0.06, 0.04), M["dark"])
        rib.location = (0.19 * math.cos(t), 0.19 * math.sin(t), 0.92 + 0.075 * k)
        rib.rotation_euler = (0, 0, t)
        cs.append(rib)
    cs.append(cyl("bore__bit", (0, 0, -0.12), 0.2, 0.24, M["dark"], sides=8, axis="Z", r1=0.26))
    cs.append(cyl("bore__bit_ring", (0, 0, -0.06), 0.24, 0.05, hot, sides=8, axis="Z"))
    cs.append(cyl("bore__tip", (0, 0, -0.32), 0.04, 0.18, M["mid"], sides=8, axis="Z", r1=0.18))
    for k in range(4):
        t = math.radians(45 + k * 90)
        tooth = box(f"bore__tooth_{k}", (0, 0, 0), (0.08, 0.06, 0.12), M["light"])
        tooth.location = (0.2 * math.cos(t), 0.2 * math.sin(t), -0.2)
        tooth.rotation_euler = (0, 0, t)
        cs.append(tooth)
    return hs, cs, top


def make():
    M = mats()
    M["ore"] = ship.mat("ore", (0.06, 0.2, 0.62), emit=(0.06, 0.2, 0.62), strength=1.5)
    hot = ship.mat("glow_core", (0.72, 0.2, 0.02), emit=(0.72, 0.2, 0.02), strength=2.5)   # glowing orange bands

    # pad and bunker body (the Auger Drill's bunker, a little deeper)
    octo("pad", 0, -0.1, 0.0, 0.08, 1.45, 1.35, 0.35, M["dark"])
    box("body", (0.05, 0.2, 0.62), (1.6, 1.36, 1.08), M["white"], chamfer=0.28)
    box("roof", (0.05, 0.25, 1.16), (1.1, 0.9, 0.1), M["mid"], chamfer=0.04)
    for sx in (-1, 1):
        x = 0.05 + sx * 0.62
        box(f"pillar_{sx}", (x, -0.52, 0.54), (0.36, 0.42, 1.04), M["white"], chamfer=0.08)
        box(f"pillar_foot_{sx}", (x, -0.52, 0.06), (0.44, 0.5, 0.12), M["mid"])
        box(f"pillar_light_{sx}", (x, -0.735, 0.74), (0.08, 0.02, 0.12), M["glow"])
        box(f"pillar_dot_{sx}", (x, -0.735, 0.5), (0.05, 0.02, 0.05), M["glow"])
        box(f"pillar_side_light_{sx}", (x + sx * 0.185, -0.6, 0.62), (0.02, 0.06, 0.1), M["glow"])
    box("lintel", (0.05, -0.52, 1.06), (1.6, 0.44, 0.12), M["white"], chamfer=0.04)
    box("lintel_light", (0.05, -0.745, 1.04), (0.4, 0.02, 0.06), M["glow"])
    box("portal", (0.05, -0.36, 0.52), (0.86, 0.1, 0.84), M["dark"])
    box("portal_frame", (0.05, -0.42, 0.94), (0.9, 0.06, 0.06), M["mid"])
    for k in (-1, 1):
        box(f"portal_jaw_{k}", (0.05 + k * 0.22, -0.4, 0.64), (0.3, 0.04, 0.36), M["mid"], chamfer=0.04)

    # ore chute from the portal down to the ground (node `ore` slides the chunks)
    cx = 0.05
    yloft("chute", [(-0.4, 0.34, 0.05, 0.0, cx, 0.44), (-1.45, 0.34, 0.05, 0.0, cx, 0.05)], M["mid"])
    for sx in (-1, 1):
        yloft(f"chute_wall_{sx}", [(-0.4, 0.05, 0.1, 0.0, cx + sx * 0.36, 0.52),
                                    (-1.45, 0.05, 0.1, 0.0, cx + sx * 0.36, 0.13)], M["light"])
        yloft(f"chute_line_{sx}", [(-0.4, 0.012, 0.012, 0.0, cx + sx * 0.36, 0.63),
                                    (-1.45, 0.012, 0.012, 0.0, cx + sx * 0.36, 0.24)], M["trim"])
    for k in range(14):
        t = (k + 0.5) / 14
        y, z = -0.45 - 1.0 * t, 0.44 - 0.39 * t + 0.08
        box(f"ore__chunk_{k}", (cx + 0.17 * math.sin(k * 2.1), y, z), (0.1, 0.09, 0.06), M["ore"])
        box(f"chute_rock_{k}", (cx - 0.16 * math.sin(k * 1.7), y + 0.04, z - 0.01), (0.1, 0.08, 0.06), M["dark"])
    node_frame("ore", (cx, -0.45, 0.52))
    clip("ore", "slide", 0.25, vec=(0, -1.0 / 14, -0.39 / 14))

    # wings: the right one carries the side auger; the left one sits behind the column
    for sx in (-1, 1):
        x = 0.05 + sx * 1.1
        box(f"wing_{sx}", (x, 0.3, 0.33), (0.6, 0.86, 0.6), M["light"], chamfer=0.14)
        box(f"wing_door_{sx}", (x, -0.135, 0.27), (0.28, 0.02, 0.26), M["dark"])
        box(f"wing_light_{sx}", (x, -0.145, 0.3), (0.16, 0.02, 0.04), M["glow"])
        box(f"wing_cap_{sx}", (x, 0.3, 0.66), (0.4, 0.56, 0.06), M["mid"])
        box(f"wing_plate_{sx}", (x + sx * 0.305, 0.3, 0.42), (0.02, 0.14, 0.14), M["trim"])
    pivot = (1.05, -0.45, 0.62)
    box("auger_r_mount", (1.03, -0.3, 0.6), (0.3, 0.3, 0.3), M["mid"], chamfer=0.05)
    auger("auger_r", pivot, math.radians(-25), M, M["trim"])
    anchor("auger_r", pivot)
    heap("heap_r", 1.2, -1.05, 0.36, 0.24, M, chunks=3, seed=1.1)
    heap("heap_l", BORE_BASE[0] + 0.02, BORE_BASE[1] - 0.12, 0.42, 0.26, M, chunks=4, seed=0.3)

    # the drill column (housing static, core and bit node `bore`), tilted back and out
    hs, cs, top = column(M, hot)
    for ob in hs + cs:
        ob.rotation_euler = BORE_TILT
        ob.location = BORE_BASE
    node_frame("bore", BORE_BASE, BORE_TILT)
    clip("bore", "spin", 1.2)
    # a brace from the column to the bunker's left pillar
    box("brace", (-0.75, -0.55, 0.95), (0.42, 0.14, 0.14), M["mid"], chamfer=0.03)
    box("brace_trim", (-0.75, -0.625, 0.95), (0.2, 0.02, 0.05), M["trim"])

    # back wall: the big fan in an octagonal frame (node `fan` turns about the Y axis)
    octo("fan_frame", 0.05, 0.9, 0.12, 1.02, 0.5, 0.06, 0.16, M["light"])
    fc = (0.05, 0.97, 0.57)
    cyl("fan_well", (0.05, 0.955, 0.57), 0.38, 0.03, M["dark"], sides=12, axis="Y")
    rim = ring("fan_rim", (0, 0, -0.025), 0.42, 0.37, 0.05, M["mid"], sides=12)
    rim.rotation_euler, rim.location = (math.radians(90), 0, 0), (0.05, 0.985, 0.57)
    fan = [cyl("fan__hub", (0, 0, 0), 0.08, 0.06, M["mid"], sides=8, axis="Y")]
    for k in range(8):
        b = box(f"fan__blade_{k}", (0, 0, 0), (0.07, 0.02, 0.3), M["dark"] if k % 2 else M["mid"])
        a = 2 * math.pi * k / 8
        b.location = (0.18 * math.sin(a), 0, 0.18 * math.cos(a))
        b.rotation_euler = (math.radians(18), a, 0)
        fan.append(b)
    for ob in fan:
        ob.location = (fc[0] + ob.location.x, fc[1] + ob.location.y, fc[2] + ob.location.z)
    node_frame("fan", fc, (math.radians(90), 0, 0))
    clip("fan", "spin", 2.0)
    box("fan_light", (0.05, 1.0, 1.08), (0.3, 0.02, 0.05), M["glow"])

    # roof: orange nubs and the dish (node `dish`)
    for sx in (-1, 1):
        box(f"roof_nub_{sx}", (0.05 + sx * 0.45, -0.18, 1.27), (0.14, 0.14, 0.16), M["trim"], chamfer=0.03)
    mx, my = 0.15, 0.35
    drum("dish_mount", (mx, my, 1.21), 0.2, 0.12, M["mid"], sides=10)
    dpiv = (mx, my, 1.42)
    parts = [
        cyl("dish__neck", (0, 0, -0.05), 0.05, 0.12, M["dark"], sides=8, axis="Z"),
        cyl("dish__bowl", (0, 0, 0.08), 0.1, 0.12, M["white"], sides=14, axis="Z", r1=0.34),
        cyl("dish__face", (0, 0, 0.145), 0.32, 0.01, M["light"], sides=14, axis="Z"),
        cyl("dish__horn", (0, 0, 0.24), 0.018, 0.2, M["dark"], sides=6, axis="Z"),
        cyl("dish__feed", (0, 0, 0.35), 0.04, 0.04, M["glow"], sides=6, axis="Z"),
    ]
    tilt = (math.radians(40), 0, math.radians(-30))
    for ob in parts:
        ob.rotation_euler = tilt
        ob.location = dpiv
    node_frame("dish", dpiv, tilt)
    clip("dish", "spin_world", 12.0)

    anchor("bore_bit", (BORE_BASE[0], BORE_BASE[1], 0.05))
    anchor("ore_out", (cx, -1.5, 0.05))
    anchor("debris_l", (BORE_BASE[0], BORE_BASE[1] - 0.12, 0.25), color="rock")   # the bit bites here (3× on Mk II)
    anchor("debris_r", (1.2, -1.05, 0.28), color="rock")
    anchor("power", (0.05, 0.85, 0.02))


if __name__ == "__main__":
    build("rig_bore", make, ref="mv_drill_bore_b.jpg")
