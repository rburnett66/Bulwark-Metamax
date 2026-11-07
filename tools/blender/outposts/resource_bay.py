"""Resource Bay (was the Harvester Bay) — the harvesters' garage, from the owner's garage sheet (ref/mv_garage.jpg)
and the concept crop (ref/harvester_bay.jpg).  [MM-story_mw5oem5o_r] (story O10)

    python3 tools/blender/outposts/resource_bay.py [out_dir] [--render] [--anim]

Footprint: a 4 × 4 pad (one unit = one battle cell). A white chamfered hall on a dark stepped skirt with two garage
bays side by side under a lit header, framed by chamfered pillars with lit panels; lower wings to each side with a
small lit door; stepped roof blocks with orange nubs and a vent. The left bay stands open with a harvester parked
half out of it (node `harvester`: it drives out and back in, clip `harvester`); the right bay's up-and-over door
(node `door`) swings up into the bay and down again, clip `door` (a harvester leaving or parking). Both loop while
harvesters work. The game can also hide the parked harvester (node `harvester`) while every harvester is out.
Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, clip, cyl, mats, node_frame, octo, ship  # noqa: E402

FRONT, BACK = -0.95, 1.05       # the hall's front and back faces
BAY_W, BAY_H = 1.1, 0.86        # each bay opening
FLOOR = 0.16
HALL = 1.3                      # the hall's roof
BAYS = (-0.68, 0.68)            # bay centres (x)


def wedge(name, x, y, z, sx, material, s=0.2, d=0.11):
    """A triangular fillet in the top corner of an opening: corner at (x, z), legs s along -sx·X and -Z, depth d (Y)."""
    import bmesh
    bm = bmesh.new()
    pts = [(x, z), (x - sx * s, z), (x, z - s)]
    f = [bm.verts.new((px, y - d / 2, pz)) for px, pz in pts]
    b = [bm.verts.new((px, y + d / 2, pz)) for px, pz in pts]
    bm.faces.new(f)
    bm.faces.new(list(reversed(b)))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((f[i], f[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return ship._obj(name, bm, material)


def harvester(p, x, y, z, M):
    """The harvester buggy (battle harvester family, ref/harvester_bay.jpg): a white chunky body, a cab with a lit
    visor, an ore hopper at the back, orange flank stripes and six dark wheels. Nose toward -Y."""
    box(p + "chassis", (x, y, z + 0.15), (0.5, 0.86, 0.1), M["mid"])
    box(p + "body", (x, y + 0.06, z + 0.28), (0.52, 0.66, 0.2), M["white"], chamfer=0.06)
    box(p + "cab", (x, y - 0.18, z + 0.44), (0.36, 0.26, 0.16), M["light"], chamfer=0.05)
    box(p + "visor", (x, y - 0.315, z + 0.45), (0.26, 0.02, 0.06), M["glow"])
    box(p + "hopper", (x, y + 0.22, z + 0.44), (0.42, 0.3, 0.14), M["mid"], chamfer=0.03)
    box(p + "hopper_load", (x, y + 0.22, z + 0.515), (0.34, 0.22, 0.02), M["ore"])
    box(p + "bumper", (x, y - 0.42, z + 0.2), (0.46, 0.06, 0.08), M["dark"])
    box(p + "lamp_l", (x - 0.16, y - 0.455, z + 0.22), (0.06, 0.01, 0.03), M["glow"])
    box(p + "lamp_r", (x + 0.16, y - 0.455, z + 0.22), (0.06, 0.01, 0.03), M["glow"])
    for sx in (-1, 1):
        box(p + f"stripe_{sx}", (x + sx * 0.262, y + 0.06, z + 0.3), (0.01, 0.4, 0.04), M["trim"])
        for k, wy in enumerate((-0.28, 0.0, 0.28)):
            cyl(p + f"wheel_{sx}_{k}", (x + sx * 0.27, y + wy, z + 0.1), 0.1, 0.08, M["dark"], sides=8, axis="X")
            cyl(p + f"hub_{sx}_{k}", (x + sx * 0.315, y + wy, z + 0.1), 0.045, 0.01, M["mid"], sides=6, axis="X")


def make():
    M = mats()
    M["ore"] = ship.mat("ore", (0.06, 0.2, 0.62), emit=(0.06, 0.2, 0.62), strength=1.5)

    # skirt and apron
    octo("skirt_0", 0, 0, 0.0, 0.08, 2.0, 1.95, 0.5, M["dark"])
    octo("skirt_1", 0, 0.05, 0.08, FLOOR, 1.9, 1.15, 0.4, M["mid"])
    box("apron", (0, -1.45, 0.09), (2.9, 0.9, 0.02), M["deck"])
    for k in range(2):
        x = BAYS[k]
        box(f"apron_line_{k}", (x, -1.45, 0.101), (0.04, 0.8, 0.01), M["trim"])
        box(f"apron_edge_{k}", (x, -1.88, 0.101), (BAY_W, 0.04, 0.01), M["trim"])

    # the hall around the two bays: back block, three pillars, header and roof
    depth = 1.45                                           # bays reach this far into the hall
    box("hall_back", (0, (FRONT + depth + BACK) / 2, (FLOOR + HALL) / 2),
        (2.9, BACK - FRONT - depth, HALL - FLOOR), M["white"], chamfer=0.1)
    top = FLOOR + BAY_H
    for k, (x0, x1) in enumerate(((-1.45, -1.23), (-0.13, 0.13), (1.23, 1.45))):
        # the pillars stop just inside the header: parts must not share vertices, or the merge welds them and the
        # normal recalculation can flip a face (it rendered black)
        box(f"pillar_{k}", ((x0 + x1) / 2, FRONT + depth / 2, (FLOOR + top + 0.02) / 2),
            (x1 - x0, depth, top + 0.02 - FLOOR), M["white"])
    box("header", (0, FRONT + depth / 2, (top + HALL) / 2), (2.9, depth, HALL - top), M["white"])
    box("roof", (0, 0.05, HALL + 0.03), (2.7, 1.85, 0.06), M["light"], chamfer=0.04)
    for k, x in enumerate(BAYS):                          # the inside of each bay: dark walls, floor, back light
        box(f"bay_back_{k}", (x, FRONT + depth - 0.01, (FLOOR + top) / 2), (BAY_W, 0.02, BAY_H), M["dark"])
        box(f"bay_ceiling_{k}", (x, FRONT + depth / 2, top - 0.01), (BAY_W, depth, 0.02), M["dark"])
        box(f"bay_floor_{k}", (x, FRONT + depth / 2, FLOOR + 0.005), (BAY_W, depth, 0.01), M["deck"])
        box(f"bay_light_{k}", (x, FRONT + depth - 0.03, top - 0.1), (0.6, 0.02, 0.04), M["glow"])
        for sx in (-1, 1):
            box(f"bay_wall_{k}_{sx}", (x + sx * (BAY_W / 2 - 0.01), FRONT + depth / 2, (FLOOR + top) / 2),
                (0.02, depth, BAY_H), M["mid"])
        # the arch frame: chamfered front frame round the opening, set proud of the wall
        fy = FRONT - 0.05
        for sx in (-1, 1):
            box(f"frame_side_{k}_{sx}", (x + sx * (BAY_W / 2 + 0.06), fy, (FLOOR + top) / 2 + 0.04),
                (0.14, 0.12, BAY_H + 0.08), M["light"], chamfer=0.03)
            # chamfered top corners of the opening: triangular fillets inside the frame (a rotated box here shared
            # vertices with the frame, and the merge's normal recalculation turned its faces black)
            wedge(f"frame_corner_{k}_{sx}", x + sx * (BAY_W / 2 - 0.005), fy - 0.004, top - 0.005, sx, M["light"])
        box(f"frame_top_{k}", (x, fy, top + 0.08), (BAY_W - 0.1, 0.12, 0.14), M["light"])
        box(f"header_light_{k}", (x, FRONT - 0.115, top + 0.25), (0.4, 0.02, 0.06), M["glow"])
    for k, x in enumerate((-1.34, 0.0, 1.34)):            # lit panels on the pillar faces
        box(f"pillar_light_{k}", (x, FRONT - 0.01, 0.75), (0.06, 0.02, 0.12), M["glow"])
        box(f"pillar_dot_{k}", (x, FRONT - 0.01, 0.52), (0.04, 0.02, 0.04), M["glow"])
        box(f"pillar_plate_{k}", (x, FRONT - 0.01, 0.32), (0.04, 0.02, 0.12), M["trim"])
    box("header_band", (0, FRONT - 0.005, HALL - 0.08), (2.9, 0.02, 0.05), M["mid"])

    # wings: lower blocks either side with a small lit door and a pipe
    for sx in (-1, 1):
        x = sx * 1.72
        box(f"wing_{sx}", (x, 0.15, 0.42), (0.56, 1.4, 0.68), M["light"], chamfer=0.14)
        box(f"wing_cap_{sx}", (x, 0.15, 0.79), (0.36, 1.0, 0.06), M["mid"])
        box(f"wing_door_{sx}", (x, -0.555, 0.34), (0.28, 0.02, 0.32), M["dark"])
        box(f"wing_win_{sx}", (x, -0.565, 0.4), (0.18, 0.02, 0.05), M["glow"])
        box(f"wing_plate_{sx}", (x + sx * 0.12, -0.565, 0.18), (0.05, 0.02, 0.08), M["trim"])
        box(f"wing_pipe_{sx}", (sx * 1.47, -0.45, 0.45), (0.06, 0.06, 0.6), M["mid"])

    # roof: stepped blocks, orange nubs, a vent block with a lit slot
    box("roof_block", (0, 0.25, HALL + 0.15), (1.5, 1.1, 0.18), M["white"], chamfer=0.06)
    box("roof_block_2", (0, 0.35, HALL + 0.3), (0.8, 0.6, 0.14), M["light"], chamfer=0.04)
    box("roof_vent", (0, 0.35, HALL + 0.42), (0.36, 0.3, 0.1), M["mid"], chamfer=0.02)
    box("roof_vent_slot", (0, 0.195, HALL + 0.42), (0.2, 0.01, 0.03), M["glow"])
    for sx in (-1, 1):
        box(f"roof_nub_{sx}", (sx * 0.55, -0.15, HALL + 0.31), (0.16, 0.16, 0.14), M["trim"], chamfer=0.03)
        box(f"roof_rail_{sx}", (sx * 1.05, 0.2, HALL + 0.1), (0.1, 1.3, 0.08), M["mid"])

    # the parked harvester in the left bay (node `harvester`): drives out and back in
    hx, hy = BAYS[0], FRONT + 0.05
    harvester("harvester__", hx, hy, FLOOR - 0.06, M)
    node_frame("harvester", (hx, hy, FLOOR - 0.06))
    clip("harvester", "travel", 8.0, vec=(0, -1.05, 0))

    # the right bay's up-and-over door (node `door`): hinged at the top of the opening, swings up into the bay
    dx = BAYS[1]
    hinge = (dx, FRONT + 0.06, top - 0.02)
    box("door__panel", (dx, FRONT + 0.06, (FLOOR + top) / 2), (BAY_W - 0.04, 0.04, BAY_H - 0.04), M["mid"])
    for k in range(4):
        box(f"door__rib_{k}", (dx, FRONT + 0.035, FLOOR + 0.14 + 0.19 * k), (BAY_W - 0.1, 0.012, 0.03), M["light"])
    box("door__band", (dx, FRONT + 0.033, FLOOR + 0.06), (BAY_W - 0.1, 0.012, 0.05), M["trim"])
    box("door__lamp", (dx + 0.4, FRONT + 0.033, top - 0.12), (0.06, 0.01, 0.03), M["glow"])
    node_frame("door", hinge)
    clip("door", "swing", 8.0, axis="X", amp=88)

    anchor("bay_l", (BAYS[0], FRONT - 0.4, 0.0))            # where harvesters leave and park
    anchor("bay_r", (BAYS[1], FRONT - 0.4, 0.0))
    anchor("power", (0, BACK + 0.02, 0.02))


if __name__ == "__main__":
    build("resourceBay", make, ref="mv_garage.jpg")
