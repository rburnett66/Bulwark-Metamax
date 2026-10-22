// [MM-task_mvd8b1mg_o] playtest copies: every faction has Powder's map 1, stamped, identical layout; authored maps are kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFactionMaps, fileSlug } from './copy-faction-maps.mjs';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FORGE = path.join(GAME, 'content/maps/forge');

// The map 1 playtest copies were retired when each faction got its own map 1 [MM-story_mvjw67lo_f] —
// faction-maps.test.mjs checks those maps. The script's own contract still holds:
test("the script never overwrites a faction's own authored map", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-'));
  fs.copyFileSync(path.join(FORGE, 'powder-map-1.json'), path.join(dir, 'powder-map-1.json'));
  fs.writeFileSync(path.join(dir, 'water-map-1.json'), JSON.stringify({ authored: true }));
  const r = copyFactionMaps({ dir, log: () => {} });
  assert.equal(r.written.length, 7);
  assert.deepEqual(r.kept, ['water-map-1.json']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'water-map-1.json'), 'utf8')), { authored: true });
});
