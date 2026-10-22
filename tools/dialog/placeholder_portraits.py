#!/usr/bin/env python3
"""tools/dialog/placeholder_portraits.py — a named stand-in portrait for every dialog character with no art
[MM-task_mviw09lz_b].

Owner 2026-10-21: "can we make dummy images for the missing portraits? give them the character names so we can
fix them later". The comm card looks up content/dialog/portraits/<slug(name)>.png (commCard.portraitSlug) and
falls back to a silhouette on a 404. This writes a faction-tinted 864x1152 PNG (the size of the real portraits)
for each voicepack character that has none: the character's name, faction and alignment, and a PLACEHOLDER tag,
all inside the centre square the card's cover-crop shows.

It NEVER overwrites: a file that exists is real art (or a placeholder already made) and is left alone. To swap in
real art, drop the finished PNG over the placeholder with the same file name. To list what is still a
placeholder:  python tools/dialog/placeholder_portraits.py --list

Run from the repo root:  python tools/dialog/placeholder_portraits.py
"""
import json
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'prototype', 'test-game')
VOICEPACKS = os.path.join(ROOT, 'content', 'dialog', 'voicepacks.json')
OUT = os.path.join(ROOT, 'content', 'dialog', 'portraits')
MARK = 'bulwark-placeholder'          # stored in the PNG text chunk, so --list can tell placeholders from art
W, H = 864, 1152

# faction tint (0..255): the impact-FX hues (src/render3d/fx/factionFx.js); Ground has none there, so steel khaki
TINT = {
    'ground': (176, 160, 120), 'air': (89, 158, 255), 'hightech': (26, 230, 255), 'artillery': (255, 184, 26),
    'water': (26, 217, 184), 'arcane': (255, 46, 13), 'space': (255, 38, 199), 'dark': (140, 38, 255),
    'greenies': (102, 255, 20),
}
ALIGN = {'AG': 'Ascendant Good', 'PG': 'Principled Good', 'G': 'Good', 'CG': 'Chaotic Good', 'N': 'Neutral',
         'CE': 'Chaotic Evil', 'E': 'Evil', 'PE': 'Principled Evil', 'DE': 'Dread Evil'}

FONT_DIRS = ['/usr/share/fonts/truetype/dejavu', 'C:/Windows/Fonts', '/Library/Fonts', '/System/Library/Fonts']


def font(names, size):
    for d in FONT_DIRS:
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)


BOLD = ['DejaVuSansCondensed-Bold.ttf', 'arialbd.ttf', 'Arial Bold.ttf']
MONO = ['DejaVuSansMono.ttf', 'consola.ttf', 'Menlo.ttc']


def slug(name):   # == commCard.portraitSlug
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', name, flags=re.I)).lower()


def mix(a, b, k):
    return tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3))


def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=f) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    return lines + ([cur] if cur else [])


def fit_name(draw, name, width, max_lines=3, max_h=236):
    for size in range(92, 40, -4):
        f = font(BOLD, size)
        lines = wrap(draw, name, f, width)
        fits = len(lines) <= max_lines and len(lines) * size * 1.08 <= max_h
        if fits and all(draw.textlength(l, font=f) <= width for l in lines):
            return f, lines
    f = font(BOLD, 44)
    return f, wrap(draw, name, f, width)


def portrait(name, faction_key, faction_name, align, gender):
    tint = TINT.get(faction_key, (150, 160, 170))
    ink, bg0 = (6, 10, 15), (12, 17, 24)
    im = Image.new('RGB', (W, H), bg0)
    px = im.load()
    for y in range(H):   # vertical glow: faction tint behind the head, falling to near-black
        for x in range(0, W, 4):
            d = ((x - W / 2) / (W * 0.55)) ** 2 + ((y - H * 0.36) / (H * 0.42)) ** 2
            c = mix(ink, tint, max(0.0, 0.34 * (1 - d)))
            for k in range(4):
                px[x + k, y] = c
    dr = ImageDraw.Draw(im)
    grid = mix(ink, tint, 0.12)
    for g in range(0, W, 48):
        dr.line([(g, 0), (g, H)], fill=grid)
    for g in range(0, H, 48):
        dr.line([(0, g), (W, g)], fill=grid)

    # generic bust silhouette (no likeness — it is a stand-in), centred in the visible square (y 144..1008)
    sil = mix(ink, tint, 0.55)
    cx, hy = W // 2, 330
    dr.ellipse([cx - 230, 490, cx + 230, 830], fill=sil)            # shoulders
    dr.rectangle([cx - 70, 410, cx + 70, 530], fill=sil)            # neck
    dr.ellipse([cx - 120, hy - 150, cx + 120, hy + 140], fill=sil)  # head
    # the lower band carries the text over a dark plate so it reads at the card's thumbnail size
    plate = Image.new('RGBA', (W, H - 570), (6, 10, 15, 215))
    im.paste(plate, (0, 570), plate)
    dr = ImageDraw.Draw(im)
    dr.line([(0, 570), (W, 570)], fill=tint, width=6)

    pad = 56
    small = font(MONO, 30)
    dr.text((pad, 590), (faction_name or faction_key).upper(), font=small, fill=tint)
    a = ALIGN.get(align, align or '')
    if a:
        dr.text((W - pad - dr.textlength(a.upper(), font=small), 590), a.upper(), font=small, fill=mix(tint, (255, 255, 255), 0.4))
    f, lines = fit_name(dr, name, W - 2 * pad)
    lh = int(f.size * 1.08)
    y = 640 + (236 - len(lines) * lh) // 2   # name block: y 640..876, centred
    for ln in lines:
        dr.text((pad, y), ln, font=f, fill=(238, 244, 248))
        y += lh
    # tag
    tag = font(BOLD, 34)
    t = 'PLACEHOLDER · ART NEEDED'
    tw = dr.textlength(t, font=tag)
    dr.rectangle([pad - 12, 900, pad + tw + 12, 948], fill=tint)   # stays inside the card's square crop (y 144..1008)
    dr.text((pad, 904), t, font=tag, fill=ink)
    return im


def is_placeholder(path):
    try:
        return Image.open(path).text.get('source') == MARK
    except Exception:
        return False


def main():
    data = json.load(open(VOICEPACKS, encoding='utf-8'))
    chars = [(fk, f.get('name'), c) for fk, f in data['factions'].items() for c in f.get('characters', [])]
    if '--list' in sys.argv:
        for fk, fname, c in chars:
            p = os.path.join(OUT, slug(c['name']) + '.png')
            state = 'MISSING' if not os.path.exists(p) else ('placeholder' if is_placeholder(p) else 'art')
            print(f'{state:12} {fk:10} {c["name"]}  ->  {slug(c["name"])}.png')
        return
    from PIL import PngImagePlugin
    made = 0
    for fk, fname, c in chars:
        p = os.path.join(OUT, slug(c['name']) + '.png')
        if os.path.exists(p):
            continue
        im = portrait(c['name'], fk, fname, c.get('align'), c.get('gender'))
        meta = PngImagePlugin.PngInfo()
        meta.add_text('source', MARK)
        meta.add_text('character', c['name'])
        im.quantize(colors=96, method=Image.Quantize.MEDIANCUT).save(p, pnginfo=meta, optimize=True)
        made += 1
        print('wrote', os.path.relpath(p, ROOT))
    print(f'{made} placeholder(s) written; {len(chars) - made} character(s) already had a portrait.')


if __name__ == '__main__':
    main()
