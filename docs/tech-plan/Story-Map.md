# Story Map — tech plan [MM-epic_mwtlwawp_f]

Owner, 2026-11-23: "Managing this complex a story will require a tool. We also need a graph which shows how the story
develops over a timeline. Prioritize shows branches that indicate the availability of missions over time. Also assume
the player is completing planets maps and waves in sequence. Highlight based on story themes (love, resources, tech,
unlocking game modes, etc.). Make the graph interactive and AAA. Allow the user to select a node or branch and see
details, dialog and criteria."

## Where it lives

`prototype/test-game/tools/story/` — `index.html` (page), `storyMap.js` (canvas view), `storyModel.js` (pure model),
`storyModel.test.mjs` (runs in `npm test`). Listed in the tool header (`tools/toolhead.js`) as **Story Map**.

## Source of truth

The map reads the live content files at load time, never a copy, so it cannot drift from the game:
`content/missions/missions.json` (271 missions, quest lines, capital ships), `content/characters/*.json` (cast per map,
secrets), `content/characters/threads.json` (love, rival, kin…), `content/dialog/voicepacks.json`,
`content/reveals/reveals.json` (outpost and farm lines aboard), `content/maps/mapdata.json` (rare offers). The wave-3
offer dialog is built by the game's own `contractOfferScene` (src/comm/mapCast.js), one code path.

## Model (storyModel.js)

- **Time** is one playthrough in sequence: planets in portal order (derived from the "Portal: X" rewards), map 1 → 9,
  wave 1 → 8. One unit = one map slot; wave w sits at slot + (w − 0.5)/8.
- **Nodes:** campaign maps (spine), light and shadow faction contracts (open once their map is won), outpost contracts
  (open with the capital ship), farm contracts (open when the planet is finished), wave-3 voices and rare offers,
  milestones (planet opens, capital ship in orbit, outposts open, farming opens).
- **Availability window** per node: `from` (can first be taken) → `due` (when a player in sequence would finish it) →
  open-ended (players can always return). Outpost and farm steps use `PACING` (assumed; owner to tune).
- **Branches** are quest lines (by variant); a contract branch forks from the campaign spine where it opens.
- **Themes** (love, rivalry, resources, tech, game modes, light & shadow, combat, secrets) are tagged from the data:
  love and rivalry from the threads between the people involved; resources from harvest/haul/deliver tasks and the
  outpost/farm contracts (not from reward kind, which nearly every mission has); tech from tech-node rewards and
  requirements; game modes from portals and the first outpost and farm; secrets from a character's first appearance.
- `density(t)`: missions open at t by kind, drawn as the "missions open over time" strip.

## View (storyMap.js)

Canvas 2D, DPR-aware; planet bands with globes; glowing spine; branch curves; availability capsules; theme halos and
ring segments; non-matching nodes dim. Wheel / pinch zooms time around the cursor, drag pans, the strip is a minimap
(click or drag to jump). Hover shows a card; click a node for DETAILS / DIALOG / CRITERIA, click a branch for its
steps. Keys: 1–8 themes, ← → step along the selected branch, F fit, Esc close, +/− zoom. `#<mission id>` deep-links.

## Open

- Outpost and farm pacing (`PACING`) is assumed; the owner may set it.
- Character secret missions and gifts (story_mwohmo7a_2z) are not in missions.json yet; the map shows secrets at a
  character's first appearance until they are.
