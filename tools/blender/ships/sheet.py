"""Compose a review sheet: the Grok reference beside the four renders.  [MM-story_mvzrzcjh_1z]
    python3 tools/blender/ships/sheet.py <slug> [out_dir]
"""
import os, sys
from PIL import Image, ImageDraw
slug = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(here, "out", slug)
W, H = 960, 540
tiles = [("Grok reference", os.path.join(here, "ref", f"{slug}.jpg"))] + \
        [(v, os.path.join(out, f"{slug}_{v}.png")) for v in ("hero", "side", "top", "rear")]
sheet = Image.new("RGB", (W * 3, H * 2), (6, 7, 12))
d = ImageDraw.Draw(sheet)
for i, (label, p) in enumerate(tiles):
    im = Image.open(p).convert("RGB")
    im.thumbnail((W, H))
    x, y = (i % 3) * W, (i // 3) * H
    sheet.paste(im, (x + (W - im.width) // 2, y + (H - im.height) // 2))
    d.text((x + 12, y + 10), label, fill=(200, 210, 230))
sheet.save(os.path.join(out, f"{slug}_sheet.jpg"), quality=86)
print(os.path.join(out, f"{slug}_sheet.jpg"))
