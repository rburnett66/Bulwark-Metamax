// [MM-story_mvk63439_o] — the Effects Lab's arena helpers: no fog, the faction's whole roster, spawns on walkable
// ground at the asked distance, tower cells round the base, and the real sim accepts all of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../data/factions.js';
import { UNITS } from '../data/tables.js';
import { buildTerrainMap, resolveResourceTypes } from '../sim/mapgen.js';
import { createSim, applyCommand, stepSim, FIXED_DT } from '../sim/core.js';
import { createUnit } from '../sim/entities.js';
import { fogWindow } from '../render3d/overlays/fogModel.js';
import { FACTION_MAP, arenaMap, factionUnits, spawnCells, towerCells } from './arena.js';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REG = globalThis.BulwarkFactions;
const load = (slug) => arenaMap(buildTerrainMap(JSON.parse(fs.readFileSync(path.join(GAME, `content/maps/forge/${slug}-map-1.json`), 'utf8')), 1, { seed: 0, bakeTune: {} }));

test('every faction has a map, and its whole roster in order', () => {
  for (const f of REG.FACTIONS) {
    assert.ok(fs.existsSync(path.join(GAME, `content/maps/forge/${FACTION_MAP[f.key]}-map-1.json`)), f.key);
    const us = factionUnits(UNITS, f.name);
    assert.ok(us.length >= 7, `${f.key}: ${us.length} units`);
    assert.equal(us[0].shape, 'Troops');
  }
});

test('the arena has no fog window: the whole board is in view', () => {
  const map = load('dark-energy');
  assert.equal(fogWindow({ map, waves: { current: 3, active: true } }, map), null);
});

test('spawns: on walkable ground, about the asked distance out, all different; flyers anywhere on the map', () => {
  const map = load('water');
  const bad = new Set([...map.blockedCells, ...(map.waterCells || [])].map((c) => c.y * map.cols + c.x));
  const cells = spawnCells(map, 12, { dist: 10 });
  assert.equal(cells.length, 12);
  assert.equal(new Set(cells.map((c) => c.y * map.cols + c.x)).size, 12);
  for (const c of cells) {
    assert.ok(!bad.has(c.y * map.cols + c.x), 'dry and unblocked');
    const d = Math.hypot(c.x - map.base.x, c.y - map.base.y);
    assert.ok(d > 5 && d < 17, `distance ${d.toFixed(1)}`);
  }
  assert.equal(spawnCells(map, 4, { dist: 10, flyer: true }).length, 4);
});

test('the real sim takes it: towers place round the base, spawned units march and get shot', () => {
  const map = load('powder');
  resolveResourceTypes(map, 1);
  const sim = createSim(1, { map, waves: [], carry: null, faction: 'Ground / Powder', mapId: 1 });
  sim.economy.money = 1e6;
  const cells = towerCells(map);
  let placed = 0, i = 0;
  for (const t of ['STR-Cannon', 'STR-Rockets', 'STR-Flak', 'STR-Missile']) for (; i < cells.length; i++) if (applyCommand(sim, { type: 'place', structId: t, cell: cells[i++] }).ok) { placed++; break; }
  assert.equal(placed, 4);
  for (const c of spawnCells(map, 3, { dist: 8 })) { const u = createUnit(sim, 'GND-Troops', 1, c, 'ground', 'attacker'); u.routeIdx = -1; sim.units.set(u.id, u); }
  let damage = 0;
  const start = [...sim.units.values()].filter((u) => u.side === 'attacker').map((u) => ({ id: u.id, x: u.pos.x, y: u.pos.y }));
  for (let t = 0; t < 900; t++) for (const e of stepSim(sim, FIXED_DT)) if (e.type === 'damage' && e.targetKind !== 'base') damage += e.amount || 0;
  assert.ok(damage > 0, 'the towers hit the attackers');
  const moved = start.some((s) => { const u = sim.units.get(s.id); return !u || Math.hypot(u.pos.x - s.x, u.pos.y - s.y) > 1; });
  assert.ok(moved, 'the attackers march (or die)');
});
