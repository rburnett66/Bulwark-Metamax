import base64, json, os
os.chdir(os.path.dirname(os.path.abspath(__file__))); os.makedirs('dist', exist_ok=True)  # dist/ is gitignored
s=open('src/viewer.html', encoding='utf-8').read()
refs={k:'data:image/jpeg;base64,'+base64.b64encode(open(f'ref/sheet_{k}.jpg','rb').read()).decode() for k in ['tank','buggy','beetle','jet']}
# ONE source: src/render3d/units/{prims,models}.js — classic.mjs strips import/export and binds Prims/UNIT_MODELS
import subprocess
part = lambda w: subprocess.run(['node', 'classic.mjs', w], capture_output=True, text=True, encoding='utf-8', check=True).stdout
s=s.replace('/*__PRIMS__*/', part('prims')).replace('/*__MODELS__*/', part('models')).replace('/*__REFS__*/{}', json.dumps(refs))
open('dist/unit-models.html','w', encoding='utf-8').write(s); print(len(s)//1024,'KB')
