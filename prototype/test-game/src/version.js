/**
 * version.js — the game's OWN version stamp, baked into the code.
 *
 * BUMP THE VERSION ON EVERY GAMEPLAY-AFFECTING CHANGE. The HUD shows it unconditionally (top bar), so
 * "which build is this tab running?" never depends on the server: the /__version git stamp is appended
 * when available, but this constant alone answers it. Date-based so newest is obvious at a glance.
 */
export const VERSION = 'v2026.11.10-t';
export const VERSION_NOTE = 'Farming: crop levels come from the tech tree (OUTPOST & FARM › SEED PODS); seed pods have no level and are bought at one price; a plot keeps the level it was planted at; level 5 needs an Irrigated plot with water';
