/**
 * src/menu/seedPods.js — the SEED PODS tab of the OUTPOST & FARM inventory [MM-story_mwabgu9v_g].
 * Design: docs/16 Bulwark MM/design/Farming-Design.md §8 (levels, the bench), §9.2 (this view). Tech plan
 * docs/tech-plan/Farming.md §5 story A10. Owner rule 5: a tab of the farm's own inventory, not of the battle INVENTORY.
 *
 * Not a second screen: a tab VIEW the inventory screen (menu/inventoryScreen.js) draws on its own markup, tabs and
 * selection, on the farm store's bands (save/stores.js storeBands). Not a second ledger: every count is s.pods, read and
 * written through farm/pods.js (podCount, podsOfCrop, benchUpgrade).
 *
 * Words (Farming-Design §8.2, D4): a pod LEVEL is a coloured badge (POD_LEVELS[].colour); the crop's TIER is the ring
 * round its icon. Each crop is a row of five level slots, Common → Legendary, empty slots dimmed.
 * Future, not here (advanced farming): mystery pods, enhancements, best-method charts, filters.
 */
import { resourceIconHtml } from '../data/resourceIcons.js';
import { POD_LEVELS, MAX_POD_LEVEL, FARM, FARM_CONTRACTS, podLevel, cropOf, growSec, yieldOf } from '../data/farm.js';
import { RESOURCE_TIERS, PLANETS } from '../data/planets.js';
import { podCount, podsOfCrop, benchUpgrade, unitsPerPod, BATTLE_POD_LEVEL } from '../farm/pods.js';
import { bankOf } from '../save/save.js';
import { bandHtml, bandDetailHtml } from './inventoryScreen.js';
import { esc, TIER_VAR, TIER_NAME } from './missionView.js';

const num = (n) => Math.round(n).toLocaleString('en-US');
const dec = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US');
const levelName = (L) => podLevel(L).name;

/** A pod level's badge: a shape in the level's colour, named for screen readers (never colour alone: also its slot). */
export const podBadgeHtml = (L, cls = 'plv') => `<i class="${cls}" style="--lc:${podLevel(L).colour}" title="${esc(levelName(L))} pod" aria-hidden="true"></i>`;
/** "[badge] Rare" — the badge and the level's name, for the legend and the detail panel. */
const named = (L) => `<span class="plvn">${podBadgeHtml(L)}${esc(levelName(L))}</span>`;

/** "2 h", "7 h 30 min", "45 min". */
export function hoursText(sec) {
  const m = Math.round(sec / 60), h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`;
}

/** The level the panel shows for a crop when the player has not picked one: the lowest level held, else Common. */
export function defaultLevel(s, cropId) {
  for (let L = 1; L <= MAX_POD_LEVEL; L++) if (podCount(s, cropId, L)) return L;
  return 1;
}

/** Gold one harvested unit is worth at a level: the level's multiple × the resource's battle value, null where unknown. */
export function podValue(crop, L) {
  const base = crop.newMaterial ? null : (RESOURCE_TIERS[crop.tier] || {}).value;
  return base == null ? null : podLevel(L).value * base;
}

/** The list: the farm store's bands, each crop a row of five level slots with its count. */
export function seedPodsListHtml(bands, s, selected, level) {
  const legend = `<div class="plegend"><span>Pod level</span>${POD_LEVELS.map((l) => named(l.level)).join('')}<span class="plring">ring = crop tier</span></div>`;
  return legend + bands.map((b) => {
    const rows = b.resources.map((c) => {
      const total = podsOfCrop(s, c.id);
      const slots = POD_LEVELS.map(({ level: L, name }) => {
        const n = podCount(s, c.id, L), on = c.id === selected && L === level;
        return `<button class="pslot${n ? '' : ' nil'}" data-inv-id="${esc(c.id)}" data-pod-lv="${L}" aria-selected="${on}" aria-label="${esc(c.name)}, ${esc(name)} pods: ${b.open ? n : 'locked'}" style="--lc:${podLevel(L).colour}">${podBadgeHtml(L)}<b class="num">${b.open ? num(n) : '—'}</b></button>`;
      }).join('');
      return `<div class="podrow${total ? '' : ' none'}" style="--rc:var(${TIER_VAR[c.tier]})"><button class="pcrop" data-inv-id="${esc(c.id)}" aria-selected="${c.id === selected}">${resourceIconHtml(c.id, 'gem3 resi pring')}
     <span class="rtx"><b>${esc(c.name)}</b><small>${TIER_NAME[c.tier]} tier</small></span></button><div class="pslots">${slots}</div></div>`;
    }).join('');
    const held = b.resources.reduce((a, c) => a + podsOfCrop(s, c.id), 0);
    return bandHtml(b, `<div class="podrows">${rows}</div>`, held, 0);
  }).join('');
}

/** Where a crop's pods come from (Farming-Design §9.1, the sources this build has). */
function sourcesHtml(c) {
  const out = [];
  if (c.newMaterial) out.push(`Battles: none. ${esc(c.planet)}'s battles carry a different material, so they drop no ${esc(c.name)} pods.`);
  else out.push(`Battles on ${esc(c.planet)}: ${named(BATTLE_POD_LEVEL)} pods, one per ${num(unitsPerPod(c.tier))} units carried home.`);
  for (const k of FARM_CONTRACTS.filter((x) => x.crop === c.id && x.podCrate)) {
    out.push(`${esc((PLANETS[k.planetKey] || {}).name || k.planetKey)} ${esc(k.code)} contract: a Pod Crate of ${num(k.podCrate)} ${named(k.podCrateLevel)} pods.`);
  }
  out.push(`The pod bench: ${num(FARM.Bench_In)} pods of one level make 1 of the next.`);
  return out.map((t) => `<li>${t}</li>`).join('');
}

/** The bench: the price of the selected level's upgrade, UPGRADE, PLANT (when the menu wires it), the last answer. */
function benchHtml(s, c, L, msg, canPlant) {
  const top = L >= MAX_POD_LEVEL, have = podCount(s, c.id, L);
  const price = top
    ? `${named(L)} is the top level.`
    : `${num(FARM.Bench_In)} × ${podBadgeHtml(L)} → 1 × ${podBadgeHtml(L + 1)} <b>${esc(levelName(L + 1))}</b> · <b class="num">${num(podLevel(L).benchGold)}</b> gold`;
  return `<div class="pbench" style="--lc:${podLevel(L).colour}"><div class="pbh">Pod bench · ${named(L)} ${esc(c.name)}</div>
   <div class="pbp">${price}</div><div class="pbhave">You hold <b class="num">${num(have)}</b> · bank <b class="num">${num(bankOf(s))}</b> gold</div>
   <div class="pbb"><button class="btn primary" data-pod-up="${esc(c.id)}" data-up-lv="${L}">Upgrade</button>${canPlant ? `<button class="btn" data-pod-plant="${esc(c.id)}" data-plant-lv="${L}"${have ? '' : ' disabled'}>Plant</button>` : ''}</div>
   ${msg ? `<p class="pbmsg ${msg.ok ? 'ok' : 'no'}" role="status">${msg.html}</p>` : ''}</div>`;
}

/** The detail panel for a crop: its pods per level, yield and value per level, where they come from, the bench. */
export function seedPodsDetailHtml(bands, s, selected, level, { back = 'All crops', msg = null, canPlant = false } = {}) {
  const src = {
    back,
    detail: (band, c) => {
      const L = level || defaultLevel(s, c.id);
      const rows = POD_LEVELS.map(({ level: l }) => {
        const v = podValue(c, l);
        return `<tr class="${podCount(s, c.id, l) ? '' : 'nil'}${l === L ? ' on' : ''}"><td>${named(l)}</td><td class="num">${num(podCount(s, c.id, l))}</td><td class="num">${num(yieldOf(c, 'traditional', l))}</td><td class="num">×${dec(podLevel(l).value)}${v == null ? '' : ` · ${dec(v)} g`}</td></tr>`;
      }).join('');
      return {
        count: podsOfCrop(s, c.id), tierLabel: TIER_NAME[c.tier] + ' tier · pods held',
        rows: [['Grows in', hoursText(growSec(c, 'traditional')) + ' · Traditional plot, every level'], ['Category', esc(c.category || '—')]],
        extra: `<table class="ptab"><thead><tr><th>Level</th><th>Held</th><th>Yield</th><th>Worth each</th></tr></thead><tbody>${rows}</tbody></table>
   ${benchHtml(s, c, L, msg, canPlant)}
   <div class="pfrom"><b>Pods come from</b><ul>${sourcesHtml(c)}</ul></div>`,
        note: 'Yield is units per Traditional plot. Worth is the level\'s multiple of the battle price' + (podValue(c, 1) == null ? '; this crop has no battle price.' : ', in gold per unit.'),
      };
    },
  };
  return bandDetailHtml(bands, selected, src, null);
}

/** What the bench said, as the panel shows it. */
export function benchMessage(r, cropId, level) {
  const c = cropOf(cropId);
  if (r.ok) return { ok: true, html: `Upgraded: ${num(FARM.Bench_In)} ${named(r.from)} pods of ${esc(c.name)} made 1 ${named(r.to)} pod, for ${num(r.gold)} gold.` };
  if (r.reason === 'top') return { ok: false, html: `${named(level)} is the top level: a ${esc(levelName(level))} pod cannot be upgraded.` };
  if (r.reason === 'pods') return { ok: false, html: `Too few pods: the bench takes ${num(r.need)} ${named(level)} pods and you hold ${num(r.have)}.` };
  return { ok: false, html: `Too little gold: this upgrade costs ${num(r.need)} gold and the bank holds ${num(r.have)}.` };
}

/**
 * The tab's view for the inventory screen (see `view` in menu/inventoryScreen.js). opts: back (the phone's back-link
 * text), onPlant(cropId, level) — PLANT is shown only when it is wired (the FARM view is story A7).
 */
export function seedPodsView({ back = 'All crops', onPlant = null } = {}) {
  let pick = { crop: null, level: 0 }, msg = null;
  const levelFor = (s, crop) => (pick.crop === crop && pick.level ? pick.level : defaultLevel(s, crop));
  return {
    list: (bands, selected, s) => seedPodsListHtml(bands, s, selected, levelFor(s, selected)),
    detail: (bands, selected, s) => seedPodsDetailHtml(bands, s, selected, levelFor(s, selected), { back, msg, canPlant: typeof onPlant === 'function' }),
    sum: (bands, s) => `<b class="num">${num(Object.keys(s.pods || {}).reduce((a, id) => a + podsOfCrop(s, id), 0))}</b> pods<br><b class="num">${num(bankOf(s))}</b> gold`,
    /** A click on the tab: a slot picks its level (the screen then selects the crop); UPGRADE and PLANT act. */
    click(t, api) {
      const d = t.dataset;
      if (d.podUp) {
        const crop = d.podUp, L = Number(d.upLv);
        let r = null;
        api.update((s) => { r = benchUpgrade(s, crop, L); });
        pick = { crop, level: L }; msg = benchMessage(r, crop, L);
        if (r.ok) api.changed();
        api.render();
        return true;
      }
      if (d.podPlant) {
        if (typeof onPlant === 'function') onPlant(d.podPlant, Number(d.plantLv));
        return true;
      }
      if (d.podLv) { pick = { crop: d.invId, level: Number(d.podLv) }; msg = null; }
      else if (d.invId) { pick = { crop: d.invId, level: 0 }; msg = null; }
      return false;
    },
  };
}
