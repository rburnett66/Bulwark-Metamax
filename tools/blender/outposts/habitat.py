"""Habitat — the outpost's living quarters, from the owner's habitat concept (ref/set_habitat.jpg).
[MM-story_mw5oem5o_r] (story O15; outpost design §6: each Habitat tier raises the gun cap)

    python3 tools/blender/outposts/habitat.py [out_dir] [--render] [--anim] [--tier2]

Footprint: a 4 × 4 pad (one unit = one battle cell). An octagonal two-step pad (dark foot, a light wall with lit
slits and orange plates, a dark deck with orange edge lines) and two stepped ramps down at the front. On it an
octagonal quarters block: chamfered white walls, arched doorways on the front faces with warm lit windows (the
concept's living-light amber), a stepped roof and a round roof vent with an orange band and a dark core whose fan
turns (node `vent`, clip `vent`: loops while the Habitat is powered).
--tier2 builds Habitat II (slug `habitat_ii`): the same base with added modules, as the tech plan's tier II variants
(§6.2): the roof becomes the concept's ribbed central dome with a comm spire and a lit band, two capsule pods join
the sides on short corridors. Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, clip, cyl, drum, mats, node_frame, octo, ring, ship  # noqa: E402

TIER2 = "--tier2" in sys.argv
DECK = 0.34
WALL = 1.02          # top of the quarters' walls


def rbox(name, at, size, material, yaw):
    ob = box(name, (0, 0, 0), size, material)
    ob.rotation_euler = (0, 0, yaw)
    ob.location = at
    return ob


def doorway(name, a, r, M, lit_w=0.16):
    """An arched doorway on the octagon face at angle a (radians, outward normal), wall radius r: a light frame
    standing proud, a dark recess, a warm lit window beside it."""
    ox, oy = math.cos(a), math.sin(a)
    tx, ty = -oy, ox                                      # along the face
    rbox(f"{name}_frame", (r * ox, r * oy, DECK + 0.33), (0.1, 0.5, 0.62), M["light"], a)
    rbox(f"{name}_frame_top", (r * ox, r * oy, DECK + 0.67), (0.12, 0.56, 0.1), M["white"], a)
    rbox(f"{name}_recess", ((r + 0.052) * ox, (r + 0.052) * oy, DECK + 0.27), (0.01, 0.32, 0.46), M["dark"], a)
    rbox(f"{name}_light", ((r + 0.053) * ox, (r + 0.053) * oy, DECK + 0.32), (0.01, 0.2, 0.26), M["warm"], a)
    rbox(f"{name}_trim", ((r + 0.056) * ox, (r + 0.056) * oy, DECK + 0.6), (0.01, 0.3, 0.03), M["trim"], a)
    wx, wy = r * ox + 0.36 * tx, r * oy + 0.36 * ty
    rbox(f"{name}_win", (wx + 0.012 * ox, wy + 0.012 * oy, DECK + 0.42), (0.01, lit_w, 0.12), M["warm"], a)


def pod(name, x, y, M):
    """A Habitat II capsule pod: a short drum with a cap, a ring of warm windows and an orange band."""
    octo(f"{name}_plinth", x, y, DECK, DECK + 0.08, 0.36, 0.36, 0.12, M["mid"])
    drum(f"{name}_body", (x, y, DECK + 0.08), 0.32, 0.46, M["white"], sides=10)
    ring(f"{name}_band", (x, y, DECK + 0.2), 0.335, 0.31, 0.04, M["trim"], sides=10)
    for k in range(5):
        a = math.radians(-90 + (k - 2) * 36)
        rbox(f"{name}_win_{k}", (x + 0.322 * math.cos(a), y + 0.322 * math.sin(a), DECK + 0.38), (0.01, 0.1, 0.08),
             M["warm"], a)
    drum(f"{name}_cap", (x, y, DECK + 0.54), 0.32, 0.12, M["light"], sides=10, r1=0.18)
    drum(f"{name}_top", (x, y, DECK + 0.66), 0.12, 0.05, M["mid"], sides=8)
    drum(f"feat_{name}_tip", (x, y, DECK + 0.71), 0.035, 0.04, M["glow"], sides=6)


def make():
    M = mats()
    M["warm"] = ship.mat("glow_warm", (0.62, 0.34, 0.08), emit=(0.62, 0.34, 0.08), strength=2.2)   # living-light windows

    # pad: dark foot, light wall with lit slits and orange plates, white rim, dark deck with orange edge lines
    octo("pad_foot", 0, 0, 0.0, 0.08, 1.9, 1.9, 1.1, M["dark"])
    octo("pad_wall", 0, 0, 0.08, DECK - 0.06, 1.82, 1.82, 1.06, M["light"])
    octo("pad_rim", 0, 0, DECK - 0.06, DECK, 1.86, 1.86, 1.08, M["white"])
    octo("pad_deck", 0, 0, DECK, DECK + 0.008, 1.7, 1.7, 0.98, M["deck"])
    for k in range(8):
        a = math.radians(k * 45)
        rbox(f"pad_line_{k}", (1.6 * math.cos(a), 1.6 * math.sin(a), DECK + 0.01), (0.02, 0.9, 0.006), M["trim"], a)
        if k in (5, 7):
            continue                                      # the ramps
        for j, off in enumerate((-0.4, 0.0, 0.4)):
            mat = M["warm"] if j == 1 else M["trim"]
            rbox(f"pad_slot_{k}_{j}", (1.835 * math.cos(a) - off * math.sin(a), 1.835 * math.sin(a) + off * math.cos(a),
                                       0.2), (0.02, 0.2 if j == 1 else 0.12, 0.05), mat, a)

    # stepped ramps down the front-left and front-right faces
    ramps = [math.radians(-135), math.radians(-45)]
    for r, a in enumerate(ramps):
        ox, oy = math.cos(a), math.sin(a)
        for i in range(4):
            top = DECK * (4 - i) / 4
            d = 1.84 + 0.12 * i
            rbox(f"ramp_{r}_{i}", (d * ox, d * oy, top / 2), (0.12, 0.6, top), M["mid"], a)
            rbox(f"ramp_edge_{r}_{i}", ((d + 0.055) * ox, (d + 0.055) * oy, top - 0.004), (0.01, 0.56, 0.008), M["trim"], a)
        for s in (-1, 1):
            rail = box(f"ramp_rail_{r}_{s}", (0, 0, 0), (0.56, 0.05, 0.06), M["light"])   # low rails down the slope
            rail.rotation_euler = (0, math.atan2(DECK, 0.48), a)
            rail.location = (2.02 * ox - s * 0.33 * oy, 2.02 * oy + s * 0.33 * ox, DECK * 0.55 + 0.06)

    # the quarters: octagonal chamfered walls, a mid band, the doorways on the front faces, warm windows round it
    R = 1.08
    C = R * (2 - math.sqrt(2))                            # a regular octagon: every face R from the centre
    octo("quarters_foot", 0, 0, DECK, DECK + 0.1, R + 0.08, R + 0.08, C + 0.03, M["mid"])
    octo("quarters", 0, 0, DECK + 0.1, WALL, R, R, C, M["white"], bevel=0.02)
    octo("quarters_band", 0, 0, DECK + 0.72, DECK + 0.78, R + 0.015, R + 0.015, C + 0.006, M["mid"])
    for k, a in enumerate((math.radians(-90), math.radians(-135), math.radians(-45))):
        doorway(f"door_{k}", a, R - 0.02, M)
    for k, a in enumerate((0.0, math.pi)):                # side windows
        ox, oy = math.cos(a), math.sin(a)
        rbox(f"side_win_{k}", ((R + 0.005) * ox, (R + 0.005) * oy, DECK + 0.45), (0.01, 0.4, 0.1), M["warm"], a)
        rbox(f"side_plate_{k}", ((R + 0.005) * ox, (R + 0.005) * oy, DECK + 0.25), (0.01, 0.2, 0.06), M["trim"], a)
    rbox("back_win", (0, R + 0.005, DECK + 0.45), (0.01, 0.6, 0.08), M["glow"], math.radians(90))
    for k in range(8):                                    # wall pilasters at the octagon's corners
        a = math.radians(22.5 + k * 45)
        rbox(f"pilaster_{k}", (1.13 * math.cos(a), 1.13 * math.sin(a), DECK + 0.4),
             (0.08, 0.1, 0.6), M["light"], a)

    # roof: tier I a stepped roof and the round vent; tier II the ribbed dome with the comm spire
    if not TIER2:
        octo("roof_0", 0, 0, WALL, WALL + 0.12, R - 0.08, R - 0.08, C - 0.03, M["light"])
        octo("roof_1", 0, 0, WALL + 0.12, WALL + 0.26, R - 0.32, R - 0.32, (R - 0.32) * 0.58, M["white"])
        vz = WALL + 0.26
    else:
        octo("roof_0", 0, 0, WALL, WALL + 0.08, R - 0.06, R - 0.06, C - 0.02, M["light"])
        ring("dome_glow", (0, 0, WALL + 0.08), R - 0.12, R - 0.2, 0.025, M["glow"], sides=16)
        steps = ((0.92, 0.84, 0.16), (0.84, 0.7, 0.16), (0.7, 0.5, 0.14), (0.5, 0.3, 0.1))
        z = WALL + 0.08
        for k, (r0, r1, h) in enumerate(steps):
            drum(f"dome_{k}", (0, 0, z), r0, h, M["white"] if k % 2 == 0 else M["light"], sides=16, r1=r1)
            z += h
        for k in range(16):                               # the dome's ribs
            a = math.radians(11.25 + k * 22.5)
            rib = box(f"dome_rib_{k}", (0, 0, 0), (0.04, 0.42, 0.04), M["mid"])
            rib.rotation_euler = (math.radians(-38), 0, a - math.pi / 2)
            rib.location = (0.66 * math.cos(a), 0.66 * math.sin(a), WALL + 0.32)
        for k in range(4):                                # lit portholes in the dome
            a = math.radians(-90 + (k - 1.5) * 40)
            rbox(f"dome_port_{k}", (0.8 * math.cos(a), 0.8 * math.sin(a), WALL + 0.17), (0.02, 0.1, 0.06),
                 M["glow"], a)
        vz = z
        # side pods on short corridors (the added modules)
        for sx in (-1, 1):
            box(f"corridor_{sx}", (sx * 1.2, 0.3, DECK + 0.2), (0.5, 0.3, 0.28), M["light"], chamfer=0.06)
            box(f"corridor_win_{sx}", (sx * 1.2, 0.145, DECK + 0.24), (0.24, 0.01, 0.06), M["warm"])
            pod(f"pod_{sx}", sx * 1.42, 0.5, M)
    # the round vent (fan node `vent`) with an orange band and a dark core; tier II carries the spire on it
    drum("vent_base", (0, 0, vz), 0.3, 0.1, M["mid"], sides=12)
    ring("vent_band", (0, 0, vz + 0.1), 0.31, 0.24, 0.05, M["trim"], sides=12)
    ring("vent_rim", (0, 0, vz + 0.15), 0.28, 0.18, 0.06, M["light"], sides=12)
    drum("vent_well", (0, 0, vz + 0.1), 0.18, 0.06, M["dark"], sides=12)
    vp = (0, 0, vz + 0.17)
    drum("vent__hub", (0, 0, vz + 0.15), 0.05, 0.04, M["mid"], sides=8)
    for k in range(6):
        a = math.radians(k * 60)
        bl = box(f"vent__blade_{k}", (0, 0, 0), (0.15, 0.04, 0.012), M["light"])
        bl.rotation_euler = (math.radians(20), 0, a)
        bl.location = (0.085 * math.cos(a), 0.085 * math.sin(a), vz + 0.165)
    node_frame("vent", vp)
    clip("vent", "spin", 3.0)
    if TIER2:
        for k, (dx, h) in enumerate(((0.36, 0.5), (-0.36, 0.34))):
            drum(f"aerial_{k}", (dx, 0, vz - 0.12), 0.025, h, M["dark"], sides=6)
            drum(f"feat_aerial_tip_{k}", (dx, 0, vz - 0.12 + h), 0.035, 0.04, M["glow"], sides=6)
    else:
        box("roof_unit", (0.5, 0.5, WALL + 0.18), (0.26, 0.26, 0.12), M["mid"], chamfer=0.03)
        box("roof_unit_light", (0.5, 0.365, WALL + 0.18), (0.14, 0.01, 0.04), M["glow"])
        box("roof_nub", (-0.52, 0.45, WALL + 0.17), (0.14, 0.14, 0.1), M["trim"], chamfer=0.03)

    anchor("vent", vp)
    anchor("door", (0, -1.3, DECK))
    anchor("power", (0, 1.9, 0.02))


if __name__ == "__main__":
    build("habitat_ii" if TIER2 else "habitat", make, ref="set_habitat.jpg")
