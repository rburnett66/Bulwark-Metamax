# Builds the standalone review page for the landing craft: dist/landing-craft.html (one file, open in any browser).
# Inlines the shared part-list builder (../next/prims.js), the unit roster (../next/models.js — for SYS-Harvester,
# which rolls out of the hatches) and models.js. three.js r128 loads from cdnjs. Pass --offline to inline a local
# three.min.js too (node_modules/three/build/three.min.js after `npm install`).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
def first(*ps):
    for p in ps:
        if os.path.exists(p): return open(p, encoding='utf-8').read()
    raise SystemExit('missing: ' + ' / '.join(ps))
prims = first('../next/prims.js', 'prims.js')
units = first('../next/models.js', 'next-models.js', '../../next-models.js')
s = open('viewer.html', encoding='utf-8').read()
s = s.replace('/*__PRIMS__*/', prims).replace('/*__UNITS__*/', units).replace('/*__CRAFT__*/', open('models.js', encoding='utf-8').read())
if '--offline' in sys.argv:
    three = first('../../../../../node_modules/three/build/three.min.js', '../node_modules/three/build/three.min.js')
    s = s.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', '<script>' + three + '</script>')
os.makedirs('dist', exist_ok=True)
out = 'dist/landing-craft' + ('-offline' if '--offline' in sys.argv else '') + '.html'
open(out, 'w', encoding='utf-8').write(s); print(out, len(s) // 1024, 'KB')
