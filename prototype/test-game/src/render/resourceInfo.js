/**
 * src/render/resourceInfo.js — the card that describes a resource field on the map [MM-story_mw2xo93o_2].
 *
 * Owner 2026-11-04: "I should be able to click on map resources and see a description".
 *
 * Clicking a crystal still sends a harvester (input.js); it now also opens this card, which follows the field live:
 * the planet's name for that resource and its description (data/planets.js), its tier, what is left in the field,
 * what one unit pays, how much of the Collective contract is still open for the tier, how many harvesters are on it,
 * and when a spent field grows back. Pure model + HTML; hud.js mounts it.
 */
import { PLANETS } from '../data/planets.js';
import { resourceId, resourceIconHtml } from '../data/resourceIcons.js';
import { TIER_COLOR } from './resourceSummary.js';

const COLOR_TIER = Object.freeze({ blue: 'common', yellow: 'uncommon', red: 'rare', green: 'epic' });
const TIER_LABEL = Object.freeze({ common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic' });
const ROLE_LABEL = Object.freeze({ primary: 'Main field — grows back after it is harvested', premium: 'Deep field — the planet\'s prized resource', quest: 'Rare find — counts toward the mission objectives' });

/** The planet record for a planet name ('Verdance') or key ('ground'); null when unknown. */
export function planetFor(planet) {
  if (!planet) return null;
  if (PLANETS[planet]) return PLANETS[planet];
  return Object.values(PLANETS).find((p) => p.name === planet) || null;
}

const f = (n) => Math.round(n).toLocaleString('en-US');

/**
 * Everything the card shows for `nodeId`, read from the sim state. `planet` = the battle planet's name or key.
 * Returns null when the node is gone.
 */
export function resourceInfoModel(state, nodeId, planet) {
  const nodes = (state && state.resourceNodes) || [];
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const tier = COLOR_TIER[node.color] || 'common';
  const P = planetFor(planet);
  const res = P && P.resources && P.resources[tier];
  const name = (res && res.name) || TIER_LABEL[tier] + ' crystal';
  const field = nodes.filter((n) => n.fieldId === node.fieldId);
  const left = field.reduce((a, n) => a + Math.max(0, n.remaining || 0), 0);
  const total = field.reduce((a, n) => a + (n.units || 0), 0);
  const wave = Math.max(1, (state.waves && state.waves.current) || 1);
  const revealed = node.wave <= Math.min(8, wave);
  let harvesters = 0;
  if (state.units) for (const u of state.units.values()) if (u.isHarvester && u.hp > 0 && u.fieldId === node.fieldId) harvesters++;
  const regrowIn = field.reduce((m, n) => (n.respawnAt != null ? Math.min(m, Math.max(0, n.respawnAt - (state.time || 0))) : m), Infinity);
  const c = state.contract;
  const contract = c ? { quota: c.quota[tier] || 0, sold: c.sold[tier] || 0, kept: c.kept[tier] || 0 } : null;
  return {
    id: node.id, tier, tierLabel: TIER_LABEL[tier], color: TIER_COLOR[tier], name, iconId: res ? resourceId(res.name) : null,
    note: (res && res.note) || '', planet: P ? P.name : null, role: node.role, roleLabel: ROLE_LABEL[node.role] || '',
    cells: field.length, left, total, valuePerUnit: node.valuePerUnit || 0, respawns: !!node.respawns,
    regrowIn: Number.isFinite(regrowIn) ? regrowIn : null, harvesters, revealed, revealWave: node.wave, contract,
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

/** The card's rows: [label, value]. A mode's card (hud.js cbs.resourceInfo) may carry its own `rows`. */
export function resourceInfoRows(m) {
  if (Array.isArray(m.rows)) return m.rows;
  const rows = [];
  if (!m.revealed) rows.push(['Status', `Opens in wave ${m.revealWave}`]);
  rows.push(['Field', `${f(m.left)} of ${f(m.total)} left · ${m.cells} crystal${m.cells === 1 ? '' : 's'}`]);
  if (m.contract) {
    const open = Math.max(0, m.contract.quota - m.contract.sold);
    rows.push(['Contract', open > 0 ? `${f(m.valuePerUnit)} gold a unit · Collective buys ${f(open)} more` : 'Quota met · the rest is yours to keep']);
  } else rows.push(['Value', `${f(m.valuePerUnit)} gold a unit`]);
  rows.push(['Harvesters', m.harvesters ? String(m.harvesters) + ' working it' : 'none — tap the field to send one']);
  if (m.respawns) rows.push(['Regrows', m.regrowIn != null ? `in ${Math.ceil(m.regrowIn)} s` : 'yes, when harvested']);
  return rows;
}

/** The card's inner HTML. */
export function resourceInfoHtml(m) {
  if (!m) return '';
  const icon = m.iconId ? resourceIconHtml(m.iconId, 'ri') : '<i class="ri dot"></i>';
  return `<button class="x" type="button" aria-label="Close">×</button>` +
    `<div class="hd">${icon}<div class="tt"><div class="nm">${esc(m.name)}</div>` +
    `<div class="sb"><span class="tier">${esc(m.tierLabel)}</span>${m.planet ? ' · ' + esc(m.planet) : ''}</div></div></div>` +
    (m.note ? `<p class="note">${esc(m.note)}</p>` : '') +
    (m.roleLabel ? `<div class="role">${esc(m.roleLabel)}</div>` : '') +
    `<div class="rows">${resourceInfoRows(m).map(([k, v]) => `<div class="r"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>`;
}

export const RESOURCE_INFO_CSS = `
/* between the minimap and the fullscreen button, above both (hud.js: THE OBJECT WINDOW, owner 2026-11-09) */
.bw-resinfo { position:absolute; left:var(--obj-left, 144px); right:var(--obj-right, 96px); margin:0 auto; width:auto; max-width:380px; box-sizing:border-box;
  bottom:calc(6px + env(safe-area-inset-bottom, 0px)); z-index:68;
  pointer-events:auto; display:none; box-sizing:border-box; padding:12px 14px 10px; border-radius:10px;
  background:linear-gradient(180deg, rgba(16,22,30,.96), rgba(10,14,20,.96)); border:1px solid #3a4a5a;
  border-top:3px solid var(--c, #58a6ff); box-shadow:0 10px 30px rgba(0,0,0,.45); font-family:Rajdhani, system-ui, sans-serif; color:#dbe6f0; }
.bw-resinfo.on { display:block; }
.bw-resinfo .x { position:absolute; right:6px; top:4px; width:32px; height:32px; border:0; background:none; color:#8fa4b8; font-size:22px; cursor:pointer; }
.bw-resinfo .x:focus-visible { outline:2px solid #7af0ff; border-radius:6px; }
.bw-resinfo .hd { display:flex; gap:10px; align-items:center; padding-right:28px; }
.bw-resinfo .ri { width:44px; height:44px; flex:none; border-radius:8px; object-fit:contain; background:rgba(255,255,255,.04); }
.bw-resinfo .ri.dot { display:block; background:var(--c, #58a6ff); width:18px; height:18px; border-radius:50%; margin:13px; }
.bw-resinfo .nm { font:800 17px/1.1 Orbitron, Rajdhani, sans-serif; letter-spacing:.02em; color:#fff; }
.bw-resinfo .sb { font-size:13px; color:#8fa4b8; margin-top:2px; }
.bw-resinfo .tier { color:var(--c, #58a6ff); font-weight:700; }
.bw-resinfo .note { margin:8px 0 4px; font-size:14px; line-height:1.35; color:#c8d6e2; }
.bw-resinfo .role { font-size:12px; color:#8fa4b8; margin-bottom:6px; }
.bw-resinfo .rows { border-top:1px solid #243140; padding-top:6px; display:grid; gap:2px; }
.bw-resinfo .r { display:flex; justify-content:space-between; gap:12px; font-size:13px; }
.bw-resinfo .k { color:#8fa4b8; }
.bw-resinfo .v { color:#e8f2fa; font-weight:600; text-align:right; font-variant-numeric:tabular-nums; }
@media (max-height: 460px) { .bw-resinfo { padding:8px 12px 6px; } .bw-resinfo .role { display:none; } .bw-resinfo .note { margin:4px 0 2px; font-size:13px; } }
`;
