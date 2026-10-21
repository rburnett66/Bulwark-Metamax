#!/usr/bin/env python3
"""tools/unit-models/field.py — every faction's units on open ground through the game's unit renderer, live shadows on.
   python3 tools/unit-models/field.py <out.png> [camDist]   [MM-story_mvibvqd2_7]"""
import asyncio, base64, functools, io, os, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); out = sys.argv[1]; dist = float(sys.argv[2]) if len(sys.argv) > 2 else 18
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
async def main():
    root = os.path.abspath(os.path.join(HERE, '../..'))
    srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=root)); threading.Thread(target=srv.serve_forever, daemon=True).start()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(); logs = []; pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/tools/unit-models/src/field.html?{os.getpid()}')
        await pg.wait_for_function('window.ready === true', timeout=20000)
        res = [(f, await pg.evaluate('([f, d]) => field(f, d, 800)', [f, dist])) for f in ['air_', 'siege_', 'arcane_', 'space_']]
        for l in logs: print(l)
        await b.close(); srv.shutdown()
    ims = [(f, r, Image.open(io.BytesIO(base64.b64decode(r['png'].split(',', 1)[1]))).convert('RGB')) for f, r in res]
    W, H = ims[0][2].size; sheet = Image.new('RGB', (W * 2, (H + 22) * 2), (240, 240, 240)); d = ImageDraw.Draw(sheet)
    for i, (f, r, im) in enumerate(ims):
        x, y = (i % 2) * W, (i // 2) * (H + 22)
        d.text((x + 6, y + 5), f"{f[:-1]}: shadows {r['shadowTris']} tris (was {r['lodTris']}) | frame {r['triangles']} tris, {r['drawCalls']} draws", fill=(0, 0, 0))
        sheet.paste(im, (x, y + 22))
    sheet.save(out); print(out)
asyncio.run(main())
