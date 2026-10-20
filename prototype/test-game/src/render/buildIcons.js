/**
 * src/render/buildIcons.js — the BUILD menu's items: picture, name, model [MM-story_mvg3xsca_1x].
 *
 * Owner 2026-10-19: "make icons for the menu that use stylized images of each item with the name of the item —
 * cannon, flak gun, wall, land mine, rockets, antiair, harvester". Each button shows a picture of the item's own
 * 3D model, baked by tools/icons/bake.html to content/icons/build/<id>.png, with its name under it.
 * Pure data (node-tested); hud.js draws the buttons.
 */
export const BUILD_ICONS = Object.freeze([
  { id: 'cannon',    structId: 'STR-Cannon',  label: 'CANNON',    model: 'sys_cannon', zoom: 0.82 },
  { id: 'flak',      structId: 'STR-Flak',    label: 'FLAK GUN',  model: 'sys_flak' },
  { id: 'wall',      structId: 'STR-Wall',    label: 'WALL',      model: 'sys_wall', yaw: 90 },
  { id: 'mine',      structId: 'STR-Mine',    label: 'LAND MINE', model: 'mine' },     // no battlefield model: stylized in the bake
  { id: 'rockets',   structId: 'STR-Rockets', label: 'ROCKETS',   model: 'sys_rockets' },
  { id: 'antiair',   structId: 'STR-Missile', label: 'ANTI-AIR',  model: 'sys_missile' },
  { id: 'harvester', structId: null,          label: 'HARVESTER', model: 'sys_harvester' },   // bought at the base
]);

/** The icon record for a structure id (or 'harvester'), or null. */
export function buildIcon(structIdOrHarvester) {
  return BUILD_ICONS.find((i) => i.structId === structIdOrHarvester || (structIdOrHarvester === 'harvester' && i.id === 'harvester')) || null;
}

/** The baked picture's URL, relative to the game page. */
export const buildIconUrl = (icon) => 'content/icons/build/' + icon.id + '.png';
