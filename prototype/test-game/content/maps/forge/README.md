# content/maps/forge/ — shipped Terrain Forge maps (THE mapping system)

Maps are **faction-owned**: a faction battle on map N loads the forge map authored for that
faction + slot. File naming (what the tool's "Export slot file" produces):

    <faction-slug>-map-<n>.json        e.g. powder-map-3.json, arcane-energy-map-1.json

Slugs come from the Terrain Forge slot names, lowercased, non-letters collapsed to `-`:
`powder`, `air`, `high-tech`, `artillery`, `water`, `arcane-energy`, `space-tech`,
`dark-energy`, `greenies`.

Game lookup order (src/main.js `loadForgeMap`):
1. localStorage slot `"<Faction> · map <n>"` — the authoring hot loop (terrain.html → Save to
   faction slot; same origin, no file handoff needed);
2. the committed file here — the ship path;
3. none → the OLD workbook generator (testing fallback only; all future map development happens
   in the forge).

Authoring loop: terrain.html → compose → **Save map to slot** (playable immediately in your
browser) → when final, **Export slot file** and commit it here.
