#!/usr/bin/env python3
"""tools/unit-models/shadows.py — old (LOD) vs new (proxy) planar shadow for every model of a faction, one sheet.
   python3 tools/unit-models/shadows.py <prefix|all> <out.png>      e.g. arcane_  [MM-story_mvibvqd2_7]"""
import asyncio, base64, functools, io, os, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
prefix, out = sys.argv[1], sys.argv[2]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

async def main():
    root = os.path.abspath(os.path.join(HERE, '../..'))
    srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(); logs = []
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/tools/unit-models/src/shadow.html?{os.getpid()}')
        await pg.wait_for_function('window.ready === true', timeout=20000)
        keys = await pg.evaluate("import('../../../src/render3d/units/models.js').then(m => Object.keys(m.UNIT_MODELS))")
        keys = [k for k in keys if prefix == 'all' or k.startswith(prefix)]
        res = [(k, await pg.evaluate('k => shadows(k, 300)', k)) for k in keys]
        for l in logs: print(l)
        await b.close(); srv.shutdown()
    img = lambda d: Image.open(io.BytesIO(base64.b64decode(d.split(',', 1)[1]))).convert('RGB')
    T, cols = 300, 2
    rows = (len(res) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 2 * T, rows * (T + 22)), (240, 240, 240)); d = ImageDraw.Draw(sheet)
    for i, (k, r) in enumerate(res):
        x, y = (i % cols) * 2 * T, (i // cols) * (T + 22)
        d.text((x + 6, y + 5), f"{k}   old {r['tris']['lod']} tris | new {r['tris']['proxy']} tris", fill=(0, 0, 0))
        sheet.paste(img(r['lod']), (x, y + 22)); sheet.paste(img(r['proxy']), (x + T, y + 22))
    sheet.save(out); print(len(res), 'models ->', out)

asyncio.run(main())
