/**
 * src/render/hudCard.js — the HUD's one card: the upper-right info panel of every mode [MM-story_mwcuyrqr_3j].
 *
 * Spec docs/16 Bulwark MM/design/Outpost-AAA-UX.md §2 (D3, D10), owner 2026-11-12: "our Victory pop-ups look very good,
 * follow that design pattern for upper right info panels". The battle's selection panel, the outpost's status card and
 * the farm's plot panel are all THIS card, so the two modes cannot drift and a look change lands once. Its look is the
 * Victory pop-up's (render/resultsScreen.js) scaled down to a HUD card: the same tokens (render/uiTokens.js) — Rajdhani
 * text, Orbitron title and numbers, the steel gradient panel with a hairline border and gold corner ticks, a gold rule
 * under the title, letter-spaced steel section heads, resource rows with the pop-up's icon ring and bar, and buttons in
 * the pop-up's button style with the battle's gold hotkey glyph (.bw-key).
 *
 * Two ways to fill it, one look:
 *   - data: card.render(model) — the outpost card and the farm panel (outpost/view/outpostCard.js builds the model);
 *   - parts: card.title / card.status / card.body / card.actions + hudCardButton — the battle selection panel, which
 *     updates its own elements every frame (render/hud.js).
 * model = { title, status: { text, tone } | string, sections: [{ head, aside, items, rows, gauges, lines }],
 *           actions: [{ key, label, sub, enabled, title, primary, run }] }
 *   items:  [{ name, icon (resource icon id) | null, colour, units, rate, rateTone, pct }]   a resource row: icon · name · bar · units · rate
 *   rows:   [[key, value, tone?]]                                                a key / value line
 *   gauges: [{ label, value, pct, tone }]                                         a labelled fill bar (storage, hopper)
 *   lines:  [{ text, tone }]                                                      a note
 * tone: 'ok' | 'warn' | 'bad' | 'info' | 'gold' | 'dim' (absent = ink). Pure builders (hudCardModel, hudCardHtml) for tests.
 */
import { AAA_PANEL_BG, AAA_FONT_BODY, AAA_FONT_NUM, aaaTicksCss } from './uiTokens.js';
import { resourceIconHtml } from '../data/resourceIcons.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TONES = new Set(['ok', 'warn', 'bad', 'info', 'gold', 'dim']);
const tone = (t) => (TONES.has(t) ? ' t-' + t : '');
const pct = (p) => Math.max(0, Math.min(100, Number(p) || 0));

/** The card's width, one value for every card in the right column (the selection panel and the mode cards). */
export const HUD_CARD_W = 220;

export const HUD_CARD_CSS = `
.bw-card { position:relative; box-sizing:border-box; pointer-events:auto; display:flex; flex-direction:column; gap:4px;
  width:${HUD_CARD_W}px; max-height:calc(100vh - 112px); overflow:hidden;
  padding:7px 10px 8px; background:${AAA_PANEL_BG}; border:1px solid var(--line); box-shadow:0 6px 22px rgba(0,0,0,.45);
  font-family:${AAA_FONT_BODY}; font-size:13px; font-weight:600; line-height:1.25; color:#dfe7ef; -webkit-font-smoothing:antialiased; }
${aaaTicksCss('.bw-card', 12, 'var(--gold)')}
.bw-card-head { display:flex; align-items:baseline; justify-content:space-between; gap:8px; min-width:0; }
.bw-card-title { font-family:${AAA_FONT_NUM}; font-weight:800; font-size:11.5px; letter-spacing:.12em; color:#f4f7fb; text-transform:uppercase;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.bw-card-status { flex:0 0 auto; font-size:10px; font-weight:700; letter-spacing:.2em; color:var(--steel); text-transform:uppercase; white-space:nowrap; }
.bw-card-body { display:flex; flex-direction:column; gap:4px; min-height:0; flex:1 1 auto; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:none; }
.bw-card-body::-webkit-scrollbar { display:none; }
.bw-card-actions { flex:0 0 auto; }   /* the body scrolls on a short screen; the title and the action row always show */
.bw-card-rule { height:1px; margin:1px 0 2px; background:linear-gradient(90deg, var(--gold-hi), rgba(242,200,105,.15) 70%, transparent); }
.bw-card-sec { display:flex; flex-direction:column; gap:3px; }
.bw-card-sec + .bw-card-sec { border-top:1px solid #1e252f; padding-top:4px; }
.bw-card-h { display:flex; justify-content:space-between; gap:6px; font-size:9.5px; font-weight:700; letter-spacing:.3em; color:var(--steel); text-transform:uppercase; }
.bw-card-h span:last-child { letter-spacing:.12em; }
.bw-card-line { font-size:12px; color:#d6dce4; }
.bw-card-line.t-gold { font-size:11px; line-height:1.2; }
.bw-card-kv { display:flex; justify-content:space-between; gap:8px; font-size:12px; }
.bw-card-kv .k { color:#9aa6b4; letter-spacing:.04em; }
.bw-card-kv .v { color:#e8eef5; text-align:right; font-variant-numeric:tabular-nums; }
.bw-card-num { font-family:${AAA_FONT_NUM}; font-weight:800; font-size:10.5px; letter-spacing:.02em; font-variant-numeric:tabular-nums; color:#f4f7fb; }
.bw-card-item { display:grid; grid-template-columns:16px minmax(0,1fr) 28px minmax(30px,auto) 40px; align-items:center; gap:0 5px; min-height:19px; }
.bw-card-item .ic { width:16px; height:16px; border-radius:2px; box-shadow:0 0 0 1px var(--c), 0 0 8px color-mix(in srgb, var(--c) 45%, transparent); }
.bw-card-item .d { width:8px; height:8px; margin-left:4px; background:var(--c); box-shadow:0 0 6px var(--c); transform:rotate(45deg); }
.bw-card-item .n { font-size:12px; font-weight:700; color:#e8eef5; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bw-card-item .q { text-align:right; }
.bw-card-item .r { text-align:right; font-size:10.5px; font-weight:700; letter-spacing:.02em; color:var(--gold-hi); white-space:nowrap; font-variant-numeric:tabular-nums; }
.bw-card-item .r.t-dim { color:#7d8896; }
.bw-card-bar { height:5px; background:#0a0d12; border:1px solid #222a35; overflow:hidden; }
.bw-card-bar > i { display:block; height:100%; width:var(--p,0%); background:var(--c, var(--gold)); opacity:.9; transition:width .4s ease-out; }
.bw-card-gauge { display:flex; flex-direction:column; gap:2px; }
.bw-card-gauge .bw-card-kv { font-size:11px; }
.bw-card-gauge .bw-card-bar { height:6px; }
.bw-card .t-ok { color:#9be37a; } .bw-card .t-warn { color:var(--gold-hi); } .bw-card .t-bad { color:#ff8a6a; }
.bw-card .t-info { color:#8fd3ff; } .bw-card .t-gold { color:var(--gold-hi); } .bw-card .t-dim { color:#7d8896; }
.bw-card-bar.t-ok > i { --c:#8cf22e; } .bw-card-bar.t-warn > i { --c:var(--gold-hi); } .bw-card-bar.t-bad > i { --c:var(--ember); }
.bw-card-actions { display:flex; flex-wrap:wrap; gap:4px; margin-top:2px; }
.bw-card .bw-btn { flex:1 1 0; min-width:0; min-height:26px; border-radius:0; padding:3px 6px; background:rgba(20,26,36,.92); border:1px solid #3a4655;
  color:#dfe7ef; font-family:${AAA_FONT_BODY}; font-size:11.5px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; line-height:1.1; white-space:nowrap; }
.bw-card .bw-btn:hover:not(:disabled) { background:rgba(30,38,50,.95); border-color:#6b7a8c; color:#fff; }
.bw-card .bw-btn:focus-visible { outline:2px solid var(--cyan); outline-offset:1px; }
.bw-card .bw-btn .bw-key { color:var(--gold-hi); font-family:${AAA_FONT_NUM}; font-weight:900; font-size:10px; margin-right:1px; }
.bw-card .bw-btn small { display:block; font-size:9.5px; font-weight:600; letter-spacing:.06em; text-transform:none; color:#9aa6b4; margin-top:1px; }
.bw-card .bw-btn.primary { color:#1a1206; border-color:var(--gold-hi); background:linear-gradient(180deg, #f6d27e, #D9A441 55%, #b9852c); }
.bw-card .bw-btn.primary .bw-key, .bw-card .bw-btn.primary small { color:#3a2706; }
.bw-card .bw-btn.wide { flex-basis:100%; }
@media (max-height:500px) { .bw-card .bw-btn { min-height:30px; } .bw-card { gap:3px; padding:6px 9px 7px; } }
`;

/** A model's normal form: strings trimmed out, numbers kept, actions with an index. Pure. */
export function hudCardModel(m) {
  const s = (m && m.status) || null;
  const status = !s ? null : typeof s === 'string' ? { text: s, tone: null } : { text: String(s.text || ''), tone: s.tone || null };
  const sections = ((m && m.sections) || []).filter(Boolean).map((x) => ({
    head: x.head || '', aside: x.aside || '',
    items: (x.items || []).filter(Boolean), rows: (x.rows || []).filter((r) => r && r[0] != null),
    gauges: (x.gauges || []).filter(Boolean), lines: (x.lines || []).filter((l) => l && l.text),
  })).filter((x) => x.head || x.items.length || x.rows.length || x.gauges.length || x.lines.length);
  const actions = ((m && m.actions) || []).filter((a) => a && a.label).map((a) => ({ key: a.key ? String(a.key).toUpperCase() : '', label: String(a.label),
    sub: a.sub ? String(a.sub) : '', enabled: a.enabled !== false, title: a.title ? String(a.title) : '', primary: !!a.primary, wide: !!a.wide, run: a.run }));
  return { title: String((m && m.title) || ''), status, sections, actions };
}

const itemHtml = (it) => '<div class="bw-card-item" style="--c:' + esc(it.colour || '#cfd6de') + '">' +
  (it.icon ? resourceIconHtml(it.icon, 'ic') : '<span class="d"></span>') +
  '<span class="n">' + esc(it.name) + '</span>' +
  '<span class="bw-card-bar"><i style="--p:' + pct(it.pct).toFixed(1) + '%"></i></span>' +
  '<span class="q bw-card-num">' + esc(it.units) + '</span>' +
  '<span class="r' + (it.rateTone ? tone(it.rateTone) : '') + '">' + esc(it.rate || '') + '</span></div>';
const gaugeHtml = (g) => '<div class="bw-card-gauge"><div class="bw-card-kv"><span class="k">' + esc(g.label) + '</span><span class="v bw-card-num' + tone(g.tone) + '">' + esc(g.value) + '</span></div>' +
  '<div class="bw-card-bar' + tone(g.tone) + '"><i style="--p:' + pct(g.pct).toFixed(1) + '%"></i></div></div>';

/** The card body's markup (everything between the title and the action row) for a normal model. Pure. */
export function hudCardBodyHtml(m) {
  return m.sections.map((x) => '<div class="bw-card-sec">' +
    (x.head ? '<div class="bw-card-h"><span>' + esc(x.head) + '</span>' + (x.aside ? '<span>' + esc(x.aside) + '</span>' : '') + '</div>' : '') +
    x.items.map(itemHtml).join('') +
    x.rows.map((r) => '<div class="bw-card-kv"><span class="k">' + esc(r[0]) + '</span><span class="v' + tone(r[2]) + '">' + esc(r[1]) + '</span></div>').join('') +
    x.gauges.map(gaugeHtml).join('') +
    x.lines.map((l) => '<div class="bw-card-line' + tone(l.tone) + '">' + esc(l.text) + '</div>').join('') + '</div>').join('');
}

/** The whole card's markup (tests and the review page; the live card renders the same pieces into its elements). Pure. */
export function hudCardHtml(model) {
  const m = hudCardModel(model);
  return '<div class="bw-card"><div class="bw-card-head"><span class="bw-card-title">' + esc(m.title) + '</span>' +
    (m.status ? '<span class="bw-card-status' + tone(m.status.tone) + '">' + esc(m.status.text) + '</span>' : '') + '</div>' +
    '<div class="bw-card-rule"></div>' + hudCardBodyHtml(m) +
    (m.actions.length ? '<div class="bw-card-actions">' + m.actions.map((a, i) => '<button class="bw-btn' + (a.primary ? ' primary' : '') + (a.wide ? ' wide' : '') + '" data-i="' + i + '"' +
      (a.enabled ? '' : ' disabled') + (a.title ? ' title="' + esc(a.title) + '"' : '') + '>' + (a.key ? '<b class="bw-key">' + esc(a.key) + '</b> ' : '') +
      '<span>' + esc(a.label) + '</span>' + (a.sub ? '<small>' + esc(a.sub) + '</small>' : '') + '</button>').join('') + '</div>' : '') + '</div>';
}

/**
 * A card button: the battle's .bw-btn with its bold hotkey glyph (.bw-key) and a label span the caller may rewrite
 * (b._label), as the selection panel's U / X / R always were. Inside a .bw-card it takes the card's look.
 */
export function hudCardButton(doc, label, key) {
  const b = doc.createElement('button');
  b.className = 'bw-btn';
  if (key) { const k = doc.createElement('b'); k.className = 'bw-key'; k.textContent = key; b.appendChild(k); }
  const lbl = doc.createElement('span');
  lbl.textContent = (key ? ' ' : '') + label;
  b.appendChild(lbl);
  b._label = lbl;
  return b;
}

/**
 * Create a card element. opts.className adds the panel's own class (bw-selpanel, bw-modecard). → { root, title, status,
 * rule, body, actions, render(model), runKey(key) → whether an enabled action with that hotkey ran, model }.
 * render() rebuilds only what changed (the HUD asks every frame).
 */
export function createHudCard(doc, { className = '' } = {}) {
  const mk = (tag, cls) => { const n = doc.createElement(tag); n.className = cls; return n; };
  const root = mk('div', 'bw-card' + (className ? ' ' + className : ''));
  const head = mk('div', 'bw-card-head');
  const title = mk('span', 'bw-card-title');
  const status = mk('span', 'bw-card-status');
  head.appendChild(title); head.appendChild(status);
  const rule = mk('div', 'bw-card-rule');
  const body = mk('div', 'bw-card-body');
  const actions = mk('div', 'bw-card-actions');
  root.appendChild(head); root.appendChild(rule); root.appendChild(body); root.appendChild(actions);
  const card = { root, head, title, status, rule, body, actions, model: hudCardModel(null) };
  let bodyKey = null, actKey = null;
  actions.addEventListener('click', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('button') : null;
    const a = b && b.dataset.i != null ? card.model.actions[+b.dataset.i] : null;
    if (a && !b.disabled && typeof a.run === 'function') a.run();
  });
  card.render = (model) => {
    const m = hudCardModel(model);
    card.model = m;
    if (title.textContent !== m.title) title.textContent = m.title;
    const st = m.status ? m.status.text : '', sc = 'bw-card-status' + (m.status ? tone(m.status.tone) : '');
    if (status.textContent !== st) status.textContent = st;
    if (status.className !== sc) status.className = sc;
    const bh = hudCardBodyHtml(m);
    if (bh !== bodyKey) { bodyKey = bh; body.innerHTML = bh; }
    const ak = JSON.stringify(m.actions.map((a) => [a.key, a.label, a.sub, a.enabled, a.title, a.primary, a.wide]));
    if (ak !== actKey) {
      actKey = ak;
      actions.textContent = '';
      m.actions.forEach((a, i) => {
        const b = hudCardButton(doc, a.label, a.key);
        if (a.primary) b.classList.add('primary');
        if (a.wide) b.classList.add('wide');
        if (a.sub) { const s = doc.createElement('small'); s.textContent = a.sub; b.appendChild(s); }
        b.dataset.i = String(i);
        b.disabled = !a.enabled;
        if (a.title) b.title = a.title;
        actions.appendChild(b);
      });
      actions.hidden = !m.actions.length;
    }
    return card;
  };
  /** A hotkey (D10: S sell, R repair all): runs the enabled action with that key. */
  card.runKey = (key) => {
    const k = String(key || '').toUpperCase();
    const a = k && card.model.actions.find((x) => x.key === k);
    if (!a || !a.enabled || typeof a.run !== 'function') return false;
    a.run();
    return true;
  };
  return card;
}
