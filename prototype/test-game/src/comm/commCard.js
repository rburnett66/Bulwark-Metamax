/**
 * src/comm/commCard.js  [comm-dialog]
 *
 * The in-battle COMM TRANSMISSION card: when a wave starts, the attacking faction's character
 * calls in — signal acquire → lock → typed "translation" while the procedural voice speaks →
 * sign-off → fade. Render-side only (reads the wave event, never touches the sim), so
 * determinism and the replay hash are unaffected.
 *
 * - Speaker picked deterministically from (faction, wave, seed) — same seed replays the same call.
 * - Click the card to skip (cuts voice + static, dismisses).
 * - 🔊 toggle (persisted to localStorage 'bulwark:commMuted') mutes audio; the card still shows —
 *   the dialog is content, the voice is flavor.
 * - Honors prefers-reduced-motion: no typing glyph noise, shortened choreography.
 */
import {
  FACTIONS, ICONS, PORTRAIT, hash,
  initAudio, audioReady, paramsFor, playUtterance, startStatic, playSweep, playDrop, utterDuration,
} from './voice.js';

/* Authored portrait lookup: content/dialog/portraits/<slug(name)>.png, silhouette SVG fallback
   (same authored-art-with-fallback pattern as unitArt.js). */
export function portraitSlug(name) { return String(name).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase(); }
const PORTRAIT_DIR = 'content/dialog/portraits/';

const CSS = `
.bw-comm{position:fixed;right:14px;bottom:120px;width:360px;z-index:60;display:none;flex-direction:column;
  font-family:"SF Mono",ui-monospace,Menlo,Consolas,monospace;border:1px solid var(--accent,#3fb6c8);border-radius:10px;
  overflow:hidden;background:linear-gradient(180deg,#0a1119f2,#070c12f2);cursor:pointer;
  box-shadow:0 0 34px -14px var(--accent,#3fb6c8),0 16px 40px -24px #000;--accent:#3fb6c8}
.bw-comm.show{display:flex}
.bw-comm.spent{filter:grayscale(.7) brightness(.55)}
.bw-comm-head{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #1a2430;
  background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 16%,#0a1119),#0a1119)}
.bw-comm-ic{width:22px;height:22px;color:var(--accent);flex:none;filter:drop-shadow(0 0 5px var(--accent))}
.bw-comm-ic svg{width:100%;height:100%}
.bw-comm-name{font-weight:700;color:#eef6fa;font-size:12.5px;letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bw-comm-sub{font-size:9px;color:var(--accent);letter-spacing:1px;text-transform:uppercase;opacity:.85}
.bw-comm-bars{margin-left:auto;display:flex;gap:2px;align-items:flex-end;height:14px;flex:none}
.bw-comm-bars i{width:3px;height:5px;background:#26333f;border-radius:1px}
.bw-comm-bars i.lit{background:var(--accent);box-shadow:0 0 4px var(--accent)}
.bw-comm-body{display:flex;min-height:86px}
.bw-comm-portrait{position:relative;width:84px;flex:none;border-right:1px solid #1a2430;overflow:hidden;
  background:radial-gradient(80% 70% at 50% 35%,color-mix(in srgb,var(--accent) 22%,#060a0f),#05080c)}
.bw-comm-portrait svg{position:absolute;inset:0;margin:auto;width:70%;height:70%;top:6%;
  fill:color-mix(in srgb,var(--accent) 70%,#8ea);opacity:.9}
.bw-comm-portrait img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  object-position:50% 10%;filter:saturate(.9) contrast(1.05)}   /* full-body art: frame the head */
.bw-comm-portrait.speaking svg{animation:bwCommBreathe .18s infinite alternate}
@keyframes bwCommBreathe{from{opacity:.7}to{opacity:1;transform:scale(1.01)}}
@media (prefers-reduced-motion: reduce){.bw-comm-portrait.speaking svg{animation:none}}
.bw-comm-text{flex:1;padding:9px 11px;font-size:12px;line-height:1.55;color:#dbe7f0;white-space:pre-wrap;min-height:0}
.bw-comm-foot{padding:5px 10px;border-top:1px solid #1a2430;font-size:9px;letter-spacing:2px;color:#5c6b7a;
  display:flex;justify-content:space-between;min-height:20px}
.bw-comm-end{color:#e06a6a;font-weight:700}
.bw-comm-mute{position:fixed;right:14px;bottom:88px;z-index:61;width:30px;height:26px;border-radius:6px;
  border:1px solid #26333f;background:#0b1119;color:#8ea0b0;cursor:pointer;font-size:13px;line-height:1}
.bw-comm-mute:hover{border-color:#3fb6c8;color:#dbe7f0}
`;

function reducedMotion() {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
}
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* type text over durMs with signal-glyph noise at the caret (skipped under reduced motion) */
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
  card.addEventListener('click', () => { token++; stopAudio(); card.className = 'bw-comm'; });

  /** Run one comm transmission from a call spec (see dialog.js):
   *  { factionKey, name, sub, line, gender, intent, voiceSeed }. Fire-and-forget. */
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
    card.innerHTML =
      '<div class="bw-comm-head"><span class="bw-comm-ic">' + ICONS[key] + '</span>' +
      '<div style="min-width:0"><div class="bw-comm-name"></div><div class="bw-comm-sub">' + (d.sub || f.name) + '</div></div>' +
      '<div class="bw-comm-bars"><i></i><i></i><i></i><i></i><i></i></div></div>' +
      '<div class="bw-comm-body"><div class="bw-comm-portrait">' + PORTRAIT +
      '<img alt="" src="' + PORTRAIT_DIR + portraitSlug(d.name) + '.png" onerror="this.remove()">' +
      '</div><div class="bw-comm-text"></div></div>' +
      '<div class="bw-comm-foot"><span class="bw-comm-foot-l">◌ ACQUIRING…</span><span class="bw-comm-end"></span></div>';
    const nm = card.querySelector('.bw-comm-name'), txt = card.querySelector('.bw-comm-text'),
      bars = card.querySelectorAll('.bw-comm-bars i'), footl = card.querySelector('.bw-comm-foot-l'),
      end = card.querySelector('.bw-comm-end'), portrait = card.querySelector('.bw-comm-portrait');

    const bed = (!muted && audioReady()) ? startStatic(key, 1) : null;
    liveAudio = { utter: null, bed };
    if (!muted) playSweep();
    for (let i = 0; i < 5; i++) { await delay(rm ? 15 : 90); if (!live()) return; bars[i].classList.add('lit'); }
    footl.textContent = '◉ SIGNAL LOCK';
    await typeText(nm, d.name, rm ? 100 : Math.min(600, d.name.length * 26), live);
    if (!live()) return;

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

    await delay(rm ? 120 : 380);
    if (!live()) return;
    end.textContent = '— END —';
    footl.textContent = '';
    if (!muted) playDrop();
    if (bed) bed.stop();
    if (liveAudio && liveAudio.bed === bed) liveAudio.bed = null;
    card.classList.add('spent');
    await delay(rm ? 400 : 1400);
    if (!live()) return;
    card.className = 'bw-comm';
  }

  return {
    showCall,
    get muted() { return muted; },
    destroy() { token++; stopAudio(); card.remove(); muteBtn.remove(); style.remove(); },
  };
}
