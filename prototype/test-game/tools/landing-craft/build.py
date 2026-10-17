# Builds the two standalone review pages from the GAME's own modules (no copies):
#   dist/landing-craft.html — the ten crafts + the landing sequence (render3d/craft/*)
#   dist/resources.html     — the 36 planet resource models (render3d/resources/*)
# Open either file in any browser (three.js r128 loads from cdnjs; --offline inlines a local copy).
# Usage: python tools/landing-craft/build.py [--offline]      [MM-epic_mvbkrvnz_2]
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from bundle import bundle
GAME = os.path.abspath(os.path.join(HERE, '..', '..'))
src = lambda *p: os.path.join(GAME, 'src', *p)

CRAFT = [src('render3d', 'units', 'metal.js'), src('render3d', 'units', 'material.js'), src('render3d', 'units', 'prims.js'),
         src('render3d', 'units', 'models.js'), src('render3d', 'obstructions', 'placement.js'), src('render3d', 'ground', 'lowpoly.js'),
         src('render3d', 'styles', 'lowpoly-palettes.js'),
         src('render3d', 'craft', 'models.js'), src('render3d', 'craft', 'landing.js'), src('render3d', 'craft', 'landingFx.js'), src('render3d', 'craft', 'craft3d.js')]
RES = [src('render3d', 'units', 'metal.js'), src('render3d', 'units', 'prims.js'), src('data', 'planets.js'),
       src('render3d', 'obstructions', 'placement.js'), src('render3d', 'ground', 'lowpoly.js'), src('render3d', 'structures', 'models.js'),
       src('render3d', 'styles', 'lowpoly-palettes.js'), src('render3d', 'resources', 'models.js'), src('render3d', 'resources', 'resources3d.js')]

CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
os.makedirs(os.path.join(HERE, 'dist'), exist_ok=True)
for page, mods, out in [('craft.html', CRAFT, 'landing-craft.html'), ('resources.html', RES, 'resources.html')]:
    html = open(os.path.join(HERE, page), encoding='utf-8').read().replace('/*__BUNDLE__*/', bundle(mods))
    if '--offline' in sys.argv:
        for p in [os.path.join(GAME, 'vendor', 'three.min.js'), os.path.join(GAME, '..', '..', 'node_modules', 'three', 'build', 'three.min.js')]:
            if os.path.exists(p):
                html = html.replace(CDN, '<script>' + open(p, encoding='utf-8').read() + '</script>'); break
        else:
            sys.exit('--offline: no three.min.js found (npm install at the repo root)')
        out = out.replace('.html', '-offline.html')
    open(os.path.join(HERE, 'dist', out), 'w', encoding='utf-8').write(html)
    print('dist/' + out, len(html) // 1024, 'KB')
