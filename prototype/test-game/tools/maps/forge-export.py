# Drive the real Terrain Forge (terrain.html) headlessly: load knobs, let it render (terrain, base, resources, spawns,
# decor groves), and take exportObj() — exactly what "Export slot file" writes.
import asyncio, json, sys, functools, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.async_api import async_playwright
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
jobs = json.load(open(sys.argv[1])); out = sys.argv[2]
class Q(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
async def main():
    srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{srv.server_address[1]}'
    html = open(ROOT + '/terrain.html').read()
    i = html.index('<script type="module">'); j = html.index('</script>', i)
    html = html[:j] + '\nwindow.__forge = { loadState, exportObj, render, decorTypes: () => Object.keys(decorCatalog).length };\n' + html[j:]
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/terrain.html', lambda r: r.fulfill(status=200, content_type='text/html', body=html))
        await pg.goto(base + '/terrain.html')
        await pg.wait_for_function('window.__forge && window.__forge.decorTypes() > 0', timeout=30000)
        res = {}
        for name, st in jobs.items():
            res[name] = await pg.evaluate('(st) => { __forge.loadState(st); __forge.render(); return __forge.exportObj(); }', st)
        json.dump(res, open(out, 'w'))
        print('exported', list(res), 'errors', errs[:3])
        await b.close(); srv.shutdown()
asyncio.run(main())
