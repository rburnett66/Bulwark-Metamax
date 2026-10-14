import asyncio, sys, base64, io, json, os, pathlib
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
unit=sys.argv[1]; ref=sys.argv[2] if len(sys.argv)>2 else unit
VIEWS=['front','side','top','rear']
async def main():
    sizes={v: Image.open(f'ref/{ref}_{v}.png').size for v in VIEWS}
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(); logs=[]
        pg.on('console', lambda m: logs.append(m.text)); pg.on('pageerror', lambda e: logs.append('ERR '+str(e)))
        await pg.goto(pathlib.Path(os.path.abspath('src/compare.html')).as_uri()); await pg.wait_for_timeout(500)
        res=await pg.evaluate('([u,s]) => renderViews(u,s)', [unit, sizes])
        for l in logs: print(l)
        await b.close()
    tiles=[]
    for v in VIEWS:
        r=Image.open(f'ref/{ref}_{v}.png').convert('RGB')
        m=Image.open(io.BytesIO(base64.b64decode(res[v]['png'].split(',')[1]))).convert('RGB')
        ra=r.size[0]/r.size[1]; print(f'{v}: ref aspect {ra:.2f}  model {res[v]["aspect"]:.2f}')
        t=Image.new('RGB',(r.size[0]*2+10,r.size[1]),'white'); t.paste(r,(0,0)); t.paste(m,(r.size[0]+10,0)); tiles.append(t)
    # scale tiles to common height 360
    H=360; tiles=[t.resize((int(t.size[0]*H/t.size[1]),H)) for t in tiles]
    W=max(tiles[0].size[0]+tiles[1].size[0], tiles[2].size[0]+tiles[3].size[0])+10
    out=Image.new('RGB',(W,H*2+10),(230,230,230)); out.paste(tiles[0],(0,0)); out.paste(tiles[1],(tiles[0].size[0]+10,0)); out.paste(tiles[2],(0,H+10)); out.paste(tiles[3],(tiles[2].size[0]+10,H+10))
    out.save(f'cmp_{unit}.png'); print('saved', out.size)
asyncio.run(main())
