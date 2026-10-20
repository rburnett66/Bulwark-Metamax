"""tools/unit-models/look.py — a model beside its concept image [MM-story_mvh8woji_1].

  python3 tools/unit-models/look.py <modelKey> <ref.png> [yaw] [elev] [out.png]

Renders the model the way the game lights it (src/look.html) as a three-quarter hero at yaw/elev, plus top/side/front
orthographic views, and lays them out as: concept | hero | (top / side / front). Prints the model's size (x, y, z).
"""
import asyncio, base64, functools, io, os, sys, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
key, ref = sys.argv[1], sys.argv[2]
yaw = float(sys.argv[3]) if len(sys.argv) > 3 else 35
elev = float(sys.argv[4]) if len(sys.argv) > 4 else 30
out = sys.argv[5] if len(sys.argv) > 5 else f'look_{key}.png'

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

async def main():
    root = os.path.abspath(os.path.join(HERE, '../..'))
    srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(); logs = []
        pg.on('console', lambda m: logs.append(m.text)); pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/tools/unit-models/src/look.html?{os.getpid()}')
        try:
            await pg.wait_for_function('window.ready === true', timeout=20000)
            res = await pg.evaluate('([k, y, e]) => look(k, y, e, 512)', [key, yaw, elev])
        finally:
            for l in logs: print(l)
            await b.close(); srv.shutdown()
    img = lambda d: Image.open(io.BytesIO(base64.b64decode(d.split(',', 1)[1]))).convert('RGB')
    refim = Image.open(ref).convert('RGBA'); bg = Image.new('RGBA', refim.size, (255, 255, 255, 255)); bg.alpha_composite(refim)
    refim = bg.convert('RGB').resize((512, 512))
    sheet = Image.new('RGB', (512 * 2 + 256 * 2, 512 + 24), (235, 235, 235)); d = ImageDraw.Draw(sheet)
    sheet.paste(refim, (0, 24)); sheet.paste(img(res['hero']), (512, 24))
    sheet.paste(img(res['top']), (1024, 24)); sheet.paste(img(res['side']), (1280, 24)); sheet.paste(img(res['front']), (1024, 24 + 256))
    for x, t in [(4, 'concept'), (516, f'model {key}  yaw {yaw:g} elev {elev:g}'), (1028, 'top'), (1284, 'side'), (1028 + 0, '')]: d.text((x, 6), t, fill=(0, 0, 0))
    d.text((1028, 24 + 258), 'front', fill=(0, 0, 0))
    sheet.save(out)
    print('size xyz', res['size'], 'cam', res.get('debug'), '->', out)

asyncio.run(main())
