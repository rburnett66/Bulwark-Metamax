/**
 * src/data/portraitMoods.js — the characters whose expression portraits have landed (owner 2026-11-09: "additional
 * portraits that show angry, neutral, and happy expressions"). For a slug listed here the game draws
 * content/dialog/portraits/<slug>-<angry|neutral|happy>.png by the player's rating with them (save/standings.js
 * moodFor); for any other it keeps the one portrait it has, without asking for files that do not exist yet.
 * Add a slug when its three files are committed: portraitMoods.test.mjs checks they are all there.
 * The prompt sheet for the art: docs/16 Bulwark MM/create/portrait-expressions/Portrait-Expression-Prompts.md.
 */
export const MOOD_PORTRAITS = new Set([
]);
