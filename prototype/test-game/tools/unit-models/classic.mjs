// The unit-model builder as a CLASSIC script, for the offline tools that inline it into one HTML page
// (terrain3d-proto/build3d.mjs, unit-models/build.py). The ONE source is src/render3d/units/{prims,models}.js (+ the System
// models the harvester comes from)
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

/** { prims, models } — each a classic-script string; prims also binds `var Prims`. models.js builds the harvester from the
 *  System miner (structures/systemModels.js), so that file rides along first, in its own scope (both declare `const M`),
 *  binding just SYSTEM_MODELS / SYSTEM_COLORS [MM-story_mvg3xsca_1x]. */
export function classicUnitsParts() {
  const prims = toClassic(fs.readFileSync(path.join(UNITS, 'prims.js'), 'utf8')) + '\nvar Prims = createPrims(THREE);\n';
  const system = toClassic(fs.readFileSync(path.join(UNITS, '../structures/systemModels.js'), 'utf8'));
  // the AIR faction's model files (air/*.js) ride in one scope too, binding AIR_MODELS for models.js [MM-story_mvh8woji_1]
  // each file gets its own scope (their local helpers may share names) and hands out only what it exports
  const air = ['palette', 'troops', 'scout', 'tank', 'artillery', 'heavy', 'gunship', 'fighter', 'missile', 'bomber', 'index'].map((f) => {
    const src = fs.readFileSync(path.join(UNITS, 'air', f + '.js'), 'utf8');
    const names = [...src.matchAll(/^export\s+(?:const|let|function|class)\s+(\w+)/gm)].map((m) => m[1]).join(', ');
    return 'var { ' + names + ' } = (function () {\n' + toClassic(src) + '\nreturn { ' + names + ' };\n})();';
  }).join('\n');
  const models = 'var { SYSTEM_MODELS, SYSTEM_COLORS } = (function () {\n' + system + '\nreturn { SYSTEM_MODELS, SYSTEM_COLORS };\n})();\n'
    + 'var { AIR_MODELS } = (function () {\n' + air + '\nreturn { AIR_MODELS };\n})();\n'
    + toClassic(fs.readFileSync(path.join(UNITS, 'models.js'), 'utf8'));
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
