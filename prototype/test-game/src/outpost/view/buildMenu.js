/**
 * src/outpost/view/buildMenu.js — what is left of the old outpost build menu: the FARM view's placement state machine
 * and a few shared names [MM-story_mw6k9xec_5].
 *
 * The outpost builds on the battle rail and the battle's placement since S2.4d [MM-story_mwc9pkcd_2g]; with the map
 * pads gone (S2c.2 [MM-story_mwc9pmbn_2i]) the old menu's item list and its pad targets were deleted. The farm view
 * (outpostView.js, until S6) still arms, aims and confirms its pieces with placementStep below, and farm/view/farmUi.js
 * shapes its list like the old one. Pure: no DOM, no clock.
 */
import { structureDef, DEFENSE_KINDS } from '../../data/outpost.js';

/** The Resource Bay's kind in the data: 'resourceBay' once O16 renames it, else 'harvesterBay'. */
export const bayKind = () => (structureDef('resourceBay', 1) ? 'resourceBay' : 'harvesterBay');
export const isResourceBay = (kind) => kind === 'resourceBay' || kind === 'harvesterBay';

/** The list, top to bottom (owner): the buildings, the harvester, then the three defenses. */
export const MENU = Object.freeze([
  { id: 'power', label: 'POWER STATION', place: 'pad' },
  { id: 'rig', label: 'MINING STATION', place: 'pad' },
  { id: 'storage', label: 'STORAGE TOWER', place: 'pad' },
  { id: 'resourceBay', label: 'RESOURCE BAY', place: 'pad' },
  { id: 'upgradeBay', label: 'UPGRADE BAY', place: 'pad' },
  { id: 'habitat', label: 'HABITAT', place: 'pad' },   // story O15: raises the gun cap
  { id: 'harvester', label: 'HARVESTER', place: 'buy' },
  { id: 'wall', label: 'WALL', place: 'cell' },
  { id: 'mg', label: 'MACHINE GUN', place: 'cell' },
  { id: 'cannon', label: 'CANNON TOWER', place: 'cell' },
].map(Object.freeze));

/** The data kind a menu item builds (the Resource Bay resolves to the data's name for it). */
export const kindOf = (id) => (id === 'resourceBay' ? bayKind() : id);

/** The battle icon (render/buildIcons.js id) a menu item reuses, or null (outpost buildings render their GLBs). */
export const BATTLE_ICON = Object.freeze({ wall: 'wall', mg: 'mg', cannon: 'cannon', harvester: 'harvester' });
/** The GLB slug an outpost building's icon renders from (rig: per head, chosen at runtime). null → a drawn glyph. */
export const ICON_SLUG = Object.freeze({ power: 'power', storage: 'storage', rig: 'rig_auger', resourceBay: 'resourceBay', upgradeBay: 'upgradeBay', habitat: 'habitat' });   // the bays and the Habitat: their GLB once content/outposts/outposts.json lists the kind, else a glyph
/** The guns the gun cap counts (story O15): their list items show n / cap. */
export const GUN_ITEMS = Object.freeze(['mg', 'cannon']);


/** A finished Resource Bay stands (either name). */
export const hasResourceBay = (o) => Object.values(o.pads || {}).some((b) => isResourceBay(b.kind));
/** Is target t one of the targets (same pad / same cell)? */
export const sameTarget = (a, b) => !!(a && b && (a.pad ? a.pad === b.pad : a.cell && b.cell && a.cell[0] === b.cell[0] && a.cell[1] === b.cell[1]));
export const targetIn = (targets, t) => !!t && targets.some((x) => sameTarget(x, t));

// ── the placement state machine ──────────────────────────────────────────────────────────────────────────────────
/**
 * The battle's pick → preview → build loop, as a reducer. state: { phase: 'idle' | 'armed' | 'aimed', item, target }.
 *   pick(item)      arm it (picking the armed item again disarms, as the battle palette's toggle)
 *   hover(target)   the mouse: the ghost follows the pointer (aimed while over the map)
 *   tap(target, { touch }) a valid target: the mouse builds at once; a touch aims there first (the ghost and CONFIRM),
 *                   and a second tap on the same target builds. An invalid target says so and stays armed.
 *   confirm         build at the aimed target       cancel   back to the list
 *   placed          a defense stays armed (several walls in a row, as in battle); a building returns to the list
 * Every step → { state, effect }; effect: null | { type: 'place', item, target } | { type: 'invalid', target } |
 * { type: 'buy', item } (the harvester is bought straight from the list, as the battle's harvester button).
 * targets: the armed item's valid targets (validTargets), passed in by the caller with each event.
 */
export const IDLE = Object.freeze({ phase: 'idle', item: null, target: null });

export function placementStep(state, ev, targets = []) {
  const s = state || IDLE;
  switch (ev.type) {
    case 'pick': {
      if (!ev.item) return { state: IDLE, effect: null };
      if (ev.item.place === 'buy') return { state: IDLE, effect: ev.item.enabled ? { type: 'buy', item: ev.item } : { type: 'locked', item: ev.item } };
      if (!ev.item.enabled) return { state: s, effect: { type: 'locked', item: ev.item } };
      if (s.item && s.item.id === ev.item.id) return { state: IDLE, effect: null };
      return { state: { phase: 'armed', item: ev.item, target: ev.target && targetIn(targets, ev.target) ? ev.target : null }, effect: null };
    }
    case 'hover': {
      if (s.phase === 'idle') return { state: s, effect: null };
      if (ev.touch) return { state: s, effect: null };   // a finger aims by tapping
      return { state: { ...s, phase: ev.target ? 'aimed' : 'armed', target: ev.target || null }, effect: null };
    }
    case 'tap': {
      if (s.phase === 'idle') return { state: s, effect: null };
      if (!ev.target || !targetIn(targets, ev.target)) return { state: s, effect: { type: 'invalid', target: ev.target || null } };
      if (!ev.touch || (s.phase === 'aimed' && sameTarget(s.target, ev.target))) return { state: { ...s, phase: 'aimed', target: ev.target }, effect: { type: 'place', item: s.item, target: ev.target } };
      return { state: { ...s, phase: 'aimed', target: ev.target }, effect: null };
    }
    case 'confirm': {
      if (s.phase !== 'aimed' || !targetIn(targets, s.target)) return { state: s, effect: s.phase === 'idle' ? null : { type: 'invalid', target: s.target } };
      return { state: s, effect: { type: 'place', item: s.item, target: s.target } };
    }
    case 'cancel': return { state: IDLE, effect: null };
    case 'placed': {
      if (s.item && s.item.place === 'cell') return { state: { phase: 'armed', item: s.item, target: null }, effect: null };
      return { state: IDLE, effect: null };
    }
    default: return { state: s, effect: null };
  }
}

/** Is the aimed target a valid build spot (the ghost's colour)? */
export const aimValid = (state, targets) => !!(state && state.target && targetIn(targets, state.target));

/** The DEFENSE kinds' battle structure ids (the battle renderer's own placement ghost draws them). */
export const DEFENSE_STRUCT = Object.freeze({ mg: 'STR-MG', cannon: 'STR-Cannon', wall: 'STR-Wall' });
export { DEFENSE_KINDS };
