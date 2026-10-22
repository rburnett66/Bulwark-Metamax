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

## Map 1 for every faction (authored)

Since 2026-10-22 every faction ships its **own** map 1, built from its planet's recipe in
`docs/16 Bulwark MM/design/Faction-Terrain-Design.md` §2.3 and checked against the §1 fairness guardrails
[MM-story_mvjw67lo_f]. Powder's map 1 is unchanged. How they were made, and how to remake or re-roll one:

1. `node tools/maps/faction-maps.mjs [slug]` — search seeds for a recipe; prints the best that pass the guardrails;
2. `python tools/maps/forge-export.py jobs.json out.json` — the real Terrain Forge (headless) renders recipe + seed and
   exports exactly what "Export slot file" writes;
3. write `<slug>-map-1.json` here, then bake its 3D level: `node tools/terrain3d-proto/bake3d.mjs <slug>-map-1`.

`tools/maps/faction-maps.test.mjs` keeps each shipped map on its recipe, inside the guardrails, and in step with its
baked level. Hand-tuning a map in the Forge and exporting it here is fine — the test still applies.

## Playtest copies (retired for map 1)

The old stopgap gave every faction a **copy of Powder's map**, written by `node tools/maps/copy-faction-maps.mjs` and
stamped `"_copiedFrom": "powder-map-<n>"`. No copies remain. The script never overwrites a file without `_copiedFrom`,
so running it now changes nothing. Maps 2–9 have no forge files yet: they still come from the workbook generator, or
from a Powder slot saved in your browser (the runtime mirror, `TEMP_MIRROR_FACTION` in `src/main.js`).
