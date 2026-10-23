/**
 * src/menu/techSave.js — the Tech Net on the REAL save [MM-story_mvkhed1f_h]. Menu-Progression-Design §1.
 *
 * Turns the campaign save into a data/techtree.js status context (bank = banked gold, owned = save.tech.owned +
 * the starting kit + Map 3 Victory once won) and gives the view a buy / refund adapter that moves the gold.
 * No DOM, no three.js: the save functions are passed in, so tests drive it with a fake save.
 */
import { TECH_BY_ID, startingOwned, settleFree, techStatus, techPrice, refundBlock } from '../data/techtree.js';

export const map3Won = (s) => !!((s.maps && s.maps[3] && s.maps[3].beaten) ||
  Object.values(s.factionRecords || {}).some((f) => f && f.mapsWon && f.mapsWon[3]));

/** factionOfPlanet: planet name ('Florael') → the faction name factionRecords is keyed by. */
export function techCtxFromSave(s, factionOfPlanet = (p) => p) {
  const owned = startingOwned();
  for (const [id, on] of Object.entries((s.tech && s.tech.owned) || {})) if (on && TECH_BY_ID[id]) owned.add(id);
  if (map3Won(s)) owned.add('map3');
  settleFree(owned);
  return {
    owned, bank: (s.carry && s.carry.gold) || 0, paid: (s.tech && s.tech.paid) || {},
    hasWin: (planet) => {
      const fr = s.factionRecords && s.factionRecords[factionOfPlanet(planet)];
      return !!(fr && fr.mapsWon && Object.values(fr.mapsWon).some(Boolean));
    },
  };
}

/** The view adapter for the game menu. save = { loadSave, buyTech, refundTech }. */
export function createGameTechAdapter({ save, factionOfPlanet, onChange, onClose }) {
  const ctx = () => techCtxFromSave(save.loadSave(), factionOfPlanet);
  return {
    mode: 'game',
    ctx,
    buy(id) {
      const n = TECH_BY_ID[id], c = ctx();
      if (!n || n.milestone || techStatus(n, c) !== 'ready') return false;
      const ok = save.buyTech(id, techPrice(n, c));
      if (ok && onChange) onChange();
      return ok;
    },
    refund(id) {
      const n = TECH_BY_ID[id], why = n ? refundBlock(n, ctx()) : 'Unknown upgrade.';
      if (why) return why;
      save.refundTech(id);
      if (onChange) onChange();
      return '';
    },
    onClose,
  };
}
