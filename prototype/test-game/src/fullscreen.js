/**
 * src/fullscreen.js — full screen for MOBILE players [MM-story_mvfxazk4_1t].
 *
 * Owner 2026-10-19: "Let's add this trick for mobile players" — the Pirate Crashers write-up "Replicating the Mobile
 * Fullscreen Trick" (src/fs-swipe.js there). Three routes from one module:
 *
 *   iPhone / iPad Safari  ('swipe') — Safari has no fullscreen API but hides its bar when the page scrolls. The document
 *       is made 200 px taller than the screen (html.fs-swipe), so one upward swipe collapses the bar; the body is pinned
 *       as a fixed full-screen frame, so nothing ever scrolls the document back and the bar stays gone. A "Swipe up to go
 *       full screen" overlay shows while the bar is visible, with PLAY ANYWAY.
 *   Android / touch browsers ('card') — a TAP TO START screen at boot; its tap is the user gesture
 *       requestFullscreen() + screen.orientation.lock('landscape') need ("Play in a window" skips it).
 *   Both show as a START SCREEN (title splash) over the game in the same page — see startView() below.
 *   Home Screen app / desktop ('none') — already chromeless (manifest "display": "fullscreen"), or a desktop browser that
 *       keeps the HUD's ⛶ button: nothing shown.
 *
 * ?fs=off turns it all off; &fsinfo=1 shows a diagnostics readout. Skipped under automation (navigator.webdriver), or
 * every browser test would stall at the card. Bulwark's page is already one fixed-height frame (#app 100dvh) and never
 * calls window.scrollTo, so the write-up's "document height changed in battle" and "scrollTo brought the bar back"
 * failures can't happen here — scrollPageTop() is exported for any future scroll-to-top.
 *
 * During battle (body.playing, set by main.js while the menu is closed) a non-passive touchmove listener stops drags
 * from scrolling anything — except touches that START on a control (iOS drops a tap whose roll is cancelled) and form
 * inputs / dialogs (sliders must drag).
 */

/** Which route a device takes, and why. env = what the browser reports (pure — node-tested). */
export function fullscreenRoute(env) {
  const q = env.search || '';
  if (/[?&]fs=off\b/.test(q)) return { route: 'none', why: 'fs=off' };
  if (env.webdriver) return { route: 'none', why: 'automation' };
  if (env.standalone) return { route: 'none', why: 'home-screen app (already full screen)' };
  const apple = /iPad|iPhone|iPod/.test(env.ua || '') || (env.platform === 'MacIntel' && (env.maxTouchPoints || 0) > 1);
  if (apple) return { route: 'swipe', why: 'iPhone/iPad Safari — no fullscreen API' };
  if (env.coarse && env.canFullscreen && !env.isFullscreen) return { route: 'card', why: 'touch browser with the fullscreen API' };
  return { route: 'none', why: env.coarse ? 'no fullscreen API' : 'desktop (HUD ⛶ button)' };
}

const CSS = `
#fsLvh { position:fixed; left:0; top:0; width:0; height:100vh; height:100lvh; visibility:hidden; pointer-events:none; }
html.fs-swipe { height:auto; min-height:calc(100vh + 200px); min-height:calc(100lvh + 200px); overflow:auto; }
html.fs-swipe body { position:fixed; inset:0; width:100%; height:100vh; height:100dvh; overflow:auto;
  overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
html.fs-swipe body.playing { overflow:hidden; }
html.fs-swipe body.playing :is(button, [data-action], a, label) { touch-action:none; }
.fs-veil { position:fixed; inset:0; z-index:2147483600; display:grid; place-items:center; background:rgba(4,7,11,.86);
  font-family:"Segoe UI",system-ui,sans-serif; color:#e6ecf3; text-align:center; padding:24px; box-sizing:border-box; }
.fs-veil[hidden] { display:none; }
/* the START SCREEN: a title splash over the game (same page — full screen can't follow a new window) */
.fs-start { touch-action:pan-y; background:radial-gradient(80% 70% at 30% 35%, rgba(40,60,90,.35), transparent 70%),
  linear-gradient(160deg,#07090c 0%, #0c1016 60%, #07090c 100%); }
.fs-crest { width:54px; height:54px; background:linear-gradient(160deg,#f2c869,#d9a441); clip-path:polygon(50% 0,100% 22%,100% 68%,50% 100%,0 68%,0 22%);
  display:flex; align-items:center; justify-content:center; color:#0c0e12; font-weight:900; font-size:26px; box-shadow:0 0 18px rgba(217,164,65,.35); }
.fs-word { font-size:clamp(30px,8vh,46px); font-weight:900; letter-spacing:.3em; margin-right:-.3em; }
.fs-word b { color:#f2c869; }
.fs-tag { font-size:10px; letter-spacing:.42em; color:#8fa0b3; margin-top:-8px; }
.fs-swipebox { display:none; flex-direction:column; align-items:center; gap:6px; }
.fs-start[data-view^="swipe"] .fs-swipebox { display:flex; }
.fs-start[data-view^="swipe"] .fs-go, .fs-start[data-view^="swipe"] .fs-sub { display:none; }
.fs-start[data-view="swipe-again"] .fs-crest, .fs-start[data-view="swipe-again"] .fs-word, .fs-start[data-view="swipe-again"] .fs-tag { display:none; }
.fs-start[data-view="swipe-again"] { background:rgba(4,7,11,.86); }
.fs-start[data-route="swipe"][data-view="tap"] .fs-link { display:none; }
.fs-go { min-width:260px; min-height:54px; font-size:17px !important; letter-spacing:.24em !important; }
.fs-sub { font-size:11px !important; letter-spacing:.2em; text-transform:uppercase; }
.fs-link { background:none; border:0; color:#8fa0b3; font:inherit; font-size:12px; letter-spacing:.16em; text-transform:uppercase; text-decoration:underline;
  cursor:pointer; padding:10px 14px; min-height:44px; }
@media (max-height:420px) { .fs-card { gap:8px; } .fs-crest { width:40px; height:40px; font-size:20px; } .fs-card p { display:none; } .fs-start[data-view^="swipe"] .fs-swipebox p { display:block; } }
.fs-card { max-width:360px; display:flex; flex-direction:column; align-items:center; gap:14px; }
.fs-card .k { font-size:11px; letter-spacing:.42em; color:#d9a441; }
.fs-card strong { font-size:22px; font-weight:900; letter-spacing:.08em; }
.fs-card p { margin:0; font-size:13px; color:#8fa0b3; line-height:1.5; }
.fs-arrow { width:34px; height:34px; border-left:3px solid #f2c869; border-top:3px solid #f2c869; transform:rotate(45deg); margin-top:10px;
  animation:fs-up 1.4s ease-in-out infinite; }
@keyframes fs-up { 0%,100% { transform:translateY(8px) rotate(45deg); opacity:.4; } 50% { transform:translateY(-8px) rotate(45deg); opacity:1; } }
@media (prefers-reduced-motion: reduce) { .fs-arrow { animation:none; } }
.fs-btn { min-width:220px; min-height:44px; padding:12px 20px; font:inherit; font-size:14px; font-weight:700; letter-spacing:.14em; cursor:pointer;
  background:#1a1f28; border:1px solid #2e3846; color:#e6ecf3; }
.fs-btn.primary { background:linear-gradient(160deg,#f2c869,#d9a441); color:#0c0e12; border-color:#f2c869; }
#fsInfo { position:fixed; left:6px; top:calc(6px + env(safe-area-inset-top, 0px)); z-index:2147483601; background:rgba(0,0,0,.78); color:#9fe; font:11px/1.35 monospace;
  padding:6px 8px; pointer-events:none; white-space:pre; }
`;

const env = () => {
  const mm = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  const de = document.documentElement;
  return {
    ua: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
    standalone: navigator.standalone === true || mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)'),
    webdriver: !!navigator.webdriver, search: location.search,
    coarse: mm('(pointer: coarse)'), canFullscreen: !!(de.requestFullscreen || de.webkitRequestFullscreen),
    isFullscreen: !!(document.fullscreenElement || document.webkitFullscreenElement),
  };
};

let state = { route: 'none', why: 'not started' };
let lvh = null, playAnyway = false;
const barPx = () => (lvh ? Math.max(0, lvh.offsetHeight - window.innerHeight) : 0);

/** Scroll to the top WITHOUT bringing Safari's bar back (scroll the body frame, never the window). */
export function scrollPageTop() {
  (state.route === 'swipe' ? document.body : window).scrollTo({ top: 0, left: 0, behavior: 'instant' });
}
/** main.js: true while a battle is on screen (the menu closed) — drags stop scrolling the page. */
export function setPlaying(on) { if (document.body) document.body.classList.toggle('playing', !!on); sync(); }
/** The route this device took (HUD ⛶ button, diagnostics). */
export function fullscreenState() { return { ...state, bar: barPx() }; }

/** Real fullscreen + landscape lock — must run inside a tap. */
export async function goFullscreen() {
  const de = document.documentElement;
  try { await (de.requestFullscreen ? de.requestFullscreen({ navigationUI: 'hide' }) : de.webkitRequestFullscreen()); } catch (e) { /* refused */ }
  try { await (screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')); } catch (e) { /* not lockable */ }
}

function el(tag, attrs, html) { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (html) e.innerHTML = html; return e; }

/**
 * The START SCREEN (owner 2026-10-19: "create a start-game window and initiate the fullscreen trick … this needs to work
 * or hide on PC and work on iPhone and Android"). Full screen belongs to the page that asked for it — a new window would
 * lose it on both platforms — so the start screen is a title splash over the game, in the same page:
 *   iPhone  — while Safari's bar shows: "Swipe up to go full screen" (+ PLAY ANYWAY); the swipe itself starts the game.
 *             If the bar comes back later (rotation, a tap on the status bar) the swipe prompt returns.
 *   Android — TAP TO START: the tap enters full screen + locks landscape (PLAY IN A WINDOW skips it).
 *   PC / Home Screen app / automation / ?fs=off — no start screen at all.
 */
export function startView(route, { started, bar, playAnyway }) {
  if (route === 'swipe') {
    if (playAnyway) return 'hidden';
    if (bar > 4) return started ? 'swipe-again' : 'swipe';
    return started ? 'hidden' : 'tap';
  }
  if (route === 'card') return started ? 'hidden' : 'tap';
  return 'hidden';
}

let start = null, started = false, lastBar = 0;
function sync() {
  const bar = barPx();
  // the swipe that hides Safari's bar IS the start: the bar going from showing to gone begins the game
  if (state.route === 'swipe' && !started && lastBar > 4 && bar <= 4) started = true;
  lastBar = bar;
  if (start) {
    const v = document.querySelector('dialog[open]') ? 'hidden' : startView(state.route, { started, bar, playAnyway });
    start.hidden = v === 'hidden';
    start.dataset.view = v;
  }
  if (info) info.textContent = `fs route: ${state.route} (${state.why})\nstart: ${start ? start.dataset.view : 'none'}  started: ${started}\nbar: ${bar}px  inner: ${window.innerHeight}  lvh: ${lvh ? lvh.offsetHeight : '?'}\nscrollY: ${Math.round(window.scrollY)}  body.playing: ${document.body.classList.contains('playing')}\nfullscreen: ${!!document.fullscreenElement}`;
}
let info = null;

function mount() {
  if (!document.getElementById('fs-style')) document.head.appendChild(el('style', { id: 'fs-style', textContent: CSS }));
  lvh = el('div', { id: 'fsLvh' }); document.body.appendChild(lvh);
  state = fullscreenRoute(env());
  if (/[?&]fsinfo=1\b/.test(location.search)) { info = el('div', { id: 'fsInfo' }); document.body.appendChild(info); }
  if (state.route === 'none') { sync(); return; }   // PC, Home Screen app, automation, ?fs=off: straight into the game

  if (state.route === 'swipe') document.documentElement.classList.add('fs-swipe');
  start = el('div', { id: 'fsStart', className: 'fs-veil fs-start' }, `<div class="fs-card">
      <div class="fs-crest">B</div><div class="fs-word">BUL<b>WARK</b></div><div class="fs-tag">HOLD THE LINE</div>
      <div class="fs-swipebox"><strong>Swipe up to go full screen</strong><p>One upward swipe hides Safari's bar for the whole game.</p>
        <div class="fs-arrow" aria-hidden="true"></div></div>
      <button type="button" class="fs-btn primary fs-go" id="fsGo">TAP TO START</button>
      <p class="fs-sub">${state.route === 'card' ? 'Plays full screen, held sideways' : 'Hold your phone sideways'}</p>
      <button type="button" class="fs-link" id="fsAlt">${state.route === 'card' ? 'Play in a window' : 'Play anyway'}</button></div>`);
  start.dataset.route = state.route;
  document.body.appendChild(start);
  start.querySelector('#fsGo').addEventListener('click', () => {
    started = true;
    if (state.route === 'card') void goFullscreen();   // this tap is the gesture full screen needs
    sync();
  });
  start.querySelector('#fsAlt').addEventListener('click', () => { started = true; if (state.route === 'swipe') playAnyway = true; sync(); });

  if (state.route === 'swipe') {
    let startedOnControl = false;
    document.addEventListener('touchstart', (e) => {
      startedOnControl = !!(e.target.closest && e.target.closest('button,[data-action],a,label'));
    }, { capture: true, passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!document.body.classList.contains('playing') || (start && !start.hidden) || !e.cancelable || startedOnControl) return;
      if (e.target.closest && e.target.closest('dialog[open],input,select,textarea')) return;
      e.preventDefault();
    }, { passive: false });
  }
  for (const t of ['resize', 'scroll', 'orientationchange']) window.addEventListener(t, sync, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', sync);
  document.addEventListener('fullscreenchange', sync);
  sync();
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
}
