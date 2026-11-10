"""Inline the GLBs and the game's crew rig into the standalone page:
    python make_page.py <glb_dir> <template> <out.html> [crew.js]
crew.js defaults to this repo's prototype/test-game/src/ship-interior/crew.js (the capital ship's avatars).
Typical run, from the repo root:
    python tools/blender/farming/build_farm_models.py -- /tmp/farm_glb      (or blender -b -P ... -- /tmp/farm_glb)
    python tools/blender/farming/make_page.py /tmp/farm_glb tools/blender/farming/scale_template.html \
        prototype/test-game/tools/farming/scale.html"""
import base64, json, os, re, sys
glb_dir, tpl, out = sys.argv[1:4]
crew = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'prototype',
                                                              'test-game', 'src', 'ship-interior', 'crew.js')
models = {f[:-4]: base64.b64encode(open(os.path.join(glb_dir, f), 'rb').read()).decode()
          for f in sorted(os.listdir(glb_dir)) if f.endswith('.glb')}
crew_src = re.sub(r'^export ', '', open(crew).read(), flags=re.M)
html = open(tpl).read().replace('/*__MODELS__*/null', json.dumps(models)).replace('/*__CREW__*/', crew_src)
open(out, 'w').write(html)
print(out, os.path.getsize(out) // 1024, 'KB')
