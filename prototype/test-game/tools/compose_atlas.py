#!/usr/bin/env python3
"""
compose_atlas.py — compose a sprite atlas LOCALLY from individual frame PNGs.

Why: the MetaMax local bridge caps request bodies at ~2 MiB, so a finished atlas can't be pushed
through it — but individual FRAMES (tens of KB each) pass easily. Flow:

  1. MetaMax (web) writes frames through the bridge into  content/sprite-atlas/incoming/<sheet>/
  2. This script packs them:   python tools/compose_atlas.py <sheet>
  3. Output lands as           content/sprite-atlas/<sheet>.png + <sheet>.json
     (TexturePacker-style JSON — the exact format unitArt.js / Terrain Forge already load)

Usage, from prototype/test-game/:
  python tools/compose_atlas.py terrain-tiles                # incoming/terrain-tiles → terrain-tiles.png/.json
  python tools/compose_atlas.py terrain-tiles --pad 2        # padding px between frames (default 1)
  python tools/compose_atlas.py path/to/frames --name foo    # any input folder, explicit sheet name

Deterministic: frames packed tallest-first, name as tiebreak — same input, same atlas, clean diffs.
"""
import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow is required:  pip install Pillow')

MAX_W = 2048  # atlas width cap; shelves wrap under it


def pack(frames, pad):
    """Shelf-pack: sort tallest first (name tiebreak), fill rows up to MAX_W. Returns (places, W, H)."""
    order = sorted(frames, key=lambda f: (-f[1].height, f[0]))
    places, x, y, row_h, atlas_w = [], pad, pad, 0, 0
    for name, im in order:
        w, h = im.width, im.height
        if x + w + pad > MAX_W and x > pad:          # wrap to a new shelf
            x, y, row_h = pad, y + row_h + pad, 0
        places.append((name, im, x, y))
        x += w + pad
        row_h = max(row_h, h)
        atlas_w = max(atlas_w, x)
    return places, atlas_w, y + row_h + pad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet', help='sheet name under content/sprite-atlas/incoming/, or any folder path')
    ap.add_argument('--name', help='output sheet name (default: the input folder name)')
    ap.add_argument('--pad', type=int, default=1, help='padding px between frames (default 1)')
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]        # prototype/test-game/
    src = Path(args.sheet)
    if not src.is_dir():
        src = root / 'content' / 'sprite-atlas' / 'incoming' / args.sheet
    if not src.is_dir():
        sys.exit(f'no such frame folder: {src}')
    name = args.name or src.name
    out_dir = root / 'content' / 'sprite-atlas'

    pngs = sorted(src.glob('*.png'))
    if not pngs:
        sys.exit(f'no .png frames in {src}')
    frames = [(p.name, Image.open(p).convert('RGBA')) for p in pngs]

    places, W, H = pack(frames, args.pad)
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    entries = {}
    for fname, im, x, y in places:
        atlas.paste(im, (x, y))
        entries[fname] = {
            'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height},
            'rotated': False, 'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height},
            'sourceSize': {'w': im.width, 'h': im.height},
        }

    atlas.save(out_dir / f'{name}.png', optimize=True)
    doc = {'frames': entries,
           'meta': {'app': 'compose_atlas.py', 'image': f'{name}.png',
                    'size': {'w': W, 'h': H}, 'scale': '1'}}
    (out_dir / f'{name}.json').write_text(json.dumps(doc, indent=1), encoding='utf-8')
    kb = (out_dir / f'{name}.png').stat().st_size / 1024
    print(f'{name}: {len(entries)} frames -> {W}x{H} ({kb:.0f} KB) at {out_dir / name}.png/.json')


if __name__ == '__main__':
    main()
