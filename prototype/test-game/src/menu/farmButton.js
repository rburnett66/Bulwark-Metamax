/**
 * src/menu/farmButton.js — the farm's status on the main menu (Farming-Design §2.3, story A5) [MM-story_mwabgpsa_e].
 * Since S6 [MM-story_mwcgbd9q_2y] there is no FARM button (owner 2026-11-11: the farm is the outpost's FARM tab): this
 * status joins the OUTPOST button's line ("… · farm: 2 plots fruited") and its red dot (menu.js refreshOutpost).
 *
 * The OUTPOST button's twin (src/menu/outpostButton.js), on the same outpost: locked until a farming contract is
 * accepted ("Upgrade a Mining Rig to Mk II, then accept a farming contract aboard a capital ship"). Its status line
 * and red dot come from a COPY of the outpost advanced to now, never saved: plots fruited, plants dead, the Silo full,
 * pods low. Raids are not fought here (the outpost view resolves them), as on the OUTPOST button.
 *
 * Pure: (save, targetPlanet, now, map) → model. The menu renders it.
 */
import { advance } from '../outpost/model.js';
import { DRAFT_LAYOUT } from '../outpost/draftLayout.js';
import { farmStatus } from '../farm/model.js';
import { hasFarm } from '../farm/contract.js';
import { podRowCount } from '../farm/pods.js';

/** Units the farm store holds for a planet (the outpost & farm inventory, s.stores.farm). */
export const farmHeld = (save, planet) => Object.values((((save && save.stores) || {}).farm || {})[planet] || {}).reduce((a, b) => a + b, 0);
/** Seed pods held, all crops (a plain count per crop: pods have no level, owner rule 9). */
const podsHeld = (save) => Object.values((save && save.pods) || {}).reduce((a, row) => a + podRowCount(row), 0);

/** The planet whose farm the button opens: the targeted planet's when it has one, else any farmed planet. */
export function farmPlanet(save, target) {
  const keys = Object.keys((save && save.farmContracts) || {}).filter((k) => hasFarm(save, k) && save.outposts && save.outposts[k]);
  if (!keys.length) return null;
  return keys.includes(target) ? target : keys.sort()[0];
}

export function farmButtonModel(save, target, now = Date.now(), map = DRAFT_LAYOUT) {
  const planet = farmPlanet(save, target);
  if (!planet) return { locked: true, planet: null, hint: 'upgrade a Mining Rig to Mk II, then accept a farming contract', dot: false };
  const saved = save.outposts[planet];
  let o = saved;
  try { if (now > saved.t) o = advance(saved, now, { map }).outpost; } catch (e) { /* a clock behind the save: show it as saved */ }
  const st = farmStatus(o, map, { held: farmHeld(save, planet) });
  const parts = [];
  if (st.fruited) parts.push(st.fruited + (st.fruited === 1 ? ' plot fruited' : ' plots fruited'));
  if (st.dead) parts.push(st.dead + (st.dead === 1 ? ' plant dead' : ' plants dead'));
  if (st.siloFull) parts.push('silo full');
  const pods = podsHeld(save);
  if (pods < 4) parts.push('pods low');
  if (!parts.length && st.growing) parts.push(st.growing + (st.growing === 1 ? ' plot growing' : ' plots growing'));
  return {
    locked: false, planet,
    hint: parts.length ? parts.join(', ') : 'ready to plant',
    dot: st.fruited > 0 || st.dead > 0 || st.siloFull,
    ...st, pods,
  };
}
