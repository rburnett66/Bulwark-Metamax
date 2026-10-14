import base64, json, os
os.chdir(os.path.dirname(os.path.abspath(__file__))); os.makedirs('dist', exist_ok=True)  # dist/ is gitignored
s=open('src/viewer.html', encoding='utf-8').read()
refs={k:'data:image/jpeg;base64,'+base64.b64encode(open(f'ref/sheet_{k}.jpg','rb').read()).decode() for k in ['tank','buggy','beetle','jet']}
s=s.replace('/*__PRIMS__*/', open('src/prims.js', encoding='utf-8').read()).replace('/*__MODELS__*/', open('src/models.js', encoding='utf-8').read()).replace('/*__REFS__*/{}', json.dumps(refs))
open('dist/unit-models.html','w', encoding='utf-8').write(s); print(len(s)//1024,'KB')
