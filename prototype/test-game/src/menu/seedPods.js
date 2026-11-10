/**
 * src/menu/seedPods.js — the SEED PODS tab of the OUTPOST & FARM inventory [MM-story_mwabgu9v_g], [MM-story_mwai5f8t_1g].
 * Design: docs/16 Bulwark MM/design/Farming-Design.md §9.2 (this view). Tech plan docs/tech-plan/Farming.md rule 9, §5
 * story A10. Owner rule 5: a tab of the farm's own inventory, not of the battle INVENTORY.
 *
 * Owner rule 9 (2026-11-10): seed pods have no level. Each crop's row shows the pods held (a plain count), the crop's
 * level now — the tech tree's (src/farm/levels.js cropLevel), the level new plantings grow at — as a badge in its
 * colour, and the next level's tech node with its price. Levels are bought in the Tech Tree (OUTPOST & FARM › SEED
 * PODS), never here. Pods are bought here, BUY 4 (one plot's worth) at one fixed price per pod (FARM.Pod_Price).
 *
 * Not a second screen: a tab VIEW the inventory screen (menu/inventoryScreen.js) draws on its own markup, tabs and
 * selection, on the farm store's bands (save/stores.js storeBands). Not a second ledger: every count is s.pods, read and
 * written through farm/pods.js (podCount, buyPods).
 *
 * Words (Farming-Design §8.2, D4): a crop LEVEL is a coloured badge (POD_LEVELS[].colour, never colour alone: its name
 * too); the crop's TIER is the ring round its icon.
 */
import { resourceIconHtml } from '../data/resourceIcons.js';
import { POD_LEVELS, FARM, FARM_CONTRACTS, MAP_CROP_LEVEL, podLevel, cropOf, growSec, yieldOf } from '../data/farm.js';
import { RESOURCE_TIERS, PLANETS } from '../data/planets.js';
import { podCount, podsHeld, buyPods, podPrice, unitsPerPod } from '../farm/pods.js';
import { unlockProgress } from '../farm/unlock.js';
import { cropLevel, nextLevelNode, cropTechUnlocked } from '../farm/levels.js';
import { bankOf } from '../save/save.js';
import { bandHtml, bandDetailHtml } from './inventoryScreen.js';
import { esc, TIER_VAR, TIER_NAME } from './missionView.js';

const num = (n) => Math.round(n).toLocaleString('en-US');
const dec = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US');
const levelName = (L) => podLevel(L).name;
/** Pods in one BUY: one plot's worth (one pod per row). */
export const BUY_PODS = FARM.Pods_Per_Plot;

/** A level's badge: a shape in the level's colour, named for screen readers (never colour alone). */
export const podBadgeHtml = (L, cls = 'plv') => `<i class="${cls}" style="--lc:${podLevel(L).colour}" title="Level ${L} · ${esc(levelName(L))}" aria-hidden="true"></i>`;
/** "[badge] L3 Rare" — the badge, the level and its name. */
const named = (L) => `<span class="plvn">${podBadgeHtml(L)}L${L} ${esc(levelName(L))}</span>`;

/** "2 h", "7 h 30 min", "45 min". */
export function hoursText(sec) {
  const m = Math.round(sec / 60), h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`;
}

/** Gold one harvested unit is worth at a level: the level's multiple × the resource's battle value, null where unknown. */
export function podValue(crop, L) {
  const base = crop.newMaterial ? null : (RESOURCE_TIERS[crop.tier] || {}).value;
  return base == null ? null : podLevel(L).value * base;
}

/** The next level's words for a crop: { html, node } — the node and its price, or the top / no chain yet. */
function nextHtml(s, c) {
  const n = nextLevelNode(s, c.id);
  if (!n) return { node: null, html: cropLevel(s, c.id) >= POD_LEVELS.length ? 'Top level' : 'More levels later' };
  return { node: n, html: `<span class="pnext">${podBadgeHtml(n.level)}${esc(n.name)}</span><b class="num">${num(n.price)}</b>g` };
}

/** The list: the farm store's bands, each crop a row — pods held, its level now, the next level and its price. */
export function seedPodsListHtml(bands, s, selected) {
  const legend = `<div class="plegend"><span>Crop level</span>${POD_LEVELS.map((l) => named(l.level)).join('')}<span class="plring">ring = crop tier</span></div>`;
  return legend + bands.map((b) => {
    const rows = b.resources.map((c) => {
      const n = podCount(s, c.id), L = cropLevel(s, c.id), next = nextHtml(s, c), id = esc(c.id), u = unlockProgress(s, c.id);
      // a crop whose pods are still locked (owner rule 10) shows its count toward the unlock instead of pods held
      const cells = (b.open && !u.open
        ? `<button class="pslot pheld plock nil" data-inv-id="${id}" aria-label="${esc(c.name)}: pods locked, ${num(Math.min(u.delivered, u.need))} of ${num(u.need)} delivered"><b class="num">${num(Math.min(u.delivered, u.need))}<i>/${num(u.need)}</i></b></button>`
        : `<button class="pslot pheld${n ? '' : ' nil'}" data-inv-id="${id}" aria-label="${esc(c.name)}: ${b.open ? num(n) : 'locked'} pods"><small>Pods</small><b class="num">${b.open ? num(n) : '—'}</b></button>`)
        + `<button class="pslot plevel" data-inv-id="${id}" style="--lc:${podLevel(L).colour}" aria-label="${esc(c.name)}: level ${L}, ${esc(levelName(L))}">${named(L)}</button>`
        + `<button class="pslot pnextc${next.node ? '' : ' nil'}" data-inv-id="${id}" aria-label="${esc(c.name)}: next level ${next.node ? esc(next.node.name) + ', ' + num(next.node.price) + ' gold' : 'none'}">${next.html}</button>`;
      return `<div class="podrow${n ? '' : ' none'}" style="--rc:var(${TIER_VAR[c.tier]})"><button class="pcrop" data-inv-id="${id}" aria-selected="${c.id === selected}">${resourceIconHtml(c.id, 'gem3 resi pring')}
     <span class="rtx"><b>${esc(c.name)}</b><small>${TIER_NAME[c.tier]} tier</small></span></button><div class="pslots pcols">${cells}</div></div>`;
    }).join('');
    const held = b.resources.reduce((a, c) => a + podCount(s, c.id), 0);
    return bandHtml(b, `<div class="podrows">${rows}</div>`, held, 0);
  }).join('');
}

/** Where a crop's pods come from (Farming-Design §9.1, the sources this build has). Pods have no level. */
function sourcesHtml(c) {
  const out = [`Buy them here: <b class="num">${num(podPrice(1))}</b> gold a pod, every crop alike.`];
  if (c.newMaterial) out.push(`Battles: none. ${esc(c.planet)}'s battles carry a different material, so they drop no ${esc(c.name)} pods.`);
  else out.push(`Battles on ${esc(c.planet)}: one pod per ${num(unitsPerPod(c.tier))} units carried home.`);
  for (const k of FARM_CONTRACTS.filter((x) => x.crop === c.id && x.podCrate)) {
    out.push(`${esc((PLANETS[k.planetKey] || {}).name || k.planetKey)} ${esc(k.code)} contract: a Pod Crate of ${num(k.podCrate)} pods.`);
  }
  return out.map((t) => `<li>${t}</li>`).join('');
}

/** The crop's level now and how the next is reached: the tech node, its price and its gate. */
function levelHtml(s, c) {
  const L = cropLevel(s, c.id), { node } = nextHtml(s, c);
  let next;
  if (!node) next = L >= POD_LEVELS.length ? `${named(L)} is the top level.` : 'More levels come with this planet\'s farming contracts.';
  else {
    const open = cropTechUnlocked(s).has(node.id);
    next = `Next: ${named(node.level)} <b>${esc(node.name)}</b> · <b class="num">${num(node.price)}</b> gold in the Tech Tree (OUTPOST &amp; FARM › SEED PODS)`
      + `<div class="pbhave">${open ? 'Unlocked: buy it in the Tech Tree.' : `Unlocked by Farming ${esc(node.unlock.contract)} on ${esc(c.planet)} ${node.unlock.state === 'complete' ? 'complete' : 'accepted'}.`}</div>`;
  }
  return `<div class="pbench" style="--lc:${podLevel(L).colour}"><div class="pbh">Crop level · ${named(L)}</div>
   <div class="pbp">New ${esc(c.name)} plantings grow at level ${L}; plots already growing keep the level they were planted at.</div>
   <div class="pbp">${next}</div>${L >= 4 ? '<div class="pbhave">Level 5 needs a trick: an Irrigated plot with water.</div>' : ''}</div>`;
}

/** BUY (one plot's worth at the fixed price), PLANT (when the menu wires it), the last answer. */
function buyHtml(s, c, msg, canPlant) {
  const have = podCount(s, c.id), gold = podPrice(BUY_PODS), u = unlockProgress(s, c.id);
  if (!u.open) {   // owner rule 10: deliver 500 of the crop to unlock its pods; the unlock gives access, not pods
    return `<div class="pbench pbuy plocked"><div class="pbh">Seed pods · ${esc(c.name)} · locked</div>
   <div class="pbp">Deliver ${num(u.need)} ${esc(c.name)} to unlock its seed pods. Every unit your harvesters bring home at the end of a map counts, and every farm sale.</div>
   <div class="pmeter" role="meter" aria-valuemin="0" aria-valuemax="${u.need}" aria-valuenow="${Math.min(u.delivered, u.need)}" aria-label="${esc(c.name)} delivered toward the unlock"><i style="width:${Math.round(100 * Math.min(1, u.delivered / u.need))}%"></i></div>
   <div class="pbhave"><b class="num">${num(Math.min(u.delivered, u.need))}</b> of <b class="num">${num(u.need)}</b> delivered</div>
   ${msg ? `<p class="pbmsg ${msg.ok ? 'ok' : 'no'}" role="status">${msg.html}</p>` : ''}</div>`;
  }
  return `<div class="pbench pbuy"><div class="pbh">Seed pods · ${esc(c.name)}</div>
   <div class="pbp"><b class="num">${num(podPrice(1))}</b> gold a pod, any crop · one plot takes ${num(FARM.Pods_Per_Plot)}</div>
   <div class="pbhave">You hold <b class="num">${num(have)}</b> · bank <b class="num">${num(bankOf(s))}</b> gold</div>
   <div class="pbb"><button class="btn primary" data-pod-buy="${esc(c.id)}" data-buy-n="${BUY_PODS}"${bankOf(s) < gold ? ' disabled' : ''}>Buy ${BUY_PODS} · ${num(gold)}g</button>${canPlant ? `<button class="btn" data-pod-plant="${esc(c.id)}"${have >= FARM.Pods_Per_Plot ? '' : ' disabled'}>Plant</button>` : ''}</div>
   ${msg ? `<p class="pbmsg ${msg.ok ? 'ok' : 'no'}" role="status">${msg.html}</p>` : ''}</div>`;
}

/** The detail panel for a crop: pods held, its level now and the next, yield and worth per level, BUY, sources. */
export function seedPodsDetailHtml(bands, s, selected, { back = 'All crops', msg = null, canPlant = false } = {}) {
  const src = {
    back,
    detail: (band, c) => {
      const now = cropLevel(s, c.id);
      const rows = POD_LEVELS.map(({ level: l }) => {
        const v = podValue(c, l);
        return `<tr class="${l > now ? 'nil' : ''}${l === now ? ' on' : ''}"><td>${named(l)}${l === MAP_CROP_LEVEL ? ' <small>= battle maps</small>' : ''}</td><td class="num">${num(yieldOf(c, 'traditional', l))}</td><td class="num">×${dec(podLevel(l).value)}${v == null ? '' : ` · ${dec(v)} g`}</td></tr>`;
      }).join('');
      return {
        count: podCount(s, c.id), tierLabel: TIER_NAME[c.tier] + ' tier · pods held',
        rows: [['Grows in', hoursText(growSec(c, 'traditional')) + ' · Traditional plot, every level'], ['Category', esc(c.category || '—')]],
        extra: `${levelHtml(s, c)}
   <table class="ptab"><thead><tr><th>Level</th><th>Yield</th><th>Worth each</th></tr></thead><tbody>${rows}</tbody></table>
   ${buyHtml(s, c, msg, canPlant)}
   <div class="pfrom"><b>Pods come from</b><ul>${sourcesHtml(c)}</ul></div>`,
        note: `Yield is units per Traditional plot. Crops from battle maps count as level ${MAP_CROP_LEVEL} (${esc(levelName(MAP_CROP_LEVEL))}). Worth is the level's multiple of the battle price`
          + (podValue(c, 1) == null ? '; this crop has no battle price.' : ', in gold per unit; the farm store sells at the base price.'),
      };
    },
  };
  return bandDetailHtml(bands, selected, src, null);
}

/** What BUY said, as the panel shows it. */
export function buyMessage(r, cropId) {
  const c = cropOf(cropId);
  if (r.ok) return { ok: true, html: `Bought ${num(r.n)} ${esc(c.name)} pods for ${num(r.gold)} gold.` };
  if (r.reason === 'locked') return { ok: false, html: `${esc(c.name)} seed pods are locked: deliver ${num(unlockProgress({}, cropId).need)} ${esc(c.name)} first.` };
  return { ok: false, html: `Too little gold: ${num(BUY_PODS)} pods cost ${num(r.need)} gold and the bank holds ${num(r.have)}.` };
}

/**
 * The tab's view for the inventory screen (see `view` in menu/inventoryScreen.js). opts: back (the phone's back-link
 * text), onPlant(cropId) — PLANT is shown only when it is wired.
 */
export function seedPodsView({ back = 'All crops', onPlant = null } = {}) {
  let msg = null;
  return {
    list: (bands, selected, s) => seedPodsListHtml(bands, s, selected),
    detail: (bands, selected, s) => seedPodsDetailHtml(bands, s, selected, { back, msg, canPlant: typeof onPlant === 'function' }),
    sum: (bands, s) => `<b class="num">${num(podsHeld(s))}</b> pods<br><b class="num">${num(bankOf(s))}</b> gold`,
    /** A click on the tab: BUY and PLANT act; any other cell lets the screen select its crop. */
    click(t, api) {
      const d = t.dataset;
      if (d.podBuy) {
        const crop = d.podBuy, n = Number(d.buyN) || BUY_PODS;
        let r = null;
        api.update((s) => { r = buyPods(s, crop, n); });
        msg = buyMessage(r, crop);
        if (r.ok) api.changed();
        api.render();
        return true;
      }
      if (d.podPlant) {
        if (typeof onPlant === 'function') onPlant(d.podPlant);
        return true;
      }
      if (d.invId) msg = null;
      return false;
    },
  };
}
