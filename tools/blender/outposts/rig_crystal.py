"""Crystal Harvester rig — resonator arms ring a crystal cluster, from the owner's crystal refinery concept
(ref/set_crystal_refinery.jpg).  [MM-story_mw5oem5o_r] (story O11's remaining rigs; outpost design §8.4)

    python3 tools/blender/outposts/rig_crystal.py [out_dir] [--render] [--anim]

Footprint: a 3 × 3 pad (one unit = one battle cell), the rig family's dark octagonal deck with orange edge lines.
At the front, the crystal cluster (the deposit, in the ore colour) stands in a glowing channel ring. Round it a
collar carries three resonator arms, white posts with prong heads whose lit tips point in at the crystal (node
`resonator`, turns slowly). Shards broken off the cluster float up a glowing conduit arc into the collector at the
back left (node `shards`, they rise one spacing per loop): a capsule tank with tall lit windows of the ore and two
antennae, as the concept's crystal towers. At the back right a white control block with lit windows and a dish.
Nodes and clips (loop while the rig mines; Mk II 2×): `resonator`, `shards`, `dish`. Ores: Silicon, Yttrium,
Iridium (Rig_Head `crystal`). Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, clip, cyl, drum, mats, node_frame, octo, ring, ship  # noqa: E402

CX, CY = 0.0, -0.45            # the cluster
COLL = (-0.78, 0.7)            # the collector tank
N_SHARDS = 7


def rbox(name, at, size, material, yaw):
    ob = box(name, (0, 0, 0), size, material)
    ob.rotation_euler = (0, 0, yaw)
    ob.location = at
    return ob


def xtal(name, x, y, z, h, r, M, lean=(0.0, 0.0)):
    """One hexagonal crystal, pointed, standing at (x, y, z) leaning by (rx, ry) radians."""
    ob = cyl(name, (0, 0, h / 2), r, h, M["ore"], sides=6, axis="Z", r1=r * 0.15)
    ob.rotation_euler = (lean[0], lean[1], 0)
    ob.location = (x, y, z)
    return ob


def make():
    M = mats()
    M["ore"] = ship.mat("ore", (0.2, 0.1, 0.62), emit=(0.2, 0.1, 0.62), strength=1.6)

    # deck: dark foot, mid deck, orange edge lines, a light rim with lit slits
    octo("pad", 0, 0, 0.0, 0.1, 1.45, 1.45, 0.42, M["dark"])
    octo("deck_rim", 0, 0, 0.1, 0.18, 1.38, 1.38, 0.4, M["light"])
    octo("deck", 0, 0, 0.18, 0.2, 1.28, 1.28, 0.36, M["deck"])
    for k in range(8):
        a = math.radians(22.5 + k * 45)
        rbox(f"deck_line_{k}", (1.22 * math.cos(a), 1.22 * math.sin(a), 0.205), (0.02, 0.62, 0.01), M["trim"], a)
        b = math.radians(k * 45)
        if k % 2 == 0 and k != 6:                          # lit slits on the rim's flat faces (not under the ramp)
            rbox(f"rim_slot_{k}", (1.385 * math.cos(b), 1.385 * math.sin(b), 0.14), (0.02, 0.3, 0.04), M["glow"], b)
    # front ramp down from the deck
    for i in range(3):
        top = 0.2 * (3 - i) / 3
        box(f"ramp_{i}", (0.75, -1.38 - 0.12 * i, top / 2), (0.5, 0.12, top), M["mid"])
        box(f"ramp_edge_{i}", (0.75, -1.44 - 0.12 * i, top - 0.005), (0.48, 0.01, 0.01), M["trim"])

    # the cluster in its channel ring
    drum("cluster_base", (CX, CY, 0.2), 0.42, 0.08, M["mid"], sides=12)
    ring("cluster_channel", (CX, CY, 0.28), 0.4, 0.33, 0.02, M["glow"], sides=24)
    drum("cluster_rock", (CX, CY, 0.28), 0.3, 0.1, M["dark"], sides=7, r1=0.24)
    xtal("cluster_xtal_0", CX, CY, 0.34, 0.78, 0.13, M)
    for k in range(6):
        a = 0.6 + 2 * math.pi * k / 6
        xtal(f"cluster_xtal_{k + 1}", CX + 0.13 * math.cos(a), CY + 0.13 * math.sin(a), 0.34,
             0.32 + 0.1 * (k % 3), 0.07, M, lean=(0.35 * -math.sin(a), 0.35 * math.cos(a)))

    # the resonator (node `resonator`): a collar on the deck with three arms whose lit tips point at the cluster
    ring("resonator__collar", (CX, CY, 0.2), 0.62, 0.5, 0.08, M["light"], sides=24)
    ring("resonator__band", (CX, CY, 0.28), 0.6, 0.52, 0.02, M["trim"], sides=24)
    for k in range(3):
        a = math.radians(90 + k * 120)
        ox, oy = math.cos(a), math.sin(a)
        px, py = CX + 0.56 * ox, CY + 0.56 * oy
        rbox(f"resonator__foot_{k}", (px, py, 0.33), (0.2, 0.16, 0.12), M["mid"], a)
        rbox(f"resonator__post_{k}", (px + 0.02 * ox, py + 0.02 * oy, 0.68), (0.12, 0.12, 0.62), M["white"], a)
        rbox(f"resonator__post_trim_{k}", (px + 0.08 * ox, py + 0.08 * oy, 0.5), (0.02, 0.08, 0.1), M["trim"], a)
        # prong head leaning in toward the crystal
        hx, hy = CX + 0.42 * ox, CY + 0.42 * oy
        head = box(f"resonator__head_{k}", (0, 0, 0), (0.3, 0.16, 0.12), M["light"], chamfer=0.03)
        head.rotation_euler = (0, math.radians(-20), a + math.pi)
        head.location = (hx, hy, 1.04)
        for s in (-1, 1):
            prong = box(f"resonator__prong_{k}_{s}", (0, 0, 0), (0.16, 0.035, 0.035), M["mid"])
            prong.rotation_euler = (0, math.radians(-25), a + math.pi)
            prong.location = (CX + 0.3 * ox - 0.05 * s * oy, CY + 0.3 * oy + 0.05 * s * ox, 0.99)
        tip = cyl(f"resonator__tip_{k}", (0, 0, 0), 0.05, 0.08, M["glow"], sides=6, axis="X")
        tip.rotation_euler = (0, math.radians(-25), a + math.pi)
        tip.location = (CX + 0.22 * ox, CY + 0.22 * oy, 0.95)
    node_frame("resonator", (CX, CY, 0.2))
    clip("resonator", "spin_world", 9.0)

    # the collector tank at the back left: stepped plinth, capsule body with lit windows, cap and antennae
    tx, ty = COLL
    octo("tank_plinth", tx, ty, 0.2, 0.34, 0.5, 0.5, 0.16, M["mid"])
    box("tank_plinth_line", (tx, ty - 0.505, 0.27), (0.4, 0.01, 0.02), M["trim"])
    drum("tank", (tx, ty, 0.34), 0.38, 1.0, M["white"], sides=10)
    for k in range(4):                                    # tall windows of the ore, between white ribs
        a = math.radians(-90 + (k - 1.5) * 38)
        rbox(f"tank_win_{k}", (tx + 0.375 * math.cos(a), ty + 0.375 * math.sin(a), 0.82), (0.02, 0.18, 0.62), M["ore"], a)
    for z in (0.42, 1.24):
        ring(f"tank_band_{z}", (tx, ty, z), 0.4, 0.36, 0.06, M["mid"], sides=10)
    ring("tank_trim", (tx, ty, 1.18), 0.395, 0.37, 0.03, M["trim"], sides=10)
    drum("tank_cap", (tx, ty, 1.34), 0.38, 0.16, M["light"], sides=10, r1=0.26)
    drum("tank_top", (tx, ty, 1.5), 0.2, 0.1, M["mid"], sides=10)
    ring("tank_inlet", (tx, ty, 1.6), 0.15, 0.09, 0.04, M["glow"], sides=10)
    for k, (dx, h) in enumerate(((0.1, 0.5), (-0.12, 0.34))):
        drum(f"tank_mast_{k}", (tx + dx, ty + 0.1, 1.6), 0.025, h, M["dark"], sides=6)
        drum(f"feat_tank_tip_{k}", (tx + dx, ty + 0.1, 1.6 + h), 0.04, 0.04, M["glow"], sides=6)
    box("tank_status", (tx + 0.2, ty - 0.33, 1.08), (0.1, 0.02, 0.05), M["glow"])

    # the conduit arc from the cluster to the tank inlet (a few lit segments), and the floating shards on it
    p0, p1 = (CX - 0.05, CY + 0.05, 1.18), (tx, ty, 1.62)
    def arc(t):
        x = p0[0] + (p1[0] - p0[0]) * t
        y = p0[1] + (p1[1] - p0[1]) * t
        z = p0[2] + (p1[2] - p0[2]) * t + 0.35 * math.sin(math.pi * t)
        return x, y, z
    for k in range(6):                                    # thin guide rings along the arc
        x, y, z = arc((k + 0.5) / 6)
        r = ring(f"arc_ring_{k}", (0, 0, -0.01), 0.09, 0.07, 0.02, M["glow"], sides=8)
        r.location = (x, y, z)
        r.rotation_euler = (math.radians(70), 0, math.atan2(p1[0] - p0[0], -(p1[1] - p0[1])))
    # shards: a chain along the straight chord (so one slide by one spacing loops seamlessly), lifted onto the arc's
    # mean height; the guide rings sit on the arc above them
    d = tuple((b - a) / N_SHARDS for a, b in zip(p0, p1))
    for k in range(N_SHARDS):
        t = (k + 0.5) / N_SHARDS
        x, y, z = (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t + 0.22)
        sh = cyl(f"shards__s_{k}", (0, 0, 0), 0.05, 0.14, M["ore"], sides=6, axis="Z", r1=0.012)
        sh.rotation_euler = (0.5 * k, 0.8 * k, 0)
        sh.location = (x, y, z)
    node_frame("shards", (p0[0], p0[1], p0[2] + 0.22))
    clip("shards", "slide", 0.6, vec=d)

    # the control block at the back right with lit windows, an orange plate and the dish (node `dish`)
    bx, by = 0.72, 0.62
    box("ctrl", (bx, by, 0.55), (0.9, 0.9, 0.7), M["white"], chamfer=0.2)
    box("ctrl_cap", (bx, by, 0.93), (0.6, 0.6, 0.08), M["mid"], chamfer=0.03)
    box("ctrl_win", (bx - 0.1, by - 0.455, 0.62), (0.36, 0.02, 0.08), M["glow"])
    box("ctrl_door", (bx + 0.25, by - 0.455, 0.4), (0.2, 0.02, 0.36), M["dark"])
    box("ctrl_plate", (bx - 0.1, by - 0.455, 0.42), (0.2, 0.02, 0.1), M["trim"])
    box("ctrl_side_win", (bx + 0.455, by, 0.62), (0.02, 0.3, 0.08), M["glow"])
    drum("dish_mount", (bx, by, 0.97), 0.14, 0.1, M["mid"], sides=8)
    dpiv = (bx, by, 1.14)
    parts = [
        cyl("dish__neck", (0, 0, -0.04), 0.04, 0.1, M["dark"], sides=8, axis="Z"),
        cyl("dish__bowl", (0, 0, 0.06), 0.08, 0.1, M["white"], sides=14, axis="Z", r1=0.28),
        cyl("dish__face", (0, 0, 0.115), 0.26, 0.01, M["light"], sides=14, axis="Z"),
        cyl("dish__horn", (0, 0, 0.2), 0.015, 0.17, M["dark"], sides=6, axis="Z"),
        cyl("dish__feed", (0, 0, 0.29), 0.035, 0.035, M["glow"], sides=6, axis="Z"),
    ]
    tilt = (math.radians(40), 0, math.radians(-40))
    for ob in parts:
        ob.rotation_euler = tilt
        ob.location = dpiv
    node_frame("dish", dpiv, tilt)
    clip("dish", "spin_world", 14.0)
    # a lit cable run from the control block to the resonator collar
    box("cable", (0.45, 0.0, 0.215), (0.06, 0.7, 0.02), M["glow"])

    anchor("cluster", (CX, CY, 0.7))
    anchor("collector", (tx, ty, 1.62))
    anchor("debris", (CX, CY, 0.6), color="ore")              # shards spray off the cluster (3× on Mk II)
    anchor("power", (0.72, 1.3, 0.02))


if __name__ == "__main__":
    build("rig_crystal", make, ref="set_crystal_refinery.jpg")
