"""Farmhouse — the farm's hub, an outpost building on a pad (Farming-Design §6).  [MM-task_mwagi1nr_1e]

    python3 tools/blender/outposts/farmhouse.py [out_dir] [--render] [--anim]
    blender -b -P tools/blender/outposts/farmhouse.py -- [out_dir] [--render]

Footprint: a pad's 2 × 2 cells, modelled at the pad scale like the other pad buildings (4 × 4 units; the view draws
it at padModelScale). A Verdance working farm hub on the outpost's stepped plinth: a long steel farmhouse with a
standing-seam gable roof (orange ridge cap), a barn hayloft door with the X brace on its gable end, lit windows and a
front door; a covered PORCH across the front holding the POD BENCH (a workbench with five pod cradles, their rings
lit: node `bench`, so the game can tint the pods to their level); a glass lean-to greenhouse on the right with crop
trays; a small wind turbine on the roof (node `rotor`, clip `rotor`: it turns while the farm works); crates, a feed
bin and a water tank. Along the plinth's front edge runs the glowing LEVEL INLAY (node `inlay`: the game tints it to
the farm's pod level, as every plot carries one, design §5.1).

Detail is geometry only (chamfers, ribs, rivets, mullions), flat shaded; the materials are the outpost set, so the
game's trim recolour, Mk II look and states apply unchanged. Front = -Y.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outpost_common import anchor, box, build, clip, cyl, drum, mats, node_frame, octo, prism, ring, strut  # noqa: E402
import common as ship  # noqa: E402  (the ship helpers, on the path via outpost_common)
import bmesh  # noqa: E402

PLINTH = 0.2                                  # top of the stepped plinth
HX0, HX1, HY0, HY1 = -1.75, 0.65, -0.45, 1.55  # the house block
EAVE, RIDGE = 1.3, 1.95                        # the roof


def farm_mats(M):
    """The outpost set plus the farm's flat colours (body role: vertex-coloured, no new texture)."""
    M["roof"] = ship.mat("farm_roof", (0.17, 0.27, 0.19), rough=0.6, metal=0.25)    # Verdance green steel
    M["wood"] = ship.mat("farm_wood", (0.36, 0.25, 0.15), rough=0.8, metal=0.0)     # crates, bench top
    M["straw"] = ship.mat("farm_straw", (0.62, 0.50, 0.24), rough=0.9, metal=0.0)
    M["leaf"] = ship.mat("farm_leaf", (0.20, 0.42, 0.16), rough=0.8, metal=0.0)
    M["soil"] = ship.mat("farm_soil", (0.17, 0.12, 0.09), rough=0.95, metal=0.0)
    return M


def tri_plate(name, pts, material, t=0.02):
    """A thin triangular plate (a glass gable) through three points, thickened along Y."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y - t / 2, z)) for x, y, z in pts]
    b = [bm.verts.new((x, y + t / 2, z)) for x, y, z in pts]
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(3):
        bm.faces.new((a[i], b[i], b[(i + 1) % 3], a[(i + 1) % 3]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return ship._obj(name, bm, material)


def rivets(name, xs, y, z, M, size=0.03):
    for i, x in enumerate(xs):
        box(f"{name}_{i}", (x, y, z), (size, 0.012, size), M["mid"])


def make():
    M = farm_mats(mats())
    # ── the plinth: dark foot, mid step, light deck edge (the pads' stepped skirt)
    octo("foot", 0, 0, 0.0, 0.08, 1.98, 1.96, 0.42, M["dark"])
    octo("step", 0, 0, 0.08, PLINTH - 0.02, 1.9, 1.88, 0.38, M["mid"])
    octo("deck", 0, 0, PLINTH - 0.02, PLINTH, 1.86, 1.84, 0.36, M["deck"])
    rivets("foot_rivet_f", [-1.5 + 0.3 * i for i in range(11)], -1.963, 0.05, M)
    rivets("foot_rivet_b", [-1.5 + 0.3 * i for i in range(11)], 1.963, 0.05, M)
    # the level inlay (node `inlay`): a lit strip along the front edge with end caps in trim
    box("inlay__strip", (0, -1.905, 0.135), (3.2, 0.02, 0.04), M["glow"])
    for sx in (-1, 1):
        box(f"inlay_cap_{sx}", (sx * 1.64, -1.9, 0.135), (0.08, 0.04, 0.08), M["trim"])
    node_frame("inlay", (0, -1.905, 0.135))

    # ── the house: wall block, mid band, corner posts, base course
    cx, cy = (HX0 + HX1) / 2, (HY0 + HY1) / 2
    w, d = HX1 - HX0, HY1 - HY0
    box("base_course", (cx, cy, PLINTH + 0.06), (w + 0.08, d + 0.08, 0.12), M["mid"], chamfer=0.02)
    box("walls", (cx, cy, (PLINTH + EAVE) / 2), (w, d, EAVE - PLINTH), M["white"])
    box("wall_band", (cx, cy, 0.72), (w + 0.03, d + 0.03, 0.06), M["light"])
    for sx, x in ((-1, HX0), (1, HX1)):
        for sy, y in ((-1, HY0), (1, HY1)):
            box(f"corner_{sx}_{sy}", (x, y, (PLINTH + EAVE) / 2), (0.1, 0.1, EAVE - PLINTH), M["light"], chamfer=0.025)
    # vertical wall ribs on the long walls
    for i in range(1, 8):
        x = HX0 + w * i / 8
        for y, f in ((HY0, -1), (HY1, 1)):
            box(f"wall_rib_{i}_{f}", (x, y + f * 0.012, 0.98), (0.03, 0.025, 0.5), M["light"])

    # ── the gable roof (along X): slab, standing seams, ridge cap in trim, gable trims
    o = 0.14                                     # overhang
    prism("roof", HX0 - o, HX1 + o, [(HY0 - o, EAVE - 0.06), (HY0 - o, EAVE), (cy, RIDGE), (HY1 + o, EAVE),
                                     (HY1 + o, EAVE - 0.06), (cy, RIDGE - 0.08)], M["roof"])
    prism("gable_wall", HX0 + 0.001, HX1 - 0.001, [(HY0, EAVE), (cy, RIDGE - 0.08), (HY1, EAVE)], M["white"])
    run = math.atan2(RIDGE - EAVE, cy - HY0 + o)
    slope = math.hypot(cy - HY0 + o, RIDGE - EAVE)
    for i in range(13):
        x = HX0 - o + 0.1 + (w + 2 * o - 0.2) * i / 12
        for f in (-1, 1):
            seam = box(f"roof_seam_{i}_{f}", (0, 0, 0), (0.025, slope, 0.03), M["mid"])
            seam.rotation_euler = (-f * run, 0, 0)
            seam.location = (x, cy + f * (cy - HY0 + o) / 2, (EAVE + RIDGE) / 2 + 0.015)
    box("ridge_cap", (cx, cy, RIDGE + 0.01), (w + 2 * o + 0.04, 0.16, 0.06), M["trim"], chamfer=0.02)
    for f in (-1, 1):
        gutter = box(f"gutter_{f}", (cx, cy + f * (cy - HY0 + o + 0.02), EAVE - 0.07), (w + 2 * o, 0.06, 0.06), M["mid"])
    for k, x in enumerate((HX0 - o - 0.005, HX1 + o + 0.005)):
        for f in (-1, 1):
            t = box(f"gable_trim_{k}_{f}", (0, 0, 0), (0.03, slope + 0.04, 0.07), M["trim"])
            t.rotation_euler = (-f * run, 0, 0)
            t.location = (x, cy + f * (cy - HY0 + o) / 2, (EAVE + RIDGE) / 2 - 0.02)
    strut("downpipe", (HX1 + 0.08, HY0 - 0.08, EAVE - 0.1), (HX1 + 0.08, HY0 - 0.08, PLINTH + 0.1), 0.025, M["mid"])

    # ── the gable end (left, -X): the hayloft door with its X brace, a light over it, the wall vent
    gx = HX0 - 0.012
    box("loft_door", (gx, cy, 1.38), (0.03, 0.5, 0.42), M["dark"])
    box("loft_frame_t", (gx - 0.01, cy, 1.61), (0.03, 0.6, 0.05), M["trim"])
    box("loft_frame_b", (gx - 0.01, cy, 1.15), (0.03, 0.6, 0.05), M["trim"])
    for sy in (-1, 1):
        box(f"loft_frame_s_{sy}", (gx - 0.01, cy + sy * 0.28, 1.38), (0.03, 0.05, 0.5), M["trim"])
        brace = box(f"loft_brace_{sy}", (0, 0, 0), (0.025, 0.04, 0.6), M["trim"])
        brace.rotation_euler = (sy * math.atan2(0.5, 0.42), 0, 0)
        brace.location = (gx - 0.018, cy, 1.38)
    box("loft_beam", (gx - 0.08, cy, 1.72), (0.16, 0.06, 0.06), M["mid"])
    cyl("loft_pulley", (gx - 0.13, cy, 1.66), 0.04, 0.03, M["dark"], sides=8, axis="Y")
    box("gable_lamp", (gx - 0.02, cy, 1.8), (0.03, 0.12, 0.04), M["glow"])
    for k in range(4):                           # ground-floor barn door slats on the gable end
        box(f"barn_door_{k}", (gx, cy - 0.33 + 0.22 * k, 0.6), (0.03, 0.18, 0.7), M["light"])
    box("barn_door_rail", (gx - 0.01, cy, 0.98), (0.03, 0.95, 0.04), M["mid"])

    # ── the front wall: door, windows with mullions, lit sills
    fy = HY0 - 0.012
    door_x = -0.15
    box("door", (door_x, fy, 0.56), (0.38, 0.03, 0.66), M["dark"])
    box("door_frame", (door_x, fy - 0.01, 0.92), (0.5, 0.03, 0.06), M["trim"])
    box("door_light", (door_x, fy - 0.015, 0.83), (0.24, 0.02, 0.03), M["glow"])
    box("door_handle", (door_x + 0.13, fy - 0.02, 0.55), (0.03, 0.02, 0.08), M["mid"])
    for k, x in enumerate((-1.35, -0.85, 0.35)):
        box(f"win_{k}", (x, fy, 0.95), (0.34, 0.03, 0.3), M["glass"])
        box(f"win_glow_{k}", (x, fy - 0.004, 0.86), (0.3, 0.02, 0.06), M["glow"])
        box(f"win_mull_v_{k}", (x, fy - 0.012, 0.95), (0.025, 0.02, 0.3), M["light"])
        box(f"win_mull_h_{k}", (x, fy - 0.012, 0.98), (0.34, 0.02, 0.02), M["light"])
        box(f"win_sill_{k}", (x, fy - 0.03, 0.79), (0.4, 0.06, 0.03), M["mid"])
    # back wall: two lit slits and a utility box with cable
    for k, x in enumerate((-1.2, -0.2)):
        box(f"back_win_{k}", (x, HY1 + 0.012, 0.95), (0.4, 0.03, 0.08), M["glow"])
    box("utility", (0.3, HY1 + 0.07, 0.55), (0.3, 0.14, 0.36), M["light"], chamfer=0.03)
    box("utility_lamp", (0.3, HY1 + 0.145, 0.66), (0.08, 0.01, 0.03), M["glow"])

    # ── the porch across the front: deck, steps, posts, lean-to roof, railing
    py0, py1 = -1.55, HY0
    px0, px1 = -1.75, 0.65
    box("porch_deck", ((px0 + px1) / 2, (py0 + py1) / 2, PLINTH + 0.04), (px1 - px0, py1 - py0, 0.08), M["light"])
    for i in range(9):
        box(f"porch_board_{i}", (px0 + 0.13 + i * 0.27, (py0 + py1) / 2, PLINTH + 0.083), (0.012, py1 - py0 - 0.04, 0.006),
            M["mid"])
    for i in range(2):
        box(f"porch_step_{i}", (door_x, py0 - 0.09 - 0.12 * i, PLINTH - 0.04 * i), (0.6, 0.12, 0.08 - 0.04 * i), M["mid"])
    box("porch_step_line", (door_x, py0 - 0.15, PLINTH + 0.004), (0.56, 0.03, 0.006), M["trim"])
    for k, x in enumerate((px0 + 0.06, -0.52, 0.22, px1 - 0.06)):
        box(f"porch_post_{k}", (x, py0 + 0.06, (PLINTH + 0.08 + 1.08) / 2), (0.07, 0.07, 1.08 - PLINTH - 0.08), M["mid"],
            chamfer=0.015)
        box(f"porch_post_cap_{k}", (x, py0 + 0.06, PLINTH + 0.1), (0.1, 0.1, 0.04), M["dark"])
    # an open pergola, not a solid roof, so the battle camera (37° down) still sees the bench and the door under it
    pr = math.atan2(1.22 - 1.06, py1 - py0 + 0.1)
    for i in range(12):
        x = px0 - 0.02 + (px1 - px0 + 0.04) * i / 11
        r = box(f"porch_rafter_{i}", (0, 0, 0), (0.04, math.hypot(py1 - py0 + 0.1, 0.16), 0.06), M["roof"])
        r.rotation_euler = (pr, 0, 0)
        r.location = (x, (py0 - 0.1 + py1) / 2, 1.14)
    for j, y in enumerate((py0 + 0.3, py0 + 0.65)):
        box(f"porch_purlin_{j}", ((px0 + px1) / 2, y, 1.1 + 0.16 * (y - py0 + 0.1) / (py1 - py0 + 0.1) + 0.04),
            (px1 - px0 + 0.04, 0.035, 0.03), M["mid"])
    box("porch_ledger", ((px0 + px1) / 2, py1 - 0.03, 1.2), (px1 - px0, 0.06, 0.08), M["mid"])
    for k in range(5):                           # hanging vine pots on the pergola, a farm touch
        x = px0 + 0.25 + k * 0.48
        cyl(f"vine_pot_{k}", (x, py0 + 0.06, 1.13), 0.05, 0.06, M["dark"], sides=8, axis="Z")
        box(f"vine_{k}", (x, py0 + 0.06, 1.17), (0.12, 0.12, 0.06), M["leaf"], chamfer=0.03)
    box("porch_fascia", ((px0 + px1) / 2, py0 - 0.11, 1.05), (px1 - px0 + 0.12, 0.03, 0.06), M["trim"])
    box("porch_beam", ((px0 + px1) / 2, py0 + 0.06, 1.02), (px1 - px0, 0.08, 0.06), M["mid"])
    for i, x in enumerate((-1.48, -0.85)):       # porch lights under the beam
        box(f"porch_light_{i}", (x, py0 + 0.06, 0.985), (0.12, 0.05, 0.02), M["glow"])
    for seg, (xa, xb) in enumerate(((px0 + 0.06, -0.52), (0.22, px1 - 0.06))):
        box(f"rail_top_{seg}", ((xa + xb) / 2, py0 + 0.06, PLINTH + 0.42), (xb - xa, 0.04, 0.03), M["light"])
        n = int((xb - xa) / 0.12)
        for i in range(1, n):
            box(f"rail_baluster_{seg}_{i}", (xa + (xb - xa) * i / n, py0 + 0.06, PLINTH + 0.25), (0.02, 0.02, 0.33), M["mid"])

    # ── the pod bench (node `bench`) under the porch, left of the door: top, legs, shelf, five pod cradles
    bx, by, bz = -1.15, -1.0, PLINTH + 0.08
    box("bench__top", (bx, by, bz + 0.34), (0.95, 0.34, 0.05), M["wood"], chamfer=0.01)
    box("bench__apron", (bx, by - 0.16, bz + 0.3), (0.95, 0.02, 0.06), M["trim"])
    box("bench__shelf", (bx, by, bz + 0.1), (0.88, 0.3, 0.03), M["mid"])
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f"bench__leg_{sx}_{sy}", (bx + sx * 0.43, by + sy * 0.13, bz + 0.16), (0.04, 0.04, 0.32), M["dark"])
    for i in range(5):
        x = bx - 0.36 + 0.18 * i
        ring(f"bench__cradle_{i}", (x, by, bz + 0.365), 0.065, 0.045, 0.03, M["mid"], sides=10)
        ring(f"bench__ring_{i}", (x, by, bz + 0.385), 0.055, 0.04, 0.012, M["glow"], sides=10)
        pod = cyl(f"bench__pod_{i}", (x, by, bz + 0.43), 0.04, 0.1, M["light"], sides=8, axis="Z", r1=0.02)
    box("bench__lamp_arm", (bx + 0.4, by + 0.12, bz + 0.6), (0.02, 0.02, 0.5), M["dark"])
    box("bench__lamp", (bx + 0.3, by + 0.05, bz + 0.84), (0.2, 0.08, 0.03), M["glow"])
    box("bench__screen", (bx - 0.3, by + 0.14, bz + 0.5), (0.26, 0.02, 0.18), M["glass"])
    box("bench__screen_glow", (bx - 0.3, by + 0.128, bz + 0.5), (0.2, 0.01, 0.1), M["glow"])
    node_frame("bench", (bx, by, bz))
    # the far porch end: a feed bin and a rocking crate stack
    box("feed_bin", (0.45, -1.05, PLINTH + 0.26), (0.32, 0.3, 0.36), M["light"], chamfer=0.03)
    box("feed_bin_lid", (0.45, -1.05, PLINTH + 0.46), (0.34, 0.32, 0.04), M["trim"])

    # ── the greenhouse lean-to on the right: frame, glass panes, mullions, crop trays inside
    gx0, gx1, gy0, gy1 = 0.7, 1.75, -0.35, 1.45
    box("gh_base", ((gx0 + gx1) / 2, (gy0 + gy1) / 2, PLINTH + 0.08), (gx1 - gx0, gy1 - gy0, 0.16), M["mid"], chamfer=0.02)
    box("gh_soil", ((gx0 + gx1) / 2, (gy0 + gy1) / 2, PLINTH + 0.17), (gx1 - gx0 - 0.1, gy1 - gy0 - 0.1, 0.02), M["soil"])
    gh_h0, gh_h1 = 0.85, 1.1                     # outer wall top, top against the house
    box("gh_glass_f", ((gx0 + gx1) / 2, gy0, (PLINTH + 0.16 + gh_h0) / 2), (gx1 - gx0, 0.02, gh_h0 - PLINTH - 0.16), M["glass"])
    box("gh_glass_b", ((gx0 + gx1) / 2, gy1, (PLINTH + 0.16 + gh_h0) / 2), (gx1 - gx0, 0.02, gh_h0 - PLINTH - 0.16), M["glass"])
    box("gh_glass_s", (gx1, (gy0 + gy1) / 2, (PLINTH + 0.16 + gh_h0) / 2), (0.02, gy1 - gy0, gh_h0 - PLINTH - 0.16), M["glass"])
    pitch = math.atan2(gh_h1 - gh_h0, gx1 - gx0)
    gh_roof = box("gh_roof", (0, 0, 0), (math.hypot(gx1 - gx0, gh_h1 - gh_h0), gy1 - gy0 + 0.04, 0.02), M["glass"])
    gh_roof.rotation_euler = (0, pitch, 0)        # high against the house (gx0), falling to the outer wall
    gh_roof.location = ((gx0 + gx1) / 2, (gy0 + gy1) / 2, (gh_h0 + gh_h1) / 2 + 0.01)
    for y in (gy0, gy1):                          # the glass gable triangles over the front and back walls
        tri_plate(f"gh_gable_{y:.2f}", [(gx0, y, gh_h0), (gx1, y, gh_h0), (gx0, y, gh_h1)], M["glass"])
    for i in range(6):                           # mullions on the front and back, rafters on the roof
        x = gx0 + (gx1 - gx0) * i / 5
        for y in (gy0 - 0.012, gy1 + 0.012):
            box(f"gh_mull_{i}_{y:.2f}", (x, y, (PLINTH + 0.16 + gh_h0) / 2), (0.03, 0.02, gh_h0 - PLINTH - 0.16), M["light"])
    for i in range(7):
        y = gy0 + (gy1 - gy0) * i / 6
        box(f"gh_mull_s_{i}", (gx1 + 0.012, y, (PLINTH + 0.16 + gh_h0) / 2), (0.02, 0.03, gh_h0 - PLINTH - 0.16), M["light"])
        strut(f"gh_rafter_{i}", (gx1 + 0.02, y, gh_h0 + 0.03), (gx0, y, gh_h1 + 0.03), 0.015, M["light"], sides=4)
    for y in (gy0, gy1):
        box(f"gh_eave_{y:.2f}", ((gx0 + gx1) / 2, y, gh_h0), (gx1 - gx0 + 0.04, 0.05, 0.05), M["trim"])
    for k in range(3):                           # crop trays with leafy rows under a grow light
        ty = gy0 + 0.3 + k * 0.55
        box(f"gh_tray_{k}", ((gx0 + gx1) / 2, ty, PLINTH + 0.3), (0.8, 0.34, 0.06), M["dark"])
        for j in range(4):
            box(f"gh_crop_{k}_{j}", (gx0 + 0.2 + 0.21 * j, ty, PLINTH + 0.39), (0.14, 0.24, 0.12), M["leaf"], chamfer=0.04)
        box(f"gh_growlight_{k}", ((gx0 + gx1) / 2, ty, gh_h0 - 0.08), (0.7, 0.05, 0.02), M["glow"])

    # ── the wind turbine on the roof's right end (node `rotor`, spins about its hub's own Y)
    tx, ty = 0.35, cy + 0.15
    drum("turbine_mast", (tx, ty, RIDGE - 0.05), 0.035, 0.75, M["mid"], sides=8)
    box("turbine_nacelle", (tx, ty - 0.02, RIDGE + 0.72), (0.1, 0.24, 0.1), M["light"], chamfer=0.025)
    box("turbine_tail", (tx, ty + 0.2, RIDGE + 0.74), (0.015, 0.18, 0.12), M["trim"])
    hub = (tx, ty - 0.16, RIDGE + 0.72)
    cyl("rotor__hub", hub, 0.045, 0.06, M["white"], sides=8, axis="Y")
    for k in range(3):
        a = k * 2 * math.pi / 3
        blade = box(f"rotor__blade_{k}", (0, 0, 0), (0.06, 0.012, 0.42), M["white"], chamfer=0.006)
        blade.rotation_euler = (0, a, 0)
        blade.location = (hub[0] + math.sin(a) * 0.23, hub[1] - 0.01, hub[2] + math.cos(a) * 0.23)
        tip = box(f"rotor__tip_{k}", (0, 0, 0), (0.062, 0.014, 0.06), M["trim"])
        tip.rotation_euler = (0, a, 0)
        tip.location = (hub[0] + math.sin(a) * 0.41, hub[1] - 0.012, hub[2] + math.cos(a) * 0.41)
    node_frame("rotor", hub, (math.radians(90), 0, 0))   # the node's own Z points along -Y: spin it about that
    clip("rotor", "spin", 3.0, axis="Z")
    drum("feat_beacon", (tx, ty - 0.02, RIDGE + 0.77), 0.025, 0.04, M["glow"], sides=6)
    drum("chimney", (-1.25, cy + 0.35, RIDGE - 0.35), 0.08, 0.5, M["mid"], sides=8)
    drum("chimney_cap", (-1.25, cy + 0.35, RIDGE + 0.15), 0.11, 0.04, M["dark"], sides=8)

    # ── the yard: water tank on legs (back right), crates and hay bales (front right)
    wx, wy = 1.35, 1.6
    drum("tank", (wx, wy, PLINTH + 0.45), 0.24, 0.5, M["light"], sides=14)
    ring("tank_band_0", (wx, wy, PLINTH + 0.55), 0.25, 0.235, 0.03, M["mid"], sides=14)
    ring("tank_band_1", (wx, wy, PLINTH + 0.8), 0.25, 0.235, 0.03, M["mid"], sides=14)
    drum("tank_lid", (wx, wy, PLINTH + 0.95), 0.25, 0.06, M["trim"], sides=14, r1=0.12)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        box(f"tank_leg_{k}", (wx + 0.18 * math.cos(a), wy + 0.18 * math.sin(a), PLINTH + 0.22), (0.04, 0.04, 0.45),
            M["dark"])
    box("tank_gauge", (wx, wy - 0.245, PLINTH + 0.7), (0.05, 0.01, 0.2), M["glow"])
    strut("tank_pipe", (wx - 0.24, wy, PLINTH + 0.5), (gx1 - 0.05, gy1 - 0.02, PLINTH + 0.5), 0.025, M["mid"])
    for k, (x, y, s) in enumerate(((1.15, -1.25, 0.3), (1.5, -1.3, 0.26), (1.3, -0.95, 0.24))):
        box(f"crate_{k}", (x, y, PLINTH + s / 2), (s, s, s), M["wood"], chamfer=0.02)
        box(f"crate_band_{k}", (x, y, PLINTH + s / 2), (s + 0.01, s + 0.01, 0.03), M["mid"])
    box("crate_top", (1.3, -1.27, PLINTH + 0.3 + 0.12), (0.22, 0.22, 0.22), M["wood"], chamfer=0.02)
    for k, (x, y) in enumerate(((0.95, -1.62), (1.4, -1.62))):
        cyl(f"bale_{k}", (x, y, PLINTH + 0.13), 0.13, 0.32, M["straw"], sides=10, axis="X")
        ring_band = cyl(f"bale_tie_{k}", (x, y, PLINTH + 0.13), 0.135, 0.02, M["wood"], sides=10, axis="X")

    anchor("door", (door_x, py0 - 0.3, PLINTH))
    anchor("bench", (bx, by, bz + 0.45))
    anchor("inlay", (0, -1.92, 0.135))
    anchor("power", (0, 1.95, 0.02))


if __name__ == "__main__":
    build("farmhouse", make)
