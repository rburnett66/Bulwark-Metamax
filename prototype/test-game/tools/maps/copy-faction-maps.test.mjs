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

test('every faction ships a map 1 copied from Powder, layout identical, stamped _copiedFrom', () => {
  const src = JSON.parse(fs.readFileSync(path.join(FORGE, 'powder-map-1.json'), 'utf8'));
  for (const name of globalThis.BulwarkFactions.NAMES) {
    const slug = fileSlug(name);
    if (slug === 'powder') continue;
    const f = path.join(FORGE, `${slug}-map-1.json`);
    assert.ok(fs.existsSync(f), `${slug}-map-1.json`);
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.equal(c._copiedFrom, 'powder-map-1');
    for (const k of ['cols', 'rows', 'base', 'terrain', 'blocking', 'resources', 'spawns', 'decor']) assert.deepEqual(c[k], src[k], `${slug}: ${k}`);
  }
});

test("the script never overwrites a faction's own authored map", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-'));
  fs.copyFileSync(path.join(FORGE, 'powder-map-1.json'), path.join(dir, 'powder-map-1.json'));
  fs.writeFileSync(path.join(dir, 'water-map-1.json'), JSON.stringify({ authored: true }));
  const r = copyFactionMaps({ dir, log: () => {} });
  assert.equal(r.written.length, 7);
  assert.deepEqual(r.kept, ['water-map-1.json']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'water-map-1.json'), 'utf8')), { authored: true });
});
