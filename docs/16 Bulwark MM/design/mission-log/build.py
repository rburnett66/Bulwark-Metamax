# Builds the standalone Mission Log design page (MLG-1): mission-log.src.html with the giver portraits
# (from the game's content/dialog/portraits) and the main-screen backdrop inlined. Output: Mission-Log-Design.html
# next to this file — one self-contained page, open it in any browser. [MM-story_mvyqojad_c]
import base64, io, json, os, re
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
PORTRAITS = os.path.join(HERE, '../../../../prototype/test-game/content/dialog/portraits')
src = open('mission-log.src.html', encoding='utf-8').read()
ids = sorted(set(re.findall(r"id:'([a-z0-9-]+)',name:", src)))
out = {}
for pid in ids:
    p = os.path.join(PORTRAITS, pid + '.png')
    if not os.path.exists(p): print('no portrait (falls back to silhouette):', pid); continue
    im = Image.open(p).convert('RGB').resize((432, 576), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=78)
    out[pid] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
bd = 'data:image/webp;base64,' + base64.b64encode(open('main-screen-backdrop.webp', 'rb').read()).decode()
html = src.replace('/*__PORTRAITS__*/{}', json.dumps(out)).replace("/*__BACKDROP__*/''", json.dumps(bd))
open('Mission-Log-Design.html', 'w', encoding='utf-8').write(html)
print(len(html) // 1024, 'KB,', len(out), 'portraits')
