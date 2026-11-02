/**
 * src/menu/missionIcons.js — the one icon sprite for the header, list and dossier [MM-story_mvyqor1y_h].
 * content/missions/mission-icons.svg goes into the page once, so every <use href="#id"> resolves and takes currentColor.
 * A failed load is reported: blank icons with no message would look like a design decision.
 */
const SPRITE_URL = new URL('../../content/missions/mission-icons.svg', import.meta.url);
const SPRITE_ID = 'bwm-ml-sprite';

export function ensureMissionIcons(doc) {
  if (doc.getElementById(SPRITE_ID)) return Promise.resolve();
  const holder = doc.createElement('div');
  holder.id = SPRITE_ID;
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  doc.body.appendChild(holder);
  return fetch(SPRITE_URL).then((r) => {
    if (!r.ok) throw new Error('mission-icons.svg: HTTP ' + r.status);
    return r.text();
  }).then((svg) => { holder.innerHTML = svg; }).catch((e) => { holder.remove(); console.error('[missions] icons failed to load', e); });
}
