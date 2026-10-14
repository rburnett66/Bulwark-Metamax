// Assembles the self-contained prototype page: src/head3d.html + src/body3d.html with the baked level,
// its images, the repo's pathfinder and the unit-model builder inlined.
// Usage (from anywhere): node prototype/test-game/tools/terrain3d-proto/build3d.mjs [mapId]
// Run bake3d.mjs first. Output: tools/terrain3d-proto/dist/terrain-proto-3d.html (gitignored — reproducible).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');   // prototype/test-game
const MAP_ID = process.argv[2] || 'powder-map-1';
const OUT = path.join(REPO, 'content/maps/baked', MAP_ID);
const tpl = fs.readFileSync(path.join(HERE, 'src/head3d.html'), 'utf8') + fs.readFileSync(path.join(HERE, 'src/body3d.html'), 'utf8');
const level = JSON.parse(fs.readFileSync(`${OUT}/level.json`, 'utf8'));
const uri = (p, mime) => `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
const images = {};
for (const t of level.tiles) images[t.name] = uri(`${OUT}/${t.name}`, 'image/webp');
images.roadMask = uri(`${OUT}/road_mask.png`, 'image/png');
images.tankBody = uri(`${REPO}/content/units/voxel/GND-Tanks.body.png`, 'image/png');
images.tankTurret = uri(`${REPO}/content/units/voxel/GND-Tanks.turret.png`, 'image/png');
images.tankBodyShadow = uri(`${REPO}/content/units/voxel/GND-Tanks.body.shadow.png`, 'image/png');
images.tankTurretShadow = uri(`${REPO}/content/units/voxel/GND-Tanks.turret.shadow.png`, 'image/png');
// Pathfinding: verbatim from the repo, from clampInt through smoothPath; `export` keywords stripped.
// Prototype only — the game imports src/sim/pathfinding.js, never a copy.
// CRLF normalised first: a Windows checkout with autocrlf would otherwise miss the end marker.
const pf = fs.readFileSync(`${REPO}/src/sim/pathfinding.js`, 'utf8').replace(/\r\n/g, '\n');
const start = pf.indexOf('function clampInt'), end = pf.indexOf('/**\n * Fixed water-lane');
if (start < 0 || end < 0) throw new Error('pathfinding markers not found');
const pfSrc = pf.slice(start, end).replace(/^export /gm, '');
// Function replacers: a string replacement would expand `$&` / `$'` sequences inside the inlined code.
let html = tpl.replace('/*__LEVEL__*/null', () => JSON.stringify(level))
  .replace('/*__IMAGES__*/{}', () => JSON.stringify(images))
  .replace('/*__PATHFINDING__*/', () => pfSrc)
  .replace('/*__UNITS__*/', () => fs.readFileSync(path.join(HERE, '../unit-models/src/prims.js'), 'utf8') + '\n' + fs.readFileSync(path.join(HERE, '../unit-models/src/models.js'), 'utf8'));
fs.mkdirSync(path.join(HERE, 'dist'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'dist/terrain-proto-3d.html'), html);
console.log('built', (html.length / 1024 / 1024).toFixed(2), 'MB');
