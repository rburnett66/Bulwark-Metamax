"""Hull-panel textures v2 — plating that reads at 500 m.  [MM-story_mw01uvuu_4]

    python3 tools/blender/ships/detail_tex_v2.py      # → tex/v2/panel_{normal,cavity,rough}.png (1024², tiling)

Fixes the v1 "smooth gouges" (see docs/16 Bulwark MM/design/Capital-Ship-Scale-Research.md):
- Authored at 4× (4096²) in pixel-unit heights and box-filtered down, so edges are crisp and anti-aliased.
- Plates sit at QUANTISED levels and seams are one-sided LAP STEPS: a higher plate ramps down onto its lower
  neighbour at 45° (a cone dilation of the level map). Asymmetric seams don't cancel out when mipmapped.
- Two seam tiers: major seams between bays (big steps), minor seams inside a bay (small steps).
- The seam itself lives in the COLOUR map as a 1 px dark line with a bright lip on the higher plate — colour
  survives mip filtering where normals average away. No blurred halo.
- Varied bay sizes (no lattice), ≈ 30 % large blank rest plates, per-plate ±4 % tone, features only in busy bays.
Deterministic (fixed seed). The roughness map is glTF metallicRoughness (G = roughness, B = metalness).
"""
import os

import numpy as np
from PIL import Image

OUT = 1024
SS = 4                      # supersample factor
N = OUT * SS
SEED = 11
HERE = os.path.dirname(os.path.abspath(__file__))

MAJOR = 7.0                 # px @4096 per major level step (≈ 1.75 px @1024 lap ramp)
MINOR = 3.0                 # px @4096 per minor level step


def shifts(a):
    for dy, dx, c in ((0, 1, 1.0), (0, -1, 1.0), (1, 0, 1.0), (-1, 0, 1.0),
                      (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414)):
        yield np.roll(np.roll(a, dy, 0), dx, 1), c


def layout(rng):
    """Return per-pixel plate id, level (px), bay id, busy flag per plate, and the plate list."""
    pid = np.zeros((N, N), np.int32)
    level = np.zeros((N, N), np.float32)
    plates = []                                     # (x0, y0, w, h, level, busy)
    y = 0
    heights = [64, 96, 128, 128, 192, 256]
    while y < OUT:
        bh = int(rng.choice(heights))
        bh = min(bh, OUT - y) if OUT - y >= 48 else OUT - y
        x = 0
        while x < OUT:
            bw = int(rng.choice([128, 192, 256, 320, 384, 512]))
            bw = min(bw, OUT - x) if OUT - x >= 96 else OUT - x
            bay_lvl = MAJOR * int(rng.integers(0, 3))
            if rng.random() < 0.3:                   # rest plate: one big quiet panel
                plates.append((x, y, bw, bh, bay_lvl, False))
            else:
                split(rng, x, y, bw, bh, bay_lvl, 4, plates)
            x += bw
        y += bh
    for i, (x0, y0, w, h, lv, _) in enumerate(plates):
        sl = (slice(y0 * SS, (y0 + h) * SS), slice(x0 * SS, (x0 + w) * SS))
        pid[sl] = i
        level[sl] = lv
    return pid, level, plates


def split(rng, x, y, w, h, lvl, depth, plates):
    if depth == 0 or w < 16 or h < 16 or (depth < 3 and rng.random() < 0.3):
        plates.append((x, y, w, h, lvl + MINOR * int(rng.integers(0, 2)), True))
        return
    if w >= h:
        c = int(w * rng.choice([0.25, 0.5, 0.5, 0.75]))
        split(rng, x, y, c, h, lvl, depth - 1, plates)
        split(rng, x + c, y, w - c, h, lvl, depth - 1, plates)
    else:
        c = int(h * rng.choice([0.25, 0.5, 0.5, 0.75]))
        split(rng, x, y, w, c, lvl, depth - 1, plates)
        split(rng, x, y + c, w, h - c, lvl, depth - 1, plates)


def boxdown(a, k=SS):
    s = a.shape
    return a.reshape(s[0] // k, k, s[1] // k, k, *s[2:]).mean(axis=(1, 3))


def main():
    rng = np.random.default_rng(SEED)
    pid, level, plates = layout(rng)

    # features (busy plates only), drawn into the level map in pixel-unit heights
    rough = np.zeros((N, N), np.float32)
    metal = np.zeros((N, N), np.float32)
    tone = np.ones((N, N), np.float32)
    feat = np.zeros((N, N), np.float32)              # local height offsets
    for i, (x0, y0, w, h, lv, busy) in enumerate(plates):
        sl = (slice(y0 * SS, (y0 + h) * SS), slice(x0 * SS, (x0 + w) * SS))
        rough[sl] = rng.uniform(0.36, 0.70)
        metal[sl] = rng.uniform(0.15, 0.45)
        tone[sl] = 1.0 + rng.uniform(-0.04, 0.04)
        if not busy:
            continue
        r = rng.random()
        X0, Y0, W, H = x0 * SS, y0 * SS, w * SS, h * SS
        if r < 0.12 and w >= 40 and h >= 28:                     # louvred vent, inset
            ix, iy, iw, ih = X0 + W // 4, Y0 + H // 4, W // 2, H // 2
            feat[iy:iy + ih, ix:ix + iw] = -6
            rough[iy:iy + ih, ix:ix + iw] = 0.85
            for yy in range(iy + 6, iy + ih - 6, 16):
                feat[yy:yy + 6, ix + 6:ix + iw - 6] = -2
        elif r < 0.30 and w >= 28 and h >= 28:                   # raised hatch, polished
            ix, iy, iw, ih = X0 + W // 5, Y0 + H // 5, W * 3 // 5, H * 3 // 5
            feat[iy:iy + ih, ix:ix + iw] = 4
            rough[iy:iy + ih, ix:ix + iw] = 0.24
            metal[iy:iy + ih, ix:ix + iw] = 0.7
        elif r < 0.45:                                           # bolt heads at the corners
            for bx, by in ((X0 + 20, Y0 + 20), (X0 + W - 28, Y0 + 20), (X0 + 20, Y0 + H - 28), (X0 + W - 28, Y0 + H - 28)):
                feat[by:by + 8, bx:bx + 8] = 3
                rough[by:by + 8, bx:bx + 8] = 0.18
                metal[by:by + 8, bx:bx + 8] = 0.9

    # lap steps: cone-dilate the level map so each higher plate ramps down 45° over its lower neighbour
    h = level.copy()
    for _ in range(int(MAJOR * 2) + 2):
        nxt = h
        for sh, c in shifts(h):
            nxt = np.maximum(nxt, sh - c)
        h = nxt
    h = h + feat

    # normals at 4× from pixel-unit heights, averaged down as vectors
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, 1, 0) - np.roll(h, -1, 0)) * 0.5             # +v up (image rows run down)
    n = np.dstack([-dx, -dy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    n1 = boxdown(n)
    n1 /= np.linalg.norm(n1, axis=2, keepdims=True)

    # colour: thin dark seam line at every plate boundary, bright lip on the higher plate's edge
    edge = np.zeros((N, N), bool)
    for sh, _c in shifts(pid):
        edge |= sh != pid
    higher = np.zeros((N, N), bool)
    for sh, _c in shifts(level):
        higher |= level > sh + 0.5
    lip = np.zeros((N, N), bool)                                   # the band just inside a higher plate's edge
    grow = edge & higher
    for _ in range(SS):
        g2 = grow.copy()
        for sh, _c in shifts(grow):
            g2 |= sh
        grow = g2 & (~edge | higher)
    lip = grow & ~edge
    cav = 0.86 * tone
    cav = np.where(lip, 1.0, cav)
    cav = np.where(edge, 0.40, cav)
    cav = np.where(feat < -1, cav * 0.86, cav)                    # vents read a touch darker
    rough = np.where(edge, 0.9, np.where(lip, 0.22, rough))       # seams dull, lips glint
    metal = np.where(edge, 0.1, metal)

    os.makedirs(os.path.join(HERE, "tex", "v2"), exist_ok=True)
    out = lambda name, a: Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(os.path.join(HERE, "tex", "v2", name))
    out("panel_normal.png", n1 * 0.5 + 0.5)
    out("panel_cavity.png", boxdown(cav))
    out("panel_rough.png", np.dstack([np.ones((OUT, OUT)), boxdown(rough), boxdown(metal)]))
    busy = sum(1 for p in plates if p[5])
    print(f"wrote tex/v2/panel_{{normal,cavity,rough}}.png — {len(plates)} plates ({len(plates) - busy} rest)")


if __name__ == "__main__":
    main()
