# Bulwark Planets — nine faction homeworlds (gallery)

Rotating globes with atmosphere rim, clouds, oceans/lava/ice and a faction dossier per planet.
Build: `python tools/planets/build.py` → `tools/planets/dist/bulwark-planets.html` (src.html + gnoise.js).
The in-world planet look (atmosphere shader, biomes/foliage, airborne particles, globe card) lives in
`tools/terrain3d-proto/src/planet/*.js`, inlined into `terrain3d-proto/src/body3d.html`. [MM-task_mva2fzdc_l]
