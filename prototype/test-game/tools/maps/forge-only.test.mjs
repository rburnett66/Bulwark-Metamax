// [MM-story_mw2ml1ze_e] Owner 2026-11-04: "100% of the maps for all factions [are] unique 3D maps … No more legacy maps."
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const G = new URL('../../', import.meta.url);
const FORGE = new URL('content/maps/forge/', G);
const SLUGS = ['powder', 'air', 'high-tech', 'artillery', 'water', 'arcane-energy', 'space-tech', 'dark-energy', 'greenies'];

test('81 maps: every faction has its own map 1-9, each with a different terrain and its baked 3D level', () => {
  const seen = new Map();
  for (const s of SLUGS) for (let n = 1; n <= 9; n++) {
    const f = `${s}-map-${n}`;
    const m = JSON.parse(readFileSync(new URL(f + '.json', FORGE), 'utf8'));
    assert.equal(m._copiedFrom, undefined, f + ' is a copy');
    const key = JSON.stringify([m.terrain, m.blocking]);
    assert.ok(!seen.has(key), `${f} has the same terrain as ${seen.get(key)}`);
    seen.set(key, f);
    assert.ok(existsSync(new URL(`content/maps/baked/${f}/level.json`, G)), f + ' has no baked 3D level');
  }
  assert.equal(seen.size, 81);
  assert.equal(readdirSync(FORGE).filter((x) => x.endsWith('.json')).length, 81, 'no stray map files');
});

test('the game has no legacy map path a player can reach', () => {
  const MAIN = readFileSync(new URL('src/main.js', G), 'utf8');
  assert.ok(!/buildCampaignMap/.test(MAIN), 'the workbook generator is not used by the game');
  assert.ok(!/TEMP_MIRROR_FACTION/.test(MAIN), 'no Powder mirror');
  assert.match(MAIN, /throw new Error\(`no map \$\{id\} for/);
  assert.ok(!/CLASSIC BOARD/.test(readFileSync(new URL('src/menu/menu.js', G), 'utf8')), 'no Classic board button');
  assert.ok(!/Classic board/.test(readFileSync(new URL('src/render/hud.js', G), 'utf8')), 'no Classic board option');
});
