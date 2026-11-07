/**
 * src/menu/outpostButton.js — what the main menu's OUTPOST button shows (tech plan docs/tech-plan/Outpost.md §7,
 * story O8) [MM-story_mw5oeidu_p].
 *
 * The button replaces REPLAY LAST BATTLE. It is locked until a contract is accepted (an outpost exists in the save).
 * Its status line and red dot come from a COPY of the outpost advanced to now, never saved: loads ready, storage
 * full, worn defenses, and raids that came while away. A raid isn't fought here (the battle sim resolves it when the
 * outpost view opens, story O7), so the copy treats due raids as held and only counts them.
 *
 * Pure: (save, targetPlanet, now, map) → model. The menu renders it.
 */
import { advance, status } from '../outpost/model.js';
import { DRAFT_LAYOUT } from '../outpost/draftLayout.js';

/** The planet whose outpost the button opens: the targeted planet's when it has one, else the newest. */
export function outpostPlanet(save, target) {
  const all = Object.entries((save && save.outposts) || {});
  if (!all.length) return null;
  if (target && save.outposts[target]) return target;
  all.sort((a, b) => (b[1].t || 0) - (a[1].t || 0));
  return all[0][0];
}

export function outpostButtonModel(save, target, now = Date.now(), map = DRAFT_LAYOUT) {
  const planet = outpostPlanet(save, target);
  if (!planet) return { locked: true, planet: null, hint: 'accept an outpost contract', dot: false };
  const saved = save.outposts[planet];
  let o = saved, raidsDue = 0;
  try {
    if (now > saved.t) { const r = advance(saved, now, { map }); o = r.outpost; raidsDue = r.report.raids.length; }
  } catch (e) { /* a clock behind the save: show it as saved */ }
  const st = status(o, {});
  const worn = status(saved, {}).worn;
  const parts = [];
  if (!saved.online) parts.push('not online');
  if (st.loads) parts.push(st.loads + (st.loads === 1 ? ' load ready' : ' loads ready'));
  if (st.full) parts.push('storage full');
  if (raidsDue) parts.push(raidsDue + (raidsDue === 1 ? ' raid' : ' raids') + ' while away');
  else if (worn) parts.push('defenses worn');
  else if (saved.raids && saved.raids.log.length) {
    const last = saved.raids.log[saved.raids.log.length - 1];
    if (last && last.result === 'breach') parts.push('last raid breached');
  }
  return {
    locked: false, planet,
    hint: parts.length ? parts.join(', ') : 'all quiet',
    dot: st.loads > 0 || st.full || worn || raidsDue > 0,
    loads: st.loads, full: st.full, worn, raidsDue,
  };
}
