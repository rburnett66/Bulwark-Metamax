/**
 * planets.js — each faction's homeworld [MM-story_mva7wn9l_t].
 *
 * From the "Bulwark Planets" design page (claude.ai artifact Ey7UQfY7eei6639zyobSXa): nine homeworlds, one per
 * faction, keyed here by the faction registry key (data/factions.js) so a rename there can't detach a planet.
 * `globe` drives the planet shader in tools/planets/bake.html, which renders content/planets/<key>.png — the
 * image the FACTIONS screen shows. Re-bake after changing a globe (see that page).
 *
 * Pure data, no DOM — node-tested by planets.test.mjs.
 */
export const PLANETS = Object.freeze({
  ground: {
    name: 'Verdance', type: 'Lush homeworld', lush: 1, haze: '#a8c4ec',
    blurb: 'Green fields and farmland worth planting a flag on: the homeland the infantry and armor fight for.',
    globe: { water: 0.5, polar: 0.12, land: ['#3e9a44', '#6cc85a', '#c8b07a', '#e8ecf0'], ocean: ['#1e5aa8', '#3a8ad8'], dry: '#b8a070', cloud: 0.55 },
  },
  air: {
    name: 'Florael', type: 'Blooming garden', lush: 1, haze: '#e6c6e6',
    blurb: 'Blossom skies and petals on the wind: the anime-ace world, best seen from the cockpit.',
    globe: { water: 0.42, polar: 0.08, land: ['#6cc08a', '#f0a0c8', '#f6e0d0', '#ffffff'], ocean: ['#5a6ad8', '#8aa0f0'], dry: '#e0c0a8', cloud: 0.45 },
  },
  hightech: {
    name: 'Ochre', type: 'Arid desert', lush: 0.3, haze: '#f0d8a8',
    blurb: 'A high white sun over open desert: solar wealth for the mega-corp, and long clear sightlines for precision weapons.',
    globe: { water: 0.12, polar: 0.03, land: ['#c0824e', '#e2c478', '#f6e2b0', '#ffffff'], ocean: ['#2a8aa8', '#5ac0c8'], dry: '#d0905a', cloud: 0.2 },
  },
  artillery: {
    name: 'Kessra', type: 'Barren dust', lush: 0.1, haze: '#c89a70',
    blurb: 'A shelled-out wasteland of mesas and dust: ridgelines for the guns, nothing left standing in between.',
    globe: { water: 0.16, polar: 0.05, land: ['#9a6646', '#b08058', '#d8b07e', '#e8dcc8'], ocean: ['#5a3a2a', '#7a5038'], dry: '#c89a6a', cloud: 0.15 },
  },
  water: {
    name: 'Rime', type: 'Frozen', lush: 0.3, haze: '#cfe0f0',
    blurb: 'Frozen seas and ice coasts: the sea tribes fish, swim and strike with frost.',
    globe: { water: 0.25, polar: 0.55, land: ['#2f5a5a', '#c8d8e6', '#eef4fa', '#ffffff'], ocean: ['#2a4a78', '#5a86b8'], dry: '#b8c8d8', cloud: 0.5 },
  },
  arcane: {
    name: 'Cinder', type: 'Volcanic ash', lush: 0, haze: '#5a3a34',
    blurb: 'A world of living fire: the theocracy draws its energy from the lava and worships the flame.',
    globe: { water: 0.18, polar: 0.0, land: ['#2a2424', '#4a4040', '#6a5a50', '#8a7a70'], ocean: ['#ff5a10', '#ffb030'], dry: '#3a3030', cloud: 0.35, lava: 1 },
  },
  space: {
    name: 'Lumen', type: 'Airless moon', lush: 0, haze: '#1c2236',
    blurb: 'No air, no haze: the clearest sightlines in the system, a natural home for an orbital federation that sees everything.',
    globe: { water: 0.28, polar: 0.0, land: ['#7a7e86', '#9a9ea6', '#b4b8be', '#d0d2d6'], ocean: ['#3e424a', '#5a5e66'], dry: '#868a92', cloud: 0.0, craters: 1 },
  },
  dark: {
    name: 'Xenthe', type: 'Fungal alien', lush: 0.95, haze: '#7a6ac8',
    blurb: 'A violet twilight world that glows in the dark: corruption grows here, and the cult is strongest at night.',
    globe: { water: 0.4, polar: 0.06, land: ['#1a8a94', '#2ec0a8', '#c84ad8', '#f0e8ff'], ocean: ['#4aa020', '#9ae850'], dry: '#7a2e8a', cloud: 0.35 },
  },
  greenies: {
    name: 'Vexmire', type: 'Toxic hive swamp', lush: 0.7, haze: '#a8b860',
    blurb: 'A living chemical swamp: the hive breeds in its pods, and its clouds are the Greenies\' own area denial.',
    globe: { water: 0.38, polar: 0.0, land: ['#5e7a3a', '#8aa040', '#c8c848', '#d8d898'], ocean: ['#78a018', '#c8f030'], dry: '#6a5a38', cloud: 0.6 },
  },
});

/** The baked image for a faction key, relative to the game root — or null for an unknown faction. */
export function planetImage(key) {
  return PLANETS[key] ? `content/planets/${key}.png` : null;
}
