"""Shared helpers for the outpost building scripts.  [MM-story_mw5oect7_m]

Built on the capital-ship helpers (tools/blender/ships/common.py): the same primitives, the same shared panel
surface (detail_tex_v2 maps) and the same glTF export. Three differences, from the outpost tech plan §6.2:

- **No mirroring.** Buildings are not port/starboard symmetric.
- **Three roles per node, not two.** `body` (every non-emissive part, vertex-coloured), `trim` (the orange accent
  parts, their own mesh so the game can recolour them per faction) and `glow` (cyan emissive, unlit at runtime).
- **Named nodes.** A part named `<node>__<part>` goes into node `<node>` (e.g. `shuttle__wing`, `core__ring`), so the
  game can move, aim or hide that node: the parked shuttle, the reactor core, the hologram, the laser emitter.
  Parts without `__` belong to the node `base`. Each node × role is one mesh: `<slug>_<node>_<role>`.

Units: one unit = one battle map cell. Blender Z is up, the building's front faces -Y (the camera side in the owner's
concept image), and the base sits on z = 0 centred on the origin. glTF export turns Z-up into the game's Y-up.

    python3 tools/blender/outposts/<slug>.py [out_dir] [--render]
"""
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "ships"))
import common as ship  # noqa: E402  (the ship helpers; bpy is imported there)
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Euler, Matrix, Quaternion, Vector  # noqa: E402

box, cyl, loft, ring_x, section = ship.box, ship.cyl, ship.loft, ship.ring_x, ship.section

ship.SURFACE = "v2"
ship.TILE = 0.75                  # one panel repeat ≈ 3 m at 1 cell ≈ 4 m: plates read at building scale
LODS = {0: 0.0, 1: 0.045, 2: 0.14}  # drop parts whose bounding diagonal is below this × the building's footprint

# ── animation: pivots and looping clips ───────────────────────────────────────────────
# A node that moves gets a pivot frame: its meshes are re-expressed about the pivot and parented to an empty there
# (named <slug>_<node>, extras node=<node>), so the game can also turn it by hand. A node with a clip gets a looping
# glTF animation named <node> on that empty. In the game every clip loops on an AnimationMixer while the building
# works (a rig: while extracting) and stops when it idles or loses power; the Mk II rig plays them at timeScale 2.
FPS = 24
_FRAMES, _CLIPS = {}, {}


def node_frame(node, pivot, euler=(0.0, 0.0, 0.0)):
    """The pivot a node turns about: a point and the node's rest orientation (radians, XYZ)."""
    _FRAMES[node] = (Vector(pivot), Euler(euler))


def clip(node, kind, period, axis="Z", amp=0.0, vec=(0.0, 0.0, 0.0), turns=1):
    """A looping clip on a node that has a pivot frame. kind:
    spin   - full turns about the node's own axis (an auger screw);   spin_world - about a world axis (a dish);
    rock   - a sine swing of `amp` degrees about the node's own axis (a pump beam);   sweep - the same about a world
    axis (a radar);   slide - moves by `vec` over the period, then snaps back (ore riding a chute, one chunk spacing);
    travel - eases out by `vec` and back over the period (an ore cart running its track)."""
    assert node in _FRAMES, f"clip on {node} needs node_frame first"
    _CLIPS[node] = dict(kind=kind, period=period, axis=axis, amp=amp, vec=Vector(vec), turns=turns)


def _keys(node):
    """[(frame, location, quaternion)] for a node's clip."""
    p, e = _FRAMES[node]
    q0, c = e.to_quaternion(), _CLIPS[node]
    n = max(2, round(c["period"] * FPS))
    ax = Vector({"X": (1, 0, 0), "Y": (0, 1, 0), "Z": (0, 0, 1)}[c["axis"]])
    k = c["kind"]
    if k == "slide":
        return [(0, p.copy(), q0), (n, p + c["vec"], q0)]
    if k == "travel":
        return [(n * i / 16, p + c["vec"] * (0.5 - 0.5 * math.cos(2 * math.pi * i / 16)), q0) for i in range(17)]
    steps = 24 * c["turns"] if k.startswith("spin") else 16
    out = []
    for i in range(steps + 1):
        t = i / steps
        a = 2 * math.pi * c["turns"] * t if k.startswith("spin") else math.radians(c["amp"]) * math.sin(2 * math.pi * t)
        r = Quaternion(ax, a)
        out.append((n * t, p.copy(), q0 @ r if k in ("spin", "rock") else r @ q0))
    return out


def _rig(slug, lod, objs):
    """Parent each framed node's meshes to a pivot empty and key its clip. Returns the empties."""
    prefs = bpy.context.preferences.edit
    prefs.keyframe_new_interpolation_type = "LINEAR"
    bpy.context.scene.render.fps = FPS
    empties = []
    for node, (p, e) in _FRAMES.items():
        parts = [o for o in objs if o.get("node") == node]
        if not parts:
            continue
        m = Matrix.Translation(p) @ e.to_matrix().to_4x4()
        emp = bpy.data.objects.new(f"{slug}_{node}", None)
        emp["node"], emp["pivot"] = node, True
        emp.rotation_mode = "QUATERNION"
        emp.location, emp.rotation_quaternion = p, e.to_quaternion()
        bpy.context.scene.collection.objects.link(emp)
        for o in parts:
            o.data.transform(m.inverted())
            o.parent = emp
            o.matrix_parent_inverse = Matrix.Identity(4)
            o.matrix_basis = Matrix.Identity(4)
        if node in _CLIPS:
            for f, loc, q in _keys(node):
                emp.location, emp.rotation_quaternion = loc, q
                emp.keyframe_insert("location", frame=f)
                emp.keyframe_insert("rotation_quaternion", frame=f)
            emp.animation_data.action.name = f"{node}__lod{lod}"
            emp.location, emp.rotation_quaternion = p, e.to_quaternion()
        empties.append(emp)
    return empties


def _export_lod(objs, path, lod):
    """Export one LOD; its clips are renamed to the bare node name for the file, then back."""
    acts = [o.animation_data.action for o in objs if o.type == "EMPTY" and o.animation_data and o.animation_data.action]
    for a in acts:
        a.name = a.name.split("__lod")[0]
    ship._export(objs, path)
    for a in acts:
        a.name = f"{a.name}__lod{lod}"

# ── palette (the concept image) ────────────────────────────────────────────────────────
WHITE = (0.70, 0.71, 0.72)        # hull panels
LIGHT = (0.46, 0.47, 0.49)        # light grey
MID = (0.24, 0.25, 0.265)         # mid grey frames
DARK = (0.075, 0.08, 0.088)       # chamfered bases, decks
DECK = (0.13, 0.135, 0.145)       # landing deck
TRIM = (0.92, 0.36, 0.05)         # orange trim (recoloured per faction at runtime)
CYAN = (0.05, 0.42, 1.0)          # emissive: saturated so the AgX view keeps it blue


def mats():
    """The material set every building uses. `trim` and `glow` are matched by name in finish()."""
    return {
        "white": ship.mat("white", WHITE, rough=0.55, metal=0.15),
        "light": ship.mat("light", LIGHT, rough=0.55, metal=0.2),
        "mid": ship.mat("mid", MID, rough=0.5, metal=0.3),
        "dark": ship.mat("dark", DARK, rough=0.55, metal=0.35),
        "deck": ship.mat("deck", DECK, rough=0.7, metal=0.2),
        "glass": ship.mat("glass", (0.05, 0.08, 0.12), rough=0.15, metal=0.6),
        "trim": ship.mat("trim", TRIM, rough=0.5, metal=0.1),
        "glow": ship.mat("glow", CYAN, emit=CYAN, strength=3.5),
    }


def octo(name, cx, cy, z0, z1, w, d, c, material, bevel=0.0):
    """A vertical chamfered block (octagon when c > 0): half-width w (X), half-depth d (Y), from z0 to z1."""
    return loft(name, [(z0, w, d, c, cx, cy), (z1, w, d, c, cx, cy)], material, bevel=bevel, axis="Z")


def yloft(name, stations, material, bevel=0.0):
    """Loft along Y (a fuselage nose-to-tail, front = -Y): stations [(y, w, h, c, cx, cz), …], w half-width in X,
    h half-height in Z."""
    bm = bmesh.new()
    rings = [[bm.verts.new(Vector((cx + a, y, cz + b))) for a, b in section(w, h, c)] for y, w, h, c, cx, cz in stations]
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return ship._obj(name, bm, material, bevel)


def tier(name, cx, cy, steps, material, c=0.0, bevel=0.0):
    """Stacked chamfered blocks: steps = [(z0, z1, w, d), …] (a stepped plinth or a tapering tower)."""
    return [octo(f"{name}_{i}", cx, cy, z0, z1, w, d, c if c else min(w, d) * 0.25, material, bevel)
            for i, (z0, z1, w, d) in enumerate(steps)]


def drum(name, center, r, h, material, sides=16, r1=None):
    """Vertical cylinder standing on center (x, y, z0)."""
    x, y, z = center
    return cyl(name, (x, y, z + h / 2), r, h, material, sides=sides, axis="Z", r1=r1)


def ring(name, center, r_out, r_in, h, material, sides=24):
    """Vertical hollow ring (a collar, a glowing core rim) standing on center (x, y, z0)."""
    bm = bmesh.new()
    x, y, z = center
    def loop(r, zz):
        return [bm.verts.new((x + r * math.cos(2 * math.pi * (i + 0.5) / sides),
                              y + r * math.sin(2 * math.pi * (i + 0.5) / sides), zz)) for i in range(sides)]
    o0, o1, i0, i1 = loop(r_out, z), loop(r_out, z + h), loop(r_in, z), loop(r_in, z + h)
    for k in range(sides):
        j = (k + 1) % sides
        bm.faces.new((o0[k], o0[j], o1[j], o1[k]))
        bm.faces.new((i1[k], i1[j], i0[j], i0[k]))
        bm.faces.new((o1[k], o1[j], i1[j], i1[k]))
        bm.faces.new((i0[k], i0[j], o0[j], o0[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return ship._obj(name, bm, material)


def panel(name, center, size, material):
    """A thin flat plate (window, stripe, screen): size (sx, sy, sz) with one axis thin."""
    return box(name, center, size, material)


def window_strip(name, x0, x1, y, z, h, glow, n=None, gap=0.08, face=-1):
    """A row of lit window slits along X on a wall facing ±Y (face = -1: front). Returns the parts."""
    n = n or max(1, int((x1 - x0) / 0.32))
    w = (x1 - x0 - gap * (n - 1)) / n
    return [box(f"{name}_{i}", (x0 + w / 2 + i * (w + gap), y + face * 0.012, z), (w, 0.03, h), glow) for i in range(n)]


def anchor(name, at, **extra):
    """An empty exported with the GLB: a point the game attaches effects to (laser muzzle, beam target, shuttle)."""
    e = bpy.data.objects.new(f"anchor_{name}", None)
    e.empty_display_type = "PLAIN_AXES"
    e.location = at
    for k, v in extra.items():
        e[k] = v
    bpy.context.scene.collection.objects.link(e)
    return e


# ── finishing ─────────────────────────────────────────────────────────────────────────
def _role(m):
    if not m:
        return "body"
    if ship._is_glow(m):
        return "glow"
    return "trim" if m.name.split(".")[0] == "trim" else "body"


def _merge(slug, lod, parts, size):
    body_mat, glow_mat = ship._shared_mats(), ship._glow_mat()
    glow_mat.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 3.0   # render only: unlit in game
    trim_mat = bpy.data.materials.get("outpost_trim") or bpy.data.materials.new("outpost_trim")
    trim_mat.use_nodes = True
    trim_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*TRIM, 1)
    trim_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.5
    dg = bpy.context.evaluated_depsgraph_get()
    groups = {}
    for ob in parts:
        if ship._diag(ob) < LODS[lod] * size:
            continue
        for md in ob.modifiers:
            if md.type == "BEVEL":
                md.show_viewport = lod == 0
        dg.update()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        me.transform(ob.matrix_world)
        m = me.materials[0] if me.materials else None
        role = _role(m)
        col = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        rgb = ship._rgb(m) if m else (0.5, 0.5, 0.5, 1)
        for d in col.data:
            d.color = rgb
        if role != "glow":
            ship._part_uvs(me, size)
        node = ob.name.split("__")[0] if "__" in ob.name else "base"
        groups.setdefault((node, role), []).append(me)
    out = []
    for (node, role), meshes in sorted(groups.items()):
        bm = bmesh.new()
        for me in meshes:
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if role == "glow":
            ship._box_uvs(bm)
        oname = f"{slug}_{node}_{role}"
        me = bpy.data.meshes.new(oname)
        bm.to_mesh(me)
        bm.free()
        me.materials.append({"body": body_mat, "trim": trim_mat, "glow": glow_mat}[role])
        for p in me.polygons:
            p.use_smooth = False
        ob = bpy.data.objects.new(oname, me)
        ob["node"], ob["role"] = node, role
        bpy.context.scene.collection.objects.link(ob)
        out.append(ob)
    return out


VIEWS = {"concept": (-90, 38), "back": (90, 38), "left": (180, 30), "top": (-90, 89)}


def _render(out, slug, res=(960, 720), views=VIEWS):
    """Cycles views: 'concept' matches the owner's image (from the front, about 38° down), on a brown ground."""
    lo, hi = ship._bounds()                       # the building only, before the ground goes in
    lo.z = 0
    ground = ship.mat("ground", (0.27, 0.21, 0.19), rough=0.95, metal=0.0)
    box("ground_plane", (0, 0, -0.01), (60, 60, 0.02), ground)
    bpy.data.worlds["space"].node_tree.nodes["Background"].inputs[0].default_value = (0.42, 0.44, 0.48, 1)
    ship._lights()
    ctr, size = (lo + hi) / 2, (hi - lo).length
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 50
    bpy.context.scene.collection.objects.link(cam)
    s = bpy.context.scene
    s.camera = cam
    s.render.resolution_x, s.render.resolution_y = res
    s.cycles.samples = 32
    s.view_settings.view_transform = "Standard"   # closer to the game's tone and the concept's saturated blues
    s.view_settings.exposure = -0.9
    for v, (yaw, pitch) in views.items():
        y, p = math.radians(yaw), math.radians(pitch)
        cam.data.type = "ORTHO" if v == "top" else "PERSP"
        cam.data.ortho_scale = max(hi.x - lo.x, hi.y - lo.y) * 1.15
        d = size * (3.0 if v == "top" else 1.55)
        cam.location = ctr + Vector((math.cos(p) * math.cos(y), math.cos(p) * math.sin(y), math.sin(p))) * d
        cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
        s.render.filepath = os.path.join(out, f"{slug}_{v}.png")
        bpy.ops.render.render(write_still=True)


def build(slug, make, argv=None, ref=None):
    """Run make() in a clean scene, merge by node × role, export {slug}_lod{0,1,2}.glb + .blend; --render adds the
    Cycles views and a review sheet beside the concept crop `ref` (a file in ref/)."""
    argv = argv if argv is not None else sys.argv[1:]
    out = os.path.abspath(argv[0] if argv and not argv[0].startswith("--") else os.path.join(HERE, "out", slug))
    os.makedirs(out, exist_ok=True)
    t = time.time()
    ship.reset()
    _FRAMES.clear()
    _CLIPS.clear()
    make()
    bpy.context.view_layer.update()
    src = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    anchors = [o for o in bpy.context.scene.objects if o.type == "EMPTY"]
    lo, hi = ship._bounds()
    size = max(hi.x - lo.x, hi.y - lo.y)
    lods = {lod: _merge(slug, lod, src, size) for lod in LODS}
    for ob in src:
        bpy.data.objects.remove(ob)
    rigs = {lod: _rig(slug, lod, objs) for lod, objs in lods.items()}
    stats = {}
    for lod, objs in lods.items():
        _export_lod(objs + rigs[lod] + anchors, os.path.join(out, f"{slug}_lod{lod}.glb"), lod)
        stats[lod] = (ship._tris(objs), len(objs))
    for lod, objs in lods.items():
        for ob in objs + rigs[lod]:
            ob.hide_render = ob.hide_viewport = lod != 0
    bpy.context.scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, f"{slug}.blend"))
    if "--render" in argv:
        _render(out, slug)
        sheet(out, slug, ref)
    if "--anim" in argv and _CLIPS:
        _anim_preview(out, slug, (lo, hi))
    dims = f"{hi.x - lo.x:.2f} × {hi.y - lo.y:.2f} × {hi.z - lo.z:.2f}"
    line = ", ".join(f"LOD{l} {n} tris / {d} meshes" for l, (n, d) in stats.items())
    clips = ", ".join(f"{n} {c['kind']} {c['period']}s" for n, c in _CLIPS.items()) or "none"
    print(f"[{slug}] {dims} cells; {line}; {len(anchors)} anchors; clips: {clips}; built in {time.time() - t:.1f}s → {out}")
    return stats


def _anim_preview(out, slug, bounds, seconds=3.0, fps=12, res=(640, 480)):
    """Render the LOD0 clips from the concept angle for `seconds` and write {slug}_anim.gif (a review aid)."""
    from PIL import Image
    lo, hi = bounds
    lo = lo.copy()
    lo.z = 0
    s = bpy.context.scene
    if not s.camera:                                     # --anim without --render: set the stage up here
        _render(out, slug, views={})
    cam = s.camera
    ctr, size = (lo + hi) / 2, (hi - lo).length
    y, p = math.radians(-90), math.radians(38)
    cam.data.type = "PERSP"
    cam.location = ctr + Vector((math.cos(p) * math.cos(y), math.cos(p) * math.sin(y), math.sin(p))) * size * 1.35
    cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
    s.render.resolution_x, s.render.resolution_y = res
    s.cycles.samples = 12
    frames = []
    for i in range(int(seconds * fps)):
        s.frame_set(round(i * FPS / fps))
        s.render.filepath = os.path.join(out, "anim", f"{i:03d}.png")
        bpy.ops.render.render(write_still=True)
        frames.append(Image.open(s.render.filepath).convert("RGB"))
    frames[0].save(os.path.join(out, f"{slug}_anim.gif"), save_all=True, append_images=frames[1:],
                   duration=int(1000 / fps), loop=0)


def sheet(out, slug, ref):
    from PIL import Image, ImageDraw
    tiles = ([("concept crop", os.path.join(HERE, "ref", ref))] if ref else []) + \
            [(v, os.path.join(out, f"{slug}_{v}.png")) for v in VIEWS]
    W, H = 720, 540
    img = Image.new("RGB", (W * 3, H * 2), (20, 22, 26))
    d = ImageDraw.Draw(img)
    for i, (label, p) in enumerate(tiles):
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGB")
        im.thumbnail((W, H))
        x, y = (i % 3) * W, (i // 3) * H
        img.paste(im, (x + (W - im.width) // 2, y + (H - im.height) // 2))
        d.text((x + 10, y + 8), label, fill=(230, 230, 230))
    img.save(os.path.join(out, f"{slug}_sheet.jpg"), quality=86)
