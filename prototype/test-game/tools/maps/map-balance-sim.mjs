/**
 * tools/maps/map-balance-sim.mjs — map-impact balance sim [MM-story_mvjw67lo_f] (Balance-Sim-Report-2026-10-22 §3).
 * Each faction's 8 campaign waves on a BASELINE map 1 (default: Powder's) vs its OWN map 1, under one scripted player,
 * several runs. Same sim code path as live play (createSim / stepSim / applyCommand). Two studies per run set:
 *   runs     — normal base hp: wins, waves survived;
 *   pressure — base can't die, a wave stuck 240 s is cleared: base damage by lane, time to first ground hit.
 * Usage: node tools/maps/map-balance-sim.mjs [baseline.json] [seeds e.g. 1,2,3] [out.json]
 *        node tools/maps/map-balance-report.mjs out.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') + '/';
const imp = (p) => import(pathToFileURL(R + p).href);
await imp('src/data/factions.js');
const { buildTerrainMap, resolveResourceTypes } = await imp('src/sim/mapgen.js');
const { buildCampaignWaves } = await imp('src/sim/campaign.js');
const { createSim, stepSim, applyCommand, FIXED_DT } = await imp('src/sim/core.js');
const NAMES = globalThis.BulwarkFactions.NAMES;
const SLOT = { 'Ground / Powder': 'powder', 'Greenies (Chem)': 'greenies' };
const slug = (n) => SLOT[n] || n.toLowerCase().replace(/[^a-z]+/g, '-').replace(/(^-+|-+$)/g, '');
const load = (s, from) => JSON.parse(fs.readFileSync((from || R + 'content/maps/forge/') + s + '-map-1.json', 'utf8'));
const OLD = JSON.parse(fs.readFileSync(process.argv[2] || R + 'content/maps/forge/powder-map-1.json', 'utf8'));   // every faction's old map 1 = Powder's
const SEEDS = (process.argv[3] || '1,2,3,4,5').split(',').map(Number);

function board(forge, faction) {
  const map = buildTerrainMap(forge, 1, { seed: 0, bakeTune: {} });
  resolveResourceTypes(map, 1);
  return { map, waves: buildCampaignWaves(map, faction) };
}
/** Scripted defender, as a sensible player builds: anti-ground (Cannon, Rockets) close in; anti-air (Missile Tower, Flak)
 *  pushed 4–5 cells out so it can meet the missile standoff; alternating ground/air; upgrades with spare gold. */
function defend(sim) {
  const b = sim.map.base;
  const ringCells = (r0, r1) => { const out = []; for (let r = r0; r <= r1; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) out.push({ x: b.x + dx, y: b.y + dy }); return out; };
  const near = ringCells(2, 4), far = ringCells(4, 6);
  const plan = [['STR-Cannon', near], ['STR-Missile', far], ['STR-Rockets', near], ['STR-Flak', far]];
  let k = sim._defK || 0, misses = 0;
  const jitter = sim._jitter || 0;   // per-run variation: where round the base each tower type starts looking
  for (let guard = 0; guard < 24 && misses < plan.length; guard++) {
    const [structId, cells] = plan[k % plan.length];
    let placed = false, poor = false;
    const off = (k * 7 + jitter) % cells.length;
    for (let n = 0; n < cells.length; n++) {
      const r = applyCommand(sim, { type: 'place', structId, cell: cells[(off + n) % cells.length] });
      if (r.ok) { placed = true; break; }
      if (/gold|money|afford/i.test(r.reason || '')) { poor = true; break; }
    }
    if (poor) break;               // out of gold: wait for more
    if (placed) misses = 0; else misses++;   // no legal cell for this type here: try the next type
    k++;
  }
  sim._defK = k;
  for (const s of sim.structures.values()) applyCommand(sim, { type: 'upgrade', id: s.id });
}
/** Scripted harvesting, as a player taps a field: any idle truck goes to the nearest live, revealed field. */
function harvest(sim) {
  const idle = [...sim.units.values()].some((u) => u.isHarvester && !u.fieldId && u.hp > 0);
  if (!idle) return;
  const b = sim.map.base;
  const nodes = (sim.resourceNodes || []).filter((n) => n.remaining > 0).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y));
  for (const n of nodes.slice(0, 40)) if (applyCommand(sim, { type: 'harvest', nodeId: n.id }).ok) return;
}
function play(forge, faction, seed, immortal) {
  const B = board(forge, faction);
  const sim = createSim(seed, { map: B.map, waves: B.waves, carry: null, harvesterLevel: 1, mapId: 1, faction });
  if (immortal) { sim.base.hp = sim.base.maxHp = 1e9; }
  sim._jitter = (seed * 11) | 0;
  const owner = new Map();   // entity id → unitId
  const perWave = [], byUnit = {};
  let cur = null, firstHit = null, t0 = 0, stalled = false;
  for (let t = 0; t < 200000 && !sim.result; t++) {
    if (sim.bonuses?.offer?.length) applyCommand(sim, { type: 'chooseBonus', bonusId: sim.bonuses.offer[0] });
    if (t % 30 === 0) { harvest(sim); defend(sim); }
    if (!sim.waves.active) { defend(sim); applyCommand(sim, { type: 'startWave' }); }
    const evs = stepSim(sim, FIXED_DT);
    if (cur && sim.waves.active && sim.time - t0 > 240) {
      stalled = true; cur.stalled = (cur.stalled || 0) + 1;
      if (!immortal) break;
      cur.stuck = [...sim.units.values()].filter((u) => u.side === 'attacker').map((u) => u.unitId);
      for (const u of sim.units.values()) if (u.side === 'attacker') u.hp = 0;   // clear a stalled wave so the run goes on
    }
    for (const u of sim.units.values()) if (!owner.has(u.id)) owner.set(u.id, { id: u.unitId, lane: u.domain === 'Flyer' || u.altitude > 0 ? 'air' : (u.domain === 'Swimmer' || u.domain === 'Floater') ? 'water' : 'ground' });
    for (const e of evs) {
      if (e.type === 'wave' && e.phase === 'start') { cur = { wave: e.wave, baseDmg: 0, lane: { ground: 0, water: 0, air: 0 }, kills: 0, spawned: 0, secs: 0, firstHit: null, firstGround: null }; t0 = sim.time; perWave.push(cur); }
      if (!cur) continue;
      if (e.type === 'damage' && e.targetKind === 'base') { cur.baseDmg += e.amount || 0; if (cur.firstHit == null) cur.firstHit = sim.time - t0;
        const o = owner.get(e.sourceId) || { id: '?', lane: 'ground' }; byUnit[o.id] = (byUnit[o.id] || 0) + (e.amount || 0); cur.lane[o.lane] += e.amount || 0;
        if (o.lane !== 'air' && cur.firstGround == null) cur.firstGround = sim.time - t0; }
      if (e.type === 'kill' && e.side === 'attacker') cur.kills++;
      if (e.type === 'wave' && e.phase === 'clear') cur.secs = sim.time - t0;
    }
  }
  return { stalled, result: sim.result, wavesCleared: perWave.filter((w) => w.secs > 0).length, baseHp: Math.round(sim.base.hp), maxHp: sim.base.maxHp,
    perWave, byUnit, time: sim.time };
}
const rows = [];
for (const fac of NAMES) {
  const s = slug(fac);
  const NEW = load(s);
  for (const [label, forge] of [['old', OLD], ['new', NEW]]) {
    const runs = SEEDS.map((seed) => play(forge, fac, seed, false));
    const pressure = SEEDS.map((seed) => play(forge, fac, seed, true));
    rows.push({ faction: fac, slug: s, map: label, runs, pressure });
  }
}
fs.writeFileSync(process.argv[4] || 'map-balance-sim.json', JSON.stringify(rows));
for (const r of rows) {
  const n = r.runs.length, wins = r.runs.filter((x) => x.result === 'win').length;
  const hp = r.runs.reduce((a, x) => a + x.baseHp / x.maxHp, 0) / n;
  const dmg = r.runs.reduce((a, x) => a + x.perWave.reduce((p, w) => p + w.baseDmg, 0), 0) / n;
  const fh = r.runs.flatMap((x) => x.perWave.map((w) => w.firstHit).filter((v) => v != null));
  const st = r.runs.filter((x) => x.stalled).length;
  console.log(r.faction.padEnd(18), r.map, 'win', wins + '/' + n, 'stall', st, 'baseHp', (100 * hp).toFixed(0) + '%', 'baseDmg', dmg.toFixed(0), 'firstHit', fh.length ? (fh.reduce((a, b) => a + b, 0) / fh.length).toFixed(1) + 's' : '-', 'waves', (r.runs.reduce((a, x) => a + x.wavesCleared, 0) / n).toFixed(1));
}
