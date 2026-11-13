/**
 * src/menu/planetNebula.js — each planet's own subtle nebula behind the planet screens [MM-story_mwem2l4j_4].
 *
 * Owner 2026-11-12: "the background of each planet should also get its own subtle nebula". The menu's space background
 * (menu.js .bwm-root.space: a dark gradient + a static starfield) gets a nebula layer in the colours of the planet on
 * screen — its haze, its label colour and its ocean (data/planets.js) — as three soft clouds placed by a hash of the
 * planet's key, so every planet's sky sits differently and the same planet always looks the same. Low alpha: a tint
 * behind the stars, never a wash.
 *
 * Pure: → a CSS background-image list (no DOM).
 */
import { PLANETS } from '../data/planets.js';

/** Peak opacity of the strongest cloud (the others are fainter). */
export const NEBULA_ALPHA = 0.45;

const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0x8899aa; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => `rgba(${hex(h).join(',')},${a.toFixed(3)})`;
function seeded(key) {
  let s = 2166136261;
  for (const ch of String(key)) s = Math.imul(s ^ ch.charCodeAt(0), 16777619);
  return () => { s = Math.imul(s ^ (s >>> 15), 2246822507); s = Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; };
}

/** The nebula for a planet key, or 'none' for an unknown key. */
export function planetNebula(key) {
  const P = PLANETS[key];
  if (!P) return 'none';
  const R = seeded(key);
  const cols = [P.haze || P.ui, P.ui || P.haze, (P.globe && P.globe.ocean && P.globe.ocean[0]) || P.haze];
  const clouds = cols.map((c, i) => {
    const x = Math.round(10 + R() * 80), y = Math.round(10 + R() * 80);
    const w = Math.round(60 + R() * 35), h = Math.round(45 + R() * 30);
    const a = NEBULA_ALPHA * [1, 0.7, 0.55][i];
    return `radial-gradient(${w}% ${h}% at ${x}% ${y}%, ${rgba(c, a)}, ${rgba(c, a * 0.35)} 45%, transparent 75%)`;
  });
  return clouds.join(', ');
}
