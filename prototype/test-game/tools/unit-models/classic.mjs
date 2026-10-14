// The unit-model builder as a CLASSIC script, for the offline tools that inline it into one HTML page
// (terrain3d-proto/build3d.mjs, unit-models/build.py). The ONE source is src/render3d/units/{prims,models}.js
// (ES modules, THREE injected); this strips import/export and binds the globals the tool pages use:
//   Prims        = createPrims(THREE)   (buildModel, geomOf, track)
//   UNIT_MODELS  = the model table
// Usage: node tools/unit-models/classic.mjs > out.js    or    import { classicUnitsSource } from './classic.mjs'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UNITS = path.resolve(HERE, '../../src/render3d/units');

export function toClassic(src) {
  return src.replace(/\r\n/g, '\n')
    .replace(/^import\s[^;]*;\s*$/gm, '')
    .replace(/^export\s+(?=(function|const|let|class)\b)/gm, '');
}

/** { prims, models } — each a classic-script string; prims also binds `var Prims`. */
export function classicUnitsParts() {
  const prims = toClassic(fs.readFileSync(path.join(UNITS, 'prims.js'), 'utf8')) + '\nvar Prims = createPrims(THREE);\n';
  const models = toClassic(fs.readFileSync(path.join(UNITS, 'models.js'), 'utf8'));
  return { prims, models };
}

export function classicUnitsSource() {
  const { prims, models } = classicUnitsParts();
  return prims + '\n' + models;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const which = process.argv[2];
  const parts = classicUnitsParts();
  process.stdout.write(which === 'prims' ? parts.prims : which === 'models' ? parts.models : classicUnitsSource());
}
