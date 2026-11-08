/**
 * tools/sim/five-star-proof.mjs — can a fair player earn 5 stars on waves 1 and 2? (owner 2026-11-07: "run simulations
 * and prove to me you can get 5 stars on waves 1 and 2 without cheating").
 *
 * Fair = the live game's own code path only: the faction's real forge map (buildTerrainMap), the campaign waves
 * (buildCampaignWaves), createSim / stepSim / applyCommand. The script only issues commands a player can tap (place,
 * upgrade, harvest, buyHarvester, startWave, chooseBonus), with the gold the game gives. It never edits sim state, and
 * the sim is NOT stepped before START WAVE (the game freezes between waves: no gathering, no building progress).
 *
 * The scripted player (one fixed script for every map; STRATEGY picks a variant):
 *   build phase: towers between the base and the coming wave's spawn points (cheap Machine Guns first, as a player
 *   facing troops and scouts would), and a second harvester when the strategy buys one;
 *   during the wave: every harvester works the current ring's premium fields first (that star needs all of them), then
 *   its primary fields; spare gold goes on more towers.
 * Usage: node tools/sim/five-star-proof.mjs [maps e.g. 1,2,3] [strategies e.g. mg4,mg2h]
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
const MAPS = (process.argv[2] || '1').split(',').map(Number);
const STRATS = (process.argv[3] || 'mg4,mg2h,mg3h').split(',');
const STRAT = {
  mg4: { towers: ['STR-MG', 'STR-MG', 'STR-MG', 'STR-MG', 'STR-Cannon'], buyHarvester: false },
  mg2h: { towers: ['STR-MG', 'STR-MG', 'STR-MG', 'STR-Cannon'], buyHarvester: true },
  mg3h: { towers: ['STR-MG', 'STR-MG', 'STR-MG'], buyHarvester: true, harvesterFirst: true },
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function spawnsOf(map, wave) {
  const ring = map.rings[wave - 1] || {};
  const L = ring.spawnList || {};
  const pts = [...(L.ground || []), ...(L.water || []), ...(L.air || [])];
  if (pts.length) return pts;
  return Object.values(ring.spawns || {}).filter(Boolean);
}
/** Cells 2–5 from the base toward each of the wave's spawn points in turn (every approach gets a tower before any
 *  gets a second), nearest the line from the base to that spawn. */
function towerCells(sim, wave) {
  const b = sim.map.base, sp = spawnsOf(sim.map, wave);
  const ring = [];
  for (let r = 2; r <= 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push({ x: b.x + dx, y: b.y + dy, r });
  if (!sp.length) return ring;
  const lists = sp.map((s) => ring.slice().sort((p, q) => (dist(p, s) + p.r * 0.6) - (dist(q, s) + q.r * 0.6)));
  const out = [], seen = new Set();
  for (let i = 0; i < ring.length; i++) for (const L of lists) { const c = L[i]; const k = c.x + ',' + c.y; if (!seen.has(k)) { seen.add(k); out.push(c); } }
  return out;
}
function build(sim, list, wave) {
  const cells = towerCells(sim, wave);
  for (const structId of list) {
    for (const c of cells) {
      const r = applyCommand(sim, { type: 'place', structId, cell: c });
      if (r.ok) break;
      if (/gold|money|afford/i.test(r.reason || '')) return false;
    }
  }
  return true;
}
/** Spare gold after the towers: upgrade the ones nearest the spawns. */
function upgrade(sim) { for (const s of sim.structures.values()) applyCommand(sim, { type: 'upgrade', id: s.id }); }
const TIER = { blue: 'common', yellow: 'uncommon' };
/** Each harvester works toward the wave's quotas (shown before the wave): the first truck on common, the second on
 *  uncommon, the rest on whichever is further from done; a truck whose quota is met moves to the other. Nearest live
 *  revealed field of that tier. */
function harvest(sim, wave) {
  const q = sim.waves.quota || { common: 0, uncommon: 0 }, took = sim.waveTake || {};
  const left = { common: Math.max(0, q.common - (took.common || 0)), uncommon: Math.max(0, q.uncommon - (took.uncommon || 0)) };
  const live = (sim.resourceNodes || []).filter((n) => n.wave <= wave && n.remaining > 0 && TIER[n.color]);
  const fleet = [...sim.units.values()].filter((u) => u.isHarvester && u.hp > 0).sort((a, b) => a.id - b.id);
  fleet.forEach((h, i) => {
    let tier = i === 0 ? 'common' : i === 1 ? 'uncommon' : (left.common / Math.max(1, q.common) >= left.uncommon / Math.max(1, q.uncommon) ? 'common' : 'uncommon');
    if (left[tier] <= 0) tier = tier === 'common' ? 'uncommon' : 'common';
    const curNode = h.fieldId && live.find((n) => n.fieldId === h.fieldId);
    if (curNode && TIER[curNode.color] === tier) return;
    const n = live.filter((x) => TIER[x.color] === tier).sort((p, r) => dist(h.pos, p) - dist(h.pos, r))[0];
    if (n) applyCommand(sim, { type: 'harvest', nodeId: n.id, harvesterId: h.id });
  });
}
function play(forge, faction, mapId, strat) {
  const S = STRAT[strat];
  const map = buildTerrainMap(forge, mapId, { seed: 0, bakeTune: {} });
  resolveResourceTypes(map, 1);
  const sim = createSim(1, { map, waves: buildCampaignWaves(map, faction), carry: null, harvesterLevel: 1, mapId, faction });
  const out = [];
  for (let wave = 1; wave <= 2; wave++) {
    // ── build phase (the sim is frozen): commands only ──
    if (sim.bonuses?.offer?.length) applyCommand(sim, { type: 'chooseBonus', bonusId: sim.bonuses.offer[0] });
    if (S.harvesterFirst && S.buyHarvester) applyCommand(sim, { type: 'buyHarvester' });
    build(sim, wave === 1 ? S.towers : ['STR-MG', 'STR-MG', 'STR-Cannon', 'STR-MG'], wave);
    if (!S.harvesterFirst && S.buyHarvester) applyCommand(sim, { type: 'buyHarvester' });
    if (!applyCommand(sim, { type: 'startWave' }).ok) break;
    harvest(sim, wave);
    let stars = null;
    for (let t = 0; t < 30 * 600 && !stars && !sim.result; t++) {
      if (t % 15 === 0) harvest(sim, wave);
      if (t % 60 === 0 && build(sim, ['STR-MG'], wave) && sim.economy.money > 700) upgrade(sim);
      for (const e of stepSim(sim, FIXED_DT)) if (e.type === 'waveStars') stars = e;
    }
    out.push(stars ? { wave, stars: stars.stars, flags: stars.flags, detail: stars.detail } : { wave, stars: 0, lost: sim.result });
    if (!stars) break;
  }
  return out;
}
const STAR = ['core', 'harv', 'com', 'unc', 'par'];
const rows = [];
for (const fac of NAMES) for (const mapId of MAPS) {
  const f = R + `content/maps/forge/${slug(fac)}-map-${mapId}.json`;
  if (!fs.existsSync(f)) continue;
  const forge = JSON.parse(fs.readFileSync(f, 'utf8'));
  const runs = {};
  for (const st of STRATS) runs[st] = play(forge, fac, mapId, st);
  rows.push({ faction: fac, mapId, runs });
  const best = (w) => Math.max(...STRATS.map((st) => (runs[st][w - 1] || {}).stars || 0));
  const line = STRATS.map((st) => st + ' ' + runs[st].map((r) => r.stars + '★' + (r.flags ? '[' + r.flags.map((f, i) => (f ? '' : STAR[i])).filter(Boolean).join(',') + ']' : '')).join(' ')).join('  ');
  console.log(`${fac.padEnd(18)} map${mapId}  best W1 ${best(1)}★ W2 ${best(2)}★   ${line}`);
}
fs.writeFileSync(process.env.OUT || '/dev/null', JSON.stringify(rows));
