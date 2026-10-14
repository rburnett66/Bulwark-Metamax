/**
 * src/render3d/level.js — the baked level the 3D view loads, and the check that it belongs to the map
 * the sim is actually running (plan v2.2 §6.12: content is committed; the renderer uses the map the sim
 * builds, never a stale copy).
 *
 * `tools/terrain3d-proto/bake3d.mjs <slug>` writes content/maps/baked/<slug>/level.json + ground tiles.
 * The sim's blocking comes from buildTerrainMap → bakedBlocking, which depends on the bake tune; a local
 * tune (localStorage tf.bake.v1) can make the committed bake disagree with the board being played. That
 * must be SAID, on screen — not rendered as a plausible-looking wrong ground.
 *
 * Pure: no three.js, no DOM.
 */

/** Folder (relative to the game root) holding a map's baked 3D level. */
export function bakedLevelDir(slug) {
  return `content/maps/baked/${slug}/`;
}

/**
 * Compare a baked level.json with the map the sim built. Returns { ok, problems: [string] }.
 * Checks size, base cell and the blocked-cell set (the walkable grid the units actually path on).
 */
export function checkLevelAgainstMap(level, map) {
  const problems = [];
  if (!level || typeof level !== 'object') return { ok: false, problems: ['no baked level'] };
  if (!map || typeof map !== 'object') return { ok: false, problems: ['no map'] };
  if (level.cols !== map.cols || level.rows !== map.rows) {
    problems.push(`size ${level.cols}x${level.rows} baked, ${map.cols}x${map.rows} in the sim`);
    return { ok: false, problems };
  }
  if (map.base && level.base && (map.base.x !== level.base.x || map.base.y !== level.base.y)) {
    problems.push(`base at ${level.base.x},${level.base.y} baked, ${map.base.x},${map.base.y} in the sim`);
  }
  if (Array.isArray(map.blockedCells) && Array.isArray(level.blocked)) {
    const sim = new Set(map.blockedCells.map((c) => c.y * map.cols + c.x));
    const baked = new Set(level.blocked);
    let onlySim = 0, onlyBaked = 0;
    for (const i of sim) if (!baked.has(i)) onlySim++;
    for (const i of baked) if (!sim.has(i)) onlyBaked++;
    if (onlySim || onlyBaked) {
      problems.push(`blocking differs: ${onlySim} cell(s) blocked only in the sim, ${onlyBaked} only in the bake — re-run bake3d.mjs`);
    }
  }
  return { ok: problems.length === 0, problems };
}
