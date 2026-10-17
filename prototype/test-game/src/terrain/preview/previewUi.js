/**
 * src/terrain/preview/previewUi.js — the small shared kit the 3D previewers draw their controls with, so they look
 * the same in the Terrain Forge (dark tool chrome) and on the standalone review pages. [MM-story_mvbpfb1b_k]
 *
 * Every colour reads a --pv-* variable with the Forge's dark value as the fallback, so a host page re-themes the
 * previewers by setting --pv-* on any ancestor (the standalone pages do, for light / dark). No framework.
 */

const CSS = `
.pv-root { --pv-text-c: var(--pv-text, #e6ecf3); --pv-mute-c: var(--pv-mute, #8fa0b3); --pv-line-c: var(--pv-line, #28303b);
  --pv-chip-c: var(--pv-chip, #1a1f28); --pv-accent-c: var(--pv-accent, #d9a441); --pv-panel-c: var(--pv-panel, #161b22);
  color: var(--pv-text-c); font-size: 12px; }
.pv-root h2 { font-size: 10px; letter-spacing: .22em; color: var(--pv-mute-c); margin: 16px 0 8px; text-transform: uppercase; font-weight: 700; }
.pv-root h2:first-child { margin-top: 4px; }
.pv-seg { display: flex; flex-wrap: wrap; gap: 4px; }
.pv-root button.pv-b { width: auto; margin: 0; padding: 6px 10px; border: 1px solid var(--pv-line-c); border-radius: 5px; background: var(--pv-chip-c);
  color: var(--pv-text-c); font: inherit; font-size: 12px; font-weight: 500; letter-spacing: 0; cursor: pointer; }
.pv-root .pv-seg button.pv-b[aria-pressed="true"] { background: var(--pv-text-c); color: var(--pv-panel-c); border-color: var(--pv-text-c); }
.pv-root button.pv-b.pv-primary { background: var(--pv-accent-c); border-color: var(--pv-accent-c); color: #111; font-weight: 700; }
.pv-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
.pv-ck { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; color: var(--pv-text-c); }
.pv-ck input { accent-color: var(--pv-accent-c); }
.pv-root select { font: inherit; padding: 4px 6px; border-radius: 5px; border: 1px solid var(--pv-line-c); background: var(--pv-chip-c); color: var(--pv-text-c); }
.pv-info { border: 1px solid var(--pv-line-c); border-radius: 8px; padding: 10px 12px; background: var(--pv-chip-c); }
.pv-info .pv-nm { font-size: 18px; font-weight: 700; line-height: 1.1; }
.pv-info .pv-fc { color: var(--pv-accent-c); font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; margin: 3px 0 6px; }
.pv-info p { margin: 0; color: var(--pv-mute-c); font-size: 11.5px; line-height: 1.45; }
.pv-info dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; margin: 8px 0 0; font-size: 11.5px; }
.pv-info dt { color: var(--pv-mute-c); } .pv-info dd { margin: 0; }
.pv-crafts { display: grid; gap: 4px; }
.pv-root button.pv-craft { display: grid; grid-template-columns: 26px 1fr auto; gap: 8px; align-items: center; width: 100%; margin: 0; padding: 7px 8px;
  border: 1px solid var(--pv-line-c); border-radius: 6px; background: var(--pv-chip-c); color: var(--pv-text-c); cursor: pointer; text-align: left;
  font: inherit; font-weight: 400; letter-spacing: 0; }
.pv-root button.pv-craft[aria-pressed="true"] { border-color: var(--pv-accent-c); box-shadow: inset 3px 0 0 var(--pv-accent-c); }
.pv-sw { width: 26px; height: 26px; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; border: 1px solid rgba(0,0,0,.2); }
.pv-craft b { display: block; font-size: 13px; }
.pv-craft small { color: var(--pv-mute-c); font-size: 10.5px; }
.pv-craft .pv-wt { font-size: 10px; color: var(--pv-mute-c); text-align: right; max-width: 96px; }
.pv-note { font-size: 10.5px; color: var(--pv-mute-c); line-height: 1.5; margin-top: 8px; }
.pv-stage { position: absolute; inset: 0; overflow: hidden; }
.pv-stage canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.pv-labels { position: absolute; inset: 0; pointer-events: none; }
.pv-vlabel { position: absolute; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.75); text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.pv-hud { position: absolute; left: 12px; bottom: 12px; right: 12px; display: flex; gap: 10px; align-items: center; pointer-events: none; }
.pv-phase { background: rgba(10,12,14,.72); color: #fff; padding: 6px 10px; border-radius: 5px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
.pv-bar { flex: 1; height: 4px; background: rgba(0,0,0,.25); border-radius: 2px; overflow: hidden; max-width: 340px; }
.pv-bar i { display: block; height: 100%; width: 0; background: var(--pv-accent-c); }
.pv-lab { position: absolute; transform: translate(-50%, 0); text-align: center; width: 180px; }
.pv-lab b { display: block; font-size: 15px; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
.pv-lab span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.pv-lab.pv-small b { font-size: 11.5px; } .pv-lab.pv-small span { font-size: 9px; }
.pv-foot { position: absolute; left: 14px; bottom: 12px; right: 14px; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.6); font-size: 11.5px; pointer-events: none; }
`;

export function injectPreviewCss(doc = document) {
  if (doc.getElementById('pv-style')) return;
  const s = doc.createElement('style'); s.id = 'pv-style'; s.textContent = CSS; doc.head.appendChild(s);
}

/** el('div', 'pv-row', '<b>x</b>') */
export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/** A segmented control: items [[key, label]], cur key, on(key). Returns { el, set(key) }. */
export function segmented(items, cur, on) {
  const box = el('div', 'pv-seg');
  const set = (k) => { for (const b of box.children) b.setAttribute('aria-pressed', b.dataset.k === k); };
  for (const [k, label] of items) {
    const b = el('button', 'pv-b', label); b.type = 'button'; b.dataset.k = k;
    b.onclick = () => { set(k); on(k); };
    box.appendChild(b);
  }
  set(cur);
  return { el: box, set };
}

export function checkbox(label, checked, on) {
  const l = el('label', 'pv-ck'), i = el('input'); i.type = 'checkbox'; i.checked = checked;
  i.onchange = () => on(i.checked);
  l.append(i, document.createTextNode(' ' + label));
  return { el: l, input: i };
}

/**
 * A three.js stage inside `host`: renderer (shadows on), canvas, a labels layer, resize tracking (ResizeObserver,
 * so it follows the host — a Forge panel — not just the window) and a start/stop render loop.
 */
export function createStage(THREE, host, frame) {
  const wrap = el('div', 'pv-stage'), labels = el('div', 'pv-labels');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  wrap.append(renderer.domElement, labels);
  host.appendChild(wrap);
  let raf = 0, last = 0, w = 1, h = 1, onResize = null;
  const resize = () => { w = wrap.clientWidth || 1; h = wrap.clientHeight || 1; renderer.setSize(w, h, false); if (onResize) onResize(w, h); };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(wrap); else window.addEventListener('resize', resize);
  const loop = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt, w, h); raf = requestAnimationFrame(loop); };
  return {
    renderer, wrap, labels,
    size: () => [w, h],
    set onResize(f) { onResize = f; },
    resize,
    get running() { return raf !== 0; },
    start() { if (raf) return; resize(); last = performance.now(); raf = requestAnimationFrame(loop); },
    stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
    dispose() { this.stop(); if (ro) ro.disconnect(); else window.removeEventListener('resize', resize); renderer.dispose(); wrap.remove(); },
  };
}
