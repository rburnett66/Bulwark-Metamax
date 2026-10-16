# Builds the standalone review page for the NEXT unit models (three-part base / weapon / head, System
# defenses, King Tiger). Output: tools/unit-models/dist/unit-models-next.html (dist/ is gitignored).
# These sources are not yet the game's: src/render3d/units/{prims,models}.js stay the ONE runtime source
# until the HEAD story ports them (models3d.js must learn base/weapon/head). [MM-story_mva2f3vg_9]
import base64, glob, json, os
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
os.makedirs('../dist', exist_ok=True)
s = open('viewer.html', encoding='utf-8').read()
refs = {os.path.basename(f)[len('sheet_'):-4]: 'data:image/jpeg;base64,' + base64.b64encode(open(f, 'rb').read()).decode()
        for f in sorted(glob.glob('../ref/sheet_*.jpg'))}
s = (s.replace('/*__PRIMS__*/', open('prims.js', encoding='utf-8').read())
      .replace('/*__MODELS__*/', open('models.js', encoding='utf-8').read())
      .replace('/*__REFS__*/{}', json.dumps(refs)))
open('../dist/unit-models-next.html', 'w', encoding='utf-8').write(s); print(len(s) // 1024, 'KB')
