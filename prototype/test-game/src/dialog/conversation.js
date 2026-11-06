/**
 * src/dialog/conversation.js — the player-paced conversation panel [MM-story_mw47llqj_6].
 *
 * Design: Collective-Opening-Design §6.2–6.3. Replaces the prototype's room modal for scripted scenes: the speaker's
 * faction tag, name and role; the line typed out with the procedural voice (comm/voice.js) and captions always on;
 * click / tap / Space / Enter advances, a press while typing finishes the line; progress pips; holo-slides float
 * above the panel (holoSlide.js). The state machine is conversationState.js (node-tested).
 * Reply choices (response mode) are added later by Dialog-Response-Reputation.
 *
 *   const conv = openConversation(doc, parentEl, script, { reduce, data, onLine, onEnd });
 *   conv.tick(dt) every frame · conv.close()
 */
import { createConversationState } from './conversationState.js';
import { createHoloPanel } from './holoSlide.js';
import { initAudio, playUtterance, paramsFor, hash } from '../comm/voice.js';

const CSS = `
.conv { position:absolute; left:50%; bottom:max(18px, env(safe-area-inset-bottom)); transform:translateX(-50%); width:min(600px, calc(100% - 28px));
  font:15px/1.45 "IBM Plex Sans Condensed", system-ui, sans-serif; color:#e9e2d6; z-index:5; }
.conv .panel { position:relative; background:linear-gradient(180deg, rgba(22,16,12,.95), rgba(10,8,7,.97)); border:1px solid rgba(242,200,105,.42);
  border-radius:12px; padding:14px 18px 12px; cursor:pointer; box-shadow:0 12px 40px rgba(0,0,0,.5); }
.conv .tag { font:600 10px "Chakra Petch", sans-serif; letter-spacing:.24em; color:#f2c869; opacity:.85; }
.conv .who { font:700 17px "Chakra Petch", sans-serif; letter-spacing:.04em; color:#f2c869; margin-top:2px; }
.conv .role { font-size:12px; color:#9b8f80; margin-bottom:8px; }
.conv .line { font-size:16px; min-height:4.4em; }
.conv .foot { display:flex; justify-content:space-between; align-items:center; margin-top:8px; }
.conv .pips { display:flex; gap:5px; }
.conv .pips i { width:6px; height:6px; border-radius:50%; background:rgba(242,200,105,.22); }
.conv .pips i.on { background:#f2c869; }
.conv .next { font:600 11px "Chakra Petch", sans-serif; letter-spacing:.18em; color:#e9e2d6; opacity:0; transition:opacity .3s; }
.conv .next.on { opacity:.85; animation:convNext 1.6s ease-in-out infinite; }
@keyframes convNext { 0%,100% { opacity:.5 } 50% { opacity:1 } }
@media (prefers-reduced-motion: reduce) { .conv .next.on { animation:none; } }
`;

export function openConversation(doc, parent, script, { reduce = false, data = {}, onLine = () => {}, onEnd = () => {}, cps = 42 } = {}) {
  if (!doc.getElementById('conv-css')) { const st = doc.createElement('style'); st.id = 'conv-css'; st.textContent = CSS; doc.head.appendChild(st); }
  const root = doc.createElement('div'); root.className = 'conv';
  root.innerHTML = `<div class="panel" role="button" tabindex="0" aria-label="Next line">
    <div class="tag"></div><div class="who"></div><div class="role"></div><div class="line" aria-live="polite"></div>
    <div class="foot"><div class="pips"></div><div class="next">TAP ▸</div></div></div>`;
  parent.appendChild(root);
  const holo = createHoloPanel(doc, { reduce }); parent.appendChild(holo.el);   // placed in the scene, beside the speaker
  const $ = (s) => root.querySelector(s);
  const panel = $('.panel'), lineEl = $('.line'), nextEl = $('.next'), pipsEl = $('.pips');
  pipsEl.innerHTML = script.lines.map(() => '<i></i>').join('');
  const pips = [...pipsEl.children];

  const C = createConversationState(script, { cps, reduce });
  let utter = null, lastIndex = -1, ended = false;
  try { initAudio(); } catch (e) { /* no audio: captions carry it */ }

  function enterLine(st) {
    const sp = st.speaker;
    $('.tag').textContent = (sp.fac === 'collective' ? 'THE COLLECTIVE' : (sp.fac || '').toUpperCase());
    $('.who').textContent = sp.name; $('.role').textContent = sp.title || '';
    pips.forEach((p, i) => p.classList.toggle('on', i <= st.index));
    if (st.slide) holo.show(st.slide, { ...(script.slides[st.slide] || {}), data }); else holo.hide();
    if (utter) utter.stop();
    try { utter = playUtterance(st.line.text, paramsFor(sp.voice), { gender: sp.gender, intent: st.line.intent || 'statement', seed: hash(st.line.text) }); }
    catch (e) { utter = null; }
    onLine(st);
  }

  function press() {
    if (ended) return;
    const r = C.press();
    if (r === 'end') { ended = true; if (utter) utter.stop(); onEnd(); }
  }
  panel.addEventListener('pointerup', (e) => { e.stopPropagation(); press(); });
  const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(); } };
  doc.addEventListener('keydown', onKey);
  panel.focus({ preventScroll: true });

  return {
    el: root,
    press,
    tick(dt) {
      const st = C.tick(dt);
      if (st.index !== lastIndex) { lastIndex = st.index; enterLine(st); }
      if (lineEl.textContent !== st.text) lineEl.textContent = st.text;
      nextEl.classList.toggle('on', st.full);
      nextEl.textContent = st.full && st.index === st.count - 1 ? 'CONTINUE ▸' : 'TAP ▸';
      return st;
    },
    get state() { return C.state; },
    close() { doc.removeEventListener('keydown', onKey); if (utter) utter.stop(); holo.dispose(); root.remove(); },
  };
}
