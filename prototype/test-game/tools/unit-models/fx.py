#!/usr/bin/env python3
"""tools/unit-models/fx.py — impact effects per faction (a tank kill + hits on a second tank), side by side.
   python3 tools/unit-models/fx.py <out.png> [t seconds] [PREFIX ...]   [MM-story_mviqruvd_2]"""
import asyncio, base64, functools, io, os, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); out = sys.argv[1]; t = float(sys.argv[2]) if len(sys.argv) > 2 else 0.3
pre = sys.argv[3:] or ['GND', 'DRK', 'SPC', 'ARC', 'GRN', 'HTC']
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
async def main():
    root = os.path.abspath(os.path.join(HERE, '../..'))
    srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=root)); threading.Thread(target=srv.serve_forever, daemon=True).start()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(); logs = []; pg.on('pageerror', lambda e: logs.append('ERR ' + str(e))); pg.on('console', lambda m: m.type == 'error' and logs.append(m.text))
        await pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/tools/unit-models/src/fx.html?{os.getpid()}')
        await pg.wait_for_function('window.ready === true', timeout=20000)
        res = [(f, await pg.evaluate('([f, t]) => fx(f, t, 420)', [f, t])) for f in pre]
        for l in logs[:5]: print(l)
        await b.close(); srv.shutdown()
    W = 420; cols = 3; rows = (len(res) + cols - 1) // cols
    sheet = Image.new('RGB', (W * cols, (W + 22) * rows), (240, 240, 240)); d = ImageDraw.Draw(sheet)
    for i, (f, u) in enumerate(res):
        x, y = (i % cols) * W, (i // cols) * (W + 22)
        d.text((x + 6, y + 5), f"{f}  ({t:g}s after the kill)", fill=(0, 0, 0))
        sheet.paste(Image.open(io.BytesIO(base64.b64decode(u.split(',', 1)[1]))).convert('RGB'), (x, y + 22))
    sheet.save(out); print(out)
asyncio.run(main())
