import asyncio, sys, os, pathlib
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright
three=open('../../../../node_modules/three/build/three.min.js', encoding='utf-8').read()  # repo-root `npm install`
html=open('dist/unit-models.html', encoding='utf-8').read().replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>','<script>'+three+'</script>')
import re; html=re.sub(r'<link rel="(preconnect|stylesheet)"[^>]*>','',html)
open('dist/test.html','w', encoding='utf-8').write(html)
async def main(shots):
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':1400,'height':860}); logs=[]
        pg.on('console', lambda m: logs.append(m.text)); pg.on('pageerror', lambda e: logs.append('ERR '+str(e)))
        await pg.goto(pathlib.Path(os.path.abspath('dist/test.html')).as_uri()); await pg.wait_for_timeout(1500)
        for u,s,v in shots:
            await pg.evaluate('([u,s,v])=>__setView(u,s,v)',[u,s,v]); await pg.wait_for_timeout(1800)
            await pg.screenshot(path=f'shot_{u}_{s}_{v}.png')
        for l in logs[:10]: print(l)
        await b.close()
shots=[tuple(a.split(',')) for a in sys.argv[1:]]
asyncio.run(main(shots))
