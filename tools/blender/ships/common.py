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


# ── scene ─────────────────────────────────────────────────────────────────────────────
def reset():
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
    pts = [ob.matrix_world @ Vector(c) for ob in bpy.context.scene.objects if ob.type == "MESH" for c in ob.bound_box]
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


def finalize_symmetric(slug):
    """Owner rule: every ship is mirrored port → starboard. Bake all modifiers, merge into one mesh per
    material (one draw call each), cut away everything at y < 0 and mirror the port half across y = 0.
    A script that models anything starboard-only simply loses it, so symmetry can't drift."""
    dg = bpy.context.evaluated_depsgraph_get()
    by_mat = {}
    for ob in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        me.transform(ob.matrix_world)
        key = me.materials[0].name if me.materials else "none"
        by_mat.setdefault(key, []).append(me)
        bpy.data.objects.remove(ob)
    for key, meshes in by_mat.items():
        bm = bmesh.new()
        for me in meshes:
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0), plane_no=(0, -1, 0), clear_outer=True)
        bmesh.ops.mirror(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], axis="Y", merge_dist=1e-4)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(f"{slug}_{key}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(bpy.data.materials.get(key))
        for p in me.polygons:
            p.use_smooth = False
        bpy.context.scene.collection.objects.link(bpy.data.objects.new(f"{slug}_{key}", me))


def build(slug, make, argv=None):
    """Run a ship's make() in a clean scene, mirror it, then export GLB + .blend and render the views."""
    argv = argv if argv is not None else sys.argv[1:]
    out = os.path.abspath(argv[0] if argv and not argv[0].startswith("--") else os.path.join(os.path.dirname(__file__), "out", slug))
    os.makedirs(out, exist_ok=True)
    t = time.time()
    reset()
    make()
    finalize_symmetric(slug)
    tris = tri_count()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, f"{slug}.glb"), export_apply=True, use_selection=True,
                              export_lights=False, export_cameras=False)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, f"{slug}.blend"))
    if "--no-render" not in argv:
        render_views(out, slug)
    print(f"[{slug}] {tris} tris, built in {time.time() - t:.1f}s → {out}")
    return tris
