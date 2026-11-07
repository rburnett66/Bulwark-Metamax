"""Auger Rig — the iron drill bunker, from the owner's drill sheet (ref/mv_drill.jpg).  [MM-story_mw5oect7_m]

    python3 tools/blender/outposts/rig_auger.py [out_dir] [--render] [--mk2]

Footprint: a 3 × 3 pad (one unit = one battle cell). A light chamfered bunker framed by two tall pillars with lit
panels; a dark portal over an ore chute that runs down to the ground carrying ore chunks (node `ore`: flows at
runtime); low wings to each side with lit doors; two side augers angled down into rubble heaps with orange screw
bands (nodes `auger_l`, `auger_r`, clips: the screws spin); a radar grid on the roof (node `radar`, clip: it sweeps).
All clips loop while the rig mines.
--mk2 renders a REVIEW PREVIEW of the Mk II: trim and screw bands turn hot amber and the heaps grow. The shipped Mk II is
the same GLB recoloured at runtime with 3× debris particles (tech plan §6.2), so the preview is not published.
Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, clip, cyl, drum, mats, node_frame, octo, yloft  # noqa: E402

MK2 = "--mk2" in sys.argv


def heap(name, x, y, r, h, M, chunks=4, seed=0):
    """A rubble heap: two stacked rough cones of dark rock with a few ore chunks on it."""
    drum(f"{name}_0", (x, y, 0), r, h * 0.55, M["dark"], sides=7, r1=r * 0.7)
    drum(f"{name}_1", (x + 0.05, y - 0.03, h * 0.55), r * 0.68, h * 0.45, M["dark"], sides=6, r1=r * 0.2)
    for k in range(chunks):
        a = 2.4 * k + seed
        rr = r * (0.45 + 0.1 * (k % 3))
        box(f"{name}_ore_{k}", (x + rr * math.cos(a), y + rr * math.sin(a), h * 0.38), (0.07, 0.06, 0.05), M["ore"])


def auger(name, pivot, yaw, M, accent):
    """An auger: a housing and a screw with banded collars, built along -Z, tilted forward and down to lie low over its heap."""
    parts = [
        cyl(f"{name}_housing", (0, 0, 0.2), 0.15, 0.4, M["mid"], sides=8, axis="Z"),
        cyl(f"{name}_collar", (0, 0, 0.0), 0.17, 0.08, M["light"], sides=8, axis="Z"),
        cyl(f"{name}__shaft", (0, 0, -0.32), 0.09, 0.56, M["dark"], sides=8, axis="Z"),
    ]
    for k in range(4):
        parts.append(cyl(f"{name}__band_{k}", (0, 0, -0.12 - 0.13 * k), 0.12, 0.05, accent, sides=8, axis="Z"))
    for k in range(10):                                  # helical teeth, so the spin reads on screen
        t = math.radians(k * 60)
        parts.append(box(f"{name}__tooth_{k}", (0.115 * math.cos(t), 0.115 * math.sin(t), -0.08 - 0.055 * k),
                         (0.07, 0.07, 0.05), accent if k % 2 else M["light"]))
    parts.append(cyl(f"{name}__tip", (0, 0, -0.65), 0.08, 0.1, M["mid"], sides=8, axis="Z", r1=0.02))
    euler = (math.radians(-62), 0, yaw)
    for ob in parts:
        ob.rotation_euler = euler
        ob.location = pivot
    node_frame(name, pivot, euler)
    clip(name, "spin", 0.8)                              # the screw turns while the rig mines


def make():
    M = mats()
    M["ore"] = __import__("outpost_common").ship.mat("ore", (0.06, 0.2, 0.62), emit=(0.06, 0.2, 0.62), strength=1.5)
    accent = M["trim"]                                    # Mk II: screw bands, nubs and plates glow hot amber
    if MK2:
        from outpost_common import ship
        accent = ship.mat("amber", (1.0, 0.45, 0.08), emit=(1.0, 0.45, 0.08), strength=3.0)
    # pad and bunker body
    octo("pad", 0, -0.1, 0.0, 0.08, 1.45, 1.35, 0.35, M["dark"])
    box("body", (0, 0.15, 0.6), (1.6, 1.3, 1.04), M["white"], chamfer=0.28)
    box("roof", (0, 0.2, 1.12), (1.1, 0.9, 0.1), M["mid"], chamfer=0.04)
    # pillars framing the portal, lit panels on their faces
    for sx in (-1, 1):
        x = sx * 0.62
        box(f"pillar_{sx}", (x, -0.52, 0.52), (0.36, 0.42, 1.0), M["white"], chamfer=0.08)
        box(f"pillar_foot_{sx}", (x, -0.52, 0.06), (0.44, 0.5, 0.12), M["mid"])
        box(f"pillar_light_{sx}", (x, -0.735, 0.72), (0.08, 0.02, 0.12), M["glow"])
        box(f"pillar_dot_{sx}", (x, -0.735, 0.5), (0.05, 0.02, 0.05), M["glow"])
        box(f"pillar_trim_{sx}", (x + sx * 0.12, -0.735, 0.32), (0.04, 0.02, 0.12), accent)
    box("lintel", (0, -0.52, 1.02), (1.6, 0.44, 0.12), M["white"], chamfer=0.04)
    box("lintel_light", (0, -0.745, 1.0), (0.4, 0.02, 0.06), M["glow"])
    box("portal", (0, -0.36, 0.5), (0.86, 0.1, 0.8), M["dark"])
    box("portal_frame", (0, -0.42, 0.9), (0.9, 0.06, 0.06), M["mid"])
    for k in (-1, 1):
        box(f"portal_jaw_{k}", (k * 0.22, -0.4, 0.62), (0.3, 0.04, 0.34), M["mid"], chamfer=0.04)

    # ore chute: a trough sloping from the portal to the ground, with side walls and ore chunks (node `ore`)
    yloft("chute", [(-0.4, 0.34, 0.05, 0.0, 0, 0.44), (-1.45, 0.34, 0.05, 0.0, 0, 0.05)], M["mid"])
    for sx in (-1, 1):
        yloft(f"chute_wall_{sx}", [(-0.4, 0.05, 0.1, 0.0, sx * 0.36, 0.52),
                                    (-1.45, 0.05, 0.1, 0.0, sx * 0.36, 0.13)], M["light"])
        yloft(f"chute_line_{sx}", [(-0.4, 0.012, 0.012, 0.0, sx * 0.36, 0.63),
                                    (-1.45, 0.012, 0.012, 0.0, sx * 0.36, 0.24)], M["trim"])
    for k in range(14):
        t = (k + 0.5) / 14
        y = -0.45 - 1.0 * t
        z = 0.44 - 0.39 * t + 0.08
        box(f"ore__chunk_{k}", (0.17 * math.sin(k * 2.1), y, z), (0.1, 0.09, 0.06), M["ore"])
        box(f"chute_rock_{k}", (-0.16 * math.sin(k * 1.7), y + 0.04, z - 0.01), (0.1, 0.08, 0.06), M["dark"])

    # side wings with lit doors
    for sx in (-1, 1):
        x = sx * 1.1
        box(f"wing_{sx}", (x, 0.25, 0.33), (0.6, 0.9, 0.6), M["light"], chamfer=0.14)
        box(f"wing_door_{sx}", (x, -0.205, 0.27), (0.28, 0.02, 0.26), M["dark"])
        box(f"wing_light_{sx}", (x, -0.215, 0.3), (0.16, 0.02, 0.04), M["glow"])
        box(f"wing_cap_{sx}", (x, 0.25, 0.66), (0.4, 0.6, 0.06), M["mid"])

    # side augers angled out and down into rubble heaps (nodes `auger_l`, `auger_r`)
    for sx, node in ((-1, "auger_l"), (1, "auger_r")):
        pivot = (sx * 1.0, -0.45, 0.62)
        box(f"{node}_mount", (sx * 0.98, -0.3, 0.6), (0.3, 0.3, 0.3), M["mid"], chamfer=0.05)
        auger(node, pivot, math.radians(-25 * sx), M, accent)
        anchor(node, pivot)
    s = 1.2 if MK2 else 1.0
    heap("heap_l", -1.15, -1.05, 0.36 * s, 0.24 * s, M, chunks=5 if MK2 else 3, seed=0.3)
    heap("heap_r", 1.15, -1.05, 0.36 * s, 0.24 * s, M, chunks=5 if MK2 else 3, seed=1.1)
    if MK2:
        heap("heap_f", -0.65, -1.35, 0.3, 0.2, M, chunks=3, seed=2.0)
        heap("heap_g", 0.7, -1.4, 0.28, 0.18, M, chunks=3, seed=0.7)

    # roof: orange nubs and the radar grid (node `radar`)
    for sx in (-1, 1):
        box(f"roof_nub_{sx}", (sx * 0.45, -0.2, 1.24), (0.14, 0.14, 0.16), accent, chamfer=0.03)
    drum("radar_base", (0, 0.25, 1.17), 0.16, 0.12, M["mid"], sides=8)
    box("radar__frame", (0, 0.25, 1.48), (0.62, 0.12, 0.34), M["mid"], chamfer=0.04)
    box("radar__grille", (0, 0.185, 1.48), (0.5, 0.02, 0.24), M["dark"])
    for k in range(5):
        box(f"radar__bar_{k}", (-0.2 + 0.1 * k, 0.17, 1.48), (0.02, 0.02, 0.24), M["light"])
    box("radar__light", (0.27, 0.18, 1.6), (0.05, 0.02, 0.05), M["glow"])

    # clips: ore rides down the chute one chunk spacing per loop; the radar sweeps
    node_frame("ore", (0, -0.45, 0.52))
    clip("ore", "slide", 0.25, vec=(0, -1.0 / 14, -0.39 / 14))
    node_frame("radar", (0, 0.25, 1.29))
    clip("radar", "sweep", 5.0, amp=50)
    anchor("radar", (0, 0.25, 1.29))
    anchor("ore_out", (0, -1.5, 0.05))
    anchor("power", (0, 0.85, 0.02))


if __name__ == "__main__":
    build("rig_auger_mk2" if MK2 else "rig_auger", make, ref="drill_front.jpg")
