/**
 * src/render/uiTokens.js — the game's "after-action" look, as tokens, in ONE place [MM-story_mwcuyrqr_3j].
 *
 * Owner 2026-11-12: "our Victory pop-ups look very good, follow that design pattern for upper right info panels". The
 * Victory pop-up (render/resultsScreen.js RESULTS_CSS) and the wave report built on it set the pattern: Rajdhani for
 * text and Orbitron for verdicts and numbers, a dark steel gradient panel with a hairline border, gold corner ticks,
 * letter-spaced steel section heads, Powder Gold for "done + paid off", cyan for kept / XP, ember for loss. The HUD's
 * cards (render/hudCard.js: the battle selection panel, the outpost card, the farm panel) are built from the SAME
 * tokens, so a change here lands in the pop-up and in every card at once — never two copies of a colour.
 * Pure strings; no DOM except ensureAaaFonts.
 */

/** The type pair's stylesheet (Google Fonts; the game falls back to Segoe UI / system-ui while it loads). */
export const AAA_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Rajdhani:wght@500;600;700&display=swap';

/** Text and numbers. */
export const AAA_FONT_BODY = 'Rajdhani,"Segoe UI",system-ui,sans-serif';
export const AAA_FONT_NUM = 'Orbitron,Rajdhani,sans-serif';

/** The palette, as CSS custom properties: declared on a pop-up's root (.rs) and on the HUD root (.bw-hud). */
export const AAA_VARS = '--gold:#D9A441; --gold-hi:#f2c869; --ink:#0b0f16; --line:#2a3340; --steel:#8A97A8; --cyan:#7af0ff; --ember:#e0533d;';

/** A panel's fill: the pop-up's steel gradient. */
export const AAA_PANEL_BG = 'linear-gradient(180deg, rgba(20,26,36,.86), rgba(12,16,23,.9))';

/** The gold corner ticks (top-left and bottom-right) on `sel`, `size` px long, in colour `col` (a CSS value). */
export const aaaTicksCss = (sel, size, col) => `${sel}::before, ${sel}::after { content:""; position:absolute; width:${size}px; height:${size}px; pointer-events:none; }
${sel}::before { left:-1px; top:-1px; border-left:2px solid ${col}; border-top:2px solid ${col}; }
${sel}::after { right:-1px; bottom:-1px; border-right:2px solid ${col}; border-bottom:2px solid ${col}; }`;

/** Load the type pair once per document (the pop-ups, the wave report and the HUD cards share the one <link>). */
export function ensureAaaFonts(doc) {
  try {
    if (!doc || !doc.head || doc.getElementById('rs-fonts')) return;
    const l = doc.createElement('link');
    l.id = 'rs-fonts'; l.rel = 'stylesheet'; l.href = AAA_FONTS_URL;
    doc.head.appendChild(l);
  } catch (e) { /* fonts are cosmetic */ }
}
