#!/usr/bin/env node
/**
 * tools/maps/copy-faction-maps.mjs — PLAYTEST COPIES: give every faction the Powder maps. [MM-task_mvd8b1mg_o]
 *
 * Owner 2026-10-17: "we still need to copy the map data from powder to all other factions, and do this in a way that
 * lets a tester pick that faction to fight and the map layout looks like the new faction's terrain".
 *
 * For each committed content/maps/forge/powder-map-<n>.json this writes <faction>-map-<n>.json for the other eight
 * factions (slugs as the Terrain Forge names its slots: air, high-tech, artillery, water, arcane-energy, space-tech,
 * dark-energy, greenies). The copy is the same layout — terrain, blocking, resources, spawns, decor, waves — stamped
 * `_copiedFrom: "powder-map-<n>"` so the game borrows Powder's baked road mask instead of needing its own bake. In the
 * battle view the faction's planet supplies the look: its ground / rock / foliage palette and light, and its four
 * resources (data/planets.js).
 *
 * A faction's own authored map is never overwritten: only files that are missing or are themselves copies get
 * (re)written. Re-run after editing Powder's maps:   node tools/maps/copy-faction-maps.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../../src/data/factions.js';

const REG = globalThis.BulwarkFactions;
const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = path.join(GAME, 'content/maps/forge');
// the Terrain Forge's short slot names (main.js FORGE_SLOT_NAME) → file slugs (main.js forgeFileSlug)
const SLOT_NAME = { 'Ground / Powder': 'Powder', 'Greenies (Chem)': 'Greenies' };
export const fileSlug = (factionName) => (SLOT_NAME[factionName] || factionName).toLowerCase().replace(/[^a-z]+/g, '-').replace(/(^-+|-+$)/g, '');

export function copyFactionMaps({ dir = DIR, dryRun = false, log = console.log } = {}) {
  const source = 'powder';
  const sources = fs.readdirSync(dir).filter((f) => /^powder-map-\d+\.json$/.test(f)).sort();
  const written = [], kept = [];
  for (const f of sources) {
    const n = f.match(/-map-(\d+)\.json$/)[1];
    const src = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const fac of REG.FACTIONS || REG.NAMES.map((name) => REG.find(name))) {
      const slug = fileSlug(fac.name);
      if (slug === source) continue;
      const out = path.join(dir, `${slug}-map-${n}.json`);
      if (fs.existsSync(out)) {
        const cur = JSON.parse(fs.readFileSync(out, 'utf8'));
        if (!cur._copiedFrom) { kept.push(path.basename(out)); continue; }   // the faction's own map — never touched
      }
      const copy = { _copiedFrom: `${source}-map-${n}`, _note: `PLAYTEST COPY of ${source}-map-${n} for ${fac.name} — regenerate with tools/maps/copy-faction-maps.mjs; replace by authoring this faction's map in the Terrain Forge`, ...src };
      if (!dryRun) fs.writeFileSync(out, JSON.stringify(copy) + '\n');
      written.push(path.basename(out));
    }
  }
  log(`copied ${sources.length} Powder map(s) → ${written.length} file(s)` + (kept.length ? `; kept authored: ${kept.join(', ')}` : ''));
  return { written, kept };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) copyFactionMaps();
