/**
 * src/render/buildPalette.js — the BUILD palette's look and its reactive left rail: the battle HUD's (render/hud.js),
 * the one rail every mode uses — the outpost's BUILD and FARM tabs included (S6) [MM-story_mw6k9xec_5].
 *
 * Factored out of render/hud.js unchanged: the palette's CSS (picture + name + cost buttons [MM-story_mvg3xsca_1x],
 * the reactive rail [MM-task_mvd3mpby_l]), the SVG glyphs a button falls back to when its picture can't load, and the
 * rail's sizing (the buttons take the height left between the top bar and the screen's bottom, 50–80 px, and fall back
 * to two columns when even the smallest won't fit). Owner 2026-11-07: the outpost builds "the same way the tower
 * defense game works", so both screens draw this one palette.
 */

/** The palette's rules (the battle HUD's, verbatim). Needs the base .bw-panel / .bw-btn rules (paletteBaseCss). */
/** The padlock a locked build item wears (moved here from the outpost's rail [MM-task_mwcdvlf8_2t]: one rail, one look). */
export const LOCK_SVG = '<svg class="bw-lock" viewBox="0 0 11 12"><rect x="1" y="5" width="9" height="7" rx="1" fill="#cfd6dd"/><path d="M3 5V3.6a2.5 2.5 0 0 1 5 0V5" fill="none" stroke="#cfd6dd" stroke-width="1.5"/></svg>';
export const PALETTE_CSS = `
.bw-buildbtn { position:relative; }
.bw-buildbtn.bw-locked { opacity:0.45; }
.bw-buildbtn.bw-locked .bw-cost { color:#9aa6b4; }
.bw-lock { position:absolute; top:2px; right:3px; width:11px; height:12px; }
.bw-palette { position:absolute; left:6px; top:56px; display:flex; flex-direction:column; gap:4px; }
.bw-palette .bw-title { font-size:11px; color:#9ab; margin-bottom:2px; }
/* catalogue TABS (a mode with several catalogues, e.g. the outpost's BUILD | FARM) [MM-story_mwcgbd9q_2y]; battles have none */
.bw-palette .bw-tabs { display:flex; gap:2px; margin-bottom:2px; }
.bw-tab { flex:1; min-width:0; font-family:inherit; font-size:9px; font-weight:800; line-height:1; letter-spacing:.08em; padding:4px 2px; color:#9ab; background:#151b22; border:1px solid #2b3540; border-radius:3px; cursor:pointer; }
.bw-tab.bw-tab-on { color:#1a1206; background:#D9A441; border-color:#D9A441; }
.bw-palette-row { display:flex; flex-direction:column; gap:4px; }
.bw-buildbtn { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0; width:76px; padding:4px 3px 3px; }
/* BUILD ICONS [MM-story_mvg3xsca_1x]: each button = a picture of the item's own model (content/icons/build) + its name + cost */
.bw-bimg { width:var(--bb-img, 48px); height:var(--bb-img, 48px); display:block; object-fit:contain; filter:drop-shadow(0 2px 2px rgba(0,0,0,.55)); pointer-events:none; }
.bw-bname { font-size:var(--bb-name, 9px); font-weight:800; letter-spacing:.06em; color:#e3eaf1; line-height:1.15; white-space:nowrap; }
/* REACTIVE LEFT RAIL [MM-task_mvd3mpby_l]: layoutLeftRail() sizes the buttons to the height available (--bb-h, --bb-icon)
   and falls back to two columns when even the smallest size won't fit — every build option always stays on screen */
.bw-palette.bw-fit .bw-buildbtn { height:var(--bb-h, 52px); width:var(--bb-w, 52px); padding:2px 3px; }
.bw-palette.bw-fit .bw-bicon svg { width:var(--bb-icon, 26px); height:var(--bb-icon, 26px); }
.bw-palette.bw-fit .bw-buildbtn { padding:3px 2px 2px; }
.bw-palette.bw-fit .bw-cost { font-size:var(--bb-cost, 10px); line-height:1; }
.bw-palette.bw-fit.bw-2col .bw-palette-row { display:grid; grid-template-columns:repeat(2, var(--bb-w, 76px)); }
.bw-bicon { position:relative; display:block; line-height:0; }
.bw-bkey { position:absolute; top:-2px; left:-2px; font-size:10px; font-weight:800; color:#ffe58a; text-shadow:0 1px 2px #000; }
.bw-buildbtn .bw-cost { color:#ffd76a; font-size:10px; }
.bw-buildbtn.bw-poor { opacity:0.45; }
@media (max-width: 900px) { .bw-buildbtn { width:64px; } }
/* COLUMN LAYOUT [MM-task_mwd2upbd_5]: a tab that declares groups (battle/catalogue.js layout) draws them side by side —
   the outpost's FARM tab: machinery far left, the seeds beside it in up to two columns that scroll (touch + wheel) */
.bw-rail-cols { display:flex; flex-direction:row; align-items:flex-start; gap:var(--bb-gap, 4px); }
.bw-rail-group { display:grid; grid-template-columns:repeat(var(--grp-cols, 1), var(--bb-w, 76px)); gap:var(--bb-gap, 4px); align-content:start; }
.bw-rail-group.bw-rail-scroll { overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; touch-action:pan-y; -webkit-overflow-scrolling:touch;
  scrollbar-width:thin; scrollbar-color:#4a6076 transparent; }
.bw-rail-group.bw-rail-scroll::-webkit-scrollbar { width:4px; }
.bw-rail-group.bw-rail-scroll::-webkit-scrollbar-thumb { background:#4a6076; border-radius:2px; }
.bw-rail-group + .bw-rail-group { border-left:1px solid #2b3540; padding-left:var(--bb-gap, 4px); }
`;

/**
 * The battle HUD's base panel and button rules, scoped under `scope` (the outpost's root) so a screen without the
 * battle HUD's stylesheet draws the palette the same. The battle HUD keeps its own unscoped copy.
 */
/**
 * The selected-structure panel's rules (the battle HUD's, verbatim): name, state line, HP bar, and the action row whose
 * buttons carry their bold hotkey (U upgrade, X sell, R repair). The outpost's selection panel uses the same panel
 * (owner 2026-11-07: "We already have a UX for info, as well as repair and upgrade and sell in the tower defense game.
 * Lets repurpose that UX"). Needs the base .bw-panel / .bw-btn rules (paletteBaseCss).
 */
export const SELPANEL_CSS = `
.bw-key { font-weight:800; color:#ffe58a; }   /* bold keyboard-shortcut glyph on build + action buttons */
.bw-selpanel { position:absolute; right:6px; top:56px; width:200px; font-size:12px; display:none; flex-direction:column; gap:4px; }
.bw-selpanel .bw-sname { font-size:13px; font-weight:bold; color:#bfe0ff; }
.bw-selpanel .bw-shpbar { width:100%; height:10px; background:#34373c; border:1px solid #141619; }
.bw-selpanel .bw-shpfill { height:100%; background:#8cf22e; }
.bw-selrow { display:flex; gap:4px; }
.bw-selrow .bw-btn { flex:1; font-size:11px; padding:3px 4px; }
`;

export const paletteBaseCss = (scope) => `
${scope} .bw-panel { background:rgba(10,14,20,0.85); border:1px solid #3a4a5a; border-radius:4px; padding:6px 8px; pointer-events:auto; }
${scope} .bw-btn { pointer-events:auto; background:#22303e; color:#e8e8e8; border:1px solid #4a6076; border-radius:3px;
  padding:4px 8px; font-family:'Courier New', monospace; font-size:12px; cursor:pointer; }
${scope} .bw-btn:hover:not(:disabled) { background:#2f4356; }
${scope} .bw-btn:disabled { opacity:0.4; cursor:default; }
${scope} .bw-btn.bw-selected { background:#3d6a3d; border-color:#7ac07a; }
${scope} .bw-palette { font-family:'Courier New', monospace; color:#e8e8e8; }
`;

/** Inline SVG glyphs (24 × 24 viewBox), tinted to the board's structure colours: a button's fallback picture. */
export const STRUCT_ICONS = Object.freeze({
  antiGround: '<circle cx="12" cy="14" r="6" fill="#8a6a2f"/><rect x="10.6" y="3" width="2.8" height="9" rx="1" fill="#c9a45a"/>',
  antiAir: '<circle cx="12" cy="15" r="5" fill="#3f7fbf"/><rect x="10.9" y="3.5" width="2.2" height="8" rx="1" transform="rotate(-28 12 12)" fill="#7fb4e0"/><rect x="10.9" y="3.5" width="2.2" height="8" rx="1" transform="rotate(28 12 12)" fill="#7fb4e0"/>',
  wall: '<rect x="4" y="6" width="16" height="12" rx="1" fill="#9aa0a6"/><path d="M4 10h16M4 14h16M9 6v4M15 6v4M12 10v4M9 14v4M15 14v4" stroke="#5c6166" stroke-width="1.1"/>',
  moat: '<rect x="4" y="6" width="16" height="12" rx="2" fill="#2f6db0"/><path d="M6 11c2-2 4 2 6 0s4 2 6 0M6 15c2-2 4 2 6 0s4 2 6 0" stroke="#8fc4ef" stroke-width="1.4" fill="none"/>',
  harvestorBay: '<rect x="5" y="10" width="10" height="7" rx="1.5" fill="#c9a45a"/><rect x="15" y="12" width="5" height="5" rx="1" fill="#8a6a2f"/><circle cx="8" cy="18.5" r="1.8" fill="#3a3f45"/><circle cx="13" cy="18.5" r="1.8" fill="#3a3f45"/><circle cx="17.5" cy="18.5" r="1.5" fill="#3a3f45"/><path d="M7 10l2-4h4l1 4" fill="#e0c07a"/>',
  mine: '<circle cx="12" cy="14" r="4.5" fill="#7a2a2a"/><circle cx="12" cy="14" r="2" fill="#ff4040"/><path d="M12 3v4M8 5l1.5 2.5M16 5l-1.5 2.5" stroke="#9fd4ff" stroke-width="1.4" fill="none"/><circle cx="12" cy="14" r="6.5" fill="none" stroke="#e03030" stroke-width="0.8" stroke-dasharray="2 2"/>',
});

/**
 * The rail's button size for the height it has. avail: px from the rail's top to the screen's bottom edge (less its
 * margin); btns: the number of buttons; chrome: the panel's padding + title; viewW: the screen width.
 * → { cols, h, w, icon, img, name, cost } (px) — the CSS variables --bb-h, --bb-w, --bb-icon, --bb-img, --bb-name, --bb-cost.
 */
export function railFit(avail, btns, chrome, viewW, { GAP = 4, MAX = 80, MIN = 50 } = {}) {
  let cols = 1, h = (avail - chrome - GAP * (btns - 1)) / btns;
  if (h < MIN) { cols = 2; const rows = Math.ceil(btns / 2); h = (avail - chrome - GAP * (rows - 1)) / rows; }
  h = Math.max(MIN - 4, Math.min(MAX, Math.floor(h)));
  const w = viewW <= 900 ? Math.min(66, Math.max(58, h)) : Math.min(80, Math.max(66, h));
  return {
    cols, h, w, gap: GAP,
    icon: Math.round(Math.max(16, Math.min(26, h - 16))), img: Math.round(Math.max(24, Math.min(54, h - 26))),
    name: h < 60 ? 8 : 9, cost: h < 60 ? 9 : 10,
  };
}

/**
 * The rail's sizes for a COLUMN layout (battle/catalogue.js layout.groups) [MM-task_mwd2upbd_5]: every button the same
 * size (one look), sized so the groups that do not scroll fit the height as the plain rail would (railFit's 50–80 px),
 * each scrolling group as wide as it needs up to its maxCols, then scrolling vertically when even that overflows.
 * groups: [{ n, scroll, maxCols }]. → { h, w, gap, icon, img, name, cost, groups: [{ cols, rows, scroll, overflow, height }] }
 * where height is the px a group may take (a scrolling group's viewport) and overflow says it scrolls now.
 */
export function railColumnsFit(avail, groups, chrome, viewW, { GAP = 4, MAX = 80, MIN = 50 } = {}) {
  const room = Math.max(0, avail - chrome);
  // the size: what the tallest non-scrolling group allows in its columns (railFit's rule), else the largest
  const fixed = groups.filter((g) => !g.scroll && g.n > 0);
  let h = MAX;
  for (const g of fixed) {
    const cols = Math.max(1, g.maxCols || 1), rows = Math.ceil(g.n / cols);
    h = Math.min(h, (room - GAP * (rows - 1)) / rows);
  }
  h = Math.max(MIN - 4, Math.min(MAX, Math.floor(h)));
  const w = viewW <= 900 ? Math.min(66, Math.max(58, h)) : Math.min(80, Math.max(66, h));
  const rowsFit = Math.max(1, Math.floor((room + GAP) / (h + GAP)));
  const out = groups.map((g) => {
    const maxCols = Math.max(1, g.maxCols || 1), n = Math.max(0, g.n | 0);
    const cols = n ? Math.min(maxCols, Math.max(1, Math.ceil(n / rowsFit))) : 1, rows = Math.ceil(n / cols);
    const overflow = !!g.scroll && rows > rowsFit;
    return { cols, rows, scroll: !!g.scroll, overflow, height: g.scroll ? Math.min(room, rows * h + GAP * Math.max(0, rows - 1)) : null };
  });
  return {
    h, w, gap: GAP, groups: out,
    icon: Math.round(Math.max(16, Math.min(26, h - 16))), img: Math.round(Math.max(24, Math.min(54, h - 26))),
    name: h < 60 ? 8 : 9, cost: h < 60 ? 9 : 10,
  };
}

/** Apply railColumnsFit's numbers: the palette's button sizes (as applyRailFit) and each group's columns and height. */
export function applyRailColumns(palette, groupEls, f) {
  palette.classList.add('bw-fit');
  palette.classList.remove('bw-2col');
  for (const [k, v] of [['--bb-h', f.h], ['--bb-w', f.w], ['--bb-icon', f.icon], ['--bb-img', f.img], ['--bb-name', f.name], ['--bb-cost', f.cost], ['--bb-gap', f.gap]]) {
    palette.style.setProperty(k, v + 'px');
  }
  groupEls.forEach((g, i) => {
    const fg = f.groups[i];
    if (!g || !fg) return;
    g.style.setProperty('--grp-cols', String(fg.cols));
    g.classList.toggle('bw-rail-scroll', fg.scroll);
    g.style.maxHeight = fg.scroll ? fg.height + 'px' : '';
  });
}

/** Apply railFit's numbers to a palette element (the CSS variables and the two-column class). */
export function applyRailFit(palette, f) {
  palette.classList.add('bw-fit');
  palette.classList.toggle('bw-2col', f.cols === 2);
  palette.style.setProperty('--bb-h', f.h + 'px');
  palette.style.setProperty('--bb-w', f.w + 'px');
  palette.style.setProperty('--bb-icon', f.icon + 'px');
  palette.style.setProperty('--bb-img', f.img + 'px');
  palette.style.setProperty('--bb-name', f.name + 'px');
  palette.style.setProperty('--bb-cost', f.cost + 'px');
  const row = palette.querySelector('.bw-palette-row');
  if (row) row.style.gap = f.gap + 'px';
}
