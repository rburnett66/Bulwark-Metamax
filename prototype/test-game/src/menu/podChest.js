/**
 * src/menu/podChest.js — opening a Pod Reward Chest (owner rule 11, 2026-11-10) [MM-story_mwatmvpt_1k].
 *
 * Owner (2026-11-10): "chests in Bulwark are awarded at the end of each map and are automatically opened with a user
 * click." So main.js plays this overlay over the result screen as soon as a won map awards the chest: the chest, TAP
 * TO OPEN, the lid lifts, then one card per crop, "+N PODS", every 500 ms (Pirate Bash's reveal, pirate-bash/src/app.js),
 * and COLLECT. A chest not opened then (the game closed first) waits in a strip at the top of the SEED PODS tab, whose
 * OPEN plays the same overlay. The pods are already in the stock when the first card shows (farm/chest.js openChest runs on the
 * tap), so closing early loses nothing. Reduced motion: the cards show at once, nothing animates.
 *
 * chestStripHtml and chestCardHtml are pure (strings); playChestOpen needs a document.
 */
import { resourceIconHtml } from '../data/resourceIcons.js';
import { cropOf } from '../data/farm.js';
import { PLANETS } from '../data/planets.js';
import { chestsHeld, chestPodCount } from '../farm/chest.js';
import { esc, TIER_VAR, TIER_NAME } from './missionView.js';

const num = (n) => Math.round(n).toLocaleString('en-US');
const REVEAL_MS = 500;   // Pirate Bash's card interval

const planetName = (p) => (PLANETS[p] || {}).name || p || '';
const pods = (n) => `${num(n)} pod${n === 1 ? '' : 's'}`;

/** The strip on the SEED PODS tab: the chests waiting, OPEN on the oldest. Empty when none are held. */
export function chestStripHtml(s) {
  const held = chestsHeld(s);
  if (!held.length) return '';
  const c = held[0], more = held.length - 1;
  return `<div class="pchests" role="region" aria-label="Pod Reward Chests">${chestIconSvg('pchi')}
   <div class="pchtx"><b>Pod Reward Chest${held.length > 1 ? 's' : ''} · ${num(held.length)}</b>
   <small>${c.planet ? esc(planetName(c.planet)) + (c.mapId ? ' · map ' + num(c.mapId) : '') + ' · ' : ''}${pods(chestPodCount(c))} inside${more ? ` · ${num(more)} more waiting` : ''}</small></div>
   <button class="btn primary" data-chest-open="${esc(c.id)}">Open</button></div>`;
}

/** One revealed card: the crop's icon, name and tier, "+N PODS". */
export function chestCardHtml({ crop, n }) {
  const c = cropOf(crop) || { name: crop, tier: 'common' };
  return `<article class="pcc" role="listitem" style="--rc:var(${TIER_VAR[c.tier]})">${resourceIconHtml(crop, 'gem3 resi pring')}
   <strong>${esc(c.name)}</strong><small>${TIER_NAME[c.tier] || ''} tier</small><b class="num">+${num(n)} pod${n === 1 ? '' : 's'}</b></article>`;
}

/** The chest itself: a banded crate, its lid a separate group so it can lift. */
export function chestIconSvg(cls = 'pchest') {
  return `<svg class="${cls}" viewBox="0 0 120 100" aria-hidden="true">
   <g class="body"><rect x="14" y="44" width="92" height="48" rx="6" fill="#3b2a17" stroke="#d9a441" stroke-width="3"/>
    <rect x="14" y="58" width="92" height="7" fill="#d9a441" opacity=".85"/><rect x="52" y="52" width="16" height="20" rx="3" fill="#f2c96a" stroke="#6b4a1c" stroke-width="2"/>
    <rect x="24" y="44" width="6" height="48" fill="#d9a441" opacity=".55"/><rect x="90" y="44" width="6" height="48" fill="#d9a441" opacity=".55"/></g>
   <g class="lid"><path d="M14 46 V34 Q14 14 60 14 Q106 14 106 34 V46 Z" fill="#4a3520" stroke="#d9a441" stroke-width="3"/>
    <rect x="52" y="30" width="16" height="16" rx="3" fill="#f2c96a" stroke="#6b4a1c" stroke-width="2"/></g></svg>`;
}

const CSS = `
.pchov{position:fixed;inset:0;z-index:4000;display:grid;place-items:center;background:rgba(4,8,10,.86);font:14px/1.4 system-ui,sans-serif;color:#e6ebe3}
.pchov .pbox{display:flex;flex-direction:column;align-items:center;gap:14px;padding:18px;max-width:min(92vw,760px)}
.pchov h2{margin:0;font:800 15px/1 system-ui;letter-spacing:.22em;color:#d9a441}
.pchov .sub{color:#9aa6b4;font-size:12px;letter-spacing:.06em;text-align:center}
.pchov .tap{border:0;background:none;cursor:pointer;padding:0}
.pchov button:focus:not(:focus-visible){outline:none}.pchov button:focus-visible{outline:2px solid #f2c96a;outline-offset:4px}
.pchov .pchest{width:min(34vh,180px);height:auto;filter:drop-shadow(0 10px 30px rgba(217,164,65,.35))}
.pchov .pchest .lid{transform-origin:60px 40px;transition:transform .45s cubic-bezier(.3,1.6,.5,1)}
.pchov.open .pchest .lid{transform:translateY(-14px) rotate(-18deg)}
.pchov:not(.open) .tap .pchest{animation:pchwob 1.6s ease-in-out infinite}
@keyframes pchwob{0%,100%{transform:rotate(0)}8%{transform:rotate(-4deg)}16%{transform:rotate(4deg)}24%{transform:rotate(0)}}
.pchov .cards{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;min-height:0}
.pchov .pcc{display:flex;flex-direction:column;align-items:center;gap:3px;width:118px;padding:10px 8px;border-radius:8px;background:#121a20;border:1px solid var(--rc,#2e3c3a);box-shadow:0 0 18px color-mix(in srgb,var(--rc,#d9a441) 30%,transparent);animation:pccin .35s ease-out}
.pchov .pcc strong{font-size:12px;text-align:center}.pchov .pcc small{color:#9aa6b4;font-size:10px;letter-spacing:.08em;text-transform:uppercase}
.pchov .pcc b{color:#f2c96a;font-size:14px}.pchov .pcc .resi{width:44px;height:44px}
@keyframes pccin{from{opacity:0;transform:translateY(10px) scale(.9)}to{opacity:1;transform:none}}
.pchov .go{font:inherit;font-weight:700;letter-spacing:.12em;padding:10px 22px;border:0;border-radius:4px;background:#d9a441;color:#1a1206;cursor:pointer}
.pchov .go[hidden]{display:none}
@media (max-height:430px){.pchov .pbox{gap:6px;padding:6px}.pchov .pchest{width:96px}.pchov.open .pchest{width:64px}.pchov .pcc{width:100px;padding:6px;gap:1px}.pchov .pcc .resi{width:34px;height:34px}.pchov .go{padding:8px 20px}}
@media (prefers-reduced-motion:reduce){.pchov *{animation:none!important;transition:none!important}}`;

function ensureStyle(doc) {
  if (doc.getElementById('pchov-style')) return;
  const st = doc.createElement('style'); st.id = 'pchov-style'; st.textContent = CSS; doc.head.appendChild(st);
}

/**
 * Play the opening. chest: the held chest (for its title); open(): opens it in the save (farm/chest.js openChest
 * through the menu's updateSave) and returns { draws } or null. → Promise resolving with the open result (or null)
 * when the player collects or closes.
 */
export function playChestOpen({ doc = document, chest, open, reduced = null } = {}) {
  ensureStyle(doc);
  const win = doc.defaultView || {};
  const still = reduced != null ? reduced : !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ov = doc.createElement('div');
  ov.className = 'pchov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Pod Reward Chest');
  ov.innerHTML = `<div class="pbox"><h2>POD REWARD CHEST</h2>
   <div class="sub">${chest && chest.planet ? esc(planetName(chest.planet)) + (chest.mapId ? ' · map ' + num(chest.mapId) : '') + ' · ' : ''}${num(chestPodCount(chest))} seed pod${chestPodCount(chest) === 1 ? '' : 's'} inside</div>
   <button class="tap" aria-label="Open the chest">${chestIconSvg()}</button>
   <div class="sub hint">Tap to open</div>
   <div class="cards" role="list"></div>
   <button class="go" hidden>Collect</button></div>`;
  doc.body.appendChild(ov);
  const $ = (q) => ov.querySelector(q);
  let result = null, timer = null, done;
  const finished = new Promise((r) => { done = r; });
  const close = () => { if (timer) win.clearTimeout(timer); doc.removeEventListener('keydown', onKey, true); ov.remove(); done(result); };
  function onKey(e) {
    if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return;
    e.stopPropagation(); e.preventDefault();
    if (!ov.classList.contains('open')) tap(); else close();
  }
  function tap() {
    if (ov.classList.contains('open')) return;
    ov.classList.add('open');
    result = open ? open() : null;
    $('.hint').textContent = result ? 'Your pods are in SEED PODS.' : 'This chest is already open.';
    const draws = (result && result.draws) || [], cards = $('.cards');
    const showAll = () => { cards.innerHTML = draws.map(chestCardHtml).join(''); $('.go').hidden = false; $('.go').focus(); };
    if (still || !draws.length) { showAll(); return; }
    let i = 0;
    const next = () => {
      if (i >= draws.length) { $('.go').hidden = false; $('.go').focus(); return; }
      cards.insertAdjacentHTML('beforeend', chestCardHtml(draws[i++]));
      timer = win.setTimeout(next, REVEAL_MS);
    };
    timer = win.setTimeout(next, 450);   // the lid lifts first
  }
  $('.tap').addEventListener('click', tap);
  $('.go').addEventListener('click', close);
  doc.addEventListener('keydown', onKey, true);
  $('.tap').focus();
  return finished;
}
