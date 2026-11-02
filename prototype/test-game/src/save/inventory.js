/**
 * src/save/inventory.js — what the commander holds [MM-story_mvzkdvrl_1l]. Mission-Log-Design §12, tech plan D8.
 * save.inventory[resourceId] counts; save.inventoryNew is the same since the last visit.
 *
 * Harvest (owner default, 2026-11-02): every resource a harvester brings home goes to the inventory, and common and
 * uncommon still pay their gold in battle as they always did. Rare and epic are the quest crystals. The counts come
 * from the battle tally's deposit events at battle end; the sim is untouched and a replay banks nothing.
 */
const addTo = (s, id, n) => {
  s.inventory[id] = (s.inventory[id] || 0) + n;
  s.inventoryNew[id] = (s.inventoryNew[id] || 0) + n;
};

/** The resource of this planet + tier. A planet the catalogue does not list is a data defect, so it throws. */
export function resourceOf(catalog, planet, tier) {
  const r = catalog.resources.find((x) => x.planet === planet && x.tier === tier);
  if (!r) throw new Error('inventory: no ' + tier + ' resource on "' + planet + '"');
  return r;
}

/** Add one finished battle's harvest. → { [resourceId]: n }. */
export function bankHarvest(s, result, catalog) {
  const out = {};
  if (!result.tally || !result.planet) return out;
  for (const [tier, n] of Object.entries(result.tally.harvested)) {
    if (!(n > 0)) continue;
    const r = resourceOf(catalog, result.planet, tier);
    addTo(s, r.id, n);
    out[r.id] = n;
  }
  return out;
}

export const inventoryFresh = (s) => Object.values(s.inventoryNew || {}).reduce((a, n) => a + n, 0);

/** Opening the screen counts as the visit. → what was new, for the screen to show while it stays open. */
export function visitInventory(s) {
  const shown = s.inventoryNew || {};
  s.inventoryNew = {};
  return shown;
}

/** Every resource in the game, in campaign order, banded by planet. */
export function inventoryBands(s, catalog, isOpen, fresh = s.inventoryNew || {}) {
  const bands = new Map();
  for (const r of catalog.resources) {
    if (!bands.has(r.planet)) bands.set(r.planet, { planet: r.planet, faction: r.faction, open: !!isOpen(r.planet), resources: [], held: 0, fresh: 0 });
    const b = bands.get(r.planet), have = (s.inventory || {})[r.id] || 0, nw = fresh[r.id] || 0;
    b.resources.push({ ...r, have, fresh: nw });
    b.held += have; b.fresh += nw;
  }
  return [...bands.values()];
}

/** The missions that ask for this resource by name: what the detail pane lists under "Wanted by". */
export function wantedBy(catalog, name, limit = 3) {
  return catalog.missions.filter((m) => (m.complete || []).some((c) => (c.text || '').includes(name))).slice(0, limit)
    .map((m) => m.title + ' (' + m.role + ', ' + m.planet + ' ' + m.map + ')');
}
