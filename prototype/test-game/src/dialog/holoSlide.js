/**
 * src/dialog/holoSlide.js — the holo-projector slides inside a conversation [MM-story_mw47llqj_6].
 *
 * Design: Collective-Opening-Design §6.3 — a projector on the counter blooms and a still floats above it as a
 * scan-lined panel; slow Ken Burns pan and zoom, a subtle flicker, cross-dissolves. Until the owner's stills arrive
 * (WebP, 1280 px), each slide is DRAWN on a canvas from primitives, in the hologram's two-tone cyan and gold, so the
 * script's slide ids work today and an image swaps in later (`slide.image`).
 *
 *   HOLO_SLIDES[id](ctx, w, h, data)   — pure canvas drawing (importable headless; no DOM at import)
 *   const holo = createHoloPanel(doc, { reduce }); parent.appendChild(holo.el);
 *   holo.show(id, { title, caption, image?, data }) · holo.hide() · holo.dispose()
 */

const CY = '#7fe9ff', CY2 = 'rgba(127,233,255,', GOLD = '#f2c869', EMBER = '#ff7a3c';

function glowLine(x, w) { x.shadowColor = CY; x.shadowBlur = 12 * (w / 640); }
function ring(x, cx, cy, r, color, lw = 2) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.strokeStyle = color; x.lineWidth = lw; x.stroke(); }

/** One drawing per slide id. Each draws into a w × h canvas (16:9). */
export const HOLO_SLIDES = {
  // the capital ship in profile: hull, dome, decks, stern engines; Vesper's arc behind
  ledger(x, w, h) {
    const u = w / 640;
    x.strokeStyle = EMBER; x.lineWidth = 2 * u; x.beginPath(); x.arc(-w * 0.1, h * 1.25, h * 1.05, -1.25, -0.25); x.stroke();
    glowLine(x, w); x.strokeStyle = CY; x.lineWidth = 2.2 * u;
    const L = w * 0.16, R = w * 0.86, T = h * 0.42, B = h * 0.66;
    x.beginPath(); x.moveTo(L, T + 10 * u); x.lineTo(L + 30 * u, T); x.lineTo(R - 40 * u, T); x.quadraticCurveTo(R + 30 * u, (T + B) / 2, R - 40 * u, B); x.lineTo(L + 20 * u, B); x.lineTo(L, B - 12 * u); x.closePath(); x.stroke();
    x.beginPath(); x.ellipse(w * 0.52, T, w * 0.1, h * 0.06, 0, Math.PI, 0); x.stroke();
    for (const f of [0.33, 0.66]) { x.beginPath(); x.moveTo(L + 20 * u, T + (B - T) * f); x.lineTo(R - 30 * u, T + (B - T) * f); x.globalAlpha = 0.5; x.stroke(); x.globalAlpha = 1; }
    for (let i = 0; i < 3; i++) { x.fillStyle = GOLD; x.fillRect(L - 18 * u, T + 8 * u + i * 14 * u, 14 * u, 6 * u); }
    x.shadowBlur = 0;
  },
  // the Collective's seal: rings, eight spokes, a ledger mark
  seal(x, w, h) {
    const cx = w / 2, cy = h / 2, r = h * 0.32;
    glowLine(x, w);
    ring(x, cx, cy, r, GOLD, 3 * w / 640); ring(x, cx, cy, r * 0.78, CY, 1.5 * w / 640);
    x.strokeStyle = CY; x.lineWidth = 2 * w / 640;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2); x.lineTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7); x.stroke(); }
    x.fillStyle = GOLD; x.fillRect(cx - r * 0.12, cy - r * 0.12, r * 0.24, r * 0.24);
    x.shadowBlur = 0;
  },
  // nine homeworlds on a spiral arm, joined by trade lanes to one gold hub
  frontier(x, w, h) {
    const cx = w * 0.5, cy = h * 0.52, hub = [w * 0.82, h * 0.22];
    x.strokeStyle = CY2 + '0.25)'; x.lineWidth = 1;
    for (let k = 0; k < 2; k++) { x.beginPath(); for (let t = 0; t < 1; t += 0.01) { const a = k * Math.PI + t * 2.6 * Math.PI, r = 12 + t * h * 0.42; x.lineTo(cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 0.6); } x.stroke(); }
    glowLine(x, w);
    for (let i = 0; i < 9; i++) {
      const t = 0.15 + i * 0.095, a = (i % 2) * Math.PI + t * 2.6 * Math.PI, r = 12 + t * h * 0.42;
      const px = cx + Math.cos(a) * r * 1.5, py = cy + Math.sin(a) * r * 0.6;
      x.strokeStyle = 'rgba(242,200,105,0.45)'; x.setLineDash([4, 5]); x.beginPath(); x.moveTo(px, py); x.lineTo(hub[0], hub[1]); x.stroke(); x.setLineDash([]);
      x.fillStyle = CY; x.beginPath(); x.arc(px, py, 4 * w / 640, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = EMBER; x.beginPath(); x.arc(hub[0], hub[1], 9 * w / 640, 0, Math.PI * 2); x.fill();
    ring(x, hub[0], hub[1], 15 * w / 640, GOLD, 2);
    x.shadowBlur = 0;
  },
  // Verdance: a banded green globe with a harvest field marked
  verdance(x, w, h) {
    const cx = w * 0.5, cy = h * 0.52, r = h * 0.34;
    const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, 'rgba(150,255,190,0.55)'); g.addColorStop(1, 'rgba(30,120,80,0.25)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    glowLine(x, w); ring(x, cx, cy, r, CY, 2);
    x.strokeStyle = CY2 + '0.45)';
    for (let i = -2; i <= 2; i++) { x.beginPath(); x.ellipse(cx, cy + i * r * 0.3, r * Math.sqrt(1 - (i * 0.3) ** 2), r * 0.08, 0, 0, Math.PI * 2); x.stroke(); }
    x.strokeStyle = GOLD; x.lineWidth = 2; const fx = cx + r * 0.25, fy = cy - r * 0.15;
    x.strokeRect(fx - 10, fy - 10, 20, 20); x.beginPath(); x.moveTo(fx + 10, fy - 10); x.lineTo(cx + r * 1.2, cy - r * 0.8); x.stroke();
    x.shadowBlur = 0;
  },
  // the hauler: capsule hull, fins, engine glow, clamp brackets
  transport(x, w, h) {
    const cx = w * 0.5, cy = h * 0.52, L = w * 0.42, R = h * 0.14;
    glowLine(x, w); x.strokeStyle = CY; x.lineWidth = 2.2 * w / 640;
    x.beginPath(); x.moveTo(cx - L / 2, cy - R); x.lineTo(cx + L / 2 - R, cy - R); x.arc(cx + L / 2 - R, cy, R, -Math.PI / 2, Math.PI / 2); x.lineTo(cx - L / 2, cy + R); x.closePath(); x.stroke();
    x.fillStyle = GOLD; x.fillRect(cx - L * 0.35, cy - R * 2, L * 0.2, R * 0.9); x.fillRect(cx - L * 0.35, cy + R * 1.1, L * 0.2, R * 0.9);
    x.fillStyle = EMBER; x.beginPath(); x.ellipse(cx - L / 2 - 6, cy, 8, R * 0.8, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = CY2 + '0.5)';
    for (const f of [-0.15, 0.2]) { x.beginPath(); x.moveTo(cx + L * f, cy + R * 1.6); x.lineTo(cx + L * f, cy + R * 2.4); x.lineTo(cx + L * f + 30, cy + R * 2.4); x.stroke(); }
    x.shadowBlur = 0;
  },
  // the terms: two quota bars (common, uncommon) and the surplus arrow; rare kept
  terms(x, w, h, data = {}) {
    const q = data.contract || { common: 1000, uncommon: 100 };
    const u = w / 640, x0 = w * 0.18, bw = w * 0.5, rows = [['COMMON', q.common], ['UNCOMMON', q.uncommon]];
    x.font = `600 ${14 * u}px "Chakra Petch", sans-serif`; x.textBaseline = 'middle';
    rows.forEach(([name, v], i) => {
      const y = h * (0.36 + i * 0.2);
      x.fillStyle = CY; x.fillText(name, x0, y - 16 * u);
      x.strokeStyle = CY; x.lineWidth = 1.5; x.strokeRect(x0, y - 6 * u, bw, 14 * u);
      x.fillStyle = 'rgba(127,233,255,0.55)'; x.fillRect(x0, y - 6 * u, bw * 0.78, 14 * u);
      x.fillStyle = GOLD; x.fillText(`${v} SOLD`, x0 + bw + 10 * u, y + 1 * u);
    });
    x.fillStyle = GOLD; x.fillText('SURPLUS + RARE → YOURS', x0, h * 0.8);
  },
};

const CSS = `
/* beside the speaker, not over them: upper right on a wide screen, top centre on a phone held upright */
.holo { position:absolute; right:max(16px, 3.5vw); top:12%; width:min(380px, 34vw); aspect-ratio:16/9; pointer-events:none; z-index:4;
  opacity:0; transition:opacity .45s ease; }
@media (max-aspect-ratio: 1/1) { .holo { right:auto; left:50%; top:max(64px, 8%); width:min(420px, 86vw); transform:translateX(-50%); } }
.holo.on { opacity:1; }
.holo .frame { position:absolute; inset:0; border:1px solid rgba(127,233,255,.45); border-radius:6px; overflow:hidden;
  background:radial-gradient(120% 100% at 50% 110%, rgba(56,225,200,.22), rgba(4,14,20,.72) 60%); box-shadow:0 0 28px rgba(56,225,200,.25); }
.holo canvas { position:absolute; inset:0; width:100%; height:100%; transition:opacity .6s ease; }
.holo .kb { animation:holoKB 14s ease-in-out infinite alternate; }
@keyframes holoKB { from { transform:scale(1.02) translate(-1%, .5%); } to { transform:scale(1.1) translate(1.5%, -1%); } }
.holo .scan { position:absolute; inset:0; background:repeating-linear-gradient(0deg, rgba(127,233,255,.07) 0 1px, transparent 1px 3px); mix-blend-mode:screen; animation:holoFlick 4.3s steps(1) infinite; }
@keyframes holoFlick { 0%,100% { opacity:1 } 37% { opacity:.75 } 38% { opacity:1 } 81% { opacity:.85 } 82% { opacity:1 } }
.holo .cap { position:absolute; left:10px; right:10px; bottom:6px; font:600 11px "Chakra Petch", sans-serif; letter-spacing:.14em; color:#bff4ff; text-shadow:0 0 6px #38e1c8; }
.holo .cap b { color:#f2c869; margin-right:8px; }
.holo .beam { position:absolute; left:50%; top:100%; width:60%; height:16px; transform:translateX(-50%);
  background:radial-gradient(50% 100% at 50% 100%, rgba(56,225,200,.55), transparent); filter:blur(2px); }
@media (prefers-reduced-motion: reduce) { .holo .kb, .holo .scan { animation:none; } }
`;

/** The floating panel: two canvases cross-dissolve between slides. */
export function createHoloPanel(doc, { reduce = false } = {}) {
  if (!doc.getElementById('holo-css')) { const st = doc.createElement('style'); st.id = 'holo-css'; st.textContent = CSS; doc.head.appendChild(st); }
  const el = doc.createElement('div'); el.className = 'holo'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="frame"><canvas></canvas><canvas></canvas><div class="scan"></div><div class="cap"></div></div><div class="beam"></div>';
  const cvs = [...el.querySelectorAll('canvas')], cap = el.querySelector('.cap');
  let front = 0, current = null;
  const draw = (cv, id, opt) => {
    const W = 640, H = 360, dpr = Math.min(2, (doc.defaultView && doc.defaultView.devicePixelRatio) || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    if (opt.image) { const img = new Image(); img.onload = () => x.drawImage(img, 0, 0, W, H); img.src = opt.image; }
    else (HOLO_SLIDES[id] || (() => {}))(x, W, H, opt.data);
  };
  return {
    el,
    show(id, opt = {}) {
      if (id === current) return; current = id;
      const back = cvs[1 - front];
      draw(back, id, opt);
      back.classList.toggle('kb', !reduce);
      back.style.opacity = '1'; cvs[front].style.opacity = '0'; front = 1 - front;
      cap.innerHTML = `<b>${(opt.title || '').toUpperCase()}</b>${opt.caption || ''}`;
      el.classList.add('on');
    },
    hide() { current = null; el.classList.remove('on'); },
    dispose() { el.remove(); },
  };
}
