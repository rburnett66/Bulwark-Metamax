# Walker viewer (prototype)

The MM Model Forge walker tool: rig, simulate and preview legged walkers (2, 4 or 6 legs) with real mass, leg strength and balance, then build the rig over a reference image. A self-contained page (three.js from jsDelivr), no build step.

- Open: `index.html` in a browser, or serve it locally (`python serve_prototype.py tools/walker-viewer/index.html`).
- Test link (this branch): https://raw.githack.com/rburnett66/Bulwark-Metamax/walker-viewer/tools/walker-viewer/index.html
- Quick start: `#example=twin` loads the twin-cannon biped.

It sits under `tools/`, so it never ships with the game (`prototype/test-game/**` only). The design and tech plan live in the MM Model Forge project.
