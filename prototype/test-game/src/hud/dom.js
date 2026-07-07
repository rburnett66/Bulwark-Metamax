// src/hud/dom.js
// Lightweight DOM HUD overlay helpers (screen-space, never rotates).
// These build and manage plain DOM elements layered above the pixi canvas.
// Presentation-only: reads sim state via callbacks, never mutates sim.

const HUD_ROOT_ID = 'bulwark-hud-root';

/**
 * Ensure a screen-space overlay container exists on top of the canvas.
 * The overlay uses pointer-events:none so pixi still gets pointer input,
 * except for individual interactive widgets which re-enable pointer-events.
 */
export function ensureHudRoot() {
  let root = document.getElementById(HUD_ROOT_ID);
  if (root) return root;
  root = document.createElement('div');
  root.id = HUD_ROOT_ID;
  Object.assign(root.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    right: '0',
    bottom: '0',
    zIndex: '1000',
    pointerEvents: 'none',
    fontFamily: 'monospace, "Courier New", Courier',
    color: '#e8e8e8',
    userSelect: 'none',
    webkitUserSelect: 'none',
  });
  document.body.appendChild(root);
  return root;
}

/**
 * Create a generic panel (DOM box) appended to the HUD root.
 * Panels never rotate with the camera; they are screen-space.
 */
export function makePanel(opts = {}) {
  const root = ensureHudRoot();
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'absolute',
    boxSizing: 'border-box',
    background: opts.bg || 'rgba(12,16,22,0.82)',
    border: opts.border || '1px solid rgba(120,160,200,0.35)',
    borderRadius: opts.radius || '4px',
    padding: opts.padding || '8px 10px',
    fontSize: opts.fontSize || '13px',
    lineHeight: '1.4',
    pointerEvents: opts.interactive === false ? 'none' : 'auto',
    color: '#e8e8e8',
    minWidth: opts.minWidth || 'auto',
  });
  if (opts.left != null) el.style.left = px(opts.left);
  if (opts.right != null) el.style.right = px(opts.right);
  if (opts.top != null) el.style.top = px(opts.top);
  if (opts.bottom != null) el.style.bottom = px(opts.bottom);
  if (opts.width != null) el.style.width = px(opts.width);
  if (opts.className) el.className = opts.className;
  root.appendChild(el);
  return el;
}

/** Create a labelled text row that we can update cheaply. */
export function makeReadout(parent, label) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.justifyContent = 'space-between';
  row.style.gap = '12px';
  const lab = document.createElement('span');
  lab.textContent = label;
  lab.style.opacity = '0.7';
  const val = document.createElement('span');
  val.style.fontWeight = 'bold';
  val.textContent = '';
  row.appendChild(lab);
  row.appendChild(val);
  parent.appendChild(row);
  return {
    row,
    set(text) {
      if (val.textContent !== text) val.textContent = text;
    },
    setColor(c) {
      val.style.color = c;
    },
  };
}

/** Create a horizontal progress/HP bar. */
export function makeBar(parent, opts = {}) {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'relative',
    width: opts.width ? px(opts.width) : '100%',
    height: (opts.height || 14) + 'px',
    background: 'rgba(0,0,0,0.55)',
    border: '1px solid rgba(160,160,160,0.4)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '4px',
  });
  const fill = document.createElement('div');
  Object.assign(fill.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    bottom: '0',
    width: '100%',
    background: opts.color || '#54c85a',
    transition: 'width 0.12s linear, background 0.2s linear',
  });
  const text = document.createElement('div');
  Object.assign(text.style, {
    position: 'absolute',
    left: '0',
    right: '0',
    top: '0',
    bottom: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    color: '#fff',
    textShadow: '0 1px 1px rgba(0,0,0,0.8)',
  });
  wrap.appendChild(fill);
  wrap.appendChild(text);
  parent.appendChild(wrap);
  return {
    wrap,
    set(frac, label) {
      const f = Math.max(0, Math.min(1, frac));
      fill.style.width = (f * 100).toFixed(1) + '%';
      // color shift green -> yellow -> red
      let col = '#54c85a';
      if (f < 0.66) col = '#d3c33a';
      if (f < 0.33) col = '#d3533a';
      fill.style.background = opts.color || col;
      if (label != null) text.textContent = label;
    },
  };
}

/** Create a clickable button widget. */
export function makeButton(parent, label, onClick, opts = {}) {
  const btn = document.createElement('button');
  btn.textContent = label;
  Object.assign(btn.style, {
    display: 'block',
    width: opts.full === false ? 'auto' : '100%',
    margin: opts.margin || '4px 0 0 0',
    padding: opts.padding || '6px 8px',
    background: opts.bg || 'rgba(40,70,110,0.9)',
    color: '#fff',
    border: '1px solid rgba(140,180,220,0.5)',
    borderRadius: '3px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: opts.fontSize || '12px',
    textAlign: 'left',
    pointerEvents: 'auto',
  });
  btn.addEventListener('mouseenter', () => {
    if (!btn.disabled) btn.style.background = opts.hover || 'rgba(60,100,150,0.95)';
  });
  btn.addEventListener('mouseleave', () => {
    if (!btn.disabled) btn.style.background = opts.bg || 'rgba(40,70,110,0.9)';
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!btn.disabled && onClick) onClick(e);
  });
  // Prevent pointer from leaking to the canvas beneath.
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  parent.appendChild(btn);
  return {
    el: btn,
    setLabel(t) {
      if (btn.textContent !== t) btn.textContent = t;
    },
    setEnabled(on) {
      btn.disabled = !on;
      btn.style.opacity = on ? '1' : '0.4';
      btn.style.cursor = on ? 'pointer' : 'default';
    },
    setBg(c) {
      btn.style.background = c;
    },
    remove() {
      btn.remove();
    },
  };
}

/** A selectable list row (used by build panel). */
export function makeListItem(parent, opts = {}) {
  const item = document.createElement('div');
  Object.assign(item.style, {
    display: 'flex',
    flexDirection: 'column',
    padding: '5px 7px',
    margin: '3px 0',
    background: 'rgba(30,40,55,0.85)',
    border: '1px solid rgba(100,130,170,0.35)',
    borderRadius: '3px',
    cursor: 'pointer',
    pointerEvents: 'auto',
    fontSize: '12px',
  });
  const title = document.createElement('div');
  title.style.fontWeight = 'bold';
  title.style.display = 'flex';
  title.style.justifyContent = 'space-between';
  const nameSpan = document.createElement('span');
  const costSpan = document.createElement('span');
  costSpan.style.color = '#ffd45a';
  title.appendChild(nameSpan);
  title.appendChild(costSpan);
  const sub = document.createElement('div');
  sub.style.opacity = '0.7';
  sub.style.fontSize = '10px';
  item.appendChild(title);
  item.appendChild(sub);

  item.addEventListener('pointerdown', (e) => e.stopPropagation());
  if (opts.onClick) {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onClick(e);
    });
  }
  parent.appendChild(item);

  let affordable = true;
  let selected = false;
  function applyStyle() {
    item.style.opacity = affordable ? '1' : '0.4';
    item.style.borderColor = selected
      ? 'rgba(255,210,90,0.9)'
      : 'rgba(100,130,170,0.35)';
    item.style.background = selected
      ? 'rgba(55,70,95,0.95)'
      : 'rgba(30,40,55,0.85)';
    item.style.cursor = affordable ? 'pointer' : 'default';
  }
  return {
    el: item,
    setName(t) {
      if (nameSpan.textContent !== t) nameSpan.textContent = t;
    },
    setCost(t) {
      if (costSpan.textContent !== t) costSpan.textContent = t;
    },
    setSub(t) {
      if (sub.textContent !== t) sub.textContent = t;
    },
    setAffordable(on) {
      affordable = !!on;
      applyStyle();
    },
    setSelected(on) {
      selected = !!on;
      applyStyle();
    },
  };
}

/** Transient floating toast message (e.g. "Insufficient funds", "Win!"). */
export function toast(message, opts = {}) {
  const root = ensureHudRoot();
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'absolute',
    left: '50%',
    top: opts.top != null ? px(opts.top) : '18%',
    transform: 'translate(-50%,0)',
    background: opts.bg || 'rgba(20,25,35,0.92)',
    color: opts.color || '#fff',
    border: '1px solid rgba(160,180,210,0.5)',
    borderRadius: '5px',
    padding: '10px 18px',
    fontSize: opts.fontSize || '16px',
    fontWeight: 'bold',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.2s linear, top 0.4s ease-out',
    whiteSpace: 'nowrap',
    zIndex: '2000',
  });
  el.textContent = message;
  root.appendChild(el);
  // trigger fade in
  requestAnimationFrame(() => {
    el.style.opacity = '1';
  });
  const dur = opts.duration || 1600;
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.top = (parseFloat(el.style.top) - 3) + '%';
    setTimeout(() => el.remove(), 300);
  }, dur);
  return el;
}

/** Persistent banner for win/lose end states. */
export function showBanner(message, opts = {}) {
  const root = ensureHudRoot();
  clearBanner();
  const el = document.createElement('div');
  el.setAttribute('data-hud-banner', '1');
  Object.assign(el.style, {
    position: 'absolute',
    left: '50%',
    top: '40%',
    transform: 'translate(-50%,-50%)',
    background: opts.bg || 'rgba(10,12,18,0.9)',
    color: opts.color || '#fff',
    border: '2px solid ' + (opts.border || 'rgba(200,200,200,0.7)'),
    borderRadius: '8px',
    padding: '22px 34px',
    fontSize: '28px',
    fontWeight: 'bold',
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: '2000',
  });
  el.textContent = message;
  root.appendChild(el);
  return el;
}

export function clearBanner() {
  const root = ensureHudRoot();
  root.querySelectorAll('[data-hud-banner]').forEach((n) => n.remove());
}

/** Small floating "+gold" delta indicator at screen coordinates. */
export function goldDelta(x, y, amount) {
  const root = ensureHudRoot();
  const el = document.createElement('div');
  el.textContent = (amount >= 0 ? '+' : '') + Math.round(amount);
  Object.assign(el.style, {
    position: 'absolute',
    left: px(x),
    top: px(y),
    transform: 'translate(-50%,-50%)',
    color: amount >= 0 ? '#ffd45a' : '#ff7a5a',
    fontWeight: 'bold',
    fontSize: '14px',
    textShadow: '0 1px 2px rgba(0,0,0,0.9)',
    pointerEvents: 'none',
    transition: 'top 0.7s ease-out, opacity 0.7s linear',
    opacity: '1',
    zIndex: '1500',
  });
  root.appendChild(el);
  requestAnimationFrame(() => {
    el.style.top = px(y - 34);
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 720);
  return el;
}

/** Divider / section header helper. */
export function makeHeader(parent, text) {
  const h = document.createElement('div');
  h.textContent = text;
  Object.assign(h.style, {
    fontWeight: 'bold',
    fontSize: '12px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    opacity: '0.85',
    borderBottom: '1px solid rgba(140,160,190,0.3)',
    paddingBottom: '3px',
    marginBottom: '5px',
    color: '#9fc2e0',
  });
  parent.appendChild(h);
  return h;
}

/** Utility: format gold with thousands separator. */
export function fmtGold(n) {
  return Math.floor(n).toLocaleString('en-US');
}

function px(v) {
  return typeof v === 'number' ? v + 'px' : String(v);
}