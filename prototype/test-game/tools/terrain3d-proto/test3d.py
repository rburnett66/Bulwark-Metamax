import asyncio, sys, re, os, pathlib
os.chdir(os.path.dirname(os.path.abspath(__file__)))  # run from this folder; needs `npm install` at the repo root (three@0.128.0)
os.makedirs('out3d', exist_ok=True)  # screenshots: gitignored scratch
from playwright.async_api import async_playwright
html = open('dist/terrain-proto-3d.html', encoding='utf-8').read()
three = open('../../../../node_modules/three/build/three.min.js', encoding='utf-8').read()  # repo-root node_modules
html = html.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', '<script>' + three + '</script>')
html = re.sub(r'<link rel="(preconnect|stylesheet)"[^>]*>', '', html)
page_html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + '</body></html>'
open('dist/test3d.html','w', encoding='utf-8').write(page_html)
async def run(w, h, name, mobile=False, actions=None, wait=6000):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if mobile else 1, has_touch=mobile, is_mobile=mobile)
        pg = await ctx.new_page()
        logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await pg.goto(pathlib.Path(os.path.abspath('dist/test3d.html')).as_uri())
        await pg.wait_for_timeout(wait)
        if actions: await actions(pg)
        await pg.screenshot(path=f'out3d/shot_{name}.png')
        stats = await pg.evaluate("() => ['sFps','sMs','sCalls','sTris','sUnits','sProj','sLines','sTier','sPhase','sStyle'].map(i=>i+'='+document.getElementById(i).textContent).join(' | ')")
        print(name, stats)
        for l in logs[:15]: print('  ', l)
        await b.close()
async def stress(pg):
    await pg.click('#stress'); await pg.wait_for_timeout(7000)



async def placing(pg):
    await pg.click('#mWall')
    await pg.mouse.move(640, 600); await pg.mouse.move(645, 603); await pg.wait_for_timeout(400)
    await pg.screenshot(path='out3d/shot_ghost.png')
    await pg.mouse.click(645, 603); await pg.wait_for_timeout(1500)
    t = await pg.evaluate("() => [document.getElementById('gold').textContent, document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent]")
    print('after click', t)
which = sys.argv[1] if len(sys.argv) > 1 else 'desk'
if which == 'desk': asyncio.run(run(1400, 860, 'desk', wait=5000))
if which == 'stress': asyncio.run(run(1400, 860, 'stress', actions=stress, wait=4000))
if which == 'place': asyncio.run(run(1400, 860, 'place', actions=placing, wait=3000))
if which == 'phone': asyncio.run(run(390, 844, 'phone', mobile=True))
async def zoom(pg):
    await pg.mouse.move(900, 450)
    for _ in range(6): await pg.mouse.wheel(0, -200); await pg.wait_for_timeout(60)
    await pg.wait_for_timeout(2500)
async def day(pg):
    await pg.select_option('#styleSel', 'day'); await pg.wait_for_timeout(1500)
if which == 'zoom': asyncio.run(run(1400, 860, 'zoom', actions=zoom, wait=4000))
if which == 'day': asyncio.run(run(1400, 860, 'day', actions=day, wait=4000))
if which.startswith('style:'):
    st = which.split(':')[1]
    async def sty(pg):
        await pg.select_option('#styleSel', st); await pg.wait_for_timeout(2500)
    asyncio.run(run(1400, 860, 'style_' + st, actions=sty, wait=4000))
if which == 'lpzoom':
    async def a(pg):
        await pg.select_option('#styleSel', 'lowpoly'); await pg.wait_for_timeout(800)
        await pg.mouse.move(700, 300)
        for _ in range(5): await pg.mouse.wheel(0, -200); await pg.wait_for_timeout(60)
        await pg.wait_for_timeout(2500)
    asyncio.run(run(1400, 860, 'lpzoom', actions=a, wait=4000))
if which in ('max', 'maxsprite', 'maxneon', 'maxfull'):
    async def a(pg):
        if which == 'maxsprite': await pg.select_option('#unitSel', 'sprite')
        if which == 'maxneon': await pg.select_option('#styleSel', 'neon')
        if which == 'maxfull': await pg.select_option('#unitSel', '3d-full')
        await pg.click('#maxUnits'); await pg.wait_for_timeout(14000)
    asyncio.run(run(1400, 860, which, actions=a, wait=3000))
if which == 'unitzoom':
    async def a(pg):
        await pg.click('#maxUnits'); await pg.wait_for_timeout(9000)
        await pg.mouse.move(700, 450)
        for _ in range(6): await pg.mouse.wheel(0, -200); await pg.wait_for_timeout(60)
        await pg.mouse.move(400, 450); await pg.mouse.down(); await pg.mouse.move(700, 430, steps=8); await pg.mouse.move(1000, 420, steps=8); await pg.mouse.up()
        await pg.wait_for_timeout(2000)
    asyncio.run(run(1400, 860, 'unitzoom', actions=a, wait=3000))
if which == 'allpal':
    keys = ['lowpoly','lp_autumn','lp_winter','lp_canyon','lp_tropical','lp_sakura','lp_dusk','lp_volcanic','lp_alien','lp_highlands','lp_lunar','lp_savanna']
    async def go():
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            pg = await b.new_page(viewport={'width': 1200, 'height': 760}); logs = []
            pg.on('pageerror', lambda e: logs.append(str(e))); pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' else None)
            await pg.goto(pathlib.Path(os.path.abspath('dist/test3d.html')).as_uri()); await pg.wait_for_timeout(5000)
            for k in keys:
                await pg.select_option('#styleSel', k); await pg.wait_for_timeout(1800)
                await pg.screenshot(path=f'out3d/pal_{k}.png')
            print(logs[:5]); await b.close()
    asyncio.run(go())
if which in ('boom', 'boomsteps'):
    async def a(pg):
        await pg.wait_for_timeout(1500)
        await pg.mouse.move(700, 450)
        for _ in range(6): await pg.mouse.wheel(0, -200); await pg.wait_for_timeout(60)
        await pg.wait_for_timeout(800)
        await pg.click('#detonate')
        marks = [1500, 3500, 3900, 4500, 5400, 7000, 9500]
        prev = 0
        for i, t in enumerate(marks):
            await pg.wait_for_timeout(t - prev); prev = t
            await pg.screenshot(path=f'out3d/boom_{i}.png')
    asyncio.run(run(1400, 860, 'boom', actions=a, wait=3000))
if which == 'metal':
    async def go():
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            pg = await b.new_page(viewport={'width': 1200, 'height': 760}); logs = []
            pg.on('pageerror', lambda e: logs.append(str(e))); pg.on('console', lambda m: logs.append(m.text) if m.type == 'error' else None)
            await pg.goto(pathlib.Path(os.path.abspath('dist/test3d.html')).as_uri()); await pg.wait_for_timeout(4000)
            await pg.mouse.move(600, 380)
            for _ in range(7): await pg.mouse.wheel(0, -200); await pg.wait_for_timeout(60)
            await pg.wait_for_timeout(1500); await pg.evaluate("() => window.__showroom()"); await pg.wait_for_timeout(800)
            for st in ['lowpoly', 'lp_dusk', 'neon']:
                await pg.select_option('#styleSel', st); await pg.wait_for_timeout(1500)
                await pg.evaluate("() => { const c=document.getElementById('metalChk'); c.checked=true; c.dispatchEvent(new Event('change')); }")
                await pg.wait_for_timeout(300); await pg.screenshot(path=f'out3d/metal_{st}_on.png')
                await pg.evaluate("() => { const c=document.getElementById('metalChk'); c.checked=false; c.dispatchEvent(new Event('change')); }")
                await pg.wait_for_timeout(300); await pg.screenshot(path=f'out3d/metal_{st}_off.png')
            print(logs[:8]); await b.close()
    asyncio.run(go())
