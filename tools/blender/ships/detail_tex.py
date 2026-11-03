"""Shared hull-panel detail textures for every capital ship.  [MM-story_mvzrzcjh_1z]

    python3 tools/blender/ships/detail_tex.py     # → tex/panel_{normal,cavity,rough}.png

One tileable 1024² set shared by the whole fleet: a normal map (panel seams, plate steps, vents, bolts),
a cavity map that darkens the seams (multiplied into the vertex colour), and a roughness/metalness map
(glTF layout, G = roughness, B = metalness) that gives every plate its own sheen, keeps seams dull and makes
hatches, louvre lips and bolt heads catch the light. Ships project it at a fixed
world scale (common.TILE), so panel size reads the same on every ship. Deterministic (fixed seed).
"""
import os

import numpy as np
from PIL import Image

N = 1024
SEED = 7
HERE = os.path.dirname(os.path.abspath(__file__))


def wrap_blur(a, r):
    out = a.copy()
    for axis in (0, 1):
        acc = np.zeros_like(out)
        for k in range(-r, r + 1):
            acc += np.roll(out, k, axis)
        out = acc / (2 * r + 1)
    return out


def heightfield():
    """Height plus per-texel roughness and metalness, from the same panel layout so they line up."""
    rng = np.random.default_rng(SEED)
    h = np.zeros((N, N), np.float32)
    rough = np.full((N, N), 0.9, np.float32)        # seams and gaps: rough, dull
    metal = np.full((N, N), 0.1, np.float32)
    seam = 3
    cell = 128

    def plate(x0, y0, w, hgt, depth):
        if w <= 2 * seam or hgt <= 2 * seam:
            return
        lvl = 1.0 + rng.uniform(-0.12, 0.12)
        h[y0 + seam:y0 + hgt - seam, x0 + seam:x0 + w - seam] = lvl
        inner = (slice(y0 + seam, y0 + hgt - seam), slice(x0 + seam, x0 + w - seam))
        rough[inner] = rng.uniform(0.38, 0.72)        # each plate its own sheen
        metal[inner] = rng.uniform(0.15, 0.45)
        h[y0 + seam - 1:y0 + hgt - seam + 1, x0 + seam - 1:x0 + w - seam + 1] = np.maximum(
            h[y0 + seam - 1:y0 + hgt - seam + 1, x0 + seam - 1:x0 + w - seam + 1], lvl * 0.55)
        r = rng.random()
        if r < 0.18 and w > 40 and hgt > 28:                       # vent: inset with louvres
            ix, iy, iw, ih = x0 + w // 4, y0 + hgt // 4, w // 2, hgt // 2
            h[iy:iy + ih, ix:ix + iw] = lvl - 0.35
            rough[iy:iy + ih, ix:ix + iw] = 0.85          # dark grille
            for yy in range(iy + 3, iy + ih - 2, 6):
                h[yy:yy + 2, ix + 2:ix + iw - 2] = lvl - 0.15
                rough[yy:yy + 2, ix + 2:ix + iw - 2] = 0.3    # louvre lips catch the light
        elif r < 0.32 and w > 30 and hgt > 30:                     # raised hatch
            ix, iy = x0 + w // 5, y0 + hgt // 5
            h[iy:iy + hgt * 3 // 5, ix:ix + w * 3 // 5] = lvl + 0.18
            rough[iy:iy + hgt * 3 // 5, ix:ix + w * 3 // 5] = 0.25     # polished hatch
            metal[iy:iy + hgt * 3 // 5, ix:ix + w * 3 // 5] = 0.7
        elif r < 0.5:                                               # corner bolts
            for bx, by in ((x0 + 8, y0 + 8), (x0 + w - 10, y0 + 8), (x0 + 8, y0 + hgt - 10), (x0 + w - 10, y0 + hgt - 10)):
                h[by:by + 3, bx:bx + 3] = lvl + 0.22
                rough[by:by + 3, bx:bx + 3] = 0.2         # bright bolt heads
                metal[by:by + 3, bx:bx + 3] = 0.9

    def split(x0, y0, w, hgt, depth):
        if depth == 0 or (depth < 3 and rng.random() < 0.3):
            plate(x0, y0, w, hgt, depth)
            return
        if w >= hgt:
            c = int(w * rng.choice([0.25, 0.5, 0.75]))
            split(x0, y0, c, hgt, depth - 1)
            split(x0 + c, y0, w - c, hgt, depth - 1)
        else:
            c = int(hgt * rng.choice([0.25, 0.5, 0.75]))
            split(x0, y0, w, c, depth - 1)
            split(x0, y0 + c, w, hgt - c, depth - 1)

    for gy in range(0, N, cell):
        for gx in range(0, N, cell * 2):                           # 256×128 bays: hulls are long
            split(gx, gy, cell * 2, cell, 4)
    return wrap_blur(h, 1), wrap_blur(rough, 1), wrap_blur(metal, 1)


def main():
    h, rough, metal = heightfield()
    k = 2.2
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * k                # +x right
    dy = (np.roll(h, 1, 0) - np.roll(h, -1, 0)) * k                # +y up (image rows run down)
    n = np.dstack([-dx, -dy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    os.makedirs(os.path.join(HERE, "tex"), exist_ok=True)
    Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(os.path.join(HERE, "tex", "panel_normal.png"))
    cav = 1.0 - np.clip((wrap_blur(h, 4) - h) * 2.2, 0, 0.6)       # seams and insets darken
    cav = np.clip(cav * (0.92 + 0.08 * (h > 0.9)), 0, 1)
    Image.fromarray((cav * 255).astype(np.uint8)).save(os.path.join(HERE, "tex", "panel_cavity.png"))
    # glTF metallicRoughness layout: G = roughness, B = metalness (R unused, kept white)
    orm = np.dstack([np.ones_like(rough), rough, metal])
    Image.fromarray((orm * 255).astype(np.uint8)).save(os.path.join(HERE, "tex", "panel_rough.png"))
    print("wrote tex/panel_normal.png, tex/panel_cavity.png, tex/panel_rough.png")


if __name__ == "__main__":
    main()
