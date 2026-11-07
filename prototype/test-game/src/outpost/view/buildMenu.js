/**
 * src/outpost/view/buildMenu.js — the outpost's build menu, as data, and its placement state machine
 * [MM-story_mw6k9xec_5].
 *
 * Owner 2026-11-07: "building an outpost should be done the same way the tower defense game works. An icon list with
 * cost on the left side of the screen with icons and prices. The user start with the base building and use their own
 * gold to build power and a mining station. Harvester can be purchased and there is a limited set of defenses - wall,
 * machine gun, turret tower." Follow-ups: the Storage Tower is a required purchase; the turret tower is the battle's
 * Cannon Tower; harvesters are bought from the list but only once the Resource Bay (the renamed Harvester Bay) stands.
 *
 * The battle's build palette (render/hud.js, input/input.js) is the pattern: a column of picture + name + price
 * buttons down the left; pick one to arm it; the ghost follows the pointer, cyan where it fits and red where it does
 * not; a tap on a lit spot builds; picking it again, Esc or right-click disarms. On a touch screen the outpost asks for
 * a second tap (or CONFIRM) before spending gold, because a pad building costs thousands.
 *
 * Pure: no DOM, no clock. Prices come from the data (structureDef → MAPDATA), so a price change in the workbook flows
 * in; which pads or cells take an item is asked of the model itself (model.place on a copy), so the menu never
 * disagrees with the rules. Story O16 changes those rules (a hub-only contract, gold-bought buildings, the Resource Bay,
 * buyHarvester); every O16 API is read optionally here, so this works before and after it lands:
 *   - model.buyHarvester(o, ctx) → { outpost, cost } | { error }  (absent → the harvester stays locked)
 *   - model.harvesterRefusal(o, ctx) → reason | null; the count is o.harvesters; price and cap from data
 *     harvesterDef() → { cost, cap, max } (absent → OUTPOST.Harvester_Cap / the 'harvester' structure row)
 *   - kind 'resourceBay' (absent → 'harvesterBay'; a built 'harvesterBay' counts as a Resource Bay)
 * (O16 landed at 60d65ee with all of these; the fallbacks stay so an old save or a trimmed data file still draws.)
 */
import * as M from '../model.js';
import * as D from '../../data/outpost.js';
import { structureDef, OUTPOST, DEFENSE_KINDS } from '../../data/outpost.js';

const harvesterDef = D.harvesterDef;   // O16 (src/data/outpost.js): { cost, value, cap, max }
import { oresOf } from '../../data/ores.js';
import { defenseRing } from '../../terrain/outpostPads.js';

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
export const ICON_SLUG = Object.freeze({ power: 'power', storage: 'storage', rig: 'rig_auger', resourceBay: null, upgradeBay: null });

const has = (ctx, id) => (ctx.unlocks instanceof Set ? ctx.unlocks.has(id) : (ctx.unlocks || []).includes(id));
const nice = (s) => String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');

/** A finished Resource Bay stands (either name). */
export const hasResourceBay = (o) => Object.values(o.pads || {}).some((b) => isResourceBay(b.kind));
/** Something of this kind is built or under construction. */
const present = (o, kind) => Object.values(o.pads || {}).some((b) => b.kind === kind || (isResourceBay(kind) && isResourceBay(b.kind)))
  || (o.building || []).some((b) => b.kind === kind || (isResourceBay(kind) && isResourceBay(b.kind)));

// ── the harvester (O16's API read optionally) ─────────────────────────────────────────────────────────────────────
/**
 * → { count, max (what the Resource Bay holds now: Harvester_Cap), price (null when the data has none), api
 *   (buyHarvester is exported), refusal (model.harvesterRefusal's reason ignoring gold, or null) }
 */
export function harvesterInfo(o, model = M) {
  const h = o.harvesters;
  const count = Array.isArray(h) ? h.length : typeof h === 'number' ? h : (h && typeof h.count === 'number') ? h.count : 0;
  const def = typeof harvesterDef === 'function' ? harvesterDef() : null;
  const max = (def && (def.cap ?? def.max)) ?? OUTPOST.Harvester_Cap ?? OUTPOST.Harvester_Max ?? 4;
  const price = def ? def.cost : (structureDef('harvester', 1) || {}).cost ?? null;
  const refusal = typeof model.harvesterRefusal === 'function' ? model.harvesterRefusal(o, { gold: Infinity }) : null;
  return { count, max, price, api: typeof model.buyHarvester === 'function', refusal };
}

// ── where an item can go ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * The targets an item can be built on now, ignoring the price: pads ({ pad }) or defense cells ({ cell: [x, y] }).
 * Asked of model.place on a copy with unlimited gold, so the rules decide (pad roles, deposits and their unlocks, a
 * taken cell, a gun cap). → { targets: [...], error (the model's reason when there are none) }
 */
export function validTargets(o, map, id, ctx = {}, model = M) {
  const item = MENU.find((m) => m.id === id);
  if (!item || item.place === 'buy') return { targets: [], error: null };
  const kind = kindOf(id);
  const probe = { ...ctx, map, gold: Infinity, now: ctx.now ?? o.t };
  let error = null;
  const ok = (what) => { const r = model.place(o, what, probe); if (r && !r.error) return true; error = error || (r && r.error) || 'cannot build here'; return false; };
  if (item.place === 'pad') {
    const free = map.pads.filter((p) => !o.pads[p.id] && !(o.building || []).some((b) => b.pad === p.id));
    return { targets: free.filter((p) => ok({ pad: p.id, kind })).map((p) => ({ pad: p.id })), error };
  }
  const taken = new Set(o.defenses.map((d) => d.cell.join(',')));
  const cells = defenseRing(map).filter((c) => !taken.has(c.join(',')));
  return { targets: cells.filter((c) => ok({ cell: c, kind })).map((c) => ({ cell: [...c] })), error };
}

/** Is target t one of the targets (same pad / same cell)? */
export const sameTarget = (a, b) => !!(a && b && (a.pad ? a.pad === b.pad : a.cell && b.cell && a.cell[0] === b.cell[0] && a.cell[1] === b.cell[1]));
export const targetIn = (targets, t) => !!t && targets.some((x) => sameTarget(x, t));

/** The model's refusal, worded for the player. */
export function whyText(error, id, o) {
  const e = String(error || '');
  if (!e) return null;
  let m;
  if ((m = e.match(/not unlocked \((?:tech:)?([^)]+)\)/))) return `Needs ${nice(m[1])}`;
  if ((m = e.match(/the (\w+) ore is not unlocked/))) { const ore = oresOf(o.planet).find((x) => x.tier === m[1]); return `${ore ? ore.name : nice(m[1])} is not unlocked yet`; }
  if (/a rig goes on a deposit|cannot go on a rig/.test(e) || id === 'rig') return 'No free deposit';
  if (/cap|crew|limit|max/i.test(e)) return 'Gun limit reached · build a Habitat';
  if (/taken|cannot go on/.test(e)) return 'No free pad';
  return e.replace(/^./, (c) => c.toUpperCase());
}

// ── the menu ─────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The build menu's items, in order. ctx: { gold, unlockedTiers, unlocks, now }.
 * → [{ id, kind, label, place, cost, poor, locked, why, enabled, targets, count?, max?, guide, key }]
 *   cost: the price (null when the data has none); poor: cost > gold (greyed, price red — the battle palette's bw-poor);
 *   locked: no target, not unlocked, the harvester's bay missing or its cap reached — why says which;
 *   enabled: can be picked now (not locked, not poor); guide: the item the first-run guidance points at.
 */
export function buildMenu(o, map, ctx = {}, model = M) {
  const gold = ctx.gold ?? Infinity;
  const guide = guideStep(o);
  return MENU.map((m, i) => {
    const kind = kindOf(m.id);
    const out = { id: m.id, kind, label: m.label, place: m.place, key: i + 1 < 10 ? String(i + 1) : null, guide: guide === m.id };
    if (m.place === 'buy') {
      const h = harvesterInfo(o, model);
      Object.assign(out, { cost: h.price, count: h.count, max: h.max, targets: [] });
      if (!hasResourceBay(o)) out.why = 'Build a Resource Bay first';
      else if (!h.api) out.why = 'Harvesters are not for sale yet';
      else if (h.count >= h.max) out.why = `The Resource Bay is full (${h.count}/${h.max})`;
      else if (h.refusal) out.why = h.refusal.replace(/^./, (c) => c.toUpperCase());
      out.locked = !!out.why;
    } else {
      const def = structureDef(kind, 1);
      out.cost = def ? def.cost : null;
      if (!def) { out.locked = true; out.why = 'Not available yet'; out.targets = []; } else {
        const { targets, error } = validTargets(o, map, m.id, ctx, model);
        out.targets = targets;
        out.locked = !targets.length;
        out.why = out.locked ? whyText(error, m.id, o) || 'No free pad' : null;
      }
    }
    out.poor = out.cost != null && out.cost > gold;
    if (!out.locked && out.poor) out.why = `Costs ${fmt(out.cost)} gold`;
    out.enabled = !out.locked && !out.poor && (m.place !== 'buy' || out.cost != null);
    return out;
  });
}

/**
 * First-run guidance (subtle, like the battle's pulsing hint): until the outpost is online, point at the first of
 * Power Station → Mining Station → Storage Tower the outpost lacks (built or building). → menu id or null.
 * (Contract step 1 asks for all three, though a rig without storage still mines, at a tiny capacity — owner 07:33.)
 */
export function guideStep(o) {
  if (o.online) return null;
  for (const id of ['power', 'rig', 'storage']) if (!present(o, id)) return id;
  return null;
}

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
