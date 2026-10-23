/**
 * src/data/techtree.js — THE TECH TREE's data and rules [MM-story_mvkhed1f_h], epic [MM-epic_mvkg5mm7_2].
 * docs/16 Bulwark MM/design/Tech-Tree-Design.md v1.1: 57 upgrades in four divisions — Units, Bases, Map, Outpost
 * (coming soon) — plus the Apocalypse Cannon capstone.
 *
 * Pure: no DOM, no three.js, no save access, no clock. The Tech Net view (src/menu/technet.js) and the sandbox page
 * (techtree3d.html) both read this; the game menu adapts the save to it. Balance is data — prices and requirements are
 * table edits here. `d` (ring, 0 = centre) and `lane` (−1..1 across the division's sector) only place a node in the
 * 3D view.
 *
 * A status context is { owned: Set<id>, bank: number, paid?: {id: gold}, hasWin?: (planetName) => boolean }.
 * 'map3' (the Map 3 Victory milestone) counts as owned when the player has won Map 3 — the game puts it in `owned`.
 */

export const DIVISIONS = Object.freeze({
  units:   Object.freeze({ label: 'UNITS',   color: '#ff8a3d', a0: 0,   a1: 130, total: 25 }),
  bases:   Object.freeze({ label: 'BASES',   color: '#34e1ff', a0: 130, a1: 245, total: 21 }),
  map:     Object.freeze({ label: 'MAP',     color: '#b67cff', a0: 245, a1: 315, total: 10 }),
  outpost: Object.freeze({ label: 'OUTPOST', color: '#6f8c9c', a0: 315, a1: 360, total: 0, soon: true }),
});
export const DIV_ORDER = Object.freeze(['units', 'bases', 'map', 'outpost']);
/** Floor labels for the groups inside a division. */
export const GROUPS = Object.freeze([
  { div: 'units', lane: -0.47, text: 'TOWERS' }, { div: 'units', lane: 0.36, text: 'TROOPS' }, { div: 'units', lane: 0.76, text: 'HARVESTERS' },
  { div: 'bases', lane: -0.82, text: 'SUPER-CANNON' }, { div: 'bases', lane: -0.3, text: 'DEFENSE PODS' }, { div: 'bases', lane: 0.52, text: 'BASE MODELS' },
  { div: 'map', lane: -0.2, text: 'PORTALS' }, { div: 'map', lane: 0.84, text: 'INTEL' },
]);
export const STAT_KEYS = Object.freeze(['ATK', 'DEF', 'RNG', 'DMG', 'COST', 'H-SPD', 'H-GAT']);
export const STAT_NAMES = Object.freeze(['Attack', 'Defense', 'Range', 'Damage', 'Upgrade cost', 'Harvester speed', 'Harvester gathering']);
export const TECH_TOTAL = 57;
export const PORTAL_BASE_PRICE = 1000, PORTAL_STEP = 500;

const N = [];
const add = (o) => { N.push(o); return o; };

// ── core + capstone
add({ id: 'pathfinder', div: 'bases', kind: 'core', name: 'BS-7 Pathfinder', sub: 'Starter base · Neutral', free: true, start: true,
  stats: [0, 0, 0, 0, 0, 0, 0], roof: 'cannon',
  desc: 'The beginner landing craft every campaign starts with. No bonuses and no weakness — the reference every other base model trades against.' });
add({ id: 'apocalypse', div: 'bases', kind: 'ult', name: 'Apocalypse Cannon', sub: 'Capstone · MK VII', price: 25000,
  req: ['pod4', 'power2', 'range2', 'mk5', 'rockets3', 'missile3', 'troop'], gate: { portals: 8 },
  desc: 'The ultimate. Needs the last item of every line: Pod 4, both cannon buybacks, Harvester Mk V, Rockets T3, Missile T3, Troop Command — and all eight portal codes.' });

// ── UNITS: towers (starting kit at T1, then T2 / T3)
for (const [id, nm, lane, p2, p3] of [['cannon', 'Cannon', -0.92, 600, 1500], ['flak', 'Flak', -0.56, 600, 1500],
  ['wall', 'Wall', -0.2, 400, 1000], ['mg', 'Machine Gun', -0.02, 400, 1000]]) {
  add({ id: id + '1', div: 'units', kind: 'tier', tier: 1, name: nm + ' T1', sub: 'Starting kit', free: true, start: true, d: 1, lane,
    desc: nm + ' at tier 1 is in every new campaign\'s build bar.' });
  add({ id: id + '2', div: 'units', kind: 'tier', tier: 2, name: nm + ' T2', price: p2, d: 2, lane, req: [id + '1'],
    desc: 'Lets ' + nm + ' be upgraded to tier 2 in battle.' });
  add({ id: id + '3', div: 'units', kind: 'tier', tier: 3, name: nm + ' T3', price: p3, d: 3, lane, req: [id + '2'], gate: { portals: 1 },
    desc: 'Lets ' + nm + ' be upgraded to tier 3 in battle. Wave bonuses 15/16 stop offering it once owned.' });
}
// new tower types, each with its own T2 / T3
for (const [id, nm, short, lane, rq, p1, p2, p3, d, desc] of [
  ['rockets', 'Rocket Tower', 'Rocket', -0.74, 'cannon2', 1500, 900, 2200, 3, 'Long-range ground artillery: range 10, splash 1.2, slow burning salvos.'],
  ['missile', 'Missile Tower', 'Missile', -0.38, 'flak2', 1500, 900, 2200, 3, 'Long-range anti-air: range 8, guided missiles.'],
  ['mine', 'Mine', 'Mine', 0.16, null, 800, 500, 1200, 1.4, 'Buried charges on the road — single-use, big burst.']]) {
  add({ id, div: 'units', kind: 'tower', tier: 1, name: nm, price: p1, d, lane, req: rq ? [rq] : [], desc: 'Unlocks the ' + nm + '. ' + desc });
  add({ id: id + '2', div: 'units', kind: 'tier', tier: 2, name: short + ' T2', price: p2, d: d + 1, lane, req: [id], desc: 'Tier 2 for the ' + nm + '.' });
  add({ id: id + '3', div: 'units', kind: 'tier', tier: 3, name: short + ' T3', price: p3, d: d + 2, lane, req: [id + '2'], desc: 'Tier 3 for the ' + nm + '.' });
}
// ── UNITS: troops + harvesters
add({ id: 'troop', div: 'units', kind: 'item', name: 'L3 Troop Command', price: 3800, d: 1.6, lane: 0.36, desc: 'Fields a rank of allied ground troops each wave.' });
const MK = [['mk2', 'Harvester Mk II', 600, '×1.2', '×1.05', '×1.15', ''], ['mk3', 'Harvester Mk III', 1500, '×1.4', '×1.15', '×1.3', ' + auto-return at 90 %'],
  ['mk4', 'Harvester Mk IV', 3200, '×1.65', '×1.25', '×1.55', ''], ['mk5', 'Harvester Mk V', 6000, '×2.0', '×1.4', '×1.9', ' + premium fast-harvest']];
MK.forEach(([id, nm, p, c, s, h, x], i) => add({ id, div: 'units', kind: 'harv', name: nm, price: p, d: 1 + i, lane: 0.56, req: i ? [MK[i - 1][0]] : [],
  desc: 'Capacity ' + c + ', speed ' + s + ', HP ' + h + x + '.' }));
add({ id: 'dock3', div: 'units', kind: 'harv', name: 'Dock 3', price: 1200, d: 1.4, lane: 0.76, desc: 'A third harvester can be bought in battle (the fleet starts at two).' });
add({ id: 'dock4', div: 'units', kind: 'harv', name: 'Dock 4', price: 2500, d: 2.4, lane: 0.76, req: ['dock3'], desc: 'A fourth harvester.' });
add({ id: 'refinery', div: 'units', kind: 'harv', name: 'Refinery', price: 1800, d: 1.9, lane: 0.94, desc: '+12 % gold per load.' });

// ── BASES: super-cannon + buybacks
add({ id: 'supercannon', div: 'bases', kind: 'weapon', name: 'Super-cannon', price: 1200, d: 1, lane: -0.82,
  desc: 'The base fires its long-range arcing shell at targets that stay put — at today\'s nerfed values (range ×0.70, damage ×0.50).' });
add({ id: 'range1', div: 'bases', kind: 'weapon', name: 'Cannon Range I', price: 900, d: 2, lane: -0.95, req: ['supercannon'], desc: 'Buys back the range nerf to ×0.85.' });
add({ id: 'range2', div: 'bases', kind: 'weapon', name: 'Cannon Range II', price: 2000, d: 3, lane: -0.95, req: ['range1'], desc: 'Range back to ×1.0.' });
add({ id: 'power1', div: 'bases', kind: 'weapon', name: 'Cannon Power I', price: 900, d: 2, lane: -0.69, req: ['supercannon'], desc: 'Buys back the damage nerf to ×0.75.' });
add({ id: 'power2', div: 'bases', kind: 'weapon', name: 'Cannon Power II', price: 2000, d: 3, lane: -0.69, req: ['power1'], desc: 'Damage back to ×1.0.' });
// ── BASES: defense pods + pod weapons
[['pod1', 'Pod 1', 'front starboard', 800, null], ['pod2', 'Pod 2', 'front port', 1600, null], ['pod3', 'Pod 3', 'rear starboard', 3000, 1], ['pod4', 'Pod 4', 'rear port', 5000, 3]]
  .forEach(([id, nm, where, p, portals], i) => add({ id, div: 'bases', kind: 'pod', name: nm, sub: where, price: p, d: 1 + i, lane: -0.4,
    req: i ? ['pod' + i] : [], gate: portals ? { portals } : null,
    desc: 'Opens the ' + where + ' corner pod on every base model. Each open pod mounts one pod weapon, chosen before battle.' }));
for (const [id, nm, p, d, lane, role, tg, rg, out] of [
  ['gunpod', 'Gun Pod', 0, 1.8, -0.22, 'close defence', 'light ground + air', '4', '20 dps'],
  ['rpgpod', 'RPG Pod', 1800, 2.6, -0.12, 'splash vs clusters', 'ground', '6 · aoe 1.0', '26 dps'],
  ['repairpod', 'Repair Pod', 1500, 3.4, -0.22, 'mends structures', 'own structures', '4', 'heals 8/s'],
  ['sampod', 'SAM Pod', 3200, 4.2, -0.12, 'guided anti-air', 'air', '8', '30 dps']]) {
  add({ id, div: 'bases', kind: 'podw', name: nm, price: p || undefined, free: !p, d, lane, req: ['pod1'],
    ws: [['ROLE', role], ['TARGETS', tg], ['RANGE', rg], ['OUTPUT', out]],
    desc: (p ? 'Pod weapon. ' : 'Comes free with Pod 1. ') + 'Fires from its corner pod, shares the base\'s HP, scales with the base model\'s Attack and Range.' });
}
// ── BASES: base models — each landing craft, a +50 / −10 trade (Tech-Tree-Design §3.1)
export const CRAFTS = Object.freeze([
  ['ironhoard', 'Ironhoard Casemate', 'Ground', 'Verdance', 'hold the line', 2000, null, [10, 25, 0, 15, 0, -10, 0], 'twin rotary anti-troop guns', 'lc_ground'],
  ['skylark', 'Skylark Carrier', 'Air', 'Florael', 'fast economy, reach', 2000, 'florael', [15, -10, 10, 5, 0, 20, 0], 'anti-aircraft missile pods', 'lc_air'],
  ['sterling', 'Sterling Vault', 'High Tech', 'Ochre', 'cheap upgrades, shield', 2500, 'ochre', [-10, 20, 0, 0, 20, 0, 10], 'three-prong shield projector', 'lc_hightech'],
  ['siegeworks', 'Siegeworks Emplacement', 'Artillery', 'Kessra', 'out-range everything', 2500, 'kessra', [10, 0, 25, 15, 0, -10, 0], 'four-tube mortar', 'lc_artillery'],
  ['tideborn', 'Tideborn Ark', 'Water', 'Rime', 'the gatherer', 3000, 'rime', [-10, 10, 10, 0, 0, 10, 20], 'harpoon rocket rack', 'lc_water'],
  ['sanctum', 'Sanctum of the Flame', 'Arcane', 'Cinder', 'strong base, dear towers', 3000, 'cinder', [20, 15, 0, 15, -10, 0, 0], 'halo shield spire', 'lc_arcane'],
  ['lumenlander', 'Lumen Survey Lander', 'Space Tech', 'Lumen', 'long-range precision', 3500, 'lumen', [0, -10, 20, 10, 10, 10, 0], 'twin-rail railgun', 'lc_space'],
  ['hollow', 'Hollow Choir', 'Dark Energy', 'Xenthe', 'glass cannon', 3500, 'xenthe', [25, -10, 0, 25, 0, 0, 0], 'corruption mortar', 'lc_dark'],
  ['brood', 'Brood Hive', 'Greenies', 'Vexmire', 'swarm economy', 4000, 'vexmire', [0, -10, 0, 0, 15, 15, 20], 'spore rockets', 'lc_greenies'],
]);
CRAFTS.forEach(([id, nm, fac, planet, plays, p, portal, stats, roof, craft], i) => add({ id, div: 'bases', kind: 'craft', name: nm, sub: fac + ' · ' + planet,
  price: p, d: i % 2 ? 6.0 : 4.9, lane: 0.12 + i * 0.104, req: portal ? ['portal_' + portal] : [], gate: { win: planet }, stats, plays, roof, craft,
  desc: 'Base model — equip it before a battle and this craft is the one that lands. Plays as: ' + plays + '. Roof weapon: ' + roof + '.' }));

// ── MAP: the Map 3 milestone, portals (nested against the base models so the links don't cross), intel
add({ id: 'map3', div: 'map', kind: 'milestone', name: 'Map 3 Victory', sub: 'Campaign milestone', d: 1, lane: -0.25, milestone: true,
  desc: 'Beat Map 3 on a planet you already hold. Not bought — won. It opens the portal codes.' });
export const PORTALS = Object.freeze([['vexmire', 'Vexmire', 'Greenies'], ['xenthe', 'Xenthe', 'Dark Energy'], ['lumen', 'Lumen', 'Space Tech'],
  ['cinder', 'Cinder', 'Arcane'], ['rime', 'Rime', 'Water'], ['kessra', 'Kessra', 'Artillery'], ['ochre', 'Ochre', 'High Tech'], ['florael', 'Florael', 'Air']]);
PORTALS.forEach(([k, nm, fac], i) => add({ id: 'portal_' + k, div: 'map', kind: 'portal', name: 'Portal: ' + nm, sub: fac + ' homeworld',
  d: i % 2 ? 3.5 : 2.4, lane: -0.92 + i * 0.205, req: ['map3'], portal: true,
  desc: 'The code to enter ' + nm + ' from the galaxy map. Codes get dearer the more you hold: 1,000 for the first, +500 each after — buy them in any order.' }));
add({ id: 'mining', div: 'map', kind: 'item', name: 'Mining Drone', price: 1500, d: 1.4, lane: 0.84, desc: 'An autonomous miner: +5 gold/s without a harvester.' });
add({ id: 'ewn', div: 'map', kind: 'item', name: 'Early Warning Net', price: 2600, d: 2.6, lane: 0.84, desc: 'Shows the next wave\'s composition before it deploys.' });

// ── OUTPOST (coming soon) — ghosts, never counted or bought
['Outpost Hub', 'Forward Relay', 'Supply Depot', 'Sensor Spire', 'Outpost Walls'].forEach((nm, i) =>
  add({ id: 'op' + i, div: 'outpost', kind: 'ghost', name: 'Classified', d: [1.4, 2.6, 3.2, 4.3, 5.2][i], lane: [-0.1, -0.55, 0.45, -0.2, 0.4][i], soon: true,
    desc: 'Outposts are coming soon: forward bases you build on the map between battles.' }));

for (const n of N) { n.req = n.req || []; n.kids = []; }
export const TECH_BY_ID = Object.freeze(Object.fromEntries(N.map((n) => [n.id, n])));
for (const n of N) for (const r of n.req) TECH_BY_ID[r].kids.push(n.id);
for (const n of N) { Object.freeze(n.req); Object.freeze(n.kids); Object.freeze(n); }
export const TECH_NODES = Object.freeze(N);
/** The 57 things a player buys (not the free starting kit, the Gun Pod, the milestone or the Outpost ghosts). */
export const BUYABLE = Object.freeze(N.filter((n) => !n.free && !n.soon && !n.milestone).map((n) => n.id));

// ════════════════════════════════════════════════ rules ════════════════════════════════════════════════
export function startingOwned() { return new Set(N.filter((n) => n.start).map((n) => n.id)); }
export const portalsOwned = (owned) => N.reduce((k, n) => k + (n.portal && owned.has(n.id) ? 1 : 0), 0);
/** What the node costs now. Portals: by how many codes are already held. */
export function techPrice(n, ctx) {
  if (n.portal) return ctx.owned.has(n.id) ? ((ctx.paid && ctx.paid[n.id]) || 0) : PORTAL_BASE_PRICE + PORTAL_STEP * portalsOwned(ctx.owned);
  return n.price || 0;
}
/** The node's gates as [{ txt, ok }]. */
export function techGates(n, ctx) {
  const out = [], g = n.gate || {}, held = portalsOwned(ctx.owned);
  if (g.portals) out.push({ txt: g.portals + (g.portals > 1 ? ' portal codes owned' : ' portal code owned') + ' (' + held + ')', ok: held >= g.portals });
  if (g.win) {
    const ok = ctx.hasWin ? !!ctx.hasWin(g.win) : true;
    out.push({ txt: '1 win on ' + g.win + (n.req.length ? '' : ' — your home planet') + (ctx.hasWin ? '' : ' (assumed in the sandbox)'), ok });
  }
  return out;
}
/** 'owned' | 'ready' (can buy now) | 'short' (only gold missing) | 'locked' | 'soon'. */
export function techStatus(n, ctx) {
  if (n.soon) return 'soon';
  if (ctx.owned.has(n.id)) return 'owned';
  const met = n.req.every((r) => ctx.owned.has(r)) && techGates(n, ctx).every((g) => g.ok);
  if (!met) return 'locked';
  if (n.milestone) return 'ready';
  return ctx.bank >= techPrice(n, ctx) ? 'ready' : 'short';
}
/** The ids a player could buy right now (badges read this). */
export function readyIds(ctx) { return BUYABLE.filter((id) => techStatus(TECH_BY_ID[id], ctx) === 'ready'); }
/** Free nodes (the Gun Pod) come and go with their prerequisites. Mutates and returns `owned`. */
export function settleFree(owned) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of N) {
      if (!n.free || n.start) continue;
      const met = n.req.every((r) => owned.has(r));
      if (met && !owned.has(n.id)) { owned.add(n.id); changed = true; }
      if (!met && owned.has(n.id)) { owned.delete(n.id); changed = true; }
    }
  }
  return owned;
}
/** Can this owned node be refunded? '' = yes, else the reason. */
export function refundBlock(n, ctx) {
  if (!ctx.owned.has(n.id) || n.free || n.milestone || n.soon) return 'Not refundable.';
  const deps = n.kids.filter((k) => ctx.owned.has(k) && !TECH_BY_ID[k].free);
  if (deps.length) return 'Refund blocked — ' + deps.map((k) => TECH_BY_ID[k].name).join(', ') + ' depends on it.';
  if (n.portal) {
    const held = portalsOwned(ctx.owned);
    const need = N.find((m) => m.gate && m.gate.portals && ctx.owned.has(m.id) && m.gate.portals >= held);
    if (need) return 'Refund blocked — ' + need.name + ' needs ' + need.gate.portals + ' portal codes.';
  }
  return '';
}
export const countOwned = (owned, div) => BUYABLE.reduce((k, id) => k + (owned.has(id) && (!div || (TECH_BY_ID[id].div === div && TECH_BY_ID[id].kind !== 'ult')) ? 1 : 0), 0);
