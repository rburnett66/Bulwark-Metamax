/**
 * src/reveal/director.js — the one full-screen player every reveal runs in [MM-story_mw56v724_3].
 *
 * Tech plan: docs/tech-plan/Content-Reveal.md §7–8. Lifted from the opening's runner (opening/introRunner.js): one
 * mount over the game, a canvas for the 3D, an overlay for text, a fade, hold-to-skip, and a frame loop that pauses
 * while the tab is hidden. A reveal is a sequence of segments; a timed segment is `await d.timed(seconds, fn)` where
 * fn(t, dt) draws frame t. Holding SKIP (or Space / Esc) for 0.6 s ends the current timed segment at its last frame,
 * so whatever the segment grants still happens (§4.3: nothing a reveal grants is lost by skipping).
 *
 *   const d = openDirector({ label: 'New planet discovered' });
 *   d.banner('NEW PLANET DISCOVERED', 'FLORAEL');  await d.timed(2.5, (t) => …);  await d.fade(1, 0.6);  d.close();
 *
 * While a director is open the body carries .rv-on, which lifts the comm card above it (comm/commCard.js mounts on body).
 */
const CSS = `
.rv { position:fixed; inset:0; z-index:200; color:#e9e2d6; font:14px/1.45 "IBM Plex Sans Condensed", system-ui, sans-serif; overflow:hidden; user-select:none; pointer-events:none; }
.rv.solid { background:#000; pointer-events:auto; touch-action:none; }
.rv canvas.rv-gl { position:absolute; inset:0; width:100%; height:100%; display:block; opacity:0; }
.rv.gl canvas.rv-gl { opacity:1; }
.rv .rv-fade { position:absolute; inset:0; background:#000; opacity:0; transition:opacity .6s ease; pointer-events:none; }
.rv .rv-ui { position:absolute; inset:0; pointer-events:none; }
.rv .rv-ui > * { pointer-events:auto; }
.rv .rv-banner { position:absolute; left:0; right:0; top:38%; text-align:center; pointer-events:none; opacity:0; transition:opacity .5s ease; }
.rv .rv-banner.on { opacity:1; }
.rv .rv-banner .k { font:600 clamp(12px,1.6vw,15px) "Chakra Petch", sans-serif; letter-spacing:.42em; padding-left:.42em; color:#6fd3c8; }
.rv .rv-banner .t { margin-top:6px; font:700 clamp(30px,6vw,64px) "Chakra Petch", sans-serif; letter-spacing:.14em; padding-left:.14em; color:#f2c869; text-shadow:0 0 24px rgba(242,200,105,.35); }
.rv .rv-banner .s { margin-top:8px; font-size:clamp(12px,1.4vw,14px); letter-spacing:.2em; color:#cfc4b4; }
.rv .rv-banner.dark { background:linear-gradient(90deg, transparent, rgba(4,6,9,.9) 18%, rgba(4,6,9,.9) 82%, transparent); padding:34px 0 30px; top:32%; backdrop-filter:blur(3px); }
.rv .rv-skip { position:absolute; right:max(16px, env(safe-area-inset-right)); bottom:max(16px, env(safe-area-inset-bottom)); display:none;
  font:600 12px "Chakra Petch", sans-serif; letter-spacing:.16em; color:#e9e2d6; background:rgba(14,9,8,.78); border:1px solid rgba(242,200,105,.35);
  border-radius:6px; padding:9px 13px; min-height:36px; cursor:pointer; overflow:hidden; }
.rv .rv-skip i { position:absolute; left:0; bottom:0; height:2px; width:0; background:#f2c869; }
.rv .rv-skip:focus-visible { outline:2px solid #f2c869; outline-offset:2px; }
.rv .rv-cap { position:absolute; left:0; right:0; bottom:max(28px, env(safe-area-inset-bottom)); text-align:center; font:600 clamp(13px,1.8vw,18px) "Chakra Petch", sans-serif;
  letter-spacing:.3em; padding-left:.3em; color:#f2c869; text-shadow:0 0 14px rgba(0,0,0,.9); pointer-events:none; opacity:0; transition:opacity .5s; }
body.rv-on .bw-comm { z-index:260; }
body.rv-on .bw-audio { display:none; }
body.rv-on .bwc-veil { position:fixed; z-index:250; pointer-events:auto; }
@media (prefers-reduced-motion: reduce) { .rv .rv-fade, .rv .rv-banner, .rv .rv-cap { transition:none; } }
`;
const HOLD_S = 0.6, SKIP_AFTER = 2;

export function openDirector({ mount = document.body, label = 'Reveal', reduce = null, solid = false } = {}) {
  const doc = mount.ownerDocument || document;
  const rm = reduce != null ? reduce : !!(doc.defaultView && doc.defaultView.matchMedia && doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!doc.getElementById('rv-css')) { const st = doc.createElement('style'); st.id = 'rv-css'; st.textContent = CSS; doc.head.appendChild(st); }
  const root = doc.createElement('div'); root.className = 'rv' + (solid ? ' solid' : '');
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', label);
  root.innerHTML = `<canvas class="rv-gl"></canvas><div class="rv-fade"></div><div class="rv-ui"></div>
    <div class="rv-banner"><div class="k"></div><div class="t"></div><div class="s"></div></div><div class="rv-cap" aria-live="polite"></div>
    <button class="rv-skip" type="button" aria-label="Hold to skip">HOLD TO SKIP ▸<i></i></button>`;
  mount.appendChild(root);
  doc.body.classList.add('rv-on');
  const $ = (s) => root.querySelector(s);
  const canvas = $('.rv-gl'), fadeEl = $('.rv-fade'), ui = $('.rv-ui'), bannerEl = $('.rv-banner'), capEl = $('.rv-cap'), skipEl = $('.rv-skip'), skipBar = skipEl.querySelector('i');

  // ── hold to skip ──────────────────────────────────────────────────────────────────────────────────────────────
  let holding = false, held = 0, skipNow = false, closed = false;
  const down = (e) => { e.preventDefault(); holding = true; };
  const up = () => { holding = false; held = 0; skipBar.style.width = '0'; };
  skipEl.addEventListener('pointerdown', down); skipEl.addEventListener('pointerup', up); skipEl.addEventListener('pointerleave', up);
  const onKey = (e) => { if ((e.key === ' ' || e.key === 'Escape') && skipEl.style.display === 'block') { e.preventDefault(); if (e.type === 'keydown') holding = true; else up(); } };
  doc.addEventListener('keydown', onKey); doc.addEventListener('keyup', onKey);

  /** Run a timed segment: fn(t, dt, end) every frame for up to `seconds` (fn returning true ends it early); resolves
   *  { skipped } at the end (on a skip fn sees end = true once, so it can jump to its final state). */
  function timed(seconds, fn, { skippable = true } = {}) {
    return new Promise((resolve) => {
      let t = 0, last = performance.now(), raf = 0;
      skipNow = false;
      const step = (now) => {
        if (closed) { resolve({ skipped: true, closed: true }); return; }
        raf = requestAnimationFrame(step);
        if (doc.hidden) { last = now; return; }
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (holding) { held += dt; skipBar.style.width = Math.min(100, (held / HOLD_S) * 100) + '%'; if (held >= HOLD_S) { skipNow = true; up(); } }
        t += dt;
        skipEl.style.display = skippable && t > SKIP_AFTER && t < seconds ? 'block' : 'none';
        let end = t >= seconds || skipNow, r = false;
        try { r = fn(end ? seconds : t, dt, end); } catch (e) { console.error('[reveal]', e); }
        if (r === true) end = true;                    // the segment says it is done (a scan that locked early)
        if (end) { cancelAnimationFrame(raf); skipEl.style.display = 'none'; resolve({ skipped: skipNow && t < seconds }); skipNow = false; }
      };
      raf = requestAnimationFrame(step);
    });
  }
  /** A free-running loop (player-paced beats): fn(dt) each frame until stop() is called. */
  function loop(fn) {
    let last = performance.now(), raf = 0, on = true;
    const step = (now) => {
      if (!on || closed) return;
      raf = requestAnimationFrame(step);
      if (doc.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      try { fn(dt); } catch (e) { console.error('[reveal]', e); }
    };
    raf = requestAnimationFrame(step);
    return { stop() { on = false; cancelAnimationFrame(raf); } };
  }
  const wait = (s) => new Promise((r) => setTimeout(r, rm ? Math.min(s * 1000, 150) : s * 1000));

  return {
    root, ui, canvas, reduce: rm, doc,
    timed, loop, wait,
    /** Fade to black (alpha 1) or clear (0) over `sec`. */
    fade(alpha, sec = 0.6) {
      fadeEl.style.transitionDuration = (rm ? 0 : sec) + 's'; fadeEl.style.opacity = String(alpha);
      return wait(sec);
    },
    setSolid(on) { root.classList.toggle('solid', !!on); },
    showGL(on) { root.classList.toggle('gl', !!on); },
    banner(kicker, title, sub = '', { dark = false } = {}) {
      bannerEl.querySelector('.k').textContent = kicker || ''; bannerEl.querySelector('.t').textContent = title || '';
      bannerEl.querySelector('.s').textContent = sub || ''; bannerEl.classList.toggle('dark', dark); bannerEl.classList.add('on');
    },
    hideBanner() { bannerEl.classList.remove('on'); },
    caption(text, on = true) { capEl.textContent = text || ''; capEl.style.opacity = on && text ? '1' : '0'; },
    get closed() { return closed; },
    close() {
      if (closed) return; closed = true;
      doc.removeEventListener('keydown', onKey); doc.removeEventListener('keyup', onKey);
      doc.body.classList.remove('rv-on');
      root.remove();
    },
  };
}
