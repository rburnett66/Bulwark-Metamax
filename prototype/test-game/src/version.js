/**
 * version.js — the game's OWN version stamp, baked into the code.
 *
 * BUMP THE VERSION ON EVERY GAMEPLAY-AFFECTING CHANGE. The HUD shows it unconditionally (top bar), so
 * "which build is this tab running?" never depends on the server: the /__version git stamp is appended
 * when available, but this constant alone answers it. Date-based so newest is obvious at a glance.
 */
export const VERSION = 'v2026.11.12-m';
export const VERSION_NOTE = 'Outpost AAA header + Victory-style cards (outpost, battle selection, away report); prices in small g (#307)';
