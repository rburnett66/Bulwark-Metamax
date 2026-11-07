/**
 * src/outpost/view/raidSeam.js — THE one place the outpost view gets its raid hook [MM-story_mw5oeer7_n].
 *
 * The model's advance() resolves each due raid through ctx.raid(outpost, raid) → { result, defenses } (tech plan
 * docs/tech-plan/Outpost.md §4, "As built (O2)"); without a hook a raid counts as held. Story O7 runs raids on the
 * battle sim (src/outpost/raid.js: runRaid / createRaid / makeRaidHook) [MM-story_mw5oegk1_o]; every due raid runs
 * headless on the outpost map through makeRaidHook.
 *
 * O7 plugs in HERE and nowhere else: import { makeRaidHook } from '../raid.js' and return makeRaidHook({ map, step }).
 * Every advance the view makes (on open, the live tick, before each action) takes its hook from this function.
 *
 * map: the outpost map (outpostMapFor); step: the planet's active contract step (1–3; it sets the raid size).
 * → a ctx.raid function, or undefined (raids held).
 */
import { makeRaidHook } from '../raid.js';

export function raidHookFor(map, step) {
  return map ? makeRaidHook({ map, step: step || 1 }) : undefined;
}
