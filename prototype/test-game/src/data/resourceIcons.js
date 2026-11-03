/**
 * src/data/resourceIcons.js — the 36 resource icons [MM-story_mw18nusb_5].
 *
 * One 256 × 256 WebP per resource at content/icons/resources/<id>.webp, painted from the prompts in
 * docs/16 Bulwark MM/create/resource-icons/. The id is the resource's name in kebab case (missions.json › resources),
 * so any screen that knows a resource's name can show its icon. The URL is resolved from this module, so it works
 * from the game, the menu and the tools pages alike.
 */
const BASE = new URL('../../content/icons/resources/', import.meta.url).href;

/** "Helium-3" → "helium-3", "Loam Grain" → "loam-grain". */
export const resourceId = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const resourceIconUrl = (id) => BASE + encodeURIComponent(id) + '.webp';

/** An <img> for the icon; decorative (the name is always printed beside it). */
export const resourceIconHtml = (id, cls = 'resi') =>
  `<img class="${cls}" src="${resourceIconUrl(id)}" alt="" width="256" height="256" loading="lazy" decoding="async" draggable="false">`;
