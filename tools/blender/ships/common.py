"""Shared helpers for the capital-ship build scripts.  [MM-story_mvzrzcjh_1z]

Conventions
- Units are metres-ish game units. +X is the bow, +Z is up, +Y is port.
- Hulls are lofts of chamfered-rectangle (octagonal) sections: hard-surface, few polygons, and the
  chamfer catches light the way the Grok art's panelled hulls do.
- Three shared material roles per ship (hull, trim, glow) plus any extras a ship needs.
- Each ship script calls build(out_dir) and writes only inside out_dir.
"""
import math
import os
import sys
import time

import bpy  # must come before bmesh: the bpy module provides it
import bmesh  # noqa: E402
from mathutils import Vector


# ── faction propulsion ────────────────────────────────────────────────────────────────
# Each faction's engines burn a slightly different colour (owner rule). The GLB carries an empty per
# nozzle (engine_N: position, scale = radius, extras.color) so the runtime exhaust effect can be driven
# per ship and dialled up or down for storytelling.
ENGINE_COLORS = {
    "air": (0.62, 0.80, 1.00),        # pale jet blue-white
    "arcane": (1.00, 0.28, 0.78),     # magenta
    "artillery": (1.00, 0.55, 0.16),  # diesel orange
    "collective": (0.30, 0.52, 1.00), # deep ion blue
    "dark": (0.62, 0.22, 1.00),       # violet
    "green": (0.58, 1.00, 0.22),      # chem green
    "lumen": (0.28, 0.86, 1.00),      # cyan
    "powder": (1.00, 0.30, 0.14),     # ember red
    "tech": (1.00, 0.80, 0.34),       # gold
    "water": (0.26, 1.00, 0.82),      # teal
}
SLUG = None
ENGINES = []


def engine(center, r, housing, depth=0.5, sides=8):
    """A stern nozzle facing -X: housing ring + glowing core in the faction colour + an engine marker.
    Port side or centreline only, like everything else; markers are mirrored in build()."""
    x, y, z = center
    cyl("engine_housing", (x + depth / 2, y, z), r * 1.22, depth, housing, sides=sides)
    col = ENGINE_COLORS.get(SLUG, (0.6, 0.8, 1.0))
    core = mat("engine_" + (SLUG or "x"), tuple(c * 0.3 for c in col), emit=col, strength=9)
    cyl("engine_core", (x - 0.02, y, z), r, 0.05, core, sides=sides)
    ENGINES.append((x - 0.05, y, z, r))


# ── scene ─────────────────────────────────────────────────────────────────────────────
def reset():
    ENGINES.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = 48
    s.cycles.use_denoising = True
    s.view_settings.view_transform = "AgX"
    w = bpy.data.worlds.new("space")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.004, 0.005, 0.009, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    s.world = w


def mat(name, rgb, rough=0.5, metal=0.1, emit=None, strength=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*rgb, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = (*emit, 1)
        p.inputs["Emission Strength"].default_value = strength
    m.diffuse_color = (*(emit or rgb), 1)
    return m


def _obj(name, bm, material, bevel=0.0, coll=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    ob = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    if material:
        me.materials.append(material)
    if bevel:
        b = ob.modifiers.new("chamfer", "BEVEL")
        b.width, b.segments, b.limit_method = bevel, 1, "ANGLE"
        b.angle_limit = math.radians(35)
    return ob


# ── primitives ────────────────────────────────────────────────────────────────────────
def section(w, h, c):
    """Chamfered rectangle in the YZ plane: half-width w, half-height h, chamfer c (c=0 → box)."""
    c = min(c, w * 0.999, h * 0.999)
    if c <= 0:
        return [(w, h), (-w, h), (-w, -h), (w, -h)]
    return [(w, h - c), (w - c, h), (-w + c, h), (-w, h - c), (-w, -h + c), (-w + c, -h), (w - c, -h), (w, -h + c)]


def loft(name, stations, material, cap0=True, cap1=True, bevel=0.0, axis="X"):
    """Loft chamfered sections along an axis. stations: [(x, w, h, c, cy, cz), …], same corner count each."""
    bm = bmesh.new()
    rings = []
    for x, w, h, c, cy, cz in stations:
        ring = []
        for y, z in section(w, h, c):
            p = Vector((x, cy + y, cz + z))
            if axis == "Z":       # vertical loft: x→z, y→x, z→y
                p = Vector((cy + y, cz + z, x))
            ring.append(bm.verts.new(p))
        rings.append(ring)
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap0:
        bm.faces.new(list(reversed(rings[0])))
    if cap1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material, bevel)


def box(name, center, size, material, chamfer=0.0, bevel=0.0):
    x, y, z = center
    sx, sy, sz = size
    return loft(name, [(x - sx / 2, sy / 2, sz / 2, chamfer, y, z), (x + sx / 2, sy / 2, sz / 2, chamfer, y, z)],
                material, bevel=bevel)


def cyl(name, center, r, length, material, sides=8, axis="X", r1=None):
    """Prism along an axis; r1 tapers the far end."""
    bm = bmesh.new()
    r1 = r if r1 is None else r1
    rings = []
    for t, rr in ((-length / 2, r), (length / 2, r1)):
        ring = []
        for i in range(sides):
            a = 2 * math.pi * (i + 0.5) / sides
            u, v = rr * math.cos(a), rr * math.sin(a)
            p = {"X": (t, u, v), "Y": (u, t, v), "Z": (u, v, t)}[axis]
            ring.append(bm.verts.new(Vector(center) + Vector(p)))
        rings.append(ring)
    for i in range(sides):
        bm.faces.new((rings[0][i], rings[0][(i + 1) % sides], rings[1][(i + 1) % sides], rings[1][i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material)


def mirror_y(ob):
    m = ob.modifiers.new("mirror", "MIRROR")
    m.use_axis = (False, True, False)
    m.mirror_object = None
    return ob


# ── output ────────────────────────────────────────────────────────────────────────────
def tri_count():
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for ob in bpy.context.scene.objects:
        if ob.type == "MESH" and not ob.hide_render:
            n += sum(len(p.vertices) - 2 for p in ob.evaluated_get(dg).data.polygons)
    return n


def _bounds():
    pts = [ob.matrix_world @ Vector(c) for ob in bpy.context.scene.objects
           if ob.type == "MESH" and not ob.hide_render for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def _lights():
    for name, rot, e, col in (("key", (50, 10, 35), 3.0, (1, 0.97, 0.92)), ("rim", (-60, 0, 200), 2.5, (0.6, 0.75, 1.0)),
                              ("fill", (100, 0, -60), 0.6, (0.8, 0.85, 1.0))):
        L = bpy.data.lights.new(name, "SUN")
        L.energy, L.color, L.angle = e, col, math.radians(2)
        o = bpy.data.objects.new(name, L)
        o.rotation_euler = [math.radians(a) for a in rot]
        bpy.context.scene.collection.objects.link(o)


VIEWS = {  # yaw (deg, 0 = looking at the bow), pitch (deg above the hull)
    "hero": (-35, 28), "side": (-90, 4), "top": (-90, 89), "rear": (150, 22),
}


def render_views(out_dir, slug, views=VIEWS, res=(960, 540)):
    _lights()
    lo, hi = _bounds()
    ctr, size = (lo + hi) / 2, (hi - lo).length
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 50
    cam.data.clip_end = size * 10
    bpy.context.scene.collection.objects.link(cam)
    s = bpy.context.scene
    s.camera = cam
    s.render.resolution_x, s.render.resolution_y = res
    paths = []
    for v, (yaw, pitch) in views.items():
        y, p = math.radians(yaw), math.radians(pitch)
        flat = v in ("side", "top")          # straight-on views are orthographic, like a blueprint
        cam.data.type = "ORTHO" if flat else "PERSP"
        cam.data.ortho_scale = max(hi.x - lo.x, hi.y - lo.y) * 1.08
        d = size * (3.0 if flat else 1.75)
        cam.location = ctr + Vector((math.cos(p) * math.cos(y), math.cos(p) * math.sin(y), math.sin(p))) * d
        cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
        s.render.filepath = os.path.join(out_dir, f"{slug}_{v}.png")
        bpy.ops.render.render(write_still=True)
        paths.append(s.render.filepath)
    return paths


# ── finishing: symmetry, draw calls, LODs ───────────────────────────────────────────────
# Effects and post-processing will own the frame budget, so every ship is finished the same lean way:
#  * mirrored port → starboard (owner rule): parts are cut at y = 0 and the port half is mirrored;
#  * 2 draw calls: every non-emissive material is folded into ONE vertex-coloured "body" mesh, and each
#    distinct glow colour becomes one emissive mesh (use one glow colour per ship → 2 draw calls);
#  * 3 LODs picked by part size relative to the ship's length (no hand tagging, no decimation artefacts).
LODS = {0: 0.0, 1: 0.05, 2: 0.16}     # drop parts whose bounding diagonal is below this × ship length


def _is_glow(m):
    if not m or not m.use_nodes:
        return False
    return m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value > 0


def _rgb(m):
    p = m.node_tree.nodes["Principled BSDF"]
    key = "Emission Color" if _is_glow(m) else "Base Color"
    return tuple(p.inputs[key].default_value)


TILE = 6.0          # world units per repeat of the shared panel texture (same panel size on every ship)
TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex")


def _img(name, colorspace):
    im = bpy.data.images.load(os.path.join(TEX, name), check_existing=True)
    im.colorspace_settings.name = colorspace
    return im


def _shared_mats():
    """ship_body: base colour = vertex colour × shared cavity map; shared panel normal map."""
    body = bpy.data.materials.get("ship_body")
    if not body:
        body = bpy.data.materials.new("ship_body")
        body.use_nodes = True
        nt = body.node_tree
        p = nt.nodes["Principled BSDF"]
        p.inputs["Roughness"].default_value = 0.5
        p.inputs["Metallic"].default_value = 0.2
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = "Col"
        cav = nt.nodes.new("ShaderNodeTexImage")
        cav.image = _img("panel_cavity.png", "sRGB")
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        nt.links.new(ca.outputs["Color"], mul.inputs[6])
        nt.links.new(cav.outputs["Color"], mul.inputs[7])
        nt.links.new(mul.outputs[2], p.inputs["Base Color"])
        nrm = nt.nodes.new("ShaderNodeTexImage")
        nrm.image = _img("panel_normal.png", "Non-Color")
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    return body


def _glow_mat():
    """ship_glow: every light strip and engine core in one mesh, coloured per vertex. In the game it is an
    UNLIT vertex-colour material (glTF has no emissive-by-vertex-colour), so swap it at load:
    MeshBasicMaterial({vertexColors: true, toneMapped: false})."""
    g = bpy.data.materials.get("ship_glow")
    if not g:
        g = bpy.data.materials.new("ship_glow")
        g.use_nodes = True
        nt = g.node_tree
        p = nt.nodes["Principled BSDF"]
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = "Col"
        nt.links.new(ca.outputs["Color"], p.inputs["Base Color"])
        nt.links.new(ca.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 8.0
    return g


def _box_uvs(bm):
    """World-space box projection; each axis frame keeps u × v along the face normal, so the normal map
    never renders inside-out on mirrored or back-facing sides."""
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        sg = 1 if n[ax] >= 0 else -1
        for lp in f.loops:
            x, y, z = lp.vert.co
            if ax == 0:
                u, v = sg * y, z
            elif ax == 1:
                u, v = -sg * x, z
            else:
                u, v = x, sg * y
            lp[uv].uv = (u / TILE, v / TILE)


def _diag(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return (Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))) -
            Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))).length


def _merge(slug, lod, parts, length):
    """parts: source objects. Returns the LOD's finished objects (body + one per glow colour)."""
    body_mat = _shared_mats()
    dg = bpy.context.evaluated_depsgraph_get()
    groups = {}
    for ob in parts:
        if _diag(ob) < LODS[lod] * length:
            continue
        for md in ob.modifiers:                           # chamfers only on the close-up LOD
            if md.type == "BEVEL":
                md.show_viewport = lod == 0
        dg.update()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        me.transform(ob.matrix_world)
        m = me.materials[0] if me.materials else None
        col = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        rgb = _rgb(m) if m else (0.5, 0.5, 0.5, 1)
        for d in col.data:
            d.color = rgb
        key = ("glow", "glow") if _is_glow(m) else ("body", "body")
        groups.setdefault(key, (m, []))[1].append(me)
    out = []
    for (role, name), (m, meshes) in groups.items():
        bm = bmesh.new()
        for me in meshes:
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0), plane_no=(0, -1, 0), clear_outer=True)
        bmesh.ops.mirror(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], axis="Y", merge_dist=1e-4)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.normal_update()
        _box_uvs(bm)
        oname = f"{slug}_lod{lod}_{'body' if role == 'body' else name}"
        me = bpy.data.meshes.new(oname)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(body_mat if role == "body" else _glow_mat())
        for p in me.polygons:
            p.use_smooth = False
        ob = bpy.data.objects.new(oname, me)
        bpy.context.scene.collection.objects.link(ob)
        out.append(ob)
    return out


def _tris(objs):
    return sum(len(p.vertices) - 2 for ob in objs for p in ob.data.polygons)


def _export(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs:
        ob.hide_set(False)
        ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_apply=True, export_extras=True,
                              export_lights=False, export_cameras=False)


def build(slug, make, argv=None):
    """Run a ship's make() in a clean scene, then finish it (mirror, 2 draw calls, LOD0-2), export
    {slug}_lod{0,1,2}.glb + {slug}.blend and render the LOD0 views. Writes only inside out_dir."""
    global SLUG
    SLUG = slug
    argv = argv if argv is not None else sys.argv[1:]
    out = os.path.abspath(argv[0] if argv and not argv[0].startswith("--") else os.path.join(os.path.dirname(__file__), "out", slug))
    os.makedirs(out, exist_ok=True)
    t = time.time()
    reset()
    make()
    src = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    lo, hi = _bounds()
    length = hi.x - lo.x
    lods = {lod: _merge(slug, lod, src, length) for lod in LODS}
    markers = []
    for x, y, z, r in ENGINES:
        for yy in ((y, -y) if abs(y) > 1e-3 else (0.0,)):
            e = bpy.data.objects.new(f"engine_{len(markers)}", None)
            e.empty_display_type = "SINGLE_ARROW"
            e.location, e.scale = (x, yy, z), (r, r, r)
            e.rotation_euler = (0, -math.pi / 2, 0)        # arrow (+Z) → -X: the thrust direction
            e["radius"] = r
            e["color"] = list(ENGINE_COLORS.get(slug, (0.6, 0.8, 1.0)))
            bpy.context.scene.collection.objects.link(e)
            markers.append(e)
    for ob in src:
        bpy.data.objects.remove(ob)
    stats = {}
    for lod, objs in lods.items():
        _export(objs + markers, os.path.join(out, f"{slug}_lod{lod}.glb"))
        stats[lod] = (_tris(objs), len(objs))
    for lod, objs in lods.items():                         # only LOD0 stays visible for renders
        for ob in objs:
            ob.hide_render = ob.hide_viewport = lod != 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, f"{slug}.blend"))
    if "--no-render" not in argv:
        render_views(out, slug)
    line = f"{len(markers)} engines; " + ", ".join(f"LOD{l} {n} tris / {d} draw calls" for l, (n, d) in stats.items())
    print(f"[{slug}] {line}; built in {time.time() - t:.1f}s → {out}")
    return stats
