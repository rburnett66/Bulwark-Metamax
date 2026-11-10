/**
 * src/menu/podChest.js — opening a Pod Reward Chest (owner rule 11, 2026-11-10) [MM-story_mwatmvpt_1k]
 * [MM-story_mwayo9y5_1v].
 *
 * Owner (2026-11-10): "chests in Bulwark are awarded at the end of each map and are automatically opened with a user
 * click." So main.js plays this overlay over the result screen as soon as a won map awards the chest, and one tap opens
 * it. The chest is the 3D one (menu/podChest3d.js, the Blender model content/farm/pod_chest.glb): it arrives in a beam
 * and is printed into being, hovers, and on the tap charges, bursts open and sends one glowing pod per crop flying to
 * its card ("+N PODS"); then COLLECT. Without WebGL or the model it is the flat drawn chest, with Pirate Bash's reveal
 * (one card every 500 ms). A chest not opened then (the game closed first) waits in a strip at the top of the SEED PODS
 * tab, whose OPEN plays the same overlay. The pods are in the stock from the tap (farm/chest.js openChest), so closing
 * early loses nothing. Reduced motion: no flight, flash or shake; the cards show at once.
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

/** The flat chest (the SEED PODS strip, and the overlay without WebGL): a banded crate, its lid a group that lifts. */
export function chestIconSvg(cls = 'pchest') {
  return `<svg class="${cls}" viewBox="0 0 120 100" aria-hidden="true">
   <g class="body"><rect x="14" y="44" width="92" height="48" rx="6" fill="#3b2a17" stroke="#d9a441" stroke-width="3"/>
    <rect x="14" y="58" width="92" height="7" fill="#d9a441" opacity=".85"/><rect x="52" y="52" width="16" height="20" rx="3" fill="#f2c96a" stroke="#6b4a1c" stroke-width="2"/>
    <rect x="24" y="44" width="6" height="48" fill="#d9a441" opacity=".55"/><rect x="90" y="44" width="6" height="48" fill="#d9a441" opacity=".55"/></g>
   <g class="lid"><path d="M14 46 V34 Q14 14 60 14 Q106 14 106 34 V46 Z" fill="#4a3520" stroke="#d9a441" stroke-width="3"/>
    <rect x="52" y="30" width="16" height="16" rx="3" fill="#f2c96a" stroke="#6b4a1c" stroke-width="2"/></g></svg>`;
}

const CSS = `
.pchov{position:fixed;inset:0;z-index:4000;display:grid;place-items:center;background:rgba(4,8,10,.86);font:14px/1.4 system-ui,sans-serif;color:#e6ebe3;--r-common:#5aa8f0;--r-uncommon:#f2c84a;--r-rare:#e85050;--r-epic:#52c070}
.pchov .stage{position:absolute;inset:0;z-index:0;overflow:hidden}
.pchov .pch3d{display:block;width:100%;height:100%;opacity:0;transition:opacity .35s}
.pchov.three .pch3d{opacity:1}
.pchov .pch3d-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
.pchov .pbox{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:14px;padding:18px;max-width:min(92vw,760px)}
.pchov .ph{display:flex;flex-direction:column;align-items:center;gap:8px}
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
.pchov .pcc.wait{visibility:hidden;animation:none}
.pchov .pcc.pop{animation:pccpop .42s cubic-bezier(.2,1.6,.4,1)}
@keyframes pccpop{0%{opacity:0;transform:scale(.4)}60%{opacity:1}100%{transform:none}}
.pchov .go{font:inherit;font-weight:700;letter-spacing:.12em;padding:10px 22px;border:0;border-radius:4px;background:#d9a441;color:#1a1206;cursor:pointer}
.pchov .go[hidden]{display:none}
.pchov.loading .tap,.pchov.loading .hint{visibility:hidden}
.pchov.three{background:#03060a}
.pchov.three .pbox{position:absolute;inset:0;max-width:none;justify-content:space-between;padding:max(16px,4vh) 16px max(16px,5vh);gap:8px;pointer-events:none}
.pchov.three .pbox>*{pointer-events:auto}
.pchov.three .ph,.pchov.three .hint{text-shadow:0 2px 12px #000}
.pchov.three .hint{color:#cfe9f2;min-height:1.4em}
.pchov.three .tap{flex:1;width:min(70vw,560px);min-height:0}
.pchov.three .tap .pchest{display:none}
.pchov.three .go{min-height:0}
@media (max-height:430px){.pchov .pbox{gap:6px;padding:6px}.pchov .pchest{width:96px}.pchov.open .pchest{width:64px}.pchov .pcc{width:100px;padding:6px;gap:1px}.pchov .pcc .resi{width:34px;height:34px}.pchov .go{padding:8px 20px}
 .pchov.three .pbox{padding:10px 12px 10px;gap:4px}.pchov.three .ph{gap:4px}}
@media (prefers-reduced-motion:reduce){.pchov *{animation:none!important;transition:none!important}}`;

function ensureStyle(doc) {
  const old = doc.getElementById('pchov-style');
  if (old && old.textContent === CSS) return;
  if (old) old.remove();
  const st = doc.createElement('style'); st.id = 'pchov-style'; st.textContent = CSS; doc.head.appendChild(st);
}

/** The crop tier colours (the menu's --r-* tokens), for the pods in flight. */
const TIER_HEX = Object.freeze({ common: '#5aa8f0', uncommon: '#f2c84a', rare: '#e85050', epic: '#52c070' });
export const podColour = (crop) => TIER_HEX[(cropOf(crop) || {}).tier] || '#f2c96a';

/** The quality tier for the 3D chest: a phone-sized screen draws a little lighter. */
function autoTier(win) {
  const w = win.innerWidth || 1280, h = win.innerHeight || 720, dpr = win.devicePixelRatio || 1;
  return Math.min(w, h) < 500 || dpr > 2.5 ? 'standard' : 'high';
}

/**
 * Play the opening. chest: the held chest (for its title); open(): opens it in the save (farm/chest.js openChest
 * through the menu's updateSave) and returns { draws } or null. opts: reduced (default: the media query), tier
 * ('high' | 'standard' | 'low'; default by screen), use3d (false: the flat chest only).
 * → Promise resolving with the open result (or null) when the player collects or closes.
 */
export function playChestOpen({ doc = document, chest, open, reduced = null, tier = null, use3d = true, timeScale = 1 } = {}) {
  ensureStyle(doc);
  const win = doc.defaultView || {};
  const still = reduced != null ? reduced : !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const ov = doc.createElement('div');
  ov.className = 'pchov' + (use3d ? ' loading' : '');
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Pod Reward Chest');
  ov.innerHTML = `<div class="stage" aria-hidden="true"></div><div class="pbox"><div class="ph"><h2>POD REWARD CHEST</h2>
   <div class="sub">${chest && chest.planet ? esc(planetName(chest.planet)) + (chest.mapId ? ' · map ' + num(chest.mapId) : '') + ' · ' : ''}${num(chestPodCount(chest))} seed pod${chestPodCount(chest) === 1 ? '' : 's'} inside</div></div>
   <button class="tap" aria-label="Open the chest">${chestIconSvg()}</button>
   <div class="sub hint">Tap to open</div>
   <div class="cards" role="list"></div>
   <button class="go" hidden>Collect</button></div>`;
  doc.body.appendChild(ov);
  const $ = (q) => ov.querySelector(q);
  let result = null, done, stage = null, closed = false, tapped = false;
  const timers = [];
  const later = (fn, ms) => { timers.push(win.setTimeout(fn, ms)); };
  const finished = new Promise((r) => { done = r; });
  const close = () => {
    if (closed) return;
    closed = true;
    for (const t of timers) win.clearTimeout(t);
    doc.removeEventListener('keydown', onKey, true);
    if (stage) stage.dispose();
    ov.remove();
    done(result);
  };
  function onKey(e) {
    if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return;
    e.stopPropagation(); e.preventDefault();
    if (!tapped) tap(); else close();
  }
  const showGo = () => { if (closed) return; $('.go').hidden = false; $('.go').focus(); };

  // the 3D chest: load it, then its arrival. No WebGL or no model: the flat chest stays.
  if (use3d) {
    import('./podChest3d.js').then((m) => m.createChestStage({ host: $('.stage'), tier: tier || autoTier(win), reduced: still, timeScale }))
      .then((s) => {
        if (closed || tapped) { s.dispose(); ov.classList.remove('loading'); return; }   // gone, or opened the flat way
        stage = s;
        ov.classList.remove('loading'); ov.classList.add('three');
        $('.hint').textContent = '';
        stage.present().then(() => { if (!tapped && !closed) $('.hint').textContent = 'Tap to open'; });
      })
      .catch((e) => { console.warn('[pod chest] 3D chest unavailable, drawing the flat one:', e && e.message); ov.classList.remove('loading'); });
  }

  function tap() {
    if (tapped) return;
    tapped = true;
    ov.classList.add('open');
    result = open ? open() : null;
    const draws = (result && result.draws) || [], cards = $('.cards');
    const said = result ? 'Your pods are in SEED PODS.' : 'This chest is already open.';
    if (stage) {   // the 3D opening: charge, burst, then each pod flies to its card
      $('.hint').textContent = '';
      stage.open().then(() => {
        if (closed) return;
        $('.hint').textContent = said;
        cards.innerHTML = draws.map(chestCardHtml).join('');
        if (still || !draws.length) { showGo(); return; }
        const els = [...cards.children];
        for (const el of els) el.classList.add('wait');
        let arrived = 0;
        draws.forEach((d, i) => later(() => {
          const r = els[i].getBoundingClientRect();
          stage.releasePod(podColour(d.crop), r.left + r.width / 2, r.top + r.height / 2).then(() => {
            if (closed) return;
            els[i].classList.remove('wait'); els[i].classList.add('pop');
            if (++arrived === draws.length) later(showGo, 250);
          });
        }, 250 + i * 380));
      });
      return;
    }
    $('.hint').textContent = said;   // the flat opening: Pirate Bash's reveal
    if (still || !draws.length) { cards.innerHTML = draws.map(chestCardHtml).join(''); showGo(); return; }
    let i = 0;
    const next = () => {
      if (i >= draws.length) { showGo(); return; }
      cards.insertAdjacentHTML('beforeend', chestCardHtml(draws[i++]));
      later(next, REVEAL_MS);
    };
    later(next, 450);   // the lid lifts first
  }
  $('.tap').addEventListener('click', tap);
  $('.stage').addEventListener('click', tap);
  $('.go').addEventListener('click', close);
  doc.addEventListener('keydown', onKey, true);
  $('.tap').focus();
  return finished;
}
