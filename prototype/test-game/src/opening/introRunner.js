/**
 * src/opening/introRunner.js — the Collective intro, played in the game [MM-story_mw4d1bsw_q].
 *
 * Owner 2026-11-05: "We need to put the prototype in the game" → "Do rooms and capital ship presentation for
 * collective intro only as in game prototype". This plays the opening's timed beats over the game:
 *   beats 0–3  the 3D shot (openingStage.js): Vesper, the Long Ledger's fly-by, the swing to its flank;
 *   beat 4     the scan line wipes the hull away, left to right, into the room view drawn from primitives
 *              (ship-interior/roomView.js) — the prototype's board wipe, now over 3D;
 *   beats 5–7  life inside; Factor Mira Valcourt flashes at the bar; every other room dims, the bar glows gold,
 *              "THE BAR · Tap to enter" (auto-enters after ROOMS.autoEnter s);
 *   beat 8     the avatar walks into the bar, the camera pushes in, Mira turns, and the conversation plays
 *              (dialog/conversation.js, content/dialog/opening.json) with holo-slides [MM-story_mw47llqj_6];
 *   beat 9     the first contract card (contractCard.js) → ACCEPT [MM-story_mw47lq0l_7];
 *   beat 10    the camera drops to the Loading Bay: the transport under the bay lights, "YOUR TRANSPORT · TAP TO
 *              LAUNCH"; launch closes the hull (the wipe in reverse) over the 3D ship and fades out "DEPARTING FOR
 *              VERDANCE"; onDone({ depart: 'ground' }) and the menu turns to Verdance.
 * Saving is the caller's: onAccept() and onLaunch() fire at those beats (the menu writes save/collective.js).
 * resume: 'transport' starts straight at the Loading Bay (a reload between ACCEPT and launch).
 * Everything timed comes from timeline.js openingAt(t) / roomsAt(t), so the review page and tests see the same thing.
 *
 *   const intro = await playIntro({ mount: document.body, tier, reduced, onDone });   // intro.close() to abort
 *
 * Two canvases (the 3D shot under, the room view over it, revealed by a clip-path wipe); both pause when the tab hides.
 */
import { openingAt, skipTarget, ROOMS, BEATS } from './timeline.js';
import { createOpeningStage } from './openingStage.js';
import { prepareLayout } from '../ship-interior/layout.js';
import { createRoomView } from '../ship-interior/roomView.js';
import { openConversation } from '../dialog/conversation.js';
import { validateScript } from '../dialog/conversationState.js';
import { contractFor, contractReward } from '../data/collectiveContract.js';
import { openContractCard } from './contractCard.js';

const VENDOR = new URL('../../vendor/', import.meta.url).href;
const CONTENT = new URL('../../content/', import.meta.url).href;
const PATRON = Object.freeze({ room: 'bar', fac: 'collective', name: 'Factor Mira Valcourt', title: 'Contract officer · The Collective' });

const CSS = `
.cx-intro { position:fixed; inset:0; z-index:200; background:#000; color:#e9e2d6; font:14px/1.45 "IBM Plex Sans Condensed", system-ui, sans-serif; overflow:hidden; touch-action:none; user-select:none; }
.cx-intro canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
.cx-intro .cx-rooms { clip-path: inset(0 100% 0 0); }
.cx-intro .cx-scan { position:absolute; top:0; bottom:0; width:3px; margin-left:-1px; background:#38e1c8; box-shadow:0 0 18px 4px #38e1c8aa, 0 0 64px 14px #38e1c844; pointer-events:none; display:none; }
.cx-intro .cx-fade { position:absolute; inset:0; background:#000; pointer-events:none; }
.cx-intro .cx-cap { position:absolute; left:0; right:0; top:46%; text-align:center; font:600 clamp(14px,2.2vw,22px) "Chakra Petch", sans-serif; letter-spacing:.42em; padding-left:.42em; color:#f2c869; text-shadow:0 0 18px rgba(255,122,60,.45); pointer-events:none; }
.cx-intro .cx-btn { position:absolute; font:600 12px "Chakra Petch", sans-serif; letter-spacing:.16em; color:#e9e2d6; background:rgba(14,9,8,.78); border:1px solid rgba(242,200,105,.35); border-radius:6px; padding:9px 13px; cursor:pointer; min-height:36px; }
.cx-intro .cx-btn:focus-visible { outline:2px solid #f2c869; outline-offset:2px; }
.cx-intro .cx-skip { right:max(16px, env(safe-area-inset-right)); top:max(16px, env(safe-area-inset-top)); display:none; }
.cx-intro .cx-close { left:max(16px, env(safe-area-inset-left)); top:max(16px, env(safe-area-inset-top)); }
.cx-intro .cx-prompt { position:absolute; transform:translate(-50%, -100%); text-align:center; pointer-events:none; opacity:0; transition:opacity .4s; }
.cx-intro .cx-prompt b { display:block; font:700 clamp(14px,2vw,20px) "Chakra Petch", sans-serif; letter-spacing:.3em; padding-left:.3em; color:#ffcf5c; text-shadow:0 0 14px rgba(255,207,92,.6); }
.cx-intro .cx-prompt span { display:block; margin-top:4px; font-size:12px; letter-spacing:.2em; color:#e9e2d6; opacity:0; transition:opacity .4s; }
.cx-intro .cx-prompt.tap span { opacity:1; animation:cxPulse 2s ease-in-out infinite; }
@keyframes cxPulse { 0%,100% { opacity:.55 } 50% { opacity:1 } }
@media (prefers-reduced-motion: reduce) { .cx-intro .cx-prompt.tap span { animation:none; } }
`;

/** Load three.js and the addons the opening needs (vendored r128). */
async function loadThree() {
  const [THREE, gl, ec, rp, sp, ub] = await Promise.all([
    import(VENDOR + 'three.module.js'), import(VENDOR + 'three-addons/loaders/GLTFLoader.js'),
    import(VENDOR + 'three-addons/postprocessing/EffectComposer.js'), import(VENDOR + 'three-addons/postprocessing/RenderPass.js'),
    import(VENDOR + 'three-addons/postprocessing/ShaderPass.js'), import(VENDOR + 'three-addons/postprocessing/UnrealBloomPass.js')]);
  return { THREE, addons: { GLTFLoader: gl.GLTFLoader, EffectComposer: ec.EffectComposer, RenderPass: rp.RenderPass, ShaderPass: sp.ShaderPass, UnrealBloomPass: ub.UnrealBloomPass } };
}

/**
 * Play the intro over `mount`. → { close(), get t(), seek(s) }. onDone() runs once, when the player continues out of
 * the bar or closes the intro.
 */
export async function playIntro({ mount = document.body, tier = 'high', reduced = null, onDone = () => {}, onAccept = () => {}, onLaunch = () => {},
  start = 0, resume = null, standing = {} } = {}) {
  const reduce = reduced != null ? reduced : matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.getElementById('cx-intro-css')) {
    const st = document.createElement('style'); st.id = 'cx-intro-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const root = document.createElement('div'); root.className = 'cx-intro'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'The Long Ledger');
  root.innerHTML = `<canvas class="cx-ship"></canvas><canvas class="cx-rooms"></canvas><div class="cx-scan"></div>
    <div class="cx-fade"></div><div class="cx-cap"></div>
    <div class="cx-prompt"><b>THE BAR</b><span>TAP TO ENTER</span></div>
    <button class="cx-btn cx-skip" type="button">SKIP ▸</button><button class="cx-btn cx-close" type="button" aria-label="Close the intro">✕</button>`;
  mount.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const shipCanvas = $('.cx-ship'), roomCanvas = $('.cx-rooms'), scanEl = $('.cx-scan'), fadeEl = $('.cx-fade'), capEl = $('.cx-cap');
  const promptEl = $('.cx-prompt'), skipEl = $('.cx-skip');

  const { THREE, addons } = await loadThree();
  const pr = Math.min(devicePixelRatio || 1, tier === 'low' ? 1 : tier === 'standard' ? 1.5 : 2);
  const shipR = new THREE.WebGLRenderer({ canvas: shipCanvas, antialias: true });
  shipR.setPixelRatio(pr);
  const roomR = new THREE.WebGLRenderer({ canvas: roomCanvas, antialias: true });
  roomR.setPixelRatio(pr); roomR.outputEncoding = THREE.sRGBEncoding;

  const stage = createOpeningStage(THREE, { renderer: shipR, addons, tier, reduced: reduce });
  const [manifest, layoutJson, script] = await Promise.all([
    fetch(CONTENT + 'ships/ships.json').then((r) => r.json()),
    fetch(CONTENT + 'ships/collective/ship-layout.json').then((r) => r.json()),
    fetch(CONTENT + 'dialog/opening.json').then((r) => r.json())]);
  const scriptErrors = validateScript(script);
  if (scriptErrors.length) console.warn('[intro] opening script:', scriptErrors);
  await stage.load({
    ship: CONTENT + 'ships/' + manifest.collective.lods[tier === 'low' ? 1 : 0].file,
    tug: manifest.tug ? CONTENT + 'ships/' + manifest.tug.lods[0].file : null, engineColor: manifest.collective.engineColor,
  });
  const layout = prepareLayout(layoutJson);
  if (!layout.ok) console.warn('[intro] ship layout:', layout.errors);
  const view = createRoomView(THREE, { renderer: roomR, layout, standing, reduce, patron: PATRON });

  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    stage.resize(w, h);
    roomR.setSize(w, h, false); view.resize(w, h);
  }
  addEventListener('resize', resize); resize();

  // ── state ─────────────────────────────────────────────────────────────────────────────────────────────────────
  let t = Math.max(0, start), phase = 'timed', closed = false, last = performance.now(), raf = 0, conv = null, card = null, launchT = 0;
  const finish = (result = {}) => { if (closed) return; closed = true; cleanup(); onDone(result); };
  const FIRST = { planet: 'ground', mapId: 1, name: 'Verdance' };

  // beat 9: the contract card
  function offerContract() {
    if (conv) { conv.close(); conv = null; }
    phase = 'contract';
    card = openContractCard(document, root, {
      planet: FIRST.name, mapId: FIRST.mapId, contract: contractFor(FIRST.planet, FIRST.mapId), reward: contractReward(FIRST.planet, FIRST.mapId),
      onAccept: () => { card.close(); card = null; try { onAccept(); } catch (e) { console.warn('[intro] onAccept', e); } toBay(); },
    });
  }
  // beat 10: the Loading Bay, then launch
  function toBay() {
    phase = 'bay';
    view.ship.setAll('dim', 'loading'); view.ship.setState('loading', 'highlight');
    view.focus('loading', root.clientWidth < root.clientHeight ? 0.95 : 0.75);
    promptEl.querySelector('b').textContent = 'YOUR TRANSPORT';
    promptEl.querySelector('span').textContent = 'TAP TO LAUNCH';
    promptEl.classList.add('tap');
  }
  function launch() {
    if (phase !== 'bay') return;
    phase = 'launch'; launchT = 0; promptEl.style.opacity = '0';
    try { onLaunch(); } catch (e) { console.warn('[intro] onLaunch', e); }
  }

  function enterBar() {
    if (phase !== 'timed') return;
    phase = 'walk';
    promptEl.style.opacity = '0';
    view.focus(ROOMS.room, root.clientWidth < root.clientHeight ? 0.96 : 0.78);
    view.walkPlayerTo(ROOMS.room, () => {
      view.patronTurn();
      phase = 'talk';
      // the Verdance map 1 contract the offer is about (the Collective buys common and uncommon only)
      conv = openConversation(document, root, script, { reduce, data: { contract: contractFor('ground', 1) }, onEnd: offerContract });
    });
  }

  skipEl.addEventListener('click', () => { const to = skipTarget(t); if (to != null) t = to; });
  $('.cx-close').addEventListener('click', finish);
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(); });
  roomCanvas.addEventListener('pointerup', (e) => {
    if (phase === 'bay') { const hit = view.pick(e.clientX, e.clientY, roomCanvas.getBoundingClientRect()); if (hit && hit.id === 'loading') launch(); return; }
    if (phase !== 'timed') return;
    const o = openingAt(t, { box: stage.box, reduced: reduce });
    if (!o.room.prompt) return;
    const hit = view.pick(e.clientX, e.clientY, roomCanvas.getBoundingClientRect());
    if (hit && hit.id === ROOMS.room) enterBar();
  });
  roomCanvas.style.pointerEvents = 'auto';

  // ── the loop ──────────────────────────────────────────────────────────────────────────────────────────────────
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (phase === 'timed') t += dt;
    const o = openingAt(t, { box: stage.box, aspect: root.clientWidth / Math.max(1, root.clientHeight), reduced: reduce });
    const R = o.room;

    // the 3D shot, until the wipe has covered it
    if (R.show3d) stage.frame(t, dt);
    fadeEl.style.opacity = (1 - o.fade).toFixed(3);
    capEl.textContent = o.caption.text; capEl.style.opacity = o.caption.alpha.toFixed(3);

    // the wipe: the room canvas is revealed left → right behind a cyan scan line
    const scan = R.scan;
    roomCanvas.style.clipPath = scan >= 1 ? 'none' : `inset(0 ${((1 - scan) * 100).toFixed(2)}% 0 0)`;
    scanEl.style.display = scan > 0 && scan < 1 ? 'block' : 'none';
    scanEl.style.left = (scan * 100).toFixed(2) + '%';

    // the room view: states, camera and the patron's flash follow the timeline until the player walks in
    if (scan > 0) {
      if (phase === 'timed') {
        if (R.dim > 0) { view.ship.setAll('dim', ROOMS.room); view.ship.setState(ROOMS.room, 'highlight'); }
        else view.ship.setAll('normal');
        // phone portrait (design §8): the whole ship is too small to read, so the camera holds the bar's side and
        // pushes in closer than on a wide screen
        const portrait = root.clientWidth < root.clientHeight;
        const f = R.focus || (portrait ? { room: ROOMS.room, fill: 0.4 } : null);
        view.focus(f ? f.room : null, f ? (portrait ? Math.min(0.95, f.fill * 1.6) : f.fill) : 0.7);
      }
      view.frame(dt, { flash: phase === 'timed' ? R.flash : 0, camEase: 2.4 });
    }

    // "THE BAR · TAP TO ENTER" over the bar
    if (phase === 'timed' && R.prompt) {
      const box = view.screenBox(ROOMS.room, { left: 0, top: 0, width: root.clientWidth, height: root.clientHeight });
      promptEl.style.left = (box.left + box.width / 2) + 'px'; promptEl.style.top = Math.max(60, box.top - 8) + 'px';
      promptEl.style.opacity = '1'; promptEl.classList.toggle('tap', R.prompt === 'tap');
      if (R.enter) enterBar();
    } else if (phase === 'timed') promptEl.style.opacity = '0';
    skipEl.style.display = phase === 'timed' && skipTarget(t) != null ? 'block' : 'none';

    if (phase === 'talk' && conv) conv.tick(dt);

    // "YOUR TRANSPORT · TAP TO LAUNCH" over the Loading Bay
    if (phase === 'bay') {
      const box = view.screenBox('loading', { left: 0, top: 0, width: root.clientWidth, height: root.clientHeight });
      promptEl.style.left = (box.left + box.width / 2) + 'px'; promptEl.style.top = Math.max(60, box.top - 8) + 'px';
      promptEl.style.opacity = '1';
    }
    // launch: the hull closes over the rooms (the wipe in reverse), the 3D ship holds its flank, then black
    if (phase === 'launch') {
      launchT += dt;
      const close = reduce ? 1 : Math.min(1, launchT / 1.6);
      roomCanvas.style.clipPath = `inset(0 0 0 ${(close * 100).toFixed(2)}%)`;
      scanEl.style.display = close > 0 && close < 1 ? 'block' : 'none'; scanEl.style.left = (close * 100).toFixed(2) + '%';
      stage.frame(Math.min(t, 40), dt);
      const out = Math.max(0, Math.min(1, (launchT - 1.8) / 1.0));
      fadeEl.style.opacity = out.toFixed(3);
      capEl.textContent = 'DEPARTING FOR VERDANCE'; capEl.style.opacity = Math.min(1, Math.max(0, (launchT - 1.4) / 0.6)).toFixed(3);
      if (launchT >= 3.6) finish({ depart: FIRST.planet });
    }
  }
  // a reload between ACCEPT and launch: straight to the Loading Bay, the room view already open
  if (resume === 'transport') { t = BEATS.find((b) => b.id === 'talk').start; phase = 'bay'; toBay(); }
  raf = requestAnimationFrame(loop);

  function cleanup() {
    cancelAnimationFrame(raf);
    if (conv) conv.close();
    if (card) card.close();
    removeEventListener('resize', resize);
    try { stage.dispose(); view.dispose(); } catch (e) { /* best effort */ }
    shipR.dispose(); roomR.dispose();
    try { shipR.forceContextLoss(); roomR.forceContextLoss(); } catch (e) { /* ignore */ }
    root.remove();
  }

  return {
    close: finish,
    get t() { return t; }, get phase() { return phase; },
    seek(s) { t = s; },
    enterBar,
    get conversation() { return conv; },
    offerContract, launch,
    beats: BEATS,
  };
}
