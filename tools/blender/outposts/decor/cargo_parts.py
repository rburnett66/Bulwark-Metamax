"""The OC-47 heavy cargo cube, shared by the decor cube (cargo_cube.py) and the cargo lift's two cubes (cargo_lift.py).
[MM-story_mwfacvte_b]

Reference: Design/cargo-cube.png — a 2.2 m cube of reinforced gunmetal composite: a chamfered frame, recessed side
panels with a raised centre plate, corner clamp blocks, hazard striping on the vertical edges, an orange OC-47 stencil
and an ID plate on the front (-Y).
"""
from decor_common import M, box, mat_stripes, mats

S = 2.2 * M   # the cube's side, in cells


def cube(prefix, center, P, detail, side=S):
    """One cargo cube standing on z = center.z, its parts named `<prefix>__…` (prefix doubles as the node)."""
    x, y, z = center
    h = side / 2
    zc = z + h
    box(f"{prefix}__core", (x, y, zc), (side * 0.96, side * 0.96, side * 0.96), P["gunmetal"], chamfer=side * 0.08 if detail else 0.0)
    if not detail:
        # the hazard edges as four thin posts, the stencil as one plate
        for sx in (-1, 1):
            for sy in (-1, 1):
                box(f"{prefix}__edge_{sx}{sy}", (x + sx * h * 0.93, y + sy * h * 0.93, zc), (side * 0.1, side * 0.1, side * 0.98), P["hazard"])
        # the light steel side panels and lid the textured cube shows (all gunmetal read near-black in the game)
        for ax, sgn in (("x", -1), ("x", 1), ("y", -1), ("y", 1)):
            px, py = (x + sgn * h * 0.985, y) if ax == "x" else (x, y + sgn * h * 0.985)
            size = (side * 0.02, side * 0.7, side * 0.7) if ax == "x" else (side * 0.7, side * 0.02, side * 0.7)
            box(f"{prefix}__panel_{ax}{sgn}", (px, py, zc), size, P["steel"])
        box(f"{prefix}__lid", (x, y, z + side * 0.985), (side * 0.7, side * 0.7, side * 0.03), P["steel"])
        box(f"{prefix}__plate", (x, y - h * 1.0, zc - side * 0.26), (side * 0.3, side * 0.01, side * 0.1), P["hazard"])
        return
    stripes = mat_stripes(scale=18)
    for sx in (-1, 1):
        for sy in (-1, 1):
            # striped vertical edge guards and the clamp blocks top and bottom
            box(f"{prefix}__edge_{sx}{sy}", (x + sx * h * 0.93, y + sy * h * 0.93, zc), (side * 0.1, side * 0.1, side * 0.86), stripes)
            for sz in (-1, 1):
                box(f"{prefix}__clamp_{sx}{sy}{sz}", (x + sx * h * 0.9, y + sy * h * 0.9, zc + sz * h * 0.9),
                    (side * 0.17, side * 0.17, side * 0.17), P["dark"], chamfer=side * 0.02)
    # recessed panels with a raised centre plate on the four sides
    for ax, sgn in (("x", -1), ("x", 1), ("y", -1), ("y", 1)):
        off = h * 0.985
        px, py = (x + sgn * off, y) if ax == "x" else (x, y + sgn * off)
        size = (side * 0.02, side * 0.62, side * 0.62) if ax == "x" else (side * 0.62, side * 0.02, side * 0.62)
        box(f"{prefix}__panel_{ax}{sgn}", (px, py, zc), size, P["steel"])
        small = (side * 0.024, side * 0.36, side * 0.3) if ax == "x" else (side * 0.36, side * 0.024, side * 0.3)
        box(f"{prefix}__plate_{ax}{sgn}", (px, py, zc + side * 0.05), small, P["gunmetal"])
    # the front stencil (OC-47 in orange) and the ID plate
    box(f"{prefix}__stencil", (x - side * 0.18, y - h * 1.0, zc - side * 0.26), (side * 0.3, side * 0.01, side * 0.1), P["hazard"])
    box(f"{prefix}__idplate", (x + side * 0.16, y - h * 1.0, zc - side * 0.26), (side * 0.14, side * 0.01, side * 0.08), P["white"])
    # the lid's raised rim
    box(f"{prefix}__lid", (x, y, z + side * 0.985), (side * 0.7, side * 0.7, side * 0.03), P["steel"])
