/**
 * src/menu/campaignPick.js — the SURVEY screen's campaign drop-down, as pure data [MM-story_mvftq4h6_k].
 *
 * Owner 2026-10-19: "Once the player is on the correct planet the player will be presented the highest unlocked
 * campaign, but a drop down should allow the player to select any of the unlocked campaigns … Each campaign is a map on
 * the target planet." A campaign is one of the 9 campaign maps (MAPDATA.maps); unlocks are the save's shared
 * `unlockedThrough` (beat a map at the star gate → the next opens). Locked maps are listed but disabled, so the player
 * can see what is ahead. No DOM — node-tested.
 */

/** The highest map the player may enter (1..count). */
export function defaultCampaign(save, count = 9) {
  return Math.max(1, Math.min(count, (save && save.unlockedThrough) | 0 || 1));
}

const par = (sec) => '~' + Math.round((sec || 0) / 60) + ' min';

/**
 * One option per campaign map: { id, label, locked, detail, beaten }. `label` is what the drop-down shows
 * ("Campaign 3 — Map 03"), `detail` the line under it (size, water, difficulty, par, best).
 */
export function campaignOptions(save, maps) {
  const top = defaultCampaign(save, maps.length);
  const recs = (save && save.maps) || {};
  return maps.map((row) => {
    const id = row.Map_ID, rec = recs[id] || {}, locked = id > top;
    const name = String(row.Map_Name || ('Map_' + id)).replace('_', ' ');
    const bits = [row.Full_W + ' × ' + row.Full_H];
    if (row.Has_Water) bits.push('water');
    bits.push('difficulty ' + Number(row.Difficulty || 0).toFixed(2), par(row.Par_Time_Sec));
    if (rec.avg != null) bits.push('★ ' + rec.avg.toFixed(1));
    if (rec.bestScore != null) bits.push('best ' + rec.bestScore);
    return {
      id, locked, beaten: !!rec.beaten,
      label: 'Campaign ' + id + ' — ' + name + (locked ? '  🔒' : rec.beaten ? '  ✓' : ''),
      detail: locked ? 'Locked — reach a ★ 3.0 average on campaign ' + (id - 1) + '.' : bits.join(' · ') + (row.Notes ? ' — ' + row.Notes : ''),
    };
  });
}
