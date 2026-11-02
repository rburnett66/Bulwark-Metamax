/**
 * src/menu/missionView.js — the Mission Log's look as pure data + HTML strings [MM-story_mvyqoo07_f] [MM-story_mvyqoplz_g].
 * docs/16 Bulwark MM/design/Mission-Log-Design.md, drawn to match design/mission-log/Mission-Log-Design.html.
 *
 * (save, catalog, ctx) → view models → HTML. No DOM and no save writes here, so node tests read exactly what the player
 * will see. missionLog.js mounts it and owns the clicks.
 */
import { logMission, missionStatus, progress, atRisk, factionOfPlanet, alignmentBand } from '../save/missions.js';
import { lockedMissions, gateMet, shipArrived } from '../save/missionFlow.js';
import { LOYALTY_TIERS } from '../save/contracts.js';
import { ICONS, FACTIONS as VOICES, HOOD_PORTRAIT } from '../comm/voice.js';
import { portraitSlug } from '../comm/commCard.js';
import { TECH_BY_ID } from '../data/techtree.js';
import { PLANETS } from '../data/planets.js';

export const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const use = (id, cls = 'i') => `<svg class="${cls}"><use href="#${id}"/></svg>`;
const num = (n) => Math.round(n).toLocaleString('en-US');

/** The status language: one hue + one glyph per state, never colour alone (design §2). */
export const STATUS = Object.freeze({
  new: { n: 'New', g: 's-new', v: '--s-new' }, active: { n: 'Active', g: 's-active', v: '--s-active' },
  risk: { n: 'At risk', g: 's-risk', v: '--s-risk' }, ready: { n: 'Ready', g: 's-ready', v: '--s-ready' },
  failed: { n: 'Failed', g: 's-failed', v: '--s-failed' }, done: { n: 'Completed', g: 's-done', v: '--s-done' },
  locked: { n: 'Locked', g: 's-locked', v: '--s-locked' },
});
export const ORDER = Object.freeze({ ready: 0, risk: 1, new: 2, active: 3, locked: 4, failed: 5, done: 6 });
const GROUP = Object.freeze({ ready: 'Ready to collect', risk: 'Needs attention', new: 'Newly logged', active: 'In progress', locked: 'Locked — next steps' });
export const TYPE_ICON = Object.freeze({ campaign: 't-campaign', faction: 't-contract', contract: 't-contract', favour: 't-favour', defend: 't-defend', haul: 't-haul', bounty: 't-bounty', survey: 't-survey' });
export const REWARD_ICON = Object.freeze({ gold: 'r-gold', xp: 'r-xp', resource: 'r-crystal', tech_unlock: 'r-research', alignment: 'r-stars', loyalty: 'r-loyalty', penalty: 'r-penalty' });
export const TIER_VAR = Object.freeze({ common: '--r-common', uncommon: '--r-uncommon', rare: '--r-rare', epic: '--r-epic' });
export const TIER_NAME = Object.freeze({ common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic' });
const ALIGN = Object.freeze([
  { c: 'AG', n: 'Angelic Good', t: 'Zealot', col: '#7fe0b0' }, { c: 'PG', n: 'Pure Good', t: 'Zealot', col: '#7fd08a' }, { c: 'G', n: 'Good', t: 'Committed', col: '#a6cf7a' },
  { c: 'CG', n: 'Chaotic Good', t: 'Free spirit', col: '#cfd07a' }, { c: 'N', n: 'Neutral', t: 'Unaligned', col: '#9aa6b4' }, { c: 'CE', n: 'Chaotic Evil', t: 'Free spirit', col: '#e0a46a' },
  { c: 'E', n: 'Evil', t: 'Committed', col: '#e2866a' }, { c: 'PE', n: 'Pure Evil', t: 'Zealot', col: '#e06a62' }, { c: 'DE', n: 'Dark Evil', t: 'Zealot', col: '#c9485f' },
]);

export const factionColor = (key) => (VOICES[key] && VOICES[key].color) || '#a98cff';
export const factionName = (key) => (VOICES[key] && VOICES[key].name) || 'Unaffiliated';
export const fsvg = (key) => (ICONS[key] || ICONS.unknown).replace('<svg ', '<svg class="i fi" ');
export const homeworld = (key) => (PLANETS[key] && PLANETS[key].name) || '—';

/** A catalogue mission as a record that is not in the save: how a Locked row reads. */
function previewRecord(def) {
  const sandbox = { missions: [], progress: { battles: 0 } };
  const rec = logMission(sandbox, def, { now: 0 });
  rec.view = def.view || [];
  return rec;
}

export function missionRows(s, catalog, ctx) {
  const rows = (s.missions || []).map((m) => ({ m, status: missionStatus(m, s) }));
  for (const def of lockedMissions(s, catalog, ctx)) rows.push({ m: previewRecord(def), status: 'locked' });
  return rows;
}

export const TABS = Object.freeze([
  { k: 'active', n: 'Current', f: (st) => ['ready', 'risk', 'new', 'active', 'locked'].includes(st) },
  { k: 'ready', n: 'Ready', f: (st) => st === 'ready' },
  { k: 'archive', n: 'Archive', f: (st) => st === 'done' || st === 'failed' },
]);
const EMPTY = { active: 'No missions yet. Land on a planet to get your first orders.', ready: 'Nothing to collect yet. Finish a mission and its rewards wait aboard the capital ship.', archive: 'Nothing here yet. Collected and failed missions are kept here.' };

/** Claimable first, then the rest in status order; steady within a status. */
export function sortRows(rows) {
  return rows.map((r, i) => [r, i]).sort((a, b) => ORDER[a[0].status] - ORDER[b[0].status] || a[1] - b[1]).map((x) => x[0]);
}

export function barHtml(have, need, st, big = false) {
  const cells = Math.ceil(need), filled = Math.floor(Math.min(have, need));
  const head = `class="bar${cells <= 14 ? '' : ' cont'} st-${st}${big ? ' big' : ''}" style="--sc:var(${STATUS[st].v})" role="progressbar" aria-valuemin="0" aria-valuemax="${need}" aria-valuenow="${Math.min(have, need)}"`;
  if (cells <= 14) return `<div ${head}>${Array.from({ length: cells }, (_, i) => `<span class="seg${i < filled ? ' f' : ''}"></span>`).join('')}</div>`;
  const pct = need ? (Math.min(have, need) / need) * 100 : 0;
  return `<div ${head}><span class="fill" style="width:${pct}%"></span>${[25, 50, 75].map((t) => `<span class="tick" style="left:${t}%"></span>`).join('')}</div>`;
}
export const tagHtml = (st) => `<span class="tag" style="--sc:var(${STATUS[st].v})">${use(STATUS[st].g)}${STATUS[st].n}</span>`;
const kickHtml = (m, catalog) => {
  const total = catalog.missions.filter((d) => d.questLine === m.questLine && d.variant === m.variant).length;
  return `<span class="kick"><span class="role${m.role === 'secondary' ? ' r2' : ''}">${m.role === 'primary' ? 'Primary' : 'Secondary'}</span>${m.variant ? `<span class="var-${m.variant[0]}">${m.variant === 'light' ? 'Light' : 'Shadow'}</span>` : ''}<span class="stp">Step ${m.step} / ${total}</span></span>`;
};

/** The reward as drawn: icon, colour, amount, label. */
export function rewardView(r, m, catalog) {
  if (r.kind === 'gold') return { icon: REWARD_ICON.gold, color: 'var(--gold)', amount: num(r.amount), label: 'Gold' };
  if (r.kind === 'xp') return { icon: REWARD_ICON.xp, color: 'var(--cyan2)', amount: num(r.amount), label: 'Commander XP' };
  if (r.kind === 'resource') {
    const res = (catalog.resources || []).find((x) => x.name === r.target);
    return { icon: REWARD_ICON.resource, color: `var(${TIER_VAR[res ? res.tier : 'common']})`, amount: num(r.amount), label: r.target };
  }
  if (r.kind === 'tech_unlock') {
    const n = TECH_BY_ID[r.target], t = (catalog.techUnlocks || {})[r.target];
    return { icon: REWARD_ICON.tech_unlock, color: 'var(--cyan2)', amount: 'Unlock', label: (n ? n.name : r.target) + (t && t.price ? ' · ' + num(t.price) + ' gold' : '') };
  }
  if (r.kind === 'alignment') return { icon: REWARD_ICON.alignment, color: '#7fe0b0', amount: (r.amount > 0 ? '+' : '') + r.amount, label: 'Alignment' };
  if (r.kind === 'loyalty') return { icon: REWARD_ICON.loyalty, color: factionColor(m.giver.faction), amount: (r.amount > 0 ? '+' : '') + r.amount, label: 'Loyalty' };
  throw new Error('missionView: unknown reward kind "' + r.kind + '"');
}

export function rowHtml(row, catalog, selectedId) {
  const { m, status: st } = row, g = m.giver, p = progress(m);
  const views = m.rewards.map((r) => rewardView(r, m, catalog));
  const rws = views.slice(0, 3).map((v) => `<span class="rwi" style="--rc:${v.color}" title="${esc(v.amount + ' ' + v.label)}">${use(v.icon)}</span>`).join('') + (views.length > 3 ? `<span class="rwi more">+${views.length - 3}</span>` : '');
  const right = st === 'ready' ? 'Collect' : st === 'failed' ? 'Failed' : st === 'done' ? 'Done' : st === 'locked' ? 'Locked' : `${num(p.have)}/${num(p.need)}`;
  return `<button class="row st-${st}" role="option" aria-selected="${m.id === selectedId}" data-id="${esc(m.id)}" style="--sc:var(${STATUS[st].v});--fc:${factionColor(g.faction)}">
  <span class="badge">${use(TYPE_ICON[m.type] || 't-contract')}</span>
  <span class="mid">${kickHtml(m, catalog)}<span class="title">${esc(m.title)}</span><span class="sub">${fsvg(g.faction)}<span>${esc(g.name)} · ${esc(m.planet)}</span></span></span>
  <span class="right">${tagHtml(st)}<span class="rw">${rws}</span></span>
  <span class="prow">${barHtml(p.have, p.need, st)}<span class="pct num">${right}</span></span></button>`;
}

export function tabsHtml(rows, tab) {
  return TABS.map((t) => {
    const k = rows.filter((r) => t.f(r.status)).length;
    return `<button class="tab" role="tab" aria-selected="${t.k === tab}" data-tab="${t.k}">${t.k === 'ready' && k ? '<span class="dot"></span>' : ''}${t.n} <b class="num">${k}</b></button>`;
  }).join('');
}

export function summaryHtml(rows) {
  const cur = rows.filter((r) => TABS[0].f(r.status)).length, ready = rows.filter((r) => r.status === 'ready').length;
  return `<b class="num">${cur}</b> current<br><b class="num">${ready}</b> to collect`;
}

export function listHtml(rows, catalog, tab, selectedId) {
  const t = TABS.find((x) => x.k === tab);
  const items = sortRows(rows.filter((r) => t.f(r.status)));
  if (!items.length) return `<div class="empty">${use('i-log')}${EMPTY[tab]}</div>`;
  let html = '', last = '';
  for (const r of items) {
    const grp = tab === 'archive' ? STATUS[r.status].n : GROUP[r.status];
    if (grp !== last) { html += `<div class="grp">${grp}</div>`; last = grp; }
    html += rowHtml(r, catalog, selectedId);
  }
  return html;
}
