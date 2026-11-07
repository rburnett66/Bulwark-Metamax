/**
 * src/menu/missionView.js — the Mission Log's look as pure data + HTML strings [MM-story_mvyqoo07_f] [MM-story_mvyqoplz_g].
 * docs/16 Bulwark MM/design/Mission-Log-Design.md, drawn to match design/mission-log/Mission-Log-Design.html.
 *
 * (save, catalog, ctx) → view models → HTML. No DOM and no save writes here, so node tests read exactly what the player
 * will see. missionLog.js mounts it and owns the clicks.
 */
import { resourceIconHtml } from '../data/resourceIcons.js';
import { logMission, missionStatus, progress, factionOfPlanet, alignmentBand } from '../save/missions.js';
import { lockedMissions, gateMet, collectShipHere, SHIP_MAP, COLLECTIVE_SHIP } from '../save/missionFlow.js';
import { LOYALTY_TIERS, rivalOf } from '../save/contracts.js';
import { ICONS, FACTIONS as VOICES, HOOD_PORTRAIT } from '../comm/voice.js';
import { portraitSlug } from '../comm/commCard.js';
import { TECH_BY_ID } from '../data/techtree.js';
import { PLANETS } from '../data/planets.js';
import { planetKeyOf } from '../outpost/contract.js';
import { contractFor, contractReward } from '../data/collectiveContract.js';

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
export const TYPE_ICON = Object.freeze({ outpost: 't-haul', campaign: 't-campaign', faction: 't-contract', contract: 't-contract', favour: 't-favour', defend: 't-defend', haul: 't-haul', bounty: 't-bounty', survey: 't-survey' });
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
    return { icon: REWARD_ICON.resource, img: res ? res.id : null, color: `var(${TIER_VAR[res ? res.tier : 'common']})`, amount: num(r.amount), label: r.target };
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
  const rws = views.slice(0, 3).map((v) => `<span class="rwi" style="--rc:${v.color}" title="${esc(v.amount + ' ' + v.label)}">${v.img ? resourceIconHtml(v.img, 'resi') : use(v.icon)}</span>`).join('') + (views.length > 3 ? `<span class="rwi more">+${views.length - 3}</span>` : '');
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

// ── the dossier (design §5, §13) ───────────────────────────────────────────────────────────────────────────────
const GATE_KIND = Object.freeze({ rank_at_least: 'Level', tech_node: 'Tech node', planet_open: 'Planet', planet_map_unlocked: 'Map', planet_map_beaten: 'Map', planet_map_stars: 'Stars',
  replay_improves: 'Unlocked by', capital_ship_arrived: 'Capital ship', quest_step_collected: 'Quest line', loyalty: 'Loyalty',
  outpost_online: 'Outpost', ore_sold: 'Delivered', raids_held: 'Raids held', outpost_contract_step: 'Contract' });

/** The gates, met or not. A logged mission met them all when it was granted, so only a Locked one is re-judged. */
export function gateViews(row, s, ctx) {
  const { m, status } = row;
  if (status === 'done' || status === 'failed') return [];
  const seen = new Set(), out = [];
  for (const g of [...(m.view || []), ...(m.gates || [])]) {
    const key = g.cond + '|' + g.param + '|' + g.op + '|' + g.value;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = g.cond === 'alignment' ? (m.variant === 'shadow' ? 'Shadow band' : 'Light band') : GATE_KIND[g.cond] || 'Gate';
    const text = g.cond === 'tech_node' && TECH_BY_ID[g.param] ? 'Own ' + TECH_BY_ID[g.param].name : g.text;
    out.push({ kind, text, ok: status === 'locked' ? gateMet(s, g, ctx) : true });
  }
  return out;
}

const signed = (n) => (n > 0 ? '+' : '−') + Math.abs(n);
const voiceOfName = (name) => Object.keys(VOICES).find((k) => VOICES[k].name === name) || null;

/** The faction impact: loyalty with the planet's faction, a loss with its rival, an alignment shift. */
export function impactViews(m) {
  const faction = factionOfPlanet(m.planet), key = voiceOfName(faction), out = [];
  const short = (n) => String(n || '').split(' ')[0];
  if (m.impact.loyaltyPlanet) out.push({ icon: fsvg(key), color: factionColor(key), amount: signed(m.impact.loyaltyPlanet), label: short(faction) + ' loyalty' });
  if (m.impact.loyaltyRival) {
    const rival = rivalOf(faction), rk = voiceOfName(rival);
    out.push({ icon: fsvg(rk), color: 'var(--s-failed)', amount: signed(m.impact.loyaltyRival), label: short(rival) + ' loyalty (rival)' });
  }
  if (m.impact.alignment) out.push({ icon: use('r-stars'), color: '#7fe0b0', amount: signed(m.impact.alignment), label: 'Alignment' });
  return out;
}

function termsOf(row) {
  const { m, status } = row, faction = factionOfPlanet(m.planet);
  if (status === 'done') return [['Collected', m.collectAt]];
  if (status === 'failed') return [['Result', m.endReason || 'Failed']];
  const out = [];
  if (status === 'locked') out.push(['Granted on', m.grantedAt]);
  out.push(['Collect at', m.collectAt]);
  if (m.execute.some((e) => e.cond === 'next_attempt')) out.push(['One attempt', `The next battle on ${m.planet} map ${m.map}`]);
  if (m.impact.brokenPenalty) out.push(['Broken promise', signed(m.impact.brokenPenalty) + ' ' + String(faction).split(' ')[0] + ' loyalty']);
  const band = alignmentBand(m);
  if (band.min !== undefined) out.push(['Withdrawn if', `Your alignment history drops below ${band.min}`]);
  if (band.max !== undefined) out.push(['Withdrawn if', `Your alignment history rises above ${band.max}`]);
  return out;
}

/**
 * The Collective's contract on this mission's map (maps 1–3 are flown under it): what the Collective buys, that the rest
 * is kept, and what completing it pays [MM-task_mw6q0j5r_9]. → [[label, text]] or [] for any other mission.
 */
export function collectiveTermsOf(m) {
  if (!m || !m.map || m.collectAt !== COLLECTIVE_SHIP) return [];
  const key = planetKeyOf(m.planet), c = contractFor(key, m.map), r = contractReward(key, m.map);
  if (!c) return [];
  const res = (PLANETS[key] || {}).resources || {}, nm = (t) => (res[t] && res[t].name) || t;
  const n = (x) => Number(x || 0).toLocaleString('en-US');
  const out = [['Buys', `${n(c.common)} ${nm('common')} and ${n(c.uncommon)} ${nm('uncommon')} on ${m.planet} map ${m.map}, paid as you harvest`],
    ['You keep', 'everything harvested beyond the quota, and every rare and epic resource']];
  if (r) out.push(['Completed', `+${r.standing} standing with the Collective` + (r.goldBonus ? ` and ${n(r.goldBonus)} gold` : '') + ' (first time)']);
  return out;
}

/** The one line in the status hue that says what is happening. */
export function noteFor(row, s) {
  const { m, status } = row;
  if (status === 'ready') return collectShipHere(s, m) ? `${use('s-ready')}All objectives complete. Collect the rewards aboard ${esc(m.collectAt)}.` : `${use('s-ready')}All objectives complete. The rewards wait for ${esc(m.collectAt)}.`;
  if (status === 'risk') {
    if (m.objectives.some((o) => o.limit && o.have >= o.need)) return `${use('s-risk')}One more and this fails.`;
    return `${use('s-risk')}Alignment history is at ${s.alignment || 0}. One more step and this ${m.variant === 'shadow' ? 'Shadow' : 'Light'} favour is withdrawn.`;
  }
  if (status === 'failed') return `${use('s-failed')}${esc(m.endReason || 'Failed.')}`;
  if (status === 'locked') return `${use('s-locked')}Locked: meet the gates below and it is granted aboard ${esc(m.grantedAt)}.`;
  if (status === 'new') return `${use('s-new')}Logged just now. Progress counts from your next battle on ${esc(m.planet)}.`;
  if (status === 'done') return `${use('s-done')}Rewards claimed.`;
  return `${use('u-clock')}Updates after every battle on ${esc(m.planet)}.`;
}

function objectiveHtml(o, status) {
  const have = Math.round(o.have * 10) / 10;
  const ok = !o.limit && o.have >= o.need, bad = (o.limit && o.have >= o.need) || (status === 'failed' && !o.limit && !ok);
  const st = ok ? (status === 'done' ? 'done' : 'ready') : bad ? (status === 'failed' ? 'failed' : 'risk') : status === 'new' ? 'new' : status === 'done' ? 'done' : status === 'locked' ? 'locked' : 'active';
  return `<div class="obj${ok ? ' ok' : ''}${bad ? ' bad' : ''}${o.bonus ? ' opt' : ''}">${use(ok ? 'u-check' : bad ? 'u-x' : 'u-open', 'i ck')}<span class="ot">${esc(o.text)}</span>${barHtml(o.have, o.need, st)}<span class="oc num">${num(o.limit ? have : Math.min(have, o.need))} / ${num(o.need)}</span></div>`;
}

function loyaltyHtml(row, s) {
  const { m, status } = row;
  if (status === 'done' || status === 'failed' || !m.impact.loyaltyPlanet) return '';
  const faction = factionOfPlanet(m.planet), have = (s.loyalty || {})[faction] || 0, gain = m.impact.loyaltyPlanet;
  const tier = LOYALTY_TIERS.find((t) => t > have) || LOYALTY_TIERS[LOYALTY_TIERS.length - 1];
  const a = Math.max(0, Math.min(have, tier)), b = Math.max(0, Math.min(tier, have + gain)), pct = (x) => (x / tier) * 100;
  return `<div class="loy"><div class="lh"><span>${esc(String(faction).split(' ')[0])} loyalty</span><b class="num">${have} → ${have + gain}</b></div>
   <div class="lb"><span style="width:${pct(Math.min(a, b))}%"></span><em style="left:${pct(Math.min(a, b))}%;width:${pct(Math.abs(b - a))}%"></em></div>
   <div class="lt"><span>0</span><span>Tier ${LOYALTY_TIERS.indexOf(tier) + 1} unlock · ${tier}</span></div></div>`;
}

export function actionsHtml(row, s, catalog) {
  const { m, status } = row, ship = m.collectAt;
  if (status === 'ready') {
    if (!collectShipHere(s, m)) return `<div class="claimed-stamp">${use('u-clock')}Waiting for ${esc(ship)}</div><div class="shipnote">It arrives when ${esc(m.planet)} map ${SHIP_MAP} averages 3 stars.</div>`;
    const line = catalog.questLines[m.questLine];
    return `<button class="btn claim" data-act="collect">${use('s-ready')}Collect aboard ${esc(ship)}</button><div class="shipnote">Collecting continues <b>${esc(line ? line.name : m.questLine)}</b>.</div>`;
  }
  if (status === 'locked') return `<div class="claimed-stamp">${use('s-locked')}Locked</div><div class="shipnote">Granted aboard <b>${esc(m.grantedAt)}</b> once every gate is met.</div>`;
  if (status === 'done') return `<div class="claimed-stamp">${use('s-done')}Collected aboard ${esc(ship)}</div>`;
  if (status === 'failed') return `<button class="btn" data-act="dismiss">Remove from log</button>`;
  // an outpost contract (O3): ACCEPT grants the kit if it was put off aboard; after that it runs from OUTPOST
  if (m.type === 'outpost') {
    const key = planetKeyOf(m.planet);
    return s.outposts && s.outposts[key] ? `<div class="shipnote">Run it from <b>OUTPOST</b> on the main menu.</div>`
      : `<button class="btn primary" data-act="accept-outpost" data-planet="${esc(key)}">${use('s-ready')}Accept the outpost contract</button><div class="shipnote">Grants the outpost kit on ${esc(m.planet)}.</div>`;
  }
  return `<button class="btn${m.tracked ? '' : ' primary'}" data-act="track" aria-pressed="${!!m.tracked}">${use('u-pin')}${m.tracked ? 'Tracking in battle' : 'Track in battle'}</button>${m.role === 'primary' ? '' : '<button class="btn ghost" data-act="abandon">Abandon favour</button>'}`;
}

/** packs: content/dialog/voicepacks.json (null while it loads; the motivation line is simply absent until then). */
export function dossierHtml(row, s, catalog, ctx, packs = null) {
  const { m, status: st } = row, g = m.giver, p = progress(m), color = factionColor(g.faction);
  const cast = packs && packs.factions && packs.factions[g.faction] && packs.factions[g.faction].characters;
  const char = cast ? cast.find((c) => c.name === g.name) : null;
  const al = ALIGN.findIndex((a) => a.c === g.align);
  const portrait = g.faction === 'unknown' ? `<div class="sil">${HOOD_PORTRAIT}</div>` : `<img src="content/dialog/portraits/${esc(portraitSlug(g.name))}.png" alt="Portrait of ${esc(g.name)}" data-portrait>`;
  const line = catalog.questLines[m.questLine];
  const total = catalog.missions.filter((d) => d.questLine === m.questLine && d.variant === m.variant).length;
  const gates = gateViews(row, s, ctx), impact = impactViews(m);
  const outcome = st === 'failed' && m.impact.brokenPenalty && !/^Abandoned/.test(m.endReason || '')
    ? [{ icon: REWARD_ICON.penalty, color: 'var(--s-failed)', amount: signed(m.impact.brokenPenalty), label: String(factionOfPlanet(m.planet)).split(' ')[0] + ' loyalty', neg: true }]
    : m.rewards.map((r) => rewardView(r, m, catalog));
  const where = m.planet + (m.map ? ' · map ' + m.map : m.type === 'outpost' ? ' · outpost' : '') + (m.execute.some((e) => e.cond === 'next_attempt') ? ' · one attempt' : '');
  const quoted = /"/.test(m.briefing || '');
  return `<button class="dback" data-act="back">${use('u-back')}All missions</button>
 <article class="dossier st-${st}" style="--sc:var(${STATUS[st].v});--fc:${color}">
  <div class="dmain">
   <div class="dk"><span class="type">${use(TYPE_ICON[m.type] || 't-contract')}${m.role === 'primary' ? 'Primary mission' : 'Secondary mission'}${m.variant ? ' · ' + (m.variant === 'light' ? 'Light' : 'Shadow') : ''}</span>${tagHtml(st)}<span class="where">${esc(where)}</span></div>
   <h2 class="dtitle">${esc(m.title)}</h2>
   <div class="qline">${use('i-log')}${esc(line ? line.name : m.questLine)} · step ${m.step} of ${total}</div>
   <div class="dprog">${barHtml(p.have, p.need, st, true)}<span class="pct num">${Math.round(p.frac * 100)}<small>%</small></span></div>
   <div class="dnote">${noteFor(row, s)}</div>
   <div class="brief"><q${quoted ? ' style="quotes:none"' : ''}>${esc(m.briefing)}</q><div class="who">— ${esc(g.name)}</div></div>
   <div class="sec"><h3>${st === 'locked' ? 'OBJECTIVES (WHEN UNLOCKED)' : 'OBJECTIVES'}</h3>${m.objectives.map((o) => objectiveHtml(o, st)).join('')}</div>
   ${gates.length ? `<div class="sec"><h3>GATES</h3><div class="gates">${gates.map((q) => `<div class="gate ${q.ok ? 'ok' : 'no'}">${use(q.ok ? 'u-check' : 's-locked')}<span><small>${esc(q.kind)}</small>${esc(q.text)}</span></div>`).join('')}</div></div>` : ''}
   ${impact.length ? `<div class="sec"><h3>${m.role === 'secondary' ? 'FACTION IMPACT' : 'FACTION STANDING'}</h3><div class="impact">${impact.map((q) => `<div class="imp" style="--ic:${q.color}">${q.icon}<b class="num">${q.amount}</b>${esc(q.label)}</div>`).join('')}</div></div>` : ''}
   <div class="sec"><h3>${st === 'failed' ? 'OUTCOME' : 'REWARDS'}</h3><div class="rewards">${outcome.map((v) => `<div class="rwd${v.neg ? ' neg' : ''}" style="--rc:${v.color}"><span class="ri">${v.img ? resourceIconHtml(v.img, 'resi') : use(v.icon)}</span><b class="num">${esc(v.amount)}</b><small>${esc(v.label)}</small></div>`).join('')}</div></div>
   ${collectiveTermsOf(m).length && st !== 'done' && st !== 'failed' ? `<div class="sec"><h3>COLLECTIVE CONTRACT</h3><div class="terms">${collectiveTermsOf(m).map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</div></div>` : ''}
   <div class="sec"><h3>TERMS</h3><div class="terms">${termsOf(row).map(([a, b]) => `<div><b>${esc(a)}</b><span class="${/−|Broken/.test(a + b) ? 'neg' : ''}">${esc(b)}</span></div>`).join('')}</div></div>
  </div>
  <aside class="dside">
   <div class="giver">
    <div class="pframe">${portrait}<span class="edge"></span><span class="fbadge">${fsvg(g.faction)}${esc(factionName(g.faction))}</span></div>
    <div><div class="gname">${esc(g.name)}</div><div class="grole">${esc(m.grantedAt)}</div>${char && char.motivation ? `<div class="gmot">“${esc(char.motivation)}”</div>` : ''}</div>
   </div>
   <dl class="facts"><dt>Faction</dt><dd>${fsvg(g.faction)}${esc(factionName(g.faction))}</dd><dt>Homeworld</dt><dd>${esc(homeworld(g.faction))}</dd><dt>Mission</dt><dd>${esc(m.planet)}</dd></dl>
   ${al >= 0 ? `<div class="align"><div class="al-h"><span>Good</span><span>Alignment</span><span>Evil</span></div>
    <div class="rail">${ALIGN.map((a, i) => `<i class="${i === al ? 'on' : ''}" style="--c:${a.col}"></i>`).join('')}</div>
    <div class="rail-codes">${ALIGN.map((a, i) => `<span class="${i === al ? 'on' : ''}">${a.c}</span>`).join('')}</div>
    <div class="al-n" style="color:${ALIGN[al].col}">${ALIGN[al].n}<small>${ALIGN[al].t}</small></div></div>`
    : `<div class="align"><div class="al-h"><span>Good</span><span>Alignment</span><span>Evil</span></div><div class="rail">${ALIGN.map(() => '<i style="--c:#5c4f80"></i>').join('')}</div><div class="al-n" style="color:#b49cff">Unreadable<small>The Contact shows no allegiance</small></div></div>`}
   ${loyaltyHtml(row, s)}
   <div class="actions">${actionsHtml(row, s, catalog)}</div>
  </aside>
 </article>`;
}

/** The claim moment: fourteen hexes fly out. Fixed angles: nothing here needs randomness. */
export function burstHtml() {
  return `<div class="burst">${Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2, d = 90 + ((i * 37) % 60); return `<span style="--x:${(Math.cos(a) * d).toFixed(1)}px;--y:${(Math.sin(a) * d).toFixed(1)}px;animation-delay:${i * 12}ms"></span>`; }).join('')}</div>`;
}
