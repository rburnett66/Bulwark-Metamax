/**
 * src/outpost/view/warnings.js — which buildings show a warning, and what it says [MM-story_mw6k9xec_5].
 *
 * Owner 2026-11-07 07:33: "Buildings with full storage or no electricity show a warning. no electricity means no
 * operation but the storage is maintained, but a storage tower with no electricity has a closed door and wont take
 * new resources." The rules are the model's (story O16 adds `warnings(o, map)` → { [padId]: ['no_power' |
 * 'storage_full' | 'door_closed'] }); until it is exported this derives the same from powerGrids().off and the bays.
 * Pure.
 */
import * as M from '../model.js';

export const WARN = Object.freeze({
  no_power: { icon: 'bolt', text: 'No power: stopped (its storage is kept)' },
  storage_full: { icon: 'crate', text: 'Storage full: sell to make room' },
  door_closed: { icon: 'door', text: 'No power: the door is shut, no new ore comes in' },
});

const units = (o, pad) => Object.values((o.storage || {})[pad] || {}).reduce((a, b) => a + b, 0);

/** → { [padId]: ['no_power' | 'storage_full' | 'door_closed', …] } for finished buildings with a problem. */
export function buildingWarnings(o, map, model = M) {
  if (typeof model.warnings === 'function') {
    const w = model.warnings(o, map) || {};
    const out = {};
    for (const [k, v] of Object.entries(w)) if (Array.isArray(v) && v.length) out[k] = [...v];
    return out;
  }
  const out = {};
  const add = (pad, w) => { (out[pad] = out[pad] || []).includes(w) || out[pad].push(w); };
  const { off } = model.powerGrids(o, map);
  for (const [id, b] of Object.entries(o.pads)) {
    if (b.kind === 'power') continue;
    if (off[id]) { add(id, 'no_power'); if (b.kind === 'storage') add(id, 'door_closed'); }
  }
  let all = 0, cap = 0;
  for (const [id, b] of Object.entries(o.pads)) {
    if (b.kind !== 'rig') continue;
    const u = units(o, id), c = model.bayCapacity(o, id, map);
    all += u; cap += c;
    if (c > 0 && u >= c - 1e-6) add(id, 'storage_full');
  }
  if (cap > 0 && all >= cap - 1e-6) for (const [id, b] of Object.entries(o.pads)) if (b.kind === 'storage') add(id, 'storage_full');
  return out;
}

/** The marker over a building: the most pressing warning (no power first). → 'no_power' | 'storage_full' | … | null */
export function markerOf(list) {
  if (!list || !list.length) return null;
  for (const k of ['no_power', 'door_closed', 'storage_full']) if (list.includes(k)) return k === 'door_closed' ? 'no_power' : k;
  return list[0];
}

/** The panel's lines for a building's warnings (door_closed folds the no-power line into itself). */
export function warningLines(list) {
  if (!list || !list.length) return [];
  const l = list.includes('door_closed') ? list.filter((x) => x !== 'no_power') : list;
  return l.map((k) => (WARN[k] ? WARN[k].text : String(k).replace(/_/g, ' ')));
}
