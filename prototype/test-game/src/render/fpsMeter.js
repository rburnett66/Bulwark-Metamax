/**
 * src/render/fpsMeter.js — the frame-rate counter behind Settings › FPS [MM-story_mw2s3s9k_c].
 *
 * Owner 2026-11-04: "Let's add a framerate counter to settings as a toggle on/off." (to compare ground modes, e.g. the
 * tiled terrain prototype, on real phones and desktops).
 *
 * It times real display frames with its own requestAnimationFrame loop (not the game's ticker), so it measures what
 * the player sees. Off = no loop, no element on screen, nothing measured. The readout updates twice a second:
 *   60 FPS · 16.7 ms · worst 21 ms
 *   3D 24 calls · 134k tris · tiled · High
 * The stats are pure (createFrameStats) and node-tested; the DOM part is createFpsMeter.
 */

export const FPS_KEY = 'bw.fps';
export const FPS_WINDOW = 120;   // frames kept for the averages (~2 s at 60 FPS)

/** Rolling frame-time stats. push(dtMs) per frame; summary() → { fps, avgMs, worstMs, low1Fps, frames }. */
export function createFrameStats(n = FPS_WINDOW) {
  const buf = new Float64Array(n);
  let count = 0, head = 0;
  return {
    push(dt) {
      if (!(dt > 0) || dt > 1000) return;   // a hidden tab or a stall: not a frame worth averaging
      buf[head] = dt; head = (head + 1) % n; if (count < n) count++;
    },
    reset() { count = 0; head = 0; },
    summary() {
      if (!count) return { fps: 0, avgMs: 0, worstMs: 0, low1Fps: 0, frames: 0 };
      let sum = 0, worst = 0;
      const xs = [];
      for (let i = 0; i < count; i++) { const v = buf[i]; sum += v; if (v > worst) worst = v; xs.push(v); }
      xs.sort((a, b) => a - b);
      const p99 = xs[Math.min(count - 1, Math.floor(count * 0.99))];
      const avg = sum / count;
      return { fps: 1000 / avg, avgMs: avg, worstMs: worst, low1Fps: 1000 / p99, frames: count };
    },
  };
}

const k = (n) => (n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n | 0));

/** The readout lines for a summary and optional 3D info { calls, triangles, ground, tier }. */
export function fpsText(s, info = null) {
  const lines = [`${Math.round(s.fps)} FPS · ${s.avgMs.toFixed(1)} ms · worst ${Math.round(s.worstMs)} ms`];
  if (info) {
    const bits = [];
    if (info.calls != null) bits.push(`${info.calls} calls`);
    if (info.triangles != null) bits.push(`${k(info.triangles)} tris`);
    if (info.ground) bits.push(info.ground);
    if (info.tier) bits.push(info.tier);
    if (bits.length) lines.push('3D ' + bits.join(' · '));
  }
  return lines;
}

/** Read / write the saved choice (off by default; storage may be missing or throw). */
export function loadFpsChoice(storage) {
  try { return !!storage && storage.getItem(FPS_KEY) === '1'; } catch (e) { return false; }
}
export function saveFpsChoice(storage, on) {
  try { if (storage) storage.setItem(FPS_KEY, on ? '1' : '0'); } catch (e) { /* private mode */ }
}

export const FPS_CSS = `
.bw-fps { position:fixed; right:calc(6px + env(safe-area-inset-right, 0px)); top:calc(52px + env(safe-area-inset-top, 0px)); z-index:2147483000; pointer-events:none;
  background:rgba(8,12,16,0.78); border:1px solid #2a3a4a; border-radius:4px; padding:3px 7px;
  font:600 11px/1.35 ui-monospace, Menlo, Consolas, monospace; color:#9fe8ff; white-space:pre; display:none; }
.bw-fps.on { display:block; }
.bw-fps .slow { color:#ffb36a; }
.bw-fps .bad { color:#ff7a6a; }
`;

/**
 * The on-screen meter. `getInfo()` → { calls, triangles, ground, tier } or null (no 3D view). Returns
 * { el, set(on), on, stats }. The loop runs only while on. Fixed to the viewport above every overlay (dialogs
 * included) and click-through, so it never blocks the game.
 */
export function createFpsMeter(doc, parent, { getInfo = () => null, everyMs = 500 } = {}) {
  const win = doc.defaultView;
  const el = doc.createElement('div');
  el.className = 'bw-fps';
  el.setAttribute('aria-live', 'off');
  parent.appendChild(el);
  const stats = createFrameStats();
  let raf = 0, last = 0, shownAt = 0, on = false;
  const tick = (t) => {
    raf = win.requestAnimationFrame(tick);
    if (last) stats.push(t - last);
    last = t;
    if (t - shownAt < everyMs) return;
    shownAt = t;
    const s = stats.summary();
    let info = null;
    try { info = getInfo(); } catch (e) { info = null; }
    const [a, b] = fpsText(s, info);
    const cls = s.fps < 30 ? 'bad' : s.fps < 50 ? 'slow' : '';
    el.innerHTML = (cls ? `<span class="${cls}">${a}</span>` : a) + (b ? '\n' + b : '');
  };
  const meter = {
    el, stats,
    get on() { return on; },
    set(v) {
      on = !!v;
      el.classList.toggle('on', on);
      if (on && !raf) { stats.reset(); last = 0; shownAt = 0; el.textContent = '— FPS'; raf = win.requestAnimationFrame(tick); }
      if (!on && raf) { win.cancelAnimationFrame(raf); raf = 0; }
      return on;
    },
  };
  return meter;
}
