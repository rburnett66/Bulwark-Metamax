"""Shared helpers for the outpost DECOR models and the farm's cargo lift.  [MM-story_mwfacvte_b]

Design and budget: docs/16 Bulwark MM/design/Outpost-Decor-and-Cargo-Lift.md (§1 the assets, §2 the budget).
Reference sheets: Design/<slug>.png (repo root, owner 2026-11-13).

Two LODs per model (owner 2026-11-13: "2 levels of LOD simple flat shaded, and medium detail textured"):

- `{slug}_flat.glb`  — make(detail=False): fewer sides, no small parts; one merged mesh per node, vertex-coloured by
  material, flat shaded, NO texture. The Low tier and safe mode draw it.
- `{slug}_tex.glb`   — make(detail=True): the medium-detail parts, joined, Smart-UV-unwrapped and baked by Cycles into
  ONE colour atlas (ATLAS[class]²: the material colours with procedural wear, grime and hazard stripes), then one
  material with that image; exported as JPEG inside the GLB. Standard and High draw it.

Units: one unit = one outpost cell = 4 m (`M` converts metres). Z up, front = -Y, base on z = 0 centred on the origin,
as the outpost buildings. Nodes: a part named `<node>__<part>` goes in node `<node>` (the cargo lift's two cubes are
nodes, so the game can show 0, 1 or 2); other parts are node `base`.

    python tools/blender/outposts/decor/<slug>.py [out_dir] [--render]

Each build prints its triangles and bytes per LOD against the budget (BUDGET) and exits non-zero when over it.
"""
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", "..", "ships"))
import common as ship  # noqa: E402  (bpy is imported there)
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

box, cyl = ship.box, ship.cyl
M = 0.25   # metres → cells (one cell ≈ 4 m)

# §2 of the design: triangles per LOD, atlas side, GLB bytes
BUDGET = {
    "small": {"flat": 300, "tex": 1200, "atlas": 256, "flat_kb": 40, "tex_kb": 120},
    "large": {"flat": 600, "tex": 2000, "atlas": 512, "flat_kb": 40, "tex_kb": 250},
    "lift": {"flat": 1200, "tex": 4000, "atlas": 512, "flat_kb": 40, "tex_kb": 400},
}

# ── the decor palette (from the reference sheets) ──────────────────────────────────────
PALETTE = {
    "steel": (0.50, 0.52, 0.54),       # galvanised steel (tank, drum, posts)
    "gunmetal": (0.20, 0.215, 0.23),   # cargo cube panels, trailer frame
    "dark": (0.075, 0.08, 0.088),      # rubber, recesses
    "blue": (0.08, 0.30, 0.62),        # the tank's bands
    "water": (0.25, 0.62, 0.92),       # the sight glass
    "hazard": (0.92, 0.48, 0.06),      # orange stripes and stencils
    "olive": (0.25, 0.28, 0.20),       # ammo / supply crates
    "khaki": (0.42, 0.38, 0.27),
    "teal": (0.20, 0.33, 0.33),
    "rust": (0.38, 0.22, 0.13),
    "white": (0.80, 0.80, 0.78),       # labels, signs
    "red": (0.62, 0.12, 0.10),
    "sky": (0.30, 0.52, 0.66),
    "cream": (0.78, 0.72, 0.58),
}
_WEAR = {"steel": 0.35, "gunmetal": 0.45, "dark": 0.2, "olive": 0.5, "khaki": 0.5, "teal": 0.5, "rust": 0.6}


def mats():
    """One Blender material per palette colour. The textured bake reads their node trees (base colour + wear)."""
    out = {}
    for k, rgb in PALETTE.items():
        m = ship.mat(f"decor_{k}", rgb, rough=0.6, metal=0.3 if k in ("steel", "gunmetal") else 0.05)
        m["wear"] = _WEAR.get(k, 0.25)
        out[k] = m
    return out


def mat_stripes(rgb_a=PALETTE["hazard"], rgb_b=PALETTE["dark"], scale=6.0):
    """A hazard-stripe material: diagonal bands, baked into the atlas (flat LOD: the first colour)."""
    m = ship.mat("decor_stripes", rgb_a, rough=0.55, metal=0.1)
    m["stripes"] = [*rgb_a, *rgb_b, float(scale)]   # a, b, scale (ID properties hold flat numbers)
    return m


def drum(name, center, r, h, material, sides=16):
    """A vertical cylinder standing on z = center.z."""
    x, y, z = center
    return cyl(name, (x, y, z + h / 2), r, h, material, sides=sides, axis="Z")


# ── building one LOD ───────────────────────────────────────────────────────────────────
def _parts():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def _flat_merge(slug, parts):
    """Merge the parts per node into one vertex-coloured, flat-shaded mesh (no texture)."""
    flat = bpy.data.materials.get("decor_flat") or bpy.data.materials.new("decor_flat")
    flat.use_nodes = True
    nt = flat.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Roughness"].default_value = 0.7
    p.inputs["Metallic"].default_value = 0.1
    ca = nt.nodes.new("ShaderNodeVertexColor")
    ca.layer_name = "Col"
    nt.links.new(ca.outputs["Color"], p.inputs["Base Color"])
    groups = {}
    for ob in parts:
        me = bpy.data.meshes.new_from_object(ob)
        me.transform(ob.matrix_world)
        m = me.materials[0] if me.materials else None
        rgb = tuple(m["stripes"][0:3]) + (1,) if m and "stripes" in m else ship._rgb(m) if m else (0.5, 0.5, 0.5, 1)
        col = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        for d in col.data:
            d.color = rgb
        node = ob.name.split("__")[0] if "__" in ob.name else "base"
        groups.setdefault(node, []).append(me)
    out = []
    for node, meshes in sorted(groups.items()):
        bm = bmesh.new()
        for me in meshes:
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        me = bpy.data.meshes.new(f"{slug}_{node}")
        bm.to_mesh(me)
        bm.free()
        me.materials.clear()
        me.materials.append(flat)
        for poly in me.polygons:
            poly.use_smooth = False
        ob = bpy.data.objects.new(f"{slug}_{node}", me)
        ob["node"] = node
        bpy.context.scene.collection.objects.link(ob)
        out.append(ob)
    for ob in parts:
        bpy.data.objects.remove(ob)
    return out


def _bake_tree(m, img):
    """Give material m a colour-only node tree for the bake (base colour with wear / grime / stripes) and the bake
    target image as its active node."""
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    if "stripes" in m:
        v = list(m["stripes"])
        a, b, scale = v[0:3], v[3:6], v[6]
        tc = nt.nodes.new("ShaderNodeTexCoord")
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = "DIAGONAL"
        wave.wave_profile = "SAW"
        wave.inputs["Scale"].default_value = scale
        nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.interpolation = "CONSTANT"
        ramp.color_ramp.elements[0].color = (*b, 1)
        ramp.color_ramp.elements[1].position = 0.5
        ramp.color_ramp.elements[1].color = (*a, 1)
        nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
        base = ramp.outputs["Color"]
    else:
        rgb = p.inputs["Base Color"].default_value
        c = nt.nodes.new("ShaderNodeRGB")
        c.outputs[0].default_value = rgb
        base = c.outputs[0]
    wear = float(m.get("wear", 0.25))
    tc = nt.nodes.new("ShaderNodeTexCoord")
    # grime: large soft noise darkening
    grime = nt.nodes.new("ShaderNodeTexNoise")
    grime.inputs["Scale"].default_value = 9.0
    grime.inputs["Detail"].default_value = 4.0
    nt.links.new(tc.outputs["Object"], grime.inputs["Vector"])
    gmix = nt.nodes.new("ShaderNodeMix")
    gmix.data_type = "RGBA"
    gmix.blend_type = "MULTIPLY"
    gmix.inputs["Factor"].default_value = 0.55 * wear
    nt.links.new(base, gmix.inputs["A"])
    nt.links.new(grime.outputs["Color"], gmix.inputs["B"])
    # scratches / chips: fine noise lightening, thresholded
    chips = nt.nodes.new("ShaderNodeTexNoise")
    chips.inputs["Scale"].default_value = 60.0
    chips.inputs["Detail"].default_value = 2.0
    nt.links.new(tc.outputs["Object"], chips.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].position = 0.62
    cr.color_ramp.elements[1].position = 0.7
    nt.links.new(chips.outputs["Fac"], cr.inputs["Fac"])
    cmix = nt.nodes.new("ShaderNodeMix")
    cmix.data_type = "RGBA"
    cmix.blend_type = "MIX"
    nt.links.new(gmix.outputs["Result"], cmix.inputs["A"])
    cmix.inputs["B"].default_value = (0.62, 0.62, 0.6, 1)
    fac = nt.nodes.new("ShaderNodeMath")
    fac.operation = "MULTIPLY"
    nt.links.new(cr.outputs["Color"], fac.inputs[0])
    fac.inputs[1].default_value = 0.6 * wear
    nt.links.new(fac.outputs[0], cmix.inputs["Factor"])
    # bake the colour straight from an emission shader (no lighting in the atlas)
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(cmix.outputs["Result"], em.inputs["Color"])
    outn = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    nt.links.new(em.outputs["Emission"], outn.inputs["Surface"])
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.nodes.active = tex


def _tex_bake(slug, parts, side):
    """Join the parts per node, Smart-UV-unwrap, bake one colour atlas for the model, one material with it."""
    img = bpy.data.images.new(f"{slug}_atlas", side, side)
    groups = {}
    for ob in parts:
        node = ob.name.split("__")[0] if "__" in ob.name else "base"
        groups.setdefault(node, []).append(ob)
    joined = []
    for node, obs in sorted(groups.items()):
        bpy.ops.object.select_all(action="DESELECT")
        for o in obs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        if len(obs) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        ob.name = ob.data.name = f"{slug}_{node}"
        ob["node"] = node
        joined.append(ob)
    # one UV layout across every node so they share the atlas
    bpy.ops.object.select_all(action="DESELECT")
    for ob in joined:
        ob.select_set(True)
        if not ob.data.uv_layers:
            ob.data.uv_layers.new(name="UVMap")
    bpy.context.view_layer.objects.active = joined[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    seen = set()
    for ob in joined:
        for m in ob.data.materials:
            if m and m.name not in seen:
                seen.add(m.name)
                _bake_tree(m, img)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = 4
    s.render.bake.margin = 4
    bpy.ops.object.select_all(action="DESELECT")
    for ob in joined:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = joined[0]
    bpy.ops.object.bake(type="EMIT")
    img.file_format = "JPEG"
    final = bpy.data.materials.new(f"{slug}_tex")
    final.use_nodes = True
    p = final.node_tree.nodes["Principled BSDF"]
    p.inputs["Roughness"].default_value = 0.62
    p.inputs["Metallic"].default_value = 0.15
    t = final.node_tree.nodes.new("ShaderNodeTexImage")
    t.image = img
    final.node_tree.links.new(t.outputs["Color"], p.inputs["Base Color"])
    for ob in joined:
        ob.data.materials.clear()
        ob.data.materials.append(final)
        for poly in ob.data.polygons:
            poly.material_index = 0
            poly.use_smooth = False
    return joined


def _export(objs, path, tex):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs:
        ob.select_set(True)
    kw = dict(filepath=path, use_selection=True, export_apply=True, export_extras=True, export_lights=False,
              export_cameras=False)
    if tex:
        kw.update(export_image_format="JPEG", export_jpeg_quality=82)
    bpy.ops.export_scene.gltf(**kw)


def _dims():
    lo, hi = ship._bounds()
    return lo, hi


def build(slug, make, cls, argv=None, label="", ref=None):
    """Build both LODs of a decor model, check them against BUDGET[cls], write {slug}.json beside them."""
    if argv is None:
        argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    out = os.path.abspath(argv[0] if argv and not argv[0].startswith("--") else os.path.join(HERE, "out", slug))
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    B = BUDGET[cls]
    report = {"slug": slug, "label": label, "class": cls, "ref": ref, "lods": {}}
    for lod in ("flat", "tex"):
        ship.reset()
        make(detail=lod == "tex")
        bpy.context.view_layer.update()
        lo, hi = _dims()
        parts = _parts()
        objs = _flat_merge(slug, parts) if lod == "flat" else _tex_bake(slug, parts, B["atlas"])
        tris = ship._tris(objs)
        path = os.path.join(out, f"{slug}_{lod}.glb")
        _export(objs, path, lod == "tex")
        size = os.path.getsize(path)
        report["lods"][lod] = {"file": os.path.basename(path), "tris": tris, "meshes": len(objs), "bytes": size}
        report["footprint"] = [round(hi.x - lo.x, 3), round(hi.y - lo.y, 3)]
        report["height"] = round(hi.z - lo.z, 3)
        report["nodes"] = sorted({o["node"] for o in objs})
        if "--render" in argv and lod == "tex":
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, f"{slug}.blend"))
    over = []
    for lod in ("flat", "tex"):
        r = report["lods"][lod]
        if r["tris"] > B[lod]:
            over.append(f"{lod} {r['tris']} tris > {B[lod]}")
        if r["bytes"] > B[f"{lod}_kb"] * 1024:
            over.append(f"{lod} {r['bytes'] // 1024} KB > {B[lod + '_kb']} KB")
    report["budget"] = {"ok": not over, "over": over, **B}
    with open(os.path.join(out, f"{slug}.json"), "w") as f:
        json.dump(report, f, indent=1)
    L = report["lods"]
    print(f"[{slug}] {report['footprint'][0]:.2f} × {report['footprint'][1]:.2f} × {report['height']:.2f} cells; "
          f"flat {L['flat']['tris']} tris {L['flat']['bytes'] // 1024} KB; tex {L['tex']['tris']} tris "
          f"{L['tex']['bytes'] // 1024} KB; {'within budget' if not over else 'OVER: ' + '; '.join(over)}; "
          f"{time.time() - t0:.1f}s → {out}")
    if over:
        sys.exit(3)
    return report
