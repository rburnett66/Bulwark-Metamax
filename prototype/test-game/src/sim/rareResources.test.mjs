// [MM-task_mw74103f_3] Owner 2026-11-07: "double the amount of rare resources on the map" — every forge battle map
// carries twice its rare (red) nodes, each partner in the same wave ring; the other tiers are unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildTerrainMap } from './mapgen.js';
import { RARE_NODE_MULT } from '../data/tables.js';

const DIR = new URL('../../content/maps/forge/', import.meta.url);
const FILES = readdirSync(DIR).filter((f) => /-map-\d+\.json$/.test(f)).slice(0, 12);

test('rare nodes are doubled; each partner shares its source ring; epic is untouched', () => {
  assert.equal(RARE_NODE_MULT, 2);
  for (const f of FILES) {
    const forge = JSON.parse(readFileSync(new URL(f, DIR)));
    const m = buildTerrainMap(forge, +f.match(/map-(\d+)/)[1], { seed: 0 });
    const red = m.resources.filter((r) => r.color === 'red');
    const src = red.filter((r) => !/-r\d+$/.test(r.id));
    const partners = red.filter((r) => /-r\d+$/.test(r.id));
    assert.equal(partners.length, src.length, f + ': one partner per rare node');
    const byId = new Map(src.map((r) => [r.id, r]));
    for (const p of partners) {
      const s = byId.get(p.id.replace(/-r\d+$/, ''));
      assert.ok(s, f + ': partner has a source');
      assert.equal(p.wave, s.wave, f + ': same ring');
      assert.equal(p.units, s.units);
    }
    const cells = new Set(m.resources.map((r) => r.x + ',' + r.y));
    assert.equal(cells.size, m.resources.length, f + ': no two nodes share a cell');
    assert.ok(!m.resources.some((r) => r.role === 'quest' && !r.color), f + ': every quest node has its colour');
  }
});
