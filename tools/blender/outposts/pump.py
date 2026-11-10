"""Pump — gives water reach for Irrigated plots, an outpost building on 1 × 1 cell (Farming-Design §6).
[MM-task_mwagi1nr_1e]

    python3 tools/blender/outposts/pump.py [out_dir] [--render] [--anim]
    blender -b -P tools/blender/outposts/pump.py -- [out_dir] [--render]

Footprint: 1 × 1 cell, modelled at the pad scale like the other outpost buildings (2 × 2 units; the view draws it at
padModelScale). A compact water pump on a small stepped plinth: a ribbed motor housing on a skid, a vertical
wellhead with bolted flanges going into the ground and a glowing water ring round it, a horizontal pump body
with an inlet bell, the FLYWHEEL on its side (node `wheel`, clip `wheel`: it turns while the pump works), a pressure
tank, and PIPE STUBS leaving three sides with flanges, valve wheels in trim and lit flow collars (where the game can
run its irrigation lines). A status lamp on a short mast. Flat shaded, geometry detail; the outpost material set.
Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, clip, cyl, drum, mats, node_frame, octo, ring, strut  # noqa: E402

PLINTH = 0.14


def flange(name, center, r, axis, M, bolts=4):
    """A bolted pipe flange: a disc and its bolt heads round the rim."""
    cyl(name, center, r, 0.04, M["mid"], sides=12, axis=axis)
    x, y, z = center
    for k in range(bolts):
        a = 2 * math.pi * k / bolts
        u, v = (r - 0.025) * math.cos(a), (r - 0.025) * math.sin(a)
        p = {"X": (x, y + u, z + v), "Y": (x + u, y, z + v), "Z": (x + u, y + v, z)}[axis]
        cyl(f"{name}_bolt_{k}", p, 0.012, 0.06, M["dark"], sides=6, axis=axis)


def valve(name, center, axis, M):
    """A gate valve: a body block, a stem and a spoked hand wheel in trim on top."""
    x, y, z = center
    box(f"{name}_body", (x, y, z), (0.14, 0.14, 0.14), M["light"], chamfer=0.03)
    drum(f"{name}_stem", (x, y, z + 0.07), 0.015, 0.1, M["dark"], sides=6)
    ring(f"{name}_wheel", (x, y, z + 0.17), 0.075, 0.06, 0.02, M["trim"], sides=12)
    for k in range(2):
        a = math.pi * k / 2
        sp = box(f"{name}_spoke_{k}", (0, 0, 0), (0.14, 0.012, 0.012), M["trim"])
        sp.rotation_euler = (0, 0, a)
        sp.location = (x, y, z + 0.18)


def make():
    M = mats()
    # ── the plinth (1 × 1 cell)
    octo("foot", 0, 0, 0.0, 0.06, 0.98, 0.98, 0.22, M["dark"])
    octo("step", 0, 0, 0.06, PLINTH - 0.015, 0.93, 0.93, 0.2, M["mid"])
    octo("deck", 0, 0, PLINTH - 0.015, PLINTH, 0.9, 0.9, 0.19, M["deck"])
    for i in range(6):
        for y in (-0.982, 0.982):
            box(f"rivet_{i}_{y:.0f}", (-0.5 + 0.2 * i, y, 0.03), (0.025, 0.012, 0.025), M["mid"])
    box("front_strip", (0, -0.95, 0.1), (1.3, 0.02, 0.03), M["trim"])
    # deck plate grid
    for k in range(-2, 3):
        box(f"grate_{k}", (k * 0.3, 0.05, PLINTH + 0.003), (0.012, 1.4, 0.006), M["mid"])

    # ── the wellhead (front left): pipe down into the ground through a lit water ring, two flanges
    wx, wy = -0.45, -0.35
    ring("well_ring", (wx, wy, PLINTH), 0.2, 0.15, 0.02, M["glow"], sides=16)
    drum("well_collar", (wx, wy, PLINTH), 0.15, 0.08, M["dark"], sides=12)
    drum("well_pipe", (wx, wy, PLINTH + 0.08), 0.09, 0.5, M["white"], sides=12)
    flange("well_flange_0", (wx, wy, PLINTH + 0.12), 0.13, "Z", M)
    flange("well_flange_1", (wx, wy, PLINTH + 0.5), 0.13, "Z", M)
    cyl("well_elbow", (wx + 0.08, wy, PLINTH + 0.6), 0.09, 0.2, M["white"], sides=12, axis="X")
    box("well_cap", (wx, wy, PLINTH + 0.62), (0.2, 0.2, 0.08), M["light"], chamfer=0.03)

    # ── the skid and the pump body: a horizontal casing with ribs, inlet bell, outlet up to the manifold
    box("skid", (0.12, 0.05, PLINTH + 0.04), (1.1, 0.6, 0.08), M["mid"], chamfer=0.02)
    for sy in (-1, 1):
        box(f"skid_rail_{sy}", (0.12, 0.05 + sy * 0.28, PLINTH + 0.1), (1.1, 0.05, 0.04), M["dark"])
    cyl("pump_body", (-0.08, -0.05, PLINTH + 0.3), 0.18, 0.4, M["white"], sides=14, axis="X")
    for k in range(4):
        cyl(f"pump_rib_{k}", (-0.24 + 0.1 * k, -0.05, PLINTH + 0.3), 0.195, 0.025, M["light"], sides=14, axis="X")
    cyl("pump_bell", (-0.32, -0.05, PLINTH + 0.3), 0.11, 0.08, M["mid"], sides=12, axis="X", r1=0.15)
    box("pump_band", (-0.08, -0.05 - 0.19, PLINTH + 0.3), (0.3, 0.01, 0.05), M["trim"])
    for sx in (-1, 1):
        box(f"pump_foot_{sx}", (-0.08 + sx * 0.14, -0.05, PLINTH + 0.13), (0.08, 0.34, 0.1), M["dark"])

    # ── the motor (right): ribbed housing, fan cowl, junction box, cable
    mx = 0.42
    cyl("motor", (mx, -0.05, PLINTH + 0.3), 0.2, 0.42, M["light"], sides=16, axis="X")
    for k in range(7):
        a = 2 * math.pi * (k + 0.5) / 14 + math.pi / 2 - math.pi / 2.3
        fin = box(f"motor_fin_{k}", (0, 0, 0), (0.38, 0.03, 0.04), M["mid"])
        fin.rotation_euler = (a, 0, 0)
        fin.location = (mx, -0.05 + 0.21 * math.cos(a + math.pi / 2), PLINTH + 0.3 + 0.21 * math.sin(a + math.pi / 2))
    cyl("motor_cowl", (mx + 0.24, -0.05, PLINTH + 0.3), 0.19, 0.06, M["dark"], sides=16, axis="X")
    for k in range(4):
        cyl(f"motor_grille_{k}", (mx + 0.275, -0.05, PLINTH + 0.3), 0.17 - 0.04 * k, 0.012, M["mid"], sides=16, axis="X")
    box("motor_jbox", (mx, -0.05, PLINTH + 0.53), (0.16, 0.14, 0.08), M["white"], chamfer=0.02)
    box("motor_jbox_lamp", (mx, -0.121, PLINTH + 0.53), (0.08, 0.01, 0.025), M["glow"])
    strut("motor_cable", (mx + 0.05, -0.05, PLINTH + 0.57), (0.75, 0.75, PLINTH + 0.02), 0.015, M["dark"], sides=4)
    cyl("coupling", (0.17, -0.05, PLINTH + 0.3), 0.1, 0.1, M["mid"], sides=10, axis="X")
    box("coupling_guard", (0.17, -0.05, PLINTH + 0.32), (0.12, 0.26, 0.26), M["trim"], chamfer=0.04)

    # ── the flywheel on the coupling side (node `wheel`): rim, hub, spokes, counterweight; turns about X
    fx, fy, fz = 0.17, -0.3, PLINTH + 0.3
    cyl("wheel__rim", (fx, fy, fz), 0.2, 0.04, M["dark"], sides=16, axis="Y")
    cyl("wheel__face", (fx, fy - 0.004, fz), 0.17, 0.04, M["mid"], sides=16, axis="Y")
    cyl("wheel__hub", (fx, fy - 0.03, fz), 0.05, 0.04, M["light"], sides=8, axis="Y")
    for k in range(4):
        sp = box(f"wheel__spoke_{k}", (0, 0, 0), (0.3, 0.03, 0.03), M["light"])
        sp.rotation_euler = (0, math.pi * k / 4, 0)
        sp.location = (fx, fy - 0.03, fz)
    box("wheel__weight", (fx, fy - 0.03, fz + 0.12), (0.1, 0.035, 0.06), M["trim"])
    node_frame("wheel", (fx, fy, fz))
    clip("wheel", "spin", 1.5, axis="Y")
    strut("wheel_shaft", (fx, -0.05, fz), (fx, fy - 0.05, fz), 0.025, M["mid"], sides=8)

    # ── the manifold and pipe stubs: up from the pump, across, then out the left, the right and the back
    oz = PLINTH + 0.62
    strut("riser", (-0.08, -0.05, PLINTH + 0.46), (-0.08, -0.05, oz), 0.06, M["white"], sides=10)
    flange("riser_flange", (-0.08, -0.05, PLINTH + 0.5), 0.09, "Z", M)
    cyl("manifold", (-0.08, 0.3, oz), 0.07, 0.75, M["white"], sides=10, axis="Y")
    flange("manifold_flange", (-0.08, 0.05, oz), 0.1, "Y", M)
    valve("valve_main", (-0.08, 0.3, oz + 0.07), "Z", M)
    # left stub (-X), right stub (+X), back stub (+Y), each down to stub height with a flange, a flow collar and a cap
    sz = PLINTH + 0.22
    strut("drop_back", (-0.08, 0.67, oz), (-0.08, 0.67, sz), 0.06, M["white"], sides=10)
    cyl("stub_back", (-0.08, 0.8, sz), 0.06, 0.3, M["white"], sides=10, axis="Y")
    flange("stub_back_flange", (-0.08, 0.8, sz), 0.09, "Y", M)
    cyl("stub_back_flow", (-0.08, 0.9, sz), 0.07, 0.03, M["glow"], sides=10, axis="Y")
    cyl("stub_back_cap", (-0.08, 0.95, sz), 0.08, 0.03, M["trim"], sides=10, axis="Y")
    for sx in (-1, 1):
        x0 = -0.08 if sx < 0 else 0.0
        strut(f"run_{sx}", (-0.08, 0.5, oz), (sx * 0.6, 0.5, oz), 0.05, M["white"], sides=10)
        strut(f"drop_{sx}", (sx * 0.6, 0.5, oz), (sx * 0.6, 0.5, sz), 0.05, M["white"], sides=10)
        cyl(f"stub_{sx}", (sx * 0.76, 0.5, sz), 0.05, 0.36, M["white"], sides=10, axis="X")
        flange(f"stub_flange_{sx}", (sx * 0.72, 0.5, sz), 0.08, "X", M)
        cyl(f"stub_flow_{sx}", (sx * 0.85, 0.5, sz), 0.06, 0.03, M["glow"], sides=10, axis="X")
        cyl(f"stub_cap_{sx}", (sx * 0.95, 0.5, sz), 0.07, 0.03, M["trim"], sides=10, axis="X")
        valve(f"valve_{sx}", (sx * 0.6, 0.5, oz + 0.06), "Z", M)
        box(f"pipe_saddle_{sx}", (sx * 0.78, 0.5, (PLINTH + sz) / 2), (0.08, 0.14, sz - PLINTH - 0.03), M["dark"])

    # ── the pressure tank (back left) and the status mast (back right)
    tx, ty = -0.55, 0.05
    drum("tank_foot", (tx, ty, PLINTH), 0.16, 0.06, M["dark"], sides=12)
    drum("tank", (tx, ty, PLINTH + 0.06), 0.15, 0.42, M["light"], sides=14)
    drum("tank_dome", (tx, ty, PLINTH + 0.48), 0.15, 0.08, M["light"], sides=14, r1=0.07)
    ring("tank_band", (tx, ty, PLINTH + 0.28), 0.16, 0.145, 0.04, M["trim"], sides=14)
    cyl("tank_gauge", (tx, ty - 0.16, PLINTH + 0.4), 0.045, 0.02, M["white"], sides=10, axis="Y")
    cyl("tank_gauge_face", (tx, ty - 0.172, PLINTH + 0.4), 0.035, 0.008, M["glow"], sides=10, axis="Y")
    strut("tank_line", (tx + 0.15, ty, PLINTH + 0.2), (-0.26, -0.05, PLINTH + 0.3), 0.02, M["mid"], sides=6)
    drum("mast", (0.62, 0.15, PLINTH + 0.08), 0.025, 0.7, M["mid"], sides=6)
    drum("mast_foot", (0.62, 0.15, PLINTH), 0.06, 0.08, M["dark"], sides=8)
    box("mast_box", (0.62, 0.15, PLINTH + 0.45), (0.1, 0.06, 0.14), M["white"], chamfer=0.015)
    drum("feat_lamp", (0.62, 0.15, PLINTH + 0.78), 0.05, 0.07, M["glow"], sides=8)
    drum("lamp_cap", (0.62, 0.15, PLINTH + 0.85), 0.06, 0.02, M["trim"], sides=8)

    anchor("water", (wx, wy, PLINTH))
    for name, at in (("out_left", (-0.97, 0.5, sz)), ("out_right", (0.97, 0.5, sz)), ("out_back", (-0.08, 0.97, sz))):
        anchor(name, at)
    anchor("power", (0.62, 0.15, 0.02))


if __name__ == "__main__":
    build("pump", make)
