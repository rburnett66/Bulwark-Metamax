/**
 * shipRooms.js — which rooms a capital ship has (owner 2026-11-09: "All ships should have all neutral rooms and faction
 * specific rooms on the correct capital ships").
 *
 * Pure (no three.js): node-tested by shipRooms.test.mjs.
 *
 * - **Neutral rooms** are the ship's own functions, on every ship: Helm, Armory, Bar, Trade Station, Loading Bay and
 *   Engineering. On a faction ship the host faction crews them, and none is sealed.
 * - **The faction room** is one per faction, on that faction's ship only, in the upper deck's second slot. The Chapel
 *   is Arcane's, so it appears aboard the Arcane ship and no other faction ship.
 * - **The Collective's Long Ledger** is a trade hub with envoys from other factions. It keeps its authored layout
 *   (content/ships/collective/ship-layout.json), including the sealed Chapel and Engineering that teach standing locks
 *   in the opening (Collective-Opening-Design §5).
 *
 * Tech plan: docs/tech-plan/Capital-Ship-Interior.md §5.5.
 */

/** Room ids every ship has, as authored in the Long Ledger layout. */
export const NEUTRAL_ROOMS = Object.freeze(['helm', 'armory', 'bar', 'trade', 'loading', 'eng']);

/** The Long Ledger slot a faction ship gives to its own room. */
export const FACTION_SLOT = 'chapel';

/** Each faction's own room: its name, prop preset (primitiveRooms.js), light and the crew role in it. */
export const FACTION_ROOMS = Object.freeze({
  ground:    { id: 'warroom',     name: 'War Room',       props: 'warroom',     theme: 'warm', role: 'Field Marshal' },
  air:       { id: 'flightdeck',  name: 'Flight Deck',    props: 'flightdeck',  theme: 'cool', role: 'Wing Leader' },
  hightech:  { id: 'shieldlab',   name: 'Shield Lab',     props: 'shieldlab',   theme: 'cool', role: 'Chief Engineer' },
  artillery: { id: 'firecontrol', name: 'Fire Control',   props: 'firecontrol', theme: 'warm', role: 'Gunnery Master' },
  water:     { id: 'moonpool',    name: 'Moon Pool',      props: 'moonpool',    theme: 'cool', role: 'Tide Warden' },
  arcane:    { id: 'chapel',      name: 'Chapel',         props: 'chapel',      theme: 'warm', role: 'Confessor' },
  space:     { id: 'observatory', name: 'Observatory',    props: 'observatory', theme: 'cool', role: 'Navigator' },
  dark:      { id: 'voidshrine',  name: 'Void Shrine',    props: 'voidshrine',  theme: 'cool', role: 'Voice of the Choir' },
  greenies:  { id: 'greenhouse',  name: 'Greenhouse',     props: 'greenhouse',  theme: 'warm', role: 'Grower' },
});

/** The crew role in each neutral room, for its label aboard a faction ship. */
const NEUTRAL_ROLE = { helm: 'Bridge', armory: 'Quartermaster', bar: 'Steward', trade: 'Factor', loading: 'Ops Chief', eng: 'Chief Engineer' };

/**
 * A faction ship's layout from the Long Ledger's: the neutral rooms crewed by the host faction with no locks, and the
 * faction's own room in FACTION_SLOT. factionName is the display name for the room labels. The base is not changed.
 * → layout (the same shape prepareLayout takes)
 */
export function factionShipLayout(base, key, factionName = key) {
  const own = FACTION_ROOMS[key];
  if (!own) throw new Error(`no faction room for ${key}`);
  const L = JSON.parse(JSON.stringify(base));
  L.ship = key;
  L.rooms = L.rooms.flatMap((r) => {
    if (r.id === FACTION_SLOT) {
      return [{ id: own.id, name: own.name, fac: key, who: `${own.role} · ${factionName}`, flag: 'talk',
        x: r.x, top: r.top, w: r.w, h: r.h, fx: r.fx, props: own.props, theme: own.theme, faction: true }];
    }
    if (!NEUTRAL_ROOMS.includes(r.id)) return [];
    const n = { ...r, fac: key, who: `${NEUTRAL_ROLE[r.id] || r.name} · ${factionName}` };
    delete n.unlock; delete n.line;
    if (r.id === 'helm') n.cap = true;
    return [n];
  });
  return L;
}
