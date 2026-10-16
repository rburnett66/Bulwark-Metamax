# Builds the nine-planet gallery (rotating globes, faction dossiers): src.html + gnoise.js (shared GLSL noise).
# Output: tools/planets/dist/bulwark-planets.html (gitignored). [MM-task_mva2fzdc_l]
import os
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); os.makedirs('dist', exist_ok=True)
s = open('src.html', encoding='utf-8').read().replace('/*__GNOISE__*/', open('gnoise.js', encoding='utf-8').read())
open('dist/bulwark-planets.html', 'w', encoding='utf-8').write(s); print(len(s) // 1024, 'KB')
