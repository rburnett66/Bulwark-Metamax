/**
 * version.js — the game's OWN version stamp, baked into the code.
 *
 * BUMP THE VERSION ON EVERY GAMEPLAY-AFFECTING CHANGE. The HUD shows it unconditionally (top bar), so
 * "which build is this tab running?" never depends on the server: the /__version git stamp is appended
 * when available, but this constant alone answers it. Date-based so newest is obvious at a glance.
 */
export const VERSION = 'v2026.11.11-d';
export const VERSION_NOTE = 'An outpost visit can run as a live battle sim and save back (no visible change yet)';
