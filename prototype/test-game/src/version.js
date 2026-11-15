/**
 * version.js — the game's OWN version stamp, baked into the code.
 *
 * BUMP THE VERSION ON EVERY GAMEPLAY-AFFECTING CHANGE. The HUD shows it unconditionally (top bar), so
 * "which build is this tab running?" never depends on the server: the /__version git stamp is appended
 * when available, but this constant alone answers it. Date-based so newest is obvious at a glance.
 */
export const VERSION = 'v2026.11.13-p';
export const VERSION_NOTE = 'Safe mode: a late outpost open goes through a fresh page';
