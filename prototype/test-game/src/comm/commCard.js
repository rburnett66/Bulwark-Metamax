/**
 * src/comm/commCard.js  [comm-dialog]
 *
 * The in-battle COMM TRANSMISSION card — a faithful port of the Comm Array tool's full S1→S7
 * choreography (comm.html runCall) at corner-card scale:
 *   S1 RF acquire (static canvas + sweep + signal bars) → S2 lock (flash, icon, meta block:
 *   FACTION · CH · ENCRYPTED · UNIVERSAL TRANSLATOR) → S3 translator boot (DECODING…) →
 *   S4 portrait veil resolve → S5 header populate (typed name) → S6 speak (procedural voice +
 *   typed translation) → S7 sign-off (— END — + carrier drop, spent fade).
 *
 * Render-side only (reads wave events, never touches the sim) — determinism and the replay
 * hash are unaffected. Deterministic per call spec: channel + voice melody derive from the
 * spec's seed, so replays show the identical transmission.
 *
 * - Click the card to skip (cuts voice + static, dismisses).
 * - 🔊 toggle (persisted, 'bulwark:commMuted') mutes audio; the card still shows — the dialog
 *   is content, the voice is flavor.
 * - prefers-reduced-motion: no static/flash/glyph noise, shortened beats (tool's body.rm).
 */
import {
  FACTIONS, ICONS, PORTRAIT, hash,
  initAudio, audioReady, paramsFor, playUtterance, startStatic, playSweep, playDrop, utterDuration,
} from './voice.js';

/* Authored portrait lookup: content/dialog/portraits/<slug(name)>.png, silhouette SVG fallback
   (same authored-art-with-fallback pattern as unitArt.js). */
export function portraitSlug(name) { return String(name).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase(); }
const PORTRAIT_DIR = 'content/dialog/portraits/';

/* Tool card skin (comm.html) at corner scale — same class names/roles, bw-comm prefixed. */
const CSS = `
.bw-comm{position:fixed;right:14px;bottom:120px;width:min(430px,calc(100vw - 20px));z-index:60;display:none;flex-direction:column;
  font-family:"SF Mono",ui-monospace,Menlo,Consolas,monospace;border:1px solid var(--accent,#3fb6c8);border-radius:12px;
  overflow:hidden;background:linear-gradient(180deg,#0a1119ee,#070c12ee);cursor:pointer;
  box-shadow:0 0 40px -18px var(--accent,#3fb6c8),0 20px 50px -30px #000;--accent:#3fb6c8}
.bw-comm.show{display:flex}
.bw-comm.spent{filter:grayscale(.7) brightness(.5)}
.bw-comm.flash{animation:bwCommFlash .35s}
@keyframes bwCommFlash{0%{background:#fff}100%{}}
.bw-comm-head{display:flex;align-items:center;gap:9px;padding:8px 11px;border-bottom:1px solid #1a2430;
  background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 16%,#0a1119),#0a1119)}
.bw-comm-ic{width:24px;height:24px;color:var(--accent);flex:none;filter:drop-shadow(0 0 5px var(--accent))}
.bw-comm-ic svg{width:100%;height:100%}
.bw-comm-name{font-weight:700;color:#eef6fa;font-size:13.5px;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bw-comm-sub{font-size:9.5px;color:var(--accent);letter-spacing:1px;margin-top:1px;text-transform:uppercase;opacity:.85}
.bw-comm-bars{margin-left:auto;display:flex;gap:2px;align-items:flex-end;height:15px;flex:none}
.bw-comm-bars i{width:3px;height:5px;background:#26333f;border-radius:1px}
.bw-comm-bars i.lit{background:var(--accent);box-shadow:0 0 4px var(--accent)}
.bw-comm-body{display:grid;grid-template-columns:38% 1fr;min-height:150px}
.bw-comm-portrait{position:relative;border-right:1px solid #1a2430;overflow:hidden;
  background:radial-gradient(80% 70% at 50% 35%,color-mix(in srgb,var(--accent) 22%,#060a0f),#05080c)}
.bw-comm-portrait>svg{position:absolute;inset:0;margin:auto;width:72%;height:72%;top:6%;
  fill:color-mix(in srgb,var(--accent) 70%,#8ea);opacity:.9;
  filter:drop-shadow(0 0 10px color-mix(in srgb,var(--accent) 50%,transparent))}
.bw-comm-portrait img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  object-position:50% 10%;filter:saturate(.9) contrast(1.05)}   /* full-body art: frame the head */
.bw-comm-portrait.speaking>svg,.bw-comm-portrait.speaking img{animation:bwCommBreathe .18s infinite alternate}
@keyframes bwCommBreathe{from{opacity:.75}to{opacity:1;transform:scale(1.01)}}
.bw-comm-pscan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(0,0,0,.4) 3px 4px);
  mix-blend-mode:overlay;pointer-events:none;z-index:2}
.bw-comm-veil{position:absolute;inset:0;background:#05080c;transition:opacity .5s;z-index:3}
.bw-comm-right{display:flex;flex-direction:column;min-height:0}
.bw-comm-meta{font-size:9px;color:#5c6b7a;padding:6px 10px;border-bottom:1px solid #1a2430;line-height:1.65;letter-spacing:.5px;min-height:48px}
.bw-comm-meta b{color:var(--accent);font-weight:600}
.bw-comm-meta .tl{color:#7fe6a1}
.bw-comm-text{flex:1;padding:9px 11px;font-size:12.5px;line-height:1.55;color:#dbe7f0;white-space:pre-wrap;min-height:0}
.bw-comm-text::after{content:"▋";color:var(--accent);animation:bwCommBlink 1s steps(1) infinite;margin-left:1px}
.bw-comm .bw-tapclose { color:#ffd76a; letter-spacing:.2em; animation:bwTapPulse 1.1s ease-in-out infinite; }
@keyframes bwTapPulse { 0%,100%{opacity:.45} 50%{opacity:1} }
.bw-comm.signoff .bw-comm-text::after,.bw-comm.spent .bw-comm-text::after{display:none}
@keyframes bwCommBlink{50%{opacity:0}}
.bw-comm-foot{padding:6px 11px;border-top:1px solid #1a2430;font-size:9px;letter-spacing:2px;color:#5c6b7a;
  display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:24px}
.bw-comm-end{color:#e06a6a;font-weight:700;opacity:0;transition:opacity .3s}
.bw-comm .bw-tapclose { color:#ffd76a; letter-spacing:.2em; animation:bwTapPulse 1.1s ease-in-out infinite; }
@keyframes bwTapPulse { 0%,100%{opacity:.45} 50%{opacity:1} }
.bw-comm.signoff .bw-comm-end{opacity:1}
.bw-comm-qchip{border:1px solid #d8a13a;color:#f0c675;border-radius:6px;padding:2px 8px;font-size:8.5px;letter-spacing:1px;opacity:0;transition:.3s}
.bw-comm-qchip.on{opacity:1}
canvas.bw-comm-static{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .1s;
  pointer-events:none;mix-blend-mode:screen;z-index:4}
canvas.bw-comm-static.on{opacity:.85}
@media (prefers-reduced-motion: reduce){
  .bw-comm.flash{animation:none}
  .bw-comm-portrait.speaking>svg,.bw-comm-portrait.speaking img{animation:none}
}
.bw-comm-mute{position:fixed;right:14px;bottom:88px;z-index:61;width:30px;height:26px;border-radius:6px;
  border:1px solid #26333f;background:#0b1119;color:#8ea0b0;cursor:pointer;font-size:13px;line-height:1}
.bw-comm-mute:hover{border-color:#3fb6c8;color:#dbe7f0}
`;

function reducedMotion() {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
}
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* type text over durMs with signal-glyph noise at the caret (tool's typeText; skips under reduced motion) */
function typeText(el, text, durMs, isLive) {
  const glyphs = '▚▞░▒▓/\\|<>#*+=';
  return new Promise((res) => {
    const start = performance.now(), len = text.length, rm = reducedMotion();
    (function frame(now) {
      if (!isLive()) { el.textContent = text; res(); return; }
      const prog = Math.min(1, (now - start) / Math.max(120, durMs));
      const tgt = Math.floor(prog * len);
      let s = text.slice(0, tgt);
      if (tgt < len && !rm) s += glyphs[Math.floor(Math.random() * glyphs.length)];
      el.textContent = s;
      if (prog >= 1) { el.textContent = text; res(); } else requestAnimationFrame(frame);
    })(start);
  });
}

/* RF snow on the whole card while acquiring (tool's staticNoise) */
function staticNoise(cv, on) {
  cv.classList.toggle('on', on);
  if (!on || reducedMotion()) return;
  // the card may not have LAID OUT yet (boot fires the pre-battle call before first paint;
  // display:none → flex is same-frame) — zero dims crash createImageData. Skip the draw and
  // retry next frame; the rAF chain below keeps polling until layout gives real dimensions.
  if (!(cv.clientWidth > 0) || !(cv.clientHeight > 0)) {
    if (cv._raf) cancelAnimationFrame(cv._raf);
    cv._raf = requestAnimationFrame(() => staticNoise(cv, cv.classList.contains('on')));
    return;
  }
  const ctx = cv.getContext('2d');
  cv.width = cv.clientWidth * 0.5; cv.height = cv.clientHeight * 0.5;
  const img = ctx.createImageData(cv.width, cv.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  if (cv._raf) cancelAnimationFrame(cv._raf);
  cv._raf = requestAnimationFrame(() => staticNoise(cv, cv.classList.contains('on')));
}

function cardHTML(d) {
  return '' +
    '<div class="bw-comm-head"><span class="bw-comm-ic"></span>' +
    '<div style="min-width:0"><div class="bw-comm-name"></div><div class="bw-comm-sub"></div></div>' +
    '<div class="bw-comm-bars"><i></i><i></i><i></i><i></i><i></i></div></div>' +
    '<div class="bw-comm-body">' +
    '<div class="bw-comm-portrait">' + PORTRAIT +
    '<img alt="" src="' + PORTRAIT_DIR + portraitSlug(d.name) + '.png" onerror="this.remove()">' +
    '<div class="bw-comm-pscan"></div><div class="bw-comm-veil"></div></div>' +
    '<div class="bw-comm-right"><div class="bw-comm-meta"></div><div class="bw-comm-text"></div>' +
    '<div class="bw-comm-foot"><span class="bw-comm-foot-l"></span><span class="bw-comm-qchip">◇ QUEST OFFER</span><span class="bw-comm-end">— END —</span></div>' +
    '</div></div>' +
    '<canvas class="bw-comm-static"></canvas>';
}

export function createComm(doc) {
  doc = doc || document;
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);

  const card = doc.createElement('div');
  card.className = 'bw-comm';
  card.title = 'click to skip transmission';
  doc.body.appendChild(card);

  const muteBtn = doc.createElement('button');
  muteBtn.className = 'bw-comm-mute';
  muteBtn.title = 'toggle comm voice audio';
  doc.body.appendChild(muteBtn);

  let muted = false;
  try { muted = localStorage.getItem('bulwark:commMuted') === '1'; } catch (e) { /* storage blocked */ }
  function renderMute() { muteBtn.textContent = muted ? '🔇' : '🔊'; }
  renderMute();
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem('bulwark:commMuted', muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
    renderMute();
  });

  let token = 0;            // bumping this cancels the running call's choreography
  let liveAudio = null;     // { utter, bed } of the running call, so skip can cut it

  function stopAudio() {
    if (liveAudio) {
      if (liveAudio.utter) liveAudio.utter.stop();
      if (liveAudio.bed) liveAudio.bed.stop();
      liveAudio = null;
    }
  }
  card.addEventListener('click', () => { token++; stopAudio(); card.className = 'bw-comm'; _resolveClosed(); });

  /** Run one transmission from a call spec (dialog.js):
   *  { factionKey, name, sub, line, gender, intent, voiceSeed, challenge? }. Fire-and-forget.
   *  Mirrors comm.html runCall S1→S7 beat for beat. */
  async function showCall(d) {
    if (!d || !FACTIONS[d.factionKey]) return;
    const my = ++token;
    const live = () => token === my;
    stopAudio();

    const key = d.factionKey, f = FACTIONS[key];
    if (!muted) initAudio();                            // always follows a user gesture, so autoplay-safe
    const rm = reducedMotion();

    card.style.setProperty('--accent', f.color);
    card.className = 'bw-comm show';
    card.innerHTML = cardHTML(d);
    const ic = card.querySelector('.bw-comm-ic'), nm = card.querySelector('.bw-comm-name'),
      sub = card.querySelector('.bw-comm-sub'), meta = card.querySelector('.bw-comm-meta'),
      txt = card.querySelector('.bw-comm-text'), veil = card.querySelector('.bw-comm-veil'),
      portrait = card.querySelector('.bw-comm-portrait'), bars = card.querySelectorAll('.bw-comm-bars i'),
      cv = card.querySelector('canvas.bw-comm-static'), footl = card.querySelector('.bw-comm-foot-l'),
      qchip = card.querySelector('.bw-comm-qchip');
    veil.style.opacity = 1;

    // channel static bed for this faction — rides under the whole transmission
    const bed = (!muted && audioReady()) ? startStatic(key, 1) : null;
    liveAudio = { utter: null, bed };

    // S1 RF acquire — deterministic channel from the call's seed (replays read identically)
    staticNoise(cv, true);
    const chan = '0' + (1 + ((d.voiceSeed || hash(d.name)) % 9));
    footl.textContent = '◌ ACQUIRING…';
    if (!muted) playSweep();
    for (let i = 0; i < 5; i++) { await delay(rm ? 20 : 110); if (!live()) return; bars[i].classList.add('lit'); }
    // S2 lock
    staticNoise(cv, false);
    card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 350);
    ic.innerHTML = ICONS[key];
    meta.innerHTML = 'FACTION: <b>' + f.name.toUpperCase() + '</b><br>CH ' + chan + ' · ENCRYPTED<br>' +
      '<span class="tl">● UNIVERSAL TRANSLATOR: ACTIVE</span>';
    footl.textContent = '◉ SIGNAL LOCK';
    await delay(rm ? 60 : 380); if (!live()) return;
    // S3 translator boot
    sub.textContent = 'DECODING…';
    await delay(rm ? 60 : 340); if (!live()) return;
    // S4 portrait resolve
    veil.style.opacity = 0;
    await delay(rm ? 60 : 460); if (!live()) return;
    // S5 header populate
    sub.textContent = d.sub || f.name;
    await typeText(nm, d.name, rm ? 120 : Math.min(700, d.name.length * 28), live);
    if (!live()) return;
    // S6 speak
    portrait.classList.add('speaking');
    footl.textContent = '◉ RECEIVING';
    const p = paramsFor(key);
    const g = { gender: d.gender, intent: d.intent, seed: d.voiceSeed || hash(d.name) };
    const utter = (!muted && audioReady()) ? playUtterance(d.line, p, g)
      : { duration: utterDuration(d.line, p, d.intent), stop: function () {} };
    if (liveAudio) liveAudio.utter = utter;
    await typeText(txt, d.line, utter.duration * 1000, live);
    if (!live()) return;
    portrait.classList.remove('speaking');
    if (d.challenge) qchip.classList.add('on');
    await delay(rm ? 150 : 420); if (!live()) return;
    // HOLD: a between-wave interlude keeps the speaker ON SCREEN after the line lands — the card
    // skips its sign-off and stays up until dismiss() runs the fade. The token still guards
    // staleness: a newer call (or the card's own click-to-close) supersedes the held card.
    if (d.hold) {
      _held = { bed, myToken: my };
      // the dialog has ENDED — surface the close affordance (owner: 'tap to close appears after
      // the dialog ends'); tapping anywhere on the card closes it (existing click handler)
      footl.textContent = 'TAP TO CLOSE';
      footl.classList.add('bw-tapclose');
      return;
    }
    await _signOff(bed, live);
    _resolveClosed();
  }

  async function _signOff(bed, live) {
    const rm = reducedMotion();
    // S7 sign-off
    card.classList.add('signoff');
    footl.textContent = '';
    if (!muted) playDrop();
    if (bed) bed.stop();
    if (liveAudio && liveAudio.bed === bed) liveAudio.bed = null;
    await delay(rm ? 80 : 520); if (!live()) return;
    card.classList.add('spent');
    await delay(rm ? 400 : 1400); if (!live()) return;
    card.className = 'bw-comm';
  }

  let _held = null;
  /** Fade out a HELD card (no-op when nothing is held or a newer call took the card over). */
  function dismiss() {
    if (!_held) return;
    const h = _held; _held = null;
    if (h.myToken !== token) return;   // superseded — the newer call owns the card now
    void (async () => { await _signOff(h.bed, () => token === h.myToken); _resolveClosed(); })();
  }

  // ── close notification: sequencing (pre-match dialog -> 1s -> TAP TO START) awaits this ──
  let _closeResolvers = [];
  function _resolveClosed() {
    const rs = _closeResolvers; _closeResolvers = [];
    for (const r of rs) { try { r(); } catch (e) { /* listener error must not break the card */ } }
  }
  /** Resolves the next time the card fully closes (tap, dismiss, or natural sign-off). */
  function waitForClose() { return new Promise((res) => _closeResolvers.push(res)); }

  return {
    showCall,
    dismiss,
    waitForClose,
    get muted() { return muted; },
    destroy() { token++; stopAudio(); card.remove(); muteBtn.remove(); style.remove(); },
  };
}
